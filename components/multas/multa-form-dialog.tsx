"use client"

import { useEffect, useMemo, useState, type ReactNode } from "react"
import { BookOpenCheck, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { useColaboradores } from "@/hooks/use-colaboradores"
import { useVehicles } from "@/hooks/use-vehicles"
import { buscarInfracoes, type InfracaoCtb } from "@/lib/infracoes-ctb"
import {
  MULTA_FONTE_LABELS,
  MULTA_GRAVIDADE_IMPORT_LABELS,
  MULTA_GRAVIDADE_IMPORT_ORDER,
  MULTA_PONTOS_POR_GRAVIDADE,
  MULTA_SITUACAO_OPCOES,
  MULTA_TRATATIVA_LABELS,
  MULTA_TRATATIVA_ORDER,
  normalizeMultaSearchText,
  type MultaCamposEditaveis,
  type MultaFonte,
  type MultaGravidadeImportada,
  type MultaImportada,
  type MultaTratativa,
} from "@/lib/multas-import-shared"

type FormState = {
  tratativa: MultaTratativa
  tipoRegistro: string
  placa: string
  modelo: string
  dataInfracao: string
  ait: string
  orgao: string
  localInfracao: string
  codigoInfracao: string
  descricaoInfracao: string
  gravidade: MultaGravidadeImportada | ""
  pontos: string
  condutor: string
  centroCusto: string
  situacaoIndicacao: string
  recebimentoNotificacao: string
  envioNotificacaoCliente: string
  dataDocsEnviados: string
  dataLimiteEnvio: string
  valorInfracao: string
  valorNic: string
  valorFaturado: string
  descontoRh: string
  envioRhEm: string
  observacoes: string
}

const NOTIFICACAO = "NOTIFICAÇÃO"

function toDateTimeInput(value: string | null | undefined): string {
  if (!value) return ""
  return value.length === 10 ? `${value}T00:00` : value.slice(0, 16)
}

function toDateInput(value: string | null | undefined): string {
  return value ? value.slice(0, 10) : ""
}

function toMoneyInput(value: number | null | undefined): string {
  return value === null || value === undefined ? "" : value.toFixed(2).replace(".", ",")
}

function formatBrDate(value: string): string {
  const [year, month, day] = value.split("-")
  return year && month && day ? `${day}/${month}/${year}` : value
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value)
}

/** Aceita "1.234,56", "1234,56" e "1234.56". */
function parseMoney(value: string): number | null {
  const text = value.trim().replace(/[R$\s]/g, "")
  if (!text) return null
  const normalized = text.includes(",") ? text.replace(/\./g, "").replace(",", ".") : text
  const parsed = Number(normalized)
  return Number.isFinite(parsed) ? parsed : null
}

function buildInitialState(record: MultaImportada | null): FormState {
  return {
    tratativa: record?.tratativa ?? "tratando",
    tipoRegistro: record?.tipoRegistro || NOTIFICACAO,
    placa: record?.placa ?? "",
    modelo: record?.modelo ?? "",
    dataInfracao: toDateTimeInput(record?.dataInfracao),
    ait: record?.ait ?? "",
    orgao: record?.orgao ?? "",
    localInfracao: record?.localInfracao ?? "",
    codigoInfracao: record?.codigoInfracao ?? "",
    descricaoInfracao: record?.descricaoInfracao ?? "",
    gravidade: record?.gravidade ?? "",
    pontos: record?.pontos === null || record?.pontos === undefined ? "" : String(record.pontos),
    condutor: record?.condutor ?? "",
    centroCusto: record?.centroCusto ?? "",
    situacaoIndicacao: record?.situacaoIndicacao ?? MULTA_SITUACAO_OPCOES[0],
    recebimentoNotificacao: toDateTimeInput(record?.recebimentoNotificacao),
    envioNotificacaoCliente: toDateTimeInput(record?.envioNotificacaoCliente),
    dataDocsEnviados: toDateTimeInput(record?.dataDocsEnviados),
    dataLimiteEnvio: toDateInput(record?.dataLimiteEnvio),
    valorInfracao: toMoneyInput(record?.valorInfracao),
    valorNic: toMoneyInput(record?.valorNic),
    valorFaturado: record ? toMoneyInput(record.valorFaturado) : "",
    descontoRh: toMoneyInput(record?.descontoRh),
    envioRhEm: toDateInput(record?.envioRhEm),
    observacoes: record?.observacoes ?? "",
  }
}

