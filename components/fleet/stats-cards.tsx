"use client"

import { useMemo } from "react"
import useSWR from "swr"
import { Car, Key, CreditCard, AlertTriangle, Users, Wrench, Settings, Fuel, Truck, Send, BadgeCheck } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { useFuelDataContext } from "@/components/fuel/fuel-data-provider"
import { fuelFetcher, FUEL_DATA_SWR_KEY, type FuelResponse } from "@/hooks/use-fuel-data"
import { isVehicleDueForReview } from "@/lib/fleet-maintenance"
import { getMultaTotalValue } from "@/lib/multas"
import { cn } from "@/lib/utils"
import type { Vehicle, Colaborador, Multa } from "@/lib/types"

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value)
}

function formatShortDate(date: Date): string {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
  }).format(date)
}

function toDateInputValue(date: Date): string {
  const year = date.getFullYear()
  const month = `${date.getMonth() + 1}`.padStart(2, "0")
  const day = `${date.getDate()}`.padStart(2, "0")
  return `${year}-${month}-${day}`
}

function getBillingCycleBounds(anchorDate: Date) {
  if (anchorDate.getDate() >= 26) {
    return {
      start: new Date(anchorDate.getFullYear(), anchorDate.getMonth(), 26),
      end: new Date(anchorDate.getFullYear(), anchorDate.getMonth() + 1, 25),
    }
  }

  return {
    start: new Date(anchorDate.getFullYear(), anchorDate.getMonth() - 1, 26),
    end: new Date(anchorDate.getFullYear(), anchorDate.getMonth(), 25),
  }
}

interface StatsCardsProps {
  vehicles: Vehicle[]
  colaboradores: Colaborador[]
  multas: Multa[]
}

function countExpiringContracts(vehicles: Vehicle[]): number {
  const today = new Date()
  const thirtyDaysFromNow = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000)

  return vehicles.filter((vehicle) => {
    if (!vehicle.dataVencimentoContrato) return false
    const vencimento = new Date(vehicle.dataVencimentoContrato)
    if (Number.isNaN(vencimento.getTime())) return false
    return vencimento <= thirtyDaysFromNow
  }).length
}

