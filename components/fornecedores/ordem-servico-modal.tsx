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
import { Textarea } from "@/components/ui/textarea"
import {
  buildParcelasFromCondicao,
  canRebuildParcelas,
  formatCurrency,
  formatDate,
  formatPrazosDias,
  getOrdemServicoTotal,
  parsePrazosDias,
  toDateInputValue,
} from "@/lib/fornecedores"
import type { Fornecedor, OrdemServico, OrdemServicoFormData, Vehicle } from "@/lib/types"

const VEHICLE_MANUAL_VALUE = "manual"

function buildPrazosPadrao(quantidade: number): number[] {
  return Array.from({ length: quantidade }, (_, index) => (index + 1) * 30)
}

function buildInitialFormData(): OrdemServicoFormData {
  return {
    fornecedorId: null,
    vehicleId: null,
    placa: "",
    descricao: "",
    valorPecas: 0,
    valorMaoObra: 0,
    valorTotal: 0,
    kmVeiculo: null,
    dataAbertura: new Date().toISOString().slice(0, 10),
    previsaoEntrega: "",
    status: "aguardando",
    aprovadoPor: null,
    aprovadoEm: null,
    motivoRejeicao: null,
    parcelasQuantidade: 1,
    prazosDias: [30],
    boletoVencimento: "",
    boletoValor: null,
    boletoArquivos: [],
    boletoParcelas: [],
    notaFiscalNumero: "",
    notaFiscalEmissao: "",
    notaFiscalValor: null,
    notaFiscalArquivos: [],
    observacoes: "",
  }
}

type OrdemServicoModalProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  ordem?: OrdemServico | null
  fornecedores: Fornecedor[]
  vehicles: Vehicle[]
  onSave: (data: OrdemServicoFormData) => Promise<void> | void
}

