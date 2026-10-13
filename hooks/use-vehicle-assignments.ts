"use client"

import useSWR, { mutate as globalMutate } from "swr"
import { createClient } from "@/lib/supabase/client"

const TABLE = "fleet_vehicle_assignments"

export const VEHICLE_ASSIGNMENTS_MISSING_TABLE_HINT =
  "O histórico de condutores ainda não foi ativado. Execute o script scripts/026_create_fleet_vehicle_assignments.sql no Supabase (SQL Editor)."

export type VehicleAssignmentOrigem = "sistema" | "carga_inicial" | "manual"

export type VehicleAssignment = {
  id: string
  vehicleId: string
  colaboradorId: string | null
  colaboradorNome: string
  colaboradorCentroCusto: string | null
  dataEntrega: string
  dataRecolhimento: string | null
  kmEntrega: number | null
  kmRecolhimento: number | null
  origem: VehicleAssignmentOrigem
  observacao: string | null
}

type VehicleAssignmentRow = {
  id: string
  vehicle_id: string
  colaborador_id: string | null
  colaborador_nome: string
  colaborador_centro_custo: string | null
  data_entrega: string
  data_recolhimento: string | null
  km_entrega: number | null
  km_recolhimento: number | null
  origem: string | null
  observacao: string | null
}

export type VehicleAssignmentInput = {
  colaboradorId: string | null
  colaboradorNome: string
  colaboradorCentroCusto: string | null
  dataEntrega: string
  dataRecolhimento: string | null
  observacao: string | null
}

function mapRow(row: VehicleAssignmentRow): VehicleAssignment {
  const origem = row.origem === "carga_inicial" || row.origem === "manual" ? row.origem : "sistema"
  return {
    id: row.id,
    vehicleId: row.vehicle_id,
    colaboradorId: row.colaborador_id,
    colaboradorNome: row.colaborador_nome,
    colaboradorCentroCusto: row.colaborador_centro_custo,
    dataEntrega: row.data_entrega,
    dataRecolhimento: row.data_recolhimento,
    kmEntrega: row.km_entrega,
    kmRecolhimento: row.km_recolhimento,
    origem,
    observacao: row.observacao,
  }
}

function toFriendlyError(message: string): Error {
  if (message.includes(TABLE) || message.toLowerCase().includes("does not exist")) {
    return new Error(VEHICLE_ASSIGNMENTS_MISSING_TABLE_HINT)
  }
  if (message.includes("fleet_vehicle_assignments_open_idx")) {
    return new Error("Este veículo já tem um condutor em aberto. Informe a data de recolhimento do condutor anterior.")
  }
  if (message.includes("fleet_vehicle_assignments_periodo_chk")) {
    return new Error("A data de recolhimento não pode ser anterior à data de entrega.")
  }
  return new Error(message)
}

function getKey(vehicleId: string | null) {
  return vehicleId ? ["fleet-vehicle-assignments", vehicleId] : null
}

async function fetchAssignments([, vehicleId]: [string, string]): Promise<VehicleAssignment[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from(TABLE)
    .select("*")
    .eq("vehicle_id", vehicleId)
    .order("data_entrega", { ascending: false })
    .limit(50)

  if (error) throw toFriendlyError(error.message)
  return (data || []).map((row) => mapRow(row as VehicleAssignmentRow))
}

export function useVehicleAssignments(vehicleId: string | null) {
  const key = getKey(vehicleId)
  const { data, error, isLoading } = useSWR(key, fetchAssignments, {
    revalidateOnFocus: false,
    revalidateOnReconnect: false,
  })

  const refresh = () => (key ? globalMutate(key) : Promise.resolve())

  async function addAssignment(input: VehicleAssignmentInput) {
    if (!vehicleId) return
    const supabase = createClient()
    const { error: insertError } = await supabase.from(TABLE).insert({
      vehicle_id: vehicleId,
      colaborador_id: input.colaboradorId,
      colaborador_nome: input.colaboradorNome.trim(),
      colaborador_centro_custo: input.colaboradorCentroCusto,
      data_entrega: input.dataEntrega,
      data_recolhimento: input.dataRecolhimento,
      observacao: input.observacao,
      origem: "manual",
    })
    if (insertError) throw toFriendlyError(insertError.message)
    await refresh()
  }

  async function updateAssignmentDates(id: string, dates: { dataEntrega: string; dataRecolhimento: string | null }) {
    const supabase = createClient()
    const current = data?.find((item) => item.id === id)
    const { error: updateError } = await supabase
      .from(TABLE)
      .update({
        data_entrega: dates.dataEntrega,
        data_recolhimento: dates.dataRecolhimento,
        // Data conferida pela frota deixa de ser "aproximada".
        ...(current?.origem === "carga_inicial" ? { origem: "sistema" } : {}),
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
    if (updateError) throw toFriendlyError(updateError.message)
    await refresh()
  }

  async function deleteAssignment(id: string) {
    const supabase = createClient()
    const { error: deleteError } = await supabase.from(TABLE).delete().eq("id", id)
    if (deleteError) throw toFriendlyError(deleteError.message)
    await refresh()
  }

  return {
    assignments: data ?? [],
    isLoading,
    error: error as Error | undefined,
    addAssignment,
    updateAssignmentDates,
    deleteAssignment,
  }
}
