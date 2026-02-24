"use client"

import { useEffect } from "react"
import { toast } from "@/hooks/use-toast"

const BACKUP_INTERVAL_MS = 24 * 60 * 60 * 1000
const LAST_BACKUP_KEY = "last_backup_at"
const LAST_BACKUP_ATTEMPT_KEY = "last_backup_attempt"

export function BackupScheduler() {
  useEffect(() => {
    if (typeof window === "undefined") return

    const now = Date.now()
    const lastBackup = Number(localStorage.getItem(LAST_BACKUP_KEY) || "0")
    const lastAttempt = Number(localStorage.getItem(LAST_BACKUP_ATTEMPT_KEY) || "0")

    if (now - lastBackup < BACKUP_INTERVAL_MS) return
    if (now - lastAttempt < 60 * 60 * 1000) return

    localStorage.setItem(LAST_BACKUP_ATTEMPT_KEY, String(now))

    const run = async () => {
      try {
        const res = await fetch("/api/backup", { method: "POST" })
        if (res.status === 403) return

        const data = await res.json().catch(() => ({}))
        if (!res.ok) {
          throw new Error(data?.error || "Falha ao gerar backup.")
        }

        localStorage.setItem(LAST_BACKUP_KEY, String(Date.now()))
        toast({
          title: "Backup",
          description: data?.file?.name
            ? `Backup salvo no Drive: ${data.file.name}`
            : "Backup salvo no Drive com sucesso.",
        })
      } catch (err) {
        const message = err instanceof Error ? err.message : "Falha ao gerar backup."
        toast({
          title: "Backup",
          description: message,
          variant: "destructive",
        })
      }
    }

    run()
  }, [])

  return null
}