function Field({ label, htmlFor, className, children }: { label: string; htmlFor?: string; className?: string; children: ReactNode }) {
  return (
    <div className={className}>
      <Label htmlFor={htmlFor} className="mb-1 block text-xs font-medium text-slate-600">
        {label}
      </Label>
      {children}
    </div>
  )
}

type MultaFormDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  fonte: MultaFonte
  /** Multa a editar; `null` cadastra uma nova. */
  record: MultaImportada | null
  /** Multas existentes, usadas para sugerir centros de custo. */
  sugestoes: MultaImportada[]
  onSubmit: (campos: MultaCamposEditaveis, gerarTermo: boolean) => Promise<void>
}

export function MultaFormDialog({ open, onOpenChange, fonte, record, sugestoes, onSubmit }: MultaFormDialogProps) {
  const { vehicles } = useVehicles(open)
  const { colaboradores } = useColaboradores(open)
  const [form, setForm] = useState<FormState>(() => buildInitialState(record))
  const [gerarTermo, setGerarTermo] = useState(true)
  const [infracaoSelecionada, setInfracaoSelecionada] = useState<InfracaoCtb | null>(null)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  useEffect(() => {
    if (open) {
      setForm(buildInitialState(record))
      setGerarTermo(true)
      setInfracaoSelecionada(null)
      setFormError(null)
    }
  }, [open, record])

  const opcoesInfracao = useMemo(() => buscarInfracoes(form.codigoInfracao), [form.codigoInfracao])

  const situacoes = useMemo(() => {
    const options: string[] = [...MULTA_SITUACAO_OPCOES]
    // Mantém a situação vinda da planilha visível para não alterá-la sem querer.
    if (form.situacaoIndicacao && !options.includes(form.situacaoIndicacao)) options.push(form.situacaoIndicacao)
    return options
  }, [form.situacaoIndicacao])

  const centros = useMemo(
    () =>
      Array.from(
        new Set([...sugestoes.map((item) => item.centroCusto), ...colaboradores.map((item) => item.centroCusto)].filter(Boolean)),
      ).sort(),
    [colaboradores, sugestoes],
  )

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => setForm((current) => ({ ...current, [key]: value }))

  const aplicarInfracao = (infracao: InfracaoCtb) => {
    setInfracaoSelecionada(infracao)
    setForm((current) => ({
      ...current,
      codigoInfracao: infracao.codigo,
      descricaoInfracao: infracao.descricao.toUpperCase(),
      gravidade: infracao.gravidade ?? "",
      pontos: infracao.pontos === null ? "" : String(infracao.pontos),
      valorInfracao: infracao.valor === null ? current.valorInfracao : toMoneyInput(infracao.valor),
    }))
  }

  const handleCodigo = (value: string) => {
    const cleaned = value.replace(/[^\d-\s]/g, "").slice(0, 7)
    setInfracaoSelecionada(null)
    setForm((current) => ({ ...current, codigoInfracao: cleaned }))
    const matches = buscarInfracoes(cleaned)
    if (matches.length === 1) aplicarInfracao(matches[0])
  }

  const handlePlaca = (value: string) => {
    const placa = value.toUpperCase().replace(/[^A-Z0-9]/g, "")
    const vehicle = vehicles.find((item) => item.placa.toUpperCase().replace(/[^A-Z0-9]/g, "") === placa)
    setForm((current) => ({ ...current, placa, modelo: vehicle && !current.modelo ? vehicle.modelo : current.modelo }))
  }

  const handleCondutor = (value: string) => {
    const colaborador = colaboradores.find((item) => normalizeMultaSearchText(item.nome) === normalizeMultaSearchText(value))
    setForm((current) => ({
      ...current,
      condutor: value,
      centroCusto: colaborador?.centroCusto && !current.centroCusto ? colaborador.centroCusto : current.centroCusto,
    }))
  }

  const handleGravidade = (value: MultaGravidadeImportada) => {
    setForm((current) => {
      const pontosAnteriores = current.gravidade ? String(MULTA_PONTOS_POR_GRAVIDADE[current.gravidade]) : ""
      const atualizaPontos = !current.pontos || current.pontos === pontosAnteriores
      return { ...current, gravidade: value, pontos: atualizaPontos ? String(MULTA_PONTOS_POR_GRAVIDADE[value]) : current.pontos }
    })
  }

  const faturadoCalculado = (parseMoney(form.valorInfracao) ?? 0) + (parseMoney(form.valorNic) ?? 0)
  const podeGerarTermo = form.condutor.trim().length > 0

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    setFormError(null)

    if (!form.placa) return setFormError("Informe a placa do veículo.")
    if (!form.dataInfracao) return setFormError("Informe a data da infração.")

    const campos: MultaCamposEditaveis = {
      tratativa: form.tratativa,
      tipoRegistro: form.tipoRegistro,
      placa: form.placa,
      modelo: form.modelo,
      dataInfracao: form.dataInfracao,
      ait: form.ait,
      orgao: form.orgao,
      localInfracao: form.localInfracao,
      codigoInfracao: form.codigoInfracao.trim(),
      descricaoInfracao: form.descricaoInfracao,
      gravidade: form.gravidade || null,
      pontos: form.pontos ? Number(form.pontos) : null,
      condutor: form.condutor,
      centroCusto: form.centroCusto,
      situacaoIndicacao: form.situacaoIndicacao,
      recebimentoNotificacao: form.recebimentoNotificacao || null,
      envioNotificacaoCliente: form.envioNotificacaoCliente || null,
      dataDocsEnviados: form.dataDocsEnviados || null,
      dataLimiteEnvio: form.dataLimiteEnvio || null,
      valorInfracao: parseMoney(form.valorInfracao) ?? 0,
      valorNic: parseMoney(form.valorNic) ?? 0,
      valorFaturado: parseMoney(form.valorFaturado) ?? faturadoCalculado,
      descontoRh: parseMoney(form.descontoRh),
      envioRhEm: form.envioRhEm || null,
      observacoes: form.observacoes,
    }

    setSaving(true)
    try {
      await onSubmit(campos, gerarTermo && podeGerarTermo)
      onOpenChange(false)
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "Não foi possível salvar a multa.")
    } finally {
      setSaving(false)
    }
  }

  const isImportada = !!record && record.origem !== "manual"
  const infracaoInfo = infracaoSelecionada ?? (opcoesInfracao.length === 1 ? opcoesInfracao[0] : null)

  return (
    <Dialog open={open} onOpenChange={(value) => !saving && onOpenChange(value)}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{record ? `Editar multa · ${record.placa}` : "Nova multa"}</DialogTitle>
          <DialogDescription>
            {record
              ? isImportada
                ? "As alterações ficam salvas no sistema e continuam valendo mesmo depois de importar a planilha novamente."
                : "Multa cadastrada manualmente."
              : `Cadastro manual em ${MULTA_FONTE_LABELS[fonte]}. Multas manuais não são apagadas ao importar a planilha.`}
          </DialogDescription>
        </DialogHeader>

        <form id="multa-form" onSubmit={handleSubmit} className="space-y-5">
          <section className="space-y-3">
            <h4 className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Infração</h4>
            <div className="grid gap-3 sm:grid-cols-4">
              <Field label="Código da infração" htmlFor="multa-codigo">
                <Input
                  id="multa-codigo"
                  inputMode="numeric"
                  value={form.codigoInfracao}
                  onChange={(event) => handleCodigo(event.target.value)}
                  placeholder="Ex.: 7455"
                  autoFocus={!record}
                />
              </Field>
              {opcoesInfracao.length > 1 ? (
                <Field label="Desdobramento" className="sm:col-span-3">
                  <Select
                    value={infracaoSelecionada?.chave ?? ""}
                    onValueChange={(chave) => {
                      const infracao = opcoesInfracao.find((item) => item.chave === chave)
                      if (infracao) aplicarInfracao(infracao)
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={`${opcoesInfracao.length} variações deste código — escolha a infração`} />
                    </SelectTrigger>
                    <SelectContent>
                      {opcoesInfracao.map((item) => (
                        <SelectItem key={item.chave} value={item.chave}>
                          {item.chave} · {item.descricao}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
              ) : (
                <Field label="Descrição da infração" htmlFor="multa-descricao" className="sm:col-span-3">
                  <Input
                    id="multa-descricao"
                    value={form.descricaoInfracao}
                    onChange={(event) => set("descricaoInfracao", event.target.value)}
                    placeholder="Preenchida automaticamente pelo código"
                  />
                </Field>
              )}
              {opcoesInfracao.length > 1 ? (
                <Field label="Descrição da infração" htmlFor="multa-descricao" className="sm:col-span-4">
                  <Input
                    id="multa-descricao"
                    value={form.descricaoInfracao}
                    onChange={(event) => set("descricaoInfracao", event.target.value)}
                  />
                </Field>
              ) : null}

              {infracaoInfo ? (
                <div className="flex items-start gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800 sm:col-span-4">
                  <BookOpenCheck className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>
                    <strong>{infracaoInfo.chave}</strong> · Art. {infracaoInfo.amparo} do CTB · Infrator: {infracaoInfo.infrator}
                    {infracaoInfo.gravidade ? ` · ${MULTA_GRAVIDADE_IMPORT_LABELS[infracaoInfo.gravidade]}` : ""}
                    {infracaoInfo.multiplicador !== 1 ? ` (x${infracaoInfo.multiplicador})` : ""}
                    {infracaoInfo.pontos !== null ? ` · ${infracaoInfo.pontos} pts` : ""}
                    {infracaoInfo.valor !== null ? ` · ${formatCurrency(infracaoInfo.valor)}` : " · valor variável"}
                  </span>
                </div>
              ) : form.codigoInfracao.replace(/\D/g, "").length >= 4 && opcoesInfracao.length === 0 ? (
                <p className="text-xs text-amber-700 sm:col-span-4">Código não encontrado na tabela oficial do CTB. Preencha a descrição manualmente.</p>
              ) : null}

              <Field label="Gravidade">
                <Select value={form.gravidade} onValueChange={(value) => handleGravidade(value as MultaGravidadeImportada)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    {MULTA_GRAVIDADE_IMPORT_ORDER.map((gravidade) => (
                      <SelectItem key={gravidade} value={gravidade}>
                        {MULTA_GRAVIDADE_IMPORT_LABELS[gravidade]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Pontos" htmlFor="multa-pontos">
                <Input id="multa-pontos" type="number" min={0} value={form.pontos} onChange={(event) => set("pontos", event.target.value)} />
              </Field>
              <Field label="Valor da infração (R$)" htmlFor="multa-valor">
                <Input
                  id="multa-valor"
                  inputMode="decimal"
                  value={form.valorInfracao}
                  onChange={(event) => set("valorInfracao", event.target.value)}
                  placeholder="0,00"
                />
              </Field>
              <Field label="Tipo">
                <Select
                  value={form.tipoRegistro === "MULTA" ? "MULTA" : "NOTIFICACAO"}
                  onValueChange={(value) =>
                    set(
                      "tipoRegistro",
                      value === "MULTA" ? "MULTA" : record?.tipoRegistro && record.tipoRegistro !== "MULTA" ? record.tipoRegistro : NOTIFICACAO,
                    )
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="NOTIFICACAO">Notificação</SelectItem>
                    <SelectItem value="MULTA">Multa</SelectItem>
                  </SelectContent>
                </Select>
              </Field>

              <Field label="Placa *" htmlFor="multa-placa">
                <Input
                  id="multa-placa"
                  list="multa-placas"
                  value={form.placa}
                  onChange={(event) => handlePlaca(event.target.value)}
                  placeholder="ABC1D23"
                  required
                />
                <datalist id="multa-placas">
                  {vehicles.map((vehicle) => (
                    <option key={vehicle.id} value={vehicle.placa}>
                      {vehicle.modelo}
                    </option>
                  ))}
                </datalist>
              </Field>
              <Field label="Modelo" htmlFor="multa-modelo" className="sm:col-span-3">
                <Input id="multa-modelo" value={form.modelo} onChange={(event) => set("modelo", event.target.value)} />
              </Field>
              <Field label="Data e hora da infração *" htmlFor="multa-data" className="sm:col-span-2">
                <Input
                  id="multa-data"
                  type="datetime-local"
                  value={form.dataInfracao}
                  onChange={(event) => set("dataInfracao", event.target.value)}
                  required
                />
              </Field>
              <Field label="AIT" htmlFor="multa-ait">
                <Input id="multa-ait" value={form.ait} onChange={(event) => set("ait", event.target.value.toUpperCase())} />
              </Field>
              <Field label="Órgão" htmlFor="multa-orgao">
                <Input id="multa-orgao" value={form.orgao} onChange={(event) => set("orgao", event.target.value)} />
              </Field>
              <Field label="Local da infração" htmlFor="multa-local" className="sm:col-span-4">
                <Input
                  id="multa-local"
                  value={form.localInfracao}
                  onChange={(event) => set("localInfracao", event.target.value)}
                  placeholder="Ex.: MGC491 KM 75,40 GUAXUPE - BORDO DIREITO"
                />
              </Field>
            </div>
          </section>

          <section className="space-y-3">
            <h4 className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Tratativa e indicação</h4>
            <div className="grid gap-3 sm:grid-cols-4">
              <Field label="Status da tratativa">
                <Select value={form.tratativa} onValueChange={(value) => set("tratativa", value as MultaTratativa)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {MULTA_TRATATIVA_ORDER.map((tratativa) => (
                      <SelectItem key={tratativa} value={tratativa}>
                        {MULTA_TRATATIVA_LABELS[tratativa]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Condutor" htmlFor="multa-condutor" className="sm:col-span-2">
                <Input id="multa-condutor" list="multa-condutores" value={form.condutor} onChange={(event) => handleCondutor(event.target.value)} />
                <datalist id="multa-condutores">
                  {colaboradores.map((colaborador) => (
                    <option key={colaborador.id} value={colaborador.nome} />
                  ))}
                </datalist>
              </Field>
              <Field label="Centro de custo" htmlFor="multa-centro">
                <Input id="multa-centro" list="multa-centros" value={form.centroCusto} onChange={(event) => set("centroCusto", event.target.value)} />
                <datalist id="multa-centros">
                  {centros.map((centro) => (
                    <option key={centro} value={centro} />
                  ))}
                </datalist>
              </Field>
              <Field label="Situação da indicação" className="sm:col-span-2">
                <Select value={form.situacaoIndicacao} onValueChange={(value) => set("situacaoIndicacao", value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    {situacoes.map((situacao) => (
                      <SelectItem key={situacao} value={situacao}>
                        {situacao}
                        {!(MULTA_SITUACAO_OPCOES as readonly string[]).includes(situacao) ? " (da planilha)" : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Data limite envio docs" htmlFor="multa-limite">
                <Input id="multa-limite" type="date" value={form.dataLimiteEnvio} onChange={(event) => set("dataLimiteEnvio", event.target.value)} />
              </Field>
              <Field label="Recebimento notificação" htmlFor="multa-recebimento">
                <Input
                  id="multa-recebimento"
                  type="datetime-local"
                  value={form.recebimentoNotificacao}
                  onChange={(event) => set("recebimentoNotificacao", event.target.value)}
                />
              </Field>
              <Field label="Envio ao cliente" htmlFor="multa-envio" className="sm:col-span-2">
                <Input
                  id="multa-envio"
                  type="datetime-local"
                  value={form.envioNotificacaoCliente}
                  onChange={(event) => set("envioNotificacaoCliente", event.target.value)}
                />
              </Field>
              <Field label="Docs enviados à locadora" htmlFor="multa-docs" className="sm:col-span-2">
                <Input
                  id="multa-docs"
                  type="datetime-local"
                  value={form.dataDocsEnviados}
                  onChange={(event) => set("dataDocsEnviados", event.target.value)}
                />
              </Field>
            </div>
          </section>

          <section className="space-y-3">
            <h4 className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Financeiro e RH (R$)</h4>
            <div className="grid gap-3 sm:grid-cols-4">
              <Field label="Valor NIC" htmlFor="multa-nic">
                <Input id="multa-nic" inputMode="decimal" value={form.valorNic} onChange={(event) => set("valorNic", event.target.value)} placeholder="0,00" />
              </Field>
              <Field label="Valor faturado" htmlFor="multa-faturado">
                <Input
                  id="multa-faturado"
                  inputMode="decimal"
                  value={form.valorFaturado}
                  onChange={(event) => set("valorFaturado", event.target.value)}
                  placeholder={`${faturadoCalculado.toFixed(2).replace(".", ",")} (infração + NIC)`}
                />
              </Field>
              <Field label="Desconto RH" htmlFor="multa-desconto">
                <Input
                  id="multa-desconto"
                  inputMode="decimal"
                  value={form.descontoRh}
                  onChange={(event) => set("descontoRh", event.target.value)}
                  placeholder="Negativo = perda"
                />
              </Field>
              <Field label="Desconto enviado ao RH em" htmlFor="multa-envio-rh">
                <Input id="multa-envio-rh" type="date" value={form.envioRhEm} onChange={(event) => set("envioRhEm", event.target.value)} />
              </Field>
              {form.envioRhEm ? (
                <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-800 sm:col-span-4">
                  DESCONTO ENVIADO PARA O RH NO DIA {formatBrDate(form.envioRhEm)}
                </p>
              ) : null}
            </div>
          </section>

          <Field label="Observações" htmlFor="multa-obs">
            <Textarea id="multa-obs" rows={3} value={form.observacoes} onChange={(event) => set("observacoes", event.target.value)} />
          </Field>

          <label className="flex items-start gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
            <Checkbox
              checked={gerarTermo && podeGerarTermo}
              disabled={!podeGerarTermo}
              onCheckedChange={(checked) => setGerarTermo(checked === true)}
              className="mt-0.5"
            />
            <span>
              Gerar o <strong>termo de desconto (PDF)</strong> ao salvar
              <span className="block text-xs text-slate-500">
                {podeGerarTermo
                  ? form.localInfracao.trim()
                    ? "O CPF do condutor e o RENAVAM são buscados nos cadastros de colaboradores e veículos."
                    : "O local da infração está vazio — ele será pedido antes de gerar o termo."
                  : "Informe o condutor para gerar o termo."}
              </span>
            </span>
          </label>

          {formError ? <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{formError}</p> : null}
        </form>

        <DialogFooter>
          <Button type="button" variant="outline" disabled={saving} onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button type="submit" form="multa-form" disabled={saving} className="gap-2 bg-[#4f8f57] hover:bg-[#437a4a]">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {record ? "Salvar alterações" : "Cadastrar multa"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
