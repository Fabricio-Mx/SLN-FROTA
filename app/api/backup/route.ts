import { NextResponse } from "next/server"
import { Readable } from "node:stream"
import { google } from "googleapis"
import { createAdminClient } from "@/lib/supabase/admin"
import { verifySession } from "@/lib/auth"

export const runtime = "nodejs"

const DRIVE_FOLDER_ID = process.env.GOOGLE_DRIVE_FOLDER_ID
const GOOGLE_OAUTH_CLIENT_ID = process.env.GOOGLE_OAUTH_CLIENT_ID
const GOOGLE_OAUTH_CLIENT_SECRET = process.env.GOOGLE_OAUTH_CLIENT_SECRET
const GOOGLE_OAUTH_REDIRECT_URL = process.env.GOOGLE_OAUTH_REDIRECT_URL
const BACKUP_FOLDER_NAME = "backups"
const BACKUP_RETENTION_DAYS = 30

function getOAuthClient() {
  if (!GOOGLE_OAUTH_CLIENT_ID || !GOOGLE_OAUTH_CLIENT_SECRET || !GOOGLE_OAUTH_REDIRECT_URL) {
    throw new Error("Google OAuth nao configurado.")
  }

  return new google.auth.OAuth2(
    GOOGLE_OAUTH_CLIENT_ID,
    GOOGLE_OAUTH_CLIENT_SECRET,
    GOOGLE_OAUTH_REDIRECT_URL
  )
}

async function getStoredRefreshToken() {
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from("drive_tokens")
    .select("refresh_token")
    .eq("id", "default")
    .maybeSingle()

  if (error) {
    throw new Error("Falha ao carregar token do Drive.")
  }

  return data?.refresh_token || null
}

async function getDriveClient() {
  if (!DRIVE_FOLDER_ID) {
    throw new Error("Drive folder id nao configurado.")
  }

  const refreshToken = await getStoredRefreshToken()
  if (!refreshToken) {
    throw new Error("Drive nao autorizado. Acesse /api/drive/oauth/start.")
  }

  const auth = getOAuthClient()
  auth.setCredentials({ refresh_token: refreshToken })

  return google.drive({ version: "v3", auth })
}

async function ensureFolder(drive: ReturnType<typeof google.drive>, name: string, parentId: string) {
  const q = [
    "mimeType='application/vnd.google-apps.folder'",
    `name='${name.replace(/'/g, "\\'")}'`,
    `'${parentId}' in parents`,
    "trashed=false",
  ].join(" and ")

  const list = await drive.files.list({
    q,
    fields: "files(id, name)",
  })

  if (list.data.files && list.data.files.length > 0) {
    return list.data.files[0].id as string
  }

  const created = await drive.files.create({
    requestBody: {
      name,
      mimeType: "application/vnd.google-apps.folder",
      parents: [parentId],
    },
    fields: "id",
  })

  return created.data.id as string
}

async function listFolders(drive: ReturnType<typeof google.drive>, parentId: string) {
  const q = [
    "mimeType='application/vnd.google-apps.folder'",
    `'${parentId}' in parents`,
    "trashed=false",
  ].join(" and ")

  const list = await drive.files.list({
    q,
    fields: "files(id, name)",
  })

  return list.data.files || []
}

async function listFiles(drive: ReturnType<typeof google.drive>, parentId: string) {
  const q = [
    "mimeType!='application/vnd.google-apps.folder'",
    `'${parentId}' in parents`,
    "trashed=false",
  ].join(" and ")

  const list = await drive.files.list({
    q,
    fields: "files(id, name, createdTime)",
  })

  return list.data.files || []
}

async function pruneOldBackups(drive: ReturnType<typeof google.drive>, backupRootId: string) {
  const cutoff = new Date(Date.now() - BACKUP_RETENTION_DAYS * 24 * 60 * 60 * 1000)

  const years = await listFolders(drive, backupRootId)
  for (const year of years) {
    if (!year.id) continue
    const months = await listFolders(drive, year.id)
    for (const month of months) {
      if (!month.id) continue
      const days = await listFolders(drive, month.id)
      for (const day of days) {
        if (!day.id) continue
        const files = await listFiles(drive, day.id)
        for (const file of files) {
          const created = file.createdTime ? new Date(file.createdTime) : null
          if (created && created < cutoff && file.id) {
            await drive.files.delete({ fileId: file.id })
          }
        }
      }
    }
  }
}

function buildFileName() {
  const now = new Date()
  const pad = (value: number) => value.toString().padStart(2, "0")
  return `backup_${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}.json`
}

export async function POST() {
  const session = await verifySession()
  if (!session || session.role !== "mestre") {
    return NextResponse.json({ error: "Sem permissao" }, { status: 403 })
  }

  try {
    const supabase = createAdminClient()

    const [vehiclesRes, colaboradoresRes, profilesRes, driveTokensRes] = await Promise.all([
      supabase.from("fleet_vehicles").select("*"),
      supabase.from("fleet_colaboradores").select("*"),
      supabase.from("profiles").select("*"),
      supabase.from("drive_tokens").select("*"),
    ])

    if (vehiclesRes.error || colaboradoresRes.error || profilesRes.error || driveTokensRes.error) {
      const message =
        vehiclesRes.error?.message ||
        colaboradoresRes.error?.message ||
        profilesRes.error?.message ||
        driveTokensRes.error?.message
      return NextResponse.json({ error: message || "Falha ao carregar dados." }, { status: 500 })
    }

    const { data: authUsers, error: authUsersError } = await supabase.auth.admin.listUsers({
      page: 1,
      perPage: 1000,
    })

    if (authUsersError) {
      return NextResponse.json({ error: authUsersError.message }, { status: 500 })
    }

    const payload = {
      generatedAt: new Date().toISOString(),
      vehicles: vehiclesRes.data || [],
      colaboradores: colaboradoresRes.data || [],
      profiles: profilesRes.data || [],
      driveTokens: driveTokensRes.data || [],
      authUsers: (authUsers?.users || []).map((user) => ({
        id: user.id,
        email: user.email,
        created_at: user.created_at,
        role: user.user_metadata?.role || null,
      })),
    }

    const drive = await getDriveClient()
    const rootId = DRIVE_FOLDER_ID as string
    const backupRootId = await ensureFolder(drive, BACKUP_FOLDER_NAME, rootId)

    const now = new Date()
    const yearFolderId = await ensureFolder(drive, String(now.getFullYear()), backupRootId)
    const monthFolderId = await ensureFolder(drive, String(now.getMonth() + 1).padStart(2, "0"), yearFolderId)
    const dayFolderId = await ensureFolder(drive, String(now.getDate()).padStart(2, "0"), monthFolderId)

    const content = Buffer.from(JSON.stringify(payload, null, 2))
    const stream = Readable.from(content)

    const created = await drive.files.create({
      requestBody: {
        name: buildFileName(),
        parents: [dayFolderId],
      },
      media: {
        mimeType: "application/json",
        body: stream,
      },
      fields: "id, name, webViewLink, webContentLink",
    })

    try {
      await pruneOldBackups(drive, backupRootId)
    } catch {
      // Ignore cleanup failures to avoid blocking backup.
    }

    return NextResponse.json({ success: true, file: created.data })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro desconhecido"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
