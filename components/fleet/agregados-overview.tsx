"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import {
  CalendarDays,
  CarFront,
  ClipboardList,
  Download,
  FileSignature,
  FileText,
  Loader2,
  MoreHorizontal,
  Search,
  Upload,
  Wallet,
  X,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
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
import { getVehicleVisual } from "@/lib/vehicle-icons"
import { cn } from "@/lib/utils"
import { toast } from "@/hooks/use-toast"
import type { Colaborador, Vehicle } from "@/lib/types"

interface AgregadosOverviewProps {
  vehicles: Vehicle[]
  colaboradores: Colaborador[]
  approverName?: string
  canManage?: boolean
  onEdit: (vehicle: Vehicle) => void
  onDelete: (id: string) => void
  onImported?: () => void | Promise<void>
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
  observacao: string
}

type ContractFilter = "todos" | "assinado" | "pendente" | "renovar"
type SortOption = "vencimento_asc" | "vencimento_desc" | "valor_desc" | "colaborador_asc"

const BILLING_CYCLE_DAYS = 30
const EXPIRING_WINDOW_DAYS = 30

function parseDate(value: string | null | undefined): Date | null {
  if (!value) return null
  const isoDateMatch = value.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  const date = isoDateMatch
    ? new Date(Number(isoDateMatch[1]), Number(isoDateMatch[2]) - 1, Number(isoDateMatch[3]))
    : new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value)
}

function formatDate(value: Date): string {
  return new Intl.DateTimeFormat("pt-BR").format(value)
}

function toIsoDate(value: Date): string {
  const year = value.getFullYear()
  const month = `${value.getMonth() + 1}`.padStart(2, "0")
  const day = `${value.getDate()}`.padStart(2, "0")
  return `${year}-${month}-${day}`
}

function formatCompetencia(value: Date): string {
  return new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric" }).format(value)
}

function toUpperLabel(value: string): string {
  return value.trim() ? value.trim().toUpperCase() : "NÃO INFORMADO"
}

function getAnoModelo(vehicle: Vehicle): string {
  if (vehicle.agregadoAnoModelo?.trim()) return vehicle.agregadoAnoModelo.trim()

  // Sem a migration 004 o ano/modelo do agregado fica gravado no campo chassi.
  if (vehicle.chassi && /^\s*(?:19|20)\d{2}\s*\/\s*(?:19|20)\d{2}\s*$/.test(vehicle.chassi)) {
    return vehicle.chassi.trim()
  }

  const matches = vehicle.modelo.match(/\b(?:19|20)\d{2}\b/g)
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

    return {
      vehicle,
      colaboradorNome: colaborador?.nome ?? vehicle.agregadoColaboradorNome ?? vehicle.cpfAgregado ?? "Sem colaborador",
      funcao: toUpperLabel(vehicle.agregadoFuncao ?? colaborador?.departamento ?? vehicle.tipoContratacao ?? ""),
      centroCusto: toUpperLabel(vehicle.agregadoCentroCusto ?? colaborador?.centroCusto ?? vehicle.empresaLocacao ?? ""),
      contrato: (vehicle.agregadoContrato ?? (vehicle.checklists?.length ? "ASSINADO" : "PENDENTE")).toUpperCase(),
      anoModelo: getAnoModelo(vehicle),
      dataInicial,
      dataFinal,
      dias,
      valorDia,
      valorTotal: valorDia * dias,
      observacao: vehicle.agregadoObservacao?.trim() ?? "",
    }
  })
}

function getContractBadgeClass(contrato: string): string {
  if (contrato.includes("ASSINADO")) return "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-50"
  if (contrato.includes("RENOVAR")) return "border-sky-200 bg-sky-50 text-sky-700 hover:bg-sky-50"
  return "border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-50"
}

