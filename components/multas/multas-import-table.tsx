"use client"

import { useMemo, useState, type ReactNode } from "react"
import { FileText, Loader2, Pencil, RotateCcw, Search, Trash2 } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { cn } from "@/lib/utils"
import {
  MULTA_GRAVIDADE_IMPORT_COLORS,
  MULTA_GRAVIDADE_IMPORT_LABELS,
  MULTA_GRAVIDADE_IMPORT_ORDER,
  MULTA_TRATATIVA_COLORS,
  MULTA_TRATATIVA_LABELS,
  MULTA_TRATATIVA_ORDER,
  normalizeMultaSearchText,
  parseMultaLocalDate,
  type MultaGravidadeImportada,
  type MultaImportada,
  type MultaTratativa,
} from "@/lib/multas-import-shared"

export function formatMultaCurrency(value: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value)
}

export function formatMultaDate(value: string | null, withTime = false): string {
  const date = parseMultaLocalDate(value)
  if (!date) return "-"
  return new Intl.DateTimeFormat("pt-BR", withTime ? { dateStyle: "short", timeStyle: "short" } : { dateStyle: "short" }).format(date)
}

export function TratativaBadge({ tratativa, className }: { tratativa: MultaTratativa; className?: string }) {
  const colors = MULTA_TRATATIVA_COLORS[tratativa]
  return (
    <span
      className={cn("inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-0.5 text-xs font-semibold", className)}
      style={{ backgroundColor: colors.soft, borderColor: colors.border, color: colors.text }}
    >
      <span className="h-2 w-2 rounded-full" style={{ backgroundColor: colors.solid }} />
      {MULTA_TRATATIVA_LABELS[tratativa]}
    </span>
  )
}

function GravidadeBadge({ gravidade }: { gravidade: MultaGravidadeImportada | null }) {
  if (!gravidade) return <span className="text-xs text-slate-400">-</span>
  return (
    <span className="inline-flex items-center gap-1 text-xs font-medium text-slate-600">
      <span className="h-2 w-2 rounded-full" style={{ backgroundColor: MULTA_GRAVIDADE_IMPORT_COLORS[gravidade] }} />
      {MULTA_GRAVIDADE_IMPORT_LABELS[gravidade]}
    </span>
  )
}

function DescontoValue({ value }: { value: number | null }) {
  if (value === null) return <span className="text-slate-400">-</span>
  if (value < 0) return <span className="font-semibold text-[#b45309]">{formatMultaCurrency(value)}</span>
  return <span className="font-semibold text-[#2f6b2a]">{formatMultaCurrency(value)}</span>
}

function OrigemBadge({ record }: { record: MultaImportada }) {
  if (record.origem === "manual") {
    return (
      <span className="rounded-full border border-violet-200 bg-violet-50 px-1.5 py-0 text-[0.65rem] font-semibold text-violet-700">
        Manual
      </span>
    )
  }
  if (record.editadoEm) {
    return (
      <span
        className="rounded-full border border-sky-200 bg-sky-50 px-1.5 py-0 text-[0.65rem] font-semibold text-sky-700"
        title={`Editada em ${new Date(record.editadoEm).toLocaleString("pt-BR")}${record.editadoPor ? ` por ${record.editadoPor}` : ""}`}
      >
        Editada
      </span>
    )
  }
  return null
}

export type MultaRowActions = {
  onEdit: (record: MultaImportada) => void
  onRestaurar: (record: MultaImportada) => Promise<void>
  onDelete: (record: MultaImportada) => Promise<void>
  onTermo: (record: MultaImportada) => Promise<void>
}

/** "DESCONTO ENVIADO PARA O RH NO DIA 06/04/2026", igual ao texto usado na planilha. */
export function envioRhTexto(record: MultaImportada): string | null {
  return record.envioRhEm ? `Desconto enviado para o RH no dia ${formatMultaDate(record.envioRhEm)}` : null
}

