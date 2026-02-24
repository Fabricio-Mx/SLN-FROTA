import React from "react"
import { redirect } from "next/navigation"
import { cookies } from "next/headers"
import { IdleLogout } from "@/components/idle-logout"
import { SupabaseHealthBanner } from "@/components/supabase-health-banner"
import { BackupScheduler } from "@/components/backup-scheduler"

export default async function ProtectedLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const cookieStore = await cookies()
  const userCookie = cookieStore.get("app_user")

  if (!userCookie?.value) {
    redirect("/auth/login")
  }

  return (
    <>
      <SupabaseHealthBanner />
      <IdleLogout />
      <BackupScheduler />
      {children}
    </>
  )
}
