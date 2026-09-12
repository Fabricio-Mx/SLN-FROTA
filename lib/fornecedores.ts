import type { BoletoParcela, Fornecedor, FornecedorRegiao, OrdemServico, OrdemServicoStatus } from "@/lib/types"

export const FORNECEDOR_REGIAO_LABELS: Record<FornecedorRegiao, string> = {
  norte: "Norte",
  nordeste: "Nordeste",
  centro_oeste: "Centro-Oeste",
  sudeste: "Sudeste",
  sul: "Sul",
}

export const FORNECEDOR_REGIAO_OPTIONS = Object.entries(FORNECEDOR_REGIAO_LABELS).map(([value, label]) => ({
  value: value as FornecedorRegiao,
  label,
}))

export const FORNECEDOR_REGIAO_BADGE_CLASS: Record<FornecedorRegiao, string> = {
  norte: "border-emerald-200 bg-emerald-50 text-emerald-700",
  nordeste: "border-amber-200 bg-amber-50 text-amber-700",
  centro_oeste: "border-orange-200 bg-orange-50 text-orange-700",
  sudeste: "border-sky-200 bg-sky-50 text-sky-700",
  sul: "border-violet-200 bg-violet-50 text-violet-700",
}

export const UF_REGIAO: Record<string, FornecedorRegiao> = {
  AC: "norte",
  AP: "norte",
  AM: "norte",
  PA: "norte",
  RO: "norte",
  RR: "norte",
  TO: "norte",
  AL: "nordeste",
  BA: "nordeste",
  CE: "nordeste",
  MA: "nordeste",
  PB: "nordeste",
  PE: "nordeste",
  PI: "nordeste",
  RN: "nordeste",
  SE: "nordeste",
  DF: "centro_oeste",
  GO: "centro_oeste",
  MT: "centro_oeste",
  MS: "centro_oeste",
  ES: "sudeste",
  MG: "sudeste",
  RJ: "sudeste",
  SP: "sudeste",
  PR: "sul",
  RS: "sul",
  SC: "sul",
}

export const UF_OPTIONS = Object.keys(UF_REGIAO).sort()

export function getRegiaoByUf(uf: string): FornecedorRegiao | null {
  return UF_REGIAO[uf.trim().toUpperCase()] ?? null
}

export function formatRegiao(fornecedor: Pick<Fornecedor, "regiao" | "uf"> | null | undefined): string {
  if (!fornecedor) return "—"

  const regiao = fornecedor.regiao ? FORNECEDOR_REGIAO_LABELS[fornecedor.regiao] : ""
  const uf = fornecedor.uf ? fornecedor.uf.toUpperCase() : ""

  if (regiao && uf) return `${regiao} · ${uf}`
  return regiao || uf || "—"
}

export const ORDEM_SERVICO_STATUS_LABELS: Record<OrdemServicoStatus, string> = {
  aguardando: "Aguardando aprovação",
  aprovado: "Aprovado",
  rejeitado: "Rejeitado",
  concluido: "Concluído",
}

export const ORDEM_SERVICO_STATUS_OPTIONS = Object.entries(ORDEM_SERVICO_STATUS_LABELS).map(([value, label]) => ({
  value: value as OrdemServicoStatus,
  label,
}))

export const ORDEM_SERVICO_STATUS_BADGE_CLASS: Record<OrdemServicoStatus, string> = {
  aguardando: "border-amber-200 bg-amber-50 text-amber-700",
  aprovado: "border-emerald-200 bg-emerald-50 text-emerald-700",
  rejeitado: "border-rose-200 bg-rose-50 text-rose-700",
  concluido: "border-sky-200 bg-sky-50 text-sky-700",
}

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(Number.isFinite(value) ? value : 0)
}

export function formatDate(value: string | null | undefined): string {
  if (!value) return "—"

  const parsed = value.length === 10 ? new Date(`${value}T00:00:00`) : new Date(value)
  if (Number.isNaN(parsed.getTime())) return "—"

  return new Intl.DateTimeFormat("pt-BR").format(parsed)
}

