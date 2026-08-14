const FUEL_BILLING_CYCLE_START_DAY = 2
const FUEL_BILLING_CYCLE_END_DAY = 4
const FUEL_FINANCIAL_POSTING_CYCLE_START_DAY = 1

function formatMonthKey(year: number, monthIndex: number): string {
  const month = `${monthIndex + 1}`.padStart(2, "0")
  return `${year}-${month}`
}

export function isFuelBillingMonthKey(value: string): boolean {
  return /^\d{4}-\d{2}$/.test(value)
}

export function getFuelBillingCycleBounds(anchorDate: Date) {
  if (anchorDate.getDate() > FUEL_BILLING_CYCLE_END_DAY) {
    return {
      start: new Date(anchorDate.getFullYear(), anchorDate.getMonth(), FUEL_BILLING_CYCLE_START_DAY),
      end: new Date(anchorDate.getFullYear(), anchorDate.getMonth() + 1, FUEL_BILLING_CYCLE_END_DAY),
    }
  }

  return {
    start: new Date(anchorDate.getFullYear(), anchorDate.getMonth() - 1, FUEL_BILLING_CYCLE_START_DAY),
    end: new Date(anchorDate.getFullYear(), anchorDate.getMonth(), FUEL_BILLING_CYCLE_END_DAY),
  }
}

export function getFuelBillingCycleClosingMonthKey(anchorDate: Date): string {
  const bounds = getFuelBillingCycleBounds(anchorDate)
  return formatMonthKey(bounds.end.getFullYear(), bounds.end.getMonth())
}

export function getLatestClosedFuelBillingCycleMonthKey(anchorDate: Date): string {
  if (anchorDate.getDate() >= FUEL_BILLING_CYCLE_END_DAY) {
    return formatMonthKey(anchorDate.getFullYear(), anchorDate.getMonth())
  }

  return formatMonthKey(anchorDate.getFullYear(), anchorDate.getMonth() - 1)
}

export function getFuelBillingCycleBoundsForClosingMonth(monthKey: string) {
  if (!isFuelBillingMonthKey(monthKey)) {
    return null
  }

  const [year, month] = monthKey.split("-").map(Number)
  if (!year || !month) {
    return null
  }

  const monthIndex = month - 1

  return {
    start: new Date(year, monthIndex - 1, FUEL_BILLING_CYCLE_START_DAY),
    end: new Date(year, monthIndex, FUEL_BILLING_CYCLE_END_DAY),
  }
}

export function getFuelFinancialPostingCycleBounds(anchorDate: Date) {
  const billingBounds = getFuelBillingCycleBounds(anchorDate)

  return {
    start: new Date(billingBounds.start.getFullYear(), billingBounds.start.getMonth(), FUEL_FINANCIAL_POSTING_CYCLE_START_DAY),
    end: billingBounds.end,
  }
}

export function getFuelFinancialPostingCycleBoundsForClosingMonth(monthKey: string) {
  const billingBounds = getFuelBillingCycleBoundsForClosingMonth(monthKey)
  if (!billingBounds) {
    return null
  }

  return {
    start: new Date(billingBounds.start.getFullYear(), billingBounds.start.getMonth(), FUEL_FINANCIAL_POSTING_CYCLE_START_DAY),
    end: billingBounds.end,
  }
}
