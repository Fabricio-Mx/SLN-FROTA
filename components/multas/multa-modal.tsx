"use client"

import { useEffect, useMemo, useState, type FormEvent } from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  MULTA_COLABORADOR_STATUS_LABELS,
  MULTA_COLABORADOR_STATUS_OPTIONS,
  MULTA_GRAVIDADE_LABELS,
  MULTA_GRAVIDADE_OPTIONS,
  MULTA_GRAVIDADE_POINTS,
  MULTA_INDICACAO_STATUS_LABELS,
  MULTA_INDICACAO_STATUS_OPTIONS,
  MULTA_LOCADORA_OPTIONS,
  MULTA_RH_STATUS_OPTIONS,
  MULTA_RH_STATUS_LABELS,
  MULTA_STATUS_OPTIONS,
  MULTA_STATUS_LABELS,
  formatCurrency,
  getMultaTotalValue,
  normalizeMultaLocadora,
  fromDateTimeLocalValue,
  toDateTimeLocalValue,
} from "@/lib/multas"
import type { Colaborador, Multa, MultaFormData, Vehicle } from "@/lib/types"

const VEHICLE_MANUAL_VALUE = "manual"
const COLABORADOR_MANUAL_VALUE = "manual"

function inferColaboradorStatus(
  colaboradorId: string | null | undefined,
  condutor: string,
  colaboradores: Colaborador[]
): NonNullable<MultaFormData["colaboradorStatus"]> {
  if (colaboradorId && colaboradores.some((item) => item.id === colaboradorId)) {
    return "ativo"
  }

  const normalizedName = condutor.trim().toLowerCase()
  if (normalizedName && colaboradores.some((item) => item.nome.trim().toLowerCase() === normalizedName)) {
    return "ativo"
  }

  return "desligado"
}

const initialFormData: MultaFormData = {
  vehicleId: null,
  colaboradorId: null,
  dataHoraInfracao: new Date().toISOString(),
  placa: "",
  condutor: "",
  tipo: "",
  gravidade: "media",
  pontos: 4,
  autoInfracao: "",
  valor: 0,
  dataLimiteIndicar: "",
  status: "pendente",
  indicacaoStatus: "sim",
  colaboradorStatus: "ativo",
  statusEnviadoEm: null,
  rhStatus: "pendente",
  rhPagoEm: null,
  valorNic: null,
  valorTotalDesconto: null,
  locadora: "",
  observacoes: "",
}

type MultaModalProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  multa?: Multa | null
  vehicles: Vehicle[]
  colaboradores: Colaborador[]
  onSave: (data: MultaFormData) => Promise<void> | void
}

