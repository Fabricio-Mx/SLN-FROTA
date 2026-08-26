"use client"

import { useEffect } from "react"
import useSWR, { mutate } from "swr"
import { createClient } from "@/lib/supabase/client"
import type { Vehicle, VehicleFormData } from "@/lib/types"

const TABLE = "fleet_vehicles"
const SWR_KEY = "fleet-vehicles"
const LEGACY_STORAGE_KEY = "fleet-vehicles"
const MIGRATION_KEY = "fleet-vehicles-migrated"
const REVIEW_KM_FALLBACK_STORAGE_KEY = "fleet-vehicles-review-km"
const SWR_OPTIONS = {
  revalidateOnFocus: false,
  revalidateOnReconnect: false,
  dedupingInterval: 30_000,
  keepPreviousData: true,
} as const

type VehicleRow = {
  id: string
  placa: string
  chassi: string
  renavan: string | null
  modelo: string
  km: number | null
  km_ultima_revisao: number | null
  mensalidade: number | string | null
  data_vencimento_contrato: string | null
  tipo_propriedade: "alugado" | "proprio" | null
  empresa_locacao: string | null
  fornecedor_proprio: string | null
  cartao_combustivel: "veloe" | "ticket" | "ambos" | null
  numero_cartao_combustivel: string | null
  placa_cartao_combustivel: string | null
  frota: boolean | null
  na_oficina: boolean | null
  para_revisao: boolean | null
  sem_parar: boolean | null
  tipo_contratacao: string | null
  cpf_agregado: string | null
  data_vencimento_cnh_agregado: string | null
  agregado_colaborador_nome?: string | null
  agregado_funcao?: string | null
  agregado_contrato?: string | null
  agregado_centro_custo?: string | null
  agregado_ano_modelo?: string | null
  agregado_data_inicial?: string | null
  agregado_dias?: number | null
  agregado_observacao?: string | null
  colaborador_id: string | null
  imagens: unknown[] | null
  checklists: unknown[] | null
  created_at: string
  updated_at: string
}

