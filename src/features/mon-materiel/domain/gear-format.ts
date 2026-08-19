/**
 * LKDV — Mon Matériel • Domaine : formatage (poids, dates, compte à rebours).
 * Helpers purs partagés par toutes les cartes & vues plein écran.
 */

import type { PlannedHike } from '@/lib/preparation/plannedHikes';

export function formatWeight(g: number | null | undefined): string {
  const value = Number(g || 0);
  if (value >= 1000) {
    return `${(value / 1000).toLocaleString('fr-FR', { minimumFractionDigits: 1, maximumFractionDigits: 2 })} kg`;
  }
  return `${Math.round(value)} g`;
}

export function formatEuro(value: number | null | undefined): string {
  const v = Number(value || 0);
  return `${v.toLocaleString('fr-FR', { minimumFractionDigits: 0, maximumFractionDigits: 2 })} €`;
}

export function formatDateFr(value: string | null | undefined, withYear = false): string {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('fr-FR', withYear ? { day: 'numeric', month: 'short', year: 'numeric' } : { day: 'numeric', month: 'short' });
}

export function formatDateRange(h: PlannedHike): string {
  if (!h.targetDate) return 'Date à définir';
  const start = new Date(`${h.targetDate}T00:00:00`);
  if (Number.isNaN(start.getTime())) return 'Date à définir';
  const fmt = start.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
  if (h.isOvernight && h.nightsCount) {
    const end = new Date(start);
    end.setDate(end.getDate() + (h.nightsCount || 1));
    return `${fmt} → ${end.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}`;
  }
  return fmt;
}

/**
 * Compte à rebours en jours par rapport à aujourd'hui.
 * `null` si la date est absente/invalide.
 */
export function daysUntil(targetDate?: string | null): number | null {
  if (!targetDate) return null;
  const target = new Date(`${targetDate.slice(0, 10)}T00:00:00`);
  if (Number.isNaN(target.getTime())) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((target.getTime() - today.getTime()) / 86400000);
}

/** Libellé lisible d'un compte à rebours (J-X, J+0…). */
export function countdownLabel(targetDate?: string | null): string {
  const d = daysUntil(targetDate);
  if (d === null) return 'Date à définir';
  if (d < 0) return `J+${Math.abs(d)}`;
  if (d === 0) return "Aujourd'hui";
  return `J-${d}`;
}

export function formatTemp(h: PlannedHike): string {
  const w = h.weather;
  if (w && typeof w.tempC === 'number') return `${Math.round(w.tempC)}°C`;
  return '—';
}

export function formatWeather(h: PlannedHike): string {
  if (h.weather && h.weather.condition) return h.weather.condition;
  return 'Prévisions non disponibles';
}

export function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

export function pct(part: number, total: number): number {
  if (total <= 0) return 0;
  return clamp(Math.round((part / total) * 100), 0, 100);
}