export function MultaModal({
  open,
  onOpenChange,
  multa,
  vehicles,
  colaboradores,
  onSave,
}: MultaModalProps) {
  const [formData, setFormData] = useState<MultaFormData>(initialFormData)
  const [errors, setErrors] = useState<Partial<Record<keyof MultaFormData, string>>>({})
  const [isSubmitting, setIsSubmitting] = useState(false)

  const sortedVehicles = useMemo(
    () => [...vehicles].sort((left, right) => left.placa.localeCompare(right.placa)),
    [vehicles]
  )
  const sortedColaboradores = useMemo(
    () => [...colaboradores].sort((left, right) => left.nome.localeCompare(right.nome)),
    [colaboradores]
  )
  const valorTotal = useMemo(
    () => getMultaTotalValue({ ...formData, id: "preview", createdAt: "", updatedAt: "" }),
    [formData]
  )
  const selectedLocadoraValue = useMemo(() => {
    return MULTA_LOCADORA_OPTIONS.some((option) => option.value === formData.locadora)
      ? formData.locadora
      : undefined
  }, [formData.locadora])
  const locadoraPreview = useMemo(() => {
    const formatted = normalizeMultaLocadora(formData.locadora)
    return formatted || "Não informada"
  }, [formData.locadora])

  useEffect(() => {
    if (multa) {
      setFormData({
        vehicleId: multa.vehicleId ?? null,
        colaboradorId: multa.colaboradorId ?? null,
        dataHoraInfracao: multa.dataHoraInfracao,
        placa: multa.placa,
        condutor: multa.condutor,
        tipo: multa.tipo,
        gravidade: multa.gravidade,
        pontos: multa.pontos,
        autoInfracao: multa.autoInfracao,
        valor: multa.valor,
        dataLimiteIndicar: multa.dataLimiteIndicar,
        status: multa.status,
        indicacaoStatus: multa.indicacaoStatus,
        colaboradorStatus: multa.colaboradorStatus ?? inferColaboradorStatus(multa.colaboradorId, multa.condutor, colaboradores),
        statusEnviadoEm: multa.statusEnviadoEm ?? null,
        rhStatus: multa.rhStatus,
        rhPagoEm: multa.rhPagoEm ?? null,
        valorNic: multa.valorNic ?? null,
        valorTotalDesconto: multa.valorTotalDesconto ?? null,
        locadora: normalizeMultaLocadora(multa.locadora),
        observacoes: multa.observacoes,
      })
    } else {
      setFormData(initialFormData)
    }

    setErrors({})
    setIsSubmitting(false)
  }, [colaboradores, multa, open])

  const handleVehicleChange = (value: string) => {
    if (value === VEHICLE_MANUAL_VALUE) {
      setFormData((current) => ({ ...current, vehicleId: null }))
      return
    }

    const vehicle = vehicles.find((item) => item.id === value)
    if (!vehicle) return

    setFormData((current) => ({
      ...current,
      vehicleId: vehicle.id,
      placa: vehicle.placa,
      locadora: current.locadora || normalizeMultaLocadora(vehicle.tipoPropriedade === "proprio" ? "Próprio" : vehicle.empresaLocacao),
    }))
  }

  const handleColaboradorChange = (value: string) => {
    if (value === COLABORADOR_MANUAL_VALUE) {
      setFormData((current) => ({ ...current, colaboradorId: null }))
      return
    }

    const colaborador = colaboradores.find((item) => item.id === value)
    if (!colaborador) return

    setFormData((current) => ({
      ...current,
      colaboradorId: colaborador.id,
      condutor: colaborador.nome,
      colaboradorStatus: "ativo",
    }))
  }

  const validateForm = () => {
    const nextErrors: Partial<Record<keyof MultaFormData, string>> = {}
    const placaRegex = /^[A-Z]{3}-?\d{4}$|^[A-Z]{3}\d[A-Z]\d{2}$/i

    if (!formData.dataHoraInfracao) {
      nextErrors.dataHoraInfracao = "Informe a data e hora da infração"
    } else if (Number.isNaN(new Date(formData.dataHoraInfracao).getTime())) {
      nextErrors.dataHoraInfracao = "Informe uma data e hora válidas"
    }

    if (!formData.placa.trim()) {
      nextErrors.placa = "Informe a placa"
    } else if (!placaRegex.test(formData.placa.replace("-", ""))) {
      nextErrors.placa = "Placa inválida"
    }

    if (!formData.tipo.trim()) {
      nextErrors.tipo = "Informe o tipo da multa"
    }

    if (!formData.locadora.trim()) {
      nextErrors.locadora = "Selecione a locadora"
    }

    if (!formData.autoInfracao.trim()) {
      nextErrors.autoInfracao = "Informe o auto de infração"
    }

    if (!formData.dataLimiteIndicar) {
      nextErrors.dataLimiteIndicar = "Informe a data-limite"
    }

    if (formData.pontos < 0) {
      nextErrors.pontos = "Pontos não podem ser negativos"
    }

    if (formData.valor < 0) {
      nextErrors.valor = "Valor não pode ser negativo"
    }

    if (typeof formData.valorNic === "number" && formData.valorNic < 0) {
      nextErrors.valorNic = "Valor NIC não pode ser negativo"
    }

    setErrors(nextErrors)
    return Object.keys(nextErrors).length === 0
  }

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    if (!validateForm()) return

    try {
      setIsSubmitting(true)
      await onSave({
        ...formData,
        placa: formData.placa.toUpperCase(),
        condutor: formData.condutor.trim(),
        locadora: normalizeMultaLocadora(formData.locadora.trim()),
        valorTotalDesconto: valorTotal,
      })
      onOpenChange(false)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[760px]">
        <DialogHeader>
          <DialogTitle>{multa ? "Editar multa" : "Adicionar multa"}</DialogTitle>
          <DialogDescription>
            Cadastre a infração, vincule ao veículo e acompanhe o prazo de indicação do condutor.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="grid gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 md:grid-cols-4">
            <div>
              <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-slate-500">Placa</p>
              <p className="mt-1 text-sm font-semibold text-slate-900">{formData.placa || "Não informada"}</p>
            </div>
            <div>
              <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-slate-500">Condutor</p>
              <p className="mt-1 text-sm font-semibold text-slate-900">{formData.condutor || "Não informado"}</p>
            </div>
            <div>
              <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-slate-500">Locadora</p>
              <p className="mt-1 text-sm font-semibold text-slate-900">{locadoraPreview}</p>
            </div>
            <div>
              <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-slate-500">Valor total</p>
              <p className="mt-1 text-sm font-semibold text-slate-900">{formatCurrency(valorTotal)}</p>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="grid gap-2 md:col-span-2">
              <Label htmlFor="vehicleId">Veículo vinculado</Label>
              <Select value={formData.vehicleId ?? VEHICLE_MANUAL_VALUE} onValueChange={handleVehicleChange}>
                <SelectTrigger id="vehicleId">
                  <SelectValue placeholder="Selecionar veículo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={VEHICLE_MANUAL_VALUE}>Informar placa manualmente</SelectItem>
                  {sortedVehicles.map((vehicle) => (
                    <SelectItem key={vehicle.id} value={vehicle.id}>
                      {vehicle.placa} - {vehicle.modelo}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="placa">Placa</Label>
              <Input
                id="placa"
                value={formData.placa}
                placeholder="ABC1D23"
                onChange={(event) => setFormData((current) => ({ ...current, placa: event.target.value.toUpperCase() }))}
              />
              {errors.placa ? <p className="text-sm text-destructive">{errors.placa}</p> : null}
            </div>

            <div className="grid gap-2">
              <Label htmlFor="locadora">Locadora / fornecedor</Label>
              <Select value={selectedLocadoraValue} onValueChange={(value) => setFormData((current) => ({ ...current, locadora: value }))}>
                <SelectTrigger id="locadora">
                  <SelectValue placeholder="Selecionar locadora" />
                </SelectTrigger>
                <SelectContent>
                  {MULTA_LOCADORA_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.locadora ? <p className="text-sm text-destructive">{errors.locadora}</p> : null}
            </div>

            <div className="grid gap-2 md:col-span-2">
              <Label htmlFor="colaboradorId">Condutor</Label>
              <Select value={formData.colaboradorId ?? COLABORADOR_MANUAL_VALUE} onValueChange={handleColaboradorChange}>
                <SelectTrigger id="colaboradorId">
                  <SelectValue placeholder="Selecionar colaborador" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={COLABORADOR_MANUAL_VALUE}>Informar condutor manualmente</SelectItem>
                  {sortedColaboradores.map((colaborador) => (
                    <SelectItem key={colaborador.id} value={colaborador.id}>
                      {colaborador.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2 md:col-span-2">
              <Input
                value={formData.condutor}
                placeholder="Nome do condutor indicado"
                onChange={(event) => setFormData((current) => ({ ...current, condutor: event.target.value }))}
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="colaboradorStatus">Status do colaborador</Label>
              <Select
                value={formData.colaboradorStatus ?? "ativo"}
                onValueChange={(value) =>
                  setFormData((current) => ({
                    ...current,
                    colaboradorStatus: value as NonNullable<MultaFormData["colaboradorStatus"]>,
                  }))
                }
              >
                <SelectTrigger id="colaboradorStatus">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MULTA_COLABORADOR_STATUS_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Situação do colaborador no momento da multa: {MULTA_COLABORADOR_STATUS_LABELS[formData.colaboradorStatus ?? "ativo"]}.
              </p>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="dataHoraInfracao">Data e hora da infração</Label>
              <Input
                id="dataHoraInfracao"
                type="datetime-local"
                value={toDateTimeLocalValue(formData.dataHoraInfracao)}
                onChange={(event) => setFormData((current) => ({ ...current, dataHoraInfracao: fromDateTimeLocalValue(event.target.value) }))}
              />
              {errors.dataHoraInfracao ? <p className="text-sm text-destructive">{errors.dataHoraInfracao}</p> : null}
            </div>

            <div className="grid gap-2">
              <Label htmlFor="dataLimiteIndicar">Data-limite para indicar</Label>
              <Input
                id="dataLimiteIndicar"
                type="date"
                value={formData.dataLimiteIndicar}
                onChange={(event) => setFormData((current) => ({ ...current, dataLimiteIndicar: event.target.value }))}
              />
              {errors.dataLimiteIndicar ? <p className="text-sm text-destructive">{errors.dataLimiteIndicar}</p> : null}
            </div>

            <div className="grid gap-2 md:col-span-2">
              <Label htmlFor="tipo">Tipo de multa</Label>
              <Input
                id="tipo"
                value={formData.tipo}
                placeholder="Excesso de velocidade, estacionamento proibido..."
                onChange={(event) => setFormData((current) => ({ ...current, tipo: event.target.value }))}
              />
              {errors.tipo ? <p className="text-sm text-destructive">{errors.tipo}</p> : null}
            </div>

            <div className="grid gap-2">
              <Label htmlFor="gravidade">Gravidade</Label>
              <Select
                value={formData.gravidade}
                onValueChange={(value) =>
                  setFormData((current) => ({
                    ...current,
                    gravidade: value as MultaFormData["gravidade"],
                    pontos: MULTA_GRAVIDADE_POINTS[value as MultaFormData["gravidade"]],
                  }))
                }
              >
                <SelectTrigger id="gravidade">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MULTA_GRAVIDADE_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {MULTA_GRAVIDADE_LABELS[formData.gravidade]} com sugestão de {MULTA_GRAVIDADE_POINTS[formData.gravidade]} pontos.
              </p>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="status">Status Frota</Label>
              <Select value={formData.status} onValueChange={(value) => setFormData((current) => ({ ...current, status: value as MultaFormData["status"] }))}>
                <SelectTrigger id="status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MULTA_STATUS_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">Fluxo operacional atual da frota: {MULTA_STATUS_LABELS[formData.status]}.</p>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="indicacaoStatus">Status indicação</Label>
              <Select
                value={formData.indicacaoStatus}
                onValueChange={(value) => setFormData((current) => ({ ...current, indicacaoStatus: value as MultaFormData["indicacaoStatus"] }))}
              >
                <SelectTrigger id="indicacaoStatus">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MULTA_INDICACAO_STATUS_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">Situação manual da indicação: {MULTA_INDICACAO_STATUS_LABELS[formData.indicacaoStatus]}.</p>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="rhStatus">Status RH</Label>
              <Select value={formData.rhStatus} onValueChange={(value) => setFormData((current) => ({ ...current, rhStatus: value as MultaFormData["rhStatus"] }))}>
                <SelectTrigger id="rhStatus">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MULTA_RH_STATUS_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">Baixa interna: {MULTA_RH_STATUS_LABELS[formData.rhStatus]}.</p>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="pontos">Pontos</Label>
              <Input
                id="pontos"
                type="number"
                min="0"
                value={formData.pontos}
                onChange={(event) => setFormData((current) => ({ ...current, pontos: Number(event.target.value) || 0 }))}
              />
              {errors.pontos ? <p className="text-sm text-destructive">{errors.pontos}</p> : null}
            </div>

            <div className="grid gap-2">
              <Label htmlFor="valor">Valor da multa</Label>
              <Input
                id="valor"
                type="number"
                min="0"
                step="0.01"
                value={formData.valor}
                onChange={(event) => setFormData((current) => ({ ...current, valor: Number(event.target.value) || 0 }))}
              />
              {errors.valor ? <p className="text-sm text-destructive">{errors.valor}</p> : null}
            </div>

            <div className="grid gap-2">
              <Label htmlFor="autoInfracao">Auto de infração</Label>
              <Input
                id="autoInfracao"
                value={formData.autoInfracao}
                onChange={(event) => setFormData((current) => ({ ...current, autoInfracao: event.target.value.toUpperCase() }))}
              />
              {errors.autoInfracao ? <p className="text-sm text-destructive">{errors.autoInfracao}</p> : null}
            </div>

            <div className="grid gap-2">
              <Label htmlFor="valorNic">Valor NIC</Label>
              <Input
                id="valorNic"
                type="number"
                min="0"
                step="0.01"
                value={formData.valorNic ?? ""}
                onChange={(event) => setFormData((current) => ({ ...current, valorNic: event.target.value === "" ? null : Number(event.target.value) }))}
              />
              {errors.valorNic ? <p className="text-sm text-destructive">{errors.valorNic}</p> : null}
            </div>

            <div className="grid gap-2 md:col-span-2">
              <Label htmlFor="valorTotal">Valor total</Label>
              <Input
                id="valorTotal"
                type="number"
                step="0.01"
                value={valorTotal}
                disabled
                readOnly
              />
              <p className="text-xs text-muted-foreground">Soma automática de Valor R$ + Valor NIC.</p>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Salvando..." : multa ? "Salvar alterações" : "Cadastrar multa"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}