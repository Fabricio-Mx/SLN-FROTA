"use client"

import { Edit, MoreHorizontal, Trash2, UserPlus, UserMinus } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
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
import type { Vehicle, Colaborador } from "@/lib/types"

interface VehiclesTableProps {
  vehicles: Vehicle[]
  colaboradores: Colaborador[]
  onEdit: (vehicle: Vehicle) => void
  onDelete: (id: string) => void
  onAssign: (vehicle: Vehicle) => void
  onUnassign: (vehicle: Vehicle) => void
}

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString("pt-BR")
}

function isContractExpiring(dateString: string): boolean {
  const vencimento = new Date(dateString)
  const today = new Date()
  const thirtyDaysFromNow = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000)
  return vencimento <= thirtyDaysFromNow
}

function isContractExpired(dateString: string): boolean {
  const vencimento = new Date(dateString)
  const today = new Date()
  return vencimento < today
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value)
}

function getEmpresaLocacaoNome(empresa: string | null | undefined): string {
  const nomes: Record<string, string> = {
    localiza: "Localiza",
    lok_motors: "LOK MOTORS",
    movida: "Movida",
    veiculo_sln: "Veículo SLN",
  }
  return empresa ? nomes[empresa] || empresa : "-"
}

export function VehiclesTable({ vehicles, colaboradores, onEdit, onDelete, onAssign, onUnassign }: VehiclesTableProps) {
  const getColaboradorName = (colaboradorId: string | null | undefined) => {
    if (!colaboradorId) return null
    const colaborador = colaboradores.find((c) => c.id === colaboradorId)
    return colaborador ? colaborador.nome : null
  }
  if (vehicles.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border bg-card py-16">
        <p className="text-lg font-medium text-foreground">
          Nenhum veículo encontrado
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          Adicione um novo veículo para começar
        </p>
      </div>
    )
  }

  return (
    <div className="rounded-lg border border-border bg-card overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/50">
            <TableHead className="font-semibold">Placa</TableHead>
            <TableHead className="font-semibold">Modelo</TableHead>
            <TableHead className="font-semibold">KM</TableHead>
            <TableHead className="font-semibold">Mensalidade</TableHead>
            <TableHead className="font-semibold">Vencimento</TableHead>
            <TableHead className="font-semibold">Propriedade</TableHead>
            <TableHead className="font-semibold">Locadora</TableHead>
            <TableHead className="font-semibold">Cartão</TableHead>
            <TableHead className="font-semibold">Status</TableHead>
            <TableHead className="font-semibold">Sem Parar</TableHead>
            <TableHead className="font-semibold">Colaborador</TableHead>
            <TableHead className="w-[70px]"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {vehicles.map((vehicle) => {
            const expired = isContractExpired(vehicle.dataVencimentoContrato)
            const expiring = isContractExpiring(vehicle.dataVencimentoContrato)
            const colaboradorNome = getColaboradorName(vehicle.colaboradorId)

            return (
              <TableRow key={vehicle.id}>
                <TableCell className="font-mono font-medium">
                  {vehicle.placa}
                </TableCell>
                <TableCell className="text-sm">
                  {vehicle.modelo}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {(vehicle.km ?? 0).toLocaleString("pt-BR")} km
                </TableCell>
                <TableCell className="font-medium text-sm">
                  {formatCurrency(vehicle.mensalidade)}
                </TableCell>
                <TableCell>
                  <span
                    className={
                      expired
                        ? "font-medium text-destructive"
                        : expiring
                        ? "font-medium text-chart-3"
                        : ""
                    }
                  >
                    {formatDate(vehicle.dataVencimentoContrato)}
                  </span>
                  {expired && (
                    <Badge variant="destructive" className="ml-2 text-xs">
                      Vencido
                    </Badge>
                  )}
                  {!expired && expiring && (
                    <Badge className="ml-2 bg-chart-3/10 text-chart-3 hover:bg-chart-3/20 text-xs">
                      Vencendo
                    </Badge>
                  )}
                </TableCell>
                <TableCell>
                  <Badge
                    variant={vehicle.tipoPropriedade === "proprio" ? "default" : "secondary"}
                    className={
                      vehicle.tipoPropriedade === "proprio"
                        ? "bg-accent/10 text-accent hover:bg-accent/20"
                        : ""
                    }
                  >
                    {vehicle.tipoPropriedade === "proprio" ? "Próprio" : "Alugado"}
                  </Badge>
                </TableCell>
                <TableCell>
                  {vehicle.tipoPropriedade === "alugado" ? (
                    <Badge variant="outline" className="bg-secondary/50">
                      {getEmpresaLocacaoNome(vehicle.empresaLocacao)}
                    </Badge>
                  ) : (
                    <span className="text-sm text-muted-foreground">-</span>
                  )}
                </TableCell>
                <TableCell>
                  <Badge variant="outline" className="font-medium">
                    {vehicle.cartaoCombustivel === "veloe" 
                      ? "Veloe" 
                      : vehicle.cartaoCombustivel === "ticket" 
                      ? "Ticket" 
                      : "Veloe/Ticket"}
                  </Badge>
                </TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-1">
                    {vehicle.frota && (
                      <Badge className="bg-chart-4/10 text-chart-4 hover:bg-chart-4/20 text-xs">
                        Frota
                      </Badge>
                    )}
                    {vehicle.naOficina && (
                      <Badge className="bg-chart-3/10 text-chart-3 hover:bg-chart-3/20 text-xs">
                        Oficina
                      </Badge>
                    )}
                    {vehicle.paraRevisao && (
                      <Badge className="bg-chart-5/10 text-chart-5 hover:bg-chart-5/20 text-xs">
                        Revisão
                      </Badge>
                    )}
                    {!vehicle.frota && !vehicle.naOficina && !vehicle.paraRevisao && (
                      vehicle.colaboradorId ? (
                        <Badge className="bg-primary/10 text-primary hover:bg-primary/20 text-xs">
                          Em uso
                        </Badge>
                      ) : (
                        <Badge className="bg-accent/10 text-accent hover:bg-accent/20 text-xs">
                          Disponível
                        </Badge>
                      )
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  {vehicle.semParar ? (
                    <Badge className="bg-green-100/80 text-green-800 hover:bg-green-100 text-xs font-medium">
                      Sem Parar
                    </Badge>
                  ) : (
                    <span className="text-sm text-muted-foreground">Não</span>
                  )}
                </TableCell>
                <TableCell>
                  {colaboradorNome ? (
                    <Badge className="bg-primary/10 text-primary hover:bg-primary/20">
                      {colaboradorNome}
                    </Badge>
                  ) : (
                    <span className="text-sm font-medium text-accent">Disponível</span>
                  )}
                </TableCell>
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <MoreHorizontal className="h-4 w-4" />
                        <span className="sr-only">Abrir menu</span>
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => onEdit(vehicle)}>
                        <Edit className="mr-2 h-4 w-4" />
                        Editar
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      {vehicle.colaboradorId ? (
                        <DropdownMenuItem onClick={() => onUnassign(vehicle)}>
                          <UserMinus className="mr-2 h-4 w-4" />
                          Remover Colaborador
                        </DropdownMenuItem>
                      ) : (
                        <DropdownMenuItem onClick={() => onAssign(vehicle)}>
                          <UserPlus className="mr-2 h-4 w-4" />
                          Atribuir Colaborador
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        onClick={() => onDelete(vehicle.id)}
                        className="text-destructive focus:text-destructive"
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        Excluir
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </div>
  )
}
