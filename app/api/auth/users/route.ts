import { createClient } from "@/lib/supabase/server"
import { verifySession } from "@/lib/auth"
import { NextResponse } from "next/server"

// GET - Listar todos os usuários (apenas mestre)
export async function GET() {
  const session = await verifySession()
  if (!session || session.role !== "mestre") {
    return NextResponse.json({ error: "Sem permissão" }, { status: 403 })
  }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .order("created_at", { ascending: false })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ users: data })
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

  const validRoles = ["consulta", "administrativo", "logistico"]
  if (!validRoles.includes(role)) {
    return NextResponse.json({ error: "Tipo de acesso inválido" }, { status: 400 })
  }

  const supabase = await createClient()

  // Verificar se email já existe
  const { data: existing } = await supabase
    .from("profiles")
    .select("id")
    .eq("email", email)
    .maybeSingle()

  if (existing) {
    return NextResponse.json({ error: "Email já cadastrado" }, { status: 400 })
  }

  // Criar usuário via Supabase Auth
  const { data: authData, error: authError } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { nome, role },
    },
  })

  if (authError) {
    return NextResponse.json({ error: authError.message }, { status: 400 })
  }

  // Criar perfil
  if (authData.user) {
    const { error: profileError } = await supabase.from("profiles").upsert({
      id: authData.user.id,
      email,
      nome,
      role,
      is_admin: false,
    })

    if (profileError) {
      return NextResponse.json({ error: profileError.message }, { status: 500 })
    }
  }

  return NextResponse.json({ success: true, message: "Usuário criado com sucesso" })
}
