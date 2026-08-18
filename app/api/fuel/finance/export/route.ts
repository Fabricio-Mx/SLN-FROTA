import ExcelJS from "exceljs"
import { NextResponse } from "next/server"
import { verifySession } from "@/lib/auth"
import { createCostCenterLookup, resolveCostCenterRecord, type CostCenterDataset, type CostCenterRecord } from "@/lib/cost-center-shared"
import { getFuelFinancialPostingCycleBoundsForClosingMonth, isFuelBillingMonthKey } from "@/lib/fuel-billing"
import { parseFuelDateTime } from "@/lib/fuel-datetime"
import { readLocalCostCenterData } from "@/lib/cost-center-storage"
import { getFuelRecordsForMonth, readLocalFuelData, readLocalFuelHistory, type FuelMonthArchive, type FuelRecord } from "@/lib/fuel-storage"
import {
  ensureFolder,
  findFile,
  getDriveClients,
  getDriveRootFolderId,
  readJsonFile,
} from "@/lib/google-drive"
import { createAdminClient } from "@/lib/supabase/admin"

export const runtime = "nodejs"

const FUEL_FOLDER_NAME = "combustivel"
const FUEL_DATA_FILE = "fuel_data.json"
const FUEL_HISTORY_FILE = "fuel_history.json"
const COST_CENTER_DATA_FILE = "cost_center_data.json"

type ExportRow = {
  dateTime: Date
  cardNumber: string
  plate: string
  driverName: string
  costCenter: string
  transactionValue: number
}

type VehicleCardLookupRow = {
  placa: string
  numero_cartao_combustivel: string | null
  placa_cartao_combustivel: string | null
}

function normalizePlate(value: string): string {
  return value.replace(/[^a-zA-Z0-9]/g, "").toUpperCase()
}

function formatMonthKey(date: Date): string {
  return `${date.getFullYear()}-${`${date.getMonth() + 1}`.padStart(2, "0")}`
}

function shiftMonth(date: Date, offset: number): Date {
  return new Date(date.getFullYear(), date.getMonth() + offset, 1)
}

async function loadFuelStorage(): Promise<{
  currentRecords: FuelRecord[]
  history: FuelMonthArchive[]
}> {
  let currentRecords = await readLocalFuelData()
  let history = await readLocalFuelHistory()

  try {
    const rootId = getDriveRootFolderId()
    const driveClients = await getDriveClients()

    for (const drive of driveClients) {
      try {
        const fuelFolderId = await ensureFolder(drive, FUEL_FOLDER_NAME, rootId)
        const currentFile = await findFile(drive, FUEL_DATA_FILE, fuelFolderId)
        const historyFile = await findFile(drive, FUEL_HISTORY_FILE, fuelFolderId)
        const driveRecords = currentFile?.id ? await readJsonFile<FuelRecord[]>(drive, currentFile.id) : []
        const driveHistory = historyFile?.id ? await readJsonFile<FuelMonthArchive[]>(drive, historyFile.id) : []

        if (currentFile?.id && Array.isArray(driveRecords)) {
          currentRecords = driveRecords
        }

        if (historyFile?.id && Array.isArray(driveHistory)) {
          history = driveHistory
        }

        if (currentFile?.id || historyFile?.id) {
          break
        }
      } catch {
        // Tenta o proximo cliente do Drive.
      }
    }
  } catch {
    // Mantem espelho local como fallback.
  }

  return { currentRecords, history }
}

