import { mkdir, readFile, stat, writeFile } from "node:fs/promises"
import path from "node:path"
import { parseFuelDateTime } from "@/lib/fuel-datetime"

export type FuelRecord = {
  cardPlate: string
  cpfMotorista: string
  nomeMotorista: string
  tipoCombustivel: string
  valor: number
  dateTime: string
  postingDate?: string | null
}

export type FuelMonthArchive = {
  month: string
  archivedAt: string
  records: FuelRecord[]
}

export type FuelMonthOption = {
  month: string
  label: string
  recordCount: number
  total: number
  source: "current" | "history"
}

export type FuelImportMetadata = {
  lastImportedAt: string | null
}

export type FuelStorageSanitization = {
  currentRecords: FuelRecord[]
  history: FuelMonthArchive[]
  removedCurrent: number
  removedHistory: number
}

const FUEL_DATA_DIR = path.join(process.cwd(), "data", "fuel")
const FUEL_DATA_FILE = path.join(FUEL_DATA_DIR, "fuel_data.json")
const FUEL_HISTORY_FILE = path.join(FUEL_DATA_DIR, "fuel_history.json")
const FUEL_META_FILE = path.join(FUEL_DATA_DIR, "fuel_meta.json")

function isReadonlyFilesystemError(error: unknown): boolean {
  if (!(error instanceof Error) || !("code" in error)) return false

  const code = (error as NodeJS.ErrnoException).code
  return code === "EROFS" || code === "EPERM" || code === "EACCES"
}

export function buildFuelRecordKey(record: FuelRecord): string {
  return [record.cardPlate, record.cpfMotorista, record.dateTime, record.valor].join("|")
}

export function getFuelMonthKey(value: Date | string): string | null {
  const date = parseFuelDateTime(value)
  if (Number.isNaN(date.getTime())) return null

  const year = date.getFullYear()
  const month = `${date.getMonth() + 1}`.padStart(2, "0")
  return `${year}-${month}`
}

export function formatFuelMonthLabel(monthKey: string): string {
  const [year, month] = monthKey.split("-").map(Number)
  const date = new Date(year, (month || 1) - 1, 1)
  if (Number.isNaN(date.getTime())) return monthKey

  return new Intl.DateTimeFormat("pt-BR", {
    month: "long",
    year: "numeric",
  }).format(date)
}

function sortFuelRecords(records: FuelRecord[]): FuelRecord[] {
  return [...records].sort((left, right) => left.dateTime.localeCompare(right.dateTime))
}

function normalizeFuelIdentity(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase()
}

function toMinuteKey(value: string): string {
  const date = parseFuelDateTime(value)
  if (Number.isNaN(date.getTime())) return value.slice(0, 16)

  const year = date.getFullYear()
  const month = `${date.getMonth() + 1}`.padStart(2, "0")
  const day = `${date.getDate()}`.padStart(2, "0")
  const hour = `${date.getHours()}`.padStart(2, "0")
  const minute = `${date.getMinutes()}`.padStart(2, "0")

  return `${year}-${month}-${day} ${hour}:${minute}`
}

function buildFuelDuplicateKey(record: FuelRecord): string {
  const roundedValue = Number(record.valor.toFixed(2))

  return [
    normalizeFuelIdentity(record.cardPlate),
    normalizeFuelIdentity(record.tipoCombustivel),
    roundedValue,
    toMinuteKey(record.dateTime),
  ].join("|")
}

function scoreFuelRecord(record: FuelRecord): number {
  let score = 0

  if (record.cardPlate.trim()) score += 2
  if (record.cpfMotorista.trim()) score += 3
  if (record.nomeMotorista.trim()) score += 2
  if (!normalizeFuelIdentity(record.nomeMotorista).includes("veiculo sem motorista")) score += 1
  if (record.dateTime.length >= 19) score += 1
  if (record.postingDate?.trim()) score += 1

  return score
}

function preferFuelRecord(current: FuelRecord, candidate: FuelRecord): FuelRecord {
  const currentScore = scoreFuelRecord(current)
  const candidateScore = scoreFuelRecord(candidate)

  if (candidateScore > currentScore) return candidate
  if (candidateScore < currentScore) return current

  return candidate.dateTime >= current.dateTime ? candidate : current
}

export function dedupeFuelRecords(records: FuelRecord[]): FuelRecord[] {
  const deduped = new Map<string, FuelRecord>()

  for (const record of records) {
    const duplicateKey = buildFuelDuplicateKey(record)
    const current = deduped.get(duplicateKey)

    if (!current) {
      deduped.set(duplicateKey, record)
      continue
    }

    deduped.set(duplicateKey, preferFuelRecord(current, record))
  }

  return sortFuelRecords(Array.from(deduped.values()))
}

