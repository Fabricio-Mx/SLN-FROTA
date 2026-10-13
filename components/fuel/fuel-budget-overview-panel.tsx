"use client"

import { useMemo, useState } from "react"
import { Bar, BarChart, CartesianGrid, LabelList, XAxis, YAxis } from "recharts"
import { CalendarClock, CalendarDays, Gauge, Info, PiggyBank, Receipt, Settings2, Target, TrendingUp, Wallet } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart"
import { useFuelBudgetAnalysis } from "@/hooks/use-fuel-budget-analysis"
import { useFuelBudgetPlan } from "@/hooks/use-fuel-budget-plan"
import {
  FUEL_BUDGET_STATUS_LABEL,
  formatBudgetCenterName,
  getFuelBudgetStatus,
  sumFuelBudgetCenters,
  type FuelBudgetCenterAnalysis,
  type FuelBudgetStatus,
} from "@/lib/fuel-budget-plan-shared"
import { cn } from "@/lib/utils"

export type FuelBudgetScope = "telecom" | "outros" | "todos"

const SCOPE_OPTIONS: Array<{ id: FuelBudgetScope; label: string }> = [
  { id: "telecom", label: "Telecom" },
  { id: "outros", label: "Outros centros" },
  { id: "todos", label: "Todos" },
]

const MAX_CHART_CENTERS = 10
// Acima disso os rotulos de valor das 3 barras se sobrepoem; mostra so o do gasto.
const MAX_CENTERS_WITH_ALL_LABELS = 6

const budgetChartConfig = {
  orcado: { label: "Orçado no mês", color: "#7b8ca3" },
  gasto: { label: "Gasto até agora", color: "#2f7d3a" },
  projecao: { label: "Projeção do mês", color: "#f0a020" },
}

export const FUEL_BUDGET_STATUS_STYLES: Record<FuelBudgetStatus, string> = {
  "sem-orcamento": "border-slate-300 bg-slate-100 text-slate-600",
  ok: "border-[#b7d9a6] bg-[#e8f5e0] text-[#2f6b25]",
  atencao: "border-[#ecd08a] bg-[#fff3d1] text-[#8a5a00]",
  estouro: "border-[#efb3ab] bg-[#fde6e3] text-[#a3261a]",
}

const STATUS_ACCENT: Record<FuelBudgetStatus, string> = {
  "sem-orcamento": "bg-slate-300",
  ok: "bg-[#3f9142]",
  atencao: "bg-[#f0a020]",
  estouro: "bg-[#d1432f]",
}

export function formatBudgetCurrency(value: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value)
}

function formatCompactCurrency(value: number): string {
  if (Math.abs(value) >= 1000) return `R$ ${(value / 1000).toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} mil`
  return `R$ ${Math.round(value).toLocaleString("pt-BR")}`
}

function formatPercent(value: number): string {
  return `${value.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`
}

function capitalizeFirst(value: string): string {
  return value ? value.charAt(0).toUpperCase() + value.slice(1) : value
}

export function filterBudgetCentersByScope(centers: FuelBudgetCenterAnalysis[], scope: FuelBudgetScope) {
  return centers.filter((center) => {
    if (scope === "telecom") return center.group === "telecom"
    const hasData = center.spentMonth > 0 || center.budgetMonthly > 0
    if (scope === "outros") return center.group === "outros" && hasData
    return hasData || center.group === "telecom"
  })
}

type FuelBudgetOverviewPanelProps = {
  onManageBudget?: () => void
}

