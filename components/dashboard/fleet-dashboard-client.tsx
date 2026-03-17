"use client"

import { useMemo, useState } from "react"
import dynamic from "next/dynamic"
import Link from "next/link"
import { ArrowRight, Car, CircleDollarSign, Fuel, LayoutDashboard, Plus, Search, ShieldAlert, Sparkles, Truck, Users } from "lucide-react"
import { toast } from "@/hooks/use-toast"
import type { AppUser, UserRole } from "@/lib/types"
import { canAddColaboradores, canAddVehicles, canEditMultaRhStatus, canManageMultas } from "@/lib/auth-shared"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Header } from "@/components/fleet/header"
import { StatsCards } from "@/components/fleet/stats-cards"
import { Filters } from "@/components/fleet/filters"
import { VehiclesTable } from "@/components/fleet/vehicles-table"
import { VehicleModal } from "@/components/fleet/vehicle-modal"
import { AgregadoModal } from "@/components/fleet/agregado-modal"
import { AgregadosOverview } from "@/components/fleet/agregados-overview"
import { DeleteDialog } from "@/components/fleet/delete-dialog"
import { ColaboradoresTable } from "@/components/fleet/colaboradores-table"
import { ColaboradoresFilters, type ColaboradorFilters } from "@/components/fleet/colaboradores-filters"
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
import { FuelDataProvider, useFuelDataContext } from "@/components/fuel/fuel-data-provider"
import { FuelStatusAlert } from "@/components/fuel/fuel-status-alert"
import { MultasDashboard } from "@/components/multas/multas-dashboard"
import { useVehicles } from "@/hooks/use-vehicles"
import { useColaboradores } from "@/hooks/use-colaboradores"
import { useMultas } from "@/hooks/use-multas"
import { isVehicleDueForReview } from "@/lib/fleet-maintenance"
import type { Vehicle, VehicleFormData, VehicleFilters, Colaborador, ColaboradorFormData } from "@/lib/types"

