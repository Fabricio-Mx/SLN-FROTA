"use client"

import { useMemo } from "react"
import useSWR from "swr"
import { normalizeFuelBudgetPlan, type FuelBudgetPlan } from "@/lib/fuel-budget-plan-shared"

export type FuelBudgetPlanResponse = {
  plan: FuelBudgetPlan
  warning?: string
}

export const FUEL_BUDGET_PLAN_SWR_KEY = "/api/fuel/budget-plan"

async function fuelBudgetPlanFetcher(url: string): Promise<FuelBudgetPlanResponse> {
  const res = await fetch(url, { cache: "no-store" })
  const data = await res.json().catch(() => ({}))

  if (!res.ok) {
    throw new Error(data?.error || "Falha ao carregar o orçamento de combustível.")
  }

  return data
}

export function useFuelBudgetPlan() {
  const { data, error, isLoading, mutate } = useSWR(FUEL_BUDGET_PLAN_SWR_KEY, fuelBudgetPlanFetcher, {
    revalidateOnFocus: false,
    revalidateOnReconnect: false,
    dedupingInterval: 30_000,
    keepPreviousData: true,
  })

  const plan = useMemo(() => normalizeFuelBudgetPlan(data?.plan ?? null), [data?.plan])

  return {
    plan,
    hasLoaded: Boolean(data),
    warning: data?.warning,
    isLoading,
    error,
    mutate,
  }
}
