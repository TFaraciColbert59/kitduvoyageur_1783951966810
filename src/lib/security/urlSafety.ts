const IPV4_RE = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;

function isBlockedIpv4(hostname: string): boolean {
  const match = hostname.match(IPV4_RE);
  if (!match) return false;
  const octets = match.slice(1).map(Number);
  if (octets.some((o) => o > 255)) return true;
  const [a, b] = octets;

  if (a === 0) return true;
  if (a === 10) return true;
  if (a === 127) return true;
  if (a === 100 && b >= 64 && b <= 127) return true;
  if (a === 169 && b === 254) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 192 && b === 0) return true;
  if (a === 198 && (b === 18 || b === 19)) return true;
  if (a >= 224) return true;
  return false;
}

function mappedIpv4FromHex(tail: string): string | null {
  const parts = tail.split(':');
  if (parts.length === 1) {
    const n = parseInt(parts[0], 16);
    if (!Number.isFinite(n)) return null;
    return `${(n >>> 24) & 255}.${(n >>> 16) & 255}.${(n >>> 8) & 255}.${n & 255}`;
  }
  if (parts.length === 2) {
    const hi = parseInt(parts[0], 16);
    const lo = parseInt(parts[1], 16);
    if (!Number.isFinite(hi) || !Number.isFinite(lo)) return null;
    return `${(hi >>> 8) & 255}.${hi & 255}.${(lo >>> 8) & 255}.${lo & 255}`;
  }
  return null;
}

function isBlockedIpv6(hostname: string): boolean {
  if (!hostname.startsWith('[') || !hostname.endsWith(']')) return false;
  const address = hostname.slice(1, -1).toLowerCase();

  if (address === '::' || address === '::1') return true;
  if (/^fe[89ab]/.test(address)) return true;
  if (/^f[cd]/.test(address)) return true;
  if (address.startsWith('::ffff:')) {
    const tail = address.slice('::ffff:'.length);
    if (tail.includes('.')) return isBlockedIpv4(tail);
    const dotted = mappedIpv4FromHex(tail);
    return dotted ? isBlockedIpv4(dotted) : true;
  }
  if (address.startsWith('64:ff9b:')) return true;
  return false;
}

/**
 * Refus par défaut pour toute destination serveur non publique :
 * schéma hors http(s), hôtes locaux, IP littérales privées/loopback/link-local
 * (IPv4 ET IPv6, y compris IPv4-mappé). Les noms DNS ne sont pas résolus ici
 * (limite documentée : la résolution/rebinding doit être traitée par l'appelant
 * ou par une allowlist de destinations).
 */
export function isBlockedRequestTarget(rawUrl: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return true;
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return true;

  const hostname = parsed.hostname.toLowerCase();
  if (!hostname) return true;
  if (hostname === 'localhost' || hostname.endsWith('.localhost')) return true;
  if (hostname.endsWith('.local') || hostname.endsWith('.internal')) return true;

  if (hostname.startsWith('[')) return isBlockedIpv6(hostname);
  if (IPV4_RE.test(hostname)) return isBlockedIpv4(hostname);
  return false;
}
