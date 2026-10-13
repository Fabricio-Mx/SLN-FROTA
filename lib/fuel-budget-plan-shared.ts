import {
  createCostCenterLookup,
  normalizeCostCenterDriverName,
  normalizeCostCenterLabel,
  resolveCostCenterRecord,
  type CostCenterLookup,
} from "@/lib/cost-center-shared"
import { parseFuelDateTime } from "@/lib/fuel-datetime"
import { getCostCenterNameKey, resolveKnownCostCenterCode } from "@/lib/fuel-telecom-centers"

export type FuelBudgetGroup = "telecom" | "outros"

export type FuelBudgetCollaborator = {
  id: string
  name: string
  plate: string
  dailyValue: number
  daysPerWeek: number
  active: boolean
}

export type FuelBudgetCenter = {
  centerCode: string
  centerLabel: string
  group: FuelBudgetGroup
  // Usado apenas quando o centro nao tem colaboradores cadastrados.
  manualMonthlyBudget: number
  collaborators: FuelBudgetCollaborator[]
}

export type FuelBudgetPlan = {
  updatedAt: string | null
  centers: FuelBudgetCenter[]
}

export type FuelBudgetRecord = {
  cardPlate: string
  cpfMotorista: string
  nomeMotorista: string
  valor: number
  dateTime: string
}

// Mesma convencao da planilha semanal: mensal = semanal x 4 (semana 4 vai do dia 22 ate o fim do mes).
export const FUEL_BUDGET_WEEKS_PER_MONTH = 4
export const FUEL_BUDGET_DEFAULT_DAYS_PER_WEEK = 6

// Centros sem codigo numerico no cadastro sao identificados pelo nome normalizado (ex.: "n:CASACLIENTEVIP").
const NAME_CENTER_PREFIX = "n:"

// Os codigos sao apenas identificadores internos; o nome exibido vem do cadastro de centro de custo atual.
export const DEFAULT_TELECOM_BUDGET_CENTERS: Array<Pick<FuelBudgetCenter, "centerCode" | "centerLabel">> = [
  { centerCode: "67", centerLabel: "CASA CLIENTE GIGA + PA" },
  { centerCode: "61", centerLabel: "CASA CLIENTE GIGA + MA" },
  { centerCode: "20", centerLabel: "CASA CLIENTE FRANCA / SP" },
  { centerCode: "60", centerLabel: "CASA CLIENTE GIGA + CE" },
]

const DEFAULT_TELECOM_CODES = new Set(DEFAULT_TELECOM_BUDGET_CENTERS.map((center) => center.centerCode))

export function isDefaultTelecomBudgetCenter(centerCode: string): boolean {
  return DEFAULT_TELECOM_CODES.has(normalizeBudgetCenterCode(centerCode))
}

export function normalizeBudgetCenterCode(value: string): string {
  const raw = String(value ?? "").trim()
  if (raw.startsWith(NAME_CENTER_PREFIX)) {
    const key = raw.slice(NAME_CENTER_PREFIX.length).toUpperCase().replace(/[^A-Z0-9]/g, "")
    return key ? `${NAME_CENTER_PREFIX}${key}` : ""
  }

  const digits = raw.replace(/\D+/g, "")
  if (!digits) return ""
  return digits.length === 1 ? `0${digits}` : digits
}

export function isNumericBudgetCenterCode(centerCode: string): boolean {
  return /^\d+$/.test(centerCode)
}

/**
 * Identificador do centro de custo para cruzar cadastro, planilha e plano.
 * Aceita rotulos com ou sem codigo e ignora diferencas de espaco/pontuacao ("GIGA+ MA" = "GIGA + MA").
 */
export function resolveBudgetCenterId(centerLabel: string, planCenters: Array<Pick<FuelBudgetCenter, "centerCode" | "centerLabel">> = []): string {
  const label = normalizeCostCenterLabel(centerLabel ?? "")
  if (!label) return ""

  const knownCode = normalizeBudgetCenterCode(resolveKnownCostCenterCode(label))
  if (knownCode && planCenters.some((center) => center.centerCode === knownCode)) return knownCode

  const nameKey = getCostCenterNameKey(label)
  if (nameKey) {
    const byName = planCenters.find((center) => getCostCenterNameKey(center.centerLabel) === nameKey)
    if (byName) return byName.centerCode
  }

  if (knownCode) return knownCode
  return nameKey ? `${NAME_CENTER_PREFIX}${nameKey}` : ""
}

