"use client"

import { useMemo, useState } from "react"
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, XAxis, YAxis } from "recharts"
import { AlertTriangle, Building2, PencilLine, Users, Wallet } from "lucide-react"
import { getCostCenterBaseKey, preferCostCenterLabel, resolveCostCenterRecord, normalizeCostCenterDriverName } from "@/lib/cost-center-shared"
import { FuelCostCenterEditor } from "@/components/fuel/fuel-cost-center-editor"
import { useFuelDataContext } from "@/components/fuel/fuel-data-provider"
import { useFuelCostCenters } from "@/hooks/use-fuel-cost-centers"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { parseFuelDateTime } from "@/lib/fuel-datetime"

type DriverSummary = {
  motorista: string
  centroCusto: string
  supervisor: string
  coordenador: string
  total: number
  abastecimentos: number
}

type CostCenterSummary = {
  centroCusto: string
  supervisor: string
  coordenador: string
  total: number
  abastecimentos: number
  motoristas: number
}

type CostCenterChartDatum = CostCenterSummary & {
  shortLabel: string
  barColor: string
}

type EnrichedCostCenterRecord = {
  nomeMotorista: string
  valor: number
  dateTime: string
  cardPlate: string
  centroCusto: string
  supervisor: string
  coordenador: string
}

type SelectedCenterTransaction = {
  motorista: string
  valor: number
  dateTime: string
  cardPlate: string
}

const costCenterChartConfig = {
  total: {
    label: "Gasto",
    color: "#5f9a54",
  },
}

function getCostCenterBarColor(index: number, total: number): string {
  const colorStops = [
    { r: 191, g: 222, b: 255 },
    { r: 247, g: 229, b: 140 },
    { r: 240, g: 166, b: 92 },
    { r: 214, g: 78, b: 78 },
  ]

  if (total <= 1) {
    const only = colorStops[colorStops.length - 1]
    return `rgb(${only.r} ${only.g} ${only.b})`
  }

  const ratio = 1 - index / (total - 1)
  const segmentCount = colorStops.length - 1
  const scaled = ratio * segmentCount
  const segmentIndex = Math.min(Math.floor(scaled), segmentCount - 1)
  const segmentProgress = scaled - segmentIndex

  const start = colorStops[segmentIndex]
  const end = colorStops[segmentIndex + 1]

  const red = Math.round(start.r + (end.r - start.r) * segmentProgress)
  const green = Math.round(start.g + (end.g - start.g) * segmentProgress)
  const blue = Math.round(start.b + (end.b - start.b) * segmentProgress)

  return `rgb(${red} ${green} ${blue})`
}

function truncateLabel(value: string, maxLength: number): string {
  return value.length > maxLength ? `${value.slice(0, maxLength)}...` : value
}

function normalizeCenterKey(value: string): string {
  return getCostCenterBaseKey(value)
}

function buildCostCenterRenderKey(center: Pick<CostCenterSummary, "centroCusto" | "supervisor" | "coordenador">, index?: number): string {
  const baseKey = `${center.centroCusto}-${center.supervisor}-${center.coordenador}`
  return typeof index === "number" ? `${baseKey}-${index}` : baseKey
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value)
}

function formatDateTime(value: string): string {
  const date = parseFuelDateTime(value)
  if (Number.isNaN(date.getTime())) return value

  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(date)
}