export function FuelBudgetOverviewPanel({ onManageBudget }: FuelBudgetOverviewPanelProps) {
  const [scope, setScope] = useState<FuelBudgetScope>("telecom")
  const { plan, isLoading } = useFuelBudgetPlan()
  const { analysis, monthLabel } = useFuelBudgetAnalysis(plan)

  const scopedCenters = useMemo(() => {
    const filtered = filterBudgetCentersByScope(analysis.centers, scope)
    if (scope === "telecom") return filtered
    return [...filtered].sort((left, right) => Math.max(right.spentMonth, right.budgetMonthly) - Math.max(left.spentMonth, left.budgetMonthly))
  }, [analysis.centers, scope])

  const totals = useMemo(() => sumFuelBudgetCenters(scopedCenters), [scopedCenters])
  const totalStatus = getFuelBudgetStatus(totals.budgetMonthly, totals.projection)
  const hasBudget = totals.budgetMonthly > 0
  const monthProgress = analysis.daysInMonth > 0 ? (analysis.elapsedDays / analysis.daysInMonth) * 100 : 0
  const scopeLabel = SCOPE_OPTIONS.find((option) => option.id === scope)?.label ?? ""

  const chartData = useMemo(() => {
    return scopedCenters.slice(0, MAX_CHART_CENTERS).map((center) => ({
      name: formatBudgetCenterName(center),
      orcado: Number(center.budgetMonthly.toFixed(2)),
      gasto: Number(center.spentMonth.toFixed(2)),
      projecao: Number(center.projection.toFixed(2)),
    }))
  }, [scopedCenters])

  const showAllLabels = chartData.length <= MAX_CENTERS_WITH_ALL_LABELS
  const tiltLabels = chartData.length > 5

  return (
    <Card className="overflow-hidden border-[#cfdcc6] bg-white shadow-md">
      <div data-theme-preserve className="bg-[linear-gradient(120deg,#1b4029_0%,#24573a_55%,#2f6d45_100%)] px-5 py-4 text-white">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-start gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white/15 ring-1 ring-white/25">
              <Target className="h-5 w-5 text-[#c5e1a5]" />
            </span>
            <div>
              <h3 className="text-xl font-extrabold tracking-tight sm:text-2xl">Orçado x Gasto por área</h3>
              <div className="mt-1.5 flex flex-wrap items-center gap-2 text-sm">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-2.5 py-0.5 font-semibold">
                  <CalendarDays className="h-3.5 w-3.5" />
                  {capitalizeFirst(monthLabel)}
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-2.5 py-0.5 font-semibold">
                  {scopeLabel}
                </span>
                <span className="text-white/85">
                  {analysis.referenceDate
                    ? `Dados até ${analysis.referenceDate.toLocaleDateString("pt-BR")}`
                    : "Sem abastecimentos no mês"}
                </span>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="flex rounded-xl bg-black/20 p-1 ring-1 ring-white/20">
              {SCOPE_OPTIONS.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => setScope(option.id)}
                  className={cn(
                    "rounded-lg px-3.5 py-1.5 text-sm font-semibold transition-colors",
                    scope === option.id ? "bg-white text-[#1b4029] shadow-sm" : "text-white/85 hover:bg-white/10 hover:text-white",
                  )}
                >
                  {option.label}
                </button>
              ))}
            </div>
            {onManageBudget ? (
              <Button size="sm" className="h-9 bg-[#7CB342] font-semibold text-white hover:bg-[#8bc34a]" onClick={onManageBudget}>
                <Settings2 className="mr-1.5 h-4 w-4" />
                Editar orçado
              </Button>
            ) : null}
          </div>
        </div>

        <div className="mt-4 flex items-center gap-3">
          <span className="shrink-0 text-xs font-semibold uppercase tracking-[0.1em] text-white/80">Mês decorrido</span>
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-white/20">
            <div className="h-full rounded-full bg-[#c5e1a5]" style={{ width: `${Math.min(100, monthProgress)}%` }} />
          </div>
          <span className="shrink-0 text-sm font-bold">
            Dia {analysis.elapsedDays} de {analysis.daysInMonth} · {formatPercent(monthProgress)}
          </span>
        </div>
      </div>

      <CardContent className="space-y-5 bg-[#f6f8f5] p-5">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <BudgetKpi
            icon={Wallet}
            accent="slate"
            label="Orçado no mês"
            value={hasBudget ? formatBudgetCurrency(totals.budgetMonthly) : "Não definido"}
            lines={[
              { label: "Diário", value: formatBudgetCurrency(totals.budgetDaily) },
              { label: "Semanal", value: formatBudgetCurrency(totals.budgetWeekly) },
            ]}
          />
          <BudgetKpi
            icon={Gauge}
            accent="green"
            label="Gasto até agora"
            value={formatBudgetCurrency(totals.spentMonth)}
            progress={hasBudget ? totals.consumedPercent : undefined}
            lines={
              hasBudget
                ? [
                    { label: "Consumido", value: formatPercent(totals.consumedPercent) },
                    { label: "Ritmo ideal até hoje", value: formatBudgetCurrency(totals.budgetToDate) },
                  ]
                : [{ label: "Semana atual", value: formatBudgetCurrency(totals.spentCurrentWeek) }]
            }
          />
          <BudgetKpi
            icon={TrendingUp}
            accent="amber"
            label="Projeção do mês"
            value={formatBudgetCurrency(totals.projection)}
            lines={[
              { label: "Semana atual", value: formatBudgetCurrency(totals.spentCurrentWeek) },
              { label: "Último dia", value: formatBudgetCurrency(totals.spentReferenceDay) },
            ]}
          />
          <BudgetKpi
            icon={PiggyBank}
            accent={!hasBudget ? "slate" : totals.projectedBalance < 0 ? "red" : "green"}
            label="Saldo projetado"
            value={hasBudget ? formatBudgetCurrency(totals.projectedBalance) : "—"}
            valueTone={!hasBudget ? undefined : totals.projectedBalance < 0 ? "danger" : "success"}
            badge={hasBudget ? { status: totalStatus } : undefined}
            lines={hasBudget ? [] : [{ label: "Defina o orçado na aba", value: "Orçamento" }]}
          />
        </div>

        {isLoading && chartData.length === 0 ? (
          <div className="h-[360px] animate-pulse rounded-2xl border border-[#dfe7d8] bg-white" />
        ) : chartData.length === 0 ? (
          <div className="flex h-[200px] flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-[#cfdcc6] bg-white text-sm font-medium text-slate-600">
            <CalendarClock className="h-6 w-6 text-slate-500" />
            Nenhum centro de custo com gasto ou orçado neste recorte.
          </div>
        ) : (
          <>
            <div className="rounded-2xl border border-[#dfe7d8] bg-white p-4 shadow-sm">
              <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
                <p className="text-base font-bold text-slate-800">Comparativo por centro de custo</p>
                <div className="flex flex-wrap items-center gap-4 text-sm font-semibold text-slate-700">
                  {Object.entries(budgetChartConfig).map(([key, item]) => (
                    <span key={key} className="inline-flex items-center gap-1.5">
                      <span className="h-3 w-3 rounded-[4px]" style={{ backgroundColor: item.color }} />
                      {item.label}
                    </span>
                  ))}
                </div>
              </div>
              <ChartContainer className="h-[360px] w-full" config={budgetChartConfig}>
                <BarChart data={chartData} margin={{ left: 8, right: 8, top: 28, bottom: 4 }} barGap={4} barCategoryGap="20%">
                  <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis
                    dataKey="name"
                    tickLine={false}
                    axisLine={{ stroke: "#cbd5e1" }}
                    tickMargin={10}
                    interval={0}
                    tick={{ fontSize: 12, fontWeight: 700, fill: "#334155" }}
                    height={tiltLabels ? 70 : 34}
                    angle={tiltLabels ? -18 : 0}
                    textAnchor={tiltLabels ? "end" : "middle"}
                  />
                  <YAxis
                    tickLine={false}
                    axisLine={false}
                    width={82}
                    tick={{ fontSize: 12, fill: "#475569" }}
                    tickFormatter={(value: number) => formatCompactCurrency(value)}
                  />
                  <ChartTooltip
                    content={
                      <ChartTooltipContent
                        formatter={(value, name, item) => (
                          <div className="flex w-full items-center justify-between gap-4">
                            <span className="flex items-center gap-1.5 text-muted-foreground">
                              <span className="h-2.5 w-2.5 rounded-[3px]" style={{ backgroundColor: item?.color ?? item?.payload?.fill }} />
                              {budgetChartConfig[name as keyof typeof budgetChartConfig]?.label ?? name}
                            </span>
                            <span className="font-mono font-semibold tabular-nums text-foreground">{formatBudgetCurrency(Number(value))}</span>
                          </div>
                        )}
                      />
                    }
                  />
                  <Bar dataKey="orcado" fill="var(--color-orcado)" radius={[6, 6, 0, 0]} maxBarSize={56}>
                    {showAllLabels ? <LabelList dataKey="orcado" content={<BarValueLabel color="#475569" />} /> : null}
                  </Bar>
                  <Bar dataKey="gasto" fill="var(--color-gasto)" radius={[6, 6, 0, 0]} maxBarSize={56}>
                    <LabelList dataKey="gasto" content={<BarValueLabel color="#1f5a28" />} />
                  </Bar>
                  <Bar dataKey="projecao" fill="var(--color-projecao)" radius={[6, 6, 0, 0]} maxBarSize={56}>
                    {showAllLabels ? <LabelList dataKey="projecao" content={<BarValueLabel color="#9a5b00" />} /> : null}
                  </Bar>
                </BarChart>
              </ChartContainer>
              {scopedCenters.length > MAX_CHART_CENTERS ? (
                <p className="mt-1 text-center text-sm text-slate-600">
                  Gráfico com os {MAX_CHART_CENTERS} maiores de {scopedCenters.length} centros. Todos aparecem nos cartões abaixo.
                </p>
              ) : null}
            </div>

            <div className={cn("grid gap-3 sm:grid-cols-2", scopedCenters.length >= 4 ? "xl:grid-cols-4" : "xl:grid-cols-3")}>
              {scopedCenters.map((center) => (
                <BudgetCenterCard key={center.centerCode} center={center} areaTotal={totals.spentMonth} />
              ))}
            </div>
          </>
        )}

        <div className="flex flex-wrap items-start gap-x-6 gap-y-1.5 rounded-xl border border-[#dfe7d8] bg-white px-4 py-2.5 text-xs text-slate-600">
          <span className="inline-flex items-center gap-1.5 font-semibold text-slate-700">
            <Info className="h-3.5 w-3.5" />
            Como ler
          </span>
          <span>
            <b className="text-slate-800">Projeção</b> = gasto até agora ÷ dias corridos × dias do mês.
          </span>
          <span>
            <b className="text-slate-800">Ritmo ideal</b> = orçado proporcional aos dias corridos (traço na barra).
          </span>
          <span>
            <b className="text-slate-800">Orçado</b> = diária × dias trabalhados × 4 semanas.
          </span>
        </div>
      </CardContent>
    </Card>
  )
}

