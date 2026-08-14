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