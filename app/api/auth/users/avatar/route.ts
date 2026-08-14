import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { createAdminClient } from "@/lib/supabase/admin"
import { deleteLocalAvatar, saveLocalAvatar } from "@/lib/avatar-storage"
import { verifySession } from "@/lib/auth"
import { describeDriveError, ensureFolder, getDriveClients, getDriveRootFolderId } from "@/lib/google-drive"
import path from "node:path"
import { Readable } from "node:stream"

export const runtime = "nodejs"

const MAX_FILE_SIZE = 5 * 1024 * 1024

const AVATAR_FOLDER_NAME = "avatars"

function sanitizeName(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "_")
    .replace(/^_+|_+$/g, "")
}

export async function POST(request: Request) {
  const session = await verifySession()
  if (!session || session.role !== "mestre") {
    return NextResponse.json({ error: "Sem permissão" }, { status: 403 })
  }

  try {
    const formData = await request.formData()
    const userId = String(formData.get("userId") || "").trim()
    const file = formData.get("file") as File | null

    if (!userId || !file) {
      return NextResponse.json({ error: "Usuário e arquivo são obrigatórios." }, { status: 400 })
    }

    if (!file.type.startsWith("image/")) {
      return NextResponse.json({ error: "Envie apenas arquivos de imagem." }, { status: 400 })
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: "A imagem deve ter no máximo 5 MB." }, { status: 400 })
    }

    const supabase = createAdminClient()
    const fileBuffer = Buffer.from(await file.arrayBuffer())
    const avatarUrl = `/api/auth/users/${userId}/avatar`

    const { data: authUser } = await supabase.auth.admin.getUserById(userId)
    const currentMetadata = authUser.user?.user_metadata || {}
    const previousDriveFileId = currentMetadata.avatar_drive_file_id as string | undefined
    const previousLocalStorageKey = currentMetadata.avatar_storage_key as string | undefined

    const fileExtension = path.extname(file.name || "").toLowerCase() || ".jpg"
    const finalName = `avatar_${Date.now()}${fileExtension}`
    const localStorageKey = `${sanitizeName(userId)}_${Date.now()}${fileExtension}`

    let driveFileId: string | null = null
    let storedLocally = false
    let lastDriveError: string | null = null

    try {
      const rootId = getDriveRootFolderId()
      const driveClients = await getDriveClients()

      for (const drive of driveClients) {
        try {
          const avatarsFolderId = await ensureFolder(drive, AVATAR_FOLDER_NAME, rootId)
          const userFolderId = await ensureFolder(drive, sanitizeName(userId), avatarsFolderId)

          if (previousDriveFileId) {
            try {
              await drive.files.delete({ fileId: previousDriveFileId, supportsAllDrives: true })
            } catch {
              // Ignora falha de limpeza do arquivo anterior.
            }
          }

          const created = await drive.files.create({
            requestBody: {
              name: finalName,
              parents: [userFolderId],
            },
            media: {
              mimeType: file.type,
              body: Readable.from(fileBuffer),
            },
            fields: "id",
            supportsAllDrives: true,
          })

          driveFileId = created.data.id || null
          if (driveFileId) {
            break
          }
        } catch (error) {
          lastDriveError = describeDriveError(error)
        }
      }
    } catch (error) {
      lastDriveError = describeDriveError(error)
    }

    if (!driveFileId) {
      storedLocally = await saveLocalAvatar(localStorageKey, fileBuffer)

      if (!storedLocally) {
        return NextResponse.json(
          { error: lastDriveError || "Nao foi possivel salvar a imagem do avatar." },
          { status: 500 }
        )
      }
    }

    await supabase.auth.admin.updateUserById(userId, {
      user_metadata: {
        ...currentMetadata,
        avatar_url: avatarUrl,
        avatar_drive_file_id: driveFileId,
        avatar_storage_key: storedLocally ? localStorageKey : null,
        avatar_mime_type: file.type,
      },
    })

    if (storedLocally) {
      if (previousDriveFileId) {
        try {
          const driveClients = await getDriveClients()
          for (const drive of driveClients) {
            try {
              await drive.files.delete({ fileId: previousDriveFileId, supportsAllDrives: true })
              break
            } catch {
              // Ignora falha de limpeza do arquivo antigo.
            }
          }
        } catch {
          // Ignora indisponibilidade do Drive durante limpeza.
        }
      }
    }

    if (previousLocalStorageKey && previousLocalStorageKey !== localStorageKey) {
      await deleteLocalAvatar(previousLocalStorageKey)
    }

    const response = NextResponse.json({ success: true, avatarUrl })

    if (session.id === userId) {
      const cookieStore = await cookies()
      const updatedSession = {
        ...session,
        avatarUrl,
      }

      cookieStore.set("app_user", encodeURIComponent(JSON.stringify(updatedSession)), {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: 60 * 60 * 24 * 7,
      })
    }

    return response
  } catch (err) {
    const message = err instanceof Error ? err.message : "Falha ao processar upload da foto."
    return NextResponse.json({ error: message }, { status: 500 })
  }
}