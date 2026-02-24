"use client"

import { useEffect } from "react"
import useSWR, { mutate } from "swr"
import { createClient } from "@/lib/supabase/client"
import type { Colaborador, ColaboradorFormData } from "@/lib/types"

const TABLE = "fleet_colaboradores"
const SWR_KEY = "fleet-colaboradores"
const LEGACY_STORAGE_KEY = "fleet-colaboradores"
const MIGRATION_KEY = "fleet-colaboradores-migrated"

type ColaboradorRow = {
  id: string
  nome: string
  cpf: string
  telefone: string
  departamento: string
  data_vencimento_cnh: string | null
  documentos: unknown[] | null
  checklist: Record<string, unknown> | null
  created_at: string
  updated_at: string
}

const mapColaboradorRow = (row: ColaboradorRow): Colaborador => {
  return {
    id: row.id,
    nome: row.nome,
    cpf: row.cpf,
    telefone: row.telefone,
    departamento: row.departamento,
    dataVencimentoCNH: row.data_vencimento_cnh || "",
    documentos: Array.isArray(row.documentos) ? (row.documentos as Colaborador["documentos"]) : [],
    checklist: (row.checklist as Colaborador["checklist"]) || undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

const toColaboradorRow = (formData: ColaboradorFormData): Omit<ColaboradorRow, "id" | "created_at" | "updated_at"> => {
  return {
    nome: formData.nome,
    cpf: formData.cpf,
    telefone: formData.telefone,
    departamento: formData.departamento,
    data_vencimento_cnh: formData.dataVencimentoCNH,
    documentos: formData.documentos ?? [],
    checklist: formData.checklist ?? null,
  }
}

const toColaboradorRowWithMeta = (colaborador: Colaborador): ColaboradorRow => {
  return {
    id: colaborador.id,
    ...toColaboradorRow(colaborador),
    created_at: colaborador.createdAt,
    updated_at: colaborador.updatedAt,
  }
}

const getLegacyColaboradoresFromStorage = (): Colaborador[] => {
  if (typeof window === "undefined") return []
  const data = localStorage.getItem(LEGACY_STORAGE_KEY)
  return data ? JSON.parse(data) : []
}

const fetcher = async (): Promise<Colaborador[]> => {
  const supabase = createClient()
  const { data, error } = await supabase.from(TABLE).select("*").order("created_at", { ascending: false })
  if (error) {
    throw new Error(error.message)
  }
  return (data || []).map((row) => mapColaboradorRow(row as ColaboradorRow))
}

export function useColaboradores() {
  const { data, error, isLoading } = useSWR<Colaborador[]>(SWR_KEY, fetcher)
  const colaboradores = data ?? []

  useEffect(() => {
    if (typeof window === "undefined") return
    if (isLoading) return
    if (localStorage.getItem(MIGRATION_KEY) === "1") return

    const legacy = getLegacyColaboradoresFromStorage()
    if (legacy.length === 0 || colaboradores.length > 0) {
      localStorage.setItem(MIGRATION_KEY, "1")
      return
    }

    const migrate = async () => {
      const supabase = createClient()
      const rows = legacy.map((colaborador) => toColaboradorRowWithMeta(colaborador))
      const { error: upsertError } = await supabase
        .from(TABLE)
        .upsert(rows, { onConflict: "id" })

      if (!upsertError) {
        localStorage.setItem(MIGRATION_KEY, "1")
        mutate(SWR_KEY)
      }
    }

    migrate()
  }, [isLoading, colaboradores.length])

  const addColaborador = async (formData: ColaboradorFormData): Promise<Colaborador> => {
    const supabase = createClient()
    const payload = toColaboradorRow(formData)
    const { data: inserted, error: insertError } = await supabase
      .from(TABLE)
      .insert(payload)
      .select("*")
      .single()

    if (insertError || !inserted) {
      throw new Error(insertError?.message || "Falha ao salvar colaborador.")
    }

    const colaborador = mapColaboradorRow(inserted as ColaboradorRow)
    mutate(SWR_KEY)
    return colaborador
  }

  const updateColaborador = async (id: string, formData: ColaboradorFormData): Promise<Colaborador | null> => {
    const supabase = createClient()
    const payload = {
      ...toColaboradorRow(formData),
      updated_at: new Date().toISOString(),
    }
    const { data: updated, error: updateError } = await supabase
      .from(TABLE)
      .update(payload)
      .eq("id", id)
      .select("*")
      .single()

    if (updateError || !updated) {
      throw new Error(updateError?.message || "Falha ao atualizar colaborador.")
    }

    const colaborador = mapColaboradorRow(updated as ColaboradorRow)
    mutate(SWR_KEY)
    return colaborador
  }

  const deleteColaborador = async (id: string): Promise<boolean> => {
    const supabase = createClient()
    const { error: deleteError } = await supabase.from(TABLE).delete().eq("id", id)
    if (deleteError) {
      throw new Error(deleteError.message)
    }
    mutate(SWR_KEY)
    return true
  }

  const getColaboradorById = (id: string): Colaborador | undefined => {
    return colaboradores.find((c) => c.id === id)
  }

  return {
    colaboradores,
    isLoading,
    error,
    addColaborador,
    updateColaborador,
    deleteColaborador,
    getColaboradorById,
  }
}
