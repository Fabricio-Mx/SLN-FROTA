"use client"

import { useTheme } from "next-themes"
import { Check, Monitor, Moon, Palette, Waves } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { toast } from "@/hooks/use-toast"
import {
  APP_THEME_PREVIEW_FILTER,
  APP_THEME_PREVIEW_PRESERVE_FILTER,
  APP_THEMES,
  DEFAULT_APP_THEME,
  isAppThemeId,
  type AppThemeId,
} from "@/lib/app-themes"
import { cn } from "@/lib/utils"

const THEME_ICONS: Record<AppThemeId, typeof Monitor> = {
  original: Monitor,
  azul: Waves,
  escuro: Moon,
}

export function ConfiguracoesPanel() {
  const { theme, setTheme } = useTheme()
  const activeTheme: AppThemeId = isAppThemeId(theme) ? theme : DEFAULT_APP_THEME

  function handleSelectTheme(themeId: AppThemeId) {
    if (themeId === activeTheme) return
    setTheme(themeId)
    const option = APP_THEMES.find((item) => item.id === themeId)
    toast({
      title: "Modo de tela atualizado",
      description: `${option?.label ?? "Tema"} aplicado. A preferência fica salva neste navegador.`,
    })
  }

  return (
    <div className="space-y-4">
      <Card className="border-border shadow-sm">
        <CardHeader className="border-b border-border pb-4">
          <div className="flex items-start gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#e6f1df] text-[#4e8f57]">
              <Palette className="h-4 w-4" />
            </span>
            <div>
              <CardTitle className="text-lg text-slate-900">Modo de tela</CardTitle>
              <p className="mt-0.5 text-sm text-slate-500">
                Escolha a aparência do sistema. A mudança vale na hora para todas as telas deste navegador.
              </p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-5">
          <div className="grid gap-4 md:grid-cols-3" role="radiogroup" aria-label="Modo de tela">
            {APP_THEMES.map((option, index) => {
              const Icon = THEME_ICONS[option.id]
              const isActive = option.id === activeTheme

              return (
                <button
                  key={option.id}
                  type="button"
                  role="radio"
                  aria-checked={isActive}
                  onClick={() => handleSelectTheme(option.id)}
                  className={cn(
                    "group flex flex-col overflow-hidden rounded-2xl border-2 bg-card text-left transition-all",
                    isActive
                      ? "border-[#7CB342] shadow-[0_8px_22px_rgba(124,179,66,0.25)]"
                      : "border-border hover:border-[#bcd9a0] hover:shadow-md",
                  )}
                >
                  <div data-theme-preserve className="border-b border-border">
                    <ThemePreview
                      filter={APP_THEME_PREVIEW_FILTER[option.id]}
                      preserveFilter={APP_THEME_PREVIEW_PRESERVE_FILTER[option.id]}
                    />
                  </div>
                  <div className="flex items-start gap-3 p-4">
                    <span
                      className={cn(
                        "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg",
                        isActive ? "bg-[#7CB342] text-white" : "bg-muted text-slate-600",
                      )}
                    >
                      <Icon className="h-4 w-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-400">Tema {index + 1}</p>
                      <p className="text-base font-bold text-slate-900">{option.label}</p>
                      <p className="mt-0.5 text-sm text-slate-500">{option.description}</p>
                    </div>
                    <span
                      className={cn(
                        "flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2",
                        isActive ? "border-[#7CB342] bg-[#7CB342] text-white" : "border-slate-300 text-transparent",
                      )}
                    >
                      <Check className="h-3.5 w-3.5" />
                    </span>
                  </div>
                </button>
              )
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

function ThemePreview({ filter, preserveFilter }: { filter: string; preserveFilter: string }) {
  return (
    <div className="flex h-[132px] bg-[#f5f7fa]" style={{ filter }} aria-hidden="true">
      <div
        className="flex w-10 flex-col items-center gap-1.5 bg-[linear-gradient(180deg,#1b4029_0%,#12301d_100%)] py-2.5"
        style={{ filter: preserveFilter }}
      >
        <span className="h-5 w-5 rounded-md bg-white" />
        <span className="mt-1 h-1.5 w-5 rounded-full bg-[#7CB342]" />
        <span className="h-1.5 w-5 rounded-full bg-white/30" />
        <span className="h-1.5 w-5 rounded-full bg-white/30" />
        <span className="h-1.5 w-5 rounded-full bg-white/30" />
      </div>
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex h-6 items-center gap-2 border-b border-[#e2e8f0] bg-white px-2.5">
          <span className="h-1.5 w-16 rounded-full bg-slate-300" />
          <span className="ml-auto h-3 w-3 rounded-full bg-[#7CB342]" />
        </div>
        <div className="grid flex-1 grid-cols-3 gap-1.5 p-2">
          <div className="rounded-md border border-[#ddd1f5] bg-[#f1eaff] p-1.5">
            <span className="block h-1.5 w-8 rounded-full bg-[#7c3aed]" />
            <span className="mt-1 block h-1 w-5 rounded-full bg-slate-400" />
          </div>
          <div className="rounded-md border border-[#cfe3c4] bg-[#eef7e9] p-1.5">
            <span className="block h-1.5 w-8 rounded-full bg-[#4e8f57]" />
            <span className="mt-1 block h-1 w-5 rounded-full bg-slate-400" />
          </div>
          <div className="rounded-md border border-[#f1d9a6] bg-[#fff6e0] p-1.5">
            <span className="block h-1.5 w-8 rounded-full bg-[#e0a43a]" />
            <span className="mt-1 block h-1 w-5 rounded-full bg-slate-400" />
          </div>
          <div className="col-span-3 flex items-end gap-1.5 rounded-md border border-[#e2e8f0] bg-white px-2 pb-1.5 pt-2">
            {[60, 85, 45, 70, 95, 55, 75].map((height, index) => (
              <span
                key={index}
                className={cn("flex-1 rounded-t-sm", index % 2 === 0 ? "bg-[#4e8f57]" : "bg-[#b9cfa9]")}
                style={{ height: `${height * 0.42}px` }}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
