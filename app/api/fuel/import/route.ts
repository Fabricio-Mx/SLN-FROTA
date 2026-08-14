import { NextResponse } from "next/server"
import { verifySession } from "@/lib/auth"
import {
  buildFuelRecordKey,
  archiveFuelRecords,
  dedupeFuelRecords,
  getFuelMonthKey,
  removeFuelMonthRecords,
  readLocalFuelData,
  readLocalFuelHistory,
  readLocalFuelMetadata,
  reconcileFuelMonths,
  replaceFuelArchiveMonth,
  saveLocalFuelData,
  saveLocalFuelHistory,
  saveLocalFuelMetadata,
  sanitizeFuelStorage,
  type FuelImportMetadata,
  type FuelMonthArchive,
  type FuelRecord,
} from "@/lib/fuel-storage"
import {
  describeDriveError,
  ensureFolder,
  findFile,
  getDriveClients,
  getDriveRootFolderId,
  readJsonFile,
  upsertJsonFile,
} from "@/lib/google-drive"
import { formatFuelDateTimeStorage } from "@/lib/fuel-datetime"

export const runtime = "nodejs"
export const maxDuration = 60

const FUEL_FOLDER_NAME = "combustivel"
const FUEL_DATA_FILE = "fuel_data.json"
const FUEL_HISTORY_FILE = "fuel_history.json"
const FUEL_META_FILE = "fuel_meta.json"

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

  return formatFuelDateTimeStorage({
    year,
    month,
    day,
    hour,
    minute,
    second,
  })
}

function parseCurrency(value: string): number {
  if (!value) return 0
  const normalized = value.replace(/\./g, "").replace(/,/g, ".")
  const parsed = Number.parseFloat(normalized)
  return Number.isFinite(parsed) ? parsed : 0
}

async function loadFuelStorage(): Promise<{
  currentRecords: FuelRecord[]
  history: FuelMonthArchive[]
  metadata: FuelImportMetadata
}> {
  let currentRecords = await readLocalFuelData()
  let history = await readLocalFuelHistory()
  let metadata = await readLocalFuelMetadata()

  try {
    const rootId = getDriveRootFolderId()
    const driveClients = await getDriveClients()

    for (const drive of driveClients) {
      try {
        const fuelFolderId = await ensureFolder(drive, FUEL_FOLDER_NAME, rootId)
        const currentFile = await findFile(drive, FUEL_DATA_FILE, fuelFolderId)
        const historyFile = await findFile(drive, FUEL_HISTORY_FILE, fuelFolderId)
        const metaFile = await findFile(drive, FUEL_META_FILE, fuelFolderId)
        const driveRecords = currentFile?.id ? await readJsonFile<FuelRecord[]>(drive, currentFile.id) : []
        const driveHistory = historyFile?.id ? await readJsonFile<FuelMonthArchive[]>(drive, historyFile.id) : []
        const driveMetadata = metaFile?.id ? await readJsonFile<FuelImportMetadata>(drive, metaFile.id) : null

        if (currentFile?.id && Array.isArray(driveRecords)) {
          currentRecords = driveRecords
        }

        if (historyFile?.id && Array.isArray(driveHistory)) {
          history = driveHistory
        }

        if (metaFile?.id && driveMetadata) {
          metadata = {
            lastImportedAt: typeof driveMetadata.lastImportedAt === "string" ? driveMetadata.lastImportedAt : null,
          }
        } else if (currentFile?.modifiedTime) {
          metadata = {
            lastImportedAt: currentFile.modifiedTime,
          }
        }

        if (currentFile?.id || historyFile?.id || metaFile?.id) {
          break
        }
      } catch {
        // Tenta o proximo cliente.
      }
    }
  } catch {
    // Mantem o espelho local como fallback.
  }

  return { currentRecords, history, metadata }
}

async function persistFuelStorage(currentRecords: FuelRecord[], history: FuelMonthArchive[], metadata: FuelImportMetadata) {
  let drivePersisted = false
  let driveError: string | null = null
  try {
    const rootId = getDriveRootFolderId()
    const driveClients = await getDriveClients()

    for (const drive of driveClients) {
      try {
        const fuelFolderId = await ensureFolder(drive, FUEL_FOLDER_NAME, rootId)
        await upsertJsonFile(drive, fuelFolderId, FUEL_DATA_FILE, currentRecords)
        await upsertJsonFile(drive, fuelFolderId, FUEL_HISTORY_FILE, history)
        await upsertJsonFile(drive, fuelFolderId, FUEL_META_FILE, metadata)
        drivePersisted = true
        driveError = null
        break
      } catch (error) {
        driveError = describeDriveError(error)
      }
    }
  } catch (error) {
    driveError = describeDriveError(error)
  }

  const localDataPersisted = await saveLocalFuelData(currentRecords)
  const localHistoryPersisted = await saveLocalFuelHistory(history)
  const localMetadataPersisted = await saveLocalFuelMetadata(metadata)
  const localPersisted = localDataPersisted && localHistoryPersisted && localMetadataPersisted

  return {
    drivePersisted,
    driveError,
    localPersisted,
    storage: drivePersisted && localPersisted ? "drive+local" : drivePersisted ? "drive" : "local",
  }
}

