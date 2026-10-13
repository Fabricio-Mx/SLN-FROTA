import type { Borders, Cell, Fill, Font, Worksheet } from "exceljs"

export type ConsolidatedExportRow = {
  centroCusto: string
  motorista: string
  placaCartao: string
  valorTransacao: number
}

export type ConsolidatedExportOptions = {
  rows: ConsolidatedExportRow[]
  /** Centros de custo listados no resumo mesmo sem gasto no período. */
  extraCostCenters?: string[]
  start: Date
  end: Date
  totalAbastecimentos: number
  appliedFilters?: string[]
}

const COLORS = {
  headerRed: "FFC00000",
  titleRed: "FF9C0006",
  valueOrange: "FFFFC000",
  summaryPeach: "FFFDE9D9",
  totalFill: "FFF2F2F2",
  border: "FFA6A6A6",
  white: "FFFFFFFF",
  subtitle: "FF595959",
}

const CURRENCY_FORMAT = '_-"R$"\\ * #,##0.00_-;\\-"R$"\\ * #,##0.00_-;_-"R$"\\ * "-"??_-;_-@_-'
const PERCENT_FORMAT = "0.0%"
const FONT_NAME = "Calibri"

const TITLE_ROW = 1
const SUBTITLE_ROW = 2
const HEADER_ROW = 4
const FIRST_DATA_ROW = HEADER_ROW + 1

const thinBorder: Partial<Borders> = {
  top: { style: "thin", color: { argb: COLORS.border } },
  left: { style: "thin", color: { argb: COLORS.border } },
  bottom: { style: "thin", color: { argb: COLORS.border } },
  right: { style: "thin", color: { argb: COLORS.border } },
}

function solidFill(argb: string): Fill {
  return { type: "pattern", pattern: "solid", fgColor: { argb } }
}

function font(overrides: Partial<Font> = {}): Partial<Font> {
  return { name: FONT_NAME, size: 11, ...overrides }
}

function formatDateBR(value: Date): string {
  return value.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" })
}

function formatDateTimeBR(value: Date): string {
  return `${formatDateBR(value)} ${value.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`
}

function getCostCenterCode(label: string): number {
  const match = label.match(/^\s*(\d+)/)
  return match ? Number(match[1]) : Number.POSITIVE_INFINITY
}

function compareCostCenters(left: string, right: string): number {
  const leftCode = getCostCenterCode(left)
  const rightCode = getCostCenterCode(right)
  if (leftCode !== rightCode) return leftCode < rightCode ? -1 : 1
  return left.localeCompare(right, "pt-BR")
}

function styleHeaderCell(cell: Cell) {
  cell.font = font({ bold: true, color: { argb: COLORS.white } })
  cell.fill = solidFill(COLORS.headerRed)
  cell.border = thinBorder
  cell.alignment = { horizontal: "center", vertical: "middle" }
}

function styleBodyCell(cell: Cell) {
  cell.font = font()
  cell.border = thinBorder
  cell.alignment = { vertical: "middle" }
}

function estimateWidth(values: string[], min: number, max: number): number {
  const longest = values.reduce((size, value) => Math.max(size, value.length), 0)
  return Math.min(max, Math.max(min, longest + 3))
}

function buildSummary(options: ConsolidatedExportOptions): Array<{ centroCusto: string; total: number }> {
  const totals = new Map<string, number>()

  for (const center of options.extraCostCenters ?? []) {
    if (center) totals.set(center, 0)
  }

  for (const row of options.rows) {
    totals.set(row.centroCusto, (totals.get(row.centroCusto) ?? 0) + row.valorTransacao)
  }

  return Array.from(totals.entries())
    .map(([centroCusto, total]) => ({ centroCusto, total }))
    .sort((left, right) => compareCostCenters(left.centroCusto, right.centroCusto))
}

