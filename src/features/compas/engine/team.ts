/**
 * Compteur de l'équipe (Nous) : présents · en attente · places libres · total.
 * Le total est la taille prévue du groupe, sauf si l'équipe la dépasse déjà.
 */
export interface TeamCount {
  present: number;
  pending: number;
  free: number;
  total: number;
}

export function teamCount(size: number, present: number, pending: number): TeamCount {
  const p = Math.max(0, Math.floor(present));
  const w = Math.max(0, Math.floor(pending));
  const total = Math.max(Math.floor(size) || 0, p + w, 1);
  return { present: p, pending: w, free: total - p - w, total };
}

export function teamCountLabel(c: TeamCount): string {
  const parts = [`${c.present} présent${c.present > 1 ? 's' : ''}`];
  if (c.pending) parts.push(`${c.pending} en attente`);
  if (c.free) parts.push(`${c.free} place${c.free > 1 ? 's' : ''} libre${c.free > 1 ? 's' : ''}`);
  parts.push(`${c.total} au total`);
  return parts.join(' · ');
}

/** Invitation envoyée, en attente de réponse. */
export interface CompasPendingInvite {
  id: string;
  userId: string | null;
  name: string;
  avatarUrl: string | null;
  role: 'editor' | 'viewer';
  createdAt: string;
}

const fmt = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short', timeZone: 'UTC' });

/** « 10 oct. → 12 oct. » (dates ISO du voyage), null sans date. */
export function invitationDates(start: string | null, end: string | null): string | null {
  if (!start) return null;
  const a = fmt.format(new Date(`${start}T12:00:00Z`));
  if (!end || end === start) return a;
  return `${a} → ${fmt.format(new Date(`${end}T12:00:00Z`))}`;
}
