import type { Borders, Cell, Fill, Font, Workbook, Worksheet } from "exceljs"
import type { MonthlyClosingData } from "@/lib/fleet-monthly-closing"

export type MonthlyClosingExportOptions = {
  data: MonthlyClosingData
  /** Competência no formato AAAA-MM. */
  month: string
}

const COLORS = {
  navy: "FF1F3864",
  navyDark: "FF14264A",
  white: "FFFFFFFF",
  zebra: "FFF2F5FA",
  border: "FFB4BFD1",
  input: "FFFFF8E1",
  totalFill: "FFDCE3F0",
  subtitle: "FF4A5568",
  kpiLabel: "FFE9EEF6",
  highlight: "FFFDE9D9",
}

const CURRENCY_FORMAT = '_-"R$"\\ * #,##0.00_-;\\-"R$"\\ * #,##0.00_-;_-"R$"\\ * "-"??_-;_-@_-'
const PERCENT_FORMAT = "0.0%"
const INTEGER_FORMAT = "0"
const FONT_NAME = "Calibri"

const MAIN_SHEET = "FECHAMENTO"
const SUMMARY_SHEET = "RESUMO"
const UNLINKED_SHEET = "COMBUSTÍVEL SEM VEÍCULO"

const HEADER_ROW = 4
const FIRST_DATA_ROW = HEADER_ROW + 1

const MONTH_NAMES = [
  "JANEIRO",
  "FEVEREIRO",
  "MARÇO",
  "ABRIL",
  "MAIO",
  "JUNHO",
  "JULHO",
  "AGOSTO",
  "SETEMBRO",
  "OUTUBRO",
  "NOVEMBRO",
  "DEZEMBRO",
]

const thinBorder: Partial<Borders> = {
  top: { style: "thin", color: { argb: COLORS.border } },
  left: { style: "thin", color: { argb: COLORS.border } },
  bottom: { style: "thin", color: { argb: COLORS.border } },
  right: { style: "thin", color: { argb: COLORS.border } },
}

const totalBorder: Partial<Borders> = {
  ...thinBorder,
  top: { style: "medium", color: { argb: COLORS.navy } },
  bottom: { style: "medium", color: { argb: COLORS.navy } },
}

function solidFill(argb: string): Fill {
  return { type: "pattern", pattern: "solid", fgColor: { argb } }
}

function font(overrides: Partial<Font> = {}): Partial<Font> {
  return { name: FONT_NAME, size: 11, ...overrides }
}

function round(value: number): number {
  return Math.round(value * 100) / 100
}

function quoteSheet(name: string): string {
  return `'${name.replace(/'/g, "''")}'`
}

export function formatClosingMonthLabel(month: string): string {
  const [year, monthNumber] = month.split("-").map(Number)
  if (!year || !monthNumber) return month
  return `${MONTH_NAMES[monthNumber - 1]}/${year}`
}

function getMonthBounds(month: string): { start: Date; end: Date } {
  const [year, monthNumber] = month.split("-").map(Number)
  return { start: new Date(year, monthNumber - 1, 1), end: new Date(year, monthNumber, 0) }
}

function formatDateBR(value: Date): string {
  return value.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" })
}

function formatDateTimeBR(value: Date): string {
  return `${formatDateBR(value)} ${value.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`
}

function styleHeader(cell: Cell) {
  cell.font = font({ bold: true, color: { argb: COLORS.white } })
  cell.fill = solidFill(COLORS.navy)
  cell.border = thinBorder
  cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true }
}

function styleBody(cell: Cell, zebra: boolean) {
  cell.font = font()
  cell.border = thinBorder
  cell.alignment = { vertical: "middle" }
  if (zebra) cell.fill = solidFill(COLORS.zebra)
}

function styleTotal(cell: Cell) {
  cell.font = font({ bold: true, color: { argb: COLORS.navyDark } })
  cell.fill = solidFill(COLORS.totalFill)
  cell.border = totalBorder
  cell.alignment = { vertical: "middle" }
}

