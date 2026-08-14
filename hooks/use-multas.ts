"use client"

import useSWR, { mutate } from "swr"
import { createClient } from "@/lib/supabase/client"
import { MULTAS_DEMO_SEED, normalizeMultaColaboradorStatus } from "@/lib/multas"
import type { Multa, MultaFormData } from "@/lib/types"

const TABLE = "fleet_multas"
const SWR_KEY = "fleet-multas"
const LEGACY_STORAGE_KEY = "fleet-multas"
const RH_STATUS_FALLBACK_STORAGE_KEY = "fleet-multas-rh-status"
const INDICACAO_STATUS_FALLBACK_STORAGE_KEY = "fleet-multas-indicacao-status"
const COLABORADOR_STATUS_FALLBACK_STORAGE_KEY = "fleet-multas-colaborador-status"
const STATUS_DATE_FALLBACK_STORAGE_KEY = "fleet-multas-status-dates"
const SWR_OPTIONS = {
  revalidateOnFocus: false,
  revalidateOnReconnect: false,
  dedupingInterval: 30_000,
  keepPreviousData: true,
} as const

type MultaRow = {
  id: string
  vehicle_id: string | null
  colaborador_id: string | null
  data_hora_infracao: string | null
  placa: string
  condutor: string | null
  tipo: string
  gravidade: "leve" | "media" | "grave" | "gravissima"
  pontos: number | null
  auto_infracao: string | null
  valor: number | string | null
  data_limite_indicar: string | null
  status: string | null
  indicacao_status?: string | null
  colaborador_status?: string | null
  status_enviado_em?: string | null
  rh_status?: string | null
  rh_pago_em?: string | null
  valor_nic: number | string | null
  valor_total_desconto: number | string | null
  locadora: string | null
  observacoes: string | null
  created_at: string
  updated_at: string
}

const hasMissingTableError = (error: unknown): boolean => {
  if (!(error instanceof Error)) return false

  const message = error.message.toLowerCase()
  return (
    (message.includes("relation") && message.includes("does not exist")) ||
    (message.includes("could not find") && message.includes(TABLE))
  )
}

const hasMissingRhStatusColumnError = (error: unknown): boolean => {
  if (!(error instanceof Error)) return false

  const message = error.message.toLowerCase()
  return message.includes("rh_status") && message.includes("column")
}

const hasMissingStatusDateColumnError = (error: unknown): boolean => {
  if (!(error instanceof Error)) return false

  const message = error.message.toLowerCase()
  return (
    message.includes("column") &&
    (message.includes("status_enviado_em") || message.includes("rh_pago_em"))
  )
}

const hasMissingIndicacaoStatusColumnError = (error: unknown): boolean => {
  if (!(error instanceof Error)) return false

  const message = error.message.toLowerCase()
  return message.includes("indicacao_status") && message.includes("column")
}

const hasMissingColaboradorStatusColumnError = (error: unknown): boolean => {
  if (!(error instanceof Error)) return false

  const message = error.message.toLowerCase()
  return message.includes("colaborador_status") && message.includes("column")
}

type StoredColaboradorStatus = NonNullable<Multa["colaboradorStatus"]>

const normalizeOperationalStatus = (status: string | null | undefined): Multa["status"] => {
  if (status === "enviado") return "enviado"
  return "pendente"
}

const deriveLegacyIndicacaoStatus = (status: string | null | undefined, deadlineValue: string | null | undefined): Multa["indicacaoStatus"] => {
  if (status === "enviado") return "sim"
  if (!deadlineValue) return "sim"

  const deadline = new Date(deadlineValue)
  if (Number.isNaN(deadline.getTime())) return "sim"

  deadline.setHours(0, 0, 0, 0)

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  return deadline < today ? "expirado" : "sim"
}

const normalizeIndicacaoStatus = (
  indicacaoStatus: string | null | undefined,
  status: string | null | undefined,
  deadlineValue: string | null | undefined
): Multa["indicacaoStatus"] => {
  if (indicacaoStatus === "expirado") return "expirado"
  if (indicacaoStatus === "sim") return "sim"
  return deriveLegacyIndicacaoStatus(status, deadlineValue)
}

const normalizeRhStatus = (mainStatus: string | null | undefined, rhStatus?: string | null): Multa["rhStatus"] => {
  if (rhStatus === "pago") return "pago"
  if (mainStatus === "pago") return "pago"
  return "pendente"
}

