"use client"

import useSWR from "swr"

export type FuelRecord = {
  cardPlate: string
  cpfMotorista: string
  nomeMotorista: string
  tipoCombustivel: string
  valor: number
  dateTime: string
}

type FuelResponse = {
  records: FuelRecord[]
}

const fetcher = async (url: string): Promise<FuelResponse> => {
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

export function useFuelData() {
  const { data, error, isLoading, mutate } = useSWR("/api/fuel/data", fetcher)
  const records = data?.records || []

  const now = new Date()
  const yesterday = new Date(now)
  yesterday.setDate(now.getDate() - 1)

  const dayStart = startOfDay(yesterday)
  const dayEnd = new Date(dayStart)
  dayEnd.setHours(23, 59, 59, 999)

  const weekStart = new Date(dayStart)
  weekStart.setDate(dayStart.getDate() - 6)

  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999)

  let dailyTotal = 0
  let weeklyTotal = 0
  let monthlyTotal = 0
  let monthlyCount = 0

  for (const record of records) {
    const recordDate = new Date(record.dateTime)
    if (Number.isNaN(recordDate.getTime())) continue

    if (isSameDay(recordDate, yesterday)) {
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
    records,
    dailyTotal,
    weeklyTotal,
    monthlyTotal,
    monthlyCount,
    reportDate: yesterday,
    isLoading,
    error,
    mutate,
  }
}
