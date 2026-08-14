"use client"

import useSWR from "swr"
import type { FuelDailyBudgetItem } from "@/lib/fuel-daily-budget-shared"

export type FuelDailyBudgetResponse = {
  items: FuelDailyBudgetItem[]
  updatedAt: string | null
  warning?: string
}

const EMPTY_ITEMS: FuelDailyBudgetItem[] = []

export const FUEL_DAILY_BUDGET_SWR_KEY = "/api/fuel/daily-budget"

async function fuelDailyBudgetFetcher(url: string): Promise<FuelDailyBudgetResponse> {
  const res = await fetch(url, { cache: "no-store" })
  const data = await res.json().catch(() => ({ items: [] }))

  if (!res.ok) {
    throw new Error(data?.error || "Falha ao carregar orçamento diário de combustível.")
  }

  return data
}

export function useFuelDailyBudgets() {
  const { data, error, isLoading, mutate } = useSWR(FUEL_DAILY_BUDGET_SWR_KEY, fuelDailyBudgetFetcher, {
    revalidateOnFocus: false,
    revalidateOnReconnect: false,
    dedupingInterval: 30_000,
    keepPreviousData: true,
  })

  return {
    items: data?.items ?? EMPTY_ITEMS,
    updatedAt: data?.updatedAt ?? null,
    warning: data?.warning,
    isLoading,
    error,
    mutate,
  }
}
