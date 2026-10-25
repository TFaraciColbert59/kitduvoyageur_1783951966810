import { formatDate, formatNumber } from '@/lib/i18n/format';
import type { Locale } from '@/lib/i18n/locale';
import { plural, type TranslationKey } from '@/lib/i18n/translate';
import { engineT } from './engineI18n';

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

export function teamCountLabel(c: TeamCount, locale: Locale = 'fr'): string {
  const t = engineT(locale);
  const n = (count: number) => formatNumber(count, {}, locale);
  const parts = [
    t(plural(locale, c.present, { one: 'compas.engine.team.presentOne', other: 'compas.engine.team.presentOther' }) as TranslationKey, {
      count: n(c.present),
    }),
  ];
  if (c.pending) parts.push(t('compas.engine.team.pending', { count: n(c.pending) }));
  if (c.free) {
    parts.push(
      t(plural(locale, c.free, { one: 'compas.engine.team.freeOne', other: 'compas.engine.team.freeOther' }) as TranslationKey, {
        count: n(c.free),
      })
    );
  }
  parts.push(t('compas.engine.team.total', { count: n(c.total) }));
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

const DAY_MONTH: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', timeZone: 'UTC' };

/** « 10 oct. → 12 oct. » (« Oct 10 → Oct 12 ») : dates ISO du voyage, null sans date. */
export function invitationDates(
  start: string | null,
  end: string | null,
  locale: Locale = 'fr'
): string | null {
  if (!start) return null;
  const fmt = (iso: string) => formatDate(new Date(`${iso}T12:00:00Z`), DAY_MONTH, locale);
  const a = fmt(start);
  if (!end || end === start) return a;
  return `${a} → ${fmt(end)}`;
}
