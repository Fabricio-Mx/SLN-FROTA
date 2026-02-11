import { NextResponse } from "next/server"
import { Readable } from "node:stream"
import { google } from "googleapis"
import { createAdminClient } from "@/lib/supabase/admin"

export const runtime = "nodejs"

const DRIVE_FOLDER_ID = process.env.GOOGLE_DRIVE_FOLDER_ID
const GOOGLE_OAUTH_CLIENT_ID = process.env.GOOGLE_OAUTH_CLIENT_ID
const GOOGLE_OAUTH_CLIENT_SECRET = process.env.GOOGLE_OAUTH_CLIENT_SECRET
const GOOGLE_OAUTH_REDIRECT_URL = process.env.GOOGLE_OAUTH_REDIRECT_URL

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

function sanitizeName(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "_")
    .replace(/^_+|_+$/g, "")
}

export async function POST(req: Request) {
  try {
    const drive = getDriveClient()
    const formData = await req.formData()

    const file = formData.get("file") as File | null
    const entityType = String(formData.get("entityType") || "geral")
    const entityId = String(formData.get("entityId") || "sem-id")
    const label = String(formData.get("label") || "arquivo")

    if (!file) {
      return NextResponse.json({ error: "Arquivo nao enviado." }, { status: 400 })
    }

    const rootId = DRIVE_FOLDER_ID as string
    const typeFolderId = await ensureFolder(drive, sanitizeName(entityType), rootId)
    const entityFolderId = await ensureFolder(drive, sanitizeName(entityId), typeFolderId)

    const fileBuffer = Buffer.from(await file.arrayBuffer())
    const stream = Readable.from(fileBuffer)

    const safeName = sanitizeName(file.name || "arquivo")
    const finalName = `${sanitizeName(label)}_${Date.now()}_${safeName}`

    const created = await drive.files.create({
      requestBody: {
        name: finalName,
        parents: [entityFolderId],
      },
      media: {
        mimeType: file.type || "application/octet-stream",
        body: stream,
      },
      fields: "id, name, webViewLink, webContentLink, mimeType, size",
    })

    return NextResponse.json(created.data)
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro desconhecido"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