async function loadCostCenterRecords(): Promise<CostCenterRecord[]> {
  let dataset = await readLocalCostCenterData()

  try {
    const rootId = getDriveRootFolderId()
    const driveClients = await getDriveClients()

    for (const drive of driveClients) {
      try {
        const fuelFolderId = await ensureFolder(drive, FUEL_FOLDER_NAME, rootId)
        const costCenterFile = await findFile(drive, COST_CENTER_DATA_FILE, fuelFolderId)
        const driveDataset = costCenterFile?.id
          ? await readJsonFile<CostCenterDataset | CostCenterRecord[]>(drive, costCenterFile.id)
          : null

        if (!costCenterFile?.id) {
          continue
        }

        if (Array.isArray(driveDataset)) {
          dataset = { updatedAt: null, records: driveDataset }
        } else if (driveDataset && typeof driveDataset === "object") {
          dataset = {
            updatedAt: typeof driveDataset.updatedAt === "string" ? driveDataset.updatedAt : null,
            records: Array.isArray(driveDataset.records) ? driveDataset.records : [],
          }
        }

        break
      } catch {
        // Tenta o proximo cliente do Drive.
      }
    }
  } catch {
    // Mantem espelho local.
  }

  return dataset.records
}

async function loadVehicleCardLookup(): Promise<Map<string, string>> {
  const lookup = new Map<string, string>()

  try {
    const supabase = createAdminClient()
    const { data, error } = await supabase
      .from("fleet_vehicles")
      .select("placa, numero_cartao_combustivel, placa_cartao_combustivel")

    if (error) {
      throw new Error(error.message)
    }

    for (const row of (data ?? []) as VehicleCardLookupRow[]) {
      const cardNumber = row.numero_cartao_combustivel?.trim()
      if (!cardNumber) continue

      const cardPlate = normalizePlate(row.placa_cartao_combustivel ?? "")
      const vehiclePlate = normalizePlate(row.placa ?? "")

      if (cardPlate) {
        lookup.set(cardPlate, cardNumber)
      }

      if (vehiclePlate && !lookup.has(vehiclePlate)) {
        lookup.set(vehiclePlate, cardNumber)
      }
    }
  } catch {
    // Se não conseguir consultar veículos, a exportação continua com cartão vazio.
  }

  return lookup
}

function filterRecordsByCycle(records: FuelRecord[], cycleStart: Date, cycleEnd: Date): FuelRecord[] {
  const normalizedStart = new Date(cycleStart)
  normalizedStart.setHours(0, 0, 0, 0)

  const normalizedEnd = new Date(cycleEnd)
  normalizedEnd.setHours(23, 59, 59, 999)

  return records.filter((record) => {
    const parsed = parseFuelDateTime(record.dateTime)
    if (Number.isNaN(parsed.getTime())) return false

    return parsed >= normalizedStart && parsed <= normalizedEnd
  })
}

function buildSheetName(cycleMonth: string): string {
  return `relatorio-fatura-${cycleMonth}`.slice(0, 31)
}

function buildFileName(cycleMonth: string): string {
  return `relatorio-conferencia-fatura-${cycleMonth}.xlsx`
}

