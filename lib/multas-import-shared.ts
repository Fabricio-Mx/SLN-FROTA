export type MultaFonte = "localiza" | "proprio"

/** Status interno de tratativa, definido pela cor da linha na planilha de controle. */
export type MultaTratativa = "tratada" | "tratando" | "analise" | "sem_classificacao"

export type MultaGravidadeImportada = "leve" | "media" | "grave" | "gravissima"

export type MultaImportada = {
  id: string
  fonte: MultaFonte
  linha: number
  placa: string
  modelo: string
  tipoRegistro: string
  codigoInfracao: string
  descricaoInfracao: string
  pontos: number | null
  gravidade: MultaGravidadeImportada | null
  /** Datas no formato local "YYYY-MM-DDTHH:mm" (sem fuso), exatamente como na planilha. */
  dataInfracao: string | null
  orgao: string
  ait: string
  recebimentoNotificacao: string | null
  envioNotificacaoCliente: string | null
  dataDocsEnviados: string | null
  dataLimiteEnvio: string | null
  situacaoIndicacao: string
  condutor: string
  centroCusto: string
  valorInfracao: number
  valorNic: number
  valorFaturado: number
  /** Positivo = valor descontado do colaborador; negativo = perda (não recuperado). */
  descontoRh: number | null
  observacoes: string
  tratativa: MultaTratativa
  corOriginal: string | null
  /** Local da infração (rodovia/km, endereço), usado no termo de desconto. */
  localInfracao?: string
  /** Dia em que o desconto foi enviado ao RH ("YYYY-MM-DD"). */
  envioRhEm?: string | null
  /** "manual" = cadastrada no sistema; ausente/"planilha" = veio da importação. */
  origem?: "planilha" | "manual"
  /** Preenchido quando a multa foi alterada no sistema (as alterações prevalecem sobre a planilha). */
  editadoEm?: string | null
  editadoPor?: string | null
}

/** Campos que podem ser informados/alterados pelo formulário de multa. */
export type MultaCamposEditaveis = Omit<MultaImportada, "id" | "fonte" | "linha" | "corOriginal" | "origem" | "editadoEm" | "editadoPor">

export type MultaEdicao = {
  campos: Partial<MultaCamposEditaveis>
  editadoEm: string
  editadoPor: string | null
}

export type MultasImportBatch = {
  fonte: MultaFonte
  fileName: string
  sheetName: string
  importedAt: string
  importedBy: string | null
  records: MultaImportada[]
  warnings: string[]
}

export type MultasImportStore = {
  version: 1
  batches: Partial<Record<MultaFonte, MultasImportBatch>>
  /** Multas cadastradas manualmente; nunca são apagadas por uma nova importação. */
  manuais?: MultaImportada[]
  /** Alterações feitas no sistema sobre multas importadas, por id; reaplicadas após cada importação. */
  edicoes?: Record<string, MultaEdicao>
}

export const MULTA_FONTE_LABELS: Record<MultaFonte, string> = {
  localiza: "Localiza",
  proprio: "Carros próprios",
}

/** Fontes com modelo de planilha já mapeado no importador. */
export const MULTA_FONTES_SUPORTADAS: MultaFonte[] = ["localiza"]

export const MULTA_TRATATIVA_LABELS: Record<MultaTratativa, string> = {
  tratada: "Tratada",
  tratando: "Em tratativa",
  analise: "Análise ou perda",
  sem_classificacao: "Sem classificação",
}

export const MULTA_TRATATIVA_DESCRIPTIONS: Record<MultaTratativa, string> = {
  tratada: "Multa já tratada",
  tratando: "Estamos tratando",
  analise: "Em análise ou com perda",
  sem_classificacao: "Linha sem cor na planilha",
}

export const MULTA_TRATATIVA_ORDER: MultaTratativa[] = ["tratada", "tratando", "analise", "sem_classificacao"]

export const MULTA_TRATATIVA_COLORS: Record<MultaTratativa, { solid: string; soft: string; border: string; text: string; excel: string }> = {
  tratada: { solid: "#4f9a45", soft: "#eef8ea", border: "#bfe0b5", text: "#2f6b2a", excel: "FF92D050" },
  tratando: { solid: "#3b7dd8", soft: "#eaf2fd", border: "#bcd4f5", text: "#1f56a3", excel: "FF8DB4E2" },
  analise: { solid: "#e8930c", soft: "#fff4e3", border: "#f6d39b", text: "#9a5b00", excel: "FFFFC000" },
  sem_classificacao: { solid: "#94a3b8", soft: "#f1f5f9", border: "#d6dde6", text: "#475569", excel: "FFE2E8F0" },
}

