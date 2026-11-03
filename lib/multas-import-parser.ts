import type { CellValue, Workbook, Worksheet } from "exceljs"
import {
  normalizeGravidade,
  type MultaFonte,
  type MultaImportada,
  type MultaTratativa,
} from "@/lib/multas-import-shared"

type FieldKey =
  | "placa"
  | "modelo"
  | "tipoRegistro"
  | "codigoInfracao"
  | "descricaoInfracao"
  | "pontos"
  | "gravidade"
  | "dataInfracao"
  | "orgao"
  | "ait"
  | "recebimentoNotificacao"
  | "envioNotificacaoCliente"
  | "dataDocsEnviados"
  | "dataLimiteEnvio"
  | "situacaoIndicacao"
  | "condutor"
  | "centroCusto"
  | "valorInfracao"
  | "valorNic"
  | "valorFaturado"
  | "descontoRh"
  | "observacoes"

// A ordem importa: cabeçalhos mais específicos precisam ser testados antes dos genéricos.
const FIELD_MATCHERS: Array<[FieldKey, (header: string) => boolean]> = [
  ["placa", (h) => h === "PLACA"],
  ["modelo", (h) => h === "MODELO"],
  ["codigoInfracao", (h) => h.startsWith("CODIGO") && h.includes("INFRA")],
  ["descricaoInfracao", (h) => h.startsWith("DESCRICAO") && h.includes("INFRA")],
  ["dataInfracao", (h) => h.startsWith("DATA DA INFRA") || h === "DATA INFRACAO"],
  ["valorInfracao", (h) => h.startsWith("VALOR DA INFRA") || h === "VALOR INFRACAO"],
  ["valorNic", (h) => h.includes("NIC") && h.startsWith("VALOR")],
  ["valorFaturado", (h) => h.startsWith("VALOR FATURADO")],
  ["descontoRh", (h) => h.startsWith("DESCONTO")],
  ["situacaoIndicacao", (h) => h.startsWith("SITUACAO")],
  ["tipoRegistro", (h) => h === "STATUS"],
  ["pontos", (h) => h.startsWith("PONTO")],
  ["gravidade", (h) => h.startsWith("GRAVIDADE")],
  ["orgao", (h) => h.startsWith("ORGAO")],
  ["ait", (h) => h === "AIT" || h.startsWith("AUTO DE INFRA")],
  ["recebimentoNotificacao", (h) => h.startsWith("RECEBIMENTO")],
  ["envioNotificacaoCliente", (h) => h.startsWith("ENVIO DE NOTIFICA") || h.startsWith("ENVIO NOTIFICA")],
  ["dataDocsEnviados", (h) => h.startsWith("DATA DOCS ENVIADOS") || h.startsWith("DATA DOCUMENTOS ENVIADOS")],
  ["dataLimiteEnvio", (h) => h.startsWith("DATA LIMITE")],
  ["condutor", (h) => h.startsWith("CONDUTOR")],
  ["centroCusto", (h) => h.startsWith("CENTRO DE CUSTO") || h === "CENTRO CUSTO"],
  ["observacoes", (h) => h.startsWith("OBSERVA")],
]

const REQUIRED_FIELDS: FieldKey[] = ["placa", "dataInfracao"]

const DEFAULT_THEME_PALETTE = [
  "FFFFFF", // lt1
  "000000", // dk1
  "E7E6E6", // lt2
  "44546A", // dk2
  "4472C4", // accent1
  "ED7D31", // accent2
  "A5A5A5", // accent3
  "FFC000", // accent4
  "5B9BD5", // accent5
  "70AD47", // accent6
  "0563C1", // hlink
  "954F72", // folHlink
]

export type ParsedMultasSheet = {
  sheetName: string
  records: MultaImportada[]
  warnings: string[]
}

function normalizeHeader(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/\s+/g, " ")
    .trim()
}

function unwrapCellValue(value: CellValue): string | number | boolean | Date | null {
  if (value === null || value === undefined) return null
  if (value instanceof Date) return value
  if (typeof value !== "object") return value

  if ("richText" in value && Array.isArray(value.richText)) {
    return value.richText.map((part) => part.text).join("")
  }
  if ("result" in value) {
    const result = (value as { result?: unknown }).result
    if (result === undefined || result === null) return null
    if (result instanceof Date || typeof result === "number" || typeof result === "string" || typeof result === "boolean") {
      return result
    }
    return null
  }
  if ("text" in value && typeof (value as { text?: unknown }).text === "string") {
    return (value as { text: string }).text
  }
  if ("error" in value) return null

  return null
}