export async function POST(req: Request) {
  try {
    const session = await verifySession()
    if (!session || session.role !== "mestre") {
      return NextResponse.json({ error: "Sem permissão" }, { status: 403 })
    }

    const formData = await req.formData()
    const file = formData.get("file") as File | null
    const importModeRaw = formData.get("importMode")
    const importMode = importModeRaw === "monthly" || importModeRaw === "billing" ? importModeRaw : "weekly"
    const targetMonthRaw = formData.get("targetMonth")
    const targetMonth =
      typeof targetMonthRaw === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(targetMonthRaw)
        ? targetMonthRaw
        : null

    if (!file) {
      return NextResponse.json({ error: "Arquivo não enviado." }, { status: 400 })
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
      const postingDateRaw = row[6] || ""
      const cpfMotorista = row[13] || ""
      const nomeMotorista = row[14] || ""
      const tipoCombustivel = row[26] || ""
      const valor = parseCurrency(row[29] || "")
      const dateTimeRaw = row[5] || ""
      const dateTime = parseDateTimeBr(dateTimeRaw)
      const postingDate = parseDateTimeBr(postingDateRaw)

      if (!cardPlate && !cpfMotorista && !nomeMotorista) continue
      if (!dateTime) continue

      records.push({
        cardPlate: cardPlate.trim(),
        cpfMotorista: cpfMotorista.trim(),
        nomeMotorista: nomeMotorista.trim(),
        tipoCombustivel: tipoCombustivel.trim(),
        valor,
        dateTime,
        postingDate: postingDate ?? null,
      })
    }

    const importedRecords = dedupeFuelRecords(records)

    let { currentRecords: stored, history, metadata } = await loadFuelStorage()

    const sanitized = sanitizeFuelStorage(stored, history)
    stored = sanitized.currentRecords
    history = sanitized.history

    const reconciled = reconcileFuelMonths(stored, history)
    stored = reconciled.currentRecords
    history = reconciled.history

    const currentMonthKey = getFuelMonthKey(new Date())
    const currentMonthRecords: FuelRecord[] = []
    const archivedImportRecords: FuelRecord[] = []
    const importedMonths = Array.from(
      new Set(importedRecords.map((record) => getFuelMonthKey(record.dateTime)).filter((month): month is string => Boolean(month)))
    ).sort((left, right) => right.localeCompare(left))
    const monthlyReplacementMonth = importMode === "monthly" ? (targetMonth ?? importedMonths[0] ?? null) : null
    const importedRecordsByMonth = new Map<string, FuelRecord[]>()

    for (const record of importedRecords) {
      const monthKey = getFuelMonthKey(record.dateTime)
      if (!monthKey) continue

      const monthRecords = importedRecordsByMonth.get(monthKey) ?? []
      monthRecords.push(record)
      importedRecordsByMonth.set(monthKey, monthRecords)
    }

    if (importMode === "monthly") {
      if (targetMonthRaw && !targetMonth) {
        return NextResponse.json(
          { error: "Competência alvo inválida. Use o formato AAAA-MM." },
          { status: 400 }
        )
      }

      if (!targetMonth && importedMonths.length !== 1) {
        return NextResponse.json(
          {
            error:
              "A importação mensal exige um arquivo com apenas uma competência mensal. Para fechamento com datas cruzadas, selecione a competência antes de importar.",
          },
          { status: 400 }
        )
      }

      if (currentMonthKey && monthlyReplacementMonth && monthlyReplacementMonth > currentMonthKey) {
        return NextResponse.json(
          { error: "Não é possível importar uma competência futura." },
          { status: 400 }
        )
      }
    }

    if (currentMonthKey && importedMonths.some((month) => month > currentMonthKey)) {
      return NextResponse.json(
        { error: "Não é possível importar competências futuras." },
        { status: 400 }
      )
    }

    if (importMode === "billing") {
      let nextStored = stored
      let nextHistory = history

      for (const monthKey of importedMonths) {
        const monthRecords = importedRecordsByMonth.get(monthKey) ?? []

        if (currentMonthKey && monthKey === currentMonthKey) {
          nextStored = dedupeFuelRecords([
            ...nextStored.filter((record) => getFuelMonthKey(record.dateTime) !== monthKey),
            ...monthRecords,
          ])
          continue
        }

        nextHistory = replaceFuelArchiveMonth(nextHistory, monthKey, monthRecords)
      }

      metadata = { lastImportedAt: new Date().toISOString() }

      const { drivePersisted, driveError, localPersisted, storage } = await persistFuelStorage(nextStored, nextHistory, metadata)

      if (!drivePersisted && !localPersisted) {
        return NextResponse.json(
          {
            error: "Não foi possível salvar a importação nem no Drive nem no armazenamento local. Verifique a configuração do Drive.",
            driveError,
          },
          { status: 500 }
        )
      }

      return NextResponse.json({
        success: true,
        importMode,
        imported: importedRecords.length,
        total: nextStored.length,
        replacedMonths: importedMonths,
        archivedMonths: importedMonths.filter((month) => !currentMonthKey || month < currentMonthKey),
        storage,
      })
    }

    if (importMode === "monthly" && monthlyReplacementMonth) {
      let nextStored = stored
      let nextHistory = history

      if (currentMonthKey && monthlyReplacementMonth === currentMonthKey) {
        nextStored = dedupeFuelRecords([
          ...nextStored.filter((record) => getFuelMonthKey(record.dateTime) !== monthlyReplacementMonth),
          ...importedRecords,
        ])
      } else {
        // Remove duplicatas já presentes no mês atual para evitar dupla contagem entre competências.
        const importedRecordKeys = new Set(importedRecords.map((record) => buildFuelRecordKey(record)))
        nextStored = nextStored.filter((record) => !importedRecordKeys.has(buildFuelRecordKey(record)))
        nextHistory = replaceFuelArchiveMonth(nextHistory, monthlyReplacementMonth, importedRecords)
      }

      metadata = { lastImportedAt: new Date().toISOString() }

      const { drivePersisted, driveError, localPersisted, storage } = await persistFuelStorage(nextStored, nextHistory, metadata)

      if (!drivePersisted && !localPersisted) {
        return NextResponse.json(
          {
            error: "Não foi possível salvar a importação nem no Drive nem no armazenamento local. Verifique a configuração do Drive.",
            driveError,
          },
          { status: 500 }
        )
      }

      return NextResponse.json({
        success: true,
        importMode,
        imported: importedRecords.length,
        total: nextStored.length,
        replacedMonth: monthlyReplacementMonth,
        archivedMonths: currentMonthKey && monthlyReplacementMonth < currentMonthKey ? [monthlyReplacementMonth] : [],
        storage,
      })
    }

    for (const record of importedRecords) {
      const recordMonth = getFuelMonthKey(record.dateTime)
      if (recordMonth && currentMonthKey && recordMonth < currentMonthKey) {
        archivedImportRecords.push(record)
      } else {
        currentMonthRecords.push(record)
      }
    }

    history = archiveFuelRecords(history, archivedImportRecords)

    const merged = dedupeFuelRecords([...stored, ...currentMonthRecords])

    metadata = { lastImportedAt: new Date().toISOString() }

    const { drivePersisted, driveError, localPersisted, storage } = await persistFuelStorage(merged, history, metadata)

    if (!drivePersisted && !localPersisted) {
      return NextResponse.json(
        {
          error: "Não foi possível salvar a importação nem no Drive nem no armazenamento local. Verifique a configuração do Drive.",
          driveError,
        },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      importMode,
      imported: importedRecords.length,
      total: merged.length,
      archivedMonths: Array.from(
        new Set(
          archivedImportRecords
            .map((record) => getFuelMonthKey(record.dateTime))
            .filter((month): month is string => Boolean(month))
        )
      ).sort((left, right) => right.localeCompare(left)),
      storage,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro desconhecido"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function DELETE(req: Request) {
  try {
    const session = await verifySession()
    if (!session || session.role !== "mestre") {
      return NextResponse.json({ error: "Sem permissão" }, { status: 403 })
    }

    const url = new URL(req.url)
    const month = url.searchParams.get("month")

    if (!month) {
      return NextResponse.json({ error: "Competência não informada." }, { status: 400 })
    }

    const storedFuel = await loadFuelStorage()
    let { currentRecords, history } = storedFuel
    const { metadata } = storedFuel

    const sanitized = sanitizeFuelStorage(currentRecords, history)
    currentRecords = sanitized.currentRecords
    history = sanitized.history

    const reconciled = reconcileFuelMonths(currentRecords, history)
    currentRecords = reconciled.currentRecords
    history = reconciled.history

    const updated = removeFuelMonthRecords(month, currentRecords, history)
    const result = await persistFuelStorage(updated.currentRecords, updated.history, metadata)

    if (!result.drivePersisted && !result.localPersisted) {
      return NextResponse.json(
        {
          error: "Não foi possível excluir a competência nem no Drive nem no armazenamento local.",
          driveError: result.driveError,
        },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      removedMonth: month,
      storage: result.storage,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro desconhecido"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
