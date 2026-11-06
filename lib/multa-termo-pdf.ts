import { readFile } from "node:fs/promises"
import path from "node:path"
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib"
import { MULTA_GRAVIDADE_IMPORT_LABELS, MULTA_PONTOS_POR_GRAVIDADE, parseMultaLocalDate, type MultaImportada } from "@/lib/multas-import-shared"

const LOGO_PATH = path.join(process.cwd(), "termo", "logo-sln.jpeg")

export type TermoDescontoDados = {
  multa: MultaImportada
  condutorNome: string
  condutorCpf: string | null
  veiculoModelo: string
  renavam: string | null
  /** Cidade/UF impressa antes da data. */
  local?: string
  emitidoEm?: Date
}

const PAGE_WIDTH = 595.28
const PAGE_HEIGHT = 841.89
const MARGIN_X = 62
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN_X * 2
const FONT_SIZE = 11
const LINE_HEIGHT = 16
const BLANK = "________________"

const MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"]

type Segment = { text: string; bold?: boolean }

function formatCpf(value: string | null): string {
  const digits = (value ?? "").replace(/\D/g, "")
  if (digits.length !== 11) return value?.trim() || BLANK
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`
}

function formatDateTime(value: string | null, withTime: boolean): string {
  const date = parseMultaLocalDate(value)
  if (!date) return BLANK
  const pad = (n: number) => `${n}`.padStart(2, "0")
  const day = `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()}`
  return withTime ? `${day} ${pad(date.getHours())}:${pad(date.getMinutes())}` : day
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value).replace(/\u00a0/g, " ")
}

/** Remove caracteres que as fontes padrão do PDF (WinAnsi) não conseguem desenhar. */
function makeSafe(font: PDFFont) {
  return (text: string) =>
    Array.from(text.replace(/\s+/g, " "))
      .map((char) => {
        try {
          font.encodeText(char)
          return char
        } catch {
          return "?"
        }
      })
      .join("")
}

type Word = { text: string; font: PDFFont; width: number; glue: boolean }

/** Desenha um parágrafo com trechos em negrito, com quebra de linha e (opcionalmente) justificado. */
function drawRichParagraph(
  page: PDFPage,
  segments: Segment[],
  fonts: { regular: PDFFont; bold: PDFFont },
  options: { x: number; y: number; width: number; justify?: boolean; indent?: number },
): number {
  const words: Word[] = []
  let previousEndsWithSpace = true
  for (const segment of segments) {
    const font = segment.bold ? fonts.bold : fonts.regular
    const safe = makeSafe(font)(segment.text)
    // Trecho que começa sem espaço (ex.: ", portador") fica colado na palavra anterior.
    let glue = words.length > 0 && !previousEndsWithSpace && !/^\s/.test(safe)
    previousEndsWithSpace = /\s$/.test(safe)
    for (const part of safe.split(" ")) {
      if (!part) {
        glue = false
        continue
      }
      words.push({ text: part, font, width: font.widthOfTextAtSize(part, FONT_SIZE), glue })
      glue = false
    }
  }

  const spaceWidth = fonts.regular.widthOfTextAtSize(" ", FONT_SIZE)
  const lines: Word[][] = []
  let current: Word[] = []
  let currentWidth = options.indent ?? 0
  for (const word of words) {
    const extra = current.length > 0 && !word.glue ? spaceWidth + word.width : word.width
    if (current.length > 0 && !word.glue && currentWidth + extra > options.width) {
      lines.push(current)
      current = [word]
      currentWidth = word.width
    } else {
      current.push(word)
      currentWidth += extra
    }
  }
  if (current.length > 0) lines.push(current)

  let y = options.y
  lines.forEach((line, index) => {
    const indent = index === 0 ? options.indent ?? 0 : 0
    const wordsWidth = line.reduce((sum, word) => sum + word.width, 0)
    const gaps = line.filter((word, wordIndex) => wordIndex > 0 && !word.glue).length
    const isLast = index === lines.length - 1
    const gap = options.justify && !isLast && gaps > 0 ? (options.width - indent - wordsWidth) / gaps : spaceWidth
    let x = options.x + indent
    line.forEach((word, wordIndex) => {
      if (wordIndex > 0 && !word.glue) x += gap
      page.drawText(word.text, { x, y, size: FONT_SIZE, font: word.font, color: rgb(0, 0, 0) })
      x += word.width
    })
    y -= LINE_HEIGHT
  })

  return y
}

function drawCentered(page: PDFPage, text: string, font: PDFFont, y: number, centerX: number, size = FONT_SIZE) {
  const safe = makeSafe(font)(text)
  const width = font.widthOfTextAtSize(safe, size)
  page.drawText(safe, { x: centerX - width / 2, y, size, font, color: rgb(0, 0, 0) })
}

/** Gera o "Termo de Autorização para Desconto em Folha de Pagamento" no mesmo layout do modelo em Word. */
export async function gerarTermoDescontoPdf(dados: TermoDescontoDados): Promise<Uint8Array> {
  const { multa } = dados
  const pdf = await PDFDocument.create()
  pdf.setTitle(`Termo de desconto - ${dados.condutorNome} - ${multa.ait || multa.placa}`)
  pdf.setAuthor("SLN Construções e Engenharia")

  const page = pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT])
  const fonts = {
    regular: await pdf.embedFont(StandardFonts.Helvetica),
    bold: await pdf.embedFont(StandardFonts.HelveticaBold),
  }

  try {
    const logo = await pdf.embedJpg(await readFile(LOGO_PATH))
    const logoWidth = 64
    const logoHeight = (logo.height / logo.width) * logoWidth
    page.drawImage(logo, { x: PAGE_WIDTH - MARGIN_X - logoWidth + 10, y: PAGE_HEIGHT - 40 - logoHeight, width: logoWidth, height: logoHeight })
  } catch {
    // Sem logo o termo continua válido.
  }

  let y = PAGE_HEIGHT - 110
  drawCentered(page, "TERMO DE AUTORIZAÇÃO PARA DESCONTO EM FOLHA DE PAGAMENTO", fonts.bold, y, PAGE_WIDTH / 2, 12)
  y -= 36

  const nome = dados.condutorNome.trim().toUpperCase() || BLANK
  const cpf = formatCpf(dados.condutorCpf)

  y = drawRichParagraph(
    page,
    [
      { text: "Eu, " },
      { text: nome, bold: true },
      { text: ", portador do CPF nº " },
      { text: cpf, bold: true },
      { text: ", condutor do veículo modelo " },
      { text: (dados.veiculoModelo || multa.modelo || BLANK).toUpperCase(), bold: true },
      { text: ", placa " },
      { text: multa.placa || BLANK, bold: true },
      { text: ", RENAVAM " },
      { text: dados.renavam?.trim() || BLANK, bold: true },
      {
        text: ", declaro, para os devidos fins, que autorizo de forma expressa e irrevogável o desconto do valor da multa de trânsito especificada abaixo diretamente em minha folha de pagamento:",
      },
    ],
    fonts,
    { x: MARGIN_X, y, width: CONTENT_WIDTH, justify: true, indent: 24 },
  )
  y -= 10

  page.drawText("Dados da infração:", { x: MARGIN_X, y, size: FONT_SIZE, font: fonts.bold })
  y -= LINE_HEIGHT + 4

  const pontos = multa.pontos ?? (multa.gravidade ? MULTA_PONTOS_POR_GRAVIDADE[multa.gravidade] : null)
  const pontuacao = multa.gravidade
    ? `${MULTA_GRAVIDADE_IMPORT_LABELS[multa.gravidade].toUpperCase()}${pontos !== null ? ` - ${pontos}pts` : ""}`
    : pontos !== null
      ? `${pontos}pts`
      : BLANK
  const codigo = [multa.codigoInfracao, multa.descricaoInfracao.toUpperCase()].filter(Boolean).join(" - ") || BLANK

  const itens: Array<[string, string]> = [
    ["Número do AIT (Auto de Infração):", multa.ait || BLANK],
    ["Código da Infração:", codigo],
    ["Pontuação:", pontuacao],
    ["Data e Hora da Infração:", formatDateTime(multa.dataInfracao, true)],
    ["Local da Infração:", multa.localInfracao?.trim() || BLANK],
    ["Valor da Infração:", formatCurrency(multa.valorInfracao)],
    ["Data limite para identificação do condutor infrator:", formatDateTime(multa.dataLimiteEnvio, false)],
  ]

  const bulletX = MARGIN_X + 30
  const textX = MARGIN_X + 44
  for (const [label, value] of itens) {
    page.drawText("•", { x: bulletX, y, size: FONT_SIZE, font: fonts.regular })
    y = drawRichParagraph(page, [{ text: label, bold: true }, { text: ` ${value}` }], fonts, {
      x: textX,
      y,
      width: PAGE_WIDTH - MARGIN_X - textX,
    })
    y -= 2
  }
  y -= 12

  y = drawRichParagraph(
    page,
    [
      {
        text: "Declaro estar ciente da infração cometida, conforme os dados fornecidos, e autorizo que o valor acima mencionado seja descontado no próximo processamento de folha de pagamento, conforme previsto em Parágrafo Único do",
      },
      { text: " TERMO DE RESPONSABILIDADE POR UTILIZAÇÃO DE VEICULO DA EMPRESA.", bold: true },
    ],
    fonts,
    { x: MARGIN_X, y, width: CONTENT_WIDTH, justify: true, indent: 24 },
  )
  y -= 40

  drawCentered(page, "Por ser verdade, firmo o presente termo.", fonts.regular, y, PAGE_WIDTH / 2 + 40)
  y -= 30

  const emitidoEm = dados.emitidoEm ?? new Date()
  const dataTexto = `${dados.local ?? "Cotia/SP"}, ${`${emitidoEm.getDate()}`.padStart(2, "0")} de ${MESES[emitidoEm.getMonth()]} de ${emitidoEm.getFullYear()}.`
  const dataSafe = makeSafe(fonts.regular)(dataTexto)
  page.drawText(dataSafe, {
    x: PAGE_WIDTH - MARGIN_X - fonts.regular.widthOfTextAtSize(dataSafe, FONT_SIZE) - 30,
    y,
    size: FONT_SIZE,
    font: fonts.regular,
  })
  y -= 80

  const signatureWidth = 240
  page.drawLine({
    start: { x: PAGE_WIDTH / 2 - signatureWidth / 2, y },
    end: { x: PAGE_WIDTH / 2 + signatureWidth / 2, y },
    thickness: 0.8,
  })
  y -= 16
  drawCentered(page, nome, fonts.bold, y, PAGE_WIDTH / 2)
  y -= 16
  drawCentered(page, `CPF nº ${cpf}`, fonts.regular, y, PAGE_WIDTH / 2)
  y -= 90

  const witnessWidth = 200
  for (const centerX of [MARGIN_X + witnessWidth / 2, PAGE_WIDTH - MARGIN_X - witnessWidth / 2]) {
    page.drawLine({ start: { x: centerX - witnessWidth / 2, y }, end: { x: centerX + witnessWidth / 2, y }, thickness: 0.8 })
    drawCentered(page, "TESTEMUNHA", fonts.bold, y - 16, centerX)
  }

  return pdf.save()
}