function writeTitle(worksheet: Worksheet, options: ConsolidatedExportOptions, lastColumn: string) {
  worksheet.mergeCells(`A${TITLE_ROW}:${lastColumn}${TITLE_ROW}`)
  const title = worksheet.getCell(`A${TITLE_ROW}`)
  title.value = "RELATÓRIO DE CONSUMO DE COMBUSTÍVEL — CONSOLIDADO POR CENTRO DE CUSTO"
  title.font = font({ size: 14, bold: true, color: { argb: COLORS.white } })
  title.fill = solidFill(COLORS.titleRed)
  title.alignment = { horizontal: "left", vertical: "middle", indent: 1 }
  worksheet.getRow(TITLE_ROW).height = 28

  const details = [
    `Período: ${formatDateBR(options.start)} a ${formatDateBR(options.end)}`,
    `Abastecimentos: ${options.totalAbastecimentos}`,
    ...(options.appliedFilters ?? []),
    `Gerado em: ${formatDateTimeBR(new Date())}`,
  ]

  worksheet.mergeCells(`A${SUBTITLE_ROW}:${lastColumn}${SUBTITLE_ROW}`)
  const subtitle = worksheet.getCell(`A${SUBTITLE_ROW}`)
  subtitle.value = details.join("   |   ")
  subtitle.font = font({ size: 10, italic: true, color: { argb: COLORS.subtitle } })
  subtitle.alignment = { horizontal: "left", vertical: "middle", indent: 1 }
  worksheet.getRow(SUBTITLE_ROW).height = 20
}

