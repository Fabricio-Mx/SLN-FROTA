"use client"

import { useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import { logoutAction, touchSessionActivityAction } from "@/app/actions/auth"

type IdleLogoutProps = {
  idleMs?: number
}

const DEFAULT_IDLE_MS = 40 * 60 * 1000
const LAST_ACTIVITY_STORAGE_KEY = "app_last_activity_at"
const SESSION_SYNC_INTERVAL_MS = 60 * 1000

export function IdleLogout({ idleMs = DEFAULT_IDLE_MS }: IdleLogoutProps) {
  const router = useRouter()
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const loggingOutRef = useRef(false)
  const lastServerSyncRef = useRef(0)

  useEffect(() => {
    const clearTimer = () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
        timeoutRef.current = null
      }
    }

    const syncActivity = (force = false) => {
      const now = Date.now()
      localStorage.setItem(LAST_ACTIVITY_STORAGE_KEY, String(now))

      if (!force && now - lastServerSyncRef.current < SESSION_SYNC_INTERVAL_MS) {
        return
      }

      lastServerSyncRef.current = now
      void touchSessionActivityAction()
    }

    const hasExpiredWhileClosed = () => {
      const storedValue = localStorage.getItem(LAST_ACTIVITY_STORAGE_KEY)
      if (!storedValue) return false

      const lastActivityAt = Number(storedValue)
      if (!Number.isFinite(lastActivityAt)) return false

      return Date.now() - lastActivityAt >= idleMs
    }

    const handleIdle = async () => {
      if (loggingOutRef.current) return
      loggingOutRef.current = true
      try {
        await logoutAction()
      } catch {
        router.push("/auth/login")
        router.refresh()
      }
    }

    const resetTimer = () => {
      if (loggingOutRef.current) return
      syncActivity()
      clearTimer()
      timeoutRef.current = setTimeout(handleIdle, idleMs)
    }

    const events: Array<keyof WindowEventMap> = [
      "mousemove",
      "mousedown",
      "keydown",
      "touchstart",
      "scroll",
      "focus",
    ]

    events.forEach((event) => window.addEventListener(event, resetTimer, { passive: true }))

    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        if (hasExpiredWhileClosed()) {
          void handleIdle()
          return
        }

        resetTimer()
      }
    }

    document.addEventListener("visibilitychange", handleVisibility)

    if (hasExpiredWhileClosed()) {
      void handleIdle()
      return () => {
        clearTimer()
        events.forEach((event) => window.removeEventListener(event, resetTimer))
        document.removeEventListener("visibilitychange", handleVisibility)
      }
    }

    syncActivity(true)
    resetTimer()

    return () => {
      clearTimer()
      events.forEach((event) => window.removeEventListener(event, resetTimer))
      document.removeEventListener("visibilitychange", handleVisibility)
    }
  }, [idleMs, router])

  return null
}
