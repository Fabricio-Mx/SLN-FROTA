import { NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"

export async function GET() {
  try {
    const supabase = createAdminClient()
    const { error } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1 })

    if (error) {
      return NextResponse.json(
        { ok: false, error: error.message, hint: "Verifique se o projeto esta ativo." },
        { status: 503 }
      )
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Falha ao conectar"
    return NextResponse.json(
      { ok: false, error: message, hint: "Verifique se o projeto esta ativo." },
      { status: 503 }
    )
  }
}