function writeBanner(worksheet: Worksheet, lastColumn: string, title: string, subtitle: string) {
  worksheet.mergeCells(`A1:${lastColumn}1`)
  const titleCell = worksheet.getCell("A1")
  titleCell.value = title
  titleCell.font = font({ size: 15, bold: true, color: { argb: COLORS.white } })
  titleCell.fill = solidFill(COLORS.navyDark)
  titleCell.alignment = { horizontal: "left", vertical: "middle", indent: 1 }
  worksheet.getRow(1).height = 30

  worksheet.mergeCells(`A2:${lastColumn}2`)
  const subtitleCell = worksheet.getCell("A2")
  subtitleCell.value = subtitle
  subtitleCell.font = font({ size: 10, italic: true, color: { argb: COLORS.subtitle } })
  subtitleCell.alignment = { horizontal: "left", vertical: "middle", indent: 1 }
  worksheet.getRow(2).height = 20
}

function createSheet(workbook: Workbook, name: string, tabColor: string, frozenRows: number, landscape = true): Worksheet {
  return workbook.addWorksheet(name, {
    properties: { tabColor: { argb: tabColor } },
    views: [{ state: "frozen", ySplit: frozenRows, showGridLines: false }],
    pageSetup: {
      paperSize: 9,
      orientation: landscape ? "landscape" : "portrait",
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
      horizontalCentered: true,
      margins: { left: 0.35, right: 0.35, top: 0.5, bottom: 0.6, header: 0.3, footer: 0.3 },
    },
    headerFooter: {
      oddFooter: "&L&8SLN Frota — Fechamento mensal da frota&R&8Página &P de &N",
    },
  })
}

type MainSheetRefs = {
  firstRow: number
  lastRow: number
  totalRow: number
}

function writeMainSheet(workbook: Workbook, options: MonthlyClosingExportOptions, subtitle: string): MainSheetRefs {
  const { rows } = options.data
  const worksheet = createSheet(workbook, MAIN_SHEET, COLORS.navy, HEADER_ROW)

  worksheet.columns = [
    { width: 12 },
    { width: 26 },
    { width: 34 },
    { width: 18 },
    { width: 40 },
    { width: 40 },
    { width: 17 },
    { width: 15 },
    { width: 18 },
  ]

  writeBanner(worksheet, "I", `FECHAMENTO MENSAL DA FROTA — ${formatClosingMonthLabel(options.month)}`, subtitle)

  const headerRow = worksheet.getRow(HEADER_ROW)
  headerRow.height = 32
  ;[
    "PLACA",
    "LOCADORA",
    "MODELO",
    "VALOR ALUGUEL",
    "CONDUTOR",
    "CENTRO DE CUSTO",
    "COMBUSTÍVEL",
    "SEM PARAR",
    "VALOR TOTAL",
  ].forEach((label, index) => {
    const cell = headerRow.getCell(index + 1)
    cell.value = label
    styleHeader(cell)
  })

  rows.forEach((row, index) => {
    const rowNumber = FIRST_DATA_ROW + index
    const excelRow = worksheet.getRow(rowNumber)
    const zebra = index % 2 === 1
    const total = round(row.valorAluguel + row.combustivel + row.semParar)

    excelRow.getCell(1).value = row.placa
    excelRow.getCell(2).value = row.locadora
    excelRow.getCell(3).value = row.modelo
    excelRow.getCell(4).value = row.valorAluguel
    excelRow.getCell(5).value = row.condutor
    excelRow.getCell(6).value = row.centroCusto
    excelRow.getCell(7).value = row.combustivel
    excelRow.getCell(8).value = row.semParar
    excelRow.getCell(9).value = { formula: `SUM(D${rowNumber},G${rowNumber},H${rowNumber})`, result: total }

    for (let column = 1; column <= 9; column += 1) {
      styleBody(excelRow.getCell(column), zebra)
    }

    excelRow.getCell(1).font = font({ bold: true })
    excelRow.getCell(1).alignment = { horizontal: "center", vertical: "middle" }
    excelRow.getCell(2).alignment = { horizontal: "center", vertical: "middle" }
    for (const column of [4, 7, 8, 9]) excelRow.getCell(column).numFmt = CURRENCY_FORMAT
    // Sem Parar ainda não vem do sistema: célula destacada para preenchimento manual.
    excelRow.getCell(8).fill = solidFill(COLORS.input)
    excelRow.getCell(9).font = font({ bold: true })
  })

  const lastRow = FIRST_DATA_ROW + Math.max(rows.length, 1) - 1
  const totalRowNumber = lastRow + 1
  const totalRow = worksheet.getRow(totalRowNumber)
  totalRow.height = 22

  worksheet.mergeCells(`A${totalRowNumber}:C${totalRowNumber}`)
  totalRow.getCell(1).value = `TOTAL GERAL — ${rows.length} VEÍCULOS`
  const sums: Record<number, number> = {
    4: rows.reduce((sum, row) => sum + row.valorAluguel, 0),
    7: rows.reduce((sum, row) => sum + row.combustivel, 0),
    8: rows.reduce((sum, row) => sum + row.semParar, 0),
  }
  sums[9] = sums[4] + sums[7] + sums[8]

  for (let column = 1; column <= 9; column += 1) {
    const cell = totalRow.getCell(column)
    styleTotal(cell)
    if (column in sums) {
      const letter = String.fromCharCode(64 + column)
      // SUBTOTAL(109) acompanha o autofiltro: ao filtrar, o total mostra só as linhas visíveis.
      cell.value = { formula: `SUBTOTAL(109,${letter}${FIRST_DATA_ROW}:${letter}${lastRow})`, result: round(sums[column]) }
      cell.numFmt = CURRENCY_FORMAT
    }
  }
  totalRow.getCell(1).alignment = { horizontal: "right", vertical: "middle", indent: 1 }

  const noteRow = totalRowNumber + 2
  worksheet.mergeCells(`A${noteRow}:I${noteRow}`)
  const note = worksheet.getCell(`A${noteRow}`)
  note.value =
    "Notas: combustível atribuído ao condutor do veículo (ou ao cartão do veículo quando o motorista não possui veículo vinculado). " +
    "SEM PARAR ainda não integrado ao sistema — preencha a coluna H manualmente; o VALOR TOTAL e o RESUMO são recalculados automaticamente."
  note.font = font({ size: 9, italic: true, color: { argb: COLORS.subtitle } })
  note.alignment = { wrapText: true, vertical: "top" }
  worksheet.getRow(noteRow).height = 30

  worksheet.autoFilter = `A${HEADER_ROW}:I${lastRow}`
  worksheet.pageSetup.printArea = `A1:I${noteRow}`
  worksheet.pageSetup.printTitlesRow = `${HEADER_ROW}:${HEADER_ROW}`

  return { firstRow: FIRST_DATA_ROW, lastRow, totalRow: totalRowNumber }
}

