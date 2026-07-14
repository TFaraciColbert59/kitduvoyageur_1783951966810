import { NextRequest, NextResponse } from 'next/server';
import { getCountryCodeByName, getCountryByCode } from '@/lib/countries';

/**
 * Middleware for:
 * 1. Country page redirects: /pays/islande → /pays/is (301)
 * 2. Shop redirects: /catalogue/* → /shop/* (301)
 * 3. Kits redirects: /kits → /shop?type=kit (301)
 */
export function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  // ─── /catalogue → /shop redirects (301) ──────────────────────────────────
  if (pathname === '/catalogue' || pathname.startsWith('/catalogue/')) {
    const url = request.nextUrl.clone();
    url.pathname = pathname.replace(/^\/catalogue/, '/shop');
    return NextResponse.redirect(url, { status: 301 });
  }

  // ─── /kits → /shop?type=kit redirect (301) ───────────────────────────────
  if (pathname === '/kits') {
    const url = request.nextUrl.clone();
    url.pathname = '/shop';
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
  matcher: ['/catalogue/:path*', '/kits', '/pays/:path*'],
};
