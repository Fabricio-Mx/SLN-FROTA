"use client"

import { useMemo, useState } from "react"
import {
  AlertTriangle,
  Building2,
  CalendarClock,
  CalendarDays,
  Car,
  Check,
  CreditCard,
  Download,
  Eye,
  FileText,
  Gauge,
  History,
  IdCard,
  Loader2,
  Pencil,
  Plus,
  Trash2,
  UserRound,
  X,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useToast } from "@/hooks/use-toast"
import { useVehicleAssignments, type VehicleAssignment } from "@/hooks/use-vehicle-assignments"
import { getVehicleVisual } from "@/lib/vehicle-icons"
import type { Colaborador, DriveFile, Vehicle } from "@/lib/types"
import { cn } from "@/lib/utils"

const PREVIOUS_DRIVERS_VISIBLE = 3
const OTHER_COLABORADOR = "__outro__"

type VehicleDetailsDialogProps = {
  vehicle: Vehicle | null
  colaboradores: Colaborador[]
  cardPlate: string
  canManage: boolean
  onOpenChange: (open: boolean) => void
}

function normalizeName(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
}

export function findTermoDocumentos(colaborador: Colaborador | null | undefined): DriveFile[] {
  return (colaborador?.documentos ?? []).filter((doc) => normalizeName(doc.name || "").includes("TERMO"))
}

function formatDate(value: string | null | undefined): string {
  if (!value) return "—"
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleDateString("pt-BR")
}

function toDateInputValue(value: string | null | undefined): string {
  if (!value) return ""
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ""
  const month = `${date.getMonth() + 1}`.padStart(2, "0")
  const day = `${date.getDate()}`.padStart(2, "0")
  return `${date.getFullYear()}-${month}-${day}`
}

// Meio-dia local evita que a data "volte" um dia ao converter para UTC.
function fromDateInputValue(value: string): string | null {
  if (!value) return null
  const date = new Date(`${value}T12:00:00`)
  return Number.isNaN(date.getTime()) ? null : date.toISOString()
}

function getDurationLabel(start: string, end: string | null): string {
  const startDate = new Date(start)
  const endDate = end ? new Date(end) : new Date()
  const days = Math.max(0, Math.round((endDate.getTime() - startDate.getTime()) / 86_400_000))
  if (days < 1) return "menos de 1 dia"
  if (days < 60) return `${days} dia${days === 1 ? "" : "s"}`
  const months = Math.floor(days / 30)
  return `${months} ${months === 1 ? "mês" : "meses"}`
}

function getPropriedadeLabel(vehicle: Vehicle): string {
  const empresas: Record<string, string> = {
    localiza: "Localiza",
    lok_motors: "LOK MOTORS",
    movida: "4LOC",
    "4loc": "4LOC",
    veiculo_sln: "Veículo SLN",
    bradesco_financiamento: "Bradesco Financiamento",
    banco_pan: "BANCO PAN S.A.",
    banco_volkswagen: "BANCO VOLKSWAGEN S.A.",
    sisprime_cdc: "Sisprime do Brasil - CDC",
  }
  const origem = vehicle.tipoPropriedade === "alugado" ? vehicle.empresaLocacao : vehicle.fornecedorProprio
  const nome = origem ? empresas[origem] || origem : ""
  return `${vehicle.tipoPropriedade === "proprio" ? "Próprio" : "Alugado"}${nome ? ` · ${nome}` : ""}`
}

export function VehicleDetailsDialog({ vehicle, colaboradores, cardPlate, canManage, onOpenChange }: VehicleDetailsDialogProps) {
  return (
    <Dialog open={vehicle !== null} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto p-0 sm:max-w-4xl">
        {vehicle ? (
          <VehicleDetailsContent vehicle={vehicle} colaboradores={colaboradores} cardPlate={cardPlate} canManage={canManage} />
        ) : null}
      </DialogContent>
    </Dialog>
  )
}

