"use client"

import Image from "next/image"
import { LifeBuoy } from "lucide-react"
import { SectionNav } from "@/components/dashboard/section-nav"
import { buildSidebarNavGroups, SIDEBAR_NAV_PALETTE_DARK, type DashboardSection } from "@/components/dashboard/nav-config"
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
        "sticky top-0 hidden h-screen w-[248px] shrink-0 flex-col border-r border-black/20 bg-[linear-gradient(180deg,#1b4029_0%,#12301d_100%)] lg:flex xl:w-[268px]",
        className
      )}
    >
      <div className="flex items-center gap-2.5 border-b border-white/10 px-5 py-4">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white p-1">
          <Image
            src="/images/sln-logo.png"
            alt="SLN Construções e Engenharia"
            width={40}
            height={40}
            className="h-full w-full object-contain"
            priority
          />
        </div>
        <div className="min-w-0">
          <p className="truncate text-lg font-extrabold leading-tight tracking-wide font-[family-name:var(--font-nunito)]">
            <span className="text-[#9ccc65]">S</span>
            <span className="text-white">ln</span>
          </p>
          <p className="truncate text-[0.68rem] leading-tight text-white/55">construções e engenharia</p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-4">
        <SectionNav groups={groups} activeId={activeSection} palette={SIDEBAR_NAV_PALETTE_DARK} tone="dark" />
      </div>

      <div className="border-t border-white/10 p-3">
        <div className="flex items-start gap-2.5 rounded-xl border border-white/10 bg-white/5 px-3.5 py-3">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#7CB342]/20 text-[#c5e1a5]">
            <LifeBuoy className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold leading-tight text-white">Precisa de ajuda?</p>
            <p className="truncate text-xs leading-tight text-white/60">Suporte técnico</p>
          </div>
        </div>
      </div>
    </aside>
  )
}
