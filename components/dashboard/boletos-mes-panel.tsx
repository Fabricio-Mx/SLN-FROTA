"use client"

import { useMemo } from "react"
import Link from "next/link"
import { ArrowRight, Receipt } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  PARCELA_STATUS_BADGE_CLASS,
  PARCELA_STATUS_LABELS,
  formatCurrency,
  formatDate,
  getParcelaStatus,
  isSameMonth,
} from "@/lib/fornecedores"
import { cn } from "@/lib/utils"
import type { OrdemServico } from "@/lib/types"

type BoletosMesPanelProps = {
  ordens: OrdemServico[]
}

export function BoletosMesPanel({ ordens }: BoletosMesPanelProps) {
  const { parcelas, totalAberto, totalPago, mesLabel } = useMemo(() => {
    const hoje = new Date()

    const itens = ordens
      .flatMap((ordem) =>
        (ordem.boletoParcelas ?? [])
          .filter((parcela) => parcela.vencimento && isSameMonth(parcela.vencimento, hoje))
          .map((parcela) => ({ ordem, parcela }))
      )
      .sort((left, right) => left.parcela.vencimento.localeCompare(right.parcela.vencimento))

    return {
      parcelas: itens,
      totalAberto: itens
        .filter((item) => !item.parcela.pago)
        .reduce((sum, item) => sum + (item.parcela.valor ?? 0), 0),
      totalPago: itens.filter((item) => item.parcela.pago).reduce((sum, item) => sum + (item.parcela.valor ?? 0), 0),
      mesLabel: new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric" }).format(hoje),
    }
  }, [ordens])

  return (
    <Card className="overflow-hidden rounded-[1.6rem] border-[#dde5ee] bg-[linear-gradient(180deg,#ffffff_0%,#f8fafc_100%)] shadow-[0_18px_40px_rgba(61,97,146,0.08)]">
      <CardHeader className="border-b border-[#e7edf4] bg-[linear-gradient(180deg,#fcfdff_0%,#f6f8fb_100%)] pb-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2 text-lg text-slate-900">
              <Receipt className="h-4.5 w-4.5 text-[#c65300]" />
              Boletos a pagar no mês
            </CardTitle>
            <CardDescription className="text-sm text-slate-500">
              Parcelas de fornecedores com vencimento em {mesLabel}.
            </CardDescription>
          </div>
          <Button asChild variant="outline" className="gap-2 rounded-xl border-[#d7dfeb] bg-white text-slate-700 shadow-sm hover:bg-slate-50">
            <Link href="/dashboard/fornecedores">
              Abrir fornecedores
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-3 p-5">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-[1.1rem] border border-[#f0d7c4] bg-[linear-gradient(180deg,#fff4e9_0%,#fde9da_100%)] px-4 py-3">
            <p className="text-xs font-semibold text-slate-600">Em aberto</p>
            <p className="text-xl font-extrabold text-slate-900">{formatCurrency(totalAberto)}</p>
          </div>
          <div className="rounded-[1.1rem] border border-[#cee2d4] bg-[linear-gradient(180deg,#eef8f1_0%,#e4f0e8_100%)] px-4 py-3">
            <p className="text-xs font-semibold text-slate-600">Já pago no mês</p>
            <p className="text-xl font-extrabold text-slate-900">{formatCurrency(totalPago)}</p>
          </div>
        </div>

        {parcelas.length === 0 ? (
          <div className="rounded-[1.35rem] border border-dashed border-[#d7e1ee] bg-[linear-gradient(180deg,#fbfcff_0%,#f5f8fc_100%)] px-4 py-10 text-center">
            <p className="text-sm font-semibold text-slate-800">Nenhum boleto com vencimento neste mês.</p>
            <p className="mt-1 text-sm text-slate-500">As parcelas aparecem aqui assim que forem cadastradas.</p>
          </div>
        ) : (
          <ul className="space-y-2">
            {parcelas.map(({ ordem, parcela }) => {
              const status = getParcelaStatus(parcela)

              return (
                <li
                  key={`${ordem.id}-${parcela.id}`}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-[1.1rem] border border-[#e2e8f0] bg-white px-4 py-2.5"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-slate-900">
                      {ordem.placa}
                      <span className="ml-2 text-xs font-normal text-slate-500">
                        parcela {parcela.numero}/{ordem.boletoParcelas.length}
                      </span>
                    </p>
                    <p className="truncate text-xs text-slate-500">{ordem.descricao}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    <div className="text-right">
                      <p className="text-sm font-semibold text-slate-900">{formatCurrency(parcela.valor ?? 0)}</p>
                      <p className="text-xs text-slate-500">{formatDate(parcela.vencimento)}</p>
                    </div>
                    <Badge variant="outline" className={cn("text-[0.65rem]", PARCELA_STATUS_BADGE_CLASS[status])}>
                      {PARCELA_STATUS_LABELS[status]}
                    </Badge>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}
