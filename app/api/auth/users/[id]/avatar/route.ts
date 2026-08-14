import { NextResponse } from "next/server"
import { readLocalAvatar } from "@/lib/avatar-storage"
import { createAdminClient } from "@/lib/supabase/admin"
import { verifySession } from "@/lib/auth"
import { findFolder, findLatestFileInFolder, getDriveClients, getDriveRootFolderId, readDriveFileContent } from "@/lib/google-drive"
export const runtime = "nodejs"

const AVATAR_FOLDER_NAME = "avatars"

function sanitizeName(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "_")
    .replace(/^_+|_+$/g, "")
}

function createMissingAvatarResponse() {
  return NextResponse.json(
    { error: "Avatar não disponível." },
    {
      status: 404,
      headers: {
        "Cache-Control": "no-store, private",
      },
    }
  )
}

function createUnauthorizedAvatarResponse() {
  return NextResponse.json(
    { error: "Sessão encerrada." },
    {
      status: 401,
      headers: {
        "Cache-Control": "no-store, private",
      },
    }
  )
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await verifySession()
  if (!session) {
    return createUnauthorizedAvatarResponse()
  }

  try {
    const { id } = await params
    const supabase = createAdminClient()
    const { data: authUser, error: authError } = await supabase.auth.admin.getUserById(id)

    if (authError || !authUser.user) {
      return createMissingAvatarResponse()
    }

    let driveFileId = authUser.user?.user_metadata?.avatar_drive_file_id as string | undefined
    const localStorageKey = authUser.user?.user_metadata?.avatar_storage_key as string | undefined
    let mimeType = authUser.user?.user_metadata?.avatar_mime_type as string | undefined
    const currentMetadata = authUser.user.user_metadata || {}

    if (localStorageKey) {
      const localAvatar = await readLocalAvatar(localStorageKey)

      if (localAvatar?.length) {
        return new NextResponse(localAvatar, {
          headers: {
            "Content-Type": mimeType || "application/octet-stream",
            "Cache-Control": "private, max-age=3600",
          },
        })
      }
    }

    const driveClients = await getDriveClients()

    if (!driveFileId) {
      const rootId = getDriveRootFolderId()

      for (const drive of driveClients) {
        try {
          const avatarsFolder = await findFolder(drive, AVATAR_FOLDER_NAME, rootId)
          const userFolder = avatarsFolder?.id ? await findFolder(drive, sanitizeName(id), avatarsFolder.id) : null
          const latestAvatar = userFolder?.id ? await findLatestFileInFolder(drive, userFolder.id) : null

          if (!latestAvatar?.id) {
            continue
          }

          driveFileId = latestAvatar.id
          mimeType = mimeType || latestAvatar.mimeType || undefined

          await supabase.auth.admin.updateUserById(id, {
            user_metadata: {
              ...currentMetadata,
              avatar_url: currentMetadata.avatar_url || `/api/auth/users/${id}/avatar`,
              avatar_drive_file_id: latestAvatar.id,
              avatar_mime_type: mimeType || null,
            },
          })

          break
        } catch {
          // Tenta o próximo cliente do Drive.
        }
      }
    }

    if (!driveFileId) {
      return createMissingAvatarResponse()
    }

    for (const drive of driveClients) {
      try {
        const data = await readDriveFileContent(drive, driveFileId)

        if (!data.length) {
          continue
        }

        return new NextResponse(data, {
          headers: {
            "Content-Type": mimeType || "application/octet-stream",
            "Cache-Control": "private, max-age=3600",
          },
        })
      } catch {
        // Tenta o próximo cliente do Drive.
      }
    }

    return createMissingAvatarResponse()
  } catch {
    return createMissingAvatarResponse()
  }
}