export function OrdemServicoModal({
  open,
  onOpenChange,
  ordem,
  fornecedores,
  vehicles,
  onSave,
}: OrdemServicoModalProps) {
  const [formData, setFormData] = useState<OrdemServicoFormData>(buildInitialFormData)
  const [prazosInput, setPrazosInput] = useState("30")
  const [errors, setErrors] = useState<Partial<Record<keyof OrdemServicoFormData, string>>>({})
  const [isSubmitting, setIsSubmitting] = useState(false)

  const sortedFornecedores = useMemo(
    () => [...fornecedores].sort((left, right) => left.razaoSocial.localeCompare(right.razaoSocial)),
    [fornecedores]
  )
  const sortedVehicles = useMemo(
    () => [...vehicles].sort((left, right) => left.placa.localeCompare(right.placa)),
    [vehicles]
  )
  const valorTotal = getOrdemServicoTotal(formData.valorPecas, formData.valorMaoObra)
  const prazosDias = useMemo(() => parsePrazosDias(prazosInput), [prazosInput])
  const dataBaseParcelas = formData.dataAbertura || new Date().toISOString().slice(0, 10)
  const previewParcelas = useMemo(
    () => buildParcelasFromCondicao(dataBaseParcelas, prazosDias, valorTotal),
    [dataBaseParcelas, prazosDias, valorTotal]
  )
  const parcelasBloqueadas = !canRebuildParcelas(formData.boletoParcelas ?? [])

  useEffect(() => {
    if (ordem) {
      setFormData({
        fornecedorId: ordem.fornecedorId,
        vehicleId: ordem.vehicleId,
        placa: ordem.placa,
        descricao: ordem.descricao,
        valorPecas: ordem.valorPecas,
        valorMaoObra: ordem.valorMaoObra,
        valorTotal: ordem.valorTotal,
        kmVeiculo: ordem.kmVeiculo,
        dataAbertura: toDateInputValue(ordem.dataAbertura),
        previsaoEntrega: toDateInputValue(ordem.previsaoEntrega),
        status: ordem.status,
        aprovadoPor: ordem.aprovadoPor,
        aprovadoEm: ordem.aprovadoEm,
        motivoRejeicao: ordem.motivoRejeicao,
        parcelasQuantidade: ordem.parcelasQuantidade ?? ordem.prazosDias.length ?? 1,
        prazosDias: ordem.prazosDias,
        boletoVencimento: toDateInputValue(ordem.boletoVencimento),
        boletoValor: ordem.boletoValor,
        boletoArquivos: ordem.boletoArquivos,
        boletoParcelas: ordem.boletoParcelas,
        notaFiscalNumero: ordem.notaFiscalNumero,
        notaFiscalEmissao: toDateInputValue(ordem.notaFiscalEmissao),
        notaFiscalValor: ordem.notaFiscalValor,
        notaFiscalArquivos: ordem.notaFiscalArquivos,
        observacoes: ordem.observacoes,
      })
      setPrazosInput(formatPrazosDias(ordem.prazosDias))
    } else {
      setFormData(buildInitialFormData())
      setPrazosInput("30")
    }

    setErrors({})
    setIsSubmitting(false)
  }, [ordem, open])

  const handleVehicleChange = (value: string) => {
    if (value === VEHICLE_MANUAL_VALUE) {
      setFormData((current) => ({ ...current, vehicleId: null }))
      return
    }

    const vehicle = vehicles.find((item) => item.id === value)
    setFormData((current) => ({
      ...current,
      vehicleId: value,
      placa: vehicle?.placa ?? current.placa,
      kmVeiculo: vehicle?.km ?? current.kmVeiculo,
    }))
  }

  const handleQuantidadeChange = (value: string) => {
    const quantidade = value === "" ? null : Number(value)

    setFormData((current) => ({ ...current, parcelasQuantidade: quantidade }))

    if (quantidade && Number.isInteger(quantidade) && quantidade > 0 && quantidade <= 36) {
      const prazos = parsePrazosDias(prazosInput)
      if (prazos.length !== quantidade) {
        const ajustados = buildPrazosPadrao(quantidade)
        setPrazosInput(formatPrazosDias(ajustados))
        setFormData((current) => ({ ...current, prazosDias: ajustados }))
      }
    }
  }

  const handlePrazosChange = (value: string) => {
    setPrazosInput(value)
    const prazos = parsePrazosDias(value)
    setFormData((current) => ({
      ...current,
      prazosDias: prazos,
      parcelasQuantidade: prazos.length > 0 ? prazos.length : current.parcelasQuantidade,
    }))
  }

  const validate = (): boolean => {
    const newErrors: Partial<Record<keyof OrdemServicoFormData, string>> = {}

    if (!formData.placa.trim()) {
      newErrors.placa = "Informe a placa do veículo"
    }

    if (!formData.fornecedorId) {
      newErrors.fornecedorId = "Selecione o fornecedor"
    }

    if (!formData.descricao.trim()) {
      newErrors.descricao = "Descreva o serviço"
    }

    if (formData.valorPecas < 0 || formData.valorMaoObra < 0) {
      newErrors.valorPecas = "Os valores não podem ser negativos"
    }

    if (valorTotal <= 0) {
      newErrors.valorMaoObra = "Informe o valor de peças e/ou mão de obra"
    }

    const quantidade = formData.parcelasQuantidade
    if (!quantidade || !Number.isInteger(quantidade) || quantidade < 1 || quantidade > 36) {
      newErrors.parcelasQuantidade = "Informe de 1 a 36 parcelas"
    } else if (prazosDias.length !== quantidade) {
      newErrors.prazosDias = `Informe ${quantidade} prazo(s) separados por barra (ex.: 15/30/60)`
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    if (!validate()) return

    setIsSubmitting(true)
    try {
      const parcelasAtuais = formData.boletoParcelas ?? []
      // Regera os vencimentos quando ainda não há boleto anexado nem parcela paga.
      const boletoParcelas = canRebuildParcelas(parcelasAtuais)
        ? buildParcelasFromCondicao(dataBaseParcelas, prazosDias, valorTotal)
        : parcelasAtuais

      await onSave({
        ...formData,
        placa: formData.placa.trim().toUpperCase(),
        valorTotal,
        prazosDias,
        boletoParcelas,
      })
      onOpenChange(false)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-[620px]">
        <DialogHeader>
          <DialogTitle>{ordem ? "Editar Orçamento de Serviço" : "Novo Orçamento de Serviço"}</DialogTitle>
          <DialogDescription>
            Vincule o serviço ao veículo e ao fornecedor. O orçamento entra como “Aguardando aprovação”.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="fornecedorId">Fornecedor</Label>
              <Select
                value={formData.fornecedorId ?? undefined}
                onValueChange={(value) => setFormData({ ...formData, fornecedorId: value })}
              >
                <SelectTrigger id="fornecedorId">
                  <SelectValue placeholder="Selecione o fornecedor" />
                </SelectTrigger>
                <SelectContent>
                  {sortedFornecedores.map((fornecedor) => (
                    <SelectItem key={fornecedor.id} value={fornecedor.id}>
                      {fornecedor.razaoSocial}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.fornecedorId ? <p className="text-xs text-destructive">{errors.fornecedorId}</p> : null}
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="vehicleId">Veículo</Label>
                <Select value={formData.vehicleId ?? VEHICLE_MANUAL_VALUE} onValueChange={handleVehicleChange}>
                  <SelectTrigger id="vehicleId">
                    <SelectValue placeholder="Selecione o veículo" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={VEHICLE_MANUAL_VALUE}>Informar placa manualmente</SelectItem>
                    {sortedVehicles.map((vehicle) => (
                      <SelectItem key={vehicle.id} value={vehicle.id}>
                        {vehicle.placa} — {vehicle.modelo}
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
                  onChange={(event) => setFormData({ ...formData, placa: event.target.value.toUpperCase() })}
                  placeholder="ABC1D23"
                />
                {errors.placa ? <p className="text-xs text-destructive">{errors.placa}</p> : null}
              </div>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="descricao">Descrição do Serviço</Label>
              <Textarea
                id="descricao"
                value={formData.descricao}
                onChange={(event) => setFormData({ ...formData, descricao: event.target.value })}
                placeholder="Troca de óleo e filtros, revisão de 60.000 km..."
                rows={3}
              />
              {errors.descricao ? <p className="text-xs text-destructive">{errors.descricao}</p> : null}
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <div className="grid gap-2">
                <Label htmlFor="valorPecas">Peças (R$)</Label>
                <Input
                  id="valorPecas"
                  type="number"
                  min={0}
                  step="0.01"
                  value={formData.valorPecas}
                  onChange={(event) => setFormData({ ...formData, valorPecas: Number(event.target.value) || 0 })}
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="valorMaoObra">Mão de Obra (R$)</Label>
                <Input
                  id="valorMaoObra"
                  type="number"
                  min={0}
                  step="0.01"
                  value={formData.valorMaoObra}
                  onChange={(event) => setFormData({ ...formData, valorMaoObra: Number(event.target.value) || 0 })}
                />
              </div>

              <div className="grid gap-2">
                <Label>Total Estimado</Label>
                <div className="flex h-10 items-center rounded-md border border-input bg-muted/40 px-3 text-sm font-semibold">
                  {formatCurrency(valorTotal)}
                </div>
              </div>
            </div>
            {errors.valorPecas ? <p className="text-xs text-destructive">{errors.valorPecas}</p> : null}
            {errors.valorMaoObra ? <p className="text-xs text-destructive">{errors.valorMaoObra}</p> : null}

            <div className="grid gap-4 sm:grid-cols-3">
              <div className="grid gap-2">
                <Label htmlFor="kmVeiculo">KM do Veículo</Label>
                <Input
                  id="kmVeiculo"
                  type="number"
                  min={0}
                  value={formData.kmVeiculo ?? ""}
                  onChange={(event) =>
                    setFormData({
                      ...formData,
                      kmVeiculo: event.target.value === "" ? null : Number(event.target.value),
                    })
                  }
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="dataAbertura">Data de Abertura</Label>
                <Input
                  id="dataAbertura"
                  type="date"
                  value={formData.dataAbertura}
                  onChange={(event) => setFormData({ ...formData, dataAbertura: event.target.value })}
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="previsaoEntrega">Previsão de Entrega</Label>
                <Input
                  id="previsaoEntrega"
                  type="date"
                  value={formData.previsaoEntrega}
                  onChange={(event) => setFormData({ ...formData, previsaoEntrega: event.target.value })}
                />
              </div>
            </div>

            <div className="space-y-3 rounded-xl border border-border p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-semibold">Condição de Pagamento</p>
                <span className="text-xs text-muted-foreground">
                  Base: {formatDate(dataBaseParcelas)}
                </span>
              </div>

              <div className="grid gap-4 sm:grid-cols-[120px_minmax(0,1fr)]">
                <div className="grid gap-2">
                  <Label htmlFor="parcelasQuantidade">Parcelas</Label>
                  <Input
                    id="parcelasQuantidade"
                    type="number"
                    min={1}
                    max={36}
                    value={formData.parcelasQuantidade ?? ""}
                    onChange={(event) => handleQuantidadeChange(event.target.value)}
                  />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="prazosDias">Prazos de vencimento (dias)</Label>
                  <Input
                    id="prazosDias"
                    value={prazosInput}
                    onChange={(event) => handlePrazosChange(event.target.value)}
                    placeholder="15/30/60"
                  />
                </div>
              </div>
              {errors.parcelasQuantidade ? (
                <p className="text-xs text-destructive">{errors.parcelasQuantidade}</p>
              ) : null}
              {errors.prazosDias ? <p className="text-xs text-destructive">{errors.prazosDias}</p> : null}

              {previewParcelas.length > 0 ? (
                <ul className="space-y-1 text-xs text-muted-foreground">
                  {previewParcelas.map((parcela, index) => (
                    <li key={parcela.id} className="flex items-center justify-between gap-2">
                      <span>
                        Parcela {parcela.numero}/{previewParcelas.length} · {prazosDias[index]} dias ·{" "}
                        {formatDate(parcela.vencimento)}
                      </span>
                      <span className="font-medium text-foreground">{formatCurrency(parcela.valor ?? 0)}</span>
                    </li>
                  ))}
                </ul>
              ) : null}

              {parcelasBloqueadas ? (
                <p className="text-xs text-amber-700">
                  Já existem boletos anexados ou parcelas pagas: os vencimentos atuais serão mantidos. Ajuste-os em
                  “Boletos & Nota Fiscal”.
                </p>
              ) : null}
            </div>

            <div className="grid gap-2">
              <Label htmlFor="ordemObservacoes">Observações</Label>
              <Textarea
                id="ordemObservacoes"
                value={formData.observacoes}
                onChange={(event) => setFormData({ ...formData, observacoes: event.target.value })}
                placeholder="Informações adicionais para a aprovação."
                rows={2}
              />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Salvando..." : "Salvar Orçamento"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
