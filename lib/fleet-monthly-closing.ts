import type { Colaborador, Vehicle } from "@/lib/types"
import { getCostCenterBaseKey, normalizeCostCenterLabel, scoreCostCenterLabel } from "@/lib/cost-center-shared"
import { isAgregadoVehicle } from "@/lib/vehicle-classification"
import {
  buildDriverMatches,
  collectAgregadoDrivers,
  collectDriverSources,
  mapDriversToVehicles,
  normalizeDriverKey,
  normalizePlate,
  type DriverLink,
} from "@/lib/driver-links-shared"

export type ClosingCategory = "alugado" | "proprio" | "agregado"

export type ClosingFuelRecord = {
  cardPlate: string
  cpfMotorista: string
  nomeMotorista: string
  valor: number
  dateTime: string
}

export type ClosingVehicleRow = {
  vehicleId: string
  categoria: ClosingCategory
  placa: string
  locadora: string
  modelo: string
  valorAluguel: number
  condutor: string
  centroCusto: string
  combustivel: number
  abastecimentos: number
  semParar: number
}

export type ClosingUnlinkedFuelRow = {
  motorista: string
  placasCartao: string
  abastecimentos: number
  valor: number
}

export type MonthlyClosingData = {
  rows: ClosingVehicleRow[]
  unlinkedFuel: ClosingUnlinkedFuelRow[]
  totalFuelMonth: number
  totalFuelLinked: number
  totalFuelUnlinked: number
}

const AGREGADO_CYCLE_DAYS = 30

const CATEGORY_ORDER: Record<ClosingCategory, number> = { alugado: 0, proprio: 1, agregado: 2 }

export const CLOSING_CATEGORY_LABEL: Record<ClosingCategory, string> = {
  alugado: "ALUGADOS",
  proprio: "PRÓPRIOS",
  agregado: "AGREGADOS",
}

const LOCADORA_LABELS: Record<string, string> = {
  localiza: "LOCALIZA",
  lok_motors: "LOK MOTORS",
  movida: "4LOC",
  "4loc": "4LOC",
  veiculo_sln: "VEÍCULO SLN",
}

const FORNECEDOR_PROPRIO_LABELS: Record<string, string> = {
  veiculo_sln: "VEÍCULO PRÓPRIO SLN",
  bradesco_financiamento: "BRADESCO FINANCIAMENTO",
  banco_pan: "BANCO PAN S.A.",
  banco_volkswagen: "BANCO VOLKSWAGEN S.A.",
  sisprime_cdc: "SISPRIME DO BRASIL - CDC",
}

function cleanText(value: string | null | undefined): string {
  return (value ?? "").replace(/\s+/g, " ").trim()
}

function roundCurrency(value: number): number {
  return Math.round(value * 100) / 100
}

function getCategory(vehicle: Vehicle): ClosingCategory {
  if (isAgregadoVehicle(vehicle)) return "agregado"
  return vehicle.tipoPropriedade === "alugado" ? "alugado" : "proprio"
}

function getLocadora(vehicle: Vehicle, categoria: ClosingCategory): string {
  if (categoria === "agregado") return "VEÍCULOS AGREGADOS"
  if (categoria === "alugado") {
    const key = cleanText(vehicle.empresaLocacao)
    return key ? LOCADORA_LABELS[key] ?? key.toUpperCase() : "LOCADORA NÃO INFORMADA"
  }
  const key = cleanText(vehicle.fornecedorProprio) || "veiculo_sln"
  return FORNECEDOR_PROPRIO_LABELS[key] ?? key.toUpperCase()
}

// Mesmo cálculo do card "Valor a Pagar Agregados": valor/dia x dias do ciclo.
function getValorAluguel(vehicle: Vehicle, categoria: ClosingCategory): number {
  const mensalidade = Number(vehicle.mensalidade) || 0
  if (categoria !== "agregado") return roundCurrency(mensalidade)

  const dias = vehicle.agregadoDias && vehicle.agregadoDias > 0 ? vehicle.agregadoDias : AGREGADO_CYCLE_DAYS
  return roundCurrency((mensalidade / AGREGADO_CYCLE_DAYS) * dias)
}

function getCondutor(vehicle: Vehicle, colaborador: Colaborador | undefined, categoria: ClosingCategory): string {
  const nome = cleanText(categoria === "agregado" ? vehicle.agregadoColaboradorNome || colaborador?.nome : colaborador?.nome)
  if (!nome) return vehicle.naOficina ? "OFICINA" : "SEM CONDUTOR"
  return vehicle.naOficina ? `${nome.toUpperCase()} (OFICINA)` : nome.toUpperCase()
}

function getCentroCusto(vehicle: Vehicle, colaborador: Colaborador | undefined, categoria: ClosingCategory): string {
  const centro = cleanText(categoria === "agregado" ? vehicle.agregadoCentroCusto || colaborador?.centroCusto : colaborador?.centroCusto)
  return centro ? normalizeCostCenterLabel(centro).toUpperCase() : "SEM CENTRO DE CUSTO"
}

export function isVehicleInMonthlyClosing(vehicle: Vehicle): boolean {
  return vehicle.frota || isAgregadoVehicle(vehicle)
}

