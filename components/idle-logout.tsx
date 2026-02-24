"use client"

import { useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import { logoutAction } from "@/app/actions/auth"

type IdleLogoutProps = {
  idleMs?: number
}

const DEFAULT_IDLE_MS = 30 * 60 * 1000

export function IdleLogout({ idleMs = DEFAULT_IDLE_MS }: IdleLogoutProps) {
  const router = useRouter()
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const loggingOutRef = useRef(false)

  useEffect(() => {
    const clearTimer = () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
        timeoutRef.current = null
      }
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
        resetTimer()
      }
    }

    document.addEventListener("visibilitychange", handleVisibility)

    resetTimer()

    return () => {
      clearTimer()
      events.forEach((event) => window.removeEventListener(event, resetTimer))
      document.removeEventListener("visibilitychange", handleVisibility)
    }
  }, [idleMs, router])

  return null
}
