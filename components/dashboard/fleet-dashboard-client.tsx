"use client"

import { useMemo, useState } from "react"
import dynamic from "next/dynamic"
import Link from "next/link"
import { ArrowRight, CalendarRange, Car, CircleDollarSign, Download, Fuel, Plus, Search, Sparkles, Users } from "lucide-react"
import { toast } from "@/hooks/use-toast"
import type { AppUser, UserRole } from "@/lib/types"
import { canAddColaboradores, canAddVehicles, canEditMultaRhStatus, canManageMultas } from "@/lib/auth-shared"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Header, type HeaderNotification } from "@/components/fleet/header"
import { AppSidebar } from "@/components/dashboard/app-sidebar"
import { SHOW_AGREGADOS_SECTION, getSectionMeta, type DashboardSection } from "@/components/dashboard/nav-config"
import { StatsCards } from "@/components/fleet/stats-cards"
import { OverviewInsights } from "@/components/dashboard/overview-insights"
import { Filters } from "@/components/fleet/filters"
import { VehiclesTable } from "@/components/fleet/vehicles-table"
import { VehicleModal } from "@/components/fleet/vehicle-modal"
import { AgregadoModal } from "@/components/fleet/agregado-modal"
import { AgregadosOverview } from "@/components/fleet/agregados-overview"
import { DeleteDialog } from "@/components/fleet/delete-dialog"
import { ColaboradoresTable } from "@/components/fleet/colaboradores-table"
import { ColaboradoresFilters, type ColaboradorFilters } from "@/components/fleet/colaboradores-filters"
import { ColaboradoresImportPanel } from "@/components/fleet/colaboradores-import-panel"
import { ColaboradorModal } from "@/components/fleet/colaborador-modal"
import { AssignModal } from "@/components/fleet/assign-modal"
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
import { FuelDataProvider, useOptionalFuelDataContext } from "@/components/fuel/fuel-data-provider"
import { FuelStatusAlert } from "@/components/fuel/fuel-status-alert"
import { MultasDashboard } from "@/components/multas/multas-dashboard"
import { useVehicles } from "@/hooks/use-vehicles"
import { refreshColaboradores, useColaboradores } from "@/hooks/use-colaboradores"
import { useMultas } from "@/hooks/use-multas"
import { isVehicleDueForReview } from "@/lib/fleet-maintenance"
import { isAgregadoVehicle, isVisibleInFrotaSection } from "@/lib/vehicle-classification"
import type { Vehicle, VehicleFormData, VehicleFilters, Colaborador, ColaboradorFormData } from "@/lib/types"

export type { DashboardSection } from "@/components/dashboard/nav-config"

const FuelWorkspace = dynamic(
  () => import("@/components/fuel/fuel-workspace").then((module) => module.FuelWorkspace),
  { loading: () => <FuelSectionLoading /> }
)

const DEFAULT_VEHICLE_FILTERS: VehicleFilters = {
  search: "",
  searchScope: "todos",
  tipoPropriedade: "todos",
  cartaoCombustivel: "todos",
  atribuicao: "todos",
  statusVeiculo: "todos",
  situacao: "todos",
}

const DEFAULT_COLABORADOR_FILTERS: ColaboradorFilters = {
  search: "",
  ordenacao: "cnh_vencimento_asc",
  statusCNH: "todos",
}

type FleetDashboardClientProps = {
  initialUser: AppUser
  initialSection?: DashboardSection
}

function FuelSectionLoading() {
  return <div className="h-24 animate-pulse rounded-lg border border-border bg-muted/40" />
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value)
}

function countExpiringContracts(vehicles: Vehicle[]): number {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const thirtyDaysFromNow = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000)

  return vehicles.filter((vehicle) => {
    if (!vehicle.dataVencimentoContrato) return false
    const vencimento = new Date(vehicle.dataVencimentoContrato)
    if (Number.isNaN(vencimento.getTime())) return false
    vencimento.setHours(0, 0, 0, 0)
    return vencimento >= today && vencimento <= thirtyDaysFromNow
  }).length
}

function countCNHAlerts(colaboradores: Colaborador[]): number {
  const hoje = new Date()
  const trintaDias = new Date(hoje.getTime() + 30 * 24 * 60 * 60 * 1000)

  return colaboradores.filter((colaborador) => {
    const vencimento = new Date(colaborador.dataVencimentoCNH)
    if (Number.isNaN(vencimento.getTime())) return false
    return vencimento <= trintaDias
  }).length
}

function normalizePlate(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "")
}

function formatDateBR(date: Date): string {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date)
}