const statCardVariants: Record<string, { cardClass: string; iconClass: string; glowClass: string }> = {
  "Veículos Frota": {
    cardClass: "border-[#c7daf7] bg-[linear-gradient(180deg,#e7f2ff_0%,#dcebff_100%)] shadow-[0_10px_24px_rgba(89,133,201,0.10)]",
    iconClass: "border-[#a9caf8] bg-[#e1efff] text-[#1552a8]",
    glowClass: "bg-[#74a9f0]/24",
  },
  "Próprios": {
    cardClass: "border-[#cfe7d8] bg-[linear-gradient(180deg,#eaf7ef_0%,#dff2e7_100%)] shadow-[0_10px_24px_rgba(90,145,110,0.10)]",
    iconClass: "border-[#afdcc0] bg-[#e1f5e9] text-[#18663b]",
    glowClass: "bg-[#95cfaa]/24",
  },
  "Alugados": {
    cardClass: "border-[#cbdcf7] bg-[linear-gradient(180deg,#eef5ff_0%,#e2eeff_100%)] shadow-[0_10px_24px_rgba(79,125,205,0.10)]",
    iconClass: "border-[#aac6fb] bg-[#e1ecff] text-[#194ab4]",
    glowClass: "bg-[#87b0f4]/24",
  },
  "Na Oficina": {
    cardClass: "border-[#f0d7c4] bg-[linear-gradient(180deg,#fff1e6_0%,#fde7d6_100%)] shadow-[0_10px_24px_rgba(211,131,66,0.10)]",
    iconClass: "border-[#f0c7a5] bg-[#ffe9d8] text-[#c65300]",
    glowClass: "bg-[#f3bb88]/24",
  },
  "Para Revisão": {
    cardClass: "border-[#ddd1f5] bg-[linear-gradient(180deg,#f3efff_0%,#ebe4fb_100%)] shadow-[0_10px_24px_rgba(128,99,202,0.10)]",
    iconClass: "border-[#ccb5fa] bg-[#ede2ff] text-[#5b1fc7]",
    glowClass: "bg-[#c3b0f2]/22",
  },
  "Contratos a Vencer Frota": {
    cardClass: "border-[#ebd1d5] bg-[linear-gradient(180deg,#f9ebed_0%,#f3dfe3_100%)] shadow-[0_10px_24px_rgba(183,96,109,0.10)]",
    iconClass: "border-[#edb7c0] bg-[#ffe6ea] text-[#b93449]",
    glowClass: "bg-[#e9a8b1]/22",
  },
  "Veículos Agregados": {
    cardClass: "border-[#c9e6f6] bg-[linear-gradient(180deg,#edf9ff_0%,#e1f3fb_100%)] shadow-[0_10px_24px_rgba(15,142,207,0.10)]",
    iconClass: "border-[#a7d8f0] bg-[#def4ff] text-[#095f89]",
    glowClass: "bg-[#98d7f0]/24",
  },
  "Contratos a Vencer Agregados": {
    cardClass: "border-[#ebd1d5] bg-[linear-gradient(180deg,#f9ebed_0%,#f3dfe3_100%)] shadow-[0_10px_24px_rgba(183,96,109,0.10)]",
    iconClass: "border-[#edb7c0] bg-[#ffe6ea] text-[#b93449]",
    glowClass: "bg-[#e9a8b1]/22",
  },
  "Faturamento Mensal": {
    cardClass: "border-[#ddd1f5] bg-[linear-gradient(180deg,#f5f0ff_0%,#ece4fb_100%)] shadow-[0_10px_24px_rgba(124,58,237,0.10)]",
    iconClass: "border-[#ccb5fa] bg-[#ede2ff] text-[#5b1fc7]",
    glowClass: "bg-[#c3b0f2]/22",
  },
  "Multas Enviadas pela Frota": {
    cardClass: "border-[#efd0d6] bg-[linear-gradient(180deg,#ffeff2_0%,#f8e3e8_100%)] shadow-[0_10px_24px_rgba(187,98,122,0.10)]",
    iconClass: "border-[#efb3c4] bg-[#ffe5ec] text-[#bd2c52]",
    glowClass: "bg-[#efafbc]/22",
  },
  "Multas Pagas pelo RH": {
    cardClass: "border-[#cee2d4] bg-[linear-gradient(180deg,#eef8f1_0%,#e4f0e8_100%)] shadow-[0_10px_24px_rgba(87,147,111,0.10)]",
    iconClass: "border-[#b6ddc3] bg-[#e3f3e8] text-[#226b3d]",
    glowClass: "bg-[#9fd0af]/22",
  },
  Colaboradores: {
    cardClass: "border-[#c8e9e4] bg-[linear-gradient(180deg,#eefaf7_0%,#e2f4ef_100%)] shadow-[0_10px_24px_rgba(21,154,140,0.10)]",
    iconClass: "border-[#added6] bg-[#dff5f0] text-[#0a6e64]",
    glowClass: "bg-[#98d9cf]/22",
  },
}

