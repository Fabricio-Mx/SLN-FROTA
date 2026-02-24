"use client"

import React from "react"
import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  ArrowLeft,
  Plus,
  Trash2,
  Loader2,
  Shield,
  Eye,
  Briefcase,
  TruckIcon,
  UserCircle,
  Users,
} from "lucide-react"
import { toast } from "@/hooks/use-toast"
import type { UserRole, AppUser } from "@/lib/types"
import { ROLE_LABELS, ROLE_DESCRIPTIONS } from "@/lib/auth-shared"

interface Profile {
  id: string
  email: string
  nome: string | null
  role: string
  is_admin: boolean
  created_at: string
}

const ROLE_STYLES: Record<UserRole, { icon: React.ReactNode; color: string }> = {
  mestre: {
    icon: <Shield className="h-3.5 w-3.5" />,
    color: "bg-amber-100 text-amber-800 border-amber-200",
  },
  consulta: {
    icon: <Eye className="h-3.5 w-3.5" />,
    color: "bg-blue-100 text-blue-800 border-blue-200",
  },
  administrativo: {
    icon: <Briefcase className="h-3.5 w-3.5" />,
    color: "bg-green-100 text-green-800 border-green-200",
  },
  logistico: {
    icon: <TruckIcon className="h-3.5 w-3.5" />,
    color: "bg-purple-100 text-purple-800 border-purple-200",
  },
}

