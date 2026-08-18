"use client"

import { useMemo } from "react"
import useSWR from "swr"
import { Bar, BarChart, CartesianGrid, Cell, LabelList, XAxis, YAxis } from "recharts"
import { BarChart3, Building2, LoaderCircle, Wallet } from "lucide-react"
import { getFuelFinancialPostingCycleBoundsForClosingMonth } from "@/lib/fuel-billing"
import { resolveCostCenterRecord } from "@/lib/cost-center-shared"
import { useFuelCostCenters } from "@/hooks/use-fuel-cost-centers"
import type { FuelRecord, FuelResponse } from "@/hooks/use-fuel-data"
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart"

type FuelFinancialCostCenterChartProps = {
  cycleMonth: string
}

type CostCenterChartRow = {
  centroCusto: string
  shortLabel: string
  total: number
  totalFormatted: string
  abastecimentos: number
  color: string
}

type FuelRangeResponse = Pick<FuelResponse, "records"> & {
  records: FuelRecord[]
}

const chartConfig = {
  total: {
    label: "Faturamento",
    color: "#5dc5ff",
  },
}

async function fetchFuelRange(url: string): Promise<FuelRangeResponse> {
  const response = await fetch(url, { cache: "no-store" })
  const payload = await response.json().catch(() => ({ records: [] }))

  if (!response.ok) {
    throw new Error(payload?.error || "Falha ao carregar o gráfico financeiro.")
  }

  return { records: Array.isArray(payload?.records) ? payload.records : [] }
}

function formatDateLabel(value: Date): string {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(value)
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value)
}

function shortenLabel(value: string): string {
  return value.length > 44 ? `${value.slice(0, 44)}...` : value
}

function buildBarColor(index: number, total: number): string {
  const palette = ["#d7f1ff", "#9fdbff", "#62bfff", "#1f8fe0", "#0f5d99"]
  if (total <= 1) return palette[0]

  const ratio = index / Math.max(total - 1, 1)
  const paletteIndex = Math.min(palette.length - 1, Math.round(ratio * (palette.length - 1)))
  return palette[paletteIndex]
}

function buildRangeUrl(cycleMonth: string): string | null {
  const bounds = getFuelFinancialPostingCycleBoundsForClosingMonth(cycleMonth)
  if (!bounds) return null

  const params = new URLSearchParams({
    start: bounds.start.toISOString().slice(0, 10),
    end: bounds.end.toISOString().slice(0, 10),
    dateField: "transaction",
  })

  return `/api/fuel/data?${params.toString()}`
}

