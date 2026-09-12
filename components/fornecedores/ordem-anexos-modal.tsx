"use client"

import { useEffect, useState } from "react"
import { ExternalLink, FileText, Plus, Trash2, Upload } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
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
import { toast } from "@/hooks/use-toast"
import {
  PARCELA_STATUS_BADGE_CLASS,
  PARCELA_STATUS_LABELS,
  buildParcelasFromCondicao,
  createParcelaId,
  formatCondicaoPagamento,
  formatCurrency,
  formatDate,
  getParcelaStatus,
  getParcelasTotal,
  splitValor,
  toDateInputValue,
} from "@/lib/fornecedores"
import type { BoletoParcela, DriveFile, OrdemServico, OrdemServicoFormData } from "@/lib/types"

const ACCEPTED_TYPES = "application/pdf,image/png,image/jpeg,image/webp"

type OrdemAnexosModalProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  ordem: OrdemServico | null
  onSave: (data: OrdemServicoFormData) => Promise<void> | void
}

type AnexosState = {
  parcelas: BoletoParcela[]
  notaFiscalNumero: string
  notaFiscalEmissao: string
  notaFiscalValor: string
  notaFiscalArquivos: DriveFile[]
}

const EMPTY_STATE: AnexosState = {
  parcelas: [],
  notaFiscalNumero: "",
  notaFiscalEmissao: "",
  notaFiscalValor: "",
  notaFiscalArquivos: [],
}

function addMonths(isoDate: string, months: number): string {
  const base = new Date(`${isoDate}T00:00:00`)
  if (Number.isNaN(base.getTime())) return ""

  const day = base.getDate()
  const shifted = new Date(base.getFullYear(), base.getMonth() + months, 1)
  const lastDay = new Date(shifted.getFullYear(), shifted.getMonth() + 1, 0).getDate()
  shifted.setDate(Math.min(day, lastDay))

  const month = String(shifted.getMonth() + 1).padStart(2, "0")
  const dayOfMonth = String(shifted.getDate()).padStart(2, "0")
  return `${shifted.getFullYear()}-${month}-${dayOfMonth}`
}

