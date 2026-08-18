"use client"

import { AlertTriangle, CheckCircle, Clock, IdCard, Users } from "lucide-react"
import type { Colaborador } from "@/lib/types"

interface ColaboradoresSummaryProps {
  colaboradores: Colaborador[]
  total: number
}

export function ColaboradoresSummary({ colaboradores, total }: ColaboradoresSummaryProps) {
  const hoje = new Date()
  const trintaDias = new Date(hoje.getTime() + 30 * 24 * 60 * 60 * 1000)

  let vencidas = 0
  let vencendo = 0
  let validas = 0
  let semCnh = 0

  for (const colaborador of colaboradores) {
    const vencimento = colaborador.dataVencimentoCNH ? new Date(colaborador.dataVencimentoCNH) : null

    if (!vencimento || Number.isNaN(vencimento.getTime())) {
      semCnh += 1
      continue
    }

    if (vencimento < hoje) vencidas += 1
    else if (vencimento <= trintaDias) vencendo += 1
    else validas += 1
  }

  const cards = [
    { label: "Colaboradores", value: colaboradores.length, hint: `de ${total} no total`, icon: Users, tone: "text-foreground" },
    { label: "CNH vencida", value: vencidas, hint: "regularizar", icon: AlertTriangle, tone: "text-destructive" },
    { label: "Vence em 30 dias", value: vencendo, hint: "atenção", icon: Clock, tone: "text-chart-3" },
    { label: "CNH válida", value: validas, hint: "em dia", icon: CheckCircle, tone: "text-[#4f8f57]" },
    { label: "Sem CNH", value: semCnh, hint: "cadastro incompleto", icon: IdCard, tone: "text-muted-foreground" },
  ]

  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
      {cards.map((card) => (
        <div key={card.label} className="rounded-lg border border-border bg-card px-4 py-3">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-muted-foreground">{card.label}</p>
            <card.icon className={`h-4 w-4 ${card.tone}`} />
          </div>
          <p className={`mt-1 text-2xl font-semibold ${card.tone}`}>{card.value}</p>
          <p className="text-xs text-muted-foreground">{card.hint}</p>
        </div>
      ))}
    </div>
  )
}
