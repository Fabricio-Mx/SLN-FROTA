// Server-only auth utilities (uses next/headers)
import { cookies } from "next/headers"
import type { AppUser } from "@/lib/types"

// Re-export everything from shared so server code can import from "@/lib/auth"
export {
  MASTER_CREDENTIALS,
  isMasterLogin,
  getMasterUser,
  ROLE_LABELS,
  ROLE_DESCRIPTIONS,
  canCreateUsers,
  canEditData,
  canDeleteData,
  canAddVehicles,
  canAddColaboradores,
} from "@/lib/auth-shared"

// Verifica a sessao do usuario a partir do cookie (server-only)
export async function verifySession(): Promise<AppUser | null> {
  try {
    const cookieStore = await cookies()
    const userCookie = cookieStore.get("app_user")
    if (!userCookie?.value) return null
    const decoded = decodeURIComponent(userCookie.value)
    return JSON.parse(decoded) as AppUser
  } catch {
    return null
  }
}
