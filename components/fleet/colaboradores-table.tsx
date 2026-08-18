"use client"

import { Download, Edit, FileText, Trash2 } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
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

function getCnhStatus(value: string) {
  if (!value) return null

  const vencimento = new Date(value)
  if (Number.isNaN(vencimento.getTime())) return null

  const hoje = new Date()
  const trintaDias = new Date(hoje.getTime() + 30 * 24 * 60 * 60 * 1000)
  const data = vencimento.toLocaleDateString("pt-BR")

  if (vencimento < hoje) {
    return { label: `${data} (Vencida)`, className: "text-destructive" }
  }

  if (vencimento <= trintaDias) {
    return { label: `${data} (Vencendo)`, className: "text-chart-3" }
  }

  return { label: data, className: "text-foreground" }
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
    <div className="rounded-lg border border-border bg-card">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted">
            <TableHead className="sticky left-0 z-30 min-w-[240px] bg-muted text-[0.88rem] font-semibold">
              Colaborador
            </TableHead>
            <TableHead className="min-w-[150px] text-[0.88rem] font-semibold">Contato</TableHead>
            <TableHead className="min-w-[140px] text-[0.88rem] font-semibold">Vínculo</TableHead>
            <TableHead className="min-w-[170px] text-[0.88rem] font-semibold">CNH</TableHead>
            <TableHead className="min-w-[200px] text-[0.88rem] font-semibold">Centro de Custo</TableHead>
            <TableHead className="min-w-[130px] text-[0.88rem] font-semibold">Veículo</TableHead>
            {canManage ? (
              <TableHead className="sticky right-0 z-30 w-[110px] bg-muted text-right text-[0.88rem] font-semibold">
                Ações
              </TableHead>
            ) : null}
          </TableRow>
        </TableHeader>
        <TableBody>
          {colaboradores.map((colaborador, index) => {
            const assignedVehicles = getVehiclesByColaborador(colaborador.id)
            const cellBg = index % 2 === 0 ? "bg-white" : "bg-[#fbfdf9]"
            const stickyClass = `sticky z-10 ${cellBg} group-hover:bg-[#deefd0]`
            const cnh = getCnhStatus(colaborador.dataVencimentoCNH)
            const cnhFile = colaborador.cnhArquivos?.[0]

            return (
              <TableRow key={colaborador.id} className={`group ${cellBg} hover:bg-[#deefd0]`}>
                <TableCell className={`${stickyClass} left-0`}>
                  <div className="space-y-0.5">
                    <p className="text-[0.95rem] font-medium leading-tight">{colaborador.nome}</p>
                    <p className="font-mono text-xs text-muted-foreground">{colaborador.cpf || "-"}</p>
                    {colaborador.email ? (
                      <p className="truncate text-xs text-muted-foreground">{colaborador.email}</p>
                    ) : null}
                  </div>
                </TableCell>
                <TableCell className="text-[0.92rem]">{colaborador.telefone || "-"}</TableCell>
                <TableCell>
                  <div className="flex flex-col items-start gap-1">
                    <span className="text-[0.9rem] text-muted-foreground">{colaborador.tipo || "-"}</span>
                    {colaborador.segmento ? (
                      <Badge variant="outline" className="text-[0.7rem]">
                        {colaborador.segmento}
                      </Badge>
                    ) : null}
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    {cnh ? (
                      <span className={`text-[0.92rem] font-medium ${cnh.className}`}>
                        {cnh.label}
                      </span>
                    ) : (
                      <span className="text-[0.92rem] text-muted-foreground">Sem CNH</span>
                    )}
                    {cnhFile ? (
                      <>
                        <a
                          href={`/api/drive/file/${cnhFile.id}`}
                          target="_blank"
                          rel="noreferrer"
                          title="Visualizar CNH"
                          className="text-muted-foreground hover:text-foreground"
                        >
                          <FileText className="h-4 w-4" />
                        </a>
                        <a
                          href={`/api/drive/file/${cnhFile.id}?download=1`}
                          title="Baixar CNH"
                          className="text-muted-foreground hover:text-foreground"
                        >
                          <Download className="h-4 w-4" />
                        </a>
                      </>
                    ) : null}
                  </div>
                </TableCell>
                <TableCell>
                  <span
                    className="block max-w-[240px] truncate text-[0.92rem] text-muted-foreground"
                    title={colaborador.centroCusto || undefined}
                  >
                    {colaborador.centroCusto || "-"}
                  </span>
                </TableCell>
                <TableCell>
                  {assignedVehicles.length > 0 ? (
                    <div className="flex flex-wrap items-center gap-1">
                      {assignedVehicles.map((v) => (
                        <Badge key={v.id} className="bg-primary/10 text-primary hover:bg-primary/20 text-xs">
                          {v.placa}
                        </Badge>
                      ))}
                      <span className="text-xs text-muted-foreground">
                        {(assignedVehicles[0].km ?? 0).toLocaleString("pt-BR")} km
                      </span>
                    </div>
                  ) : (
                    <span className="text-[0.92rem] text-muted-foreground">Sem veículo</span>
                  )}
                </TableCell>
                {canManage ? (
                  <TableCell className={`${stickyClass} right-0`}>
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-8 w-8"
                        title="Editar colaborador"
                        onClick={() => onEdit(colaborador)}
                      >
                        <Edit className="h-4 w-4" />
                        <span className="sr-only">Editar</span>
                      </Button>
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:text-destructive"
                        title={
                          assignedVehicles.length > 0
                            ? "Desvincule o veículo antes de excluir"
                            : "Excluir colaborador"
                        }
                        disabled={assignedVehicles.length > 0}
                        onClick={() => onDelete(colaborador.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                        <span className="sr-only">Excluir</span>
                      </Button>
                    </div>
                  </TableCell>
                ) : null}
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
      <div className="border-t border-border px-4 py-2 text-xs text-muted-foreground">
        {colaboradores.length} colaborador(es) listado(s)
      </div>
    </div>
  )
}