export function StatsCards({ vehicles, colaboradores, multas }: StatsCardsProps) {
  const { monthlyTotal: monthlyFuelTotal, reportDate } = useFuelDataContext()
  const totalColaboradores = colaboradores.length
  const billingCycle = useMemo(() => getBillingCycleBounds(reportDate), [reportDate])
  const billingCycleKey = useMemo(() => {
    const params = new URLSearchParams({
      start: toDateInputValue(billingCycle.start),
      end: toDateInputValue(billingCycle.end),
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
    if (!billingCycleData?.records) return monthlyFuelTotal
    return billingCycleData.records.reduce((sum, record) => sum + record.valor, 0)
  }, [billingCycleData, monthlyFuelTotal])

  const stats = useMemo(() => {
    const fleetVehicles = vehicles.filter((vehicle) => vehicle.frota)
    const agregadoVehicles = vehicles.filter((vehicle) => !vehicle.frota)
    const totalFleetVehicles = fleetVehicles.length
    const totalAgregados = agregadoVehicles.length
    const alugados = fleetVehicles.filter((vehicle) => vehicle.tipoPropriedade === "alugado").length
    const proprios = fleetVehicles.filter((vehicle) => vehicle.tipoPropriedade === "proprio").length
    const naOficina = fleetVehicles.filter((vehicle) => vehicle.naOficina).length
    const paraRevisao = fleetVehicles.filter((vehicle) => isVehicleDueForReview(vehicle)).length
    const contratosVencendoFrota = countExpiringContracts(fleetVehicles)
    const contratosVencendoAgregados = countExpiringContracts(agregadoVehicles)
    const valorEnviadoFrota = multas
      .filter((multa) => multa.status === "enviado")
      .reduce((sum, multa) => sum + getMultaTotalValue(multa), 0)
    const quantidadeEnviadaFrota = multas.filter((multa) => multa.status === "enviado").length
    const valorPagoRh = multas
      .filter((multa) => multa.rhStatus === "pago")
      .reduce((sum, multa) => sum + getMultaTotalValue(multa), 0)
    const quantidadePagaRh = multas.filter((multa) => multa.rhStatus === "pago").length

    return [
      {
        label: "Veículos Frota",
        value: totalFleetVehicles.toString(),
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
        label: "Contratos a Vencer Frota",
        value: contratosVencendoFrota.toString(),
        icon: AlertTriangle,
        color: "bg-destructive/10 text-destructive",
      },
      {
        label: "Veículos Agregados",
        value: totalAgregados.toString(),
        icon: Truck,
        color: "bg-sky-500/10 text-sky-600",
      },
      {
        label: "Contratos a Vencer Agregados",
        value: contratosVencendoAgregados.toString(),
        icon: AlertTriangle,
        color: "bg-amber-500/10 text-amber-600",
      },
      {
        label: "Faturamento Mensal",
        value: formatCurrency(billingCycleFuelTotal),
        helperText: `Ciclo ${formatShortDate(billingCycle.start)} a ${formatShortDate(billingCycle.end)}`,
        icon: Fuel,
        color: "bg-emerald-500/10 text-emerald-600",
      },
      {
        label: "Multas Enviadas pela Frota",
        value: formatCurrency(valorEnviadoFrota),
        helperText: `${quantidadeEnviadaFrota} ${quantidadeEnviadaFrota === 1 ? "multa enviada" : "multas enviadas"}`,
        icon: Send,
        color: "bg-sky-500/10 text-sky-600",
      },
      {
        label: "Multas Pagas pelo RH",
        value: formatCurrency(valorPagoRh),
        helperText: `${quantidadePagaRh} ${quantidadePagaRh === 1 ? "multa paga" : "multas pagas"}`,
        icon: BadgeCheck,
        color: "bg-emerald-500/10 text-emerald-600",
      },
      {
        label: "Colaboradores",
        value: totalColaboradores.toString(),
        helperText: `${vehicles.filter((vehicle) => vehicle.colaboradorId).length} com veículo vinculado`,
        icon: Users,
        color: "bg-primary/10 text-primary",
      },
    ]
  }, [billingCycle.end, billingCycle.start, billingCycleFuelTotal, multas, totalColaboradores, vehicles])

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
      {stats.map((stat) => {
        const variant = statCardVariants[stat.label] ?? statCardVariants.Colaboradores
        const isWideMetric = stat.label === "Multas Pagas pelo RH" || stat.label === "Colaboradores"

        return (
          <Card
            key={stat.label}
            className={cn(
              "relative overflow-hidden rounded-[1.35rem] border",
              variant.cardClass,
              isWideMetric ? "sm:col-span-2 xl:col-span-2" : ""
            )}
          >
            <div className={cn("absolute -right-3 -top-3 h-12 w-12 rounded-full blur-2xl", variant.glowClass)} />
            <div className="absolute inset-x-0 top-0 h-1 bg-[linear-gradient(90deg,rgba(255,255,255,0.7),rgba(255,255,255,0),rgba(255,255,255,0.55))]" />
            <CardContent className="relative flex min-h-[98px] items-start gap-3 p-4 sm:p-4.5">
              <div className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-[0.95rem] border border-white/70 shadow-sm", variant.iconClass)}>
                <stat.icon className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1 pt-0.5">
                <p className="text-[1.7rem] font-extrabold leading-none tracking-[-0.03em] text-slate-900">{stat.value}</p>
                <p className="mt-1.5 text-[0.9rem] font-semibold leading-tight text-slate-700">{stat.label}</p>
                {"helperText" in stat ? (
                  <p className="mt-1 text-[0.76rem] leading-tight text-slate-500">{stat.helperText}</p>
                ) : null}
              </div>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}
