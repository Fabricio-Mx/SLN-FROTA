import { NextResponse } from "next/server"
import { randomUUID } from "node:crypto"
import { google } from "googleapis"
import { cookies } from "next/headers"
import { verifySession } from "@/lib/auth"
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

  // Navegacao direta pelo browser: manda para o login em vez de devolver JSON.
  if (!session) {
    return NextResponse.redirect(new URL("/auth/login", req.url))
  }

  if (session.role !== "mestre" && !session.isMaster) {
    return NextResponse.json(
      { error: "Apenas o usuário mestre pode autorizar o Google Drive." },
      { status: 403 }
    )
  }

  const auth = getOAuthClient(resolveDriveRedirectUrl(req.url))
  const state = randomUUID()
  const authUrl = auth.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: ["https://www.googleapis.com/auth/drive"],
    state,
  })

  const isProd = process.env.NODE_ENV === "production"
  const cookieStore = await cookies()
  cookieStore.set("drive_oauth_state", state, {
    httpOnly: true,
    sameSite: "lax",
    secure: isProd,
    path: "/",
    maxAge: 60 * 10,
  })

  return NextResponse.redirect(authUrl)
}
