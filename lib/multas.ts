import type {
  Multa,
  MultaColaboradorStatus,
  MultaGravidade,
  MultaIndicacaoStatus,
  MultaRhStatus,
  MultaStatus,
} from "@/lib/types"

export const MULTA_STATUS_LABELS: Record<MultaStatus, string> = {
  pendente: "Pendente",
  enviado: "Enviado",
}

export const MULTA_RH_STATUS_LABELS: Record<MultaRhStatus, string> = {
  pendente: "Pendente",
  pago: "Pago",
}

export const MULTA_INDICACAO_STATUS_LABELS: Record<MultaIndicacaoStatus, string> = {
  sim: "Sim",
  expirado: "Expirado",
}

export const MULTA_COLABORADOR_STATUS_LABELS: Record<MultaColaboradorStatus, string> = {
  ativo: "Ativo",
  desligado: "Desligado",
}

export const MULTA_GRAVIDADE_LABELS: Record<MultaGravidade, string> = {
  leve: "Leve",
  media: "Média",
  grave: "Grave",
  gravissima: "Gravíssima",
}

export const MULTA_GRAVIDADE_POINTS: Record<MultaGravidade, number> = {
  leve: 3,
  media: 4,
  grave: 5,
  gravissima: 7,
}

export const MULTA_STATUS_OPTIONS = Object.entries(MULTA_STATUS_LABELS).map(([value, label]) => ({
  value: value as MultaStatus,
  label,
}))

export const MULTA_RH_STATUS_OPTIONS = Object.entries(MULTA_RH_STATUS_LABELS).map(([value, label]) => ({
  value: value as MultaRhStatus,
  label,
}))

export const MULTA_INDICACAO_STATUS_OPTIONS = Object.entries(MULTA_INDICACAO_STATUS_LABELS).map(([value, label]) => ({
  value: value as MultaIndicacaoStatus,
  label,
}))

export const MULTA_COLABORADOR_STATUS_OPTIONS = Object.entries(MULTA_COLABORADOR_STATUS_LABELS).map(([value, label]) => ({
  value: value as MultaColaboradorStatus,
  label,
}))

export const MULTA_GRAVIDADE_OPTIONS = Object.entries(MULTA_GRAVIDADE_LABELS).map(([value, label]) => ({
  value: value as MultaGravidade,
  label,
}))

export const MULTA_LOCADORA_OPTIONS = [
  { value: "Localiza", label: "Localiza" },
  { value: "4LOC", label: "4LOC" },
  { value: "Lok Motors", label: "Lok Motors" },
  { value: "Próprio", label: "Próprio" },
] as const

export const MULTA_STATUS_BADGE_CLASS: Record<MultaStatus, string> = {
  pendente: "border-amber-200 bg-amber-50 text-amber-700",
  enviado: "border-emerald-200 bg-emerald-50 text-emerald-700",
}

export const MULTA_RH_STATUS_BADGE_CLASS: Record<MultaRhStatus, string> = {
  pendente: "border-sky-200 bg-sky-50 text-sky-700",
  pago: "border-slate-200 bg-slate-100 text-slate-700",
}

export const MULTA_INDICACAO_STATUS_BADGE_CLASS: Record<MultaIndicacaoStatus, string> = {
  sim: "bg-emerald-100 text-emerald-700",
  expirado: "bg-rose-100 text-rose-700",
}

export const MULTA_COLABORADOR_STATUS_BADGE_CLASS: Record<MultaColaboradorStatus, string> = {
  ativo: "bg-emerald-100 text-emerald-700",
  desligado: "bg-rose-100 text-rose-700",
}

export const MULTA_GRAVIDADE_BADGE_CLASS: Record<MultaGravidade, string> = {
  leve: "bg-emerald-100 text-emerald-700",
  media: "bg-amber-100 text-amber-700",
  grave: "bg-orange-100 text-orange-700",
  gravissima: "bg-rose-100 text-rose-700",
}

