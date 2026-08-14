"use client"

import { useMemo, useState } from "react"
import useSWR from "swr"
import { CalendarDays, Download, FileSpreadsheet, Fuel, Search } from "lucide-react"
import { Bar, BarChart, CartesianGrid, LabelList, XAxis, YAxis } from "recharts"
import { resolveCostCenterRecord, normalizeCostCenterDriverName } from "@/lib/cost-center-shared"
import { parseFuelDateTime } from "@/lib/fuel-datetime"
import { useFuelDataContext } from "@/components/fuel/fuel-data-provider"
import { fuelFetcher, FUEL_DATA_SWR_KEY, type FuelResponse } from "@/hooks/use-fuel-data"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { useFuelCostCenters } from "@/hooks/use-fuel-cost-centers"
import { toast } from "@/hooks/use-toast"

type PeriodPreset = "ultimos-7-dias" | "mes-selecionado" | "personalizado"

type EnrichedFuelRecord = {
  centroCusto: string
  supervisor: string
  coordenador: string
  nomeMotorista: string
  cardPlate: string
  valor: number
  parsedDate: Date
}

type ConsolidatedFuelRow = {
  centroCusto: string
  motorista: string
  placaCartao: string
  valorTransacao: number
  abastecimentos: number
  supervisor: string
  coordenador: string
}

type CostCenterChartRow = {
  centroCusto: string
  shortLabel: string
  total: number
  totalFormatted: string
  abastecimentos: number
}

const chartConfig = {
  total: {
    label: "Valor bruto",
    color: "#6aa553",
  },
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value)
}

function formatDateInputValue(value: Date): string {
  const year = value.getFullYear()
  const month = `${value.getMonth() + 1}`.padStart(2, "0")
  const day = `${value.getDate()}`.padStart(2, "0")
  return `${year}-${month}-${day}`
}

function toDateOnly(value: string): Date | null {
  if (!value) return null

  const [year, month, day] = value.split("-").map(Number)
  if (!year || !month || !day) return null

  return new Date(year, month - 1, day)
}

function startOfDay(value: Date): Date {
  return new Date(value.getFullYear(), value.getMonth(), value.getDate(), 0, 0, 0, 0)
}

function endOfDay(value: Date): Date {
  return new Date(value.getFullYear(), value.getMonth(), value.getDate(), 23, 59, 59, 999)
}

function normalizeSearchValue(value: string): string {
  return value.toLowerCase().trim()
}

function shortenLabel(value: string): string {
  return value.length > 38 ? `${value.slice(0, 38)}...` : value
}

function formatCompactCurrency(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)
}

function buildExportFileName(start: Date, end: Date): string {
  const startLabel = formatDateInputValue(start)
  const endLabel = formatDateInputValue(end)
  return `combustivel-consolidado-${startLabel}_a_${endLabel}.xlsx`
}

