import { NextResponse } from "next/server"
import { describeDriveError, getDriveClients, getDriveRootFolderId, isDriveConfigured } from "@/lib/google-drive"

export async function GET() {
  if (!isDriveConfigured()) {
    return NextResponse.json(
      {
        ok: false,
        error: "Drive não configurado.",
        hint: "Configure a conta de serviço ou OAuth para validar o Drive.",
      },
      { status: 503 }
    )
  }

  try {
    const rootId = getDriveRootFolderId()
    const driveClients = await getDriveClients()
    let lastDriveError: string | null = null

    for (const drive of driveClients) {
      try {
        const response = await drive.files.get({
          fileId: rootId,
          fields: "id, name",
          supportsAllDrives: true,
        })

        if (response.data.id) {
          return NextResponse.json({
            ok: true,
            folderId: response.data.id,
            folderName: response.data.name ?? null,
          })
        }
      } catch (error) {
        lastDriveError = describeDriveError(error)
      }
    }

    return NextResponse.json(
      {
        ok: false,
        error: "Conta do Drive não carregada.",
        driveError: lastDriveError,
        hint: "Verifique a pasta compartilhada e as credenciais da conta de serviço.",
      },
      { status: 503 }
    )
  } catch (err) {
    const message = err instanceof Error ? err.message : "Falha ao validar o Drive."
    return NextResponse.json(
      {
        ok: false,
        error: message,
        hint: "Verifique as variáveis do Drive e o compartilhamento da pasta raiz.",
      },
      { status: 503 }
    )
  }
}