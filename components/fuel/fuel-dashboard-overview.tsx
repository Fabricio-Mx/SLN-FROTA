"use client"

import { useMemo, useState } from "react"
import useSWR from "swr"
import { Bar, BarChart, CartesianGrid, Cell, ComposedChart, LabelList, Line, Pie, PieChart, XAxis, YAxis } from "recharts"
import { AlertTriangle, Building2, CalendarDays, CalendarRange, Droplets, Fuel, Receipt, TrendingUp, Users } from "lucide-react"
import { useFuelDataContext } from "@/components/fuel/fuel-data-provider"
import { FuelCostCenterInsights } from "@/components/fuel/fuel-cost-center-insights"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ChartContainer, ChartLegend, ChartLegendContent, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { useToast } from "@/hooks/use-toast"
import { useFuelCostCenters } from "@/hooks/use-fuel-cost-centers"
import { FUEL_DAILY_BUDGET_SWR_KEY, useFuelDailyBudgets } from "@/hooks/use-fuel-daily-budgets"
import { fuelFetcher, FUEL_DATA_SWR_KEY, type FuelResponse } from "@/hooks/use-fuel-data"
import { getFuelFinancialPostingCycleBounds } from "@/lib/fuel-billing"
import { normalizeCostCenterDriverName, resolveCostCenterRecord } from "@/lib/cost-center-shared"
import { extractCostCenterCode, type FuelDailyBudgetItem } from "@/lib/fuel-daily-budget-shared"
import { isEngineeringCostCenter, isTelecomCostCenter } from "@/lib/fuel-telecom-centers"
import { parseFuelDateTime } from "@/lib/fuel-datetime"

type FuelTypeDatum = {
  name: string
  value: number
  percentage: number
  color: string
}

type WeeklyDatum = {
  label: string
  total: number
  average: number
  startKey?: string
  endKey?: string
}

type PeriodDatum = {
  label: string
  total: number
  dateKey?: string
}

type TopSpenderDatum = {
  key: string
  name: string
  cpf: string
  plate: string
  total: number
  transactions: number
  centroCusto: string
  supervisor: string
  coordenador: string
}

type FuelAnalyticsPreset = "current-month" | "last-7-days" | "last-30-days" | "last-90-days" | "custom"

type WeeklyScopeFilter = "all" | "telecom" | "engineering"

type DailyRightPanelView = "centers" | "budget"

type FuelRecordWithDate = {
  cardPlate: string
  cpfMotorista: string
  nomeMotorista: string
  tipoCombustivel: string
  valor: number
  dateTime: string
  parsedDate: Date
}

type TelecomDailyBudgetRow = {
  centerCode: string
  centerLabel: string
  budget: number
  spent: number
}

const FUEL_TYPE_COLORS: Record<string, string> = {
  Etanol: "#4E8F57",
  Gasolina: "#4F9BC9",
  Diesel: "#D89A4A",
  GNV: "#D86C61",
  Outros: "#A0AEC0",
}

function formatCompactCurrency(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)
}

const weeklyChartConfig = {
  total: {
    label: "Total da semana",
    color: "#5b9b5f",
  },
  average: {
    label: "Média acumulada",
    color: "#8fc78e",
  },
}

const rankingChartConfig = {
  total: {
    label: "Gasto",
    color: "#77b05d",
  },
}

const periodChartConfig = {
  total: {
    label: "Gasto",
    color: "#6aa553",
  },
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value)
}

function parseBudgetInputValue(value: string): number {
  const normalized = value.replace(/\./g, "").replace(",", ".")
  const parsed = Number(normalized)
  return Number.isFinite(parsed) ? parsed : Number.NaN
}

function getBudgetVarianceLabel(value: number): string {
  const sign = value > 0 ? "+" : "-"
  return `${sign} ${formatCurrency(Math.abs(value))}`
}

function formatCompactDate(date: Date): string {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
  }).format(date)
}

function formatShortDate(date: Date): string {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
  }).format(date)
}

function formatFullDate(date: Date): string {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date)
}

function formatTime(date: Date): string {
  return new Intl.DateTimeFormat("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(date)
}

function formatMonthLabel(date: Date): string {
  return new Intl.DateTimeFormat("pt-BR", {
    month: "long",
    year: "numeric",
  }).format(date)
}

function formatMonthShort(date: Date): string {
  return new Intl.DateTimeFormat("pt-BR", {
    month: "short",
    year: "2-digit",
  })
    .format(date)
    .replace(".", "")
}

function toMonthKey(date: Date): string {
  const year = date.getFullYear()
  const month = `${date.getMonth() + 1}`.padStart(2, "0")
  return `${year}-${month}`
}

function toDateInputValue(date: Date): string {
  const year = date.getFullYear()
  const month = `${date.getMonth() + 1}`.padStart(2, "0")
  const day = `${date.getDate()}`.padStart(2, "0")
  return `${year}-${month}-${day}`
}

function toDateKey(date: Date): string {
  const year = date.getFullYear()
  const month = `${date.getMonth() + 1}`.padStart(2, "0")
  const day = `${date.getDate()}`.padStart(2, "0")
  return `${year}-${month}-${day}`
}

function fromDateKey(value: string): Date | null {
  const [year, month, day] = value.split("-").map(Number)
  if (!year || !month || !day) return null
  return new Date(year, month - 1, day)
}

function toDateOnly(value: string): Date | null {
  if (!value) return null
  const [year, month, day] = value.split("-").map(Number)
  if (!year || !month || !day) return null
  return new Date(year, month - 1, day)
}

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

function endOfDay(date: Date): Date {
  const copy = new Date(date)
  copy.setHours(23, 59, 59, 999)
  return copy
}

function startOfWeek(date: Date): Date {
  const copy = new Date(date)
  const day = copy.getDay()
  const diff = day === 0 ? -6 : 1 - day
  copy.setDate(copy.getDate() + diff)
  copy.setHours(0, 0, 0, 0)
  return copy
}

function endOfWeek(date: Date): Date {
  const copy = new Date(date)
  copy.setDate(copy.getDate() + 6)
  copy.setHours(23, 59, 59, 999)
  return copy
}

function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1)
}

function endOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999)
}

function normalizeFuelType(value: string): string {
  const normalized = value.trim().toLowerCase()
  if (!normalized) return "Gasolina"
  if (normalized.includes("etan") || normalized.includes("alcool") || normalized.includes("alco")) return "Etanol"
  if (normalized.includes("gas")) return "Gasolina"
  if (normalized.includes("dies")) return "Diesel"
  if (normalized.includes("gnv")) return "GNV"
  return "Outros"
}

function normalizePersonName(name: string, cpf: string): string {
  const trimmed = name.trim()
  if (trimmed && !trimmed.toLowerCase().includes("veiculo sem motorista")) return trimmed
  if (cpf.trim()) return `CPF ${cpf.trim()}`
  return "Não identificado"
}

function normalizeSearchValue(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
}

function matchesRecordSearch(record: FuelRecordWithDate, query: string): boolean {
  if (!query) return true

  const driver = normalizeSearchValue(normalizePersonName(record.nomeMotorista, record.cpfMotorista))
  const plate = normalizeSearchValue(record.cardPlate || "")

  return driver.includes(query) || plate.includes(query)
}

function getPersonAggregationKey(name: string, cpf: string): string {
  const normalizedName = normalizeCostCenterDriverName(name)

  if (normalizedName && !normalizedName.includes("veiculo sem motorista")) {
    return `name:${normalizedName}`
  }

  const trimmedCpf = cpf.trim()
  if (trimmedCpf) {
    return `cpf:${trimmedCpf}`
  }

  return "unknown"
}

function mergePersonCpf(currentCpf: string, nextCpf: string): string {
  const currentTrimmed = currentCpf.trim()
  const nextTrimmed = nextCpf.trim()

  if (!currentTrimmed) return nextTrimmed || "-"
  if (!nextTrimmed || nextTrimmed === currentTrimmed) return currentTrimmed

  return currentTrimmed
}

function mergePersonPlate(currentPlate: string, nextPlate: string): string {
  const currentTrimmed = currentPlate.trim()
  const nextTrimmed = nextPlate.trim()

  if (!currentTrimmed) return nextTrimmed || "-"
  if (!nextTrimmed || nextTrimmed === currentTrimmed) return currentTrimmed

  return currentTrimmed
}

function formatUnmatchedPersonLabel(spender: Pick<TopSpenderDatum, "name" | "cpf" | "plate">): string {
  const normalizedName = spender.name.trim()
  if (normalizedName && normalizedName !== "Não identificado") {
    return normalizedName
  }

  if (spender.cpf.trim() && spender.cpf.trim() !== "-") {
    return `CPF ${spender.cpf.trim()}`
  }

  if (spender.plate.trim() && spender.plate.trim() !== "-") {
    return `Placa ${spender.plate.trim()}`
  }

  return "Registro sem identificação"
}

function formatPeriodLabel(preset: FuelAnalyticsPreset, rangeStart: Date, rangeEnd: Date): string {
  if (preset === "current-month") {
    return formatMonthLabel(rangeEnd)
  }

  return `${formatCompactDate(rangeStart)} a ${formatCompactDate(rangeEnd)}`
}

function getRankingBarColor(index: number, total: number): string {
  const colorStops = [
    { r: 191, g: 222, b: 255 },
    { r: 247, g: 229, b: 140 },
    { r: 240, g: 166, b: 92 },
    { r: 214, g: 78, b: 78 },
  ]

  if (total <= 1) {
    const only = colorStops[colorStops.length - 1]
    return `rgb(${only.r} ${only.g} ${only.b})`
  }

  const ratio = 1 - index / (total - 1)
  const segmentCount = colorStops.length - 1
  const scaled = ratio * segmentCount
  const segmentIndex = Math.min(Math.floor(scaled), segmentCount - 1)
  const segmentProgress = scaled - segmentIndex

  const start = colorStops[segmentIndex]
  const end = colorStops[segmentIndex + 1]

  const red = Math.round(start.r + (end.r - start.r) * segmentProgress)
  const green = Math.round(start.g + (end.g - start.g) * segmentProgress)
  const blue = Math.round(start.b + (end.b - start.b) * segmentProgress)

  return `rgb(${red} ${green} ${blue})`
}

function formatRankingPersonLabel(value: string): string {
  const normalized = value.trim()
  if (normalized.length <= 20) return normalized

  const parts = normalized.split(" ").filter(Boolean)
  if (parts.length <= 1) return `${normalized.slice(0, 20)}...`

  const first = parts[0]
  const last = parts[parts.length - 1]
  const composed = `${first} ${last}`

  if (composed.length <= 20) return composed

  return `${composed.slice(0, 20)}...`
}

type FuelDashboardOverviewProps = {
  isMaster?: boolean
}

