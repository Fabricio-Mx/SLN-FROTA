import type { Borders, Font } from "exceljs"
import {
  MULTA_GRAVIDADE_IMPORT_LABELS,
  MULTA_TRATATIVA_COLORS,
  MULTA_TRATATIVA_LABELS,
  parseMultaLocalDate,
  type MultaImportada,
} from "@/lib/multas-import-shared"

type ExportOptions = {
  title: string
  periodLabel: string
  records: MultaImportada[]
}

const THIN_BORDER: Partial<Borders> = {
  top: { style: "thin", color: { argb: "FFD9DED4" } },
  left: { style: "thin", color: { argb: "FFD9DED4" } },
  bottom: { style: "thin", color: { argb: "FFD9DED4" } },
  right: { style: "thin", color: { argb: "FFD9DED4" } },
}

function font(overrides: Partial<Font> = {}): Partial<Font> {
  return { name: "Calibri", size: 10, ...overrides }
}

function toExcelDate(value: string | null): Date | null {
  const date = parseMultaLocalDate(value)
  if (!date) return null
  // O Excel grava data/hora sem fuso: enviamos o "relógio de parede" em UTC para não deslocar o horário.
  return new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate(), date.getHours(), date.getMinutes()))
}

const COLUMNS: Array<{ header: string; width: number; value: (record: MultaImportada) => unknown; format?: string }> = [
  { header: "Tratativa", width: 18, value: (record) => MULTA_TRATATIVA_LABELS[record.tratativa] },
  { header: "Placa", width: 11, value: (record) => record.placa },
  { header: "Modelo", width: 34, value: (record) => record.modelo },
  { header: "Status", width: 14, value: (record) => record.tipoRegistro },
  { header: "Código", width: 9, value: (record) => record.codigoInfracao },
  { header: "Descrição da infração", width: 36, value: (record) => record.descricaoInfracao },
  { header: "Pontos", width: 8, value: (record) => record.pontos },
  { header: "Gravidade", width: 12, value: (record) => (record.gravidade ? MULTA_GRAVIDADE_IMPORT_LABELS[record.gravidade] : "") },
  { header: "Data da infração", width: 17, value: (record) => toExcelDate(record.dataInfracao), format: "dd/mm/yyyy hh:mm" },
  { header: "Órgão", width: 30, value: (record) => record.orgao },
  { header: "AIT", width: 14, value: (record) => record.ait },
  { header: "Limite envio docs", width: 15, value: (record) => toExcelDate(record.dataLimiteEnvio), format: "dd/mm/yyyy" },
  { header: "Situação indicação", width: 30, value: (record) => record.situacaoIndicacao },
  { header: "Condutor indicado", width: 34, value: (record) => record.condutor },
  { header: "Centro de custo", width: 32, value: (record) => record.centroCusto },
  { header: "Valor infração", width: 14, value: (record) => record.valorInfracao, format: '"R$" #,##0.00' },
  { header: "Valor NIC", width: 12, value: (record) => record.valorNic, format: '"R$" #,##0.00' },
  { header: "Valor faturado", width: 14, value: (record) => record.valorFaturado, format: '"R$" #,##0.00' },
  { header: "Desconto RH", width: 13, value: (record) => record.descontoRh, format: '"R$" #,##0.00' },
  { header: "Envio ao RH", width: 13, value: (record) => toExcelDate(record.envioRhEm ?? null), format: "dd/mm/yyyy" },
  { header: "Local da infração", width: 36, value: (record) => record.localInfracao ?? "" },
  { header: "Observações", width: 50, value: (record) => record.observacoes },
]

export async function downloadMultasWorkbook({ title, periodLabel, records }: ExportOptions) {
  const ExcelJSModule = await import("exceljs")
  const ExcelJS = (ExcelJSModule as unknown as { default?: typeof ExcelJSModule }).default ?? ExcelJSModule

  const workbook = new ExcelJS.Workbook()
  workbook.creator = "SLN Frota"
  workbook.created = new Date()

  const worksheet = workbook.addWorksheet("Multas", {
    views: [{ state: "frozen", ySplit: 3, showGridLines: false }],
    pageSetup: { paperSize: 9, orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
  })

  worksheet.columns = COLUMNS.map((column) => ({ width: column.width }))
  const lastColumnLetter = worksheet.getColumn(COLUMNS.length).letter

  worksheet.mergeCells(`A1:${lastColumnLetter}1`)
  const titleCell = worksheet.getCell("A1")
  titleCell.value = title
  titleCell.font = font({ size: 14, bold: true, color: { argb: "FF2F4F2A" } })
  titleCell.alignment = { vertical: "middle" }
  worksheet.getRow(1).height = 24

  worksheet.mergeCells(`A2:${lastColumnLetter}2`)
  const subtitleCell = worksheet.getCell("A2")
  subtitleCell.value = `${periodLabel}   |   ${records.length} multa(s)   |   Gerado em ${new Date().toLocaleString("pt-BR")}`
  subtitleCell.font = font({ italic: true, color: { argb: "FF64748B" } })

  const headerRow = worksheet.getRow(3)
  COLUMNS.forEach((column, index) => {
    const cell = headerRow.getCell(index + 1)
    cell.value = column.header
    cell.font = font({ bold: true, color: { argb: "FF1F2937" } })
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE3EEDC" } }
    cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true }
    cell.border = THIN_BORDER
  })
  headerRow.height = 30
  worksheet.autoFilter = { from: { row: 3, column: 1 }, to: { row: 3, column: COLUMNS.length } }

  records.forEach((record, recordIndex) => {
    const row = worksheet.getRow(4 + recordIndex)
    const fillColor = MULTA_TRATATIVA_COLORS[record.tratativa].excel

    COLUMNS.forEach((column, index) => {
      const cell = row.getCell(index + 1)
      cell.value = column.value(record) as never
      cell.font = font()
      cell.border = THIN_BORDER
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: fillColor } }
      if (column.format) cell.numFmt = column.format
    })
  })

  const buffer = await workbook.xlsx.writeBuffer()
  const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement("a")
  anchor.href = url
  anchor.download = `multas-${new Date().toISOString().slice(0, 10)}.xlsx`
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  URL.revokeObjectURL(url)
}