export function FuelConsolidatedReport() {
  const { records, availableMonths, selectedMonth } = useFuelDataContext()
  const { lookup } = useFuelCostCenters()
  const [periodPreset, setPeriodPreset] = useState<PeriodPreset>("ultimos-7-dias")
  const [selectedSupervisor, setSelectedSupervisor] = useState("todos")
  const [selectedCoordenador, setSelectedCoordenador] = useState("todos")
  const [search, setSearch] = useState("")

  const latestRecordDate = useMemo(() => {
    const sortedDates = records
      .map((record) => parseFuelDateTime(record.dateTime))
      .filter((date) => !Number.isNaN(date.getTime()))
      .sort((left, right) => right.getTime() - left.getTime())

    return sortedDates[0] ?? new Date()
  }, [records])

  const selectedMonthOption = useMemo(() => {
    return availableMonths.find((month) => month.month === selectedMonth) ?? null
  }, [availableMonths, selectedMonth])

  const monthBounds = useMemo(() => {
    const baseDate = latestRecordDate
    return {
      start: startOfDay(new Date(baseDate.getFullYear(), baseDate.getMonth(), 1)),
      end: endOfDay(new Date(baseDate.getFullYear(), baseDate.getMonth() + 1, 0)),
    }
  }, [latestRecordDate])

  const defaultCustomRange = useMemo(() => {
    const end = latestRecordDate
    const start = new Date(end.getFullYear(), end.getMonth(), end.getDate() - 6)

    return {
      start: formatDateInputValue(start),
      end: formatDateInputValue(end),
    }
  }, [latestRecordDate])

  const [customStartDate, setCustomStartDate] = useState(defaultCustomRange.start)
  const [customEndDate, setCustomEndDate] = useState(defaultCustomRange.end)

  const effectiveRange = useMemo(() => {
    if (periodPreset === "mes-selecionado") {
      return monthBounds
    }

    if (periodPreset === "personalizado") {
      const start = toDateOnly(customStartDate) ?? monthBounds.start
      const end = toDateOnly(customEndDate) ?? monthBounds.end

      if (start <= end) {
        return {
          start: startOfDay(start),
          end: endOfDay(end),
        }
      }

      return {
        start: startOfDay(end),
        end: endOfDay(start),
      }
    }

    return {
      start: startOfDay(new Date(latestRecordDate.getFullYear(), latestRecordDate.getMonth(), latestRecordDate.getDate() - 6)),
      end: endOfDay(latestRecordDate),
    }
  }, [customEndDate, customStartDate, latestRecordDate, monthBounds, periodPreset])

  const customRangeKey = useMemo(() => {
    if (periodPreset === "mes-selecionado") return null

    const params = new URLSearchParams({
      start: formatDateInputValue(effectiveRange.start),
      end: formatDateInputValue(effectiveRange.end),
    })

    if (selectedMonth) {
      params.set("month", selectedMonth)
    }

    return `${FUEL_DATA_SWR_KEY}?${params.toString()}`
  }, [effectiveRange, periodPreset, selectedMonth])

  const { data: customRangeData } = useSWR<FuelResponse>(customRangeKey, fuelFetcher, {
    revalidateOnFocus: false,
    revalidateOnReconnect: false,
    dedupingInterval: 30_000,
    keepPreviousData: true,
  })

  const sourceRecords = periodPreset === "mes-selecionado" ? records : (customRangeData?.records ?? records)

  const enrichedRecords = useMemo<EnrichedFuelRecord[]>(() => {
    return sourceRecords
      .map((record) => {
        const parsedDate = parseFuelDateTime(record.dateTime)
        const resolved = resolveCostCenterRecord(record.nomeMotorista, lookup)

        return {
          centroCusto: resolved?.centroCusto ?? "Sem centro de custo",
          supervisor: resolved?.supervisor ?? "",
          coordenador: resolved?.coordenador ?? "",
          nomeMotorista: record.nomeMotorista,
          cardPlate: record.cardPlate.trim() || "-",
          valor: record.valor,
          parsedDate,
        }
      })
      .filter((record) => !Number.isNaN(record.parsedDate.getTime()))
  }, [lookup, sourceRecords])

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

  const filteredRecords = useMemo(() => {
    const searchTerm = normalizeSearchValue(search)
    const startTime = effectiveRange.start.getTime()
    const endTime = effectiveRange.end.getTime()

    return enrichedRecords.filter((record) => {
      const recordTime = record.parsedDate.getTime()
      if (recordTime < startTime || recordTime > endTime) {
        return false
      }

      if (selectedSupervisor !== "todos" && record.supervisor !== selectedSupervisor) {
        return false
      }

      if (selectedCoordenador !== "todos" && record.coordenador !== selectedCoordenador) {
        return false
      }

      if (!searchTerm) {
        return true
      }

      return [record.centroCusto, record.nomeMotorista, record.cardPlate]
        .some((value) => normalizeSearchValue(value).includes(searchTerm))
    })
  }, [effectiveRange.end, effectiveRange.start, enrichedRecords, search, selectedCoordenador, selectedSupervisor])

  const consolidatedRows = useMemo<ConsolidatedFuelRow[]>(() => {
    const groups = new Map<string, ConsolidatedFuelRow>()

    for (const record of filteredRecords) {
      const driverKey = normalizeCostCenterDriverName(record.nomeMotorista) || record.nomeMotorista.trim().toLowerCase()
      const groupKey = [record.centroCusto, driverKey, record.cardPlate].join("|")
      const current = groups.get(groupKey)

      if (current) {
        current.valorTransacao += record.valor
        current.abastecimentos += 1
        continue
      }

      groups.set(groupKey, {
        centroCusto: record.centroCusto,
        motorista: record.nomeMotorista,
        placaCartao: record.cardPlate,
        valorTransacao: record.valor,
        abastecimentos: 1,
        supervisor: record.supervisor,
        coordenador: record.coordenador,
      })
    }

    return Array.from(groups.values()).sort((left, right) => {
      const centerCompare = left.centroCusto.localeCompare(right.centroCusto, "pt-BR")
      if (centerCompare !== 0) return centerCompare

      if (right.valorTransacao !== left.valorTransacao) {
        return right.valorTransacao - left.valorTransacao
      }

      return left.motorista.localeCompare(right.motorista, "pt-BR")
    })
  }, [filteredRecords])

  const totalConsolidatedValue = useMemo(() => {
    return consolidatedRows.reduce((sum, row) => sum + row.valorTransacao, 0)
  }, [consolidatedRows])

  const costCenterChartData = useMemo<CostCenterChartRow[]>(() => {
    const grouped = new Map<string, { centroCusto: string; total: number; abastecimentos: number }>()

    for (const record of filteredRecords) {
      const current = grouped.get(record.centroCusto)

      grouped.set(record.centroCusto, {
        centroCusto: record.centroCusto,
        total: (current?.total ?? 0) + record.valor,
        abastecimentos: (current?.abastecimentos ?? 0) + 1,
      })
    }

    return Array.from(grouped.values())
      .sort((left, right) => right.total - left.total || left.centroCusto.localeCompare(right.centroCusto, "pt-BR"))
      .map((item) => ({
        centroCusto: item.centroCusto,
        shortLabel: shortenLabel(item.centroCusto),
        total: item.total,
        totalFormatted: formatCurrency(item.total),
        abastecimentos: item.abastecimentos,
      }))
  }, [filteredRecords])

  const chartHeight = useMemo(() => {
    return Math.max(320, costCenterChartData.length * 48)
  }, [costCenterChartData.length])

  const handleExport = async () => {
    if (consolidatedRows.length === 0) {
      toast({
        title: "Nada para exportar",
        description: "Ajuste os filtros para gerar ao menos uma linha no consolidado.",
        variant: "destructive",
      })
      return
    }

    try {
      const XLSX = await import("xlsx")
      const sheetRows = consolidatedRows.map((row) => ({
        "CENTRO DE CUSTO": row.centroCusto,
        "NOME MOTORISTA": row.motorista,
        "VALOR DA TRANSAÇÃO": row.valorTransacao,
        "PLACA CARTÃO": row.placaCartao,
      }))

      const worksheet = XLSX.utils.json_to_sheet(sheetRows)
      worksheet["!cols"] = [
        { wch: 28 },
        { wch: 34 },
        { wch: 18 },
        { wch: 16 },
      ]

      const workbook = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(workbook, worksheet, "Consolidado")
      XLSX.writeFile(workbook, buildExportFileName(effectiveRange.start, effectiveRange.end))

      toast({
        title: "Planilha exportada",
        description: "O consolidado foi exportado em Excel com centro de custo, motorista, valor e placa do cartão.",
      })
    } catch (error) {
      toast({
        title: "Erro ao exportar",
        description: error instanceof Error ? error.message : "Não foi possível gerar a planilha.",
        variant: "destructive",
      })
    }
  }

  return (
    <Card className="border-[#d8dfd1] bg-white shadow-sm">
      <CardHeader className="border-b border-[#e5ece0] pb-4">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <CardTitle className="text-xl text-slate-900">Consolidado semanal de consumo</CardTitle>
            <CardDescription>
              Consolida o gasto bruto por centro de custo, motorista e placa do cartão para o mês {selectedMonthOption?.label ?? "selecionado"}.
            </CardDescription>
          </div>

          <Button type="button" className="gap-2 bg-[#6f9f4c] text-white hover:bg-[#628d44]" onClick={handleExport}>
            <Download className="h-4 w-4" />
            Exportar planilha
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-5 p-5">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-xl border border-[#d9e5d0] bg-[#f6faf3] p-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
              <FileSpreadsheet className="h-4 w-4 text-[#56814e]" />
              Linhas consolidadas
            </div>
            <div className="mt-2 text-2xl font-semibold text-slate-950">{consolidatedRows.length}</div>
          </div>

          <div className="rounded-xl border border-[#d9e5d0] bg-[#f6faf3] p-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
              <Fuel className="h-4 w-4 text-[#56814e]" />
              Abastecimentos no recorte
            </div>
            <div className="mt-2 text-2xl font-semibold text-slate-950">{filteredRecords.length}</div>
          </div>

          <div className="rounded-xl border border-[#ddd8f7] bg-[#f7f5ff] p-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
              <CalendarDays className="h-4 w-4 text-[#7443d6]" />
              Período filtrado
            </div>
            <div className="mt-2 text-sm font-semibold text-slate-950">
              {formatDateInputValue(effectiveRange.start)} a {formatDateInputValue(effectiveRange.end)}
            </div>
          </div>

          <div className="rounded-xl border border-[#ddd8f7] bg-[#f7f5ff] p-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
              <Download className="h-4 w-4 text-[#7443d6]" />
              Valor bruto total
            </div>
            <div className="mt-2 text-2xl font-semibold text-slate-950">{formatCurrency(totalConsolidatedValue)}</div>
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-12">
          <div className="space-y-1 xl:col-span-3">
            <Label>Período</Label>
            <Select value={periodPreset} onValueChange={(value) => setPeriodPreset(value as PeriodPreset)}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ultimos-7-dias">Últimos 7 dias</SelectItem>
                <SelectItem value="mes-selecionado">Mês selecionado</SelectItem>
                <SelectItem value="personalizado">Período personalizado</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1 xl:col-span-3">
            <Label htmlFor="fuel-consolidated-search">Busca</Label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                id="fuel-consolidated-search"
                className="pl-9"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Centro de custo, motorista ou placa"
              />
            </div>
          </div>

          <div className="space-y-1 xl:col-span-2">
            <Label>Supervisor</Label>
            <Select value={selectedSupervisor} onValueChange={setSelectedSupervisor}>
              <SelectTrigger>
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

          <div className="space-y-1 xl:col-span-2">
            <Label>Coordenação</Label>
            <Select value={selectedCoordenador} onValueChange={setSelectedCoordenador}>
              <SelectTrigger>
                <SelectValue placeholder="Todas" />
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

          {periodPreset === "personalizado" ? (
            <>
              <div className="space-y-1 xl:col-span-1">
                <Label htmlFor="fuel-consolidated-start">Início</Label>
                <Input
                  id="fuel-consolidated-start"
                  type="date"
                  value={customStartDate}
                  onChange={(event) => setCustomStartDate(event.target.value)}
                />
              </div>

              <div className="space-y-1 xl:col-span-1">
                <Label htmlFor="fuel-consolidated-end">Fim</Label>
                <Input
                  id="fuel-consolidated-end"
                  type="date"
                  value={customEndDate}
                  onChange={(event) => setCustomEndDate(event.target.value)}
                />
              </div>
            </>
          ) : null}
        </div>

        <div className="rounded-2xl border border-dashed border-[#d7e2d0] bg-[#fbfdf9] p-4 text-sm text-slate-500">
          A planilha sai com as colunas CENTRO DE CUSTO, NOME MOTORISTA, VALOR DA TRANSAÇÃO e PLACA CARTÃO, no mesmo recorte aplicado na tela.
        </div>

        <Card className="overflow-hidden border-[#d8dfd1] bg-[linear-gradient(180deg,#fbfcfa_0%,#f4f7f1_100%)] shadow-sm">
          <CardHeader className="border-b border-[#e7eee2] pb-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <CardTitle className="text-xl text-slate-900">Valor bruto por centro de custo</CardTitle>
                <p className="mt-1 text-sm text-slate-500">O gráfico usa exatamente os mesmos filtros do consolidado, pronto para print e envio.</p>
              </div>

              <div className="text-left lg:text-right">
                <p className="text-xs uppercase tracking-[0.12em] text-slate-500">Centro com maior gasto</p>
                <p className="mt-1 text-base font-black tracking-tight text-slate-900">{costCenterChartData[0]?.centroCusto ?? "-"}</p>
                <p className="mt-1 text-2xl font-black tracking-tight text-[#376b40]">{costCenterChartData[0]?.totalFormatted ?? "-"}</p>
              </div>
            </div>
          </CardHeader>

          {costCenterChartData.length > 0 ? (
            <CardContent className="grid gap-5 p-5 xl:grid-cols-[minmax(0,1fr)_360px] 2xl:grid-cols-[minmax(0,1.08fr)_380px]">
              <div className="rounded-2xl border border-[#dce6d6] bg-white/80 p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.9)]">
                <div className="overflow-x-auto rounded-xl">
                  <div className="min-w-[980px]" style={{ height: `${chartHeight}px` }}>
                    <ChartContainer config={chartConfig} className="h-full w-full">
                      <BarChart data={costCenterChartData} layout="vertical" margin={{ left: 18, right: 110, top: 6, bottom: 6 }}>
                        <CartesianGrid horizontal={false} strokeDasharray="3 3" />
                        <XAxis type="number" hide />
                        <YAxis
                          type="category"
                          dataKey="shortLabel"
                          width={214}
                          tickLine={false}
                          axisLine={false}
                          tick={{ fill: "#334155", fontSize: 12 }}
                        />
                        <ChartTooltip
                          content={
                            <ChartTooltipContent
                              formatter={(value, _name, item) => {
                                const payload = item.payload as CostCenterChartRow

                                return (
                                  <div className="min-w-[14rem] space-y-2">
                                    <div className="space-y-1">
                                      <p className="font-semibold text-foreground">{payload.centroCusto}</p>
                                      <p className="text-xs text-muted-foreground">Centro de custo do consolidado</p>
                                    </div>
                                    <div className="space-y-1 text-sm">
                                      <div className="flex items-center justify-between gap-3">
                                        <span className="text-muted-foreground">Valor bruto</span>
                                        <span className="font-mono font-medium tabular-nums text-foreground">{formatCurrency(Number(value))}</span>
                                      </div>
                                      <div className="flex items-center justify-between gap-3">
                                        <span className="text-muted-foreground">Abastecimentos</span>
                                        <span className="font-medium text-foreground">{payload.abastecimentos}</span>
                                      </div>
                                    </div>
                                  </div>
                                )
                              }}
                            />
                          }
                        />
                        <Bar dataKey="total" fill="var(--color-total)" radius={[0, 8, 8, 0]}>
                          <LabelList
                            dataKey="total"
                            position="right"
                            offset={12}
                            formatter={(value) => formatCompactCurrency(Number(value ?? 0))}
                            className="fill-slate-700 text-[12px] font-semibold"
                          />
                        </Bar>
                      </BarChart>
                    </ChartContainer>
                  </div>
                </div>
              </div>

              <div className="space-y-4 rounded-2xl border border-[#dce6d6] bg-white/85 p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.9)]">
                <div>
                  <div className="text-sm font-semibold text-slate-900">Ranking resumido</div>
                  <div className="mt-1 max-w-[28ch] text-xs leading-relaxed text-slate-500">Leitura dos centros com maior valor bruto dentro do período filtrado.</div>
                </div>

                {costCenterChartData.slice(0, 6).map((item, index) => (
                  <div key={item.centroCusto} className="flex flex-col gap-2 border-b border-[#edf2ea] pb-3 last:border-b-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
                    <div className="flex min-w-0 items-start gap-3">
                      <span className="h-3.5 w-3.5 shrink-0 rounded-full bg-[#6aa553]" />
                      <div className="min-w-0 space-y-1">
                        <p className="text-sm font-semibold leading-snug text-slate-800">{index + 1}. {item.centroCusto}</p>
                        <p className="text-[11px] uppercase tracking-[0.12em] text-slate-400">{item.abastecimentos} abastecimentos</p>
                      </div>
                    </div>
                    <p className="pl-6 text-left text-lg font-bold text-slate-900 sm:pl-0 sm:text-right">{item.totalFormatted}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          ) : (
            <CardContent className="p-5">
              <div className="flex h-[300px] items-center justify-center rounded-xl border border-dashed border-[#dce6d6] text-sm text-slate-500">
                Nenhum centro de custo encontrado para montar o gráfico com os filtros atuais.
              </div>
            </CardContent>
          )}
        </Card>

        <div className="overflow-hidden rounded-xl border border-[#dfe7d8] bg-[#fbfcfa]">
          <ScrollArea className="h-[560px]">
            <Table>
              <TableHeader>
                <TableRow className="bg-[#f6faf3] hover:bg-[#f6faf3]">
                  <TableHead>Centro de custo</TableHead>
                  <TableHead>Nome motorista</TableHead>
                  <TableHead>Placa cartão</TableHead>
                  <TableHead className="text-right">Valor da transação</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {consolidatedRows.map((row) => (
                  <TableRow key={`${row.centroCusto}-${row.motorista}-${row.placaCartao}`}>
                    <TableCell className="font-medium text-slate-900">{row.centroCusto}</TableCell>
                    <TableCell>{row.motorista}</TableCell>
                    <TableCell>{row.placaCartao}</TableCell>
                    <TableCell className="text-right font-semibold text-slate-900">{formatCurrency(row.valorTransacao)}</TableCell>
                  </TableRow>
                ))}
                {consolidatedRows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="py-8 text-center text-sm text-muted-foreground">
                      Nenhum dado consolidado encontrado para os filtros atuais.
                    </TableCell>
                  </TableRow>
                ) : null}
              </TableBody>
            </Table>
          </ScrollArea>
        </div>
      </CardContent>
    </Card>
  )
}