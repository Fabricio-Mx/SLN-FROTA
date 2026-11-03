"use client"

import { useMemo, useRef, useState } from "react"
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts"
import {
  AlertTriangle,
  CalendarClock,
  CarFront,
  CircleDollarSign,
  Download,
  FileSpreadsheet,
  Gauge,
  HandCoins,
  Loader2,
  ShieldAlert,
  TrendingDown,
  Upload,
} from "lucide-react"
import { toast } from "@/hooks/use-toast"
import { useMultasImportadas } from "@/hooks/use-multas-importadas"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ChartContainer, ChartLegend, ChartLegendContent, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { MultasImportTable, formatMultaCurrency, formatMultaDate } from "@/components/multas/multas-import-table"
import { downloadMultasWorkbook } from "@/lib/multas-import-export"
import {
  MULTA_FONTE_LABELS,
  MULTA_FONTES_SUPORTADAS,
  MULTA_GRAVIDADE_IMPORT_COLORS,
  MULTA_GRAVIDADE_IMPORT_LABELS,
  MULTA_GRAVIDADE_IMPORT_ORDER,
  MULTA_TRATATIVA_COLORS,
  MULTA_TRATATIVA_DESCRIPTIONS,
  MULTA_TRATATIVA_LABELS,
  MULTA_TRATATIVA_ORDER,
  normalizeMultaSearchText,
  parseMultaLocalDate,
  type MultaFonte,
  type MultaImportada,
  type MultaTratativa,
} from "@/lib/multas-import-shared"

type PeriodPreset = "todo" | "mes-atual" | "mes-anterior" | "ultimos-30" | "ultimos-90" | "ano-atual" | "personalizado"

const PERIOD_LABELS: Record<PeriodPreset, string> = {
  todo: "Todo o período",
  "mes-atual": "Mês atual",
  "mes-anterior": "Mês anterior",
  "ultimos-30": "Últimos 30 dias",
  "ultimos-90": "Últimos 90 dias",
  "ano-atual": "Ano atual",
  personalizado: "Personalizado",
}

const CARD_CLASS = "overflow-hidden border-[#d8dfd1] shadow-sm"
const CARD_HEADER_CLASS = "border-b border-[#e2eadc] bg-[linear-gradient(180deg,#fbfcfa_0%,#f4f7f1_100%)] pb-4"
const SECTION_LABEL_CLASS = "text-[0.72rem] font-semibold uppercase tracking-[0.12em] text-slate-500"

const FONTE_DESCRIPTIONS: Record<MultaFonte, string> = {
  localiza: "Carros alugados · Relatório de infrações da Localiza",
  proprio: "Carros próprios · Controle interno de infrações",
}

const monthlyChartConfig = Object.fromEntries(
  MULTA_TRATATIVA_ORDER.map((tratativa) => [tratativa, { label: MULTA_TRATATIVA_LABELS[tratativa], color: MULTA_TRATATIVA_COLORS[tratativa].solid }]),
)

function toInputDate(date: Date): string {
  const pad = (value: number) => `${value}`.padStart(2, "0")
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

function fromInputDate(value: string): Date | null {
  const [year, month, day] = value.split("-").map(Number)
  if (!year || !month || !day) return null
  return new Date(year, month - 1, day)
}

function resolvePeriodRange(preset: PeriodPreset, customStart: string, customEnd: string): { start: Date; end: Date } | null {
  const today = new Date()
  const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate())
  const endOfDay = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999)

  switch (preset) {
    case "todo":
      return null
    case "mes-atual":
      return { start: new Date(today.getFullYear(), today.getMonth(), 1), end: endOfDay(new Date(today.getFullYear(), today.getMonth() + 1, 0)) }
    case "mes-anterior":
      return { start: new Date(today.getFullYear(), today.getMonth() - 1, 1), end: endOfDay(new Date(today.getFullYear(), today.getMonth(), 0)) }
    case "ultimos-30":
      return { start: new Date(startOfToday.getFullYear(), startOfToday.getMonth(), startOfToday.getDate() - 29), end: endOfDay(today) }
    case "ultimos-90":
      return { start: new Date(startOfToday.getFullYear(), startOfToday.getMonth(), startOfToday.getDate() - 89), end: endOfDay(today) }
    case "ano-atual":
      return { start: new Date(today.getFullYear(), 0, 1), end: endOfDay(new Date(today.getFullYear(), 11, 31)) }
    case "personalizado": {
      const start = fromInputDate(customStart)
      const end = fromInputDate(customEnd)
      if (!start && !end) return null
      const safeStart = start ?? new Date(1990, 0, 1)
      const safeEnd = end ?? new Date(2100, 11, 31)
      return safeStart <= safeEnd ? { start: safeStart, end: endOfDay(safeEnd) } : { start: end as Date, end: endOfDay(start as Date) }
    }
  }
}

