"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
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

export function FuelSummary() {
  const { dailyTotal, weeklyTotal, monthlyTotal, monthlyCount, reportDate } = useFuelData()

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm text-muted-foreground">
            Relatório do dia {formatDateBr(reportDate)}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-semibold">{formatCurrency(dailyTotal)}</div>
          <p className="text-xs text-muted-foreground">
            {dailyTotal > 0 ? "Fechamento do dia" : "Aguardando importação"}
          </p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm text-muted-foreground">Gasto na semana</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-semibold">{formatCurrency(weeklyTotal)}</div>
          <p className="text-xs text-muted-foreground">
            {weeklyTotal > 0 ? "Últimos 7 dias" : "Aguardando importação"}
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
  )
}
