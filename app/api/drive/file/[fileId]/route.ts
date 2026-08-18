import { NextResponse } from "next/server"
import { verifySession } from "@/lib/auth"
import { getDriveClients, readDriveFileContent } from "@/lib/google-drive"
import { createAdminClient } from "@/lib/supabase/admin"

export const runtime = "nodejs"

type DriveFileRef = { id?: string; name?: string; mimeType?: string | null }

// Só libera arquivos que estejam realmente vinculados a um colaborador.
async function findLinkedFile(fileId: string): Promise<DriveFileRef | null> {
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from("fleet_colaboradores")
    .select("documentos, cnh_arquivos, imagens_veiculo")
    .limit(10000)

  if (error) {
    throw new Error(error.message)
  }

  for (const row of data ?? []) {
    const groups = [row.documentos, row.cnh_arquivos, row.imagens_veiculo]

    for (const group of groups) {
      if (!Array.isArray(group)) continue

      const match = (group as DriveFileRef[]).find((item) => item?.id === fileId)
      if (match) return match
    }
  }

  return null
}

export async function GET(req: Request, { params }: { params: Promise<{ fileId: string }> }) {
  try {
    const session = await verifySession()
    if (!session) {
      return NextResponse.json({ error: "Sem permissão" }, { status: 403 })
    }

    const { fileId } = await params
    if (!/^[A-Za-z0-9_-]{10,}$/.test(fileId)) {
      return NextResponse.json({ error: "Arquivo inválido." }, { status: 400 })
    }

    const linked = await findLinkedFile(fileId)
    if (!linked) {
      return NextResponse.json({ error: "Arquivo não encontrado." }, { status: 404 })
    }

    const asAttachment = new URL(req.url).searchParams.get("download") === "1"
    const driveClients = await getDriveClients()

    for (const drive of driveClients) {
      try {
        const content = await readDriveFileContent(drive, fileId)
        const fileName = linked.name || `arquivo-${fileId}`

        return new NextResponse(new Uint8Array(content), {
          headers: {
            "Content-Type": linked.mimeType || "application/octet-stream",
            "Content-Disposition": `${asAttachment ? "attachment" : "inline"}; filename="${fileName.replace(/"/g, "")}"`,
            "Cache-Control": "private, no-store",
          },
        })
      } catch {
        // Tenta o próximo cliente do Drive.
      }
    }

    return NextResponse.json({ error: "Não foi possível ler o arquivo no Drive." }, { status: 404 })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro desconhecido"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
