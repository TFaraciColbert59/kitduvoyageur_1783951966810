/**
 * Récapitulatifs mensuels et annuels partageables (A05 · S2.39).
 *
 * Calcule des bilans fidèles (jamais de valeurs inventées ni de récompenses
 * fictives C-REWARD) et génère un texte partageable + une carte SVG exportable.
 */

import {
  formatDuration,
  isDone,
  localDateKey,
  monthLabel,
  sportLabel,
  type ProgressionSession,
} from './engine';

export type RecapScope = 'month' | 'year';

export interface RecapSportBreakdown {
  sport: string | null;
  label: string;
  sessions: number;
  km: number;
  dplusM: number;
  durationS: number;
}

export interface ActivityRecap {
  scope: RecapScope;
  periodKey: string;
  periodLabel: string;
  sessionsCount: number;
  totalKm: number | null;
  totalDplusM: number | null;
  totalDurationS: number | null;
  topSportLabel: string | null;
  longestSession: { id: string; title: string; km: number } | null;
  biggestClimbSession: { id: string; title: string; dplusM: number } | null;
  sports: RecapSportBreakdown[];
  shareText: string;
}

export function buildActivityRecap(
  sessions: readonly ProgressionSession[],
  scope: RecapScope,
  periodKey: string, // YYYY-MM ou YYYY
  timeZone: string
): ActivityRecap {
  const periodLabel =
    scope === 'month' ? monthLabel(periodKey) : `Année ${periodKey}`;

  const matching = sessions.filter((s) => {
    if (!isDone(s)) return false;
    const key = localDateKey(s.startedAt ?? s.endedAt, timeZone);
    if (!key) return false;
    return scope === 'month' ? key.startsWith(`${periodKey}-`) : key.startsWith(`${periodKey}-`);
  });

  if (matching.length === 0) {
    return {
      scope,
      periodKey,
      periodLabel,
      sessionsCount: 0,
      totalKm: null,
      totalDplusM: null,
      totalDurationS: null,
      topSportLabel: null,
      longestSession: null,
      biggestClimbSession: null,
      sports: [],
      shareText: `Bilan ${periodLabel} : aucune sortie terminée enregistrée.`,
    };
  }

  let kmSum = 0;
  let kmPresent = 0;
  let dplusSum = 0;
  let dplusPresent = 0;
  let durSum = 0;
  let durPresent = 0;
  let longestSession: ActivityRecap['longestSession'] = null;
  let biggestClimbSession: ActivityRecap['biggestClimbSession'] = null;

  const bySport = new Map<string, RecapSportBreakdown>();

  for (const s of matching) {
    if (typeof s.km === 'number' && Number.isFinite(s.km)) {
      kmSum += s.km;
      kmPresent += 1;
      if (!longestSession || s.km > longestSession.km) {
        longestSession = { id: s.id, title: s.title, km: Math.round(s.km * 10) / 10 };
      }
    }
    if (typeof s.dplus === 'number' && Number.isFinite(s.dplus)) {
      dplusSum += s.dplus;
      dplusPresent += 1;
      if (!biggestClimbSession || s.dplus > biggestClimbSession.dplusM) {
        biggestClimbSession = { id: s.id, title: s.title, dplusM: Math.round(s.dplus) };
      }
    }
    if (typeof s.durationS === 'number' && Number.isFinite(s.durationS)) {
      durSum += s.durationS;
      durPresent += 1;
    }

    const key = s.sport ?? '__unknown';
    const cur = bySport.get(key) ?? {
      sport: s.sport,
      label: sportLabel(s.sport),
      sessions: 0,
      km: 0,
      dplusM: 0,
      durationS: 0,
    };
    cur.sessions += 1;
    cur.km += s.km ?? 0;
    cur.dplusM += s.dplus ?? 0;
    cur.durationS += s.durationS ?? 0;
    bySport.set(key, cur);
  }

  const sports = Array.from(bySport.values()).sort((a, b) => b.sessions - a.sessions);
  const totalKm = kmPresent > 0 ? Math.round(kmSum * 10) / 10 : null;
  const totalDplusM = dplusPresent > 0 ? Math.round(dplusSum) : null;
  const totalDurationS = durPresent > 0 ? Math.round(durSum) : null;
  const topSportLabel = sports[0]?.label ?? null;

  const parts: string[] = [
    `Mon récap ${periodLabel} sur Les Kms de Vie :`,
    `• ${matching.length} sortie${matching.length > 1 ? 's' : ''}`,
  ];
  if (totalKm !== null) parts.push(`• ${totalKm} km parcourus`);
  if (totalDplusM !== null) parts.push(`• +${totalDplusM} m de dénivelé`);
  if (totalDurationS !== null) parts.push(`• ${formatDuration(totalDurationS)} d'activité`);
  if (topSportLabel) parts.push(`• Sport principal : ${topSportLabel}`);

  return {
    scope,
    periodKey,
    periodLabel,
    sessionsCount: matching.length,
    totalKm,
    totalDplusM,
    totalDurationS,
    topSportLabel,
    longestSession,
    biggestClimbSession,
    sports,
    shareText: parts.join('\n'),
  };
}

export function buildRecapShareSvg(recap: ActivityRecap): string {
  const esc = (s: string) =>
    s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const kmText = recap.totalKm !== null ? `${recap.totalKm} km` : '—';
  const dpText = recap.totalDplusM !== null ? `+${recap.totalDplusM} m` : '—';
  const durText = recap.totalDurationS !== null ? formatDuration(recap.totalDurationS) : '—';

  return `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="320" viewBox="0 0 600 320">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#17402C" />
      <stop offset="100%" stop-color="#2E6B4B" />
    </linearGradient>
  </defs>
  <rect width="600" height="320" rx="24" fill="url(#bg)" />
  <text x="36" y="54" fill="#A7F3D0" font-family="system-ui, sans-serif" font-size="14" font-weight="600">LES KMS DE VIE · RÉCAPITULATIF</text>
  <text x="36" y="92" fill="#FFFFFF" font-family="system-ui, sans-serif" font-size="28" font-weight="700">${esc(recap.periodLabel)}</text>
  <text x="36" y="156" fill="#FFFFFF" font-family="system-ui, sans-serif" font-size="34" font-weight="700">${recap.sessionsCount} sorties</text>
  <text x="36" y="218" fill="#D1FAE5" font-family="system-ui, sans-serif" font-size="22" font-weight="600">${esc(kmText)}   ·   ${esc(dpText)}   ·   ${esc(durText)}</text>
  <text x="36" y="276" fill="#A7F3D0" font-family="system-ui, sans-serif" font-size="14">${recap.topSportLabel ? `Sport dominant : ${esc(recap.topSportLabel)}` : 'Données vérifiées de mes sorties'}</text>
</svg>`;
}
