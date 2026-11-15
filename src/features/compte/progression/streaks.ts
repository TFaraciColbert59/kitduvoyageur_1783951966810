/**
 * Séries d'activité — Activity Streaks (A05 · S2.21).
 *
 * Calcule les séries consécutives (en jours et en semaines) sur les séances
 * terminées dans le fuseau utilisateur, globalement et par sport. Aucune
 * récompense factice (C-REWARD) : présentation factuelle de la régularité.
 */

import {
  addDaysToKey,
  isDone,
  localDateKey,
  sportLabel,
  startOfWeekKey,
  todayKey,
  type ProgressionSession,
} from './engine';

export interface ActivityStreakSummary {
  sport: string | null;
  label: string;
  currentDayStreak: number;
  longestDayStreak: number;
  currentWeekStreak: number;
  longestWeekStreak: number;
  activeToday: boolean;
  activeThisWeek: boolean;
  lastActiveDateKey: string | null;
}

export interface AllStreaksSummary {
  global: ActivityStreakSummary;
  bySport: ActivityStreakSummary[];
}

function computeStreaksForKeys(
  dateKeys: Set<string>,
  sport: string | null,
  label: string,
  today: string
): ActivityStreakSummary {
  if (dateKeys.size === 0) {
    return {
      sport,
      label,
      currentDayStreak: 0,
      longestDayStreak: 0,
      currentWeekStreak: 0,
      longestWeekStreak: 0,
      activeToday: false,
      activeThisWeek: false,
      lastActiveDateKey: null,
    };
  }

  const sortedDays = Array.from(dateKeys).sort();
  const lastActiveDateKey = sortedDays[sortedDays.length - 1] ?? null;

  // Plus longue série en jours
  let longestDayStreak = 1;
  let run = 1;
  for (let i = 1; i < sortedDays.length; i += 1) {
    if (addDaysToKey(sortedDays[i - 1], 1) === sortedDays[i]) {
      run += 1;
      if (run > longestDayStreak) longestDayStreak = run;
    } else {
      run = 1;
    }
  }

  // Série courante en jours (tolère aujourd'hui vide si hier est actif)
  const yesterday = addDaysToKey(today, -1);
  const activeToday = dateKeys.has(today);
  let cursor = activeToday ? today : dateKeys.has(yesterday) ? yesterday : null;
  let currentDayStreak = 0;
  while (cursor && dateKeys.has(cursor)) {
    currentDayStreak += 1;
    cursor = addDaysToKey(cursor, -1);
  }

  // Séries par semaine ISO (lundi)
  const weekSet = new Set<string>();
  for (const day of sortedDays) {
    weekSet.add(startOfWeekKey(day));
  }
  const sortedWeeks = Array.from(weekSet).sort();
  let longestWeekStreak = 1;
  let weekRun = 1;
  for (let i = 1; i < sortedWeeks.length; i += 1) {
    if (addDaysToKey(sortedWeeks[i - 1], 7) === sortedWeeks[i]) {
      weekRun += 1;
      if (weekRun > longestWeekStreak) longestWeekStreak = weekRun;
    } else {
      weekRun = 1;
    }
  }

  const thisWeek = startOfWeekKey(today);
  const prevWeek = addDaysToKey(thisWeek, -7);
  const activeThisWeek = weekSet.has(thisWeek);
  let weekCursor = activeThisWeek ? thisWeek : weekSet.has(prevWeek) ? prevWeek : null;
  let currentWeekStreak = 0;
  while (weekCursor && weekSet.has(weekCursor)) {
    currentWeekStreak += 1;
    weekCursor = addDaysToKey(weekCursor, -7);
  }

  return {
    sport,
    label,
    currentDayStreak,
    longestDayStreak,
    currentWeekStreak,
    longestWeekStreak,
    activeToday,
    activeThisWeek,
    lastActiveDateKey,
  };
}

export function computeActivityStreaks(
  sessions: readonly ProgressionSession[],
  timeZone: string,
  now = new Date()
): AllStreaksSummary {
  const today = todayKey(timeZone, now);
  const globalDays = new Set<string>();
  const sportDays = new Map<string, Set<string>>();

  for (const session of sessions) {
    if (!isDone(session)) continue;
    const key = localDateKey(session.startedAt ?? session.endedAt, timeZone);
    if (!key || key > today) continue;
    globalDays.add(key);
    if (session.sport) {
      const set = sportDays.get(session.sport) ?? new Set<string>();
      set.add(key);
      sportDays.set(session.sport, set);
    }
  }

  const global = computeStreaksForKeys(globalDays, null, 'Tous sports', today);
  const bySport: ActivityStreakSummary[] = Array.from(sportDays.entries())
    .map(([sport, days]) => computeStreaksForKeys(days, sport, sportLabel(sport), today))
    .sort((a, b) => b.currentWeekStreak - a.currentWeekStreak || b.longestWeekStreak - a.longestWeekStreak);

  return { global, bySport };
}