export const MULTA_GRAVIDADE_IMPORT_LABELS: Record<MultaGravidadeImportada, string> = {
  leve: "Leve",
  media: "Média",
  grave: "Grave",
  gravissima: "Gravíssima",
}

export const MULTA_GRAVIDADE_IMPORT_ORDER: MultaGravidadeImportada[] = ["leve", "media", "grave", "gravissima"]

export const MULTA_GRAVIDADE_IMPORT_COLORS: Record<MultaGravidadeImportada, string> = {
  leve: "#7cb26a",
  media: "#e0b13a",
  grave: "#e07b39",
  gravissima: "#d0463b",
}

export function createEmptyMultasImportStore(): MultasImportStore {
  return { version: 1, batches: {} }
}

export function normalizeMultasImportStore(value: unknown): MultasImportStore {
  if (!value || typeof value !== "object") return createEmptyMultasImportStore()

  const normalized: MultasImportStore = createEmptyMultasImportStore()

  const manuais = (value as { manuais?: unknown }).manuais
  if (Array.isArray(manuais)) {
    normalized.manuais = manuais.filter(
      (item): item is MultaImportada => !!item && typeof item === "object" && typeof (item as MultaImportada).id === "string",
    )
  }

  const edicoes = (value as { edicoes?: unknown }).edicoes
  if (edicoes && typeof edicoes === "object" && !Array.isArray(edicoes)) {
    normalized.edicoes = edicoes as Record<string, MultaEdicao>
  }

  const batches = (value as { batches?: unknown }).batches
  if (!batches || typeof batches !== "object") return normalized

  for (const fonte of Object.keys(MULTA_FONTE_LABELS) as MultaFonte[]) {
    const batch = (batches as Record<string, unknown>)[fonte]
    if (batch && typeof batch === "object" && Array.isArray((batch as MultasImportBatch).records)) {
      normalized.batches[fonte] = batch as MultasImportBatch
    }
  }

  return normalized
}

export function normalizeGravidade(value: string): MultaGravidadeImportada | null {
  const normalized = value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()

  if (!normalized) return null
  if (normalized.startsWith("gravis")) return "gravissima"
  if (normalized.startsWith("grav")) return "grave"
  if (normalized.startsWith("med")) return "media"
  if (normalized.startsWith("lev")) return "leve"
  return null
}

/** Converte "YYYY-MM-DDTHH:mm" (hora local, sem fuso) em Date local. */
export function parseMultaLocalDate(value: string | null | undefined): Date | null {
  if (!value) return null
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}))?/)
  if (!match) return null

  const [, year, month, day, hours = "0", minutes = "0"] = match
  const date = new Date(Number(year), Number(month) - 1, Number(day), Number(hours), Number(minutes))
  return Number.isNaN(date.getTime()) ? null : date
}

/** Janela usada nos indicadores gerais de multas (painel inicial). */
export const MULTAS_PAINEL_JANELA_DIAS = 120

/** Opções de situação da indicação usadas no cadastro/edição. */
export const MULTA_SITUACAO_OPCOES = ["Pendente Indicação", "Condutor indicado"] as const

const ENVIO_RH_REGEX = /ENVIAD[OA]\s+(?:PARA|AO)\s+(?:O\s+)?RH\s+(?:NO\s+DIA|EM)\s+(\d{1,2})\/(\d{1,2})\/(\d{2,4})/i

