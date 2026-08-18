"use client"

import { useEffect, useRef, useState } from "react"
import { CreditCard, Edit, MoreHorizontal, Trash2, UserPlus, UserMinus } from "lucide-react"
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
import { getVehicleReviewMilestone, isVehicleDueForReview } from "@/lib/fleet-maintenance"
import { getVehicleVisual } from "@/lib/vehicle-icons"
import type { Vehicle, Colaborador } from "@/lib/types"

interface VehiclesTableProps {
  vehicles: Vehicle[]
  colaboradores: Colaborador[]
  canManage?: boolean
  onEdit: (vehicle: Vehicle) => void
  onDelete: (id: string) => void
  onAssign: (vehicle: Vehicle) => void
  onUnassign: (vehicle: Vehicle) => void
}

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString("pt-BR")
}

function isContractExpiring(dateString: string): boolean {
  if (!dateString) return false
  const vencimento = new Date(dateString)
  if (Number.isNaN(vencimento.getTime())) return false
  const today = new Date()
  const thirtyDaysFromNow = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000)
  return vencimento <= thirtyDaysFromNow
}

function isContractExpired(dateString: string): boolean {
  if (!dateString) return false
  const vencimento = new Date(dateString)
  if (Number.isNaN(vencimento.getTime())) return false
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
    movida: "4LOC",
    "4loc": "4LOC",
    veiculo_sln: "Veículo SLN",
  }
  return empresa ? nomes[empresa] || empresa : "-"
}

function getFornecedorProprioNome(fornecedor: string | null | undefined): string {
  const nomes: Record<string, string> = {
    veiculo_sln: "Veículo SLN",
    bradesco_financiamento: "Bradesco Financiamento",
    banco_pan: "BANCO PAN S.A.",
    banco_volkswagen: "BANCO VOLKSWAGEN S.A.",
    sisprime_cdc: "Sisprime do Brasil - CDC",
  }

  return fornecedor ? nomes[fornecedor] || fornecedor : "-"
}

function getRowHighlightClass(expired: boolean, expiring: boolean, index: number): string {
  const defaultHoverClass = index % 2 === 0 ? "bg-white hover:bg-[#e7f4dc]" : "bg-[#fbfdf9] hover:bg-[#deefd0]"

  if (expired) {
    return "bg-red-50/70 hover:bg-[#e7f4dc]"
  }

  if (expiring) {
    return "bg-amber-50/60 hover:bg-[#deefd0]"
  }

  return defaultHoverClass
}

function getCartaoBadgeClass(cartao: Vehicle["cartaoCombustivel"]): string {
  if (cartao === "veloe") {
    return "border-violet-200 bg-violet-100 text-violet-700 hover:bg-violet-100"
  }

  if (cartao === "ticket") {
    return "border-sky-200 bg-sky-100 text-sky-700 hover:bg-sky-100"
  }

  return "border-fuchsia-200 bg-fuchsia-100 text-fuchsia-700 hover:bg-fuchsia-100"
}

function getCartaoLabel(cartao: Vehicle["cartaoCombustivel"]): string {
  if (cartao === "veloe") return "Veloe"
  if (cartao === "ticket") return "Ticket"
  return "Veloe/Ticket"
}

