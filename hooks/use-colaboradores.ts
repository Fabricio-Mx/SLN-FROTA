"use client"

import { useEffect } from "react"
import useSWR, { mutate } from "swr"
import { createClient } from "@/lib/supabase/client"
import type { Colaborador, ColaboradorFormData } from "@/lib/types"

const TABLE = "fleet_colaboradores"
const SWR_KEY = "fleet-colaboradores"
const LEGACY_STORAGE_KEY = "fleet-colaboradores"
const MIGRATION_KEY = "fleet-colaboradores-migrated"
const SWR_OPTIONS = {
  revalidateOnFocus: false,
  revalidateOnReconnect: false,
  dedupingInterval: 30_000,
  keepPreviousData: true,
} as const

type ColaboradorRow = {
  id: string
  nome: string
  cpf: string
  telefone: string
  email: string | null
  departamento: string
  cep: string | null
  endereco: string | null
  data_vencimento_cnh: string | null
  documentos: unknown[] | null
  imagens_veiculo: unknown[] | null
  checklist: Record<string, unknown> | null
  created_at: string
  updated_at: string
}

const COLABORADOR_MIGRATION_COLUMNS = ["email", "cep", "endereco", "imagens_veiculo"]

const getColaboradorSchemaErrorMessage = (message?: string) => {
  if (!message) return null
  if (COLABORADOR_MIGRATION_COLUMNS.some((column) => message.includes(column))) {
    return "Execute a migracao mais recente de colaboradores no Supabase antes de salvar."
  }
  return null
}

const mapColaboradorRow = (row: ColaboradorRow): Colaborador => {
  return {
    id: row.id,
    nome: row.nome,
    cpf: row.cpf,
    telefone: row.telefone,
    email: row.email || "",
    departamento: row.departamento,
    cep: row.cep || "",
    endereco: row.endereco || "",
    dataVencimentoCNH: row.data_vencimento_cnh || "",
    documentos: Array.isArray(row.documentos) ? (row.documentos as Colaborador["documentos"]) : [],
    imagensVeiculo: Array.isArray(row.imagens_veiculo) ? (row.imagens_veiculo as Colaborador["imagensVeiculo"]) : [],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

const toColaboradorRow = (formData: ColaboradorFormData): Omit<ColaboradorRow, "id" | "created_at" | "updated_at"> => {
  return {
    nome: formData.nome,
    cpf: formData.cpf,
    telefone: formData.telefone,
    email: formData.email,
    departamento: formData.departamento,
    cep: formData.cep,
    endereco: formData.endereco,
    data_vencimento_cnh: formData.dataVencimentoCNH,
    documentos: formData.documentos ?? [],
    imagens_veiculo: formData.imagensVeiculo ?? [],
    checklist: null,
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
  const { data, error, isLoading } = useSWR<Colaborador[]>(SWR_KEY, fetcher, SWR_OPTIONS)
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
      throw new Error(getColaboradorSchemaErrorMessage(insertError?.message) || insertError?.message || "Falha ao salvar colaborador.")
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
      throw new Error(getColaboradorSchemaErrorMessage(updateError?.message) || updateError?.message || "Falha ao atualizar colaborador.")
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
