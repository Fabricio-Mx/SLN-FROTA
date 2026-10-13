"use client"

import { useEffect, useMemo, useState } from "react"
import { Download, FileSpreadsheet, Loader2 } from "lucide-react"
import { useOptionalFuelDataContext } from "@/components/fuel/fuel-data-provider"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useDriverLinks } from "@/hooks/use-driver-links"
import { fuelFetcher, FUEL_DATA_SWR_KEY } from "@/hooks/use-fuel-data"
import { toast } from "@/hooks/use-toast"
import { buildMonthlyClosing, isVehicleInMonthlyClosing } from "@/lib/fleet-monthly-closing"
import { buildMonthlyClosingFileName, buildMonthlyClosingWorkbook, formatClosingMonthLabel } from "@/lib/fleet-monthly-closing-export"
import { downloadBlob } from "@/lib/fuel-consolidated-export"
import type { Colaborador, Vehicle } from "@/lib/types"

type FleetClosingExportButtonProps = {
  vehicles: Vehicle[]
  colaboradores: Colaborador[]
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value)
}

function getCurrentMonthKey(): string {
  const today = new Date()
  return `${today.getFullYear()}-${`${today.getMonth() + 1}`.padStart(2, "0")}`
}

export function FleetClosingExportButton({ vehicles, colaboradores }: FleetClosingExportButtonProps) {
  const fuelData = useOptionalFuelDataContext()
  const [open, setOpen] = useState(false)
  const [month, setMonth] = useState("")
  const [exporting, setExporting] = useState(false)
  const { links, isLoading: loadingLinks } = useDriverLinks(open)

  const monthOptions = useMemo(() => {
    const options = fuelData?.availableMonths ?? []
    if (options.length > 0) return options
    const current = getCurrentMonthKey()
    return [{ month: current, label: formatClosingMonthLabel(current), recordCount: 0, total: 0, source: "current" as const }]
  }, [fuelData?.availableMonths])

  // O fechamento normalmente é do mês anterior já encerrado.
  useEffect(() => {
    if (!open || month) return
    const current = getCurrentMonthKey()
    const closed = monthOptions.find((option) => option.month < current && option.recordCount > 0)
    setMonth(closed?.month ?? monthOptions[0]?.month ?? current)
  }, [month, monthOptions, open])

  const vehiclesInClosing = useMemo(() => vehicles.filter(isVehicleInMonthlyClosing).length, [vehicles])

  const handleExport = async () => {
    if (!month) return
    if (vehiclesInClosing === 0) {
      toast({ title: "Nada para exportar", description: "Nenhum veículo da frota ou agregado carregado.", variant: "destructive" })
      return
    }

    setExporting(true)
    try {
      const response = await fuelFetcher(`${FUEL_DATA_SWR_KEY}?month=${month}`)
      const records = response.selectedMonth === month || !response.selectedMonth ? response.records : []
      const data = buildMonthlyClosing({ vehicles, colaboradores, links, records })
      const blob = await buildMonthlyClosingWorkbook({ data, month })
      downloadBlob(blob, buildMonthlyClosingFileName(month))

      toast({
        title: "Fechamento exportado",
        description:
          data.unlinkedFuel.length > 0
            ? `${data.rows.length} veículos. ${formatCurrency(data.totalFuelUnlinked)} de combustível sem veículo vinculado (veja a aba própria).`
            : `${data.rows.length} veículos no fechamento de ${formatClosingMonthLabel(month).toLowerCase()}.`,
      })
      setOpen(false)
    } catch (error) {
      toast({
        title: "Erro ao exportar",
        description: error instanceof Error ? error.message : "Não foi possível gerar o fechamento.",
        variant: "destructive",
      })
    } finally {
      setExporting(false)
    }
  }

  const selectedOption = monthOptions.find((option) => option.month === month)

  return (
    <>
      <Button type="button" onClick={() => setOpen(true)} className="h-9 gap-2 bg-[#7CB342] text-white hover:bg-[#6d9d39] sm:h-10">
        <Download className="h-4 w-4" />
        Exportar Relatório
      </Button>

      <Dialog open={open} onOpenChange={(next) => (!exporting ? setOpen(next) : undefined)}>
        <DialogContent className="sm:max-w-[460px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileSpreadsheet className="h-5 w-5 text-[#1F3864]" />
              Fechamento mensal da frota
            </DialogTitle>
            <DialogDescription>
              Gera a planilha com aluguel, combustível e Sem Parar de cada veículo (frota e agregados), com resumo por locadora e
              centro de custo.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Competência</Label>
              <Select value={month} onValueChange={setMonth}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o mês" />
                </SelectTrigger>
                <SelectContent>
                  {monthOptions.map((option) => (
                    <SelectItem key={option.month} value={option.month}>
                      {formatClosingMonthLabel(option.month)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-3 rounded-xl border border-border bg-muted/40 p-3 text-sm">
              <div>
                <p className="text-xs text-muted-foreground">Veículos no fechamento</p>
                <p className="font-semibold">{vehiclesInClosing}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Combustível do mês</p>
                <p className="font-semibold">{selectedOption ? formatCurrency(selectedOption.total) : "-"}</p>
              </div>
            </div>

            <p className="text-xs text-muted-foreground">
              Sem Parar ainda não é integrado ao sistema: a coluna sai zerada e destacada para preenchimento manual, e os totais
              são recalculados na própria planilha.
            </p>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={exporting}>
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={handleExport}
              disabled={!month || exporting || loadingLinks}
              className="gap-2 bg-[#7CB342] text-white hover:bg-[#6d9d39]"
            >
              {exporting || loadingLinks ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
              {exporting ? "Gerando..." : "Gerar planilha"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
