/**
 * POC mini-chat pays — recherche d'images Unsplash (pur, testé).
 * Attribution ToS : nom du photographe + lien profil systématiques.
 * Dégradation totale : tableau vide à la moindre anomalie (clé absente,
 * HTTP non-ok, timeout 8 s, payload inattendu). Jamais de throw.
 */

export interface PaysImage {
  url: string;
  thumbUrl: string;
  alt: string;
  authorName: string;
  authorUrl: string;
}

const UNSPLASH_SEARCH_URL = 'https://api.unsplash.com/search/photos';

function normalize(item: unknown, query: string): PaysImage | null {
  const urls = (item as { urls?: { regular?: string; thumb?: string } })?.urls;
  const url = urls?.regular;
  if (typeof url !== 'string' || url.length === 0) return null;
  const user = (item as { user?: { name?: string | null; username?: string } })?.user;
  const username = user?.username ?? '';
  const rawAlt = (item as { alt_description?: string | null })?.alt_description;
  return {
    url,
    thumbUrl: urls?.thumb ?? url,
    alt: rawAlt && rawAlt.trim().length > 0 ? rawAlt : `Photo : ${query}`,
    authorName: user?.name ?? username,
    authorUrl: `https://unsplash.com/@${username}`,
  };
}

export async function searchCountryImages(
  query: string,
  opts: { perPage?: number } = {}
): Promise<PaysImage[]> {
  const apiKey = process.env.UNSPLASH_ACCESS_KEY;
  if (!apiKey) return [];
  const perPage = Math.min(Math.max(opts.perPage ?? 3, 1), 6);
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 8000);
  try {
    const res = await fetch(
      `${UNSPLASH_SEARCH_URL}?query=${encodeURIComponent(query)}&per_page=${perPage}&orientation=landscape`,
      { headers: { Authorization: `Client-ID ${apiKey}` }, signal: ctrl.signal }
    );
    if (!res.ok) return [];
    const data = await res.json();
    const results = Array.isArray(data?.results) ? data.results : [];
    const images: PaysImage[] = [];
    for (const item of results) {
      const img = normalize(item, query);
      if (img) images.push(img);
    }
    return images;
  } catch {
    return [];
  } finally {
    clearTimeout(timer);
  }
}
