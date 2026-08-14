"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts"
import {
  Building2,
  CalendarClock,
  CalendarDays,
  CarFront,
  ClipboardList,
  Download,
  FileClock,
  MoreHorizontal,
  Plus,
  Search,
  Wallet,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart"
import type { Colaborador, Vehicle } from "@/lib/types"

interface AgregadosOverviewProps {
  vehicles: Vehicle[]
  colaboradores: Colaborador[]
  approverName?: string
  canManage?: boolean
  onAdd?: () => void
  onEdit: (vehicle: Vehicle) => void
  onDelete: (id: string) => void
}

type OverviewRow = {
  vehicle: Vehicle
  colaboradorNome: string
  funcao: string
  centroCusto: string
  contrato: string
  anoModelo: string
  dataInicial: Date
  dataFinal: Date
  dias: number
  valorDia: number
  valorTotal: number
}

type ContractFilter = "todos" | "assinado" | "pendente" | "renovar"
type SortOption = "vencimento_asc" | "vencimento_desc" | "valor_desc" | "colaborador_asc"

const BILLING_CYCLE_DAYS = 30
const EXPIRING_WINDOW_DAYS = 5

function parseDate(value: string | null | undefined): Date | null {
  if (!value) return null
  const isoDateMatch = value.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  const date = isoDateMatch
    ? new Date(Number(isoDateMatch[1]), Number(isoDateMatch[2]) - 1, Number(isoDateMatch[3]))
    : new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value)
}

function formatDate(value: Date): string {
  return new Intl.DateTimeFormat("pt-BR").format(value)
}

function toIsoDate(value: Date): string {
  return value.toISOString().slice(0, 10)
}

function formatCompetencia(value: Date): string {
  return new Intl.DateTimeFormat("pt-BR", {
    month: "short",
    year: "numeric",
  })
    .format(value)
    .replace(".", "")
}

function toUpperLabel(value: string): string {
  return value.trim() ? value.trim().toUpperCase() : "NÃO INFORMADO"
}

function getAnoModelo(modelo: string): string {
  const matches = modelo.match(/\b(?:19|20)\d{2}\b/g)
  if (!matches || matches.length === 0) return "N/I"
  if (matches.length === 1) return matches[0]
  return `${matches[0]}/${matches[1]}`
}

function getReferenceMonth(vehicles: Vehicle[]): Date {
  const dates = vehicles
    .map((vehicle) => parseDate(vehicle.dataVencimentoContrato))
    .filter((date): date is Date => Boolean(date))
    .sort((a, b) => b.getTime() - a.getTime())

  return dates[0] ?? new Date()
}

function getInitialDate(vehicle: Vehicle, endDate: Date): Date {
  const storedDate = parseDate(vehicle.agregadoDataInicial ?? vehicle.dataVencimentoCNHAgregado)
  if (storedDate) return storedDate
  return new Date(endDate.getFullYear(), endDate.getMonth(), 1)
}

function addMonths(baseDate: Date, months: number): Date {
  return new Date(baseDate.getFullYear(), baseDate.getMonth() + months, 1)
}

function getMonthEnd(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0)
}

function overlapsRange(startDate: Date, endDate: Date, rangeStart: Date, rangeEnd: Date): boolean {
  return startDate <= rangeEnd && endDate >= rangeStart
}

function normalizeSearch(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
}

function buildRows(vehicles: Vehicle[], colaboradores: Colaborador[]): OverviewRow[] {
  const colaboradoresById = new Map(colaboradores.map((colaborador) => [colaborador.id, colaborador]))

  return vehicles.map((vehicle) => {
    const colaborador = vehicle.colaboradorId ? colaboradoresById.get(vehicle.colaboradorId) : undefined
    const dataFinal = parseDate(vehicle.dataVencimentoContrato) ?? new Date()
    const dataInicial = getInitialDate(vehicle, dataFinal)
    const dias = (vehicle.agregadoDias && vehicle.agregadoDias > 0)
      ? vehicle.agregadoDias
      : vehicle.km > 0
      ? vehicle.km
      : Math.max(1, Math.round((dataFinal.getTime() - dataInicial.getTime()) / 86_400_000) + 1)
    const valorDia = vehicle.mensalidade > 0 ? vehicle.mensalidade / BILLING_CYCLE_DAYS : 0
    const valorTotal = valorDia * dias

    return {
      vehicle,
      colaboradorNome: vehicle.agregadoColaboradorNome ?? vehicle.cpfAgregado ?? colaborador?.nome ?? "Sem colaborador",
      funcao: toUpperLabel(vehicle.agregadoFuncao ?? vehicle.tipoContratacao ?? colaborador?.departamento ?? "Não informado"),
      centroCusto: toUpperLabel(vehicle.agregadoCentroCusto ?? vehicle.empresaLocacao ?? colaborador?.departamento ?? "Sem centro de custo"),
      contrato: vehicle.agregadoContrato ?? (vehicle.checklists?.length ? "ASSINADO" : "PENDENTE"),
      anoModelo: vehicle.agregadoAnoModelo ?? vehicle.chassi ?? getAnoModelo(vehicle.modelo),
      dataInicial,
      dataFinal,
      dias,
      valorDia,
      valorTotal,
    }
  })
}

