"use client"

import { useEffect } from "react"
import useSWR, { mutate } from "swr"
import { createClient } from "@/lib/supabase/client"
import type { Vehicle, VehicleFormData } from "@/lib/types"

const TABLE = "fleet_vehicles"
const SWR_KEY = "fleet-vehicles"
const LEGACY_STORAGE_KEY = "fleet-vehicles"
const MIGRATION_KEY = "fleet-vehicles-migrated"

type VehicleRow = {
  id: string
  placa: string
  chassi: string
  modelo: string
  km: number | null
  mensalidade: number | string | null
  data_vencimento_contrato: string | null
  tipo_propriedade: "alugado" | "proprio" | null
  empresa_locacao: string | null
  cartao_combustivel: "veloe" | "ticket" | "ambos" | null
  frota: boolean | null
  na_oficina: boolean | null
  para_revisao: boolean | null
  sem_parar: boolean | null
  tipo_contratacao: "clt" | "pj" | null
  cpf_agregado: string | null
  data_vencimento_cnh_agregado: string | null
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
    modelo: row.modelo,
    km: Number(row.km ?? 0),
    mensalidade: Number(row.mensalidade ?? 0),
    dataVencimentoContrato: row.data_vencimento_contrato || "",
    tipoPropriedade: row.tipo_propriedade || "proprio",
    empresaLocacao: row.empresa_locacao || null,
    cartaoCombustivel: row.cartao_combustivel || "veloe",
    frota: row.frota ?? true,
    naOficina: row.na_oficina ?? false,
    paraRevisao: row.para_revisao ?? false,
    semParar: row.sem_parar ?? false,
    tipoContratacao: row.tipo_contratacao || null,
    cpfAgregado: row.cpf_agregado || null,
    dataVencimentoCNHAgregado: row.data_vencimento_cnh_agregado || null,
    colaboradorId: row.colaborador_id || null,
    imagens: Array.isArray(row.imagens) ? (row.imagens as Vehicle["imagens"]) : [],
    checklists: Array.isArray(row.checklists) ? (row.checklists as Vehicle["checklists"]) : [],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

const toVehicleRow = (formData: VehicleFormData): Omit<VehicleRow, "id" | "created_at" | "updated_at"> => {
  const dataVencimentoContrato = formData.dataVencimentoContrato?.trim()
    ? formData.dataVencimentoContrato
    : null
  const dataVencimentoCNHAgregado = formData.dataVencimentoCNHAgregado?.trim()
    ? formData.dataVencimentoCNHAgregado
    : null
  const cpfAgregado = formData.cpfAgregado?.trim() ? formData.cpfAgregado : null

  return {
    placa: formData.placa,
    chassi: formData.chassi,
    modelo: formData.modelo,
    km: formData.km,
    mensalidade: formData.mensalidade,
    data_vencimento_contrato: dataVencimentoContrato,
    tipo_propriedade: formData.tipoPropriedade,
    empresa_locacao: formData.empresaLocacao ?? null,
    cartao_combustivel: formData.cartaoCombustivel,
    frota: formData.frota,
    na_oficina: formData.naOficina,
    para_revisao: formData.paraRevisao,
    sem_parar: formData.semParar,
    tipo_contratacao: formData.tipoContratacao ?? null,
    cpf_agregado: cpfAgregado,
    data_vencimento_cnh_agregado: dataVencimentoCNHAgregado,
    colaborador_id: formData.colaboradorId ?? null,
    imagens: formData.imagens ?? [],
    checklists: formData.checklists ?? [],
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
  return (data || []).map((row) => mapVehicleRow(row as VehicleRow))
}

export function useVehicles() {
  const { data, error, isLoading } = useSWR<Vehicle[]>(SWR_KEY, fetcher)
  const vehicles = data ?? []

  useEffect(() => {
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
  }, [isLoading, vehicles.length])

  const addVehicle = async (formData: VehicleFormData): Promise<Vehicle> => {
    const supabase = createClient()
    const payload = toVehicleRow(formData)
    const { data: inserted, error: insertError } = await supabase
      .from(TABLE)
      .insert(payload)
      .select("*")
      .single()

    if (insertError || !inserted) {
      throw new Error(insertError?.message || "Falha ao salvar veiculo.")
    }

    const vehicle = mapVehicleRow(inserted as VehicleRow)
    mutate(SWR_KEY)
    return vehicle
  }

  const updateVehicle = async (id: string, formData: VehicleFormData): Promise<Vehicle | null> => {
    const supabase = createClient()
    const payload = {
      ...toVehicleRow(formData),
      updated_at: new Date().toISOString(),
    }
    const { data: updated, error: updateError } = await supabase
      .from(TABLE)
      .update(payload)
      .eq("id", id)
      .select("*")
      .single()

    if (updateError || !updated) {
      throw new Error(updateError?.message || "Falha ao atualizar veiculo.")
    }

    const vehicle = mapVehicleRow(updated as VehicleRow)
    mutate(SWR_KEY)
    return vehicle
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

  return {
    vehicles,
    isLoading,
    error,
    addVehicle,
    updateVehicle,
    deleteVehicle,
    getVehicleById,
  }
}
