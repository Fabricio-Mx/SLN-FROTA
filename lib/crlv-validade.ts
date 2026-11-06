import type { CrlvAnalise, DriveFile } from "@/lib/types"

export const CRLV_ALERTA_DIAS = 30

const UFS = new Set([
  "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS", "MG", "PA",
  "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC", "SP", "SE", "TO",
])

// Prazo de licenciamento por final de placa: [mês, dia]. Dia 0 = último dia do mês.
type Calendario = Record<number, [number, number]>

const CALENDARIOS: Record<string, Calendario> = {
  SP: { 1: [7, 0], 2: [7, 0], 3: [8, 0], 4: [8, 0], 5: [9, 0], 6: [9, 0], 7: [10, 0], 8: [10, 0], 9: [11, 0], 0: [12, 0] },
  MG: { 1: [8, 0], 2: [8, 0], 3: [8, 0], 4: [9, 0], 5: [9, 0], 6: [9, 0], 7: [10, 0], 8: [10, 0], 9: [10, 0], 0: [10, 0] },
  // Detran-PR publica dias específicos a cada ano; tabela baseada no calendário de 2026.
  PR: { 1: [8, 14], 2: [8, 28], 3: [9, 9], 4: [9, 18], 5: [9, 28], 6: [10, 9], 7: [10, 20], 8: [10, 30], 9: [11, 13], 0: [11, 27] },
}

const CALENDARIO_PADRAO = "SP"

function normalize(value: string): string {
  return (value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
}

export function normalizePlaca(value: string | null | undefined): string {
  return normalize(value ?? "").replace(/[^A-Z0-9]/g, "")
}

export function findCrlvFile(vehicle: { imagens?: DriveFile[]; checklists?: DriveFile[] }): DriveFile | null {
  const matches = [...(vehicle.imagens ?? []), ...(vehicle.checklists ?? [])].filter((file) =>
    normalize(file.name || "").includes("CRLV")
  )
  return matches.length > 0 ? matches[matches.length - 1] : null
}

/** Extrai placa, exercício, UF e data de emissão do texto de um CRLV-e (Senatran). */
export function parseCrlvText(rawText: string): Omit<CrlvAnalise, "analisadoEm"> {
  const text = normalize(rawText).replace(/\s+/g, " ")

  // No CRLV-e os valores vêm na ordem "RENAVAM PLACA EXERCÍCIO ANO_FAB ANO_MOD".
  const placaExercicio = text.match(/\b([A-Z]{3}[0-9][A-Z0-9][0-9]{2})\s+((?:19|20)[0-9]{2})\b/)

  let uf: string | null = null
  let emitidoEm: string | null = null
  for (const match of text.matchAll(/\s([A-Z]{2})\s([0-9]{2})\/([0-9]{2})\/([0-9]{4})\b/g)) {
    if (UFS.has(match[1])) {
      uf = match[1]
      emitidoEm = `${match[4]}-${match[3]}-${match[2]}`
      break
    }
  }

  const exercicio = placaExercicio ? Number(placaExercicio[2]) : null

  return {
    placa: placaExercicio ? placaExercicio[1] : null,
    exercicio,
    uf,
    emitidoEm,
    erro: exercicio ? null : "Não foi possível identificar o exercício no PDF.",
  }
}

export type CrlvStatus = "valido" | "vencendo" | "vencido" | "nao_analisado" | "erro"

export type CrlvValidade = {
  status: CrlvStatus
  exercicio: number | null
  uf: string | null
  validoAte: Date | null
  diasRestantes: number | null
  calendarioUf: string | null
  placaDivergente: boolean
  mensagem: string
}

function prazoLicenciamento(uf: string, finalPlaca: number, ano: number): Date {
  const calendario = CALENDARIOS[uf] ?? CALENDARIOS[CALENDARIO_PADRAO]
  const [mes, dia] = calendario[finalPlaca]
  // new Date(ano, mes, 0) devolve o último dia do mês `mes` (1-based).
  return dia === 0 ? new Date(ano, mes, 0) : new Date(ano, mes - 1, dia)
}

function formatDate(value: Date): string {
  return value.toLocaleDateString("pt-BR")
}

function startOfDay(value: Date): Date {
  return new Date(value.getFullYear(), value.getMonth(), value.getDate())
}

/**
 * O CRLV do exercício X vale até o prazo de licenciamento do ano X+1,
 * conforme o final da placa e o calendário do Detran da UF de registro.
 */
export function getCrlvValidade(
  placaVeiculo: string,
  arquivo: DriveFile | null,
  hoje: Date = new Date()
): CrlvValidade | null {
  if (!arquivo) return null

  const analise = arquivo.crlvAnalise
  const base = {
    exercicio: analise?.exercicio ?? null,
    uf: analise?.uf ?? null,
    validoAte: null,
    diasRestantes: null,
    calendarioUf: null,
    placaDivergente: false,
  }

  if (!analise) {
    return { ...base, status: "nao_analisado", mensagem: "Aguardando análise" }
  }

  if (!analise.exercicio) {
    return { ...base, status: "erro", mensagem: analise.erro || "Não foi possível ler o CRLV." }
  }

  const placa = normalizePlaca(analise.placa) || normalizePlaca(placaVeiculo)
  const finalPlaca = Number(placa.slice(-1))
  if (!Number.isInteger(finalPlaca)) {
    return { ...base, status: "erro", mensagem: "Final da placa inválido." }
  }

  const calendarioUf = analise.uf && CALENDARIOS[analise.uf] ? analise.uf : CALENDARIO_PADRAO
  const validoAte = prazoLicenciamento(calendarioUf, finalPlaca, analise.exercicio + 1)
  const diasRestantes = Math.round((validoAte.getTime() - startOfDay(hoje).getTime()) / 86_400_000)
  const placaDivergente = Boolean(analise.placa) && normalizePlaca(analise.placa) !== normalizePlaca(placaVeiculo)

  const status: CrlvStatus = diasRestantes < 0 ? "vencido" : diasRestantes <= CRLV_ALERTA_DIAS ? "vencendo" : "valido"
  const mensagem =
    status === "vencido"
      ? `Documento vencido em ${formatDate(validoAte)}`
      : status === "vencendo"
        ? `Vence em ${formatDate(validoAte)} (${diasRestantes} dia(s))`
        : `Válido até ${formatDate(validoAte)}`

  return { ...base, status, validoAte, diasRestantes, calendarioUf, placaDivergente, mensagem }
}
