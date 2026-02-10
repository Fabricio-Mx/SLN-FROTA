"use client"

import useSWR, { mutate } from "swr"
import type { Vehicle, VehicleFormData } from "@/lib/types"

const STORAGE_KEY = "fleet-vehicles"

function getVehiclesFromStorage(): Vehicle[] {
  if (typeof window === "undefined") return []
  const data = localStorage.getItem(STORAGE_KEY)
  return data ? JSON.parse(data) : []
}

function saveVehiclesToStorage(vehicles: Vehicle[]): void {
  if (typeof window === "undefined") return
  localStorage.setItem(STORAGE_KEY, JSON.stringify(vehicles))
}

const fetcher = (): Vehicle[] => getVehiclesFromStorage()

export function useVehicles() {
  const { data: vehicles = [], error, isLoading } = useSWR<Vehicle[]>(STORAGE_KEY, fetcher)

  const addVehicle = (formData: VehicleFormData): Vehicle => {
    const newVehicle: Vehicle = {
      ...formData,
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
    const updatedVehicles = [...vehicles, newVehicle]
    saveVehiclesToStorage(updatedVehicles)
    mutate(STORAGE_KEY, updatedVehicles, false)
    return newVehicle
  }

  const updateVehicle = (id: string, formData: VehicleFormData): Vehicle | null => {
    const index = vehicles.findIndex((v) => v.id === id)
    if (index === -1) return null
    
    const updatedVehicle: Vehicle = {
      ...vehicles[index],
      ...formData,
      updatedAt: new Date().toISOString(),
    }
    const updatedVehicles = [...vehicles]
    updatedVehicles[index] = updatedVehicle
    saveVehiclesToStorage(updatedVehicles)
    mutate(STORAGE_KEY, updatedVehicles, false)
    return updatedVehicle
  }

  const deleteVehicle = (id: string): boolean => {
    const updatedVehicles = vehicles.filter((v) => v.id !== id)
    if (updatedVehicles.length === vehicles.length) return false
    saveVehiclesToStorage(updatedVehicles)
    mutate(STORAGE_KEY, updatedVehicles, false)
    return true
  }

  const getVehicleById = (id: string): Vehicle | undefined => {
    return vehicles.find((v) => v.id === id)
  }

  return {
    vehicles,
    isLoading,
    error,
    addVehicle,
    updateVehicle,
    deleteVehicle,
    getVehicleById,
  }
}
