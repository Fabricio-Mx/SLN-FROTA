"use client"

import Link from "next/link"
import type { LucideIcon } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

export type SectionNavItem = {
  id: string
  href?: string
  label: string
  description?: string
  icon: LucideIcon
}

export type SectionNavGroup = {
  title?: string
  items: SectionNavItem[]
}

export type SectionNavPalette = Record<string, { active: string; inactive: string }>

const DEFAULT_NAV_COLORS = {
  active: "border-slate-300 bg-slate-100 text-slate-700",
  inactive: "border-transparent bg-transparent text-slate-600 hover:border-slate-200 hover:bg-slate-100",
}

type SectionNavProps = {
  groups: SectionNavGroup[]
  activeId: string
  palette: SectionNavPalette
  tone?: "light" | "dark"
  onNavigate?: () => void
  className?: string
}

export function SectionNav({ groups, activeId, palette, tone = "light", onNavigate, className }: SectionNavProps) {
  const isDark = tone === "dark"

  return (
    <nav className={cn("flex flex-col gap-4", className)}>
      {groups.map((group, groupIndex) => (
        <div key={group.title ?? `group-${groupIndex}`} className="flex flex-col gap-1.5">
          {group.title ? (
            <p
              className={cn(
                "px-2.5 pb-1 text-[0.68rem] font-semibold uppercase tracking-wider",
                isDark ? "text-white/45" : "text-muted-foreground"
              )}
            >
              {group.title}
            </p>
          ) : null}

          {group.items.map((item) => {
            const isActive = item.id === activeId
            const colors = palette[item.id] ?? DEFAULT_NAV_COLORS

            if (!item.href) {
              return (
                <div
                  key={item.id}
                  aria-disabled="true"
                  className={cn(
                    "flex items-center gap-3 rounded-xl border border-transparent px-3.5 py-2.5 text-sm font-medium",
                    isDark ? "text-white/40" : "text-muted-foreground/60"
                  )}
                >
                  <item.icon className="h-4 w-4 shrink-0" />
                  <span className="min-w-0 flex-1 truncate text-left">{item.label}</span>
                  <Badge
                    variant="outline"
                    className={cn(
                      "shrink-0 px-1.5 py-0 text-[0.6rem] font-medium",
                      isDark
                        ? "border-white/15 bg-white/10 text-white/60"
                        : "border-border bg-muted/60 text-muted-foreground"
                    )}
                  >
                    Em breve
                  </Badge>
                </div>
              )
            }

            return (
              <Link
                key={item.id}
                href={item.href}
                onClick={onNavigate}
                aria-current={isActive ? "page" : undefined}
                className={cn(
                  "flex items-center gap-3 rounded-xl border px-3.5 py-2.5 text-sm font-medium transition-colors",
                  isDark ? "shadow-none" : "shadow-sm",
                  isActive ? colors.active : colors.inactive
                )}
              >
                <item.icon className="h-4 w-4 shrink-0" />
                <span className="min-w-0 flex-1 truncate text-left">{item.label}</span>
              </Link>
            )
          })}
        </div>
      ))}
    </nav>
  )
}

