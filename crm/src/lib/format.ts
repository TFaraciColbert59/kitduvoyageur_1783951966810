export function firstName(name: string | null | undefined): string {
  const first = name?.trim().split(/\s+/)[0];
  return first || 'non renseigné';
}

export function euros(cents: number | null | undefined): string {
  if (cents === null || cents === undefined || !Number.isFinite(cents)) return 'non renseigné';
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(cents / 100);
}

export function relativeFr(iso: string | null | undefined, now = Date.now()): string {
  if (!iso) return 'non renseigné';
  const diff = now - Date.parse(iso);
  if (diff < 0) {
    const ahead = Math.abs(diff);
    const m = Math.round(ahead / 60_000);
    if (m < 1) return 'dans un instant';
    if (m < 60) return `dans ${m} min`;
    const h = Math.round(m / 60);
    if (h < 24) return `dans ${h} h`;
    const d = Math.round(h / 24);
    return d === 1 ? 'demain' : `dans ${d} j`;
  }
  const min = Math.round(diff / 60_000);
  if (min < 1) return "à l'instant";
  if (min < 60) return `il y a ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `il y a ${h} h`;
  const d = Math.round(h / 24);
  if (d === 1) return 'hier';
  if (d < 31) return `il y a ${d} j`;
  return new Intl.DateTimeFormat('fr-FR', { dateStyle: 'medium' }).format(new Date(iso));
}

export function maskEmail(email: string | null | undefined): string {
  if (!email || !email.includes('@')) return 'non renseigné';
  const [local, domain] = email.split('@');
  return `${local.slice(0, 2)}•••@${domain}`;
}
