"use client"

import { useMemo, useState } from "react"
import { AlertTriangle, Check, CreditCard, Loader2 } from "lucide-react"
import { toast } from "@/hooks/use-toast"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { useVehicles } from "@/hooks/use-vehicles"
import { useColaboradores } from "@/hooks/use-colaboradores"
import { useDriverLinks } from "@/hooks/use-driver-links"
import {
  mapVehicleCardPlates,
  normalizePlate,
} from "@/lib/driver-links-shared"
import type { FuelRecord } from "@/hooks/use-fuel-data"
import type { Vehicle } from "@/lib/types"

type CartaoStatus = "definir" | "divergente" | "ok" | "sem-dado"

type CartaoRow = {
  vehicle: Vehicle
  motorista: string
  placaPlanilha: string
  status: CartaoStatus
}

type StatusFilter = "pendentes" | "todos"

const STATUS_LABELS: Record<CartaoStatus, string> = {
  definir: "Definir",
  divergente: "Divergente",
  ok: "Em dia",
  "sem-dado": "Sem dado",
}

const STATUS_CLASSES: Record<CartaoStatus, string> = {
  definir: "border-sky-200 bg-sky-100 text-sky-700 hover:bg-sky-100",
  divergente: "border-amber-200 bg-amber-100 text-amber-700 hover:bg-amber-100",
  ok: "border-emerald-200 bg-emerald-100 text-emerald-700 hover:bg-emerald-100",
  "sem-dado": "border-slate-200 bg-slate-100 text-slate-600 hover:bg-slate-100",
}

type AjusteCartaoProps = {
  records: FuelRecord[]
  canManage: boolean
}

