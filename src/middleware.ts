import { NextRequest, NextResponse } from 'next/server';
import { getCountryCodeByName, getCountryByCode } from '@/lib/countries';

/**
 * Middleware for country page redirects
 * Handles: /pays/islande → /pays/is (301 redirect)
 */
export function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

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
  matcher: '/pays/:path*',
};