type GroupTotals = { key: string; veiculos: number; aluguel: number; combustivel: number; semParar: number; total: number }

function groupRows(rows: MonthlyClosingData["rows"], getKey: (row: MonthlyClosingData["rows"][number]) => string): GroupTotals[] {
  const groups = new Map<string, GroupTotals>()
  for (const row of rows) {
    const key = getKey(row)
    const current = groups.get(key) ?? { key, veiculos: 0, aluguel: 0, combustivel: 0, semParar: 0, total: 0 }
    current.veiculos += 1
    current.aluguel += row.valorAluguel
    current.combustivel += row.combustivel
    current.semParar += row.semParar
    current.total += row.valorAluguel + row.combustivel + row.semParar
    groups.set(key, current)
  }
  return Array.from(groups.values())
}

function writeGroupTable(
  worksheet: Worksheet,
  startRow: number,
  title: string,
  keyHeader: string,
  keyColumn: "B" | "F",
  groups: GroupTotals[],
  refs: MainSheetRefs,
): number {
  const main = quoteSheet(MAIN_SHEET)
  const range = (column: string) => `${main}!$${column}$${refs.firstRow}:$${column}$${refs.lastRow}`

  worksheet.mergeCells(`A${startRow}:G${startRow}`)
  const titleCell = worksheet.getCell(`A${startRow}`)
  titleCell.value = title
  titleCell.font = font({ size: 12, bold: true, color: { argb: COLORS.navyDark } })
  titleCell.border = { bottom: { style: "medium", color: { argb: COLORS.navy } } }
  worksheet.getRow(startRow).height = 22

  const headerRowNumber = startRow + 1
  const headerRow = worksheet.getRow(headerRowNumber)
  headerRow.height = 30
  ;[keyHeader, "VEÍCULOS", "ALUGUEL", "COMBUSTÍVEL", "SEM PARAR", "TOTAL", "% DO TOTAL"].forEach((label, index) => {
    const cell = headerRow.getCell(index + 1)
    cell.value = label
    styleHeader(cell)
  })

  const firstRow = headerRowNumber + 1
  const totalRowNumber = firstRow + groups.length
  const grandTotal = groups.reduce((sum, group) => sum + group.total, 0)

  groups.forEach((group, index) => {
    const rowNumber = firstRow + index
    const excelRow = worksheet.getRow(rowNumber)
    const zebra = index % 2 === 1
    const criteria = `$A${rowNumber}`

    excelRow.getCell(1).value = group.key
    excelRow.getCell(2).value = { formula: `COUNTIF(${range(keyColumn)},${criteria})`, result: group.veiculos }
    excelRow.getCell(3).value = { formula: `SUMIF(${range(keyColumn)},${criteria},${range("D")})`, result: round(group.aluguel) }
    excelRow.getCell(4).value = { formula: `SUMIF(${range(keyColumn)},${criteria},${range("G")})`, result: round(group.combustivel) }
    excelRow.getCell(5).value = { formula: `SUMIF(${range(keyColumn)},${criteria},${range("H")})`, result: round(group.semParar) }
    excelRow.getCell(6).value = { formula: `SUM(C${rowNumber}:E${rowNumber})`, result: round(group.total) }
    excelRow.getCell(7).value = {
      formula: `IF($F$${totalRowNumber}=0,0,F${rowNumber}/$F$${totalRowNumber})`,
      result: grandTotal > 0 ? group.total / grandTotal : 0,
    }

    for (let column = 1; column <= 7; column += 1) styleBody(excelRow.getCell(column), zebra)
    excelRow.getCell(2).numFmt = INTEGER_FORMAT
    excelRow.getCell(2).alignment = { horizontal: "center", vertical: "middle" }
    for (const column of [3, 4, 5, 6]) excelRow.getCell(column).numFmt = CURRENCY_FORMAT
    excelRow.getCell(6).font = font({ bold: true })
    excelRow.getCell(7).numFmt = PERCENT_FORMAT
    excelRow.getCell(7).alignment = { horizontal: "center", vertical: "middle" }
  })

  const totalRow = worksheet.getRow(totalRowNumber)
  const lastGroupRow = Math.max(totalRowNumber - 1, firstRow)
  const totalsByColumn: Record<number, number> = {
    2: groups.reduce((sum, group) => sum + group.veiculos, 0),
    3: groups.reduce((sum, group) => sum + group.aluguel, 0),
    4: groups.reduce((sum, group) => sum + group.combustivel, 0),
    5: groups.reduce((sum, group) => sum + group.semParar, 0),
    6: grandTotal,
    7: grandTotal > 0 ? 1 : 0,
  }
  totalRow.getCell(1).value = "TOTAL"
  for (let column = 1; column <= 7; column += 1) {
    const cell = totalRow.getCell(column)
    styleTotal(cell)
    if (column === 1) continue
    const letter = String.fromCharCode(64 + column)
    cell.value = { formula: `SUM(${letter}${firstRow}:${letter}${lastGroupRow})`, result: round(totalsByColumn[column]) }
    cell.numFmt = column === 2 ? INTEGER_FORMAT : column === 7 ? PERCENT_FORMAT : CURRENCY_FORMAT
    if (column === 2 || column === 7) cell.alignment = { horizontal: "center", vertical: "middle" }
  }

  return totalRowNumber
}

