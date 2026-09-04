import type { Colaborador } from "@/lib/types"
import { normalizeCostCenterDriverName } from "@/lib/cost-center-shared"

export type DriverLinkOrigin = "veloe"

export type DriverLink = {
  id: string
  origem: DriverLinkOrigin
  nomeOrigem: string
  nomeNormalizado: string
  cpfOrigem: string
  colaboradorId: string | null
  ignorado: boolean
}

export type DriverSource = {
  nome: string
  cpf: string
  abastecimentos: number
  ultimoAbastecimento: string | null
  placasCartao: string[]
  // Cartao que o motorista mais usa no periodo (desempate pelo abastecimento mais recente).
  placaCartaoPrincipal: string
}

export type DriverMatchStatus = "vinculado" | "agregado" | "sugerido" | "pendente" | "externo" | "ignorado"

export type AgregadoDriver = {
  vehicleId: string
  placa: string
  nome: string
  cpf: string
}

export type DriverMatch = {
  key: string
  source: DriverSource
  status: DriverMatchStatus
  colaborador: Colaborador | null
  agregado: AgregadoDriver | null
  sugestao: Colaborador | null
  sugestaoScore: number
  link: DriverLink | null
}

// Abaixo disso o motorista provavelmente nem esta cadastrado no sistema (terceiro/posto).
export const DRIVER_MATCH_MIN_SCORE = 45
export const DRIVER_MATCH_SUGGESTION_SCORE = 70

const NAME_PARTICLES = new Set(["da", "de", "do", "das", "dos", "e", "di", "du"])
const NAME_SUFFIXES = new Set(["junior", "jr", "filho", "neto", "sobrinho", "segundo"])

export function normalizeDriverKey(value: string): string {
  return normalizeCostCenterDriverName(value ?? "")
}

export function normalizeCpf(value: string): string {
  return (value ?? "").replace(/\D/g, "")
}

function getRelevantTokens(value: string): string[] {
  return normalizeDriverKey(value)
    .split(" ")
    .filter((token) => token && !NAME_PARTICLES.has(token))
}

function getSimplifiedName(value: string): string {
  return getRelevantTokens(value)
    .filter((token) => !NAME_SUFFIXES.has(token))
    .join(" ")
}

// 0 a 100: 100 = nome identico, >= 70 = sugestao confiavel.
export function scoreDriverName(left: string, right: string): number {
  const normalizedLeft = normalizeDriverKey(left)
  const normalizedRight = normalizeDriverKey(right)

  if (!normalizedLeft || !normalizedRight) return 0
  if (normalizedLeft === normalizedRight) return 100

  const simplifiedLeft = getSimplifiedName(left)
  const simplifiedRight = getSimplifiedName(right)
  if (simplifiedLeft && simplifiedLeft === simplifiedRight) return 95

  const leftTokens = getRelevantTokens(left)
  const rightTokens = getRelevantTokens(right)
  if (leftTokens.length === 0 || rightTokens.length === 0) return 0

  const rightSet = new Set(rightTokens)
  const commonTokens = leftTokens.filter((token) => rightSet.has(token)).length
  if (commonTokens === 0) return 0

  const coverage = commonTokens / Math.max(leftTokens.length, rightTokens.length)
  const firstMatches = leftTokens[0] === rightTokens[0]
  const lastMatches = leftTokens[leftTokens.length - 1] === rightTokens[rightTokens.length - 1]

  if (firstMatches && lastMatches && coverage >= 0.5) return Math.round(80 + coverage * 10)
  if (coverage >= 0.8 && commonTokens >= 2) return Math.round(70 + coverage * 10)
  if (firstMatches && commonTokens >= 2) return Math.round(60 + coverage * 10)

  return Math.round(coverage * 50)
}

type FuelLikeRecord = {
  nomeMotorista: string
  cpfMotorista: string
  cardPlate: string
  dateTime: string
  km?: number | null
}

export type OdometerReading = {
  km: number
  dateTime: string
  nomeMotorista: string
  cardPlate: string
}

export function normalizePlate(value: string): string {
  return (value ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "")
}

