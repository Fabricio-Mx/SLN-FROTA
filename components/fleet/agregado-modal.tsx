"use client"

import { useEffect, useState, type FormEvent } from "react"
import { CalendarDays, CircleDollarSign, FileText, UserSquare2 } from "lucide-react"
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { toast } from "@/hooks/use-toast"
import type { Vehicle, VehicleFormData } from "@/lib/types"

function calculateDays(startDate: string, endDate: string): number | null {
  if (!startDate || !endDate) return null

  const [startYear, startMonth, startDay] = startDate.split("-").map(Number)
  const [endYear, endMonth, endDay] = endDate.split("-").map(Number)

  if (!startYear || !startMonth || !startDay || !endYear || !endMonth || !endDay) {
    return null
  }

  const start = new Date(startYear, startMonth - 1, startDay)
  const end = new Date(endYear, endMonth - 1, endDay)
  const differenceInDays = Math.round((end.getTime() - start.getTime()) / 86_400_000) + 1

  return differenceInDays > 0 ? differenceInDays : null
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value)
}

interface AgregadoModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  vehicle?: Vehicle | null
  onSave: (data: VehicleFormData) => void
}

const initialFormData: VehicleFormData = {
  placa: "",
  chassi: "",
  modelo: "",
  km: 0,
  kmUltimaRevisao: null,
  mensalidade: 0,
  dataVencimentoContrato: "",
  tipoPropriedade: "proprio",
  empresaLocacao: null,
  cartaoCombustivel: "veloe",
  frota: false,
  naOficina: false,
  paraRevisao: false,
  semParar: false,
  tipoContratacao: null,
  cpfAgregado: null,
  dataVencimentoCNHAgregado: null,
  agregadoColaboradorNome: null,
  agregadoFuncao: null,
  agregadoContrato: "ASSINADO",
  agregadoCentroCusto: null,
  agregadoAnoModelo: null,
  agregadoDataInicial: null,
  agregadoDias: null,
  colaboradorId: null,
}

type AgregadoFormErrors = Partial<Record<
  | "placa"
  | "modelo"
  | "mensalidade"
  | "agregadoColaboradorNome"
  | "agregadoFuncao"
  | "agregadoContrato"
  | "agregadoCentroCusto"
  | "agregadoAnoModelo"
  | "agregadoDataInicial"
  | "dataVencimentoContrato"
  | "agregadoDias",
  string
>>