type BarValueLabelProps = {
  x?: number | string
  y?: number | string
  width?: number | string
  value?: number | string
  color: string
}

function BarValueLabel({ x, y, width, value, color }: BarValueLabelProps) {
  const numeric = Number(value)
  if (!Number.isFinite(numeric) || numeric <= 0) return null

  const centerX = Number(x ?? 0) + Number(width ?? 0) / 2
  return (
    <text x={centerX} y={Number(y ?? 0) - 7} textAnchor="middle" fontSize={11.5} fontWeight={800} fill={color}>
      {formatCompactCurrency(numeric)}
    </text>
  )
}

const KPI_ACCENTS = {
  slate: { bar: "bg-[#7b8ca3]", icon: "bg-[#eef1f5] text-[#475569]" },
  green: { bar: "bg-[#2f7d3a]", icon: "bg-[#e5f3e0] text-[#2f7d3a]" },
  amber: { bar: "bg-[#f0a020]", icon: "bg-[#fff2d6] text-[#a46200]" },
  red: { bar: "bg-[#d1432f]", icon: "bg-[#fde6e3] text-[#b3321f]" },
} as const

type BudgetKpiProps = {
  icon: typeof Wallet
  accent: keyof typeof KPI_ACCENTS
  label: string
  value: string
  valueTone?: "success" | "danger"
  lines: Array<{ label: string; value: string }>
  progress?: number
  badge?: { status: FuelBudgetStatus }
}