// Ultima leitura de hodometro por placa de cartao (coluna AO da VELOE).
export function collectOdometerReadings(records: FuelLikeRecord[]): {
  byPlate: Map<string, OdometerReading>
} {
  const byPlate = new Map<string, OdometerReading>()

  for (const record of records) {
    const km = typeof record.km === "number" ? record.km : null
    if (!km || km <= 0 || !record.dateTime) continue

    const key = normalizePlate(record.cardPlate)
    if (!key) continue

    const current = byPlate.get(key)
    if (current && current.dateTime >= record.dateTime) continue

    byPlate.set(key, {
      km,
      dateTime: record.dateTime,
      nomeMotorista: (record.nomeMotorista || "").trim(),
      cardPlate: (record.cardPlate || "").trim(),
    })
  }

  return { byPlate }
}

type AgregadoVehicleLike = {
  id: string
  placa: string
  agregadoColaboradorNome?: string | null
  cpfAgregado?: string | null
}

export function collectAgregadoDrivers(vehicles: AgregadoVehicleLike[]): AgregadoDriver[] {
  return vehicles
    .filter((vehicle) => (vehicle.agregadoColaboradorNome || "").trim())
    .map((vehicle) => ({
      vehicleId: vehicle.id,
      placa: vehicle.placa,
      nome: (vehicle.agregadoColaboradorNome || "").trim(),
      cpf: normalizeCpf(vehicle.cpfAgregado || ""),
    }))
}

export function collectDriverSources(records: FuelLikeRecord[]): DriverSource[] {
  const byKey = new Map<string, DriverSource & { placas: Map<string, { count: number; ultimo: string }> }>()

  for (const record of records) {
    const nome = (record.nomeMotorista || "").trim()
    const key = normalizeDriverKey(nome)
    if (!key) continue

    let current = byKey.get(key)
    if (!current) {
      current = {
        nome,
        cpf: normalizeCpf(record.cpfMotorista),
        abastecimentos: 0,
        ultimoAbastecimento: null,
        placasCartao: [],
        placaCartaoPrincipal: "",
        placas: new Map(),
      }
      byKey.set(key, current)
    }

    current.abastecimentos += 1
    if (!current.cpf) current.cpf = normalizeCpf(record.cpfMotorista)
    if (record.dateTime && (!current.ultimoAbastecimento || record.dateTime > current.ultimoAbastecimento)) {
      current.ultimoAbastecimento = record.dateTime
    }

    const cardPlate = (record.cardPlate || "").trim()
    if (!cardPlate) continue

    const placa = current.placas.get(cardPlate)
    if (!placa) {
      current.placas.set(cardPlate, { count: 1, ultimo: record.dateTime || "" })
      continue
    }

    placa.count += 1
    if (record.dateTime > placa.ultimo) placa.ultimo = record.dateTime
  }

  return Array.from(byKey.values())
    .map(({ placas, ...source }) => {
      const ordenadas = Array.from(placas.entries()).sort((left, right) => {
        if (right[1].count !== left[1].count) return right[1].count - left[1].count
        return right[1].ultimo.localeCompare(left[1].ultimo)
      })

      return {
        ...source,
        placasCartao: ordenadas.map(([placa]) => placa),
        placaCartaoPrincipal: ordenadas[0]?.[0] ?? "",
      }
    })
    .sort((left, right) => left.nome.localeCompare(right.nome, "pt-BR"))
}

type AssignableVehicle = {
  id: string
  colaboradorId?: string | null
}

export function mapDriversToVehicles(matches: DriverMatch[], vehicles: AssignableVehicle[]): Map<string, string> {
  const vehicleByColaboradorId = new Map(
    vehicles.filter((vehicle) => vehicle.colaboradorId).map((vehicle) => [vehicle.colaboradorId as string, vehicle.id]),
  )
  const result = new Map<string, string>()

  for (const match of matches) {
    if (match.agregado) {
      result.set(match.key, match.agregado.vehicleId)
      continue
    }

    if (!match.colaborador) continue
    const vehicleId = vehicleByColaboradorId.get(match.colaborador.id)
    if (vehicleId) result.set(match.key, vehicleId)
  }

  return result
}