export const MULTAS_DEMO_SEED: Multa[] = [
  {
    id: "demo-1",
    vehicleId: null,
    colaboradorId: null,
    dataHoraInfracao: "2026-02-19T13:41:00.000Z",
    placa: "SIW3I87",
    condutor: "Wagner Correia Oliveira",
    tipo: "Excesso de velocidade em até 20%",
    gravidade: "media",
    pontos: 4,
    autoInfracao: "1K2624549",
    valor: 130.16,
    dataLimiteIndicar: "2026-04-02",
    status: "enviado",
    indicacaoStatus: "sim",
    colaboradorStatus: "ativo",
    statusEnviadoEm: "2026-03-03T14:20:00.000Z",
    rhStatus: "pendente",
    rhPagoEm: null,
    valorNic: 130.16,
    valorTotalDesconto: 260.32,
    locadora: "Localiza",
    observacoes: "Veículo retirado na casa do colaborador.",
    createdAt: "2026-03-01T10:00:00.000Z",
    updatedAt: "2026-03-01T10:00:00.000Z",
  },
  {
    id: "demo-2",
    vehicleId: null,
    colaboradorId: null,
    dataHoraInfracao: "2025-12-28T13:52:00.000Z",
    placa: "TII0F86",
    condutor: "Aldemir Batista Costa",
    tipo: "Excesso de velocidade em até 20%",
    gravidade: "grave",
    pontos: 5,
    autoInfracao: "1J5723209",
    valor: 130.16,
    dataLimiteIndicar: "2026-04-02",
    status: "pendente",
    indicacaoStatus: "sim",
    colaboradorStatus: "ativo",
    statusEnviadoEm: null,
    rhStatus: "pendente",
    rhPagoEm: null,
    valorNic: 130.16,
    valorTotalDesconto: 90,
    locadora: "Localiza",
    observacoes: "Aguardando anexar comprovante e contestação.",
    createdAt: "2026-03-02T09:30:00.000Z",
    updatedAt: "2026-03-02T09:30:00.000Z",
  },
  {
    id: "demo-3",
    vehicleId: null,
    colaboradorId: null,
    dataHoraInfracao: "2026-03-05T08:17:00.000Z",
    placa: "GIC7F92",
    condutor: "Sem condutor indicado",
    tipo: "Estacionamento em local proibido",
    gravidade: "leve",
    pontos: 3,
    autoInfracao: "2A9034511",
    valor: 88.38,
    dataLimiteIndicar: "2026-03-22",
    status: "pendente",
    indicacaoStatus: "sim",
    colaboradorStatus: "desligado",
    statusEnviadoEm: null,
    rhStatus: "pendente",
    rhPagoEm: null,
    valorNic: null,
    valorTotalDesconto: 88.38,
    locadora: "Bradesco Financiamento",
    observacoes: "Validar se houve uso operacional no momento da autuação.",
    createdAt: "2026-03-05T11:00:00.000Z",
    updatedAt: "2026-03-05T11:00:00.000Z",
  },
  {
    id: "demo-4",
    vehicleId: null,
    colaboradorId: null,
    dataHoraInfracao: "2026-03-01T19:10:00.000Z",
    placa: "SIQ0A22",
    condutor: "João Batista Rocha",
    tipo: "Avanço de sinal vermelho",
    gravidade: "gravissima",
    pontos: 7,
    autoInfracao: "3C8120440",
    valor: 293.47,
    dataLimiteIndicar: "2026-03-18",
    status: "enviado",
    indicacaoStatus: "sim",
    colaboradorStatus: "ativo",
    statusEnviadoEm: "2026-03-07T09:00:00.000Z",
    rhStatus: "pago",
    rhPagoEm: "2026-03-10T16:45:00.000Z",
    valorNic: 293.47,
    valorTotalDesconto: 293.47,
    locadora: "4LOC",
    observacoes: "Pagamento já processado pela locadora.",
    createdAt: "2026-03-06T14:15:00.000Z",
    updatedAt: "2026-03-06T14:15:00.000Z",
  },
]

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value)
}

