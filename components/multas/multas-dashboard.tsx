"use client"

import { useMemo, useState } from "react"
import { Building2, CarFront, CheckCircle2, CreditCard, FileWarning, Filter, Pencil, Plus, Search, Trash2, UserRound, XCircle } from "lucide-react"
import { toast } from "@/hooks/use-toast"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { MultaModal } from "@/components/multas/multa-modal"
import { useMultas } from "@/hooks/use-multas"
import {
  buildSeverityChartData,
  formatCurrency,
  formatDate,
  formatDateTime,
  formatStatusDate,
  getMultaTotalValue,
  MULTA_COLABORADOR_STATUS_BADGE_CLASS,
  MULTA_COLABORADOR_STATUS_LABELS,
  MULTA_GRAVIDADE_BADGE_CLASS,
  MULTA_GRAVIDADE_LABELS,
  MULTA_GRAVIDADE_OPTIONS,
  MULTA_INDICACAO_STATUS_BADGE_CLASS,
  MULTA_INDICACAO_STATUS_LABELS,
  MULTA_RH_STATUS_BADGE_CLASS,
  MULTA_RH_STATUS_LABELS,
  MULTA_RH_STATUS_OPTIONS,
  MULTA_STATUS_BADGE_CLASS,
  MULTA_STATUS_LABELS,
  MULTA_STATUS_OPTIONS,
  normalizeMultaLocadora,
} from "@/lib/multas"
import type { Colaborador, Multa, MultaFormData, MultaRhStatus, MultaStatus, Vehicle } from "@/lib/types"

type MultasDashboardProps = {
  vehicles: Vehicle[]
  colaboradores: Colaborador[]
  canManage: boolean
  canEditRhStatus: boolean
}

const DASHBOARD_CARD_CLASS = "overflow-hidden border-[#d8dfd1] shadow-sm"
const DASHBOARD_CARD_HEADER_CLASS = "border-b border-[#e2eadc] pb-4"
const DASHBOARD_SECTION_LABEL_CLASS = "text-[0.82rem] font-semibold uppercase tracking-[0.12em] text-slate-500"
const DASHBOARD_CARD_VARIANTS = {
  indicacao: "bg-[linear-gradient(180deg,#fbfcfa_0%,#f4f7f1_100%)]",
  financeiro: "bg-[linear-gradient(180deg,#fbfbf7_0%,#f5f3eb_100%)]",
  gravidade: "bg-[linear-gradient(180deg,#f8fbf6_0%,#f1f6ee_100%)]",
  statusFrota: "bg-[linear-gradient(180deg,#fafcf9_0%,#f2f6ef_100%)]",
  statusRh: "bg-[linear-gradient(180deg,#fbfcfa_0%,#f4f7f1_100%)]",
  locadoras: "bg-[linear-gradient(180deg,#fcfdfb_0%,#f4f8f1_100%)]",
} as const

function resolveMultaLocadoraLabel(
  multa: Multa,
  vehiclesById: Map<string, Vehicle>,
  vehiclesByPlate: Map<string, Vehicle>
) {
  const linkedVehicle =
    (multa.vehicleId ? vehiclesById.get(multa.vehicleId) : undefined) ||
    vehiclesByPlate.get(multa.placa.trim().toUpperCase())

  if (linkedVehicle?.tipoPropriedade === "proprio") {
    return "Próprio"
  }

  const providerLabel = normalizeMultaLocadora(
    multa.locadora || linkedVehicle?.empresaLocacao || linkedVehicle?.fornecedorProprio || null
  )

  return providerLabel || "Próprio"
}

