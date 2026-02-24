"use client"

import { useState, useMemo, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Plus, Users, Car, Truck, Fuel } from "lucide-react"
import { toast } from "@/hooks/use-toast"
import type { AppUser, UserRole } from "@/lib/types"
import { canAddVehicles } from "@/lib/auth-shared"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Header } from "@/components/fleet/header"
import { StatsCards } from "@/components/fleet/stats-cards"
import { Filters } from "@/components/fleet/filters"
import { VehiclesTable } from "@/components/fleet/vehicles-table"
import { VehicleModal } from "@/components/fleet/vehicle-modal"
import { AgregadoModal } from "@/components/fleet/agregado-modal"
import { AgregadosTable } from "@/components/fleet/agregados-table"
import { DeleteDialog } from "@/components/fleet/delete-dialog"
import { ColaboradoresTable } from "@/components/fleet/colaboradores-table"
import { ColaboradoresFilters, type ColaboradorFilters } from "@/components/fleet/colaboradores-filters"
import { ColaboradorModal } from "@/components/fleet/colaborador-modal"
import { AssignModal } from "@/components/fleet/assign-modal"
import { FuelSummary } from "@/components/fuel/fuel-summary"
import { FuelChartsPlaceholder } from "@/components/fuel/fuel-charts-placeholder"
import { FuelImportPanel } from "@/components/fuel/fuel-import-panel"
import { FuelTransactionsTable } from "@/components/fuel/fuel-transactions-table"
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
import { useVehicles } from "@/hooks/use-vehicles"
import { useColaboradores } from "@/hooks/use-colaboradores"
import type { Vehicle, VehicleFormData, VehicleFilters, Colaborador, ColaboradorFormData } from "@/lib/types"

