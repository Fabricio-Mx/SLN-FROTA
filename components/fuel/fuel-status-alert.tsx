"use client"

import { AlertCircle, Info } from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { useFuelDataContext } from "@/components/fuel/fuel-data-provider"

export function FuelStatusAlert() {
  const { warning, error } = useFuelDataContext()
  const isEmptyState = warning?.includes("Nenhum relatório importado")
  const isLocalMirrorState = warning?.includes("espelho local")

  if (!warning && !error) {
    return null
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Falha ao carregar combustível</AlertTitle>
        <AlertDescription>
          {error.message || "Não foi possível carregar os dados de combustível."}
        </AlertDescription>
      </Alert>
    )
  }

  return (
    <Alert>
      <Info className="h-4 w-4" />
      <AlertTitle>
        {isEmptyState
          ? "Nenhum relatório carregado"
          : isLocalMirrorState
            ? "Combustível carregado pelo espelho local"
            : "Aviso do combustível"}
      </AlertTitle>
      <AlertDescription>{warning}</AlertDescription>
    </Alert>
  )
}