function writeSummarySheet(workbook: Workbook, options: MonthlyClosingExportOptions, subtitle: string, refs: MainSheetRefs, unlinkedTotalRef: string | null) {
  const { data } = options
  const worksheet = createSheet(workbook, SUMMARY_SHEET, "FF2E7D32", 2, false)
  worksheet.columns = [{ width: 58 }, { width: 11 }, { width: 18 }, { width: 18 }, { width: 15 }, { width: 19 }, { width: 12 }]

  writeBanner(worksheet, "G", `RESUMO DO FECHAMENTO — ${formatClosingMonthLabel(options.month)}`, subtitle)

  const main = quoteSheet(MAIN_SHEET)
  const sumOf = (column: string) => `SUM(${main}!${column}${refs.firstRow}:${column}${refs.lastRow})`
  const totals = {
    aluguel: data.rows.reduce((sum, row) => sum + row.valorAluguel, 0),
    combustivel: data.totalFuelLinked,
    semParar: data.rows.reduce((sum, row) => sum + row.semParar, 0),
  }
  const totalFrota = totals.aluguel + totals.combustivel + totals.semParar

  const kpis: Array<{ label: string; value: { formula: string; result: number }; format: string; emphasis?: boolean }> = [
    { label: "Veículos no fechamento", value: { formula: `COUNTA(${main}!A${refs.firstRow}:A${refs.lastRow})`, result: data.rows.length }, format: INTEGER_FORMAT },
    { label: "Aluguel / locação", value: { formula: sumOf("D"), result: round(totals.aluguel) }, format: CURRENCY_FORMAT },
    { label: "Combustível dos veículos", value: { formula: sumOf("G"), result: round(totals.combustivel) }, format: CURRENCY_FORMAT },
    { label: "Sem Parar (preenchimento manual)", value: { formula: sumOf("H"), result: round(totals.semParar) }, format: CURRENCY_FORMAT },
    { label: "CUSTO TOTAL DA FROTA", value: { formula: sumOf("I"), result: round(totalFrota) }, format: CURRENCY_FORMAT, emphasis: true },
  ]

  const kpiStart = 4
  const fuelKpiRow = kpiStart + 2

  if (unlinkedTotalRef) {
    const unlinkedKpiRow = kpiStart + kpis.length
    kpis.push(
      {
        label: "Combustível sem veículo vinculado (ver aba)",
        value: { formula: unlinkedTotalRef, result: data.totalFuelUnlinked },
        format: CURRENCY_FORMAT,
      },
      {
        label: "Combustível total do mês (Veloe)",
        value: { formula: `C${fuelKpiRow}+C${unlinkedKpiRow}`, result: data.totalFuelMonth },
        format: CURRENCY_FORMAT,
      },
    )
  }

  kpis.forEach((kpi, index) => {
    const rowNumber = kpiStart + index
    worksheet.mergeCells(`A${rowNumber}:B${rowNumber}`)
    const labelCell = worksheet.getCell(`A${rowNumber}`)
    const valueCell = worksheet.getCell(`C${rowNumber}`)
    labelCell.value = kpi.label
    valueCell.value = kpi.value
    valueCell.numFmt = kpi.format

    if (kpi.emphasis) {
      for (const cell of [labelCell, valueCell, worksheet.getCell(`B${rowNumber}`)]) {
        cell.font = font({ bold: true, size: 12, color: { argb: COLORS.white } })
        cell.fill = solidFill(COLORS.navy)
        cell.border = thinBorder
      }
    } else {
      for (const cell of [labelCell, worksheet.getCell(`B${rowNumber}`)]) {
        cell.font = font({ bold: true, color: { argb: COLORS.navyDark } })
        cell.fill = solidFill(COLORS.kpiLabel)
        cell.border = thinBorder
      }
      valueCell.font = font({ bold: true })
      valueCell.border = thinBorder
    }
    labelCell.alignment = { vertical: "middle", indent: 1 }
    valueCell.alignment = kpi.format === INTEGER_FORMAT ? { horizontal: "center", vertical: "middle" } : { vertical: "middle" }
    worksheet.getRow(rowNumber).height = 20
  })

  let nextRow = kpiStart + kpis.length + 2

  const byLocadora = groupRows(data.rows, (row) => row.locadora)
  nextRow = writeGroupTable(worksheet, nextRow, "CUSTO POR LOCADORA / ORIGEM", "LOCADORA / ORIGEM", "B", byLocadora, refs) + 3

  const byCentro = groupRows(data.rows, (row) => row.centroCusto).sort((left, right) => right.total - left.total)
  const lastRow = writeGroupTable(worksheet, nextRow, "CUSTO POR CENTRO DE CUSTO", "CENTRO DE CUSTO", "F", byCentro, refs)

  worksheet.pageSetup.printArea = `A1:G${lastRow}`
}