export default function FleetPage() {
  const { vehicles, addVehicle, updateVehicle, deleteVehicle } = useVehicles()
  const { colaboradores, addColaborador, updateColaborador, deleteColaborador } = useColaboradores()
  const router = useRouter()

  const [currentUser, setCurrentUser] = useState<AppUser | null>(null)
  const [activeTab, setActiveTab] = useState("veiculos")

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const { getCurrentUser } = await import("@/app/actions/auth")
        const user = await getCurrentUser()
        if (user) {
          setCurrentUser(user)
        } else {
          router.push("/auth/login")
        }
      } catch {
        router.push("/auth/login")
      }
    }
    fetchUser()
  }, [router])

  const userRole: UserRole = currentUser?.role || "consulta"
  const isMaster = currentUser?.isMaster === true
  
  const [filters, setFilters] = useState<VehicleFilters>({
    search: "",
    tipoPropriedade: "todos",
    cartaoCombustivel: "todos",
    atribuicao: "todos",
    statusVeiculo: "todos",
    situacao: "todos",
  })
  
  const [colaboradorFilters, setColaboradorFilters] = useState<ColaboradorFilters>({
    search: "",
    ordenacao: "cnh_vencimento_asc",
    statusCNH: "todos",
  })
  
  // Vehicle modals
  const [isVehicleModalOpen, setIsVehicleModalOpen] = useState(false)
  const [editingVehicle, setEditingVehicle] = useState<Vehicle | null>(null)
  const [isDeleteVehicleDialogOpen, setIsDeleteVehicleDialogOpen] = useState(false)
  const [deletingVehicle, setDeletingVehicle] = useState<Vehicle | null>(null)
  
  // Agregado modal
  const [isAgregadoModalOpen, setIsAgregadoModalOpen] = useState(false)
  const [editingAgregado, setEditingAgregado] = useState<Vehicle | null>(null)
  
  // Colaborador modals
  const [isColaboradorModalOpen, setIsColaboradorModalOpen] = useState(false)
  const [editingColaborador, setEditingColaborador] = useState<Colaborador | null>(null)
  const [isDeleteColaboradorDialogOpen, setIsDeleteColaboradorDialogOpen] = useState(false)
  const [deletingColaborador, setDeletingColaborador] = useState<Colaborador | null>(null)
  
  // Assign modal
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false)
  const [assigningVehicle, setAssigningVehicle] = useState<Vehicle | null>(null)
  const [isUnassignDialogOpen, setIsUnassignDialogOpen] = useState(false)
  const [unassigningVehicle, setUnassigningVehicle] = useState<Vehicle | null>(null)

  const filteredVehicles = useMemo(() => {
    const today = new Date()
    const thirtyDaysFromNow = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000)
    
    return vehicles.filter((vehicle) => {
      const matchesSearch =
        filters.search === "" ||
        vehicle.placa.toLowerCase().includes(filters.search.toLowerCase()) ||
        vehicle.chassi.toLowerCase().includes(filters.search.toLowerCase()) ||
        vehicle.modelo.toLowerCase().includes(filters.search.toLowerCase())

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

      // Filtro de situação (contratos vencendo, na oficina, para revisão, sem parar)
      const vencimento = new Date(vehicle.dataVencimentoContrato)
      const contratoVencendo = vencimento <= thirtyDaysFromNow
      
      const matchesSituacao =
        filters.situacao === "todos" ||
        (filters.situacao === "contrato_vencendo" && contratoVencendo) ||
        (filters.situacao === "na_oficina" && vehicle.naOficina) ||
        (filters.situacao === "para_revisao" && vehicle.paraRevisao) ||
        (filters.situacao === "sem_parar" && vehicle.semParar)

      return matchesSearch && matchesPropriedade && matchesCartao && matchesAtribuicao && matchesStatus && matchesSituacao
    })
  }, [vehicles, filters])

  const filteredColaboradores = useMemo(() => {
    const hoje = new Date()
    const trintaDias = new Date(hoje.getTime() + 30 * 24 * 60 * 60 * 1000)
    
    let result = colaboradores.filter((colaborador) => {
      // Filtro de busca
      const matchesSearch =
        colaboradorFilters.search === "" ||
        colaborador.nome.toLowerCase().includes(colaboradorFilters.search.toLowerCase()) ||
        colaborador.cpf.toLowerCase().includes(colaboradorFilters.search.toLowerCase()) ||
        (colaborador.telefone && colaborador.telefone.includes(colaboradorFilters.search))

      // Filtro de status CNH
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

    // Ordenação
    result = [...result].sort((a, b) => {
      if (colaboradorFilters.ordenacao === "nome") {
        return a.nome.localeCompare(b.nome)
      }
      
      const dateA = new Date(a.dataVencimentoCNH).getTime()
      const dateB = new Date(b.dataVencimentoCNH).getTime()
      
      if (colaboradorFilters.ordenacao === "cnh_vencimento_asc") {
        return dateA - dateB // Mais próximo primeiro
      }
      
      return dateB - dateA // Mais distante primeiro
    })

    return result
  }, [colaboradores, colaboradorFilters])

  // Veículos da Frota (frota = true)
  const veiculosFrota = useMemo(() => {
    return filteredVehicles.filter((v) => v.frota === true)
  }, [filteredVehicles])

  // Veículos Agregados (frota = false ou undefined)
  const veiculosAgregados = useMemo(() => {
    return filteredVehicles.filter((v) => !v.frota)
  }, [filteredVehicles])

  // Vehicle handlers
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
        await addVehicle({ ...data, frota: true }) // Veículos frota sempre tem frota = true
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

  // Agregado handlers
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
        await addVehicle({ ...data, frota: false }) // Veículos agregados sempre tem frota = false
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
    const vehicle = vehicles.find((v) => v.id === id)
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

  // Colaborador handlers
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

        const vehiclesToUnassign = vehicles.filter((v) => v.colaboradorId === colaboradorId && v.id !== veiculoId)
        if (vehiclesToUnassign.length > 0) {
          await Promise.all(
            vehiclesToUnassign.map((v) => updateVehicle(v.id, { ...v, colaboradorId: null }))
          )
        }

        toast({ title: "Sucesso", description: "Colaborador atualizado com sucesso!" })
      } else {
        const newColaborador = await addColaborador(data)
        colaboradorId = newColaborador.id
        toast({ title: "Sucesso", description: "Colaborador adicionado com sucesso!" })
      }

      if (veiculoId) {
        const vehicle = vehicles.find((v) => v.id === veiculoId)
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
    const colaborador = colaboradores.find((c) => c.id === id)
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

  // Assign handlers
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
    const vehicle = vehicles.find((v) => v.id === vehicleId)
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

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Header userRole={userRole} userEmail={currentUser?.email} userName={currentUser?.nome} />
      
      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <div className="space-y-6">
          <StatsCards vehicles={vehicles} colaboradores={colaboradores} />

          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <TabsList className="bg-muted/70 border border-border shadow-sm">
                <TabsTrigger
                  value="veiculos"
                  className="gap-2 data-[state=active]:bg-[#7CB342] data-[state=active]:text-white data-[state=active]:shadow text-muted-foreground"
                >
                  <Car className="h-4 w-4" />
                  Veículos Frota
                </TabsTrigger>
                <TabsTrigger
                  value="agregados"
                  className="gap-2 data-[state=active]:bg-[#7CB342] data-[state=active]:text-white data-[state=active]:shadow text-muted-foreground"
                >
                  <Truck className="h-4 w-4" />
                  Veículos Agregados
                </TabsTrigger>
                <TabsTrigger
                  value="colaboradores"
                  className="gap-2 data-[state=active]:bg-[#7CB342] data-[state=active]:text-white data-[state=active]:shadow text-muted-foreground"
                >
                  <Users className="h-4 w-4" />
                  Colaboradores
                </TabsTrigger>
                <TabsTrigger
                  value="combustivel"
                  className="gap-2 data-[state=active]:bg-[#7CB342] data-[state=active]:text-white data-[state=active]:shadow text-muted-foreground"
                >
                  <Fuel className="h-4 w-4" />
                  Combustível
                </TabsTrigger>
              </TabsList>

              {canAddVehicles(userRole) && (
                activeTab === "colaboradores" ? (
                  <Button onClick={handleAddColaborador} className="gap-2">
                    <Plus className="h-4 w-4" />
                    Adicionar Colaborador
                  </Button>
                ) : activeTab === "combustivel" ? (
                  <Button onClick={() => setActiveTab("combustivel")} className="gap-2" variant="secondary">
                    <Plus className="h-4 w-4" />
                    Novo Relatório
                  </Button>
                ) : activeTab === "agregados" ? (
                  <Button onClick={handleAddAgregado} className="gap-2">
                    <Plus className="h-4 w-4" />
                    Adicionar Agregado
                  </Button>
                ) : (
                  <Button onClick={handleAddVehicle} className="gap-2">
                    <Plus className="h-4 w-4" />
                    Adicionar Veículo
                  </Button>
                )
              )}
            </div>
            
            <TabsContent value="veiculos" className="mt-6 space-y-4">
              <Filters filters={filters} onFiltersChange={setFilters} />
              <VehiclesTable
                vehicles={veiculosFrota}
                colaboradores={colaboradores}
                onEdit={handleEditVehicle}
                onDelete={handleDeleteVehicleClick}
                onAssign={handleAssignVehicle}
                onUnassign={handleUnassignVehicle}
              />
            </TabsContent>

            <TabsContent value="agregados" className="mt-6 space-y-4">
              <AgregadosTable
                vehicles={veiculosAgregados}
                colaboradores={colaboradores}
                onEdit={handleEditAgregado}
                onDelete={handleDeleteVehicleClick}
                onAssign={handleAssignVehicle}
                onUnassign={handleUnassignVehicle}
              />
            </TabsContent>
            
            <TabsContent value="colaboradores" className="mt-6 space-y-4">
              <ColaboradoresFilters 
                filters={colaboradorFilters} 
                onFiltersChange={setColaboradorFilters} 
              />
              <ColaboradoresTable
                colaboradores={filteredColaboradores}
                vehicles={vehicles}
                onEdit={handleEditColaborador}
                onDelete={handleDeleteColaboradorClick}
              />
            </TabsContent>

            <TabsContent value="combustivel" className="mt-6 space-y-4">
              <FuelSummary />
              <FuelImportPanel isMaster={isMaster} />
              <FuelTransactionsTable />
              <FuelChartsPlaceholder />
            </TabsContent>
          </Tabs>
        </div>
      </main>

      {/* Vehicle Modals */}
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

      {/* Agregado Modal */}
      <AgregadoModal
        open={isAgregadoModalOpen}
        onOpenChange={setIsAgregadoModalOpen}
        vehicle={editingAgregado}
        onSave={handleSaveAgregado}
      />

      {/* Colaborador Modals */}
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

      {/* Assign Modal */}
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
              Deseja realmente remover o colaborador do veiculo{" "}
              <span className="font-semibold text-foreground">
                {unassigningVehicle?.placa}
              </span>
              ?
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