const statCardVariants = {
  total: {
    cardClass: "border-[#ddd1f5] bg-[linear-gradient(180deg,#f5f0ff_0%,#ece4fb_100%)] shadow-[0_10px_24px_rgba(124,58,237,0.10)]",
    iconClass: "border-[#ccb5fa] bg-[#ede2ff] text-[#5b1fc7]",
    glowClass: "bg-[#c3b0f2]/22",
  },
  veiculos: {
    cardClass: "border-[#c9e6f6] bg-[linear-gradient(180deg,#edf9ff_0%,#e1f3fb_100%)] shadow-[0_10px_24px_rgba(15,142,207,0.10)]",
    iconClass: "border-[#a7d8f0] bg-[#def4ff] text-[#095f89]",
    glowClass: "bg-[#98d7f0]/24",
  },
  contratos: {
    cardClass: "border-[#cfe7d8] bg-[linear-gradient(180deg,#eaf7ef_0%,#dff2e7_100%)] shadow-[0_10px_24px_rgba(90,145,110,0.10)]",
    iconClass: "border-[#afdcc0] bg-[#e1f5e9] text-[#18663b]",
    glowClass: "bg-[#95cfaa]/24",
  },
  vencendo: {
    cardClass: "border-[#ebd1d5] bg-[linear-gradient(180deg,#f9ebed_0%,#f3dfe3_100%)] shadow-[0_10px_24px_rgba(183,96,109,0.10)]",
    iconClass: "border-[#edb7c0] bg-[#ffe6ea] text-[#b93449]",
    glowClass: "bg-[#e9a8b1]/22",
  },
} as const

