import { createClient } from "@/lib/supabase/server"
import { verifySession } from "@/lib/auth"
import { NextResponse } from "next/server"

// DELETE - Remover usuário (apenas mestre)
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await verifySession()
  if (!session || session.role !== "mestre") {
    return NextResponse.json({ error: "Sem permissão" }, { status: 403 })
  }

  const { id } = await params
  const supabase = await createClient()

  const { error } = await supabase
    .from("profiles")
    .delete()
    .eq("id", id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}

// PATCH - Atualizar role do usuário (apenas mestre)
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await verifySession()
  if (!session || session.role !== "mestre") {
    return NextResponse.json({ error: "Sem permissão" }, { status: 403 })
  }

  const { id } = await params
  const body = await request.json()
  const { role, nome } = body

  const supabase = await createClient()

  const updateData: Record<string, string> = { updated_at: new Date().toISOString() }
  if (role) updateData.role = role
  if (nome) updateData.nome = nome

  const { error } = await supabase
    .from("profiles")
    .update(updateData)
    .eq("id", id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
