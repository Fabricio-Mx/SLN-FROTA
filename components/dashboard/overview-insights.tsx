"use client"

import { useMemo } from "react"
import { Cell, Legend, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"
import { CheckCircle2, Fuel, ShieldAlert, Users } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import { getMultaTotalValue } from "@/lib/multas"
import { isVehicleDueForReview } from "@/lib/fleet-maintenance"
import type { UseFuelDataResult } from "@/hooks/use-fuel-data"
import type { Colaborador, Multa, Vehicle } from "@/lib/types"

type OverviewInsightsProps = {
  vehicles: Vehicle[]
  colaboradores: Colaborador[]
  multas: Multa[]
  fuelData: UseFuelDataResult | null
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value)
}

function formatPercent(value: number): string {
  return `${Math.round(value)}%`
}

const EMPTY_STATE_CLASS =
  "flex h-[200px] items-center justify-center rounded-xl border border-dashed border-border text-center text-sm text-muted-foreground"

export function OverviewInsights({ vehicles, colaboradores, multas, fuelData }: OverviewInsightsProps) {
  const weeklyFuelPoints = useMemo(() => {
    const comparison = fuelData?.weeklyComparison
    const currentMonthKey = fuelData?.currentMonth

    if (!comparison || !currentMonthKey || !comparison.months.some((month) => month.key === currentMonthKey)) {
      return []
    }

    return comparison.points
      .map((point) => ({
        weekLabel: point.weekLabel,
        valor: typeof point[currentMonthKey] === "number" ? (point[currentMonthKey] as number) : 0,
      }))
      .filter((point) => point.valor > 0)
  }, [fuelData])

  const multasChartData = useMemo(() => {
    const pago = multas.filter((multa) => multa.rhStatus === "pago").reduce((sum, multa) => sum + getMultaTotalValue(multa), 0)
    const pendente = multas
      .filter((multa) => multa.rhStatus === "pendente")
      .reduce((sum, multa) => sum + getMultaTotalValue(multa), 0)
    const total = pago + pendente

    return {
      total,
      data: [
        { name: "Pagas", value: pago, color: "#159a8c" },
        { name: "Pendentes", value: pendente, color: "#e0aa22" },
      ].filter((item) => item.value > 0),
    }
  }, [multas])

  const colaboradoresInsights = useMemo(() => {
    const hoje = new Date()
    const trintaDias = new Date(hoje.getTime() + 30 * 24 * 60 * 60 * 1000)

    let validas = 0
    let vencendo = 0
    let vencidas = 0

    for (const colaborador of colaboradores) {
      if (!colaborador.dataVencimentoCNH) continue
      const vencimento = new Date(colaborador.dataVencimentoCNH)
      if (Number.isNaN(vencimento.getTime())) continue
      if (vencimento < hoje) vencidas += 1
      else if (vencimento <= trintaDias) vencendo += 1
      else validas += 1
    }

    const colaboradoresComVeiculo = new Set(
      vehicles.map((vehicle) => vehicle.colaboradorId).filter((id): id is string => Boolean(id))
    )
    const comVeiculo = colaboradores.filter((colaborador) => colaboradoresComVeiculo.has(colaborador.id)).length
    const semVeiculo = colaboradores.length - comVeiculo

    return {
      total: colaboradores.length,
      comVeiculo,
      semVeiculo,
      cnhData: [
        { name: "CNH em dia", value: validas, color: "#159a8c" },
        { name: "Vencendo em 30 dias", value: vencendo, color: "#e0aa22" },
        { name: "CNH vencida", value: vencidas, color: "#d64545" },
      ].filter((item) => item.value > 0),
    }
  }, [colaboradores, vehicles])

  const frotaSituacao = useMemo(() => {
    const frotaVehicles = vehicles.filter((vehicle) => vehicle.frota)
    const naOficina = frotaVehicles.filter((vehicle) => vehicle.naOficina).length
    const paraRevisao = frotaVehicles.filter((vehicle) => !vehicle.naOficina && isVehicleDueForReview(vehicle)).length
    const emCirculacao = frotaVehicles.length - naOficina - paraRevisao
    const total = frotaVehicles.length
    const percentualCirculacao = total > 0 ? (emCirculacao / total) * 100 : 0

    return {
      total,
      emCirculacao,
      naOficina,
      paraRevisao,
      percentualCirculacao,
      data: [
        { name: "Em circulação", value: emCirculacao, color: "#2f7ddf" },
        { name: "Na oficina", value: naOficina, color: "#e0aa22" },
        { name: "Para revisão", value: paraRevisao, color: "#7c3aed" },
      ].filter((item) => item.value > 0),
    }
  }, [vehicles])

  return (
    <div className="grid gap-4 xl:grid-cols-3">
      <Card className="overflow-hidden rounded-[1.6rem] border-border shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base text-slate-900">
            <Fuel className="h-4.5 w-4.5 text-[#7CB342]" />
            Resumo Financeiro
          </CardTitle>
          <CardDescription>Combustível por semana e situação das multas.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-5 sm:grid-cols-2">
          <div>
            <p className="text-xs font-medium text-muted-foreground">Combustível (mês atual)</p>
            <p className="text-xl font-bold text-slate-900">{formatCurrency(fuelData?.monthlyTotal ?? 0)}</p>
            {weeklyFuelPoints.length === 0 ? (
              <div className={cn(EMPTY_STATE_CLASS, "mt-2 h-[160px]")}>Sem dados de combustível importados.</div>
            ) : (
              <div className="mt-2 h-[160px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={weeklyFuelPoints} margin={{ left: 0, right: 8, top: 8, bottom: 0 }}>
                    <XAxis dataKey="weekLabel" tickLine={false} axisLine={false} fontSize={11} />
                    <YAxis hide />
                    <Tooltip formatter={(value) => formatCurrency(Number(value))} />
                    <Line type="monotone" dataKey="valor" stroke="#7CB342" strokeWidth={2.5} dot={{ r: 3, fill: "#7CB342" }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          <div>
            <p className="text-xs font-medium text-muted-foreground">Total Multas</p>
            <p className="text-xl font-bold text-slate-900">{formatCurrency(multasChartData.total)}</p>
            {multasChartData.data.length === 0 ? (
              <div className={cn(EMPTY_STATE_CLASS, "mt-2 h-[160px]")}>Nenhuma multa registrada.</div>
            ) : (
              <div className="mt-2 h-[160px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={multasChartData.data} dataKey="value" nameKey="name" innerRadius={38} outerRadius={58} paddingAngle={2}>
                      {multasChartData.data.map((entry) => (
                        <Cell key={entry.name} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value) => formatCurrency(Number(value))} />
                    <Legend verticalAlign="bottom" height={24} iconSize={8} wrapperStyle={{ fontSize: 11 }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Card className="overflow-hidden rounded-[1.6rem] border-border shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base text-slate-900">
            <Users className="h-4.5 w-4.5 text-[#159a8c]" />
            Colaboradores
          </CardTitle>
          <CardDescription>Total na frota e situação da CNH.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-xl font-bold text-slate-900">{colaboradoresInsights.total} colaboradores</p>
          {colaboradoresInsights.cnhData.length === 0 ? (
            <div className={EMPTY_STATE_CLASS}>Nenhum colaborador cadastrado.</div>
          ) : (
            <div className="h-[160px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={colaboradoresInsights.cnhData} dataKey="value" nameKey="name" innerRadius={38} outerRadius={58} paddingAngle={2}>
                    {colaboradoresInsights.cnhData.map((entry) => (
                      <Cell key={entry.name} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend verticalAlign="bottom" height={24} iconSize={8} wrapperStyle={{ fontSize: 11 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}

          <div className="space-y-2 rounded-xl border border-border bg-muted/30 p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Vínculos</p>
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-600">Com veículo</span>
              <span className="font-semibold text-slate-900">{colaboradoresInsights.comVeiculo}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-600">Sem veículo</span>
              <span className="font-semibold text-slate-900">{colaboradoresInsights.semVeiculo}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="overflow-hidden rounded-[1.6rem] border-border shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base text-slate-900">
            <ShieldAlert className="h-4.5 w-4.5 text-[#2f7ddf]" />
            Situação da Frota
          </CardTitle>
          <CardDescription>Distribuição dos veículos da frota por status.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {frotaSituacao.data.length === 0 ? (
            <div className={EMPTY_STATE_CLASS}>Nenhum veículo de frota cadastrado.</div>
          ) : (
            <div className="h-[180px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={frotaSituacao.data} dataKey="value" nameKey="name" innerRadius={42} outerRadius={64} paddingAngle={2}>
                    {frotaSituacao.data.map((entry) => (
                      <Cell key={entry.name} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend verticalAlign="bottom" height={24} iconSize={8} wrapperStyle={{ fontSize: 11 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}

          {frotaSituacao.total > 0 ? (
            <div
              className={cn(
                "flex items-center gap-2 rounded-xl border px-3.5 py-2.5 text-sm font-medium",
                frotaSituacao.percentualCirculacao >= 70
                  ? "border-[#dbe8cf] bg-[#f3f9e8] text-[#4c7a22]"
                  : "border-[#f0dfaa] bg-[#fff8df] text-[#8a6a15]"
              )}
            >
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              <span>
                {frotaSituacao.percentualCirculacao >= 70 ? "Frota operando normalmente" : "Atenção: parte da frota indisponível"} —{" "}
                {formatPercent(frotaSituacao.percentualCirculacao)} dos veículos em circulação
              </span>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  )
}
