"use client"

import { useMemo, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useFuelData } from "@/hooks/use-fuel-data"

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value)
}

function formatDateBr(date: Date): string {
  return new Intl.DateTimeFormat("pt-BR").format(date)
}

function toDateOnly(value: string): Date | null {
  if (!value) return null
  const [year, month, day] = value.split("-").map(Number)
  if (!year || !month || !day) return null
  return new Date(year, month - 1, day)
}

export function FuelSummary() {
  const { records, dailyTotal, weeklyTotal, monthlyTotal, monthlyCount, reportDate } = useFuelData()
  const [selectedDay, setSelectedDay] = useState("")
  const [rangeStart, setRangeStart] = useState("")
  const [rangeEnd, setRangeEnd] = useState("")

  const { dailyValue, dailyLabel, rangeValue, rangeLabel } = useMemo(() => {
    const selectedDate = toDateOnly(selectedDay)
    const dayBase = selectedDate ?? reportDate

    let dailyValueLocal = 0
    let rangeValueLocal = 0

    const rangeStartDate = toDateOnly(rangeStart)
    const rangeEndDate = toDateOnly(rangeEnd)
    if (rangeEndDate) {
      rangeEndDate.setHours(23, 59, 59, 999)
    }

    for (const record of records) {
      const recordDate = new Date(record.dateTime)
      if (Number.isNaN(recordDate.getTime())) continue

      if (
        recordDate.getFullYear() === dayBase.getFullYear() &&
        recordDate.getMonth() === dayBase.getMonth() &&
        recordDate.getDate() === dayBase.getDate()
      ) {
        dailyValueLocal += record.valor
      }

      if (rangeStartDate && rangeEndDate) {
        if (recordDate >= rangeStartDate && recordDate <= rangeEndDate) {
          rangeValueLocal += record.valor
        }
      }
    }

    const dailyLabelLocal = selectedDate ? "Dia selecionado" : "Fechamento do dia"
    const rangeLabelLocal = rangeStartDate && rangeEndDate ? "Período selecionado" : "Últimos 7 dias"

    return {
      dailyValue: selectedDate ? dailyValueLocal : dailyTotal,
      dailyLabel: dailyLabelLocal,
      rangeValue: rangeStartDate && rangeEndDate ? rangeValueLocal : weeklyTotal,
      rangeLabel: rangeLabelLocal,
    }
  }, [records, selectedDay, rangeStart, rangeEnd, reportDate, dailyTotal, weeklyTotal])

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="space-y-1">
          <Label htmlFor="fuel-day">Dia</Label>
          <Input
            id="fuel-day"
            type="date"
            value={selectedDay}
            onChange={(event) => setSelectedDay(event.target.value)}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="fuel-range-start">Semana de</Label>
          <Input
            id="fuel-range-start"
            type="date"
            value={rangeStart}
            onChange={(event) => setRangeStart(event.target.value)}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="fuel-range-end">Ate</Label>
          <Input
            id="fuel-range-end"
            type="date"
            value={rangeEnd}
            onChange={(event) => setRangeEnd(event.target.value)}
          />
        </div>
        <div />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">
              Relatório do dia {formatDateBr(selectedDay ? new Date(selectedDay) : reportDate)}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">{formatCurrency(dailyValue)}</div>
            <p className="text-xs text-muted-foreground">
              {dailyValue > 0 ? dailyLabel : "Aguardando importação"}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Gasto na semana</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">{formatCurrency(rangeValue)}</div>
            <p className="text-xs text-muted-foreground">
              {rangeValue > 0 ? rangeLabel : "Aguardando importação"}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Gasto no mês</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">{formatCurrency(monthlyTotal)}</div>
            <p className="text-xs text-muted-foreground">Acumulado do mês</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Transações</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">{monthlyCount}</div>
            <p className="text-xs text-muted-foreground">
              {monthlyCount > 0 ? "Transações no mês" : "Aguardando importação"}
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
