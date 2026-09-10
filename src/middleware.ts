import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { getCountryCodeByName, getCountryByCode } from '@/lib/countries';
import { resolveLegacyRedirect } from '@/lib/hub/hubRedirects';

const PROTECTED_ROUTES = ['/admin', '/checkout'];
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

  // ─── Mobile landing redirect to the hub ────────────────────────────────────
  if (pathname === '/') {
    const userAgent = request.headers.get('user-agent') || '';
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(userAgent);
    if (isMobile) {
      const url = request.nextUrl.clone();
      url.pathname = '/hub';
      return NextResponse.redirect(url, { status: 302 });
    }
  }

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

  // ─── H5/H-AUTO-42 : redirects 307 du hub (matrice pur, testée) ────────────────
  // La table statique + le cas dynamique /materiel/depart/[id] vivent dans
  // src/lib/hub/hubRedirects.ts (resolver pur). Le clone d'URL conserve la
  // query d'origine (?route=… etc.) ; seuls les params posés sont ajoutés.
  const legacy = resolveLegacyRedirect(pathname);
  if (legacy) {
    const url = request.nextUrl.clone();
    url.pathname = legacy.destination;
    for (const [key, value] of Object.entries(legacy.setParams ?? {})) {
      url.searchParams.set(key, value);
    }
    // H5.3 — Télémétrie héritage : source + cible sur chaque 307.
    const redirect = NextResponse.redirect(url, { status: 307 });
    redirect.headers.set('x-hub-redirect-source', pathname);
    redirect.headers.set('x-hub-redirect-target', `${url.pathname}${url.search}`);
    return redirect;
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
    '/',
    '/admin',
    '/admin/:path*',
    '/checkout/:path*',
    '/compte/:path*',
    '/kits',
    '/pays/:path*',
    // H5/H-AUTO-42 : chemins redirigés (le matcher explicite est requis, sinon
    // le redirect ne tire jamais). Littéral obligatoire : Next refuse le spread
    // dans config.matcher — la synchro avec LEGACY_REDIRECTS est testée
    // (tests/features/hub/hubRedirects.spec.ts, INV-5).
    '/materiel',
    '/materiel/inventaire',
    '/materiel/kits',
    '/materiel/preparation',
    '/materiel/depart',
    '/materiel/depart/:path*',
    '/materiel/disponibilite',
    '/materiel/alertes',
    '/materiel/forget',
    // Étape 2 — Hub unique : pages séparées supprimées
    '/voyages',
    '/voyages/nouveau',
    '/groupes',
    '/groupes/:path*',
    '/equipages',
    '/equipages/:path*',
    '/preparation',
    '/alertes',
    '/terrain',
    '/mes-aventures',
    '/recommandations',
    '/naviguer',
    '/boussole',
    '/rapport-kit',
    '/activite',
    '/gamification',
    '/encheres',
  ],
};