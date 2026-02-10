"use client"

import { useState, useMemo, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Plus, Users, Car, Truck } from "lucide-react"
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

  const handleSaveVehicle = (data: VehicleFormData) => {
    if (editingVehicle) {
      updateVehicle(editingVehicle.id, data)
      toast({ title: "Sucesso", description: "Veículo atualizado com sucesso!" })
    } else {
      addVehicle({ ...data, frota: true }) // Veículos frota sempre tem frota = true
      toast({ title: "Sucesso", description: "Veículo adicionado com sucesso!" })
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

  const handleSaveAgregado = (data: VehicleFormData) => {
    if (editingAgregado) {
      updateVehicle(editingAgregado.id, { ...data, frota: false })
      toast({ title: "Sucesso", description: "Veículo agregado atualizado com sucesso!" })
    } else {
      addVehicle({ ...data, frota: false }) // Veículos agregados sempre tem frota = false
      toast({ title: "Sucesso", description: "Veículo agregado adicionado com sucesso!" })
    }
  }

  const handleDeleteVehicleClick = (id: string) => {
    const vehicle = vehicles.find((v) => v.id === id)
    if (vehicle) {
      setDeletingVehicle(vehicle)
      setIsDeleteVehicleDialogOpen(true)
    }
  }

  const handleConfirmDeleteVehicle = () => {
    if (deletingVehicle) {
      deleteVehicle(deletingVehicle.id)
      toast({ title: "Sucesso", description: "Veículo excluído com sucesso!" })
      setIsDeleteVehicleDialogOpen(false)
      setDeletingVehicle(null)
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

  const handleSaveColaborador = (data: ColaboradorFormData, veiculoId?: string | null) => {
    let colaboradorId: string

    if (editingColaborador) {
      updateColaborador(editingColaborador.id, data)
      colaboradorId = editingColaborador.id
      
      // Remover atribuição de veículos antigos deste colaborador
      vehicles.forEach((v) => {
        if (v.colaboradorId === colaboradorId && v.id !== veiculoId) {
          updateVehicle(v.id, { ...v, colaboradorId: null })
        }
      })
      
      toast({ title: "Sucesso", description: "Colaborador atualizado com sucesso!" })
    } else {
      const newColaborador = addColaborador(data)
      colaboradorId = newColaborador.id
      toast({ title: "Sucesso", description: "Colaborador adicionado com sucesso!" })
    }

    // Atribuir novo veículo ao colaborador
    if (veiculoId) {
      const vehicle = vehicles.find((v) => v.id === veiculoId)
      if (vehicle) {
        updateVehicle(veiculoId, { ...vehicle, colaboradorId })
      }
    }
  }

  const handleDeleteColaboradorClick = (id: string) => {
    const colaborador = colaboradores.find((c) => c.id === id)
    if (colaborador) {
      setDeletingColaborador(colaborador)
      setIsDeleteColaboradorDialogOpen(true)
    }
  }

  const handleConfirmDeleteColaborador = () => {
    if (deletingColaborador) {
      deleteColaborador(deletingColaborador.id)
      toast({ title: "Sucesso", description: "Colaborador excluído com sucesso!" })
      setIsDeleteColaboradorDialogOpen(false)
      setDeletingColaborador(null)
    }
  }

  // Assign handlers
  const handleAssignVehicle = (vehicle: Vehicle) => {
    setAssigningVehicle(vehicle)
    setIsAssignModalOpen(true)
  }

  const handleUnassignVehicle = (vehicle: Vehicle) => {
    updateVehicle(vehicle.id, { ...vehicle, colaboradorId: null })
    toast({ title: "Sucesso", description: "Veículo desvinculado do colaborador!" })
  }

  const handleConfirmAssign = (vehicleId: string, colaboradorId: string) => {
    const vehicle = vehicles.find((v) => v.id === vehicleId)
    if (vehicle) {
      updateVehicle(vehicleId, { ...vehicle, colaboradorId })
      toast({ title: "Sucesso", description: "Veículo atribuído ao colaborador!" })
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
              <TabsList>
                <TabsTrigger value="veiculos" className="gap-2">
                  <Car className="h-4 w-4" />
                  Veículos Frota
                </TabsTrigger>
                <TabsTrigger value="agregados" className="gap-2">
                  <Truck className="h-4 w-4" />
                  Veículos Agregados
                </TabsTrigger>
                <TabsTrigger value="colaboradores" className="gap-2">
                  <Users className="h-4 w-4" />
                  Colaboradores
                </TabsTrigger>
              </TabsList>
              
              {canAddVehicles(userRole) && (
                activeTab === "colaboradores" ? (
                  <Button onClick={handleAddColaborador} className="gap-2">
                    <Plus className="h-4 w-4" />
                    Adicionar Colaborador
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
    </div>
  )
}