function toText(value: CellValue): string {
  const raw = unwrapCellValue(value)
  if (raw === null) return ""
  if (raw instanceof Date) return formatLocalDate(utcWallClock(raw))
  const text = String(raw).replace(/\s+/g, " ").trim()
  return text === "-" ? "" : text
}

function toNumber(value: CellValue): number | null {
  const raw = unwrapCellValue(value)
  if (raw === null || raw instanceof Date || typeof raw === "boolean") return null
  if (typeof raw === "number") return Number.isFinite(raw) ? raw : null

  const cleaned = raw.replace(/R\$/gi, "").replace(/\s/g, "")
  if (!cleaned || cleaned === "-") return null

  const normalized = cleaned.includes(",") ? cleaned.replace(/\./g, "").replace(",", ".") : cleaned
  const parsed = Number(normalized)
  return Number.isFinite(parsed) ? parsed : null
}

/** O Excel guarda data/hora sem fuso; o ExcelJS expõe esse "relógio de parede" em UTC. */
function utcWallClock(date: Date) {
  return {
    year: date.getUTCFullYear(),
    month: date.getUTCMonth() + 1,
    day: date.getUTCDate(),
    hours: date.getUTCHours(),
    minutes: date.getUTCMinutes(),
  }
}

function formatLocalDate(parts: { year: number; month: number; day: number; hours: number; minutes: number }): string {
  const pad = (value: number) => `${value}`.padStart(2, "0")
  return `${parts.year}-${pad(parts.month)}-${pad(parts.day)}T${pad(parts.hours)}:${pad(parts.minutes)}`
}

function isValidDateParts(year: number, month: number, day: number) {
  return year >= 1990 && year <= 2100 && month >= 1 && month <= 12 && day >= 1 && day <= 31
}

function toLocalDateString(value: CellValue): string | null {
  const raw = unwrapCellValue(value)
  if (raw === null || typeof raw === "boolean") return null

  if (raw instanceof Date) {
    if (Number.isNaN(raw.getTime())) return null
    return formatLocalDate(utcWallClock(raw))
  }

  if (typeof raw === "number") {
    // Número serial do Excel (dias desde 30/12/1899).
    if (raw < 20000 || raw > 80000) return null
    const millis = Math.round((raw - 25569) * 86400 * 1000)
    return formatLocalDate(utcWallClock(new Date(millis)))
  }

  const text = raw.trim()
  const brMatch = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})(?:\s+(\d{1,2}):(\d{2})(?::\d{2})?)?/)
  if (brMatch) {
    const [, day, month, yearRaw, hours = "0", minutes = "0"] = brMatch
    const year = yearRaw.length === 2 ? 2000 + Number(yearRaw) : Number(yearRaw)
    if (!isValidDateParts(year, Number(month), Number(day))) return null
    return formatLocalDate({ year, month: Number(month), day: Number(day), hours: Number(hours), minutes: Number(minutes) })
  }

  const isoMatch = text.match(/^(\d{4})-(\d{2})-(\d{2})(?:[T\s](\d{2}):(\d{2}))?/)
  if (isoMatch) {
    const [, year, month, day, hours = "0", minutes = "0"] = isoMatch
    if (!isValidDateParts(Number(year), Number(month), Number(day))) return null
    return formatLocalDate({ year: Number(year), month: Number(month), day: Number(day), hours: Number(hours), minutes: Number(minutes) })
  }

  return null
}

