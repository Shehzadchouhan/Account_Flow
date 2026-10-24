import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

/**
 * Refreshes Supabase auth token and enforces route protection.
 * Redirects unauthenticated users to /login and authenticated users away from /login.
 */
export async function updateSession(request: NextRequest) {
  try {
    let supabaseResponse = NextResponse.next({
      request,
    })

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim()

    // If environment variables are not yet configured or empty, redirect protected routes to /login
    if (!supabaseUrl || !supabaseAnonKey || !supabaseUrl.startsWith('http')) {
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
    // Wrapped in safe try-catch to prevent 500 MIDDLEWARE_INVOCATION_FAILED if Supabase is unreachable.
    let user = null
    try {
      const { data, error } = await supabase.auth.getUser()
      if (!error && data?.user) {
        user = data.user
      }
    } catch (authError) {
      console.warn('Middleware auth verification error:', authError)
      user = null
    }

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
  } catch (fatalError) {
    console.error('Unhandled middleware error prevented from crashing:', fatalError)
    const isLoginPage = request.nextUrl.pathname === '/login'
    if (isLoginPage) {
      return NextResponse.next({ request })
    }
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }
}
