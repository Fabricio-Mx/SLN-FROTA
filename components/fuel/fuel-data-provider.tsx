"use client"

import { createContext, useContext } from "react"
import { useFuelData, type UseFuelDataResult } from "@/hooks/use-fuel-data"

const FuelDataContext = createContext<UseFuelDataResult | null>(null)

type FuelDataProviderProps = {
  children: React.ReactNode
}

export function FuelDataProvider({ children }: FuelDataProviderProps) {
  const value = useFuelData()

  return <FuelDataContext.Provider value={value}>{children}</FuelDataContext.Provider>
}

export function useFuelDataContext() {
  const context = useContext(FuelDataContext)

  if (!context) {
    throw new Error("useFuelDataContext deve ser usado dentro de FuelDataProvider")
  }

  return context
}