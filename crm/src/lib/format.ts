export function firstName(name: string | null | undefined): string {
  if (!name) return 'non renseigné';
  return name.trim().split(/\s+/)[0] ?? 'non renseigné';
}

export function euros(cents: number | null | undefined): string {
  if (cents === null || cents === undefined || !Number.isFinite(cents)) return 'non renseigné';
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(cents / 100);
}

export function relativeFr(iso: string | null | undefined, now = Date.now()): string {
  if (!iso) return 'non renseigné';
  const diff = now - Date.parse(iso);
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
