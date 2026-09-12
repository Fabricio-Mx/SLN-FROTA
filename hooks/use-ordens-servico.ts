"use client"

import useSWR, { mutate } from "swr"
import { createClient } from "@/lib/supabase/client"
import { getOrdemServicoTotal } from "@/lib/fornecedores"
import type {
  BoletoParcela,
  DriveFile,
  OrdemServico,
  OrdemServicoFormData,
  OrdemServicoStatus,
} from "@/lib/types"

const TABLE = "fleet_ordens_servico"
const SWR_KEY = "fleet-ordens-servico"
const SWR_OPTIONS = {
  revalidateOnFocus: false,
  revalidateOnReconnect: false,
  dedupingInterval: 30_000,
  keepPreviousData: true,
} as const

type OrdemServicoRow = {
  id: string
  fornecedor_id: string | null
  vehicle_id: string | null
  placa: string
  descricao: string
  valor_pecas: number | string | null
  valor_mao_obra: number | string | null
  valor_total: number | string | null
  km_veiculo: number | null
  data_abertura: string | null
  previsao_entrega: string | null
  status: string | null
  aprovado_por: string | null
  aprovado_em: string | null
  motivo_rejeicao: string | null
  parcelas_quantidade?: number | null
  prazos_dias?: unknown
  boleto_vencimento: string | null
  boleto_valor: number | string | null
  boleto_arquivos: unknown
  boleto_parcelas?: unknown
  nota_fiscal_numero: string | null
  nota_fiscal_emissao: string | null
  nota_fiscal_valor: number | string | null
  nota_fiscal_arquivos: unknown
  observacoes: string | null
  created_at: string
  updated_at: string
}

const normalizeStatus = (status: string | null | undefined): OrdemServicoStatus => {
  if (status === "aprovado" || status === "rejeitado" || status === "concluido") return status
  return "aguardando"
}

const toDriveFiles = (value: unknown): DriveFile[] => (Array.isArray(value) ? (value as DriveFile[]) : [])

const toPrazosDias = (value: unknown): number[] =>
  Array.isArray(value) ? value.map((item) => Number(item)).filter((item) => Number.isFinite(item) && item >= 0) : []

const toParcelas = (value: unknown): BoletoParcela[] => {
  if (!Array.isArray(value)) return []

  return (value as Partial<BoletoParcela>[]).map((parcela, index) => ({
    id: String(parcela?.id ?? `parcela-${index + 1}`),
    numero: Number(parcela?.numero ?? index + 1),
    vencimento: typeof parcela?.vencimento === "string" ? parcela.vencimento.slice(0, 10) : "",
    valor: parcela?.valor === null || parcela?.valor === undefined ? null : Number(parcela.valor),
    pago: parcela?.pago === true,
    pagoEm: typeof parcela?.pagoEm === "string" ? parcela.pagoEm : null,
    arquivos: toDriveFiles(parcela?.arquivos),
  }))
}

// Bancos legados guardavam um boleto único; ele vira a primeira parcela.
const buildParcelasFromLegacy = (row: OrdemServicoRow): BoletoParcela[] => {
  const arquivos = toDriveFiles(row.boleto_arquivos)
  if (!row.boleto_vencimento && arquivos.length === 0) return []

  return [
    {
      id: `${row.id}-parcela-1`,
      numero: 1,
      vencimento: row.boleto_vencimento || "",
      valor: toNullableNumber(row.boleto_valor),
      pago: false,
      pagoEm: null,
      arquivos,
    },
  ]
}

