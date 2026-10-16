"use client"

import { useMemo } from "react"
import { useFuelDataContext } from "@/components/fuel/fuel-data-provider"
import { useFuelCostCenters } from "@/hooks/use-fuel-cost-centers"
import { createCostCenterLookup, normalizeCostCenterDriverName, type CostCenterRecord } from "@/lib/cost-center-shared"
import { buildFuelBudgetAnalysis, toBudgetMonthKey, type FuelBudgetPlan } from "@/lib/fuel-budget-plan-shared"

export type FuelBudgetRegistryOverride = CostCenterRecord & { previousMotorista: string | null }

/** Aplica alteracoes de cadastro ainda nao salvas (ex.: colaborador movido de centro) sobre o cadastro atual. */
export function applyCostCenterOverrides(records: CostCenterRecord[], overrides: FuelBudgetRegistryOverride[]): CostCenterRecord[] {
  if (overrides.length === 0) return records

  const replacedKeys = new Set<string>()
  for (const override of overrides) {
    replacedKeys.add(normalizeCostCenterDriverName(override.motorista))
    if (override.previousMotorista) replacedKeys.add(normalizeCostCenterDriverName(override.previousMotorista))
  }

  return [
    ...records.filter((record) => !replacedKeys.has(normalizeCostCenterDriverName(record.motorista))),
    ...overrides.map(({ motorista, centroCusto, supervisor, coordenador }) => ({ motorista, centroCusto, supervisor, coordenador })),
  ]
}

const NO_OVERRIDES: FuelBudgetRegistryOverride[] = []

export function useFuelBudgetAnalysis(plan: FuelBudgetPlan, registryOverrides: FuelBudgetRegistryOverride[] = NO_OVERRIDES) {
  const { records, selectedMonth, monthlyReferenceDate, availableMonths } = useFuelDataContext()
  const { records: savedCostCenterRecords } = useFuelCostCenters()
  const monthKey = selectedMonth ?? toBudgetMonthKey(monthlyReferenceDate)

  const costCenterRecords = useMemo(
    () => applyCostCenterOverrides(savedCostCenterRecords, registryOverrides),
    [registryOverrides, savedCostCenterRecords],
  )
  const costCenterLookup = useMemo(() => createCostCenterLookup(costCenterRecords), [costCenterRecords])

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
