import { normalizeCostCenterLabel } from "@/lib/cost-center-shared"

export type FuelDailyBudgetItem = {
  centerCode: string
  centerLabel: string
  dailyBudget: number
}

export type FuelDailyBudgetDataset = {
  updatedAt: string | null
  items: FuelDailyBudgetItem[]
}

export const DEFAULT_TELECOM_DAILY_BUDGETS: FuelDailyBudgetItem[] = [
  {
    centerCode: "20",
    centerLabel: "20 - CASA CLIENTE POLO SUMICITY - BASE FRANCA / SP",
    dailyBudget: 620,
  },
  {
    centerCode: "61",
    centerLabel: "61 - CASA CLIENTE GIGA+ PA",
    dailyBudget: 945,
  },
  {
    centerCode: "67",
    centerLabel: "67 - CASA CLIENTE GIGA+ MA",
    dailyBudget: 845,
  },
  {
    centerCode: "60",
    centerLabel: "60 - CASA CLIENTE CE",
    dailyBudget: 290,
  },
]

function normalizeCenterCode(value: string): string {
  return value.replace(/\D+/g, "").trim()
}

function normalizeBudgetValue(value: number): number {
  if (!Number.isFinite(value) || value < 0) return 0
  return Number(value.toFixed(2))
}

function sanitizeBudgetItem(input: Partial<FuelDailyBudgetItem>): FuelDailyBudgetItem | null {
  const centerCode = normalizeCenterCode(input.centerCode ?? "")
  const centerLabel = normalizeCostCenterLabel(input.centerLabel ?? "")
  const dailyBudget = normalizeBudgetValue(Number(input.dailyBudget ?? 0))

  if (!centerCode) return null

  return {
    centerCode,
    centerLabel: centerLabel || centerCode,
    dailyBudget,
  }
}

function sortBudgetItems(items: FuelDailyBudgetItem[]): FuelDailyBudgetItem[] {
  return [...items].sort((left, right) => {
    const leftCode = Number(left.centerCode)
    const rightCode = Number(right.centerCode)

    if (Number.isFinite(leftCode) && Number.isFinite(rightCode) && leftCode !== rightCode) {
      return leftCode - rightCode
    }

    return left.centerCode.localeCompare(right.centerCode, "pt-BR")
  })
}

function mergeDefaultAndCustomBudgetItems(customItems: FuelDailyBudgetItem[]): FuelDailyBudgetItem[] {
  const merged = new Map<string, FuelDailyBudgetItem>()

  for (const item of DEFAULT_TELECOM_DAILY_BUDGETS) {
    const sanitized = sanitizeBudgetItem(item)
    if (!sanitized) continue
    merged.set(sanitized.centerCode, sanitized)
  }

  for (const item of customItems) {
    const sanitized = sanitizeBudgetItem(item)
    if (!sanitized) continue

    const current = merged.get(sanitized.centerCode)
    merged.set(sanitized.centerCode, {
      centerCode: sanitized.centerCode,
      centerLabel: sanitized.centerLabel || current?.centerLabel || sanitized.centerCode,
      dailyBudget: sanitized.dailyBudget,
    })
  }

  return sortBudgetItems(Array.from(merged.values()))
}

export function extractCostCenterCode(centerLabel: string): string {
  const normalized = normalizeCostCenterLabel(centerLabel)
  const match = normalized.match(/^(\d+)\s*-/)
  return match?.[1] ?? ""
}

export function normalizeFuelDailyBudgetDataset(input: unknown): FuelDailyBudgetDataset {
  if (!input || typeof input !== "object") {
    return {
      updatedAt: null,
      items: mergeDefaultAndCustomBudgetItems([]),
    }
  }

  const candidate = input as Partial<FuelDailyBudgetDataset>
  const customItems = Array.isArray(candidate.items) ? (candidate.items as FuelDailyBudgetItem[]) : []

  return {
    updatedAt: typeof candidate.updatedAt === "string" ? candidate.updatedAt : null,
    items: mergeDefaultAndCustomBudgetItems(customItems),
  }
}

export function upsertFuelDailyBudgetItem(
  items: FuelDailyBudgetItem[],
  nextItem: FuelDailyBudgetItem,
): FuelDailyBudgetItem[] {
  const merged = new Map<string, FuelDailyBudgetItem>()

  for (const item of items) {
    const sanitized = sanitizeBudgetItem(item)
    if (!sanitized) continue
    merged.set(sanitized.centerCode, sanitized)
  }

  const sanitizedNext = sanitizeBudgetItem(nextItem)
  if (!sanitizedNext) {
    return sortBudgetItems(Array.from(merged.values()))
  }

  const current = merged.get(sanitizedNext.centerCode)
  merged.set(sanitizedNext.centerCode, {
    centerCode: sanitizedNext.centerCode,
    centerLabel: sanitizedNext.centerLabel || current?.centerLabel || sanitizedNext.centerCode,
    dailyBudget: sanitizedNext.dailyBudget,
  })

  return sortBudgetItems(Array.from(merged.values()))
}
