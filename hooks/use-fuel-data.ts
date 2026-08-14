"use client"

import { useEffect, useMemo, useState } from "react"
import useSWR from "swr"
import { useSWRConfig } from "swr"
import { parseFuelDateTime } from "@/lib/fuel-datetime"

export type FuelRecord = {
  cardPlate: string
  cpfMotorista: string
  nomeMotorista: string
  tipoCombustivel: string
  valor: number
  dateTime: string
  postingDate?: string | null
}

export type FuelWeeklyComparisonMonth = {
  key: string
  label: string
  color: string
}

export type FuelWeeklyComparisonPoint = {
  weekLabel: string
} & Record<string, string | number>

export type FuelWeeklyComparison = {
  months: FuelWeeklyComparisonMonth[]
  points: FuelWeeklyComparisonPoint[]
}

export type FuelResponse = {
  records: FuelRecord[]
  availableMonths: FuelMonthOption[]
  weeklyComparison: FuelWeeklyComparison
  selectedMonth?: string | null
  currentMonth?: string | null
  lastImportedAt?: string | null
  warning?: string
}

export type FuelMonthOption = {
  month: string
  label: string
  recordCount: number
  total: number
  source: "current" | "history"
}

const EMPTY_RECORDS: FuelRecord[] = []
const EMPTY_MONTHS: FuelMonthOption[] = []
const EMPTY_WEEKLY_COMPARISON: FuelWeeklyComparison = { months: [], points: [] }

export const FUEL_DATA_SWR_KEY = "/api/fuel/data"

export const fuelFetcher = async (url: string): Promise<FuelResponse> => {
  const res = await fetch(url, { cache: "no-store" })
  const data = await res.json().catch(() => ({ records: [] }))
  if (!res.ok) {
    throw new Error(data?.error || "Falha ao carregar dados.")
  }
  return data
}

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}

function isWithinRange(date: Date, start: Date, end: Date): boolean {
  return date.getTime() >= start.getTime() && date.getTime() <= end.getTime()
}

export type UseFuelDataResult = {
  records: FuelRecord[]
  availableMonths: FuelMonthOption[]
  weeklyComparison: FuelWeeklyComparison
  selectedMonth: string | null
  currentMonth: string | null
  setSelectedMonth: (month: string) => void
  dailyTotal: number
  weeklyTotal: number
  monthlyTotal: number
  monthlyCount: number
  reportDate: Date
  monthlyReferenceDate: Date
  lastImportedAt: string | null
  isLoading: boolean
  error: Error | undefined
  warning?: string
  mutate: ReturnType<typeof useSWR<FuelResponse>>["mutate"]
}

export function useFuelData(): UseFuelDataResult {
  const [requestedMonth, setRequestedMonth] = useState<string>("")
  const { mutate: globalMutate } = useSWRConfig()
  const swrKey = requestedMonth ? `${FUEL_DATA_SWR_KEY}?month=${requestedMonth}` : FUEL_DATA_SWR_KEY
  const { data, error, isLoading, mutate } = useSWR(swrKey, fuelFetcher, {
    revalidateOnFocus: false,
    revalidateOnReconnect: false,
    dedupingInterval: 30_000,
    keepPreviousData: true,
  })
  const records = data?.records ?? EMPTY_RECORDS
  const availableMonths = data?.availableMonths ?? EMPTY_MONTHS
  const selectedMonth = data?.selectedMonth ?? (requestedMonth || null)

  useEffect(() => {
    const monthsToPrefetch = (data?.availableMonths ?? [])
      .map((month) => month.month)
      .filter((month) => month !== selectedMonth)
      .slice(0, 2)

    for (const month of monthsToPrefetch) {
      const key = `${FUEL_DATA_SWR_KEY}?month=${month}`
      void globalMutate(key, fuelFetcher(key), {
        populateCache: true,
        revalidate: false,
      })
    }
  }, [data?.availableMonths, globalMutate, selectedMonth])

  const metrics = useMemo(() => {
    const now = new Date()
    const sorted = [...records]
      .map((record) => ({ date: parseFuelDateTime(record.dateTime), valor: record.valor }))
      .filter((item) => !Number.isNaN(item.date.getTime()))
      .sort((a, b) => b.date.getTime() - a.date.getTime())

    const reportBaseDate = sorted.length > 0 ? sorted[0].date : now
    const dayStart = startOfDay(reportBaseDate)
    const dayEnd = new Date(dayStart)
    dayEnd.setHours(23, 59, 59, 999)

    const weekStart = new Date(dayStart)
    weekStart.setDate(dayStart.getDate() - 6)

    const monthStart = new Date(reportBaseDate.getFullYear(), reportBaseDate.getMonth(), 1)
    const monthEnd = new Date(reportBaseDate.getFullYear(), reportBaseDate.getMonth() + 1, 0, 23, 59, 59, 999)

    let dailyTotal = 0
    let weeklyTotal = 0
    let monthlyTotal = 0
    let monthlyCount = 0

    for (const record of records) {
      const recordDate = parseFuelDateTime(record.dateTime)
      if (Number.isNaN(recordDate.getTime())) continue

      if (isSameDay(recordDate, dayStart)) {
        dailyTotal += record.valor
      }

      if (isWithinRange(recordDate, weekStart, dayEnd)) {
        weeklyTotal += record.valor
      }

      if (isWithinRange(recordDate, monthStart, monthEnd)) {
        monthlyTotal += record.valor
        monthlyCount += 1
      }
    }

    return {
      dailyTotal,
      weeklyTotal,
      monthlyTotal,
      monthlyCount,
      reportDate: dayStart,
      monthlyReferenceDate: monthStart,
    }
  }, [records])

  return {
    records,
    availableMonths,
    weeklyComparison: data?.weeklyComparison ?? EMPTY_WEEKLY_COMPARISON,
    selectedMonth,
    currentMonth: data?.currentMonth ?? null,
    setSelectedMonth: setRequestedMonth,
    ...metrics,
    lastImportedAt: data?.lastImportedAt ?? null,
    isLoading,
    error,
    warning: data?.warning,
    mutate,
  }
}
