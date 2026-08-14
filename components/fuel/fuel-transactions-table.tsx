"use client"

import { memo, useDeferredValue, useMemo, useState } from "react"
import { RotateCcw } from "lucide-react"
import { getCostCenterBaseKey, preferCostCenterLabel, resolveCostCenterRecord } from "@/lib/cost-center-shared"
import { useFuelCostCenters } from "@/hooks/use-fuel-cost-centers"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { useFuelDataContext } from "@/components/fuel/fuel-data-provider"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { parseFuelDateTime } from "@/lib/fuel-datetime"

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value)
}

function formatDateTime(value: string): string {
  const date = parseFuelDateTime(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(date)
}

function toDateOnly(value: string): Date | null {
  if (!value) return null
  const [year, month, day] = value.split("-").map(Number)
  if (!year || !month || !day) return null
  return new Date(year, month - 1, day)
}

function toMinutes(value: string): number | null {
  if (!value) return null
  const [hours, minutes] = value.split(":").map(Number)
  if (Number.isNaN(hours) || Number.isNaN(minutes)) return null
  return hours * 60 + minutes
}

function normalizeSearchValue(value: string): string {
  return value.toLowerCase().trim()
}

function normalizeDigits(value: string): string {
  return value.replace(/\D/g, "")
}

function normalizePlate(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "")
}

type IndexedFuelRecord = {
  cardPlate: string
  cpfMotorista: string
  nomeMotorista: string
  tipoCombustivel: string
  valor: number
  dateTime: string
  centroCusto: string
  supervisor: string
  coordenador: string
  parsedDate: Date
  normalizedPlate: string
  normalizedCpf: string
  normalizedDriverName: string
}

const FuelTransactionsRows = memo(function FuelTransactionsRows({
  records,
  isLoading,
}: {
  records: IndexedFuelRecord[]
  isLoading: boolean
}) {
  return (
    <TableBody>
      {records.map((record) => (
        <TableRow key={`${record.cardPlate}-${record.cpfMotorista}-${record.dateTime}-${record.valor}`}>
          <TableCell className="font-medium">{record.cardPlate || "-"}</TableCell>
          <TableCell>{record.cpfMotorista || "-"}</TableCell>
          <TableCell>{record.nomeMotorista || "-"}</TableCell>
          <TableCell>{record.centroCusto || "-"}</TableCell>
          <TableCell>{record.supervisor || "-"}</TableCell>
          <TableCell>{record.coordenador || "-"}</TableCell>
          <TableCell>{record.tipoCombustivel || "-"}</TableCell>
          <TableCell>{formatCurrency(record.valor)}</TableCell>
          <TableCell>{formatDateTime(record.dateTime)}</TableCell>
        </TableRow>
      ))}
      {!isLoading && records.length === 0 && (
        <TableRow>
          <TableCell colSpan={9} className="py-6 text-center text-sm text-muted-foreground">
            Nenhum abastecimento encontrado com os filtros atuais.
          </TableCell>
        </TableRow>
      )}
    </TableBody>
  )
})

