import { NextResponse } from "next/server"
import { google } from "googleapis"
import { cookies } from "next/headers"
import { verifySession } from "@/lib/auth"
import { createAdminClient } from "@/lib/supabase/admin"
import { resolveDriveRedirectUrl } from "@/lib/google-drive"

export const runtime = "nodejs"

const GOOGLE_OAUTH_CLIENT_ID = process.env.GOOGLE_OAUTH_CLIENT_ID
const GOOGLE_OAUTH_CLIENT_SECRET = process.env.GOOGLE_OAUTH_CLIENT_SECRET

function getOAuthClient(redirectUrl: string) {
  if (!GOOGLE_OAUTH_CLIENT_ID || !GOOGLE_OAUTH_CLIENT_SECRET || !redirectUrl) {
    throw new Error("Google OAuth nao configurado.")
  }

  return new google.auth.OAuth2(GOOGLE_OAUTH_CLIENT_ID, GOOGLE_OAUTH_CLIENT_SECRET, redirectUrl)
}

export async function GET(req: Request) {
  const session = await verifySession()
  if (!session) {
    return NextResponse.json(
      { error: "Sessão expirada durante a autorização. Entre no sistema novamente e repita o processo." },
      { status: 403 }
    )
  }

  if (session.role !== "mestre" && !session.isMaster) {
    return NextResponse.json(
      { error: "Apenas o usuário mestre pode autorizar o Google Drive." },
      { status: 403 }
    )
  }

  const url = new URL(req.url)
  const code = url.searchParams.get("code")
  const state = url.searchParams.get("state")
  const cookieStore = await cookies()
  const storedState = cookieStore.get("drive_oauth_state")?.value

  if (!code || !state) {
    return NextResponse.json({ error: "Codigo OAuth ausente." }, { status: 400 })
  }

  if (storedState && state !== storedState) {
    return NextResponse.json({ error: "Estado OAuth invalido." }, { status: 400 })
  }

  const auth = getOAuthClient(resolveDriveRedirectUrl(req.url))
  const { tokens } = await auth.getToken(code)

  if (!tokens.refresh_token) {
    return NextResponse.json(
      { error: "Refresh token nao recebido. Revogue o acesso e tente novamente." },
      { status: 400 }
    )
  }

  const supabase = createAdminClient()
  const { error } = await supabase
    .from("drive_tokens")
    .upsert({
      id: "default",
      refresh_token: tokens.refresh_token,
      updated_at: new Date().toISOString(),
    })

  if (error) {
    return NextResponse.json({ error: "Falha ao salvar token." }, { status: 500 })
  }

  cookieStore.delete("drive_oauth_state")

  const redirectUrl = new URL("/", url.origin)
  redirectUrl.searchParams.set("drive", "authorized")
  return NextResponse.redirect(redirectUrl)
}
