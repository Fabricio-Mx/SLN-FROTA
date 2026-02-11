import { NextResponse } from "next/server"
import { randomUUID } from "node:crypto"
import { google } from "googleapis"
import { cookies } from "next/headers"
import { verifySession } from "@/lib/auth"

export const runtime = "nodejs"

const GOOGLE_OAUTH_CLIENT_ID = process.env.GOOGLE_OAUTH_CLIENT_ID
const GOOGLE_OAUTH_CLIENT_SECRET = process.env.GOOGLE_OAUTH_CLIENT_SECRET
const GOOGLE_OAUTH_REDIRECT_URL = process.env.GOOGLE_OAUTH_REDIRECT_URL

function getOAuthClient() {
  if (!GOOGLE_OAUTH_CLIENT_ID || !GOOGLE_OAUTH_CLIENT_SECRET || !GOOGLE_OAUTH_REDIRECT_URL) {
    throw new Error("Google OAuth nao configurado.")
  }

  return new google.auth.OAuth2(
    GOOGLE_OAUTH_CLIENT_ID,
    GOOGLE_OAUTH_CLIENT_SECRET,
    GOOGLE_OAUTH_REDIRECT_URL
  )
}

export async function GET() {
  const session = await verifySession()
  if (!session || session.role !== "mestre") {
    return NextResponse.json({ error: "Sem permissao" }, { status: 403 })
  }

  const auth = getOAuthClient()
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