export function OrdemAnexosModal({ open, onOpenChange, ordem, onSave }: OrdemAnexosModalProps) {
  const [state, setState] = useState<AnexosState>(EMPTY_STATE)
  const [uploadingId, setUploadingId] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [quantidadeParcelas, setQuantidadeParcelas] = useState("3")
  const [primeiroVencimento, setPrimeiroVencimento] = useState("")

  useEffect(() => {
    if (!ordem) {
      setState(EMPTY_STATE)
      return
    }

    setState({
      parcelas: ordem.boletoParcelas ?? [],
      notaFiscalNumero: ordem.notaFiscalNumero,
      notaFiscalEmissao: toDateInputValue(ordem.notaFiscalEmissao),
      notaFiscalValor: ordem.notaFiscalValor === null ? "" : String(ordem.notaFiscalValor),
      notaFiscalArquivos: ordem.notaFiscalArquivos ?? [],
    })
    setQuantidadeParcelas(String(ordem.parcelasQuantidade ?? ordem.boletoParcelas?.length ?? 1))
    setPrimeiroVencimento("")
    setIsSubmitting(false)
  }, [ordem, open])

  const updateParcela = (parcelaId: string, patch: Partial<BoletoParcela>) => {
    setState((current) => ({
      ...current,
      parcelas: current.parcelas.map((parcela) => (parcela.id === parcelaId ? { ...parcela, ...patch } : parcela)),
    }))
  }

  const handleAddParcela = () => {
    setState((current) => ({
      ...current,
      parcelas: [
        ...current.parcelas,
        {
          id: createParcelaId(),
          numero: current.parcelas.length + 1,
          vencimento: "",
          valor: null,
          pago: false,
          pagoEm: null,
          arquivos: [],
        },
      ],
    }))
  }

  const handleRemoveParcela = (parcelaId: string) => {
    setState((current) => ({
      ...current,
      parcelas: current.parcelas
        .filter((parcela) => parcela.id !== parcelaId)
        .map((parcela, index) => ({ ...parcela, numero: index + 1 })),
    }))
  }

  const handleGenerateParcelas = () => {
    if (!ordem) return

    const quantidade = Number(quantidadeParcelas)
    if (!Number.isInteger(quantidade) || quantidade < 1 || quantidade > 36) {
      toast({ title: "Aviso", description: "Informe uma quantidade de parcelas entre 1 e 36." })
      return
    }

    if (!primeiroVencimento) {
      toast({ title: "Aviso", description: "Informe a data do primeiro vencimento." })
      return
    }

    const geradas: BoletoParcela[] = splitValor(ordem.valorTotal, quantidade).map((valor, index) => ({
      id: createParcelaId(),
      numero: index + 1,
      vencimento: index === 0 ? primeiroVencimento : addMonths(primeiroVencimento, index),
      valor,
      pago: false,
      pagoEm: null,
      arquivos: [],
    }))

    setState((current) => ({ ...current, parcelas: geradas }))
    toast({
      title: "Parcelas geradas",
      description: `${quantidade} parcela(s) com vencimento mensal. Anexe o boleto de cada uma.`,
    })
  }

  const handleAplicarCondicao = () => {
    if (!ordem) return

    const dataBase = ordem.dataAbertura || ordem.createdAt
    const geradas = buildParcelasFromCondicao(dataBase.slice(0, 10), ordem.prazosDias, ordem.valorTotal)

    if (geradas.length === 0) {
      toast({
        title: "Aviso",
        description: "Cadastre a condição de pagamento no orçamento antes de aplicá-la.",
      })
      return
    }

    setState((current) => ({ ...current, parcelas: geradas }))
    toast({
      title: "Condição aplicada",
      description: `${formatCondicaoPagamento(ordem)} a partir de ${formatDate(dataBase)}.`,
    })
  }

  const uploadFiles = async (files: File[], label: string, subfolder: string): Promise<DriveFile[]> => {
    if (!ordem) return []

    const uploaded: DriveFile[] = []

    for (const file of files) {
      const body = new FormData()
      body.append("file", file)
      body.append("entityType", "ordens-servico")
      body.append("entityId", ordem.id)
      body.append("label", label)
      body.append("subfolder", subfolder)

      const response = await fetch("/api/drive/upload", { method: "POST", body })

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}))
        throw new Error(payload?.error || "Falha ao enviar arquivo.")
      }

      uploaded.push((await response.json()) as DriveFile)
    }

    return uploaded
  }

  const handleUploadParcela = async (parcela: BoletoParcela, files: FileList | null) => {
    if (!files || files.length === 0) return

    setUploadingId(parcela.id)
    try {
      const uploaded = await uploadFiles(Array.from(files), `boleto-parcela-${parcela.numero}`, "boletos")

      setState((current) => ({
        ...current,
        parcelas: current.parcelas.map((item) =>
          item.id === parcela.id ? { ...item, arquivos: [...item.arquivos, ...uploaded] } : item
        ),
      }))
      toast({ title: "Sucesso", description: "Boleto enviado para o Drive." })
    } catch (error) {
      const message = error instanceof Error ? error.message : "Falha ao enviar arquivo."
      toast({ title: "Erro", description: message, variant: "destructive" })
    } finally {
      setUploadingId(null)
    }
  }

  const handleUploadNotaFiscal = async (files: FileList | null) => {
    if (!files || files.length === 0) return

    setUploadingId("nota-fiscal")
    try {
      const uploaded = await uploadFiles(Array.from(files), "nota-fiscal", "nota-fiscal")

      setState((current) => ({ ...current, notaFiscalArquivos: [...current.notaFiscalArquivos, ...uploaded] }))
      toast({ title: "Sucesso", description: "Nota fiscal enviada para o Drive." })
    } catch (error) {
      const message = error instanceof Error ? error.message : "Falha ao enviar arquivo."
      toast({ title: "Erro", description: message, variant: "destructive" })
    } finally {
      setUploadingId(null)
    }
  }

  const handleSave = async () => {
    if (!ordem) return

    setIsSubmitting(true)
    try {
      await onSave({
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
        parcelasQuantidade: state.parcelas.length > 0 ? state.parcelas.length : ordem.parcelasQuantidade,
        prazosDias: ordem.prazosDias,
        boletoVencimento: ordem.boletoVencimento,
        boletoValor: ordem.boletoValor,
        boletoArquivos: ordem.boletoArquivos,
        boletoParcelas: state.parcelas,
        notaFiscalNumero: state.notaFiscalNumero,
        notaFiscalEmissao: state.notaFiscalEmissao,
        notaFiscalValor: state.notaFiscalValor === "" ? null : Number(state.notaFiscalValor),
        notaFiscalArquivos: state.notaFiscalArquivos,
        observacoes: ordem.observacoes,
      })
      onOpenChange(false)
    } finally {
      setIsSubmitting(false)
    }
  }

  const renderFileList = (files: DriveFile[], onRemove: (fileId: string) => void) => {
    if (files.length === 0) {
      return <p className="text-xs text-muted-foreground">Nenhum arquivo anexado.</p>
    }

    return (
      <ul className="space-y-2">
        {files.map((file) => (
          <li
            key={file.id}
            className="flex items-center justify-between gap-2 rounded-lg border border-border bg-muted/30 px-3 py-2"
          >
            <span className="flex min-w-0 items-center gap-2">
              <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
              <span className="truncate text-xs">{file.name}</span>
            </span>
            <span className="flex shrink-0 items-center gap-1">
              {file.webViewLink ? (
                <Button asChild variant="ghost" size="icon" className="h-7 w-7">
                  <a href={file.webViewLink} target="_blank" rel="noopener noreferrer" aria-label="Abrir arquivo">
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                </Button>
              ) : null}
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-destructive"
                aria-label="Remover arquivo"
                onClick={() => onRemove(file.id)}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </span>
          </li>
        ))}
      </ul>
    )
  }

  const totalParcelas = getParcelasTotal(state.parcelas)
  const diferenca = ordem ? ordem.valorTotal - totalParcelas : 0

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-[640px]">
        <DialogHeader>
          <DialogTitle>Boletos & Nota Fiscal</DialogTitle>
          <DialogDescription>
            {ordem ? `Ordem do veículo ${ordem.placa} — ${ordem.descricao}` : ""}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-2">
          <section className="space-y-4 rounded-xl border border-border p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="text-sm font-semibold">Parcelas do Boleto</h3>
                {ordem ? (
                  <p className="text-xs text-muted-foreground">
                    Condição negociada: {formatCondicaoPagamento(ordem)}
                  </p>
                ) : null}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8"
                  onClick={handleAplicarCondicao}
                >
                  Aplicar condição
                </Button>
                <Button type="button" variant="outline" size="sm" className="h-8 gap-1.5" onClick={handleAddParcela}>
                  <Plus className="h-3.5 w-3.5" />
                  Adicionar parcela
                </Button>
              </div>
            </div>

            <div className="grid gap-3 rounded-lg bg-muted/30 p-3 sm:grid-cols-[110px_minmax(0,1fr)_auto] sm:items-end">
              <div className="grid gap-1.5">
                <Label htmlFor="quantidadeParcelas" className="text-xs">
                  Qtd. de parcelas
                </Label>
                <Input
                  id="quantidadeParcelas"
                  type="number"
                  min={1}
                  max={36}
                  value={quantidadeParcelas}
                  onChange={(event) => setQuantidadeParcelas(event.target.value)}
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="primeiroVencimento" className="text-xs">
                  1º vencimento
                </Label>
                <Input
                  id="primeiroVencimento"
                  type="date"
                  value={primeiroVencimento}
                  onChange={(event) => setPrimeiroVencimento(event.target.value)}
                />
              </div>
              <Button type="button" variant="secondary" className="h-10" onClick={handleGenerateParcelas}>
                Dividir valor
              </Button>
            </div>

            {state.parcelas.length === 0 ? (
              <p className="rounded-lg border border-dashed border-border px-4 py-8 text-center text-xs text-muted-foreground">
                Nenhuma parcela cadastrada. Use “Dividir valor” ou adicione manualmente.
              </p>
            ) : (
              <div className="space-y-3">
                {state.parcelas.map((parcela) => {
                  const status = getParcelaStatus(parcela)

                  return (
                    <div key={parcela.id} className="space-y-3 rounded-lg border border-border p-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="flex items-center gap-2">
                          <span className="text-sm font-semibold">
                            Parcela {parcela.numero}/{state.parcelas.length}
                          </span>
                          <Badge variant="outline" className={PARCELA_STATUS_BADGE_CLASS[status]}>
                            {PARCELA_STATUS_LABELS[status]}
                          </Badge>
                        </span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-destructive"
                          aria-label="Remover parcela"
                          onClick={() => handleRemoveParcela(parcela.id)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>

                      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] sm:items-end">
                        <div className="grid gap-1.5">
                          <Label htmlFor={`vencimento-${parcela.id}`} className="text-xs">
                            Vencimento
                          </Label>
                          <Input
                            id={`vencimento-${parcela.id}`}
                            type="date"
                            value={parcela.vencimento}
                            onChange={(event) => updateParcela(parcela.id, { vencimento: event.target.value })}
                          />
                        </div>

                        <div className="grid gap-1.5">
                          <Label htmlFor={`valor-${parcela.id}`} className="text-xs">
                            Valor (R$)
                          </Label>
                          <Input
                            id={`valor-${parcela.id}`}
                            type="number"
                            min={0}
                            step="0.01"
                            value={parcela.valor ?? ""}
                            onChange={(event) =>
                              updateParcela(parcela.id, {
                                valor: event.target.value === "" ? null : Number(event.target.value),
                              })
                            }
                          />
                        </div>

                        <label className="flex h-10 items-center gap-2 text-xs font-medium">
                          <Checkbox
                            checked={parcela.pago}
                            onCheckedChange={(checked) =>
                              updateParcela(parcela.id, {
                                pago: checked === true,
                                pagoEm: checked === true ? new Date().toISOString() : null,
                              })
                            }
                          />
                          Pago
                        </label>
                      </div>

                      <div className="grid gap-1.5">
                        <Label htmlFor={`upload-${parcela.id}`} className="flex items-center gap-2 text-xs">
                          <Upload className="h-3.5 w-3.5" />
                          Anexar boleto (PDF ou imagem)
                        </Label>
                        <Input
                          id={`upload-${parcela.id}`}
                          type="file"
                          multiple
                          accept={ACCEPTED_TYPES}
                          disabled={uploadingId !== null}
                          onChange={(event) => {
                            handleUploadParcela(parcela, event.target.files)
                            event.target.value = ""
                          }}
                        />
                      </div>

                      {renderFileList(parcela.arquivos, (fileId) =>
                        updateParcela(parcela.id, {
                          arquivos: parcela.arquivos.filter((file) => file.id !== fileId),
                        })
                      )}
                    </div>
                  )
                })}

                <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-muted/40 px-3 py-2 text-xs">
                  <span className="text-muted-foreground">
                    Total das parcelas: <strong className="text-foreground">{formatCurrency(totalParcelas)}</strong>
                  </span>
                  {ordem && Math.abs(diferenca) >= 0.01 ? (
                    <span className="font-medium text-amber-700">
                      Diferença de {formatCurrency(Math.abs(diferenca))} em relação ao total da ordem.
                    </span>
                  ) : null}
                </div>
              </div>
            )}
          </section>

          <section className="space-y-3 rounded-xl border border-border p-4">
            <h3 className="text-sm font-semibold">Nota Fiscal</h3>

            <div className="grid gap-4 sm:grid-cols-3">
              <div className="grid gap-2">
                <Label htmlFor="notaFiscalNumero">Número</Label>
                <Input
                  id="notaFiscalNumero"
                  value={state.notaFiscalNumero}
                  onChange={(event) => setState({ ...state, notaFiscalNumero: event.target.value })}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="notaFiscalEmissao">Emissão</Label>
                <Input
                  id="notaFiscalEmissao"
                  type="date"
                  value={state.notaFiscalEmissao}
                  onChange={(event) => setState({ ...state, notaFiscalEmissao: event.target.value })}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="notaFiscalValor">Valor (R$)</Label>
                <Input
                  id="notaFiscalValor"
                  type="number"
                  min={0}
                  step="0.01"
                  value={state.notaFiscalValor}
                  onChange={(event) => setState({ ...state, notaFiscalValor: event.target.value })}
                />
              </div>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="notaFiscalUpload" className="flex items-center gap-2">
                <Upload className="h-3.5 w-3.5" />
                Enviar nota fiscal (PDF ou imagem)
              </Label>
              <Input
                id="notaFiscalUpload"
                type="file"
                multiple
                accept={ACCEPTED_TYPES}
                disabled={uploadingId !== null}
                onChange={(event) => {
                  handleUploadNotaFiscal(event.target.files)
                  event.target.value = ""
                }}
              />
            </div>

            {renderFileList(state.notaFiscalArquivos, (fileId) =>
              setState((current) => ({
                ...current,
                notaFiscalArquivos: current.notaFiscalArquivos.filter((file) => file.id !== fileId),
              }))
            )}
          </section>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button type="button" onClick={handleSave} disabled={isSubmitting || uploadingId !== null}>
            {isSubmitting ? "Salvando..." : "Salvar Anexos"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
