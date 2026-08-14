"use client"

import Image from "next/image"
import Link from "next/link"
import { useState } from "react"
import { Bell, ChevronDown, LogOut, Menu, Shield, Users } from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import { SectionNav } from "@/components/dashboard/section-nav"
import { buildSidebarNavGroups, SIDEBAR_NAV_PALETTE, type DashboardSection } from "@/components/dashboard/nav-config"
import type { UserRole } from "@/lib/types"
import { ROLE_LABELS } from "@/lib/auth-shared"

export type HeaderNotification = {
  id: string
  title: string
  description: string
  href: string
}

interface HeaderProps {
  userRole: UserRole
  userEmail?: string
  userName?: string
  userAvatarUrl?: string | null
  activeSection: DashboardSection
  isMaster: boolean
  notifications?: HeaderNotification[]
}

const ROLE_COLORS: Record<UserRole, string> = {
  mestre: "bg-amber-100 text-amber-800 border-amber-200",
  consulta: "bg-blue-100 text-blue-800 border-blue-200",
  administrativo: "bg-green-100 text-green-800 border-green-200",
  administrativo_rh: "bg-cyan-100 text-cyan-800 border-cyan-200",
  logistico: "bg-purple-100 text-purple-800 border-purple-200",
}

const LAST_ACTIVITY_STORAGE_KEY = "app_last_activity_at"

export function Header({
  userRole,
  userEmail,
  userName,
  userAvatarUrl,
  activeSection,
  isMaster,
  notifications = [],
}: HeaderProps) {
  const [isNavSheetOpen, setIsNavSheetOpen] = useState(false)

  const handleLogout = async () => {
    localStorage.removeItem(LAST_ACTIVITY_STORAGE_KEY)
    const { logoutAction } = await import("@/app/actions/auth")
    await logoutAction()
  }

  const userInitial = (userName || userEmail || "U").charAt(0).toUpperCase()
  const navGroups = buildSidebarNavGroups(isMaster)

  return (
    <header className="sticky top-0 z-30 border-b border-border bg-card">
      <div className="flex items-center justify-between gap-3 px-4 py-3 sm:px-5 lg:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <Sheet open={isNavSheetOpen} onOpenChange={setIsNavSheetOpen}>
            <SheetTrigger asChild>
              <Button variant="outline" size="icon" className="shrink-0 rounded-xl shadow-sm lg:hidden" aria-label="Abrir menu de navegação">
                <Menu className="h-4 w-4" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-72 p-0">
              <SheetHeader className="border-b border-border p-4">
                <SheetTitle className="flex items-center gap-2">
                  <Image
                    src="/images/sln-logo.png"
                    alt="SLN Construções e Engenharia"
                    width={28}
                    height={28}
                    className="h-7 w-7 object-contain"
                  />
                  Navegação
                </SheetTitle>
              </SheetHeader>
              <div className="overflow-y-auto p-3">
                <SectionNav
                  groups={navGroups}
                  activeId={activeSection}
                  palette={SIDEBAR_NAV_PALETTE}
                  onNavigate={() => setIsNavSheetOpen(false)}
                />
              </div>
            </SheetContent>
          </Sheet>

          <div className="min-w-0">
            <h1 className="truncate text-base font-semibold text-foreground sm:text-lg">Sistema de Frota</h1>
            <p className="truncate text-xs text-muted-foreground sm:text-sm">Controle de veículos e colaboradores</p>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2 sm:gap-3">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="icon" className="relative rounded-full shadow-sm" aria-label="Notificações">
                <Bell className="h-4 w-4" />
                {notifications.length > 0 ? (
                  <span className="absolute -right-1 -top-1 flex h-4.5 min-w-4.5 items-center justify-center rounded-full bg-destructive px-1 text-[0.65rem] font-semibold text-destructive-foreground">
                    {notifications.length}
                  </span>
                ) : null}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-80">
              <div className="px-3 py-2.5">
                <p className="text-sm font-semibold">Notificações</p>
              </div>
              <DropdownMenuSeparator />
              {notifications.length === 0 ? (
                <p className="px-3 py-4 text-center text-sm text-muted-foreground">Nenhuma notificação no momento.</p>
              ) : (
                notifications.map((notification) => (
                  <DropdownMenuItem key={notification.id} asChild>
                    <Link href={notification.href} className="flex cursor-pointer flex-col items-start gap-0.5 whitespace-normal py-2">
                      <span className="text-sm font-medium leading-tight">{notification.title}</span>
                      <span className="text-xs leading-tight text-muted-foreground">{notification.description}</span>
                    </Link>
                  </DropdownMenuItem>
                ))
              )}
            </DropdownMenuContent>
          </DropdownMenu>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center gap-2 rounded-2xl border border-border bg-[linear-gradient(180deg,rgba(255,255,255,0.98)_0%,rgba(243,246,241,0.98)_100%)] px-2.5 py-1.5 shadow-sm transition-colors hover:bg-muted sm:gap-3 sm:px-3 sm:py-2 cursor-pointer">
                <Avatar className="h-8 w-8 ring-2 ring-[#dbe8cf] sm:h-9 sm:w-9">
                  <AvatarImage src={userAvatarUrl || undefined} alt={userName || "Usuário"} className="object-cover" />
                  <AvatarFallback className="bg-[#7CB342] text-sm font-bold text-white">
                    {userInitial}
                  </AvatarFallback>
                </Avatar>
                <div className="hidden md:flex flex-col items-start gap-0.5">
                  <span className="text-sm font-medium text-foreground leading-tight">{userName || "Usuário"}</span>
                  <Badge variant="outline" className={`text-[10px] px-1.5 py-0 h-4 ${ROLE_COLORS[userRole]}`}>
                    {userRole === "mestre" && <Shield className="h-2.5 w-2.5 mr-0.5" />}
                    {ROLE_LABELS[userRole]}
                  </Badge>
                </div>
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-64">
              <div className="px-4 py-3 border-b border-border">
                <div className="flex items-center gap-3">
                  <Avatar className="h-11 w-11 ring-2 ring-[#dbe8cf]">
                    <AvatarImage src={userAvatarUrl || undefined} alt={userName || "Usuário"} className="object-cover" />
                    <AvatarFallback className="bg-[#7CB342] font-bold text-white">
                      {userInitial}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="text-sm font-semibold">{userName || "Usuário"}</p>
                    <p className="text-xs text-muted-foreground">{userEmail || ""}</p>
                    <p className="text-xs text-muted-foreground">{ROLE_LABELS[userRole]}</p>
                  </div>
                </div>
              </div>

              {userRole === "mestre" && (
                <>
                  <DropdownMenuItem asChild>
                    <Link href="/admin/usuarios" className="flex items-center gap-2 cursor-pointer">
                      <Users className="h-4 w-4" />
                      Gerenciar Usuários
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                </>
              )}
              <DropdownMenuItem onClick={handleLogout} className="flex items-center gap-2 cursor-pointer text-destructive">
                <LogOut className="h-4 w-4" />
                Sair do Sistema
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  )
}
