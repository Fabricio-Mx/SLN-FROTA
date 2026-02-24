import { createAdminClient } from "@/lib/supabase/admin"
import { verifySession } from "@/lib/auth"
import { NextResponse } from "next/server"

// GET - Listar todos os usuários (apenas mestre)
export async function GET() {
  const session = await verifySession()
  if (!session || session.role !== "mestre") {
    return NextResponse.json({ error: "Sem permissão" }, { status: 403 })
  }

  try {
    const supabase = createAdminClient()
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .order("created_at", { ascending: false })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ users: data })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Falha ao conectar ao Supabase."
    return NextResponse.json(
      { error: "Falha ao conectar ao Supabase.", detail: message, hint: "Verifique se o projeto esta ativo." },
      { status: 503 }
    )
  }
}

// POST - Criar novo usuário (apenas mestre)
export async function POST(request: Request) {
  const session = await verifySession()
  if (!session || session.role !== "mestre") {
    return NextResponse.json({ error: "Sem permissão" }, { status: 403 })
  }

  const body = await request.json()
  const { email, password, nome, role } = body

  if (!email || !password || !nome || !role) {
    return NextResponse.json({ error: "Todos os campos são obrigatórios" }, { status: 400 })
  }

  const validRoles = ["mestre", "consulta", "administrativo", "logistico"]
  if (!validRoles.includes(role)) {
    return NextResponse.json({ error: "Tipo de acesso inválido" }, { status: 400 })
  }

  try {
    const supabase = createAdminClient()

    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { nome, role },
    })

    if (authError || !authData.user) {
      return NextResponse.json({ error: authError?.message || "Falha ao criar usuário" }, { status: 400 })
    }

    const { error: profileError } = await supabase.from("profiles").upsert({
      id: authData.user.id,
      email,
      nome,
      role,
      is_admin: role === "mestre",
      updated_at: new Date().toISOString(),
    })

    if (profileError) {
      return NextResponse.json({ error: profileError.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, message: "Usuário criado com sucesso" })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Falha ao conectar ao Supabase."
    return NextResponse.json(
      { error: "Falha ao conectar ao Supabase.", detail: message, hint: "Verifique se o projeto esta ativo." },
      { status: 503 }
    )
  }
}
