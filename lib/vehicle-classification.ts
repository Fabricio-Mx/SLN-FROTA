import type { Vehicle } from "@/lib/types"

export function isAgregadoVehicle(vehicle: Vehicle): boolean {
  return Boolean(
    vehicle.cpfAgregado ||
      vehicle.dataVencimentoCNHAgregado ||
      vehicle.agregadoColaboradorNome ||
      vehicle.agregadoFuncao ||
      vehicle.agregadoContrato ||
      vehicle.agregadoCentroCusto ||
      vehicle.agregadoAnoModelo ||
      vehicle.agregadoDataInicial ||
      vehicle.agregadoDias
  )
}

export function isVisibleInFrotaSection(vehicle: Vehicle): boolean {
  return vehicle.frota || !isAgregadoVehicle(vehicle)
}
