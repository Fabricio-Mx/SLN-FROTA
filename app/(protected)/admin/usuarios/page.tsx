"use client"

import React from "react"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import {
  ArrowLeft,
  Briefcase,
  Camera,
  Eye,
  Loader2,
  Plus,
  Search,
  Shield,
  Trash2,
  TruckIcon,
  UserCircle,
  Users,
} from "lucide-react"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { toast } from "@/hooks/use-toast"
import { ROLE_DESCRIPTIONS, ROLE_LABELS, USER_ROLES } from "@/lib/auth-shared"
import { cn } from "@/lib/utils"
import type { AppUser, UserRole } from "@/lib/types"

interface Profile {
  id: string
  email: string
  nome: string | null
  avatar_url?: string | null
  role: string
  is_admin: boolean
  created_at: string
}

const ROLE_STYLES: Record<UserRole, { icon: React.ReactNode; color: string; dot: string }> = {
  mestre: {
    icon: <Shield className="h-3.5 w-3.5" />,
    color: "bg-amber-100 text-amber-800 border-amber-200",
    dot: "bg-amber-500",
  },
  consulta: {
    icon: <Eye className="h-3.5 w-3.5" />,
    color: "bg-blue-100 text-blue-800 border-blue-200",
    dot: "bg-blue-500",
  },
  administrativo: {
    icon: <Briefcase className="h-3.5 w-3.5" />,
    color: "bg-green-100 text-green-800 border-green-200",
    dot: "bg-green-500",
  },
  administrativo_rh: {
    icon: <Users className="h-3.5 w-3.5" />,
    color: "bg-cyan-100 text-cyan-800 border-cyan-200",
    dot: "bg-cyan-500",
  },
  logistico: {
    icon: <TruckIcon className="h-3.5 w-3.5" />,
    color: "bg-purple-100 text-purple-800 border-purple-200",
    dot: "bg-purple-500",
  },
}

const CARD_CLASS = "overflow-hidden rounded-2xl border-[#dde5ee] shadow-[0_10px_30px_rgba(61,97,146,0.08)]"

function normalizeText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
}

