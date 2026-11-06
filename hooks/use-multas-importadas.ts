"use client"

import { useCallback } from "react"
import useSWR from "swr"
import {
  normalizeMultasImportStore,
  type MultaCamposEditaveis,
  type MultaFonte,
  type MultasImportStore,
} from "@/lib/multas-import-shared"

export const MULTAS_IMPORT_SWR_KEY = "/api/multas/import"
const MULTAS_REGISTROS_URL = "/api/multas/registros"

/** Baixa o termo de desconto em PDF. Retorna os dados que ficaram em branco no termo (ex.: CPF não cadastrado). */
export async function baixarTermoDesconto(id: string): Promise<string[]> {
  const response = await fetch(`/api/multas/termo?id=${encodeURIComponent(id)}`, { cache: "no-store" })
  if (!response.ok) {
    const payload = await response.json().catch(() => null)
    throw new Error(payload?.error || "Não foi possível gerar o termo de desconto.")
  }

  const disposition = response.headers.get("Content-Disposition") ?? ""
  const encodedName = disposition.match(/filename\*=UTF-8''([^;]+)/)?.[1]
  const fileName = encodedName ? decodeURIComponent(encodedName) : "termo-desconto.pdf"

  const url = URL.createObjectURL(await response.blob())
  const link = document.createElement("a")
  link.href = url
  link.download = fileName
  document.body.appendChild(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 10_000)

  const pendencias = decodeURIComponent(response.headers.get("X-Termo-Pendencias") ?? "")
  return pendencias ? pendencias.split(", ") : []
}

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

  const callRegistros = useCallback(
    async (method: "POST" | "PUT" | "DELETE", body?: unknown, query = ""): Promise<{ driveError: string | null; recordId: string | null }> => {
      const response = await fetch(`${MULTAS_REGISTROS_URL}${query}`, {
        method,
        headers: body ? { "Content-Type": "application/json" } : undefined,
        body: body ? JSON.stringify(body) : undefined,
      })
      const payload = await response.json().catch(() => null)
      if (!response.ok) {
        throw new Error(payload?.error || "Não foi possível salvar a multa.")
      }

      await mutate({ store: normalizeMultasImportStore(payload.store) }, { revalidate: false })
      return { driveError: payload?.driveError ?? null, recordId: payload?.recordId ?? null }
    },
    [mutate],
  )

  /** Cadastra (sem `id`) ou edita (com `id`) uma multa. */
  const saveMulta = useCallback(
    (fonte: MultaFonte, campos: MultaCamposEditaveis, id?: string) =>
      id ? callRegistros("PUT", { id, campos }) : callRegistros("POST", { fonte, campos }),
    [callRegistros],
  )

  const restaurarMulta = useCallback((id: string) => callRegistros("PUT", { id, restaurar: true }), [callRegistros])

  /** Altera só alguns campos da multa (ex.: local da infração antes de gerar o termo). */
  const patchMulta = useCallback(
    (id: string, patch: Partial<MultaCamposEditaveis>) => callRegistros("PUT", { id, patch }),
    [callRegistros],
  )

  const deleteMulta = useCallback(
    (id: string) => callRegistros("DELETE", undefined, `?id=${encodeURIComponent(id)}`),
    [callRegistros],
  )

  return {
    store: data?.store ?? null,
    warning: data?.warning,
    error: error instanceof Error ? error.message : null,
    isLoading,
    importFile,
    removeImport,
    saveMulta,
    restaurarMulta,
    patchMulta,
    deleteMulta,
  }
}
