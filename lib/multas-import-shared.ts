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

  const batches = (value as { batches?: unknown }).batches
  if (!batches || typeof batches !== "object") return createEmptyMultasImportStore()

  const normalized: MultasImportStore = createEmptyMultasImportStore()
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

/** Todas as multas importadas, de todas as fontes (Localiza, carros próprios...). */
export function getAllImportedMultas(store: MultasImportStore | null | undefined): MultaImportada[] {
  if (!store) return []
  return Object.values(store.batches).flatMap((batch) => batch?.records ?? [])
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