export function FuelFinancialCostCenterChart({ cycleMonth }: FuelFinancialCostCenterChartProps) {
  const { lookup, isLoading: isCostCenterLoading, error: costCenterError } = useFuelCostCenters()
  const rangeUrl = useMemo(() => buildRangeUrl(cycleMonth), [cycleMonth])
  const { data, error, isLoading } = useSWR(rangeUrl, fetchFuelRange, {
    revalidateOnFocus: false,
    revalidateOnReconnect: false,
    dedupingInterval: 30_000,
    keepPreviousData: true,
  })

  const cycleBounds = useMemo(() => getFuelFinancialPostingCycleBoundsForClosingMonth(cycleMonth), [cycleMonth])

  const summary = useMemo(() => {
    const grouped = new Map<string, { centroCusto: string; total: number; abastecimentos: number }>()

    for (const record of data?.records ?? []) {
      const resolved = resolveCostCenterRecord(record.nomeMotorista, lookup)
      const centroCusto = resolved?.centroCusto?.trim() || "Sem centro de custo"
      const current = grouped.get(centroCusto)

      grouped.set(centroCusto, {
        centroCusto,
        total: (current?.total ?? 0) + record.valor,
        abastecimentos: (current?.abastecimentos ?? 0) + 1,
      })
    }

    const chartData = Array.from(grouped.values())
      .sort((left, right) => right.total - left.total || left.centroCusto.localeCompare(right.centroCusto, "pt-BR"))
      .map<CostCenterChartRow>((item, index, rows) => ({
        centroCusto: item.centroCusto,
        shortLabel: shortenLabel(item.centroCusto),
        total: item.total,
        totalFormatted: formatCurrency(item.total),
        abastecimentos: item.abastecimentos,
        color: buildBarColor(index, rows.length),
      }))

    return {
      totalFaturado: chartData.reduce((accumulator, item) => accumulator + item.total, 0),
      totalCentros: chartData.length,
      topCenter: chartData[0] ?? null,
      chartData,
      chartHeight: Math.max(360, chartData.length * 46),
    }
  }, [data?.records, lookup])

  if (!cycleBounds) {
    return (
      <div className="rounded-3xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">
        Não foi possível calcular o ciclo selecionado para montar o gráfico.
      </div>
    )
  }

  if (isLoading || isCostCenterLoading) {
    return (
      <div className="flex min-h-[320px] items-center justify-center rounded-[28px] bg-[#0e1320] text-slate-200">
        <div className="flex items-center gap-3 text-sm">
          <LoaderCircle className="h-5 w-5 animate-spin text-[#67d0ff]" />
          Carregando faturamento consolidado por centro de custo...
        </div>
      </div>
    )
  }

  if (error || costCenterError) {
    return (
      <div className="rounded-3xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">
        {(error || costCenterError)?.message || "Não foi possível montar o gráfico financeiro."}
      </div>
    )
  }

  if (summary.chartData.length === 0) {
    return (
      <div className="flex min-h-[320px] items-center justify-center rounded-[28px] border border-dashed border-[#2b3448] bg-[#0e1320] p-6 text-center text-sm text-slate-300">
        Não existem abastecimentos nesse ciclo para consolidar o faturamento por centro de custo.
      </div>
    )
  }

  return (
    <div className="space-y-5 rounded-[30px] bg-[#0e1320] p-5 text-slate-100 shadow-[0_24px_60px_rgba(15,23,42,0.45)]">
      <div className="grid gap-4 rounded-[24px] border border-white/10 bg-[linear-gradient(180deg,rgba(15,23,42,0.72)_0%,rgba(8,13,24,0.96)_100%)] p-5 xl:grid-cols-[minmax(0,1.2fr)_minmax(420px,0.8fr)] xl:items-start">
        <div className="space-y-2 rounded-[22px] border border-white/8 bg-white/[0.03] p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#67d0ff]">Faturamento consolidado</p>
          <h3 className="max-w-xl text-3xl font-semibold leading-tight text-white">Centro de custo com maior gasto no ciclo</h3>
          <p className="text-sm text-slate-300">
            Período: {formatDateLabel(cycleBounds.start)} a {formatDateLabel(cycleBounds.end)}.
          </p>

          <div className="pt-3">
            <p className="text-sm text-slate-400">Maior consumo no período</p>
            <p className="mt-1 max-w-2xl text-xl font-semibold text-white">{summary.topCenter?.centroCusto ?? "-"}</p>
            <p className="mt-2 text-sm text-[#67d0ff]">{summary.topCenter?.totalFormatted ?? "-"}</p>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-1">
          <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4">
            <div className="flex items-center gap-2 text-xs uppercase tracking-[0.14em] text-slate-400">
              <Wallet className="h-4 w-4 text-[#67d0ff]" />
              Total acumulado
            </div>
            <p className="mt-3 text-2xl font-semibold text-[#67d0ff]">{formatCurrency(summary.totalFaturado)}</p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4">
            <div className="flex items-center gap-2 text-xs uppercase tracking-[0.14em] text-slate-400">
              <Building2 className="h-4 w-4 text-[#89e384]" />
              Centros no ciclo
            </div>
            <p className="mt-3 text-2xl font-semibold text-white">{summary.totalCentros}</p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4">
            <div className="flex items-center gap-2 text-xs uppercase tracking-[0.14em] text-slate-400">
              <BarChart3 className="h-4 w-4 text-[#f7d47c]" />
              Abastecimentos do topo
            </div>
            <p className="mt-3 text-2xl font-semibold text-white">{summary.topCenter?.abastecimentos ?? 0}</p>
            <p className="mt-1 text-xs text-slate-400">no centro de custo líder</p>
          </div>
        </div>
      </div>

      <div className="space-y-5">
        <div className="rounded-[24px] border border-white/10 bg-[#121a2b] p-4">
          <div className="overflow-x-auto rounded-2xl">
            <div className="min-w-[920px]">
              <ChartContainer config={chartConfig} className="aspect-auto min-h-[360px] w-full" style={{ height: summary.chartHeight }}>
                <BarChart data={summary.chartData} layout="vertical" margin={{ left: 12, right: 60, top: 8, bottom: 8 }}>
                  <CartesianGrid horizontal={false} strokeDasharray="3 3" stroke="rgba(148,163,184,0.16)" />
                  <XAxis type="number" hide />
                  <YAxis
                    type="category"
                    dataKey="shortLabel"
                    width={280}
                    tickLine={false}
                    axisLine={false}
                    tick={{ fill: "#e2e8f0", fontSize: 12 }}
                  />
                  <ChartTooltip
                    cursor={{ fill: "rgba(103,208,255,0.08)" }}
                    content={
                      <ChartTooltipContent
                        formatter={(value, _name, item) => {
                          const payload = item.payload as CostCenterChartRow

                          return (
                            <div className="flex min-w-[220px] items-center justify-between gap-4">
                              <div className="space-y-1">
                                <p className="font-medium text-slate-100">{payload.centroCusto}</p>
                                <p className="text-xs text-slate-400">{payload.abastecimentos} abastecimento(s)</p>
                              </div>
                              <span className="font-mono font-semibold text-white">{formatCurrency(Number(value))}</span>
                            </div>
                          )
                        }}
                        hideIndicator
                        hideLabel
                        className="border-white/10 bg-[#0b1120] text-white"
                      />
                    }
                  />
                  <Bar dataKey="total" radius={[0, 8, 8, 0]}>
                    {summary.chartData.map((entry) => (
                      <Cell key={entry.centroCusto} fill={entry.color} />
                    ))}
                    <LabelList dataKey="totalFormatted" position="right" offset={12} fill="#f8fafc" fontSize={12} />
                  </Bar>
                </BarChart>
              </ChartContainer>
            </div>
          </div>
        </div>

        <div className="rounded-[24px] border border-white/10 bg-[#121a2b] p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#67d0ff]">Ranking resumido</p>
          <div className="mt-4 grid gap-3 lg:grid-cols-2 2xl:grid-cols-3">
            {summary.chartData.slice(0, 8).map((item, index) => (
              <div key={item.centroCusto} className="rounded-2xl border border-white/8 bg-white/[0.04] p-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">#{index + 1}</p>
                    <p className="mt-1 text-sm font-medium text-white">{item.centroCusto}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-[#67d0ff]">{item.totalFormatted}</p>
                    <p className="mt-1 text-xs text-slate-400">{item.abastecimentos} abastecimento(s)</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}