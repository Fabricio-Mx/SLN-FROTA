import { NextResponse } from "next/server"
import { canManageMultas, verifySession } from "@/lib/auth"
import { isDriveConfigured } from "@/lib/google-drive"
import { parseMultasWorkbook } from "@/lib/multas-import-parser"
import {
  MULTA_FONTE_LABELS,
  MULTA_FONTES_SUPORTADAS,
  type MultaFonte,
  type MultasImportBatch,
} from "@/lib/multas-import-shared"
import { loadMultasImportStore, persistMultasImportStore } from "@/lib/multas-import-storage"

export const runtime = "nodejs"
export const maxDuration = 60

const MAX_FILE_SIZE = 15 * 1024 * 1024

function parseFonte(value: unknown): MultaFonte | null {
  return typeof value === "string" && value in MULTA_FONTE_LABELS ? (value as MultaFonte) : null
}

export async function GET() {
  try {
    const session = await verifySession()
    if (!session) {
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 })
    }

    const { store, loadedFromDrive } = await loadMultasImportStore()
    const hasData = Object.values(store.batches).some((batch) => (batch?.records.length ?? 0) > 0)
    const warning =
      isDriveConfigured() && !loadedFromDrive && hasData
        ? "Multas carregadas do espelho local. Verifique o acesso da conta de serviço ao Drive."
        : undefined

    return NextResponse.json({ store, warning })
  } catch (err) {
    console.error("[multas/import] GET error", err)
    const message = err instanceof Error ? err.message : "Erro desconhecido"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const session = await verifySession()
    if (!session || !canManageMultas(session.role)) {
      return NextResponse.json({ error: "Sem permissão para importar multas." }, { status: 403 })
    }

    const formData = await req.formData()
    const file = formData.get("file")
    const fonte = parseFonte(formData.get("fonte"))

    if (!fonte) {
      return NextResponse.json({ error: "Fonte da planilha inválida." }, { status: 400 })
    }
    if (!MULTA_FONTES_SUPORTADAS.includes(fonte)) {
      return NextResponse.json(
        { error: `O modelo de planilha de ${MULTA_FONTE_LABELS[fonte]} ainda não foi configurado.` },
        { status: 400 },
      )
    }
    if (!(file instanceof File) || file.size === 0) {
      return NextResponse.json({ error: "Selecione a planilha (.xlsx) para importar." }, { status: 400 })
    }
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: "Arquivo muito grande (limite de 15 MB)." }, { status: 400 })
    }
    if (!/\.xlsx$/i.test(file.name)) {
      return NextResponse.json({ error: "Envie a planilha no formato .xlsx." }, { status: 400 })
    }

    const buffer = Buffer.from(await file.arrayBuffer())
    let parsed: Awaited<ReturnType<typeof parseMultasWorkbook>>
    try {
      parsed = await parseMultasWorkbook(buffer, fonte)
    } catch (error) {
      const message = error instanceof Error ? error.message : "Não foi possível ler a planilha."
      return NextResponse.json({ error: message }, { status: 400 })
    }

    if (parsed.records.length === 0) {
      return NextResponse.json({ error: "Nenhuma multa encontrada na planilha." }, { status: 400 })
    }

    const batch: MultasImportBatch = {
      fonte,
      fileName: file.name,
      sheetName: parsed.sheetName,
      importedAt: new Date().toISOString(),
      importedBy: session.nome || session.email || null,
      records: parsed.records,
      warnings: parsed.warnings,
    }

    // A planilha é o controle oficial: cada importação substitui todas as multas da mesma fonte.
    const { store } = await loadMultasImportStore()
    const previousCount = store.batches[fonte]?.records.length ?? 0
    store.batches[fonte] = batch

    const persisted = await persistMultasImportStore(store, { fonte, buffer, fileName: file.name })
    if (!persisted.drivePersisted && !persisted.localPersisted) {
      return NextResponse.json(
        { error: "Não foi possível salvar as multas nem no Drive nem no armazenamento local.", driveError: persisted.driveError },
        { status: 500 },
      )
    }

    return NextResponse.json({
      success: true,
      store,
      summary: {
        fonte,
        imported: parsed.records.length,
        previousCount,
        warnings: parsed.warnings,
      },
      driveError: persisted.drivePersisted ? null : persisted.driveError,
    })
  } catch (err) {
    console.error("[multas/import] POST error", err)
    const message = err instanceof Error ? err.message : "Erro desconhecido"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function DELETE(req: Request) {
  try {
    const session = await verifySession()
    if (!session || !canManageMultas(session.role)) {
      return NextResponse.json({ error: "Sem permissão." }, { status: 403 })
    }

    const fonte = parseFonte(new URL(req.url).searchParams.get("fonte"))
    if (!fonte) {
      return NextResponse.json({ error: "Fonte inválida." }, { status: 400 })
    }

    const { store } = await loadMultasImportStore()
    delete store.batches[fonte]

    const persisted = await persistMultasImportStore(store)
    if (!persisted.drivePersisted && !persisted.localPersisted) {
      return NextResponse.json({ error: "Não foi possível remover a importação." }, { status: 500 })
    }

    return NextResponse.json({ success: true, store })
  } catch (err) {
    console.error("[multas/import] DELETE error", err)
    const message = err instanceof Error ? err.message : "Erro desconhecido"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