export function VehiclesTable({ vehicles, colaboradores, canManage = true, onEdit, onDelete, onAssign, onUnassign }: VehiclesTableProps) {
  const wrapperRef = useRef<HTMLDivElement | null>(null)
  const stickyScrollbarRef = useRef<HTMLDivElement | null>(null)
  const [stickyScrollWidth, setStickyScrollWidth] = useState(0)
  const [showStickyScrollbar, setShowStickyScrollbar] = useState(false)

  const getColaboradorName = (colaboradorId: string | null | undefined) => {
    if (!colaboradorId) return null
    const colaborador = colaboradores.find((c) => c.id === colaboradorId)
    return colaborador ? colaborador.nome : null
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
    if (tableElement) {
      resizeObserver.observe(tableElement)
    }

    window.addEventListener("resize", syncMetrics)

    return () => {
      tableContainer.removeEventListener("scroll", handleTableScroll)
      stickyScrollbarElement.removeEventListener("scroll", handleStickyScroll)
      resizeObserver.disconnect()
      window.removeEventListener("resize", syncMetrics)
    }
  }, [vehicles.length, canManage])

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
    <div ref={wrapperRef} className="space-y-2">
      <div className="table-scroll-hidden overflow-hidden rounded-lg border border-border bg-card">
        <Table className="min-w-[1380px]">
        <TableHeader>
          <TableRow className="bg-muted/50">
            <TableHead className="text-[0.88rem] font-semibold text-left">Veículo</TableHead>
            <TableHead className="text-[0.88rem] font-semibold text-left">Modelo</TableHead>
            <TableHead className="text-[0.88rem] font-semibold text-center">KM</TableHead>
            <TableHead className="text-[0.88rem] font-semibold text-center">Próx. Revisão</TableHead>
            <TableHead className="text-[0.88rem] font-semibold text-center">Mensalidade</TableHead>
            <TableHead className="text-[0.88rem] font-semibold text-center">Vencimento</TableHead>
            <TableHead className="text-[0.88rem] font-semibold text-center">Status</TableHead>
            <TableHead className="text-[0.88rem] font-semibold text-center">Sem Parar</TableHead>
            <TableHead className="text-[0.88rem] font-semibold text-left">Origem</TableHead>
            <TableHead className="text-[0.88rem] font-semibold text-left">Cartão</TableHead>
            <TableHead className="text-[0.88rem] font-semibold text-left">Colaborador</TableHead>
            {canManage ? (
              <TableHead className="sticky right-0 z-10 w-[70px] bg-muted/50 text-center shadow-[-1px_0_0_hsl(var(--border))]"></TableHead>
            ) : null}
          </TableRow>
        </TableHeader>
        <TableBody>
          {vehicles.map((vehicle, index) => {
            const hasContractExpiry = vehicle.tipoPropriedade === "alugado" && Boolean(vehicle.dataVencimentoContrato)
            const expired = hasContractExpiry && isContractExpired(vehicle.dataVencimentoContrato)
            const expiring = hasContractExpiry && isContractExpiring(vehicle.dataVencimentoContrato)
            const colaboradorNome = getColaboradorName(vehicle.colaboradorId)
            const rowHighlightClass = getRowHighlightClass(expired, expiring, index)
            const reviewMilestone = getVehicleReviewMilestone(vehicle)
            const dueForReview = isVehicleDueForReview(vehicle)
            const vehicleVisual = getVehicleVisual(vehicle.modelo)
            const VehicleIcon = vehicleVisual.icon
            const stickyActionClass = expired
              ? "bg-red-50/70 group-hover:bg-[#e7f4dc]"
              : expiring
              ? "bg-amber-50/60 group-hover:bg-[#deefd0]"
              : index % 2 === 0
              ? "bg-white group-hover:bg-[#e7f4dc]"
              : "bg-[#fbfdf9] group-hover:bg-[#deefd0]"

            return (
              <TableRow key={vehicle.id} className={`group ${rowHighlightClass}`}>
                <TableCell className="align-middle text-left">
                  <div className="flex items-center gap-2.5">
                    <span
                      title={vehicleVisual.label}
                      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border ${vehicleVisual.chipClass}`}
                    >
                      <VehicleIcon className="h-4 w-4" />
                    </span>
                    <div className="space-y-1">
                      <div className="font-mono text-[0.95rem] font-semibold text-foreground">{vehicle.placa}</div>
                      <div className="text-[0.78rem] text-muted-foreground">Renavan: {vehicle.renavan || "-"}</div>
                    </div>
                  </div>
                </TableCell>
                <TableCell className="align-middle text-left text-[0.92rem]">
                  {vehicle.modelo}
                </TableCell>
                <TableCell className="align-middle text-center text-[0.9rem] text-muted-foreground">
                  {(vehicle.km ?? 0).toLocaleString("pt-BR")} km
                </TableCell>
                <TableCell className="align-middle text-center">
                  {reviewMilestone.proximaRevisaoKm !== null ? (
                    <div className="space-y-1 text-[0.9rem]">
                      <div className={reviewMilestone.emAtraso ? "font-medium text-destructive" : "font-medium text-foreground"}>
                        {reviewMilestone.proximaRevisaoKm.toLocaleString("pt-BR")} km
                      </div>
                      <div className="text-[0.78rem] text-muted-foreground">
                        Última: {vehicle.kmUltimaRevisao?.toLocaleString("pt-BR")} km
                      </div>
                      <div className={reviewMilestone.emAtraso ? "text-[0.78rem] font-medium text-destructive" : "text-[0.78rem] text-muted-foreground"}>
                        {reviewMilestone.emAtraso
                          ? `Atrasada em ${Math.abs(reviewMilestone.kmRestante ?? 0).toLocaleString("pt-BR")} km`
                          : `Faltam ${(reviewMilestone.kmRestante ?? 0).toLocaleString("pt-BR")} km`}
                      </div>
                    </div>
                  ) : (
                    <span className="text-[0.8rem] text-muted-foreground">Não informado</span>
                  )}
                </TableCell>
                <TableCell className="align-middle text-center text-[0.92rem] font-medium">
                  {vehicle.tipoPropriedade === "proprio" ? "-" : formatCurrency(vehicle.mensalidade)}
                </TableCell>
                <TableCell className="align-middle text-center">
                  {hasContractExpiry ? (
                    <>
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
                        <Badge variant="destructive" className="ml-2 text-[0.76rem]">
                          Vencido
                        </Badge>
                      )}
                      {!expired && expiring && (
                        <Badge className="ml-2 bg-chart-3/10 text-chart-3 hover:bg-chart-3/20 text-[0.76rem]">
                          Vencendo
                        </Badge>
                      )}
                    </>
                  ) : (
                    <span className="text-[0.9rem] text-muted-foreground">-</span>
                  )}
                </TableCell>
                <TableCell className="align-middle text-center">
                  <div className="flex flex-wrap gap-1">
                    {vehicle.frota && (
                      <Badge className="bg-chart-4/10 text-chart-4 hover:bg-chart-4/20 text-[0.76rem]">
                        Frota
                      </Badge>
                    )}
                    {vehicle.naOficina && (
                      <Badge className="bg-chart-3/10 text-chart-3 hover:bg-chart-3/20 text-[0.76rem]">
                        Oficina
                      </Badge>
                    )}
                    {dueForReview && (
                      <Badge className="bg-chart-5/10 text-chart-5 hover:bg-chart-5/20 text-[0.76rem]">
                        Revisão
                      </Badge>
                    )}
                    {!vehicle.frota && !vehicle.naOficina && !dueForReview && (
                      vehicle.colaboradorId ? (
                        <Badge className="bg-primary/10 text-primary hover:bg-primary/20 text-[0.76rem]">
                          Em uso
                        </Badge>
                      ) : (
                        <Badge className="bg-accent/10 text-accent hover:bg-accent/20 text-[0.76rem]">
                          Disponível
                        </Badge>
                      )
                    )}
                  </div>
                </TableCell>
                <TableCell className="align-middle text-center">
                  {vehicle.semParar ? (
                    <Badge className="bg-green-100/80 text-green-800 hover:bg-green-100 text-[0.76rem] font-medium">
                      Ativo
                    </Badge>
                  ) : (
                    <span className="text-[0.9rem] font-medium text-muted-foreground">Não</span>
                  )}
                </TableCell>
                <TableCell className="align-middle text-left">
                  <div className="space-y-2">
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
                    <div className="text-[0.78rem] text-muted-foreground">
                      {vehicle.tipoPropriedade === "alugado"
                        ? getEmpresaLocacaoNome(vehicle.empresaLocacao)
                        : getFornecedorProprioNome(vehicle.fornecedorProprio)}
                    </div>
                  </div>
                </TableCell>
                <TableCell className="align-middle text-left">
                  <div className="space-y-2">
                    <Badge variant="outline" className={`gap-1.5 font-medium ${getCartaoBadgeClass(vehicle.cartaoCombustivel)}`}>
                      <CreditCard className="h-3.5 w-3.5" />
                      {getCartaoLabel(vehicle.cartaoCombustivel)}
                    </Badge>
                    {vehicle.placaCartaoCombustivel ? (
                      <div className="text-[0.78rem] font-medium text-foreground">
                        {vehicle.placaCartaoCombustivel}
                      </div>
                    ) : null}
                  </div>
                </TableCell>
                <TableCell className="align-middle text-left">
                  {colaboradorNome ? (
                    <Badge className="bg-primary/10 text-primary hover:bg-primary/20">
                      {colaboradorNome}
                    </Badge>
                  ) : (
                    <span className="text-[0.9rem] font-medium text-accent">Disponível</span>
                  )}
                </TableCell>
                {canManage ? (
                  <TableCell className={`sticky right-0 z-10 align-middle text-center shadow-[-1px_0_0_hsl(var(--border))] ${stickyActionClass}`}>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-600 hover:text-violet-700">
                          <MoreHorizontal className="h-4 w-4" />
                          <span className="sr-only">Abrir menu</span>
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => onEdit(vehicle)}>
                          <Edit className="mr-2 h-4 w-4 text-sky-600" />
                          Editar
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        {vehicle.colaboradorId ? (
                          <DropdownMenuItem onClick={() => onUnassign(vehicle)}>
                            <UserMinus className="mr-2 h-4 w-4 text-amber-600" />
                            Remover Colaborador
                          </DropdownMenuItem>
                        ) : (
                          <DropdownMenuItem onClick={() => onAssign(vehicle)}>
                            <UserPlus className="mr-2 h-4 w-4 text-emerald-600" />
                            Atribuir Colaborador
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          onClick={() => onDelete(vehicle.id)}
                          className="text-destructive focus:text-destructive"
                        >
                          <Trash2 className="mr-2 h-4 w-4 text-destructive" />
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
        <div className="border-t border-border px-4 py-2 text-xs text-muted-foreground">
          {vehicles.length} veículo(s) listado(s)
        </div>
      </div>
      <div className={`sticky bottom-3 z-20 transition-opacity ${showStickyScrollbar ? "opacity-100" : "pointer-events-none opacity-0"}`}>
        <div
          ref={stickyScrollbarRef}
          className="overflow-x-auto rounded-full border border-border bg-background/95 shadow-[0_8px_24px_rgba(15,23,42,0.12)] supports-[backdrop-filter]:bg-background/85"
          aria-label="Rolagem horizontal fixa da tabela"
        >
          <div style={{ width: `${stickyScrollWidth}px` }} className="h-3" />
        </div>
      </div>
    </div>
  )
}
