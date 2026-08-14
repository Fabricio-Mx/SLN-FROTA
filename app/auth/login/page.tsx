"use client"

import React from "react"
import { useState } from "react"
import { useRouter } from "next/navigation"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Loader2, Lock, User, Car, Shield, ChevronRight } from "lucide-react"

const LAST_ACTIVITY_STORAGE_KEY = "app_last_activity_at"

export default function LoginPage() {
  const [login, setLogin] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const router = useRouter()

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setIsLoading(true)

    try {
      const { loginAction } = await import("@/app/actions/auth")
      const result = await loginAction(login, password)

      if (!result.success) {
        setError(result.error || "Credenciais inválidas")
        setIsLoading(false)
        return
      }

      localStorage.setItem(LAST_ACTIVITY_STORAGE_KEY, String(Date.now()))
      router.replace("/dashboard")
    } catch {
      setError("Erro ao conectar. Tente novamente.")
      setIsLoading(false)
    }
  }

  return (
    <div className="flex min-h-[100svh] bg-[#FAFAFA] lg:h-[100svh] lg:overflow-hidden">
      {/* Lado esquerdo - Branding */}
      <div className="relative hidden overflow-hidden bg-gradient-to-br from-[#7CB342] to-[#558B2F] lg:flex lg:w-[54%] lg:flex-col xl:w-[55%]">
        {/* Elementos decorativos */}
        <div className="absolute inset-0">
          <div className="absolute -top-24 -left-24 w-96 h-96 bg-white/5 rounded-full" />
          <div className="absolute top-1/3 -right-32 w-[500px] h-[500px] bg-white/5 rounded-full" />
          <div className="absolute -bottom-20 left-1/4 w-72 h-72 bg-white/5 rounded-full" />
          <div className="absolute top-20 right-20 w-32 h-32 border-2 border-white/10 rounded-full" />
          <div className="absolute bottom-40 left-16 w-20 h-20 border-2 border-white/10 rounded-full" />
        </div>

        {/* Conteudo central */}
        <div className="relative z-10 flex flex-1 flex-col items-center justify-center px-10 py-8 xl:px-16 xl:py-10">
          <div className="mb-7 rounded-[1.75rem] bg-white p-7 shadow-2xl xl:mb-10 xl:rounded-3xl xl:p-10">
            <Image
              src="/images/sln-logo.png"
              alt="SLN Construções e Engenharia"
              width={240}
              height={240}
              className="h-40 w-40 object-contain xl:h-56 xl:w-56"
              priority
            />
          </div>

          <div className="max-w-lg space-y-4 text-center xl:space-y-6">
            <div className="flex items-center justify-center gap-3">
              <div className="h-px w-12 bg-white/40" />
              <Car className="h-5 w-5 text-white/90 xl:h-6 xl:w-6" />
              <div className="h-px w-12 bg-white/40" />
            </div>
            <h1 className="text-[2rem] font-bold leading-tight text-white xl:text-4xl">
              Sistema de Gestão de Frota
            </h1>
            <p className="text-base leading-relaxed text-white/80 xl:text-lg">
              Controle completo de veículos, colaboradores e operações logísticas.
            </p>

            {/* Features */}
            <div className="grid grid-cols-2 gap-3 pt-2 xl:gap-4 xl:pt-4">
              {[
                "Frota Veicular",
                "Agregados",
                "Colaboradores",
                "Relatórios",
              ].map((item) => (
                <div
                  key={item}
                  className="flex items-center gap-2 text-xs text-white/70 xl:text-sm"
                >
                  <ChevronRight className="h-4 w-4 text-white/50" />
                  {item}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Rodapé branding */}
        <div className="relative z-10 px-10 pb-6 text-center xl:px-16 xl:pb-8">
          <div className="mb-4 h-px bg-white/20 xl:mb-6" />
          <p className="text-xs text-white/50 xl:text-sm">
            SLN Construções e Engenharia
          </p>
        </div>
      </div>

      {/* Lado direito - Login */}
      <div className="flex min-h-[100svh] w-full flex-col bg-[#FAFAFA] lg:h-[100svh] lg:w-[46%] xl:w-[45%]">
        {/* Barra verde mobile */}
        <div className="lg:hidden h-1.5 bg-[#7CB342]" />

        <div className="flex flex-1 items-center justify-center px-5 py-5 sm:px-8 sm:py-6 lg:px-8 lg:py-5 xl:px-12 xl:py-8">
          <div className="w-full max-w-[21.5rem] sm:max-w-[23rem]">
            {/* Logo mobile */}
            <div className="mb-6 flex justify-center lg:hidden sm:mb-8">
              <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-lg sm:p-5">
                <Image
                  src="/images/sln-logo.png"
                  alt="SLN"
                  width={100}
                  height={100}
                  className="h-20 w-20 object-contain sm:h-24 sm:w-24"
                  priority
                />
              </div>
            </div>

            {/* Header */}
            <div className="mb-6 sm:mb-7 lg:mb-6 xl:mb-8">
              <div className="mb-2.5 flex items-center gap-2">
                <Shield className="h-4.5 w-4.5 text-[#7CB342] sm:h-5 sm:w-5" />
                <span className="text-[0.68rem] font-semibold uppercase tracking-[0.22em] text-[#7CB342] sm:text-xs sm:tracking-widest">
                  Acesso Seguro
                </span>
              </div>
              <h2 className="mb-2 text-[1.9rem] font-bold text-gray-900 sm:text-[2.1rem] xl:text-3xl">
                Painel do Usuário
              </h2>
              <p className="text-sm text-gray-500">
                Insira suas credenciais para acessar o sistema
              </p>
            </div>

            {/* Form */}
            <form onSubmit={handleLogin} className="space-y-4 sm:space-y-5">
              <div className="space-y-1.5">
                <Label
                  htmlFor="login"
                  className="text-gray-600 text-xs font-semibold uppercase tracking-wider"
                >
                  Usuário / Email
                </Label>
                <div className="relative">
                  <User className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4.5 w-4.5 text-gray-400" />
                  <Input
                    id="login"
                    type="text"
                    placeholder="admin"
                    value={login}
                    onChange={(e) => setLogin(e.target.value)}
                    required
                    disabled={isLoading}
                    className="h-11 rounded-xl border-gray-200 bg-white pl-11 text-sm placeholder:text-gray-300 transition-colors focus:border-[#7CB342] focus:ring-[#7CB342]/20 sm:h-12"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label
                  htmlFor="password"
                  className="text-gray-600 text-xs font-semibold uppercase tracking-wider"
                >
                  Senha
                </Label>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4.5 w-4.5 text-gray-400" />
                  <Input
                    id="password"
                    type="password"
                    placeholder="Digite sua senha"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    disabled={isLoading}
                    className="h-11 rounded-xl border-gray-200 bg-white pl-11 text-sm placeholder:text-gray-300 transition-colors focus:border-[#7CB342] focus:ring-[#7CB342]/20 sm:h-12"
                  />
                </div>
              </div>

              {error && (
                <div className="rounded-xl bg-red-50 border border-red-100 px-4 py-3 text-sm text-red-600 flex items-center gap-2.5">
                  <div className="h-2 w-2 rounded-full bg-red-400 shrink-0" />
                  {error}
                </div>
              )}

              <div className="pt-1.5 sm:pt-2">
                <Button
                  type="submit"
                  className="h-11 w-full rounded-xl bg-[#7CB342] text-sm font-semibold text-white shadow-lg shadow-[#7CB342]/25 transition-all duration-200 hover:bg-[#689F38] hover:shadow-xl hover:shadow-[#689F38]/30 active:scale-[0.98] sm:h-12"
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Autenticando...
                    </>
                  ) : (
                    "Acessar Sistema"
                  )}
                </Button>
              </div>
            </form>

            {/* Divisor */}
            <div className="my-6 flex items-center gap-4 sm:my-7">
              <div className="flex-1 h-px bg-gray-200" />
              <span className="text-xs text-gray-400">INFORMAÇÕES</span>
              <div className="flex-1 h-px bg-gray-200" />
            </div>

            {/* Info */}
            <div className="rounded-xl border border-gray-100 bg-white p-3.5 text-center sm:p-4">
              <p className="text-xs text-gray-500 leading-relaxed">
                O acesso ao sistema é restrito a usuários autorizados.
                Entre em contato com o administrador para obter suas credenciais.
              </p>
            </div>
          </div>
        </div>

        {/* Copyright */}
        <div className="px-5 pb-4 text-center sm:px-8 sm:pb-5 lg:px-8 xl:px-12 xl:pb-6">
          <p className="text-xs text-gray-300">
            © {new Date().getFullYear()} SLN Construções e Engenharia
          </p>
        </div>
      </div>
    </div>
  )
}
