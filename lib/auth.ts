// Server-only auth utilities (uses next/headers)
import { cookies } from "next/headers"
import type { AppUser } from "@/lib/types"

export const USER_SESSION_COOKIE = "app_user"
export const SESSION_ACTIVITY_COOKIE = "app_last_activity"
export const SESSION_IDLE_MS = 40 * 60 * 1000

// Re-export everything from shared so server code can import from "@/lib/auth"
export {
  MASTER_CREDENTIALS,
  isMasterLogin,
  getMasterUser,
  ROLE_LABELS,
  ROLE_DESCRIPTIONS,
  USER_ROLES,
  canCreateUsers,
  canEditData,
  canDeleteData,
  canAddVehicles,
  canAddColaboradores,
  canManageMultas,
  canEditMultaRhStatus,
} from "@/lib/auth-shared"

// Verifica a sessao do usuario a partir do cookie (server-only)
export async function verifySession(): Promise<AppUser | null> {
  try {
    const cookieStore = await cookies()
    const userCookie = cookieStore.get(USER_SESSION_COOKIE)
    const lastActivityCookie = cookieStore.get(SESSION_ACTIVITY_COOKIE)
    if (!userCookie?.value) return null

    const lastActivityAt = Number(lastActivityCookie?.value)
    if (!Number.isFinite(lastActivityAt) || Date.now() - lastActivityAt > SESSION_IDLE_MS) {
      return null
    }

    const decoded = decodeURIComponent(userCookie.value)
    return JSON.parse(decoded) as AppUser
  } catch {
    return null
  }
}
