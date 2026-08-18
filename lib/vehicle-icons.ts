import { Bike, Bus, Car, CarFront, Caravan, Forklift, Truck, type LucideIcon } from "lucide-react"

export type VehicleCategory = "moto" | "bus" | "machine" | "truck" | "van" | "pickup" | "car"

type VehicleVisual = {
  category: VehicleCategory
  icon: LucideIcon
  label: string
  chipClass: string
}

const VISUALS: Record<VehicleCategory, VehicleVisual> = {
  moto: {
    category: "moto",
    icon: Bike,
    label: "Motocicleta",
    chipClass: "border-[#e6d5f5] bg-[#f4ecff] text-[#6d28d9]",
  },
  bus: {
    category: "bus",
    icon: Bus,
    label: "Ônibus",
    chipClass: "border-[#f2ddc0] bg-[#fff3e2] text-[#b45309]",
  },
  machine: {
    category: "machine",
    icon: Forklift,
    label: "Máquina",
    chipClass: "border-[#e4dcc6] bg-[#f8f4e6] text-[#8a6d1f]",
  },
  truck: {
    category: "truck",
    icon: Truck,
    label: "Caminhão",
    chipClass: "border-[#f0d3b6] bg-[#fff1e2] text-[#c2410c]",
  },
  van: {
    category: "van",
    icon: Caravan,
    label: "Furgão / Van",
    chipClass: "border-[#cfe3f7] bg-[#eaf4ff] text-[#1d4ed8]",
  },
  pickup: {
    category: "pickup",
    icon: CarFront,
    label: "Picape",
    chipClass: "border-[#cfe6da] bg-[#e9f7ef] text-[#15803d]",
  },
  car: {
    category: "car",
    icon: Car,
    label: "Automóvel",
    chipClass: "border-[#d8e2ee] bg-[#eef3fa] text-[#334e6b]",
  },
}

const RULES: { category: VehicleCategory; keywords: string[] }[] = [
  {
    category: "moto",
    keywords: ["MOTO", "BIZ", "POP 1", "FACTOR", "XRE", "BROS", "TITAN", "FAN 1", "YBR", "CB 3", "PCX", "NMAX"],
  },
  { category: "bus", keywords: ["ONIBUS", "BUS", "MICRO ONIBUS"] },
  {
    category: "machine",
    keywords: ["EMPILHADEIRA", "RETRO", "ESCAVADEIRA", "TRATOR", "CARREGADEIRA", "MOTONIVELADORA", "GERADOR"],
  },
  {
    category: "truck",
    keywords: [
      "CAMINHAO",
      "TRUCK",
      "VUC",
      "ACCELO",
      "ATEGO",
      "AXOR",
      "CARGO",
      "DELIVERY",
      "WORKER",
      "CONSTELLATION",
      "DAILY",
      "BONGO",
      "HR ",
      "MUNCK",
      "BAU",
      "3/4",
    ],
  },
  {
    category: "van",
    keywords: [
      "FIORINO",
      "KANGOO",
      "DOBLO",
      "PARTNER",
      "BERLINGO",
      "DUCATO",
      "MASTER",
      "SPRINTER",
      "JUMPER",
      "JUMPY",
      "BOXER",
      "EXPERT",
      "SCUDO",
      "TRANSIT",
      "FURGAO",
      "VAN",
      "COMBO",
    ],
  },
  {
    category: "pickup",
    keywords: [
      "SAVEIRO",
      "STRADA",
      "MONTANA",
      "TORO",
      "OROCH",
      "HILUX",
      "S10",
      "S-10",
      "RANGER",
      "AMAROK",
      "FRONTIER",
      "L200",
      "TRITON",
      "COURIER",
      "PICAPE",
      "PICK UP",
      "PICK-UP",
      "RAMPAGE",
      "MAVERICK",
    ],
  },
]

function normalizeModel(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
}

export function getVehicleVisual(modelo: string | null | undefined): VehicleVisual {
  const normalized = normalizeModel(modelo || "")

  for (const rule of RULES) {
    if (rule.keywords.some((keyword) => normalized.includes(keyword))) {
      return VISUALS[rule.category]
    }
  }

  return VISUALS.car
}
