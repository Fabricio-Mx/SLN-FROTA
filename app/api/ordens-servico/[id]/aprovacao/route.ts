import { NextResponse } from "next/server"
import { canApproveOrdemServico, verifySession } from "@/lib/auth"
import { createAdminClient } from "@/lib/supabase/admin"
import type { OrdemServicoStatus } from "@/lib/types"

export const runtime = "nodejs"

type RouteContext = {
  params: Promise<{ id: string }>
}

type DecisionStatus = Extract<OrdemServicoStatus, "aprovado" | "rejeitado">

const VALID_DECISIONS: DecisionStatus[] = ["aprovado", "rejeitado"]
const MAX_MOTIVO_LENGTH = 500

type OrdemStatusRow = {
  id: string
  status: OrdemServicoStatus | null
}

export async function PATCH(request: Request, context: RouteContext) {
  const session = await verifySession()
  if (!session || !canApproveOrdemServico(session.role)) {
    return NextResponse.json({ error: "Apenas o cargo mestre pode aprovar ou rejeitar orçamentos." }, { status: 403 })
  }

  const { id } = await context.params
  const body = await request.json().catch(() => null)
  const status = body?.status as DecisionStatus | undefined
  const motivoRejeicao = typeof body?.motivoRejeicao === "string" ? body.motivoRejeicao.trim() : ""

  if (!status || !VALID_DECISIONS.includes(status)) {
    return NextResponse.json({ error: "Decisão inválida." }, { status: 400 })
  }

  if (status === "rejeitado" && !motivoRejeicao) {
    return NextResponse.json({ error: "Informe o motivo da rejeição." }, { status: 400 })
  }

  if (motivoRejeicao.length > MAX_MOTIVO_LENGTH) {
    return NextResponse.json({ error: "Motivo da rejeição muito longo." }, { status: 400 })
  }

  try {
    const supabase = createAdminClient()
    const { data: ordem, error: selectError } = await supabase
      .from("fleet_ordens_servico")
      .select("id, status")
      .eq("id", id)
      .maybeSingle<OrdemStatusRow>()

    if (selectError) {
      return NextResponse.json({ error: selectError.message }, { status: 500 })
    }

    if (!ordem) {
      return NextResponse.json({ error: "Ordem de serviço não encontrada." }, { status: 404 })
    }

    if (ordem.status !== "aguardando") {
      return NextResponse.json(
        { error: "Somente orçamentos aguardando aprovação podem ser decididos." },
        { status: 409 }
      )
    }

    const now = new Date().toISOString()
    const { error: updateError } = await supabase
      .from("fleet_ordens_servico")
      .update({
        status,
        aprovado_por: session.nome || session.email,
        aprovado_em: now,
        motivo_rejeicao: status === "rejeitado" ? motivoRejeicao : null,
        updated_at: now,
      })
      .eq("id", id)

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha ao registrar a decisão do orçamento."
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