export function AjusteCartao({ records, canManage }: AjusteCartaoProps) {
  const { vehicles, updateVehicle } = useVehicles(true)
  const { colaboradores } = useColaboradores(true)
  const { links } = useDriverLinks(true)

  const [statusFilter, setStatusFilter] = useState<StatusFilter>("pendentes")
  const [savingId, setSavingId] = useState<string | null>(null)
  const [bulkRunning, setBulkRunning] = useState(false)

  const rows = useMemo<CartaoRow[]>(() => {
    const cardPlates = mapVehicleCardPlates(records, vehicles, colaboradores, links)

    return vehicles
      .map((vehicle) => {
        const data = cardPlates.get(vehicle.id)
        if (!data) {
          return { vehicle, motorista: "", placaPlanilha: "", status: "sem-dado" as CartaoStatus }
        }

        const atual = normalizePlate(vehicle.placaCartaoCombustivel || "")
        const status: CartaoStatus =
          !atual ? "definir" : atual === normalizePlate(data.cardPlate) ? "ok" : "divergente"

        return { vehicle, motorista: data.motorista, placaPlanilha: data.cardPlate, status }
      })
      .sort((left, right) => left.vehicle.placa.localeCompare(right.vehicle.placa, "pt-BR"))
  }, [vehicles, colaboradores, links, records])

  const summary = useMemo(() => {
    return rows.reduce(
      (acc, row) => {
        acc[row.status] += 1
        return acc
      },
      { definir: 0, divergente: 0, ok: 0, "sem-dado": 0 } as Record<CartaoStatus, number>,
    )
  }, [rows])

  const filteredRows = useMemo(() => {
    if (statusFilter === "todos") return rows
    return rows.filter((row) => row.status === "definir" || row.status === "divergente")
  }, [rows, statusFilter])

  const applyPlate = async (row: CartaoRow) => {
    await updateVehicle(row.vehicle.id, { ...row.vehicle, placaCartaoCombustivel: row.placaPlanilha.toUpperCase() })
  }

  const handleApply = async (row: CartaoRow) => {
    setSavingId(row.vehicle.id)
    try {
      await applyPlate(row)
      toast({ title: "Placa do cartão salva", description: `${row.vehicle.placa}: ${row.placaPlanilha}.` })
    } catch (error) {
      toast({
        title: "Erro",
        description: error instanceof Error ? error.message : "Falha ao salvar a placa do cartão.",
        variant: "destructive",
      })
    } finally {
      setSavingId(null)
    }
  }

  const handleApplyAll = async () => {
    const pending = rows.filter((row) => row.status === "definir")
    if (pending.length === 0) return

    setBulkRunning(true)
    let updated = 0
    let failed = 0

    for (const row of pending) {
      try {
        await applyPlate(row)
        updated += 1
      } catch {
        failed += 1
      }
    }

    setBulkRunning(false)
    toast({
      title: "Atualização concluída",
      description: `${updated} veículo(s) atualizado(s)${failed > 0 ? `, ${failed} com falha` : ""}.`,
      variant: failed > 0 ? "destructive" : undefined,
    })
  }

  return (
    <div className="space-y-4">
      <Card className="border-[#d8dfd1] bg-[linear-gradient(180deg,#fcfdfb_0%,#f5f8f2_100%)] shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <CreditCard className="h-4 w-4 text-[#7c3aed]" />
            Placa do cartão VELOE
          </CardTitle>
          <CardDescription>
            Preenche a &quot;Placa Registrada no Cartão&quot; do veículo com o cartão que o colaborador vinculado mais
            usa na planilha da VELOE. O cartão segue a pessoa, então o vínculo é sempre pelo nome do motorista.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-end gap-3 p-5 pt-0">
          <div className="w-[220px] space-y-2">
            <span className="text-sm font-medium">Exibir</span>
            <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as StatusFilter)}>
              <SelectTrigger className="w-full bg-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="pendentes">Somente pendentes</SelectItem>
                <SelectItem value="todos">Todos os veículos</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Button disabled={!canManage || bulkRunning || summary.definir === 0} onClick={handleApplyAll}>
            {bulkRunning ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Check className="mr-2 h-4 w-4" />}
            Preencher {summary.definir} veículo(s)
          </Button>

          <p className="text-xs text-muted-foreground">
            Divergências só são aplicadas manualmente, para não sobrescrever placa cadastrada por engano.
          </p>
        </CardContent>
      </Card>

      <div className="overflow-hidden rounded-lg border border-border bg-card">
        <Table className="min-w-[900px]">
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead className="text-[0.88rem] font-semibold">Veículo</TableHead>
              <TableHead className="text-[0.88rem] font-semibold">Motorista do abastecimento</TableHead>
              <TableHead className="text-center text-[0.88rem] font-semibold">Placa no sistema</TableHead>
              <TableHead className="text-center text-[0.88rem] font-semibold">Placa na planilha</TableHead>
              <TableHead className="text-center text-[0.88rem] font-semibold">Situação</TableHead>
              <TableHead className="w-[150px] text-center text-[0.88rem] font-semibold">Ação</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredRows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="py-10 text-center text-sm text-muted-foreground">
                  Nenhum veículo com placa de cartão pendente.
                </TableCell>
              </TableRow>
            ) : null}

            {filteredRows.map((row) => {
              const saving = savingId === row.vehicle.id

              return (
                <TableRow key={row.vehicle.id}>
                  <TableCell>
                    <div className="font-mono text-[0.95rem] font-semibold text-foreground">{row.vehicle.placa}</div>
                    <div className="text-[0.78rem] text-muted-foreground">{row.vehicle.modelo}</div>
                  </TableCell>
                  <TableCell className="text-[0.9rem]">{row.motorista || "-"}</TableCell>
                  <TableCell className="text-center font-mono text-[0.9rem] text-muted-foreground">
                    {row.vehicle.placaCartaoCombustivel || "-"}
                  </TableCell>
                  <TableCell className="text-center font-mono text-[0.9rem] font-medium">
                    {row.placaPlanilha || "-"}
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge variant="outline" className={STATUS_CLASSES[row.status]}>
                      {row.status === "divergente" ? <AlertTriangle className="mr-1 h-3 w-3" /> : null}
                      {STATUS_LABELS[row.status]}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-center">
                    {row.status === "definir" || row.status === "divergente" ? (
                      <Button size="sm" disabled={!canManage || saving || bulkRunning} onClick={() => handleApply(row)}>
                        {saving ? (
                          <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Check className="mr-1.5 h-3.5 w-3.5" />
                        )}
                        Aplicar
                      </Button>
                    ) : (
                      <span className="text-[0.75rem] text-muted-foreground">-</span>
                    )}
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