function formatMonthLabel(key: string): string {
  const [year, month] = key.split("-").map(Number)
  return new Intl.DateTimeFormat("pt-BR", { month: "short", year: "2-digit" })
    .format(new Date(year, month - 1, 1))
    .replace(".", "")
    .replace(/^./, (char) => char.toUpperCase())
}

function groupTop<T>(items: T[], keyOf: (item: T) => string, valueOf: (item: T) => number, limit = 6) {
  const map = new Map<string, { label: string; count: number; value: number }>()
  for (const item of items) {
    const label = keyOf(item)
    const current = map.get(label)
    if (current) {
      current.count += 1
      current.value += valueOf(item)
    } else {
      map.set(label, { label, count: 1, value: valueOf(item) })
    }
  }
  return Array.from(map.values())
    .sort((left, right) => right.count - left.count || right.value - left.value)
    .slice(0, limit)
}

type KpiCardProps = {
  icon: typeof Gauge
  label: string
  value: string
  caption: string
  accent: string
}

function KpiCard({ icon: Icon, label, value, caption, accent }: KpiCardProps) {
  return (
    <Card className={`${CARD_CLASS} bg-white`}>
      <CardContent className="flex items-start gap-3 p-4">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl" style={{ backgroundColor: `${accent}1a`, color: accent }}>
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <p className={SECTION_LABEL_CLASS}>{label}</p>
          <p className="mt-1 truncate text-2xl font-black tracking-tight text-slate-900">{value}</p>
          <p className="mt-0.5 text-xs text-slate-500">{caption}</p>
        </div>
      </CardContent>
    </Card>
  )
}

function RankingCard({
  title,
  description,
  items,
  color,
  valueMode = "count",
}: {
  title: string
  description: string
  items: Array<{ label: string; count: number; value: number }>
  color: string
  valueMode?: "count" | "value"
}) {
  const max = Math.max(1, ...items.map((item) => (valueMode === "count" ? item.count : item.value)))

  return (
    <Card className={CARD_CLASS}>
      <CardHeader className={CARD_HEADER_CLASS}>
        <CardTitle className="text-base text-slate-900">{title}</CardTitle>
        <p className="text-xs text-slate-500">{description}</p>
      </CardHeader>
      <CardContent className="space-y-3 p-4">
        {items.length === 0 ? <p className="py-6 text-center text-sm text-slate-400">Sem dados no período.</p> : null}
        {items.map((item) => {
          const metric = valueMode === "count" ? item.count : item.value
          return (
            <div key={item.label} className="space-y-1">
              <div className="flex items-center justify-between gap-3 text-sm">
                <span className="truncate text-slate-700" title={item.label}>
                  {item.label}
                </span>
                <span className="shrink-0 font-semibold text-slate-900">
                  {valueMode === "count" ? `${item.count}` : formatMultaCurrency(item.value)}
                  <span className="ml-1 text-xs font-normal text-slate-400">
                    {valueMode === "count" ? formatMultaCurrency(item.value) : `${item.count} multa(s)`}
                  </span>
                </span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
                <div className="h-full rounded-full" style={{ width: `${(metric / max) * 100}%`, backgroundColor: color }} />
              </div>
            </div>
          )
        })}
      </CardContent>
    </Card>
  )
}

