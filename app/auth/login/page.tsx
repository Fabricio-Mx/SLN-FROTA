"use client"

import React from "react"
import { useState } from "react"
import { useRouter } from "next/navigation"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Loader2, Lock, User, Car, Shield, ChevronRight } from "lucide-react"

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

      router.push("/dashboard")
      router.refresh()
    } catch {
      setError("Erro ao conectar. Tente novamente.")
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex">
      {/* Lado esquerdo - Branding */}
      <div className="hidden lg:flex lg:w-[55%] bg-gradient-to-br from-[#7CB342] to-[#558B2F] flex-col relative overflow-hidden">
        {/* Elementos decorativos */}
        <div className="absolute inset-0">
          <div className="absolute -top-24 -left-24 w-96 h-96 bg-white/5 rounded-full" />
          <div className="absolute top-1/3 -right-32 w-[500px] h-[500px] bg-white/5 rounded-full" />
          <div className="absolute -bottom-20 left-1/4 w-72 h-72 bg-white/5 rounded-full" />
          <div className="absolute top-20 right-20 w-32 h-32 border-2 border-white/10 rounded-full" />
          <div className="absolute bottom-40 left-16 w-20 h-20 border-2 border-white/10 rounded-full" />
        </div>

        {/* Conteudo central */}
        <div className="flex-1 flex flex-col items-center justify-center relative z-10 px-16">
          <div className="bg-white rounded-3xl p-10 shadow-2xl mb-10">
            <Image
              src="/images/sln-logo.png"
              alt="SLN Construções e Engenharia"
              width={240}
              height={240}
              className="h-56 w-56 object-contain"
              priority
            />
          </div>

          <div className="text-center space-y-6 max-w-lg">
            <div className="flex items-center justify-center gap-3">
              <div className="h-px w-12 bg-white/40" />
              <Car className="h-6 w-6 text-white/90" />
              <div className="h-px w-12 bg-white/40" />
            </div>
            <h1 className="text-4xl font-bold text-white leading-tight">
              Sistema de Gestão de Frota
            </h1>
            <p className="text-white/80 text-lg leading-relaxed">
              Controle completo de veículos, colaboradores e operações logísticas.
            </p>

            {/* Features */}
            <div className="grid grid-cols-2 gap-4 pt-4">
              {[
                "Frota Veicular",
                "Agregados",
                "Colaboradores",
                "Relatórios",
              ].map((item) => (
                <div
                  key={item}
                  className="flex items-center gap-2 text-white/70 text-sm"
                >
                  <ChevronRight className="h-4 w-4 text-white/50" />
                  {item}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Rodapé branding */}
        <div className="relative z-10 px-16 pb-8 text-center">
          <div className="h-px bg-white/20 mb-6" />
          <p className="text-white/50 text-sm">
            SLN Construções e Engenharia
          </p>
        </div>
      </div>

      {/* Lado direito - Login */}
      <div className="w-full lg:w-[45%] flex flex-col bg-[#FAFAFA]">
        {/* Barra verde mobile */}
        <div className="lg:hidden h-1.5 bg-[#7CB342]" />

        <div className="flex-1 flex items-center justify-center px-6 py-12 sm:px-12">
          <div className="w-full max-w-sm">
            {/* Logo mobile */}
            <div className="lg:hidden flex justify-center mb-10">
              <div className="bg-white rounded-2xl p-5 shadow-lg border border-gray-100">
                <Image
                  src="/images/sln-logo.png"
                  alt="SLN"
                  width={100}
                  height={100}
                  className="h-24 w-24 object-contain"
                  priority
                />
              </div>
            </div>

            {/* Header */}
            <div className="mb-10">
              <div className="flex items-center gap-2 mb-3">
                <Shield className="h-5 w-5 text-[#7CB342]" />
                <span className="text-xs font-semibold uppercase tracking-widest text-[#7CB342]">
                  Acesso Seguro
                </span>
              </div>
              <h2 className="text-3xl font-bold text-gray-900 mb-2">
                Painel do Usuário
              </h2>
              <p className="text-gray-500 text-sm">
                Insira suas credenciais para acessar o sistema
              </p>
            </div>

            {/* Form */}
            <form onSubmit={handleLogin} className="space-y-5">
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
                    className="pl-11 h-12 bg-white border-gray-200 rounded-xl text-sm placeholder:text-gray-300 focus:border-[#7CB342] focus:ring-[#7CB342]/20 transition-colors"
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
                    className="pl-11 h-12 bg-white border-gray-200 rounded-xl text-sm placeholder:text-gray-300 focus:border-[#7CB342] focus:ring-[#7CB342]/20 transition-colors"
                  />
                </div>
              </div>

              {error && (
                <div className="rounded-xl bg-red-50 border border-red-100 px-4 py-3 text-sm text-red-600 flex items-center gap-2.5">
                  <div className="h-2 w-2 rounded-full bg-red-400 shrink-0" />
                  {error}
                </div>
              )}

              <div className="pt-2">
                <Button
                  type="submit"
                  className="w-full h-12 bg-[#7CB342] hover:bg-[#689F38] text-white font-semibold text-sm rounded-xl shadow-lg shadow-[#7CB342]/25 transition-all duration-200 hover:shadow-xl hover:shadow-[#689F38]/30 active:scale-[0.98]"
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
            <div className="flex items-center gap-4 my-8">
              <div className="flex-1 h-px bg-gray-200" />
              <span className="text-xs text-gray-400">INFORMAÇÕES</span>
              <div className="flex-1 h-px bg-gray-200" />
            </div>

            {/* Info */}
            <div className="bg-white border border-gray-100 rounded-xl p-4 text-center">
              <p className="text-xs text-gray-500 leading-relaxed">
                O acesso ao sistema é restrito a usuários autorizados.
                Entre em contato com o administrador para obter suas credenciais.
              </p>
            </div>
          </div>
        </div>

        {/* Copyright */}
        <div className="px-6 pb-6 text-center">
          <p className="text-xs text-gray-300">
            © {new Date().getFullYear()} SLN Construções e Engenharia
          </p>
        </div>
      </div>
    </div>
  )
}
