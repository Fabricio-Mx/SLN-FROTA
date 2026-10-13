"use client"

import { useMemo } from "react"
import { useFuelDataContext } from "@/components/fuel/fuel-data-provider"
import { useFuelCostCenters } from "@/hooks/use-fuel-cost-centers"
import { buildFuelBudgetAnalysis, toBudgetMonthKey, type FuelBudgetPlan } from "@/lib/fuel-budget-plan-shared"

export function useFuelBudgetAnalysis(plan: FuelBudgetPlan) {
  const { records, selectedMonth, monthlyReferenceDate, availableMonths } = useFuelDataContext()
  const { lookup: costCenterLookup, records: costCenterRecords } = useFuelCostCenters()
  const monthKey = selectedMonth ?? toBudgetMonthKey(monthlyReferenceDate)

  const analysis = useMemo(
    () => buildFuelBudgetAnalysis({ plan, records, costCenterLookup, monthKey }),
    [costCenterLookup, monthKey, plan, records],
  )

  const monthLabel = useMemo(() => {
    const option = availableMonths.find((month) => month.month === monthKey)
    if (option?.label) return option.label

    const [year, month] = monthKey.split("-").map(Number)
    return new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric" }).format(new Date(year, (month || 1) - 1, 1))
  }, [availableMonths, monthKey])

  return { analysis, monthKey, monthLabel, costCenterRecords }
}