const DASHBOARD_PAGE_FRAME_CLASS = "w-full max-w-none"
const DASHBOARD_HEADER_CARD_CLASS = "w-full rounded-2xl border border-border bg-card p-4 shadow-sm sm:p-5 lg:p-6"
const DASHBOARD_CONTENT_STAGE_CLASS = "min-h-[calc(100vh-18rem)] w-full max-w-none"

export function FleetDashboardClient({ initialUser, initialSection = "overview" }: FleetDashboardClientProps) {
  const needsFuelData = initialSection === "overview" || initialSection === "combustivel"

  if (!needsFuelData) {
    return <FleetDashboardContent initialUser={initialUser} initialSection={initialSection} />
  }

  return (
    <FuelDataProvider>
      <FleetDashboardContent initialUser={initialUser} initialSection={initialSection} />
    </FuelDataProvider>
  )
}

function FleetDashboardContent({ initialUser, initialSection }: Required<FleetDashboardClientProps>) {
  const resolvedInitialSection = initialSection === "veiculos-agregados" && !SHOW_AGREGADOS_SECTION
    ? "veiculos-frota"
    : initialSection
  const fuelData = useOptionalFuelDataContext()
  const shouldLoadVehicles = resolvedInitialSection !== "combustivel"
  const shouldLoadColaboradores = resolvedInitialSection !== "combustivel"
  const shouldLoadMultas = resolvedInitialSection === "overview"
  const monthlyFuelTotal = fuelData?.monthlyTotal ?? 0
  const { vehicles, addVehicle, updateVehicle, deleteVehicle } = useVehicles(shouldLoadVehicles)
  const {
    colaboradores,
    addColaborador,
    updateColaborador,
    deleteColaborador,
  } = useColaboradores(shouldLoadColaboradores)
  const { multas } = useMultas(shouldLoadMultas)

  const userRole: UserRole = initialUser.role || "consulta"
  const isMaster = initialUser.isMaster === true
  const { label: sectionLabel, description: sectionDescription } = getSectionMeta(resolvedInitialSection)

  const notifications = useMemo<HeaderNotification[]>(() => {
    const items: HeaderNotification[] = []
    const contratosVencendo = countExpiringContracts(vehicles.filter((vehicle) => vehicle.frota))
    const cnhAlertas = countCNHAlerts(colaboradores)
    const multasPendentes = multas.filter((multa) => multa.rhStatus === "pendente").length

    if (contratosVencendo > 0) {
      items.push({
        id: "contratos",
        title: `${contratosVencendo} contrato${contratosVencendo > 1 ? "s" : ""} a vencer`,
        description: "Vencimento nos próximos 30 dias.",
        href: "/dashboard/veiculos-frota",
      })
    }

    if (cnhAlertas > 0) {
      items.push({
        id: "cnh",
        title: `${cnhAlertas} CNH${cnhAlertas > 1 ? "s" : ""} em atenção`,
        description: "Vencidas ou vencendo nos próximos 30 dias.",
        href: "/dashboard/colaboradores",
      })
    }

    if (multasPendentes > 0) {
      items.push({
        id: "multas",
        title: `${multasPendentes} multa${multasPendentes > 1 ? "s" : ""} pendente${multasPendentes > 1 ? "s" : ""}`,
        description: "Aguardando tratativa do RH.",
        href: "/dashboard/multas",
      })
    }

    return items
  }, [vehicles, colaboradores, multas])

  const [filters, setFilters] = useState<VehicleFilters>(DEFAULT_VEHICLE_FILTERS)
  const [colaboradorFilters, setColaboradorFilters] = useState<ColaboradorFilters>(DEFAULT_COLABORADOR_FILTERS)
  const [quickSearch, setQuickSearch] = useState("")

  const [isVehicleModalOpen, setIsVehicleModalOpen] = useState(false)
  const [editingVehicle, setEditingVehicle] = useState<Vehicle | null>(null)
  const [isDeleteVehicleDialogOpen, setIsDeleteVehicleDialogOpen] = useState(false)
  const [deletingVehicle, setDeletingVehicle] = useState<Vehicle | null>(null)

  const [isAgregadoModalOpen, setIsAgregadoModalOpen] = useState(false)
  const [editingAgregado, setEditingAgregado] = useState<Vehicle | null>(null)


  const [isColaboradorModalOpen, setIsColaboradorModalOpen] = useState(false)
  const [editingColaborador, setEditingColaborador] = useState<Colaborador | null>(null)
  const [isDeleteColaboradorDialogOpen, setIsDeleteColaboradorDialogOpen] = useState(false)
  const [deletingColaborador, setDeletingColaborador] = useState<Colaborador | null>(null)

  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false)
  const [assigningVehicle, setAssigningVehicle] = useState<Vehicle | null>(null)
  const [isUnassignDialogOpen, setIsUnassignDialogOpen] = useState(false)
  const [unassigningVehicle, setUnassigningVehicle] = useState<Vehicle | null>(null)

  const colaboradoresById = useMemo(() => new Map(colaboradores.map((colaborador) => [colaborador.id, colaborador])), [colaboradores])

  const filteredVehicles = useMemo(() => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const thirtyDaysFromNow = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000)
    const normalizedSearch = filters.search.trim().toLowerCase()
    const normalizedPlateSearch = normalizePlate(filters.search.trim())

    return vehicles.filter((vehicle) => {
      const matchesVehiclePlate =
        normalizedPlateSearch !== "" && normalizePlate(vehicle.placa).includes(normalizedPlateSearch)
      const matchesCardPlate =
        normalizedPlateSearch !== "" && normalizePlate(vehicle.placaCartaoCombustivel ?? "").includes(normalizedPlateSearch)
      const matchesGenericFields =
        normalizedSearch !== "" && (
          vehicle.chassi.toLowerCase().includes(normalizedSearch) ||
          vehicle.modelo.toLowerCase().includes(normalizedSearch)
        )

      const matchesSearch =
        normalizedSearch === "" ||
        (filters.searchScope === "todos" && (matchesVehiclePlate || matchesCardPlate || matchesGenericFields)) ||
        (filters.searchScope === "placa_veiculo" && matchesVehiclePlate) ||
        (filters.searchScope === "placa_cartao" && matchesCardPlate)

      const matchesPropriedade =
        filters.tipoPropriedade === "todos" ||
        vehicle.tipoPropriedade === filters.tipoPropriedade

      const matchesCartao =
        filters.cartaoCombustivel === "todos" ||
        vehicle.cartaoCombustivel === filters.cartaoCombustivel

      const matchesAtribuicao =
        filters.atribuicao === "todos" ||
        (filters.atribuicao === "atribuido" && vehicle.colaboradorId) ||
        (filters.atribuicao === "disponivel" && !vehicle.colaboradorId)

      const matchesStatus =
        filters.statusVeiculo === "todos" ||
        (filters.statusVeiculo === "frota" && vehicle.frota) ||
        (filters.statusVeiculo === "disponivel" && !vehicle.colaboradorId && !vehicle.naOficina && !isVehicleDueForReview(vehicle)) ||
        (filters.statusVeiculo === "ocupado" && Boolean(vehicle.colaboradorId))

      const vencimento = new Date(vehicle.dataVencimentoContrato)
      const contratoVencendo =
        !Number.isNaN(vencimento.getTime()) &&
        (() => {
          vencimento.setHours(0, 0, 0, 0)
          return vencimento >= today && vencimento <= thirtyDaysFromNow
        })()

      const matchesSituacao =
        filters.situacao === "todos" ||
        (filters.situacao === "contrato_vencendo" && contratoVencendo) ||
        (filters.situacao === "na_oficina" && vehicle.naOficina) ||
        (filters.situacao === "para_revisao" && isVehicleDueForReview(vehicle)) ||
        (filters.situacao === "sem_parar" && vehicle.semParar)

      return matchesSearch && matchesPropriedade && matchesCartao && matchesAtribuicao && matchesStatus && matchesSituacao
    })
  }, [vehicles, filters])

  const filteredColaboradores = useMemo(() => {
    const hoje = new Date()
    const trintaDias = new Date(hoje.getTime() + 30 * 24 * 60 * 60 * 1000)
    const normalizedSearch = colaboradorFilters.search.trim().toLowerCase()

    let result = colaboradores.filter((colaborador) => {
      const matchesSearch =
        normalizedSearch === "" ||
        colaborador.nome.toLowerCase().includes(normalizedSearch) ||
        colaborador.cpf.toLowerCase().includes(normalizedSearch) ||
        (colaborador.telefone && colaborador.telefone.includes(colaboradorFilters.search)) ||
        colaborador.centroCusto.toLowerCase().includes(normalizedSearch)

      const vencimento = new Date(colaborador.dataVencimentoCNH)
      const hasValidDate = !Number.isNaN(vencimento.getTime())
      const vencida = hasValidDate && vencimento < hoje
      const vencendo = hasValidDate && vencimento <= trintaDias && vencimento >= hoje
      const valida = hasValidDate && vencimento > trintaDias

      const matchesStatusCNH =
        colaboradorFilters.statusCNH === "todos" ||
        (colaboradorFilters.statusCNH === "vencida" && vencida) ||
        (colaboradorFilters.statusCNH === "vencendo" && vencendo) ||
        (colaboradorFilters.statusCNH === "valida" && valida)

      return matchesSearch && matchesStatusCNH
    })

    result = [...result].sort((a, b) => {
      if (colaboradorFilters.ordenacao === "nome") {
        return a.nome.localeCompare(b.nome)
      }

      const dateA = new Date(a.dataVencimentoCNH).getTime()
      const dateB = new Date(b.dataVencimentoCNH).getTime()
      const normalizedDateA = Number.isNaN(dateA) ? Number.POSITIVE_INFINITY : dateA
      const normalizedDateB = Number.isNaN(dateB) ? Number.POSITIVE_INFINITY : dateB

      if (colaboradorFilters.ordenacao === "cnh_vencimento_asc") {
        return normalizedDateA - normalizedDateB
      }

      return normalizedDateB - normalizedDateA
    })

    return result
  }, [colaboradores, colaboradorFilters])

  const veiculosAgregados = useMemo(() => filteredVehicles.filter((vehicle) => isAgregadoVehicle(vehicle)), [filteredVehicles])
  const veiculosFrota = useMemo(() => filteredVehicles.filter((vehicle) => isVisibleInFrotaSection(vehicle)), [filteredVehicles])
  const totalVeiculosFrota = useMemo(() => vehicles.filter((vehicle) => vehicle.frota), [vehicles])
  const totalVeiculosAgregados = useMemo(() => vehicles.filter((vehicle) => isAgregadoVehicle(vehicle)), [vehicles])

  const quickSearchResults = useMemo(() => {
    const normalizedPlate = normalizePlate(quickSearch.trim())

    if (!normalizedPlate) return []

    return vehicles.filter((vehicle) => normalizePlate(vehicle.placa).includes(normalizedPlate)).slice(0, 6)
  }, [vehicles, quickSearch])

  const overviewCards = useMemo(
    () => [
      {
        href: "/dashboard/veiculos-frota",
        label: "Veículos Frota",
        value: totalVeiculosFrota.length.toString(),
        accent: "bg-primary/10 text-primary",
        description: `${totalVeiculosFrota.filter((vehicle) => vehicle.colaboradorId).length} em uso • ${countExpiringContracts(totalVeiculosFrota)} contratos a vencer`,
        icon: Car,
      },
      {
        href: "/dashboard/colaboradores",
        label: "Colaboradores",
        value: colaboradores.length.toString(),
        accent: "bg-teal-500/10 text-teal-700",
        description: `${new Set(vehicles.map((vehicle) => vehicle.colaboradorId).filter(Boolean)).size} com veículo vinculado • ${countCNHAlerts(colaboradores)} CNHs em atenção`,
        icon: Users,
      },
      {
        href: "/dashboard/combustivel",
        label: "Combustível",
        value: formatCurrency(monthlyFuelTotal),
        accent: "bg-violet-500/10 text-violet-700",
        description: "Resumo mensal, importação de dados e histórico de transações.",
        icon: Fuel,
      },
      {
        href: "/dashboard/multas",
        label: "Multas",
        value: multas.length.toString(),
        accent: "bg-rose-500/10 text-rose-700",
        description: "Painel inicial para acompanhamento de multas, status e indicação de condutor.",
        icon: CircleDollarSign,
      },
    ],
    [colaboradores, monthlyFuelTotal, multas.length, totalVeiculosFrota, vehicles]
  )

  const handleAddVehicle = () => {
    setEditingVehicle(null)
    setIsVehicleModalOpen(true)
  }

  const handleEditVehicle = (vehicle: Vehicle) => {
    setEditingVehicle(vehicle)
    setIsVehicleModalOpen(true)
  }

  const handleSaveVehicle = async (data: VehicleFormData) => {
    try {
      const normalizedData = !data.frota
        ? {
            ...data,
            frota: false,
            colaboradorId: null,
            naOficina: false,
            paraRevisao: false,
          }
        : data

      if (editingVehicle) {
        await updateVehicle(editingVehicle.id, normalizedData)
        if (!data.frota) {
          toast({
            title: "Status atualizado",
            description: "O veículo continua na página de frota como disponível, sem entrar na contagem da frota.",
          })
        } else {
          toast({ title: "Sucesso", description: "Veículo atualizado com sucesso!" })
        }
      } else {
        await addVehicle({ ...normalizedData, frota: true })
        toast({ title: "Sucesso", description: "Veículo adicionado com sucesso!" })
      }
    } catch (error) {
      toast({
        title: "Erro",
        description: error instanceof Error ? error.message : "Falha ao salvar veículo.",
        variant: "destructive",
      })
    }
  }

  const handleAddAgregado = () => {
    setEditingAgregado(null)
    setIsAgregadoModalOpen(true)
  }

  const handleEditAgregado = (vehicle: Vehicle) => {
    setEditingAgregado(vehicle)
    setIsAgregadoModalOpen(true)
  }

  const handleSaveAgregado = async (data: VehicleFormData) => {
    try {
      if (editingAgregado) {
        await updateVehicle(editingAgregado.id, { ...data, frota: false })
        toast({ title: "Sucesso", description: "Veículo agregado atualizado com sucesso!" })
      } else {
        await addVehicle({ ...data, frota: false })
        toast({ title: "Sucesso", description: "Veículo agregado adicionado com sucesso!" })
      }
    } catch (error) {
      toast({
        title: "Erro",
        description: error instanceof Error ? error.message : "Falha ao salvar veículo agregado.",
        variant: "destructive",
      })
    }
  }

  const handleDeleteVehicleClick = (id: string) => {
    const vehicle = vehicles.find((item) => item.id === id)
    if (vehicle) {
      setDeletingVehicle(vehicle)
      setIsDeleteVehicleDialogOpen(true)
    }
  }

  const handleConfirmDeleteVehicle = async () => {
    if (!deletingVehicle) return
    try {
      await deleteVehicle(deletingVehicle.id)
      toast({ title: "Sucesso", description: "Veículo excluído com sucesso!" })
      setIsDeleteVehicleDialogOpen(false)
      setDeletingVehicle(null)
    } catch (error) {
      toast({
        title: "Erro",
        description: error instanceof Error ? error.message : "Falha ao excluir veículo.",
        variant: "destructive",
      })
    }
  }

  const handleAddColaborador = () => {
    setEditingColaborador(null)
    setIsColaboradorModalOpen(true)
  }

  const handleEditColaborador = (colaborador: Colaborador) => {
    setEditingColaborador(colaborador)
    setIsColaboradorModalOpen(true)
  }

  const handleSaveColaborador = async (data: ColaboradorFormData, veiculoId?: string | null, veiculoKm?: number | null) => {
    try {
      let colaboradorId: string

      if (editingColaborador) {
        await updateColaborador(editingColaborador.id, data)
        colaboradorId = editingColaborador.id

        const vehiclesToUnassign = vehicles.filter((vehicle) => vehicle.colaboradorId === colaboradorId && vehicle.id !== veiculoId)
        if (vehiclesToUnassign.length > 0) {
          await Promise.all(vehiclesToUnassign.map((vehicle) => updateVehicle(vehicle.id, { ...vehicle, colaboradorId: null })))
        }

        toast({ title: "Sucesso", description: "Colaborador atualizado com sucesso!" })
      } else {
        const newColaborador = await addColaborador(data)
        colaboradorId = newColaborador.id
        toast({ title: "Sucesso", description: "Colaborador adicionado com sucesso!" })
      }

      if (veiculoId) {
        const vehicle = vehicles.find((item) => item.id === veiculoId)
        if (vehicle) {
          const kmToSave = typeof veiculoKm === "number" ? veiculoKm : vehicle.km
          await updateVehicle(veiculoId, { ...vehicle, colaboradorId, km: kmToSave })
        }
      }
    } catch (error) {
      toast({
        title: "Erro",
        description: error instanceof Error ? error.message : "Falha ao salvar colaborador.",
        variant: "destructive",
      })
    }
  }

  const handleDeleteColaboradorClick = (id: string) => {
    const colaborador = colaboradores.find((item) => item.id === id)
    if (colaborador) {
      setDeletingColaborador(colaborador)
      setIsDeleteColaboradorDialogOpen(true)
    }
  }

  const handleConfirmDeleteColaborador = async () => {
    if (!deletingColaborador) return
    try {
      await deleteColaborador(deletingColaborador.id)
      toast({ title: "Sucesso", description: "Colaborador excluído com sucesso!" })
      setIsDeleteColaboradorDialogOpen(false)
      setDeletingColaborador(null)
    } catch (error) {
      toast({
        title: "Erro",
        description: error instanceof Error ? error.message : "Falha ao excluir colaborador.",
        variant: "destructive",
      })
    }
  }

  const handleAssignVehicle = (vehicle: Vehicle) => {
    setAssigningVehicle(vehicle)
    setIsAssignModalOpen(true)
  }

  const handleUnassignVehicle = (vehicle: Vehicle) => {
    setUnassigningVehicle(vehicle)
    setIsUnassignDialogOpen(true)
  }

  const handleConfirmUnassignVehicle = async () => {
    if (!unassigningVehicle) return
    try {
      await updateVehicle(unassigningVehicle.id, { ...unassigningVehicle, colaboradorId: null })
      toast({ title: "Sucesso", description: "Veículo desvinculado do colaborador!" })
      setIsUnassignDialogOpen(false)
      setUnassigningVehicle(null)
    } catch (error) {
      toast({
        title: "Erro",
        description: error instanceof Error ? error.message : "Falha ao remover colaborador.",
        variant: "destructive",
      })
    }
  }

  const handleConfirmAssign = async (vehicleId: string, colaboradorId: string) => {
    const vehicle = vehicles.find((item) => item.id === vehicleId)
    if (!vehicle) return

    try {
      await updateVehicle(vehicleId, { ...vehicle, colaboradorId })
      toast({ title: "Sucesso", description: "Veículo atribuído ao colaborador!" })
    } catch (error) {
      toast({
        title: "Erro",
        description: error instanceof Error ? error.message : "Falha ao atribuir colaborador.",
        variant: "destructive",
      })
    }
  }

  const renderPrimaryAction = () => {
    if (resolvedInitialSection === "overview") {
      const today = new Date()
      const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1)
      const periodLabel = `${formatDateBR(startOfMonth)} - ${formatDateBR(today)}`

      return (
        <div className="flex flex-wrap items-center gap-2">
          <span className="flex h-9 items-center gap-2 rounded-xl border border-border bg-muted/40 px-3 text-xs font-medium text-muted-foreground sm:h-10 sm:text-sm">
            <CalendarRange className="h-4 w-4" />
            {periodLabel}
          </span>
          <Button
            type="button"
            onClick={() =>
              toast({
                title: "Exportação em breve",
                description: "A exportação de relatórios será disponibilizada em uma próxima atualização.",
              })
            }
            className="h-9 gap-2 bg-[#7CB342] text-white hover:bg-[#6d9d39] sm:h-10"
          >
            <Download className="h-4 w-4" />
            Exportar Relatório
          </Button>
        </div>
      )
    }

    if (resolvedInitialSection === "veiculos-frota" && canAddVehicles(userRole)) {
      return (
        <Button onClick={handleAddVehicle} className="gap-2">
          <Plus className="h-4 w-4" />
          Adicionar Veículo
        </Button>
      )
    }

    if (resolvedInitialSection === "veiculos-agregados" && SHOW_AGREGADOS_SECTION && canAddVehicles(userRole)) {
      return (
        <Button onClick={handleAddAgregado} className="gap-2">
          <Plus className="h-4 w-4" />
          Adicionar Agregado
        </Button>
      )
    }

    if (resolvedInitialSection === "colaboradores" && canAddColaboradores(userRole)) {
      return (
        <Button onClick={handleAddColaborador} className="gap-2">
          <Plus className="h-4 w-4" />
          Adicionar Colaborador
        </Button>
      )
    }

    return null
  }

  const renderOverview = () => (
    <div className="w-full space-y-6">
      <StatsCards vehicles={vehicles} multas={multas} />

      <OverviewInsights vehicles={vehicles} colaboradores={colaboradores} multas={multas} fuelData={fuelData} />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.25fr)_minmax(320px,0.75fr)]">
        <Card className="overflow-hidden rounded-[1.6rem] border-[#d9e3ef] bg-[linear-gradient(180deg,#ffffff_0%,#fbfdff_100%)] shadow-[0_18px_40px_rgba(61,97,146,0.10)]">
          <CardHeader className="border-b border-[#e6edf6] bg-[linear-gradient(180deg,#fbfdff_0%,#f5f8fc_100%)] pb-5">
            <CardTitle className="flex items-center gap-2 text-xl text-slate-900">
              <Search className="h-4.5 w-4.5 text-[#2f7ddf]" />
              Busca rápida por placa
            </CardTitle>
            <CardDescription className="text-sm text-slate-500">
              Localize rapidamente veículos pela placa e abra a página da seção correspondente.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5 p-5 sm:p-6">
            <div className="flex flex-col gap-3 sm:flex-row">
              <div className="relative flex-1">
                <Search className="absolute left-4 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                <Input
                  placeholder="Digite a placa"
                  value={quickSearch}
                  onChange={(event) => setQuickSearch(event.target.value)}
                  className="h-12 rounded-2xl border-[#d7dfeb] bg-white pl-10 text-sm shadow-[inset_0_1px_0_rgba(255,255,255,0.8)]"
                />
              </div>
              <Button
                type="button"
                onClick={() => setQuickSearch((currentValue) => currentValue.trim().toUpperCase())}
                className="h-12 rounded-2xl bg-[#2f7ddf] px-6 text-sm font-semibold text-white shadow-[0_14px_24px_rgba(47,125,223,0.22)] hover:bg-[#256fca]"
              >
                <Search className="h-3.5 w-3.5" />
                Buscar
              </Button>
            </div>

            {quickSearch.trim() === "" ? (
              <div className="rounded-[1.35rem] border border-dashed border-[#d7e1ee] bg-[linear-gradient(180deg,#fbfcff_0%,#f5f8fc_100%)] px-4 py-12 text-center">
                <p className="text-sm font-semibold text-slate-800">Digite uma placa para procurar um veículo.</p>
                <p className="mt-1 text-sm text-slate-500">
                  A busca considera o formato completo ou parcial da placa.
                </p>
              </div>
            ) : quickSearchResults.length === 0 ? (
              <div className="rounded-[1.35rem] border border-dashed border-[#ead8d8] bg-[linear-gradient(180deg,#fffafa_0%,#fdf3f3_100%)] px-4 py-12 text-center">
                <p className="text-sm font-semibold text-slate-800">Nenhum veículo encontrado.</p>
                <p className="mt-1 text-sm text-slate-500">Verifique a placa informada e tente novamente.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {quickSearchResults.map((vehicle) => {
                  const colaboradorNome = vehicle.colaboradorId ? colaboradoresById.get(vehicle.colaboradorId)?.nome : null
                  const destinationHref = "/dashboard/veiculos-frota"

                  return (
                    <div
                      key={vehicle.id}
                      className="flex flex-col gap-3 rounded-[1.15rem] border border-[#dfe6f0] bg-[linear-gradient(180deg,#ffffff_0%,#f8fbff_100%)] p-4 shadow-[0_10px_20px_rgba(78,110,160,0.06)] sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-mono text-base font-semibold text-slate-900">{vehicle.placa}</span>
                          <Badge className="bg-[#2f7ddf]/10 text-[#2f7ddf] hover:bg-[#2f7ddf]/20">
                            Veículo
                          </Badge>
                          {colaboradorNome ? (
                            <Badge variant="outline" className="border-[#d9e2ed] bg-white text-slate-600">{colaboradorNome}</Badge>
                          ) : (
                            <Badge variant="outline" className="border-[#d9e2ed] bg-white text-slate-400">
                              Sem colaborador
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-slate-500">{vehicle.modelo}</p>
                      </div>

                      <Button asChild variant="outline" className="gap-2 rounded-xl border-[#d7dfeb] bg-white text-slate-700 shadow-sm hover:bg-slate-50 sm:self-center">
                        <Link href={destinationHref}>
                          Abrir página
                          <ArrowRight className="h-4 w-4" />
                        </Link>
                      </Button>
                    </div>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="overflow-hidden rounded-[1.6rem] border-[#dde5ee] bg-[linear-gradient(180deg,#ffffff_0%,#f8fafc_100%)] shadow-[0_18px_40px_rgba(61,97,146,0.08)]">
          <CardHeader className="border-b border-[#e7edf4] bg-[linear-gradient(180deg,#fcfdff_0%,#f6f8fb_100%)] pb-5">
            <CardTitle className="flex items-center gap-2 text-lg text-slate-900">
              <Sparkles className="h-4.5 w-4.5 text-[#7aa63d]" />
              Acessos rápidos
            </CardTitle>
            <CardDescription className="text-sm text-slate-500">
              Entradas diretas para as áreas mais usadas da operação.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 p-5">
          {overviewCards.map((card) => (
            <Card key={card.label} className="rounded-[1.3rem] border-[#dfe6ef] bg-[linear-gradient(180deg,#ffffff_0%,#fbfcfe_100%)] shadow-[0_10px_22px_rgba(83,108,147,0.08)]">
              <CardContent className="flex h-full flex-col gap-4 p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-1">
                    <p className="text-sm font-semibold text-slate-500">{card.label}</p>
                    <p className="text-2xl font-bold text-slate-900">{card.value}</p>
                  </div>
                  <div className={cn("flex h-9.5 w-9.5 items-center justify-center rounded-[1.05rem] shadow-sm", card.accent)}>
                    <card.icon className="h-4.5 w-4.5" />
                  </div>
                </div>
                <p className="text-sm leading-relaxed text-slate-500">{card.description}</p>
                <Button asChild variant="outline" className="mt-auto gap-2 rounded-xl border-[#d7dfeb] bg-white text-slate-700 shadow-sm hover:bg-slate-50">
                  <Link href={card.href}>
                    Acessar página
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
              </CardContent>
            </Card>
          ))}
          </CardContent>
        </Card>
      </div>
    </div>
  )

  const renderCurrentSection = () => {
    if (resolvedInitialSection === "veiculos-frota") {
      return (
        <div className="w-full space-y-4">
          <Filters filters={filters} onFiltersChange={setFilters} />
          <VehiclesTable
            vehicles={veiculosFrota}
            colaboradores={colaboradores}
            canManage={canAddVehicles(userRole)}
            onEdit={handleEditVehicle}
            onDelete={handleDeleteVehicleClick}
            onAssign={handleAssignVehicle}
            onUnassign={handleUnassignVehicle}
          />
        </div>
      )
    }

    if (resolvedInitialSection === "veiculos-agregados" && SHOW_AGREGADOS_SECTION) {
      return (
        <div className="w-full">
          <AgregadosOverview
            vehicles={veiculosAgregados}
            colaboradores={colaboradores}
            approverName={initialUser.nome}
            canManage={canAddVehicles(userRole)}
            onAdd={handleAddAgregado}
            onEdit={handleEditAgregado}
            onDelete={handleDeleteVehicleClick}
          />
        </div>
      )
    }

    if (resolvedInitialSection === "colaboradores") {
      return (
        <div className="w-full space-y-4">
          {isMaster ? <ColaboradoresImportPanel isMaster={isMaster} onImported={refreshColaboradores} /> : null}
          <ColaboradoresFilters filters={colaboradorFilters} onFiltersChange={setColaboradorFilters} />
          <ColaboradoresTable
            colaboradores={filteredColaboradores}
            vehicles={vehicles}
            canManage={canAddColaboradores(userRole)}
            onEdit={handleEditColaborador}
            onDelete={handleDeleteColaboradorClick}
          />
        </div>
      )
    }

    if (resolvedInitialSection === "combustivel") {
      return (
        <div className="w-full space-y-4">
          <FuelStatusAlert />
          <FuelWorkspace isMaster={isMaster} />
        </div>
      )
    }

    if (resolvedInitialSection === "multas") {
      return (
        <div className="w-full">
          <MultasDashboard
            vehicles={vehicles}
            colaboradores={colaboradores}
            canManage={canManageMultas(userRole)}
            canEditRhStatus={canEditMultaRhStatus(userRole)}
          />
        </div>
      )
    }

    return renderOverview()
  }
  return (
    <div className="flex min-h-screen bg-background">
      <AppSidebar activeSection={resolvedInitialSection} isMaster={isMaster} />

      <div className="flex min-h-screen min-w-0 flex-1 flex-col">
        <Header
          userRole={userRole}
          userEmail={initialUser.email}
          userName={initialUser.nome}
          userAvatarUrl={initialUser.avatarUrl}
          activeSection={resolvedInitialSection}
          isMaster={isMaster}
          notifications={notifications}
        />

        <main className="mx-auto w-full max-w-[1440px] px-4 py-3 sm:px-5 sm:py-4 lg:px-6 lg:py-5 xl:px-8 xl:py-6">
          <div className="min-h-[calc(100vh-9rem)] w-full space-y-4 sm:min-h-[calc(100vh-10rem)] sm:space-y-5 lg:space-y-6">
            <div className={DASHBOARD_HEADER_CARD_CLASS}>
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0 space-y-1">
                  <h2 className="text-[1.45rem] font-semibold text-foreground sm:text-[1.7rem] xl:text-[2rem]">{sectionLabel}</h2>
                  <p className="max-w-4xl text-sm text-muted-foreground sm:text-[0.98rem]">{sectionDescription}</p>
                </div>

                {renderPrimaryAction()}
              </div>
            </div>

            <section className={cn(DASHBOARD_PAGE_FRAME_CLASS, DASHBOARD_CONTENT_STAGE_CLASS)}>{renderCurrentSection()}</section>
          </div>
        </main>
      </div>

      <VehicleModal
        open={isVehicleModalOpen}
        onOpenChange={setIsVehicleModalOpen}
        vehicle={editingVehicle}
        onSave={handleSaveVehicle}
      />

      <DeleteDialog
        open={isDeleteVehicleDialogOpen}
        onOpenChange={setIsDeleteVehicleDialogOpen}
        onConfirm={handleConfirmDeleteVehicle}
        vehiclePlaca={deletingVehicle?.placa}
      />

      <AgregadoModal
        open={isAgregadoModalOpen}
        onOpenChange={setIsAgregadoModalOpen}
        vehicle={editingAgregado}
        onSave={handleSaveAgregado}
      />

      <ColaboradorModal
        open={isColaboradorModalOpen}
        onOpenChange={setIsColaboradorModalOpen}
        colaborador={editingColaborador}
        vehicles={vehicles}
        onSave={handleSaveColaborador}
      />

      <DeleteDialog
        open={isDeleteColaboradorDialogOpen}
        onOpenChange={setIsDeleteColaboradorDialogOpen}
        onConfirm={handleConfirmDeleteColaborador}
        vehiclePlaca={deletingColaborador?.nome}
      />

      <AssignModal
        open={isAssignModalOpen}
        onOpenChange={setIsAssignModalOpen}
        vehicle={assigningVehicle}
        colaboradores={colaboradores}
        onAssign={handleConfirmAssign}
      />

      <AlertDialog open={isUnassignDialogOpen} onOpenChange={setIsUnassignDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover colaborador</AlertDialogTitle>
            <AlertDialogDescription>
              Deseja realmente remover o colaborador do veículo{" "}
              <span className="font-semibold text-foreground">{unassigningVehicle?.placa}</span>?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmUnassignVehicle}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}