export function formatDate(value: string): string {
  return new Intl.DateTimeFormat("pt-BR").format(new Date(value))
}

export function formatDateTime(value: string): string {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value))
}

export function formatStatusDate(value: string | null | undefined): string {
  if (!value) return ""
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
  }).format(new Date(value))
}

export function formatProviderLabel(value: string | null | undefined): string {
  if (!value) return ""

  return value
    .replace(/[_-]+/g, " ")
    .split(" ")
    .filter(Boolean)
    .map((chunk) => chunk.charAt(0).toUpperCase() + chunk.slice(1))
    .join(" ")
}

export function normalizeMultaLocadora(value: string | null | undefined): string {
  if (!value) return ""

  const normalized = value.trim().toLowerCase()

  if (["localiza"].includes(normalized)) return "Localiza"
  if (["movida", "4loc"].includes(normalized)) return "4LOC"
  if (["lok_motors", "lok motors", "lokmotors", "lok-motors"].includes(normalized)) return "Lok Motors"
  if (["proprio", "próprio", "veiculo_sln", "veículo sln"].includes(normalized)) return "Próprio"

  return formatProviderLabel(value)
}

export function normalizeMultaColaboradorStatus(value: string | null | undefined): MultaColaboradorStatus | null {
  if (value === "ativo" || value === "desligado") {
    return value
  }

  return null
}

export function getMultaTotalValue(multa: Multa): number {
  return multa.valor + (multa.valorNic ?? 0)
}

export function countUpcomingDeadline(multas: Multa[], days = 7): number {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const limitDate = new Date(today.getTime() + days * 24 * 60 * 60 * 1000)

  return multas.filter((multa) => {
    const deadline = new Date(multa.dataLimiteIndicar)
    deadline.setHours(0, 0, 0, 0)
    return deadline >= today && deadline <= limitDate && multa.rhStatus !== "pago"
  }).length
}

export function countOverdueDeadlines(multas: Multa[]): number {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  return multas.filter((multa) => {
    if (multa.rhStatus === "pago") return false
    const deadline = new Date(multa.dataLimiteIndicar)
    deadline.setHours(0, 0, 0, 0)
    return deadline < today
  }).length
}

export function buildSeverityChartData(multas: Multa[]) {
  const counts = {
    leve: multas.filter((multa) => multa.gravidade === "leve").length,
    media: multas.filter((multa) => multa.gravidade === "media").length,
    grave: multas.filter((multa) => multa.gravidade === "grave").length,
    gravissima: multas.filter((multa) => multa.gravidade === "gravissima").length,
  }

  const segments = [
    { key: "leve", color: "var(--color-chart-2)", value: counts.leve, label: MULTA_GRAVIDADE_LABELS.leve },
    { key: "media", color: "var(--color-chart-3)", value: counts.media, label: MULTA_GRAVIDADE_LABELS.media },
    { key: "grave", color: "var(--color-chart-5)", value: counts.grave, label: MULTA_GRAVIDADE_LABELS.grave },
    { key: "gravissima", color: "var(--color-destructive)", value: counts.gravissima, label: MULTA_GRAVIDADE_LABELS.gravissima },
  ] as const

  const total = segments.reduce((sum, segment) => sum + segment.value, 0)
  let currentPercent = 0

  const gradientParts = segments.map((segment) => {
    const percentage = total === 0 ? 0 : (segment.value / total) * 100
    const start = currentPercent
    currentPercent += percentage
    return `${segment.color} ${start}% ${currentPercent}%`
  })

  return {
    counts,
    segments,
    total,
    gradient: total === 0 ? "var(--border) 0% 100%" : gradientParts.join(", "),
  }
}

export function toDateTimeLocalValue(value: string): string {
  if (!value) return ""

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ""

  const timezoneOffset = date.getTimezoneOffset() * 60_000
  return new Date(date.getTime() - timezoneOffset).toISOString().slice(0, 16)
}

export function fromDateTimeLocalValue(value: string): string {
  if (!value) return ""

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ""

  return date.toISOString()
}