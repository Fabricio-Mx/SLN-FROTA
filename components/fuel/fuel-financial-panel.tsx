"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { CalendarRange, Download, FileArchive, FileSpreadsheet, History, BarChart3, Upload } from "lucide-react"
import Link from "next/link"
import { FuelFinancialCostCenterChart } from "@/components/fuel/fuel-financial-cost-center-chart"
import { useFuelDataContext } from "@/components/fuel/fuel-data-provider"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { toast } from "@/hooks/use-toast"
import { useFuelFinancialInvoices } from "@/hooks/use-fuel-financial-invoices"
import {
  getFuelBillingCycleClosingMonthKey,
  getFuelFinancialPostingCycleBounds,
  getFuelFinancialPostingCycleBoundsForClosingMonth,
  getLatestClosedFuelBillingCycleMonthKey,
} from "@/lib/fuel-billing"

type FuelFinancialPanelProps = {
  isMaster?: boolean
}

type CycleOption = {
  value: string
  label: string
  helper: string
  hasInvoice: boolean
}

function formatMonthLabel(monthKey: string): string {
  const [year, month] = monthKey.split("-").map(Number)
  const date = new Date(year, (month || 1) - 1, 1)

  return new Intl.DateTimeFormat("pt-BR", {
    month: "long",
    year: "numeric",
  }).format(date)
}

function formatDateLabel(value: string): string {
  const [year, month, day] = value.split("-").map(Number)
  const date = new Date(year, (month || 1) - 1, day || 1)

  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date)
}

function formatDateTimeLabel(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "-"

  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date)
}

function shiftMonthKey(monthKey: string, offset: number): string {
  const [year, month] = monthKey.split("-").map(Number)
  const shiftedDate = new Date(year, (month || 1) - 1 + offset, 1)
  return `${shiftedDate.getFullYear()}-${`${shiftedDate.getMonth() + 1}`.padStart(2, "0")}`
}

function formatCycleOptionLabel(monthKey: string): string {
  const bounds = getFuelFinancialPostingCycleBoundsForClosingMonth(monthKey)
  if (!bounds) return monthKey

  return `${formatDateLabel(bounds.start.toISOString().slice(0, 10))} a ${formatDateLabel(bounds.end.toISOString().slice(0, 10))}`
}

function buildCycleHelperText(option: CycleOption | null, latestClosedCycleMonth: string): string {
  if (!option) {
    return "Mostrando apenas ciclos já fechados com dados disponíveis."
  }

  return `${option.helper}${option.value === latestClosedCycleMonth ? " • Último ciclo fechado" : ""}`
}

