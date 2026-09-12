"use client"

import useSWR, { mutate } from "swr"
import { createClient } from "@/lib/supabase/client"
import { FORNECEDOR_REGIAO_LABELS } from "@/lib/fornecedores"
import type { Fornecedor, FornecedorFormData, FornecedorRegiao } from "@/lib/types"

const TABLE = "fleet_fornecedores"
const SWR_KEY = "fleet-fornecedores"
const SWR_OPTIONS = {
  revalidateOnFocus: false,
  revalidateOnReconnect: false,
  dedupingInterval: 30_000,
  keepPreviousData: true,
} as const

type FornecedorRow = {
  id: string
  razao_social: string
  cnpj: string | null
  telefone: string | null
  email: string | null
  responsavel: string | null
  regiao: string | null
  uf: string | null
  chave_pix: string | null
  banco: string | null
  agencia: string | null
  conta: string | null
  observacoes: string | null
  ativo: boolean | null
  created_at: string
  updated_at: string
}

const normalizeRegiao = (value: string | null): FornecedorRegiao | null =>
  value && value in FORNECEDOR_REGIAO_LABELS ? (value as FornecedorRegiao) : null

const mapFornecedorRow = (row: FornecedorRow): Fornecedor => ({
  id: row.id,
  razaoSocial: row.razao_social,
  cnpj: row.cnpj || "",
  telefone: row.telefone || "",
  email: row.email || "",
  responsavel: row.responsavel || "",
  regiao: normalizeRegiao(row.regiao),
  uf: row.uf || "",
  chavePix: row.chave_pix || "",
  banco: row.banco || "",
  agencia: row.agencia || "",
  conta: row.conta || "",
  observacoes: row.observacoes || "",
  ativo: row.ativo ?? true,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
})

const toFornecedorRow = (formData: FornecedorFormData) => ({
  razao_social: formData.razaoSocial.trim(),
  cnpj: formData.cnpj.trim() || null,
  telefone: formData.telefone.trim() || null,
  email: formData.email.trim() || null,
  responsavel: formData.responsavel.trim() || null,
  regiao: formData.regiao,
  uf: formData.uf.trim().toUpperCase() || null,
  chave_pix: formData.chavePix.trim() || null,
  banco: formData.banco.trim() || null,
  agencia: formData.agencia.trim() || null,
  conta: formData.conta.trim() || null,
  observacoes: formData.observacoes.trim() || null,
  ativo: formData.ativo,
})

const fetcher = async (): Promise<Fornecedor[]> => {
  const supabase = createClient()
  const { data, error } = await supabase.from(TABLE).select("*").order("razao_social", { ascending: true })

  if (error) {
    throw new Error(error.message)
  }

  return (data || []).map((row) => mapFornecedorRow(row as FornecedorRow))
}

export function refreshFornecedores() {
  return mutate(SWR_KEY)
}

export function useFornecedores(enabled = true) {
  const { data, error, isLoading } = useSWR<Fornecedor[]>(enabled ? SWR_KEY : null, fetcher, SWR_OPTIONS)

  const addFornecedor = async (formData: FornecedorFormData): Promise<Fornecedor> => {
    const supabase = createClient()
    const { data: inserted, error: insertError } = await supabase
      .from(TABLE)
      .insert(toFornecedorRow(formData))
      .select("*")
      .single()

    if (insertError || !inserted) {
      throw new Error(insertError?.message || "Falha ao salvar fornecedor.")
    }

    await mutate(SWR_KEY)
    return mapFornecedorRow(inserted as FornecedorRow)
  }

  const updateFornecedor = async (id: string, formData: FornecedorFormData): Promise<Fornecedor> => {
    const supabase = createClient()
    const { data: updated, error: updateError } = await supabase
      .from(TABLE)
      .update({ ...toFornecedorRow(formData), updated_at: new Date().toISOString() })
      .eq("id", id)
      .select("*")
      .single()

    if (updateError || !updated) {
      throw new Error(updateError?.message || "Falha ao atualizar fornecedor.")
    }

    await mutate(SWR_KEY)
    return mapFornecedorRow(updated as FornecedorRow)
  }

  const deleteFornecedor = async (id: string): Promise<void> => {
    const supabase = createClient()
    const { error: deleteError } = await supabase.from(TABLE).delete().eq("id", id)

    if (deleteError) {
      throw new Error(deleteError.message)
    }

    await mutate(SWR_KEY)
  }

  return {
    fornecedores: data ?? [],
    isLoading,
    error: error instanceof Error ? error.message : null,
    addFornecedor,
    updateFornecedor,
    deleteFornecedor,
    refreshFornecedores,
  }
}
