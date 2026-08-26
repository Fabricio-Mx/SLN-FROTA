import { NextResponse } from "next/server"
import * as XLSX from "xlsx"
import { verifySession } from "@/lib/auth"
import { canAddVehicles } from "@/lib/auth-shared"
import { createClient } from "@/lib/supabase/server"

export const runtime = "nodejs"

type ImportedAgregado = {
  colaboradorNome: string
  funcao: string
  contrato: string
  centroCusto: string
  modelo: string
  placa: string
  anoModelo: string
  valorLocacao: number
  dias: number
  observacao: string
}

type ColumnMap = {
  colaborador: number
  funcao: number
  contrato: number
  centroCusto: number
  veiculo: number
  placa: number
  anoModelo: number
  valorLocacao: number
  dias: number
  observacao: number
}

const MONTHS: Record<string, number> = {
  janeiro: 0,
  fevereiro: 1,
  marco: 2,
  abril: 3,
  maio: 4,
  junho: 5,
  julho: 6,
  agosto: 7,
  setembro: 8,
  outubro: 9,
  novembro: 10,
  dezembro: 11,
}

function stripAccents(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "")
}

function normalizeKey(value: string): string {
  return stripAccents(value).toLowerCase().replace(/\s+/g, " ").trim()
}

function toText(value: unknown): string {
  if (typeof value === "string") return value.replace(/\s+/g, " ").trim()
  if (typeof value === "number") return String(value)
  return ""
}

function toNumber(value: unknown): number {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0
  if (typeof value !== "string") return 0

  const normalized = value
    .replace(/[^\d,.-]/g, "")
    .replace(/\.(?=\d{3}(\D|$))/g, "")
    .replace(",", ".")

  const parsed = Number.parseFloat(normalized)
  return Number.isFinite(parsed) ? parsed : 0
}

function normalizePlate(value: string): string {
  return stripAccents(value).toUpperCase().replace(/[^A-Z0-9]/g, "")
}

function detectColumns(row: unknown[]): ColumnMap | null {
  const headers = row.map((cell) => normalizeKey(toText(cell)))
  const find = (predicate: (header: string) => boolean) => headers.findIndex(predicate)

  const colaborador = find((header) => header.includes("colaborador"))
  const placa = find((header) => header === "placa" || header.includes("placa"))

  if (colaborador < 0 || placa < 0) return null

  return {
    colaborador,
    funcao: find((header) => header.includes("funcao")),
    contrato: find((header) => header.includes("contrato")),
    centroCusto: find((header) => header.includes("centro")),
    veiculo: find((header) => header.includes("veiculo")),
    placa,
    anoModelo: find((header) => header.includes("ano")),
    valorLocacao: find((header) => header.includes("locacao")),
    dias: find((header) => header === "dias" || header.includes("dias")),
    observacao: find((header) => header.includes("observacao")),
  }
}

function findCompetencia(rows: unknown[][]): Date | null {
  for (const row of rows) {
    for (const cell of row) {
      const text = normalizeKey(toText(cell))
      if (!text.startsWith("competencia")) continue

      const match = text.match(/([a-z]+)\s*\/\s*(\d{4})/)
      if (!match) continue

      const month = MONTHS[match[1]]
      if (month === undefined) continue

      return new Date(Number(match[2]), month, 1)
    }
  }

  return null
}

function toIsoDate(date: Date): string {
  const year = date.getFullYear()
  const month = `${date.getMonth() + 1}`.padStart(2, "0")
  const day = `${date.getDate()}`.padStart(2, "0")
  return `${year}-${month}-${day}`
}

function parseSpreadsheet(buffer: Buffer): { records: ImportedAgregado[]; competencia: Date | null; skipped: number } {
  const workbook = XLSX.read(buffer, { type: "buffer" })
  const sheetName = workbook.SheetNames[0]
  const sheet = workbook.Sheets[sheetName]

  if (!sheet) {
    return { records: [], competencia: null, skipped: 0 }
  }

  const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, raw: true, defval: null })

  let columns: ColumnMap | null = null
  let headerIndex = -1

  for (let index = 0; index < rows.length; index += 1) {
    const detected = detectColumns(rows[index] ?? [])
    if (detected) {
      columns = detected
      headerIndex = index
      break
    }
  }

  if (!columns) {
    return { records: [], competencia: null, skipped: 0 }
  }

  const readCell = (row: unknown[], index: number): unknown => (index >= 0 ? row[index] : null)
  const deduped = new Map<string, ImportedAgregado>()
  let skipped = 0

  for (const row of rows.slice(headerIndex + 1)) {
    if (!Array.isArray(row)) continue

    const placa = normalizePlate(toText(readCell(row, columns.placa)))
    const colaboradorNome = toText(readCell(row, columns.colaborador))

    if (!placa || placa.length < 6) {
      if (colaboradorNome) skipped += 1
      continue
    }

    deduped.set(placa, {
      colaboradorNome: colaboradorNome.toUpperCase(),
      funcao: toText(readCell(row, columns.funcao)).toUpperCase(),
      contrato: toText(readCell(row, columns.contrato)).toUpperCase(),
      centroCusto: toText(readCell(row, columns.centroCusto)).toUpperCase(),
      modelo: toText(readCell(row, columns.veiculo)).toUpperCase(),
      placa,
      anoModelo: toText(readCell(row, columns.anoModelo)),
      valorLocacao: toNumber(readCell(row, columns.valorLocacao)),
      dias: Math.round(toNumber(readCell(row, columns.dias))) || 30,
      observacao: toText(readCell(row, columns.observacao)),
    })
  }

  return { records: Array.from(deduped.values()), competencia: findCompetencia(rows), skipped }
}