export type VehicleCardPlate = {
  cardPlate: string
  motorista: string
}

type CardPlateVehicle = AssignableVehicle & AgregadoVehicleLike

// Cartao de cada veiculo a partir do colaborador vinculado: o cartao segue a pessoa, nao a placa.
export function mapVehicleCardPlates(
  records: FuelLikeRecord[],
  vehicles: CardPlateVehicle[],
  colaboradores: Colaborador[],
  links: DriverLink[],
): Map<string, VehicleCardPlate> {
  const matches = buildDriverMatches(collectDriverSources(records), colaboradores, links, collectAgregadoDrivers(vehicles))
  const vehicleIdByDriverKey = mapDriversToVehicles(matches, vehicles)
  const result = new Map<string, VehicleCardPlate>()

  for (const match of matches) {
    const vehicleId = vehicleIdByDriverKey.get(match.key)
    if (!vehicleId || !match.source.placaCartaoPrincipal) continue
    result.set(vehicleId, { cardPlate: match.source.placaCartaoPrincipal, motorista: match.source.nome })
  }

  return result
}

export function buildDriverMatches(
  sources: DriverSource[],
  colaboradores: Colaborador[],
  links: DriverLink[],
  agregados: AgregadoDriver[] = [],
): DriverMatch[] {
  const linkByKey = new Map(links.map((link) => [link.nomeNormalizado, link]))
  const colaboradorById = new Map(colaboradores.map((colaborador) => [colaborador.id, colaborador]))
  const colaboradorByCpf = new Map(
    colaboradores.filter((colaborador) => normalizeCpf(colaborador.cpf)).map((c) => [normalizeCpf(c.cpf), c]),
  )
  const colaboradorByNome = new Map(colaboradores.map((colaborador) => [normalizeDriverKey(colaborador.nome), colaborador]))
  const agregadoByCpf = new Map(agregados.filter((a) => a.cpf).map((a) => [a.cpf, a]))
  const agregadoByNome = new Map(agregados.map((a) => [normalizeDriverKey(a.nome), a]))

  const empty = { colaborador: null, agregado: null, sugestao: null, sugestaoScore: 0 }

  return sources.map((source) => {
    const key = normalizeDriverKey(source.nome)
    const link = linkByKey.get(key) ?? null

    if (link?.ignorado) {
      return { key, source, status: "ignorado", ...empty, link }
    }

    if (link?.colaboradorId) {
      const colaborador = colaboradorById.get(link.colaboradorId) ?? null
      if (colaborador) {
        return { key, source, status: "vinculado", ...empty, colaborador, sugestaoScore: 100, link }
      }
    }

    const byCpf = source.cpf ? colaboradorByCpf.get(source.cpf) ?? null : null
    if (byCpf) {
      return { key, source, status: "vinculado", ...empty, colaborador: byCpf, sugestaoScore: 100, link }
    }

    const byNome = colaboradorByNome.get(key) ?? null
    if (byNome) {
      return { key, source, status: "vinculado", ...empty, colaborador: byNome, sugestaoScore: 100, link }
    }

    const agregado = (source.cpf ? agregadoByCpf.get(source.cpf) : null) ?? agregadoByNome.get(key) ?? null
    if (agregado) {
      return { key, source, status: "agregado", ...empty, agregado, sugestaoScore: 100, link }
    }

    let sugestao: Colaborador | null = null
    let sugestaoScore = 0

    for (const colaborador of colaboradores) {
      const score = scoreDriverName(source.nome, colaborador.nome)
      if (score > sugestaoScore) {
        sugestaoScore = score
        sugestao = colaborador
      }
    }

    if (sugestao && sugestaoScore >= DRIVER_MATCH_SUGGESTION_SCORE) {
      return { key, source, status: "sugerido", ...empty, sugestao, sugestaoScore, link }
    }

    if (sugestaoScore >= DRIVER_MATCH_MIN_SCORE) {
      return { key, source, status: "pendente", ...empty, sugestao, sugestaoScore, link }
    }

    return { key, source, status: "externo", ...empty, sugestao, sugestaoScore, link }
  })
}