type MultasImportTableProps = {
  records: MultaImportada[]
  tratativaFilter: "todas" | MultaTratativa
  onTratativaFilterChange: (value: "todas" | MultaTratativa) => void
  /** Quando informado, habilita editar/restaurar/excluir. */
  actions?: MultaRowActions
  headerAction?: ReactNode
}

export function MultasImportTable({ records, tratativaFilter, onTratativaFilterChange, actions, headerAction }: MultasImportTableProps) {
  const [search, setSearch] = useState("")
  const [gravidadeFilter, setGravidadeFilter] = useState<"todas" | MultaGravidadeImportada>("todas")
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const selected = useMemo(() => records.find((record) => record.id === selectedId) ?? null, [records, selectedId])

  const tratativaCounts = useMemo(() => {
    const counts = new Map<MultaTratativa, number>()
    for (const record of records) counts.set(record.tratativa, (counts.get(record.tratativa) ?? 0) + 1)
    return counts
  }, [records])

  const filtered = useMemo(() => {
    const tokens = normalizeMultaSearchText(search).split(/\s+/).filter(Boolean)

    return records.filter((record) => {
      if (tratativaFilter !== "todas" && record.tratativa !== tratativaFilter) return false
      if (gravidadeFilter !== "todas" && record.gravidade !== gravidadeFilter) return false
      if (tokens.length === 0) return true

      const haystack = normalizeMultaSearchText(
        [
          record.placa,
          record.modelo,
          record.condutor,
          record.centroCusto,
          record.ait,
          record.codigoInfracao,
          record.descricaoInfracao,
          record.orgao,
          record.situacaoIndicacao,
          record.observacoes,
        ].join(" "),
      )
      return tokens.every((token) => haystack.includes(token))
    })
  }, [gravidadeFilter, records, search, tratativaFilter])

  const filteredTotal = useMemo(() => filtered.reduce((sum, record) => sum + record.valorFaturado, 0), [filtered])
  const visibleTratativas = MULTA_TRATATIVA_ORDER.filter((tratativa) => tratativa !== "sem_classificacao" || tratativaCounts.has(tratativa))

  return (
    <Card className="overflow-hidden border-[#d8dfd1] shadow-sm">
      <CardHeader className="space-y-4 border-b border-[#e2eadc] bg-[linear-gradient(180deg,#fbfcfa_0%,#f4f7f1_100%)] pb-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="text-lg text-slate-900">Multas do período</CardTitle>
            <p className="mt-1 text-sm text-slate-500">
              {filtered.length} de {records.length} multa(s) · {formatMultaCurrency(filteredTotal)} faturado
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Placa, condutor, AIT, centro de custo..."
                className="w-[280px] bg-white pl-9"
              />
            </div>
            <Select value={gravidadeFilter} onValueChange={(value) => setGravidadeFilter(value as typeof gravidadeFilter)}>
              <SelectTrigger className="w-[160px] bg-white">
                <SelectValue placeholder="Gravidade" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todas">Todas gravidades</SelectItem>
                {MULTA_GRAVIDADE_IMPORT_ORDER.map((gravidade) => (
                  <SelectItem key={gravidade} value={gravidade}>
                    {MULTA_GRAVIDADE_IMPORT_LABELS[gravidade]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {headerAction}
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => onTratativaFilterChange("todas")}
            className={cn(
              "rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors",
              tratativaFilter === "todas" ? "border-slate-700 bg-slate-800 text-white" : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50",
            )}
          >
            Todas · {records.length}
          </button>
          {visibleTratativas.map((tratativa) => {
            const colors = MULTA_TRATATIVA_COLORS[tratativa]
            const isActive = tratativaFilter === tratativa
            return (
              <button
                key={tratativa}
                type="button"
                onClick={() => onTratativaFilterChange(isActive ? "todas" : tratativa)}
                className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors"
                style={
                  isActive
                    ? { backgroundColor: colors.solid, borderColor: colors.solid, color: "#fff" }
                    : { backgroundColor: colors.soft, borderColor: colors.border, color: colors.text }
                }
              >
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: isActive ? "#fff" : colors.solid }} />
                {MULTA_TRATATIVA_LABELS[tratativa]} · {tratativaCounts.get(tratativa) ?? 0}
              </button>
            )
          })}
        </div>
      </CardHeader>

      <CardContent className="p-0">
        <div className="max-h-[640px] overflow-auto">
          <Table>
            <TableHeader className="sticky top-0 z-10 bg-[#f6faf3]">
              <TableRow className="hover:bg-[#f6faf3]">
                <TableHead className="w-[150px]">Tratativa</TableHead>
                <TableHead>Data</TableHead>
                <TableHead>Veículo</TableHead>
                <TableHead>Infração</TableHead>
                <TableHead>Condutor</TableHead>
                <TableHead>Situação da indicação</TableHead>
                <TableHead className="text-right">Faturado</TableHead>
                <TableHead className="text-right">Desconto RH</TableHead>
                {actions ? <TableHead className="w-[92px]" /> : null}
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((record) => (
                <TableRow
                  key={record.id}
                  className="cursor-pointer align-top"
                  style={{ boxShadow: `inset 4px 0 0 ${MULTA_TRATATIVA_COLORS[record.tratativa].solid}` }}
                  onClick={() => setSelectedId(record.id)}
                >
                  <TableCell>
                    <TratativaBadge tratativa={record.tratativa} />
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-sm text-slate-700">{formatMultaDate(record.dataInfracao, true)}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1.5">
                      <span className="font-semibold text-slate-900">{record.placa}</span>
                      <OrigemBadge record={record} />
                    </div>
                    <div className="max-w-[200px] truncate text-xs text-slate-500" title={record.modelo}>
                      {record.modelo || "-"}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="max-w-[260px] truncate text-sm text-slate-800" title={record.descricaoInfracao}>
                      {record.descricaoInfracao || "-"}
                    </div>
                    <div className="mt-0.5 flex items-center gap-2 text-xs text-slate-500">
                      <GravidadeBadge gravidade={record.gravidade} />
                      {record.pontos !== null ? <span>· {record.pontos} pts</span> : null}
                      {record.tipoRegistro ? <span>· {record.tipoRegistro === "MULTA" ? "Multa" : "Notificação"}</span> : null}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="max-w-[220px] truncate text-sm text-slate-800" title={record.condutor}>
                      {record.condutor || "-"}
                    </div>
                    <div className="max-w-[220px] truncate text-xs text-slate-500" title={record.centroCusto}>
                      {record.centroCusto || "Sem centro de custo"}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="max-w-[220px] truncate text-sm text-slate-700" title={record.situacaoIndicacao}>
                      {record.situacaoIndicacao || "-"}
                    </div>
                    <div className="text-xs text-slate-500">Limite: {formatMultaDate(record.dataLimiteEnvio)}</div>
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-right font-semibold text-slate-900">
                    {formatMultaCurrency(record.valorFaturado)}
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-right">
                    <DescontoValue value={record.descontoRh} />
                    {record.envioRhEm ? (
                      <div className="mt-0.5 text-[0.7rem] font-medium text-emerald-700" title={envioRhTexto(record) ?? undefined}>
                        Enviado ao RH {formatMultaDate(record.envioRhEm)}
                      </div>
                    ) : null}
                  </TableCell>
                  {actions ? (
                    <TableCell className="whitespace-nowrap text-right">
                      {record.condutor ? (
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8 text-slate-500 hover:text-slate-900"
                          title="Gerar termo de desconto (PDF)"
                          onClick={(event) => {
                            event.stopPropagation()
                            void actions.onTermo(record)
                          }}
                        >
                          <FileText className="h-4 w-4" />
                        </Button>
                      ) : null}
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 text-slate-500 hover:text-slate-900"
                        title="Editar multa"
                        onClick={(event) => {
                          event.stopPropagation()
                          actions.onEdit(record)
                        }}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  ) : null}
                </TableRow>
              ))}
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={actions ? 9 : 8} className="py-10 text-center text-sm text-muted-foreground">
                    Nenhuma multa encontrada com os filtros atuais.
                  </TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
        </div>
      </CardContent>

      <MultaImportadaDetailDialog record={selected} actions={actions} onOpenChange={(open) => !open && setSelectedId(null)} />
    </Card>
  )
}

