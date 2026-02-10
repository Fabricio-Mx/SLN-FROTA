import React from "react"
import { redirect } from "next/navigation"
import { cookies } from "next/headers"

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

  return <>{children}</>
}