const mapVehicleRow = (row: VehicleRow): Vehicle => {
  return {
    id: row.id,
    placa: row.placa,
    chassi: row.chassi,
    renavan: row.renavan || null,
    modelo: row.modelo,
    km: Number(row.km ?? 0),
    kmUltimaRevisao: row.km_ultima_revisao ?? null,
    mensalidade: Number(row.mensalidade ?? 0),
    dataVencimentoContrato: row.data_vencimento_contrato || "",
    tipoPropriedade: row.tipo_propriedade || "proprio",
    empresaLocacao: row.empresa_locacao || null,
    fornecedorProprio: row.fornecedor_proprio || null,
    cartaoCombustivel: row.cartao_combustivel || "veloe",
    numeroCartaoCombustivel: row.numero_cartao_combustivel || null,
    placaCartaoCombustivel: row.placa_cartao_combustivel || null,
    frota: row.frota ?? true,
    naOficina: row.na_oficina ?? false,
    paraRevisao: row.para_revisao ?? false,
    semParar: row.sem_parar ?? false,
    tipoContratacao: row.tipo_contratacao || null,
    cpfAgregado: row.cpf_agregado || null,
    dataVencimentoCNHAgregado: row.data_vencimento_cnh_agregado || null,
    agregadoColaboradorNome: row.agregado_colaborador_nome || null,
    agregadoFuncao: row.agregado_funcao || null,
    agregadoContrato: row.agregado_contrato || null,
    agregadoCentroCusto: row.agregado_centro_custo || null,
    agregadoAnoModelo: row.agregado_ano_modelo || null,
    agregadoDataInicial: row.agregado_data_inicial || null,
    agregadoDias: row.agregado_dias ?? null,
    agregadoObservacao: row.agregado_observacao || null,
    colaboradorId: row.colaborador_id || null,
    imagens: Array.isArray(row.imagens) ? (row.imagens as Vehicle["imagens"]) : [],
    checklists: Array.isArray(row.checklists) ? (row.checklists as Vehicle["checklists"]) : [],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

type VehiclePayload = Omit<VehicleRow, "id" | "created_at" | "updated_at">

const hasMissingColumnError = (error: unknown): boolean => {
  if (!(error instanceof Error)) return false

  const message = error.message.toLowerCase()
  return message.includes("could not find the") || message.includes("column")
}

const toLegacyCompatibleVehicleRow = (formData: VehicleFormData) => {
  const payload = { ...toVehicleRow(formData, false) } as Partial<VehiclePayload>
  delete payload.km_ultima_revisao
  return payload
}

const getReviewKmFallbackMap = (): Record<string, number | null> => {
  if (typeof window === "undefined") return {}

  try {
    const raw = localStorage.getItem(REVIEW_KM_FALLBACK_STORAGE_KEY)
    return raw ? (JSON.parse(raw) as Record<string, number | null>) : {}
  } catch {
    return {}
  }
}

const setReviewKmFallbackValue = (vehicleId: string, kmUltimaRevisao: number | null) => {
  if (typeof window === "undefined") return

  const currentMap = getReviewKmFallbackMap()
  currentMap[vehicleId] = kmUltimaRevisao
  localStorage.setItem(REVIEW_KM_FALLBACK_STORAGE_KEY, JSON.stringify(currentMap))
}

const clearReviewKmFallbackValue = (vehicleId: string) => {
  if (typeof window === "undefined") return

  const currentMap = getReviewKmFallbackMap()
  if (!(vehicleId in currentMap)) return

  delete currentMap[vehicleId]
  localStorage.setItem(REVIEW_KM_FALLBACK_STORAGE_KEY, JSON.stringify(currentMap))
}

const mergeVehicleWithReviewKm = (vehicle: Vehicle, kmUltimaRevisao: number | null): Vehicle => {
  return {
    ...vehicle,
    kmUltimaRevisao,
  }
}

const toVehicleRow = (formData: VehicleFormData, includeExtendedAgregadoFields = true): VehiclePayload => {
  const dataVencimentoContrato = formData.dataVencimentoContrato?.trim()
    ? formData.dataVencimentoContrato
    : null
  const dataVencimentoCNHAgregado = formData.dataVencimentoCNHAgregado?.trim()
    ? formData.dataVencimentoCNHAgregado
    : null
  const cpfAgregado = formData.cpfAgregado?.trim() ? formData.cpfAgregado : null
  const renavan = formData.renavan?.trim() ? formData.renavan.trim() : null
  const numeroCartaoCombustivel = formData.numeroCartaoCombustivel?.trim()
    ? formData.numeroCartaoCombustivel.trim()
    : null
  const placaCartaoCombustivel = formData.placaCartaoCombustivel?.trim()
    ? formData.placaCartaoCombustivel.trim().toUpperCase()
    : null
  const agregadoColaboradorNome = formData.agregadoColaboradorNome?.trim() ? formData.agregadoColaboradorNome : null
  const agregadoFuncao = formData.agregadoFuncao?.trim() ? formData.agregadoFuncao : null
  const agregadoContrato = formData.agregadoContrato?.trim() ? formData.agregadoContrato : null
  const agregadoCentroCusto = formData.agregadoCentroCusto?.trim() ? formData.agregadoCentroCusto : null
  const agregadoAnoModelo = formData.agregadoAnoModelo?.trim() ? formData.agregadoAnoModelo : null
  const agregadoDataInicial = formData.agregadoDataInicial?.trim() ? formData.agregadoDataInicial : null
  const agregadoDias = typeof formData.agregadoDias === "number" && formData.agregadoDias > 0 ? formData.agregadoDias : null
  const agregadoObservacao = formData.agregadoObservacao?.trim() ? formData.agregadoObservacao.trim() : null

  const basePayload: VehiclePayload = {
    placa: formData.placa,
    chassi: formData.chassi,
    renavan,
    modelo: formData.modelo,
    km: formData.km,
    km_ultima_revisao: typeof formData.kmUltimaRevisao === "number" ? formData.kmUltimaRevisao : null,
    mensalidade: formData.mensalidade,
    data_vencimento_contrato: dataVencimentoContrato,
    tipo_propriedade: formData.tipoPropriedade,
    empresa_locacao: formData.empresaLocacao ?? null,
    fornecedor_proprio: formData.fornecedorProprio ?? null,
    cartao_combustivel: formData.cartaoCombustivel,
    numero_cartao_combustivel: numeroCartaoCombustivel,
    placa_cartao_combustivel: placaCartaoCombustivel,
    frota: formData.frota,
    na_oficina: formData.naOficina,
    para_revisao: formData.paraRevisao,
    sem_parar: formData.semParar,
    tipo_contratacao: formData.tipoContratacao ?? null,
    cpf_agregado: cpfAgregado,
    data_vencimento_cnh_agregado: dataVencimentoCNHAgregado,
    agregado_colaborador_nome: includeExtendedAgregadoFields ? agregadoColaboradorNome : undefined,
    agregado_funcao: includeExtendedAgregadoFields ? agregadoFuncao : undefined,
    agregado_contrato: includeExtendedAgregadoFields ? agregadoContrato : undefined,
    agregado_centro_custo: includeExtendedAgregadoFields ? agregadoCentroCusto : undefined,
    agregado_ano_modelo: includeExtendedAgregadoFields ? agregadoAnoModelo : undefined,
    agregado_data_inicial: includeExtendedAgregadoFields ? agregadoDataInicial : undefined,
    agregado_dias: includeExtendedAgregadoFields ? agregadoDias : undefined,
    agregado_observacao: includeExtendedAgregadoFields ? agregadoObservacao : undefined,
    colaborador_id: formData.colaboradorId ?? null,
    imagens: formData.imagens ?? [],
    checklists: formData.checklists ?? [],
  }

  if (includeExtendedAgregadoFields) {
    return basePayload
  }

  return {
    ...basePayload,
    // Backward-compatible fallback for databases without the new agregado columns.
    empresa_locacao: agregadoCentroCusto ?? formData.empresaLocacao ?? null,
    tipo_contratacao: agregadoFuncao ?? formData.tipoContratacao ?? null,
    cpf_agregado: agregadoColaboradorNome ?? cpfAgregado,
    data_vencimento_cnh_agregado: agregadoDataInicial ?? dataVencimentoCNHAgregado,
    chassi: agregadoAnoModelo ?? formData.chassi,
    km: agregadoDias ?? formData.km,
    km_ultima_revisao: typeof formData.kmUltimaRevisao === "number" ? formData.kmUltimaRevisao : null,
  }
}

const toVehicleRowWithMeta = (vehicle: Vehicle): VehicleRow => {
  return {
    id: vehicle.id,
    ...toVehicleRow(vehicle),
    created_at: vehicle.createdAt,
    updated_at: vehicle.updatedAt,
  }
}

const getLegacyVehiclesFromStorage = (): Vehicle[] => {
  if (typeof window === "undefined") return []
  const data = localStorage.getItem(LEGACY_STORAGE_KEY)
  return data ? JSON.parse(data) : []
}

const fetcher = async (): Promise<Vehicle[]> => {
  const supabase = createClient()
  const { data, error } = await supabase.from(TABLE).select("*").order("created_at", { ascending: false })
  if (error) {
    throw new Error(error.message)
  }

  const reviewKmFallbackMap = getReviewKmFallbackMap()

  return (data || []).map((row) => {
    const vehicle = mapVehicleRow(row as VehicleRow)
    const fallbackKm = reviewKmFallbackMap[vehicle.id]

    if (vehicle.kmUltimaRevisao == null && typeof fallbackKm !== "undefined") {
      return mergeVehicleWithReviewKm(vehicle, fallbackKm)
    }

    return vehicle
  })
}

export function useVehicles(enabled = true) {
  const { data, error, isLoading } = useSWR<Vehicle[]>(enabled ? SWR_KEY : null, fetcher, SWR_OPTIONS)
  const vehicles = data ?? []

  useEffect(() => {
    if (!enabled) return
    if (typeof window === "undefined") return
    if (isLoading) return
    if (localStorage.getItem(MIGRATION_KEY) === "1") return

    const legacy = getLegacyVehiclesFromStorage()
    if (legacy.length === 0 || vehicles.length > 0) {
      localStorage.setItem(MIGRATION_KEY, "1")
      return
    }

    const migrate = async () => {
      const supabase = createClient()
      const rows = legacy.map((vehicle) => toVehicleRowWithMeta(vehicle))
      const { error: upsertError } = await supabase
        .from(TABLE)
        .upsert(rows, { onConflict: "id" })

      if (!upsertError) {
        localStorage.setItem(MIGRATION_KEY, "1")
        mutate(SWR_KEY)
      }
    }

    migrate()
  }, [enabled, isLoading, vehicles.length])

  const addVehicle = async (formData: VehicleFormData): Promise<Vehicle> => {
    const supabase = createClient()
    const payload = toVehicleRow(formData)

    let inserted: VehicleRow | null = null
    let insertError: Error | null = null
    let usedReviewKmFallback = false

    const primaryResult = await supabase
      .from(TABLE)
      .insert(payload)
      .select("*")
      .single()

    if (primaryResult.error) {
      if (hasMissingColumnError(new Error(primaryResult.error.message))) {
        usedReviewKmFallback = true
        const fallbackResult = await supabase
          .from(TABLE)
          .insert(toLegacyCompatibleVehicleRow(formData))
          .select("*")
          .single()

        inserted = (fallbackResult.data as VehicleRow | null) ?? null
        insertError = fallbackResult.error ? new Error(fallbackResult.error.message) : null
      } else {
        insertError = new Error(primaryResult.error.message)
      }
    } else {
      inserted = (primaryResult.data as VehicleRow | null) ?? null
    }

    if (insertError || !inserted) {
      throw new Error(insertError?.message || "Falha ao salvar veiculo.")
    }

    const vehicle = mapVehicleRow(inserted as VehicleRow)
    if (usedReviewKmFallback) {
      setReviewKmFallbackValue(vehicle.id, formData.kmUltimaRevisao ?? null)
    } else {
      clearReviewKmFallbackValue(vehicle.id)
    }
    mutate(SWR_KEY)
    return usedReviewKmFallback
      ? mergeVehicleWithReviewKm(vehicle, formData.kmUltimaRevisao ?? null)
      : vehicle
  }

  const updateVehicle = async (id: string, formData: VehicleFormData): Promise<Vehicle | null> => {
    const supabase = createClient()
    const payload = {
      ...toVehicleRow(formData),
      updated_at: new Date().toISOString(),
    }

    let updated: VehicleRow | null = null
    let updateError: Error | null = null
    let usedReviewKmFallback = false

    const primaryResult = await supabase
      .from(TABLE)
      .update(payload)
      .eq("id", id)
      .select("*")
      .single()

    if (primaryResult.error) {
      if (hasMissingColumnError(new Error(primaryResult.error.message))) {
        usedReviewKmFallback = true
        const fallbackResult = await supabase
          .from(TABLE)
          .update({
            ...toLegacyCompatibleVehicleRow(formData),
            updated_at: new Date().toISOString(),
          })
          .eq("id", id)
          .select("*")
          .single()

        updated = (fallbackResult.data as VehicleRow | null) ?? null
        updateError = fallbackResult.error ? new Error(fallbackResult.error.message) : null
      } else {
        updateError = new Error(primaryResult.error.message)
      }
    } else {
      updated = (primaryResult.data as VehicleRow | null) ?? null
    }

    if (updateError || !updated) {
      throw new Error(updateError?.message || "Falha ao atualizar veiculo.")
    }

    const vehicle = mapVehicleRow(updated as VehicleRow)
    if (usedReviewKmFallback) {
      setReviewKmFallbackValue(vehicle.id, formData.kmUltimaRevisao ?? null)
    } else {
      clearReviewKmFallbackValue(vehicle.id)
    }
    mutate(SWR_KEY)
    return usedReviewKmFallback
      ? mergeVehicleWithReviewKm(vehicle, formData.kmUltimaRevisao ?? null)
      : vehicle
  }

  const deleteVehicle = async (id: string): Promise<boolean> => {
    const supabase = createClient()
    const { error: deleteError } = await supabase.from(TABLE).delete().eq("id", id)
    if (deleteError) {
      throw new Error(deleteError.message)
    }
    mutate(SWR_KEY)
    return true
  }

  const getVehicleById = (id: string): Vehicle | undefined => {
    return vehicles.find((v) => v.id === id)
  }

  const refreshVehicles = async (): Promise<void> => {
    await mutate(SWR_KEY)
  }

  return {
    vehicles,
    isLoading,
    error,
    addVehicle,
    updateVehicle,
    deleteVehicle,
    getVehicleById,
    refreshVehicles,
  }
}
