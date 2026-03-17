import { Readable } from "node:stream"
import { google } from "googleapis"
import { createAdminClient } from "@/lib/supabase/admin"

const DRIVE_SCOPE = ["https://www.googleapis.com/auth/drive"]

const GOOGLE_DRIVE_FOLDER_ID = process.env.GOOGLE_DRIVE_FOLDER_ID
const GOOGLE_DRIVE_CLIENT_EMAIL = process.env.GOOGLE_DRIVE_CLIENT_EMAIL
const GOOGLE_DRIVE_PRIVATE_KEY = process.env.GOOGLE_DRIVE_PRIVATE_KEY
const GOOGLE_OAUTH_CLIENT_ID = process.env.GOOGLE_OAUTH_CLIENT_ID
const GOOGLE_OAUTH_CLIENT_SECRET = process.env.GOOGLE_OAUTH_CLIENT_SECRET
const GOOGLE_OAUTH_REDIRECT_URL = process.env.GOOGLE_OAUTH_REDIRECT_URL

export type GoogleDriveClient = ReturnType<typeof google.drive>

function normalizeEnvValue(value?: string) {
  return value?.replace(/^"|"$/g, "")
}

function normalizePrivateKey(value?: string) {
  return normalizeEnvValue(value)?.replace(/\\n/g, "\n")
}

export function isDriveConfigured() {
  const hasFolderId = Boolean(normalizeEnvValue(GOOGLE_DRIVE_FOLDER_ID))
  const hasServiceAccount = Boolean(normalizeEnvValue(GOOGLE_DRIVE_CLIENT_EMAIL) && normalizePrivateKey(GOOGLE_DRIVE_PRIVATE_KEY))
  const hasOAuthConfig = Boolean(
    normalizeEnvValue(GOOGLE_OAUTH_CLIENT_ID) &&
      normalizeEnvValue(GOOGLE_OAUTH_CLIENT_SECRET) &&
      normalizeEnvValue(GOOGLE_OAUTH_REDIRECT_URL)
  )

  return hasFolderId && (hasServiceAccount || hasOAuthConfig)
}

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

export function getDriveRootFolderId() {
  if (!GOOGLE_DRIVE_FOLDER_ID) {
    throw new Error("Drive folder id nao configurado.")
  }

  return GOOGLE_DRIVE_FOLDER_ID
}

export async function getDriveClients() {
  const clients: GoogleDriveClient[] = []

  const serviceAccountEmail = normalizeEnvValue(GOOGLE_DRIVE_CLIENT_EMAIL)
  const serviceAccountKey = normalizePrivateKey(GOOGLE_DRIVE_PRIVATE_KEY)
  if (serviceAccountEmail && serviceAccountKey) {
    const serviceAuth = new google.auth.JWT({
      email: serviceAccountEmail,
      key: serviceAccountKey,
      scopes: DRIVE_SCOPE,
    })

    clients.push(google.drive({ version: "v3", auth: serviceAuth }))
  }

  try {
    const refreshToken = await getStoredRefreshToken()
    if (refreshToken) {
      const auth = getOAuthClient()
      auth.setCredentials({ refresh_token: refreshToken })
      clients.push(google.drive({ version: "v3", auth }))
    }
  } catch {
    // OAuth e apenas fallback aqui.
  }

  if (clients.length === 0) {
    throw new Error("Drive nao configurado para acesso ao combustivel.")
  }

  return clients
}

export async function ensureFolder(drive: GoogleDriveClient, name: string, parentId: string) {
  const q = [
    "mimeType='application/vnd.google-apps.folder'",
    `name='${name.replace(/'/g, "\\'")}'`,
    `'${parentId}' in parents`,
    "trashed=false",
  ].join(" and ")

  const list = await drive.files.list({ q, fields: "files(id, name)" })

  if (list.data.files?.length) {
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

export async function findFile(drive: GoogleDriveClient, name: string, parentId: string) {
  const q = [
    `name='${name.replace(/'/g, "\\'")}'`,
    `'${parentId}' in parents`,
    "trashed=false",
  ].join(" and ")

  const list = await drive.files.list({ q, fields: "files(id, name)" })
  return list.data.files?.[0] || null
}

export async function readJsonFile<T>(drive: GoogleDriveClient, fileId: string): Promise<T | null> {
  const response = await drive.files.get(
    { fileId, alt: "media" },
    { responseType: "arraybuffer" }
  )

  const buffer = Buffer.from(response.data as ArrayBuffer)
  const text = buffer.toString("utf-8")
  if (!text) return null

  try {
    return JSON.parse(text) as T
  } catch {
    return null
  }
}

export async function upsertJsonFile(drive: GoogleDriveClient, parentId: string, fileName: string, payload: unknown) {
  const content = Buffer.from(JSON.stringify(payload, null, 2))
  const existing = await findFile(drive, fileName, parentId)

  if (existing?.id) {
    return drive.files.update({
      fileId: existing.id,
      media: {
        mimeType: "application/json",
        body: Readable.from(content),
      },
      fields: "id, name",
    })
  }

  return drive.files.create({
    requestBody: {
      name: fileName,
      parents: [parentId],
    },
    media: {
      mimeType: "application/json",
      body: Readable.from(content),
    },
    fields: "id, name",
  })
}