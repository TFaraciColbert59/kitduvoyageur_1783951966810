/**
 * IndexNow helper (server-only).
 *
 * IndexNow permet d'avertir les moteurs (Bing, Yandex, Naver, Seznam, Yep…)
 * qu'une URL ou un ensemble d'URLs a changé, pour un indexage quasi immédiat.
 *
 * Contrat :
 *  - la clé est publique et hébergée à la racine du site : /<KEY>.txt
 *  - on POST vers https://api.indexnow.org/indexnow avec { host, key, urlList }
 *
 * Réf. Laravel (inspirant) : https://github.com/LaravelFreelancerNL/laravel-index-now
 */

// Clé publique IndexNow. Le fichier public/<KEY>.txt doit contenir exactement cette valeur.
// Pour faire tourner la clé, définir INDEXNOW_KEY et mettre à jour le fichier public portant le même nom.
const INDEXNOW_KEY = process.env.INDEXNOW_KEY || 'c1cabab20becde5282fed0916e32374e';

const INDEXNOW_ENDPOINT = 'https://api.indexnow.org/indexnow';

function getSiteHost(): string {
  const base = process.env.NEXT_PUBLIC_SITE_URL || 'https://lekitduvoyageur.fr';
  try {
    return new URL(base).host;
  } catch {
    return 'lekitduvoyageur.fr';
  }
}

export const indexNowKey = INDEXNOW_KEY;
export const indexNowHost = getSiteHost();

/**
 * Soumet des URLs à IndexNow. Seules les URLs HTTPS du même hôte que le site
 * sont acceptées (évite toute soumission arbitraire).
 */
export async function submitUrls(urls: string[]): Promise<{
  ok: boolean;
  status: number;
  body: string;
  submitted: number;
}> {
  const clean = urls
    .map((u) => String(u).trim())
    .filter((u) => {
      try {
        const parsed = new URL(u);
        return parsed.protocol === 'https:' && parsed.host === indexNowHost;
      } catch {
        return false;
      }
    });

  if (clean.length === 0) {
    return { ok: false, status: 0, body: 'Aucune URL valide (même hôte HTTPS)', submitted: 0 };
  }

  try {
    const res = await fetch(INDEXNOW_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ host: indexNowHost, key: INDEXNOW_KEY, urlList: clean }),
    });
    const body = await res.text();
    return { ok: res.ok, status: res.status, body, submitted: clean.length };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Erreur réseau IndexNow';
    return { ok: false, status: 0, body: message, submitted: clean.length };
  }
}

/**
 * Récupère toutes les URLs du sitemap.xml du site et les soumet (bootstrap).
 */
export async function submitSitemap(): Promise<{ ok: boolean; status: number; body: string; submitted: number }> {
  const base = process.env.NEXT_PUBLIC_SITE_URL || 'https://lekitduvoyageur.fr';
  try {
    const res = await fetch(`${base}/sitemap.xml`);
    if (!res.ok) {
      return { ok: false, status: res.status, body: 'sitemap.xml introuvable', submitted: 0 };
    }
    const xml = await res.text();
    const locs = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
    if (locs.length === 0) {
      return { ok: false, status: 0, body: 'Aucune <loc> dans le sitemap', submitted: 0 };
    }
    return submitUrls(locs);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Erreur récupération sitemap';
    return { ok: false, status: 0, body: message, submitted: 0 };
  }
}
