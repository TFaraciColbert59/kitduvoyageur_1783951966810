import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { getCountryCodeByName, getCountryByCode } from '@/lib/countries';

const PROTECTED_ROUTES = ['/admin', '/checkout', '/messagerie'];
const ADMIN_ROUTES = ['/admin'];

function isProtected(pathname: string) {
  return PROTECTED_ROUTES.some(
    (r) => pathname === r || pathname.startsWith(r + '/')
  );
}

function isAdmin(pathname: string) {
  return ADMIN_ROUTES.some(
    (r) => pathname === r || pathname.startsWith(r + '/')
  );
}

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  // ─── Auth protection ──────────────────────────────────────────────────────
  if (isProtected(pathname)) {
    let response = NextResponse.next({ request });

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll();
          },
          setAll(cookiesToSet: any[]) {
            cookiesToSet.forEach(({ name, value }: any) =>
              request.cookies.set(name, value)
            );
            response = NextResponse.next({ request });
            cookiesToSet.forEach(({ name, value, options }: any) =>
              response.cookies.set(name, value, options)
            );
          },
        },
      }
    );

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      const loginUrl = request.nextUrl.clone();
      loginUrl.pathname = '/connexion';
      loginUrl.searchParams.set('redirect', pathname);
      return NextResponse.redirect(loginUrl);
    }

        // Admin routes: verify role
    if (isAdmin(pathname)) {
      const { data: isAdminRole } = await supabase.rpc('is_admin');

      if (!isAdminRole) {
        const homeUrl = request.nextUrl.clone();
        homeUrl.pathname = '/';
        return NextResponse.redirect(homeUrl);
      }
    }

    return response;
  }

  // ─── /catalogue → /boutique redirects (301) ──────────────────────────────────
  if (pathname === '/catalogue' || pathname.startsWith('/catalogue/')) {
    const url = request.nextUrl.clone();
    url.pathname = '/boutique';
    return NextResponse.redirect(url, { status: 301 });
  }

  // ─── /kits → /boutique?type=kit redirect (301) ───────────────────────────────
  if (pathname === '/kits') {
    const url = request.nextUrl.clone();
    url.pathname = '/boutique';
    url.searchParams.set('type', 'kit');
    return NextResponse.redirect(url, { status: 301 });
  }

  // ─── Country redirect logic ───────────────────────────────────────────────
  const paysMatch = pathname.match(/^\/pays\/([a-zà-ü-]+)$/i);
  if (paysMatch) {
    const slug = paysMatch[1];

    if (slug.length === 2) {
      const country = getCountryByCode(slug);
      if (country) {
        return NextResponse.next();
      }
    }

    const code = getCountryCodeByName(slug);
    if (code) {
      const url = request.nextUrl.clone();
      url.pathname = `/pays/${code.toLowerCase()}`;
      return NextResponse.redirect(url, { status: 301 });
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/admin',
    '/admin/:path*',
    '/checkout/:path*',
    '/compte/:path*',
    '/messagerie/:path*',
    '/kits',
    '/pays/:path*',
  ],
};