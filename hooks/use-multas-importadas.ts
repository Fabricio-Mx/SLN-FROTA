"use client"

import { useCallback } from "react"
import useSWR from "swr"
import { normalizeMultasImportStore, type MultaFonte, type MultasImportStore } from "@/lib/multas-import-shared"

export const MULTAS_IMPORT_SWR_KEY = "/api/multas/import"

type MultasImportResponse = {
  store: MultasImportStore
  warning?: string
}

export type MultasImportSummary = {
  fonte: MultaFonte
  imported: number
  previousCount: number
  warnings: string[]
}

async function fetcher(url: string): Promise<MultasImportResponse> {
  const response = await fetch(url, { cache: "no-store" })
  const data = await response.json().catch(() => null)
  if (!response.ok) {
    throw new Error(data?.error || "Falha ao carregar as multas importadas.")
  }
  return { store: normalizeMultasImportStore(data?.store), warning: data?.warning }
}

export function useMultasImportadas(enabled = true) {
  const { data, error, isLoading, mutate } = useSWR<MultasImportResponse>(enabled ? MULTAS_IMPORT_SWR_KEY : null, fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 30_000,
  })

  const importFile = useCallback(
    async (fonte: MultaFonte, file: File): Promise<{ summary: MultasImportSummary; driveError: string | null }> => {
      const formData = new FormData()
      formData.append("file", file)
      formData.append("fonte", fonte)

      const response = await fetch(MULTAS_IMPORT_SWR_KEY, { method: "POST", body: formData })
      const payload = await response.json().catch(() => null)
      if (!response.ok) {
        throw new Error(payload?.error || "Não foi possível importar a planilha.")
      }

      await mutate({ store: normalizeMultasImportStore(payload.store) }, { revalidate: false })
      return { summary: payload.summary as MultasImportSummary, driveError: payload.driveError ?? null }
    },
    [mutate],
  )

  const removeImport = useCallback(
    async (fonte: MultaFonte) => {
      const response = await fetch(`${MULTAS_IMPORT_SWR_KEY}?fonte=${fonte}`, { method: "DELETE" })
      const payload = await response.json().catch(() => null)
      if (!response.ok) {
        throw new Error(payload?.error || "Não foi possível remover a importação.")
      }

      await mutate({ store: normalizeMultasImportStore(payload.store) }, { revalidate: false })
    },
    [mutate],
  )

  return {
    store: data?.store ?? null,
    warning: data?.warning,
    error: error instanceof Error ? error.message : null,
    isLoading,
    importFile,
    removeImport,
  }
}