function VehicleDetailsContent({
  vehicle,
  colaboradores,
  cardPlate,
  canManage,
}: {
  vehicle: Vehicle
  colaboradores: Colaborador[]
  cardPlate: string
  canManage: boolean
}) {
  const { assignments, isLoading, error, addAssignment, updateAssignmentDates, deleteAssignment } = useVehicleAssignments(vehicle.id)
  const { toast } = useToast()
  const [showAllPrevious, setShowAllPrevious] = useState(false)
  const [isAdding, setIsAdding] = useState(false)
  const [editingCurrentEntrega, setEditingCurrentEntrega] = useState<string | null>(null)
  const [isSavingCurrent, setIsSavingCurrent] = useState(false)
  const colaboradoresById = useMemo(() => new Map(colaboradores.map((item) => [item.id, item])), [colaboradores])
  const currentColaborador = vehicle.colaboradorId ? colaboradoresById.get(vehicle.colaboradorId) ?? null : null
  const visual = getVehicleVisual(vehicle.modelo)
  const VehicleIcon = visual.icon

  const openAssignment = assignments.find((item) => !item.dataRecolhimento) ?? null
  const previousAssignments = assignments.filter((item) => item.dataRecolhimento)
  const visiblePrevious = showAllPrevious ? previousAssignments : previousAssignments.slice(0, PREVIOUS_DRIVERS_VISIBLE)
  const vehicleFiles = [...(vehicle.imagens ?? []), ...(vehicle.checklists ?? [])]

  async function handleSaveCurrentEntrega(assignmentId: string) {
    const dataEntrega = editingCurrentEntrega ? fromDateInputValue(editingCurrentEntrega) : null
    if (!dataEntrega) {
      toast({ title: "Data inválida", description: "Informe a data de entrega.", variant: "destructive" })
      return
    }
    setIsSavingCurrent(true)
    try {
      await updateAssignmentDates(assignmentId, { dataEntrega, dataRecolhimento: null })
      setEditingCurrentEntrega(null)
      toast({ title: "Data de entrega atualizada" })
    } catch (saveError) {
      toast({
        title: "Erro ao salvar",
        description: saveError instanceof Error ? saveError.message : "Tente novamente.",
        variant: "destructive",
      })
    } finally {
      setIsSavingCurrent(false)
    }
  }

  return (
    <div>
      <DialogHeader className="space-y-0 border-b border-border bg-[linear-gradient(135deg,#f7faf5_0%,#eef5ea_100%)] px-6 py-5 text-left">
        <div className="flex items-start gap-4 pr-8">
          <span className={cn("flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border", visual.chipClass)}>
            <VehicleIcon className="h-6 w-6" />
          </span>
          <div className="min-w-0 flex-1">
            <DialogTitle className="flex flex-wrap items-center gap-2 text-xl">
              <span className="rounded-lg border-2 border-slate-800 bg-white px-2.5 py-0.5 text-lg font-black uppercase tracking-[0.1em] text-slate-900">
                {vehicle.placa}
              </span>
              <span className="font-bold text-slate-800">{vehicle.modelo}</span>
            </DialogTitle>
            <DialogDescription className="mt-2 flex flex-wrap gap-2 text-sm">
              <InfoChip icon={Building2}>{getPropriedadeLabel(vehicle)}</InfoChip>
              <InfoChip icon={Gauge}>{(vehicle.km ?? 0).toLocaleString("pt-BR")} km</InfoChip>
              <InfoChip icon={CreditCard}>
                {vehicle.cartaoCombustivel === "ticket" ? "Ticket" : vehicle.cartaoCombustivel === "ambos" ? "Veloe/Ticket" : "Veloe"}
                {cardPlate ? ` · ${cardPlate}` : ""}
              </InfoChip>
              {vehicle.renavan ? <InfoChip icon={IdCard}>Renavan {vehicle.renavan}</InfoChip> : null}
            </DialogDescription>
          </div>
        </div>
      </DialogHeader>

      <div className="space-y-6 px-6 py-5">
        <section className="space-y-3">
          <SectionTitle icon={UserRound} title="Condutor atual" />
          {currentColaborador ? (
            <div className="rounded-2xl border border-[#cfe3c4] bg-[#f6fbf3] p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-lg font-extrabold text-slate-900">{currentColaborador.nome}</p>
                  <p className="mt-0.5 flex items-center gap-1.5 text-sm text-slate-600">
                    <Building2 className="h-3.5 w-3.5" />
                    {currentColaborador.centroCusto || "Sem centro de custo"}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  {editingCurrentEntrega !== null && openAssignment ? (
                    <span className="inline-flex items-center gap-1.5">
                      <Input
                        type="date"
                        value={editingCurrentEntrega}
                        onChange={(event) => setEditingCurrentEntrega(event.target.value)}
                        className="h-8 w-[160px] bg-white"
                      />
                      <Button
                        size="sm"
                        className="h-8 bg-[#4e8f57] hover:bg-[#437c4b]"
                        disabled={isSavingCurrent}
                        onClick={() => void handleSaveCurrentEntrega(openAssignment.id)}
                      >
                        {isSavingCurrent ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                      </Button>
                      <Button size="sm" variant="ghost" className="h-8" onClick={() => setEditingCurrentEntrega(null)}>
                        <X className="h-4 w-4" />
                      </Button>
                    </span>
                  ) : openAssignment ? (
                    <Badge variant="outline" className="gap-1.5 border-[#b7d9a6] bg-white px-2.5 py-1 font-semibold text-[#2f6b25]">
                      <CalendarDays className="h-3.5 w-3.5" />
                      Entregue em {formatDate(openAssignment.dataEntrega)}
                      {openAssignment.origem === "carga_inicial" ? " (aprox.)" : ""}
                      {canManage ? (
                        <button
                          type="button"
                          className="ml-0.5 rounded p-0.5 text-[#2f6b25] hover:bg-[#e8f5e0]"
                          title="Corrigir data de entrega"
                          onClick={() => setEditingCurrentEntrega(toDateInputValue(openAssignment.dataEntrega))}
                        >
                          <Pencil className="h-3 w-3" />
                        </button>
                      ) : null}
                    </Badge>
                  ) : null}
                  {openAssignment ? (
                    <Badge variant="outline" className="border-slate-200 bg-white px-2.5 py-1 font-semibold text-slate-600">
                      há {getDurationLabel(openAssignment.dataEntrega, null)}
                    </Badge>
                  ) : null}
                  {currentColaborador.dataVencimentoCNH ? (
                    <Badge variant="outline" className="border-slate-200 bg-white px-2.5 py-1 font-semibold text-slate-600">
                      CNH vence {formatDate(currentColaborador.dataVencimentoCNH)}
                    </Badge>
                  ) : null}
                </div>
              </div>
              <TermoList colaborador={currentColaborador} className="mt-3" />
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-4 text-sm font-medium text-slate-600">
              Veículo disponível — sem condutor no momento.
            </div>
          )}
        </section>

        <section className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <SectionTitle
              icon={History}
              title="Condutores anteriores"
              hint={`Últimos ${PREVIOUS_DRIVERS_VISIBLE}, com data de entrega e recolhimento`}
            />
            {canManage && !error ? (
              <Button variant="outline" size="sm" onClick={() => setIsAdding((value) => !value)}>
                {isAdding ? <X className="mr-1.5 h-4 w-4" /> : <Plus className="mr-1.5 h-4 w-4" />}
                {isAdding ? "Cancelar" : "Registrar condutor anterior"}
              </Button>
            ) : null}
          </div>

          {error ? (
            <div className="flex items-start gap-2 rounded-xl border border-[#ecd08a] bg-[#fff8e1] p-3 text-sm text-[#7a5300]">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{error.message}</span>
            </div>
          ) : null}

          {isAdding && !error ? (
            <AddPreviousDriverForm
              colaboradores={colaboradores}
              onCancel={() => setIsAdding(false)}
              onSubmit={async (input) => {
                await addAssignment(input)
                setIsAdding(false)
              }}
            />
          ) : null}

          {isLoading ? (
            <div className="flex items-center gap-2 rounded-xl border border-border p-4 text-sm text-slate-600">
              <Loader2 className="h-4 w-4 animate-spin" />
              Carregando histórico...
            </div>
          ) : !error && previousAssignments.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-600">
              Nenhum condutor anterior registrado. A partir de agora, toda troca de condutor fica salva aqui automaticamente.
              {canManage ? " Você também pode registrar condutores antigos manualmente." : ""}
            </div>
          ) : (
            <ol className="relative space-y-3 border-l-2 border-[#dfe7d8] pl-5">
              {visiblePrevious.map((assignment, index) => (
                <AssignmentItem
                  key={assignment.id}
                  position={index + 1}
                  assignment={assignment}
                  colaborador={assignment.colaboradorId ? colaboradoresById.get(assignment.colaboradorId) ?? null : null}
                  canManage={canManage}
                  onSaveDates={(dates) => updateAssignmentDates(assignment.id, dates)}
                  onDelete={() => deleteAssignment(assignment.id)}
                />
              ))}
            </ol>
          )}

          {previousAssignments.length > PREVIOUS_DRIVERS_VISIBLE ? (
            <Button variant="ghost" size="sm" className="text-[#2f6b25]" onClick={() => setShowAllPrevious((value) => !value)}>
              {showAllPrevious ? "Mostrar só os últimos 3" : `Ver histórico completo (${previousAssignments.length})`}
            </Button>
          ) : null}
        </section>

        <section className="space-y-3">
          <SectionTitle icon={FileText} title="Documentos do veículo" hint="CRLV, fotos e checklists anexados na ficha" />
          {vehicleFiles.length === 0 ? (
            <p className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-600">Nenhum arquivo anexado ao veículo.</p>
          ) : (
            <div className="grid gap-2 sm:grid-cols-2">
              {vehicleFiles.map((file) => (
                <FileRow key={file.id} file={file} />
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  )
}

function InfoChip({ icon: Icon, children }: { icon: typeof Car; children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-[#dfe7d8] bg-white px-2.5 py-0.5 font-semibold text-slate-700">
      <Icon className="h-3.5 w-3.5 text-slate-500" />
      {children}
    </span>
  )
}

function SectionTitle({ icon: Icon, title, hint }: { icon: typeof Car; title: string; hint?: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#e8f2e1] text-[#3f7d32]">
        <Icon className="h-4 w-4" />
      </span>
      <div>
        <h4 className="text-[15px] font-bold text-slate-900">{title}</h4>
        {hint ? <p className="text-xs text-slate-500">{hint}</p> : null}
      </div>
    </div>
  )
}

function FileRow({ file, label }: { file: DriveFile; label?: string }) {
  return (
    <div className="flex items-center gap-2 rounded-lg border border-border bg-white px-3 py-2">
      <FileText className="h-4 w-4 shrink-0 text-violet-600" />
      <span className="min-w-0 flex-1 truncate text-sm font-medium text-slate-700" title={file.name}>
        {label ?? file.name}
      </span>
      <Button variant="ghost" size="icon" className="h-7 w-7 text-slate-500 hover:text-violet-700" asChild>
        <a href={`/api/drive/file/${file.id}`} target="_blank" rel="noreferrer" title="Visualizar">
          <Eye className="h-4 w-4" />
        </a>
      </Button>
      <Button variant="ghost" size="icon" className="h-7 w-7 text-slate-500 hover:text-violet-700" asChild>
        <a href={`/api/drive/file/${file.id}?download=1`} title="Baixar">
          <Download className="h-4 w-4" />
        </a>
      </Button>
    </div>
  )
}

function TermoList({ colaborador, className }: { colaborador: Colaborador | null; className?: string }) {
  const termos = findTermoDocumentos(colaborador)

  if (termos.length === 0) {
    return (
      <p className={cn("flex items-center gap-1.5 text-sm font-medium text-[#8a5a00]", className)}>
        <AlertTriangle className="h-4 w-4" />
        Nenhum termo de responsabilidade assinado anexado.
      </p>
    )
  }

  return (
    <div className={cn("space-y-1.5", className)}>
      <p className="text-xs font-bold uppercase tracking-[0.06em] text-slate-600">Termos assinados</p>
      <div className="grid gap-2 sm:grid-cols-2">
        {termos.map((termo) => (
          <FileRow key={termo.id} file={termo} />
        ))}
      </div>
    </div>
  )
}

function AssignmentItem({
  position,
  assignment,
  colaborador,
  canManage,
  onSaveDates,
  onDelete,
}: {
  position: number
  assignment: VehicleAssignment
  colaborador: Colaborador | null
  canManage: boolean
  onSaveDates: (dates: { dataEntrega: string; dataRecolhimento: string | null }) => Promise<void>
  onDelete: () => Promise<void>
}) {
  const { toast } = useToast()
  const [isEditing, setIsEditing] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [entrega, setEntrega] = useState(toDateInputValue(assignment.dataEntrega))
  const [recolhimento, setRecolhimento] = useState(toDateInputValue(assignment.dataRecolhimento))

  async function handleSave() {
    const dataEntrega = fromDateInputValue(entrega)
    if (!dataEntrega) {
      toast({ title: "Data inválida", description: "Informe a data de entrega.", variant: "destructive" })
      return
    }
    setIsSaving(true)
    try {
      await onSaveDates({ dataEntrega, dataRecolhimento: fromDateInputValue(recolhimento) })
      setIsEditing(false)
      toast({ title: "Datas atualizadas" })
    } catch (error) {
      toast({ title: "Erro ao salvar", description: error instanceof Error ? error.message : "Tente novamente.", variant: "destructive" })
    } finally {
      setIsSaving(false)
    }
  }

  async function handleDelete() {
    setIsSaving(true)
    try {
      await onDelete()
      toast({ title: "Registro removido" })
    } catch (error) {
      toast({ title: "Erro ao remover", description: error instanceof Error ? error.message : "Tente novamente.", variant: "destructive" })
      setIsSaving(false)
    }
  }

  return (
    <li className="relative">
      <span className="absolute -left-[31px] top-3 flex h-5 w-5 items-center justify-center rounded-full border-2 border-white bg-[#7b8ca3] text-[10px] font-black text-white">
        {position}
      </span>
      <div className="rounded-xl border border-border bg-white p-3.5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="font-bold text-slate-900">{assignment.colaboradorNome}</p>
            <p className="flex items-center gap-1.5 text-xs text-slate-600">
              <Building2 className="h-3 w-3" />
              {assignment.colaboradorCentroCusto || colaborador?.centroCusto || "Sem centro de custo"}
              {assignment.origem === "manual" ? (
                <Badge variant="outline" className="ml-1 h-4 border-slate-200 px-1.5 text-[10px] text-slate-500">
                  lançado manualmente
                </Badge>
              ) : null}
            </p>
          </div>
          {canManage && !isEditing ? (
            <div className="flex gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-slate-500"
                title="Editar datas"
                onClick={() => {
                  setEntrega(toDateInputValue(assignment.dataEntrega))
                  setRecolhimento(toDateInputValue(assignment.dataRecolhimento))
                  setIsEditing(true)
                }}
              >
                <Pencil className="h-3.5 w-3.5" />
              </Button>
              {assignment.origem === "manual" ? (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-slate-500 hover:text-destructive"
                  title="Remover registro"
                  disabled={isSaving}
                  onClick={() => void handleDelete()}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              ) : null}
            </div>
          ) : null}
        </div>

        {isEditing ? (
          <div className="mt-3 flex flex-wrap items-end gap-2">
            <div className="space-y-1">
              <Label className="text-xs">Entrega</Label>
              <Input type="date" value={entrega} onChange={(event) => setEntrega(event.target.value)} className="h-8 w-[160px]" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Recolhimento</Label>
              <Input type="date" value={recolhimento} onChange={(event) => setRecolhimento(event.target.value)} className="h-8 w-[160px]" />
            </div>
            <Button size="sm" className="h-8 bg-[#4e8f57] hover:bg-[#437c4b]" disabled={isSaving} onClick={() => void handleSave()}>
              {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
            </Button>
            <Button size="sm" variant="ghost" className="h-8" disabled={isSaving} onClick={() => setIsEditing(false)}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        ) : (
          <div className="mt-2.5 grid gap-2 text-sm sm:grid-cols-3">
            <DateCell label="Entrega" value={formatDate(assignment.dataEntrega)} km={assignment.kmEntrega} approx={assignment.origem === "carga_inicial"} />
            <DateCell label="Recolhimento" value={formatDate(assignment.dataRecolhimento)} km={assignment.kmRecolhimento} />
            <div className="rounded-lg bg-slate-50 px-2.5 py-1.5">
              <p className="text-[11px] font-bold uppercase tracking-[0.05em] text-slate-500">Período</p>
              <p className="font-semibold text-slate-800">{getDurationLabel(assignment.dataEntrega, assignment.dataRecolhimento)}</p>
            </div>
          </div>
        )}

        {assignment.observacao ? <p className="mt-2 text-xs italic text-slate-600">{assignment.observacao}</p> : null}

        {colaborador ? (
          <TermoList colaborador={colaborador} className="mt-3" />
        ) : (
          <p className="mt-2 text-xs text-slate-500">Colaborador sem cadastro ativo — termos indisponíveis.</p>
        )}
      </div>
    </li>
  )
}

function DateCell({ label, value, km, approx }: { label: string; value: string; km: number | null; approx?: boolean }) {
  return (
    <div className="rounded-lg bg-slate-50 px-2.5 py-1.5">
      <p className="flex items-center gap-1 text-[11px] font-bold uppercase tracking-[0.05em] text-slate-500">
        <CalendarClock className="h-3 w-3" />
        {label}
      </p>
      <p className="font-semibold text-slate-800">
        {value}
        {approx ? <span className="text-xs font-normal text-slate-500"> (aprox.)</span> : null}
      </p>
      {typeof km === "number" ? <p className="text-xs text-slate-500">{km.toLocaleString("pt-BR")} km</p> : null}
    </div>
  )
}

function AddPreviousDriverForm({
  colaboradores,
  onSubmit,
  onCancel,
}: {
  colaboradores: Colaborador[]
  onSubmit: (input: {
    colaboradorId: string | null
    colaboradorNome: string
    colaboradorCentroCusto: string | null
    dataEntrega: string
    dataRecolhimento: string | null
    observacao: string | null
  }) => Promise<void>
  onCancel: () => void
}) {
  const { toast } = useToast()
  const [colaboradorId, setColaboradorId] = useState("")
  const [nomeLivre, setNomeLivre] = useState("")
  const [entrega, setEntrega] = useState("")
  const [recolhimento, setRecolhimento] = useState("")
  const [observacao, setObservacao] = useState("")
  const [isSaving, setIsSaving] = useState(false)
  const sortedColaboradores = useMemo(
    () => [...colaboradores].sort((left, right) => left.nome.localeCompare(right.nome, "pt-BR")),
    [colaboradores],
  )

  async function handleSubmit() {
    const colaborador = colaboradorId && colaboradorId !== OTHER_COLABORADOR ? colaboradores.find((item) => item.id === colaboradorId) : null
    const nome = colaborador?.nome ?? nomeLivre.trim()
    const dataEntrega = fromDateInputValue(entrega)
    const dataRecolhimento = fromDateInputValue(recolhimento)

    if (!nome) {
      toast({ title: "Informe o condutor", variant: "destructive" })
      return
    }
    if (!dataEntrega || !dataRecolhimento) {
      toast({ title: "Informe as datas", description: "Entrega e recolhimento são obrigatórias para um condutor anterior.", variant: "destructive" })
      return
    }
    if (dataRecolhimento < dataEntrega) {
      toast({ title: "Datas inválidas", description: "O recolhimento não pode ser antes da entrega.", variant: "destructive" })
      return
    }

    setIsSaving(true)
    try {
      await onSubmit({
        colaboradorId: colaborador?.id ?? null,
        colaboradorNome: nome,
        colaboradorCentroCusto: colaborador?.centroCusto || null,
        dataEntrega,
        dataRecolhimento,
        observacao: observacao.trim() || null,
      })
      toast({ title: "Condutor anterior registrado" })
    } catch (error) {
      toast({ title: "Erro ao registrar", description: error instanceof Error ? error.message : "Tente novamente.", variant: "destructive" })
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="space-y-3 rounded-xl border border-[#cfe3c4] bg-[#f6fbf3] p-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5 sm:col-span-2">
          <Label>Condutor</Label>
          <Select value={colaboradorId} onValueChange={setColaboradorId}>
            <SelectTrigger className="bg-white">
              <SelectValue placeholder="Selecione o colaborador" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={OTHER_COLABORADOR}>Outro (digitar o nome)</SelectItem>
              {sortedColaboradores.map((colaborador) => (
                <SelectItem key={colaborador.id} value={colaborador.id}>
                  {colaborador.nome}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {colaboradorId === OTHER_COLABORADOR ? (
            <Input className="bg-white" placeholder="Nome do condutor" value={nomeLivre} onChange={(event) => setNomeLivre(event.target.value)} />
          ) : null}
        </div>
        <div className="space-y-1.5">
          <Label>Data de entrega</Label>
          <Input type="date" className="bg-white" value={entrega} onChange={(event) => setEntrega(event.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label>Data de recolhimento</Label>
          <Input type="date" className="bg-white" value={recolhimento} onChange={(event) => setRecolhimento(event.target.value)} />
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <Label>Observação (opcional)</Label>
          <Input className="bg-white" placeholder="Ex.: veículo devolvido com avaria no para-choque" value={observacao} onChange={(event) => setObservacao(event.target.value)} />
        </div>
      </div>
      <div className="flex justify-end gap-2">
        <Button variant="ghost" size="sm" onClick={onCancel} disabled={isSaving}>
          Cancelar
        </Button>
        <Button size="sm" className="bg-[#4e8f57] hover:bg-[#437c4b]" onClick={() => void handleSubmit()} disabled={isSaving}>
          {isSaving ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Check className="mr-1.5 h-4 w-4" />}
          Salvar registro
        </Button>
      </div>
    </div>
  )
}