function mergeFuelRecords(existing: FuelRecord[], incoming: FuelRecord[]): FuelRecord[] {
  return dedupeFuelRecords([...existing, ...incoming])
}

function normalizeFuelHistory(months: FuelMonthArchive[]): FuelMonthArchive[] {
  return [...months]
    .map((month) => ({
      month: month.month,
      archivedAt: month.archivedAt,
      records: dedupeFuelRecords(month.records ?? []),
    }))
    .sort((left, right) => right.month.localeCompare(left.month))
}

export function sanitizeFuelStorage(currentRecords: FuelRecord[], history: FuelMonthArchive[]): FuelStorageSanitization {
  const sanitizedCurrent = dedupeFuelRecords(currentRecords)
  const sanitizedHistory = normalizeFuelHistory(history)
  const historyOriginalCount = history.reduce((sum, month) => sum + (month.records?.length ?? 0), 0)
  const historySanitizedCount = sanitizedHistory.reduce((sum, month) => sum + month.records.length, 0)

  return {
    currentRecords: sanitizedCurrent,
    history: sanitizedHistory,
    removedCurrent: Math.max(0, currentRecords.length - sanitizedCurrent.length),
    removedHistory: Math.max(0, historyOriginalCount - historySanitizedCount),
  }
}

function upsertFuelArchive(history: FuelMonthArchive[], monthKey: string, records: FuelRecord[]): FuelMonthArchive[] {
  if (records.length === 0) return normalizeFuelHistory(history)

  const existing = history.find((entry) => entry.month === monthKey)
  const nextEntry: FuelMonthArchive = {
    month: monthKey,
    archivedAt: new Date().toISOString(),
    records: mergeFuelRecords(existing?.records ?? [], records),
  }

  return normalizeFuelHistory([
    ...history.filter((entry) => entry.month !== monthKey),
    nextEntry,
  ])
}

export function replaceFuelArchiveMonth(history: FuelMonthArchive[], monthKey: string, records: FuelRecord[]): FuelMonthArchive[] {
  if (records.length === 0) {
    return normalizeFuelHistory(history.filter((entry) => entry.month !== monthKey))
  }

  return normalizeFuelHistory([
    ...history.filter((entry) => entry.month !== monthKey),
    {
      month: monthKey,
      archivedAt: new Date().toISOString(),
      records: sortFuelRecords(records),
    },
  ])
}

export function removeFuelMonthRecords(
  monthKey: string,
  currentRecords: FuelRecord[],
  history: FuelMonthArchive[],
  referenceDate: Date = new Date()
): {
  currentRecords: FuelRecord[]
  history: FuelMonthArchive[]
} {
  const currentMonthKey = getFuelMonthKey(referenceDate)

  if (monthKey && currentMonthKey && monthKey === currentMonthKey) {
    return {
      currentRecords: dedupeFuelRecords(currentRecords.filter((record) => getFuelMonthKey(record.dateTime) !== monthKey)),
      history: normalizeFuelHistory(history),
    }
  }

  return {
    currentRecords: dedupeFuelRecords(currentRecords),
    history: normalizeFuelHistory(history.filter((entry) => entry.month !== monthKey)),
  }
}

export function archiveFuelRecords(history: FuelMonthArchive[], records: FuelRecord[]): FuelMonthArchive[] {
  const grouped = new Map<string, FuelRecord[]>()

  for (const record of records) {
    const monthKey = getFuelMonthKey(record.dateTime)
    if (!monthKey) continue

    const monthRecords = grouped.get(monthKey) ?? []
    monthRecords.push(record)
    grouped.set(monthKey, monthRecords)
  }

  let nextHistory = normalizeFuelHistory(history)
  for (const [monthKey, monthRecords] of grouped) {
    nextHistory = upsertFuelArchive(nextHistory, monthKey, monthRecords)
  }

  return nextHistory
}

export function reconcileFuelMonths(
  currentRecords: FuelRecord[],
  history: FuelMonthArchive[],
  referenceDate: Date = new Date()
): {
  currentRecords: FuelRecord[]
  history: FuelMonthArchive[]
  archivedMonths: string[]
} {
  const currentMonthKey = getFuelMonthKey(referenceDate)
  if (!currentMonthKey) {
    return {
      currentRecords: sortFuelRecords(currentRecords),
      history: normalizeFuelHistory(history),
      archivedMonths: [],
    }
  }

  const retainedCurrent: FuelRecord[] = []
  const rolloverRecords: FuelRecord[] = []

  for (const record of currentRecords) {
    const recordMonth = getFuelMonthKey(record.dateTime)
    if (!recordMonth || recordMonth >= currentMonthKey) {
      retainedCurrent.push(record)
      continue
    }

    rolloverRecords.push(record)
  }

  const nextHistory = archiveFuelRecords(history, rolloverRecords)
  const archivedMonths = Array.from(
    new Set(
      rolloverRecords
        .map((record) => getFuelMonthKey(record.dateTime))
        .filter((month): month is string => Boolean(month))
    )
  ).sort((left, right) => right.localeCompare(left))

  return {
    currentRecords: sortFuelRecords(retainedCurrent),
    history: nextHistory,
    archivedMonths,
  }
}

