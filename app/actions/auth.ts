"use server"

import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import { isMasterLogin, getMasterUser, MASTER_CREDENTIALS } from "@/lib/auth-shared"
import { SESSION_ACTIVITY_COOKIE, USER_SESSION_COOKIE } from "@/lib/auth"
import { createAdminClient } from "@/lib/supabase/admin"
import type { AppUser } from "@/lib/types"

const MASTER_DB_EMAIL = process.env.MASTER_DB_EMAIL || "admin@sln.com"

async function setSessionCookies(user: AppUser) {
  const cookieStore = await cookies()
  const baseOptions = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  }

  cookieStore.set(USER_SESSION_COOKIE, JSON.stringify(user), baseOptions)
  cookieStore.set(SESSION_ACTIVITY_COOKIE, String(Date.now()), baseOptions)
}

async function ensureMasterUser(): Promise<AppUser | null> {
  try {
    const admin = createAdminClient()

    const { data: userList, error: listError } = await admin.auth.admin.listUsers({
      page: 1,
      perPage: 1000,
    })

    if (listError) return null

    const existing = userList.users.find((user) => user.email === MASTER_DB_EMAIL)
    let userId = existing?.id

    if (!userId) {
      const { data: created, error: createError } = await admin.auth.admin.createUser({
        email: MASTER_DB_EMAIL,
        password: MASTER_CREDENTIALS.password,
        email_confirm: true,
        user_metadata: { nome: "Administrador Mestre", role: "mestre" },
      })

      if (createError || !created.user) return null
      userId = created.user.id
    }

    await admin.from("profiles").upsert({
      id: userId,
      email: MASTER_DB_EMAIL,
      nome: "Administrador Mestre",
      role: "mestre",
      is_admin: true,
      updated_at: new Date().toISOString(),
    })

    return {
      id: userId,
      email: MASTER_DB_EMAIL,
      nome: "Administrador Mestre",
      role: "mestre",
      avatarUrl: null,
      isMaster: true,
    }
  } catch {
    return null
  }
}

export async function loginAction(email: string, password: string): Promise<{ success: boolean; error?: string }> {
  // 1. Verificar login mestre
  if (isMasterLogin(email, password)) {
    const { createClient } = await import("@/lib/supabase/server")
    const supabase = await createClient()
    const masterUser = (await ensureMasterUser()) || getMasterUser()

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: MASTER_DB_EMAIL,
      password: MASTER_CREDENTIALS.password,
    })

    if (signInError) {
      return { success: false, error: "Falha ao iniciar a sessão mestre." }
    }

    await setSessionCookies(masterUser)
    return { success: true }
  }

  // 2. Tentar login via Supabase
  try {
    const { createClient } = await import("@/lib/supabase/server")
    const supabase = await createClient()
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) {
      return { success: false, error: "Credenciais inválidas" }
    }

    // Buscar perfil
    const { data: profile } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", data.user.id)
      .single()

    const appUser = {
      id: data.user.id,
      email: data.user.email || email,
      nome: profile?.nome || data.user.user_metadata?.nome || email,
      role: profile?.role || data.user.user_metadata?.role || "consulta",
      avatarUrl: profile?.avatar_url || data.user.user_metadata?.avatar_url || null,
      isMaster: false,
    }

    await setSessionCookies(appUser)

    return { success: true }
  } catch {
    return { success: false, error: "Erro interno. Tente novamente." }
  }
}

export async function logoutAction() {
  try {
    const { createClient } = await import("@/lib/supabase/server")
    const supabase = await createClient()
    await supabase.auth.signOut()
  } catch {
    // Ignora se nao estava logado no Supabase
  }

  const cookieStore = await cookies()
  cookieStore.set(USER_SESSION_COOKIE, "", {
    httpOnly: true,
    path: "/",
    maxAge: 0,
  })
  cookieStore.set(SESSION_ACTIVITY_COOKIE, "", {
    httpOnly: true,
    path: "/",
    maxAge: 0,
  })

  redirect("/auth/login")
}

export async function touchSessionActivityAction() {
  const cookieStore = await cookies()

  if (!cookieStore.get(USER_SESSION_COOKIE)?.value) {
    return { success: false }
  }

  cookieStore.set(SESSION_ACTIVITY_COOKIE, String(Date.now()), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  })

  return { success: true }
}

export async function getCurrentUser() {
  const cookieStore = await cookies()
  const userCookie = cookieStore.get(USER_SESSION_COOKIE)

  if (!userCookie?.value) return null

  try {
    return JSON.parse(userCookie.value)
  } catch {
    return null
  }
}