const toNullableNumber = (value: number | string | null): number | null => {
  if (value === null || value === "") return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

const mapOrdemServicoRow = (row: OrdemServicoRow): OrdemServico => {
  const valorPecas = Number(row.valor_pecas ?? 0)
  const valorMaoObra = Number(row.valor_mao_obra ?? 0)
  const parcelas = toParcelas(row.boleto_parcelas)

  return {
    id: row.id,
    fornecedorId: row.fornecedor_id,
    vehicleId: row.vehicle_id,
    placa: row.placa,
    descricao: row.descricao,
    valorPecas,
    valorMaoObra,
    valorTotal: Number(row.valor_total ?? getOrdemServicoTotal(valorPecas, valorMaoObra)),
    kmVeiculo: row.km_veiculo ?? null,
    dataAbertura: row.data_abertura || "",
    previsaoEntrega: row.previsao_entrega || "",
    status: normalizeStatus(row.status),
    aprovadoPor: row.aprovado_por,
    aprovadoEm: row.aprovado_em,
    motivoRejeicao: row.motivo_rejeicao,
    parcelasQuantidade: row.parcelas_quantidade ?? (parcelas.length > 0 ? parcelas.length : null),
    prazosDias: toPrazosDias(row.prazos_dias),
    boletoVencimento: row.boleto_vencimento || "",
    boletoValor: toNullableNumber(row.boleto_valor),
    boletoArquivos: toDriveFiles(row.boleto_arquivos),
    boletoParcelas: parcelas.length > 0 ? parcelas : buildParcelasFromLegacy(row),
    notaFiscalNumero: row.nota_fiscal_numero || "",
    notaFiscalEmissao: row.nota_fiscal_emissao || "",
    notaFiscalValor: toNullableNumber(row.nota_fiscal_valor),
    notaFiscalArquivos: toDriveFiles(row.nota_fiscal_arquivos),
    observacoes: row.observacoes || "",
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

const toOrdemServicoRow = (formData: OrdemServicoFormData) => {
  const parcelas = (formData.boletoParcelas ?? []).map((parcela, index) => ({
    ...parcela,
    numero: index + 1,
  }))
  const proximaPendente = parcelas
    .filter((parcela) => !parcela.pago && parcela.vencimento)
    .sort((left, right) => left.vencimento.localeCompare(right.vencimento))[0]
  // O endpoint que libera os anexos do Drive lê `boleto_arquivos`, então mantemos a lista achatada.
  const arquivosAchatados = parcelas.flatMap((parcela) => parcela.arquivos ?? [])

  return {
    fornecedor_id: formData.fornecedorId,
    vehicle_id: formData.vehicleId,
    placa: formData.placa.trim().toUpperCase(),
    descricao: formData.descricao.trim(),
    valor_pecas: formData.valorPecas,
    valor_mao_obra: formData.valorMaoObra,
    valor_total: getOrdemServicoTotal(formData.valorPecas, formData.valorMaoObra),
    km_veiculo: formData.kmVeiculo,
    data_abertura: formData.dataAbertura || null,
    previsao_entrega: formData.previsaoEntrega || null,
    status: formData.status,
    aprovado_por: formData.aprovadoPor,
    aprovado_em: formData.aprovadoEm,
    motivo_rejeicao: formData.motivoRejeicao,
    parcelas_quantidade: formData.parcelasQuantidade,
    prazos_dias: formData.prazosDias ?? [],
    boleto_vencimento: proximaPendente?.vencimento || null,
    boleto_valor: proximaPendente?.valor ?? null,
    boleto_arquivos: arquivosAchatados,
    boleto_parcelas: parcelas,
    nota_fiscal_numero: formData.notaFiscalNumero.trim() || null,
    nota_fiscal_emissao: formData.notaFiscalEmissao || null,
    nota_fiscal_valor: formData.notaFiscalValor,
    nota_fiscal_arquivos: formData.notaFiscalArquivos ?? [],
    observacoes: formData.observacoes.trim() || null,
  }
}

const fetcher = async (): Promise<OrdemServico[]> => {
  const supabase = createClient()
  const { data, error } = await supabase.from(TABLE).select("*").order("created_at", { ascending: false })

  if (error) {
    throw new Error(error.message)
  }

  return (data || []).map((row) => mapOrdemServicoRow(row as OrdemServicoRow))
}

export function refreshOrdensServico() {
  return mutate(SWR_KEY)
}

export type OrdemServicoDecision = {
  status: Extract<OrdemServicoStatus, "aprovado" | "rejeitado">
  motivoRejeicao?: string
}

export function useOrdensServico(enabled = true) {
  const { data, error, isLoading } = useSWR<OrdemServico[]>(enabled ? SWR_KEY : null, fetcher, SWR_OPTIONS)

  const addOrdemServico = async (formData: OrdemServicoFormData): Promise<OrdemServico> => {
    const supabase = createClient()
    const { data: inserted, error: insertError } = await supabase
      .from(TABLE)
      .insert(toOrdemServicoRow(formData))
      .select("*")
      .single()

    if (insertError || !inserted) {
      throw new Error(insertError?.message || "Falha ao salvar a ordem de serviço.")
    }

    await mutate(SWR_KEY)
    return mapOrdemServicoRow(inserted as OrdemServicoRow)
  }

  const updateOrdemServico = async (id: string, formData: OrdemServicoFormData): Promise<OrdemServico> => {
    const supabase = createClient()
    const { data: updated, error: updateError } = await supabase
      .from(TABLE)
      .update({ ...toOrdemServicoRow(formData), updated_at: new Date().toISOString() })
      .eq("id", id)
      .select("*")
      .single()

    if (updateError || !updated) {
      throw new Error(updateError?.message || "Falha ao atualizar a ordem de serviço.")
    }

    await mutate(SWR_KEY)
    return mapOrdemServicoRow(updated as OrdemServicoRow)
  }

  const deleteOrdemServico = async (id: string): Promise<void> => {
    const supabase = createClient()
    const { error: deleteError } = await supabase.from(TABLE).delete().eq("id", id)

    if (deleteError) {
      throw new Error(deleteError.message)
    }

    await mutate(SWR_KEY)
  }

  // A decisão do gestor passa pelo servidor para validar o papel antes de gravar.
  const decideOrdemServico = async (id: string, decision: OrdemServicoDecision): Promise<void> => {
    const response = await fetch(`/api/ordens-servico/${id}/aprovacao`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(decision),
    })

    if (!response.ok) {
      const payload = await response.json().catch(() => ({}))
      throw new Error(payload?.error || "Falha ao registrar a decisão do orçamento.")
    }

    await mutate(SWR_KEY)
  }

  return {
    ordens: data ?? [],
    isLoading,
    error: error instanceof Error ? error.message : null,
    addOrdemServico,
    updateOrdemServico,
    deleteOrdemServico,
    decideOrdemServico,
    refreshOrdensServico,
  }
}
