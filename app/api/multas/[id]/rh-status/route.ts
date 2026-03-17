import { NextResponse } from "next/server"
import { verifySession, canEditMultaRhStatus, canManageMultas } from "@/lib/auth"
import { createAdminClient } from "@/lib/supabase/admin"
import type { MultaRhStatus } from "@/lib/types"

export const runtime = "nodejs"

type RouteContext = {
  params: Promise<{ id: string }>
}

const VALID_RH_STATUSES: MultaRhStatus[] = ["pendente", "pago"]

type MultaStatusRow = {
  id: string
  rh_status: MultaRhStatus | null
  rh_pago_em: string | null
}

export async function PATCH(request: Request, context: RouteContext) {
  const session = await verifySession()
  if (!session || !canEditMultaRhStatus(session.role)) {
    return NextResponse.json({ error: "Sem permissão" }, { status: 403 })
  }

  const { id } = await context.params
  const body = await request.json().catch(() => null)
  const rhStatus = body?.rhStatus as MultaRhStatus | undefined

  if (!rhStatus || !VALID_RH_STATUSES.includes(rhStatus)) {
    return NextResponse.json({ error: "Status RH inválido." }, { status: 400 })
  }

  try {
    const supabase = createAdminClient()
    const { data: currentMulta, error: currentError } = await supabase
      .from("fleet_multas")
      .select("id, rh_status, rh_pago_em")
      .eq("id", id)
      .single<MultaStatusRow>()

    if (currentError) {
      return NextResponse.json({ error: currentError.message }, { status: 500 })
    }

    if (!currentMulta) {
      return NextResponse.json({ error: "Multa não encontrada." }, { status: 404 })
    }

    if (!canManageMultas(session.role)) {
      if (currentMulta.rh_status !== "pendente" || rhStatus !== "pago") {
        return NextResponse.json(
          { error: "O Administrativo RH só pode alterar multas pendentes para Pago." },
          { status: 403 }
        )
      }
    }

    const now = new Date().toISOString()
    const { error: updateError } = await supabase
      .from("fleet_multas")
      .update({
        rh_status: rhStatus,
        rh_pago_em: rhStatus === "pago" ? currentMulta.rh_pago_em ?? now : null,
        updated_at: now,
      })
      .eq("id", id)

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha ao atualizar o Status RH."
    return NextResponse.json({ error: message }, { status: 500 })
  }
}