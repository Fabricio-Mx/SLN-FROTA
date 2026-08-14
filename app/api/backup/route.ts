import { NextResponse } from "next/server"
import { Readable } from "node:stream"
import { createAdminClient } from "@/lib/supabase/admin"
import { verifySession } from "@/lib/auth"
import { ensureFolder, getDriveClients, getDriveRootFolderId, type GoogleDriveClient } from "@/lib/google-drive"
import packageJson from "@/package.json"

export const runtime = "nodejs"

const BACKUP_FOLDER_NAME = "backups"
const BACKUP_RETENTION_DAYS = 30
const DRIVE_REAUTH_CODE = "DRIVE_REAUTH_REQUIRED"

function hasCronAuthorization(req: Request) {
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret) {
    return false
  }

  return req.headers.get("authorization") === `Bearer ${cronSecret}`
}

function getApplicationMetadata() {
  return {
    name: packageJson.name,
    version: packageJson.version,
    commitSha: process.env.VERCEL_GIT_COMMIT_SHA || process.env.GIT_COMMIT_SHA || null,
    generatedFromBranch: process.env.VERCEL_GIT_COMMIT_REF || process.env.GIT_BRANCH || null,
  }
}

type DriveRouteError = Error & { code?: string }

async function clearStoredRefreshToken() {
  const supabase = createAdminClient()
  await supabase.from("drive_tokens").delete().eq("id", "default")
}

function isInvalidGrantError(error: unknown) {
  const messages: string[] = []

  if (error instanceof Error && error.message) {
    messages.push(error.message)
  }

  if (typeof error === "object" && error !== null) {
    const code = (error as { code?: unknown }).code
    if (typeof code === "string") {
      messages.push(code)
    }

    const responseData = (error as { response?: { data?: unknown } }).response?.data
    if (typeof responseData === "string") {
      messages.push(responseData)
    } else if (responseData) {
      messages.push(JSON.stringify(responseData))
    }
  }

  return messages.some((message) => message.toLowerCase().includes("invalid_grant"))
}

async function listFolders(drive: GoogleDriveClient, parentId: string) {
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

async function listFiles(drive: GoogleDriveClient, parentId: string) {
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

async function pruneOldBackups(drive: GoogleDriveClient, backupRootId: string) {
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

async function getWritableDriveClient() {
  const rootId = getDriveRootFolderId()
  const driveClients = await getDriveClients()

  for (const drive of driveClients) {
    try {
      await drive.files.get({ fileId: rootId, fields: "id", supportsAllDrives: true })
      return { drive, rootId }
    } catch {
      // Tenta o próximo cliente configurado.
    }
  }

  const error = new Error("Google Drive precisa ser autorizado novamente.") as DriveRouteError
  error.code = DRIVE_REAUTH_CODE
  throw error
}

async function createBackupFile() {
  try {
    const supabase = createAdminClient()

    const [vehiclesRes, colaboradoresRes, profilesRes] = await Promise.all([
      supabase.from("fleet_vehicles").select("*"),
      supabase.from("fleet_colaboradores").select("*"),
      supabase.from("profiles").select("*"),
    ])

    if (vehiclesRes.error || colaboradoresRes.error || profilesRes.error) {
      const message =
        vehiclesRes.error?.message ||
        colaboradoresRes.error?.message ||
        profilesRes.error?.message
      throw new Error(message || "Falha ao carregar dados.")
    }

    const { data: authUsers, error: authUsersError } = await supabase.auth.admin.listUsers({
      page: 1,
      perPage: 1000,
    })

    if (authUsersError) {
      throw new Error(authUsersError.message)
    }

    const payload = {
      generatedAt: new Date().toISOString(),
      application: getApplicationMetadata(),
      vehicles: vehiclesRes.data || [],
      colaboradores: colaboradoresRes.data || [],
      profiles: profilesRes.data || [],
      authUsers: (authUsers?.users || []).map((user) => ({
        id: user.id,
        email: user.email,
        created_at: user.created_at,
        role: user.user_metadata?.role || null,
      })),
    }

    const { drive, rootId } = await getWritableDriveClient()
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

    return created.data
  } catch (err) {
    if (isInvalidGrantError(err)) {
      await clearStoredRefreshToken()
      const error = new Error("Google Drive precisa ser autorizado novamente.") as DriveRouteError
      error.code = DRIVE_REAUTH_CODE
      throw error
    }

    if (typeof err === "object" && err !== null && "code" in err && (err as DriveRouteError).code === DRIVE_REAUTH_CODE) {
      throw err
    }

    throw err
  }
}

function toBackupErrorResponse(err: unknown) {
  if (typeof err === "object" && err !== null && "code" in err && (err as DriveRouteError).code === DRIVE_REAUTH_CODE) {
    return NextResponse.json(
      {
        error: err instanceof Error ? err.message : "Google Drive precisa ser autorizado novamente.",
        code: DRIVE_REAUTH_CODE,
      },
      { status: 409 }
    )
  }

  const message = err instanceof Error ? err.message : "Erro desconhecido"
  return NextResponse.json({ error: message }, { status: 500 })
}

export async function GET(req: Request) {
  if (!hasCronAuthorization(req)) {
    return NextResponse.json({ error: "Nao autorizado para execucao automatica." }, { status: 401 })
  }

  try {
    const file = await createBackupFile()
    return NextResponse.json({ success: true, file, triggeredBy: "cron" })
  } catch (err) {
    return toBackupErrorResponse(err)
  }
}

export async function POST() {
  const session = await verifySession()
  if (!session || session.role !== "mestre") {
    return NextResponse.json({ error: "Sem permissao" }, { status: 403 })
  }

  try {
    const file = await createBackupFile()
    return NextResponse.json({ success: true, file, triggeredBy: "manual" })
  } catch (err) {
    return toBackupErrorResponse(err)
  }
}