function formatFileSize(size: number): string {
  if (size < 1024) return `${size} B`
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`
  return `${(size / (1024 * 1024)).toFixed(1)} MB`
}

export function FuelFinancialPanel({ isMaster = false }: FuelFinancialPanelProps) {
  const inputRef = useRef<HTMLInputElement | null>(null)
  const { reportDate, availableMonths } = useFuelDataContext()
  const { data, error, isLoading, mutate } = useFuelFinancialInvoices()
  const [uploading, setUploading] = useState(false)
  const [isChartOpen, setIsChartOpen] = useState(false)
  const currentCycleMonth = useMemo(() => getFuelBillingCycleClosingMonthKey(new Date()), [])
  const latestClosedCycleMonth = useMemo(() => getLatestClosedFuelBillingCycleMonthKey(new Date()), [])
  const [cycleMonth, setCycleMonth] = useState(latestClosedCycleMonth)

  const activeCycle = useMemo(() => getFuelFinancialPostingCycleBounds(reportDate), [reportDate])
  const selectedCycle = useMemo(() => getFuelFinancialPostingCycleBoundsForClosingMonth(cycleMonth), [cycleMonth])
  const invoices = useMemo(() => data?.invoices ?? [], [data?.invoices])
  const exportHref = selectedCycle ? `/api/fuel/finance/export?cycleMonth=${encodeURIComponent(cycleMonth)}` : "#"

  const cycleOptions = useMemo<CycleOption[]>(() => {
    const optionKeys = new Set<string>()

    for (const month of availableMonths) {
      optionKeys.add(month.month)
      optionKeys.add(shiftMonthKey(month.month, 1))
    }

    for (const invoice of invoices) {
      optionKeys.add(invoice.cycleMonth)
    }

    return Array.from(optionKeys)
      .filter((value) => value <= latestClosedCycleMonth)
      .map((value) => {
        const bounds = getFuelFinancialPostingCycleBoundsForClosingMonth(value)
        if (!bounds) return null

        const hasInvoice = invoices.some((invoice) => invoice.cycleMonth === value)

        return {
          value,
          label: formatCycleOptionLabel(value),
          helper: hasInvoice ? "Com fatura salva" : "Com dados do ciclo",
          hasInvoice,
        }
      })
      .filter((item): item is CycleOption => Boolean(item))
      .sort((left, right) => right.value.localeCompare(left.value))
  }, [availableMonths, invoices, latestClosedCycleMonth])

  useEffect(() => {
    if (cycleOptions.length === 0) {
      setCycleMonth(latestClosedCycleMonth)
      return
    }

    const currentIsValid = cycleOptions.some((option) => option.value === cycleMonth)
    if (currentIsValid) {
      return
    }

    const latestClosedOption = cycleOptions.find((option) => option.value === latestClosedCycleMonth)
    setCycleMonth(latestClosedOption?.value ?? cycleOptions[0].value)
  }, [cycleMonth, cycleOptions, latestClosedCycleMonth])

  const selectedCycleOption = cycleOptions.find((option) => option.value === cycleMonth) ?? null
  const cycleHelperText = buildCycleHelperText(selectedCycleOption, latestClosedCycleMonth)

  const handleUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return

    const file = files[0]
    setUploading(true)

    try {
      const body = new FormData()
      body.append("file", file)
      body.append("cycleMonth", cycleMonth)

      const response = await fetch("/api/fuel/finance", {
        method: "POST",
        body,
      })

      const payload = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new Error(payload?.error || "Falha ao salvar a fatura.")
      }

      toast({
        title: "Fatura salva",
        description: `A fatura de ${formatMonthLabel(cycleMonth)} foi registrada no histórico financeiro.`,
      })

      await mutate()
    } catch (error) {
      toast({
        title: "Erro",
        description: error instanceof Error ? error.message : "Falha ao salvar a fatura.",
        variant: "destructive",
      })
    } finally {
      setUploading(false)
      if (inputRef.current) {
        inputRef.current.value = ""
      }
    }
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)]">
        <Card className="border-[#d8dfd1] bg-[linear-gradient(180deg,#fcfdfb_0%,#f5f8f2_100%)] shadow-sm">
          <CardHeader className="border-b border-[#e5ece0] pb-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <CardTitle className="text-xl text-slate-900">Histórico de faturamento VELOE</CardTitle>
                <p className="mt-1 text-sm text-slate-500">
                  Salve uma fatura por fechamento para manter o histórico financeiro separado da carga operacional.
                </p>
              </div>
              <Badge variant="outline" className="border-[#d6e5cd] bg-[#f4faef] text-[#5d874d]">
                Financeiro
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4 p-5">
            {isMaster ? (
              <div className="flex flex-col gap-2 rounded-xl border border-[#d8dfd1] bg-white/80 p-3 text-sm text-slate-600 sm:flex-row sm:items-center sm:justify-between">
                <span>
                  Se o Drive pedir autorização para salvar a fatura, conecte a conta Google antes de importar.
                </span>
                <Button asChild type="button" variant="outline" className="border-[#cfd8c7] bg-white">
                  <Link href="/api/drive/oauth/start">Autorizar Drive</Link>
                </Button>
              </div>
            ) : null}

            <div className="rounded-2xl border border-[#dfe7d8] bg-[linear-gradient(180deg,#ffffff_0%,#f7fbf4_100%)] px-4 py-4 shadow-sm">
              <div className="grid gap-2 md:grid-cols-[220px_minmax(0,1fr)] md:items-start">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Ciclo selecionado</p>
                  <div className="mt-2 inline-flex rounded-2xl border border-[#cfe0c4] bg-[#f4faef] px-3 py-2 text-sm font-semibold text-[#426a32] shadow-sm">
                    {selectedCycleOption?.label ?? "Selecione um ciclo fechado"}
                  </div>
                  <p className="mt-2 text-xs font-medium text-slate-500">{cycleHelperText}</p>
                </div>

                <div>
                  <div className="flex items-center gap-2 text-sm font-semibold text-slate-800">
                    <CalendarRange className="h-4 w-4 text-[#6f9f4c]" />
                    Ciclo associado ao fechamento
                  </div>
                  <p className="mt-2 text-sm text-slate-600">
                    {selectedCycle
                      ? `${formatDateLabel(selectedCycle.start.toISOString().slice(0, 10))} a ${formatDateLabel(selectedCycle.end.toISOString().slice(0, 10))}`
                      : "Selecione um fechamento válido para calcular o ciclo."}
                  </p>
                </div>
            </div>
            </div>

            <div className="flex flex-col gap-3 rounded-2xl border border-[#eadfb9] bg-[#fff9e8] p-4 text-sm text-slate-600 lg:flex-row lg:items-center lg:justify-between">
              <div>
                {isMaster
                  ? "Aceita PDF, CSV e planilhas da VELOE. Se já existir uma fatura para o mesmo fechamento, ela será substituída."
                  : "Somente o usuário mestre pode importar faturas financeiras."}
              </div>

              <label className="inline-flex">
                <input
                  ref={inputRef}
                  type="file"
                  accept=".pdf,.csv,.xlsx,.xls,text/csv,application/pdf,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                  className="hidden"
                  disabled={!isMaster || uploading || !selectedCycle}
                  onChange={(event) => handleUpload(event.target.files)}
                />
                <Button
                  type="button"
                  disabled={!isMaster || uploading || !selectedCycle}
                  className="gap-2 bg-[#6f9f4c] text-white hover:bg-[#628d44]"
                  onClick={() => inputRef.current?.click()}
                >
                  <Upload className="h-4 w-4" />
                  {uploading ? "Salvando fatura..." : "Importar fatura VELOE"}
                </Button>
              </label>
            </div>
          </CardContent>
        </Card>

        <Card className="border-[#d8dfd1] bg-[linear-gradient(180deg,#fbfcfa_0%,#f4f7f1_100%)] shadow-sm">
          <CardHeader className="border-b border-[#e5ece0] pb-4">
            <CardTitle className="text-xl text-slate-900">Exportar relatório</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 p-5">
            <div className="space-y-2 rounded-2xl border border-[#dfe7d8] bg-[linear-gradient(180deg,#ffffff_0%,#f7fbf4_100%)] p-4 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <Label htmlFor="fuel-finance-export-cycle">Ciclo para exportação e gráfico</Label>
                <Badge variant="outline" className="border-[#d6e5cd] bg-[#f4faef] text-[#5d874d]">
                  sincronizado
                </Badge>
              </div>
              <Select value={cycleMonth} onValueChange={setCycleMonth} disabled={cycleOptions.length === 0}>
                <SelectTrigger id="fuel-finance-export-cycle" className="w-full bg-white">
                  <SelectValue placeholder="Selecione um ciclo fechado" />
                </SelectTrigger>
                <SelectContent>
                  {cycleOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-slate-500">{cycleHelperText}</p>
            </div>

            <div className="rounded-2xl border border-[#dfe7d8] bg-white/90 p-4">
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-800">
                <FileSpreadsheet className="h-4 w-4 text-[#6f9f4c]" />
                Planilha Excel por ciclo de faturamento
              </div>
              <p className="mt-2 text-sm text-slate-600">
                {selectedCycle
                  ? `A exportação vai usar o ciclo de ${formatDateLabel(selectedCycle.start.toISOString().slice(0, 10))} a ${formatDateLabel(selectedCycle.end.toISOString().slice(0, 10))}.`
                  : `A exportação vai usar o ciclo atual de ${formatDateLabel(activeCycle.start.toISOString().slice(0, 10))} a ${formatDateLabel(activeCycle.end.toISOString().slice(0, 10))}.`}
              </p>
            </div>

            <div className="rounded-2xl border border-dashed border-[#d7e2d0] bg-[#fbfdf9] p-4 text-sm text-slate-500">
              O arquivo sai em Excel com as colunas Data/Hora, Número Cartão, Placa, Nome do Motorista, Centro de Custo e Valor transação, seguindo o modelo da conferência da fatura.
            </div>

            <Button asChild type="button" className="w-full gap-2 bg-[#6f9f4c] text-white hover:bg-[#628d44]" disabled={!selectedCycle}>
              <a href={exportHref} aria-disabled={!selectedCycle}>
                <Download className="h-4 w-4" />
                Exportar relatório por fatura
              </a>
            </Button>

            <Button
              type="button"
              className="w-full gap-2 border border-[#1c3850] bg-[linear-gradient(180deg,#17324a_0%,#10263a_100%)] text-white shadow-[0_10px_24px_rgba(16,38,58,0.18)] hover:bg-[linear-gradient(180deg,#1a3954_0%,#123046_100%)]"
              disabled={!selectedCycle}
              onClick={() => setIsChartOpen(true)}
            >
              <BarChart3 className="h-4 w-4 text-[#67d0ff]" />
              Ver gráfico dinâmico do ciclo
            </Button>
          </CardContent>
        </Card>
      </div>

      <Dialog open={isChartOpen} onOpenChange={setIsChartOpen}>
        <DialogContent className="h-[92vh] w-[96vw] max-w-[96vw] overflow-hidden border-[#0f172a] bg-[#08111f] p-0 text-white sm:max-w-[96vw]" showCloseButton>
          <DialogHeader className="border-b border-white/10 px-6 py-5 text-left">
            <DialogTitle className="text-xl text-white">Gráfico dinâmico por centro de custo</DialogTitle>
            <DialogDescription className="text-slate-300">
              Consolidação do faturamento do ciclo selecionado para identificar rapidamente qual centro de custo gastou mais.
            </DialogDescription>
          </DialogHeader>

          <div className="h-[calc(92vh-96px)] overflow-y-auto px-6 py-5">
            <FuelFinancialCostCenterChart cycleMonth={cycleMonth} />
          </div>
        </DialogContent>
      </Dialog>

      <Card className="border-[#d8dfd1] bg-[linear-gradient(180deg,#fcfdfb_0%,#f5f8f2_100%)] shadow-sm">
        <CardHeader className="border-b border-[#e5ece0] pb-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle className="text-xl text-slate-900">Faturas salvas</CardTitle>
              <p className="mt-1 text-sm text-slate-500">Histórico de faturas importadas para consulta e download.</p>
            </div>
            <div className="rounded-full border border-[#dfe7d8] bg-white px-3 py-1 text-xs font-medium uppercase tracking-[0.12em] text-slate-500">
              {invoices.length} registro{invoices.length === 1 ? "" : "s"}
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-5">
          {error ? (
            <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error.message || "Não foi possível carregar o histórico financeiro."}
            </div>
          ) : null}

          {isLoading ? (
            <div className="grid gap-3">
              {Array.from({ length: 3 }, (_, index) => (
                <div key={index} className="h-20 animate-pulse rounded-2xl border border-[#e5ece0] bg-white/80" />
              ))}
            </div>
          ) : invoices.length === 0 ? (
            <div className="flex min-h-[180px] flex-col items-center justify-center rounded-2xl border border-dashed border-[#d7e2d0] bg-[#fbfdf9] px-6 py-8 text-center">
              <History className="h-8 w-8 text-[#7da060]" />
              <p className="mt-3 text-sm font-semibold text-slate-800">Nenhuma fatura financeira salva ainda.</p>
              <p className="mt-1 max-w-xl text-sm text-slate-500">
                Importe a primeira fatura da VELOE para montar o histórico de faturamento por ciclo.
              </p>
            </div>
          ) : (
            <div className="grid gap-3">
              {invoices.map((invoice) => (
                <div key={invoice.id} className="flex flex-col gap-4 rounded-2xl border border-[#e1e8db] bg-white/90 p-4 lg:flex-row lg:items-center lg:justify-between">
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-base font-semibold text-slate-900">{formatMonthLabel(invoice.cycleMonth)}</p>
                      {invoice.id === currentCycleMonth ? (
                        <Badge variant="outline" className="border-[#d6e5cd] bg-[#f4faef] text-[#5d874d]">
                          Ciclo atual
                        </Badge>
                      ) : null}
                    </div>
                    <div className="flex flex-wrap items-center gap-3 text-sm text-slate-500">
                      <span className="inline-flex items-center gap-1.5">
                        <CalendarRange className="h-4 w-4" />
                        {formatDateLabel(invoice.cycleStart)} a {formatDateLabel(invoice.cycleEnd)}
                      </span>
                      <span className="inline-flex items-center gap-1.5">
                        <FileArchive className="h-4 w-4" />
                        {invoice.originalFileName}
                      </span>
                    </div>
                    <p className="text-xs uppercase tracking-[0.12em] text-slate-400">
                      Importado em {formatDateTimeLabel(invoice.uploadedAt)} • {formatFileSize(invoice.size)}
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Button asChild type="button" variant="outline" className="border-[#cfd8c7] bg-white">
                      <a href={`/api/fuel/finance/${encodeURIComponent(invoice.id)}`}>
                        <Download className="h-4 w-4" />
                        Baixar fatura
                      </a>
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
