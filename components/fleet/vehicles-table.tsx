"use client"

import { useEffect, useRef, useState } from "react"
import { Building2, CalendarClock, CreditCard, Download, Edit, Eye, FileSearch, Loader2, MoreHorizontal, Trash2, UserPlus, UserMinus } from "lucide-react"
import { VehicleDetailsDialog } from "@/components/fleet/vehicle-details-dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
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
import {
  formatReviewSchedule,
  fromReviewScheduleInputValue,
  getVehicleReviewMilestone,
  isReviewSchedulePast,
  isVehicleDueForReview,
  toReviewScheduleInputValue,
} from "@/lib/fleet-maintenance"
import { getVehicleVisual } from "@/lib/vehicle-icons"
import type { VehicleCardPlate } from "@/lib/driver-links-shared"
import type { Vehicle, Colaborador, DriveFile } from "@/lib/types"

interface VehiclesTableProps {
  vehicles: Vehicle[]
  colaboradores: Colaborador[]
  canManage?: boolean
  cardPlatesByVehicleId?: Map<string, VehicleCardPlate>
  onEdit: (vehicle: Vehicle) => void
  onDelete: (id: string) => void
  onAssign: (vehicle: Vehicle) => void
  onUnassign: (vehicle: Vehicle) => void
  onScheduleReview?: (vehicle: Vehicle, revisaoAgendadaEm: string | null) => Promise<boolean>
}

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString("pt-BR")
}

const HEAD_CLASS = "h-11 text-[0.72rem] font-bold uppercase tracking-[0.06em] text-slate-600"
const STATUS_BADGE_CLASS = "border px-2 py-0.5 text-[0.72rem] font-semibold shadow-none"

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

