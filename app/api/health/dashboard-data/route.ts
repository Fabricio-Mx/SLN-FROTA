import { NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"

export async function GET() {
  try {
    const supabase = createAdminClient()

    const [vehiclesRes, colaboradoresRes, multasRes] = await Promise.all([
      supabase.from("fleet_vehicles").select("id", { head: true, count: "exact" }),
      supabase.from("fleet_colaboradores").select("id", { head: true, count: "exact" }),
      supabase.from("fleet_multas").select("id", { head: true, count: "exact" }),
    ])

    const firstError = vehiclesRes.error || colaboradoresRes.error || multasRes.error
    if (firstError) {
      return NextResponse.json(
        {
          ok: false,
          error: firstError.message,
          hint: "Falha ao validar os dados principais do painel.",
        },
        { status: 503 }
      )
    }

    return NextResponse.json({
      ok: true,
      vehicles: vehiclesRes.count ?? 0,
      colaboradores: colaboradoresRes.count ?? 0,
      multas: multasRes.count ?? 0,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Falha ao validar os dados do painel."
    return NextResponse.json(
      {
        ok: false,
        error: message,
        hint: "Falha ao validar os dados principais do painel.",
      },
      { status: 503 }
    )
  }
}