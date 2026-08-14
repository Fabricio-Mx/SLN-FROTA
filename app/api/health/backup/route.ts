import { NextResponse } from "next/server"
import { ensureFolder, getDriveClients, getDriveRootFolderId, isDriveConfigured } from "@/lib/google-drive"

const BACKUP_FOLDER_NAME = "backups"

export async function GET() {
  if (!isDriveConfigured()) {
    return NextResponse.json(
      {
        ok: false,
        error: "Drive não configurado.",
        hint: "Configure o Drive antes de validar a rotina de backup.",
      },
      { status: 503 }
    )
  }

  try {
    const rootId = getDriveRootFolderId()
    const driveClients = await getDriveClients()

    for (const drive of driveClients) {
      try {
        await drive.files.get({
          fileId: rootId,
          fields: "id",
          supportsAllDrives: true,
        })

        const backupRootId = await ensureFolder(drive, BACKUP_FOLDER_NAME, rootId)

        return NextResponse.json({
          ok: true,
          folderId: backupRootId,
        })
      } catch {
        // Tenta o próximo cliente configurado.
      }
    }

    return NextResponse.json(
      {
        ok: false,
        error: "Backup não disponível no Drive.",
        hint: "Verifique as permissões da pasta raiz e da conta configurada para backup.",
      },
      { status: 503 }
    )
  } catch (err) {
    const message = err instanceof Error ? err.message : "Falha ao validar o backup."

    return NextResponse.json(
      {
        ok: false,
        error: message,
        hint: "Falha ao validar a rotina de backup no Drive.",
      },
      { status: 503 }
    )
  }
}