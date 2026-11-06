import { randomUUID } from "node:crypto"
import { NextResponse } from "next/server"
import { canManageMultas, verifySession } from "@/lib/auth"
import {
  MULTA_FONTE_LABELS,
  sanitizeMultaCampos,
  type MultaCamposEditaveis,
  type MultaFonte,
  type MultaImportada,
  type MultasImportStore,
  withDerivedMultaFields,
} from "@/lib/multas-import-shared"
import { loadMultasImportStore, persistMultasImportStore } from "@/lib/multas-import-storage"

export const runtime = "nodejs"

function parseFonte(value: unknown): MultaFonte | null {
  return typeof value === "string" && value in MULTA_FONTE_LABELS ? (value as MultaFonte) : null
}

function validateCampos(campos: MultaCamposEditaveis): string | null {
  if (!campos.placa) return "Informe a placa do veículo."
  if (!campos.dataInfracao) return "Informe a data da infração."
  return null
}

function findImportedRecord(store: MultasImportStore, id: string): MultaImportada | null {
  for (const batch of Object.values(store.batches)) {
    const record = batch?.records.find((item) => item.id === id)
    if (record) return withDerivedMultaFields(record)
  }
  return null
}

// Evita marcar como editado o que só mudou de formato no formulário (hora 00:00, data sem hora, arredondamento de centavos).
function isSameValue(next: unknown, base: unknown): boolean {
  const isEmpty = (value: unknown) => value === null || value === undefined || value === ""
  if (isEmpty(next) && isEmpty(base)) return true
  if (typeof next === "number" && typeof base === "number") return Math.abs(next - base) < 0.005
  if (typeof next === "string" && typeof base === "string") {
    if (/^\d{4}-\d{2}-\d{2}$/.test(next) && /^\d{4}-\d{2}-\d{2}T/.test(base)) return base.startsWith(next)
    return next.replace(/T00:00$/, "") === base.replace(/T00:00$/, "")
  }
  return next === base
}

function diffCampos(base: MultaImportada, campos: MultaCamposEditaveis): Partial<MultaCamposEditaveis> {
  const diff: Partial<MultaCamposEditaveis> = {}
  for (const key of Object.keys(campos) as (keyof MultaCamposEditaveis)[]) {
    if (!isSameValue(campos[key], base[key])) {
      ;(diff as Record<string, unknown>)[key] = campos[key]
    }
  }
  return diff
}

async function saveStore(store: MultasImportStore, recordId: string) {
  const persisted = await persistMultasImportStore(store)
  if (!persisted.drivePersisted && !persisted.localPersisted) {
    return NextResponse.json({ error: "Não foi possível salvar a multa.", driveError: persisted.driveError }, { status: 500 })
  }
  return NextResponse.json({ success: true, store, recordId, driveError: persisted.drivePersisted ? null : persisted.driveError })
}

async function requireManager() {
  const session = await verifySession()
  if (!session || !canManageMultas(session.role)) return null
  return session
}

/** Cadastra uma nova multa manualmente. */
export async function POST(req: Request) {
  try {
    const session = await requireManager()
    if (!session) return NextResponse.json({ error: "Sem permissão para cadastrar multas." }, { status: 403 })

    const body = (await req.json().catch(() => ({}))) as { fonte?: unknown; campos?: unknown }
    const fonte = parseFonte(body.fonte)
    if (!fonte) return NextResponse.json({ error: "Fonte inválida." }, { status: 400 })

    const campos = sanitizeMultaCampos(body.campos)
    const invalid = validateCampos(campos)
    if (invalid) return NextResponse.json({ error: invalid }, { status: 400 })

    const { store } = await loadMultasImportStore()
    const record: MultaImportada = {
      ...campos,
      id: `manual-${randomUUID()}`,
      fonte,
      linha: 0,
      corOriginal: null,
      origem: "manual",
      editadoEm: new Date().toISOString(),
      editadoPor: session.nome || session.email || null,
    }
    store.manuais = [...(store.manuais ?? []), record]

    return await saveStore(store, record.id)
  } catch (err) {
    console.error("[multas/registros] POST error", err)
    return NextResponse.json({ error: err instanceof Error ? err.message : "Erro desconhecido" }, { status: 500 })
  }
}

