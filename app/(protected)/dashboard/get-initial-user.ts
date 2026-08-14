import { redirect } from "next/navigation"
import { verifySession } from "@/lib/auth"
import type { AppUser } from "@/lib/types"

export async function getDashboardInitialUser(): Promise<AppUser> {
  const initialUser = await verifySession()

  if (!initialUser) {
    redirect("/auth/login")
  }

  return initialUser
}