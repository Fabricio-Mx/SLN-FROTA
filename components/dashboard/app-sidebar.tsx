"use client"

import Image from "next/image"
import { useState } from "react"
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
  const [isExpanded, setIsExpanded] = useState(false)

  return (
    // z-index no wrapper: `sticky` cria contexto de empilhamento, então o z do <aside> não vale contra o header.
    <div
      className={cn("sticky top-0 z-40 hidden h-screen w-[72px] shrink-0 lg:block", className)}
      onMouseEnter={() => setIsExpanded(true)}
      onMouseLeave={() => setIsExpanded(false)}
    >
      <aside
        className={cn(
          "absolute inset-y-0 left-0 flex h-screen flex-col border-r border-black/20 bg-[linear-gradient(180deg,#1b4029_0%,#12301d_100%)] transition-[width] duration-200 ease-out",
          isExpanded ? "w-[248px] shadow-[0_18px_45px_rgba(0,0,0,0.35)] xl:w-[268px]" : "w-[72px]"
        )}
      >
        <div
          className={cn(
            "flex shrink-0 items-center gap-2.5 border-b border-white/10 py-4",
            isExpanded ? "px-5" : "justify-center px-0"
          )}
        >
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

          {isExpanded ? (
            <div className="min-w-0 flex-1">
              <p className="truncate text-lg font-extrabold leading-tight tracking-wide font-[family-name:var(--font-nunito)]">
                <span className="text-[#9ccc65]">S</span>
                <span className="text-white">ln</span>
              </p>
              <p className="truncate text-[0.68rem] leading-tight text-white/55">construções e engenharia</p>
            </div>
          ) : null}
        </div>

        <div className={cn("flex-1 overflow-y-auto py-4", isExpanded ? "px-3" : "px-2")}>
          <SectionNav
            groups={groups}
            activeId={activeSection}
            palette={SIDEBAR_NAV_PALETTE_DARK}
            tone="dark"
            collapsed={!isExpanded}
          />
        </div>

        <div className={cn("border-t border-white/10", isExpanded ? "p-3" : "p-2")}>
          <div
            className={cn(
              "flex items-center gap-2.5 rounded-xl border border-white/10 bg-white/5",
              isExpanded ? "items-start px-3.5 py-3" : "justify-center px-0 py-2"
            )}
            title={isExpanded ? undefined : "Precisa de ajuda? Suporte técnico"}
          >
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#7CB342]/20 text-[#c5e1a5]">
              <LifeBuoy className="h-4 w-4" />
            </div>
            {isExpanded ? (
              <div className="min-w-0">
                <p className="text-sm font-semibold leading-tight text-white">Precisa de ajuda?</p>
                <p className="truncate text-xs leading-tight text-white/60">Suporte técnico</p>
              </div>
            ) : null}
          </div>
        </div>
      </aside>
    </div>
  )
}
