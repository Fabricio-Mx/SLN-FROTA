"use client"

import { useMemo, useState } from "react"
import { AlertTriangle, Check, Gauge, Loader2 } from "lucide-react"
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
  buildDriverMatches,
  collectAgregadoDrivers,
  collectDriverSources,
  collectOdometerReadings,
  mapDriversToVehicles,
  normalizePlate,
  type OdometerReading,
} from "@/lib/driver-links-shared"
import type { FuelRecord } from "@/hooks/use-fuel-data"
import type { Vehicle } from "@/lib/types"

// Acima disso o salto de hodometro provavelmente e erro de digitacao do motorista.
const SUSPICIOUS_JUMP_KM = 30_000

type KmStatus = "atualizar" | "atualizado" | "verificar" | "sem-leitura"

type KmRow = {
  vehicle: Vehicle
  reading: OdometerReading | null
  origem: "cartao" | "motorista" | null
  diff: number
  status: KmStatus
}

type StatusFilter = "atualizar" | "todos"

const STATUS_LABELS: Record<KmStatus, string> = {
  atualizar: "Atualizar",
  atualizado: "Em dia",
  verificar: "Verificar",
  "sem-leitura": "Sem leitura",
}

const STATUS_CLASSES: Record<KmStatus, string> = {
  atualizar: "border-sky-200 bg-sky-100 text-sky-700 hover:bg-sky-100",
  atualizado: "border-emerald-200 bg-emerald-100 text-emerald-700 hover:bg-emerald-100",
  verificar: "border-amber-200 bg-amber-100 text-amber-700 hover:bg-amber-100",
  "sem-leitura": "border-slate-200 bg-slate-100 text-slate-600 hover:bg-slate-100",
}

function formatKm(value: number | null | undefined): string {
  if (value === null || value === undefined) return "-"
  return `${value.toLocaleString("pt-BR")} km`
}

function formatDate(value: string | null): string {
  if (!value) return "-"
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return "-"
  return parsed.toLocaleDateString("pt-BR")
}

type AjusteKmProps = {
  records: FuelRecord[]
  canManage: boolean
}

