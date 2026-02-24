"use client"

import { useEffect, useState } from "react"

type HealthState = {
  ok: boolean
  message?: string
}

const CHECK_INTERVAL_MS = 5 * 60 * 1000

export function SupabaseHealthBanner() {
  const [state, setState] = useState<HealthState>({ ok: true })

  useEffect(() => {
    let mounted = true

    const check = async () => {
      try {
        const res = await fetch("/api/health/supabase", { cache: "no-store" })
        const data = await res.json().catch(() => ({}))
        if (!mounted) return
        if (!res.ok || data?.ok === false) {
          setState({ ok: false, message: data?.hint || data?.error || "Supabase indisponivel." })
          return
        }
        setState({ ok: true })
      } catch (err) {
        if (!mounted) return
        const message = err instanceof Error ? err.message : "Supabase indisponivel."
        setState({ ok: false, message })
      }
    }

    check()
    const interval = setInterval(check, CHECK_INTERVAL_MS)

    return () => {
      mounted = false
      clearInterval(interval)
    }
  }, [])

  if (state.ok) return null

  return (
    <div className="bg-destructive/10 border-b border-destructive/30 text-destructive">
      <div className="mx-auto max-w-7xl px-4 py-2 text-sm sm:px-6 lg:px-8">
        <span className="font-semibold">Aviso:</span> {state.message || "Supabase indisponivel."} Verifique se o projeto esta ativo.
      </div>
    </div>
  )
}