// Termo assinado que o colaborador envia em "Outros Documentos" (nome contem TERMO).
function findTermoDocumento(colaborador: Colaborador): DriveFile | null {
  const documentos = colaborador.documentos || []
  const matches = documentos.filter((doc) =>
    (doc.name || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toUpperCase()
      .includes("TERMO"),
  )

  return matches.length > 0 ? matches[matches.length - 1] : null
}

export function VehiclesTable({
  vehicles,
  colaboradores,
  canManage = true,
  cardPlatesByVehicleId,
  onEdit,
  onDelete,
  onAssign,
  onUnassign,
  onScheduleReview,
}: VehiclesTableProps) {
  const wrapperRef = useRef<HTMLDivElement | null>(null)
  const stickyScrollbarRef = useRef<HTMLDivElement | null>(null)
  const [stickyScrollWidth, setStickyScrollWidth] = useState(0)
  const [showStickyScrollbar, setShowStickyScrollbar] = useState(false)
  const [detailsVehicleId, setDetailsVehicleId] = useState<string | null>(null)
  const [scheduleVehicleId, setScheduleVehicleId] = useState<string | null>(null)
  const scheduleVehicle = scheduleVehicleId ? vehicles.find((item) => item.id === scheduleVehicleId) ?? null : null
  const canScheduleReview = canManage && Boolean(onScheduleReview)
  const detailsVehicle = detailsVehicleId ? vehicles.find((item) => item.id === detailsVehicleId) ?? null : null
  const detailsCardPlate = detailsVehicle
    ? detailsVehicle.placaCartaoCombustivel || cardPlatesByVehicleId?.get(detailsVehicle.id)?.cardPlate || ""
    : ""

  const getColaborador = (colaboradorId: string | null | undefined) => {
    if (!colaboradorId) return null
    return colaboradores.find((c) => c.id === colaboradorId) ?? null
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
          <TableRow className="border-b-2 border-[#dfe7d8] bg-[#f3f6f1] hover:bg-[#f3f6f1]">
            <TableHead className={`${HEAD_CLASS} text-left`}>Veículo</TableHead>
            <TableHead className={`${HEAD_CLASS} text-left`}>Modelo</TableHead>
            <TableHead className={`${HEAD_CLASS} text-center`}>KM</TableHead>
            <TableHead className={`${HEAD_CLASS} text-center`}>Próx. Revisão</TableHead>
            <TableHead className={`${HEAD_CLASS} text-center`}>Mensalidade</TableHead>
            <TableHead className={`${HEAD_CLASS} text-center`}>Vencimento</TableHead>
            <TableHead className={`${HEAD_CLASS} text-center`}>Status</TableHead>
            <TableHead className={`${HEAD_CLASS} text-center`}>Sem Parar</TableHead>
            <TableHead className={`${HEAD_CLASS} text-left`}>Origem</TableHead>
            <TableHead className={`${HEAD_CLASS} text-left`}>Cartão</TableHead>
            <TableHead className={`${HEAD_CLASS} min-w-[300px] text-left`}>Colaborador</TableHead>
            {canManage ? (
              <TableHead className="sticky right-0 z-10 w-[70px] bg-[#f3f6f1] text-center shadow-[-1px_0_0_hsl(var(--border))]"></TableHead>
            ) : null}
          </TableRow>
        </TableHeader>
        <TableBody>
          {vehicles.map((vehicle, index) => {
            const hasContractExpiry = Boolean(vehicle.dataVencimentoContrato)
            const expired = hasContractExpiry && isContractExpired(vehicle.dataVencimentoContrato)
            const expiring = hasContractExpiry && isContractExpiring(vehicle.dataVencimentoContrato)
            const colaborador = getColaborador(vehicle.colaboradorId)
            const colaboradorNome = colaborador?.nome ?? null
            const termoDoc = colaborador ? findTermoDocumento(colaborador) : null
            const cardPlateFromFuel = cardPlatesByVehicleId?.get(vehicle.id) ?? null
            const cardPlate = vehicle.placaCartaoCombustivel || cardPlateFromFuel?.cardPlate || ""
            const rowHighlightClass = getRowHighlightClass(expired, expiring, index)
            const reviewMilestone = getVehicleReviewMilestone(vehicle)
            const dueForReview = isVehicleDueForReview(vehicle)
            const reviewSchedule = formatReviewSchedule(vehicle.revisaoAgendadaEm)
            const [reviewScheduleDate, reviewScheduleTime] = reviewSchedule ? reviewSchedule.split(" às ") : [null, null]
            const reviewSchedulePast = isReviewSchedulePast(vehicle.revisaoAgendadaEm)
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
                      <div className="inline-flex rounded-md border border-slate-300 bg-white px-1.5 py-px text-[0.9rem] font-extrabold uppercase tracking-[0.08em] text-slate-900 shadow-[inset_0_-1px_0_rgba(15,23,42,0.08)]">
                        {vehicle.placa}
                      </div>
                      <div className="text-[0.74rem] text-muted-foreground">Renavam {vehicle.renavan || "-"}</div>
                    </div>
                  </div>
                </TableCell>
                <TableCell className="align-middle text-left text-[0.88rem] font-medium text-slate-700">
                  {vehicle.modelo}
                </TableCell>
                <TableCell className="align-middle text-center text-[0.88rem] font-medium tabular-nums text-slate-700">
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
                  {vehicle.tipoPropriedade === "proprio" && !(vehicle.mensalidade > 0) ? "-" : formatCurrency(vehicle.mensalidade)}
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
                  <div className="flex flex-wrap justify-center gap-1">
                    {vehicle.frota && (
                      <Badge variant="outline" className={`${STATUS_BADGE_CLASS} border-sky-200 bg-sky-50 text-sky-700`}>
                        Frota
                      </Badge>
                    )}
                    {vehicle.naOficina && (
                      <Badge variant="outline" className={`${STATUS_BADGE_CLASS} border-orange-200 bg-orange-50 text-orange-700`}>
                        Oficina
                      </Badge>
                    )}
                    {dueForReview && (
                      <Badge variant="outline" className={`${STATUS_BADGE_CLASS} border-rose-200 bg-rose-50 text-rose-700`}>
                        Revisão
                      </Badge>
                    )}
                    {!vehicle.frota && !vehicle.naOficina && !dueForReview && (
                      vehicle.colaboradorId ? (
                        <Badge variant="outline" className={`${STATUS_BADGE_CLASS} border-indigo-200 bg-indigo-50 text-indigo-700`}>
                          Em uso
                        </Badge>
                      ) : (
                        <Badge variant="outline" className={`${STATUS_BADGE_CLASS} border-emerald-200 bg-emerald-50 text-emerald-700`}>
                          Disponível
                        </Badge>
                      )
                    )}
                  </div>
                  {reviewSchedule ? (
                    <button
                      type="button"
                      disabled={!canScheduleReview}
                      onClick={() => setScheduleVehicleId(vehicle.id)}
                      title={reviewSchedulePast ? `Revisão agendada para ${reviewSchedule} (data já passou)` : `Revisão agendada para ${reviewSchedule}`}
                      className={`mx-auto mt-1 flex flex-col items-center rounded-md px-1.5 py-0.5 text-[0.7rem] leading-tight enabled:hover:bg-rose-50 disabled:cursor-default ${
                        reviewSchedulePast ? "text-slate-400" : "text-rose-700"
                      }`}
                    >
                      <span className="inline-flex items-center gap-1 font-semibold">
                        <CalendarClock className="h-3 w-3" />
                        {reviewScheduleDate}
                      </span>
                      <span className="font-medium">às {reviewScheduleTime}</span>
                    </button>
                  ) : null}
                </TableCell>
                <TableCell className="align-middle text-center">
                  {vehicle.semParar ? (
                    <Badge variant="outline" className={`${STATUS_BADGE_CLASS} border-emerald-200 bg-emerald-50 text-emerald-700`}>
                      Ativo
                    </Badge>
                  ) : (
                    <span className="text-[0.82rem] font-medium text-slate-400">Não</span>
                  )}
                </TableCell>
                <TableCell className="align-middle text-left">
                  <div className="space-y-1">
                    <Badge
                      variant="outline"
                      className={
                        vehicle.tipoPropriedade === "proprio"
                          ? `${STATUS_BADGE_CLASS} border-emerald-200 bg-emerald-50 text-emerald-700`
                          : `${STATUS_BADGE_CLASS} border-sky-200 bg-sky-50 text-sky-700`
                      }
                    >
                      {vehicle.tipoPropriedade === "proprio" ? "Próprio" : "Alugado"}
                    </Badge>
                    <div className="text-[0.74rem] text-muted-foreground">
                      {vehicle.tipoPropriedade === "alugado"
                        ? getEmpresaLocacaoNome(vehicle.empresaLocacao)
                        : getFornecedorProprioNome(vehicle.fornecedorProprio)}
                    </div>
                  </div>
                </TableCell>
                <TableCell className="align-middle text-left">
                  <div className="space-y-1">
                    <Badge variant="outline" className={`gap-1.5 ${STATUS_BADGE_CLASS} ${getCartaoBadgeClass(vehicle.cartaoCombustivel)}`}>
                      <CreditCard className="h-3.5 w-3.5" />
                      {getCartaoLabel(vehicle.cartaoCombustivel)}
                    </Badge>
                    {cardPlate ? (
                      <div
                        className="text-[0.82rem] font-extrabold uppercase tracking-[0.06em] text-foreground"
                        title={
                          vehicle.placaCartaoCombustivel
                            ? "Placa cadastrada no veículo"
                            : `Cartão usado por ${cardPlateFromFuel?.motorista} no combustível`
                        }
                      >
                        {cardPlate}
                      </div>
                    ) : (
                      <div className="text-[0.72rem] text-muted-foreground">placa não informada</div>
                    )}
                  </div>
                </TableCell>
                <TableCell className="align-middle text-left">
                  <div className="flex items-center gap-2.5">
                    <div className="min-w-0 flex-1">
                      {colaboradorNome ? (
                        <>
                          <p className="truncate text-[0.84rem] font-bold uppercase leading-tight text-slate-800" title={colaboradorNome}>
                            {colaboradorNome}
                          </p>
                          <p
                            className="mt-0.5 flex items-center gap-1 truncate text-[0.74rem] text-slate-500"
                            title={colaborador?.centroCusto || "Sem centro de custo"}
                          >
                            <Building2 className="h-3 w-3 shrink-0" />
                            <span className="truncate">{colaborador?.centroCusto || "Sem centro de custo"}</span>
                          </p>
                          <div className="mt-1 flex items-center gap-1">
                            {termoDoc ? (
                              <>
                                <span className="rounded border border-emerald-200 bg-emerald-50 px-1.5 text-[0.66rem] font-semibold uppercase text-emerald-700">
                                  Termo
                                </span>
                                <a
                                  href={`/api/drive/file/${termoDoc.id}`}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="rounded p-0.5 text-slate-500 hover:bg-violet-50 hover:text-violet-700"
                                  title={`Visualizar termo de responsabilidade (${termoDoc.name})`}
                                >
                                  <Eye className="h-3.5 w-3.5" />
                                  <span className="sr-only">Visualizar termo</span>
                                </a>
                                <a
                                  href={`/api/drive/file/${termoDoc.id}?download=1`}
                                  className="rounded p-0.5 text-slate-500 hover:bg-violet-50 hover:text-violet-700"
                                  title={`Baixar termo de responsabilidade (${termoDoc.name})`}
                                >
                                  <Download className="h-3.5 w-3.5" />
                                  <span className="sr-only">Baixar termo</span>
                                </a>
                              </>
                            ) : (
                              <span
                                className="rounded border border-amber-200 bg-amber-50 px-1.5 text-[0.66rem] font-semibold uppercase text-amber-700"
                                title="Nenhum termo de responsabilidade anexado na ficha do colaborador"
                              >
                                Sem termo
                              </span>
                            )}
                          </div>
                        </>
                      ) : (
                        <Badge variant="outline" className={`${STATUS_BADGE_CLASS} border-emerald-200 bg-emerald-50 text-emerald-700`}>
                          Disponível
                        </Badge>
                      )}
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 shrink-0 gap-1.5 border-[#cfe3c4] bg-white px-2.5 text-[0.76rem] font-semibold text-[#2f6b25] hover:bg-[#f1f8ec] hover:text-[#2f6b25]"
                      onClick={() => setDetailsVehicleId(vehicle.id)}
                      title="Ficha do veículo: termos assinados e histórico de condutores"
                    >
                      <FileSearch className="h-3.5 w-3.5" />
                      Ficha
                    </Button>
                  </div>
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
                        {canScheduleReview ? (
                          <DropdownMenuItem onClick={() => setScheduleVehicleId(vehicle.id)}>
                            <CalendarClock className="mr-2 h-4 w-4 text-rose-600" />
                            {vehicle.revisaoAgendadaEm ? "Alterar agendamento da revisão" : "Agendar revisão"}
                          </DropdownMenuItem>
                        ) : null}
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
      <VehicleDetailsDialog
        vehicle={detailsVehicle}
        colaboradores={colaboradores}
        cardPlate={detailsCardPlate}
        canManage={canManage}
        onOpenChange={(open) => {
          if (!open) setDetailsVehicleId(null)
        }}
      />
      {canScheduleReview && onScheduleReview ? (
        <ReviewScheduleDialog
          key={scheduleVehicle?.id ?? "closed"}
          vehicle={scheduleVehicle}
          onOpenChange={(open) => {
            if (!open) setScheduleVehicleId(null)
          }}
          onSave={async (revisaoAgendadaEm) => {
            if (!scheduleVehicle) return
            const saved = await onScheduleReview(scheduleVehicle, revisaoAgendadaEm)
            if (saved) setScheduleVehicleId(null)
          }}
        />
      ) : null}
    </div>
  )
}

function ReviewScheduleDialog({
  vehicle,
  onOpenChange,
  onSave,
}: {
  vehicle: Vehicle | null
  onOpenChange: (open: boolean) => void
  onSave: (revisaoAgendadaEm: string | null) => Promise<void>
}) {
  const [value, setValue] = useState(() => toReviewScheduleInputValue(vehicle?.revisaoAgendadaEm))
  const [saving, setSaving] = useState(false)
  const currentSchedule = formatReviewSchedule(vehicle?.revisaoAgendadaEm)

  const save = async (next: string | null) => {
    setSaving(true)
    try {
      await onSave(next)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={vehicle !== null} onOpenChange={(open) => !saving && onOpenChange(open)}>
      <DialogContent className="sm:max-w-[420px]">
        <DialogHeader>
          <DialogTitle>Agendar revisão</DialogTitle>
          <DialogDescription>
            Veículo <span className="font-semibold text-foreground">{vehicle?.placa}</span>
            {vehicle?.modelo ? ` — ${vehicle.modelo}` : ""}. A data e hora aparecem abaixo do status na lista da frota.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-1.5 py-1">
          <Label htmlFor="review-schedule-input">Data e hora da revisão</Label>
          <Input id="review-schedule-input" type="datetime-local" value={value} onChange={(event) => setValue(event.target.value)} />
          {currentSchedule ? <p className="text-xs text-muted-foreground">Agendamento atual: {currentSchedule}</p> : null}
        </div>
        <DialogFooter className="gap-2 sm:justify-between">
          {vehicle?.revisaoAgendadaEm ? (
            <Button type="button" variant="ghost" className="text-destructive hover:text-destructive" disabled={saving} onClick={() => void save(null)}>
              Remover agendamento
            </Button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <Button type="button" variant="outline" disabled={saving} onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button
              type="button"
              disabled={saving || !fromReviewScheduleInputValue(value)}
              onClick={() => void save(fromReviewScheduleInputValue(value))}
            >
              {saving ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <CalendarClock className="mr-1.5 h-4 w-4" />}
              Salvar agendamento
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
