import { NextResponse } from "next/server"
import { verifySession } from "@/lib/auth"
import { createAdminClient } from "@/lib/supabase/admin"

export const runtime = "nodejs"

async function resetToken() {
  const session = await verifySession()
  if (!session || session.role !== "mestre") {
    return NextResponse.json({ error: "Sem permissao" }, { status: 403 })
  }

  const supabase = createAdminClient()
  const { error } = await supabase
    .from("drive_tokens")
    .delete()
    .eq("id", "default")

  if (error) {
    return NextResponse.json({ error: "Falha ao limpar token." }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}

export async function POST() {
  return resetToken()
}

export async function GET() {
  return resetToken()
}