export function getBudgetCenterShortLabel(centerLabel: string): string {
  const withoutCode = normalizeCostCenterLabel(centerLabel).replace(/^\d+\s*-\s*/, "")
  const simplified = withoutCode
    .replace(/^CASA CLIENTE\s*/i, "")
    .replace(/^POLO SUMICITY\s*-\s*BASE\s*/i, "")
    .replace(/\s*\+\s*/g, "+ ")
    .replace(/\+\s*-\s*/g, "+ ")
    .replace(/\s+/g, " ")
    .trim()

  return simplified || withoutCode || centerLabel
}

export function formatBudgetCenterName(center: { centerLabel: string }): string {
  return normalizeCostCenterLabel(center.centerLabel).replace(/^\d+\s*-\s*/, "") || center.centerLabel
}

/** Nome atual de cada centro do plano segundo o cadastro (o rotulo mais usado entre os colaboradores). */
export function getRegistryLabelsByBudgetCenter(
  registryRecords: Array<{ centroCusto: string }>,
  planCenters: Array<Pick<FuelBudgetCenter, "centerCode" | "centerLabel">>,
): Map<string, string> {
  const counts = new Map<string, Map<string, number>>()

  for (const record of registryRecords) {
    const label = normalizeCostCenterLabel(record.centroCusto ?? "")
    if (!label) continue
    const centerId = resolveBudgetCenterId(label, planCenters)
    if (!centerId) continue
    const labelCounts = counts.get(centerId) ?? new Map<string, number>()
    labelCounts.set(label, (labelCounts.get(label) ?? 0) + 1)
    counts.set(centerId, labelCounts)
  }

  const result = new Map<string, string>()
  for (const [centerId, labelCounts] of counts) {
    const best = Array.from(labelCounts.entries()).sort((left, right) => right[1] - left[1])[0]
    if (best) result.set(centerId, best[0])
  }
  return result
}

function toMoney(value: unknown): number {
  const parsed = typeof value === "number" ? value : Number(value)
  if (!Number.isFinite(parsed) || parsed < 0) return 0
  return Number(parsed.toFixed(2))
}

function toDays(value: unknown): number {
  const parsed = typeof value === "number" ? value : Number(value)
  if (!Number.isFinite(parsed)) return FUEL_BUDGET_DEFAULT_DAYS_PER_WEEK
  return Math.min(7, Math.max(0, Math.round(parsed)))
}

