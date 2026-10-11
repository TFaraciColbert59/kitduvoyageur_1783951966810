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
 *
 * La clé d'une adresse IPv6 publique est son préfixe /64 (forme « :: » développée, quatre
 * premiers groupes, ex. `2001:db8:1:2::/64`) : le plus petit bloc qu'un abonné reçoit, dans
 * lequel il change d'adresse à volonté. Une adresse IPv4-mappée (`::ffff:a.b.c.d`) vaut son IPv4.
 */

const V4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;
const HEXTET = /^[0-9a-f]{1,4}$/;

function v4Octets(hop: string): number[] | null {
  const m = V4.exec(hop);
  if (!m) return null;
  const octets = m.slice(1).map(Number);
  return octets.every((n) => n <= 255) ? octets : null;
}

/**
 * Les huit groupes de 16 bits d'une adresse IPv6 (forme « :: » développée, IPv4 finale
 * convertie en deux groupes), null si le texte n'en est pas une.
 */
function v6Groups(hop: string): number[] | null {
  if (hop.length > 45 || !/^[0-9a-f:.]+$/.test(hop) || (hop.match(/:/g)?.length ?? 0) < 2) return null;
  let text = hop;
  const tail = hop.slice(hop.lastIndexOf(':') + 1);
  if (tail.includes('.')) {
    const o = v4Octets(tail);
    if (!o) return null;
    text = `${hop.slice(0, hop.lastIndexOf(':') + 1)}${((o[0] << 8) | o[1]).toString(16)}:${((o[2] << 8) | o[3]).toString(16)}`;
  }
  const halves = text.split('::');
  if (halves.length > 2) return null;
  const read = (part: string) => (part === '' ? [] : part.split(':'));
  const head = read(halves[0]);
  const rest = halves.length === 2 ? read(halves[1]) : [];
  const missing = 8 - head.length - rest.length;
  if (halves.length === 1 ? missing !== 0 : missing < 1) return null;
  const groups = [...head, ...Array<string>(halves.length === 2 ? missing : 0).fill('0'), ...rest];
  return groups.every((g) => HEXTET.test(g)) ? groups.map((g) => parseInt(g, 16)) : null;
}

/** L'IPv4 que porte une adresse IPv6 « IPv4-mappée » (::ffff:a.b.c.d, en toute graphie), sinon null. */
function mappedV4(g: number[]): string | null {
  if (g.slice(0, 5).some((x) => x !== 0) || g[5] !== 0xffff) return null;
  return [g[6] >> 8, g[6] & 0xff, g[7] >> 8, g[7] & 0xff].join('.');
}

function isPrivateV4(o: number[]): boolean {
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

/** Boucle locale, non spécifiée, locale unique (fc00::/7) ou de lien (fe80::/10) : jamais un visiteur. */
function isPrivateV6(g: number[]): boolean {
  const loopbackOrAny = g.slice(0, 7).every((x) => x === 0) && g[7] <= 1;
  return loopbackOrAny || (g[0] & 0xfe00) === 0xfc00 || (g[0] & 0xffc0) === 0xfe80;
}

/** Un saut sans crochets, port ni identifiant de zone, en minuscules (certains relais écrivent `ip:port`, `[ip]:port`, `ip%eth0`). */
function normalizeHop(raw: string): string {
  const hop = raw.trim();
  const bracketed = /^\[([^\]]+)\](?::\d{1,5})?$/.exec(hop);
  const withPort = /^(\d{1,3}(?:\.\d{1,3}){3}):\d{1,5}$/.exec(hop);
  const bare = bracketed ? bracketed[1] : withPort ? withPort[1] : hop;
  return bare.replace(/%[^%\s]*$/, '').toLowerCase();
}

/**
 * Un saut lisible : sa clé et s'il est interne. Une adresse IPv4-mappée vaut son IPv4 ; une
 * adresse IPv6 publique vaut son préfixe /64 (une personne ou un réseau reçoit au moins un /64
 * et change d'adresse à chaque requête sans le quitter : la clé entière laissait contourner
 * toute limite « par adresse »). Les adresses internes restent entières (développement local).
 */
function readHop(raw: string): { key: string; internal: boolean } | null {
  const hop = normalizeHop(raw);
  const v4 = v4Octets(hop);
  if (v4) return { key: hop, internal: isPrivateV4(v4) };
  const g = v6Groups(hop);
  if (!g) return null;
  const mapped = mappedV4(g);
  if (mapped) return { key: mapped, internal: isPrivateV4(mapped.split('.').map(Number)) };
  if (isPrivateV6(g)) return { key: hop, internal: true };
  return { key: `${g.slice(0, 4).map((x) => x.toString(16)).join(':')}::/64`, internal: false };
}

/** Les sauts lisibles d'un en-tête de chaîne, dans l'ordre reçu (le plus à droite en dernier). */
function hopsOf(value: string | null): Array<{ key: string; internal: boolean }> {
  if (!value) return [];
  return value.split(',').flatMap((raw) => {
    const hop = readHop(raw);
    return hop ? [hop] : [];
  });
}

/** Le saut de notre proxy : la première adresse publique en partant de la droite. */
function proxyHop(value: string | null): string | null {
  const hops = hopsOf(value);
  for (let i = hops.length - 1; i >= 0; i -= 1) if (!hops[i].internal) return hops[i].key;
  return hops.length ? hops[hops.length - 1].key : null;
}

export function clientIpFromHeaders(headers: Headers): string {
  if (process.env.VERCEL) {
    const platform = proxyHop(headers.get('x-vercel-forwarded-for'));
    if (platform) return platform;
  }
  return proxyHop(headers.get('x-forwarded-for')) ?? proxyHop(headers.get('x-real-ip')) ?? 'inconnue';
}
