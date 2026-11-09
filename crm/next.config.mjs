/** @type {import('next').NextConfig} */
const supabaseHost = (() => {
  try { return new URL(process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://supabase.invalid').host } catch { return 'supabase.invalid' }
})();

const csp = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "form-action 'self'",
  "img-src 'self' data: blob: https://*.supabase.co",
  "font-src 'self' data: https://fonts.gstatic.com",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  process.env.CRM_CSP_DEV === '1' || process.env.NODE_ENV === 'development' ? "script-src 'self' 'unsafe-eval' 'unsafe-inline'" : "script-src 'self' 'unsafe-inline'",
  `connect-src 'self' https://${supabaseHost} wss://${supabaseHost} https://api.stripe.com`,
  "worker-src 'self' blob:"
].join('; ');

const securityHeaders = [
  { key: 'Content-Security-Policy', value: csp },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Referrer-Policy', value: 'no-referrer' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=()' },
  { key: 'X-Robots-Tag', value: 'noindex, nofollow' },
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains' }
];

const nextConfig = {
  reactStrictMode: true,
  devIndicators: false,
  outputFileTracingRoot: new URL('.', import.meta.url).pathname,
  poweredByHeader: false,
  transpilePackages: [],
  typedRoutes: false,
  async headers() {
    return [
      { source: '/:path*', headers: securityHeaders },
      { source: '/robots.txt', headers: [{ key: 'X-Robots-Tag', value: 'noindex, nofollow' }] }
    ];
  }
};

export default nextConfig;
