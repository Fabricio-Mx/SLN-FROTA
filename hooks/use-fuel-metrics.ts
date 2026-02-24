"use client"

import { useEffect, useState } from "react"

const MONTH_KEY_STORAGE = "fuel_month_key"
const TOTAL_STORAGE = "fuel_monthly_total"

function getMonthKey(date = new Date()): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  return `${year}-${month}`
}

function readMonthlyTotal(): number {
  if (typeof window === "undefined") return 0
  const currentKey = getMonthKey()
  const storedKey = localStorage.getItem(MONTH_KEY_STORAGE)

  if (!storedKey || storedKey !== currentKey) {
    localStorage.setItem(MONTH_KEY_STORAGE, currentKey)
    localStorage.setItem(TOTAL_STORAGE, "0")
    return 0
  }

  const raw = localStorage.getItem(TOTAL_STORAGE)
  const parsed = raw ? Number(raw) : 0
  return Number.isFinite(parsed) ? parsed : 0
}

function writeMonthlyTotal(total: number): number {
  if (typeof window === "undefined") return 0
  const currentKey = getMonthKey()
  localStorage.setItem(MONTH_KEY_STORAGE, currentKey)
  localStorage.setItem(TOTAL_STORAGE, String(total))
  return total
}

export function setMonthlyFuelTotal(total: number): number {
  const safe = Number.isFinite(total) ? total : 0
  return writeMonthlyTotal(safe)
}

export function addMonthlyFuelAmount(amount: number): number {
  const current = readMonthlyTotal()
  const next = current + (Number.isFinite(amount) ? amount : 0)
  return writeMonthlyTotal(next)
}

export function useMonthlyFuelTotal() {
  const [total, setTotal] = useState(0)

  useEffect(() => {
    setTotal(readMonthlyTotal())

    const handleStorage = (event: StorageEvent) => {
      if (event.key === MONTH_KEY_STORAGE || event.key === TOTAL_STORAGE) {
        setTotal(readMonthlyTotal())
      }
    }

    window.addEventListener("storage", handleStorage)
    return () => window.removeEventListener("storage", handleStorage)
  }, [])

  return total
}