export function AgregadoModal({
  open,
  onOpenChange,
  vehicle,
  onSave,
}: AgregadoModalProps) {
  const [formData, setFormData] = useState<VehicleFormData>(initialFormData)
  const [errors, setErrors] = useState<AgregadoFormErrors>({})
  const [uploadingContrato, setUploadingContrato] = useState(false)

  useEffect(() => {
    if (vehicle) {
      setFormData({
        placa: vehicle.placa || "",
        chassi: vehicle.chassi || "",
        modelo: vehicle.modelo || "",
        km: vehicle.km ?? 0,
        kmUltimaRevisao: vehicle.kmUltimaRevisao ?? null,
        mensalidade: vehicle.mensalidade ?? 0,
        dataVencimentoContrato: vehicle.dataVencimentoContrato || "",
        tipoPropriedade: vehicle.tipoPropriedade || "proprio",
        empresaLocacao: vehicle.empresaLocacao || null,
        cartaoCombustivel: vehicle.cartaoCombustivel || "veloe",
        frota: false,
        naOficina: vehicle.naOficina ?? false,
        paraRevisao: vehicle.paraRevisao ?? false,
        semParar: vehicle.semParar ?? false,
        tipoContratacao: vehicle.tipoContratacao || null,
        cpfAgregado: vehicle.cpfAgregado || null,
        dataVencimentoCNHAgregado: vehicle.dataVencimentoCNHAgregado || null,
        agregadoColaboradorNome: vehicle.agregadoColaboradorNome ?? vehicle.cpfAgregado ?? null,
        agregadoFuncao: vehicle.agregadoFuncao ?? vehicle.tipoContratacao ?? null,
        agregadoContrato: vehicle.agregadoContrato ?? (vehicle.checklists?.length ? "ASSINADO" : "PENDENTE"),
        agregadoCentroCusto: vehicle.agregadoCentroCusto ?? vehicle.empresaLocacao ?? null,
        agregadoAnoModelo: vehicle.agregadoAnoModelo ?? vehicle.chassi ?? null,
        agregadoDataInicial: vehicle.agregadoDataInicial ?? vehicle.dataVencimentoCNHAgregado ?? null,
        agregadoDias: vehicle.agregadoDias ?? vehicle.km ?? null,
        colaboradorId: vehicle.colaboradorId || null,
        checklists: vehicle.checklists || [],
      })
    } else {
      setFormData(initialFormData)
    }

    setErrors({})
  }, [vehicle, open])

  const validateForm = (): boolean => {
    const newErrors: AgregadoFormErrors = {}
    const placaRegex = /^[A-Z]{3}-?\d{4}$|^[A-Z]{3}\d[A-Z]\d{2}$/i

    if (!formData.placa) {
      newErrors.placa = "Placa é obrigatória"
    } else if (!placaRegex.test(formData.placa.replace("-", ""))) {
      newErrors.placa = "Formato inválido (ex: ABC-1234 ou ABC1D23)"
    }

    if (!formData.modelo.trim()) {
      newErrors.modelo = "Veículo é obrigatório"
    }

    if (!formData.agregadoColaboradorNome?.trim()) {
      newErrors.agregadoColaboradorNome = "Informe o colaborador"
    }

    if (!formData.agregadoFuncao?.trim()) {
      newErrors.agregadoFuncao = "Informe a função"
    }

    if (!formData.agregadoContrato?.trim()) {
      newErrors.agregadoContrato = "Informe o contrato"
    }

    if (!formData.agregadoCentroCusto?.trim()) {
      newErrors.agregadoCentroCusto = "Informe o centro de custo"
    }

    if (!formData.agregadoAnoModelo?.trim()) {
      newErrors.agregadoAnoModelo = "Informe o ano/modelo"
    }

    if (formData.mensalidade < 0) {
      newErrors.mensalidade = "O valor da locação não pode ser negativo"
    }

    if (!formData.agregadoDataInicial) {
      newErrors.agregadoDataInicial = "Data inicial é obrigatória"
    }

    if (!formData.dataVencimentoContrato) {
      newErrors.dataVencimentoContrato = "Data final é obrigatória"
    }

    if (!formData.agregadoDias) {
      newErrors.agregadoDias = "Informe os dias"
    } else if (Number.isNaN(Number(formData.agregadoDias)) || Number(formData.agregadoDias) <= 0) {
      newErrors.agregadoDias = "Os dias devem ser um número maior que zero"
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const updateField = <K extends keyof VehicleFormData,>(field: K, value: VehicleFormData[K]) => {
    setFormData((current) => ({ ...current, [field]: value }))
  }

  const updateDateRange = (nextStartDate: string, nextEndDate: string) => {
    updateField("agregadoDataInicial", nextStartDate || null)
    updateField("dataVencimentoContrato", nextEndDate)
    updateField("agregadoDias", calculateDays(nextStartDate, nextEndDate))
  }

  const valorDia = formData.mensalidade > 0 ? formData.mensalidade / 30 : 0
  const valorTotal = valorDia * (formData.agregadoDias ?? 0)

  const handleUploadContrato = async (file: File | null) => {
    if (!file) return

    if (!formData.placa.trim()) {
      toast({
        title: "Aviso",
        description: "Informe a placa antes de enviar o contrato.",
      })
      return
    }

    setUploadingContrato(true)

    try {
      const body = new FormData()
      body.append("file", file)
      body.append("entityType", "agregados_contratos")
      body.append("entityId", formData.placa.toUpperCase())
      body.append("label", "contrato_assinado")

      const response = await fetch("/api/drive/upload", {
        method: "POST",
        body,
      })

      if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        throw new Error(data?.error || "Falha ao enviar contrato.")
      }

      const uploadedFile = await response.json()
      setFormData((current) => ({
        ...current,
        checklists: [uploadedFile],
      }))

      if (!formData.agregadoContrato) {
        updateField("agregadoContrato", "ASSINADO")
      }

      toast({
        title: "Sucesso",
        description: "Contrato enviado para o Drive.",
      })
    } catch (error) {
      toast({
        title: "Erro",
        description: error instanceof Error ? error.message : "Falha ao enviar contrato.",
        variant: "destructive",
      })
    } finally {
      setUploadingContrato(false)
    }
  }

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault()

    if (!validateForm()) return

    onSave({
      ...formData,
      placa: formData.placa.toUpperCase(),
      chassi: formData.agregadoAnoModelo?.trim() || "",
      frota: false,
      cpfAgregado: formData.agregadoColaboradorNome?.trim() || null,
      tipoContratacao: formData.agregadoFuncao?.trim() || null,
      empresaLocacao: formData.agregadoCentroCusto?.trim() || null,
      dataVencimentoCNHAgregado: formData.agregadoDataInicial || null,
      km: Number(formData.agregadoDias) || 0,
      agregadoColaboradorNome: formData.agregadoColaboradorNome?.trim() || null,
      agregadoFuncao: formData.agregadoFuncao?.trim() || null,
      agregadoContrato: formData.agregadoContrato?.trim() || null,
      agregadoCentroCusto: formData.agregadoCentroCusto?.trim() || null,
      agregadoAnoModelo: formData.agregadoAnoModelo?.trim() || null,
      agregadoDataInicial: formData.agregadoDataInicial || null,
      agregadoDias: Number(formData.agregadoDias) || 0,
      colaboradorId: null,
    })

    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[88vh] overflow-y-auto sm:max-w-[820px]">
        <DialogHeader>
          <DialogTitle>{vehicle ? "Editar Veículo Agregado" : "Adicionar Veículo Agregado"}</DialogTitle>
          <DialogDescription>
            Cadastre os dados da planilha de agregados com período, custo e vínculo operacional.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          <div className="space-y-6 py-4">
            <div className="grid gap-3 rounded-2xl border border-border bg-muted/20 p-4 md:grid-cols-3">
              <div className="rounded-xl bg-background p-4 shadow-sm">
                <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                  <CircleDollarSign className="h-4 w-4 text-primary" />
                  Valor por dia
                </div>
                <p className="mt-2 text-2xl font-bold text-foreground">{formatCurrency(valorDia)}</p>
              </div>
              <div className="rounded-xl bg-background p-4 shadow-sm">
                <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                  <CalendarDays className="h-4 w-4 text-primary" />
                  Dias calculados
                </div>
                <p className="mt-2 text-2xl font-bold text-foreground">{formData.agregadoDias ?? 0}</p>
              </div>
              <div className="rounded-xl bg-background p-4 shadow-sm">
                <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                  <FileText className="h-4 w-4 text-primary" />
                  Valor total
                </div>
                <p className="mt-2 text-2xl font-bold text-foreground">{formatCurrency(valorTotal)}</p>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="agregadoColaboradorNome">Colaborador</Label>
                <Input
                  id="agregadoColaboradorNome"
                  placeholder="Ex: Jefferson Cabral"
                  value={formData.agregadoColaboradorNome ?? ""}
                  onChange={(event) => updateField("agregadoColaboradorNome", event.target.value)}
                />
                {errors.agregadoColaboradorNome ? <p className="text-sm text-destructive">{errors.agregadoColaboradorNome}</p> : null}
              </div>

              <div className="grid gap-2">
                <Label htmlFor="agregadoFuncao">Função</Label>
                <Input
                  id="agregadoFuncao"
                  placeholder="Ex: Supervisor"
                  value={formData.agregadoFuncao ?? ""}
                  onChange={(event) => updateField("agregadoFuncao", event.target.value)}
                />
                {errors.agregadoFuncao ? <p className="text-sm text-destructive">{errors.agregadoFuncao}</p> : null}
              </div>

              <div className="grid gap-2">
                <Label htmlFor="placa">Placa</Label>
                <Input
                  id="placa"
                  placeholder="ABC-1234 ou ABC1D23"
                  value={formData.placa}
                  onChange={(event) => updateField("placa", event.target.value.toUpperCase())}
                  maxLength={8}
                />
                {errors.placa ? <p className="text-sm text-destructive">{errors.placa}</p> : null}
              </div>

              <div className="grid gap-2">
                <Label htmlFor="agregadoContrato">Contrato</Label>
                <Select value={formData.agregadoContrato ?? "ASSINADO"} onValueChange={(value) => updateField("agregadoContrato", value)}>
                  <SelectTrigger id="agregadoContrato">
                    <SelectValue placeholder="Selecione o contrato" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ASSINADO">Assinado</SelectItem>
                    <SelectItem value="PENDENTE">Pendente</SelectItem>
                    <SelectItem value="RENOVAR">Renovar</SelectItem>
                  </SelectContent>
                </Select>
                {errors.agregadoContrato ? <p className="text-sm text-destructive">{errors.agregadoContrato}</p> : null}
              </div>

              <div className="grid gap-2 md:col-span-2">
                <Label htmlFor="agregadoCentroCusto">Centro de Custo</Label>
                <Input
                  id="agregadoCentroCusto"
                  placeholder="Ex: 52-CASA CLIENTE GIGA+ RJ T6"
                  value={formData.agregadoCentroCusto ?? ""}
                  onChange={(event) => updateField("agregadoCentroCusto", event.target.value)}
                />
                {errors.agregadoCentroCusto ? <p className="text-sm text-destructive">{errors.agregadoCentroCusto}</p> : null}
              </div>

              <div className="grid gap-2 md:col-span-2">
                <Label htmlFor="modelo">Veículo</Label>
                <Input
                  id="modelo"
                  placeholder="Ex: Renault/Duster 2.0 D 4x2A"
                  value={formData.modelo}
                  onChange={(event) => updateField("modelo", event.target.value)}
                />
                {errors.modelo ? <p className="text-sm text-destructive">{errors.modelo}</p> : null}
              </div>

              <div className="grid gap-2">
                <Label htmlFor="agregadoAnoModelo">Ano/Modelo</Label>
                <Input
                  id="agregadoAnoModelo"
                  placeholder="Ex: 2013/2014"
                  value={formData.agregadoAnoModelo ?? ""}
                  onChange={(event) => updateField("agregadoAnoModelo", event.target.value)}
                />
                {errors.agregadoAnoModelo ? <p className="text-sm text-destructive">{errors.agregadoAnoModelo}</p> : null}
              </div>

              <div className="grid gap-2">
                <Label htmlFor="mensalidade">Valor Locação (R$)</Label>
                <Input
                  id="mensalidade"
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0"
                  value={formData.mensalidade || ""}
                  onChange={(event) => updateField("mensalidade", parseFloat(event.target.value) || 0)}
                />
                {errors.mensalidade ? <p className="text-sm text-destructive">{errors.mensalidade}</p> : null}
              </div>
            </div>

            <Separator />

            <div className="grid gap-4 md:grid-cols-3">
              <div className="grid gap-2">
                <Label htmlFor="agregadoDataInicial">Data Inicial</Label>
                <Input
                  id="agregadoDataInicial"
                  type="date"
                  value={formData.agregadoDataInicial ?? ""}
                  onChange={(event) => updateDateRange(event.target.value, formData.dataVencimentoContrato)}
                />
                {errors.agregadoDataInicial ? <p className="text-sm text-destructive">{errors.agregadoDataInicial}</p> : null}
              </div>

              <div className="grid gap-2">
                <Label htmlFor="dataVencimentoContrato">Data Final</Label>
                <Input
                  id="dataVencimentoContrato"
                  type="date"
                  value={formData.dataVencimentoContrato}
                  onChange={(event) => updateDateRange(formData.agregadoDataInicial ?? "", event.target.value)}
                />
                {errors.dataVencimentoContrato ? <p className="text-sm text-destructive">{errors.dataVencimentoContrato}</p> : null}
              </div>

              <div className="grid gap-2">
                <Label htmlFor="agregadoDias">Dias</Label>
                <Input
                  id="agregadoDias"
                  type="number"
                  min="1"
                  placeholder="30"
                  value={formData.agregadoDias ?? ""}
                  onChange={(event) => updateField("agregadoDias", Number(event.target.value) || null)}
                />
                {errors.agregadoDias ? <p className="text-sm text-destructive">{errors.agregadoDias}</p> : null}
              </div>
            </div>

            <Separator />

            <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
              <div className="grid gap-2">
                <Label htmlFor="contratoAgregado">Contrato Assinado (PDF)</Label>
                <Input
                  id="contratoAgregado"
                  type="file"
                  accept="application/pdf,.pdf"
                  onChange={(event) => handleUploadContrato(event.target.files?.[0] ?? null)}
                  disabled={uploadingContrato}
                />
                {formData.checklists?.[0] ? (
                  <a
                    href={formData.checklists[0].webViewLink || "#"}
                    target="_blank"
                    rel="noreferrer"
                    className="text-sm text-primary underline-offset-4 hover:underline"
                  >
                    {formData.checklists[0].name}
                  </a>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    {uploadingContrato ? "Enviando contrato..." : "Envie o PDF assinado para salvar no Drive."}
                  </p>
                )}
              </div>

              <div className="rounded-2xl border border-border bg-muted/20 p-4">
                <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                  <UserSquare2 className="h-4 w-4 text-primary" />
                  Resumo do lançamento
                </div>
                <div className="mt-4 grid gap-3 text-sm">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-muted-foreground">Colaborador</span>
                    <span className="text-right font-medium text-foreground">{formData.agregadoColaboradorNome || "-"}</span>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-muted-foreground">Centro de custo</span>
                    <span className="text-right font-medium text-foreground">{formData.agregadoCentroCusto || "-"}</span>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-muted-foreground">Contrato</span>
                    <span className="text-right font-medium text-foreground">{formData.agregadoContrato || "-"}</span>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-muted-foreground">Período</span>
                    <span className="text-right font-medium text-foreground">{formData.agregadoDataInicial || "-"} a {formData.dataVencimentoContrato || "-"}</span>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-muted-foreground">Valor total</span>
                    <span className="text-right font-semibold text-foreground">{formatCurrency(valorTotal)}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit">{vehicle ? "Salvar Alterações" : "Adicionar"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