async function buildWorkbook(rows: ExportRow[], cycleMonth: string, cycleStart: Date, cycleEnd: Date) {
  const workbook = new ExcelJS.Workbook()
  const worksheet = workbook.addWorksheet(buildSheetName(cycleMonth), {
    views: [{ state: "frozen", ySplit: 1 }],
  })

  worksheet.columns = [
    { header: "Data/Hora", key: "dateTime", width: 22 },
    { header: "Numero Cartao", key: "cardNumber", width: 24 },
    { header: "Placa", key: "plate", width: 14 },
    { header: "Nome Motorista", key: "driverName", width: 34 },
    { header: "Centro de Custo", key: "costCenter", width: 42 },
    { header: "Valor transação", key: "transactionValue", width: 18 },
  ]

  const headerRow = worksheet.getRow(1)
  headerRow.height = 22
  headerRow.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: "FFFFFFFF" } }
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF9E1B1B" },
    }
    cell.alignment = { vertical: "middle", horizontal: "center" }
    cell.border = {
      top: { style: "thin", color: { argb: "FF6B0F0F" } },
      left: { style: "thin", color: { argb: "FF6B0F0F" } },
      bottom: { style: "thin", color: { argb: "FF6B0F0F" } },
      right: { style: "thin", color: { argb: "FF6B0F0F" } },
    }
  })

  worksheet.autoFilter = {
    from: "A1",
    to: "F1",
  }

  for (const row of rows) {
    const worksheetRow = worksheet.addRow({
      dateTime: row.dateTime,
      cardNumber: row.cardNumber,
      plate: row.plate,
      driverName: row.driverName,
      costCenter: row.costCenter,
      transactionValue: row.transactionValue,
    })

    worksheetRow.getCell("A").numFmt = "dd/mm/yyyy hh:mm:ss"
    worksheetRow.getCell("F").numFmt = '"R$" #,##0.00'

    worksheetRow.eachCell((cell) => {
      cell.border = {
        bottom: { style: "hair", color: { argb: "FFD9D9D9" } },
      }
      cell.alignment = { vertical: "middle" }
    })
  }

  worksheet.getColumn("A").alignment = { horizontal: "left" }
  worksheet.getColumn("B").alignment = { horizontal: "left" }
  worksheet.getColumn("C").alignment = { horizontal: "center" }
  worksheet.getColumn("D").alignment = { horizontal: "left" }
  worksheet.getColumn("E").alignment = { horizontal: "left" }
  worksheet.getColumn("F").alignment = { horizontal: "right" }

  worksheet.headerFooter.oddHeader = `&LRelatório conferência fatura ${cycleMonth}&R${cycleStart.toLocaleDateString("pt-BR")} a ${cycleEnd.toLocaleDateString("pt-BR")}`

  return workbook.xlsx.writeBuffer()
}

export async function GET(req: Request) {
  try {
    const session = await verifySession()
    if (!session) {
      return NextResponse.json({ error: "Sem permissão" }, { status: 403 })
    }

    const url = new URL(req.url)
    const cycleMonth = `${url.searchParams.get("cycleMonth") ?? ""}`.trim()

    if (!isFuelBillingMonthKey(cycleMonth)) {
      return NextResponse.json({ error: "Fechamento da fatura inválido." }, { status: 400 })
    }

    const cycleBounds = getFuelFinancialPostingCycleBoundsForClosingMonth(cycleMonth)
    if (!cycleBounds) {
      return NextResponse.json({ error: "Não foi possível calcular o ciclo da fatura." }, { status: 400 })
    }

    const [{ currentRecords, history }, costCenterRecords, vehicleCardLookup] = await Promise.all([
      loadFuelStorage(),
      loadCostCenterRecords(),
      loadVehicleCardLookup(),
    ])

    const costCenterLookup = createCostCenterLookup(costCenterRecords)
    const candidateMonths = new Set<string>([
      cycleMonth,
      formatMonthKey(shiftMonth(cycleBounds.start, -1)),
      formatMonthKey(cycleBounds.start),
      formatMonthKey(cycleBounds.end),
    ])

    const records = Array.from(candidateMonths)
      .flatMap((monthKey) => getFuelRecordsForMonth(monthKey, currentRecords, history))

    const exportRows = filterRecordsByCycle(records, cycleBounds.start, cycleBounds.end)
      .map<ExportRow>((record) => {
        const parsedDate = parseFuelDateTime(record.dateTime)
        const resolvedCostCenter = resolveCostCenterRecord(record.nomeMotorista, costCenterLookup)
        const normalizedPlate = normalizePlate(record.cardPlate)

        return {
          dateTime: parsedDate,
          cardNumber: vehicleCardLookup.get(normalizedPlate) ?? "",
          plate: record.cardPlate,
          driverName: record.nomeMotorista,
          costCenter: resolvedCostCenter?.centroCusto ?? "",
          transactionValue: record.valor,
        }
      })
      .filter((row) => !Number.isNaN(row.dateTime.getTime()))
      .sort((left, right) => left.dateTime.getTime() - right.dateTime.getTime())

    const buffer = await buildWorkbook(exportRows, cycleMonth, cycleBounds.start, cycleBounds.end)
    const fileName = buildFileName(cycleMonth)

    return new NextResponse(buffer, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${fileName}"`,
        "Cache-Control": "private, no-store",
      },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro desconhecido"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
