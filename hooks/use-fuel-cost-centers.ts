"use client"

import { useMemo } from "react"
import useSWR from "swr"
import { createCostCenterLookup, type CostCenterLookup, type CostCenterRecord } from "@/lib/cost-center-shared"

export type CostCenterResponse = {
  records: CostCenterRecord[]
  updatedAt: string | null
  warning?: string
}

const EMPTY_RECORDS: CostCenterRecord[] = []

export const FUEL_COST_CENTER_SWR_KEY = "/api/fuel/cost-center"

async function costCenterFetcher(url: string): Promise<CostCenterResponse> {
  const res = await fetch(url, { cache: "no-store" })
  const data = await res.json().catch(() => ({ records: [] }))

  if (!res.ok) {
    throw new Error(data?.error || "Falha ao carregar centro de custo.")
  }

  return data
}

export function useFuelCostCenters() {
  const { data, error, isLoading, mutate } = useSWR(FUEL_COST_CENTER_SWR_KEY, costCenterFetcher, {
    revalidateOnFocus: false,
    revalidateOnReconnect: false,
    dedupingInterval: 30_000,
    keepPreviousData: true,
  })

  const records = data?.records ?? EMPTY_RECORDS
  const lookup = useMemo<CostCenterLookup>(() => createCostCenterLookup(records), [records])

  return {
    records,
    lookup,
    updatedAt: data?.updatedAt ?? null,
    warning: data?.warning,
    isLoading,
    error,
    mutate,
  }
}