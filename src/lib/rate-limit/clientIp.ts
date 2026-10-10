/**
 * Adresse du client pour les clés « par adresse » (limites de fréquence).
 *
 * Le PREMIER saut de `x-forwarded-for` est celui que le navigateur écrit lui-même :
 * les proxys ajoutent l'adresse qu'ils voient à droite de ce qu'ils ont reçu.
 * Sur Vercel l'en-tête est réécrit (une seule adresse), mais ailleurs (aperçu
 * derrière un autre relais, essai local) lire le premier saut laisse changer de
 * clé à chaque appel. On lit donc :
 *
 *  1. sur Vercel seulement (`VERCEL`), `x-vercel-forwarded-for`, posé par la
 *     plateforme ; hors de Vercel, un navigateur peut l'écrire lui-même, il est
 *     ignoré ;
 *  2. sinon `x-forwarded-for` du DERNIER saut vers le premier : la première
 *     adresse publique est celle que notre proxy a ajoutée ; les adresses
 *     privées à sa droite sont des relais internes. Aucune adresse publique
 *     (développement local) : la plus à droite ;
 *  3. sinon `x-real-ip` (lu comme une adresse, pas comme un texte libre), sinon
 *     `inconnue`.
 */

const V4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;

function v4Octets(hop: string): number[] | null {
  const m = V4.exec(hop);
  if (!m) return null;
  const octets = m.slice(1).map(Number);
  return octets.every((n) => n <= 255) ? octets : null;
}

function isIpLike(hop: string): boolean {
  if (v4Octets(hop)) return true;
  return hop.length <= 45 && /^[0-9a-f:.]+$/i.test(hop) && (hop.match(/:/g)?.length ?? 0) >= 2;
}

/** Adresse de relais interne, de boucle locale ou de réseau privé : jamais celle d'un visiteur. */
function isPrivateHop(hop: string): boolean {
  const o = v4Octets(hop);
  if (o) {
    const [a, b] = o;
    return (
      a === 0 ||
      a === 10 ||
      a === 127 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168)
    );
  }
  const v6 = hop.toLowerCase();
  const mapped = /^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/.exec(v6);
  if (mapped) return isPrivateHop(mapped[1]);
  return v6 === '::' || v6 === '::1' || /^f[cd]/.test(v6) || /^fe[89ab]/.test(v6);
}

/** Un saut sans crochets ni port, en minuscules (certains relais écrivent `ip:port` ou `[ip]:port`). */
function normalizeHop(raw: string): string {
  const hop = raw.trim();
  const bracketed = /^\[([^\]]+)\](?::\d{1,5})?$/.exec(hop);
  if (bracketed) return bracketed[1].toLowerCase();
  const withPort = /^(\d{1,3}(?:\.\d{1,3}){3}):\d{1,5}$/.exec(hop);
  return (withPort ? withPort[1] : hop).toLowerCase();
}

/** Les sauts lisibles d'un en-tête de chaîne, dans l'ordre reçu (le plus à droite en dernier). */
function hopsOf(value: string | null): string[] {
  if (!value) return [];
  return value
    .split(',')
    .map(normalizeHop)
    .filter((hop) => hop.length > 0 && isIpLike(hop));
}

/** Le saut de notre proxy : la première adresse publique en partant de la droite. */
function proxyHop(value: string | null): string | null {
  const hops = hopsOf(value);
  for (let i = hops.length - 1; i >= 0; i -= 1) if (!isPrivateHop(hops[i])) return hops[i];
  return hops.length ? hops[hops.length - 1] : null;
}

export function clientIpFromHeaders(headers: Headers): string {
  if (process.env.VERCEL) {
    const platform = proxyHop(headers.get('x-vercel-forwarded-for'));
    if (platform) return platform;
  }
  return proxyHop(headers.get('x-forwarded-for')) ?? proxyHop(headers.get('x-real-ip')) ?? 'inconnue';
}
