export const dynamic = 'force-dynamic';

const DEV_CLEANUP = `/* LKDV dev service worker — auto-désinscription pour ne jamais cacher /_next/static. */
self.addEventListener('install', () => { self.skipWaiting(); });
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.map((k) => caches.delete(k))))
      .then(() => self.registration.unregister())
      .then(() => self.clients.matchAll({ type: 'window' }))
      .then((clients) => Promise.all(clients.map((c) => c.navigate(c.url))))
  );
});
`;

const LOADER = `/* LKDV service worker loader — versionné, jamais mis en cache. */
importScripts('/sw-v18.js?v=dev-nocache-1');
`;

export function GET() {
  const body = process.env.NODE_ENV === 'production' ? LOADER : DEV_CLEANUP;
  return new Response(body, {
    status: 200,
    headers: {
      'Content-Type': 'application/javascript; charset=utf-8',
      'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
      'CDN-Cache-Control': 'no-store',
      'Cloudflare-CDN-Cache-Control': 'no-store',
    },
  });
}