function readThemePalette(workbook: Workbook): string[] {
  const themes = (workbook as unknown as { _themes?: Record<string, string> })._themes
  const xml = themes ? Object.values(themes)[0] : undefined
  if (typeof xml !== "string") return DEFAULT_THEME_PALETTE

  const readColor = (tag: string) => {
    const block = xml.match(new RegExp(`<a:${tag}>([\\s\\S]*?)</a:${tag}>`))?.[1]
    if (!block) return null
    return block.match(/srgbClr val="([0-9A-Fa-f]{6})"/)?.[1] ?? block.match(/lastClr="([0-9A-Fa-f]{6})"/)?.[1] ?? null
  }

  // Ordem dos índices de tema do Excel: lt1, dk1, lt2, dk2, accent1..6, hlink, folHlink.
  const tags = ["lt1", "dk1", "lt2", "dk2", "accent1", "accent2", "accent3", "accent4", "accent5", "accent6", "hlink", "folHlink"]
  return tags.map((tag, index) => (readColor(tag) ?? DEFAULT_THEME_PALETTE[index]).toUpperCase())
}

function resolveFillHex(fill: unknown, palette: string[]): string | null {
  if (!fill || typeof fill !== "object") return null
  const pattern = fill as { type?: string; pattern?: string; fgColor?: { argb?: string; theme?: number } }
  if (pattern.type !== "pattern" || !pattern.pattern || pattern.pattern === "none") return null

  const color = pattern.fgColor
  if (!color) return null
  if (typeof color.argb === "string" && color.argb.length >= 6) return color.argb.slice(-6).toUpperCase()
  if (typeof color.theme === "number") return palette[color.theme] ?? null
  return null
}

function classifyHexColor(hex: string | null): MultaTratativa {
  if (!hex) return "sem_classificacao"

  const r = parseInt(hex.slice(0, 2), 16) / 255
  const g = parseInt(hex.slice(2, 4), 16) / 255
  const b = parseInt(hex.slice(4, 6), 16) / 255
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const lightness = (max + min) / 2
  const delta = max - min

  if (delta === 0 || lightness > 0.97) return "sem_classificacao"

  const saturation = delta / (1 - Math.abs(2 * lightness - 1))
  if (saturation < 0.15) return "sem_classificacao"

  let hue: number
  if (max === r) hue = ((g - b) / delta) % 6
  else if (max === g) hue = (b - r) / delta + 2
  else hue = (r - g) / delta + 4
  hue = (hue * 60 + 360) % 360

  if (hue >= 70 && hue < 170) return "tratada"
  if (hue >= 170 && hue < 260) return "tratando"
  if (hue < 70 || hue >= 330) return "analise"
  return "sem_classificacao"
}

function resolveRowColor(worksheet: Worksheet, rowNumber: number, columnCount: number, palette: string[]): string | null {
  const counts = new Map<string, number>()
  const row = worksheet.getRow(rowNumber)

  for (let column = 1; column <= columnCount; column += 1) {
    const hex = resolveFillHex(row.getCell(column).fill, palette)
    if (hex) counts.set(hex, (counts.get(hex) ?? 0) + 1)
  }

  let winner: string | null = null
  let winnerCount = 0
  for (const [hex, count] of counts) {
    if (count > winnerCount) {
      winner = hex
      winnerCount = count
    }
  }

  return winner
}

function findHeader(worksheet: Worksheet): { rowNumber: number; columns: Partial<Record<FieldKey, number>> } | null {
  const maxRow = Math.min(worksheet.rowCount, 15)

  for (let rowNumber = 1; rowNumber <= maxRow; rowNumber += 1) {
    const row = worksheet.getRow(rowNumber)
    const columns: Partial<Record<FieldKey, number>> = {}

    row.eachCell({ includeEmpty: false }, (cell, columnNumber) => {
      const header = normalizeHeader(toText(cell.value))
      if (!header) return

      const match = FIELD_MATCHERS.find(([field, test]) => columns[field] === undefined && test(header))
      if (match) columns[match[0]] = columnNumber
    })

    if (REQUIRED_FIELDS.every((field) => columns[field] !== undefined)) {
      return { rowNumber, columns }
    }
  }

  return null
}