export function FuelTransactionsTable() {
  const { records, isLoading, availableMonths, selectedMonth } = useFuelDataContext()
  const { lookup } = useFuelCostCenters()
  const [search, setSearch] = useState("")
  const [fuelType, setFuelType] = useState("todos")
  const [costCenter, setCostCenter] = useState("todos")
  const [supervisor, setSupervisor] = useState("todos")
  const [matchStatus, setMatchStatus] = useState("todos")
  const [fromDate, setFromDate] = useState("")
  const [toDate, setToDate] = useState("")
  const [fromTime, setFromTime] = useState("")
  const [toTime, setToTime] = useState("")
  const deferredSearch = useDeferredValue(search)

  const indexedRecords = useMemo<IndexedFuelRecord[]>(() => {
    return records
      .map((record) => {
        const parsedDate = parseFuelDateTime(record.dateTime)
        const matchedCostCenter = resolveCostCenterRecord(record.nomeMotorista, lookup)

        return {
          ...record,
          centroCusto: matchedCostCenter?.centroCusto ?? "",
          supervisor: matchedCostCenter?.supervisor ?? "",
          coordenador: matchedCostCenter?.coordenador ?? "",
          parsedDate,
          normalizedPlate: normalizePlate(record.cardPlate),
          normalizedCpf: normalizeDigits(record.cpfMotorista),
          normalizedDriverName: normalizeSearchValue(record.nomeMotorista),
        }
      })
      .filter((record) => !Number.isNaN(record.parsedDate.getTime()))
  }, [records, lookup])

  const matchedCount = useMemo(() => {
    return indexedRecords.filter((record) => record.centroCusto || record.supervisor || record.coordenador).length
  }, [indexedRecords])

  const costCenterOptions = useMemo(() => {
    const optionsByKey = new Map<string, string>()

    for (const value of indexedRecords.map((record) => record.centroCusto).filter(Boolean)) {
      const key = getCostCenterBaseKey(value)
      const current = optionsByKey.get(key) ?? ""
      optionsByKey.set(key, preferCostCenterLabel(current, value))
    }

    return Array.from(optionsByKey.values()).sort((left, right) => left.localeCompare(right, "pt-BR"))
  }, [indexedRecords])

  const supervisorOptions = useMemo(() => {
    return Array.from(new Set(indexedRecords.map((record) => record.supervisor).filter(Boolean))).sort((left, right) =>
      left.localeCompare(right, "pt-BR")
    )
  }, [indexedRecords])

  const filtered = useMemo(() => {
    const searchTerm = normalizeSearchValue(deferredSearch)
    const searchDigits = normalizeDigits(searchTerm)
    const searchPlate = normalizePlate(searchTerm)
    const start = toDateOnly(fromDate)
    const end = toDateOnly(toDate)
    const startMinutes = toMinutes(fromTime)
    const endMinutes = toMinutes(toTime)
    if (end) {
      end.setHours(23, 59, 59, 999)
    }

    return indexedRecords.filter((record) => {
      if (searchTerm) {
        const matchesDriverName = record.normalizedDriverName.includes(searchTerm)
        const matchesCpf = searchDigits.length > 0 && record.normalizedCpf.includes(searchDigits)
        const matchesPlate = searchPlate.length > 0 && record.normalizedPlate.includes(searchPlate)

        if (!matchesDriverName && !matchesCpf && !matchesPlate) return false
      }

      if (fuelType !== "todos") {
        const normalized = record.tipoCombustivel.toLowerCase()
        if (fuelType === "gasolina" && !normalized.includes("gas")) return false
        if (fuelType === "alcool" && !normalized.includes("alc") && !normalized.includes("etan")) return false
        if (fuelType === "diesel" && !normalized.includes("dies")) return false
        if (fuelType === "gnv" && !normalized.includes("gnv")) return false
      }

      if (costCenter !== "todos" && record.centroCusto !== costCenter) return false
      if (supervisor !== "todos" && record.supervisor !== supervisor) return false
      if (matchStatus === "com-centro" && !record.centroCusto) return false
      if (matchStatus === "sem-centro" && record.centroCusto) return false

      if (start && record.parsedDate < start) return false
      if (end && record.parsedDate > end) return false

      if (startMinutes !== null || endMinutes !== null) {
        const recordMinutes = record.parsedDate.getHours() * 60 + record.parsedDate.getMinutes()
        if (startMinutes !== null && recordMinutes < startMinutes) return false
        if (endMinutes !== null && recordMinutes > endMinutes) return false
      }

      return true
    })
  }, [indexedRecords, deferredSearch, fuelType, costCenter, supervisor, matchStatus, fromDate, toDate, fromTime, toTime])

  const selectedMonthOption = useMemo(() => {
    return availableMonths.find((month) => month.month === selectedMonth) ?? null
  }, [availableMonths, selectedMonth])

  const clearFilters = () => {
    setSearch("")
    setFuelType("todos")
    setCostCenter("todos")
    setSupervisor("todos")
    setMatchStatus("todos")
    setFromDate("")
    setToDate("")
    setFromTime("")
    setToTime("")
  }

  return (
    <Card className="border-[#d8dfd1] bg-white shadow-sm">
      <CardHeader className="border-b border-[#e5ece0] pb-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <CardTitle className="text-xl text-slate-900">Abastecimentos importados</CardTitle>
            <p className="mt-1 text-sm text-slate-500">
              Consulte, filtre e confira as movimentações de {selectedMonthOption?.label ?? "mês selecionado"}.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="rounded-full border border-[#d6e3ce] bg-[#f5faf1] px-3 py-1 text-xs font-semibold uppercase tracking-[0.12em] text-[#56814e]">
              {filtered.length} registros
            </span>
            <span className="rounded-full border border-[#e4dbf8] bg-[#f7f2ff] px-3 py-1 text-xs font-semibold uppercase tracking-[0.12em] text-[#7443d6]">
              {matchedCount} com centro de custo
            </span>
            <Button type="button" variant="outline" className="gap-2 bg-transparent" onClick={clearFilters}>
              <RotateCcw className="h-4 w-4" />
              Limpar filtros
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4 p-5">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-12">
          <div className="space-y-1 xl:col-span-3">
            <Label htmlFor="fuel-search">Buscar</Label>
            <Input
              id="fuel-search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Digite nome do motorista, placa ou CPF"
            />
          </div>
          <div className="space-y-1 xl:col-span-2">
            <Label>Combustível</Label>
            <Select value={fuelType} onValueChange={setFuelType}>
              <SelectTrigger>
                <SelectValue placeholder="Todos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                <SelectItem value="gasolina">Gasolina</SelectItem>
                <SelectItem value="alcool">Álcool</SelectItem>
                <SelectItem value="diesel">Diesel</SelectItem>
                <SelectItem value="gnv">GNV</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1 xl:col-span-2">
            <Label>Centro de custo</Label>
            <Select value={costCenter} onValueChange={setCostCenter}>
              <SelectTrigger>
                <SelectValue placeholder="Todos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                {costCenterOptions.map((option) => (
                  <SelectItem key={option} value={option}>
                    {option}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1 xl:col-span-2">
            <Label>Supervisor</Label>
            <Select value={supervisor} onValueChange={setSupervisor}>
              <SelectTrigger>
                <SelectValue placeholder="Todos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                {supervisorOptions.map((option) => (
                  <SelectItem key={option} value={option}>
                    {option}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1 xl:col-span-1">
            <Label>Vínculo</Label>
            <Select value={matchStatus} onValueChange={setMatchStatus}>
              <SelectTrigger>
                <SelectValue placeholder="Todos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                <SelectItem value="com-centro">Com centro de custo</SelectItem>
                <SelectItem value="sem-centro">Sem centro de custo</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1 xl:col-span-1">
            <Label htmlFor="fuel-from">De</Label>
            <Input id="fuel-from" type="date" value={fromDate} onChange={(event) => setFromDate(event.target.value)} />
          </div>
          <div className="space-y-1 xl:col-span-1">
            <Label htmlFor="fuel-to">Até</Label>
            <Input id="fuel-to" type="date" value={toDate} onChange={(event) => setToDate(event.target.value)} />
          </div>
          <div className="space-y-1 xl:col-span-1">
            <Label htmlFor="fuel-from-time">Hora de</Label>
            <Input
              id="fuel-from-time"
              type="time"
              value={fromTime}
              onChange={(event) => setFromTime(event.target.value)}
            />
          </div>
          <div className="space-y-1 xl:col-span-1">
            <Label htmlFor="fuel-to-time">Hora até</Label>
            <Input
              id="fuel-to-time"
              type="time"
              value={toTime}
              onChange={(event) => setToTime(event.target.value)}
            />
          </div>
        </div>

        <div className="overflow-x-auto rounded-xl border border-[#dfe7d8]">
          <Table>
            <TableHeader>
              <TableRow className="bg-[#f6faf3] hover:bg-[#f6faf3]">
                <TableHead>Placa do cartão</TableHead>
                <TableHead>CPF</TableHead>
                <TableHead>Motorista</TableHead>
                <TableHead>Centro de custo</TableHead>
                <TableHead>Supervisor</TableHead>
                <TableHead>Coordenador</TableHead>
                <TableHead>Combustível</TableHead>
                <TableHead>Valor pago</TableHead>
                <TableHead>Data</TableHead>
              </TableRow>
            </TableHeader>
            <FuelTransactionsRows records={filtered} isLoading={isLoading} />
          </Table>
        </div>
      </CardContent>
    </Card>
  )
}
