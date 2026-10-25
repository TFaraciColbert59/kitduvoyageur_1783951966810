/**
 * Moteur mobile Carnet/Journal (sortie) — pur, testable sans DOM.
 * Stats du carnet, tri (épinglées d'abord), jours couverts, temps relatif.
 */

export interface JournalNoteLike {
  id: string;
  day_number?: number | null;
  is_pinned?: boolean | null;
  created_at: string;
  updated_at?: string | null;
}

export interface JournalStats {
  total: number;
  pinned: number;
  daysTold: number;
  progressPct: number;
  lastCreatedAt: string | null;
}

export function availableNoteDays(notes: JournalNoteLike[]): number[] {
  return Array.from(
    new Set(
      notes
        .map((note) => note.day_number)
        .filter((day): day is number => typeof day === 'number' && Number.isFinite(day))
    )
  ).sort((a, b) => a - b);
}

export function buildJournalStats(notes: JournalNoteLike[], totalTripDays: number): JournalStats {
  const lastCreatedAt =
    notes.length > 0
      ? [...notes].sort(
          (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        )[0].created_at
      : null;

  return {
    total: notes.length,
    pinned: notes.filter((note) => !!note.is_pinned).length,
    daysTold: availableNoteDays(notes).length,
    progressPct:
      totalTripDays > 0
        ? Math.min(100, Math.round((availableNoteDays(notes).length / totalTripDays) * 100))
        : 0,
    lastCreatedAt,
  };
}

/** Épinglées d'abord, puis les plus récentes. */
export function sortJournalNotes<T extends JournalNoteLike>(notes: T[]): T[] {
  return [...notes].sort((a, b) => {
    const pinDiff = Number(!!b.is_pinned) - Number(!!a.is_pinned);
    if (pinDiff !== 0) return pinDiff;
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });
}

export function notesForDay<T extends JournalNoteLike>(notes: T[], day: number): T[] {
  return notes.filter((note) => note.day_number === day);
}

/** Temps relatif compact fr (« il y a 3 heures », « hier »). */
export function formatRelativeTime(dateIso: string, now: Date = new Date()): string {
  const date = new Date(dateIso);
  if (Number.isNaN(date.getTime())) return '';
  const diffMs = now.getTime() - date.getTime();
  const rtf = new Intl.RelativeTimeFormat('fr', { numeric: 'auto' });
  const minutes = Math.round(diffMs / 60000);
  if (Math.abs(minutes) < 60) return rtf.format(-minutes, 'minute');
  const hours = Math.round(diffMs / 3600000);
  if (Math.abs(hours) < 24) return rtf.format(-hours, 'hour');
  const days = Math.round(diffMs / 86400000);
  return rtf.format(-days, 'day');
}