export async function parseMultasWorkbook(buffer: Buffer, fonte: MultaFonte): Promise<ParsedMultasSheet> {
  const ExcelJSModule = await import("exceljs")
  const ExcelJS = (ExcelJSModule as unknown as { default?: typeof ExcelJSModule }).default ?? ExcelJSModule
  const workbook = new ExcelJS.Workbook()
  await workbook.xlsx.load(buffer as unknown as ArrayBuffer)

  const palette = readThemePalette(workbook)
  const candidates = workbook.worksheets.filter((sheet) => sheet.state !== "hidden" && sheet.state !== "veryHidden")

  let worksheet: Worksheet | null = null
  let header: ReturnType<typeof findHeader> = null
  for (const sheet of candidates) {
    const found = findHeader(sheet)
    if (found) {
      worksheet = sheet
      header = found
      break
    }
  }

  if (!worksheet || !header) {
    throw new Error("Não encontrei o cabeçalho da planilha de multas (colunas PLACA e DATA DA INFRAÇÃO).")
  }

  const { columns } = header
  const columnCount = Math.max(...Object.values(columns).map((value) => value ?? 0))
  const warnings: string[] = []
  const records: MultaImportada[] = []
  const usedIds = new Set<string>()

  const cell = (rowNumber: number, field: FieldKey): CellValue => {
    const column = columns[field]
    return column ? worksheet.getRow(rowNumber).getCell(column).value : null
  }

  for (let rowNumber = header.rowNumber + 1; rowNumber <= worksheet.rowCount; rowNumber += 1) {
    const placa = toText(cell(rowNumber, "placa")).toUpperCase().replace(/\s+/g, "")
    const ait = toText(cell(rowNumber, "ait")).toUpperCase()
    if (!placa && !ait) continue

    const dataInfracao = toLocalDateString(cell(rowNumber, "dataInfracao"))
    if (!dataInfracao) {
      warnings.push(`Linha ${rowNumber}: data da infração não reconhecida.`)
    }

    // Algumas linhas trazem um valor numérico na coluna de centro de custo; nesse caso o centro não foi informado.
    const centroCustoRaw = unwrapCellValue(cell(rowNumber, "centroCusto"))
    const centroCusto = typeof centroCustoRaw === "number" ? "" : toText(cell(rowNumber, "centroCusto"))

    const valorInfracao = toNumber(cell(rowNumber, "valorInfracao")) ?? 0
    const valorNic = toNumber(cell(rowNumber, "valorNic")) ?? 0
    const valorFaturado = toNumber(cell(rowNumber, "valorFaturado")) ?? valorInfracao + valorNic
    const corOriginal = resolveRowColor(worksheet, rowNumber, columnCount, palette)

    let id = `${fonte}-${ait || `${placa}-${dataInfracao ?? rowNumber}`}`
    if (usedIds.has(id)) id = `${id}-${rowNumber}`
    usedIds.add(id)

    records.push({
      id,
      fonte,
      linha: rowNumber,
      placa,
      modelo: toText(cell(rowNumber, "modelo")),
      tipoRegistro: toText(cell(rowNumber, "tipoRegistro")).toUpperCase(),
      codigoInfracao: toText(cell(rowNumber, "codigoInfracao")),
      descricaoInfracao: toText(cell(rowNumber, "descricaoInfracao")),
      pontos: toNumber(cell(rowNumber, "pontos")),
      gravidade: normalizeGravidade(toText(cell(rowNumber, "gravidade"))),
      dataInfracao,
      orgao: toText(cell(rowNumber, "orgao")),
      ait,
      recebimentoNotificacao: toLocalDateString(cell(rowNumber, "recebimentoNotificacao")),
      envioNotificacaoCliente: toLocalDateString(cell(rowNumber, "envioNotificacaoCliente")),
      dataDocsEnviados: toLocalDateString(cell(rowNumber, "dataDocsEnviados")),
      dataLimiteEnvio: toLocalDateString(cell(rowNumber, "dataLimiteEnvio")),
      situacaoIndicacao: toText(cell(rowNumber, "situacaoIndicacao")),
      condutor: toText(cell(rowNumber, "condutor")),
      centroCusto,
      valorInfracao,
      valorNic,
      valorFaturado,
      descontoRh: toNumber(cell(rowNumber, "descontoRh")),
      observacoes: toText(cell(rowNumber, "observacoes")),
      tratativa: classifyHexColor(corOriginal),
      corOriginal,
    })
  }

  const unclassified = records.filter((record) => record.tratativa === "sem_classificacao").length
  if (unclassified > 0) {
    warnings.push(`${unclassified} linha(s) sem cor reconhecida ficaram como "Sem classificação".`)
  }

  return { sheetName: worksheet.name, records, warnings }
}