export function getFuelMonthOptions(
  currentRecords: FuelRecord[],
  history: FuelMonthArchive[],
  referenceDate: Date = new Date()
): FuelMonthOption[] {
  const currentMonthKey = getFuelMonthKey(referenceDate)
  const options = new Map<string, FuelMonthOption>()

  if (currentMonthKey) {
    const total = currentRecords.reduce((sum, record) => sum + record.valor, 0)
    options.set(currentMonthKey, {
      month: currentMonthKey,
      label: formatFuelMonthLabel(currentMonthKey),
      recordCount: currentRecords.length,
      total,
      source: "current",
    })
  }

  for (const month of history) {
    const total = month.records.reduce((sum, record) => sum + record.valor, 0)
    options.set(month.month, {
      month: month.month,
      label: formatFuelMonthLabel(month.month),
      recordCount: month.records.length,
      total,
      source: "history",
    })
  }

  return Array.from(options.values()).sort((left, right) => right.month.localeCompare(left.month))
}

export function getFuelRecordsForMonth(
  selectedMonth: string,
  currentRecords: FuelRecord[],
  history: FuelMonthArchive[],
  referenceDate: Date = new Date()
): FuelRecord[] {
  const currentMonthKey = getFuelMonthKey(referenceDate)
  if (selectedMonth === currentMonthKey) {
    return dedupeFuelRecords(currentRecords)
  }

  const archivedMonth = history.find((month) => month.month === selectedMonth)
  return archivedMonth ? dedupeFuelRecords(archivedMonth.records) : []
}

export async function readLocalFuelData(): Promise<FuelRecord[]> {
  try {
    const text = await readFile(FUEL_DATA_FILE, "utf-8")
    const parsed = JSON.parse(text)
    return Array.isArray(parsed) ? dedupeFuelRecords(parsed as FuelRecord[]) : []
  } catch {
    return []
  }
}

export async function saveLocalFuelData(records: FuelRecord[]): Promise<boolean> {
  try {
    await mkdir(FUEL_DATA_DIR, { recursive: true })
    await writeFile(FUEL_DATA_FILE, JSON.stringify(dedupeFuelRecords(records), null, 2), "utf-8")
    return true
  } catch (error) {
    if (isReadonlyFilesystemError(error)) return false
    throw error
  }
}

export async function readLocalFuelHistory(): Promise<FuelMonthArchive[]> {
  try {
    const text = await readFile(FUEL_HISTORY_FILE, "utf-8")
    const parsed = JSON.parse(text)
    return Array.isArray(parsed) ? normalizeFuelHistory(parsed as FuelMonthArchive[]) : []
  } catch {
    return []
  }
}

export async function saveLocalFuelHistory(months: FuelMonthArchive[]): Promise<boolean> {
  try {
    await mkdir(FUEL_DATA_DIR, { recursive: true })
    await writeFile(FUEL_HISTORY_FILE, JSON.stringify(normalizeFuelHistory(months), null, 2), "utf-8")
    return true
  } catch (error) {
    if (isReadonlyFilesystemError(error)) return false
    throw error
  }
}

export async function readLocalFuelMetadata(): Promise<FuelImportMetadata> {
  try {
    const text = await readFile(FUEL_META_FILE, "utf-8")
    const parsed = JSON.parse(text)

    return {
      lastImportedAt: typeof parsed?.lastImportedAt === "string" ? parsed.lastImportedAt : null,
    }
  } catch {
    try {
      const fileStat = await stat(FUEL_DATA_FILE)
      return { lastImportedAt: fileStat.mtime.toISOString() }
    } catch {
      return { lastImportedAt: null }
    }
  }
}

export async function saveLocalFuelMetadata(metadata: FuelImportMetadata): Promise<boolean> {
  try {
    await mkdir(FUEL_DATA_DIR, { recursive: true })
    await writeFile(
      FUEL_META_FILE,
      JSON.stringify({ lastImportedAt: metadata.lastImportedAt ?? null }, null, 2),
      "utf-8"
    )
    return true
  } catch (error) {
    if (isReadonlyFilesystemError(error)) return false
    throw error
  }
}