export function MultasDashboard({ vehicles, colaboradores, canManage, canEditRhStatus }: MultasDashboardProps) {
  const { multas, isLoading, error, addMulta, updateMulta, updateMultaRhStatus, deleteMulta } = useMultas()
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState<"todos" | MultaStatus>("todos")
  const [rhStatusFilter, setRhStatusFilter] = useState<"todos" | MultaRhStatus>("todos")
  const [gravidadeFilter, setGravidadeFilter] = useState<"todas" | Multa["gravidade"]>("todas")
  const [locadoraFilter, setLocadoraFilter] = useState("todas")
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingMulta, setEditingMulta] = useState<Multa | null>(null)
  const [deletingMulta, setDeletingMulta] = useState<Multa | null>(null)

  const colaboradoresById = useMemo(
    () => new Map(colaboradores.map((colaborador) => [colaborador.id, colaborador])),
    [colaboradores]
  )

  const colaboradoresByNome = useMemo(
    () => new Map(colaboradores.map((colaborador) => [colaborador.nome.trim().toLowerCase(), colaborador])),
    [colaboradores]
  )

  const vehiclesById = useMemo(
    () => new Map(vehicles.map((vehicle) => [vehicle.id, vehicle])),
    [vehicles]
  )

  const vehiclesByPlate = useMemo(
    () => new Map(vehicles.map((vehicle) => [vehicle.placa.trim().toUpperCase(), vehicle])),
    [vehicles]
  )

  const getCondutorStatus = (multa: Multa) => {
    if (multa.colaboradorStatus) {
      return multa.colaboradorStatus
    }

    if (multa.colaboradorId && colaboradoresById.has(multa.colaboradorId)) {
      return "ativo" as const
    }

    const normalizedName = multa.condutor.trim().toLowerCase()
    if (normalizedName && colaboradoresByNome.has(normalizedName)) {
      return "ativo" as const
    }

    return "desligado" as const
  }

  const getIndicacaoStatus = (multa: Multa) => {
    return {
      label: MULTA_INDICACAO_STATUS_LABELS[multa.indicacaoStatus],
      className: MULTA_INDICACAO_STATUS_BADGE_CLASS[multa.indicacaoStatus],
    }
  }

  const locadoraOptions = useMemo(() => {
    return Array.from(
      new Set(multas.map((multa) => resolveMultaLocadoraLabel(multa, vehiclesById, vehiclesByPlate)))
    ).sort((left, right) => left.localeCompare(right))
  }, [multas, vehiclesById, vehiclesByPlate])

  const filteredMultas = useMemo(() => {
    const query = search.trim().toLowerCase()

    return multas.filter((multa) => {
      const locadoraLabel = resolveMultaLocadoraLabel(multa, vehiclesById, vehiclesByPlate)
      const matchesQuery =
        query.length === 0 ||
        [multa.placa, multa.condutor, multa.tipo, multa.autoInfracao, locadoraLabel]
          .some((value) => value.toLowerCase().includes(query))
      const matchesStatus = statusFilter === "todos" || multa.status === statusFilter
      const matchesRhStatus = rhStatusFilter === "todos" || multa.rhStatus === rhStatusFilter
      const matchesGravidade = gravidadeFilter === "todas" || multa.gravidade === gravidadeFilter
      const matchesLocadora = locadoraFilter === "todas" || locadoraLabel === locadoraFilter

      return matchesQuery && matchesStatus && matchesRhStatus && matchesGravidade && matchesLocadora
    })
  }, [gravidadeFilter, locadoraFilter, multas, rhStatusFilter, search, statusFilter, vehiclesById, vehiclesByPlate])

  const stats = useMemo(() => {
    const total = filteredMultas.length
    const totalEmAberto = filteredMultas.filter((multa) => multa.rhStatus !== "pago").length
    const totalPago = filteredMultas.filter((multa) => multa.rhStatus === "pago").length
    const valorBase = filteredMultas.reduce((sum, multa) => sum + multa.valor, 0)
    const valorNic = filteredMultas.reduce((sum, multa) => sum + (multa.valorNic ?? 0), 0)
    const valorTotal = filteredMultas.reduce((sum, multa) => sum + getMultaTotalValue(multa), 0)
    const valorEmAberto = filteredMultas
      .filter((multa) => multa.rhStatus !== "pago")
      .reduce((sum, multa) => sum + getMultaTotalValue(multa), 0)
    const valorPago = filteredMultas
      .filter((multa) => multa.rhStatus === "pago")
      .reduce((sum, multa) => sum + getMultaTotalValue(multa), 0)
    const indicadas = filteredMultas.filter((multa) => multa.indicacaoStatus === "sim").length
    const expiradas = filteredMultas.filter((multa) => multa.indicacaoStatus === "expirado").length
    const severityChart = buildSeverityChartData(filteredMultas)
    const statusCounts = {
      pendente: filteredMultas.filter((multa) => multa.status === "pendente").length,
      enviado: filteredMultas.filter((multa) => multa.status === "enviado").length,
    }
    const rhStatusCounts = {
      pendente: filteredMultas.filter((multa) => multa.rhStatus === "pendente").length,
      pago: filteredMultas.filter((multa) => multa.rhStatus === "pago").length,
    }
    const locadoraCounts = Object.entries(
      filteredMultas.reduce<Record<string, number>>((accumulator, multa) => {
        const label = resolveMultaLocadoraLabel(multa, vehiclesById, vehiclesByPlate)
        accumulator[label] = (accumulator[label] ?? 0) + 1
        return accumulator
      }, {})
    )
      .sort((left, right) => right[1] - left[1])
      .slice(0, 4)

    return {
      total,
      totalEmAberto,
      totalPago,
      valorBase,
      valorNic,
      valorTotal,
      valorEmAberto,
      valorPago,
      indicadas,
      expiradas,
      severityChart,
      statusCounts,
      rhStatusCounts,
      locadoraCounts,
    }
  }, [filteredMultas, vehiclesById, vehiclesByPlate])

  const handleAdd = () => {
    setEditingMulta(null)
    setIsModalOpen(true)
  }

  const handleEdit = (multa: Multa) => {
    setEditingMulta(multa)
    setIsModalOpen(true)
  }

  const applyStatusDates = (currentMulta: Multa | null, data: MultaFormData): MultaFormData => {
    const now = new Date().toISOString()

    return {
      ...data,
      statusEnviadoEm:
        data.status === "enviado"
          ? currentMulta?.status === "enviado"
            ? (currentMulta.statusEnviadoEm ?? data.statusEnviadoEm ?? now)
            : (data.statusEnviadoEm ?? now)
          : null,
      rhPagoEm:
        data.rhStatus === "pago"
          ? currentMulta?.rhStatus === "pago"
            ? (currentMulta.rhPagoEm ?? data.rhPagoEm ?? now)
            : (data.rhPagoEm ?? now)
          : null,
    }
  }

  const handleSave = async (data: MultaFormData) => {
    try {
      const normalizedData = applyStatusDates(editingMulta, data)

      if (editingMulta) {
        await updateMulta(editingMulta.id, normalizedData)
        toast({ title: "Sucesso", description: "Multa atualizada com sucesso." })
      } else {
        await addMulta(normalizedData)
        toast({ title: "Sucesso", description: "Multa cadastrada com sucesso." })
      }
    } catch (saveError) {
      toast({
        title: "Erro",
        description: saveError instanceof Error ? saveError.message : "Falha ao salvar multa.",
        variant: "destructive",
      })
      throw saveError
    }
  }

  const handleStatusChange = async (multa: Multa, status: MultaStatus) => {
    try {
      await updateMulta(
        multa.id,
        applyStatusDates(multa, {
          ...multa,
          status,
        })
      )
      toast({ title: "Sucesso", description: "Status Frota atualizado." })
    } catch (updateError) {
      toast({
        title: "Erro",
        description: updateError instanceof Error ? updateError.message : "Falha ao atualizar o Status Frota.",
        variant: "destructive",
      })
    }
  }

  const handleRhStatusChange = async (multa: Multa, rhStatus: MultaRhStatus) => {
    if (!canManage) {
      if (!canEditRhStatus || multa.rhStatus !== "pendente" || rhStatus !== "pago") {
        return
      }
    }

    try {
      await updateMultaRhStatus(multa.id, rhStatus)
      toast({ title: "Sucesso", description: "Status RH atualizado." })
    } catch (updateError) {
      toast({
        title: "Erro",
        description: updateError instanceof Error ? updateError.message : "Falha ao atualizar o status RH.",
        variant: "destructive",
      })
    }
  }

  const handleConfirmDelete = async () => {
    if (!deletingMulta) return

    try {
      await deleteMulta(deletingMulta.id)
      toast({ title: "Sucesso", description: "Multa excluída com sucesso." })
      setDeletingMulta(null)
    } catch (deleteError) {
      toast({
        title: "Erro",
        description: deleteError instanceof Error ? deleteError.message : "Falha ao excluir multa.",
        variant: "destructive",
      })
    }
  }

  const hasActiveFilters = search.length > 0 || statusFilter !== "todos" || rhStatusFilter !== "todos" || gravidadeFilter !== "todas" || locadoraFilter !== "todas"

  const resetFilters = () => {
    setSearch("")
    setStatusFilter("todos")
    setRhStatusFilter("todos")
    setGravidadeFilter("todas")
    setLocadoraFilter("todas")
  }

  return (
    <div className="space-y-5">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-12">
        <Card className={`${DASHBOARD_CARD_CLASS} ${DASHBOARD_CARD_VARIANTS.indicacao} xl:col-span-3`}>
          <CardHeader className={DASHBOARD_CARD_HEADER_CLASS}>
            <CardDescription className={DASHBOARD_SECTION_LABEL_CLASS}>Confirmação do processo</CardDescription>
            <CardTitle className="text-xl">Janela de indicação</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between rounded-xl border border-emerald-200/70 bg-emerald-500/10 px-4 py-3 text-emerald-700">
              <div className="flex items-center gap-3">
                <CheckCircle2 className="h-4 w-4" />
                <span className="text-[0.95rem] font-medium">Indicação no prazo</span>
              </div>
              <span className="text-xl font-black">{stats.indicadas}</span>
            </div>
            <div className="flex items-center justify-between rounded-xl border border-destructive/20 bg-destructive/10 px-4 py-3 text-destructive">
              <div className="flex items-center gap-3">
                <XCircle className="h-4 w-4" />
                <span className="text-[0.95rem] font-medium">Indicação expirada</span>
              </div>
              <span className="text-xl font-black">{stats.expiradas}</span>
            </div>
          </CardContent>
        </Card>

        <Card className={`${DASHBOARD_CARD_CLASS} ${DASHBOARD_CARD_VARIANTS.financeiro} xl:col-span-3`}>
          <CardHeader className={DASHBOARD_CARD_HEADER_CLASS}>
            <CardDescription className={DASHBOARD_SECTION_LABEL_CLASS}>Valores da tabela</CardDescription>
            <CardTitle className="text-xl">Financeiro</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between rounded-xl border border-sky-200/70 bg-sky-500/10 px-4 py-3 text-sky-700">
              <div className="flex items-center gap-3">
                <CreditCard className="h-4 w-4" />
                <span className="text-[0.95rem] font-medium">Valor R$</span>
              </div>
              <span className="text-lg font-black">{formatCurrency(stats.valorBase)}</span>
            </div>
            <div className="flex items-center justify-between rounded-xl border border-amber-200/70 bg-amber-500/10 px-4 py-3 text-amber-700">
              <span className="text-[0.95rem] font-medium">Valor NIC</span>
              <span className="text-lg font-black">{formatCurrency(stats.valorNic)}</span>
            </div>
            <div className="rounded-xl border border-primary/15 bg-primary/5 px-4 py-3 text-primary">
              <p className="text-[0.95rem] text-primary/80">Valor total consolidado</p>
              <p className="mt-1 text-2xl font-black">{formatCurrency(stats.valorTotal)}</p>
            </div>
          </CardContent>
        </Card>

        <Card className={`${DASHBOARD_CARD_CLASS} ${DASHBOARD_CARD_VARIANTS.gravidade} xl:col-span-3`}>
          <CardHeader className={DASHBOARD_CARD_HEADER_CLASS}>
            <CardDescription className={DASHBOARD_SECTION_LABEL_CLASS}>Distribuição por gravidade</CardDescription>
            <CardTitle className="text-xl">Mapa de risco</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="mx-auto h-32 w-32 rounded-full sm:h-36 sm:w-36" style={{ background: `conic-gradient(${stats.severityChart.gradient})` }}>
              <div className="flex h-full w-full items-center justify-center rounded-full border-[18px] border-background bg-background/95">
                <div className="text-center">
                  <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Multas</p>
                  <p className="text-3xl font-black text-foreground">{stats.severityChart.total}</p>
                </div>
              </div>
            </div>
            <div className="space-y-2">
              {stats.severityChart.segments.map((segment) => (
                <div key={segment.key} className="flex items-center justify-between rounded-xl border border-border/70 px-3 py-2 text-[0.95rem]">
                  <div className="flex items-center gap-2 text-slate-600">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: segment.color }} />
                    {segment.label}
                  </div>
                  <span className="font-semibold text-foreground">{segment.value}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className={`${DASHBOARD_CARD_CLASS} ${DASHBOARD_CARD_VARIANTS.statusFrota} xl:col-span-3`}>
          <CardHeader className={DASHBOARD_CARD_HEADER_CLASS}>
            <CardDescription className={DASHBOARD_SECTION_LABEL_CLASS}>Fluxo atual</CardDescription>
            <CardTitle className="text-xl">Status Frota</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {Object.entries(stats.statusCounts).map(([status, count]) => (
              <div key={status} className="flex items-center justify-between rounded-xl border border-border/70 px-3 py-2">
                <Badge className={MULTA_STATUS_BADGE_CLASS[status as MultaStatus]}>
                  {MULTA_STATUS_LABELS[status as MultaStatus]}
                </Badge>
                <span className="text-lg font-black text-foreground">{count}</span>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className={`${DASHBOARD_CARD_CLASS} ${DASHBOARD_CARD_VARIANTS.statusRh} xl:col-span-6`}>
          <CardHeader className={DASHBOARD_CARD_HEADER_CLASS}>
            <CardDescription className={DASHBOARD_SECTION_LABEL_CLASS}>Confirmação interna</CardDescription>
            <CardTitle className="text-xl">Status RH</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {Object.entries(stats.rhStatusCounts).map(([status, count]) => (
              <div key={status} className="flex items-center justify-between rounded-xl border border-border/70 px-3 py-3">
                <Badge className={MULTA_RH_STATUS_BADGE_CLASS[status as MultaRhStatus]}>
                  {MULTA_RH_STATUS_LABELS[status as MultaRhStatus]}
                </Badge>
                <span className="text-lg font-black text-foreground">{count}</span>
              </div>
            ))}
            <div className="rounded-xl border border-sky-200/70 bg-sky-500/10 px-4 py-3 text-sky-700">
              <p className="text-xs uppercase tracking-[0.16em]">A recuperar</p>
              <p className="mt-1 text-xl font-black">{formatCurrency(stats.valorEmAberto)}</p>
            </div>
            <div className="rounded-xl border border-emerald-200/70 bg-emerald-500/10 px-4 py-3 text-emerald-700">
              <p className="text-xs uppercase tracking-[0.16em]">Já baixado</p>
              <p className="mt-1 text-xl font-black">{formatCurrency(stats.valorPago)}</p>
            </div>
          </CardContent>
        </Card>

        <Card className={`${DASHBOARD_CARD_CLASS} ${DASHBOARD_CARD_VARIANTS.locadoras} xl:col-span-6`}>
          <CardHeader className={DASHBOARD_CARD_HEADER_CLASS}>
            <CardDescription className={DASHBOARD_SECTION_LABEL_CLASS}>Base de locação</CardDescription>
            <CardTitle className="text-xl">Locadoras</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {stats.locadoraCounts.length > 0 ? (
              stats.locadoraCounts.map(([label, count]) => (
                <div key={label} className="flex items-center justify-between rounded-xl border border-border/70 px-3 py-3">
                  <div className="flex items-center gap-2 text-[0.95rem] text-slate-700">
                    <Building2 className="h-4 w-4 text-slate-400" />
                    <span>{label}</span>
                  </div>
                  <span className="text-lg font-black text-foreground">{count}</span>
                </div>
              ))
            ) : (
              <div className="rounded-xl border border-dashed border-border px-4 py-6 text-sm text-muted-foreground">
                Nenhuma locadora encontrada nos filtros atuais.
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="border-[#d8dfd1] bg-white shadow-sm">
          <CardHeader className="border-b border-[#e5ece0] pb-4">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <CardTitle className="text-2xl font-semibold">Gestão de multas</CardTitle>
                <CardDescription className="text-slate-600">
                  Busca por placa, condutor, auto de infração e acompanhamento do fluxo operacional.
                </CardDescription>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
                <p className="text-[0.95rem] text-muted-foreground">
                  Mostrando <span className="font-semibold text-foreground">{filteredMultas.length}</span> de <span className="font-semibold text-foreground">{multas.length}</span> registros
                </p>
                {hasActiveFilters ? (
                  <Button type="button" variant="outline" className="h-10 text-[0.95rem]" onClick={resetFilters}>
                    Limpar filtros
                  </Button>
                ) : null}
                {canManage ? (
                  <Button className="h-10 gap-2 text-[0.95rem]" onClick={handleAdd}>
                    <Plus className="h-4 w-4" />
                    Adicionar nova multa
                  </Button>
                ) : null}
              </div>
            </div>

            <div className="grid gap-3 xl:grid-cols-[minmax(0,1.2fr)_180px_170px_190px_190px]">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Buscar por placa, condutor, tipo, locadora ou auto"
                  className="h-10 pl-9 text-[0.95rem]"
                />
              </div>
              <div className="relative">
                <Filter className="pointer-events-none absolute left-3 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as typeof statusFilter)}>
                  <SelectTrigger className="h-10 w-full pl-9 text-[0.95rem]">
                    <SelectValue placeholder="Status Frota" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos os status da frota</SelectItem>
                    {MULTA_STATUS_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="relative">
                <Filter className="pointer-events-none absolute left-3 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Select value={rhStatusFilter} onValueChange={(value) => setRhStatusFilter(value as typeof rhStatusFilter)}>
                  <SelectTrigger className="h-10 w-full pl-9 text-[0.95rem]">
                    <SelectValue placeholder="Status RH" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todo o RH</SelectItem>
                    {MULTA_RH_STATUS_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="relative">
                <Filter className="pointer-events-none absolute left-3 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Select value={gravidadeFilter} onValueChange={(value) => setGravidadeFilter(value as typeof gravidadeFilter)}>
                  <SelectTrigger className="h-10 w-full pl-9 text-[0.95rem]">
                    <SelectValue placeholder="Gravidade" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todas">Todas as gravidades</SelectItem>
                    {MULTA_GRAVIDADE_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="relative">
                <Filter className="pointer-events-none absolute left-3 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Select value={locadoraFilter} onValueChange={setLocadoraFilter}>
                  <SelectTrigger className="h-10 w-full pl-9 text-[0.95rem]">
                    <SelectValue placeholder="Locadora" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todas">Todas as locadoras</SelectItem>
                    {locadoraOptions.map((option) => (
                      <SelectItem key={option} value={option}>{option}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardHeader>

          <CardContent className="space-y-4 p-5">
            <div className="overflow-hidden rounded-xl border border-[#dfe7d8]">
              <div className="overflow-x-auto bg-white">
              <Table className="min-w-[1220px]">
                <TableHeader>
                  <TableRow className="bg-[#1f4f82] hover:bg-[#1f4f82] [&>th]:border-b-0">
                    <TableHead className="w-[220px] text-[0.9rem] text-white">Veículo / Condutor</TableHead>
                    <TableHead className="w-[210px] text-[0.9rem] text-white">Ocorrência</TableHead>
                    <TableHead className="w-[110px] text-[0.9rem] text-white">Gravidade</TableHead>
                    <TableHead className="w-[88px] text-[0.9rem] text-white">Valor R$</TableHead>
                    <TableHead className="w-[88px] text-[0.9rem] text-white">Valor NIC</TableHead>
                    <TableHead className="w-[96px] text-[0.9rem] text-white">Valor Total</TableHead>
                    <TableHead className="w-[110px] text-[0.9rem] text-white">Prazo Indicação</TableHead>
                    <TableHead className="w-[132px] text-[0.9rem] text-center text-white">Status Frota</TableHead>
                    <TableHead className="w-[118px] text-[0.9rem] text-center text-white">Status RH</TableHead>
                    {canManage ? <TableHead className="w-[104px] text-[0.9rem] text-center text-white">Ações</TableHead> : null}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredMultas.map((multa, index) => (
                    <TableRow key={multa.id} className={index % 2 === 0 ? "bg-white hover:bg-[#e7f4dc]" : "bg-[#fbfdf9] hover:bg-[#deefd0]"}>
                      <TableCell>
                        <div className="space-y-2.5">
                          <div className="flex items-center gap-2 text-slate-900">
                            <CarFront className="h-4 w-4 text-slate-400" />
                            <span className="font-semibold">{multa.placa}</span>
                          </div>
                          <div className="flex items-center gap-2 text-slate-700">
                            <UserRound className="h-4 w-4 text-slate-400" />
                            <span>{multa.condutor || "Não informado"}</span>
                          </div>
                          <div className="flex items-center gap-2 text-[0.8rem] text-muted-foreground">
                            <span className="font-medium text-slate-500">Status:</span>
                            <Badge className={MULTA_COLABORADOR_STATUS_BADGE_CLASS[getCondutorStatus(multa)]}>
                              {MULTA_COLABORADOR_STATUS_LABELS[getCondutorStatus(multa)]}
                            </Badge>
                          </div>
                          <div className="flex items-center gap-2 text-[0.8rem] text-muted-foreground">
                            <span className="font-medium text-slate-500">Indicado:</span>
                            <Badge className={getIndicacaoStatus(multa).className}>
                              {getIndicacaoStatus(multa).label}
                            </Badge>
                          </div>
                          <p className="text-[0.8rem] text-muted-foreground">
                            <span className="font-medium text-slate-500">Locadora:</span>{" "}
                            {resolveMultaLocadoraLabel(multa, vehiclesById, vehiclesByPlate)}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell className="max-w-[320px] whitespace-normal">
                        <div className="space-y-2">
                          <p className="font-medium text-slate-900">{multa.tipo}</p>
                          <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                            <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-slate-500">Auto de infração</p>
                            <p className="mt-1 font-mono text-[0.95rem] font-semibold text-slate-900">{multa.autoInfracao || "-"}</p>
                          </div>
                          <div className="flex flex-wrap items-center gap-3 text-[0.8rem] text-muted-foreground">
                            <span>{formatDateTime(multa.dataHoraInfracao)}</span>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge className={MULTA_GRAVIDADE_BADGE_CLASS[multa.gravidade]}>
                          {MULTA_GRAVIDADE_LABELS[multa.gravidade]} - {multa.pontos} pts
                        </Badge>
                      </TableCell>
                      <TableCell className="font-medium text-slate-900">{formatCurrency(multa.valor)}</TableCell>
                      <TableCell className="text-slate-700">{multa.valorNic != null ? formatCurrency(multa.valorNic) : "-"}</TableCell>
                      <TableCell className="font-semibold text-slate-900">{formatCurrency(getMultaTotalValue(multa))}</TableCell>
                      <TableCell className="text-slate-700">{formatDate(multa.dataLimiteIndicar)}</TableCell>
                      <TableCell>
                        <div className="space-y-1.5">
                          {canManage ? (
                            <Select value={multa.status} onValueChange={(value) => handleStatusChange(multa, value as MultaStatus)}>
                              <SelectTrigger className={`h-9 w-[132px] border px-2 text-[0.9rem] ${MULTA_STATUS_BADGE_CLASS[multa.status]}`}>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {MULTA_STATUS_OPTIONS.map((option) => (
                                  <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          ) : (
                            <Badge className={MULTA_STATUS_BADGE_CLASS[multa.status]}>{MULTA_STATUS_LABELS[multa.status]}</Badge>
                          )}
                          <p className="min-h-4 text-[0.76rem] text-muted-foreground">
                            {multa.statusEnviadoEm ? `Enviado em ${formatStatusDate(multa.statusEnviadoEm)}` : ""}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1.5">
                          {canManage ? (
                            <Select value={multa.rhStatus} onValueChange={(value) => handleRhStatusChange(multa, value as MultaRhStatus)}>
                              <SelectTrigger className={`h-9 w-[118px] border px-2 text-[0.9rem] ${MULTA_RH_STATUS_BADGE_CLASS[multa.rhStatus]}`}>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {MULTA_RH_STATUS_OPTIONS.map((option) => (
                                  <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          ) : canEditRhStatus && multa.rhStatus === "pendente" ? (
                            <Select value={multa.rhStatus} onValueChange={(value) => handleRhStatusChange(multa, value as MultaRhStatus)}>
                              <SelectTrigger className={`h-9 w-[118px] border px-2 text-[0.9rem] ${MULTA_RH_STATUS_BADGE_CLASS[multa.rhStatus]}`}>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="pendente">{MULTA_RH_STATUS_LABELS.pendente}</SelectItem>
                                <SelectItem value="pago">{MULTA_RH_STATUS_LABELS.pago}</SelectItem>
                              </SelectContent>
                            </Select>
                          ) : (
                            <Badge className={MULTA_RH_STATUS_BADGE_CLASS[multa.rhStatus]}>{MULTA_RH_STATUS_LABELS[multa.rhStatus]}</Badge>
                          )}
                          <p className="min-h-4 text-[0.76rem] text-muted-foreground">
                            {multa.rhPagoEm ? `Pago em ${formatStatusDate(multa.rhPagoEm)}` : ""}
                          </p>
                        </div>
                      </TableCell>
                      {canManage ? (
                        <TableCell className="w-[104px]">
                          <div className="flex flex-col items-stretch gap-2">
                            <Button variant="outline" size="sm" className="h-9 gap-1.5 px-2.5 text-[0.85rem] justify-center" onClick={() => handleEdit(multa)}>
                              <Pencil className="h-3.5 w-3.5" />
                              Editar
                            </Button>
                            <Button variant="outline" size="sm" className="h-9 gap-1.5 px-2.5 text-[0.85rem] justify-center text-destructive hover:text-destructive" onClick={() => setDeletingMulta(multa)}>
                              <Trash2 className="h-3.5 w-3.5" />
                              Excluir
                            </Button>
                          </div>
                        </TableCell>
                      ) : null}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              </div>
            </div>

            {!isLoading && filteredMultas.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-3 px-6 py-14 text-center">
                <div className="rounded-full bg-muted p-3 text-muted-foreground">
                  <FileWarning className="h-6 w-6" />
                </div>
                <div>
                  <p className="text-lg font-medium text-foreground">Nenhuma multa encontrada</p>
                  <p className="text-sm text-muted-foreground">Ajuste os filtros atuais ou cadastre uma nova ocorrência.</p>
                </div>
              </div>
            ) : null}
          </CardContent>
      </Card>

      <div className="space-y-4">
        {error ? (
          <Card className="overflow-hidden border-[#efcfc9] bg-[#fff7f4] shadow-sm">
            <CardHeader className="border-b border-[#f0d4cf] bg-[#fff0ec] pb-4">
              <CardTitle className="text-xl text-destructive">Erro ao carregar multas</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-[0.95rem] text-destructive/80">{error.message}</p>
            </CardContent>
          </Card>
        ) : null}

        <Card className={DASHBOARD_CARD_CLASS}>
          <CardHeader className={DASHBOARD_CARD_HEADER_CLASS}>
            <CardDescription className={DASHBOARD_SECTION_LABEL_CLASS}>Base utilizada</CardDescription>
            <CardTitle className="text-xl">Observação</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-[0.95rem] text-muted-foreground">
              Se a tabela de multas ainda não existir no banco, o painel continua funcionando com fallback local até a migração SQL ser aplicada.
            </p>
          </CardContent>
        </Card>
      </div>

      <MultaModal
        open={isModalOpen}
        onOpenChange={setIsModalOpen}
        multa={editingMulta}
        vehicles={vehicles}
        colaboradores={colaboradores}
        onSave={handleSave}
      />

      <AlertDialog open={Boolean(deletingMulta)} onOpenChange={(open) => { if (!open) setDeletingMulta(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir multa</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir a multa da placa <span className="font-semibold text-foreground">{deletingMulta?.placa}</span>? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={handleConfirmDelete}>
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}