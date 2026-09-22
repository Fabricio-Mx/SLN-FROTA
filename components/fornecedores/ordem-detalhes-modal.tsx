"use client"

import { Download, Eye, FileText } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  ORDEM_SERVICO_STATUS_BADGE_CLASS,
  ORDEM_SERVICO_STATUS_LABELS,
  PARCELA_STATUS_BADGE_CLASS,
  PARCELA_STATUS_LABELS,
  formatCondicaoPagamento,
  formatCurrency,
  formatDate,
  getParcelaStatus,
} from "@/lib/fornecedores"
import { cn } from "@/lib/utils"
import type { DriveFile, OrdemServico } from "@/lib/types"

type OrdemDetalhesModalProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  ordem: OrdemServico | null
  fornecedorNome?: string
}

function DriveFileRow({ file }: { file: DriveFile }) {
  return (
    <li className="flex items-center justify-between gap-2 rounded-lg border border-border bg-background px-3 py-2">
      <span className="flex min-w-0 items-center gap-2">
        <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
        <span className="truncate text-xs">{file.name}</span>
      </span>
      <span className="flex shrink-0 items-center gap-1">
        <Button asChild variant="ghost" size="icon" className="h-7 w-7">
          <a
            href={`/api/drive/file/${file.id}`}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`Visualizar ${file.name}`}
            title="Visualizar"
          >
            <Eye className="h-3.5 w-3.5" />
          </a>
        </Button>
        <Button asChild variant="ghost" size="icon" className="h-7 w-7">
          <a
            href={`/api/drive/file/${file.id}?download=1`}
            download={file.name}
            aria-label={`Baixar ${file.name}`}
            title="Baixar"
          >
            <Download className="h-3.5 w-3.5" />
          </a>
        </Button>
      </span>
    </li>
  )
}

function FileGroup({ files }: { files: DriveFile[] }) {
  if (files.length === 0) {
    return <p className="text-xs text-muted-foreground">Nenhum arquivo anexado.</p>
  }

  return (
    <ul className="space-y-2">
      {files.map((file) => (
        <DriveFileRow key={file.id} file={file} />
      ))}
    </ul>
  )
}

export function OrdemDetalhesModal({ open, onOpenChange, ordem, fornecedorNome }: OrdemDetalhesModalProps) {
  const parcelas = ordem?.boletoParcelas ?? []
  // Ordens antigas guardavam os boletos fora das parcelas.
  const boletosAvulsos = parcelas.length === 0 ? ordem?.boletoArquivos ?? [] : []

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-[640px]">
        <DialogHeader>
          <DialogTitle>Detalhes da Ordem de Serviço</DialogTitle>
          <DialogDescription>
            {ordem ? `${ordem.placa}${fornecedorNome ? ` — ${fornecedorNome}` : ""}` : ""}
          </DialogDescription>
        </DialogHeader>

        {ordem ? (
          <div className="space-y-5 py-2">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline" className={cn(ORDEM_SERVICO_STATUS_BADGE_CLASS[ordem.status])}>
                {ORDEM_SERVICO_STATUS_LABELS[ordem.status]}
              </Badge>
              {ordem.aprovadoPor ? (
                <span className="text-xs text-muted-foreground">
                  Decidido por {ordem.aprovadoPor}
                  {ordem.aprovadoEm ? ` em ${formatDate(ordem.aprovadoEm)}` : ""}
                </span>
              ) : null}
            </div>

            <section className="space-y-2">
              <h3 className="text-sm font-semibold">Descrição do Serviço</h3>
              <div className="whitespace-pre-line rounded-xl border border-border bg-muted/30 px-3 py-2.5 text-sm">
                {ordem.descricao || "Sem descrição."}
              </div>
            </section>

            <section className="grid gap-2 text-xs sm:grid-cols-2">
              <p>
                <span className="text-muted-foreground">Peças: </span>
                {formatCurrency(ordem.valorPecas)}
              </p>
              <p>
                <span className="text-muted-foreground">Mão de obra: </span>
                {formatCurrency(ordem.valorMaoObra)}
              </p>
              <p>
                <span className="text-muted-foreground">Total: </span>
                <span className="font-semibold">{formatCurrency(ordem.valorTotal)}</span>
              </p>
              <p>
                <span className="text-muted-foreground">KM do veículo: </span>
                {ordem.kmVeiculo === null ? "—" : ordem.kmVeiculo.toLocaleString("pt-BR")}
              </p>
              <p>
                <span className="text-muted-foreground">Abertura: </span>
                {formatDate(ordem.dataAbertura || ordem.createdAt)}
              </p>
              <p>
                <span className="text-muted-foreground">Previsão de entrega: </span>
                {ordem.previsaoEntrega ? formatDate(ordem.previsaoEntrega) : "—"}
              </p>
              <p className="sm:col-span-2">
                <span className="text-muted-foreground">Condição de pagamento: </span>
                {formatCondicaoPagamento(ordem)}
              </p>
            </section>

            {ordem.motivoRejeicao ? (
              <section className="space-y-2">
                <h3 className="text-sm font-semibold">Motivo da rejeição</h3>
                <p className="rounded-xl border border-destructive/30 bg-destructive/5 px-3 py-2.5 text-xs">
                  {ordem.motivoRejeicao}
                </p>
              </section>
            ) : null}

            {ordem.observacoes ? (
              <section className="space-y-2">
                <h3 className="text-sm font-semibold">Observações</h3>
                <p className="whitespace-pre-line rounded-xl border border-border bg-muted/30 px-3 py-2.5 text-xs">
                  {ordem.observacoes}
                </p>
              </section>
            ) : null}

            <section className="space-y-3">
              <h3 className="text-sm font-semibold">Boletos</h3>

              {parcelas.length === 0 ? (
                <FileGroup files={boletosAvulsos} />
              ) : (
                parcelas.map((parcela) => {
                  const status = getParcelaStatus(parcela)

                  return (
                    <div key={parcela.id} className="space-y-2 rounded-xl border border-border bg-muted/20 p-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="text-xs">
                          <span className="font-medium">
                            {parcela.numero}/{parcelas.length}
                          </span>{" "}
                          <span className="text-muted-foreground">
                            {parcela.vencimento ? formatDate(parcela.vencimento) : "sem vencimento"} ·{" "}
                            {formatCurrency(parcela.valor ?? 0)}
                          </span>
                        </span>
                        <Badge
                          variant="outline"
                          className={cn("text-[0.65rem]", PARCELA_STATUS_BADGE_CLASS[status])}
                        >
                          {PARCELA_STATUS_LABELS[status]}
                        </Badge>
                      </div>
                      <FileGroup files={parcela.arquivos ?? []} />
                    </div>
                  )
                })
              )}
            </section>

            <section className="space-y-3">
              <h3 className="text-sm font-semibold">Nota Fiscal</h3>
              <div className="grid gap-2 text-xs sm:grid-cols-3">
                <p>
                  <span className="text-muted-foreground">Número: </span>
                  {ordem.notaFiscalNumero || "—"}
                </p>
                <p>
                  <span className="text-muted-foreground">Emissão: </span>
                  {ordem.notaFiscalEmissao ? formatDate(ordem.notaFiscalEmissao) : "—"}
                </p>
                <p>
                  <span className="text-muted-foreground">Valor: </span>
                  {ordem.notaFiscalValor === null ? "—" : formatCurrency(ordem.notaFiscalValor)}
                </p>
              </div>
              <FileGroup files={ordem.notaFiscalArquivos ?? []} />
            </section>
          </div>
        ) : null}

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Fechar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
