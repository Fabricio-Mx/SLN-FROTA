import { NextResponse } from "next/server"
import * as XLSX from "xlsx"
import { verifySession } from "@/lib/auth"
import { createClient } from "@/lib/supabase/server"

export const runtime = "nodejs"

type ImportedColaborador = {
  nome: string
  cpf: string
  centroCusto: string
}

type ExistingColaborador = {
  id: string
  cpf: string
}

function normalizeCellValue(value: string | number | null | undefined): string {
  if (typeof value === "string") return value.trim()
  if (typeof value === "number") return String(value).trim()
  return ""
}

function normalizeCpf(value: string): string {
  const digits = value.replace(/\D/g, "")
  if (digits.length !== 11) {
    return value.trim()
  }

  return digits.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4")
}

function isHeaderRow(nome: string, cpf: string, centroCusto: string): boolean {
  const normalizedName = nome.toLowerCase().replace(/\s+/g, "")
  const normalizedCpf = cpf.toLowerCase().replace(/\s+/g, "")
  const normalizedCenter = centroCusto.toLowerCase().replace(/\s+/g, "")

  return normalizedName === "nome" && normalizedCpf === "cpf" && normalizedCenter.includes("centrodecusto")
}

function parseSpreadsheet(buffer: Buffer): ImportedColaborador[] {
  const workbook = XLSX.read(buffer, { type: "buffer", raw: false })
  const firstSheetName = workbook.SheetNames[0]

  if (!firstSheetName) {
    return []
  }

  const sheet = workbook.Sheets[firstSheetName]
  const rows = XLSX.utils.sheet_to_json<(string | number | null)[]>(sheet, {
    header: 1,
    raw: false,
    defval: "",
  })

  const deduped = new Map<string, ImportedColaborador>()

  for (const row of rows) {
    const nome = normalizeCellValue(row[2])
    const cpf = normalizeCpf(normalizeCellValue(row[3]))
    const centroCusto = normalizeCellValue(row[4])

    if (!nome && !cpf && !centroCusto) {
      continue
    }

    if (isHeaderRow(nome, cpf, centroCusto)) {
      continue
    }

    const cpfDigits = cpf.replace(/\D/g, "")
    if (!nome || cpfDigits.length !== 11) {
      continue
    }

    deduped.set(cpfDigits, { nome, cpf, centroCusto })
  }

  return Array.from(deduped.values())
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
    const records = parseSpreadsheet(buffer)

    if (records.length === 0) {
      return NextResponse.json(
        { error: "Nenhum colaborador válido encontrado. Confira as colunas C (Nome), D (CPF) e E (Centro de Custo)." },
        { status: 400 }
      )
    }

    const supabase = await createClient()
    const cpfs = records.map((record) => record.cpf)
    const { data: existingRows, error: selectError } = await supabase
      .from("fleet_colaboradores")
      .select("id, cpf")
      .in("cpf", cpfs)

    if (selectError) {
      throw new Error(selectError.message)
    }

    const existingByCpf = new Map<string, ExistingColaborador>()
    for (const row of (existingRows ?? []) as ExistingColaborador[]) {
      existingByCpf.set(row.cpf.replace(/\D/g, ""), row)
    }

    const inserts = records
      .filter((record) => !existingByCpf.has(record.cpf.replace(/\D/g, "")))
      .map((record) => ({
        nome: record.nome,
        cpf: record.cpf,
        telefone: "",
        email: "",
        departamento: "",
        centro_custo: record.centroCusto,
        cep: "",
        endereco: "",
        data_vencimento_cnh: null,
        documentos: [],
        imagens_veiculo: [],
        checklist: null,
      }))

    if (inserts.length > 0) {
      const { error: insertError } = await supabase.from("fleet_colaboradores").insert(inserts)
      if (insertError) {
        if (insertError.message.includes("data_vencimento_cnh")) {
          throw new Error("Execute a migration 017_allow_partial_colaborador_import.sql no Supabase antes de importar a planilha.")
        }
        throw new Error(insertError.message)
      }
    }

    const updates = records.filter((record) => existingByCpf.has(record.cpf.replace(/\D/g, "")))
    for (const record of updates) {
      const existing = existingByCpf.get(record.cpf.replace(/\D/g, ""))
      if (!existing) continue

      const { error: updateError } = await supabase
        .from("fleet_colaboradores")
        .update({
          nome: record.nome,
          cpf: record.cpf,
          centro_custo: record.centroCusto,
          updated_at: new Date().toISOString(),
        })
        .eq("id", existing.id)

      if (updateError) {
        throw new Error(updateError.message)
      }
    }

    return NextResponse.json({
      success: true,
      imported: records.length,
      inserted: inserts.length,
      updated: updates.length,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro desconhecido"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}