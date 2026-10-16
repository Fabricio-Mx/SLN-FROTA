import type { Vehicle } from "@/lib/types"

const REVIEW_INTERVAL_KM = 10000

type VehicleReviewInput = Pick<Vehicle, "km" | "kmUltimaRevisao" | "paraRevisao">

export function getNextReviewKm(kmUltimaRevisao?: number | null): number | null {
  if (typeof kmUltimaRevisao !== "number") return null
  return kmUltimaRevisao + REVIEW_INTERVAL_KM
}

export function isVehicleDueForReview(vehicle: VehicleReviewInput): boolean {
  if (vehicle.paraRevisao) return true

  const nextReviewKm = getNextReviewKm(vehicle.kmUltimaRevisao)
  if (nextReviewKm === null) return false

  return (vehicle.km ?? 0) >= nextReviewKm
}

export function getVehicleReviewMilestone(vehicle: Pick<Vehicle, "km" | "kmUltimaRevisao">) {
  const proximaRevisaoKm = getNextReviewKm(vehicle.kmUltimaRevisao)

  if (proximaRevisaoKm === null) {
    return { proximaRevisaoKm: null, kmRestante: null, emAtraso: false }
  }

  const kmRestante = proximaRevisaoKm - (vehicle.km ?? 0)

  return {
    proximaRevisaoKm,
    kmRestante,
    emAtraso: kmRestante <= 0,
  }
}
function parseReviewSchedule(value?: string | null): Date | null {
  if (!value) return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

/** Ex.: "18/10/2026 às 09:30" (horario local). */
export function formatReviewSchedule(value?: string | null): string | null {
  const date = parseReviewSchedule(value)
  if (!date) return null
  const day = date.toLocaleDateString("pt-BR")
  const time = date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
  return `${day} às ${time}`
}

export function isReviewSchedulePast(value?: string | null, now: Date = new Date()): boolean {
  const date = parseReviewSchedule(value)
  return date !== null && date.getTime() < now.getTime()
}

/** Valor ISO salvo no banco -> valor do input datetime-local ("2026-10-18T09:30"). */
export function toReviewScheduleInputValue(value?: string | null): string {
  const date = parseReviewSchedule(value)
  if (!date) return ""
  const pad = (part: number) => `${part}`.padStart(2, "0")
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

/** Valor do input datetime-local (horario local) -> ISO para o banco. */
export function fromReviewScheduleInputValue(value: string): string | null {
  if (!value.trim()) return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date.toISOString()
}