const getColaboradorStatusFallbackMap = (): Record<string, StoredColaboradorStatus> => {
  if (typeof window === "undefined") return {}

  try {
    const stored = localStorage.getItem(COLABORADOR_STATUS_FALLBACK_STORAGE_KEY)
    return stored ? (JSON.parse(stored) as Record<string, StoredColaboradorStatus>) : {}
  } catch {
    return {}
  }
}

const getRhStatusFallbackMap = (): Record<string, Multa["rhStatus"]> => {
  if (typeof window === "undefined") return {}

  try {
    const stored = localStorage.getItem(RH_STATUS_FALLBACK_STORAGE_KEY)
    return stored ? (JSON.parse(stored) as Record<string, Multa["rhStatus"]>) : {}
  } catch {
    return {}
  }
}

const getIndicacaoStatusFallbackMap = (): Record<string, Multa["indicacaoStatus"]> => {
  if (typeof window === "undefined") return {}

  try {
    const stored = localStorage.getItem(INDICACAO_STATUS_FALLBACK_STORAGE_KEY)
    return stored ? (JSON.parse(stored) as Record<string, Multa["indicacaoStatus"]>) : {}
  } catch {
    return {}
  }
}

const setColaboradorStatusFallbackValue = (multaId: string, colaboradorStatus: StoredColaboradorStatus) => {
  if (typeof window === "undefined") return

  const current = getColaboradorStatusFallbackMap()
  current[multaId] = colaboradorStatus
  localStorage.setItem(COLABORADOR_STATUS_FALLBACK_STORAGE_KEY, JSON.stringify(current))
}

const getStatusDateFallbackMap = (): Record<string, Pick<Multa, "statusEnviadoEm" | "rhPagoEm">> => {
  if (typeof window === "undefined") return {}

  try {
    const stored = localStorage.getItem(STATUS_DATE_FALLBACK_STORAGE_KEY)
    return stored ? (JSON.parse(stored) as Record<string, Pick<Multa, "statusEnviadoEm" | "rhPagoEm">>) : {}
  } catch {
    return {}
  }
}

const setRhStatusFallbackValue = (multaId: string, rhStatus: Multa["rhStatus"]) => {
  if (typeof window === "undefined") return

  const current = getRhStatusFallbackMap()
  current[multaId] = rhStatus
  localStorage.setItem(RH_STATUS_FALLBACK_STORAGE_KEY, JSON.stringify(current))
}

const setIndicacaoStatusFallbackValue = (multaId: string, indicacaoStatus: Multa["indicacaoStatus"]) => {
  if (typeof window === "undefined") return

  const current = getIndicacaoStatusFallbackMap()
  current[multaId] = indicacaoStatus
  localStorage.setItem(INDICACAO_STATUS_FALLBACK_STORAGE_KEY, JSON.stringify(current))
}

const clearColaboradorStatusFallbackValue = (multaId: string) => {
  if (typeof window === "undefined") return

  const current = getColaboradorStatusFallbackMap()
  if (!(multaId in current)) return
  delete current[multaId]
  localStorage.setItem(COLABORADOR_STATUS_FALLBACK_STORAGE_KEY, JSON.stringify(current))
}

const setStatusDateFallbackValue = (multaId: string, statusDates: Pick<Multa, "statusEnviadoEm" | "rhPagoEm">) => {
  if (typeof window === "undefined") return

  const current = getStatusDateFallbackMap()
  current[multaId] = statusDates
  localStorage.setItem(STATUS_DATE_FALLBACK_STORAGE_KEY, JSON.stringify(current))
}

const clearRhStatusFallbackValue = (multaId: string) => {
  if (typeof window === "undefined") return

  const current = getRhStatusFallbackMap()
  if (!(multaId in current)) return
  delete current[multaId]
  localStorage.setItem(RH_STATUS_FALLBACK_STORAGE_KEY, JSON.stringify(current))
}

const clearIndicacaoStatusFallbackValue = (multaId: string) => {
  if (typeof window === "undefined") return

  const current = getIndicacaoStatusFallbackMap()
  if (!(multaId in current)) return
  delete current[multaId]
  localStorage.setItem(INDICACAO_STATUS_FALLBACK_STORAGE_KEY, JSON.stringify(current))
}

