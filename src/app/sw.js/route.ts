export const dynamic = 'force-dynamic';

const LOADER = `/* LKDV service worker loader — versionné, jamais mis en cache. */
importScripts('/sw-v17.js');
`;

export function GET() {
  return new Response(LOADER, {
    status: 200,
    headers: {
      'Content-Type': 'application/javascript; charset=utf-8',
      'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
      'CDN-Cache-Control': 'no-store',
      'Cloudflare-CDN-Cache-Control': 'no-store',
    },
  });
}