function BudgetKpi({ icon: Icon, accent, label, value, valueTone, lines, progress, badge }: BudgetKpiProps) {
  const colors = KPI_ACCENTS[accent]

  return (
    <div className="relative overflow-hidden rounded-2xl border border-[#dfe7d8] bg-white p-4 shadow-sm">
      <span className={cn("absolute inset-x-0 top-0 h-1", colors.bar)} />
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className={cn("flex h-8 w-8 items-center justify-center rounded-xl", colors.icon)}>
            <Icon className="h-4 w-4" />
          </span>
          <span className="text-[13px] font-bold uppercase tracking-[0.06em] text-slate-700">{label}</span>
        </div>
        {badge ? (
          <span className={cn("rounded-full border px-2 py-0.5 text-[11px] font-bold uppercase", FUEL_BUDGET_STATUS_STYLES[badge.status])}>
            {FUEL_BUDGET_STATUS_LABEL[badge.status]}
          </span>
        ) : null}
      </div>
      <p
        className={cn(
          "mt-3 text-[1.85rem] font-black leading-none tracking-tight text-slate-900",
          valueTone === "danger" && "text-[#b3321f]",
          valueTone === "success" && "text-[#2f6b25]",
        )}
      >
        {value}
      </p>
      {typeof progress === "number" ? (
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-200">
          <div
            className={cn("h-full rounded-full", progress > 100 ? "bg-[#d1432f]" : progress > 90 ? "bg-[#f0a020]" : "bg-[#2f7d3a]")}
            style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
          />
        </div>
      ) : null}
      {lines.length > 0 ? (
        <div className="mt-3 space-y-1 border-t border-slate-100 pt-2.5">
          {lines.map((line) => (
            <div key={line.label} className="flex items-center justify-between gap-2 text-sm">
              <span className="text-slate-600">{line.label}</span>
              <span className="font-bold tabular-nums text-slate-800">{line.value}</span>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  )
}

function BudgetCenterCard({ center, areaTotal }: { center: FuelBudgetCenterAnalysis; areaTotal: number }) {
  const status = getFuelBudgetStatus(center.budgetMonthly, center.projection)
  const hasBudget = center.budgetMonthly > 0
  const spentPercent = hasBudget ? (center.spentMonth / center.budgetMonthly) * 100 : 0
  const projectionPercent = hasBudget ? (center.projection / center.budgetMonthly) * 100 : 0
  const paceMarker = hasBudget ? (center.budgetToDate / center.budgetMonthly) * 100 : 0
  const share = areaTotal > 0 ? (center.spentMonth / areaTotal) * 100 : 0

  return (
    <div className="relative flex flex-col overflow-hidden rounded-2xl border border-[#dfe7d8] bg-white shadow-sm">
      <span className={cn("absolute inset-y-0 left-0 w-1.5", STATUS_ACCENT[status])} />
      <div className="flex flex-1 flex-col p-4 pl-5">
        <div className="flex items-start justify-between gap-2">
          <p className="text-[15px] font-extrabold leading-snug text-slate-900">{formatBudgetCenterName(center)}</p>
          <span className={cn("shrink-0 rounded-full border px-2 py-0.5 text-[11px] font-bold uppercase", FUEL_BUDGET_STATUS_STYLES[status])}>
            {FUEL_BUDGET_STATUS_LABEL[status]}
          </span>
        </div>

        <div className="mt-3 flex items-end justify-between gap-2">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.06em] text-slate-600">Gasto no mês</p>
            <p className="text-2xl font-black leading-tight tracking-tight text-slate-900">{formatBudgetCurrency(center.spentMonth)}</p>
          </div>
          {hasBudget ? (
            <p className={cn("text-lg font-black", spentPercent > 100 ? "text-[#b3321f]" : "text-[#2f6b25]")}>{formatPercent(spentPercent)}</p>
          ) : null}
        </div>

        {hasBudget ? (
          <div className="relative mt-2 h-2.5 rounded-full bg-slate-200">
            <div className="absolute inset-y-0 left-0 rounded-full bg-[#f0a020]/40" style={{ width: `${Math.min(100, projectionPercent)}%` }} />
            <div
              className={cn("absolute inset-y-0 left-0 rounded-full", spentPercent > 100 ? "bg-[#d1432f]" : "bg-[#2f7d3a]")}
              style={{ width: `${Math.min(100, spentPercent)}%` }}
            />
            <div className="absolute -top-1 h-[18px] w-[3px] rounded bg-slate-800" style={{ left: `calc(${Math.min(100, paceMarker)}% - 1.5px)` }} title="Ritmo ideal até hoje" />
          </div>
        ) : (
          <p className="mt-2 rounded-lg bg-slate-100 px-2.5 py-1.5 text-xs font-semibold text-slate-600">Orçado ainda não definido para este centro.</p>
        )}

        <dl className="mt-3 grid grid-cols-3 gap-2 rounded-xl bg-[#f6f8f5] p-2.5">
          <CardStat label="Orçado" value={hasBudget ? formatBudgetCurrency(center.budgetMonthly) : "—"} />
          <CardStat label="Projeção" value={formatBudgetCurrency(center.projection)} tone="amber" />
          <CardStat
            label="Saldo proj."
            value={hasBudget ? formatBudgetCurrency(center.projectedBalance) : "—"}
            tone={!hasBudget ? undefined : center.projectedBalance < 0 ? "danger" : "success"}
          />
        </dl>

        <div className="mt-3 flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-[13px] text-slate-600">
          <span className="inline-flex items-center gap-1">
            <Receipt className="h-3.5 w-3.5" />
            <b className="text-slate-800">{center.transactions}</b> transações
          </span>
          <span>
            Semana atual <b className="text-slate-800">{formatBudgetCurrency(center.spentCurrentWeek)}</b>
          </span>
          {areaTotal > 0 ? (
            <span>
              <b className="text-slate-800">{formatPercent(share)}</b> do total
            </span>
          ) : null}
        </div>
      </div>
    </div>
  )
}

function CardStat({ label, value, tone }: { label: string; value: string; tone?: "amber" | "success" | "danger" }) {
  return (
    <div className="min-w-0">
      <dt className="text-[11px] font-bold uppercase tracking-[0.05em] text-slate-600">{label}</dt>
      <dd
        className={cn(
          "truncate text-[13px] font-extrabold tabular-nums text-slate-900",
          tone === "amber" && "text-[#9a5b00]",
          tone === "success" && "text-[#2f6b25]",
          tone === "danger" && "text-[#b3321f]",
        )}
        title={value}
      >
        {value}
      </dd>
    </div>
  )
}

export function BudgetCenterRow({ center, active, onClick }: { center: FuelBudgetCenterAnalysis; active?: boolean; onClick?: () => void }) {
  const status = getFuelBudgetStatus(center.budgetMonthly, center.projection)
  const spentPercent = center.budgetMonthly > 0 ? (center.spentMonth / center.budgetMonthly) * 100 : 0
  const projectionPercent = center.budgetMonthly > 0 ? (center.projection / center.budgetMonthly) * 100 : 0
  const paceMarker = center.budgetMonthly > 0 ? (center.budgetToDate / center.budgetMonthly) * 100 : 0
  const Wrapper = onClick ? "button" : "div"

  return (
    <Wrapper
      type={onClick ? "button" : undefined}
      onClick={onClick}
      className={cn(
        "block w-full rounded-xl border bg-white p-3 text-left shadow-sm transition-colors",
        active ? "border-[#7CB342] ring-2 ring-[#cfe3c4]" : "border-[#dfe7d8]",
        onClick ? "hover:border-[#9cc58a]" : "",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-bold text-slate-900" title={center.centerLabel}>
            {formatBudgetCenterName(center)}
          </p>
          <p className="text-[13px] text-slate-700">
            <b className="tabular-nums">{formatBudgetCurrency(center.spentMonth)}</b>
            {center.budgetMonthly > 0 ? ` de ${formatBudgetCurrency(center.budgetMonthly)}` : " gastos"}
          </p>
        </div>
        <span className={cn("shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase", FUEL_BUDGET_STATUS_STYLES[status])}>
          {FUEL_BUDGET_STATUS_LABEL[status]}
        </span>
      </div>

      {center.budgetMonthly > 0 ? (
        <div className="relative mt-2 h-2 rounded-full bg-slate-200">
          <div className="absolute inset-y-0 left-0 rounded-full bg-[#f0a020]/40" style={{ width: `${Math.min(100, projectionPercent)}%` }} />
          <div
            className={cn("absolute inset-y-0 left-0 rounded-full", spentPercent > 100 ? "bg-[#d1432f]" : "bg-[#2f7d3a]")}
            style={{ width: `${Math.min(100, spentPercent)}%` }}
          />
          <div className="absolute -top-0.5 h-3 w-0.5 rounded bg-slate-700" style={{ left: `${Math.min(100, paceMarker)}%` }} title="Ritmo ideal até a data" />
        </div>
      ) : null}

      <div className="mt-1.5 flex justify-between text-xs text-slate-600">
        <span>
          Projeção <b className="text-slate-800">{formatBudgetCurrency(center.projection)}</b>
        </span>
        {center.budgetMonthly > 0 ? (
          <span className={center.projectedBalance < 0 ? "font-bold text-[#b3321f]" : "font-bold text-[#2f6b25]"}>
            {center.projectedBalance < 0 ? "Excede " : "Sobra "}
            {formatBudgetCurrency(Math.abs(center.projectedBalance))}
          </span>
        ) : (
          <span>{center.transactions} transações</span>
        )}
      </div>
    </Wrapper>
  )
}
