import { NextResponse } from "next/server"
import { Readable } from "node:stream"
import { verifySession } from "@/lib/auth"
import { describeDriveError, ensureFolder, getDriveClients, getDriveRootFolderId } from "@/lib/google-drive"

export const runtime = "nodejs"

const DRIVE_WRITE_OPTIONS = {
  supportsAllDrives: true,
} as const

function sanitizeName(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "_")
    .replace(/^_+|_+$/g, "")
}

export async function POST(req: Request) {
  try {
    const session = await verifySession()
    if (!session) {
      return NextResponse.json({ error: "Sem permissão" }, { status: 403 })
    }

    const formData = await req.formData()

    const file = formData.get("file") as File | null
    const entityType = String(formData.get("entityType") || "geral")
    const entityId = String(formData.get("entityId") || "sem-id")
    const label = String(formData.get("label") || "arquivo")
    const subfolder = sanitizeName(String(formData.get("subfolder") || ""))

    if (!file) {
      return NextResponse.json({ error: "Arquivo nao enviado." }, { status: 400 })
    }

    const rootId = getDriveRootFolderId()
    const fileBuffer = Buffer.from(await file.arrayBuffer())
    const safeName = sanitizeName(file.name || "arquivo")
    const finalName = `${sanitizeName(label)}_${Date.now()}_${safeName}`
    const driveClients = await getDriveClients()
    const failures: unknown[] = []

    // Tenta OAuth e, se o token estiver invalido, cai para a conta de servico.
    for (const drive of driveClients) {
      try {
        const typeFolderId = await ensureFolder(drive, sanitizeName(entityType), rootId)
        const entityFolderId = await ensureFolder(drive, sanitizeName(entityId), typeFolderId)
        const targetFolderId = subfolder ? await ensureFolder(drive, subfolder, entityFolderId) : entityFolderId

        const created = await drive.files.create({
          requestBody: {
            name: finalName,
            parents: [targetFolderId],
          },
          media: {
            mimeType: file.type || "application/octet-stream",
            body: Readable.from(fileBuffer),
          },
          fields: "id, name, webViewLink, webContentLink, mimeType, size",
          ...DRIVE_WRITE_OPTIONS,
        })

        return NextResponse.json(created.data)
      } catch (error) {
        failures.push(error)
      }
    }

    // A conta de servico nunca consegue criar arquivo em pasta pessoal, entao o erro do OAuth e o relevante.
    throw failures[0] ?? new Error("Nenhuma credencial do Drive disponivel.")
  } catch (err) {
    const message = describeDriveError(err)
    const isExpiredAuth = message.toLowerCase().includes("invalid_grant")

    return NextResponse.json(
      {
        error: isExpiredAuth
          ? "A autorização do Google Drive expirou. Peça para um administrador reconectar a conta em /api/drive/oauth/start e tente novamente."
          : message,
      },
      { status: 500 }
    )
  }
}
