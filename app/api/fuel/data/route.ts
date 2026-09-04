import { NextResponse } from "next/server"
import {
  getFuelMonthKey,
  getFuelMonthOptions,
  getFuelRecordsForMonth,
  readLocalFuelData,
  readLocalFuelHistory,
  readLocalFuelMetadata,
  reconcileFuelMonths,
  saveLocalFuelData,
  saveLocalFuelHistory,
  saveLocalFuelMetadata,
  sanitizeFuelStorage,
  type FuelImportMetadata,
  type FuelMonthArchive,
  type FuelRecord,
} from "@/lib/fuel-storage"
import {
  ensureFolder,
  findFile,
  getDriveClients,
  getDriveRootFolderId,
  isDriveConfigured,
  readJsonFile,
  upsertJsonFile,
} from "@/lib/google-drive"
import { parseFuelDateTime } from "@/lib/fuel-datetime"

export const runtime = "nodejs"

const FUEL_FOLDER_NAME = "combustivel"
const FUEL_DATA_FILE = "fuel_data.json"
const FUEL_HISTORY_FILE = "fuel_history.json"
const FUEL_META_FILE = "fuel_meta.json"
const WEEKLY_COMPARISON_COLORS = ["#4E8F57", "#4F9BC9", "#D89A4A", "#D86C61"]
const FUEL_CACHE_TTL_MS = 60_000

let fuelDataCache:
  | {
      cachedAt: number
      currentRecords: FuelRecord[]
      history: FuelMonthArchive[]
      metadata: FuelImportMetadata
      loadedFromDrive: boolean
    }
  | null = null

type WeeklyComparisonMonth = {
  key: string
  label: string
  color: string
}

type WeeklyComparisonPoint = {
  weekLabel: string
} & Record<string, string | number>

function normalizeDuplicateToken(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase()
}

function buildDuplicateMinuteKey(value: string): string {
  const date = parseFuelDateTime(value)
  if (Number.isNaN(date.getTime())) return value.slice(0, 16)

  const year = date.getFullYear()
  const month = `${date.getMonth() + 1}`.padStart(2, "0")
  const day = `${date.getDate()}`.padStart(2, "0")
  const hour = `${date.getHours()}`.padStart(2, "0")
  const minute = `${date.getMinutes()}`.padStart(2, "0")

  return `${year}-${month}-${day} ${hour}:${minute}`
}

function scoreApiFuelRecord(record: FuelRecord): number {
  let score = 0

  if (record.cardPlate.trim()) score += 2
  if (record.cpfMotorista.trim()) score += 3
  if (record.nomeMotorista.trim()) score += 2
  if (!normalizeDuplicateToken(record.nomeMotorista).includes("veiculo sem motorista")) score += 1
  if (record.dateTime.length >= 19) score += 1
  if (typeof record.km === "number" && record.km > 0) score += 1

  return score
}

function collapseFuelRecords(records: FuelRecord[]): FuelRecord[] {
  const deduped = new Map<string, FuelRecord>()

  for (const record of records) {
    const key = [
      normalizeDuplicateToken(record.cardPlate),
      normalizeDuplicateToken(record.tipoCombustivel),
      Number(record.valor.toFixed(2)),
      buildDuplicateMinuteKey(record.dateTime),
    ].join("|")

    const current = deduped.get(key)
    if (!current) {
      deduped.set(key, record)
      continue
    }

    deduped.set(key, scoreApiFuelRecord(record) >= scoreApiFuelRecord(current) ? record : current)
  }

  return Array.from(deduped.values()).sort((left, right) => left.dateTime.localeCompare(right.dateTime))
}

function buildWeeklyComparison(currentRecords: FuelRecord[], history: FuelMonthArchive[]) {
  const allMonths = getFuelMonthOptions(currentRecords, history).slice(0, 3).reverse()
  const months: WeeklyComparisonMonth[] = allMonths.map((month, index) => ({
    key: month.month,
    label: month.label,
    color: WEEKLY_COMPARISON_COLORS[index % WEEKLY_COMPARISON_COLORS.length],
  }))

  const points: WeeklyComparisonPoint[] = Array.from({ length: 5 }, (_, index) => ({
    weekLabel: `Semana ${index + 1}`,
  }))

  for (const month of months) {
    const monthRecords = getFuelRecordsForMonth(month.key, currentRecords, history)

    for (const record of monthRecords) {
      const recordDate = parseFuelDateTime(record.dateTime)
      if (Number.isNaN(recordDate.getTime())) continue

      const weekIndex = Math.min(4, Math.floor((recordDate.getDate() - 1) / 7))
      const currentValue = Number(points[weekIndex][month.key] ?? 0)
      points[weekIndex][month.key] = currentValue + record.valor
    }
  }

  return { months, points }
}

