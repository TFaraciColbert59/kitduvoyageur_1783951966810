import type maplibregl from 'maplibre-gl';

/**
 * Débit des tuiles Maptoolkit (TOS §9).
 *
 * La limite Community non enregistrée est de **10 requêtes non cachées/s**.
 * MapLibre ne plafonne que les images (`setMaxParallelImageRequests`) : les
 * tuiles vectorielles partent du worker sans limite et déclenchent des 429.
 *
 * On enregistre donc un protocole `lkdv-mtk://` qui pointe **exactement** sur
 * les URLs officielles (aucun proxy, aucune copie : le TOS l'exige) et les
 * délivre via un seau à jetons. Le style ne doit jamais être servi depuis un
 * autre fournisseur : seule la cadence change.
 */

export interface ThrottleOptions {
  /** Requêtes par seconde (8 laisse une marge sous la limite de 10). */
  perSecond?: number;
}

/** Seau à jetons partagé : un seul débit pour toutes les instances de carte. */
class TokenBucket {
  private tokens: number;
  private readonly capacity: number;
  private readonly refillMs: number;
  private last = Date.now();
  private waiting: Array<() => void> = [];

  constructor(perSecond: number) {
    this.capacity = Math.max(1, Math.floor(perSecond));
    this.tokens = this.capacity;
    this.refillMs = 1000 / perSecond;
  }

  async take(): Promise<void> {
    const now = Date.now();
    const elapsed = now - this.last;
    const refilled = Math.floor(elapsed / this.refillMs);
    if (refilled > 0) {
      this.tokens = Math.min(this.capacity, this.tokens + refilled);
      this.last = now;
    }
    if (this.tokens > 0) {
      this.tokens -= 1;
      return;
    }
    await new Promise<void>((resolve) => {
      this.waiting.push(resolve);
      window.setTimeout(() => {
        const next = this.waiting.shift();
        if (next) {
          this.tokens = Math.min(this.capacity, this.tokens + 1);
          next();
        }
      }, this.refillMs);
    });
  }
}

let bucket: TokenBucket | null = null;

/** Préfixe d'URL interne : `lkdv-mtk://tiles.maptoolkit.org/...`. */
export const THROTTLE_PROTOCOL = 'lkdv-mtk';

export function throttleUrl(url: string): string {
  if (!url.startsWith('https://')) return url;
  return `${THROTTLE_PROTOCOL}://${url.slice('https://'.length)}`;
}

export function unthrottleUrl(url: string): string {
  return url.startsWith(`${THROTTLE_PROTOCOL}://`)
    ? `https://${url.slice(`${THROTTLE_PROTOCOL}://`.length)}`
    : url;
}

/** Vrai pour les hôtes Maptoolkit (tuiles, glyphes, sprites). */
export function isMaptoolkitUrl(url: string): boolean {
  return /^https:\/\/(tiles|fonts|icons)\.maptoolkit\.org\//.test(url);
}

/**
 * Installe le protocole une seule fois. Renvoie le nombre de jetons par seconde
 * effectif (utile aux tests et au diagnostic).
 */
export function installThrottleProtocol(
  maplibre: typeof maplibregl,
  options: ThrottleOptions = {},
): number {
  const perSecond = options.perSecond ?? 8;
  if (!bucket) bucket = new TokenBucket(perSecond);

  const registry = (maplibre as unknown as { getProtocol?: (name: string) => unknown }).getProtocol;
  if (typeof registry === 'function' && registry(THROTTLE_PROTOCOL)) return perSecond;

  maplibre.addProtocol(THROTTLE_PROTOCOL, async (params, abortController) => {
    const url = unthrottleUrl(params.url);
    await bucket?.take();
    const response = await fetch(url, { signal: abortController.signal });
    if (!response.ok) throw new Error(`${response.status} ${url}`);
    // Une TileJSON doit rester du texte JSON : la rendre en ArrayBuffer casse
    // le chargement de la source sans message (constaté : 0 tuile demandée).
    const isJson = /\.json(\?|$)/i.test(url);
    return isJson ? { data: await response.text() } : { data: await response.arrayBuffer() };
  });
  return perSecond;
}

/**
 * Réécrit les sources Maptoolkit d'un style pour passer par le protocole
 * throttlé. Les URLs finales restent celles de Maptoolkit.
 */
export function throttleStyleSources<T extends { sources: Record<string, unknown> }>(style: T): T {
  const sources: Record<string, unknown> = {};
  for (const [name, source] of Object.entries(style.sources)) {
    const candidate = source as { url?: string; tiles?: string[] };
    if (candidate.url && isMaptoolkitUrl(candidate.url)) {
      sources[name] = { ...candidate, url: throttleUrl(candidate.url) };
      continue;
    }
    if (candidate.tiles?.length && candidate.tiles.every(isMaptoolkitUrl)) {
      sources[name] = { ...candidate, tiles: candidate.tiles.map(throttleUrl) };
      continue;
    }
    sources[name] = source;
  }
  return { ...style, sources };
}
