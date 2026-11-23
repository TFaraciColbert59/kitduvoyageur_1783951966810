/* LKDV — fond de carte hors ligne du corridor d'un itinéraire (2.10).
 *
 * Chargé par `sw-v18.js` (importScripts). Les caches `lkdv-route-tiles:<espace>:v<n>:<horodatage>` sont écrits PAR LA
 * PAGE (src/features/route-collab/offlineTiles.ts) : style, TileJSON, pictogrammes, glyphes et tuiles vectorielles
 * d'OpenFreeMap. Ici, une seule règle : une requête GET vers ce fournisseur est servie depuis la copie du corridor
 * si elle y est (aussi en ligne : pas de réseau pour ce qui est déjà gardé), sinon par le réseau. Rien n'est mis
 * en cache à la volée : seule la copie téléchargée et contrôlée par la page existe.
 */
const ROUTE_TILE_CACHE_PREFIX = 'lkdv-route-tiles:';
const ROUTE_TILE_HOSTS = ['tiles.openfreemap.org'];

async function routeTilesLookup(request) {
  try {
    const keys = (await caches.keys()).filter((k) => k.startsWith(ROUTE_TILE_CACHE_PREFIX));
    // La copie la plus récente d'abord (le nom finit par l'horodatage de création).
    keys.sort().reverse();
    for (const k of keys) {
      const hit = await (await caches.open(k)).match(request.url);
      if (hit) return hit;
    }
  } catch {
    /* cache illisible : le réseau prend le relais */
  }
  return null;
}

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;
  let host = '';
  try {
    host = new URL(request.url).hostname;
  } catch {
    return;
  }
  if (!ROUTE_TILE_HOSTS.includes(host)) return;
  event.respondWith(
    (async () => {
      const hit = await routeTilesLookup(request);
      if (hit) return hit;
      try {
        return await fetch(request);
      } catch {
        return new Response('', { status: 504 });
      }
    })()
  );
});
