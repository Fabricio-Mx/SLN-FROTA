import {
  FUEL_BUDGET_DEFAULT_DAYS_PER_WEEK,
  createBudgetCollaboratorId,
  formatBudgetCenterName,
  normalizeBudgetPlate,
  resolveBudgetCenterId,
  sumFuelBudgetCenters,
  type FuelBudgetAnalysis,
  type FuelBudgetCenterAnalysis,
  type FuelBudgetCollaborator,
} from "@/lib/fuel-budget-plan-shared"

export type ImportedBudgetCenter = {
  centerCode: string
  centerLabel: string
  collaborators: FuelBudgetCollaborator[]
}

type SheetRow = Array<string | number | boolean | Date | null>

function cellText(value: SheetRow[number] | undefined): string {
  if (value === null || value === undefined) return ""
  return String(value).replace(/\s+/g, " ").trim()
}

function normalizeHeader(value: SheetRow[number] | undefined): string {
  return cellText(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
}

function cellNumber(value: SheetRow[number] | undefined): number {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0
  const text = cellText(value).replace(/[^\d,.-]/g, "")
  if (!text) return 0
  const normalized = text.includes(",") ? text.replace(/\./g, "").replace(",", ".") : text
  const parsed = Number(normalized)
  return Number.isFinite(parsed) ? parsed : 0
}

/**
 * Le a planilha no formato "RELATORIO SEMANAL TELECOM": em cada aba, a primeira tabela com as colunas
 * CENTRO DE CUSTO | NOME MOTORISTA | VALOR DIARIO | DIAS TRABALHADOS | ... | PLACA.
 */
export async function parseFuelBudgetWorkbook(file: ArrayBuffer): Promise<ImportedBudgetCenter[]> {
  const XLSX = await import("xlsx")
  const workbook = XLSX.read(file, { type: "array" })
  const centers = new Map<string, ImportedBudgetCenter>()

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName]
    if (!sheet) continue

    const rows = XLSX.utils.sheet_to_json<SheetRow>(sheet, { header: 1, raw: true, defval: null, blankrows: true })
    const headerIndex = rows.findIndex((row) => {
      const headers = row.map(normalizeHeader)
      return (
        headers.some((header) => header.startsWith("CENTRO DE CUSTO") && !header.includes("MENSAL")) &&
        headers.some((header) => header.includes("NOME")) &&
        headers.some((header) => header.startsWith("VALOR DIARI"))
      )
    })
    if (headerIndex === -1) continue

    const headers = rows[headerIndex].map(normalizeHeader)
    const centerColumn = headers.findIndex((header) => header.startsWith("CENTRO DE CUSTO"))
    const nameColumn = headers.findIndex((header) => header.includes("NOME"))
    const dailyColumn = headers.findIndex((header) => header.startsWith("VALOR DIARI"))
    const daysColumn = headers.findIndex((header) => header.startsWith("DIAS"))
    const plateColumn = headers.findIndex((header) => header.includes("PLACA"))

    const sheetRows: Array<{ centerCode: string; centerLabel: string; collaborator: FuelBudgetCollaborator }> = []

    for (let index = headerIndex + 1; index < rows.length; index += 1) {
      const row = rows[index] ?? []
      const centerLabel = cellText(row[centerColumn])
      if (!centerLabel) break

      const name = cellText(row[nameColumn])
      if (!name || name === "-") continue

      const centerCode = resolveBudgetCenterId(centerLabel)
      if (!centerCode) continue

      const days = daysColumn >= 0 ? cellNumber(row[daysColumn]) : 0
      sheetRows.push({
        centerCode,
        centerLabel,
        collaborator: {
          id: createBudgetCollaboratorId(),
          name,
          plate: plateColumn >= 0 ? normalizeBudgetPlate(cellText(row[plateColumn])) : "",
          dailyValue: Number(cellNumber(row[dailyColumn]).toFixed(2)),
          daysPerWeek: days > 0 ? Math.min(7, Math.round(days)) : FUEL_BUDGET_DEFAULT_DAYS_PER_WEEK,
          active: true,
        },
      })
    }

    // Cada aba representa um centro: usa o centro predominante para corrigir linhas digitadas com o codigo errado.
    const codeCounts = new Map<string, { count: number; label: string }>()
    for (const item of sheetRows) {
      const current = codeCounts.get(item.centerCode)
      codeCounts.set(item.centerCode, { count: (current?.count ?? 0) + 1, label: current?.label ?? item.centerLabel })
    }
    const predominant = Array.from(codeCounts.entries()).sort((left, right) => right[1].count - left[1].count)[0]
    if (!predominant) continue

    const [centerCode, { label: centerLabel }] = predominant
    const current = centers.get(centerCode) ?? { centerCode, centerLabel, collaborators: [] }
    current.collaborators.push(...sheetRows.map((item) => item.collaborator))
    centers.set(centerCode, current)
  }

  return Array.from(centers.values())
}

