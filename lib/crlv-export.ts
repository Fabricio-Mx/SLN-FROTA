import type { Borders, Font } from "exceljs"
import type { CrlvStatus, CrlvValidade } from "@/lib/crlv-validade"

export type CrlvExportRecord = {
  placa: string
  modelo: string
  renavam: string
  validade: CrlvValidade | null
}

type ExportOptions = {
  title: string
  filtroLabel?: string
  records: CrlvExportRecord[]
}

type SituacaoKey = CrlvStatus | "sem_documento"

const SITUACAO: Record<SituacaoKey, { label: string; fill: string; font: string }> = {
  valido: { label: "Válido", fill: "FFDCFCE7", font: "FF166534" },
  vencendo: { label: "Vencendo", fill: "FFFEF3C7", font: "FF92400E" },
  vencido: { label: "Vencido", fill: "FFFEE2E2", font: "FF991B1B" },
  nao_analisado: { label: "Aguardando análise", fill: "FFF1F5F9", font: "FF475569" },
  erro: { label: "Erro na leitura", fill: "FFF1F5F9", font: "FF475569" },
  sem_documento: { label: "Sem CRLV", fill: "FFF1F5F9", font: "FF475569" },
}

const SITUACAO_ORDEM: SituacaoKey[] = ["vencido", "vencendo", "valido", "nao_analisado", "erro", "sem_documento"]

const BRAND = "FFD97706"
const DARK = "FF1F2937"
const BORDER_COLOR = "FFE2E8F0"

const THIN_BORDER: Partial<Borders> = {
  top: { style: "thin", color: { argb: BORDER_COLOR } },
  left: { style: "thin", color: { argb: BORDER_COLOR } },
  bottom: { style: "thin", color: { argb: BORDER_COLOR } },
  right: { style: "thin", color: { argb: BORDER_COLOR } },
}

function font(overrides: Partial<Font> = {}): Partial<Font> {
  return { name: "Calibri", size: 11, color: { argb: DARK }, ...overrides }
}

function situacaoDe(record: CrlvExportRecord): SituacaoKey {
  return record.validade?.status ?? "sem_documento"
}

function toExcelDate(value: Date | null): Date | null {
  if (!value) return null
  // O Excel grava datas sem fuso: enviamos o dia local em UTC para não deslocar a data.
  return new Date(Date.UTC(value.getFullYear(), value.getMonth(), value.getDate()))
}

function exercicioLabel(validade: CrlvValidade | null): string {
  if (!validade?.exercicio) return "-"
  return `Exercício ${validade.exercicio} • ${validade.uf || "UF ?"}`
}

function detalheLabel(record: CrlvExportRecord): string {
  const validade = record.validade
  if (!validade) return "CRLV não anexado"
  const avisos = [validade.mensagem]
  if (validade.placaDivergente) avisos.push("Placa do PDF diferente do veículo")
  return avisos.join(" • ")
}

const COLUMNS: Array<{
  header: string
  width: number
  align?: "left" | "center" | "right"
  format?: string
  value: (record: CrlvExportRecord, index: number) => unknown
}> = [
  { header: "Nº", width: 6, align: "center", value: (_record, index) => index + 1 },
  { header: "PLACA", width: 13, align: "center", value: (record) => record.placa },
  { header: "MODELO", width: 34, value: (record) => record.modelo || "-" },
  { header: "RENAVAM", width: 16, align: "center", value: (record) => record.renavam || "-" },
  { header: "EXERCÍCIO / UF", width: 20, align: "center", value: (record) => exercicioLabel(record.validade) },
  { header: "VALIDADE", width: 14, align: "center", format: "dd/mm/yyyy", value: (record) => toExcelDate(record.validade?.validoAte ?? null) ?? "-" },
  { header: "DIAS", width: 9, align: "center", value: (record) => record.validade?.diasRestantes ?? "-" },
  { header: "SITUAÇÃO", width: 20, align: "center", value: (record) => SITUACAO[situacaoDe(record)].label },
  { header: "DETALHE", width: 46, value: (record) => detalheLabel(record) },
]

