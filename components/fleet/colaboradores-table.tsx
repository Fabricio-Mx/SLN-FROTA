"use client"

import { Edit, MoreHorizontal, Trash2 } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
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
import type { Colaborador, Vehicle } from "@/lib/types"

interface ColaboradoresTableProps {
  colaboradores: Colaborador[]
  vehicles: Vehicle[]
  onEdit: (colaborador: Colaborador) => void
  onDelete: (id: string) => void
}

export function ColaboradoresTable({
  colaboradores,
  vehicles,
  onEdit,
  onDelete,
}: ColaboradoresTableProps) {
  const getVehiclesByColaborador = (colaboradorId: string) => {
    return vehicles.filter((v) => v.colaboradorId === colaboradorId)
  }

  if (colaboradores.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border bg-card py-16">
        <p className="text-lg font-medium text-foreground">
          Nenhum colaborador encontrado
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          Adicione um novo colaborador para começar
        </p>
      </div>
    )
  }

  return (
    <div className="rounded-lg border border-border bg-card overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/50">
            <TableHead className="font-semibold">Nome</TableHead>
            <TableHead className="font-semibold">CPF</TableHead>
            <TableHead className="font-semibold">Telefone</TableHead>
            <TableHead className="font-semibold">Departamento</TableHead>
            <TableHead className="font-semibold">Vencimento CNH</TableHead>
            <TableHead className="font-semibold">Veículo</TableHead>
            <TableHead className="font-semibold">KM</TableHead>
            <TableHead className="w-[70px]"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {colaboradores.map((colaborador) => {
            const assignedVehicles = getVehiclesByColaborador(colaborador.id)

            return (
              <TableRow key={colaborador.id}>
                <TableCell className="font-medium">{colaborador.nome}</TableCell>
                <TableCell className="font-mono text-sm text-muted-foreground">
                  {colaborador.cpf}
                </TableCell>
                <TableCell className="text-sm">{colaborador.telefone}</TableCell>
                <TableCell>
                  <Badge variant="secondary">{colaborador.departamento}</Badge>
                </TableCell>
                <TableCell>
                  {(() => {
                    const vencimento = new Date(colaborador.dataVencimentoCNH)
                    const hoje = new Date()
                    const trintaDias = new Date(hoje.getTime() + 30 * 24 * 60 * 60 * 1000)
                    const vencido = vencimento < hoje
                    const vencendo = vencimento <= trintaDias && vencimento >= hoje
                    
                    return (
                      <span className={`text-sm font-medium ${vencido ? "text-destructive" : vencendo ? "text-chart-3" : "text-foreground"}`}>
                        {vencimento.toLocaleDateString("pt-BR")}
                        {vencido && " (Vencida)"}
                        {vencendo && " (Vencendo)"}
                      </span>
                    )
                  })()}
                </TableCell>
                <TableCell>
                  {assignedVehicles.length > 0 ? (
                    <div className="flex flex-wrap gap-1">
                      {assignedVehicles.map((v) => (
                        <Badge
                          key={v.id}
                          className="bg-primary/10 text-primary hover:bg-primary/20 text-xs"
                        >
                          {v.placa}
                        </Badge>
                      ))}
                    </div>
                  ) : (
                    <span className="text-sm font-medium text-accent">
                      Sem veículo
                    </span>
                  )}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {assignedVehicles.length > 0 ? (
                    <span>
                      {(assignedVehicles[0].km ?? 0).toLocaleString("pt-BR")} km
                    </span>
                  ) : (
                    <span>-</span>
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
                      <DropdownMenuItem onClick={() => onEdit(colaborador)}>
                        <Edit className="mr-2 h-4 w-4" />
                        Editar
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => onDelete(colaborador.id)}
                        className="text-destructive focus:text-destructive"
                        disabled={assignedVehicles.length > 0}
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
