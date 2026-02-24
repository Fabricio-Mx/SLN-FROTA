"use client"

import { useMemo, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { useFuelData } from "@/hooks/use-fuel-data"

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value)
}

function formatDateTime(value: string): string {
  const date = new Date(value)
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

export function FuelTransactionsTable() {
  const { records, isLoading } = useFuelData()
  const [search, setSearch] = useState("")
  const [fuelType, setFuelType] = useState("todos")
  const [fromDate, setFromDate] = useState("")
  const [toDate, setToDate] = useState("")
  const [fromTime, setFromTime] = useState("")
  const [toTime, setToTime] = useState("")

  const filtered = useMemo(() => {
    const searchTerm = search.trim().toLowerCase()
    const start = toDateOnly(fromDate)
    const end = toDateOnly(toDate)
    const startMinutes = toMinutes(fromTime)
    const endMinutes = toMinutes(toTime)
    if (end) {
      end.setHours(23, 59, 59, 999)
    }

    return records.filter((record) => {
      const recordDate = new Date(record.dateTime)
      if (Number.isNaN(recordDate.getTime())) return false

      if (searchTerm) {
        const haystack = [record.cardPlate, record.cpfMotorista, record.nomeMotorista]
          .join(" ")
          .toLowerCase()
        if (!haystack.includes(searchTerm)) return false
      }

      if (fuelType !== "todos") {
        const normalized = record.tipoCombustivel.toLowerCase()
        if (fuelType === "gasolina" && !normalized.includes("gas")) return false
        if (fuelType === "alcool" && !normalized.includes("alc")) return false
      }

      if (start && recordDate < start) return false
      if (end && recordDate > end) return false

      if (startMinutes !== null || endMinutes !== null) {
        const recordMinutes = recordDate.getHours() * 60 + recordDate.getMinutes()
        if (startMinutes !== null && recordMinutes < startMinutes) return false
        if (endMinutes !== null && recordMinutes > endMinutes) return false
      }

      return true
    })
  }, [records, search, fuelType, fromDate, toDate, fromTime, toTime])

  return (
    <Card>
      <CardHeader>
        <CardTitle>Abastecimentos importados</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 md:grid-cols-6">
          <div className="space-y-1">
            <Label htmlFor="fuel-search">Buscar</Label>
            <Input
              id="fuel-search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Placa do cartao, CPF ou motorista"
            />
          </div>
          <div className="space-y-1">
            <Label>Combustivel</Label>
            <Select value={fuelType} onValueChange={setFuelType}>
              <SelectTrigger>
                <SelectValue placeholder="Todos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                <SelectItem value="gasolina">Gasolina</SelectItem>
                <SelectItem value="alcool">Alcool</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label htmlFor="fuel-from">De</Label>
            <Input id="fuel-from" type="date" value={fromDate} onChange={(event) => setFromDate(event.target.value)} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="fuel-to">Ate</Label>
            <Input id="fuel-to" type="date" value={toDate} onChange={(event) => setToDate(event.target.value)} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="fuel-from-time">Hora de</Label>
            <Input
              id="fuel-from-time"
              type="time"
              value={fromTime}
              onChange={(event) => setFromTime(event.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="fuel-to-time">Hora ate</Label>
            <Input
              id="fuel-to-time"
              type="time"
              value={toTime}
              onChange={(event) => setToTime(event.target.value)}
            />
          </div>
        </div>

        <div className="overflow-hidden rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Placa do cartao</TableHead>
                <TableHead>CPF</TableHead>
                <TableHead>Motorista</TableHead>
                <TableHead>Combustivel</TableHead>
                <TableHead>Valor</TableHead>
                <TableHead>Data</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((record, index) => (
                <TableRow key={`${record.cardPlate}-${record.cpfMotorista}-${record.dateTime}-${index}`}>
                  <TableCell className="font-medium">{record.cardPlate || "-"}</TableCell>
                  <TableCell>{record.cpfMotorista || "-"}</TableCell>
                  <TableCell>{record.nomeMotorista || "-"}</TableCell>
                  <TableCell>{record.tipoCombustivel || "-"}</TableCell>
                  <TableCell>{formatCurrency(record.valor)}</TableCell>
                  <TableCell>{formatDateTime(record.dateTime)}</TableCell>
                </TableRow>
              ))}
              {!isLoading && filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="py-6 text-center text-sm text-muted-foreground">
                    Nenhum abastecimento encontrado com os filtros atuais.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  )
}