function writeUnlinkedSheet(workbook: Workbook, options: MonthlyClosingExportOptions, subtitle: string) {
  const { unlinkedFuel } = options.data
  if (unlinkedFuel.length === 0) return

  const worksheet = createSheet(workbook, UNLINKED_SHEET, "FFC62828", HEADER_ROW, false)
  worksheet.columns = [{ width: 44 }, { width: 30 }, { width: 19 }, { width: 18 }]
  writeBanner(worksheet, "D", `COMBUSTÍVEL SEM VEÍCULO VINCULADO — ${formatClosingMonthLabel(options.month)}`, subtitle)

  const headerRow = worksheet.getRow(HEADER_ROW)
  headerRow.height = 30
  ;["MOTORISTA", "PLACA(S) DO CARTÃO", "ABASTECIMENTOS", "VALOR"].forEach((label, index) => {
    const cell = headerRow.getCell(index + 1)
    cell.value = label
    styleHeader(cell)
  })

  unlinkedFuel.forEach((item, index) => {
    const excelRow = worksheet.getRow(FIRST_DATA_ROW + index)
    excelRow.getCell(1).value = item.motorista
    excelRow.getCell(2).value = item.placasCartao
    excelRow.getCell(3).value = item.abastecimentos
    excelRow.getCell(4).value = item.valor
    for (let column = 1; column <= 4; column += 1) styleBody(excelRow.getCell(column), index % 2 === 1)
    excelRow.getCell(2).alignment = { horizontal: "center", vertical: "middle" }
    excelRow.getCell(3).alignment = { horizontal: "center", vertical: "middle" }
    excelRow.getCell(4).numFmt = CURRENCY_FORMAT
  })

  const lastRow = FIRST_DATA_ROW + unlinkedFuel.length - 1
  const totalRowNumber = lastRow + 1
  const totalRow = worksheet.getRow(totalRowNumber)
  totalRow.getCell(1).value = "TOTAL SEM VEÍCULO"
  totalRow.getCell(3).value = {
    formula: `SUM(C${FIRST_DATA_ROW}:C${lastRow})`,
    result: unlinkedFuel.reduce((sum, item) => sum + item.abastecimentos, 0),
  }
  totalRow.getCell(4).value = { formula: `SUM(D${FIRST_DATA_ROW}:D${lastRow})`, result: options.data.totalFuelUnlinked }
  for (let column = 1; column <= 4; column += 1) styleTotal(totalRow.getCell(column))
  totalRow.getCell(3).alignment = { horizontal: "center", vertical: "middle" }
  totalRow.getCell(4).numFmt = CURRENCY_FORMAT

  const noteRow = totalRowNumber + 2
  worksheet.mergeCells(`A${noteRow}:D${noteRow}`)
  const note = worksheet.getCell(`A${noteRow}`)
  note.value =
    "Abastecimentos do mês cujo motorista não está vinculado a um veículo da frota e cujo cartão não pertence a nenhum veículo do fechamento. " +
    "Vincule o motorista no Ajuste Geral para que o valor passe a compor o veículo correto."
  note.font = font({ size: 9, italic: true, color: { argb: COLORS.subtitle } })
  note.alignment = { wrapText: true, vertical: "top" }
  worksheet.getRow(noteRow).height = 42

  worksheet.autoFilter = `A${HEADER_ROW}:D${lastRow}`
  worksheet.pageSetup.printArea = `A1:D${noteRow}`
}

