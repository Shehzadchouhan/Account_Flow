import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

/**
 * Refreshes Supabase auth token and enforces route protection.
 * Redirects unauthenticated users to /login and authenticated users away from /login.
 */
export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  })

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  // If environment variables are not yet configured, redirect protected routes to /login
  if (!supabaseUrl || !supabaseAnonKey) {
    const isPublic = request.nextUrl.pathname === '/login'
    const isApi = request.nextUrl.pathname.startsWith('/api')
    if (!isPublic) {
      if (isApi) {
        return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
      }
      const url = request.nextUrl.clone()
      url.pathname = '/login'
      return NextResponse.redirect(url)
    }
    return supabaseResponse
  }

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll()
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
        supabaseResponse = NextResponse.next({
          request,
        })
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, options)
        )
      },
    },
  })

  // IMPORTANT: getUser() validates and refreshes the user session against Supabase Auth.
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const pathname = request.nextUrl.pathname
  const isLoginPage = pathname === '/login'
  const isAuthRoute = pathname.startsWith('/auth')
  const isApiRoute = pathname.startsWith('/api')

  // Unauthenticated user attempting to access protected route
  if (!user && !isLoginPage && !isAuthRoute) {
    if (isApiRoute) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    // Preserve attempted destination as redirect parameter if needed
    return NextResponse.redirect(url)
  }

  // Authenticated user attempting to visit login page -> redirect to dashboard (/)
  if (user && isLoginPage) {
    const url = request.nextUrl.clone()
    url.pathname = '/'
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}
