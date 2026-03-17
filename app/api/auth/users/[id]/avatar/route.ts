import { NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { verifySession } from "@/lib/auth"
export const runtime = "nodejs"

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await verifySession()
  if (!session) {
    return NextResponse.json({ error: "Sem permissão" }, { status: 403 })
  }

  try {
    const { id } = await params
    const supabase = createAdminClient()
    const { data: authUser, error: authError } = await supabase.auth.admin.getUserById(id)

    if (authError) {
      return NextResponse.json({ error: authError.message }, { status: 500 })
    }

    const driveFileId = authUser.user?.user_metadata?.avatar_drive_file_id as string | undefined
    const mimeType = authUser.user?.user_metadata?.avatar_mime_type as string | undefined

    if (!driveFileId) {
      return NextResponse.json({ error: "Avatar não encontrado." }, { status: 404 })
    }

    const { getDriveClients } = await import("@/lib/google-drive")
    const drive = (await getDriveClients())[0]
    const response = await drive.files.get(
      { fileId: driveFileId, alt: "media" },
      { responseType: "arraybuffer" }
    )

    const data = Buffer.from(response.data as ArrayBuffer)

    if (!data) {
      return NextResponse.json({ error: "Avatar não encontrado." }, { status: 404 })
    }

    return new NextResponse(data, {
      headers: {
        "Content-Type": mimeType || "application/octet-stream",
        "Cache-Control": "private, max-age=3600",
      },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Falha ao carregar avatar."
    return NextResponse.json({ error: message }, { status: 500 })
  }
}