export async function buildMonthlyClosingWorkbook(options: MonthlyClosingExportOptions): Promise<Blob> {
  const ExcelJSModule = await import("exceljs")
  const ExcelJS = (ExcelJSModule as unknown as { default?: typeof ExcelJSModule }).default ?? ExcelJSModule

  const workbook = new ExcelJS.Workbook()
  workbook.creator = "SLN Frota"
  workbook.created = new Date()
  workbook.calcProperties.fullCalcOnLoad = true

  const { start, end } = getMonthBounds(options.month)
  const subtitle = [
    `Competência: ${formatClosingMonthLabel(options.month)}`,
    `Período do combustível: ${formatDateBR(start)} a ${formatDateBR(end)}`,
    `Veículos: ${options.data.rows.length}`,
    `Gerado em: ${formatDateTimeBR(new Date())}`,
  ].join("   |   ")

  const refs = writeMainSheet(workbook, options, subtitle)
  // O RESUMO é criado antes da aba de pendências para aparecer como segunda aba; a referência ao total é conhecida de antemão.
  const unlinkedTotalRow = FIRST_DATA_ROW + options.data.unlinkedFuel.length
  const unlinkedTotalRef = options.data.unlinkedFuel.length > 0 ? `${quoteSheet(UNLINKED_SHEET)}!D${unlinkedTotalRow}` : null
  writeSummarySheet(workbook, options, subtitle, refs, unlinkedTotalRef)
  writeUnlinkedSheet(workbook, options, subtitle)

  const buffer = await workbook.xlsx.writeBuffer()
  return new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" })
}

export function buildMonthlyClosingFileName(month: string): string {
  return `fechamento-frota-${month}.xlsx`
}
