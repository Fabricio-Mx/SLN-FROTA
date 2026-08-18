import { NextResponse } from "next/server"
import * as XLSX from "xlsx"
import { verifySession } from "@/lib/auth"
import { createClient } from "@/lib/supabase/server"

export const runtime = "nodejs"

const INSERT_CHUNK_SIZE = 200
const UPDATE_CHUNK_SIZE = 25

type ImportedColaborador = {
  tipo: string
  segmento: string
  nome: string
  documento: string
  documentoDigits: string
  centroCusto: string
}

type ExistingColaborador = {
  id: string
  nome: string
  cpf: string | null
}

type ColumnMap = {
  tipo: number
  segmento: number
  nome: number
  documento: number
  centroCusto: number
}

const DEFAULT_COLUMNS: ColumnMap = { tipo: 0, segmento: 1, nome: 2, documento: 3, centroCusto: 4 }

function normalizeCellValue(value: unknown): string {
  if (typeof value === "string") return value.replace(/\s+/g, " ").trim()
  if (typeof value === "number") return String(value).trim()
  return ""
}

function stripAccents(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "")
}

function normalizeKey(value: string): string {
  return stripAccents(value).toLowerCase().replace(/\s+/g, " ").trim()
}

function normalizeName(value: string): string {
  return normalizeKey(value)
    .replace(/[^a-z0-9 ]/g, "")
    .replace(/\s+/g, " ")
    .trim()
}

function formatDocument(value: string): { documento: string; digits: string } {
  const digits = value.replace(/\D/g, "")

  if (digits.length === 11) {
    return { documento: digits.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4"), digits }
  }

  if (digits.length === 14) {
    return { documento: digits.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5"), digits }
  }

  return { documento: value.trim(), digits }
}

function detectColumns(row: unknown[]): ColumnMap | null {
  const headers = row.map((cell) => normalizeKey(normalizeCellValue(cell)))
  const findIndex = (predicate: (header: string) => boolean) => headers.findIndex(predicate)

  const documento = findIndex((header) => header.includes("cpf") || header.includes("cnpj"))
  const nome = findIndex(
    (header) =>
      header.includes("cliente") || header.includes("fornecedor") || header === "nome" || header.includes("colaborador")
  )
  const centroCusto = findIndex((header) => header.includes("centro"))

  if (documento < 0 || nome < 0 || centroCusto < 0) {
    return null
  }

  const tipo = findIndex((header) => header.startsWith("tipo"))
  const segmento = findIndex((header) => header.includes("segmento"))

  return {
    tipo: tipo < 0 ? DEFAULT_COLUMNS.tipo : tipo,
    segmento: segmento < 0 ? DEFAULT_COLUMNS.segmento : segmento,
    nome,
    documento,
    centroCusto,
  }
}

function parseSpreadsheet(buffer: Buffer): {
  records: ImportedColaborador[]
  skipped: number
  duplicates: number
} {
  const workbook = XLSX.read(buffer, { type: "buffer", raw: false })
  const firstSheetName = workbook.SheetNames[0]

  if (!firstSheetName) {
    return { records: [], skipped: 0, duplicates: 0 }
  }

  const sheet = workbook.Sheets[firstSheetName]
  const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, raw: false, defval: "" })

  let columns = DEFAULT_COLUMNS
  let startIndex = 0

  // O cabeçalho pode não estar na primeira linha da planilha.
  for (let index = 0; index < Math.min(rows.length, 10); index += 1) {
    const detected = detectColumns(rows[index] ?? [])
    if (detected) {
      columns = detected
      startIndex = index + 1
      break
    }
  }

  const deduped = new Map<string, ImportedColaborador>()
  let skipped = 0
  let duplicates = 0

  for (let index = startIndex; index < rows.length; index += 1) {
    const row = rows[index] ?? []
    const tipo = normalizeCellValue(row[columns.tipo])
    const segmento = normalizeCellValue(row[columns.segmento])
    const nome = normalizeCellValue(row[columns.nome])
    const { documento, digits } = formatDocument(normalizeCellValue(row[columns.documento]))
    const centroCusto = normalizeCellValue(row[columns.centroCusto])

    if (!tipo && !segmento && !nome && !documento && !centroCusto) {
      continue
    }

    if (!nome) {
      skipped += 1
      continue
    }

    const key = `${digits || "sem-documento"}|${normalizeName(nome)}`
    if (deduped.has(key)) {
      duplicates += 1
      continue
    }

    deduped.set(key, {
      tipo,
      segmento: segmento.toUpperCase(),
      nome: nome.toUpperCase(),
      documento,
      documentoDigits: digits,
      centroCusto,
    })
  }

  return { records: Array.from(deduped.values()), skipped, duplicates }
}

function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = []
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size))
  }
  return chunks
}

