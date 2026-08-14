export type CostCenterRecord = {
  motorista: string
  centroCusto: string
  supervisor: string
  coordenador: string
}

export type CostCenterDataset = {
  updatedAt: string | null
  records: CostCenterRecord[]
}

export type CostCenterLookup = {
  records: CostCenterRecord[]
  exactByDriver: Map<string, CostCenterRecord>
  simplifiedByDriver: Map<string, CostCenterRecord>
}

const NAME_PARTICLES = new Set(["da", "de", "do", "das", "dos", "e"])
const NAME_SUFFIXES = new Set(["junior", "jr", "filho", "neto"])

function normalizeText(value: string): string {
  return value.replace(/\s+/g, " ").trim()
}

export function normalizeCostCenterLabel(value: string): string {
  return normalizeText(value)
    .replace(/\s*-\s*/g, " - ")
    .replace(/\s+/g, " ")
    .trim()
}

export function getCostCenterBaseKey(value: string): string {
  return normalizeCostCenterLabel(value)
    .replace(/^\d+\s*-\s*/g, "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
}

function hasCostCenterCode(value: string): boolean {
  return /^\d+\s*-\s*/.test(normalizeCostCenterLabel(value))
}

export function scoreCostCenterLabel(value: string): number {
  const normalized = normalizeCostCenterLabel(value)
  let score = normalized.length

  if (hasCostCenterCode(normalized)) {
    score += 100
  }

  return score
}

export function preferCostCenterLabel(currentValue: string, nextValue: string): string {
  if (!currentValue) return normalizeCostCenterLabel(nextValue)
  if (!nextValue) return normalizeCostCenterLabel(currentValue)

  const currentLabel = normalizeCostCenterLabel(currentValue)
  const nextLabel = normalizeCostCenterLabel(nextValue)

  return scoreCostCenterLabel(nextLabel) > scoreCostCenterLabel(currentLabel) ? nextLabel : currentLabel
}

function canonicalizeCostCenterLabels(records: CostCenterRecord[]): CostCenterRecord[] {
  const preferredByBaseKey = new Map<string, string>()

  for (const record of records) {
    if (!record.centroCusto) continue

    const baseKey = getCostCenterBaseKey(record.centroCusto)
    const current = preferredByBaseKey.get(baseKey)

    if (!current || scoreCostCenterLabel(record.centroCusto) > scoreCostCenterLabel(current)) {
      preferredByBaseKey.set(baseKey, record.centroCusto)
    }
  }

  return records.map((record) => {
    if (!record.centroCusto) return record

    const canonicalLabel = preferredByBaseKey.get(getCostCenterBaseKey(record.centroCusto))
    if (!canonicalLabel) return record

    return {
      ...record,
      centroCusto: canonicalLabel,
    }
  })
}

export function normalizeCostCenterDriverName(value: string): string {
  return normalizeText(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .toLowerCase()
}

function getRelevantNameTokens(value: string): string[] {
  return normalizeCostCenterDriverName(value)
    .split(" ")
    .filter((token) => token && !NAME_PARTICLES.has(token))
}

function getSimplifiedDriverName(value: string): string {
  return getRelevantNameTokens(value)
    .filter((token) => !NAME_SUFFIXES.has(token))
    .join(" ")
}

function countCommonTokens(left: string[], right: string[]): number {
  const rightSet = new Set(right)
  let common = 0

  for (const token of left) {
    if (rightSet.has(token)) {
      common += 1
    }
  }

  return common
}

function scoreNameMatch(left: string, right: string): number {
  const normalizedLeft = normalizeCostCenterDriverName(left)
  const normalizedRight = normalizeCostCenterDriverName(right)

  if (!normalizedLeft || !normalizedRight) return 0
  if (normalizedLeft === normalizedRight) return 100

  const simplifiedLeft = getSimplifiedDriverName(left)
  const simplifiedRight = getSimplifiedDriverName(right)
  if (simplifiedLeft && simplifiedLeft === simplifiedRight) return 95

  const leftTokens = getRelevantNameTokens(left)
  const rightTokens = getRelevantNameTokens(right)
  if (leftTokens.length === 0 || rightTokens.length === 0) return 0

  const commonTokens = countCommonTokens(leftTokens, rightTokens)
  if (commonTokens === 0) return 0

  const firstTokenMatches = leftTokens[0] === rightTokens[0]
  const lastTokenMatches = leftTokens[leftTokens.length - 1] === rightTokens[rightTokens.length - 1]
  const coverage = commonTokens / Math.max(leftTokens.length, rightTokens.length)

  if (firstTokenMatches && lastTokenMatches && coverage >= 0.5) {
    return 80 + coverage * 10
  }

  if (coverage >= 0.8 && commonTokens >= 2) {
    return 70 + coverage * 10
  }

  if ((simplifiedLeft.includes(simplifiedRight) || simplifiedRight.includes(simplifiedLeft)) && commonTokens >= 2) {
    return 65 + coverage * 10
  }

  return 0
}

function sanitizeCostCenterRecord(record: Partial<CostCenterRecord>): CostCenterRecord {
  return {
    motorista: normalizeText(record.motorista ?? ""),
    centroCusto: normalizeCostCenterLabel(record.centroCusto ?? ""),
    supervisor: normalizeText(record.supervisor ?? ""),
    coordenador: normalizeText(record.coordenador ?? ""),
  }
}

function scoreCostCenterRecord(record: CostCenterRecord): number {
  let score = 0

  if (record.motorista) score += 3
  if (record.centroCusto) score += 2
  if (record.supervisor) score += 1
  if (record.coordenador) score += 1

  return score
}

export function dedupeCostCenterRecords(records: CostCenterRecord[]): CostCenterRecord[] {
  const deduped = new Map<string, CostCenterRecord>()

  for (const rawRecord of records) {
    const record = sanitizeCostCenterRecord(rawRecord)
    const key = normalizeCostCenterDriverName(record.motorista)
    if (!key) continue

    const current = deduped.get(key)
    if (!current) {
      deduped.set(key, record)
      continue
    }

    deduped.set(key, scoreCostCenterRecord(record) >= scoreCostCenterRecord(current) ? record : current)
  }

  return canonicalizeCostCenterLabels(Array.from(deduped.values())).sort((left, right) => left.motorista.localeCompare(right.motorista, "pt-BR"))
}

export function normalizeCostCenterDataset(input: unknown): CostCenterDataset {
  if (Array.isArray(input)) {
    return {
      updatedAt: null,
      records: dedupeCostCenterRecords(input as CostCenterRecord[]),
    }
  }

  if (input && typeof input === "object") {
    const dataset = input as Partial<CostCenterDataset>
    return {
      updatedAt: typeof dataset.updatedAt === "string" ? dataset.updatedAt : null,
      records: dedupeCostCenterRecords(Array.isArray(dataset.records) ? dataset.records : []),
    }
  }

  return {
    updatedAt: null,
    records: [],
  }
}

export function createCostCenterLookup(records: CostCenterRecord[]): CostCenterLookup {
  const exactByDriver = new Map<string, CostCenterRecord>()
  const simplifiedByDriver = new Map<string, CostCenterRecord>()

  for (const record of records) {
    exactByDriver.set(normalizeCostCenterDriverName(record.motorista), record)

    const simplifiedKey = getSimplifiedDriverName(record.motorista)
    if (simplifiedKey && !simplifiedByDriver.has(simplifiedKey)) {
      simplifiedByDriver.set(simplifiedKey, record)
    }
  }

  return {
    records,
    exactByDriver,
    simplifiedByDriver,
  }
}

export function resolveCostCenterRecord(driverName: string, lookup: CostCenterLookup): CostCenterRecord | null {
  const normalizedName = normalizeCostCenterDriverName(driverName)
  if (!normalizedName) return null

  const exactMatch = lookup.exactByDriver.get(normalizedName)
  if (exactMatch) return exactMatch

  const simplifiedName = getSimplifiedDriverName(driverName)
  if (simplifiedName) {
    const simplifiedMatch = lookup.simplifiedByDriver.get(simplifiedName)
    if (simplifiedMatch) return simplifiedMatch
  }

  let bestMatch: CostCenterRecord | null = null
  let bestScore = 0

  for (const record of lookup.records) {
    const score = scoreNameMatch(driverName, record.motorista)
    if (score > bestScore) {
      bestScore = score
      bestMatch = record
    }
  }

  return bestScore >= 75 ? bestMatch : null
}