export default function AdminUsuariosPage() {
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [currentUser, setCurrentUser] = useState<AppUser | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isCreating, setIsCreating] = useState(false)
  const [newUser, setNewUser] = useState({
    email: "",
    password: "",
    nome: "",
    role: "consulta" as UserRole,
  })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const router = useRouter()

  useEffect(() => {
    checkAccessAndLoad()
  }, [])

  const formatApiError = (data: { error?: string; hint?: string } | null) => {
    if (!data) return "Erro ao carregar."
    if (data.hint) return `${data.error || "Erro"}. ${data.hint}`
    return data.error || "Erro ao carregar."
  }

  const checkAccessAndLoad = async () => {
    try {
      // Verificar se é mestre
      const { getCurrentUser } = await import("@/app/actions/auth")
      const user = await getCurrentUser()
      
      if (!user || user.role !== "mestre") {
        toast({
          title: "Acesso Negado",
          description: "Apenas o administrador mestre pode acessar esta página.",
          variant: "destructive",
        })
        router.push("/dashboard")
        return
      }

      setCurrentUser(user)

      // Carregar usuários
      const usersRes = await fetch("/api/auth/users")
      const usersData = await usersRes.json().catch(() => null)

      if (!usersRes.ok) {
        toast({
          title: "Erro",
          description: formatApiError(usersData),
          variant: "destructive",
        })
        setProfiles([])
        return
      }

      if (usersData?.users) {
        setProfiles(usersData.users)
      }
    } catch {
      router.push("/auth/login")
    } finally {
      setIsLoading(false)
    }
  }

  const validateForm = () => {
    const newErrors: Record<string, string> = {}
    if (!newUser.nome.trim()) newErrors.nome = "Nome é obrigatório"
    if (!newUser.email.trim()) newErrors.email = "Email é obrigatório"
    if (!newUser.email.includes("@")) newErrors.email = "Email inválido"
    if (newUser.password.length < 6) newErrors.password = "Mínimo 6 caracteres"
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!validateForm()) return
    setIsCreating(true)

    try {
      const res = await fetch("/api/auth/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newUser),
      })

      const data = await res.json().catch(() => null)

      if (!res.ok) {
        toast({ title: "Erro", description: formatApiError(data), variant: "destructive" })
        return
      }

      toast({ title: "Sucesso", description: "Usuário criado com sucesso!" })
      setIsModalOpen(false)
      setNewUser({ email: "", password: "", nome: "", role: "consulta" })
      setErrors({})
      checkAccessAndLoad()
    } catch {
      toast({ title: "Erro", description: "Erro ao criar usuário.", variant: "destructive" })
    } finally {
      setIsCreating(false)
    }
  }

  const handleDeleteUser = async (userId: string, userEmail: string) => {
    if (!confirm(`Tem certeza que deseja remover o acesso de ${userEmail}?`)) return

    try {
      const res = await fetch(`/api/auth/users/${userId}`, { method: "DELETE" })

      if (!res.ok) {
        toast({ title: "Erro", description: "Erro ao remover usuário.", variant: "destructive" })
        return
      }

      toast({ title: "Sucesso", description: "Usuário removido com sucesso!" })
      setProfiles(profiles.filter((p) => p.id !== userId))
    } catch {
      toast({ title: "Erro", description: "Erro ao remover.", variant: "destructive" })
    }
  }

  const handleChangeRole = async (userId: string, newRole: string) => {
    try {
      const res = await fetch(`/api/auth/users/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: newRole }),
      })

      if (!res.ok) {
        toast({ title: "Erro", description: "Erro ao alterar permissão.", variant: "destructive" })
        return
      }

      setProfiles(profiles.map((p) => (p.id === userId ? { ...p, role: newRole } : p)))
      toast({ title: "Sucesso", description: "Permissão atualizada!" })
    } catch {
      toast({ title: "Erro", description: "Erro ao atualizar.", variant: "destructive" })
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-[#7CB342]" />
          <p className="text-sm text-muted-foreground">Carregando...</p>
        </div>
      </div>
    )
  }

  if (!currentUser || currentUser.role !== "mestre") return null

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="h-3 bg-[#7CB342]" />
      <div className="border-b border-border bg-card">
        <div className="mx-auto max-w-5xl px-4 py-5 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link href="/dashboard">
                <Button variant="outline" size="icon" className="bg-transparent">
                  <ArrowLeft className="h-4 w-4" />
                </Button>
              </Link>
              <div>
                <div className="flex items-center gap-2">
                  <Users className="h-5 w-5 text-[#7CB342]" />
                  <h1 className="text-xl font-semibold text-foreground">Gerenciar Usuários</h1>
                </div>
                <p className="text-sm text-muted-foreground mt-0.5">
                  Cadastre e gerencie os acessos ao sistema
                </p>
              </div>
            </div>
            <Button
              onClick={() => setIsModalOpen(true)}
              className="gap-2 bg-[#7CB342] hover:bg-[#689F38] text-white shadow-md"
            >
              <Plus className="h-4 w-4" />
              Novo Usuário
            </Button>
          </div>
        </div>
      </div>

      {/* Content */}
      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8 space-y-6">
        {/* Legenda dos tipos */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {(["mestre", "consulta", "administrativo", "logistico"] as UserRole[]).map((role) => {
            const style = ROLE_STYLES[role]
            return (
              <div key={role} className="bg-card border border-border rounded-lg p-4 flex items-start gap-3">
                <div className={`rounded-full p-2 ${style.color}`}>{style.icon}</div>
                <div>
                  <p className="text-sm font-semibold text-foreground">{ROLE_LABELS[role]}</p>
                  <p className="text-xs text-muted-foreground leading-relaxed">{ROLE_DESCRIPTIONS[role]}</p>
                </div>
              </div>
            )
          })}
        </div>

        {/* Tabela */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Usuários Cadastrados</CardTitle>
                <CardDescription>{profiles.length} usuário(s) no sistema</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {profiles.length === 0 ? (
              <div className="text-center py-12">
                <UserCircle className="h-12 w-12 mx-auto text-muted-foreground/40 mb-3" />
                <p className="text-muted-foreground font-medium">Nenhum usuário cadastrado</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Clique em "Novo Usuário" para cadastrar o primeiro acesso.
                </p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead className="font-semibold">Nome</TableHead>
                    <TableHead className="font-semibold">Email</TableHead>
                    <TableHead className="font-semibold">Tipo de Acesso</TableHead>
                    <TableHead className="font-semibold">Criado em</TableHead>
                    <TableHead className="w-[60px]" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {profiles.map((profile) => {
                    const role = (profile.role || "consulta") as UserRole
                    const style = ROLE_STYLES[role] || ROLE_STYLES.consulta
                    return (
                      <TableRow key={profile.id}>
                        <TableCell className="font-medium">{profile.nome || "-"}</TableCell>
                        <TableCell className="text-muted-foreground">{profile.email}</TableCell>
                        <TableCell>
                          <Select
                            value={role}
                            onValueChange={(val) => handleChangeRole(profile.id, val)}
                          >
                            <SelectTrigger className="w-44 h-8 bg-transparent">
                              <SelectValue>
                                <div className="flex items-center gap-2">
                                  <Badge variant="outline" className={`text-xs ${style.color}`}>
                                    {style.icon}
                                    <span className="ml-1">{ROLE_LABELS[role]}</span>
                                  </Badge>
                                </div>
                              </SelectValue>
                            </SelectTrigger>
                            <SelectContent>
                              {(["mestre", "consulta", "administrativo", "logistico"] as UserRole[]).map(
                                (r) => (
                                  <SelectItem key={r} value={r}>
                                    <div className="flex items-center gap-2">
                                      {ROLE_STYLES[r].icon}
                                      <span>{ROLE_LABELS[r]}</span>
                                    </div>
                                  </SelectItem>
                                )
                              )}
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {new Date(profile.created_at).toLocaleDateString("pt-BR")}
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                            onClick={() => handleDeleteUser(profile.id, profile.email)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </main>

      {/* Create User Modal */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="sm:max-w-lg w-full max-w-[90vw] overflow-hidden">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="h-5 w-5 text-[#7CB342]" />
              Cadastrar Novo Usuário
            </DialogTitle>
            <DialogDescription>
              Defina as credenciais e o tipo de acesso do novo usuário.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreateUser} className="space-y-5 pt-2 w-full max-w-full">
            <div className="space-y-1.5">
              <Label htmlFor="nome" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Nome Completo
              </Label>
              <Input
                id="nome"
                placeholder="Ex: João da Silva"
                value={newUser.nome}
                onChange={(e) => setNewUser({ ...newUser, nome: e.target.value })}
              />
              {errors.nome && <p className="text-xs text-destructive">{errors.nome}</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="new-email" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Email
              </Label>
              <Input
                id="new-email"
                type="email"
                placeholder="email@exemplo.com"
                value={newUser.email}
                onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
              />
              {errors.email && <p className="text-xs text-destructive">{errors.email}</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="new-password" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Senha
              </Label>
              <Input
                id="new-password"
                type="password"
                placeholder="Mínimo 6 caracteres"
                value={newUser.password}
                onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
              />
              {errors.password && <p className="text-xs text-destructive">{errors.password}</p>}
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Tipo de Acesso
              </Label>
              <Select
                value={newUser.role}
                onValueChange={(val) => setNewUser({ ...newUser, role: val as UserRole })}
              >
                <SelectTrigger className="w-full bg-transparent overflow-hidden">
                  <SelectValue className="block max-w-full truncate" placeholder="Selecione o tipo de acesso" />
                </SelectTrigger>
                <SelectContent>
                  {(["mestre", "consulta", "administrativo", "logistico"] as UserRole[]).map((r) => (
                    <SelectItem key={r} value={r}>
                      <div className="flex items-center gap-2">
                        {ROLE_STYLES[r].icon}
                        <span className="font-medium">{ROLE_LABELS[r]}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex gap-3 pt-4 border-t border-border">
              <Button
                type="button"
                variant="outline"
                className="flex-1 bg-transparent"
                onClick={() => {
                  setIsModalOpen(false)
                  setErrors({})
                }}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                className="flex-1 bg-[#7CB342] hover:bg-[#689F38] text-white"
                disabled={isCreating}
              >
                {isCreating ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Criando...
                  </>
                ) : (
                  "Cadastrar Usuário"
                )}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