// Unifica variações do mesmo centro ("CASA CLIENTE GIGA + PA" x "67 - CASA CLIENTE GIGA+ PA"), preferindo a versão com código.
function canonicalizeCostCenters(rows: ClosingVehicleRow[]) {
  const keyOf = (label: string) => getCostCenterBaseKey(label).replace(/\s+/g, "")
  const preferred = new Map<string, string>()

  for (const row of rows) {
    if (row.centroCusto === "SEM CENTRO DE CUSTO") continue
    const key = keyOf(row.centroCusto)
    const current = preferred.get(key)
    if (!current || scoreCostCenterLabel(row.centroCusto) > scoreCostCenterLabel(current)) preferred.set(key, row.centroCusto)
  }

  for (const row of rows) {
    if (row.centroCusto === "SEM CENTRO DE CUSTO") continue
    row.centroCusto = preferred.get(keyOf(row.centroCusto)) ?? row.centroCusto
  }
}

export function buildMonthlyClosing(input: {
  vehicles: Vehicle[]
  colaboradores: Colaborador[]
  links: DriverLink[]
  records: ClosingFuelRecord[]
}): MonthlyClosingData {
  const vehicles = input.vehicles.filter(isVehicleInMonthlyClosing)
  const colaboradoresById = new Map(input.colaboradores.map((colaborador) => [colaborador.id, colaborador]))

  // O combustível segue o condutor (como no fechamento manual); sem condutor com veículo, vale a placa do cartão.
  const matches = buildDriverMatches(
    collectDriverSources(input.records),
    input.colaboradores,
    input.links,
    collectAgregadoDrivers(vehicles),
  )
  const vehicleIdByDriverKey = mapDriversToVehicles(matches, vehicles)

  const vehicleIdByCardPlate = new Map<string, string>()
  for (const vehicle of vehicles) {
    const cardPlate = normalizePlate(vehicle.placaCartaoCombustivel ?? "")
    if (cardPlate && !vehicleIdByCardPlate.has(cardPlate)) vehicleIdByCardPlate.set(cardPlate, vehicle.id)
  }
  for (const vehicle of vehicles) {
    const plate = normalizePlate(vehicle.placa)
    if (plate && !vehicleIdByCardPlate.has(plate)) vehicleIdByCardPlate.set(plate, vehicle.id)
  }

  const fuelByVehicle = new Map<string, { valor: number; abastecimentos: number }>()
  const unlinkedByDriver = new Map<string, { motorista: string; placas: Set<string>; abastecimentos: number; valor: number }>()
  let totalFuelMonth = 0

  for (const record of input.records) {
    const valor = Number(record.valor) || 0
    totalFuelMonth += valor

    const driverKey = normalizeDriverKey(record.nomeMotorista)
    const vehicleId = vehicleIdByDriverKey.get(driverKey) ?? vehicleIdByCardPlate.get(normalizePlate(record.cardPlate))

    if (vehicleId) {
      const current = fuelByVehicle.get(vehicleId) ?? { valor: 0, abastecimentos: 0 }
      current.valor += valor
      current.abastecimentos += 1
      fuelByVehicle.set(vehicleId, current)
      continue
    }

    const unlinkedKey = driverKey || `cartao:${normalizePlate(record.cardPlate)}`
    const current = unlinkedByDriver.get(unlinkedKey) ?? {
      motorista: cleanText(record.nomeMotorista).toUpperCase() || "MOTORISTA NÃO INFORMADO",
      placas: new Set<string>(),
      abastecimentos: 0,
      valor: 0,
    }
    if (record.cardPlate?.trim()) current.placas.add(record.cardPlate.trim().toUpperCase())
    current.abastecimentos += 1
    current.valor += valor
    unlinkedByDriver.set(unlinkedKey, current)
  }

  const rows = vehicles
    .map<ClosingVehicleRow>((vehicle) => {
      const categoria = getCategory(vehicle)
      const colaborador = vehicle.colaboradorId ? colaboradoresById.get(vehicle.colaboradorId) : undefined
      const fuel = fuelByVehicle.get(vehicle.id)

      return {
        vehicleId: vehicle.id,
        categoria,
        placa: cleanText(vehicle.placa).toUpperCase(),
        locadora: getLocadora(vehicle, categoria),
        modelo: cleanText(vehicle.modelo).toUpperCase(),
        valorAluguel: getValorAluguel(vehicle, categoria),
        condutor: getCondutor(vehicle, colaborador, categoria),
        centroCusto: getCentroCusto(vehicle, colaborador, categoria),
        combustivel: roundCurrency(fuel?.valor ?? 0),
        abastecimentos: fuel?.abastecimentos ?? 0,
        semParar: 0,
      }
    })
    .sort(
      (left, right) =>
        CATEGORY_ORDER[left.categoria] - CATEGORY_ORDER[right.categoria] ||
        left.locadora.localeCompare(right.locadora, "pt-BR") ||
        left.modelo.localeCompare(right.modelo, "pt-BR") ||
        left.placa.localeCompare(right.placa, "pt-BR"),
    )

  canonicalizeCostCenters(rows)

  const unlinkedFuel = Array.from(unlinkedByDriver.values())
    .filter((item) => Math.abs(item.valor) >= 0.005)
    .map((item) => ({
      motorista: item.motorista,
      placasCartao: Array.from(item.placas).join(", ") || "-",
      abastecimentos: item.abastecimentos,
      valor: roundCurrency(item.valor),
    }))
    .sort((left, right) => right.valor - left.valor)

  const totalFuelLinked = roundCurrency(rows.reduce((sum, row) => sum + row.combustivel, 0))
  const totalFuelUnlinked = roundCurrency(unlinkedFuel.reduce((sum, row) => sum + row.valor, 0))

  return {
    rows,
    unlinkedFuel,
    totalFuelMonth: roundCurrency(totalFuelMonth),
    totalFuelLinked,
    totalFuelUnlinked,
  }
}
