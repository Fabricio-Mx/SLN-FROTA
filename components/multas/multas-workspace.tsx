"use client"

import { useState } from "react"
import { CarFront, Warehouse } from "lucide-react"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { MultasImportPanel } from "@/components/multas/multas-import-panel"
import { cn } from "@/lib/utils"
import type { MultaFonte } from "@/lib/multas-import-shared"

const TAB_ITEMS: Array<{ id: MultaFonte; label: string; description: string; icon: typeof CarFront }> = [
  {
    id: "localiza",
    label: "Carros alugados · Localiza",
    description: "Painel e importação do relatório de infrações.",
    icon: CarFront,
  },
  {
    id: "proprio",
    label: "Carros próprios",
    description: "Infrações da frota própria.",
    icon: Warehouse,
  },
]

export function MultasWorkspace({ canManage }: { canManage: boolean }) {
  const [activeTab, setActiveTab] = useState<MultaFonte>("localiza")

  return (
    <div className="space-y-4">
      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as MultaFonte)}>
        <div className="rounded-2xl border border-[#d8dfd1] bg-[linear-gradient(180deg,#fcfdfb_0%,#f5f8f2_100%)] p-3 shadow-sm">
          <TabsList className="grid h-auto w-full grid-cols-1 gap-2 bg-transparent p-0 md:grid-cols-2">
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

      <MultasImportPanel key={activeTab} fonte={activeTab} canManage={canManage} />
    </div>
  )
}
