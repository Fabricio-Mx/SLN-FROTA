"use client"

import { Car, Key, CreditCard, AlertTriangle, Users, Wrench, Settings, Fuel } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import type { Vehicle, Colaborador } from "@/lib/types"
import { useFuelData } from "@/hooks/use-fuel-data"

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value)
}

interface StatsCardsProps {
  vehicles: Vehicle[]
  colaboradores: Colaborador[]
}

export function StatsCards({ vehicles, colaboradores }: StatsCardsProps) {
  const { monthlyTotal: monthlyFuelTotal } = useFuelData()
  const totalVehicles = vehicles.length
  const alugados = vehicles.filter((v) => v.tipoPropriedade === "alugado").length
  const proprios = vehicles.filter((v) => v.tipoPropriedade === "proprio").length
  const totalColaboradores = colaboradores.length
  const naOficina = vehicles.filter((v) => v.naOficina).length
  const paraRevisao = vehicles.filter((v) => v.paraRevisao).length
  
  const today = new Date()
  const thirtyDaysFromNow = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000)
  const contratosVencendo = vehicles.filter((v) => {
    const vencimento = new Date(v.dataVencimentoContrato)
    return vencimento <= thirtyDaysFromNow
  }).length

  const stats = [
    {
      label: "Total de Veículos",
      value: totalVehicles.toString(),
      icon: Car,
      color: "bg-primary/10 text-primary",
    },
    {
      label: "Próprios",
      value: proprios.toString(),
      icon: Key,
      color: "bg-accent/10 text-accent",
    },
    {
      label: "Alugados",
      value: alugados.toString(),
      icon: CreditCard,
      color: "bg-chart-2/10 text-chart-2",
    },
    {
      label: "Na Oficina",
      value: naOficina.toString(),
      icon: Wrench,
      color: "bg-chart-3/10 text-chart-3",
    },
    {
      label: "Para Revisão",
      value: paraRevisao.toString(),
      icon: Settings,
      color: "bg-chart-4/10 text-chart-4",
    },
    {
      label: "Contratos Vencendo",
      value: contratosVencendo.toString(),
      icon: AlertTriangle,
      color: "bg-destructive/10 text-destructive",
    },
    {
      label: "Faturamento Mensal",
      value: formatCurrency(monthlyFuelTotal),
      icon: Fuel,
      color: "bg-emerald-500/10 text-emerald-600",
    },
  ]

  return (
    <div className="space-y-4">
      <div className="grid gap-4 grid-cols-2 sm:grid-cols-3 lg:grid-cols-7">
        {stats.map((stat) => (
          <Card key={stat.label} className="border-border">
            <CardContent className="flex items-center gap-3 p-4">
              <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${stat.color}`}>
                <stat.icon className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="break-words text-lg font-bold leading-tight text-foreground">{stat.value}</p>
                <p className="text-xs text-muted-foreground leading-tight">{stat.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
      <div className="max-w-[200px]">
        <Card className="border-border">
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Users className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p className="text-xl font-bold text-foreground">{totalColaboradores}</p>
              <p className="text-xs text-muted-foreground truncate">Colaboradores</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