export default function AdminUsuariosPage() {
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [currentUser, setCurrentUser] = useState<AppUser | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isCreating, setIsCreating] = useState(false)
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false)
  const [uploadingAvatarForUserId, setUploadingAvatarForUserId] = useState<string | null>(null)
  const [deletingProfile, setDeletingProfile] = useState<Profile | null>(null)
  const [search, setSearch] = useState("")
  const [roleFilter, setRoleFilter] = useState<"todos" | UserRole>("todos")
  const [newUser, setNewUser] = useState({
    email: "",
    password: "",
    nome: "",
    role: "consulta" as UserRole,
  })
  const [newUserAvatarFile, setNewUserAvatarFile] = useState<File | null>(null)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const avatarInputsRef = useRef<Record<string, HTMLInputElement | null>>({})
  const router = useRouter()

  const formatApiError = (data: { error?: string; hint?: string } | null) => {
    if (!data) return "Erro ao carregar."
    if (data.hint) return `${data.error || "Erro"}. ${data.hint}`
    return data.error || "Erro ao carregar."
  }

  const checkAccessAndLoad = useCallback(async () => {
    try {
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

      const usersRes = await fetch("/api/auth/users")
      const usersData = await usersRes.json().catch(() => null)

      if (!usersRes.ok) {
        toast({ title: "Erro", description: formatApiError(usersData), variant: "destructive" })
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
  }, [router])

  useEffect(() => {
    checkAccessAndLoad()
  }, [checkAccessAndLoad])

  const roleCounts = useMemo(() => {
    const counts = Object.fromEntries(USER_ROLES.map((role) => [role, 0])) as Record<UserRole, number>

    for (const profile of profiles) {
      const role = (profile.role || "consulta") as UserRole
      if (role in counts) counts[role] += 1
    }

    return counts
  }, [profiles])

  const filteredProfiles = useMemo(() => {
    const term = normalizeText(search)

    return profiles.filter((profile) => {
      const role = (profile.role || "consulta") as UserRole
      if (roleFilter !== "todos" && role !== roleFilter) return false
      if (!term) return true

      return (
        normalizeText(profile.nome || "").includes(term) ||
        normalizeText(profile.email).includes(term)
      )
    })
  }, [profiles, search, roleFilter])

  const validateForm = () => {
    const newErrors: Record<string, string> = {}
    if (!newUser.nome.trim()) newErrors.nome = "Nome é obrigatório"
    if (!newUser.email.trim()) newErrors.email = "Email é obrigatório"
    if (!newUser.email.includes("@")) newErrors.email = "Email inválido"
    if (newUser.password.length < 6) newErrors.password = "Mínimo 6 caracteres"
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const getInitials = (name: string | null | undefined, email: string) => {
    const base = (name || email || "U").trim()
    return base.charAt(0).toUpperCase()
  }

  const uploadAvatar = async (userId: string, file: File) => {
    const body = new FormData()
    body.append("userId", userId)
    body.append("file", file)

    const res = await fetch("/api/auth/users/avatar", { method: "POST", body })
    const data = await res.json().catch(() => null)

    if (!res.ok) {
      throw new Error(formatApiError(data))
    }

    return data?.avatarUrl as string
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

      if (newUserAvatarFile && data?.userId) {
        setIsUploadingAvatar(true)
        await uploadAvatar(data.userId, newUserAvatarFile)
      }

      toast({ title: "Sucesso", description: data?.message || "Usuário criado com sucesso!" })
      setIsModalOpen(false)
      setNewUser({ email: "", password: "", nome: "", role: "consulta" })
      setNewUserAvatarFile(null)
      setErrors({})
      checkAccessAndLoad()
    } catch (error) {
      toast({
        title: "Erro",
        description: error instanceof Error ? error.message : "Erro ao criar usuário.",
        variant: "destructive",
      })
    } finally {
      setIsUploadingAvatar(false)
      setIsCreating(false)
    }
  }

  const handleAvatarChange = async (userId: string, file: File | null) => {
    if (!file) return

    setUploadingAvatarForUserId(userId)
    try {
      const avatarUrl = await uploadAvatar(userId, file)
      setProfiles((current) =>
        current.map((profile) =>
          profile.id === userId ? { ...profile, avatar_url: `${avatarUrl}?v=${Date.now()}` } : profile
        )
      )
      toast({ title: "Sucesso", description: "Foto atualizada com sucesso!" })
    } catch (error) {
      toast({
        title: "Erro",
        description: error instanceof Error ? error.message : "Não foi possível enviar a foto.",
        variant: "destructive",
      })
    } finally {
      setUploadingAvatarForUserId(null)
    }
  }

  const handleDeleteUser = async () => {
    if (!deletingProfile) return

    try {
      const res = await fetch(`/api/auth/users/${deletingProfile.id}`, { method: "DELETE" })

      if (!res.ok) {
        toast({ title: "Erro", description: "Erro ao remover usuário.", variant: "destructive" })
        return
      }

      toast({ title: "Sucesso", description: "Usuário removido com sucesso!" })
      setProfiles((current) => current.filter((profile) => profile.id !== deletingProfile.id))
    } catch {
      toast({ title: "Erro", description: "Erro ao remover.", variant: "destructive" })
    } finally {
      setDeletingProfile(null)
    }
  }

  const handleChangeRole = async (userId: string, newRole: string) => {
    const previousProfiles = profiles
    setProfiles((current) => current.map((p) => (p.id === userId ? { ...p, role: newRole } : p)))

    try {
      const res = await fetch(`/api/auth/users/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: newRole }),
      })

      if (!res.ok) {
        setProfiles(previousProfiles)
        toast({ title: "Erro", description: "Erro ao alterar permissão.", variant: "destructive" })
        return
      }

      toast({
        title: "Permissão atualizada",
        description: `Novo acesso: ${ROLE_LABELS[newRole as UserRole] ?? newRole}.`,
      })
    } catch {
      setProfiles(previousProfiles)
      toast({ title: "Erro", description: "Erro ao atualizar.", variant: "destructive" })
    }
  }

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-[#7CB342]" />
          <p className="text-sm text-muted-foreground">Carregando...</p>
        </div>
      </div>
    )
  }

  if (!currentUser || currentUser.role !== "mestre") return null

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#f7f9fc_0%,#f2f5f9_100%)]">
      <div className="h-2 bg-[#7CB342]" />

      <header className="sticky top-0 z-20 border-b border-border bg-card/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <Button asChild variant="outline" size="icon" className="rounded-xl bg-transparent">
              <Link href="/dashboard" aria-label="Voltar ao painel">
                <ArrowLeft className="h-4 w-4" />
              </Link>
            </Button>
            <div>
              <h1 className="flex items-center gap-2 text-lg font-semibold text-foreground sm:text-xl">
                <Users className="h-5 w-5 text-[#7CB342]" />
                Gerenciar Usuários
              </h1>
              <p className="text-xs text-muted-foreground sm:text-sm">
                Cadastre, defina permissões e controle os acessos ao sistema.
              </p>
            </div>
          </div>

          <Button
            onClick={() => setIsModalOpen(true)}
            className="gap-2 bg-[#7CB342] text-white shadow-sm hover:bg-[#689F38]"
          >
            <Plus className="h-4 w-4" />
            Novo Usuário
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-6xl space-y-6 px-4 py-6 sm:px-6 lg:px-8">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Card className={CARD_CLASS}>
            <CardContent className="flex items-start justify-between gap-4 p-5">
              <div className="space-y-1">
                <p className="text-sm font-semibold text-muted-foreground">Total de Usuários</p>
                <p className="text-2xl font-bold text-slate-900">{profiles.length}</p>
                <p className="text-xs text-muted-foreground">Contas ativas no sistema</p>
              </div>
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#7CB342]/10 text-[#4c6b28]">
                <Users className="h-5 w-5" />
              </span>
            </CardContent>
          </Card>

          {(["mestre", "administrativo", "consulta"] as UserRole[]).map((role) => (
            <Card key={role} className={CARD_CLASS}>
              <CardContent className="flex items-start justify-between gap-4 p-5">
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-muted-foreground">{ROLE_LABELS[role]}</p>
                  <p className="text-2xl font-bold text-slate-900">{roleCounts[role]}</p>
                  <p className="text-xs text-muted-foreground">
                    {role === "mestre" ? "Acesso total ao sistema" : role === "consulta" ? "Somente leitura" : "Operação do dia a dia"}
                  </p>
                </div>
                <span className={cn("flex h-10 w-10 items-center justify-center rounded-xl", ROLE_STYLES[role].color)}>
                  {ROLE_STYLES[role].icon}
                </span>
              </CardContent>
            </Card>
          ))}
        </div>

        <Card className={CARD_CLASS}>
          <CardHeader className="border-b border-border pb-4">
            <CardTitle className="text-base">Tipos de acesso</CardTitle>
            <CardDescription>O que cada perfil pode fazer dentro do sistema.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 p-5 sm:grid-cols-2 xl:grid-cols-3">
            {USER_ROLES.map((role) => (
              <div key={role} className="flex items-start gap-3 rounded-xl border border-border bg-muted/20 p-3">
                <span className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-lg", ROLE_STYLES[role].color)}>
                  {ROLE_STYLES[role].icon}
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-foreground">{ROLE_LABELS[role]}</p>
                  <p className="text-xs leading-relaxed text-muted-foreground">{ROLE_DESCRIPTIONS[role]}</p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className={CARD_CLASS}>
          <CardHeader className="border-b border-border pb-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <CardTitle className="text-base">Usuários Cadastrados</CardTitle>
                <CardDescription>
                  {filteredProfiles.length} de {profiles.length} usuário(s) exibido(s)
                </CardDescription>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <div className="relative min-w-[220px]">
                  <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Buscar por nome ou e-mail"
                    className="pl-9"
                  />
                </div>

                <Select value={roleFilter} onValueChange={(value) => setRoleFilter(value as "todos" | UserRole)}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Todos os acessos" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos os acessos</SelectItem>
                    {USER_ROLES.map((role) => (
                      <SelectItem key={role} value={role}>
                        {ROLE_LABELS[role]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardHeader>

          <CardContent className="p-0">
            {filteredProfiles.length === 0 ? (
              <div className="py-14 text-center">
                <UserCircle className="mx-auto mb-3 h-12 w-12 text-muted-foreground/40" />
                <p className="font-medium text-muted-foreground">
                  {profiles.length === 0 ? "Nenhum usuário cadastrado" : "Nenhum usuário encontrado"}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {profiles.length === 0
                    ? "Clique em “Novo Usuário” para cadastrar o primeiro acesso."
                    : "Ajuste a busca ou o filtro de tipo de acesso."}
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/40">
                      <TableHead className="font-semibold">Usuário</TableHead>
                      <TableHead className="font-semibold">Tipo de Acesso</TableHead>
                      <TableHead className="font-semibold">Criado em</TableHead>
                      <TableHead className="w-[120px] text-right font-semibold">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredProfiles.map((profile) => {
                      const role = (profile.role || "consulta") as UserRole
                      const style = ROLE_STYLES[role] || ROLE_STYLES.consulta
                      const isUploading = uploadingAvatarForUserId === profile.id
                      const isCurrentUser = profile.id === currentUser.id

                      return (
                        <TableRow key={profile.id}>
                          <TableCell>
                            <div className="flex items-center gap-3">
                              <div className="relative">
                                <Avatar className="h-11 w-11 ring-2 ring-[#dbe8cf]">
                                  <AvatarImage
                                    src={profile.avatar_url || undefined}
                                    alt={profile.nome || profile.email}
                                    className="object-cover"
                                  />
                                  <AvatarFallback className="bg-[#7CB342] font-semibold text-white">
                                    {getInitials(profile.nome, profile.email)}
                                  </AvatarFallback>
                                </Avatar>
                                <input
                                  ref={(element) => {
                                    avatarInputsRef.current[profile.id] = element
                                  }}
                                  type="file"
                                  accept="image/*"
                                  className="hidden"
                                  onChange={(event) => {
                                    handleAvatarChange(profile.id, event.target.files?.[0] || null)
                                    event.currentTarget.value = ""
                                  }}
                                />
                                <button
                                  type="button"
                                  aria-label={`Alterar foto de ${profile.nome || profile.email}`}
                                  title="Alterar foto"
                                  disabled={isUploading}
                                  onClick={() => avatarInputsRef.current[profile.id]?.click()}
                                  className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full border border-border bg-card text-muted-foreground shadow-sm transition-colors hover:text-foreground"
                                >
                                  {isUploading ? (
                                    <Loader2 className="h-3 w-3 animate-spin text-[#7CB342]" />
                                  ) : (
                                    <Camera className="h-3 w-3" />
                                  )}
                                </button>
                              </div>

                              <div className="min-w-0">
                                <p className="flex items-center gap-2 font-medium text-foreground">
                                  <span className="truncate">{profile.nome || "—"}</span>
                                  {isCurrentUser ? (
                                    <Badge variant="outline" className="border-[#dbe8cf] bg-[#f3f9e8] text-[0.65rem] text-[#4c6b28]">
                                      Você
                                    </Badge>
                                  ) : null}
                                </p>
                                <p className="truncate text-xs text-muted-foreground">{profile.email}</p>
                              </div>
                            </div>
                          </TableCell>

                          <TableCell>
                            <Select value={role} onValueChange={(value) => handleChangeRole(profile.id, value)}>
                              <SelectTrigger className="h-9 w-48 bg-transparent">
                                <SelectValue>
                                  <Badge variant="outline" className={cn("gap-1 text-xs", style.color)}>
                                    {style.icon}
                                    {ROLE_LABELS[role]}
                                  </Badge>
                                </SelectValue>
                              </SelectTrigger>
                              <SelectContent>
                                {USER_ROLES.map((item) => (
                                  <SelectItem key={item} value={item}>
                                    <span className="flex items-center gap-2">
                                      <span className={cn("h-2 w-2 rounded-full", ROLE_STYLES[item].dot)} />
                                      {ROLE_LABELS[item]}
                                    </span>
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </TableCell>

                          <TableCell className="text-sm text-muted-foreground">
                            {new Date(profile.created_at).toLocaleDateString("pt-BR")}
                          </TableCell>

                          <TableCell>
                            <div className="flex items-center justify-end">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-destructive hover:bg-destructive/10 hover:text-destructive"
                                aria-label="Remover usuário"
                                disabled={isCurrentUser}
                                onClick={() => setDeletingProfile(profile)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </main>

      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="max-h-[85vh] w-full max-w-[90vw] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="h-5 w-5 text-[#7CB342]" />
              Cadastrar Novo Usuário
            </DialogTitle>
            <DialogDescription>Defina as credenciais e o tipo de acesso do novo usuário.</DialogDescription>
          </DialogHeader>

          <form onSubmit={handleCreateUser} className="w-full max-w-full space-y-4 pt-2">
            <div className="grid gap-2">
              <Label htmlFor="nome">Nome Completo</Label>
              <Input
                id="nome"
                placeholder="Ex: João da Silva"
                value={newUser.nome}
                onChange={(e) => setNewUser({ ...newUser, nome: e.target.value })}
              />
              {errors.nome ? <p className="text-xs text-destructive">{errors.nome}</p> : null}
            </div>

            <div className="grid gap-2">
              <Label htmlFor="new-email">Email</Label>
              <Input
                id="new-email"
                type="email"
                placeholder="email@exemplo.com"
                value={newUser.email}
                onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
              />
              {errors.email ? <p className="text-xs text-destructive">{errors.email}</p> : null}
            </div>

            <div className="grid gap-2">
              <Label htmlFor="new-password">Senha</Label>
              <Input
                id="new-password"
                type="password"
                placeholder="Mínimo 6 caracteres"
                value={newUser.password}
                onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
              />
              {errors.password ? <p className="text-xs text-destructive">{errors.password}</p> : null}
            </div>

            <div className="grid gap-2">
              <Label htmlFor="avatar-file">Foto do Usuário</Label>
              <Input
                id="avatar-file"
                type="file"
                accept="image/*"
                onChange={(e) => setNewUserAvatarFile(e.target.files?.[0] || null)}
              />
              <p className="text-xs text-muted-foreground">PNG, JPG, WEBP ou GIF até 5 MB.</p>
            </div>

            <div className="grid gap-2">
              <Label>Tipo de Acesso</Label>
              <Select
                value={newUser.role}
                onValueChange={(val) => setNewUser({ ...newUser, role: val as UserRole })}
              >
                <SelectTrigger className="w-full overflow-hidden bg-transparent">
                  <SelectValue className="block max-w-full truncate" placeholder="Selecione o tipo de acesso" />
                </SelectTrigger>
                <SelectContent>
                  {USER_ROLES.map((r) => (
                    <SelectItem key={r} value={r}>
                      <span className="flex items-center gap-2">
                        <span className={cn("h-2 w-2 rounded-full", ROLE_STYLES[r].dot)} />
                        <span className="font-medium">{ROLE_LABELS[r]}</span>
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">{ROLE_DESCRIPTIONS[newUser.role]}</p>
            </div>

            <div className="flex gap-3 border-t border-border pt-4">
              <Button
                type="button"
                variant="outline"
                className="flex-1 bg-transparent"
                onClick={() => {
                  setIsModalOpen(false)
                  setNewUserAvatarFile(null)
                  setErrors({})
                }}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                className="flex-1 bg-[#7CB342] text-white hover:bg-[#689F38]"
                disabled={isCreating || isUploadingAvatar}
              >
                {isCreating || isUploadingAvatar ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Salvando...
                  </>
                ) : (
                  "Cadastrar Usuário"
                )}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={deletingProfile !== null}
        onOpenChange={(value) => {
          if (!value) setDeletingProfile(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover acesso?</AlertDialogTitle>
            <AlertDialogDescription>
              {deletingProfile
                ? `${deletingProfile.nome || deletingProfile.email} perderá o acesso ao sistema. Essa ação não pode ser desfeita.`
                : ""}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteUser}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