function round(value: number): number {
  return Number(value.toFixed(2))
}

const CURRENCY_FORMAT = '"R$" #,##0.00'

function toSafeSheetName(value: string, used: Set<string>): string {
  const base = value.replace(/[\\/?*[\]:]/g, " ").replace(/\s+/g, " ").trim().slice(0, 28) || "Centro"
  let name = base
  let counter = 2
  while (used.has(name.toLowerCase())) {
    name = `${base.slice(0, 25)} ${counter}`
    counter += 1
  }
  used.add(name.toLowerCase())
  return name
}

export async function exportFuelBudgetWorkbook(params: {
  analysis: FuelBudgetAnalysis
  centers: FuelBudgetCenterAnalysis[]
  monthLabel: string
  scopeLabel: string
}) {
  const { analysis, centers, monthLabel, scopeLabel } = params
  const XLSX = await import("xlsx")
  const workbook = XLSX.utils.book_new()
  const usedNames = new Set<string>()
  const weekHeaders = analysis.weeks.map((week) => `${week.label} (${week.startDay}-${week.endDay})`)

  function formatCurrencyColumns(sheet: import("xlsx").WorkSheet, columns: number[], startRow: number) {
    const range = XLSX.utils.decode_range(sheet["!ref"] ?? "A1")
    for (let row = startRow; row <= range.e.r; row += 1) {
      for (const column of columns) {
        const cell = sheet[XLSX.utils.encode_cell({ r: row, c: column })]
        if (cell && typeof cell.v === "number") cell.z = CURRENCY_FORMAT
      }
    }
  }

  const totals = sumFuelBudgetCenters(centers)
  const summaryHeader = [
    "Centro de custo",
    "Orçado diário",
    "Orçado semanal",
    "Orçado mensal",
    "Orçado até a data",
    ...weekHeaders,
    "Gasto no mês",
    "Projeção do mês",
    "Saldo projetado",
    "% consumido",
  ]
  const summaryRows: Array<Array<string | number>> = [
    [`Orçado x Gasto — ${scopeLabel} — ${monthLabel}`],
    [
      analysis.referenceDate
        ? `Dados até ${analysis.referenceDate.toLocaleDateString("pt-BR")} (${analysis.elapsedDays} de ${analysis.daysInMonth} dias)`
        : "Sem abastecimentos no mês",
    ],
    [],
    summaryHeader,
    ...centers.map((center) => [
      formatBudgetCenterName(center),
      round(center.budgetDaily),
      round(center.budgetWeekly),
      round(center.budgetMonthly),
      round(center.budgetToDate),
      ...center.spentByWeek.map(round),
      round(center.spentMonth),
      round(center.projection),
      round(center.projectedBalance),
      center.budgetMonthly > 0 ? `${center.consumedPercent.toFixed(1)}%` : "-",
    ]),
    [
      "TOTAL",
      round(totals.budgetDaily),
      round(totals.budgetWeekly),
      round(totals.budgetMonthly),
      round(totals.budgetToDate),
      ...analysis.weeks.map((week) => round(centers.reduce((sum, center) => sum + center.spentByWeek[week.index], 0))),
      round(totals.spentMonth),
      round(totals.projection),
      round(totals.projectedBalance),
      totals.budgetMonthly > 0 ? `${totals.consumedPercent.toFixed(1)}%` : "-",
    ],
  ]
  const summarySheet = XLSX.utils.aoa_to_sheet(summaryRows)
  summarySheet["!cols"] = [{ wch: 48 }, ...summaryHeader.slice(1).map(() => ({ wch: 17 }))]
  formatCurrencyColumns(
    summarySheet,
    summaryHeader.map((_, index) => index).filter((index) => index > 0 && index < summaryHeader.length - 1),
    4,
  )
  XLSX.utils.book_append_sheet(workbook, summarySheet, toSafeSheetName("GERAL", usedNames))

  for (const center of centers) {
    if (center.collaborators.length === 0 && center.unlistedDrivers.length === 0) continue

    const rows: Array<Array<string | number>> = [
      [formatBudgetCenterName(center)],
      [],
      ["MENSAL", "Motorista", "Placa", "Valor diário", "Dias trabalhados", "Orçado semanal", "Orçado mensal", "Gasto no mês", "Saldo"],
    ]

    for (const collaborator of center.collaborators) {
      rows.push([
        collaborator.active ? "" : "INATIVO",
        collaborator.name,
        collaborator.plate,
        round(collaborator.dailyValue),
        collaborator.daysPerWeek,
        round(collaborator.weeklyBudget),
        round(collaborator.monthlyBudget),
        round(collaborator.spentMonth),
        round(collaborator.monthlyBudget - collaborator.spentMonth),
      ])
    }

    for (const driver of center.unlistedDrivers) {
      rows.push(["FORA DO ORÇADO", driver.name, driver.plate, 0, 0, 0, 0, round(driver.total), round(-driver.total)])
    }

    rows.push([
      "TOTAL",
      "",
      "",
      round(center.budgetDaily),
      "",
      round(center.budgetWeekly),
      round(center.budgetMonthly),
      round(center.spentMonth),
      round(center.budgetMonthly - center.spentMonth),
    ])

    for (const week of analysis.weeks) {
      rows.push([])
      rows.push([`${week.label.toUpperCase()} (${week.startDay} a ${week.endDay})`, "Motorista", "Placa", "Valor diário", "Dias trabalhados", "Valor orçado", "Valor adicional", "Total gasto"])

      let weekBudget = 0
      let weekExtra = 0
      let weekSpent = 0

      for (const collaborator of center.collaborators) {
        const spent = collaborator.spentByWeek[week.index]
        const extra = Math.max(0, spent - collaborator.weeklyBudget)
        weekBudget += collaborator.weeklyBudget
        weekExtra += extra
        weekSpent += spent
        rows.push([
          week.label,
          collaborator.name,
          collaborator.plate,
          round(collaborator.dailyValue),
          collaborator.daysPerWeek,
          round(collaborator.weeklyBudget),
          extra > 0 ? round(extra) : "",
          round(spent),
        ])
      }

      const unlistedWeekSpent = center.spentByWeek[week.index] - weekSpent
      if (unlistedWeekSpent > 0.009) {
        weekExtra += unlistedWeekSpent
        weekSpent += unlistedWeekSpent
        rows.push([week.label, "Fora do orçado (não listados)", "", 0, 0, 0, round(unlistedWeekSpent), round(unlistedWeekSpent)])
      }

      rows.push(["TOTAL", "", "", "", "", round(weekBudget), round(weekExtra), round(weekSpent)])
    }

    const sheet = XLSX.utils.aoa_to_sheet(rows)
    sheet["!cols"] = [{ wch: 22 }, { wch: 40 }, { wch: 11 }, { wch: 14 }, { wch: 16 }, { wch: 16 }, { wch: 16 }, { wch: 16 }, { wch: 14 }]
    formatCurrencyColumns(sheet, [3, 5, 6, 7, 8], 2)
    XLSX.utils.book_append_sheet(workbook, sheet, toSafeSheetName(formatBudgetCenterName(center), usedNames))
  }

  const fileMonth = analysis.monthKey.replace("-", "_")
  XLSX.writeFile(workbook, `orcado_x_gasto_${scopeLabel.toLowerCase().replace(/\s+/g, "_")}_${fileMonth}.xlsx`)
}
