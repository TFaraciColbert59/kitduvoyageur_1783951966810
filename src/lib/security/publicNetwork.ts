/**
 * A-215 — Garde SSRF pour les aperçus de liens (route /api/og-preview).
 *
 * Trois niveaux :
 *   1. URL http(s) uniquement, sans identifiants embarqués ;
 *   2. hôte littéral (IPv4/IPv6) refusé s'il est privé/loopback/link-local ;
 *   3. hôtes nommés : résolution DNS et refus si UNE des adresses est privée
 *      (anti DNS-rebinding), puis CHAQUE saut de redirection revalidé.
 */

const BLOCKED_HOSTNAMES = new Set([
  'localhost',
  'localhost.localdomain',
  '0.0.0.0',
  'metadata.google.internal',
  'metadata.google',
]);

export function isPrivateAddress(address: string): boolean {
  const ip = address.trim().toLowerCase();
  if (!ip) return true;

  // IPv6
  if (ip.includes(':')) {
    if (ip === '::' || ip === '::1') return true;
    if (ip.startsWith('fe8') || ip.startsWith('fe9') || ip.startsWith('fea') || ip.startsWith('feb')) return true; // link-local
    if (ip.startsWith('fc') || ip.startsWith('fd')) return true; // unique local
    // IPv4 mappée ::ffff:... (forme pointée OU hexadécimale normalisée par WHATWG)
    const mapped = ip.match(/^::ffff:(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/);
    if (mapped) return isPrivateAddress(mapped[1]);
    const mappedHex = ip.match(/^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/);
    if (mappedHex) {
      const hi = parseInt(mappedHex[1], 16);
      const lo = parseInt(mappedHex[2], 16);
      return isPrivateAddress(`${hi >> 8}.${hi & 255}.${lo >> 8}.${lo & 255}`);
    }
    return false;
  }

  // IPv4
  const match = ip.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!match) return false; // hôte nommé : géré par la résolution DNS
  const [a, b] = [Number(match[1]), Number(match[2])];
  if (a === 0 || a === 10 || a === 127) return true;
  if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT
  if (a === 169 && b === 254) return true; // link-local
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 198 && (b === 18 || b === 19)) return true; // benchmarks
  if (a >= 224) return true; // multicast + réservé
  return false;
}

export type PublicUrlResult =
  | { ok: true; url: URL }
  | { ok: false; status: number; error: string };

export function parsePublicHttpUrl(rawUrl: string): PublicUrlResult {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return { ok: false, status: 400, error: 'URL invalide' };
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return { ok: false, status: 400, error: 'Protocole non supporté' };
  }

  if (parsed.username || parsed.password) {
    return { ok: false, status: 400, error: 'Identifiants embarqués refusés' };
  }

  const hostname = parsed.hostname.toLowerCase();

  if (BLOCKED_HOSTNAMES.has(hostname) || hostname.endsWith('.local') || hostname.endsWith('.internal')) {
    return { ok: false, status: 403, error: 'Adresse privée non autorisée' };
  }

  // Hôte littéral (IPv4 normalisé par WHATWG, ou IPv6 entre crochets) :
  // .hostname retire les crochets IPv6 uniquement sur Node récent ; on gère les deux.
  const literal = hostname.replace(/^\[|\]$/g, '');
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(literal) || literal.includes(':')) {
    if (isPrivateAddress(literal)) {
      return { ok: false, status: 403, error: 'Adresse privée non autorisée' };
    }
  }

  return { ok: true, url: parsed };
}

export type Lookup = (hostname: string) => Promise<string[]>;

export async function assertHostResolvesPublic(
  hostname: string,
  lookup: Lookup
): Promise<PublicUrlResult | { ok: true }> {
  const literal = hostname.replace(/^\[|\]$/g, '');
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(literal) || literal.includes(':')) {
    return { ok: true };
  }

  let addresses: string[];
  try {
    addresses = await lookup(hostname);
  } catch {
    return { ok: false, status: 400, error: 'Hôte introuvable' };
  }

  if (addresses.length === 0 || addresses.some((addr) => isPrivateAddress(addr))) {
    return { ok: false, status: 403, error: 'Adresse privée non autorisée' };
  }

  return { ok: true };
}
