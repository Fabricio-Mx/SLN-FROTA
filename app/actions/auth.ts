"use server"

import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import { isMasterLogin, getMasterUser } from "@/lib/auth-shared"

export async function loginAction(email: string, password: string): Promise<{ success: boolean; error?: string }> {
  // 1. Verificar login mestre
  if (isMasterLogin(email, password)) {
    const masterUser = getMasterUser()
    const cookieStore = await cookies()
    cookieStore.set("app_user", JSON.stringify(masterUser), {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 7,
    })
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
      isMaster: false,
    }

    const cookieStore = await cookies()
    cookieStore.set("app_user", JSON.stringify(appUser), {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 7,
    })

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
  cookieStore.set("app_user", "", {
    httpOnly: true,
    path: "/",
    maxAge: 0,
  })

  redirect("/auth/login")
}

export async function getCurrentUser() {
  const cookieStore = await cookies()
  const userCookie = cookieStore.get("app_user")

  if (!userCookie?.value) return null

  try {
    return JSON.parse(userCookie.value)
  } catch {
    return null
  }
}
