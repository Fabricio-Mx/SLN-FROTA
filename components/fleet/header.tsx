"use client"

import Image from "next/image"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Car, LogOut, Users, Shield, ChevronDown } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import type { UserRole } from "@/lib/types"
import { ROLE_LABELS } from "@/lib/auth-shared"

interface HeaderProps {
  userRole: UserRole
  userEmail?: string
  userName?: string
}

const ROLE_COLORS: Record<UserRole, string> = {
  mestre: "bg-amber-100 text-amber-800 border-amber-200",
  consulta: "bg-blue-100 text-blue-800 border-blue-200",
  administrativo: "bg-green-100 text-green-800 border-green-200",
  logistico: "bg-purple-100 text-purple-800 border-purple-200",
}

export function Header({ userRole, userEmail, userName }: HeaderProps) {
  const router = useRouter()

  const handleLogout = async () => {
    const { logoutAction } = await import("@/app/actions/auth")
    await logoutAction()
  }

  return (
    <header className="bg-card">
      {/* Barra verde */}
      <div className="h-3 bg-[#7CB342]" />
      
      {/* Logo e nome da empresa */}
      <div className="bg-white border-b border-border">
        <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-5">
              <div className="rounded-lg bg-white p-2 shadow-sm border border-border">
                <Image
                  src="/images/sln-logo.png"
                  alt="SLN Construções e Engenharia"
                  width={96}
                  height={96}
                  className="h-24 w-24 object-contain"
                  priority
                />
              </div>
              <div>
                <h2 className="text-3xl font-extrabold tracking-wide font-[family-name:var(--font-nunito)]">
                  <span className="text-[#7CB342]">S</span>
                  <span className="text-[#333333]">ln</span>
                </h2>
                <p className="text-sm font-normal tracking-wider text-[#555555] font-[family-name:var(--font-nunito)]">construções e engenharia</p>
              </div>
            </div>

            {/* User info + menu */}
            <div className="flex items-center gap-3">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="flex items-center gap-3 rounded-xl border border-border bg-muted/50 px-4 py-2.5 hover:bg-muted transition-colors cursor-pointer">
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#7CB342] text-white text-sm font-bold">
                      {(userName || userEmail || "U").charAt(0).toUpperCase()}
                    </div>
                    <div className="hidden sm:flex flex-col items-start gap-0.5">
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
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#7CB342] text-white font-bold">
                        {(userName || userEmail || "U").charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p className="text-sm font-semibold">{userName || "Usuário"}</p>
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
        </div>
      </div>
      
      {/* Título do sistema */}
      <div className="border-b border-border">
        <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-3 sm:px-6 lg:px-8">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Car className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-foreground">Sistema de Frota</h1>
            <p className="text-sm text-muted-foreground">Controle de veículos e colaboradores</p>
          </div>
        </div>
      </div>
    </header>
  )
}