export function FuelDashboardOverview({ isMaster = false }: FuelDashboardOverviewProps = {}) {
  const {
    records,
    monthlyReferenceDate,
    monthlyTotal,
    reportDate,
    availableMonths,
    weeklyComparison,
    currentMonth,
    lastImportedAt,
    selectedMonth,
    setSelectedMonth,
  } = useFuelDataContext()
  const { toast } = useToast()
  const { lookup: costCenterLookup } = useFuelCostCenters()
  const { items: dailyBudgetItems, isLoading: isDailyBudgetLoading, mutate: mutateDailyBudgets } = useFuelDailyBudgets()
  const [budgetDrafts, setBudgetDrafts] = useState<Record<string, string>>({})
  const [isBudgetEditMode, setIsBudgetEditMode] = useState(false)
  const [savingBudgetCenterCode, setSavingBudgetCenterCode] = useState<string | null>(null)
  const [analyticsPreset, setAnalyticsPreset] = useState<FuelAnalyticsPreset>("current-month")
  const defaultCustomStart = useMemo(() => toDateInputValue(startOfMonth(monthlyReferenceDate)), [monthlyReferenceDate])
  const defaultCustomEnd = useMemo(() => toDateInputValue(reportDate), [reportDate])
  const customRangeSeed = useMemo(
    () => `${selectedMonth ?? ""}:${defaultCustomStart}:${defaultCustomEnd}`,
    [defaultCustomEnd, defaultCustomStart, selectedMonth]
  )
  const [customRange, setCustomRange] = useState(() => ({
    seed: customRangeSeed,
    start: defaultCustomStart,
    end: defaultCustomEnd,
  }))
  const [selectedDailyKey, setSelectedDailyKey] = useState<string | null>(null)
  const [isDailyDetailOpen, setIsDailyDetailOpen] = useState(false)
  const [dailyScopeFilter, setDailyScopeFilter] = useState<WeeklyScopeFilter>("all")
  const [dailyRightPanelView, setDailyRightPanelView] = useState<DailyRightPanelView>("centers")
  const [selectedDailyCenterKey, setSelectedDailyCenterKey] = useState<string | null>(null)
  const [dailyRecordsSearch, setDailyRecordsSearch] = useState("")
  const [selectedWeeklyStartKey, setSelectedWeeklyStartKey] = useState<string | null>(null)
  const [isWeeklyDetailOpen, setIsWeeklyDetailOpen] = useState(false)
  const [weeklyScopeFilter, setWeeklyScopeFilter] = useState<WeeklyScopeFilter>("all")
  const [weeklyRightPanelView, setWeeklyRightPanelView] = useState<DailyRightPanelView>("centers")
  const [selectedWeeklyCenterKey, setSelectedWeeklyCenterKey] = useState<string | null>(null)
  const [weeklyRecordsSearch, setWeeklyRecordsSearch] = useState("")
  const billingCycle = useMemo(() => getFuelFinancialPostingCycleBounds(reportDate), [reportDate])
  const billingCycleKey = useMemo(() => {
    const params = new URLSearchParams({
      start: toDateInputValue(billingCycle.start),
      end: toDateInputValue(billingCycle.end),
      dateField: "transaction",
    })

    return `${FUEL_DATA_SWR_KEY}?${params.toString()}`
  }, [billingCycle.end, billingCycle.start])
  const { data: billingCycleData } = useSWR<FuelResponse>(billingCycleKey, fuelFetcher, {
    revalidateOnFocus: false,
    revalidateOnReconnect: false,
    dedupingInterval: 30_000,
    keepPreviousData: true,
  })

  const billingCycleFuelTotal = useMemo(() => {
    if (!billingCycleData?.records) return monthlyTotal
    return billingCycleData.records.reduce((sum, record) => sum + record.valor, 0)
  }, [billingCycleData, monthlyTotal])

  const effectiveCustomRange = customRange.seed === customRangeSeed
    ? customRange
    : {
        seed: customRangeSeed,
        start: defaultCustomStart,
        end: defaultCustomEnd,
      }

  const customQueryRange = useMemo(() => {
    const start = toDateOnly(effectiveCustomRange.start)
    const end = toDateOnly(effectiveCustomRange.end)

    if (!start || !end) return null

    const normalizedStart = start <= end ? start : end
    const normalizedEnd = start <= end ? end : start

    return {
      start: toDateInputValue(normalizedStart),
      end: toDateInputValue(normalizedEnd),
    }
  }, [effectiveCustomRange.end, effectiveCustomRange.start])

  const customRangeKey = useMemo(() => {
    if (analyticsPreset !== "custom" || !customQueryRange) return null

    const params = new URLSearchParams({
      start: customQueryRange.start,
      end: customQueryRange.end,
    })

    if (selectedMonth) {
      params.set("month", selectedMonth)
    }

    return `${FUEL_DATA_SWR_KEY}?${params.toString()}`
  }, [analyticsPreset, customQueryRange, selectedMonth])

  const { data: customRangeData } = useSWR<FuelResponse>(customRangeKey, fuelFetcher, {
    revalidateOnFocus: false,
    revalidateOnReconnect: false,
    dedupingInterval: 30_000,
    keepPreviousData: true,
  })

  const selectedMonthOption = useMemo(() => {
    return availableMonths.find((month) => month.month === selectedMonth) ?? null
  }, [availableMonths, selectedMonth])

  const sourceRecords = analyticsPreset === "custom" ? customRangeData?.records ?? records : records

  const parsedRecords = useMemo<FuelRecordWithDate[]>(() => {
    return sourceRecords
      .map((record) => ({
        ...record,
        parsedDate: parseFuelDateTime(record.dateTime),
      }))
      .filter((record) => !Number.isNaN(record.parsedDate.getTime()))
      .sort((left, right) => left.parsedDate.getTime() - right.parsedDate.getTime())
  }, [sourceRecords])

  const monthTotals = useMemo(() => {
    return new Map(availableMonths.map((month) => [month.month, month.total]))
  }, [availableMonths])

  const latestRecordDate = useMemo(() => {
    return parsedRecords.length > 0 ? parsedRecords[parsedRecords.length - 1].parsedDate : reportDate
  }, [parsedRecords, reportDate])

  const lastImportedLabel = useMemo(() => {
    if (!lastImportedAt) return null

    const parsed = new Date(lastImportedAt)
    if (Number.isNaN(parsed.getTime())) return null

    return formatFullDate(parsed)
  }, [lastImportedAt])

  const analyticsRange = useMemo(() => {
    if (analyticsPreset === "custom") {
      const start = toDateOnly(effectiveCustomRange.start) ?? startOfMonth(latestRecordDate)
      const end = toDateOnly(effectiveCustomRange.end) ?? latestRecordDate
      const normalizedStart = start <= end ? startOfDay(start) : startOfDay(end)
      const normalizedEnd = start <= end ? endOfDay(end) : endOfDay(start)
      return { start: normalizedStart, end: normalizedEnd }
    }

    if (analyticsPreset === "last-7-days") {
      const end = endOfDay(latestRecordDate)
      const start = startOfDay(new Date(latestRecordDate.getFullYear(), latestRecordDate.getMonth(), latestRecordDate.getDate() - 6))
      return { start, end }
    }

    if (analyticsPreset === "last-30-days") {
      const end = endOfDay(latestRecordDate)
      const start = startOfDay(new Date(latestRecordDate.getFullYear(), latestRecordDate.getMonth(), latestRecordDate.getDate() - 29))
      return { start, end }
    }

    if (analyticsPreset === "last-90-days") {
      const end = endOfDay(latestRecordDate)
      const start = startOfDay(new Date(latestRecordDate.getFullYear(), latestRecordDate.getMonth(), latestRecordDate.getDate() - 89))
      return { start, end }
    }

    return {
      start: startOfMonth(latestRecordDate),
      end: endOfDay(latestRecordDate),
    }
  }, [analyticsPreset, effectiveCustomRange.end, effectiveCustomRange.start, latestRecordDate])

  const filteredRecords = useMemo(() => {
    return parsedRecords.filter((record) => record.parsedDate >= analyticsRange.start && record.parsedDate <= analyticsRange.end)
  }, [analyticsRange.end, analyticsRange.start, parsedRecords])

  const insights = useMemo(() => {
    const fuelMap = new Map<string, number>()
    const spendersMap = new Map<string, TopSpenderDatum>()
    const resolvedCostCenterByDriver = new Map<string, ReturnType<typeof resolveCostCenterRecord>>()

    for (const record of filteredRecords) {
      const fuelType = normalizeFuelType(record.tipoCombustivel)
      fuelMap.set(fuelType, (fuelMap.get(fuelType) ?? 0) + record.valor)

      const personKey = getPersonAggregationKey(record.nomeMotorista, record.cpfMotorista)
      const current = spendersMap.get(personKey)
      const normalizedDriver = normalizePersonName(record.nomeMotorista, record.cpfMotorista)
      const resolvedCostCenter = resolvedCostCenterByDriver.has(normalizedDriver)
        ? resolvedCostCenterByDriver.get(normalizedDriver) ?? null
        : resolveCostCenterRecord(normalizedDriver, costCenterLookup)

      if (!resolvedCostCenterByDriver.has(normalizedDriver)) {
        resolvedCostCenterByDriver.set(normalizedDriver, resolvedCostCenter)
      }

      if (current) {
        current.total += record.valor
        current.transactions += 1
        current.cpf = mergePersonCpf(current.cpf, record.cpfMotorista)
        current.plate = mergePersonPlate(current.plate, record.cardPlate)
      } else {
        spendersMap.set(personKey, {
          key: personKey,
          name: normalizedDriver,
          cpf: record.cpfMotorista.trim() || "-",
          plate: record.cardPlate.trim() || "-",
          total: record.valor,
          transactions: 1,
          centroCusto: resolvedCostCenter?.centroCusto ?? "",
          supervisor: resolvedCostCenter?.supervisor ?? "",
          coordenador: resolvedCostCenter?.coordenador ?? "",
        })
      }
    }

    const periodTotal = filteredRecords.reduce((sum, record) => sum + record.valor, 0)
    const periodCount = filteredRecords.length
    const anchorDate = analyticsRange.end
    const latestWeekStart = startOfWeek(anchorDate)
    const latestMonthStart = startOfMonth(anchorDate)

    const fuelBreakdown: FuelTypeDatum[] = Array.from(fuelMap.entries())
      .map(([name, value]) => ({
        name,
        value,
        percentage: periodTotal > 0 ? (value / periodTotal) * 100 : 0,
        color: FUEL_TYPE_COLORS[name] ?? FUEL_TYPE_COLORS.Outros,
      }))
      .sort((left, right) => right.value - left.value)

    const topSpenders = Array.from(spendersMap.values())
      .sort((left, right) => right.total - left.total)
      .slice(0, 10)

    const topSpendersTotal = topSpenders.reduce((sum, spender) => sum + spender.total, 0)
    const topSpendersMappedCount = topSpenders.filter((spender) => spender.centroCusto).length
    const costCenterRanking = Array.from(
      topSpenders.reduce((map, spender) => {
        const costCenterLabel = spender.centroCusto || "Sem centro de custo"

        const current = map.get(costCenterLabel)
        if (current) {
          current.total += spender.total
          current.people += 1
        } else {
          map.set(costCenterLabel, {
            centroCusto: costCenterLabel,
            total: spender.total,
            people: 1,
          })
        }

        return map
      }, new Map<string, { centroCusto: string; total: number; people: number }>())
      .values(),
    ).sort((left, right) => right.total - left.total)

    const dailyMetric = filteredRecords.reduce((sum, record) => {
      return startOfDay(record.parsedDate).getTime() === startOfDay(anchorDate).getTime() ? sum + record.valor : sum
    }, 0)

    const rollingWeekStart = startOfDay(new Date(anchorDate.getFullYear(), anchorDate.getMonth(), anchorDate.getDate() - 6))
    const weeklyMetric = filteredRecords.reduce((sum, record) => {
      return record.parsedDate >= rollingWeekStart && record.parsedDate <= anchorDate ? sum + record.valor : sum
    }, 0)

    const currentMonthStart = startOfMonth(anchorDate)
    const currentMonthEnd = endOfMonth(anchorDate)
    const monthlyMetric =
      analyticsPreset === "current-month"
        ? monthTotals.get(toMonthKey(currentMonthStart)) ?? 0
        : filteredRecords.reduce((sum, record) => {
            return record.parsedDate >= currentMonthStart && record.parsedDate <= currentMonthEnd ? sum + record.valor : sum
          }, 0)

    const dailySeries: PeriodDatum[] = Array.from({ length: 7 }, (_, index) => {
      const day = new Date(anchorDate)
      day.setDate(anchorDate.getDate() - (6 - index))
      day.setHours(0, 0, 0, 0)
      const dayEnd = endOfDay(day)

      return {
        dateKey: toDateKey(day),
        label: formatCompactDate(day),
        total: filteredRecords.reduce((sum, record) => {
          return record.parsedDate >= day && record.parsedDate <= dayEnd ? sum + record.valor : sum
        }, 0),
      }
    })

    const weeklySeries: WeeklyDatum[] = Array.from({ length: 8 }, (_, index) => {
      const weekStart = new Date(latestWeekStart)
      weekStart.setDate(latestWeekStart.getDate() - 7 * (7 - index))
      const weekEnd = endOfWeek(weekStart)

      return {
        startKey: toDateKey(weekStart),
        endKey: toDateKey(weekEnd),
        label: formatCompactDate(weekStart),
        total: filteredRecords.reduce((sum, record) => {
          return record.parsedDate >= weekStart && record.parsedDate <= weekEnd ? sum + record.valor : sum
        }, 0),
        average: 0,
      }
    }).map((entry, index, array) => ({
      ...entry,
      average: array.slice(0, index + 1).reduce((sum, item) => sum + item.total, 0) / (index + 1),
    }))

    const monthlySeries: PeriodDatum[] = Array.from({ length: 6 }, (_, index) => {
      const monthDate = new Date(latestMonthStart.getFullYear(), latestMonthStart.getMonth() - (5 - index), 1)
      const monthStart = startOfMonth(monthDate)
      const monthEnd = endOfMonth(monthDate)
      const monthKey = toMonthKey(monthDate)

      return {
        label: formatMonthShort(monthDate).replace(/^./, (char) => char.toUpperCase()),
        total:
          analyticsPreset === "current-month"
            ? monthTotals.get(monthKey) ?? 0
            : filteredRecords.reduce((sum, record) => {
                return record.parsedDate >= monthStart && record.parsedDate <= monthEnd ? sum + record.valor : sum
              }, 0),
      }
    })

    return {
      activePeople: spendersMap.size,
      avgTicket: periodCount > 0 ? periodTotal / periodCount : 0,
      dailyMetric,
      dailySeries,
      fuelBreakdown,
      monthlyMetric,
      monthlySeries,
      periodCount,
      periodLabel: formatPeriodLabel(analyticsPreset, analyticsRange.start, analyticsRange.end),
      periodTotal,
      topSpendersMappedCount,
      topSpendersShare: periodTotal > 0 ? (topSpendersTotal / periodTotal) * 100 : 0,
      topSpender: topSpenders[0] ?? null,
      topSpenders,
      topCostCenter: costCenterRanking[0] ?? null,
      weeklyMetric,
      weeklySeries,
    }
  }, [analyticsPreset, analyticsRange.end, analyticsRange.start, costCenterLookup, filteredRecords, monthTotals])

  const summaryCard = useMemo(() => {
    if (analyticsPreset === "custom") {
      return {
        title: "Recorte aplicado",
        subtitle: insights.periodLabel,
        recordCount: insights.periodCount,
        total: insights.periodTotal,
        badgeLabel: "Período",
      }
    }

    return {
      title: "Competência carregada",
      subtitle: selectedMonthOption?.label ?? insights.periodLabel,
      recordCount: selectedMonthOption?.recordCount ?? filteredRecords.length,
      total: selectedMonthOption?.total ?? insights.periodTotal,
      badgeLabel: selectedMonth === currentMonth ? "Atual" : "Histórico",
    }
  }, [analyticsPreset, currentMonth, filteredRecords.length, insights.periodCount, insights.periodLabel, insights.periodTotal, selectedMonth, selectedMonthOption])

  const rangeMonthKeys = useMemo(() => {
    return new Set(filteredRecords.map((record) => toMonthKey(record.parsedDate)))
  }, [filteredRecords])

  const analyticsCopy = useMemo(() => {
    if (analyticsPreset === "custom") {
      return {
        dailyDescription: "Últimos 7 dias dentro do recorte aplicado",
        dailyMetricLabel: "Fim do recorte",
        weeklyTitle: "Janela final de 7 dias",
        weeklyDescription: "Total móvel dos 7 dias finais do recorte",
        weeklyMetricLabel: "7 dias finais",
        monthlyTitle: "Mês final do recorte",
        monthlyDescription: "Total do mês em que o recorte termina",
        monthlyMetricLabel: "Mês do fim",
        summaryTitle: "Resumo do recorte atual",
        summaryWeeklyCaption: "7 dias finais do recorte",
        summaryMonthlyCaption: "Mês do fim do recorte",
      }
    }

    return {
      dailyDescription: "Últimos 7 dias dentro do período",
      dailyMetricLabel: "Dia final",
      weeklyTitle: "Gasto semanal",
      weeklyDescription: "Últimas 8 semanas do recorte",
      weeklyMetricLabel: "7 dias",
      monthlyTitle: "Gasto mensal",
      monthlyDescription: "Últimos 6 meses do recorte",
      monthlyMetricLabel: "Mês final",
      summaryTitle: "Resumo do fechamento atual",
      summaryWeeklyCaption: "Últimos 7 dias",
      summaryMonthlyCaption: "Mês final",
    }
  }, [analyticsPreset])

  const rankingChartData = useMemo(() => {
    const total = insights.topSpenders.length

    return insights.topSpenders.map((item, index) => ({
      ...item,
      barColor: getRankingBarColor(index, total),
    }))
  }, [insights.topSpenders])

  const unmatchedDriversPreview = useMemo(() => {
    return insights.topSpenders.filter((driver) => !driver.centroCusto).slice(0, 6)
  }, [insights.topSpenders])

  const weeklyComparisonChartConfig = useMemo(() => {
    return weeklyComparison.months.reduce<Record<string, { label: string; color: string }>>((config, month) => {
      config[month.key] = {
        label: month.label,
        color: month.color,
      }
      return config
    }, {})
  }, [weeklyComparison.months])

  const selectedDailyPoint = useMemo(() => {
    if (insights.dailySeries.length === 0) return null

    const fromState = selectedDailyKey
      ? insights.dailySeries.find((entry) => entry.dateKey === selectedDailyKey) ?? null
      : null

    return fromState ?? insights.dailySeries[insights.dailySeries.length - 1]
  }, [insights.dailySeries, selectedDailyKey])

  const selectedDailyDate = useMemo(() => {
    if (!selectedDailyPoint?.dateKey) return null
    return fromDateKey(selectedDailyPoint.dateKey)
  }, [selectedDailyPoint])

  const selectedDayRecords = useMemo(() => {
    if (!selectedDailyPoint?.dateKey) return []

    return filteredRecords
      .filter((record) => toDateKey(record.parsedDate) === selectedDailyPoint.dateKey)
      .sort((left, right) => right.parsedDate.getTime() - left.parsedDate.getTime())
  }, [filteredRecords, selectedDailyPoint])

  const selectedDayScopedRecords = useMemo(() => {
    if (dailyScopeFilter === "all") return selectedDayRecords

    return selectedDayRecords.filter((record) => {
      const driver = normalizePersonName(record.nomeMotorista, record.cpfMotorista)
      const resolved = resolveCostCenterRecord(driver, costCenterLookup)
      const centerLabel = resolved?.centroCusto || "Sem centro de custo"
      return dailyScopeFilter === "telecom" ? isTelecomCostCenter(centerLabel) : isEngineeringCostCenter(centerLabel)
    })
  }, [costCenterLookup, dailyScopeFilter, selectedDayRecords])

  const selectedDayScopedResolvedRecords = useMemo(() => {
    return selectedDayScopedRecords.map((record) => {
      const driver = normalizePersonName(record.nomeMotorista, record.cpfMotorista)
      const resolved = resolveCostCenterRecord(driver, costCenterLookup)

      return {
        record,
        centerLabel: resolved?.centroCusto || "Sem centro de custo",
      }
    })
  }, [costCenterLookup, selectedDayScopedRecords])

  const selectedDayCostCenters = useMemo(() => {
    const aggregation = new Map<
      string,
      {
        centroCusto: string
        total: number
        transactions: number
        drivers: Set<string>
      }
    >()

    for (const item of selectedDayScopedResolvedRecords) {
      const record = item.record
      const driver = normalizePersonName(record.nomeMotorista, record.cpfMotorista)
      const centerLabel = item.centerLabel
      const key = centerLabel.toLowerCase()
      const current = aggregation.get(key)

      if (current) {
        current.total += record.valor
        current.transactions += 1
        current.drivers.add(driver)
      } else {
        aggregation.set(key, {
          centroCusto: centerLabel,
          total: record.valor,
          transactions: 1,
          drivers: new Set([driver]),
        })
      }
    }

    return Array.from(aggregation.values())
      .map((item) => ({
        key: item.centroCusto.toLowerCase(),
        centroCusto: item.centroCusto,
        total: item.total,
        transactions: item.transactions,
        drivers: item.drivers.size,
      }))
      .sort((left, right) => right.total - left.total)
  }, [selectedDayScopedResolvedRecords])

  const selectedDayCostCentersTotal = useMemo(() => {
    return selectedDayCostCenters.reduce((total, center) => total + center.total, 0)
  }, [selectedDayCostCenters])

  const selectedDayTelecomSpentByCode = useMemo(() => {
    const totals = new Map<string, { total: number; centerLabel: string }>()

    for (const record of selectedDayRecords) {
      const driver = normalizePersonName(record.nomeMotorista, record.cpfMotorista)
      const resolved = resolveCostCenterRecord(driver, costCenterLookup)
      const centerLabel = resolved?.centroCusto || ""

      if (!isTelecomCostCenter(centerLabel)) continue

      const centerCode = extractCostCenterCode(centerLabel)
      if (!centerCode) continue

      const current = totals.get(centerCode)
      totals.set(centerCode, {
        total: (current?.total ?? 0) + record.valor,
        centerLabel: current?.centerLabel || centerLabel,
      })
    }

    return totals
  }, [costCenterLookup, selectedDayRecords])

  const telecomDailyBudgetRows = useMemo<TelecomDailyBudgetRow[]>(() => {
    const budgetsByCode = new Map<string, FuelDailyBudgetItem>()

    for (const item of dailyBudgetItems) {
      budgetsByCode.set(item.centerCode, item)
    }

    const rows: TelecomDailyBudgetRow[] = []

    for (const [centerCode, budget] of budgetsByCode.entries()) {
      const spent = selectedDayTelecomSpentByCode.get(centerCode)?.total ?? 0
      const centerLabel = selectedDayTelecomSpentByCode.get(centerCode)?.centerLabel || budget.centerLabel || centerCode
      rows.push({
        centerCode,
        centerLabel,
        budget: budget.dailyBudget,
        spent,
      })
    }

    for (const [centerCode, spentData] of selectedDayTelecomSpentByCode.entries()) {
      if (budgetsByCode.has(centerCode)) continue

      rows.push({
        centerCode,
        centerLabel: spentData.centerLabel || centerCode,
        budget: 0,
        spent: spentData.total,
      })
    }

    return rows.sort((left, right) => Number(left.centerCode) - Number(right.centerCode))
  }, [dailyBudgetItems, selectedDayTelecomSpentByCode])

  const telecomBudgetTotals = useMemo(() => {
    return telecomDailyBudgetRows.reduce(
      (acc, row) => {
        acc.budget += row.budget
        acc.spent += row.spent
        return acc
      },
      { budget: 0, spent: 0 },
    )
  }, [telecomDailyBudgetRows])

  async function saveDailyBudget(centerCode: string, centerLabel: string, budgetValue: number) {
    if (!Number.isFinite(budgetValue) || budgetValue < 0) {
      toast({
        title: "Orçamento inválido",
        description: "Informe um valor diário maior ou igual a zero.",
        variant: "destructive",
      })
      return
    }

    setSavingBudgetCenterCode(centerCode)

    try {
      const res = await fetch(FUEL_DAILY_BUDGET_SWR_KEY, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          centerCode,
          centerLabel,
          dailyBudget: Number(budgetValue.toFixed(2)),
        }),
      })

      const data = await res.json().catch(() => ({}))

      if (!res.ok) {
        throw new Error(data?.error || "Falha ao salvar orçamento diário.")
      }

      await mutateDailyBudgets()
      toast({
        title: "Orçamento diário salvo",
        description: `${centerCode} atualizado para ${formatCompactCurrency(budgetValue)}.`,
      })
    } catch (error) {
      toast({
        title: "Erro ao salvar orçamento",
        description: error instanceof Error ? error.message : "Não foi possível salvar no momento.",
        variant: "destructive",
      })
    } finally {
      setSavingBudgetCenterCode(null)
    }
  }

  async function handleSaveBudgetRow(row: TelecomDailyBudgetRow) {
    const rawDraft = budgetDrafts[row.centerCode]
    const hasDraft = typeof rawDraft === "string"
    const nextBudget = hasDraft ? parseBudgetInputValue(rawDraft) : row.budget
    await saveDailyBudget(row.centerCode, row.centerLabel, nextBudget)

    setBudgetDrafts((current) => {
      const next = { ...current }
      delete next[row.centerCode]
      return next
    })
  }

  const activeDailyCenterKey = useMemo(() => {
    if (!selectedDailyCenterKey) return null
    return selectedDayCostCenters.some((center) => center.key === selectedDailyCenterKey) ? selectedDailyCenterKey : null
  }, [selectedDailyCenterKey, selectedDayCostCenters])

  const activeDailyCenter = useMemo(() => {
    if (!activeDailyCenterKey) return null
    return selectedDayCostCenters.find((center) => center.key === activeDailyCenterKey) ?? null
  }, [activeDailyCenterKey, selectedDayCostCenters])

  function getDailyCenterKeyByCode(centerCode: string): string | null {
    const match = selectedDayCostCenters.find((center) => extractCostCenterCode(center.centroCusto) === centerCode)
    return match?.key ?? null
  }

  const selectedDayRecordsForList = useMemo(() => {
    if (!activeDailyCenterKey) return selectedDayScopedResolvedRecords.map((item) => item.record)

    return selectedDayScopedResolvedRecords
      .filter((item) => item.centerLabel.toLowerCase() === activeDailyCenterKey)
      .map((item) => item.record)
  }, [activeDailyCenterKey, selectedDayScopedResolvedRecords])

  const selectedDaySearchQuery = useMemo(() => normalizeSearchValue(dailyRecordsSearch), [dailyRecordsSearch])

  const selectedDayRecordsForDisplay = useMemo(() => {
    return selectedDayRecordsForList.filter((record) => matchesRecordSearch(record, selectedDaySearchQuery))
  }, [selectedDayRecordsForList, selectedDaySearchQuery])

  const selectedWeeklyPoint = useMemo(() => {
    if (insights.weeklySeries.length === 0) return null

    const fromState = selectedWeeklyStartKey
      ? insights.weeklySeries.find((entry) => entry.startKey === selectedWeeklyStartKey) ?? null
      : null

    return fromState ?? insights.weeklySeries[insights.weeklySeries.length - 1]
  }, [insights.weeklySeries, selectedWeeklyStartKey])

  const selectedWeekRange = useMemo(() => {
    if (!selectedWeeklyPoint?.startKey || !selectedWeeklyPoint.endKey) return null

    const start = fromDateKey(selectedWeeklyPoint.startKey)
    const end = fromDateKey(selectedWeeklyPoint.endKey)
    if (!start || !end) return null

    return {
      start: startOfDay(start),
      end: endOfDay(end),
    }
  }, [selectedWeeklyPoint])

  const selectedWeekRecords = useMemo(() => {
    if (!selectedWeekRange) return []

    return filteredRecords
      .filter((record) => record.parsedDate >= selectedWeekRange.start && record.parsedDate <= selectedWeekRange.end)
      .sort((left, right) => right.parsedDate.getTime() - left.parsedDate.getTime())
  }, [filteredRecords, selectedWeekRange])

  const selectedWeekScopedRecords = useMemo(() => {
    if (weeklyScopeFilter === "all") return selectedWeekRecords

    return selectedWeekRecords.filter((record) => {
      const driver = normalizePersonName(record.nomeMotorista, record.cpfMotorista)
      const resolved = resolveCostCenterRecord(driver, costCenterLookup)
      const centerLabel = resolved?.centroCusto || "Sem centro de custo"
      return weeklyScopeFilter === "telecom" ? isTelecomCostCenter(centerLabel) : isEngineeringCostCenter(centerLabel)
    })
  }, [costCenterLookup, selectedWeekRecords, weeklyScopeFilter])

  const selectedWeekScopedResolvedRecords = useMemo(() => {
    return selectedWeekScopedRecords.map((record) => {
      const driver = normalizePersonName(record.nomeMotorista, record.cpfMotorista)
      const resolved = resolveCostCenterRecord(driver, costCenterLookup)
      const centerLabel = resolved?.centroCusto || "Sem centro de custo"

      return {
        record,
        centerLabel,
      }
    })
  }, [costCenterLookup, selectedWeekScopedRecords])

  const selectedWeekCostCenters = useMemo(() => {
    const aggregation = new Map<
      string,
      {
        centroCusto: string
        total: number
        transactions: number
        drivers: Set<string>
      }
    >()

    for (const item of selectedWeekScopedResolvedRecords) {
      const driver = normalizePersonName(item.record.nomeMotorista, item.record.cpfMotorista)
      const centerLabel = item.centerLabel
      const key = centerLabel.toLowerCase()
      const current = aggregation.get(key)

      if (current) {
        current.total += item.record.valor
        current.transactions += 1
        current.drivers.add(driver)
      } else {
        aggregation.set(key, {
          centroCusto: centerLabel,
          total: item.record.valor,
          transactions: 1,
          drivers: new Set([driver]),
        })
      }
    }

    return Array.from(aggregation.values())
      .map((item) => ({
        key: item.centroCusto.toLowerCase(),
        centroCusto: item.centroCusto,
        total: item.total,
        transactions: item.transactions,
        drivers: item.drivers.size,
        telecom: isTelecomCostCenter(item.centroCusto),
        engineering: isEngineeringCostCenter(item.centroCusto),
      }))
      .sort((left, right) => right.total - left.total)
  }, [selectedWeekScopedResolvedRecords])

  const selectedWeekCostCentersTotal = useMemo(() => {
    return selectedWeekCostCenters.reduce((total, center) => total + center.total, 0)
  }, [selectedWeekCostCenters])

  const daysInSelectedWeek = useMemo(() => {
    if (!selectedWeekRange) return 7

    const diffDays =
      Math.round((startOfDay(selectedWeekRange.end).getTime() - startOfDay(selectedWeekRange.start).getTime()) / (24 * 60 * 60 * 1000)) + 1

    return diffDays > 0 ? diffDays : 7
  }, [selectedWeekRange])

  const selectedWeekTelecomSpentByCode = useMemo(() => {
    const totals = new Map<string, { total: number; centerLabel: string }>()

    for (const record of selectedWeekRecords) {
      const driver = normalizePersonName(record.nomeMotorista, record.cpfMotorista)
      const resolved = resolveCostCenterRecord(driver, costCenterLookup)
      const centerLabel = resolved?.centroCusto || ""

      if (!isTelecomCostCenter(centerLabel)) continue

      const centerCode = extractCostCenterCode(centerLabel)
      if (!centerCode) continue

      const current = totals.get(centerCode)
      totals.set(centerCode, {
        total: (current?.total ?? 0) + record.valor,
        centerLabel: current?.centerLabel || centerLabel,
      })
    }

    return totals
  }, [costCenterLookup, selectedWeekRecords])

  const telecomWeeklyBudgetRows = useMemo<TelecomDailyBudgetRow[]>(() => {
    const budgetsByCode = new Map<string, FuelDailyBudgetItem>()

    for (const item of dailyBudgetItems) {
      budgetsByCode.set(item.centerCode, item)
    }

    const rows: TelecomDailyBudgetRow[] = []

    for (const [centerCode, budget] of budgetsByCode.entries()) {
      const spent = selectedWeekTelecomSpentByCode.get(centerCode)?.total ?? 0
      const centerLabel = selectedWeekTelecomSpentByCode.get(centerCode)?.centerLabel || budget.centerLabel || centerCode
      rows.push({
        centerCode,
        centerLabel,
        budget: Number((budget.dailyBudget * daysInSelectedWeek).toFixed(2)),
        spent,
      })
    }

    for (const [centerCode, spentData] of selectedWeekTelecomSpentByCode.entries()) {
      if (budgetsByCode.has(centerCode)) continue

      rows.push({
        centerCode,
        centerLabel: spentData.centerLabel || centerCode,
        budget: 0,
        spent: spentData.total,
      })
    }

    return rows.sort((left, right) => Number(left.centerCode) - Number(right.centerCode))
  }, [dailyBudgetItems, daysInSelectedWeek, selectedWeekTelecomSpentByCode])

  const telecomWeeklyBudgetTotals = useMemo(() => {
    return telecomWeeklyBudgetRows.reduce(
      (acc, row) => {
        acc.budget += row.budget
        acc.spent += row.spent
        return acc
      },
      { budget: 0, spent: 0 },
    )
  }, [telecomWeeklyBudgetRows])

  function getWeeklyCenterKeyByCode(centerCode: string): string | null {
    const match = selectedWeekCostCenters.find((center) => extractCostCenterCode(center.centroCusto) === centerCode)
    return match?.key ?? null
  }

  const activeWeeklyCenterKey = useMemo(() => {
    if (!selectedWeeklyCenterKey) return null
    const exists = selectedWeekCostCenters.some((center) => center.key === selectedWeeklyCenterKey)
    return exists ? selectedWeeklyCenterKey : null
  }, [selectedWeekCostCenters, selectedWeeklyCenterKey])

  const activeWeeklyCenter = useMemo(() => {
    if (!activeWeeklyCenterKey) return null
    return selectedWeekCostCenters.find((center) => center.key === activeWeeklyCenterKey) ?? null
  }, [activeWeeklyCenterKey, selectedWeekCostCenters])

  const selectedWeekRecordsForList = useMemo(() => {
    if (!activeWeeklyCenterKey) {
      return selectedWeekScopedResolvedRecords.map((item) => item.record)
    }

    return selectedWeekScopedResolvedRecords
      .filter((item) => item.centerLabel.toLowerCase() === activeWeeklyCenterKey)
      .map((item) => item.record)
  }, [activeWeeklyCenterKey, selectedWeekScopedResolvedRecords])

  const selectedWeekSearchQuery = useMemo(() => normalizeSearchValue(weeklyRecordsSearch), [weeklyRecordsSearch])

  const selectedWeekRecordsForDisplay = useMemo(() => {
    return selectedWeekRecordsForList.filter((record) => matchesRecordSearch(record, selectedWeekSearchQuery))
  }, [selectedWeekRecordsForList, selectedWeekSearchQuery])

  return (
    <div className="space-y-4">
      <Card className="border-[#d8dfd1] bg-[linear-gradient(180deg,#fcfdfb_0%,#f5f8f2_100%)] shadow-sm">
        <CardContent className="grid gap-4 p-5 lg:grid-cols-[220px_220px_1fr] lg:items-end">
          <div className="space-y-2">
            <Label htmlFor="fuel-month-select">Competência mensal</Label>
            <Select value={selectedMonth ?? currentMonth ?? undefined} onValueChange={setSelectedMonth}>
              <SelectTrigger id="fuel-month-select" className="w-full bg-white">
                <SelectValue placeholder="Selecione a competência" />
              </SelectTrigger>
              <SelectContent>
                {availableMonths.map((month) => (
                  <SelectItem key={month.month} value={month.month}>
                    {month.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="fuel-analytics-preset">Período analítico</Label>
            <Select value={analyticsPreset} onValueChange={(value) => setAnalyticsPreset(value as FuelAnalyticsPreset)}>
              <SelectTrigger id="fuel-analytics-preset" className="w-full bg-white">
                <SelectValue placeholder="Selecione o período" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="current-month">{selectedMonth === currentMonth ? "Mês atual" : "Competência inteira"}</SelectItem>
                <SelectItem value="last-7-days">Últimos 7 dias</SelectItem>
                <SelectItem value="last-30-days">Últimos 30 dias</SelectItem>
                <SelectItem value="last-90-days">Últimos 90 dias</SelectItem>
                <SelectItem value="custom">Período personalizado</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_180px_180px]">
            <div className="rounded-2xl border border-[#dfe7d8] bg-white/90 px-4 py-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">{summaryCard.title}</p>
                  <p className="mt-1 text-sm font-medium text-slate-800">{summaryCard.subtitle}</p>
                </div>
                <Badge variant="outline" className="border-[#cfe0c5] bg-[#f5faf1] text-[#56814e]">
                  {summaryCard.badgeLabel}
                </Badge>
              </div>
              <p className="mt-3 text-xs text-slate-500">
                {summaryCard.recordCount} registros • {formatCurrency(summaryCard.total)}
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="fuel-analytics-start">Data inicial</Label>
              <Input
                id="fuel-analytics-start"
                type="date"
                value={effectiveCustomRange.start}
                onChange={(event) =>
                  setCustomRange({
                    seed: customRangeSeed,
                    start: event.target.value,
                    end: effectiveCustomRange.end,
                  })
                }
                disabled={analyticsPreset !== "custom"}
                className="bg-white"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="fuel-analytics-end">Data final</Label>
              <Input
                id="fuel-analytics-end"
                type="date"
                value={effectiveCustomRange.end}
                onChange={(event) =>
                  setCustomRange({
                    seed: customRangeSeed,
                    start: effectiveCustomRange.start,
                    end: event.target.value,
                  })
                }
                disabled={analyticsPreset !== "custom"}
                className="bg-white"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 xl:grid-cols-3">
        <Card className="overflow-hidden border-[#d8dfd1] bg-[linear-gradient(180deg,#fbfcfa_0%,#f4f7f1_100%)] shadow-sm">
          <CardHeader className="border-b border-[#e2eadc] pb-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <CardTitle className="text-lg text-slate-900">Gasto diário</CardTitle>
                <p className="mt-1 text-sm text-slate-500">{analyticsCopy.dailyDescription}</p>
              </div>
              <div className="text-right">
                <p className="text-xs uppercase tracking-[0.12em] text-slate-500">{analyticsCopy.dailyMetricLabel}</p>
                <p className="text-2xl font-black tracking-tight text-[#376b40]">{formatCurrency(insights.dailyMetric)}</p>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-5">
            <ChartContainer className="h-[230px] w-full" config={periodChartConfig}>
              <BarChart data={insights.dailySeries} margin={{ left: 0, right: 8, top: 12, bottom: 0 }}>
                <CartesianGrid vertical={false} strokeDasharray="3 3" />
                <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} />
                <YAxis hide />
                <Bar
                  dataKey="total"
                  radius={[8, 8, 0, 0]}
                  cursor="pointer"
                  onClick={(_, index) => {
                    setSelectedDailyKey(insights.dailySeries[index]?.dateKey ?? null)
                    setIsDailyDetailOpen(true)
                  }}
                >
                  {insights.dailySeries.map((entry) => {
                    const isActive = !!selectedDailyPoint?.dateKey && selectedDailyPoint.dateKey === entry.dateKey
                    return <Cell key={entry.dateKey ?? entry.label} fill={isActive ? "#4f8f57" : "var(--color-total)"} />
                  })}
                </Bar>
                <ChartTooltip content={<ChartTooltipContent formatter={(value) => formatCurrency(Number(value))} />} />
              </BarChart>
            </ChartContainer>

            <div className="mt-5 border-t border-[#e4ebde] pt-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-semibold text-slate-800">
                  {selectedDailyDate ? `Dia selecionado: ${formatFullDate(selectedDailyDate)}` : "Selecione um dia"}
                </p>
                <p className="text-sm font-bold text-[#376b40]">{formatCurrency(selectedDailyPoint?.total ?? 0)}</p>
              </div>
              <p className="mt-1 text-xs text-slate-500">Clique em uma barra para abrir o detalhamento em tela cheia.</p>
            </div>
          </CardContent>
        </Card>

        <Card className="overflow-hidden border-[#d8dfd1] bg-[linear-gradient(180deg,#fbfcfa_0%,#f4f7f1_100%)] shadow-sm">
          <CardHeader className="border-b border-[#e2eadc] pb-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <CardTitle className="text-lg text-slate-900">{analyticsCopy.weeklyTitle}</CardTitle>
                <p className="mt-1 text-sm text-slate-500">{analyticsCopy.weeklyDescription}</p>
              </div>
              <div className="text-right">
                <p className="text-xs uppercase tracking-[0.12em] text-slate-500">{analyticsCopy.weeklyMetricLabel}</p>
                <p className="text-2xl font-black tracking-tight text-[#376b40]">{formatCurrency(insights.weeklyMetric)}</p>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-5">
            <ChartContainer className="h-[230px] w-full" config={weeklyChartConfig}>
              <ComposedChart data={insights.weeklySeries} margin={{ left: 0, right: 8, top: 12, bottom: 0 }}>
                <CartesianGrid vertical={false} strokeDasharray="3 3" />
                <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} />
                <YAxis hide />
                <Bar
                  dataKey="total"
                  radius={[8, 8, 0, 0]}
                  cursor="pointer"
                  onClick={(_, index) => {
                    setSelectedWeeklyStartKey(insights.weeklySeries[index]?.startKey ?? null)
                    setIsWeeklyDetailOpen(true)
                  }}
                >
                  {insights.weeklySeries.map((entry) => {
                    const isActive = !!selectedWeeklyPoint?.startKey && selectedWeeklyPoint.startKey === entry.startKey
                    return <Cell key={entry.startKey ?? entry.label} fill={isActive ? "#4f8f57" : "var(--color-total)"} />
                  })}
                </Bar>
                <Line type="monotone" dataKey="average" stroke="var(--color-average)" strokeWidth={3} dot={false} />
                <ChartTooltip
                  content={
                    <ChartTooltipContent
                      formatter={(value, name) => (
                        <div className="flex min-w-[11rem] items-center justify-between gap-3">
                          <span className="text-muted-foreground">{name === "average" ? "Média acumulada" : "Total da semana"}</span>
                          <span className="font-mono font-medium tabular-nums text-foreground">{formatCurrency(Number(value))}</span>
                        </div>
                      )}
                    />
                  }
                />
                <ChartLegend content={<ChartLegendContent />} />
              </ComposedChart>
            </ChartContainer>

            <div className="mt-5 border-t border-[#e4ebde] pt-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-semibold text-slate-800">
                  {selectedWeekRange ? `Semana selecionada: ${formatCompactDate(selectedWeekRange.start)} a ${formatCompactDate(selectedWeekRange.end)}` : "Selecione uma semana"}
                </p>
                <p className="text-sm font-bold text-[#376b40]">{formatCurrency(selectedWeeklyPoint?.total ?? 0)}</p>
              </div>
              <p className="mt-1 text-xs text-slate-500">Clique em uma barra para abrir os detalhes da semana e a aba de metas semanais.</p>
            </div>
          </CardContent>
        </Card>

        <Card className="overflow-hidden border-[#d8dfd1] bg-[linear-gradient(180deg,#fbfcfa_0%,#f4f7f1_100%)] shadow-sm">
          <CardHeader className="border-b border-[#e2eadc] pb-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <CardTitle className="text-lg text-slate-900">{analyticsCopy.monthlyTitle}</CardTitle>
                <p className="mt-1 text-sm text-slate-500">{analyticsCopy.monthlyDescription}</p>
              </div>
              <div className="text-right">
                <p className="text-xs uppercase tracking-[0.12em] text-slate-500">{analyticsCopy.monthlyMetricLabel}</p>
                <p className="text-2xl font-black tracking-tight text-[#376b40]">{formatCurrency(insights.monthlyMetric)}</p>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-5">
            <ChartContainer className="h-[230px] w-full" config={periodChartConfig}>
              <BarChart data={insights.monthlySeries} margin={{ left: 0, right: 8, top: 12, bottom: 0 }}>
                <CartesianGrid vertical={false} strokeDasharray="3 3" />
                <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} />
                <YAxis hide />
                <Bar dataKey="total" fill="var(--color-total)" radius={[8, 8, 0, 0]} />
                <ChartTooltip content={<ChartTooltipContent formatter={(value) => formatCurrency(Number(value))} />} />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
        <Card className="overflow-hidden border-[#d8dfd1] bg-[linear-gradient(180deg,#f8fbf6_0%,#f1f6ee_100%)] shadow-sm">
          <CardHeader className="border-b border-[#dfe8d9] pb-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <CardTitle className="text-xl text-slate-900">Gastos por tipo de combustível</CardTitle>
                <p className="mt-1 text-sm text-slate-500">Distribuição dentro de {insights.periodLabel}</p>
              </div>
              <div className="text-right">
                <p className="text-sm font-medium text-[#5b9157]">Total do período</p>
                <p className="text-3xl font-black tracking-tight text-[#356b3e]">{formatCurrency(insights.periodTotal)}</p>
              </div>
            </div>
          </CardHeader>
          <CardContent className="grid gap-5 p-5 lg:grid-cols-[minmax(0,0.9fr)_minmax(260px,0.95fr)] lg:items-center">
            <ChartContainer className="mx-auto h-[250px] w-full max-w-[330px]" config={{}}>
              <PieChart>
                <Pie data={insights.fuelBreakdown} dataKey="value" nameKey="name" innerRadius={62} outerRadius={102} paddingAngle={3} strokeWidth={0}>
                  {insights.fuelBreakdown.map((entry) => (
                    <Cell key={entry.name} fill={entry.color} />
                  ))}
                </Pie>
                <ChartTooltip content={<ChartTooltipContent formatter={(value) => formatCurrency(Number(value))} hideLabel />} />
              </PieChart>
            </ChartContainer>

            <div className="space-y-3 rounded-2xl border border-[#dce6d6] bg-white/85 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.9)]">
              {insights.fuelBreakdown.length === 0 ? (
                <div className="flex h-[220px] items-center justify-center rounded-xl border border-dashed border-[#dce6d6] text-sm text-slate-500">
                  Nenhum dado importado para montar o gráfico.
                </div>
              ) : (
                insights.fuelBreakdown.map((item) => (
                  <div key={item.name} className="flex items-center justify-between gap-4 border-b border-[#edf2ea] pb-3 last:border-b-0 last:pb-0">
                    <div className="flex items-center gap-3">
                      <span className="h-3.5 w-3.5 rounded-full" style={{ backgroundColor: item.color }} />
                      <div>
                        <p className="font-semibold text-slate-800">{item.name}</p>
                        <p className="text-xs uppercase tracking-[0.12em] text-slate-400">{item.percentage.toFixed(1)}%</p>
                      </div>
                    </div>
                    <p className="text-right text-lg font-bold text-slate-900">{formatCurrency(item.value)}</p>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="overflow-hidden border-[#d8dfd1] bg-[linear-gradient(180deg,#fafcf9_0%,#f2f6ef_100%)] shadow-sm">
          <CardHeader className="border-b border-[#dfe8d9] pb-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <CardTitle className="text-xl text-slate-900">Comparativo semanal entre competências</CardTitle>
                <p className="mt-1 text-sm text-slate-500">Semanas 1 a 5 das 3 competências mais recentes</p>
              </div>
              <div className="text-right">
                <p className="text-sm font-medium text-slate-500">Competências comparadas</p>
                <p className="text-3xl font-black tracking-tight text-slate-900">{weeklyComparison.months.length}</p>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-5">
            {weeklyComparison.points.length === 0 || weeklyComparison.months.length === 0 ? (
              <div className="flex h-[300px] items-center justify-center rounded-xl border border-dashed border-[#dce6d6] text-sm text-slate-500">
                Importe mais competências para liberar o comparativo semanal histórico.
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex flex-wrap gap-2">
                  {weeklyComparison.months.map((month) => (
                    (() => {
                      const isHighlighted = analyticsPreset === "custom" ? rangeMonthKeys.has(month.key) : month.key === selectedMonth
                      const badgeText = analyticsPreset === "custom" ? "No recorte" : "Atual seleção"

                      return (
                    <div
                      key={month.key}
                      className={
                        isHighlighted
                          ? "flex items-center gap-2 rounded-full border border-[#d7d3a4] bg-[#fff8d8] px-3 py-1.5 text-xs font-semibold text-[#7b6a16] shadow-sm"
                          : "flex items-center gap-2 rounded-full border border-[#dbe6d6] bg-white px-3 py-1.5 text-xs font-medium text-slate-700 shadow-sm"
                      }
                    >
                      <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: month.color }} />
                      <span>{month.label}</span>
                      {isHighlighted ? <span className="rounded-full bg-[#efe2a2] px-2 py-0.5 text-[10px] uppercase tracking-[0.12em]">{badgeText}</span> : null}
                    </div>
                      )
                    })()
                  ))}
                </div>

                <ChartContainer className="h-[300px] w-full" config={weeklyComparisonChartConfig}>
                  <ComposedChart data={weeklyComparison.points} margin={{ left: 8, right: 12, top: 16, bottom: 8 }}>
                    <CartesianGrid vertical={false} strokeDasharray="3 3" />
                    <XAxis dataKey="weekLabel" tickLine={false} axisLine={false} tickMargin={8} />
                    <YAxis tickLine={false} axisLine={false} tickFormatter={(value: number) => `R$ ${Math.round(value).toLocaleString("pt-BR")}`} />
                    {weeklyComparison.months.map((month) => {
                      const isHighlighted = analyticsPreset === "custom" ? rangeMonthKeys.has(month.key) : month.key === selectedMonth

                      return (
                        <Line
                          key={month.key}
                          type="monotone"
                          dataKey={month.key}
                          stroke={`var(--color-${month.key})`}
                          strokeWidth={isHighlighted ? 4 : 3}
                          dot={{ r: isHighlighted ? 4 : 3, fill: `var(--color-${month.key})` }}
                          activeDot={{ r: isHighlighted ? 6 : 5 }}
                        />
                      )
                    })}
                    <ChartTooltip content={<ChartTooltipContent formatter={(value) => formatCurrency(Number(value))} />} />
                  </ComposedChart>
                </ChartContainer>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <Card className="relative overflow-hidden rounded-[1.35rem] border border-[#ddd1f5] bg-[linear-gradient(180deg,#f5f0ff_0%,#ece4fb_100%)] shadow-[0_10px_24px_rgba(124,58,237,0.10)]">
          <div className="absolute -right-3 -top-3 h-12 w-12 rounded-full bg-[#c3b0f2]/22 blur-2xl" />
          <div className="absolute inset-x-0 top-0 h-1 bg-[linear-gradient(90deg,rgba(255,255,255,0.7),rgba(255,255,255,0),rgba(255,255,255,0.55))]" />
          <CardContent className="relative flex min-h-[98px] items-start gap-3 p-4 sm:p-4.5">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[0.95rem] border border-white/70 bg-[#ede2ff] text-[#5b1fc7] shadow-sm">
              <Fuel className="h-4 w-4" />
            </div>
            <div className="min-w-0 flex-1 pt-0.5">
              <p className="text-[1.7rem] font-extrabold leading-none tracking-[-0.03em] text-slate-900">{formatCurrency(billingCycleFuelTotal)}</p>
              <p className="mt-1.5 text-[0.9rem] font-semibold leading-tight text-slate-700">Faturamento Mensal</p>
              <p className="mt-1 text-[0.76rem] leading-tight text-slate-500">Ciclo {formatShortDate(billingCycle.start)} a {formatShortDate(billingCycle.end)}</p>
              <p className="mt-1 text-[0.76rem] leading-tight text-slate-500">
                {lastImportedLabel ? `Última atualização: ${lastImportedLabel}` : "Última atualização: sem importação registrada"}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-[#d8dfd1] bg-[linear-gradient(180deg,#fbfcfa_0%,#f3f5f1_100%)] shadow-sm">
          <CardContent className="flex items-start justify-between gap-4 p-5">
            <div>
              <p className="text-sm font-medium text-slate-500">Total transações</p>
              <p className="mt-1 text-4xl font-black tracking-tight text-slate-900">{insights.periodCount}</p>
              <p className="mt-1 text-sm text-slate-500">Movimentações no período</p>
            </div>
            <div className="rounded-2xl bg-[#f2e7c9] p-3 text-[#b48225]">
              <Receipt className="h-6 w-6" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-[#d8dfd1] bg-[linear-gradient(180deg,#fbfcfa_0%,#f3f6fb_100%)] shadow-sm">
          <CardContent className="flex items-start justify-between gap-4 p-5">
            <div>
              <p className="text-sm font-medium text-slate-500">Base de pessoas</p>
              <p className="mt-1 text-4xl font-black tracking-tight text-slate-900">{insights.activePeople}</p>
              <p className="mt-1 text-sm text-slate-500">Cadastradas e ativas</p>
            </div>
            <div className="rounded-2xl bg-[#e4eef8] p-3 text-[#4f9bc9]">
              <Users className="h-6 w-6" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-[#d8dfd1] bg-[linear-gradient(180deg,#f8fbf8_0%,#eef5ef_100%)] shadow-sm">
          <CardContent className="flex items-start justify-between gap-4 p-5">
            <div>
              <p className="text-sm font-medium text-slate-500">Participação do grupo analisado</p>
              <p className="mt-1 text-4xl font-black tracking-tight text-slate-900">{insights.topSpendersShare.toFixed(1)}%</p>
              <p className="mt-1 text-sm text-slate-500">Do valor total filtrado</p>
            </div>
            <div className="rounded-2xl bg-[#ddeedd] p-3 text-[#5b9b5f]">
              <TrendingUp className="h-6 w-6" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-[#d8dfd1] bg-[linear-gradient(180deg,#f8fbf8_0%,#eef5ef_100%)] shadow-sm">
          <CardContent className="flex items-start justify-between gap-4 p-5">
            <div>
              <p className="text-sm font-medium text-slate-500">Combustível dominante</p>
              <p className="mt-1 text-3xl font-black tracking-tight text-slate-900">{insights.fuelBreakdown[0]?.name ?? "Sem dados"}</p>
              <p className="mt-1 text-sm text-slate-500">
                {insights.fuelBreakdown[0] ? `${insights.fuelBreakdown[0].percentage.toFixed(1)}% por volume transacionado` : "Sem base suficiente"}
              </p>
            </div>
            <div className="rounded-2xl bg-[#e6f0e4] p-3 text-[#5b9b5f]">
              <Droplets className="h-6 w-6" />
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.15fr)_320px]">
        <Card className="overflow-hidden border-[#d8dfd1] bg-[linear-gradient(180deg,#fbfcfa_0%,#f4f7f1_100%)] shadow-sm">
          <CardHeader className="border-b border-[#e7eee2] pb-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <CardTitle className="text-xl text-slate-900">Maiores consumos por pessoa</CardTitle>
                <p className="mt-1 text-sm text-slate-500">Leitura dos 10 nomes com maior gasto dentro do período filtrado</p>
              </div>
              <Badge variant="outline" className="border-[#cfe0c5] bg-[#f5faf1] text-[#56814e]">
                Grupo do período
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="p-5">
            {rankingChartData.length === 0 ? (
              <div className="flex h-[280px] items-center justify-center rounded-xl border border-dashed border-[#dce6d6] text-sm text-slate-500">
                Importe um relatório para gerar a lista.
              </div>
            ) : (
              <div className="space-y-4">
                <div className="rounded-2xl border border-[#dce6d6] bg-white/80 p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.9)]">
                  <ChartContainer className="h-[300px] w-full" config={rankingChartConfig}>
                  <BarChart data={rankingChartData} layout="vertical" margin={{ left: 18, right: 110, top: 6, bottom: 6 }}>
                    <CartesianGrid horizontal={false} strokeDasharray="3 3" />
                    <XAxis type="number" hide />
                    <YAxis
                      type="category"
                      dataKey="name"
                      width={138}
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={formatRankingPersonLabel}
                    />
                    <Bar dataKey="total" radius={[0, 8, 8, 0]}>
                      <LabelList
                        dataKey="total"
                        position="right"
                        offset={12}
                        formatter={(value) => formatCompactCurrency(Number(value ?? 0))}
                        className="fill-slate-700 text-[12px] font-semibold"
                      />
                      {rankingChartData.map((entry) => (
                        <Cell key={entry.key} fill={entry.barColor} />
                      ))}
                    </Bar>
                    <ChartTooltip
                      content={
                        <ChartTooltipContent
                          formatter={(value, _name, item) => {
                            const payload = item.payload as TopSpenderDatum

                            return (
                              <div className="min-w-[14rem] space-y-2">
                                <div className="space-y-1">
                                  <p className="font-semibold text-foreground">{payload.name}</p>
                                  <p className="text-xs text-muted-foreground">{payload.centroCusto || "Centro de custo não vinculado"}</p>
                                </div>
                                <div className="space-y-1 text-sm">
                                  <div className="flex items-center justify-between gap-3">
                                    <span className="text-muted-foreground">Gasto</span>
                                    <span className="font-mono font-medium tabular-nums text-foreground">{formatCurrency(Number(value))}</span>
                                  </div>
                                  <div className="flex items-center justify-between gap-3">
                                    <span className="text-muted-foreground">Abastecimentos</span>
                                    <span className="font-medium text-foreground">{payload.transactions}</span>
                                  </div>
                                  <div className="flex items-center justify-between gap-3">
                                    <span className="text-muted-foreground">Supervisor</span>
                                    <span className="max-w-[8rem] truncate text-right font-medium text-foreground">{payload.supervisor || "-"}</span>
                                  </div>
                                </div>
                              </div>
                            )
                          }}
                        />
                      }
                    />
                  </BarChart>
                  </ChartContainer>
                </div>
                {unmatchedDriversPreview.length > 0 ? (
                  <div className="rounded-2xl border border-[#f2d6cc] bg-[#fffdfc] p-4">
                    <div className="flex items-center justify-between gap-3 border-b border-[#f2d6cc] pb-3">
                      <div>
                        <p className="text-sm font-semibold text-slate-900">Quem compõe o “Sem centro de custo” deste gráfico</p>
                        <p className="mt-1 text-xs text-slate-500">Lista calculada no mesmo recorte e com a mesma base do ranking acima.</p>
                      </div>
                      <Badge variant="outline" className="border-[#f1c8ba] bg-[#fff1eb] text-[#b85e54]">
                        {unmatchedDriversPreview.length} item(ns)
                      </Badge>
                    </div>
                    <div className="mt-3 space-y-2">
                      {unmatchedDriversPreview.map((driver) => (
                        <div key={driver.key} className="grid gap-2 rounded-xl border border-[#f3d8d0] bg-white/90 p-3 md:grid-cols-[minmax(0,1.4fr)_0.9fr_0.9fr_110px_130px] md:items-center">
                          <div>
                            <p className="text-sm font-semibold text-slate-900">{formatUnmatchedPersonLabel(driver)}</p>
                            <p className="mt-1 text-xs text-slate-500">{driver.name.trim() === "Não identificado" ? "Nome não veio preenchido no relatório." : "Motorista sem vínculo de centro de custo."}</p>
                          </div>
                          <div className="text-xs text-slate-600">
                            <span className="font-semibold text-slate-700">CPF:</span> {driver.cpf || "-"}
                          </div>
                          <div className="text-xs text-slate-600">
                            <span className="font-semibold text-slate-700">Placa:</span> {driver.plate || "-"}
                          </div>
                          <div className="text-xs text-slate-600">
                            <span className="font-semibold text-slate-700">Qtd:</span> {driver.transactions}
                          </div>
                          <div className="text-sm font-bold text-[#b85e54]">{formatCurrency(driver.total)}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}
                <div className="grid gap-3 rounded-2xl border border-[#dce6d6] bg-[#fbfcfa] p-4 md:grid-cols-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Principal nome do período</p>
                    <p className="mt-2 line-clamp-1 text-sm font-bold text-slate-900">{insights.topSpender?.name ?? "Sem dados"}</p>
                    <p className="mt-1 text-sm text-[#376b40]">{formatCurrency(insights.topSpender?.total ?? 0)}</p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Centro vinculado</p>
                    <p className="mt-2 line-clamp-1 text-sm font-bold text-slate-900">{insights.topSpender?.centroCusto || "Não vinculado"}</p>
                    <p className="mt-1 text-sm text-slate-500">{insights.topSpender?.transactions ?? 0} abastecimentos</p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Participação do grupo</p>
                    <p className="mt-2 text-2xl font-black tracking-tight text-slate-900">{insights.topSpendersShare.toFixed(1)}%</p>
                    <p className="mt-1 text-sm text-slate-500">do total filtrado</p>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="grid gap-4">
          <Card className="overflow-hidden border-[#d8dfd1] bg-[linear-gradient(180deg,#fbfcfa_0%,#f4f7f1_100%)] shadow-sm">
            <CardContent className="p-4">
              <Tabs defaultValue="top1" className="gap-4">
                <TabsList className="grid h-auto w-full grid-cols-3 rounded-xl border border-[#dce6d6] bg-white/80 p-1 shadow-[inset_0_1px_0_rgba(255,255,255,0.9)]">
                  <TabsTrigger value="top1" className="rounded-lg py-2 text-xs font-semibold data-[state=active]:text-[#376b40]">
                    Destaque
                  </TabsTrigger>
                  <TabsTrigger value="centro" className="rounded-lg py-2 text-xs font-semibold data-[state=active]:text-[#376b40]">
                    Centro
                  </TabsTrigger>
                  <TabsTrigger value="cobertura" className="rounded-lg py-2 text-xs font-semibold data-[state=active]:text-[#376b40]">
                    Cobertura
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="top1" className="rounded-2xl border border-[#dce6d6] bg-white/85 p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.9)]">
                  <div className="flex items-start gap-3">
                    <div className="rounded-2xl bg-[#e6f0e4] p-3 text-[#5b9b5f]">
                      <TrendingUp className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-slate-500">Principal destaque</p>
                      <p className="mt-1 text-xs uppercase tracking-[0.12em] text-slate-400">Maior consumo individual no período</p>
                    </div>
                  </div>
                  <p className="mt-5 line-clamp-2 text-2xl font-black leading-tight tracking-tight text-slate-900">{insights.topSpender?.name ?? "Sem dados"}</p>
                  <p className="mt-2 text-sm text-slate-500">{insights.topSpender?.centroCusto || "Centro de custo não vinculado"}</p>
                  <div className="mt-5 flex items-end justify-between gap-3 border-t border-[#e7eee2] pt-4">
                    <p className="text-3xl font-black tracking-tight text-[#376b40]">{formatCurrency(insights.topSpender?.total ?? 0)}</p>
                    <p className="text-xs text-slate-500">{insights.topSpender?.transactions ?? 0} abastecimentos</p>
                  </div>
                </TabsContent>

                <TabsContent value="centro" className="rounded-2xl border border-[#dce6d6] bg-white/85 p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.9)]">
                  <div className="flex items-start gap-3">
                    <div className="rounded-2xl bg-[#e6f0e4] p-3 text-[#5b9b5f]">
                      <Building2 className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-slate-500">Centro em destaque</p>
                      <p className="mt-1 text-xs uppercase tracking-[0.12em] text-slate-400">Maior concentração entre os 10 maiores</p>
                    </div>
                  </div>
                  <p className="mt-5 line-clamp-3 text-2xl font-black leading-tight tracking-tight text-slate-900">{insights.topCostCenter?.centroCusto ?? "Sem dados"}</p>
                  <div className="mt-5 flex items-end justify-between gap-3 border-t border-[#e7eee2] pt-4">
                    <p className="text-3xl font-black tracking-tight text-[#376b40]">{formatCurrency(insights.topCostCenter?.total ?? 0)}</p>
                    <p className="text-xs text-slate-500">Acumulado do grupo principal</p>
                  </div>
                </TabsContent>

                <TabsContent value="cobertura" className="rounded-2xl border border-[#dce6d6] bg-white/85 p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.9)]">
                  <div className="flex items-start gap-3">
                    <div className="rounded-2xl bg-[#e4eef8] p-3 text-[#4f9bc9]">
                      <Users className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-slate-500">Cobertura do cruzamento</p>
                      <p className="mt-1 text-xs uppercase tracking-[0.12em] text-slate-400">Vínculo entre consumo e centro de custo</p>
                    </div>
                  </div>
                  <div className="mt-5 grid gap-4 sm:grid-cols-2">
                    <div className="rounded-xl border border-[#e7eee2] bg-[#fbfcfa] p-4">
                      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">Nomes vinculados</p>
                      <p className="mt-2 text-3xl font-black tracking-tight text-slate-900">{insights.topSpendersMappedCount}/{insights.topSpenders.length}</p>
                      <p className="mt-1 text-sm text-slate-500">Com centro de custo identificado</p>
                    </div>
                    <div className="rounded-xl border border-[#e7eee2] bg-[#fbfcfa] p-4">
                      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">Ticket médio</p>
                      <p className="mt-2 text-3xl font-black tracking-tight text-slate-900">{formatCurrency(insights.avgTicket)}</p>
                      <p className="mt-1 text-sm text-slate-500">Média por abastecimento</p>
                    </div>
                  </div>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </div>
      </div>

      {unmatchedDriversPreview.length > 0 ? (
        <Card className="border-[#f2d6cc] bg-[linear-gradient(180deg,#fffdfc_0%,#fff6f2_100%)] shadow-sm">
          <CardHeader className="border-b border-[#f2d6cc] pb-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <div className="rounded-2xl bg-[#fde6df] p-3 text-[#d86c61]">
                  <AlertTriangle className="h-5 w-5" />
                </div>
                <div>
                  <CardTitle className="text-lg text-slate-900">Motoristas sem centro de custo</CardTitle>
                  <p className="mt-1 text-sm text-slate-500">Esses nomes estão no período atual, mas ainda não possuem vínculo com centro de custo.</p>
                </div>
              </div>
              <Badge variant="outline" className="border-[#f1c8ba] bg-[#fff1eb] text-[#b85e54]">
                {unmatchedDriversPreview.length} em destaque
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="grid gap-3 p-5 md:grid-cols-2 xl:grid-cols-3">
            {unmatchedDriversPreview.map((driver) => (
              <div key={driver.key} className="rounded-2xl border border-[#f3d8d0] bg-white/90 p-4">
                <p className="line-clamp-2 text-sm font-bold text-slate-900">{driver.name}</p>
                <p className="mt-2 text-lg font-black tracking-tight text-[#b85e54]">{formatCurrency(driver.total)}</p>
                <p className="mt-1 text-xs uppercase tracking-[0.12em] text-slate-500">{driver.transactions} abastecimentos</p>
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}

      <FuelCostCenterInsights
        records={filteredRecords}
        description={`Resumo do período ${insights.periodLabel} com os motoristas cruzados pela planilha de centro de custo.`}
      />

      <Dialog open={isDailyDetailOpen} onOpenChange={setIsDailyDetailOpen}>
        <DialogContent
          className="grid h-[95vh] w-[98vw] max-w-[98vw] grid-rows-[auto_minmax(0,1fr)] gap-0 overflow-hidden border-[#d8dfd1] bg-[linear-gradient(180deg,#f9fcf7_0%,#eef4ea_100%)] p-0 text-slate-900 sm:max-w-[98vw]"
          showCloseButton
        >
          <DialogHeader className="border-b border-[#dfe8d9] px-6 py-5 text-left">
            <DialogTitle className="text-2xl text-slate-900">
              {selectedDailyDate ? `Consumo detalhado - ${formatFullDate(selectedDailyDate)}` : "Consumo detalhado do dia"}
            </DialogTitle>
            <DialogDescription className="text-slate-600">
              {selectedDayScopedRecords.length} lançamentos filtrados - {selectedDayCostCenters.length} centros de custo - Total {formatCurrency(selectedDayCostCentersTotal)}
            </DialogDescription>
          </DialogHeader>

          <div className="min-h-0 overflow-hidden px-5 py-4 lg:px-6">
            <div className="flex h-full min-h-0 flex-col gap-3">
            <div className="flex flex-wrap items-end justify-between gap-3 rounded-xl border border-[#d8e4d2] bg-white/90 px-4 py-3">
              <div className="space-y-1.5">
                <Label htmlFor="daily-scope-filter" className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Escopo</Label>
                <Select
                  value={dailyScopeFilter}
                  onValueChange={(value) => {
                    setDailyScopeFilter(value as WeeklyScopeFilter)
                    setSelectedDailyCenterKey(null)
                  }}
                >
                  <SelectTrigger id="daily-scope-filter" className="h-9 w-[180px] bg-white">
                    <SelectValue placeholder="Selecione o escopo" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    <SelectItem value="telecom">Telecom</SelectItem>
                    <SelectItem value="engineering">Engenharia</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <p className="pb-1 text-xs text-slate-500">Escolha Telecom, Engenharia ou todos os centros de custo.</p>
            </div>

            <div className="grid min-h-0 flex-1 gap-3 lg:grid-cols-[minmax(0,1.12fr)_minmax(360px,0.98fr)] xl:grid-cols-[minmax(0,1.05fr)_minmax(380px,1fr)]">
              <div className="grid min-h-0 grid-rows-[auto_auto_minmax(0,1fr)] rounded-xl border border-[#d8e4d2] bg-[linear-gradient(180deg,#ffffff_0%,#fbfcfa_100%)] shadow-[inset_0_1px_0_rgba(255,255,255,0.88)]">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#e8efe2] px-4 py-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Lançamentos do dia</p>
                    <p className="mt-1 text-xs text-slate-500">
                      {activeDailyCenterKey
                        ? `Centro selecionado: ${selectedDayCostCenters.find((center) => center.key === activeDailyCenterKey)?.centroCusto ?? ""}`
                        : "Todos os centros do escopo selecionado"}
                    </p>
                  </div>
                  <span className="rounded-full border border-[#dce8d6] bg-[#f6fbf3] px-2.5 py-1 text-[11px] font-semibold text-[#4f7d48]">
                    {selectedDayRecordsForDisplay.length} lançamentos
                  </span>
                </div>
                <div className="px-4 pt-3">
                  <Input
                    value={dailyRecordsSearch}
                    onChange={(event) => setDailyRecordsSearch(event.target.value)}
                    placeholder="Buscar por colaborador ou placa"
                    className="h-9 bg-white"
                  />
                </div>
                <ScrollArea className="min-h-0 h-full px-4 py-3">
                {selectedDayRecordsForDisplay.length === 0 ? (
                  <p className="mt-4 text-sm text-slate-500">Não há lançamentos para o dia selecionado.</p>
                ) : (
                  <div className="space-y-1.5">
                    {selectedDayRecordsForDisplay.map((record) => {
                      const driver = normalizePersonName(record.nomeMotorista, record.cpfMotorista)

                      return (
                        <div key={`${record.dateTime}-${record.cardPlate}-${record.cpfMotorista}-${record.valor}`} className="rounded-lg border border-[#e8efe2] bg-white px-3 py-2 shadow-sm shadow-[#eef4ea]/40">
                          <div className="flex items-center justify-between gap-2">
                            <p className="truncate text-sm font-semibold text-slate-800">{driver}</p>
                            <p className="shrink-0 text-sm font-bold text-slate-900">{formatCurrency(record.valor)}</p>
                          </div>
                          <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[11px] text-slate-500">
                            <span className="rounded-full bg-[#f3f6f1] px-2 py-0.5">{formatTime(record.parsedDate)}</span>
                            <span className="rounded-full bg-[#f3f6f1] px-2 py-0.5">Placa {record.cardPlate || "-"}</span>
                            <span className="rounded-full bg-[#eef4f9] px-2 py-0.5 text-[#587c93]">{normalizeFuelType(record.tipoCombustivel)}</span>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
                </ScrollArea>
              </div>

              <div className="flex min-h-0 flex-col overflow-hidden rounded-xl border border-[#d8e4d2] bg-[linear-gradient(180deg,#ffffff_0%,#f8fbf6_100%)] shadow-[inset_0_1px_0_rgba(255,255,255,0.85)]">
                <div className="border-b border-[#e8efe2] px-4 py-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Centros de custo</p>
                      <p className="mt-1 text-xs text-slate-500">Selecione um centro para filtrar os lançamentos.</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="border-[#d9e6d1] bg-white text-[#557c4e]">
                        {selectedDayCostCenters.length} centro(s)
                      </Badge>
                      <div className="flex rounded-lg border border-[#d9e6d1] bg-white p-0.5">
                        <button
                          type="button"
                          onClick={() => setDailyRightPanelView("centers")}
                          className={
                            dailyRightPanelView === "centers"
                              ? "rounded-md bg-[#f4faef] px-2.5 py-1 text-[11px] font-semibold text-[#426a32]"
                              : "rounded-md px-2.5 py-1 text-[11px] font-semibold text-slate-500"
                          }
                        >
                          Centros
                        </button>
                        <button
                          type="button"
                          onClick={() => setDailyRightPanelView("budget")}
                          className={
                            dailyRightPanelView === "budget"
                              ? "rounded-md bg-[#f4faef] px-2.5 py-1 text-[11px] font-semibold text-[#426a32]"
                              : "rounded-md px-2.5 py-1 text-[11px] font-semibold text-slate-500"
                          }
                        >
                          Orçado
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="grid gap-2 border-b border-[#e8efe2] bg-[#f6faf3] px-4 py-3 sm:grid-cols-2">
                  <div className="rounded-xl border border-[#dde8d6] bg-white/95 px-3 py-3 shadow-sm shadow-[#eff5eb]/60">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">Total dos centros</p>
                    <p className="mt-1 text-xl font-black tracking-tight text-slate-900">{formatCurrency(selectedDayCostCentersTotal)}</p>
                    <p className="mt-1 text-[11px] text-slate-500">Rateio consolidado do dia selecionado</p>
                  </div>
                  <div className={activeDailyCenter ? "rounded-xl border border-[#cfe2c6] bg-[#f5fbf1] px-3 py-3 shadow-sm shadow-[#eff5eb]/60" : "rounded-xl border border-[#dde8d6] bg-white/95 px-3 py-3 shadow-sm shadow-[#eff5eb]/60"}>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">Filtro ativo</p>
                    <p className="mt-1 truncate text-sm font-bold text-slate-900">{activeDailyCenter?.centroCusto ?? "Todos os centros"}</p>
                    <p className="mt-1 text-[11px] text-slate-500">
                      {activeDailyCenter ? `${activeDailyCenter.transactions} lançamentos filtrados` : "Sem filtro específico aplicado"}
                    </p>
                  </div>
                </div>
                {dailyRightPanelView === "budget" ? (
                <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-[#fbfdf9]">
                  <div className="flex flex-wrap items-center justify-between gap-2 px-4 pt-3">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">Telecom - Orçado x gasto do dia</p>
                    <div className="flex items-center gap-2">
                      <Badge
                        variant="outline"
                        className={
                          telecomBudgetTotals.spent > telecomBudgetTotals.budget
                            ? "border-[#f1c8ba] bg-[#fff1eb] text-[#b85e54]"
                            : "border-[#d7e4cf] bg-[#f5faf1] text-[#4f7d48]"
                        }
                      >
                        {formatCurrency(telecomBudgetTotals.spent)} / {formatCurrency(telecomBudgetTotals.budget)}
                      </Badge>
                      {isMaster ? (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-7 border-[#cdddc3] px-2 text-[11px]"
                          onClick={() => {
                            setIsBudgetEditMode((current) => {
                              if (current) {
                                setBudgetDrafts({})
                              }

                              return !current
                            })
                          }}
                        >
                          {isBudgetEditMode ? "Concluir" : "Editar"}
                        </Button>
                      ) : null}
                    </div>
                  </div>

                  <div className="mt-3 flex-1 overflow-auto px-4 pb-3">
                    {isDailyBudgetLoading ? <p className="text-xs text-slate-500">Carregando limites diários...</p> : null}
                    {!isDailyBudgetLoading && telecomDailyBudgetRows.length === 0 ? (
                      <p className="text-xs text-slate-500">Nenhum centro telecom configurado para orçamento diário.</p>
                    ) : null}
                    {!isDailyBudgetLoading && telecomDailyBudgetRows.length > 0 ? (
                      <div className="overflow-hidden rounded-xl border border-[#e4ece0] bg-white shadow-sm shadow-[#eff4eb]/50">
                        <Table>
                          <TableHeader>
                            <TableRow className="bg-[#f6faf3] hover:bg-[#f6faf3]">
                              <TableHead className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">Centro</TableHead>
                              <TableHead className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">Orçado</TableHead>
                              <TableHead className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">Gasto</TableHead>
                              <TableHead className="text-right text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">Variação</TableHead>
                              {isMaster && isBudgetEditMode ? (
                                <TableHead className="w-[72px] text-right text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">Ação</TableHead>
                              ) : null}
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {telecomDailyBudgetRows.map((row) => {
                              const variance = row.spent - row.budget
                              const isOverBudget = row.spent > row.budget
                              const draftValue = budgetDrafts[row.centerCode]
                              const draftBudget = typeof draftValue === "string" ? parseBudgetInputValue(draftValue) : row.budget
                              const matchingCenterKey = getDailyCenterKeyByCode(row.centerCode)
                              const isSelected = matchingCenterKey !== null && activeDailyCenterKey === matchingCenterKey

                              return (
                                <TableRow
                                  key={`daily-modal-${row.centerCode}`}
                                  className={isSelected ? "bg-[#f4faef] hover:bg-[#f4faef]" : "hover:bg-[#fafcf9]"}
                                >
                                  <TableCell className="max-w-[220px]">
                                    <button
                                      type="button"
                                      className="min-w-0 text-left"
                                      onClick={() => {
                                        if (!matchingCenterKey) return
                                        setSelectedDailyCenterKey((current) => (current === matchingCenterKey ? null : matchingCenterKey))
                                      }}
                                    >
                                      <p className="truncate text-xs font-semibold text-slate-800">{row.centerLabel}</p>
                                      <p className="mt-0.5 truncate text-[10px] text-slate-500">
                                        {matchingCenterKey ? "Clique para filtrar os lançamentos" : "Sem lançamentos neste dia"}
                                      </p>
                                    </button>
                                  </TableCell>
                                  <TableCell>
                                    {isMaster && isBudgetEditMode ? (
                                      <Input
                                        value={draftValue ?? String(row.budget).replace(".", ",")}
                                        onChange={(event) =>
                                          setBudgetDrafts((current) => ({
                                            ...current,
                                            [row.centerCode]: event.target.value,
                                          }))
                                        }
                                        className="h-8 w-24 bg-white text-xs"
                                      />
                                    ) : (
                                      <span className="text-sm font-semibold text-slate-900">{formatCurrency(row.budget)}</span>
                                    )}
                                  </TableCell>
                                  <TableCell>
                                    <span className="text-sm font-semibold text-slate-900">{formatCurrency(row.spent)}</span>
                                  </TableCell>
                                  <TableCell className="text-right">
                                    <span
                                      className={
                                        isOverBudget
                                          ? "inline-flex rounded-full bg-[#fff1ef] px-2 py-0.5 text-[10px] font-bold text-[#c24d4d]"
                                          : "inline-flex rounded-full bg-[#eef8ef] px-2 py-0.5 text-[10px] font-bold text-[#3f7a46]"
                                      }
                                    >
                                      {getBudgetVarianceLabel(variance)}
                                    </span>
                                  </TableCell>
                                  {isMaster && isBudgetEditMode ? (
                                    <TableCell className="text-right">
                                      <Button
                                        type="button"
                                        size="sm"
                                        className="h-8 px-2 text-[11px]"
                                        disabled={savingBudgetCenterCode === row.centerCode || !Number.isFinite(draftBudget) || draftBudget < 0}
                                        onClick={() => void handleSaveBudgetRow(row)}
                                      >
                                        Salvar
                                      </Button>
                                    </TableCell>
                                  ) : null}
                                </TableRow>
                              )
                            })}
                          </TableBody>
                        </Table>
                      </div>
                    ) : null}

                    <div className="mt-3 flex items-center justify-between gap-2 rounded-xl border border-[#e4ece0] bg-white/85 px-3 py-2.5 shadow-sm shadow-[#eff4eb]/50">
                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">Status consolidado</p>
                        <p className="mt-0.5 text-sm font-bold text-slate-900">
                          {telecomBudgetTotals.spent > telecomBudgetTotals.budget ? "Acima do orçado" : "Dentro do orçado"}
                        </p>
                      </div>
                      <p className={telecomBudgetTotals.spent > telecomBudgetTotals.budget ? "rounded-full bg-[#fff2f0] px-2.5 py-1 text-[11px] font-bold text-[#c24d4d]" : "rounded-full bg-[#eef8ef] px-2.5 py-1 text-[11px] font-bold text-[#3f7a46]"}>
                        {getBudgetVarianceLabel(telecomBudgetTotals.spent - telecomBudgetTotals.budget)}
                      </p>
                    </div>
                  </div>
                </div>
                ) : null}
                {dailyRightPanelView === "centers" ? (
                <div className="flex min-h-0 flex-1 flex-col overflow-hidden border-t border-[#eef3eb]">
                  <div className="border-b border-[#e8efe2] px-4 py-2.5">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">Lista completa dos centros do dia</p>
                  </div>
                  <ScrollArea className="min-h-0 h-full flex-1 px-4 py-3">
                  {selectedDayCostCenters.length === 0 ? (
                    <p className="mt-4 text-sm text-slate-500">Sem rateio para exibir.</p>
                  ) : (
                    <div className="space-y-2.5 pb-1">
                      {selectedDayCostCenters.map((center) => (
                        <button
                          key={center.centroCusto}
                          type="button"
                          onClick={() => setSelectedDailyCenterKey((current) => (current === center.key ? null : center.key))}
                          className={
                            activeDailyCenterKey === center.key
                              ? "w-full rounded-xl border border-[#8fb78f] bg-[#f4faef] px-3 py-3 text-left shadow-sm"
                              : "w-full rounded-xl border border-[#e8efe2] bg-white px-3 py-3 text-left shadow-sm shadow-[#eef4ea]/35 transition-colors hover:border-[#b8d2ae] hover:bg-[#f8fbf6]"
                          }
                        >
                          <div className="flex items-center justify-between gap-3">
                            <div className="min-w-0">
                              <p className="truncate text-sm font-semibold text-slate-800">{center.centroCusto}</p>
                              {activeDailyCenterKey === center.key ? <p className="mt-0.5 text-[10px] font-medium text-[#4f7d48]">Filtro ativo nos lançamentos</p> : null}
                            </div>
                            <p className="shrink-0 text-sm font-bold text-slate-900">{formatCurrency(center.total)}</p>
                          </div>
                          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-500">
                            <span>{center.transactions} lançamentos</span>
                            <span>{center.drivers} motoristas</span>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                  </ScrollArea>
                </div>
                ) : null}
              </div>
            </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={isWeeklyDetailOpen} onOpenChange={setIsWeeklyDetailOpen}>
        <DialogContent
          className="grid h-[95vh] w-[98vw] max-w-[98vw] grid-rows-[auto_minmax(0,1fr)] gap-0 overflow-hidden border-[#d8dfd1] bg-[linear-gradient(180deg,#f9fcf7_0%,#eef4ea_100%)] p-0 text-slate-900 sm:max-w-[98vw]"
          showCloseButton
        >
          <DialogHeader className="border-b border-[#dfe8d9] px-6 py-5 text-left">
            <DialogTitle className="text-2xl text-slate-900">
              {selectedWeekRange
                ? `Detalhamento semanal - ${formatCompactDate(selectedWeekRange.start)} a ${formatCompactDate(selectedWeekRange.end)}`
                : "Detalhamento semanal"}
            </DialogTitle>
            <DialogDescription className="text-slate-600">
              {selectedWeekScopedRecords.length} lançamentos filtrados - {selectedWeekCostCenters.length} centros de custo - Total {formatCurrency(selectedWeeklyPoint?.total ?? 0)}
            </DialogDescription>
          </DialogHeader>

          <div className="min-h-0 overflow-hidden px-5 py-4 lg:px-6">
            <div className="flex h-full min-h-0 flex-col gap-3">
              <div className="flex flex-wrap items-end justify-between gap-3 rounded-xl border border-[#d8e4d2] bg-white/90 px-4 py-3">
                <div className="space-y-1.5">
                  <Label htmlFor="weekly-scope-filter" className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Escopo</Label>
                  <Select
                    value={weeklyScopeFilter}
                    onValueChange={(value) => {
                      setWeeklyScopeFilter(value as WeeklyScopeFilter)
                      setSelectedWeeklyCenterKey(null)
                    }}
                  >
                  <SelectTrigger id="weekly-scope-filter" className="h-9 bg-white">
                    <SelectValue placeholder="Selecione o escopo" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    <SelectItem value="telecom">Telecom</SelectItem>
                    <SelectItem value="engineering">Engenharia</SelectItem>
                  </SelectContent>
                </Select>
                </div>
                <p className="pb-1 text-xs text-slate-500">Escolha Telecom, Engenharia ou todos os centros de custo.</p>
              </div>

              <div className="grid min-h-0 flex-1 gap-3 lg:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.85fr)]">
                  <div className="grid min-h-0 grid-rows-[auto_auto_minmax(0,1fr)] rounded-xl border border-[#d8e4d2] bg-white/90">
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#e8efe2] px-4 py-3">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Lançamentos da semana</p>
                        <p className="mt-1 text-xs text-slate-500">
                          {activeWeeklyCenterKey
                            ? `Centro selecionado: ${selectedWeekCostCenters.find((center) => center.key === activeWeeklyCenterKey)?.centroCusto ?? ""}`
                            : "Todos os centros do escopo selecionado"}
                        </p>
                      </div>
                      <span className="rounded-md border border-[#dce8d6] bg-[#f6fbf3] px-2 py-1 text-xs font-semibold text-[#4f7d48]">
                        {selectedWeekRecordsForDisplay.length} lançamentos
                      </span>
                    </div>
                    <div className="px-4 pt-3">
                      <Input
                        value={weeklyRecordsSearch}
                        onChange={(event) => setWeeklyRecordsSearch(event.target.value)}
                        placeholder="Buscar por colaborador ou placa"
                        className="h-9 bg-white"
                      />
                    </div>
                    <ScrollArea className="min-h-0 px-4 py-3">
                    {selectedWeekRecordsForDisplay.length === 0 ? (
                      <p className="text-sm text-slate-500">Não há lançamentos para o filtro selecionado.</p>
                    ) : (
                      <div className="space-y-2">
                        {selectedWeekRecordsForDisplay.map((record) => {
                          const driver = normalizePersonName(record.nomeMotorista, record.cpfMotorista)

                          return (
                            <div key={`${record.dateTime}-${record.cardPlate}-${record.cpfMotorista}-${record.valor}`} className="rounded-lg border border-[#e8efe2] bg-white px-3 py-2.5">
                              <div className="flex items-center justify-between gap-2">
                                <p className="truncate text-sm font-semibold text-slate-800">{driver}</p>
                                <p className="text-sm font-bold text-slate-900">{formatCurrency(record.valor)}</p>
                              </div>
                              <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
                                <span>{formatCompactDate(record.parsedDate)}</span>
                                <span>{formatTime(record.parsedDate)}</span>
                                <span>Placa {record.cardPlate || "-"}</span>
                                <span>{normalizeFuelType(record.tipoCombustivel)}</span>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    )}
                    </ScrollArea>
                  </div>

                  <div className="flex min-h-0 flex-col overflow-hidden rounded-xl border border-[#d8e4d2] bg-[linear-gradient(180deg,#ffffff_0%,#f8fbf6_100%)] shadow-[inset_0_1px_0_rgba(255,255,255,0.85)]">
                    <div className="border-b border-[#e8efe2] px-4 py-3">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Centros de custo</p>
                          <p className="mt-1 text-xs text-slate-500">Selecione um centro para filtrar os lançamentos.</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="border-[#d9e6d1] bg-white text-[#557c4e]">
                            {selectedWeekCostCenters.length} centro(s)
                          </Badge>
                          <div className="flex rounded-lg border border-[#d9e6d1] bg-white p-0.5">
                            <button
                              type="button"
                              onClick={() => setWeeklyRightPanelView("centers")}
                              className={
                                weeklyRightPanelView === "centers"
                                  ? "rounded-md bg-[#f4faef] px-2.5 py-1 text-[11px] font-semibold text-[#426a32]"
                                  : "rounded-md px-2.5 py-1 text-[11px] font-semibold text-slate-500"
                              }
                            >
                              Centros
                            </button>
                            <button
                              type="button"
                              onClick={() => setWeeklyRightPanelView("budget")}
                              className={
                                weeklyRightPanelView === "budget"
                                  ? "rounded-md bg-[#f4faef] px-2.5 py-1 text-[11px] font-semibold text-[#426a32]"
                                  : "rounded-md px-2.5 py-1 text-[11px] font-semibold text-slate-500"
                              }
                            >
                              Orçado
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="grid gap-2 border-b border-[#e8efe2] bg-[#f6faf3] px-4 py-3 sm:grid-cols-2">
                      <div className="rounded-xl border border-[#dde8d6] bg-white/95 px-3 py-3 shadow-sm shadow-[#eff5eb]/60">
                        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">Total dos centros</p>
                        <p className="mt-1 text-xl font-black tracking-tight text-slate-900">{formatCurrency(selectedWeekCostCentersTotal)}</p>
                        <p className="mt-1 text-[11px] text-slate-500">Rateio consolidado da semana selecionada</p>
                      </div>
                      <div className={activeWeeklyCenter ? "rounded-xl border border-[#cfe2c6] bg-[#f5fbf1] px-3 py-3 shadow-sm shadow-[#eff5eb]/60" : "rounded-xl border border-[#dde8d6] bg-white/95 px-3 py-3 shadow-sm shadow-[#eff5eb]/60"}>
                        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">Filtro ativo</p>
                        <p className="mt-1 truncate text-sm font-bold text-slate-900">{activeWeeklyCenter?.centroCusto ?? "Todos os centros"}</p>
                        <p className="mt-1 text-[11px] text-slate-500">
                          {activeWeeklyCenter ? `${activeWeeklyCenter.transactions} lançamentos filtrados` : "Sem filtro específico aplicado"}
                        </p>
                      </div>
                    </div>

                    {weeklyRightPanelView === "budget" ? (
                    <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-[#fbfdf9]">
                      <div className="flex flex-wrap items-center justify-between gap-2 px-4 pt-3">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">Telecom - Orçado x gasto da semana</p>
                        <Badge
                          variant="outline"
                          className={
                            telecomWeeklyBudgetTotals.spent > telecomWeeklyBudgetTotals.budget
                              ? "border-[#f1c8ba] bg-[#fff1eb] text-[#b85e54]"
                              : "border-[#d7e4cf] bg-[#f5faf1] text-[#4f7d48]"
                          }
                        >
                          {formatCurrency(telecomWeeklyBudgetTotals.spent)} / {formatCurrency(telecomWeeklyBudgetTotals.budget)}
                        </Badge>
                      </div>
                      <p className="px-4 pt-1 text-[10px] text-slate-500">Orçamento diário x {daysInSelectedWeek} dias da semana selecionada.</p>

                      <div className="mt-3 flex-1 overflow-auto px-4 pb-3">
                        {telecomWeeklyBudgetRows.length === 0 ? (
                          <p className="text-xs text-slate-500">Nenhum centro telecom configurado para orçamento diário.</p>
                        ) : (
                          <div className="overflow-hidden rounded-xl border border-[#e4ece0] bg-white shadow-sm shadow-[#eff4eb]/50">
                            <Table>
                              <TableHeader>
                                <TableRow className="bg-[#f6faf3] hover:bg-[#f6faf3]">
                                  <TableHead className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">Centro</TableHead>
                                  <TableHead className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">Orçado</TableHead>
                                  <TableHead className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">Gasto</TableHead>
                                  <TableHead className="text-right text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">Variação</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {telecomWeeklyBudgetRows.map((row) => {
                                  const variance = row.spent - row.budget
                                  const isOverBudget = row.spent > row.budget
                                  const matchingCenterKey = getWeeklyCenterKeyByCode(row.centerCode)
                                  const isSelected = matchingCenterKey !== null && activeWeeklyCenterKey === matchingCenterKey

                                  return (
                                    <TableRow
                                      key={`weekly-modal-${row.centerCode}`}
                                      className={isSelected ? "bg-[#f4faef] hover:bg-[#f4faef]" : "hover:bg-[#fafcf9]"}
                                    >
                                      <TableCell className="max-w-[220px]">
                                        <button
                                          type="button"
                                          className="min-w-0 text-left"
                                          onClick={() => {
                                            if (!matchingCenterKey) return
                                            setSelectedWeeklyCenterKey((current) => (current === matchingCenterKey ? null : matchingCenterKey))
                                          }}
                                        >
                                          <p className="truncate text-xs font-semibold text-slate-800">{row.centerLabel}</p>
                                          <p className="mt-0.5 truncate text-[10px] text-slate-500">
                                            {matchingCenterKey ? "Clique para filtrar os lançamentos" : "Sem lançamentos nesta semana"}
                                          </p>
                                        </button>
                                      </TableCell>
                                      <TableCell>
                                        <span className="text-sm font-semibold text-slate-900">{formatCurrency(row.budget)}</span>
                                      </TableCell>
                                      <TableCell>
                                        <span className="text-sm font-semibold text-slate-900">{formatCurrency(row.spent)}</span>
                                      </TableCell>
                                      <TableCell className="text-right">
                                        <span
                                          className={
                                            isOverBudget
                                              ? "inline-flex rounded-full bg-[#fff1ef] px-2 py-0.5 text-[10px] font-bold text-[#c24d4d]"
                                              : "inline-flex rounded-full bg-[#eef8ef] px-2 py-0.5 text-[10px] font-bold text-[#3f7a46]"
                                          }
                                        >
                                          {getBudgetVarianceLabel(variance)}
                                        </span>
                                      </TableCell>
                                    </TableRow>
                                  )
                                })}
                              </TableBody>
                            </Table>
                          </div>
                        )}

                        <div className="mt-3 flex items-center justify-between gap-2 rounded-xl border border-[#e4ece0] bg-white/85 px-3 py-2.5 shadow-sm shadow-[#eff4eb]/50">
                          <div>
                            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">Status consolidado</p>
                            <p className="mt-0.5 text-sm font-bold text-slate-900">
                              {telecomWeeklyBudgetTotals.spent > telecomWeeklyBudgetTotals.budget ? "Acima do orçado" : "Dentro do orçado"}
                            </p>
                          </div>
                          <p className={telecomWeeklyBudgetTotals.spent > telecomWeeklyBudgetTotals.budget ? "rounded-full bg-[#fff2f0] px-2.5 py-1 text-[11px] font-bold text-[#c24d4d]" : "rounded-full bg-[#eef8ef] px-2.5 py-1 text-[11px] font-bold text-[#3f7a46]"}>
                            {getBudgetVarianceLabel(telecomWeeklyBudgetTotals.spent - telecomWeeklyBudgetTotals.budget)}
                          </p>
                        </div>
                      </div>
                    </div>
                    ) : null}

                    {weeklyRightPanelView === "centers" ? (
                    <div className="flex min-h-0 flex-1 flex-col overflow-hidden border-t border-[#eef3eb]">
                      <ScrollArea className="min-h-0 h-full flex-1 px-4 py-3">
                      {selectedWeekCostCenters.length === 0 ? (
                        <p className="mt-4 text-sm text-slate-500">Sem rateio para exibir.</p>
                      ) : (
                        <div className="space-y-2.5 pb-1">
                          {selectedWeekCostCenters.map((center) => (
                            <button
                              key={center.centroCusto}
                              type="button"
                              onClick={() => setSelectedWeeklyCenterKey((current) => (current === center.key ? null : center.key))}
                              className={
                                activeWeeklyCenterKey === center.key
                                  ? "w-full rounded-xl border border-[#8fb78f] bg-[#f4faef] px-3 py-3 text-left shadow-sm"
                                  : "w-full rounded-xl border border-[#e8efe2] bg-white px-3 py-3 text-left shadow-sm shadow-[#eef4ea]/35 transition-colors hover:border-[#b8d2ae] hover:bg-[#f8fbf6]"
                              }
                            >
                              <div className="flex items-center justify-between gap-3">
                                <div className="min-w-0">
                                  <p className="truncate text-sm font-semibold text-slate-800">{center.centroCusto}</p>
                                  {activeWeeklyCenterKey === center.key ? <p className="mt-0.5 text-[10px] font-medium text-[#4f7d48]">Filtro ativo nos lançamentos</p> : null}
                                </div>
                                <p className="shrink-0 text-sm font-bold text-slate-900">{formatCurrency(center.total)}</p>
                              </div>
                              <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-500">
                                <span>{center.transactions} lançamentos</span>
                                <span>{center.drivers} motoristas</span>
                              </div>
                            </button>
                          ))}
                        </div>
                      )}
                      </ScrollArea>
                    </div>
                    ) : null}
                  </div>
                </div>
              </div>
            </div>
        </DialogContent>
      </Dialog>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
        <Card className="border-[#d8dfd1] bg-white shadow-sm">
          <CardHeader className="border-b border-[#e7eee2] pb-4">
            <div className="flex items-center gap-2">
              <CalendarDays className="h-5 w-5 text-[#5b9b5f]" />
              <CardTitle className="text-lg text-slate-900">{analyticsCopy.summaryTitle}</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="grid gap-4 p-5 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-2xl border border-[#e4ebe0] bg-[#f9fbf8] p-4">
              <p className="text-sm font-medium text-slate-500">Diário</p>
              <p className="mt-2 text-2xl font-black tracking-tight text-slate-900">{formatCurrency(insights.dailyMetric)}</p>
              <p className="mt-1 text-xs uppercase tracking-[0.12em] text-slate-400">Base {formatCompactDate(analyticsRange.end)}</p>
            </div>
            <div className="rounded-2xl border border-[#e4ebe0] bg-[#f9fbf8] p-4">
              <p className="text-sm font-medium text-slate-500">Semanal</p>
              <p className="mt-2 text-2xl font-black tracking-tight text-slate-900">{formatCurrency(insights.weeklyMetric)}</p>
              <p className="mt-1 text-xs uppercase tracking-[0.12em] text-slate-400">{analyticsCopy.summaryWeeklyCaption}</p>
            </div>
            <div className="rounded-2xl border border-[#e4ebe0] bg-[#f9fbf8] p-4">
              <p className="text-sm font-medium text-slate-500">Mensal</p>
              <p className="mt-2 text-2xl font-black tracking-tight text-slate-900">{formatCurrency(insights.monthlyMetric)}</p>
              <p className="mt-1 text-xs uppercase tracking-[0.12em] text-slate-400">{analyticsCopy.summaryMonthlyCaption}</p>
            </div>
            <div className="rounded-2xl border border-[#e4ebe0] bg-[#f9fbf8] p-4">
              <p className="text-sm font-medium text-slate-500">Ticket médio</p>
              <p className="mt-2 text-2xl font-black tracking-tight text-slate-900">{formatCurrency(insights.avgTicket)}</p>
              <p className="mt-1 text-xs uppercase tracking-[0.12em] text-slate-400">Por transação</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-[#d8dfd1] bg-[linear-gradient(180deg,#fcfdfb_0%,#f4f8f1_100%)] shadow-sm">
          <CardHeader className="border-b border-[#e7eee2] pb-4">
            <div className="flex items-center gap-2">
              <CalendarRange className="h-5 w-5 text-[#5b9b5f]" />
              <CardTitle className="text-lg text-slate-900">Indicadores do período</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="grid gap-4 p-5 sm:grid-cols-2">
            <div className="rounded-2xl border border-[#dde7d8] bg-white/90 p-4">
              <p className="text-sm font-medium text-slate-500">Pessoas com abastecimento</p>
              <p className="mt-2 text-3xl font-black tracking-tight text-[#376b40]">{insights.activePeople}</p>
            </div>
            <div className="rounded-2xl border border-[#dde7d8] bg-white/90 p-4">
              <p className="text-sm font-medium text-slate-500">Transações</p>
              <p className="mt-2 text-3xl font-black tracking-tight text-[#376b40]">{insights.periodCount}</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