function parseDateParam(value: string | null): Date | null {
  if (!value) return null

  const [year, month, day] = value.split("-").map(Number)
  if (!year || !month || !day) return null

  return new Date(year, month - 1, day)
}

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

function endOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999)
}

function normalizeRangeBounds(start: Date, end: Date) {
  return start <= end
    ? { start: new Date(start), end: new Date(end) }
    : { start: new Date(end), end: new Date(start) }
}

function getAllFuelRecords(currentRecords: FuelRecord[], history: FuelMonthArchive[]): FuelRecord[] {
  return collapseFuelRecords([...currentRecords, ...history.flatMap((month) => month.records)])
}

function getRangeFilterDate(record: FuelRecord, dateField: "transaction" | "posting") {
  const sourceValue = dateField === "posting" ? record.postingDate || record.dateTime : record.dateTime
  return parseFuelDateTime(sourceValue)
}

function filterFuelRecordsByRange(
  records: FuelRecord[],
  start: Date,
  end: Date,
  dateField: "transaction" | "posting" = "transaction",
  endExclusive = false
): FuelRecord[] {
  const normalizedBounds = normalizeRangeBounds(start, end)
  const normalizedStart = startOfDay(normalizedBounds.start)
  const normalizedEnd = endExclusive ? startOfDay(normalizedBounds.end) : endOfDay(normalizedBounds.end)

  return records.filter((record) => {
    const recordDate = getRangeFilterDate(record, dateField)
    if (Number.isNaN(recordDate.getTime())) return false

    return endExclusive
      ? recordDate >= normalizedStart && recordDate < normalizedEnd
      : recordDate >= normalizedStart && recordDate <= normalizedEnd
  })
}

function readFuelCache() {
  if (!fuelDataCache) return null
  if (Date.now() - fuelDataCache.cachedAt > FUEL_CACHE_TTL_MS) return null
  return fuelDataCache
}

function writeFuelCache(
  currentRecords: FuelRecord[],
  history: FuelMonthArchive[],
  metadata: FuelImportMetadata,
  loadedFromDrive: boolean
) {
  fuelDataCache = {
    cachedAt: Date.now(),
    currentRecords,
    history,
    metadata,
    loadedFromDrive,
  }
}

