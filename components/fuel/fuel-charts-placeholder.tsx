"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

export function FuelChartsPlaceholder() {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Gasto por dia/semana/mês</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-56 rounded-lg border border-dashed border-border bg-muted/40 flex items-center justify-center text-sm text-muted-foreground">
            Gráfico será exibido após a importação do relatório.
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Gasto por veículo/colaborador</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-56 rounded-lg border border-dashed border-border bg-muted/40 flex items-center justify-center text-sm text-muted-foreground">
            Gráfico será exibido após a importação do relatório.
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