export function FuelCostCenterInsights() {
  const { records, selectedMonth, availableMonths } = useFuelDataContext()
  const { lookup } = useFuelCostCenters()
  const [editingDriver, setEditingDriver] = useState<DriverSummary | null>(null)
  const [selectedSupervisor, setSelectedSupervisor] = useState("todos")
  const [selectedCoordenador, setSelectedCoordenador] = useState("todos")
  const [selectedCenterKey, setSelectedCenterKey] = useState<string | null>(null)

  const enrichedRecords = useMemo<EnrichedCostCenterRecord[]>(() => {
    return records.map((record) => {
      const costCenterRecord = resolveCostCenterRecord(record.nomeMotorista, lookup)

      return {
        ...record,
        centroCusto: costCenterRecord?.centroCusto ?? "",
        supervisor: costCenterRecord?.supervisor ?? "",
        coordenador: costCenterRecord?.coordenador ?? "",
      }
    })
  }, [lookup, records])

  const supervisorOptions = useMemo(() => {
    return Array.from(new Set(enrichedRecords.map((record) => record.supervisor).filter(Boolean))).sort((left, right) =>
      left.localeCompare(right, "pt-BR")
    )
  }, [enrichedRecords])

  const coordenadorOptions = useMemo(() => {
    return Array.from(new Set(enrichedRecords.map((record) => record.coordenador).filter(Boolean))).sort((left, right) =>
      left.localeCompare(right, "pt-BR")
    )
  }, [enrichedRecords])

  const filteredEnrichedRecords = useMemo(() => {
    return enrichedRecords.filter((record) => {
      if (selectedSupervisor !== "todos" && record.supervisor !== selectedSupervisor) return false
      if (selectedCoordenador !== "todos" && record.coordenador !== selectedCoordenador) return false
      return true
    })
  }, [enrichedRecords, selectedCoordenador, selectedSupervisor])

  const metrics = useMemo(() => {
    const drivers = new Map<string, DriverSummary>()
    const centers = new Map<string, CostCenterSummary>()
    const driversPerCenter = new Map<string, Set<string>>()
    let totalSpend = 0
    let matchedSpend = 0

    for (const record of filteredEnrichedRecords) {
      totalSpend += record.valor

      const driverKey = normalizeCostCenterDriverName(record.nomeMotorista)
      if (driverKey) {
        const currentDriver = drivers.get(driverKey)
        drivers.set(driverKey, {
          motorista: currentDriver?.motorista ?? record.nomeMotorista,
          centroCusto: currentDriver?.centroCusto ?? record.centroCusto,
          supervisor: currentDriver?.supervisor ?? record.supervisor,
          coordenador: currentDriver?.coordenador ?? record.coordenador,
          total: (currentDriver?.total ?? 0) + record.valor,
          abastecimentos: (currentDriver?.abastecimentos ?? 0) + 1,
        })
      }

      if (!record.centroCusto) {
        continue
      }

      matchedSpend += record.valor

      const centerKey = normalizeCenterKey(record.centroCusto)
      const currentCenter = centers.get(centerKey)
      const driverBucket = driversPerCenter.get(centerKey) ?? new Set<string>()
      driverBucket.add(driverKey)
      driversPerCenter.set(centerKey, driverBucket)

      centers.set(centerKey, {
        centroCusto: preferCostCenterLabel(currentCenter?.centroCusto ?? "", record.centroCusto),
        supervisor: currentCenter?.supervisor ?? record.supervisor,
        coordenador: currentCenter?.coordenador ?? record.coordenador,
        total: (currentCenter?.total ?? 0) + record.valor,
        abastecimentos: (currentCenter?.abastecimentos ?? 0) + 1,
        motoristas: driverBucket.size,
      })
    }

    const driverList = Array.from(drivers.values())
    const matchedDrivers = driverList.filter((driver) => Boolean(driver.centroCusto))
    const unmatchedDrivers = driverList
      .filter((driver) => !driver.centroCusto)
      .sort((left, right) => right.total - left.total || left.motorista.localeCompare(right.motorista, "pt-BR"))

    const centerList = Array.from(centers.entries())
      .map(([key, center]) => ({
        ...center,
        motoristas: driversPerCenter.get(key)?.size ?? 0,
      }))
      .sort((left, right) => right.total - left.total || left.centroCusto.localeCompare(right.centroCusto, "pt-BR"))

    return {
      uniqueDrivers: driverList.length,
      matchedDrivers: matchedDrivers.length,
      unmatchedDrivers,
      matchedSpend,
      totalSpend,
      centerList,
    }
  }, [filteredEnrichedRecords])

  const selectedMonthOption = useMemo(() => {
    return availableMonths.find((month) => month.month === selectedMonth) ?? null
  }, [availableMonths, selectedMonth])

  const costCenterChartData = useMemo<CostCenterChartDatum[]>(() => {
    const total = metrics.centerList.length

    return metrics.centerList.map((center, index) => ({
      ...center,
      shortLabel: truncateLabel(center.centroCusto, 28),
      barColor: getCostCenterBarColor(index, total),
    }))
  }, [metrics.centerList])

  const donutChartData = useMemo(() => {
    return metrics.centerList.map((center, index) => ({
      ...center,
      value: center.total,
      color: getCostCenterBarColor(index, Math.max(metrics.centerList.length, 1)),
    }))
  }, [metrics.centerList])

  const chartHeight = useMemo(() => {
    return Math.max(320, costCenterChartData.length * 42)
  }, [costCenterChartData.length])

  const resolvedSelectedCenterKey = useMemo(() => {
    if (!selectedCenterKey) return null

    return metrics.centerList.some((center) => normalizeCenterKey(center.centroCusto) === selectedCenterKey)
      ? selectedCenterKey
      : null
  }, [metrics.centerList, selectedCenterKey])

  const selectedCenter = useMemo(() => {
    if (!resolvedSelectedCenterKey) return null
    return metrics.centerList.find((center) => normalizeCenterKey(center.centroCusto) === resolvedSelectedCenterKey) ?? null
  }, [metrics.centerList, resolvedSelectedCenterKey])

  const selectedCenterTransactions = useMemo<SelectedCenterTransaction[]>(() => {
    if (!selectedCenter) return []

    const centerKey = normalizeCenterKey(selectedCenter.centroCusto)

    return filteredEnrichedRecords
      .filter((record) => record.centroCusto && normalizeCenterKey(record.centroCusto) === centerKey)
      .sort((left, right) => parseFuelDateTime(right.dateTime).getTime() - parseFuelDateTime(left.dateTime).getTime())
      .map((record) => ({
        motorista: record.nomeMotorista,
        valor: record.valor,
        dateTime: record.dateTime,
        cardPlate: record.cardPlate,
      }))
  }, [filteredEnrichedRecords, selectedCenter])

  return (
    <Card className="border-[#d8dfd1] bg-white shadow-sm">
      <CardHeader className="border-b border-[#e5ece0] pb-4">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <CardTitle className="text-xl text-slate-900">Cobertura do centro de custo</CardTitle>
            <CardDescription>
              Resumo do mês {selectedMonthOption?.label ?? "selecionado"} com os motoristas cruzados pela planilha de centro de custo.
            </CardDescription>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <span className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Supervisor</span>
              <Select value={selectedSupervisor} onValueChange={setSelectedSupervisor}>
                <SelectTrigger className="w-full min-w-[210px] bg-white">
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  {supervisorOptions.map((option) => (
                    <SelectItem key={option} value={option}>
                      {option}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <span className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Coordenação</span>
              <Select value={selectedCoordenador} onValueChange={setSelectedCoordenador}>
                <SelectTrigger className="w-full min-w-[210px] bg-white">
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todas</SelectItem>
                  {coordenadorOptions.map((option) => (
                    <SelectItem key={option} value={option}>
                      {option}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-5 p-5">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-xl border border-[#d9e5d0] bg-[#f6faf3] p-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
              <Users className="h-4 w-4 text-[#56814e]" />
              Motoristas no combustível
            </div>
            <div className="mt-2 text-2xl font-semibold text-slate-950">{metrics.uniqueDrivers}</div>
          </div>
          <div className="rounded-xl border border-[#d9e5d0] bg-[#f6faf3] p-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
              <Building2 className="h-4 w-4 text-[#56814e]" />
              Motoristas vinculados
            </div>
            <div className="mt-2 text-2xl font-semibold text-slate-950">{metrics.matchedDrivers}</div>
          </div>
          <div className="rounded-xl border border-[#f2d6cc] bg-[#fff6f2] p-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
              <AlertTriangle className="h-4 w-4 text-[#d86c61]" />
              Sem centro de custo
            </div>
            <div className="mt-2 text-2xl font-semibold text-slate-950">{metrics.unmatchedDrivers.length}</div>
          </div>
          <div className="rounded-xl border border-[#ddd8f7] bg-[#f7f5ff] p-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
              <Wallet className="h-4 w-4 text-[#7443d6]" />
              Gasto com centro vinculado
            </div>
            <div className="mt-2 text-2xl font-semibold text-slate-950">{formatCurrency(metrics.matchedSpend)}</div>
            <div className="mt-1 text-xs text-slate-500">
              {metrics.totalSpend > 0 ? `${Math.round((metrics.matchedSpend / metrics.totalSpend) * 100)}% do total do mês` : "Sem gasto no período"}
            </div>
          </div>
        </div>

        <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
          <div className="overflow-hidden rounded-xl border border-[#dfe7d8]">
            <div className="border-b border-[#e5ece0] bg-[#f6faf3] px-4 py-3">
              <div className="text-sm font-semibold text-slate-900">Gasto por centro de custo</div>
              <div className="text-xs text-slate-500">Todos os centros de custo com consumo no período selecionado.</div>
            </div>
            <div className="grid gap-4 p-4 xl:grid-cols-[minmax(0,1fr)_300px] xl:items-center">
              {costCenterChartData.length === 0 ? (
                <div className="flex h-[320px] items-center justify-center rounded-xl border border-dashed border-[#dce6d6] text-sm text-slate-500 xl:col-span-2">
                  Nenhum abastecimento com centro de custo vinculado ainda.
                </div>
              ) : (
                <>
                  <div style={{ height: `${chartHeight}px` }}>
                    <ChartContainer className="h-full w-full" config={costCenterChartConfig}>
                      <BarChart data={costCenterChartData} layout="vertical" margin={{ left: 16, right: 12, top: 8, bottom: 8 }}>
                        <CartesianGrid horizontal={false} strokeDasharray="3 3" />
                        <XAxis type="number" hide />
                        <YAxis
                          type="category"
                          dataKey="shortLabel"
                          width={175}
                          tickLine={false}
                          axisLine={false}
                        />
                        <Bar dataKey="total" radius={[0, 8, 8, 0]}>
                          {costCenterChartData.map((entry, index) => (
                            <Cell
                              key={buildCostCenterRenderKey(entry, index)}
                              fill={entry.barColor}
                              fillOpacity={selectedCenter && normalizeCenterKey(entry.centroCusto) !== normalizeCenterKey(selectedCenter.centroCusto) ? 0.55 : 1}
                              stroke={selectedCenter && normalizeCenterKey(entry.centroCusto) === normalizeCenterKey(selectedCenter.centroCusto) ? "#2f5c35" : undefined}
                              strokeWidth={selectedCenter && normalizeCenterKey(entry.centroCusto) === normalizeCenterKey(selectedCenter.centroCusto) ? 2 : 0}
                              style={{ cursor: "pointer" }}
                              onClick={() => setSelectedCenterKey(normalizeCenterKey(entry.centroCusto))}
                            />
                          ))}
                        </Bar>
                        <ChartTooltip
                          content={
                            <ChartTooltipContent
                              formatter={(value, _name, item) => {
                                const payload = item.payload as CostCenterChartDatum
                                return (
                                  <div className="flex min-w-[14rem] flex-col gap-1">
                                    <span className="font-medium text-foreground">{payload.centroCusto}</span>
                                    <span className="text-muted-foreground">
                                      {formatCurrency(Number(value))} · {payload.abastecimentos} abastecimentos · {payload.motoristas} motoristas
                                    </span>
                                  </div>
                                )
                              }}
                              hideLabel
                            />
                          }
                        />
                      </BarChart>
                    </ChartContainer>
                  </div>

                  <div className="space-y-3 rounded-xl border border-[#dfe7d8] bg-[#fbfcfa] p-4">
                    <div>
                      <div className="text-sm font-semibold text-slate-900">Participação por centro</div>
                      <div className="text-xs text-slate-500">Todos os centros de custo presentes no recorte atual.</div>
                    </div>

                    <ChartContainer className="mx-auto h-[220px] w-full max-w-[280px]" config={{}}>
                      <PieChart>
                        <Pie data={donutChartData} dataKey="value" nameKey="centroCusto" innerRadius={52} outerRadius={88} paddingAngle={3} strokeWidth={0}>
                          {donutChartData.map((entry, index) => (
                            <Cell
                              key={buildCostCenterRenderKey(entry, index)}
                              fill={entry.color}
                              fillOpacity={selectedCenter && normalizeCenterKey(entry.centroCusto) !== normalizeCenterKey(selectedCenter.centroCusto) ? 0.5 : 1}
                              stroke={selectedCenter && normalizeCenterKey(entry.centroCusto) === normalizeCenterKey(selectedCenter.centroCusto) ? "#2f5c35" : undefined}
                              strokeWidth={selectedCenter && normalizeCenterKey(entry.centroCusto) === normalizeCenterKey(selectedCenter.centroCusto) ? 2 : 0}
                              style={{ cursor: "pointer" }}
                              onClick={() => setSelectedCenterKey(normalizeCenterKey(entry.centroCusto))}
                            />
                          ))}
                        </Pie>
                        <ChartTooltip
                          content={
                            <ChartTooltipContent
                              formatter={(value, _name, item) => {
                                const payload = item.payload as (typeof donutChartData)[number]
                                return (
                                  <div className="flex min-w-[14rem] flex-col gap-1">
                                    <span className="font-medium text-foreground">{payload.centroCusto}</span>
                                    <span className="text-muted-foreground">{formatCurrency(Number(value))}</span>
                                  </div>
                                )
                              }}
                              hideLabel
                            />
                          }
                        />
                      </PieChart>
                    </ChartContainer>

                    <ScrollArea className="h-[240px] pr-3">
                      <div className="space-y-2">
                        {donutChartData.map((center, index) => (
                          <button
                            key={buildCostCenterRenderKey(center, index)}
                            type="button"
                            onClick={() => setSelectedCenterKey(normalizeCenterKey(center.centroCusto))}
                            className={
                              normalizeCenterKey(center.centroCusto) === (resolvedSelectedCenterKey ?? "")
                                ? "flex w-full items-center justify-between gap-3 rounded-lg border border-[#d5e5cf] bg-[#f4f8f1] px-2 py-2 text-left"
                                : "flex w-full items-center justify-between gap-3 rounded-lg border border-transparent px-2 py-2 text-left hover:border-[#e5ece0] hover:bg-white"
                            }
                          >
                            <div className="flex min-w-0 items-center gap-2">
                              <span className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: center.color }} />
                              <span className="truncate text-sm font-medium text-slate-800">{center.centroCusto}</span>
                            </div>
                            <span className="shrink-0 text-sm text-slate-700">{formatCurrency(center.total)}</span>
                          </button>
                        ))}
                      </div>
                    </ScrollArea>
                  </div>
                </>
              )}
            </div>
          </div>

          <div className="overflow-hidden rounded-xl border border-[#dfe7d8] bg-[#fbfcfa]">
            <div className="border-b border-[#e5ece0] bg-[#f6faf3] px-4 py-3">
              <div className="text-sm font-semibold text-slate-900">Detalhes do centro selecionado</div>
              <div className="text-xs text-slate-500">
                {selectedCenter ? `${selectedCenter.centroCusto} · ${selectedCenter.motoristas} motoristas · ${selectedCenter.abastecimentos} abastecimentos` : "Selecione um centro de custo para ver os detalhes."}
              </div>
            </div>
            {selectedCenter ? (
              <>
                <div className="grid gap-3 border-b border-[#e5ece0] bg-white/80 px-4 py-4 sm:grid-cols-3">
                  <div>
                    <div className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">Gasto acumulado</div>
                    <div className="mt-1 text-2xl font-black tracking-tight text-[#376b40]">{formatCurrency(selectedCenter.total)}</div>
                  </div>
                  <div>
                    <div className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">Supervisor</div>
                    <div className="mt-1 text-sm font-semibold text-slate-900">{selectedCenter.supervisor || "-"}</div>
                  </div>
                  <div>
                    <div className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">Coordenação</div>
                    <div className="mt-1 text-sm font-semibold text-slate-900">{selectedCenter.coordenador || "-"}</div>
                  </div>
                </div>

                <ScrollArea className="h-[520px]">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-[#fbfcfa] hover:bg-[#fbfcfa]">
                        <TableHead>Motorista</TableHead>
                        <TableHead>Valor</TableHead>
                        <TableHead>Data e hora</TableHead>
                        <TableHead>Placa</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {selectedCenterTransactions.map((transaction, index) => (
                        <TableRow key={`${transaction.motorista}-${transaction.dateTime}-${transaction.valor}-${index}`}>
                          <TableCell className="font-medium text-slate-900">{transaction.motorista}</TableCell>
                          <TableCell>{formatCurrency(transaction.valor)}</TableCell>
                          <TableCell>{formatDateTime(transaction.dateTime)}</TableCell>
                          <TableCell>{transaction.cardPlate || "-"}</TableCell>
                        </TableRow>
                      ))}
                      {selectedCenterTransactions.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={4} className="py-6 text-center text-sm text-muted-foreground">
                            Nenhum abastecimento encontrado para esse centro com os filtros atuais.
                          </TableCell>
                        </TableRow>
                      ) : null}
                    </TableBody>
                  </Table>
                </ScrollArea>
              </>
            ) : (
              <div className="flex h-[320px] items-center justify-center px-4 text-center text-sm text-slate-500">
                Selecione um centro de custo no gráfico ou na lista para abrir os abastecimentos detalhados.
              </div>
            )}
          </div>
        </div>

        <div className="overflow-hidden rounded-xl border border-[#f2d6cc] bg-[#fffdfc]">
            <div className="border-b border-[#f2d6cc] bg-[#fff6f2] px-4 py-3">
              <div className="text-sm font-semibold text-slate-900">Motoristas sem correspondência</div>
              <div className="text-xs text-slate-500">Revise esses nomes na planilha de centro de custo para completar o vínculo.</div>
            </div>
            <Table>
              <TableHeader>
                <TableRow className="bg-[#fffdfc] hover:bg-[#fffdfc]">
                  <TableHead>Motorista</TableHead>
                  <TableHead>Abastecimentos</TableHead>
                  <TableHead>Total</TableHead>
                  <TableHead className="w-[88px] text-right">Ação</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {metrics.unmatchedDrivers.slice(0, 12).map((driver) => (
                  <TableRow key={driver.motorista}>
                    <TableCell className="font-medium text-slate-900">{driver.motorista}</TableCell>
                    <TableCell>{driver.abastecimentos}</TableCell>
                    <TableCell>{formatCurrency(driver.total)}</TableCell>
                    <TableCell className="text-right">
                      <Button type="button" variant="ghost" size="sm" className="gap-1.5" onClick={() => setEditingDriver(driver)}>
                        <PencilLine className="h-4 w-4" />
                        Editar
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {metrics.unmatchedDrivers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="py-6 text-center text-sm text-muted-foreground">
                      Todos os motoristas do período atual já possuem centro de custo vinculado.
                    </TableCell>
                  </TableRow>
                ) : null}
              </TableBody>
            </Table>
          </div>

        <FuelCostCenterEditor
          open={Boolean(editingDriver)}
          onOpenChange={(open) => {
            if (!open) {
              setEditingDriver(null)
            }
          }}
          initialRecord={editingDriver ? { motorista: editingDriver.motorista } : null}
        />
      </CardContent>
    </Card>
  )
}