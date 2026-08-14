"use client"

import { useState } from "react"
import dynamic from "next/dynamic"
import { ArrowUpFromLine, ChartNoAxesCombined, Receipt, Sheet, Table2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"

type FuelWorkspaceTab = "painel" | "importacoes" | "transacoes" | "consolidado" | "financeiro"

type FuelWorkspaceProps = {
  isMaster?: boolean
}

const FuelDashboardOverview = dynamic(
  () => import("@/components/fuel/fuel-dashboard-overview").then((module) => module.FuelDashboardOverview),
  { loading: () => <FuelWorkspaceLoading /> },
)

const FuelImportPanel = dynamic(
  () => import("@/components/fuel/fuel-import-panel").then((module) => module.FuelImportPanel),
  { loading: () => <FuelWorkspaceLoading /> },
)

const FuelTransactionsTable = dynamic(
  () => import("@/components/fuel/fuel-transactions-table").then((module) => module.FuelTransactionsTable),
  { loading: () => <FuelWorkspaceLoading /> },
)

const FuelConsolidatedReport = dynamic(
  () => import("@/components/fuel/fuel-consolidated-report").then((module) => module.FuelConsolidatedReport),
  { loading: () => <FuelWorkspaceLoading /> },
)

const FuelFinancialPanel = dynamic(
  () => import("@/components/fuel/fuel-financial-panel").then((module) => module.FuelFinancialPanel),
  { loading: () => <FuelWorkspaceLoading /> },
)

const TAB_ITEMS: Array<{
  id: FuelWorkspaceTab
  label: string
  description: string
  icon: typeof ChartNoAxesCombined
}> = [
  {
    id: "painel",
    label: "Painel",
    description: "Resumo analítico e ciclo atual.",
    icon: ChartNoAxesCombined,
  },
  {
    id: "importacoes",
    label: "Importações",
    description: "Carga dos relatórios e centro de custo.",
    icon: ArrowUpFromLine,
  },
  {
    id: "transacoes",
    label: "Transações",
    description: "Consulta detalhada dos lançamentos.",
    icon: Table2,
  },
  {
    id: "consolidado",
    label: "Consolidado",
    description: "Relatório semanal com exportação em planilha.",
    icon: Sheet,
  },
  {
    id: "financeiro",
    label: "Financeiro",
    description: "Faturas VELOE e exportação por ciclo.",
    icon: Receipt,
  },
]

function FuelWorkspaceLoading() {
  return <div className="h-24 animate-pulse rounded-2xl border border-border bg-muted/40" />
}

export function FuelWorkspace({ isMaster = false }: FuelWorkspaceProps) {
  const [activeTab, setActiveTab] = useState<FuelWorkspaceTab>("painel")

  return (
    <div className="space-y-4">
      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as FuelWorkspaceTab)} className="space-y-4">
        <div className="rounded-2xl border border-[#d8dfd1] bg-[linear-gradient(180deg,#fcfdfb_0%,#f5f8f2_100%)] p-3 shadow-sm">
          <TabsList className="grid h-auto w-full grid-cols-1 gap-2 bg-transparent p-0 md:grid-cols-2 xl:grid-cols-5">
            {TAB_ITEMS.map((tab) => {
              const Icon = tab.icon

              return (
                <TabsTrigger
                  key={tab.id}
                  value={tab.id}
                  className={cn(
                    "h-auto items-start justify-start rounded-2xl border border-[#dce6d6] bg-white/80 px-4 py-3 text-left shadow-sm transition-all data-[state=active]:border-[#bfd5b3] data-[state=active]:bg-[#f4faef] data-[state=active]:text-[#426a32]",
                  )}
                >
                  <Icon className="mt-0.5 h-4 w-4 text-[#6f9f4c]" />
                  <div className="space-y-1">
                    <div className="text-sm font-semibold">{tab.label}</div>
                    <div className="text-xs text-slate-500">{tab.description}</div>
                  </div>
                </TabsTrigger>
              )
            })}
          </TabsList>
        </div>
      </Tabs>

      {activeTab === "painel" ? <FuelDashboardOverview isMaster={isMaster} /> : null}
      {activeTab === "importacoes" ? <FuelImportPanel isMaster={isMaster} /> : null}
      {activeTab === "transacoes" ? <FuelTransactionsTable /> : null}
      {activeTab === "consolidado" ? <FuelConsolidatedReport /> : null}
      {activeTab === "financeiro" ? <FuelFinancialPanel isMaster={isMaster} /> : null}
    </div>
  )
}