function DetailField({ label, value, className }: { label: string; value: ReactNode; className?: string }) {
  return (
    <div className={cn("rounded-xl border border-slate-200 bg-white px-3 py-2", className)}>
      <div className="text-[0.7rem] font-semibold uppercase tracking-[0.1em] text-slate-400">{label}</div>
      <div className="mt-0.5 text-sm text-slate-800">{value || "-"}</div>
    </div>
  )
}

function MultaImportadaDetailDialog({
  record,
  actions,
  onOpenChange,
}: {
  record: MultaImportada | null
  actions?: MultaRowActions
  onOpenChange: (open: boolean) => void
}) {
  const [busy, setBusy] = useState<"restaurar" | "excluir" | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const run = async (kind: "restaurar" | "excluir", action: () => Promise<void>) => {
    setBusy(kind)
    try {
      await action()
      if (kind === "excluir") onOpenChange(false)
    } finally {
      setBusy(null)
      setConfirmDelete(false)
    }
  }

  return (
    <Dialog
      open={!!record}
      onOpenChange={(open) => {
        if (!open) setConfirmDelete(false)
        onOpenChange(open)
      }}
    >
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
        {record ? (
          <>
            <DialogHeader>
              <div className="flex flex-wrap items-center gap-2">
                <TratativaBadge tratativa={record.tratativa} />
                <Badge variant="outline">{record.tipoRegistro === "MULTA" ? "Multa" : "Notificação"}</Badge>
                <OrigemBadge record={record} />
                <span className="text-xs text-slate-400">
                  {record.origem === "manual" ? "Cadastrada no sistema" : `Linha ${record.linha} da planilha`}
                  {record.editadoEm
                    ? ` · ${record.origem === "manual" ? "salva" : "editada"} em ${new Date(record.editadoEm).toLocaleString("pt-BR", {
                        dateStyle: "short",
                        timeStyle: "short",
                      })}${record.editadoPor ? ` por ${record.editadoPor}` : ""}`
                    : ""}
                </span>
              </div>
              <DialogTitle className="text-xl">
                {record.placa} · {record.descricaoInfracao || "Infração"}
              </DialogTitle>
              <DialogDescription>
                AIT {record.ait || "-"} · {formatMultaDate(record.dataInfracao, true)} · {record.orgao || "Órgão não informado"}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <section>
                <h4 className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Infração</h4>
                <div className="grid gap-2 sm:grid-cols-3">
                  <DetailField label="Modelo" value={record.modelo} className="sm:col-span-2" />
                  <DetailField label="Código" value={record.codigoInfracao} />
                  <DetailField label="Gravidade" value={<GravidadeBadge gravidade={record.gravidade} />} />
                  <DetailField label="Pontos" value={record.pontos ?? "-"} />
                  <DetailField label="Órgão" value={record.orgao} />
                  {record.localInfracao ? <DetailField label="Local da infração" value={record.localInfracao} className="sm:col-span-3" /> : null}
                </div>
              </section>

              <section>
                <h4 className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Processo de indicação</h4>
                <div className="grid gap-2 sm:grid-cols-3">
                  <DetailField label="Condutor indicado" value={record.condutor} className="sm:col-span-2" />
                  <DetailField label="Centro de custo" value={record.centroCusto} />
                  <DetailField label="Situação" value={record.situacaoIndicacao} className="sm:col-span-3" />
                  <DetailField label="Recebimento notificação" value={formatMultaDate(record.recebimentoNotificacao, true)} />
                  <DetailField label="Envio ao cliente" value={formatMultaDate(record.envioNotificacaoCliente, true)} />
                  <DetailField label="Docs enviados à locadora" value={formatMultaDate(record.dataDocsEnviados, true)} />
                  <DetailField label="Data limite envio docs" value={formatMultaDate(record.dataLimiteEnvio)} />
                </div>
              </section>

              <section>
                <h4 className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Financeiro</h4>
                <div className="grid gap-2 sm:grid-cols-4">
                  <DetailField label="Valor infração" value={formatMultaCurrency(record.valorInfracao)} />
                  <DetailField label="Valor NIC" value={formatMultaCurrency(record.valorNic)} />
                  <DetailField label="Valor faturado" value={<strong>{formatMultaCurrency(record.valorFaturado)}</strong>} />
                  <DetailField label="Desconto RH" value={<DescontoValue value={record.descontoRh} />} />
                  <DetailField
                    label="Envio ao RH"
                    className="sm:col-span-4"
                    value={
                      record.envioRhEm ? (
                        <span className="font-semibold uppercase text-emerald-700">{envioRhTexto(record)}</span>
                      ) : (
                        <span className="text-slate-400">Desconto ainda não enviado ao RH</span>
                      )
                    }
                  />
                </div>
              </section>

              {record.observacoes ? (
                <section>
                  <h4 className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Observações</h4>
                  <p className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">{record.observacoes}</p>
                </section>
              ) : null}
            </div>

            {actions ? (
              <DialogFooter className="flex-wrap gap-2 sm:justify-between">
                <div className="flex flex-wrap gap-2">
                  {record.origem === "manual" ? (
                    confirmDelete ? (
                      <>
                        <Button
                          type="button"
                          variant="destructive"
                          disabled={busy !== null}
                          onClick={() => run("excluir", () => actions.onDelete(record))}
                          className="gap-2"
                        >
                          {busy === "excluir" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                          Confirmar exclusão
                        </Button>
                        <Button type="button" variant="ghost" disabled={busy !== null} onClick={() => setConfirmDelete(false)}>
                          Cancelar
                        </Button>
                      </>
                    ) : (
                      <Button type="button" variant="outline" className="gap-2 text-red-600 hover:text-red-700" onClick={() => setConfirmDelete(true)}>
                        <Trash2 className="h-4 w-4" />
                        Excluir
                      </Button>
                    )
                  ) : record.editadoEm ? (
                    <Button
                      type="button"
                      variant="outline"
                      className="gap-2"
                      disabled={busy !== null}
                      title="Descarta as alterações feitas no sistema e volta aos valores da planilha"
                      onClick={() => run("restaurar", () => actions.onRestaurar(record))}
                    >
                      {busy === "restaurar" ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />}
                      Restaurar valores da planilha
                    </Button>
                  ) : null}
                </div>
                <div className="flex flex-wrap gap-2">
                  {record.condutor ? (
                    <Button
                      type="button"
                      variant="outline"
                      className="gap-2"
                      disabled={busy !== null}
                      onClick={() => {
                        onOpenChange(false)
                        void actions.onTermo(record)
                      }}
                    >
                      <FileText className="h-4 w-4" />
                      Termo de desconto (PDF)
                    </Button>
                  ) : null}
                  <Button
                    type="button"
                    className="gap-2 bg-[#4f8f57] hover:bg-[#437a4a]"
                    onClick={() => {
                      onOpenChange(false)
                      actions.onEdit(record)
                    }}
                  >
                    <Pencil className="h-4 w-4" />
                    Editar
                  </Button>
                </div>
              </DialogFooter>
            ) : null}
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  )
}
