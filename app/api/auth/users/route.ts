import { createAdminClient } from "@/lib/supabase/admin"
import { verifySession } from "@/lib/auth"
import { USER_ROLES } from "@/lib/auth-shared"
import { NextResponse } from "next/server"

type AuthMetadata = {
  nome?: string | null
  role?: string | null
  avatar_url?: string | null
  avatar_drive_file_id?: string | null
  avatar_mime_type?: string | null
}

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

    const { data: authUsers, error: authUsersError } = await supabase.auth.admin.listUsers({
      page: 1,
      perPage: 1000,
    })

    if (authUsersError) {
      return NextResponse.json({ error: authUsersError.message }, { status: 500 })
    }

    const metadataByUserId = new Map(
      (authUsers?.users || []).map((user) => [user.id, user.user_metadata || {}])
    )

    const users = (data || []).map((profile) => ({
      ...profile,
      avatar_url: metadataByUserId.get(profile.id)?.avatar_url || null,
    }))

    return NextResponse.json({ users })
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

  if (!USER_ROLES.includes(role)) {
    return NextResponse.json({ error: "Tipo de acesso inválido" }, { status: 400 })
  }

  try {
    const supabase = createAdminClient()
    const normalizedEmail = String(email).trim().toLowerCase()

    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email: normalizedEmail,
      password,
      email_confirm: true,
      user_metadata: { nome, role, avatar_url: null, avatar_drive_file_id: null, avatar_mime_type: null },
    })

    let userId = authData.user?.id || null
    let message = "Usuário criado com sucesso"

    if (authError || !userId) {
      const duplicateEmail = /already been registered|already registered|already exists/i.test(authError?.message || "")

      if (!duplicateEmail) {
        return NextResponse.json({ error: authError?.message || "Falha ao criar usuário" }, { status: 400 })
      }

      const { data: userList, error: listError } = await supabase.auth.admin.listUsers({
        page: 1,
        perPage: 1000,
      })

      if (listError) {
        return NextResponse.json({ error: listError.message }, { status: 500 })
      }

      const existingUser = userList.users.find((user) => (user.email || "").toLowerCase() === normalizedEmail)
      if (!existingUser) {
        return NextResponse.json({ error: authError?.message || "Falha ao localizar usuário existente" }, { status: 400 })
      }

      userId = existingUser.id

      const { data: existingProfile, error: profileLookupError } = await supabase
        .from("profiles")
        .select("id")
        .eq("id", userId)
        .maybeSingle()

      if (profileLookupError) {
        return NextResponse.json({ error: profileLookupError.message }, { status: 500 })
      }

      if (existingProfile?.id) {
        return NextResponse.json(
          { error: "Já existe um usuário cadastrado com este email." },
          { status: 409 }
        )
      }

      const currentMetadata = (existingUser.user_metadata || {}) as AuthMetadata
      const { error: updateAuthError } = await supabase.auth.admin.updateUserById(userId, {
        password,
        user_metadata: {
          ...currentMetadata,
          nome,
          role,
          avatar_url: currentMetadata.avatar_url || null,
          avatar_drive_file_id: currentMetadata.avatar_drive_file_id || null,
          avatar_mime_type: currentMetadata.avatar_mime_type || null,
        },
      })

      if (updateAuthError) {
        return NextResponse.json({ error: updateAuthError.message }, { status: 500 })
      }

      message = "Usuário recuperado e finalizado com sucesso"
    }

    const { error: profileError } = await supabase.from("profiles").upsert({
      id: userId,
      email: normalizedEmail,
      nome,
      role,
      is_admin: role === "mestre",
      updated_at: new Date().toISOString(),
    })

    if (profileError) {
      return NextResponse.json({ error: profileError.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, message, userId })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Falha ao conectar ao Supabase."
    return NextResponse.json(
      { error: "Falha ao conectar ao Supabase.", detail: message, hint: "Verifique se o projeto esta ativo." },
      { status: 503 }
    )
  }
}
