import { createAdminClient } from "@/lib/supabase/admin"
import { deleteLocalAvatar } from "@/lib/avatar-storage"
import { verifySession } from "@/lib/auth"
import { USER_ROLES } from "@/lib/auth-shared"
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
  if (session.id === id) {
    return NextResponse.json({ error: "Nao e permitido remover o proprio usuario." }, { status: 400 })
  }

  try {
    const supabase = createAdminClient()

    const { data: authUser } = await supabase.auth.admin.getUserById(id)
    const driveFileId = authUser.user?.user_metadata?.avatar_drive_file_id as string | undefined
  const localStorageKey = authUser.user?.user_metadata?.avatar_storage_key as string | undefined

    if (driveFileId) {
      try {
        const { getDriveClients } = await import("@/lib/google-drive")
        const driveClients = await getDriveClients()

        for (const drive of driveClients) {
          try {
            await drive.files.delete({ fileId: driveFileId, supportsAllDrives: true })
            break
          } catch {
            // Tenta o próximo cliente disponível.
          }
        }
      } catch {
        // Ignora falha de limpeza do Drive para nao bloquear exclusao do usuario.
      }
    }

    if (localStorageKey) {
      await deleteLocalAvatar(localStorageKey)
    }

    const { error: authError } = await supabase.auth.admin.deleteUser(id)
    if (authError) {
      return NextResponse.json({ error: authError.message }, { status: 500 })
    }

    const { error } = await supabase
      .from("profiles")
      .delete()
      .eq("id", id)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Falha ao conectar ao Supabase."
    return NextResponse.json(
      { error: "Falha ao conectar ao Supabase.", detail: message, hint: "Verifique se o projeto esta ativo." },
      { status: 503 }
    )
  }
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

  if (role && !USER_ROLES.includes(role)) {
    return NextResponse.json({ error: "Tipo de acesso inválido" }, { status: 400 })
  }

  try {
    const supabase = createAdminClient()

    const updateData: Record<string, string | boolean> = { updated_at: new Date().toISOString() }
    if (role) updateData.role = role
    if (nome) updateData.nome = nome
    if (role) updateData.is_admin = role === "mestre"

    const { error } = await supabase
      .from("profiles")
      .update(updateData)
      .eq("id", id)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    if (role || nome) {
      const { data: authUser } = await supabase.auth.admin.getUserById(id)
      const currentMetadata = authUser.user?.user_metadata || {}

      await supabase.auth.admin.updateUserById(id, {
        user_metadata: {
          ...currentMetadata,
          ...(nome ? { nome } : {}),
          ...(role ? { role } : {}),
        },
      })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Falha ao conectar ao Supabase."
    return NextResponse.json(
      { error: "Falha ao conectar ao Supabase.", detail: message, hint: "Verifique se o projeto esta ativo." },
      { status: 503 }
    )
  }
}