export async function buildConsolidatedWorkbook(options: ConsolidatedExportOptions): Promise<Blob> {
  const ExcelJSModule = await import("exceljs")
  const ExcelJS = (ExcelJSModule as unknown as { default?: typeof ExcelJSModule }).default ?? ExcelJSModule

  const workbook = new ExcelJS.Workbook()
  workbook.creator = "SLN Frota"
  workbook.created = new Date()
  workbook.calcProperties.fullCalcOnLoad = true

  const worksheet = workbook.addWorksheet("Consolidado", {
    views: [{ state: "frozen", ySplit: HEADER_ROW, showGridLines: false }],
    pageSetup: {
      paperSize: 9,
      orientation: "landscape",
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
      horizontalCentered: true,
      margins: { left: 0.4, right: 0.4, top: 0.5, bottom: 0.6, header: 0.3, footer: 0.3 },
      printTitlesRow: `${HEADER_ROW}:${HEADER_ROW}`,
    },
    headerFooter: {
      oddFooter: "&L&8SLN Frota — Consolidado de combustível&R&8Página &P de &N",
    },
  })

  const rows = [...options.rows].sort(
    (left, right) =>
      right.valorTransacao - left.valorTransacao || left.centroCusto.localeCompare(right.centroCusto, "pt-BR")
  )
  const summary = buildSummary(options)

  worksheet.columns = [
    { key: "A", width: estimateWidth(rows.map((row) => row.centroCusto), 28, 56) },
    { key: "B", width: estimateWidth(rows.map((row) => row.motorista), 30, 46) },
    { key: "C", width: 25 },
    { key: "D", width: 18 },
    { key: "E", width: 3 },
    { key: "F", width: estimateWidth(summary.map((item) => item.centroCusto), 32, 60) },
    { key: "G", width: 22 },
    { key: "H", width: 12 },
  ]

  writeTitle(worksheet, options, "H")

  // Tabela detalhada (A:D)
  const header = worksheet.getRow(HEADER_ROW)
  header.height = 20
  ;["CENTRO DE CUSTO", "NOME MOTORISTA", "VALOR DA TRANSAÇÃO", "PLACA CARTÃO"].forEach((label, index) => {
    const cell = header.getCell(index + 1)
    cell.value = label
    styleHeaderCell(cell)
  })

  rows.forEach((row, index) => {
    const excelRow = worksheet.getRow(FIRST_DATA_ROW + index)
    excelRow.getCell(1).value = row.centroCusto
    excelRow.getCell(2).value = row.motorista
    excelRow.getCell(3).value = Math.round(row.valorTransacao * 100) / 100
    excelRow.getCell(4).value = row.placaCartao

    for (let column = 1; column <= 4; column += 1) {
      styleBodyCell(excelRow.getCell(column))
    }

    const valueCell = excelRow.getCell(3)
    valueCell.numFmt = CURRENCY_FORMAT
    valueCell.fill = solidFill(COLORS.valueOrange)
    excelRow.getCell(4).alignment = { horizontal: "center", vertical: "middle" }
  })

  const lastDataRow = FIRST_DATA_ROW + Math.max(rows.length, 1) - 1
  worksheet.autoFilter = `A${HEADER_ROW}:D${lastDataRow}`

  // Resumo por centro de custo (F:H)
  ;["GASTOS POR CENTRO DE CUSTO", "VALOR DA TRANSAÇÃO", "% DO TOTAL"].forEach((label, index) => {
    const cell = header.getCell(6 + index)
    cell.value = label
    styleHeaderCell(cell)
  })

  const summaryTotalRow = FIRST_DATA_ROW + summary.length
  const grandTotal = summary.reduce((sum, item) => sum + item.total, 0)
  const centersRange = `$A$${FIRST_DATA_ROW}:$A$${lastDataRow}`
  const valuesRange = `$C$${FIRST_DATA_ROW}:$C$${lastDataRow}`

  summary.forEach((item, index) => {
    const rowNumber = FIRST_DATA_ROW + index
    const excelRow = worksheet.getRow(rowNumber)
    const centerCell = excelRow.getCell(6)
    const totalCell = excelRow.getCell(7)
    const shareCell = excelRow.getCell(8)
    const roundedTotal = Math.round(item.total * 100) / 100

    centerCell.value = item.centroCusto
    styleBodyCell(centerCell)
    centerCell.fill = solidFill(COLORS.summaryPeach)

    // SUMIF mantém o resumo coerente se as linhas forem ajustadas manualmente antes do envio.
    totalCell.value = { formula: `SUMIF(${centersRange},F${rowNumber},${valuesRange})`, result: roundedTotal }
    styleBodyCell(totalCell)
    totalCell.numFmt = CURRENCY_FORMAT

    shareCell.value = {
      formula: `IF($G$${summaryTotalRow}=0,0,G${rowNumber}/$G$${summaryTotalRow})`,
      result: grandTotal > 0 ? item.total / grandTotal : 0,
    }
    styleBodyCell(shareCell)
    shareCell.numFmt = PERCENT_FORMAT
    shareCell.alignment = { horizontal: "center", vertical: "middle" }
  })

  const totalRow = worksheet.getRow(summaryTotalRow)
  const totalLabel = totalRow.getCell(6)
  const totalValue = totalRow.getCell(7)
  const totalShare = totalRow.getCell(8)
  const summaryFirst = FIRST_DATA_ROW
  const summaryLast = Math.max(summaryTotalRow - 1, FIRST_DATA_ROW)

  totalLabel.value = "TOTAL GERAL"
  totalValue.value = { formula: `SUM(G${summaryFirst}:G${summaryLast})`, result: Math.round(grandTotal * 100) / 100 }
  totalShare.value = { formula: `SUM(H${summaryFirst}:H${summaryLast})`, result: grandTotal > 0 ? 1 : 0 }

  for (const cell of [totalLabel, totalValue, totalShare]) {
    styleBodyCell(cell)
    cell.font = font({ bold: true })
    cell.fill = solidFill(COLORS.totalFill)
    cell.border = { ...thinBorder, top: { style: "medium", color: { argb: COLORS.headerRed } } }
  }
  totalLabel.alignment = { horizontal: "right", vertical: "middle" }
  totalValue.numFmt = CURRENCY_FORMAT
  totalShare.numFmt = PERCENT_FORMAT
  totalShare.alignment = { horizontal: "center", vertical: "middle" }

  const lastRow = Math.max(lastDataRow, summaryTotalRow)
  worksheet.pageSetup.printArea = `A1:H${lastRow}`

  const buffer = await workbook.xlsx.writeBuffer()
  return new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" })
}

export function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement("a")
  anchor.href = url
  anchor.download = fileName
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
