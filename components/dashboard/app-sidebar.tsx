"use client"

import Image from "next/image"
import { LifeBuoy } from "lucide-react"
import { SectionNav } from "@/components/dashboard/section-nav"
import { buildSidebarNavGroups, SIDEBAR_NAV_PALETTE, type DashboardSection } from "@/components/dashboard/nav-config"
import { cn } from "@/lib/utils"

type AppSidebarProps = {
  activeSection: DashboardSection
  isMaster: boolean
  className?: string
}

export function AppSidebar({ activeSection, isMaster, className }: AppSidebarProps) {
  const groups = buildSidebarNavGroups(isMaster)

  return (
    <aside
      className={cn(
        "sticky top-0 hidden h-screen w-[248px] shrink-0 flex-col border-r border-border bg-card lg:flex xl:w-[268px]",
        className
      )}
    >
      <div className="flex items-center gap-2.5 border-b border-border px-5 py-4">
        <Image
          src="/images/sln-logo.png"
          alt="SLN Construções e Engenharia"
          width={40}
          height={40}
          className="h-9 w-9 shrink-0 object-contain"
          priority
        />
        <div className="min-w-0">
          <p className="truncate text-lg font-extrabold leading-tight tracking-wide font-[family-name:var(--font-nunito)]">
            <span className="text-[#7CB342]">S</span>
            <span className="text-[#333333]">ln</span>
          </p>
          <p className="truncate text-[0.68rem] leading-tight text-[#555555]">construções e engenharia</p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-4">
        <SectionNav groups={groups} activeId={activeSection} palette={SIDEBAR_NAV_PALETTE} />
      </div>

      <div className="border-t border-border p-3">
        <div className="flex items-start gap-2.5 rounded-xl border border-[#dbe8cf] bg-[#f3f9e8] px-3.5 py-3">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#7CB342]/15 text-[#4c7a22]">
            <LifeBuoy className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold leading-tight text-foreground">Precisa de ajuda?</p>
            <p className="truncate text-xs leading-tight text-muted-foreground">Suporte técnico</p>
          </div>
        </div>
      </div>
    </aside>
  )
}
