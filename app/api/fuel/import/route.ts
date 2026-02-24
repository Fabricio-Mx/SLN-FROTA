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

type FuelRecord = {
  cardPlate: string
  cpfMotorista: string
  nomeMotorista: string
  tipoCombustivel: string
  valor: number
  dateTime: string
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

async function readFuelData(drive: ReturnType<typeof google.drive>, fileId: string): Promise<FuelRecord[]> {
  const response = await drive.files.get(
    { fileId, alt: "media" },
    { responseType: "arraybuffer" }
  )

  const buffer = Buffer.from(response.data as ArrayBuffer)
  const text = buffer.toString("utf-8")
  if (!text) return []

  try {
    const parsed = JSON.parse(text)
    return Array.isArray(parsed) ? (parsed as FuelRecord[]) : []
  } catch {
    return []
  }
}

async function saveFuelData(drive: ReturnType<typeof google.drive>, parentId: string, records: FuelRecord[]) {
  const content = Buffer.from(JSON.stringify(records, null, 2))

  const existing = await findFile(drive, FUEL_DATA_FILE, parentId)
  if (existing?.id) {
    const updated = await drive.files.update({
      fileId: existing.id,
      media: {
        mimeType: "application/json",
        body: content,
      },
      fields: "id, name",
    })
    return updated.data
  }

  const created = await drive.files.create({
    requestBody: {
      name: FUEL_DATA_FILE,
      parents: [parentId],
    },
    media: {
      mimeType: "application/json",
      body: content,
    },
    fields: "id, name",
  })

  return created.data
}

function decodeCsv(buffer: Buffer): string {
  const utf8 = buffer.toString("utf-8")
  if (utf8.includes("\uFFFD")) {
    return buffer.toString("latin1")
  }
  return utf8
}

function detectDelimiter(line: string): string {
  const commas = (line.match(/,/g) || []).length
  const semicolons = (line.match(/;/g) || []).length
  return semicolons >= commas ? ";" : ","
}

function parseCsvLine(line: string, delimiter: string): string[] {
  const result: string[] = []
  let current = ""
  let inQuotes = false

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i]

    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"'
        i += 1
      } else {
        inQuotes = !inQuotes
      }
      continue
    }

    if (char === delimiter && !inQuotes) {
      result.push(current)
      current = ""
      continue
    }

    current += char
  }

  result.push(current)
  return result
}

function parseDateTimeBr(value: string): string | null {
  if (!value) return null
  const parts = value.trim().split(" ")
  const datePart = parts[0]
  const timePart = parts[1] || "00:00:00"

  const [day, month, year] = datePart.split(/[\/-]/).map(Number)
  if (!day || !month || !year) return null

  const [hour = 0, minute = 0, second = 0] = timePart.split(":").map(Number)
  const date = new Date(year, month - 1, day, hour, minute, second)
  if (Number.isNaN(date.getTime())) return null

  return date.toISOString()
}

function parseCurrency(value: string): number {
  if (!value) return 0
  const normalized = value.replace(/\./g, "").replace(/,/g, ".")
  const parsed = Number.parseFloat(normalized)
  return Number.isFinite(parsed) ? parsed : 0
}

function buildKey(record: FuelRecord): string {
  return [record.cardPlate, record.cpfMotorista, record.dateTime, record.valor].join("|")
}

export async function POST(req: Request) {
  try {
    const formData = await req.formData()
    const file = formData.get("file") as File | null

    if (!file) {
      return NextResponse.json({ error: "Arquivo nao enviado." }, { status: 400 })
    }

    const buffer = Buffer.from(await file.arrayBuffer())
    const text = decodeCsv(buffer)
    const lines = text.split(/\r?\n/).filter(Boolean)
    if (lines.length === 0) {
      return NextResponse.json({ error: "CSV vazio." }, { status: 400 })
    }

    const delimiter = detectDelimiter(lines[0])
    const rows = lines.map((line) => parseCsvLine(line, delimiter))

    const records: FuelRecord[] = []
    for (let i = 1; i < rows.length; i += 1) {
      const row = rows[i]

      const cardPlate = row[8] || ""
      const cpfMotorista = row[13] || ""
      const nomeMotorista = row[14] || ""
      const tipoCombustivel = row[26] || ""
      const valor = parseCurrency(row[29] || "")
      const dateTimeRaw = row[5] || ""
      const dateTime = parseDateTimeBr(dateTimeRaw)

      if (!cardPlate && !cpfMotorista && !nomeMotorista) continue
      if (!dateTime) continue

      records.push({
        cardPlate: cardPlate.trim(),
        cpfMotorista: cpfMotorista.trim(),
        nomeMotorista: nomeMotorista.trim(),
        tipoCombustivel: tipoCombustivel.trim(),
        valor,
        dateTime,
      })
    }

    const drive = await getDriveClient()
    const rootId = DRIVE_FOLDER_ID as string
    const fuelFolderId = await ensureFolder(drive, FUEL_FOLDER_NAME, rootId)

    const existing = await findFile(drive, FUEL_DATA_FILE, fuelFolderId)
    const stored = existing?.id ? await readFuelData(drive, existing.id) : []
    const map = new Map(stored.map((item) => [buildKey(item), item]))

    for (const record of records) {
      map.set(buildKey(record), record)
    }

    const merged = Array.from(map.values())
      .sort((a, b) => a.dateTime.localeCompare(b.dateTime))

    const fileInfo = await saveFuelData(drive, fuelFolderId, merged)

    return NextResponse.json({
      success: true,
      imported: records.length,
      total: merged.length,
      file: fileInfo,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro desconhecido"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