export async function downloadCrlvWorkbook({ title, filtroLabel, records }: ExportOptions) {
  const ExcelJSModule = await import("exceljs")
  const ExcelJS = (ExcelJSModule as unknown as { default?: typeof ExcelJSModule }).default ?? ExcelJSModule

  const sorted = [...records].sort((left, right) => {
    const bySituacao = SITUACAO_ORDEM.indexOf(situacaoDe(left)) - SITUACAO_ORDEM.indexOf(situacaoDe(right))
    if (bySituacao !== 0) return bySituacao
    const leftDate = left.validade?.validoAte?.getTime() ?? Number.MAX_SAFE_INTEGER
    const rightDate = right.validade?.validoAte?.getTime() ?? Number.MAX_SAFE_INTEGER
    if (leftDate !== rightDate) return leftDate - rightDate
    return left.placa.localeCompare(right.placa, "pt-BR")
  })

  const workbook = new ExcelJS.Workbook()
  workbook.creator = "SLN Frota"
  workbook.created = new Date()

  const headerRowNumber = 7
  const worksheet = workbook.addWorksheet("CRLV Próprios", {
    views: [{ state: "frozen", ySplit: headerRowNumber, showGridLines: false }],
    pageSetup: {
      paperSize: 9,
      orientation: "landscape",
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
      margins: { left: 0.4, right: 0.4, top: 0.5, bottom: 0.5, header: 0.3, footer: 0.3 },
      printTitlesRow: `${headerRowNumber}:${headerRowNumber}`,
    },
    headerFooter: { oddFooter: "&L&8SLN Frota • Relatório de CRLV&R&8Página &P de &N" },
  })

  worksheet.columns = COLUMNS.map((column) => ({ width: column.width }))
  const lastColumn = COLUMNS.length
  const lastColumnLetter = worksheet.getColumn(lastColumn).letter

  // Faixa de título
  worksheet.mergeCells(`A1:${lastColumnLetter}1`)
  const titleCell = worksheet.getCell("A1")
  titleCell.value = title
  titleCell.font = font({ size: 16, bold: true, color: { argb: "FFFFFFFF" } })
  titleCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: DARK } }
  titleCell.alignment = { vertical: "middle", horizontal: "left", indent: 1 }
  worksheet.getRow(1).height = 32

  worksheet.mergeCells(`A2:${lastColumnLetter}2`)
  const subtitleCell = worksheet.getCell("A2")
  const subtitleParts = [
    "Veículos próprios da frota",
    filtroLabel,
    `Gerado em ${new Date().toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}`,
  ].filter(Boolean)
  subtitleCell.value = subtitleParts.join("   |   ")
  subtitleCell.font = font({ size: 10, italic: true, color: { argb: "FFFFFFFF" } })
  subtitleCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: BRAND } }
  subtitleCell.alignment = { vertical: "middle", horizontal: "left", indent: 1 }
  worksheet.getRow(2).height = 20

  // Resumo
  const contagem = (key: SituacaoKey) => sorted.filter((record) => situacaoDe(record) === key).length
  const outros = contagem("nao_analisado") + contagem("erro") + contagem("sem_documento")
  const resumo: Array<{ label: string; value: number; fill: string; color: string }> = [
    { label: "TOTAL", value: sorted.length, fill: "FFF8FAFC", color: DARK },
    { label: "VÁLIDOS", value: contagem("valido"), fill: SITUACAO.valido.fill, color: SITUACAO.valido.font },
    { label: "VENCENDO (30 DIAS)", value: contagem("vencendo"), fill: SITUACAO.vencendo.fill, color: SITUACAO.vencendo.font },
    { label: "VENCIDOS", value: contagem("vencido"), fill: SITUACAO.vencido.fill, color: SITUACAO.vencido.font },
    { label: "PENDENTES / SEM LEITURA", value: outros, fill: SITUACAO.sem_documento.fill, color: SITUACAO.sem_documento.font },
  ]

  // Cada bloco do resumo ocupa colunas fixas: A-B, C, D, E-F, G-I
  const resumoRanges = [
    [1, 2],
    [3, 3],
    [4, 4],
    [5, 6],
    [7, 9],
  ]
  worksheet.getRow(4).height = 18
  worksheet.getRow(5).height = 26
  resumo.forEach((item, index) => {
    const [start, end] = resumoRanges[index]
    const startLetter = worksheet.getColumn(start).letter
    const endLetter = worksheet.getColumn(end).letter
    if (start !== end) {
      worksheet.mergeCells(`${startLetter}4:${endLetter}4`)
      worksheet.mergeCells(`${startLetter}5:${endLetter}5`)
    }
    const labelCell = worksheet.getCell(`${startLetter}4`)
    labelCell.value = item.label
    labelCell.font = font({ size: 9, bold: true, color: { argb: item.color } })
    labelCell.alignment = { vertical: "middle", horizontal: "center" }

    const valueCell = worksheet.getCell(`${startLetter}5`)
    valueCell.value = item.value
    valueCell.font = font({ size: 16, bold: true, color: { argb: item.color } })
    valueCell.alignment = { vertical: "middle", horizontal: "center" }

    for (let column = start; column <= end; column += 1) {
      for (const rowNumber of [4, 5]) {
        const cell = worksheet.getRow(rowNumber).getCell(column)
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: item.fill } }
        cell.border = {
          top: rowNumber === 4 ? { style: "thin", color: { argb: BORDER_COLOR } } : undefined,
          bottom: rowNumber === 5 ? { style: "thin", color: { argb: BORDER_COLOR } } : undefined,
          left: column === start ? { style: "thin", color: { argb: BORDER_COLOR } } : undefined,
          right: column === end ? { style: "thin", color: { argb: BORDER_COLOR } } : undefined,
        }
      }
    }
  })

  // Cabeçalho da tabela
  const headerRow = worksheet.getRow(headerRowNumber)
  COLUMNS.forEach((column, index) => {
    const cell = headerRow.getCell(index + 1)
    cell.value = column.header
    cell.font = font({ size: 10, bold: true, color: { argb: "FFFFFFFF" } })
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: BRAND } }
    cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true }
    cell.border = {
      ...THIN_BORDER,
      top: { style: "thin", color: { argb: BRAND } },
      bottom: { style: "medium", color: { argb: "FFB45309" } },
    }
  })
  headerRow.height = 26
  worksheet.autoFilter = {
    from: { row: headerRowNumber, column: 1 },
    to: { row: headerRowNumber, column: lastColumn },
  }

  // Linhas
  sorted.forEach((record, recordIndex) => {
    const row = worksheet.getRow(headerRowNumber + 1 + recordIndex)
    row.height = 20
    const zebra = recordIndex % 2 === 1 ? "FFF8FAFC" : "FFFFFFFF"
    const situacao = SITUACAO[situacaoDe(record)]

    COLUMNS.forEach((column, index) => {
      const cell = row.getCell(index + 1)
      cell.value = column.value(record, recordIndex) as never
      cell.font = font({ size: 10 })
      cell.border = THIN_BORDER
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: zebra } }
      cell.alignment = { vertical: "middle", horizontal: column.align ?? "left", indent: column.align ? 0 : 1 }
      if (column.format) cell.numFmt = column.format
    })

    row.getCell(2).font = font({ size: 10, bold: true })
    // RENAVAM como texto para preservar zeros à esquerda.
    row.getCell(4).numFmt = "@"

    const situacaoCell = row.getCell(8)
    situacaoCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: situacao.fill } }
    situacaoCell.font = font({ size: 10, bold: true, color: { argb: situacao.font } })

    const status = situacaoDe(record)
    if (status === "vencido" || status === "vencendo") {
      row.getCell(6).font = font({ size: 10, bold: true, color: { argb: situacao.font } })
      row.getCell(7).font = font({ size: 10, bold: true, color: { argb: situacao.font } })
      row.getCell(9).font = font({ size: 10, color: { argb: situacao.font } })
    }
  })

  if (sorted.length === 0) {
    const emptyRowNumber = headerRowNumber + 1
    worksheet.mergeCells(`A${emptyRowNumber}:${lastColumnLetter}${emptyRowNumber}`)
    const emptyCell = worksheet.getCell(`A${emptyRowNumber}`)
    emptyCell.value = "Nenhum veículo próprio encontrado."
    emptyCell.font = font({ italic: true, color: { argb: "FF64748B" } })
    emptyCell.alignment = { horizontal: "center", vertical: "middle" }
  }

  // Legenda
  const legendRowNumber = headerRowNumber + Math.max(sorted.length, 1) + 2
  worksheet.mergeCells(`A${legendRowNumber}:${lastColumnLetter}${legendRowNumber}`)
  const legendCell = worksheet.getCell(`A${legendRowNumber}`)
  legendCell.value =
    "Validade calculada pelo exercício do CRLV, final da placa e calendário de licenciamento do Detran da UF (SP, MG ou PR). " +
    "\"Vencendo\" = vence nos próximos 30 dias. DIAS negativos indicam dias em atraso."
  legendCell.font = font({ size: 9, italic: true, color: { argb: "FF64748B" } })
  legendCell.alignment = { wrapText: true, vertical: "top" }
  worksheet.getRow(legendRowNumber).height = 30

  const buffer = await workbook.xlsx.writeBuffer()
  const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement("a")
  anchor.href = url
  anchor.download = `crlv-veiculos-proprios-${new Date().toISOString().slice(0, 10)}.xlsx`
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  URL.revokeObjectURL(url)
}
