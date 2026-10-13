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
  "03 - RATEIO - ENGENHARIA",
  "54 - OBRA REFORMA E AMPLIAÇÃO UBS TAMOIO - JUNDIAI/SP",
  "62 - OBRA DE ROÇAGEM",
  "63 - PROJETO FACILITIES SP",
  "65 - CONSTRUÇÃO ESCOLA HELENA GALIMBERT - JUNDIAI/SP",
] as const

// O cadastro pode vir sem o codigo numerico (ex.: "CASA CLIENTE GIGA + MA"); estes nomes identificam o codigo.
const KNOWN_COST_CENTER_ALIASES: Record<string, string[]> = {
  "20": ["CASA CLIENTE FRANCA / SP", "CASA CLIENTE POLO SUMICITY - BASE FRANCA / SP", "BASE FRANCA / SP", "FRANCA / SP"],
  "32": ["CASA CLIENTE VIP"],
  "60": ["CASA CLIENTE GIGA+ CE", "CASA CLIENTE CE"],
  "61": ["CASA CLIENTE GIGA+ MA"],
  "67": ["CASA CLIENTE GIGA+ PA"],
}

/** Chave do nome do centro sem codigo, acentos, espacos e pontuacao: "61 - CASA CLIENTE GIGA + MA" -> "CASACLIENTEGIGAMA". */
export function getCostCenterNameKey(centerLabel: string): string {
  return normalizeCostCenterLabel(centerLabel ?? "")
    .replace(/^\d+\s*-\s*/, "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
}

const CODE_BY_NAME_KEY = new Map<string, string>()
for (const label of [...TELECOM_COST_CENTERS, ...ENGINEERING_COST_CENTERS]) {
  const code = extractCenterCode(label)
  const key = getCostCenterNameKey(label)
  if (code && key && !CODE_BY_NAME_KEY.has(key)) CODE_BY_NAME_KEY.set(key, code)
}
for (const [code, aliases] of Object.entries(KNOWN_COST_CENTER_ALIASES)) {
  for (const alias of aliases) CODE_BY_NAME_KEY.set(getCostCenterNameKey(alias), code)
}

const TELECOM_CENTER_KEYS = new Set(TELECOM_COST_CENTERS.map((item) => getCostCenterNameKey(item)))
const ENGINEERING_CENTER_KEYS = new Set(ENGINEERING_COST_CENTERS.map((item) => getCostCenterNameKey(item)))
const TELECOM_CENTER_CODES = new Set(TELECOM_COST_CENTERS.map((item) => extractCenterCode(item)).filter(Boolean))
const ENGINEERING_CENTER_CODES = new Set(ENGINEERING_COST_CENTERS.map((item) => extractCenterCode(item)).filter(Boolean))

function extractCenterCode(centerLabel: string): string {
  const normalized = normalizeCostCenterLabel(centerLabel)
  const match = normalized.match(/^(\d+)\s*-/)
  return match?.[1] ?? ""
}

/** Codigo do centro: o numero do rotulo, ou o codigo conhecido pelo nome quando o cadastro vem sem numero. */
export function resolveKnownCostCenterCode(centerLabel: string): string {
  if (!centerLabel) return ""
  return extractCenterCode(centerLabel) || CODE_BY_NAME_KEY.get(getCostCenterNameKey(centerLabel)) || ""
}

export function isTelecomCostCenter(centerLabel: string): boolean {
  if (!centerLabel) return false

  const normalized = normalizeCostCenterLabel(centerLabel)
  if (!normalized) return false

  const centerCode = resolveKnownCostCenterCode(normalized)
  if (centerCode && TELECOM_CENTER_CODES.has(centerCode)) {
    return true
  }

  return TELECOM_CENTER_KEYS.has(getCostCenterNameKey(normalized)) || TELECOM_CENTER_KEYS.has(getCostCenterBaseKey(normalized))
}

export function isEngineeringCostCenter(centerLabel: string): boolean {
  if (!centerLabel) return false

  const normalized = normalizeCostCenterLabel(centerLabel)
  if (!normalized) return false

  const centerCode = resolveKnownCostCenterCode(normalized)
  if (centerCode && ENGINEERING_CENTER_CODES.has(centerCode)) {
    return true
  }

  return ENGINEERING_CENTER_KEYS.has(getCostCenterNameKey(normalized))
}