async function syncFuelFilesToDrive(currentRecords: FuelRecord[], history: FuelMonthArchive[], metadata: FuelImportMetadata) {
  try {
    const rootId = getDriveRootFolderId()
    const driveClients = await getDriveClients()

    for (const drive of driveClients) {
      try {
        const fuelFolderId = await ensureFolder(drive, FUEL_FOLDER_NAME, rootId)
        await upsertJsonFile(drive, fuelFolderId, FUEL_DATA_FILE, currentRecords)
        await upsertJsonFile(drive, fuelFolderId, FUEL_HISTORY_FILE, history)
        await upsertJsonFile(drive, fuelFolderId, FUEL_META_FILE, metadata)
        return true
      } catch {
        // Tenta o próximo cliente de autenticação.
      }
    }
  } catch {
    // Mantem apenas o espelho local.
  }

  return false
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url)
    const requestedMonth = url.searchParams.get("month")
    const requestedStart = parseDateParam(url.searchParams.get("start"))
    const requestedEnd = parseDateParam(url.searchParams.get("end"))
    const dateField = url.searchParams.get("dateField") === "posting" ? "posting" : "transaction"
    const endExclusive = url.searchParams.get("endExclusive") === "true"
    const currentMonthKey = getFuelMonthKey(new Date())
    const driveConfigured = isDriveConfigured()
    const cached = readFuelCache()
    let currentRecords: FuelRecord[]
    let history: FuelMonthArchive[]
    let metadata: FuelImportMetadata
    let loadedFromDrive: boolean

    if (cached) {
      currentRecords = cached.currentRecords
      history = cached.history
      metadata = cached.metadata
      loadedFromDrive = cached.loadedFromDrive
    } else {
      currentRecords = await readLocalFuelData()
      history = await readLocalFuelHistory()
      metadata = await readLocalFuelMetadata()
      loadedFromDrive = false

      try {
        const rootId = getDriveRootFolderId()
        const driveClients = await getDriveClients()

        for (const drive of driveClients) {
          try {
            const fuelFolderId = await ensureFolder(drive, FUEL_FOLDER_NAME, rootId)
            const currentFile = await findFile(drive, FUEL_DATA_FILE, fuelFolderId)
            const historyFile = await findFile(drive, FUEL_HISTORY_FILE, fuelFolderId)
            const metaFile = await findFile(drive, FUEL_META_FILE, fuelFolderId)

            const driveCurrent = currentFile?.id ? await readJsonFile<FuelRecord[]>(drive, currentFile.id) : []
            const driveHistory = historyFile?.id ? await readJsonFile<FuelMonthArchive[]>(drive, historyFile.id) : []
            const driveMetadata = metaFile?.id ? await readJsonFile<FuelImportMetadata>(drive, metaFile.id) : null

            if (currentFile?.id || historyFile?.id || metaFile?.id) {
              currentRecords = Array.isArray(driveCurrent) ? driveCurrent : []
              history = Array.isArray(driveHistory) ? driveHistory : []
              metadata = {
                lastImportedAt:
                  typeof driveMetadata?.lastImportedAt === "string"
                    ? driveMetadata.lastImportedAt
                    : currentFile?.modifiedTime ?? null,
              }
              await saveLocalFuelData(currentRecords)
              await saveLocalFuelHistory(history)
              await saveLocalFuelMetadata(metadata)
              loadedFromDrive = true
              break
            }
          } catch {
            // Tenta o proximo cliente de autenticacao.
          }
        }
      } catch {
        // Cai para o espelho local abaixo.
      }

      writeFuelCache(currentRecords, history, metadata, loadedFromDrive)
    }

    const sanitized = sanitizeFuelStorage(currentRecords, history)
    currentRecords = collapseFuelRecords(sanitized.currentRecords)
    history = sanitized.history.map((month) => ({
      ...month,
      records: collapseFuelRecords(month.records),
    }))

    const reconciled = reconcileFuelMonths(currentRecords, history)
    currentRecords = reconciled.currentRecords
    history = reconciled.history

    if (sanitized.removedCurrent > 0 || sanitized.removedHistory > 0 || reconciled.archivedMonths.length > 0) {
      await saveLocalFuelData(currentRecords)
      await saveLocalFuelHistory(history)
      await saveLocalFuelMetadata(metadata)
      await syncFuelFilesToDrive(currentRecords, history, metadata)
      writeFuelCache(currentRecords, history, metadata, loadedFromDrive)
    }

    const availableMonths = getFuelMonthOptions(currentRecords, history)
    const selectedMonth =
      requestedMonth && availableMonths.some((month) => month.month === requestedMonth)
        ? requestedMonth
        : currentMonthKey

    const records =
      requestedStart && requestedEnd
        ? filterFuelRecordsByRange(getAllFuelRecords(currentRecords, history), requestedStart, requestedEnd, dateField, endExclusive)
        : selectedMonth
          ? getFuelRecordsForMonth(selectedMonth, currentRecords, history)
          : []
    const weeklyComparison = buildWeeklyComparison(currentRecords, history)
    const hasHistory = availableMonths.some((month) => month.recordCount > 0)
    const warning =
      records.length === 0 && !hasHistory
        ? "Nenhum relatório importado ainda. O sistema vai arquivar automaticamente cada mês fechado."
        : driveConfigured && !loadedFromDrive && currentRecords.length > 0
          ? "Dados carregados do espelho local. Verifique o acesso da conta de serviço ao Drive."
          : undefined

    return NextResponse.json({
      records,
      warning,
      lastImportedAt: metadata.lastImportedAt,
      availableMonths,
      weeklyComparison,
      selectedMonth,
      currentMonth: currentMonthKey,
    })
  } catch (err) {
    console.error("[fuel/data] unexpected error", err)

    const message = err instanceof Error ? err.message : "Erro desconhecido"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