const normalizeStoredMulta = (multa: Multa): Multa => ({
  ...multa,
  colaboradorStatus: normalizeMultaColaboradorStatus(multa.colaboradorStatus),
})

const clearStatusDateFallbackValue = (multaId: string) => {
  if (typeof window === "undefined") return

  const current = getStatusDateFallbackMap()
  if (!(multaId in current)) return
  delete current[multaId]
  localStorage.setItem(STATUS_DATE_FALLBACK_STORAGE_KEY, JSON.stringify(current))
}

const mapMultaRow = (row: MultaRow): Multa => {
  return {
    id: row.id,
    vehicleId: row.vehicle_id ?? null,
    colaboradorId: row.colaborador_id ?? null,
    dataHoraInfracao: row.data_hora_infracao || new Date().toISOString(),
    placa: row.placa,
    condutor: row.condutor || "",
    tipo: row.tipo,
    gravidade: row.gravidade,
    pontos: Number(row.pontos ?? 0),
    autoInfracao: row.auto_infracao || "",
    valor: Number(row.valor ?? 0),
    dataLimiteIndicar: row.data_limite_indicar || "",
    status: normalizeOperationalStatus(row.status),
    indicacaoStatus: normalizeIndicacaoStatus(row.indicacao_status, row.status, row.data_limite_indicar),
    colaboradorStatus: normalizeMultaColaboradorStatus(row.colaborador_status),
    statusEnviadoEm: row.status_enviado_em ?? null,
    rhStatus: normalizeRhStatus(row.status, row.rh_status),
    rhPagoEm: row.rh_pago_em ?? null,
    valorNic: row.valor_nic == null ? null : Number(row.valor_nic),
    valorTotalDesconto: row.valor_total_desconto == null ? null : Number(row.valor_total_desconto),
    locadora: row.locadora || "",
    observacoes: row.observacoes || "",
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

const toMultaRow = (formData: MultaFormData): Omit<MultaRow, "id" | "created_at" | "updated_at"> => {
  return {
    vehicle_id: formData.vehicleId ?? null,
    colaborador_id: formData.colaboradorId ?? null,
    data_hora_infracao: formData.dataHoraInfracao,
    placa: formData.placa.trim().toUpperCase(),
    condutor: formData.condutor.trim() || null,
    tipo: formData.tipo.trim(),
    gravidade: formData.gravidade,
    pontos: formData.pontos,
    auto_infracao: formData.autoInfracao.trim() || null,
    valor: formData.valor,
    data_limite_indicar: formData.dataLimiteIndicar,
    status: formData.status,
    indicacao_status: formData.indicacaoStatus,
    colaborador_status: formData.colaboradorStatus ?? "ativo",
    status_enviado_em: formData.statusEnviadoEm ?? null,
    rh_status: formData.rhStatus,
    rh_pago_em: formData.rhPagoEm ?? null,
    valor_nic: typeof formData.valorNic === "number" ? formData.valorNic : null,
    valor_total_desconto: typeof formData.valorTotalDesconto === "number" ? formData.valorTotalDesconto : null,
    locadora: formData.locadora.trim() || null,
    observacoes: formData.observacoes.trim() || null,
  }
}

const toLegacyCompatibleMultaRow = (formData: MultaFormData) => {
  const payload = { ...toMultaRow(formData) } as Partial<ReturnType<typeof toMultaRow>>
  delete payload.indicacao_status
  delete payload.colaborador_status
  delete payload.rh_status
  delete payload.status_enviado_em
  delete payload.rh_pago_em
  return payload
}

const getLegacyMultasFromStorage = (): Multa[] => {
  if (typeof window === "undefined") return MULTAS_DEMO_SEED

  try {
    const stored = localStorage.getItem(LEGACY_STORAGE_KEY)
    if (!stored) return MULTAS_DEMO_SEED
    return (JSON.parse(stored) as Multa[]).map(normalizeStoredMulta)
  } catch {
    return MULTAS_DEMO_SEED
  }
}

const saveLegacyMultasToStorage = (multas: Multa[]) => {
  if (typeof window === "undefined") return
  localStorage.setItem(LEGACY_STORAGE_KEY, JSON.stringify(multas))
}

const buildLocalMulta = (
  formData: MultaFormData,
  id?: string,
  timestamps?: { createdAt: string; updatedAt: string }
): Multa => {
  const now = new Date().toISOString()

  return {
    id: id ?? crypto.randomUUID(),
    vehicleId: formData.vehicleId ?? null,
    colaboradorId: formData.colaboradorId ?? null,
    dataHoraInfracao: formData.dataHoraInfracao,
    placa: formData.placa.trim().toUpperCase(),
    condutor: formData.condutor.trim(),
    tipo: formData.tipo.trim(),
    gravidade: formData.gravidade,
    pontos: formData.pontos,
    autoInfracao: formData.autoInfracao.trim(),
    valor: formData.valor,
    dataLimiteIndicar: formData.dataLimiteIndicar,
    status: formData.status,
    indicacaoStatus: formData.indicacaoStatus,
    colaboradorStatus: formData.colaboradorStatus ?? "ativo",
    statusEnviadoEm: formData.statusEnviadoEm ?? null,
    rhStatus: formData.rhStatus,
    rhPagoEm: formData.rhPagoEm ?? null,
    valorNic: typeof formData.valorNic === "number" ? formData.valorNic : null,
    valorTotalDesconto: typeof formData.valorTotalDesconto === "number" ? formData.valorTotalDesconto : null,
    locadora: formData.locadora.trim(),
    observacoes: formData.observacoes.trim(),
    createdAt: timestamps?.createdAt ?? now,
    updatedAt: timestamps?.updatedAt ?? now,
  }
}

const fetcher = async (): Promise<Multa[]> => {
  const supabase = createClient()
  const { data, error } = await supabase.from(TABLE).select("*").order("data_hora_infracao", { ascending: false })

  if (error) {
    if (hasMissingTableError(new Error(error.message))) {
      return getLegacyMultasFromStorage()
    }
    throw new Error(error.message)
  }

  const rhStatusFallbackMap = getRhStatusFallbackMap()
  const indicacaoStatusFallbackMap = getIndicacaoStatusFallbackMap()
  const colaboradorStatusFallbackMap = getColaboradorStatusFallbackMap()
  const statusDateFallbackMap = getStatusDateFallbackMap()

  return (data || []).map((row) => {
    const multa = mapMultaRow(row as MultaRow)
    const fallbackRhStatus = rhStatusFallbackMap[multa.id]
    const fallbackColaboradorStatus = colaboradorStatusFallbackMap[multa.id]
    const fallbackStatusDates = statusDateFallbackMap[multa.id]
    const rowData = row as MultaRow

    return {
      ...multa,
      indicacaoStatus:
        typeof rowData.indicacao_status === "undefined"
          ? (indicacaoStatusFallbackMap[multa.id] ?? multa.indicacaoStatus)
          : multa.indicacaoStatus,
      colaboradorStatus:
        typeof rowData.colaborador_status === "undefined"
          ? (fallbackColaboradorStatus ?? multa.colaboradorStatus ?? null)
          : multa.colaboradorStatus,
      rhStatus: typeof rowData.rh_status === "undefined" && fallbackRhStatus ? fallbackRhStatus : multa.rhStatus,
      statusEnviadoEm:
        typeof rowData.status_enviado_em === "undefined"
          ? (fallbackStatusDates?.statusEnviadoEm ?? multa.statusEnviadoEm)
          : multa.statusEnviadoEm,
      rhPagoEm:
        typeof rowData.rh_pago_em === "undefined"
          ? (fallbackStatusDates?.rhPagoEm ?? multa.rhPagoEm)
          : multa.rhPagoEm,
    }
  })
}

export function useMultas(enabled = true) {
  const { data, error, isLoading } = useSWR<Multa[]>(enabled ? SWR_KEY : null, fetcher, SWR_OPTIONS)
  const multas = data ?? []

  const addMulta = async (formData: MultaFormData): Promise<Multa> => {
    const supabase = createClient()
    const payload = toMultaRow(formData)
    let inserted: MultaRow | null = null
    let insertError: Error | null = null
    let usedIndicacaoStatusFallback = false
    let usedColaboradorStatusFallback = false
    let usedRhStatusFallback = false
    let usedStatusDatesFallback = false

    const primaryResult = await supabase.from(TABLE).insert(payload).select("*").single()

    if (primaryResult.error) {
      if (
        hasMissingColaboradorStatusColumnError(new Error(primaryResult.error.message)) ||
        hasMissingIndicacaoStatusColumnError(new Error(primaryResult.error.message)) ||
        hasMissingRhStatusColumnError(new Error(primaryResult.error.message)) ||
        hasMissingStatusDateColumnError(new Error(primaryResult.error.message))
      ) {
        usedIndicacaoStatusFallback = true
        usedColaboradorStatusFallback = true
        usedRhStatusFallback = true
        usedStatusDatesFallback = true
        const fallbackResult = await supabase.from(TABLE).insert(toLegacyCompatibleMultaRow(formData)).select("*").single()
        inserted = (fallbackResult.data as MultaRow | null) ?? null
        insertError = fallbackResult.error ? new Error(fallbackResult.error.message) : null
      } else if (!hasMissingTableError(new Error(primaryResult.error.message))) {
        insertError = new Error(primaryResult.error.message)
      }
    } else {
      inserted = (primaryResult.data as MultaRow | null) ?? null
    }

    if (insertError || (!inserted && !primaryResult?.error)) {
      if (insertError) {
        throw new Error(insertError.message)
      }
    }

    if (primaryResult.error && hasMissingTableError(new Error(primaryResult.error.message))) {
      const current = getLegacyMultasFromStorage()
      const localMulta = buildLocalMulta(formData)
      saveLegacyMultasToStorage([localMulta, ...current])
      await mutate(SWR_KEY)
      return localMulta
    }

    if (!inserted) {
      throw new Error("Falha ao salvar multa.")
    }

    const multa = mapMultaRow(inserted as MultaRow)
    if (usedIndicacaoStatusFallback) {
      setIndicacaoStatusFallbackValue(multa.id, formData.indicacaoStatus)
    } else {
      clearIndicacaoStatusFallbackValue(multa.id)
    }
    if (usedColaboradorStatusFallback && formData.colaboradorStatus) {
      setColaboradorStatusFallbackValue(multa.id, formData.colaboradorStatus)
    } else {
      clearColaboradorStatusFallbackValue(multa.id)
    }
    if (usedRhStatusFallback) {
      setRhStatusFallbackValue(multa.id, formData.rhStatus)
    } else {
      clearRhStatusFallbackValue(multa.id)
    }
    if (usedStatusDatesFallback) {
      setStatusDateFallbackValue(multa.id, {
        statusEnviadoEm: formData.statusEnviadoEm ?? null,
        rhPagoEm: formData.rhPagoEm ?? null,
      })
    } else {
      clearStatusDateFallbackValue(multa.id)
    }
    await mutate(SWR_KEY)
    return {
      ...multa,
      ...(usedIndicacaoStatusFallback ? { indicacaoStatus: formData.indicacaoStatus } : {}),
      ...(usedColaboradorStatusFallback ? { colaboradorStatus: formData.colaboradorStatus ?? "ativo" } : {}),
      ...(usedRhStatusFallback ? { rhStatus: formData.rhStatus } : {}),
      ...(usedStatusDatesFallback
        ? {
            statusEnviadoEm: formData.statusEnviadoEm ?? null,
            rhPagoEm: formData.rhPagoEm ?? null,
          }
        : {}),
    }
  }

  const updateMulta = async (id: string, formData: MultaFormData): Promise<Multa> => {
    const supabase = createClient()
    const payload = {
      ...toMultaRow(formData),
      updated_at: new Date().toISOString(),
    }
    let updated: MultaRow | null = null
    let updateError: Error | null = null
    let usedIndicacaoStatusFallback = false
    let usedColaboradorStatusFallback = false
    let usedRhStatusFallback = false
    let usedStatusDatesFallback = false

    const primaryResult = await supabase.from(TABLE).update(payload).eq("id", id).select("*").single()

    if (primaryResult.error) {
      if (
        hasMissingColaboradorStatusColumnError(new Error(primaryResult.error.message)) ||
        hasMissingIndicacaoStatusColumnError(new Error(primaryResult.error.message)) ||
        hasMissingRhStatusColumnError(new Error(primaryResult.error.message)) ||
        hasMissingStatusDateColumnError(new Error(primaryResult.error.message))
      ) {
        usedIndicacaoStatusFallback = true
        usedColaboradorStatusFallback = true
        usedRhStatusFallback = true
        usedStatusDatesFallback = true
        const fallbackResult = await supabase
          .from(TABLE)
          .update({
            ...toLegacyCompatibleMultaRow(formData),
            updated_at: new Date().toISOString(),
          })
          .eq("id", id)
          .select("*")
          .single()

        updated = (fallbackResult.data as MultaRow | null) ?? null
        updateError = fallbackResult.error ? new Error(fallbackResult.error.message) : null
      } else if (!hasMissingTableError(new Error(primaryResult.error.message))) {
        updateError = new Error(primaryResult.error.message)
      }
    } else {
      updated = (primaryResult.data as MultaRow | null) ?? null
    }

    if (updateError) {
      throw new Error(updateError.message)
    }

    if (primaryResult.error && hasMissingTableError(new Error(primaryResult.error.message))) {

      const current = getLegacyMultasFromStorage()
      const currentMulta = current.find((multa) => multa.id === id)
      if (!currentMulta) {
        throw new Error("Multa não encontrada.")
      }

      const localMulta = buildLocalMulta(formData, id, {
        createdAt: currentMulta.createdAt,
        updatedAt: new Date().toISOString(),
      })
      saveLegacyMultasToStorage(current.map((multa) => (multa.id === id ? localMulta : multa)))
      await mutate(SWR_KEY)
      return localMulta
    }

    if (!updated) {
      throw new Error("Falha ao atualizar multa.")
    }

    const multa = mapMultaRow(updated as MultaRow)
    if (usedIndicacaoStatusFallback) {
      setIndicacaoStatusFallbackValue(multa.id, formData.indicacaoStatus)
    } else {
      clearIndicacaoStatusFallbackValue(multa.id)
    }
    if (usedColaboradorStatusFallback && formData.colaboradorStatus) {
      setColaboradorStatusFallbackValue(multa.id, formData.colaboradorStatus)
    } else {
      clearColaboradorStatusFallbackValue(multa.id)
    }
    if (usedRhStatusFallback) {
      setRhStatusFallbackValue(multa.id, formData.rhStatus)
    } else {
      clearRhStatusFallbackValue(multa.id)
    }
    if (usedStatusDatesFallback) {
      setStatusDateFallbackValue(multa.id, {
        statusEnviadoEm: formData.statusEnviadoEm ?? null,
        rhPagoEm: formData.rhPagoEm ?? null,
      })
    } else {
      clearStatusDateFallbackValue(multa.id)
    }
    await mutate(SWR_KEY)
    return {
      ...multa,
      ...(usedIndicacaoStatusFallback ? { indicacaoStatus: formData.indicacaoStatus } : {}),
      ...(usedColaboradorStatusFallback ? { colaboradorStatus: formData.colaboradorStatus ?? "ativo" } : {}),
      ...(usedRhStatusFallback ? { rhStatus: formData.rhStatus } : {}),
      ...(usedStatusDatesFallback
        ? {
            statusEnviadoEm: formData.statusEnviadoEm ?? null,
            rhPagoEm: formData.rhPagoEm ?? null,
          }
        : {}),
    }
  }

  const updateMultaRhStatus = async (id: string, rhStatus: Multa["rhStatus"]): Promise<boolean> => {
    const response = await fetch(`/api/multas/${id}/rh-status`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ rhStatus }),
    })

    const result = (await response.json().catch(() => null)) as { error?: string } | null
    if (!response.ok) {
      throw new Error(result?.error || "Falha ao atualizar o Status RH.")
    }

    await mutate(SWR_KEY)
    return true
  }

  const deleteMulta = async (id: string): Promise<boolean> => {
    const supabase = createClient()
    const { error: deleteError } = await supabase.from(TABLE).delete().eq("id", id)

    if (deleteError) {
      if (!hasMissingTableError(new Error(deleteError.message))) {
        throw new Error(deleteError.message)
      }

      const current = getLegacyMultasFromStorage()
      saveLegacyMultasToStorage(current.filter((multa) => multa.id !== id))
      clearColaboradorStatusFallbackValue(id)
      clearIndicacaoStatusFallbackValue(id)
      clearStatusDateFallbackValue(id)
      await mutate(SWR_KEY)
      return true
    }

    clearColaboradorStatusFallbackValue(id)
    clearIndicacaoStatusFallbackValue(id)
    clearStatusDateFallbackValue(id)
    await mutate(SWR_KEY)
    return true
  }

  const getMultaById = (id: string): Multa | undefined => multas.find((multa) => multa.id === id)

  return {
    multas,
    error,
    isLoading,
    addMulta,
    updateMulta,
    updateMultaRhStatus,
    deleteMulta,
    getMultaById,
  }
}