function isMissingColumnError(message: string): boolean {
  const normalized = message.toLowerCase()
  return normalized.includes("tipo") || normalized.includes("segmento") || normalized.includes("centro_custo")
}

export async function POST(req: Request) {
  try {
    const session = await verifySession()
    if (!session || session.role !== "mestre") {
      return NextResponse.json({ error: "Sem permissão" }, { status: 403 })
    }

    const formData = await req.formData()
    const file = formData.get("file") as File | null

    if (!file) {
      return NextResponse.json({ error: "Arquivo não enviado." }, { status: 400 })
    }

    const buffer = Buffer.from(await file.arrayBuffer())
    const { records, skipped, duplicates } = parseSpreadsheet(buffer)

    if (records.length === 0) {
      return NextResponse.json(
        {
          error:
            "Nenhum colaborador válido encontrado. Confira as colunas A (Tipo), B (Segmento), C (Nome), D (CPF/CNPJ) e E (Centro de Custo).",
        },
        { status: 400 }
      )
    }

    const supabase = await createClient()
    const { data: existingRows, error: selectError } = await supabase
      .from("fleet_colaboradores")
      .select("id, nome, cpf")
      .limit(10000)

    if (selectError) {
      throw new Error(selectError.message)
    }

    const existing = (existingRows ?? []) as ExistingColaborador[]
    const byKey = new Map<string, ExistingColaborador>()
    const byDocument = new Map<string, ExistingColaborador[]>()
    const byName = new Map<string, ExistingColaborador[]>()

    for (const row of existing) {
      const digits = (row.cpf ?? "").replace(/\D/g, "")
      const normalizedName = normalizeName(row.nome ?? "")

      byKey.set(`${digits || "sem-documento"}|${normalizedName}`, row)

      if (digits) {
        byDocument.set(digits, [...(byDocument.get(digits) ?? []), row])
      }
      if (normalizedName) {
        byName.set(normalizedName, [...(byName.get(normalizedName) ?? []), row])
      }
    }

    const usedIds = new Set<string>()
    const toInsert: ImportedColaborador[] = []
    const toUpdate: { id: string; record: ImportedColaborador }[] = []

    for (const record of records) {
      const normalizedName = normalizeName(record.nome)
      const key = `${record.documentoDigits || "sem-documento"}|${normalizedName}`

      let match = byKey.get(key)

      // Sem correspondência exata, só reaproveita o cadastro quando o documento/nome é único.
      if (!match || usedIds.has(match.id)) {
        const candidates = record.documentoDigits
          ? byDocument.get(record.documentoDigits) ?? []
          : byName.get(normalizedName) ?? []
        const available = candidates.filter((candidate) => !usedIds.has(candidate.id))
        match = available.length === 1 ? available[0] : undefined
      }

      if (match) {
        usedIds.add(match.id)
        toUpdate.push({ id: match.id, record })
      } else {
        toInsert.push(record)
      }
    }

    const insertPayloads = toInsert.map((record) => ({
      nome: record.nome,
      cpf: record.documento,
      tipo: record.tipo,
      segmento: record.segmento,
      centro_custo: record.centroCusto,
      telefone: "",
      email: "",
      departamento: "",
      cep: "",
      endereco: "",
      data_vencimento_cnh: null,
      documentos: [],
      imagens_veiculo: [],
      checklist: null,
    }))

    for (const batch of chunk(insertPayloads, INSERT_CHUNK_SIZE)) {
      const { error: insertError } = await supabase.from("fleet_colaboradores").insert(batch)
      if (insertError) {
        if (insertError.message.includes("data_vencimento_cnh") || isMissingColumnError(insertError.message)) {
          throw new Error(
            "Execute as migrations 017_allow_partial_colaborador_import.sql e 018_add_colaborador_tipo_segmento.sql no Supabase antes de importar a planilha."
          )
        }
        throw new Error(insertError.message)
      }
    }

    const timestamp = new Date().toISOString()
    for (const batch of chunk(toUpdate, UPDATE_CHUNK_SIZE)) {
      const results = await Promise.all(
        batch.map(({ id, record }) =>
          supabase
            .from("fleet_colaboradores")
            .update({
              nome: record.nome,
              cpf: record.documento,
              tipo: record.tipo,
              segmento: record.segmento,
              centro_custo: record.centroCusto,
              updated_at: timestamp,
            })
            .eq("id", id)
        )
      )

      const failed = results.find((result) => result.error)
      if (failed?.error) {
        if (isMissingColumnError(failed.error.message)) {
          throw new Error(
            "Execute a migration 018_add_colaborador_tipo_segmento.sql no Supabase antes de importar a planilha."
          )
        }
        throw new Error(failed.error.message)
      }
    }

    return NextResponse.json({
      success: true,
      imported: records.length,
      inserted: insertPayloads.length,
      updated: toUpdate.length,
      duplicates,
      skipped,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro desconhecido"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}