function normalizeName(value: string): string {
  return normalizeKey(value).replace(/[^a-z0-9 ]/g, "").replace(/\s+/g, " ").trim()
}

function isMissingAgregadoColumnError(message: string): boolean {
  const normalized = message.toLowerCase()
  return normalized.includes("agregado_") && (normalized.includes("could not find") || normalized.includes("column"))
}

export async function POST(req: Request) {
  try {
    const session = await verifySession()
    if (!session || !canAddVehicles(session.role)) {
      return NextResponse.json({ error: "Sem permissão" }, { status: 403 })
    }

    const formData = await req.formData()
    const file = formData.get("file") as File | null

    if (!file) {
      return NextResponse.json({ error: "Arquivo não enviado." }, { status: 400 })
    }

    const buffer = Buffer.from(await file.arrayBuffer())
    const { records, competencia, skipped } = parseSpreadsheet(buffer)

    if (records.length === 0) {
      return NextResponse.json(
        {
          error:
            "Nenhum agregado válido encontrado. Confira se a planilha tem as colunas COLABORADOR, PLACA, VEICULO, VALOR LOCAÇÃO e DIAS.",
        },
        { status: 400 }
      )
    }

    const periodStart = competencia ?? new Date(new Date().getFullYear(), new Date().getMonth(), 1)

    const supabase = await createClient()

    const { data: colaboradorRows, error: colaboradoresError } = await supabase
      .from("fleet_colaboradores")
      .select("id, nome")
      .limit(10000)

    if (colaboradoresError) {
      throw new Error(colaboradoresError.message)
    }

    const colaboradorByName = new Map<string, string>()
    for (const row of colaboradorRows ?? []) {
      const key = normalizeName(String(row.nome ?? ""))
      if (key && !colaboradorByName.has(key)) {
        colaboradorByName.set(key, String(row.id))
      }
    }

    const { data: vehicleRows, error: vehiclesError } = await supabase
      .from("fleet_vehicles")
      .select("id, placa")
      .limit(10000)

    if (vehiclesError) {
      throw new Error(vehiclesError.message)
    }

    const vehicleIdByPlate = new Map<string, string>()
    for (const row of vehicleRows ?? []) {
      vehicleIdByPlate.set(normalizePlate(String(row.placa ?? "")), String(row.id))
    }

    let inserted = 0
    let updated = 0
    let linked = 0
    let extendedColumnsSupported = true

    const buildPayload = (record: ImportedAgregado, colaboradorId: string | null, periodEnd: Date) => {
      const base = {
        placa: record.placa,
        chassi: record.anoModelo,
        modelo: record.modelo,
        km: record.dias,
        mensalidade: record.valorLocacao,
        data_vencimento_contrato: toIsoDate(periodEnd),
        tipo_propriedade: "proprio",
        cartao_combustivel: "veloe",
        frota: false,
        na_oficina: false,
        para_revisao: false,
        sem_parar: false,
        tipo_contratacao: record.funcao || null,
        cpf_agregado: record.colaboradorNome || null,
        data_vencimento_cnh_agregado: toIsoDate(periodStart),
        colaborador_id: colaboradorId,
      }

      // Sem as migrations 004/020 o banco só tem as colunas legadas.
      if (!extendedColumnsSupported) {
        return { ...base, empresa_locacao: record.centroCusto || null }
      }

      return {
        ...base,
        agregado_colaborador_nome: record.colaboradorNome || null,
        agregado_funcao: record.funcao || null,
        agregado_contrato: record.contrato || null,
        agregado_centro_custo: record.centroCusto || null,
        agregado_ano_modelo: record.anoModelo || null,
        agregado_data_inicial: toIsoDate(periodStart),
        agregado_dias: record.dias,
        agregado_observacao: record.observacao || null,
      }
    }

    for (const record of records) {
      const periodEnd = new Date(periodStart.getFullYear(), periodStart.getMonth(), periodStart.getDate() + record.dias - 1)
      const colaboradorId = colaboradorByName.get(normalizeName(record.colaboradorNome)) ?? null
      if (colaboradorId) linked += 1

      const existingId = vehicleIdByPlate.get(record.placa)

      const persist = async () => {
        const payload = buildPayload(record, colaboradorId, periodEnd)

        if (existingId) {
          return supabase
            .from("fleet_vehicles")
            .update({ ...payload, updated_at: new Date().toISOString() })
            .eq("id", existingId)
        }

        return supabase.from("fleet_vehicles").insert({ ...payload, imagens: [], checklists: [] })
      }

      let { error } = await persist()

      if (error && extendedColumnsSupported && isMissingAgregadoColumnError(error.message)) {
        extendedColumnsSupported = false
        ;({ error } = await persist())
      }

      if (error) {
        throw new Error(error.message)
      }

      if (existingId) {
        updated += 1
      } else {
        inserted += 1
      }
    }

    return NextResponse.json({
      imported: records.length,
      inserted,
      updated,
      linked,
      skipped,
      legacyMode: !extendedColumnsSupported,
      competencia: toIsoDate(periodStart),
    })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Falha ao importar a planilha de agregados." },
      { status: 500 }
    )
  }
}