const FuelDashboardOverview = dynamic(
  () => import("@/components/fuel/fuel-dashboard-overview").then((module) => module.FuelDashboardOverview),
  { loading: () => <FuelSectionLoading /> }
)
const FuelImportPanel = dynamic(
  () => import("@/components/fuel/fuel-import-panel").then((module) => module.FuelImportPanel),
  { loading: () => <FuelSectionLoading /> }
)
const FuelTransactionsTable = dynamic(
  () => import("@/components/fuel/fuel-transactions-table").then((module) => module.FuelTransactionsTable),
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

export type DashboardSection = "overview" | "veiculos-frota" | "veiculos-agregados" | "colaboradores" | "combustivel" | "multas"

type FleetDashboardClientProps = {
  initialUser: AppUser
  initialSection?: DashboardSection
}

type DashboardSectionItem = {
  id: DashboardSection
  href: string
  label: string
  description: string
  icon: typeof LayoutDashboard
}

const DASHBOARD_SECTION_BUTTON_STYLES: Record<DashboardSection, { active: string; inactive: string }> = {
  overview: {
    active: "border-[#7CB342] bg-[#7CB342] text-white hover:bg-[#6d9d39] hover:border-[#6d9d39]",
    inactive: "border-[#cfe3b2] bg-[#f3f9e8] text-[#6c9730] hover:bg-[#e8f3d6] hover:border-[#bcd88f] hover:text-[#5f8828]",
  },
  "veiculos-frota": {
    active: "border-[#2f7ddf] bg-[#2f7ddf] text-white hover:bg-[#256fca] hover:border-[#256fca]",
    inactive: "border-[#c7daf7] bg-[#edf5ff] text-[#2f7ddf] hover:bg-[#e3efff] hover:border-[#adcaf4] hover:text-[#256fca]",
  },
  "veiculos-agregados": {
    active: "border-[#0f8ecf] bg-[#0f8ecf] text-white hover:bg-[#0b7db6] hover:border-[#0b7db6]",
    inactive: "border-[#c9e6f6] bg-[#ebf8ff] text-[#0f8ecf] hover:bg-[#def3ff] hover:border-[#a9d8ef] hover:text-[#0b7db6]",
  },
  colaboradores: {
    active: "border-[#159a8c] bg-[#159a8c] text-white hover:bg-[#118477] hover:border-[#118477]",
    inactive: "border-[#c8e9e4] bg-[#eefaf7] text-[#159a8c] hover:bg-[#e0f4f0] hover:border-[#9fd8d0] hover:text-[#118477]",
  },
  combustivel: {
    active: "border-[#7c3aed] bg-[#7c3aed] text-white hover:bg-[#6d28d9] hover:border-[#6d28d9]",
    inactive: "border-[#ddd1f5] bg-[#f5f0ff] text-[#7c3aed] hover:bg-[#ede4ff] hover:border-[#cdbaf4] hover:text-[#6d28d9]",
  },
  multas: {
    active: "border-[#e0aa22] bg-[#e0aa22] text-white hover:bg-[#c99313] hover:border-[#c99313]",
    inactive: "border-[#f0dfaa] bg-[#fff8df] text-[#b98507] hover:bg-[#fdf1c8] hover:border-[#e7cd7a] hover:text-[#9f7306]",
  },
}

const DASHBOARD_SECTIONS: DashboardSectionItem[] = [
  {
    id: "overview",
    href: "/dashboard",
    label: "Painel Geral",
    description: "Resumo consolidado com os principais indicadores e busca rápida.",
    icon: LayoutDashboard,
  },
  {
    id: "veiculos-frota",
    href: "/dashboard/veiculos-frota",
    label: "Veículos Frota",
    description: "Cadastro, filtros e acompanhamento dos veículos próprios e alugados.",
    icon: Car,
  },
  {
    id: "veiculos-agregados",
    href: "/dashboard/veiculos-agregados",
    label: "Veículos Agregados",
    description: "Controle operacional dos veículos agregados e seus vínculos.",
    icon: Truck,
  },
  {
    id: "colaboradores",
    href: "/dashboard/colaboradores",
    label: "Colaboradores",
    description: "Gestão dos colaboradores, documentos e vencimentos de CNH.",
    icon: Users,
  },
  {
    id: "combustivel",
    href: "/dashboard/combustivel",
    label: "Combustível",
    description: "Resumo mensal, importação de dados e transações do combustível.",
    icon: Fuel,
  },
  {
    id: "multas",
    href: "/dashboard/multas",
    label: "Multas",
    description: "Acompanhamento de infrações, indicação de condutor, valores e status de tratativa.",
    icon: ShieldAlert,
  },
]

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

function getSectionMeta(section: DashboardSection): Pick<DashboardSectionItem, "label" | "description"> {
  const matchedSection = DASHBOARD_SECTIONS.find((item) => item.id === section)

  return {
    label: matchedSection?.label || "Painel Geral",
    description: matchedSection?.description || "Resumo consolidado do sistema.",
  }
}

const DASHBOARD_PAGE_FRAME_CLASS = "w-full max-w-none"
const DASHBOARD_HEADER_CARD_CLASS = "w-full rounded-2xl border border-border bg-card p-5 shadow-sm sm:p-6"
const DASHBOARD_CONTENT_STAGE_CLASS = "min-h-[calc(100vh-20rem)] w-full max-w-none"

export function FleetDashboardClient({ initialUser, initialSection = "overview" }: FleetDashboardClientProps) {
  return (
    <FuelDataProvider>
      <FleetDashboardContent initialUser={initialUser} initialSection={initialSection} />
    </FuelDataProvider>
  )
}

function FleetDashboardContent({ initialUser, initialSection }: Required<FleetDashboardClientProps>) {
  const { monthlyTotal: monthlyFuelTotal } = useFuelDataContext()
  const { vehicles, addVehicle, updateVehicle, deleteVehicle } = useVehicles()
  const {
    colaboradores,
    addColaborador,
    updateColaborador,
    deleteColaborador,
  } = useColaboradores()
  const { multas } = useMultas()

  const userRole: UserRole = initialUser.role || "consulta"
  const isMaster = initialUser.isMaster === true
  const { label: sectionLabel, description: sectionDescription } = getSectionMeta(initialSection)

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
        (filters.statusVeiculo === "disponivel" && !vehicle.frota && !vehicle.colaboradorId) ||
        (filters.statusVeiculo === "ocupado" && !vehicle.frota && vehicle.colaboradorId)

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
        (colaborador.telefone && colaborador.telefone.includes(colaboradorFilters.search))

      const vencimento = new Date(colaborador.dataVencimentoCNH)
      const vencida = vencimento < hoje
      const vencendo = vencimento <= trintaDias && vencimento >= hoje
      const valida = vencimento > trintaDias

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

      if (colaboradorFilters.ordenacao === "cnh_vencimento_asc") {
        return dateA - dateB
      }

      return dateB - dateA
    })

    return result
  }, [colaboradores, colaboradorFilters])

  const veiculosFrota = useMemo(() => filteredVehicles.filter((vehicle) => vehicle.frota === true), [filteredVehicles])
  const veiculosAgregados = useMemo(() => filteredVehicles.filter((vehicle) => !vehicle.frota), [filteredVehicles])
  const totalVeiculosFrota = useMemo(() => vehicles.filter((vehicle) => vehicle.frota), [vehicles])
  const totalVeiculosAgregados = useMemo(() => vehicles.filter((vehicle) => !vehicle.frota), [vehicles])

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
        href: "/dashboard/veiculos-agregados",
        label: "Veículos Agregados",
        value: totalVeiculosAgregados.length.toString(),
        accent: "bg-cyan-500/10 text-cyan-700",
        description: `${totalVeiculosAgregados.filter((vehicle) => !vehicle.colaboradorId).length} sem colaborador • ${countExpiringContracts(totalVeiculosAgregados)} contratos a vencer`,
        icon: Truck,
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
    [colaboradores, monthlyFuelTotal, multas.length, totalVeiculosAgregados, totalVeiculosFrota, vehicles]
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
      if (editingVehicle) {
        await updateVehicle(editingVehicle.id, data)
        toast({ title: "Sucesso", description: "Veículo atualizado com sucesso!" })
      } else {
        await addVehicle({ ...data, frota: true })
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
    if (initialSection === "veiculos-frota" && canAddVehicles(userRole)) {
      return (
        <Button onClick={handleAddVehicle} className="gap-2">
          <Plus className="h-4 w-4" />
          Adicionar Veículo
        </Button>
      )
    }

    if (initialSection === "veiculos-agregados" && canAddVehicles(userRole)) {
      return (
        <Button onClick={handleAddAgregado} className="gap-2">
          <Plus className="h-4 w-4" />
          Adicionar Agregado
        </Button>
      )
    }

    if (initialSection === "colaboradores" && canAddColaboradores(userRole)) {
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
      <StatsCards vehicles={vehicles} colaboradores={colaboradores} multas={multas} />

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
                  const destinationHref = vehicle.frota ? "/dashboard/veiculos-frota" : "/dashboard/veiculos-agregados"

                  return (
                    <div
                      key={vehicle.id}
                      className="flex flex-col gap-3 rounded-[1.15rem] border border-[#dfe6f0] bg-[linear-gradient(180deg,#ffffff_0%,#f8fbff_100%)] p-4 shadow-[0_10px_20px_rgba(78,110,160,0.06)] sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-mono text-base font-semibold text-slate-900">{vehicle.placa}</span>
                          <Badge className={vehicle.frota ? "bg-[#2f7ddf]/10 text-[#2f7ddf] hover:bg-[#2f7ddf]/20" : "bg-sky-500/10 text-sky-600 hover:bg-sky-500/20"}>
                            {vehicle.frota ? "Frota" : "Agregado"}
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
    if (initialSection === "veiculos-frota") {
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

    if (initialSection === "veiculos-agregados") {
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

    if (initialSection === "colaboradores") {
      return (
        <div className="w-full space-y-4">
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

    if (initialSection === "combustivel") {
      return (
        <div className="w-full space-y-4">
          <FuelStatusAlert />
          <FuelDashboardOverview />
          <FuelImportPanel isMaster={isMaster} />
          <FuelTransactionsTable />
        </div>
      )
    }

    if (initialSection === "multas") {
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
    <div className="flex min-h-screen flex-col bg-background">
      <Header userRole={userRole} userEmail={initialUser.email} userName={initialUser.nome} userAvatarUrl={initialUser.avatarUrl} />

      <main className="mx-auto w-full max-w-[1440px] px-5 py-6 sm:px-6 lg:px-8 xl:px-10">
        <div className="min-h-[calc(100vh-12rem)] w-full space-y-6">
          <div className={DASHBOARD_HEADER_CARD_CLASS}>
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="space-y-1">
                <h2 className="text-[2rem] font-semibold text-foreground">{sectionLabel}</h2>
                <p className="max-w-4xl text-[0.98rem] text-muted-foreground">{sectionDescription}</p>
              </div>
              {renderPrimaryAction()}
            </div>

            <div className="mt-5 flex flex-wrap gap-2.5">
              {DASHBOARD_SECTIONS.map((section) => {
                const isActive = section.id === initialSection
                const palette = DASHBOARD_SECTION_BUTTON_STYLES[section.id]

                return (
                  <Button
                    key={section.id}
                    asChild
                    variant="outline"
                    className={cn(
                      "h-10 gap-2 rounded-xl px-4 text-[0.95rem] shadow-sm transition-colors",
                      isActive ? palette.active : palette.inactive
                    )}
                  >
                    <Link href={section.href}>
                      <section.icon className="h-4 w-4" />
                      {section.label}
                    </Link>
                  </Button>
                )
              })}
            </div>
          </div>

          <section className={cn(DASHBOARD_PAGE_FRAME_CLASS, DASHBOARD_CONTENT_STAGE_CLASS)}>{renderCurrentSection()}</section>
        </div>
      </main>

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