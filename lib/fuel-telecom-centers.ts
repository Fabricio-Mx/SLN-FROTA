import { getCostCenterBaseKey, normalizeCostCenterLabel } from "@/lib/cost-center-shared"

export const TELECOM_COST_CENTERS = [
  "32 - CASA CLIENTE VIP",
  "20 - CASA CLIENTE POLO SUMICITY - BASE FRANCA / SP",
  "60 - CASA CLIENTE GIGA+ CE",
  "61 - CASA CLIENTE GIGA+ MA",
  "67 - CASA CLIENTE GIGA+ PA",
] as const

export const ENGINEERING_COST_CENTERS = [
  "03 - ENGENHARIA",
  "54 - OBRA REFORMA E AMPLIAÇÃO UBS TAMOIO - JUNDIAI/SP",
  "62 - OBRA DE ROÇAGEM",
  "63 - PROJETO FACILITIES SP",
  "65 - CONSTRUÇÃO ESCOLA HELENA GALIMBERT - JUNDIAI/SP",
] as const

const TELECOM_CENTER_KEYS = new Set(TELECOM_COST_CENTERS.map((item) => getCostCenterBaseKey(item)))
const ENGINEERING_CENTER_KEYS = new Set(ENGINEERING_COST_CENTERS.map((item) => getCostCenterBaseKey(item)))
const TELECOM_CENTER_CODES = new Set(TELECOM_COST_CENTERS.map((item) => extractCenterCode(item)).filter(Boolean))
const ENGINEERING_CENTER_CODES = new Set(ENGINEERING_COST_CENTERS.map((item) => extractCenterCode(item)).filter(Boolean))

function extractCenterCode(centerLabel: string): string {
  const normalized = normalizeCostCenterLabel(centerLabel)
  const match = normalized.match(/^(\d+)\s*-/)
  return match?.[1] ?? ""
}

export function isTelecomCostCenter(centerLabel: string): boolean {
  if (!centerLabel) return false

  const normalized = normalizeCostCenterLabel(centerLabel)
  if (!normalized) return false

  const centerCode = extractCenterCode(normalized)
  if (centerCode && TELECOM_CENTER_CODES.has(centerCode)) {
    return true
  }

  return TELECOM_CENTER_KEYS.has(getCostCenterBaseKey(normalized))
}

export function isEngineeringCostCenter(centerLabel: string): boolean {
  if (!centerLabel) return false

  const normalized = normalizeCostCenterLabel(centerLabel)
  if (!normalized) return false

  const centerCode = extractCenterCode(normalized)
  if (centerCode && ENGINEERING_CENTER_CODES.has(centerCode)) {
    return true
  }

  return ENGINEERING_CENTER_KEYS.has(getCostCenterBaseKey(normalized))
}
