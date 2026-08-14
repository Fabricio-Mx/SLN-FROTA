"use client"

import useSWR from "swr"

export type FuelFinancialInvoice = {
  id: string
  cycleMonth: string
  cycleStart: string
  cycleEnd: string
  uploadedAt: string
  originalFileName: string
  storedFileName: string
  mimeType: string
  size: number
  driveFileId?: string | null
}

type FuelFinancialInvoicesResponse = {
  invoices: FuelFinancialInvoice[]
}

export const FUEL_FINANCIAL_INVOICES_SWR_KEY = "/api/fuel/finance"

async function fuelFinancialInvoicesFetcher(url: string): Promise<FuelFinancialInvoicesResponse> {
  const response = await fetch(url, { cache: "no-store" })
  const data = await response.json().catch(() => ({ invoices: [] }))

  if (!response.ok) {
    throw new Error(data?.error || "Falha ao carregar faturas financeiras.")
  }

  return data
}

export function useFuelFinancialInvoices() {
  return useSWR(FUEL_FINANCIAL_INVOICES_SWR_KEY, fuelFinancialInvoicesFetcher, {
    revalidateOnFocus: false,
    revalidateOnReconnect: false,
    dedupingInterval: 30_000,
    keepPreviousData: true,
  })
}
