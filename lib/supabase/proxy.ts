import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { MASTER_CREDENTIALS } from '@/lib/auth-shared'
import { SESSION_ACTIVITY_COOKIE, SESSION_IDLE_MS, USER_SESSION_COOKIE } from '@/lib/auth'

const MASTER_DB_EMAIL = process.env.MASTER_DB_EMAIL || 'admin@sln.com'

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  })

  let hasMasterCookie = false
  let hasValidAppSession = false
  const appUserCookie = request.cookies.get(USER_SESSION_COOKIE)?.value
  const lastActivityCookie = request.cookies.get(SESSION_ACTIVITY_COOKIE)?.value
  if (appUserCookie) {
    try {
      const appUser = JSON.parse(decodeURIComponent(appUserCookie)) as {
        isMaster?: boolean
      }
      hasMasterCookie = appUser?.isMaster === true

      const lastActivityAt = Number(lastActivityCookie)
      hasValidAppSession = Number.isFinite(lastActivityAt) && Date.now() - lastActivityAt <= SESSION_IDLE_MS
    } catch {
      hasMasterCookie = false
      hasValidAppSession = false
    }
  }

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          )
          supabaseResponse = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          )
        },
      },
    },
  )

  let {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user && hasMasterCookie) {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: MASTER_DB_EMAIL,
      password: MASTER_CREDENTIALS.password,
    })

    if (!error) {
      user = data.user
    }
  }

  // Redireciona para login se não autenticado e tentando acessar rotas protegidas
  if (
    !hasValidAppSession &&
    !request.nextUrl.pathname.startsWith('/auth') &&
    request.nextUrl.pathname !== '/'
  ) {
    const url = request.nextUrl.clone()
    url.pathname = '/auth/login'
    const response = NextResponse.redirect(url)
    response.cookies.set(USER_SESSION_COOKIE, '', { path: '/', maxAge: 0 })
    response.cookies.set(SESSION_ACTIVITY_COOKIE, '', { path: '/', maxAge: 0 })
    return response
  }

  // Se usuário logado e na página de login, redireciona para dashboard
  if (hasValidAppSession && request.nextUrl.pathname.startsWith('/auth')) {
    const url = request.nextUrl.clone()
    url.pathname = '/dashboard'
    return NextResponse.redirect(url)
  }

  // Se usuário logado e na raiz, redireciona para dashboard
  if (hasValidAppSession && request.nextUrl.pathname === '/') {
    const url = request.nextUrl.clone()
    url.pathname = '/dashboard'
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}