export function AgregadosOverview({
  vehicles,
  colaboradores,
  approverName,
  canManage,
  onEdit,
  onDelete,
  onImported,
}: AgregadosOverviewProps) {
  const rows = useMemo(() => buildRows(vehicles, colaboradores), [vehicles, colaboradores])
  const referenceMonth = useMemo(() => getReferenceMonth(vehicles), [vehicles])
  const wrapperRef = useRef<HTMLDivElement | null>(null)
  const stickyScrollbarRef = useRef<HTMLDivElement | null>(null)
  const importInputRef = useRef<HTMLInputElement | null>(null)
  const [stickyScrollWidth, setStickyScrollWidth] = useState(0)
  const [showStickyScrollbar, setShowStickyScrollbar] = useState(false)
  const [importing, setImporting] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [search, setSearch] = useState("")
  const [selectedCenterCost, setSelectedCenterCost] = useState("todos")
  const [selectedContract, setSelectedContract] = useState<ContractFilter>("todos")
  const [sortBy, setSortBy] = useState<SortOption>("vencimento_asc")

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
            row.observacao,
          ]
            .map((value) => normalizeSearch(value))
            .join(" ")

          return haystack.includes(query)
        })

    const constrainedRows = searchedRows.filter((row) => {
      const matchesCenterCost = selectedCenterCost === "todos" || row.centroCusto === selectedCenterCost
      const matchesContract = selectedContract === "todos" || normalizeSearch(row.contrato).includes(selectedContract)

      return matchesCenterCost && matchesContract
    })

    return [...constrainedRows].sort((left, right) => {
      if (sortBy === "vencimento_desc") return right.dataFinal.getTime() - left.dataFinal.getTime()
      if (sortBy === "valor_desc") return right.valorTotal - left.valorTotal
      if (sortBy === "colaborador_asc") return left.colaboradorNome.localeCompare(right.colaboradorNome, "pt-BR")
      return left.dataFinal.getTime() - right.dataFinal.getTime()
    })
  }, [rows, search, selectedCenterCost, selectedContract, sortBy])

  const summary = useMemo(() => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const expiringThreshold = new Date(today.getTime() + EXPIRING_WINDOW_DAYS * 86_400_000)

    const totalToPay = filteredRows.reduce((acc, row) => acc + row.valorTotal, 0)
    const totalDays = filteredRows.reduce((acc, row) => acc + row.dias, 0)

    return {
      totalToPay,
      averageDailyValue: totalDays > 0 ? totalToPay / totalDays : 0,
      totalVehicles: filteredRows.length,
      signedContracts: filteredRows.filter((row) => row.contrato.includes("ASSINADO")).length,
      expiringContracts: filteredRows.filter((row) => row.dataFinal >= today && row.dataFinal <= expiringThreshold).length,
    }
  }, [filteredRows])

  const paymentDateLabel = useMemo(() => {
    return formatDate(new Date(referenceMonth.getFullYear(), referenceMonth.getMonth(), 27))
  }, [referenceMonth])

  const hasActiveFilters = search.trim() !== "" || selectedCenterCost !== "todos" || selectedContract !== "todos"

  const clearFilters = () => {
    setSearch("")
    setSelectedCenterCost("todos")
    setSelectedContract("todos")
  }

  useEffect(() => {
    const wrapperElement = wrapperRef.current
    const stickyScrollbarElement = stickyScrollbarRef.current
    const tableContainer = wrapperElement?.querySelector<HTMLElement>("[data-slot='table-container']")

    if (!stickyScrollbarElement || !tableContainer) return

    let syncingFromTable = false
    let syncingFromSticky = false

    const syncMetrics = () => {
      setStickyScrollWidth(tableContainer.scrollWidth)
      setShowStickyScrollbar(tableContainer.scrollWidth > tableContainer.clientWidth)
      stickyScrollbarElement.scrollLeft = tableContainer.scrollLeft
    }

    const handleTableScroll = () => {
      if (syncingFromSticky) {
        syncingFromSticky = false
        return
      }
      syncingFromTable = true
      stickyScrollbarElement.scrollLeft = tableContainer.scrollLeft
    }

    const handleStickyScroll = () => {
      if (syncingFromTable) {
        syncingFromTable = false
        return
      }
      syncingFromSticky = true
      tableContainer.scrollLeft = stickyScrollbarElement.scrollLeft
    }

    syncMetrics()
    tableContainer.addEventListener("scroll", handleTableScroll)
    stickyScrollbarElement.addEventListener("scroll", handleStickyScroll)

    const resizeObserver = new ResizeObserver(syncMetrics)
    resizeObserver.observe(tableContainer)
    const tableElement = tableContainer.querySelector("table")
    if (tableElement) resizeObserver.observe(tableElement)

    window.addEventListener("resize", syncMetrics)

    return () => {
      tableContainer.removeEventListener("scroll", handleTableScroll)
      stickyScrollbarElement.removeEventListener("scroll", handleStickyScroll)
      resizeObserver.disconnect()
      window.removeEventListener("resize", syncMetrics)
    }
  }, [filteredRows.length, canManage])

  const handleImport = async (files: FileList | null) => {
    if (!files || files.length === 0) return

    setImporting(true)

    try {
      const body = new FormData()
      body.append("file", files[0])

      const response = await fetch("/api/agregados/import", { method: "POST", body })
      const data = await response.json().catch(() => ({}))

      if (!response.ok) {
        throw new Error(data?.error || "Falha ao importar a planilha.")
      }

      await onImported?.()

      if (data?.legacyMode) {
        toast({
          title: "Importado em modo compatível",
          description:
            "O banco está sem as colunas de agregados. Rode os scripts 004_add_agregado_fields.sql e 020_add_agregado_observacao.sql no Supabase para salvar contrato e observação.",
        })
        return
      }

      toast({
        title: "Planilha importada",
        description: `${data?.inserted ?? 0} novos, ${data?.updated ?? 0} atualizados e ${data?.linked ?? 0} vinculados a colaboradores.`,
      })
    } catch (error) {
      toast({
        title: "Erro",
        description: error instanceof Error ? error.message : "Falha ao importar a planilha.",
        variant: "destructive",
      })
    } finally {
      setImporting(false)
      if (importInputRef.current) importInputRef.current.value = ""
    }
  }

  const handleExport = async () => {
    setExporting(true)

    try {
      const response = await fetch("/api/agregados/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          competencia: toIsoDate(referenceMonth),
          rows: filteredRows.map((row) => ({
            colaborador: row.colaboradorNome,
            funcao: row.funcao,
            contrato: row.contrato,
            centroCusto: row.centroCusto,
            veiculo: row.vehicle.modelo,
            placa: row.vehicle.placa,
            anoModelo: row.anoModelo,
            valorLocacao: row.vehicle.mensalidade,
            dias: row.dias,
            observacao: row.observacao,
          })),
        }),
      })

      if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        throw new Error(data?.error || "Falha ao exportar a planilha.")
      }

      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement("a")
      anchor.href = url
      anchor.download = `AGREGADOS_${toIsoDate(new Date())}.xlsx`
      anchor.click()
      URL.revokeObjectURL(url)
    } catch (error) {
      toast({
        title: "Erro",
        description: error instanceof Error ? error.message : "Falha ao exportar a planilha.",
        variant: "destructive",
      })
    } finally {
      setExporting(false)
    }
  }

  const statCards = [
    {
      key: "total",
      label: "Total a Pagar",
      value: formatCurrency(summary.totalToPay),
      helperText: `Competência ${formatCompetencia(referenceMonth)}`,
      secondaryHelperText: `${formatCurrency(summary.averageDailyValue)} por dia (média)`,
      icon: Wallet,
      variant: statCardVariants.total,
    },
    {
      key: "veiculos",
      label: "Veículos Agregados",
      value: String(summary.totalVehicles),
      helperText: `${rows.length} cadastrados no total`,
      secondaryHelperText: null,
      icon: CarFront,
      variant: statCardVariants.veiculos,
    },
    {
      key: "contratos",
      label: "Contratos Assinados",
      value: String(summary.signedContracts),
      helperText: `${Math.max(summary.totalVehicles - summary.signedContracts, 0)} pendentes de assinatura`,
      secondaryHelperText: null,
      icon: FileSignature,
      variant: statCardVariants.contratos,
    },
    {
      key: "vencendo",
      label: "Contratos a Vencer",
      value: String(summary.expiringContracts),
      helperText: `Próximos ${EXPIRING_WINDOW_DAYS} dias`,
      secondaryHelperText: null,
      icon: CalendarDays,
      variant: statCardVariants.vencendo,
    },
  ]

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {statCards.map((card) => (
          <Card key={card.key} className={cn("relative overflow-hidden rounded-[1.35rem] border", card.variant.cardClass)}>
            <div className={cn("absolute -right-3 -top-3 h-12 w-12 rounded-full blur-2xl", card.variant.glowClass)} />
            <div className="absolute inset-x-0 top-0 h-1 bg-[linear-gradient(90deg,rgba(255,255,255,0.7),rgba(255,255,255,0),rgba(255,255,255,0.55))]" />
            <CardContent className="relative flex min-h-[98px] items-start gap-3 p-4 sm:p-4.5">
              <div
                className={cn(
                  "flex h-8 w-8 shrink-0 items-center justify-center rounded-[0.95rem] border border-white/70 shadow-sm",
                  card.variant.iconClass
                )}
              >
                <card.icon className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1 pt-0.5">
                <p className="text-[1.7rem] font-extrabold leading-none tracking-[-0.03em] text-slate-900">{card.value}</p>
                <p className="mt-1.5 text-[0.9rem] font-semibold leading-tight text-slate-700">{card.label}</p>
                <p className="mt-1 text-[0.76rem] leading-tight text-slate-500">{card.helperText}</p>
                {card.secondaryHelperText ? (
                  <p className="mt-1 text-[0.76rem] leading-tight text-slate-500">{card.secondaryHelperText}</p>
                ) : null}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="rounded-lg border border-border bg-card p-3 sm:p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <div className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar por colaborador, placa, veículo, função ou centro de custo"
              className="h-10 pl-9"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Select value={selectedCenterCost} onValueChange={setSelectedCenterCost}>
              <SelectTrigger className="h-10 w-[230px] bg-transparent">
                <SelectValue placeholder="Centro de custo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os centros</SelectItem>
                {centerCostOptions.map((centerCost) => (
                  <SelectItem key={centerCost} value={centerCost}>
                    {centerCost}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={selectedContract} onValueChange={(value) => setSelectedContract(value as ContractFilter)}>
              <SelectTrigger className="h-10 w-[170px] bg-transparent">
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
              <SelectTrigger className="h-10 w-[215px] bg-transparent">
                <SelectValue placeholder="Ordenar por" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="vencimento_asc">Vencimento mais próximo</SelectItem>
                <SelectItem value="vencimento_desc">Vencimento mais distante</SelectItem>
                <SelectItem value="valor_desc">Maior valor</SelectItem>
                <SelectItem value="colaborador_asc">Colaborador A-Z</SelectItem>
              </SelectContent>
            </Select>

            {hasActiveFilters ? (
              <Button type="button" variant="ghost" className="h-10 gap-1.5" onClick={clearFilters}>
                <X className="h-4 w-4" />
                Limpar
              </Button>
            ) : null}

            {canManage ? (
              <>
                <input
                  ref={importInputRef}
                  type="file"
                  accept=".xlsb,.xlsx,.xlsm,.xls,.csv"
                  className="hidden"
                  onChange={(event) => handleImport(event.target.files)}
                />
                <Button
                  type="button"
                  variant="outline"
                  className="h-10 gap-2 bg-transparent"
                  disabled={importing}
                  onClick={() => importInputRef.current?.click()}
                >
                  {importing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                  {importing ? "Importando..." : "Importar planilha"}
                </Button>
              </>
            ) : null}

            <Button type="button" className="h-10 gap-2" disabled={exporting} onClick={handleExport}>
              {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
              {exporting ? "Gerando..." : "Exportar planilha"}
            </Button>
          </div>
        </div>
      </div>

      {filteredRows.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border bg-card py-16">
          <div className="rounded-full bg-muted p-3 text-muted-foreground">
            <ClipboardList className="h-6 w-6" />
          </div>
          <p className="mt-3 text-lg font-medium text-foreground">Nenhum veículo agregado encontrado</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {hasActiveFilters ? "Ajuste os filtros para ver outros registros." : "Adicione um novo agregado para começar."}
          </p>
        </div>
      ) : (
        <div ref={wrapperRef} className="space-y-2">
          <div className="table-scroll-hidden overflow-hidden rounded-lg border border-border bg-card">
            <Table className="min-w-[1460px]">
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="w-[56px] text-center text-[0.88rem] font-semibold">#</TableHead>
                  <TableHead className="text-left text-[0.88rem] font-semibold">Colaborador</TableHead>
                  <TableHead className="text-left text-[0.88rem] font-semibold">Contrato</TableHead>
                  <TableHead className="text-left text-[0.88rem] font-semibold">Centro de Custo</TableHead>
                  <TableHead className="text-left text-[0.88rem] font-semibold">Veículo</TableHead>
                  <TableHead className="text-center text-[0.88rem] font-semibold">Ano/Modelo</TableHead>
                  <TableHead className="text-center text-[0.88rem] font-semibold">Valor Locação</TableHead>
                  <TableHead className="text-center text-[0.88rem] font-semibold">Período</TableHead>
                  <TableHead className="text-center text-[0.88rem] font-semibold">Dias</TableHead>
                  <TableHead className="text-center text-[0.88rem] font-semibold">Valor Dia</TableHead>
                  <TableHead className="text-center text-[0.88rem] font-semibold">Valor</TableHead>
                  <TableHead className="text-left text-[0.88rem] font-semibold">Observação</TableHead>
                  {canManage ? (
                    <TableHead className="sticky right-0 z-10 w-[70px] bg-muted/50 text-center shadow-[-1px_0_0_hsl(var(--border))]" />
                  ) : null}
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRows.map((row, index) => {
                  const vehicleVisual = getVehicleVisual(row.vehicle.modelo)
                  const VehicleIcon = vehicleVisual.icon
                  const contratoFile = row.vehicle.checklists?.[0]
                  const rowClass = index % 2 === 0 ? "bg-white hover:bg-[#e7f4dc]" : "bg-[#fbfdf9] hover:bg-[#deefd0]"
                  const stickyActionClass =
                    index % 2 === 0 ? "bg-white group-hover:bg-[#e7f4dc]" : "bg-[#fbfdf9] group-hover:bg-[#deefd0]"

                  return (
                    <TableRow key={row.vehicle.id} className={`group ${rowClass}`}>
                      <TableCell className="align-middle text-center text-[0.85rem] font-semibold text-muted-foreground">
                        {index + 1}
                      </TableCell>
                      <TableCell className="align-middle text-left">
                        <div className="space-y-1">
                          <div className="font-medium text-foreground">{row.colaboradorNome}</div>
                          <div className="text-[0.78rem] uppercase tracking-wide text-muted-foreground">{row.funcao}</div>
                        </div>
                      </TableCell>
                      <TableCell className="align-middle text-left">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className={cn("text-[0.76rem]", getContractBadgeClass(row.contrato))}>
                            {row.contrato}
                          </Badge>
                          {contratoFile ? (
                            <>
                              <a
                                href={`/api/drive/file/${contratoFile.id}`}
                                target="_blank"
                                rel="noreferrer"
                                title="Visualizar contrato"
                                className="text-muted-foreground hover:text-foreground"
                              >
                                <FileText className="h-4 w-4" />
                              </a>
                              <a
                                href={`/api/drive/file/${contratoFile.id}?download=1`}
                                title="Baixar contrato"
                                className="text-muted-foreground hover:text-foreground"
                              >
                                <Download className="h-4 w-4" />
                              </a>
                            </>
                          ) : null}
                        </div>
                      </TableCell>
                      <TableCell className="align-middle text-left text-[0.88rem] text-foreground">{row.centroCusto}</TableCell>
                      <TableCell className="align-middle text-left">
                        <div className="flex items-center gap-2.5">
                          <span
                            title={vehicleVisual.label}
                            className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border ${vehicleVisual.chipClass}`}
                          >
                            <VehicleIcon className="h-4 w-4" />
                          </span>
                          <div className="space-y-1">
                            <div className="text-[0.92rem] text-foreground">{row.vehicle.modelo}</div>
                            <div className="font-mono text-[0.82rem] font-semibold text-muted-foreground">{row.vehicle.placa}</div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="align-middle text-center text-[0.9rem] text-muted-foreground">{row.anoModelo}</TableCell>
                      <TableCell className="align-middle text-center text-[0.92rem] font-medium">
                        {formatCurrency(row.vehicle.mensalidade)}
                      </TableCell>
                      <TableCell className="align-middle text-center text-[0.85rem] text-muted-foreground">
                        <div>{formatDate(row.dataInicial)}</div>
                        <div>{formatDate(row.dataFinal)}</div>
                      </TableCell>
                      <TableCell className="align-middle text-center text-[0.92rem] font-semibold tabular-nums">{row.dias}</TableCell>
                      <TableCell className="align-middle text-center text-[0.92rem] tabular-nums">{formatCurrency(row.valorDia)}</TableCell>
                      <TableCell className="align-middle text-center text-[0.95rem] font-semibold tabular-nums text-foreground">
                        {formatCurrency(row.valorTotal)}
                      </TableCell>
                      <TableCell className="max-w-[240px] align-middle text-left text-[0.85rem] text-muted-foreground">
                        {row.observacao || "-"}
                      </TableCell>
                      {canManage ? (
                        <TableCell
                          className={`sticky right-0 z-10 text-center shadow-[-1px_0_0_hsl(var(--border))] ${stickyActionClass}`}
                        >
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
                              <DropdownMenuItem
                                className="text-destructive focus:text-destructive"
                                onClick={() => onDelete(row.vehicle.id)}
                              >
                                Excluir
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      ) : null}
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>

          {showStickyScrollbar ? (
            <div
              ref={stickyScrollbarRef}
              className="sticky bottom-0 z-20 overflow-x-auto rounded-lg border border-border bg-card/95"
              aria-hidden="true"
            >
              <div className="h-2.5" style={{ width: stickyScrollWidth }} />
            </div>
          ) : null}
        </div>
      )}

      <div className="grid gap-3 rounded-lg border border-border bg-card px-4 py-3 text-[0.9rem] text-muted-foreground md:grid-cols-4">
        <div className="flex items-center gap-2">
          <Wallet className="h-4 w-4 text-[#5f9736]" />
          <span>
            Total a pagar: <strong className="text-foreground">{formatCurrency(summary.totalToPay)}</strong>
          </span>
        </div>
        <div className="flex items-center gap-2">
          <CalendarDays className="h-4 w-4 text-[#5f9736]" />
          <span className="capitalize">Competência: {formatCompetencia(referenceMonth)}</span>
        </div>
        <div className="flex items-center gap-2">
          <FileSignature className="h-4 w-4 text-[#5f9736]" />
          <span>Pagamento: todo dia 27 ({paymentDateLabel})</span>
        </div>
        <div className="flex min-w-0 items-center gap-2">
          <ClipboardList className="h-4 w-4 shrink-0 text-[#5f9736]" />
          <span className="truncate">Responsável: {approverName || "Gestor"}</span>
        </div>
      </div>
    </div>
  )
}