const chartConfig = {
  total: {
    label: "Total",
    color: "#6ea93c",
  },
  competencia: {
    label: "Competência",
    color: "#c49b2e",
  },
}

const spreadsheetHeadClass = "h-12 border-b border-r border-[#d7e5cf] bg-gradient-to-b from-[#f6fbf1] to-[#edf6e5] px-4 text-[12.5px] font-extrabold uppercase tracking-[0.14em] text-[#486235] last:border-r-0"
const spreadsheetCellClass = "border-r border-[#edf1ea] px-4 py-3.5 text-[14px] text-slate-700 last:border-r-0"

export function AgregadosOverview({
  vehicles,
  colaboradores,
  approverName,
  canManage,
  onAdd,
  onEdit,
  onDelete,
}: AgregadosOverviewProps) {
  const rows = useMemo(() => buildRows(vehicles, colaboradores), [vehicles, colaboradores])
  const referenceMonth = useMemo(() => getReferenceMonth(vehicles), [vehicles])
  const topScrollbarRef = useRef<HTMLDivElement | null>(null)
  const tableRegionRef = useRef<HTMLDivElement | null>(null)
  const [tableScrollWidth, setTableScrollWidth] = useState(1320)
  const [search, setSearch] = useState("")
  const [selectedCenterCost, setSelectedCenterCost] = useState("todos")
  const [selectedContract, setSelectedContract] = useState<ContractFilter>("todos")
  const [sortBy, setSortBy] = useState<SortOption>("vencimento_asc")

  useEffect(() => {
    const topScrollbar = topScrollbarRef.current
    const tableRegion = tableRegionRef.current
    const tableScroller = tableRegion?.querySelector<HTMLDivElement>('[data-slot="table-container"]')
    if (!topScrollbar || !tableRegion || !tableScroller) return

    const updateWidths = () => {
      const tableElement = tableScroller.querySelector("table")
      const nextWidth = Math.max(
        tableScroller.scrollWidth,
        Math.ceil(tableElement?.getBoundingClientRect().width ?? 0),
      )

      setTableScrollWidth(nextWidth)
      topScrollbar.scrollLeft = tableScroller.scrollLeft
    }

    let isSyncing = false

    const syncFromTop = () => {
      if (isSyncing) return
      isSyncing = true
      tableScroller.scrollLeft = topScrollbar.scrollLeft
      isSyncing = false
    }

    const syncFromTable = () => {
      if (isSyncing) return
      isSyncing = true
      topScrollbar.scrollLeft = tableScroller.scrollLeft
      isSyncing = false
    }

    updateWidths()
    topScrollbar.addEventListener("scroll", syncFromTop, { passive: true })
    tableScroller.addEventListener("scroll", syncFromTable, { passive: true })

    if (typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", updateWidths)
      return () => {
        topScrollbar.removeEventListener("scroll", syncFromTop)
        tableScroller.removeEventListener("scroll", syncFromTable)
        window.removeEventListener("resize", updateWidths)
      }
    }

    const observer = new ResizeObserver(() => updateWidths())
    observer.observe(tableScroller)
    observer.observe(tableRegion)

    const tableElement = tableScroller.querySelector("table")
    if (tableElement) observer.observe(tableElement)

    return () => {
      topScrollbar.removeEventListener("scroll", syncFromTop)
      tableScroller.removeEventListener("scroll", syncFromTable)
      observer.disconnect()
    }
  }, [rows.length])

  const centerCostOptions = useMemo(() => {
    return Array.from(new Set(rows.map((row) => row.centroCusto))).sort((left, right) => left.localeCompare(right, "pt-BR"))
  }, [rows])

  const filteredRows = useMemo(() => {
    const query = normalizeSearch(search.trim())

    const searchedRows = !query
      ? rows
      : rows.filter((row) => {
      const haystack = [
        row.colaboradorNome,
        row.funcao,
        row.vehicle.placa,
        row.contrato,
        row.centroCusto,
        row.vehicle.modelo,
        row.anoModelo,
      ]
        .map((value) => normalizeSearch(value))
        .join(" ")

      return haystack.includes(query)
      })

    const constrainedRows = searchedRows.filter((row) => {
      const matchesCenterCost = selectedCenterCost === "todos" || row.centroCusto === selectedCenterCost
      const matchesContract = selectedContract === "todos" || row.contrato.toLowerCase() === selectedContract

      return matchesCenterCost && matchesContract
    })

    return [...constrainedRows].sort((left, right) => {
      if (sortBy === "vencimento_desc") {
        return right.dataFinal.getTime() - left.dataFinal.getTime()
      }

      if (sortBy === "valor_desc") {
        return right.valorTotal - left.valorTotal
      }

      if (sortBy === "colaborador_asc") {
        return left.colaboradorNome.localeCompare(right.colaboradorNome, "pt-BR")
      }

      return left.dataFinal.getTime() - right.dataFinal.getTime()
    })
  }, [rows, search, selectedCenterCost, selectedContract, sortBy])

  const summary = useMemo(() => {
    const totalToPay = filteredRows.reduce((acc, row) => acc + row.valorTotal, 0)
    const totalDaysUsed = filteredRows.reduce((acc, row) => acc + row.dias, 0)
    const averageDailyValue = totalDaysUsed > 0 ? totalToPay / totalDaysUsed : 0
    const expiringThreshold = new Date()
    expiringThreshold.setHours(23, 59, 59, 999)
    expiringThreshold.setDate(expiringThreshold.getDate() + EXPIRING_WINDOW_DAYS)

    const expiringRows = filteredRows
      .filter((row) => row.dataFinal >= new Date() && row.dataFinal <= expiringThreshold)
      .sort((a, b) => a.dataFinal.getTime() - b.dataFinal.getTime())

    const chartData = filteredRows.reduce<Array<{ centroCusto: string; total: number }>>((acc, row) => {
      const existing = acc.find((item) => item.centroCusto === row.centroCusto)
      if (existing) {
        existing.total += row.valorTotal
        return acc
      }

      acc.push({ centroCusto: row.centroCusto, total: row.valorTotal })
      return acc
    }, [])

    const monthBase = new Date(referenceMonth.getFullYear(), referenceMonth.getMonth(), 1)
    const timelineData = Array.from({ length: 4 }, (_, index) => {
      const monthStart = addMonths(monthBase, index)
      const monthEnd = getMonthEnd(monthStart)
      const matchingRows = filteredRows.filter((row) => overlapsRange(row.dataInicial, row.dataFinal, monthStart, monthEnd))

      return {
        competencia: formatCompetencia(monthStart).replace(/^./, (char) => char.toUpperCase()),
        total: matchingRows.reduce((acc, row) => acc + row.valorTotal, 0),
        contratos: matchingRows.length,
      }
    })

    return {
      totalToPay,
      averageDailyValue,
      activeVehicles: filteredRows.length,
      expiringRows,
      chartData: chartData.sort((a, b) => b.total - a.total).slice(0, 6),
      timelineData,
    }
  }, [filteredRows, referenceMonth])

  const paymentDateLabel = useMemo(() => {
    const paymentDate = new Date(referenceMonth.getFullYear(), referenceMonth.getMonth(), 27)
    return formatDate(paymentDate)
  }, [referenceMonth])

  const exportRows = () => {
    const csvHeader = [
      "Colaborador",
      "Função",
      "Placa",
      "Contrato",
      "Centro de Custo",
      "Veículo",
      "Ano/Modelo",
      "Valor Locação",
      "Data Inicial",
      "Data Final",
      "Dias",
      "Valor Dia",
      "Valor",
    ]

    const csvRows = filteredRows.map((row) => [
      row.colaboradorNome,
      row.funcao,
      row.vehicle.placa,
      row.contrato,
      row.centroCusto,
      row.vehicle.modelo,
      row.anoModelo,
      row.vehicle.mensalidade.toFixed(2),
      toIsoDate(row.dataInicial),
      toIsoDate(row.dataFinal),
      String(row.dias),
      row.valorDia.toFixed(2),
      row.valorTotal.toFixed(2),
    ])

    const csvContent = [csvHeader, ...csvRows]
      .map((row) => row.map((value) => `"${String(value).replace(/"/g, '""')}"`).join(";"))
      .join("\n")

    const blob = new Blob([`\uFEFF${csvContent}`], { type: "text/csv;charset=utf-8;" })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement("a")
    anchor.href = url
    anchor.download = `veiculos-agregados-${toIsoDate(new Date())}.csv`
    anchor.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-5">
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="overflow-hidden border-[#d8dfd1] bg-[#faf9f4] shadow-sm">
          <div className="border-b border-[#d6decf] bg-[#f1f0e9] px-5 py-3 text-xs font-extrabold uppercase tracking-[0.18em] text-[#313131]">
            Total a pagar
          </div>
          <CardContent className="space-y-3 p-5">
            <div>
              <p className="text-4xl font-black tracking-tight text-[#b13d31]">{formatCurrency(summary.totalToPay)}</p>
              <p className="mt-1 text-sm text-slate-500">Competência {formatCompetencia(referenceMonth)}</p>
            </div>
            <div className="flex items-center gap-2 text-sm text-slate-600">
              <Wallet className="h-4 w-4 text-[#727272]" />
              <span>{formatCurrency(summary.averageDailyValue)}/dia médio</span>
            </div>
          </CardContent>
        </Card>

        <Card className="overflow-hidden border-[#d8dfd1] bg-[#faf9f4] shadow-sm">
          <div className="border-b border-[#d6decf] bg-[#f1f0e9] px-5 py-3 text-xs font-extrabold uppercase tracking-[0.18em] text-[#313131]">
            Veículos ativos
          </div>
          <CardContent className="space-y-3 p-5">
            <div className="flex items-end justify-between gap-4">
              <div>
                <p className="text-4xl font-black tracking-tight text-[#5e91a4]">{summary.activeVehicles}</p>
                <p className="mt-1 text-sm text-slate-500">Agregados em acompanhamento</p>
              </div>
              <div className="rounded-full bg-[#d7e7ee] p-2.5 text-[#5e91a4]">
                <CarFront className="h-5 w-5" />
              </div>
            </div>
            <div className="flex items-center gap-2 text-sm text-slate-600">
              <div className="h-2.5 w-10 rounded-full bg-[#d3e2b9]" />
              <span>{filteredRows.length} registros no filtro atual</span>
            </div>
          </CardContent>
        </Card>

        <Card className="overflow-hidden border-[#d8dfd1] bg-[#faf9f4] shadow-sm">
          <div className="border-b border-[#d6decf] bg-[#f1f0e9] px-5 py-3 text-xs font-extrabold uppercase tracking-[0.18em] text-[#313131]">
            Contratos expirando
          </div>
          <CardContent className="space-y-3 p-5">
            <div className="flex items-end justify-between gap-4">
              <div>
                <p className="text-4xl font-black tracking-tight text-[#b98525]">{summary.expiringRows.length}</p>
                <p className="mt-1 text-sm text-slate-500">Próximos {EXPIRING_WINDOW_DAYS} dias</p>
              </div>
              <div className="rounded-full bg-[#f2e7c7] p-2.5 text-[#b98525]">
                <FileClock className="h-5 w-5" />
              </div>
            </div>
            <div className="space-y-1.5 text-sm text-slate-600">
              {summary.expiringRows.slice(0, 2).map((row) => (
                <div key={row.vehicle.id} className="flex items-center justify-between gap-3">
                  <span className="truncate font-medium text-slate-700">{row.vehicle.placa}</span>
                  <span className="shrink-0 text-xs uppercase tracking-[0.12em] text-slate-500">{formatDate(row.dataFinal)}</span>
                </div>
              ))}
              {summary.expiringRows.length === 0 ? <span>Nenhum contrato perto do vencimento.</span> : null}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
        <Card className="border-[#d8dfd1] bg-[#faf9f4] shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold uppercase tracking-[0.12em] text-slate-600">Custos por centro de custo</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <ChartContainer className="h-[220px] w-full" config={chartConfig}>
              <BarChart accessibilityLayer data={summary.chartData} margin={{ left: 8, right: 8, top: 16 }}>
                <CartesianGrid vertical={false} />
                <XAxis
                  dataKey="centroCusto"
                  tickLine={false}
                  axisLine={false}
                  tickMargin={8}
                  interval={0}
                  tickFormatter={(value: string) => (value.length > 12 ? `${value.slice(0, 12)}...` : value)}
                />
                <YAxis tickLine={false} axisLine={false} tickFormatter={(value: number) => `R$ ${value.toLocaleString("pt-BR")}`} />
                <ChartTooltip cursor={false} content={<ChartTooltipContent formatter={(value) => formatCurrency(Number(value))} />} />
                <Bar dataKey="total" fill="var(--color-total)" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>

        <Card className="border-[#d8dfd1] bg-[#faf9f4] shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold uppercase tracking-[0.12em] text-slate-600">Contratos expirando</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 pt-0">
            {summary.expiringRows.length === 0 ? (
              <div className="rounded-xl border border-dashed border-[#d6decf] bg-white/70 px-4 py-10 text-center text-sm text-slate-500">
                Nenhum contrato vence nos próximos {EXPIRING_WINDOW_DAYS} dias.
              </div>
            ) : (
              summary.expiringRows.slice(0, 6).map((row) => (
                <div key={row.vehicle.id} className="flex items-start justify-between gap-3 rounded-xl border border-[#e2e6dc] bg-white/80 px-4 py-3">
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-slate-900">{row.vehicle.placa} · {row.colaboradorNome}</p>
                    <p className="truncate text-sm text-slate-500">{row.vehicle.modelo}</p>
                  </div>
                  <Badge variant="outline" className="shrink-0 border-[#e6d4a7] bg-[#faf3dd] text-[#9a741a]">
                    {formatDate(row.dataFinal)}
                  </Badge>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.45fr)_minmax(0,0.75fr)]">
      <Card className="border-[#d8dfd1] shadow-sm">
        <CardHeader className="flex flex-col gap-4 border-b border-border/70 pb-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <CardTitle className="text-2xl font-semibold text-foreground">Veículos Agregados</CardTitle>
            <p className="mt-1 text-[0.98rem] text-muted-foreground">Controle mensal de locação, período de uso e vínculo com colaborador.</p>
          </div>
          <div className="flex flex-wrap gap-2 self-start">
            <div className="relative min-w-[240px] flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Buscar colaborador, placa, função ou centro de custo"
                className="pl-9"
              />
            </div>
            <Select value={selectedCenterCost} onValueChange={setSelectedCenterCost}>
              <SelectTrigger className="h-11 w-[230px] bg-transparent text-[0.95rem]">
                <SelectValue placeholder="Centro de custo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos centros</SelectItem>
                {centerCostOptions.map((centerCost) => (
                  <SelectItem key={centerCost} value={centerCost}>
                    {centerCost}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={selectedContract} onValueChange={(value) => setSelectedContract(value as ContractFilter)}>
              <SelectTrigger className="h-11 w-[190px] bg-transparent text-[0.95rem]">
                <SelectValue placeholder="Contrato" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos contratos</SelectItem>
                <SelectItem value="assinado">Assinado</SelectItem>
                <SelectItem value="pendente">Pendente</SelectItem>
                <SelectItem value="renovar">Renovar</SelectItem>
              </SelectContent>
            </Select>
            <Select value={sortBy} onValueChange={(value) => setSortBy(value as SortOption)}>
              <SelectTrigger className="h-11 w-[225px] bg-transparent text-[0.95rem]">
                <SelectValue placeholder="Ordenar por" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="vencimento_asc">Vencimento mais próximo</SelectItem>
                <SelectItem value="vencimento_desc">Vencimento mais distante</SelectItem>
                <SelectItem value="valor_desc">Maior valor</SelectItem>
                <SelectItem value="colaborador_asc">Colaborador A-Z</SelectItem>
              </SelectContent>
            </Select>
            <Button type="button" variant="outline" className="h-11 gap-2 bg-transparent text-[0.95rem]" onClick={exportRows}>
              <Download className="h-4 w-4" />
              Exportar dados
            </Button>
            {canManage && onAdd ? (
              <Button onClick={onAdd} className="h-11 gap-2 text-[0.95rem]">
                <Plus className="h-4 w-4" />
                Adicionar agregado
              </Button>
            ) : null}
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {filteredRows.length === 0 ? (
            <div className="flex min-h-[320px] flex-col items-center justify-center gap-3 px-6 py-12 text-center">
              <div className="rounded-full bg-muted p-3 text-muted-foreground">
                <ClipboardList className="h-6 w-6" />
              </div>
              <div>
                <p className="text-lg font-medium text-foreground">Nenhum agregado encontrado</p>
                <p className="text-sm text-muted-foreground">Ajuste a busca atual ou adicione novos veículos agregados para preencher esta visão.</p>
              </div>
            </div>
          ) : (
            <div className="rounded-b-2xl bg-[#fcfdfb]">
              <div className="flex flex-wrap items-center gap-2 border-b border-[#dfe9d7] bg-[#fbfcf8] px-4 py-3 text-[0.82rem] font-medium uppercase tracking-[0.12em] text-slate-500">
                <span>{filteredRows.length} registros</span>
                <span className="h-1 w-1 rounded-full bg-slate-300" />
                <span>{selectedCenterCost === "todos" ? "Todos centros" : selectedCenterCost}</span>
                <span className="h-1 w-1 rounded-full bg-slate-300" />
                <span>{selectedContract === "todos" ? "Todos contratos" : selectedContract}</span>
              </div>
              <div className="border-b border-[#dfe9d7] bg-[#f4f8ef] px-3 py-2">
                <div
                  ref={topScrollbarRef}
                  className="overflow-x-scroll rounded-full border border-[#d7e5cf] bg-white/90 shadow-[inset_0_1px_0_rgba(255,255,255,0.9)]"
                  aria-label="Rolagem horizontal da tabela"
                >
                  <div className="h-3" style={{ width: tableScrollWidth }} />
                </div>
              </div>
              <div ref={tableRegionRef}>
              <Table className="min-w-[1380px] border-separate border-spacing-0 font-sans">
                <TableHeader className="sticky top-0 z-10">
                  <TableRow className="border-b-0 hover:bg-transparent">
                    <TableHead className={spreadsheetHeadClass}>Colaborador</TableHead>
                    <TableHead className={spreadsheetHeadClass}>Função</TableHead>
                    <TableHead className={spreadsheetHeadClass}>Placa</TableHead>
                    <TableHead className={spreadsheetHeadClass}>Contrato</TableHead>
                    <TableHead className={spreadsheetHeadClass}>Centro de Custo</TableHead>
                    <TableHead className={spreadsheetHeadClass}>Veículo</TableHead>
                    <TableHead className={spreadsheetHeadClass}>Ano/Modelo</TableHead>
                    <TableHead className={spreadsheetHeadClass}>Valor Locação</TableHead>
                    <TableHead className={spreadsheetHeadClass}>Data Inicial</TableHead>
                    <TableHead className={spreadsheetHeadClass}>Data Final</TableHead>
                    <TableHead className={spreadsheetHeadClass}>Dias</TableHead>
                    <TableHead className={spreadsheetHeadClass}>Valor Dia</TableHead>
                    <TableHead className={spreadsheetHeadClass}>Valor</TableHead>
                    {canManage ? <TableHead className={`${spreadsheetHeadClass} w-[64px]`} /> : null}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredRows.map((row, index) => (
                    <TableRow
                      key={row.vehicle.id}
                      className={index % 2 === 0 ? "bg-white/95" : "bg-[#f9fbf7]"}
                    >
                      <TableCell className={`${spreadsheetCellClass} font-semibold text-slate-900`}>{row.colaboradorNome}</TableCell>
                      <TableCell className={`${spreadsheetCellClass} font-medium`}>{row.funcao}</TableCell>
                      <TableCell className={`${spreadsheetCellClass} font-mono text-[13.5px] font-semibold tracking-[0.08em] text-slate-800`}>{row.vehicle.placa}</TableCell>
                      <TableCell className={spreadsheetCellClass}>
                        <Badge
                          variant="outline"
                          className={
                            row.contrato === "ASSINADO"
                              ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                              : "border-amber-200 bg-amber-50 text-amber-700"
                          }
                        >
                          {row.contrato}
                        </Badge>
                      </TableCell>
                      <TableCell className={`${spreadsheetCellClass} text-slate-800`}>{row.centroCusto}</TableCell>
                      <TableCell className={`${spreadsheetCellClass} font-medium text-slate-800`}>{row.vehicle.modelo}</TableCell>
                      <TableCell className={`${spreadsheetCellClass} font-semibold text-slate-800`}>{row.anoModelo}</TableCell>
                      <TableCell className={`${spreadsheetCellClass} font-semibold tabular-nums text-slate-900`}>{formatCurrency(row.vehicle.mensalidade)}</TableCell>
                      <TableCell className={`${spreadsheetCellClass} tabular-nums`}>{formatDate(row.dataInicial)}</TableCell>
                      <TableCell className={`${spreadsheetCellClass} tabular-nums`}>{formatDate(row.dataFinal)}</TableCell>
                      <TableCell className={`${spreadsheetCellClass} text-center font-bold tabular-nums text-[#486235]`}>{row.dias}</TableCell>
                      <TableCell className={`${spreadsheetCellClass} font-semibold tabular-nums`}>{formatCurrency(row.valorDia)}</TableCell>
                      <TableCell className={`${spreadsheetCellClass} font-bold tabular-nums text-slate-950`}>{formatCurrency(row.valorTotal)}</TableCell>
                      {canManage ? (
                        <TableCell className={`${spreadsheetCellClass} text-center`}>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8">
                                <MoreHorizontal className="h-4 w-4" />
                                <span className="sr-only">Abrir ações do agregado</span>
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => onEdit(row.vehicle)}>Editar</DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => onDelete(row.vehicle.id)}>
                                Excluir
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      ) : null}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="border-[#d8dfd1] bg-[#faf9f4] shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-[0.98rem] font-semibold uppercase tracking-[0.12em] text-slate-600">Cronograma de contratos</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 pt-0">
          <ChartContainer className="h-[260px] w-full" config={chartConfig}>
            <BarChart accessibilityLayer data={summary.timelineData} layout="vertical" margin={{ left: 16, right: 8, top: 8, bottom: 8 }}>
              <CartesianGrid horizontal={false} />
              <XAxis type="number" hide />
              <YAxis dataKey="competencia" type="category" tickLine={false} axisLine={false} width={76} />
              <ChartTooltip
                cursor={false}
                content={
                  <ChartTooltipContent
                    formatter={(value, _name, item) => `${formatCurrency(Number(value))} · ${item.payload.contratos} contratos`}
                  />
                }
              />
              <Bar dataKey="total" fill="var(--color-competencia)" radius={8} />
            </BarChart>
          </ChartContainer>

          <div className="space-y-2">
            {summary.timelineData.map((item) => (
              <div key={item.competencia} className="flex items-center justify-between gap-3 rounded-lg border border-[#e2e6dc] bg-white/80 px-3 py-2 text-[0.95rem]">
                <div className="flex items-center gap-2 text-slate-700">
                  <CalendarClock className="h-4 w-4 text-[#b98525]" />
                  <span>{item.competencia}</span>
                </div>
                <div className="text-right">
                  <p className="font-semibold text-slate-900">{formatCurrency(item.total)}</p>
                  <p className="text-[0.82rem] text-slate-500">{item.contratos} contratos</p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
      </div>

      <div className="grid gap-3 rounded-xl border border-border bg-card px-4 py-3 text-[0.95rem] text-muted-foreground md:grid-cols-3">
        <div className="flex items-center gap-2">
          <CalendarDays className="h-4 w-4 text-[#5f9736]" />
          <span>Competência: {formatCompetencia(referenceMonth).toUpperCase()}</span>
        </div>
        <div className="flex items-center gap-2">
          <Wallet className="h-4 w-4 text-[#5f9736]" />
          <span>Pagamento previsto: {paymentDateLabel}</span>
        </div>
        <div className="flex items-center gap-2 truncate">
          <Building2 className="h-4 w-4 text-[#5f9736]" />
          <span>Aprovado por: {approverName || "Gestor"}</span>
        </div>
      </div>
    </div>
  )
}