export function AjusteKm({ records, canManage }: AjusteKmProps) {
  const { vehicles, updateVehicle } = useVehicles(true)
  const { colaboradores } = useColaboradores(true)
  const { links } = useDriverLinks(true)

  const [statusFilter, setStatusFilter] = useState<StatusFilter>("atualizar")
  const [savingId, setSavingId] = useState<string | null>(null)
  const [bulkRunning, setBulkRunning] = useState(false)

  const readings = useMemo(() => collectOdometerReadings(records), [records])

  // Motorista vinculado -> veiculo atribuido a ele, quando a placa do cartao nao bate.
  const vehicleIdByDriverKey = useMemo(() => {
    const agregados = collectAgregadoDrivers(vehicles)
    const matches = buildDriverMatches(collectDriverSources(records), colaboradores, links, agregados)
    return mapDriversToVehicles(matches, vehicles)
  }, [records, colaboradores, links, vehicles])

  const rows = useMemo<KmRow[]>(() => {
    const readingByVehicleId = new Map<string, { reading: OdometerReading; origem: "cartao" | "motorista" }>()

    for (const [driverKey, vehicleId] of vehicleIdByDriverKey) {
      const reading = readings.byDriver.get(driverKey)
      if (reading) readingByVehicleId.set(vehicleId, { reading, origem: "motorista" })
    }

    for (const vehicle of vehicles) {
      // Casa pela placa registrada no cartao; a placa do veiculo nao serve, o cartao segue a pessoa.
      const plateKey = normalizePlate(vehicle.placaCartaoCombustivel || "")
      if (!plateKey) continue

      const reading = readings.byPlate.get(plateKey)
      if (reading) readingByVehicleId.set(vehicle.id, { reading, origem: "cartao" })
    }

    return vehicles
      .map((vehicle) => {
        const match = readingByVehicleId.get(vehicle.id)
        if (!match) {
          return { vehicle, reading: null, origem: null, diff: 0, status: "sem-leitura" as KmStatus }
        }

        const currentKm = vehicle.km ?? 0
        const diff = match.reading.km - currentKm
        const status: KmStatus =
          diff <= 0 ? "atualizado" : diff > SUSPICIOUS_JUMP_KM && currentKm > 0 ? "verificar" : "atualizar"

        return { vehicle, reading: match.reading, origem: match.origem, diff, status }
      })
      .sort((left, right) => right.diff - left.diff)
  }, [vehicles, readings, vehicleIdByDriverKey])

  const summary = useMemo(() => {
    return rows.reduce(
      (acc, row) => {
        acc[row.status] += 1
        return acc
      },
      { atualizar: 0, atualizado: 0, verificar: 0, "sem-leitura": 0 } as Record<KmStatus, number>,
    )
  }, [rows])

  const filteredRows = useMemo(() => {
    if (statusFilter === "todos") return rows
    return rows.filter((row) => row.status === "atualizar" || row.status === "verificar")
  }, [rows, statusFilter])

  const applyKm = async (row: KmRow) => {
    if (!row.reading) return
    await updateVehicle(row.vehicle.id, { ...row.vehicle, km: row.reading.km })
  }

  const handleApply = async (row: KmRow) => {
    setSavingId(row.vehicle.id)
    try {
      await applyKm(row)
      toast({
        title: "KM atualizado",
        description: `${row.vehicle.placa}: ${formatKm(row.reading?.km)}.`,
      })
    } catch (error) {
      toast({
        title: "Erro",
        description: error instanceof Error ? error.message : "Falha ao atualizar o KM.",
        variant: "destructive",
      })
    } finally {
      setSavingId(null)
    }
  }

  const handleApplyAll = async () => {
    const pending = rows.filter((row) => row.status === "atualizar")
    if (pending.length === 0) return

    setBulkRunning(true)
    let updated = 0
    let failed = 0

    for (const row of pending) {
      try {
        await applyKm(row)
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
            <Gauge className="h-4 w-4 text-[#0f766e]" />
            KM dos veículos pelo abastecimento
          </CardTitle>
          <CardDescription>
            Usa o hodômetro informado pelo motorista na planilha da VELOE (coluna AO) para atualizar o KM atual do
            veículo. O veículo é encontrado pela placa do cartão e, quando não bate, pelo colaborador vinculado.
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
                <SelectItem value="atualizar">Somente pendentes</SelectItem>
                <SelectItem value="todos">Todos os veículos</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Button disabled={!canManage || bulkRunning || summary.atualizar === 0} onClick={handleApplyAll}>
            {bulkRunning ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Check className="mr-2 h-4 w-4" />}
            Atualizar {summary.atualizar} veículo(s)
          </Button>

          <p className="text-xs text-muted-foreground">
            Saltos acima de {SUSPICIOUS_JUMP_KM.toLocaleString("pt-BR")} km ficam como &quot;Verificar&quot; e só são
            aplicados manualmente.
          </p>
        </CardContent>
      </Card>

      <div className="overflow-hidden rounded-lg border border-border bg-card">
        <Table className="min-w-[980px]">
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead className="text-[0.88rem] font-semibold">Veículo</TableHead>
              <TableHead className="text-[0.88rem] font-semibold">Motorista do abastecimento</TableHead>
              <TableHead className="text-center text-[0.88rem] font-semibold">KM no sistema</TableHead>
              <TableHead className="text-center text-[0.88rem] font-semibold">KM informado</TableHead>
              <TableHead className="text-center text-[0.88rem] font-semibold">Diferença</TableHead>
              <TableHead className="text-center text-[0.88rem] font-semibold">Situação</TableHead>
              <TableHead className="w-[150px] text-center text-[0.88rem] font-semibold">Ação</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredRows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="py-10 text-center text-sm text-muted-foreground">
                  Nenhum veículo com KM pendente nesta competência.
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
                  <TableCell>
                    <div className="text-[0.9rem]">{row.reading?.nomeMotorista || "-"}</div>
                    {row.reading ? (
                      <div className="text-[0.72rem] text-muted-foreground">
                        {formatDate(row.reading.dateTime)} · {row.origem === "cartao" ? "placa do cartão" : "colaborador vinculado"}
                      </div>
                    ) : null}
                  </TableCell>
                  <TableCell className="text-center text-[0.9rem]">{formatKm(row.vehicle.km)}</TableCell>
                  <TableCell className="text-center text-[0.9rem] font-medium">{formatKm(row.reading?.km)}</TableCell>
                  <TableCell className="text-center text-[0.9rem]">
                    {row.reading ? (
                      <span className={row.diff > 0 ? "font-medium text-sky-700" : "text-muted-foreground"}>
                        {row.diff > 0 ? `+${row.diff.toLocaleString("pt-BR")}` : row.diff.toLocaleString("pt-BR")}
                      </span>
                    ) : (
                      "-"
                    )}
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge variant="outline" className={STATUS_CLASSES[row.status]}>
                      {row.status === "verificar" ? <AlertTriangle className="mr-1 h-3 w-3" /> : null}
                      {STATUS_LABELS[row.status]}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-center">
                    {row.status === "atualizar" || row.status === "verificar" ? (
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
