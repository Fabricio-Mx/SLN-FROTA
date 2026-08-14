import React from "react"
import { redirect } from "next/navigation"
import { IdleLogout } from "@/components/idle-logout"
import { SupabaseHealthBanner } from "@/components/supabase-health-banner"
import { verifySession } from "@/lib/auth"

export default async function ProtectedLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await verifySession()

  if (!session) {
    redirect("/auth/login")
  }

  return (
    <>
      <SupabaseHealthBanner />
      <IdleLogout />
      {children}
    </>
  )
}