/** Edita uma multa (manual ou importada) ou, com `restaurar: true`, desfaz as edições de uma multa importada. */
export async function PUT(req: Request) {
  try {
    const session = await requireManager()
    if (!session) return NextResponse.json({ error: "Sem permissão para editar multas." }, { status: 403 })

    const body = (await req.json().catch(() => ({}))) as { id?: unknown; campos?: unknown; restaurar?: unknown; patch?: unknown }
    const id = typeof body.id === "string" ? body.id : ""
    if (!id) return NextResponse.json({ error: "Multa não informada." }, { status: 400 })

    const { store } = await loadMultasImportStore()
    const editadoEm = new Date().toISOString()
    const editadoPor = session.nome || session.email || null

    // `patch` altera só alguns campos, mantendo os demais valores atuais da multa (com as edições já feitas).
    if (body.patch && typeof body.patch === "object" && !body.campos) {
      const manual = (store.manuais ?? []).find((item) => item.id === id)
      const imported = manual ? null : findImportedRecord(store, id)
      const current = manual ?? (imported ? { ...imported, ...(store.edicoes?.[id]?.campos ?? {}) } : null)
      if (!current) return NextResponse.json({ error: "Multa não encontrada." }, { status: 404 })
      body.campos = { ...current, ...(body.patch as Record<string, unknown>) }
    }

    const manualIndex = (store.manuais ?? []).findIndex((item) => item.id === id)
    if (manualIndex >= 0) {
      if (body.restaurar === true) return NextResponse.json({ error: "Multas manuais não têm versão da planilha." }, { status: 400 })

      const campos = sanitizeMultaCampos(body.campos)
      const invalid = validateCampos(campos)
      if (invalid) return NextResponse.json({ error: invalid }, { status: 400 })

      const manuais = [...(store.manuais ?? [])]
      manuais[manualIndex] = { ...manuais[manualIndex], ...campos, editadoEm, editadoPor }
      store.manuais = manuais
      return await saveStore(store, id)
    }

    const base = findImportedRecord(store, id)
    if (!base) return NextResponse.json({ error: "Multa não encontrada." }, { status: 404 })

    const edicoes = { ...(store.edicoes ?? {}) }
    if (body.restaurar === true) {
      delete edicoes[id]
    } else {
      const campos = sanitizeMultaCampos(body.campos)
      const invalid = validateCampos(campos)
      if (invalid) return NextResponse.json({ error: invalid }, { status: 400 })

      const diff = diffCampos(base, campos)
      if (Object.keys(diff).length === 0) {
        delete edicoes[id]
      } else {
        edicoes[id] = { campos: diff, editadoEm, editadoPor }
      }
    }
    store.edicoes = edicoes

    return await saveStore(store, id)
  } catch (err) {
    console.error("[multas/registros] PUT error", err)
    return NextResponse.json({ error: err instanceof Error ? err.message : "Erro desconhecido" }, { status: 500 })
  }
}

/** Exclui uma multa cadastrada manualmente (as importadas só saem pela planilha). */
export async function DELETE(req: Request) {
  try {
    const session = await requireManager()
    if (!session) return NextResponse.json({ error: "Sem permissão para excluir multas." }, { status: 403 })

    const id = new URL(req.url).searchParams.get("id") ?? ""
    const { store } = await loadMultasImportStore()
    const manuais = store.manuais ?? []
    if (!manuais.some((item) => item.id === id)) {
      return NextResponse.json({ error: "Somente multas cadastradas manualmente podem ser excluídas." }, { status: 400 })
    }

    store.manuais = manuais.filter((item) => item.id !== id)
    return await saveStore(store, id)
  } catch (err) {
    console.error("[multas/registros] DELETE error", err)
    return NextResponse.json({ error: err instanceof Error ? err.message : "Erro desconhecido" }, { status: 500 })
  }
}
