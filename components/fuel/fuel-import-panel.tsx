"use client"

import { useRef, useState } from "react"
import { useSWRConfig } from "swr"
import { Trash2, Upload } from "lucide-react"
import { FUEL_COST_CENTER_SWR_KEY } from "@/hooks/use-fuel-cost-centers"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { useFuelDataContext } from "@/components/fuel/fuel-data-provider"
import { toast } from "@/hooks/use-toast"
import { Label } from "@/components/ui/label"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

type FuelImportMode = "weekly" | "monthly"

type FuelImportPanelProps = {
  isMaster?: boolean
}

export function FuelImportPanel({ isMaster = false }: FuelImportPanelProps) {
  const [uploadingFuel, setUploadingFuel] = useState(false)
  const [uploadingCostCenter, setUploadingCostCenter] = useState(false)
  const [deletingMonth, setDeletingMonth] = useState(false)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [importMode, setImportMode] = useState<FuelImportMode>("weekly")
  const { mutate: mutateCache } = useSWRConfig()
  const { availableMonths, currentMonth, mutate, selectedMonth, setSelectedMonth } = useFuelDataContext()
  const fuelInputRef = useRef<HTMLInputElement | null>(null)
  const costCenterInputRef = useRef<HTMLInputElement | null>(null)

  const selectedMonthOption = availableMonths.find((month) => month.month === selectedMonth) ?? null

  const handleUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return
    const file = files[0]

    setUploadingFuel(true)
    try {
      const body = new FormData()
      body.append("file", file)
      body.append("importMode", importMode)

      const res = await fetch("/api/fuel/import", {
        method: "POST",
        body,
      })

      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(data?.error || "Falha ao enviar planilha.")
      }

      toast({
        title: "Importação concluída",
        description:
          data?.replacedMonth
            ? `Competência ${data.replacedMonth} substituída com ${data?.imported ?? 0} registros do relatório mensal.`
            : data?.archivedMonths?.length > 0
            ? `Registros importados: ${data?.imported ?? 0}. Meses arquivados: ${data.archivedMonths.join(", ")}.`
            : `Registros importados: ${data?.imported ?? 0}`,
      })
      if (data?.replacedMonth) {
        setSelectedMonth(data.replacedMonth)
      } else if (currentMonth) {
        setSelectedMonth(currentMonth)
      }
      mutate()
    } catch (err) {
      const message = err instanceof Error ? err.message : "Falha ao enviar planilha."
      toast({
        title: "Erro",
        description: message,
        variant: "destructive",
      })
    } finally {
      setUploadingFuel(false)
    }
  }

  const handleCostCenterUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return
    const file = files[0]

    setUploadingCostCenter(true)
    try {
      const body = new FormData()
      body.append("file", file)

      const res = await fetch("/api/fuel/cost-center", {
        method: "POST",
        body,
      })

      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(data?.error || "Falha ao enviar a planilha de centro de custo.")
      }

      toast({
        title: "Centro de custo atualizado",
        description: `Cadastro substituído com ${data?.imported ?? 0} motoristas.`,
      })

      await mutateCache(FUEL_COST_CENTER_SWR_KEY)
    } catch (err) {
      const message = err instanceof Error ? err.message : "Falha ao enviar a planilha de centro de custo."
      toast({
        title: "Erro",
        description: message,
        variant: "destructive",
      })
    } finally {
      setUploadingCostCenter(false)
    }
  }

  const handleDeleteMonth = async () => {
    if (!selectedMonth) return

    setDeletingMonth(true)
    try {
      const res = await fetch(`/api/fuel/import?month=${encodeURIComponent(selectedMonth)}`, {
        method: "DELETE",
      })

      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(data?.error || "Falha ao excluir a competência.")
      }

      toast({
        title: "Competência excluída",
        description: `A competência ${selectedMonthOption?.label ?? selectedMonth} foi removida com sucesso.`,
      })

      if (currentMonth && selectedMonth !== currentMonth) {
        setSelectedMonth(currentMonth)
      }

      setIsDeleteDialogOpen(false)
      await mutate()
    } catch (err) {
      const message = err instanceof Error ? err.message : "Falha ao excluir a competência."
      toast({
        title: "Erro",
        description: message,
        variant: "destructive",
      })
    } finally {
      setDeletingMonth(false)
    }
  }

  return (
    <Card className="border-[#d8dfd1] bg-[linear-gradient(180deg,#fcfdfb_0%,#f5f8f2_100%)] shadow-sm">
      <CardHeader className="border-b border-[#e5ece0] pb-4">
        <CardTitle className="text-xl text-slate-900">Importações</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4 p-5">
        <div className="text-sm text-slate-500">
          {isMaster
            ? "Escolha se o arquivo é semanal ou mensal. O semanal mescla novos registros; o mensal substitui a competência inteira do arquivo."
            : "Somente o usuário mestre pode importar relatórios."}
        </div>

        {isMaster ? (
          <div className="grid gap-3 rounded-xl border border-[#eadfb9] bg-[#fff9e8] p-3 md:grid-cols-[220px_1fr] md:items-start">
            <div className="space-y-2">
              <Label htmlFor="fuel-import-mode" className="text-sm font-semibold text-slate-900">
                Tipo de importação
              </Label>
              <Select value={importMode} onValueChange={(value) => setImportMode(value as FuelImportMode)}>
                <SelectTrigger id="fuel-import-mode" className="bg-white">
                  <SelectValue placeholder="Selecione o tipo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="weekly">Semanal</SelectItem>
                  <SelectItem value="monthly">Mensal</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1 pt-0.5">
              <p className="text-sm font-semibold text-slate-900">
                {importMode === "monthly" ? "Relatório mensal" : "Relatório semanal"}
              </p>
              <p className="text-xs text-slate-600">
                {importMode === "monthly"
                  ? "Use quando o arquivo trouxer a competência inteira. O sistema substitui todo o mês do arquivo pelos dados novos."
                  : "Use para cargas parciais da semana. O sistema mescla os registros novos ao mês já existente."}
              </p>
            </div>
          </div>
        ) : null}

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-xs text-slate-500">
            {importMode === "monthly"
              ? "Modo mensal: a competência do arquivo será substituída por completo."
              : "Modo semanal: os registros novos serão mesclados ao que já existe."}
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:justify-end">
            <Button
              type="button"
              variant="outline"
              disabled={!isMaster || !selectedMonth || deletingMonth || uploadingFuel || uploadingCostCenter}
              className="gap-2 border-red-200 text-red-700 hover:bg-red-50 hover:text-red-800"
              onClick={() => setIsDeleteDialogOpen(true)}
            >
              <Trash2 className="h-4 w-4" />
              Excluir competência carregada
            </Button>

            <label className="inline-flex">
              <input
                type="file"
                accept=".csv,.xlsx,.xls,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv"
                className="hidden"
                onChange={(event) => handleCostCenterUpload(event.target.files)}
                disabled={uploadingFuel || uploadingCostCenter || !isMaster}
                ref={costCenterInputRef}
              />
              <Button
                type="button"
                disabled={uploadingFuel || uploadingCostCenter || !isMaster}
                className="gap-2 bg-[#6f9f4c] text-white hover:bg-[#628d44]"
                onClick={() => costCenterInputRef.current?.click()}
              >
                <Upload className="h-4 w-4" />
                {uploadingCostCenter ? "Importando centro de custo..." : "Importar centro de custo"}
              </Button>
            </label>

            <label className="inline-flex">
              <input
                type="file"
                accept=".csv,text/csv"
                className="hidden"
                onChange={(e) => handleUpload(e.target.files)}
                disabled={uploadingFuel || uploadingCostCenter || !isMaster}
                ref={fuelInputRef}
              />
              <Button
                type="button"
                disabled={uploadingFuel || uploadingCostCenter || !isMaster}
                className="gap-2 bg-[#69a74f] text-white hover:bg-[#5d9447]"
                onClick={() => fuelInputRef.current?.click()}
              >
                <Upload className="h-4 w-4" />
                {uploadingFuel ? "Enviando..." : "Enviar relatório VELOE"}
              </Button>
            </label>
          </div>
        </div>

        <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Excluir competência</AlertDialogTitle>
              <AlertDialogDescription>
                Isso remove todos os registros da competência {selectedMonthOption?.label ?? selectedMonth ?? "selecionada"}. Depois disso, você pode importar o relatório mensal limpo.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={deletingMonth}>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDeleteMonth}
                disabled={deletingMonth}
                className="bg-red-600 text-white hover:bg-red-700"
              >
                {deletingMonth ? "Excluindo..." : "Excluir competência"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardContent>
    </Card>
  )
}
