"use client"

import useSWR, { mutate } from "swr"
import type { Colaborador, ColaboradorFormData } from "@/lib/types"

const STORAGE_KEY = "fleet-colaboradores"

function getColaboradoresFromStorage(): Colaborador[] {
  if (typeof window === "undefined") return []
  const data = localStorage.getItem(STORAGE_KEY)
  return data ? JSON.parse(data) : []
}

function saveColaboradoresToStorage(colaboradores: Colaborador[]): void {
  if (typeof window === "undefined") return
  localStorage.setItem(STORAGE_KEY, JSON.stringify(colaboradores))
}

const fetcher = (): Colaborador[] => getColaboradoresFromStorage()

export function useColaboradores() {
  const { data: colaboradores = [], error, isLoading } = useSWR<Colaborador[]>(STORAGE_KEY, fetcher)

  const addColaborador = (formData: ColaboradorFormData): Colaborador => {
    const newColaborador: Colaborador = {
      ...formData,
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
    const updatedColaboradores = [...colaboradores, newColaborador]
    saveColaboradoresToStorage(updatedColaboradores)
    mutate(STORAGE_KEY, updatedColaboradores, false)
    return newColaborador
  }

  const updateColaborador = (id: string, formData: ColaboradorFormData): Colaborador | null => {
    const index = colaboradores.findIndex((c) => c.id === id)
    if (index === -1) return null
    
    const updatedColaborador: Colaborador = {
      ...colaboradores[index],
      ...formData,
      updatedAt: new Date().toISOString(),
    }
    const updatedColaboradores = [...colaboradores]
    updatedColaboradores[index] = updatedColaborador
    saveColaboradoresToStorage(updatedColaboradores)
    mutate(STORAGE_KEY, updatedColaboradores, false)
    return updatedColaborador
  }

  const deleteColaborador = (id: string): boolean => {
    const updatedColaboradores = colaboradores.filter((c) => c.id !== id)
    if (updatedColaboradores.length === colaboradores.length) return false
    saveColaboradoresToStorage(updatedColaboradores)
    mutate(STORAGE_KEY, updatedColaboradores, false)
    return true
  }

  const getColaboradorById = (id: string): Colaborador | undefined => {
    return colaboradores.find((c) => c.id === id)
  }

  return {
    colaboradores,
    isLoading,
    error,
    addColaborador,
    updateColaborador,
    deleteColaborador,
    getColaboradorById,
  }
}
