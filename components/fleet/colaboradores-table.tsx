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
  canManage?: boolean
  onEdit: (colaborador: Colaborador) => void
  onDelete: (id: string) => void
}

export function ColaboradoresTable({
  colaboradores,
  vehicles,
  canManage = true,
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
            <TableHead className="text-[0.88rem] font-semibold">Nome</TableHead>
            <TableHead className="text-[0.88rem] font-semibold">CPF</TableHead>
            <TableHead className="text-[0.88rem] font-semibold">Telefone</TableHead>
            <TableHead className="text-[0.88rem] font-semibold">Departamento</TableHead>
            <TableHead className="text-[0.88rem] font-semibold">Vencimento CNH</TableHead>
            <TableHead className="text-[0.88rem] font-semibold">Veículo</TableHead>
            <TableHead className="text-[0.88rem] font-semibold">KM</TableHead>
            {canManage ? <TableHead className="w-[70px]"></TableHead> : null}
          </TableRow>
        </TableHeader>
        <TableBody>
          {colaboradores.map((colaborador, index) => {
            const assignedVehicles = getVehiclesByColaborador(colaborador.id)
            const rowClass = index % 2 === 0 ? "bg-white hover:bg-[#e7f4dc]" : "bg-[#fbfdf9] hover:bg-[#deefd0]"

            return (
              <TableRow key={colaborador.id} className={rowClass}>
                <TableCell>
                  <div className="space-y-1">
                    <p className="text-[0.95rem] font-medium">{colaborador.nome}</p>
                    {colaborador.email ? <p className="text-xs text-muted-foreground">{colaborador.email}</p> : null}
                  </div>
                </TableCell>
                <TableCell className="font-mono text-[0.9rem] text-muted-foreground">
                  {colaborador.cpf}
                </TableCell>
                <TableCell>
                  <div className="space-y-1 text-[0.92rem]">
                    <p>{colaborador.telefone}</p>
                    {colaborador.cep ? <p className="text-xs text-muted-foreground">CEP: {colaborador.cep}</p> : null}
                  </div>
                </TableCell>
                <TableCell>
                  <div className="space-y-1">
                    <Badge variant="secondary">{colaborador.departamento}</Badge>
                    {colaborador.endereco ? (
                      <p className="max-w-[240px] truncate text-xs text-muted-foreground" title={colaborador.endereco}>
                        {colaborador.endereco}
                      </p>
                    ) : null}
                  </div>
                </TableCell>
                <TableCell>
                  {(() => {
                    const vencimento = new Date(colaborador.dataVencimentoCNH)
                    const hoje = new Date()
                    const trintaDias = new Date(hoje.getTime() + 30 * 24 * 60 * 60 * 1000)
                    const vencido = vencimento < hoje
                    const vencendo = vencimento <= trintaDias && vencimento >= hoje
                    
                    return (
                      <span className={`text-[0.92rem] font-medium ${vencido ? "text-destructive" : vencendo ? "text-chart-3" : "text-foreground"}`}>
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
                    <span className="text-[0.92rem] font-medium text-accent">
                      Sem veículo
                    </span>
                  )}
                </TableCell>
                <TableCell className="text-[0.9rem] text-muted-foreground">
                  {assignedVehicles.length > 0 ? (
                    <span>
                      {(assignedVehicles[0].km ?? 0).toLocaleString("pt-BR")} km
                    </span>
                  ) : (
                    <span>-</span>
                  )}
                </TableCell>
                {canManage ? (
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
                ) : null}
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </div>
  )
}
