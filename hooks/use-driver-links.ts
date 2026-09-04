"use client"

import useSWR, { mutate } from "swr"
import { createClient } from "@/lib/supabase/client"
import { normalizeCpf, normalizeDriverKey, type DriverLink } from "@/lib/driver-links-shared"

const TABLE = "fleet_driver_links"
const SWR_KEY = "fleet-driver-links"
const SWR_OPTIONS = {
  revalidateOnFocus: false,
  revalidateOnReconnect: false,
  dedupingInterval: 30_000,
  keepPreviousData: true,
} as const

type DriverLinkRow = {
  id: string
  origem: string | null
  nome_origem: string
  nome_normalizado: string
  cpf_origem: string | null
  colaborador_id: string | null
  ignorado: boolean | null
}

const MISSING_TABLE_HINT =
  "Execute o script scripts/021_create_fleet_driver_links.sql no Supabase para habilitar o Ajuste Geral."

function mapRow(row: DriverLinkRow): DriverLink {
  return {
    id: row.id,
    origem: "veloe",
    nomeOrigem: row.nome_origem,
    nomeNormalizado: row.nome_normalizado,
    cpfOrigem: row.cpf_origem || "",
    colaboradorId: row.colaborador_id,
    ignorado: row.ignorado === true,
  }
}

const fetcher = async (): Promise<DriverLink[]> => {
  const supabase = createClient()
  const { data, error } = await supabase.from(TABLE).select("*")

  if (error) {
    throw new Error(error.message.includes(TABLE) ? MISSING_TABLE_HINT : error.message)
  }

  return (data || []).map((row) => mapRow(row as DriverLinkRow))
}

export function useDriverLinks(enabled = true) {
  const { data, error, isLoading } = useSWR<DriverLink[]>(enabled ? SWR_KEY : null, fetcher, SWR_OPTIONS)

  const upsertLink = async (input: {
    nomeOrigem: string
    cpfOrigem?: string
    colaboradorId: string | null
    ignorado?: boolean
  }): Promise<void> => {
    const supabase = createClient()
    const payload = {
      origem: "veloe",
      nome_origem: input.nomeOrigem.trim(),
      nome_normalizado: normalizeDriverKey(input.nomeOrigem),
      cpf_origem: normalizeCpf(input.cpfOrigem ?? "") || null,
      colaborador_id: input.colaboradorId,
      ignorado: input.ignorado === true,
      updated_at: new Date().toISOString(),
    }

    const { error: upsertError } = await supabase
      .from(TABLE)
      .upsert(payload, { onConflict: "origem,nome_normalizado" })

    if (upsertError) {
      throw new Error(upsertError.message.includes(TABLE) ? MISSING_TABLE_HINT : upsertError.message)
    }

    await mutate(SWR_KEY)
  }

  const removeLink = async (id: string): Promise<void> => {
    const supabase = createClient()
    const { error: deleteError } = await supabase.from(TABLE).delete().eq("id", id)

    if (deleteError) {
      throw new Error(deleteError.message)
    }

    await mutate(SWR_KEY)
  }

  return {
    links: data ?? [],
    isLoading,
    error: error as Error | undefined,
    upsertLink,
    removeLink,
  }
}
