import { NextResponse } from "next/server"
import { google } from "googleapis"
import { createAdminClient } from "@/lib/supabase/admin"

export const runtime = "nodejs"

const DRIVE_FOLDER_ID = process.env.GOOGLE_DRIVE_FOLDER_ID
const GOOGLE_OAUTH_CLIENT_ID = process.env.GOOGLE_OAUTH_CLIENT_ID
const GOOGLE_OAUTH_CLIENT_SECRET = process.env.GOOGLE_OAUTH_CLIENT_SECRET
const GOOGLE_OAUTH_REDIRECT_URL = process.env.GOOGLE_OAUTH_REDIRECT_URL
const FUEL_FOLDER_NAME = "combustivel"
const FUEL_DATA_FILE = "fuel_data.json"

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

async function findFile(drive: ReturnType<typeof google.drive>, name: string, parentId: string) {
  const q = [
    `name='${name.replace(/'/g, "\\'")}'`,
    `'${parentId}' in parents`,
    "trashed=false",
  ].join(" and ")

  const list = await drive.files.list({
    q,
    fields: "files(id, name)",
  })

  return list.data.files?.[0] || null
}

async function readFuelData(drive: ReturnType<typeof google.drive>, fileId: string) {
  const response = await drive.files.get(
    { fileId, alt: "media" },
    { responseType: "arraybuffer" }
  )

  const buffer = Buffer.from(response.data as ArrayBuffer)
  const text = buffer.toString("utf-8")
  if (!text) return []

  try {
    const parsed = JSON.parse(text)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export async function GET() {
  try {
    const drive = await getDriveClient()
    const rootId = DRIVE_FOLDER_ID as string
    const fuelFolderId = await ensureFolder(drive, FUEL_FOLDER_NAME, rootId)
    const file = await findFile(drive, FUEL_DATA_FILE, fuelFolderId)

    if (!file?.id) {
      return NextResponse.json({ records: [] })
    }

    const records = await readFuelData(drive, file.id)
    return NextResponse.json({ records })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro desconhecido"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
