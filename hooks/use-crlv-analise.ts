"use client"

import { useCallback, useEffect, useSyncExternalStore } from "react"
import { refreshVehiclesCache } from "@/hooks/use-vehicles"
import { findCrlvFile } from "@/lib/crlv-validade"
import type { Vehicle } from "@/lib/types"
import { isVisibleInFrotaSection } from "@/lib/vehicle-classification"

const LOTE_ANALISE = 5

// Estado compartilhado entre o Painel Geral e Documentos para não analisar o mesmo PDF duas vezes.
let emAndamento = false
const arquivosTentados = new Set<string>()
const listeners = new Set<() => void>()

function setEmAndamento(value: boolean) {
  emAndamento = value
  listeners.forEach((listener) => listener())
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

/** Envia os veículos em lotes para a rota que lê o PDF e grava o exercício/UF do CRLV. Retorna a quantidade de falhas. */
export async function analisarCrlvs(vehicleIds: string[], force: boolean): Promise<number | null> {
  if (emAndamento || vehicleIds.length === 0) return null

  setEmAndamento(true)
  let falhas = 0

  try {
    for (let index = 0; index < vehicleIds.length; index += LOTE_ANALISE) {
      const res = await fetch("/api/documentos/crlv/analisar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ vehicleIds: vehicleIds.slice(index, index + LOTE_ANALISE), force }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.error || "Falha ao analisar os CRLVs.")

      falhas += ((data?.resultados ?? []) as { erro?: string }[]).filter((item) => item.erro).length
      await refreshVehiclesCache()
    }

    return falhas
  } finally {
    setEmAndamento(false)
  }
}

/** Analisa automaticamente os CRLVs da frota que ainda não foram lidos (uma tentativa por arquivo por sessão). */
export function useCrlvAnalise(vehicles: Vehicle[]) {
  const analisando = useSyncExternalStore(subscribe, () => emAndamento, () => false)

  useEffect(() => {
    if (emAndamento) return

    const pendentes = vehicles.filter((vehicle) => {
      if (!isVisibleInFrotaSection(vehicle)) return false
      const arquivo = findCrlvFile(vehicle)
      return Boolean(arquivo && !arquivo.crlvAnalise && !arquivosTentados.has(arquivo.id))
    })
    if (pendentes.length === 0) return

    pendentes.forEach((vehicle) => arquivosTentados.add(findCrlvFile(vehicle)!.id))
    analisarCrlvs(
      pendentes.map((vehicle) => vehicle.id),
      false
    ).catch((error) => console.warn("Falha na análise automática do CRLV:", error))
  }, [vehicles, analisando])

  const reanalisar = useCallback((vehicleIds: string[]) => analisarCrlvs(vehicleIds, true), [])

  return { analisando, reanalisar }
}
