import { Readable } from "node:stream"
import { google } from "googleapis"
import { createAdminClient } from "@/lib/supabase/admin"

const DRIVE_SCOPE = ["https://www.googleapis.com/auth/drive"]
const DRIVE_LIST_OPTIONS = {
  supportsAllDrives: true,
  includeItemsFromAllDrives: true,
} as const
const DRIVE_WRITE_OPTIONS = {
  supportsAllDrives: true,
} as const

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

export function describeDriveError(error: unknown) {
  if (error instanceof Error && error.message) {
    return error.message
  }

  if (typeof error === "object" && error !== null) {
    const candidate = error as {
      code?: number
      message?: string
      errors?: Array<{ message?: string }>
      response?: { data?: { error?: { message?: string } } }
    }

    const apiMessage = candidate.response?.data?.error?.message
    if (typeof apiMessage === "string" && apiMessage) {
      return apiMessage
    }

    const nestedMessage = candidate.errors?.find((item) => typeof item?.message === "string")?.message
    if (nestedMessage) {
      return nestedMessage
    }

    if (typeof candidate.message === "string" && candidate.message) {
      return candidate.message
    }

    if (typeof candidate.code === "number") {
      return `Erro do Google Drive (${candidate.code}).`
    }
  }

  return "Falha ao acessar o Google Drive."
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
  const clientId = normalizeEnvValue(GOOGLE_OAUTH_CLIENT_ID)
  const clientSecret = normalizeEnvValue(GOOGLE_OAUTH_CLIENT_SECRET)
  const redirectUrl = normalizeEnvValue(GOOGLE_OAUTH_REDIRECT_URL)

  if (!clientId || !clientSecret || !redirectUrl) {
    throw new Error("Google OAuth nao configurado.")
  }

  return new google.auth.OAuth2(
    clientId,
    clientSecret,
    redirectUrl
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
  const folderId = normalizeEnvValue(GOOGLE_DRIVE_FOLDER_ID)

  if (!folderId) {
    throw new Error("Drive folder id nao configurado.")
  }

  return folderId
}

// Em desenvolvimento o callback precisa voltar para a propria origem, senao o cookie de sessao nao acompanha.
export function resolveDriveRedirectUrl(requestUrl: string) {
  const origin = new URL(requestUrl).origin

  if (origin.startsWith("http://localhost") || origin.startsWith("http://127.0.0.1")) {
    return `${origin}/api/drive/oauth/callback`
  }

  return normalizeEnvValue(GOOGLE_OAUTH_REDIRECT_URL) ?? ""
}

export async function getDriveClients() {
  const clients: GoogleDriveClient[] = []

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

  const list = await drive.files.list({
    q,
    fields: "files(id, name)",
    ...DRIVE_LIST_OPTIONS,
  })

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
    ...DRIVE_WRITE_OPTIONS,
  })

  return created.data.id as string
}

export async function findFolder(drive: GoogleDriveClient, name: string, parentId: string) {
  const q = [
    "mimeType='application/vnd.google-apps.folder'",
    `name='${name.replace(/'/g, "\\'")}'`,
    `'${parentId}' in parents`,
    "trashed=false",
  ].join(" and ")

  const list = await drive.files.list({
    q,
    fields: "files(id, name)",
    ...DRIVE_LIST_OPTIONS,
  })

  return list.data.files?.[0] || null
}

export async function findLatestFileInFolder(drive: GoogleDriveClient, parentId: string) {
  const q = [
    `'${parentId}' in parents`,
    "mimeType!='application/vnd.google-apps.folder'",
    "trashed=false",
  ].join(" and ")

  const list = await drive.files.list({
    q,
    fields: "files(id, name, mimeType, modifiedTime)",
    orderBy: "modifiedTime desc",
    pageSize: 1,
    ...DRIVE_LIST_OPTIONS,
  })

  return list.data.files?.[0] || null
}

export async function findFile(drive: GoogleDriveClient, name: string, parentId: string) {
  const q = [
    `name='${name.replace(/'/g, "\\'")}'`,
    `'${parentId}' in parents`,
    "trashed=false",
  ].join(" and ")

  const list = await drive.files.list({
    q,
    fields: "files(id, name, modifiedTime)",
    ...DRIVE_LIST_OPTIONS,
  })
  return list.data.files?.[0] || null
}

export async function readJsonFile<T>(drive: GoogleDriveClient, fileId: string): Promise<T | null> {
  const buffer = await readDriveFileContent(drive, fileId)
  const text = buffer.toString("utf-8")
  if (!text) return null

  try {
    return JSON.parse(text) as T
  } catch {
    return null
  }
}

export async function readDriveFileContent(drive: GoogleDriveClient, fileId: string): Promise<Buffer> {
  const response = await drive.files.get(
    { fileId, alt: "media", supportsAllDrives: true },
    { responseType: "arraybuffer" }
  )

  return Buffer.from(response.data as ArrayBuffer)
}

export async function upsertJsonFile(drive: GoogleDriveClient, parentId: string, fileName: string, payload: unknown) {
  const content = Buffer.from(JSON.stringify(payload, null, 2))
  return upsertBinaryFile(drive, parentId, fileName, content, "application/json")
}

export async function upsertBinaryFile(
  drive: GoogleDriveClient,
  parentId: string,
  fileName: string,
  content: Buffer,
  mimeType: string,
) {
  const existing = await findFile(drive, fileName, parentId)

  if (existing?.id) {
    return drive.files.update({
      fileId: existing.id,
      media: {
        mimeType,
        body: Readable.from(content),
      },
      fields: "id, name",
      ...DRIVE_WRITE_OPTIONS,
    })
  }

  return drive.files.create({
    requestBody: {
      name: fileName,
      parents: [parentId],
    },
    media: {
      mimeType,
      body: Readable.from(content),
    },
    fields: "id, name",
    ...DRIVE_WRITE_OPTIONS,
  })
}