export function MultasImportPanel({ fonte, canManage }: { fonte: MultaFonte; canManage: boolean }) {
  const { store, isLoading, error, warning, importFile } = useMultasImportadas()
  const [periodPreset, setPeriodPreset] = useState<PeriodPreset>("todo")
  const [customStart, setCustomStart] = useState("")
  const [customEnd, setCustomEnd] = useState("")
  const [tratativaFilter, setTratativaFilter] = useState<"todas" | MultaTratativa>("todas")
  const [isImporting, setIsImporting] = useState(false)
  const [isExporting, setIsExporting] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const batch = store?.batches[fonte] ?? null
  const isSupported = MULTA_FONTES_SUPORTADAS.includes(fonte)
  const periodRange = useMemo(() => resolvePeriodRange(periodPreset, customStart, customEnd), [customEnd, customStart, periodPreset])

  const periodLabel = useMemo(() => {
    if (!periodRange) return PERIOD_LABELS.todo
    return `${formatMultaDate(toInputDate(periodRange.start))} a ${formatMultaDate(toInputDate(periodRange.end))}`
  }, [periodRange])

  const periodRecords = useMemo(() => {
    const records = batch?.records ?? []
    const filtered = periodRange
      ? records.filter((record) => {
          const date = parseMultaLocalDate(record.dataInfracao)
          return !!date && date >= periodRange.start && date <= periodRange.end
        })
      : records

    return [...filtered].sort((left, right) => (right.dataInfracao ?? "").localeCompare(left.dataInfracao ?? ""))
  }, [batch, periodRange])

  const stats = useMemo(() => {
    let valorFaturado = 0
    let valorInfracao = 0
    let valorNic = 0
    let recuperado = 0
    let perda = 0
    let perdaCount = 0
    let pontos = 0
    let multas = 0
    const byTratativa = new Map<MultaTratativa, { count: number; value: number }>()
    const byGravidade = new Map<string, number>()

    for (const record of periodRecords) {
      valorFaturado += record.valorFaturado
      valorInfracao += record.valorInfracao
      valorNic += record.valorNic
      pontos += record.pontos ?? 0
      if (record.tipoRegistro === "MULTA") multas += 1
      if (record.descontoRh !== null && record.descontoRh > 0) recuperado += record.descontoRh
      if (record.descontoRh !== null && record.descontoRh < 0) {
        perda += Math.abs(record.descontoRh)
        perdaCount += 1
      }

      const tratativa = byTratativa.get(record.tratativa) ?? { count: 0, value: 0 }
      tratativa.count += 1
      tratativa.value += record.valorFaturado
      byTratativa.set(record.tratativa, tratativa)

      if (record.gravidade) byGravidade.set(record.gravidade, (byGravidade.get(record.gravidade) ?? 0) + 1)
    }

    return {
      total: periodRecords.length,
      multas,
      notificacoes: periodRecords.length - multas,
      valorFaturado,
      valorInfracao,
      valorNic,
      recuperado,
      perda,
      perdaCount,
      pontos,
      byTratativa,
      byGravidade,
    }
  }, [periodRecords])

  const monthlySeries = useMemo(() => {
    const map = new Map<string, Record<MultaTratativa, number>>()
    for (const record of periodRecords) {
      const key = record.dataInfracao?.slice(0, 7)
      if (!key) continue
      const entry = map.get(key) ?? { tratada: 0, tratando: 0, analise: 0, sem_classificacao: 0 }
      entry[record.tratativa] += 1
      map.set(key, entry)
    }
    return Array.from(map.entries())
      .sort(([left], [right]) => left.localeCompare(right))
      .slice(-12)
      .map(([key, values]) => ({ month: formatMonthLabel(key), ...values }))
  }, [periodRecords])

  const deadlines = useMemo(() => {
    const today = new Date()
    const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate())
    const pending = (batch?.records ?? []).filter((record) => normalizeMultaSearchText(record.situacaoIndicacao).startsWith("pendente"))

    const upcoming = pending
      .map((record) => ({ record, limit: parseMultaLocalDate(record.dataLimiteEnvio) }))
      .filter((item): item is { record: MultaImportada; limit: Date } => !!item.limit && item.limit >= startOfToday)
      .sort((left, right) => left.limit.getTime() - right.limit.getTime())
      .map((item) => ({ ...item, days: Math.round((item.limit.getTime() - startOfToday.getTime()) / 86_400_000) }))

    const expired = (batch?.records ?? []).filter((record) => normalizeMultaSearchText(record.situacaoIndicacao).includes("expirado")).length

    return { upcoming, expired, pendingTotal: pending.length }
  }, [batch])

  const situacoes = useMemo(
    () => groupTop(periodRecords, (record) => record.situacaoIndicacao || "Não informado", (record) => record.valorFaturado, 8),
    [periodRecords],
  )
  const topInfracoes = useMemo(
    () => groupTop(periodRecords, (record) => record.descricaoInfracao || "Não informado", (record) => record.valorFaturado),
    [periodRecords],
  )
  const topCondutores = useMemo(
    () => groupTop(periodRecords, (record) => record.condutor || "Não informado", (record) => record.valorFaturado),
    [periodRecords],
  )
  const topCentros = useMemo(
    () =>
      groupTop(periodRecords, (record) => record.centroCusto || "Sem centro de custo", (record) => record.valorFaturado, 8).sort(
        (left, right) => right.value - left.value,
      ),
    [periodRecords],
  )
  const topPlacas = useMemo(
    () => groupTop(periodRecords, (record) => `${record.placa}${record.modelo ? ` · ${record.modelo.split(" ").slice(0, 2).join(" ")}` : ""}`, (record) => record.valorFaturado),
    [periodRecords],
  )

  async function handleFileSelected(file: File | undefined) {
    if (!file) return
    setIsImporting(true)
    try {
      const { summary, driveError } = await importFile(fonte, file)
      toast({
        title: "Planilha importada",
        description: `${summary.imported} multa(s) carregada(s)${summary.previousCount ? ` (substituindo ${summary.previousCount} anteriores)` : ""}.${
          summary.warnings.length ? ` ${summary.warnings.length} aviso(s) de leitura.` : ""
        }`,
      })
      if (driveError) {
        toast({ title: "Salvo apenas localmente", description: driveError, variant: "destructive" })
      }
    } catch (err) {
      toast({ title: "Falha na importação", description: err instanceof Error ? err.message : "Erro desconhecido", variant: "destructive" })
    } finally {
      setIsImporting(false)
      if (fileInputRef.current) fileInputRef.current.value = ""
    }
  }

  async function handleExport() {
    setIsExporting(true)
    try {
      const records = tratativaFilter === "todas" ? periodRecords : periodRecords.filter((record) => record.tratativa === tratativaFilter)
      await downloadMultasWorkbook({
        title: `Multas · ${MULTA_FONTE_LABELS[fonte]}`,
        periodLabel: `Período: ${periodLabel}${tratativaFilter !== "todas" ? ` · ${MULTA_TRATATIVA_LABELS[tratativaFilter]}` : ""}`,
        records,
      })
    } catch (err) {
      toast({ title: "Falha ao exportar", description: err instanceof Error ? err.message : "Erro desconhecido", variant: "destructive" })
    } finally {
      setIsExporting(false)
    }
  }

  const importButton = canManage && isSupported ? (
    <>
      <input
        ref={fileInputRef}
        type="file"
        accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        className="hidden"
        onChange={(event) => handleFileSelected(event.target.files?.[0])}
      />
      <Button type="button" className="gap-2 bg-[#4f8f57] hover:bg-[#437a4a]" disabled={isImporting} onClick={() => fileInputRef.current?.click()}>
        {isImporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
        {batch ? "Atualizar planilha" : "Importar planilha"}
      </Button>
    </>
  ) : null

  if (isLoading && !store) {
    return <div className="h-40 animate-pulse rounded-2xl border border-border bg-muted/40" />
  }

  if (!batch) {
    return (
      <Card className={CARD_CLASS}>
        <CardContent className="flex flex-col items-center gap-4 px-6 py-14 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#eef6ea] text-[#4f8f57]">
            <FileSpreadsheet className="h-7 w-7" />
          </div>
          <div className="space-y-1">
            <h3 className="text-lg font-semibold text-slate-900">{FONTE_DESCRIPTIONS[fonte]}</h3>
            <p className="mx-auto max-w-xl text-sm text-slate-500">
              {isSupported
                ? "Nenhuma planilha importada ainda. Importe o relatório de infrações (.xlsx): as cores das linhas definem o status da tratativa — verde (tratada), azul (em tratativa) e laranja (análise ou perda)."
                : "O modelo da planilha de carros próprios ainda não foi configurado. Assim que a planilha for enviada, a importação será habilitada aqui com o mesmo painel."}
            </p>
            {error ? <p className="text-sm text-destructive">{error}</p> : null}
          </div>
          {importButton}
          {!canManage && isSupported ? <p className="text-xs text-slate-400">Seu perfil não tem permissão para importar.</p> : null}
        </CardContent>
      </Card>
    )
  }

  const tratadas = stats.byTratativa.get("tratada")?.count ?? 0
  const visibleTratativas = MULTA_TRATATIVA_ORDER.filter((tratativa) => tratativa !== "sem_classificacao" || stats.byTratativa.has(tratativa))

  return (
    <div className="space-y-4">
      <Card className={CARD_CLASS}>
        <CardContent className="space-y-4 p-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#eef6ea] text-[#4f8f57]">
                <CarFront className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-slate-900">{FONTE_DESCRIPTIONS[fonte]}</h3>
                <p className="text-xs text-slate-500">
                  Última importação: <span className="font-medium text-slate-700">{batch.fileName}</span> ·{" "}
                  {new Date(batch.importedAt).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}
                  {batch.importedBy ? ` · por ${batch.importedBy}` : ""} · {batch.records.length} registros
                </p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button type="button" variant="outline" className="gap-2 bg-white" disabled={isExporting || periodRecords.length === 0} onClick={handleExport}>
                {isExporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                Exportar Excel
              </Button>
              {importButton}
            </div>
          </div>

          <div className="flex flex-wrap items-end gap-3 rounded-xl border border-[#e2eadc] bg-[#f8fbf6] p-3">
            <div className="space-y-1">
              <Label className="text-xs text-slate-500">Período (data da infração)</Label>
              <Select value={periodPreset} onValueChange={(value) => setPeriodPreset(value as PeriodPreset)}>
                <SelectTrigger className="w-[200px] bg-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(PERIOD_LABELS) as PeriodPreset[]).map((preset) => (
                    <SelectItem key={preset} value={preset}>
                      {PERIOD_LABELS[preset]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="multas-de" className="text-xs text-slate-500">
                De
              </Label>
              <Input
                id="multas-de"
                type="date"
                className="w-[160px] bg-white"
                value={periodPreset === "personalizado" ? customStart : periodRange ? toInputDate(periodRange.start) : ""}
                onChange={(event) => {
                  setPeriodPreset("personalizado")
                  setCustomStart(event.target.value)
                  if (periodPreset !== "personalizado" && periodRange) setCustomEnd(toInputDate(periodRange.end))
                }}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="multas-ate" className="text-xs text-slate-500">
                Até
              </Label>
              <Input
                id="multas-ate"
                type="date"
                className="w-[160px] bg-white"
                value={periodPreset === "personalizado" ? customEnd : periodRange ? toInputDate(periodRange.end) : ""}
                onChange={(event) => {
                  setPeriodPreset("personalizado")
                  setCustomEnd(event.target.value)
                  if (periodPreset !== "personalizado" && periodRange) setCustomStart(toInputDate(periodRange.start))
                }}
              />
            </div>
            <div className="ml-auto text-right">
              <p className={SECTION_LABEL_CLASS}>Recorte aplicado</p>
              <p className="text-sm font-semibold text-slate-800">{periodLabel}</p>
            </div>
          </div>

          {warning || batch.warnings.length > 0 ? (
            <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <div className="space-y-0.5">
                {warning ? <p>{warning}</p> : null}
                {batch.warnings.slice(0, 4).map((item) => (
                  <p key={item}>{item}</p>
                ))}
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <KpiCard
          icon={ShieldAlert}
          label="Total de multas"
          value={`${stats.total}`}
          caption={`${stats.notificacoes} notificações · ${stats.multas} multas`}
          accent="#4f8f57"
        />
        <KpiCard
          icon={CircleDollarSign}
          label="Valor faturado"
          value={formatMultaCurrency(stats.valorFaturado)}
          caption={`Infração ${formatMultaCurrency(stats.valorInfracao)} · NIC ${formatMultaCurrency(stats.valorNic)}`}
          accent="#2f6fb5"
        />
        <KpiCard
          icon={HandCoins}
          label="Recuperado via RH"
          value={formatMultaCurrency(stats.recuperado)}
          caption="Descontos lançados aos colaboradores"
          accent="#3f8f3a"
        />
        <KpiCard
          icon={TrendingDown}
          label="Perda (não recuperado)"
          value={formatMultaCurrency(stats.perda)}
          caption={`${stats.perdaCount} multa(s) sem desconto possível`}
          accent="#d97706"
        />
        <KpiCard
          icon={Gauge}
          label="Pontos acumulados"
          value={`${stats.pontos}`}
          caption={stats.total > 0 ? `Média de ${(stats.pontos / stats.total).toFixed(1)} pts por infração` : "Sem infrações"}
          accent="#b91c1c"
        />
      </div>

      <Card className={CARD_CLASS}>
        <CardHeader className={CARD_HEADER_CLASS}>
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className={SECTION_LABEL_CLASS}>Status da tratativa</p>
              <CardTitle className="mt-1 text-lg text-slate-900">Andamento das multas</CardTitle>
            </div>
            <div className="text-right">
              <p className="text-3xl font-black tracking-tight text-[#2f6b2a]">
                {stats.total > 0 ? `${Math.round((tratadas / stats.total) * 100)}%` : "0%"}
              </p>
              <p className="text-xs text-slate-500">das multas do período já tratadas</p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4 p-5">
          <div className="flex h-3 overflow-hidden rounded-full bg-slate-100">
            {visibleTratativas.map((tratativa) => {
              const count = stats.byTratativa.get(tratativa)?.count ?? 0
              if (count === 0) return null
              return (
                <div
                  key={tratativa}
                  title={`${MULTA_TRATATIVA_LABELS[tratativa]}: ${count}`}
                  style={{ width: `${(count / Math.max(1, stats.total)) * 100}%`, backgroundColor: MULTA_TRATATIVA_COLORS[tratativa].solid }}
                />
              )
            })}
          </div>

          <div className={`grid gap-3 ${visibleTratativas.length > 3 ? "md:grid-cols-4" : "md:grid-cols-3"}`}>
            {visibleTratativas.map((tratativa) => {
              const colors = MULTA_TRATATIVA_COLORS[tratativa]
              const entry = stats.byTratativa.get(tratativa) ?? { count: 0, value: 0 }
              const isActive = tratativaFilter === tratativa
              return (
                <button
                  key={tratativa}
                  type="button"
                  onClick={() => setTratativaFilter(isActive ? "todas" : tratativa)}
                  className="rounded-2xl border p-4 text-left transition-all hover:shadow-md"
                  style={{
                    backgroundColor: colors.soft,
                    borderColor: isActive ? colors.solid : colors.border,
                    boxShadow: isActive ? `0 0 0 2px ${colors.solid}40` : undefined,
                  }}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="inline-flex items-center gap-2 text-sm font-semibold" style={{ color: colors.text }}>
                      <span className="h-3 w-3 rounded-full" style={{ backgroundColor: colors.solid }} />
                      {MULTA_TRATATIVA_LABELS[tratativa]}
                    </span>
                    <span className="text-xs font-medium" style={{ color: colors.text }}>
                      {stats.total > 0 ? `${((entry.count / stats.total) * 100).toFixed(0)}%` : "0%"}
                    </span>
                  </div>
                  <p className="mt-3 text-4xl font-black tracking-tight" style={{ color: colors.text }}>
                    {entry.count}
                  </p>
                  <p className="mt-1 text-xs text-slate-600">
                    {MULTA_TRATATIVA_DESCRIPTIONS[tratativa]} · {formatMultaCurrency(entry.value)}
                  </p>
                </button>
              )
            })}
          </div>
          <p className="text-xs text-slate-400">Clique em um status para filtrar a lista de multas abaixo.</p>
        </CardContent>
      </Card>

      <div className="grid gap-4 xl:grid-cols-12">
        <Card className={`${CARD_CLASS} xl:col-span-8`}>
          <CardHeader className={CARD_HEADER_CLASS}>
            <CardTitle className="text-base text-slate-900">Evolução mensal</CardTitle>
            <p className="text-xs text-slate-500">Quantidade de multas por mês da infração e status da tratativa</p>
          </CardHeader>
          <CardContent className="p-4">
            {monthlySeries.length === 0 ? (
              <p className="py-16 text-center text-sm text-slate-400">Sem dados no período.</p>
            ) : (
              <ChartContainer className="h-[260px] w-full" config={monthlyChartConfig}>
                <BarChart data={monthlySeries} margin={{ left: -16, right: 8, top: 12, bottom: 0 }}>
                  <CartesianGrid vertical={false} strokeDasharray="3 3" />
                  <XAxis dataKey="month" tickLine={false} axisLine={false} tickMargin={8} />
                  <YAxis allowDecimals={false} tickLine={false} axisLine={false} width={40} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <ChartLegend content={<ChartLegendContent payload={undefined} />} />
                  {visibleTratativas.map((tratativa, index) => (
                    <Bar
                      key={tratativa}
                      dataKey={tratativa}
                      stackId="tratativa"
                      fill={`var(--color-${tratativa})`}
                      radius={index === visibleTratativas.length - 1 ? [6, 6, 0, 0] : [0, 0, 0, 0]}
                    />
                  ))}
                </BarChart>
              </ChartContainer>
            )}
          </CardContent>
        </Card>

        <Card className={`${CARD_CLASS} xl:col-span-4`}>
          <CardHeader className={CARD_HEADER_CLASS}>
            <CardTitle className="text-base text-slate-900">Gravidade</CardTitle>
            <p className="text-xs text-slate-500">Distribuição das infrações do período</p>
          </CardHeader>
          <CardContent className="space-y-4 p-5">
            {MULTA_GRAVIDADE_IMPORT_ORDER.map((gravidade) => {
              const count = stats.byGravidade.get(gravidade) ?? 0
              const percentage = stats.total > 0 ? (count / stats.total) * 100 : 0
              return (
                <div key={gravidade} className="space-y-1.5">
                  <div className="flex items-center justify-between text-sm">
                    <span className="inline-flex items-center gap-2 text-slate-700">
                      <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: MULTA_GRAVIDADE_IMPORT_COLORS[gravidade] }} />
                      {MULTA_GRAVIDADE_IMPORT_LABELS[gravidade]}
                    </span>
                    <span className="font-semibold text-slate-900">
                      {count} <span className="text-xs font-normal text-slate-400">({percentage.toFixed(0)}%)</span>
                    </span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                    <div className="h-full rounded-full" style={{ width: `${percentage}%`, backgroundColor: MULTA_GRAVIDADE_IMPORT_COLORS[gravidade] }} />
                  </div>
                </div>
              )
            })}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <Card className={CARD_CLASS}>
          <CardHeader className={CARD_HEADER_CLASS}>
            <div className="flex items-center gap-2">
              <CalendarClock className="h-4 w-4 text-[#d97706]" />
              <CardTitle className="text-base text-slate-900">Prazos de indicação</CardTitle>
            </div>
            <p className="text-xs text-slate-500">
              {deadlines.pendingTotal} pendente(s) de indicação · {deadlines.expired} com prazo expirado
            </p>
          </CardHeader>
          <CardContent className="space-y-2 p-4">
            {deadlines.upcoming.length === 0 ? (
              <p className="py-6 text-center text-sm text-slate-400">Nenhum prazo de envio em aberto.</p>
            ) : null}
            {deadlines.upcoming.slice(0, 6).map(({ record, days }) => {
              const urgent = days <= 7
              return (
                <div key={record.id} className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-slate-800">
                      {record.placa} · <span className="font-normal">{record.condutor || "Sem condutor"}</span>
                    </p>
                    <p className="text-xs text-slate-500">Limite {formatMultaDate(record.dataLimiteEnvio)}</p>
                  </div>
                  <span
                    className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                      urgent ? "bg-rose-100 text-rose-700" : "bg-amber-50 text-amber-700"
                    }`}
                  >
                    {days === 0 ? "Hoje" : `${days} dia(s)`}
                  </span>
                </div>
              )
            })}
          </CardContent>
        </Card>

        <RankingCard
          title="Situação do processo"
          description="Andamento da indicação junto à locadora"
          items={situacoes}
          color="#5b8fd0"
        />
        <RankingCard title="Principais infrações" description="Infrações mais recorrentes no período" items={topInfracoes} color="#d0463b" />
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <RankingCard title="Condutores" description="Condutores com mais multas no período" items={topCondutores} color="#e07b39" />
        <RankingCard
          title="Centros de custo"
          description="Valor faturado por centro de custo"
          items={topCentros}
          color="#4f8f57"
          valueMode="value"
        />
        <RankingCard title="Veículos" description="Placas com mais multas no período" items={topPlacas} color="#3b7dd8" />
      </div>

      <MultasImportTable records={periodRecords} tratativaFilter={tratativaFilter} onTratativaFilterChange={setTratativaFilter} />
    </div>
  )
}