export function normalizeBudgetPlate(value: string): string {
  return String(value ?? "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
}

export function createBudgetCollaboratorId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID()
  }

  return `col-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}

function sanitizeCollaborator(input: Partial<FuelBudgetCollaborator>): FuelBudgetCollaborator | null {
  const name = String(input.name ?? "").replace(/\s+/g, " ").trim()
  if (!name) return null

  return {
    id: String(input.id ?? "").trim() || createBudgetCollaboratorId(),
    name,
    plate: normalizeBudgetPlate(input.plate ?? ""),
    dailyValue: toMoney(input.dailyValue),
    daysPerWeek: toDays(input.daysPerWeek ?? FUEL_BUDGET_DEFAULT_DAYS_PER_WEEK),
    active: input.active !== false,
  }
}

function sanitizeCenter(input: Partial<FuelBudgetCenter>): FuelBudgetCenter | null {
  const centerLabel = normalizeCostCenterLabel(String(input.centerLabel ?? ""))
  const centerCode = normalizeBudgetCenterCode(String(input.centerCode ?? "")) || resolveBudgetCenterId(centerLabel)
  if (!centerCode) return null

  const collaborators = Array.isArray(input.collaborators)
    ? input.collaborators
        .map((item) => sanitizeCollaborator(item))
        .filter((item): item is FuelBudgetCollaborator => item !== null)
    : []

  return {
    centerCode,
    centerLabel: centerLabel || centerCode,
    group: input.group === "outros" ? "outros" : input.group === "telecom" ? "telecom" : isDefaultTelecomBudgetCenter(centerCode) ? "telecom" : "outros",
    manualMonthlyBudget: toMoney(input.manualMonthlyBudget),
    collaborators,
  }
}

function sortCenters(centers: FuelBudgetCenter[]): FuelBudgetCenter[] {
  const defaultOrder = DEFAULT_TELECOM_BUDGET_CENTERS.map((center) => center.centerCode)

  return [...centers].sort((left, right) => {
    if (left.group !== right.group) return left.group === "telecom" ? -1 : 1

    const leftDefault = defaultOrder.indexOf(left.centerCode)
    const rightDefault = defaultOrder.indexOf(right.centerCode)
    if (leftDefault !== -1 || rightDefault !== -1) {
      if (leftDefault === -1) return 1
      if (rightDefault === -1) return -1
      return leftDefault - rightDefault
    }

    if (isNumericBudgetCenterCode(left.centerCode) && isNumericBudgetCenterCode(right.centerCode)) {
      return Number(left.centerCode) - Number(right.centerCode)
    }

    return getBudgetCenterShortLabel(left.centerLabel).localeCompare(getBudgetCenterShortLabel(right.centerLabel), "pt-BR")
  })
}

export function normalizeFuelBudgetPlan(input: unknown): FuelBudgetPlan {
  const candidate = input && typeof input === "object" ? (input as Partial<FuelBudgetPlan>) : {}
  const centers = new Map<string, FuelBudgetCenter>()

  for (const center of DEFAULT_TELECOM_BUDGET_CENTERS) {
    centers.set(center.centerCode, {
      ...center,
      group: "telecom",
      manualMonthlyBudget: 0,
      collaborators: [],
    })
  }

  if (Array.isArray(candidate.centers)) {
    for (const rawCenter of candidate.centers) {
      const center = sanitizeCenter(rawCenter)
      if (!center) continue
      centers.set(center.centerCode, center)
    }
  }

  return {
    updatedAt: typeof candidate.updatedAt === "string" ? candidate.updatedAt : null,
    centers: sortCenters(Array.from(centers.values())),
  }
}

export type FuelBudgetCenterTotals = {
  daily: number
  weekly: number
  monthly: number
  activeCollaborators: number
}

export function getCollaboratorWeeklyBudget(collaborator: FuelBudgetCollaborator): number {
  if (!collaborator.active) return 0
  return collaborator.dailyValue * collaborator.daysPerWeek
}

export function getCollaboratorMonthlyBudget(collaborator: FuelBudgetCollaborator): number {
  return getCollaboratorWeeklyBudget(collaborator) * FUEL_BUDGET_WEEKS_PER_MONTH
}

export function computeCenterBudgetTotals(center: FuelBudgetCenter): FuelBudgetCenterTotals {
  if (center.collaborators.length === 0) {
    const monthly = center.manualMonthlyBudget
    const weekly = monthly / FUEL_BUDGET_WEEKS_PER_MONTH
    return {
      daily: weekly / FUEL_BUDGET_DEFAULT_DAYS_PER_WEEK,
      weekly,
      monthly,
      activeCollaborators: 0,
    }
  }

  let daily = 0
  let weekly = 0
  let activeCollaborators = 0

  for (const collaborator of center.collaborators) {
    if (!collaborator.active) continue
    activeCollaborators += 1
    daily += collaborator.dailyValue
    weekly += getCollaboratorWeeklyBudget(collaborator)
  }

  return {
    daily,
    weekly,
    monthly: weekly * FUEL_BUDGET_WEEKS_PER_MONTH,
    activeCollaborators,
  }
}

export type FuelBudgetWeek = {
  index: number
  label: string
  startDay: number
  endDay: number
}

export function getBudgetMonthWeeks(monthKey: string): FuelBudgetWeek[] {
  const daysInMonth = getDaysInMonth(monthKey)

  return Array.from({ length: FUEL_BUDGET_WEEKS_PER_MONTH }, (_, index) => {
    const startDay = index * 7 + 1
    const endDay = index === FUEL_BUDGET_WEEKS_PER_MONTH - 1 ? daysInMonth : startDay + 6
    return {
      index,
      label: `Semana ${index + 1}`,
      startDay,
      endDay,
    }
  })
}

export function getBudgetWeekIndex(dayOfMonth: number): number {
  return Math.min(FUEL_BUDGET_WEEKS_PER_MONTH - 1, Math.floor((dayOfMonth - 1) / 7))
}

export function getDaysInMonth(monthKey: string): number {
  const [year, month] = monthKey.split("-").map(Number)
  if (!year || !month) return 30
  return new Date(year, month, 0).getDate()
}

export function toBudgetMonthKey(date: Date): string {
  return `${date.getFullYear()}-${`${date.getMonth() + 1}`.padStart(2, "0")}`
}

export type FuelBudgetCollaboratorAnalysis = {
  id: string
  name: string
  plate: string
  dailyValue: number
  daysPerWeek: number
  active: boolean
  weeklyBudget: number
  monthlyBudget: number
  spentMonth: number
  spentByWeek: number[]
  transactions: number
}

export type FuelBudgetUnlistedDriver = {
  name: string
  plate: string
  total: number
  transactions: number
}

export type FuelBudgetCenterAnalysis = {
  centerCode: string
  centerLabel: string
  shortLabel: string
  group: FuelBudgetGroup
  inPlan: boolean
  budgetDaily: number
  budgetWeekly: number
  budgetMonthly: number
  budgetToDate: number
  spentMonth: number
  spentReferenceDay: number
  spentCurrentWeek: number
  spentByWeek: number[]
  projection: number
  projectedBalance: number
  consumedPercent: number
  transactions: number
  collaborators: FuelBudgetCollaboratorAnalysis[]
  unlistedDrivers: FuelBudgetUnlistedDriver[]
}

export type FuelBudgetAnalysis = {
  monthKey: string
  daysInMonth: number
  elapsedDays: number
  referenceDate: Date | null
  currentWeekIndex: number
  weeks: FuelBudgetWeek[]
  centers: FuelBudgetCenterAnalysis[]
}

export type FuelBudgetAnalysisTotals = {
  budgetDaily: number
  budgetWeekly: number
  budgetMonthly: number
  budgetToDate: number
  spentMonth: number
  spentReferenceDay: number
  spentCurrentWeek: number
  projection: number
  projectedBalance: number
  consumedPercent: number
}

const UNASSIGNED_CENTER_CODE = "__sem_centro__"

const NAME_PARTICLES = new Set(["da", "de", "do", "das", "dos", "e"])

function getNameTokens(name: string): string[] {
  return normalizeCostCenterDriverName(name)
    .split(" ")
    .filter((token) => token && !NAME_PARTICLES.has(token))
}

type CollaboratorTokens = { centerCode: string; collaboratorId: string; tokens: string[] }

/** Nome da planilha contido no nome completo do VELOE (ex.: "FRANCISCO IVO BEZERRA" em "FRANCISCO IVO BEZERRA DOS SANTOS"). */
function findCollaboratorByNameTokens(
  driverName: string,
  collaborators: CollaboratorTokens[],
  isAllowed: (match: { centerCode: string }) => boolean,
): { centerCode: string; collaboratorId: string } | undefined {
  const driverTokens = getNameTokens(driverName)
  if (driverTokens.length < 2) return undefined
  const driverSet = new Set(driverTokens)

  const matches = collaborators.filter(
    (item) =>
      item.tokens.length >= 2 &&
      item.tokens[0] === driverTokens[0] &&
      item.tokens.every((token) => driverSet.has(token)) &&
      isAllowed(item),
  )

  return matches.length === 1 ? matches[0] : undefined
}

function normalizeDriverDisplayName(name: string, cpf: string): string {
  const trimmed = name.replace(/\s+/g, " ").trim()
  if (trimmed && !trimmed.toLowerCase().includes("veiculo sem motorista")) return trimmed
  if (cpf.trim()) return `CPF ${cpf.trim()}`
  return "Não identificado"
}

type MutableCenter = FuelBudgetCenterAnalysis & {
  collaboratorIndex: Map<string, FuelBudgetCollaboratorAnalysis>
  unlistedIndex: Map<string, FuelBudgetUnlistedDriver>
}

function createMutableCenter(
  center: Pick<FuelBudgetCenter, "centerCode" | "centerLabel" | "group">,
  inPlan: boolean,
  totals: FuelBudgetCenterTotals,
  collaborators: FuelBudgetCollaboratorAnalysis[],
): MutableCenter {
  return {
    centerCode: center.centerCode,
    centerLabel: center.centerLabel,
    shortLabel: center.centerCode === UNASSIGNED_CENTER_CODE ? center.centerLabel : getBudgetCenterShortLabel(center.centerLabel),
    group: center.group,
    inPlan,
    budgetDaily: totals.daily,
    budgetWeekly: totals.weekly,
    budgetMonthly: totals.monthly,
    budgetToDate: 0,
    spentMonth: 0,
    spentReferenceDay: 0,
    spentCurrentWeek: 0,
    spentByWeek: Array.from({ length: FUEL_BUDGET_WEEKS_PER_MONTH }, () => 0),
    projection: 0,
    projectedBalance: 0,
    consumedPercent: 0,
    transactions: 0,
    collaborators,
    unlistedDrivers: [],
    collaboratorIndex: new Map(collaborators.map((item) => [item.id, item])),
    unlistedIndex: new Map(),
  }
}

/**
 * Cruza os abastecimentos do mes com o plano de orcamento.
 * O centro de cada abastecimento vem do cadastro de centro de custo (mesma regra do relatorio consolidado);
 * o plano so identifica o colaborador (nome > placa > nome parcial) dentro desse mesmo centro.
 */
export function buildFuelBudgetAnalysis(params: {
  plan: FuelBudgetPlan
  records: FuelBudgetRecord[]
  costCenterLookup: CostCenterLookup
  monthKey: string
  today?: Date
}): FuelBudgetAnalysis {
  const { plan, records, costCenterLookup, monthKey } = params
  const today = params.today ?? new Date()
  const daysInMonth = getDaysInMonth(monthKey)
  const weeks = getBudgetMonthWeeks(monthKey)

  const centers = new Map<string, MutableCenter>()
  const registryLabels = getRegistryLabelsByBudgetCenter(costCenterLookup.records, plan.centers)
  const planCollaboratorLookupRecords: Array<{ motorista: string; centroCusto: string; supervisor: string; coordenador: string }> = []
  const collaboratorByLookupKey = new Map<string, { centerCode: string; collaboratorId: string }>()
  const collaboratorByPlate = new Map<string, { centerCode: string; collaboratorId: string }>()

  for (const center of plan.centers) {
    const collaborators = center.collaborators.map<FuelBudgetCollaboratorAnalysis>((collaborator) => ({
      id: collaborator.id,
      name: collaborator.name,
      plate: collaborator.plate,
      dailyValue: collaborator.dailyValue,
      daysPerWeek: collaborator.daysPerWeek,
      active: collaborator.active,
      weeklyBudget: getCollaboratorWeeklyBudget(collaborator),
      monthlyBudget: getCollaboratorMonthlyBudget(collaborator),
      spentMonth: 0,
      spentByWeek: Array.from({ length: FUEL_BUDGET_WEEKS_PER_MONTH }, () => 0),
      transactions: 0,
    }))

    const currentLabel = registryLabels.get(center.centerCode) ?? center.centerLabel
    centers.set(
      center.centerCode,
      createMutableCenter({ ...center, centerLabel: currentLabel }, true, computeCenterBudgetTotals(center), collaborators),
    )

    for (const collaborator of center.collaborators) {
      const lookupKey = `${center.centerCode}::${collaborator.id}`
      planCollaboratorLookupRecords.push({ motorista: collaborator.name, centroCusto: lookupKey, supervisor: "", coordenador: "" })
      collaboratorByLookupKey.set(lookupKey, { centerCode: center.centerCode, collaboratorId: collaborator.id })

      if (collaborator.plate && !collaboratorByPlate.has(collaborator.plate)) {
        collaboratorByPlate.set(collaborator.plate, { centerCode: center.centerCode, collaboratorId: collaborator.id })
      }
    }
  }

  const planLookup = createCostCenterLookup(planCollaboratorLookupRecords)
  const collaboratorTokens = plan.centers.flatMap((center) =>
    center.collaborators.map((collaborator) => ({
      centerCode: center.centerCode,
      collaboratorId: collaborator.id,
      tokens: getNameTokens(collaborator.name),
    })),
  )
  const resolvedByDriver = new Map<string, { centerCode: string; centerLabel: string; collaboratorId: string | null }>()

  // Rotulos do cadastro que so sao alias de um centro do plano (ex.: "FRANCA / SP") ficam separados, como no relatorio.
  const resolveRegistryCenterCode = (registryLabel: string): string => {
    const nameKey = getCostCenterNameKey(registryLabel)
    const planCode = resolveBudgetCenterId(registryLabel, plan.centers)
    const planCenter = planCode ? centers.get(planCode) : undefined
    if (planCenter?.inPlan && getCostCenterNameKey(planCenter.centerLabel) === nameKey) return planCode
    return nameKey ? `${NAME_CENTER_PREFIX}${nameKey}` : planCode
  }

  const monthRecords = records
    .map((record) => ({ record, date: parseFuelDateTime(record.dateTime) }))
    .filter((item) => !Number.isNaN(item.date.getTime()) && toBudgetMonthKey(item.date) === monthKey)

  let latestDay = 0
  for (const item of monthRecords) {
    latestDay = Math.max(latestDay, item.date.getDate())
  }

  const isPastMonth = monthKey < toBudgetMonthKey(today)
  const elapsedDays = monthRecords.length === 0 ? 0 : isPastMonth ? daysInMonth : Math.min(daysInMonth, Math.max(1, latestDay))
  const referenceDay = isPastMonth ? latestDay || daysInMonth : latestDay
  const [refYear, refMonth] = monthKey.split("-").map(Number)
  const referenceDate = referenceDay > 0 ? new Date(refYear, refMonth - 1, referenceDay) : null
  const currentWeekIndex = referenceDay > 0 ? getBudgetWeekIndex(referenceDay) : 0

  for (const { record, date } of monthRecords) {
    const driverName = normalizeDriverDisplayName(record.nomeMotorista, record.cpfMotorista)
    const plate = normalizeBudgetPlate(record.cardPlate)
    const cacheKey = `${record.nomeMotorista}|${driverName.toLowerCase()}|${plate}`
    let resolved = resolvedByDriver.get(cacheKey)

    if (!resolved) {
      const registry = resolveCostCenterRecord(record.nomeMotorista, costCenterLookup)
      const registryLabel = registry?.centroCusto ? normalizeCostCenterLabel(registry.centroCusto) : ""
      const registryCenterCode = registryLabel ? resolveRegistryCenterCode(registryLabel) : ""
      const isConsistent = (match: { centerCode: string }) => Boolean(registryCenterCode) && match.centerCode === registryCenterCode
      const planMatch = registryCenterCode ? resolveCostCenterRecord(driverName, planLookup) : null
      const nameCandidate = planMatch ? collaboratorByLookupKey.get(planMatch.centroCusto) : undefined
      const byName = nameCandidate && isConsistent(nameCandidate) ? nameCandidate : undefined
      const plateCandidate = !byName && plate ? collaboratorByPlate.get(plate) : undefined
      const byPlate = plateCandidate && isConsistent(plateCandidate) ? plateCandidate : undefined
      const byPartialName = !byName && !byPlate ? findCollaboratorByNameTokens(driverName, collaboratorTokens, isConsistent) : undefined
      const collaboratorMatch = byName ?? byPlate ?? byPartialName

      if (collaboratorMatch) {
        resolved = {
          centerCode: collaboratorMatch.centerCode,
          centerLabel: centers.get(collaboratorMatch.centerCode)?.centerLabel ?? collaboratorMatch.centerCode,
          collaboratorId: collaboratorMatch.collaboratorId,
        }
      } else {
        resolved = registryCenterCode
          ? { centerCode: registryCenterCode, centerLabel: registryLabel, collaboratorId: null }
          : { centerCode: UNASSIGNED_CENTER_CODE, centerLabel: "Sem centro de custo", collaboratorId: null }
      }

      resolvedByDriver.set(cacheKey, resolved)
    }

    let center = centers.get(resolved.centerCode)
    if (!center) {
      center = createMutableCenter(
        { centerCode: resolved.centerCode, centerLabel: resolved.centerLabel, group: "outros" },
        false,
        { daily: 0, weekly: 0, monthly: 0, activeCollaborators: 0 },
        [],
      )
      centers.set(resolved.centerCode, center)
    }

    const day = date.getDate()
    const weekIndex = getBudgetWeekIndex(day)
    center.spentMonth += record.valor
    center.spentByWeek[weekIndex] += record.valor
    center.transactions += 1
    if (day === referenceDay) center.spentReferenceDay += record.valor
    if (weekIndex === currentWeekIndex) center.spentCurrentWeek += record.valor

    const collaborator = resolved.collaboratorId ? center.collaboratorIndex.get(resolved.collaboratorId) : undefined
    if (collaborator) {
      collaborator.spentMonth += record.valor
      collaborator.spentByWeek[weekIndex] += record.valor
      collaborator.transactions += 1
    } else {
      const unlistedKey = driverName.toLowerCase()
      const current = center.unlistedIndex.get(unlistedKey)
      if (current) {
        current.total += record.valor
        current.transactions += 1
        if (!current.plate && plate) current.plate = plate
      } else {
        center.unlistedIndex.set(unlistedKey, { name: driverName, plate, total: record.valor, transactions: 1 })
      }
    }
  }

  const result: FuelBudgetCenterAnalysis[] = []
  for (const center of centers.values()) {
    const { unlistedIndex, ...withoutUnlisted } = center
    const rest: Omit<MutableCenter, "collaboratorIndex" | "unlistedIndex"> & { collaboratorIndex?: unknown } = withoutUnlisted
    delete rest.collaboratorIndex
    const budgetToDate = daysInMonth > 0 ? (rest.budgetMonthly * elapsedDays) / daysInMonth : 0
    const projection = elapsedDays > 0 ? (rest.spentMonth / elapsedDays) * daysInMonth : 0

    result.push({
      ...rest,
      budgetToDate,
      projection,
      projectedBalance: rest.budgetMonthly - projection,
      consumedPercent: rest.budgetMonthly > 0 ? (rest.spentMonth / rest.budgetMonthly) * 100 : 0,
      unlistedDrivers: Array.from(unlistedIndex.values()).sort((left, right) => right.total - left.total),
    })
  }

  const order = new Map(plan.centers.map((center, index) => [center.centerCode, index]))
  result.sort((left, right) => {
    const leftOrder = order.get(left.centerCode)
    const rightOrder = order.get(right.centerCode)
    if (leftOrder !== undefined && rightOrder !== undefined) return leftOrder - rightOrder
    if (leftOrder !== undefined) return -1
    if (rightOrder !== undefined) return 1
    if (left.centerCode === UNASSIGNED_CENTER_CODE) return 1
    if (right.centerCode === UNASSIGNED_CENTER_CODE) return -1
    return right.spentMonth - left.spentMonth
  })

  return {
    monthKey,
    daysInMonth,
    elapsedDays,
    referenceDate,
    currentWeekIndex,
    weeks,
    centers: result,
  }
}

export function sumFuelBudgetCenters(centers: FuelBudgetCenterAnalysis[]): FuelBudgetAnalysisTotals {
  const totals = centers.reduce(
    (acc, center) => {
      acc.budgetDaily += center.budgetDaily
      acc.budgetWeekly += center.budgetWeekly
      acc.budgetMonthly += center.budgetMonthly
      acc.budgetToDate += center.budgetToDate
      acc.spentMonth += center.spentMonth
      acc.spentReferenceDay += center.spentReferenceDay
      acc.spentCurrentWeek += center.spentCurrentWeek
      acc.projection += center.projection
      return acc
    },
    {
      budgetDaily: 0,
      budgetWeekly: 0,
      budgetMonthly: 0,
      budgetToDate: 0,
      spentMonth: 0,
      spentReferenceDay: 0,
      spentCurrentWeek: 0,
      projection: 0,
      projectedBalance: 0,
      consumedPercent: 0,
    },
  )

  totals.projectedBalance = totals.budgetMonthly - totals.projection
  totals.consumedPercent = totals.budgetMonthly > 0 ? (totals.spentMonth / totals.budgetMonthly) * 100 : 0
  return totals
}

export type FuelBudgetStatus = "sem-orcamento" | "ok" | "atencao" | "estouro"

export function getFuelBudgetStatus(budgetMonthly: number, projection: number): FuelBudgetStatus {
  if (budgetMonthly <= 0) return "sem-orcamento"
  const ratio = projection / budgetMonthly
  if (ratio > 1) return "estouro"
  if (ratio > 0.9) return "atencao"
  return "ok"
}

export const FUEL_BUDGET_STATUS_LABEL: Record<FuelBudgetStatus, string> = {
  "sem-orcamento": "Sem orçamento",
  ok: "Dentro do orçado",
  atencao: "Atenção",
  estouro: "Estouro previsto",
}