export function formatCnpj(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 14)

  return digits
    .replace(/(\d{2})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1/$2")
    .replace(/(\d{4})(\d{1,2})$/, "$1-$2")
}

export function formatTelefone(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 11)

  if (digits.length <= 10) {
    return digits
      .replace(/(\d{2})(\d)/, "($1) $2")
      .replace(/(\d{4})(\d)/, "$1-$2")
      .replace(/(-\d{4})\d+?$/, "$1")
  }

  return digits
    .replace(/(\d{2})(\d)/, "($1) $2")
    .replace(/(\d{5})(\d)/, "$1-$2")
    .replace(/(-\d{4})\d+?$/, "$1")
}

export function getOrdemServicoTotal(pecas: number, maoObra: number): number {
  return (Number(pecas) || 0) + (Number(maoObra) || 0)
}

export function parsePrazosDias(value: string): number[] {
  return value
    .split(/[^0-9]+/)
    .map((chunk) => Number(chunk))
    .filter((dias) => Number.isFinite(dias) && dias >= 0)
}

export function formatPrazosDias(prazos: number[]): string {
  return prazos.join("/")
}

export function formatCondicaoPagamento(
  ordem: Pick<OrdemServico, "parcelasQuantidade" | "prazosDias">
): string {
  const quantidade = ordem.parcelasQuantidade ?? ordem.prazosDias.length
  if (!quantidade) return "Não informada"

  const prazos = ordem.prazosDias.length > 0 ? ` · ${formatPrazosDias(ordem.prazosDias)} dias` : ""
  return `${quantidade}x${prazos}`
}

export function createParcelaId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID()
  }

  return `parcela-${Date.now()}-${Math.random().toString(16).slice(2)}`
}

export function addDays(isoDate: string, days: number): string {
  const base = new Date(`${isoDate.slice(0, 10)}T00:00:00`)
  if (Number.isNaN(base.getTime())) return ""

  base.setDate(base.getDate() + days)

  const month = String(base.getMonth() + 1).padStart(2, "0")
  const day = String(base.getDate()).padStart(2, "0")
  return `${base.getFullYear()}-${month}-${day}`
}

export function splitValor(total: number, partes: number): number[] {
  if (partes <= 0) return []

  const cents = Math.round(total * 100)
  const base = Math.floor(cents / partes)
  const resto = cents - base * partes

  return Array.from({ length: partes }, (_, index) => (base + (index < resto ? 1 : 0)) / 100)
}

// Gera as parcelas a partir da condição negociada (ex.: 3x em 15/30/60 dias a partir da abertura).
export function buildParcelasFromCondicao(
  dataBase: string,
  prazosDias: number[],
  total: number
): BoletoParcela[] {
  if (!dataBase || prazosDias.length === 0) return []

  return splitValor(total, prazosDias.length).map((valor, index) => ({
    id: createParcelaId(),
    numero: index + 1,
    vencimento: addDays(dataBase, prazosDias[index]),
    valor,
    pago: false,
    pagoEm: null,
    arquivos: [],
  }))
}

// Só pode regerar enquanto ninguém anexou boleto nem marcou pagamento.
export function canRebuildParcelas(parcelas: BoletoParcela[]): boolean {
  return parcelas.every((parcela) => !parcela.pago && (parcela.arquivos?.length ?? 0) === 0)
}

export const PARCELA_ALERTA_DIAS = 7

export type ParcelaStatus = "pago" | "vencido" | "proximo" | "aberto" | "sem_data"

export const PARCELA_STATUS_LABELS: Record<ParcelaStatus, string> = {
  pago: "Pago",
  vencido: "Vencido",
  proximo: "Vence em breve",
  aberto: "Em aberto",
  sem_data: "Sem vencimento",
}

export const PARCELA_STATUS_BADGE_CLASS: Record<ParcelaStatus, string> = {
  pago: "border-emerald-200 bg-emerald-50 text-emerald-700",
  vencido: "border-rose-200 bg-rose-50 text-rose-700",
  proximo: "border-amber-200 bg-amber-50 text-amber-700",
  aberto: "border-slate-200 bg-slate-100 text-slate-700",
  sem_data: "border-slate-200 bg-slate-100 text-slate-500",
}