/** Na planilha a data de envio ao RH vem como texto nas observações ("DESCONTO ENVIADO PARA O RH NO DIA 06/04/2026"). */
export function extractEnvioRhFromObservacoes(observacoes: string | null | undefined): string | null {
  const match = (observacoes ?? "").match(ENVIO_RH_REGEX)
  if (!match) return null
  const [, day, month, yearRaw] = match
  const year = yearRaw.length === 2 ? `20${yearRaw}` : yearRaw
  return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`
}

/** Completa campos derivados de registros importados (ex.: envio ao RH lido das observações). */
export function withDerivedMultaFields(record: MultaImportada): MultaImportada {
  if (record.envioRhEm !== undefined) return record
  return { ...record, envioRhEm: extractEnvioRhFromObservacoes(record.observacoes) }
}

/** Multas de uma fonte já com as edições do sistema aplicadas, incluindo as cadastradas manualmente. */
export function getMultasDaFonte(store: MultasImportStore | null | undefined, fonte: MultaFonte): MultaImportada[] {
  if (!store) return []
  const edicoes = store.edicoes ?? {}
  const importadas = (store.batches[fonte]?.records ?? []).map((raw) => {
    const record = withDerivedMultaFields(raw)
    const edicao = edicoes[record.id]
    return edicao ? { ...record, ...edicao.campos, editadoEm: edicao.editadoEm, editadoPor: edicao.editadoPor } : record
  })
  const manuais = (store.manuais ?? []).filter((record) => record.fonte === fonte)
  return [...importadas, ...manuais]
}

/** Todas as multas (importadas com edições + manuais), de todas as fontes (Localiza, carros próprios...). */
export function getAllImportedMultas(store: MultasImportStore | null | undefined): MultaImportada[] {
  if (!store) return []
  return (Object.keys(MULTA_FONTE_LABELS) as MultaFonte[]).flatMap((fonte) => getMultasDaFonte(store, fonte))
}

export const MULTA_PONTOS_POR_GRAVIDADE: Record<MultaGravidadeImportada, number> = {
  leve: 3,
  media: 4,
  grave: 5,
  gravissima: 7,
}

const MULTA_TRATATIVAS = new Set<string>(MULTA_TRATATIVA_ORDER)
const MULTA_GRAVIDADES = new Set<string>(MULTA_GRAVIDADE_IMPORT_ORDER)

function sanitizeText(value: unknown, maxLength = 500): string {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : ""
}

function sanitizeNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null
  const parsed = typeof value === "number" ? value : Number(String(value).replace(",", "."))
  return Number.isFinite(parsed) ? Math.round(parsed * 100) / 100 : null
}

function sanitizeLocalDate(value: unknown): string | null {
  if (typeof value !== "string") return null
  const match = value.trim().match(/^(\d{4}-\d{2}-\d{2})(?:T(\d{2}:\d{2}))?/)
  if (!match) return null
  return match[2] ? `${match[1]}T${match[2]}` : match[1]
}

/** Valida e normaliza os campos vindos do formulário de multa. */
export function sanitizeMultaCampos(input: unknown): MultaCamposEditaveis {
  const data = (input && typeof input === "object" ? input : {}) as Record<string, unknown>
  const gravidade = typeof data.gravidade === "string" && MULTA_GRAVIDADES.has(data.gravidade) ? (data.gravidade as MultaGravidadeImportada) : null
  const tratativa =
    typeof data.tratativa === "string" && MULTA_TRATATIVAS.has(data.tratativa) ? (data.tratativa as MultaTratativa) : "sem_classificacao"
  const valorInfracao = sanitizeNumber(data.valorInfracao) ?? 0
  const valorNic = sanitizeNumber(data.valorNic) ?? 0
  const pontos = sanitizeNumber(data.pontos)

  return {
    placa: sanitizeText(data.placa, 10).toUpperCase().replace(/[^A-Z0-9]/g, ""),
    modelo: sanitizeText(data.modelo, 120),
    tipoRegistro: sanitizeText(data.tipoRegistro, 30).toUpperCase(),
    codigoInfracao: sanitizeText(data.codigoInfracao, 30),
    descricaoInfracao: sanitizeText(data.descricaoInfracao, 200),
    pontos: pontos === null ? null : Math.max(0, Math.round(pontos)),
    gravidade,
    dataInfracao: sanitizeLocalDate(data.dataInfracao),
    orgao: sanitizeText(data.orgao, 120),
    ait: sanitizeText(data.ait, 40).toUpperCase(),
    recebimentoNotificacao: sanitizeLocalDate(data.recebimentoNotificacao),
    envioNotificacaoCliente: sanitizeLocalDate(data.envioNotificacaoCliente),
    dataDocsEnviados: sanitizeLocalDate(data.dataDocsEnviados),
    dataLimiteEnvio: sanitizeLocalDate(data.dataLimiteEnvio),
    situacaoIndicacao: sanitizeText(data.situacaoIndicacao, 120),
    condutor: sanitizeText(data.condutor, 120),
    centroCusto: sanitizeText(data.centroCusto, 120),
    valorInfracao,
    valorNic,
    valorFaturado: sanitizeNumber(data.valorFaturado) ?? valorInfracao + valorNic,
    descontoRh: sanitizeNumber(data.descontoRh),
    envioRhEm: sanitizeLocalDate(data.envioRhEm)?.slice(0, 10) ?? null,
    localInfracao: sanitizeText(data.localInfracao, 200),
    observacoes: sanitizeText(data.observacoes, 2000),
    tratativa,
  }
}

export function getRecentWindowStart(days: number, now = new Date()): Date {
  return new Date(now.getFullYear(), now.getMonth(), now.getDate() - days)
}

/** Multas com data da infração dentro dos últimos `days` dias. */
export function filterRecentMultas(records: MultaImportada[], days: number, now = new Date()): MultaImportada[] {
  const start = getRecentWindowStart(days, now)
  return records.filter((record) => {
    const date = parseMultaLocalDate(record.dataInfracao)
    return !!date && date >= start && date <= now
  })
}

export function normalizeMultaSearchText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
}