export function getDiasParaVencimento(vencimento: string | null | undefined): number | null {
  if (!vencimento) return null

  const parsed = new Date(`${vencimento.slice(0, 10)}T00:00:00`)
  if (Number.isNaN(parsed.getTime())) return null

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  return Math.round((parsed.getTime() - today.getTime()) / (24 * 60 * 60 * 1000))
}

export function getParcelaStatus(parcela: BoletoParcela, alertaDias = PARCELA_ALERTA_DIAS): ParcelaStatus {
  if (parcela.pago) return "pago"

  const dias = getDiasParaVencimento(parcela.vencimento)
  if (dias === null) return "sem_data"
  if (dias < 0) return "vencido"
  if (dias <= alertaDias) return "proximo"

  return "aberto"
}

export function describeVencimento(dias: number): string {
  if (dias < 0) return `vencido há ${Math.abs(dias)} dia${Math.abs(dias) === 1 ? "" : "s"}`
  if (dias === 0) return "vence hoje"
  if (dias === 1) return "vence amanhã"
  return `vence em ${dias} dias`
}

export type ParcelaAlerta = {
  ordem: OrdemServico
  parcela: BoletoParcela
  dias: number
}

// Alerta apenas parcelas em aberto de ordens que já foram aprovadas.
export function getParcelasEmAlerta(ordens: OrdemServico[], alertaDias = PARCELA_ALERTA_DIAS): ParcelaAlerta[] {
  const alertas: ParcelaAlerta[] = []

  for (const ordem of ordens) {
    if (ordem.status !== "aprovado" && ordem.status !== "concluido") continue

    for (const parcela of ordem.boletoParcelas ?? []) {
      if (parcela.pago) continue

      const dias = getDiasParaVencimento(parcela.vencimento)
      if (dias === null || dias > alertaDias) continue

      alertas.push({ ordem, parcela, dias })
    }
  }

  return alertas.sort((left, right) => left.dias - right.dias)
}

export function getParcelasTotal(parcelas: BoletoParcela[]): number {
  return parcelas.reduce((total, parcela) => total + (parcela.valor ?? 0), 0)
}

export function getProximaParcelaPendente(ordem: OrdemServico): BoletoParcela | null {
  const pendentes = (ordem.boletoParcelas ?? [])
    .filter((parcela) => !parcela.pago && parcela.vencimento)
    .sort((left, right) => left.vencimento.localeCompare(right.vencimento))

  return pendentes[0] ?? null
}

export function countParcelasPagas(ordem: OrdemServico): number {
  return (ordem.boletoParcelas ?? []).filter((parcela) => parcela.pago).length
}

export function hasBoletoAnexado(ordem: OrdemServico): boolean {
  const parcelas = ordem.boletoParcelas ?? []
  if (parcelas.length > 0) {
    return parcelas.some((parcela) => (parcela.arquivos?.length ?? 0) > 0)
  }

  return (ordem.boletoArquivos?.length ?? 0) > 0
}

export function hasNotaFiscalAnexada(ordem: OrdemServico): boolean {
  return (ordem.notaFiscalArquivos?.length ?? 0) > 0
}

// Pendência financeira: ordem liberada para execução mas ainda sem boleto anexado.
export function hasPendenciaFinanceira(ordem: OrdemServico): boolean {
  return (ordem.status === "aprovado" || ordem.status === "concluido") && !hasBoletoAnexado(ordem)
}

export function isBoletoVencido(ordem: OrdemServico): boolean {
  return (ordem.boletoParcelas ?? []).some((parcela) => getParcelaStatus(parcela) === "vencido")
}

export function isSameMonth(value: string, reference: Date): boolean {
  const parsed = value.length === 10 ? new Date(`${value}T00:00:00`) : new Date(value)
  if (Number.isNaN(parsed.getTime())) return false

  return parsed.getFullYear() === reference.getFullYear() && parsed.getMonth() === reference.getMonth()
}

export function toDateInputValue(value: string | null | undefined): string {
  if (!value) return ""
  return value.slice(0, 10)
}
