/**
 * Meilleurs efforts course à pied & Prédictions de course (A05 · S2.22, S2.27).
 *
 * Règles C-MET :
 *   - seuls les sports pédestres (`course`, `trail`) terminés avec distance
 *     et durée valides entrent dans les records et la prédiction Riegel ;
 *   - sans flux GPS détaillé au bootstrap, les records par distance cible
 *     utilisent la meilleure performance de séance couvrant la distance (prorata
 *     honnête de l'allure de séance), explicitement étiquetée `estimated` vs
 *     `measured` si un chrono exact a été importé ;
 *   - formule de Riegel : T2 = T1 * (D2 / D1)^1.06, à partir d'une référence
 *     récente (>= 3 km) ; indisponible sinon.
 */

import { isDone, localDateKey, type ProgressionSession } from './engine';

export const RUNNING_SPORTS: ReadonlySet<string> = new Set(['course', 'trail']);
export const RIEGEL_METHOD = 'riegel-1.06-v1' as const;

export interface RunningDistanceTarget {
  id: '400m' | '1k' | '5k' | '10k' | 'half' | 'marathon';
  label: string;
  distanceKm: number;
}

export const RUNNING_BEST_EFFORT_TARGETS: readonly RunningDistanceTarget[] = [
  { id: '400m', label: '400 m', distanceKm: 0.4 },
  { id: '1k', label: '1 km', distanceKm: 1 },
  { id: '5k', label: '5 km', distanceKm: 5 },
  { id: '10k', label: '10 km', distanceKm: 10 },
  { id: 'half', label: 'Semi-marathon', distanceKm: 21.0975 },
  { id: 'marathon', label: 'Marathon', distanceKm: 42.195 },
];

export interface RunningBestEffort {
  targetId: RunningDistanceTarget['id'];
  label: string;
  distanceKm: number;
  estimatedTimeS: number | null;
  paceMinPerKm: number | null;
  quality: 'measured' | 'estimated' | 'unavailable';
  sessionId: string | null;
  sessionTitle: string | null;
  achievedDate: string | null;
  reason: string | null;
}

export interface RacePrediction {
  targetId: '5k' | '10k' | 'half' | 'marathon';
  label: string;
  distanceKm: number;
  predictedTimeS: number;
  predictedPaceMinPerKm: number;
  confidence: 'haute' | 'moyenne' | 'indicative';
}

export interface RacePredictionResult {
  status: 'available' | 'unavailable';
  method: typeof RIEGEL_METHOD;
  quality: 'estimated';
  reason: string | null;
  referenceSession: {
    id: string;
    title: string;
    distanceKm: number;
    durationS: number;
    date: string | null;
  } | null;
  predictions: RacePrediction[];
}

export function formatChronoS(totalS: number | null): string {
  if (totalS === null || !Number.isFinite(totalS) || totalS <= 0) return '—';
  const rounded = Math.round(totalS);
  const h = Math.floor(rounded / 3600);
  const m = Math.floor((rounded % 3600) / 60);
  const s = rounded % 60;
  if (h > 0) return `${h}h ${String(m).padStart(2, '0')}m ${String(s).padStart(2, '0')}s`;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function isValidRunningSession(s: ProgressionSession): boolean {
  return (
    isDone(s) &&
    Boolean(s.sport && RUNNING_SPORTS.has(s.sport)) &&
    typeof s.km === 'number' &&
    Number.isFinite(s.km) &&
    s.km >= 0.4 &&
    typeof s.durationS === 'number' &&
    Number.isFinite(s.durationS) &&
    s.durationS > 60
  );
}

export function computeRunningBestEfforts(
  sessions: readonly ProgressionSession[],
  timeZone: string
): RunningBestEffort[] {
  const valid = sessions.filter((s) => {
    if (!isValidRunningSession(s)) return false;
    const pace = (s.durationS! / 60) / s.km!;
    return pace >= 2.2 && pace <= 18;
  });

  return RUNNING_BEST_EFFORT_TARGETS.map((target) => {
    const eligible = valid.filter((s) => (s.km ?? 0) >= target.distanceKm * 0.96);
    if (eligible.length === 0) {
      return {
        targetId: target.id,
        label: target.label,
        distanceKm: target.distanceKm,
        estimatedTimeS: null,
        paceMinPerKm: null,
        quality: 'unavailable',
        sessionId: null,
        sessionTitle: null,
        achievedDate: null,
        reason: `Aucune sortie course/trail d'au moins ${target.label}.`,
      };
    }

    let bestSession: ProgressionSession | null = null;
    let bestTimeS = Number.POSITIVE_INFINITY;
    let exactMatch = false;

    for (const s of eligible) {
      const km = s.km!;
      const dur = s.durationS!;
      const isCloseDistance = Math.abs(km - target.distanceKm) / target.distanceKm <= 0.04;
      // Si la séance fait la distance exacte (~4%), c'est un chrono quasi-mesuré ; sinon Riegel léger depuis l'allure de séance
      const timeForTarget = isCloseDistance
        ? dur * (target.distanceKm / km)
        : dur * Math.pow(target.distanceKm / km, 1.03);
      if (timeForTarget < bestTimeS) {
        bestTimeS = timeForTarget;
        bestSession = s;
        exactMatch = isCloseDistance;
      }
    }

    if (!bestSession) {
      return {
        targetId: target.id,
        label: target.label,
        distanceKm: target.distanceKm,
        estimatedTimeS: null,
        paceMinPerKm: null,
        quality: 'unavailable',
        sessionId: null,
        sessionTitle: null,
        achievedDate: null,
        reason: 'Données insuffisantes.',
      };
    }

    return {
      targetId: target.id,
      label: target.label,
      distanceKm: target.distanceKm,
      estimatedTimeS: Math.round(bestTimeS),
      paceMinPerKm: Math.round(((bestTimeS / 60) / target.distanceKm) * 100) / 100,
      quality: exactMatch ? 'measured' : 'estimated',
      sessionId: bestSession.id,
      sessionTitle: bestSession.title,
      achievedDate: localDateKey(bestSession.startedAt ?? bestSession.endedAt, timeZone),
      reason: null,
    };
  });
}

export function computeRacePredictions(
  sessions: readonly ProgressionSession[],
  timeZone: string,
  now = new Date()
): RacePredictionResult {
  const cutoffMs = now.getTime() - 180 * 86_400_000;
  const candidates = sessions
    .filter((s) => {
      if (!isValidRunningSession(s)) return false;
      if ((s.km ?? 0) < 3) return false;
      const pace = (s.durationS! / 60) / s.km!;
      if (pace < 2.4 || pace > 15) return false;
      const ts = Date.parse(s.startedAt ?? s.endedAt ?? '');
      return Number.isNaN(ts) || ts >= cutoffMs;
    })
    .map((s) => {
      const km = s.km!;
      const dur = s.durationS!;
      // Normaliser vers 10 km via Riegel pour trouver la meilleure forme de référence
      const norm10k = dur * Math.pow(10 / km, 1.06);
      return { session: s, norm10k };
    })
    .sort((a, b) => a.norm10k - b.norm10k);

  if (candidates.length === 0) {
    return {
      status: 'unavailable',
      method: RIEGEL_METHOD,
      quality: 'estimated',
      reason: 'Enregistre une course d’au moins 3 km sur les 6 derniers mois pour estimer tes temps.',
      referenceSession: null,
      predictions: [],
    };
  }

  const ref = candidates[0].session;
  const refKm = ref.km!;
  const refDur = ref.durationS!;

  const targets: Array<{ id: '5k' | '10k' | 'half' | 'marathon'; label: string; distanceKm: number }> = [
    { id: '5k', label: '5 km', distanceKm: 5 },
    { id: '10k', label: '10 km', distanceKm: 10 },
    { id: 'half', label: 'Semi-marathon', distanceKm: 21.0975 },
    { id: 'marathon', label: 'Marathon', distanceKm: 42.195 },
  ];

  const predictions: RacePrediction[] = targets.map((t) => {
    const predictedTimeS = Math.round(refDur * Math.pow(t.distanceKm / refKm, 1.06));
    const ratio = t.distanceKm / refKm;
    const confidence: RacePrediction['confidence'] =
      ratio >= 0.5 && ratio <= 2.2
        ? 'haute'
        : ratio <= 4.5
          ? 'moyenne'
          : 'indicative';
    return {
      targetId: t.id,
      label: t.label,
      distanceKm: t.distanceKm,
      predictedTimeS,
      predictedPaceMinPerKm: Math.round(((predictedTimeS / 60) / t.distanceKm) * 100) / 100,
      confidence,
    };
  });

  return {
    status: 'available',
    method: RIEGEL_METHOD,
    quality: 'estimated',
    reason: null,
    referenceSession: {
      id: ref.id,
      title: ref.title,
      distanceKm: refKm,
      durationS: refDur,
      date: localDateKey(ref.startedAt ?? ref.endedAt, timeZone),
    },
    predictions,
  };
}

export interface RunningTracePointInput {
  lat: number;
  lng: number;
  timestampMs: number;
}

export interface CleanRunningTraceResult {
  cleanDistanceM: number;
  cleanDurationS: number;
  filteredSpikeCount: number;
  bestEfforts: RunningBestEffort[];
}

function haversineMeters(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const r = 6_371_000;
  const dLat = toRad(bLat - aLat);
  const dLng = toRad(bLng - aLng);
  const sinDLat = Math.sin(dLat / 2);
  const sinDLng = Math.sin(dLng / 2);
  const a =
    sinDLat * sinDLat +
    Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * sinDLng * sinDLng;
  return 2 * r * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * S2.22 — Extrait les meilleurs efforts depuis une trace GPS en filtrant les sauts
 * irréalistes (> maxPlausibleSpeedMps, défaut 10.5 m/s ≈ 37.8 km/h en course).
 * Lorsqu'un saut GPS génère une pointe aberrante, les points aberrants sont retirés
 * avant calcul ; le faux record est ainsi retiré/recalculé honnêtement.
 */
export function extractCleanRunningBestEffortsFromTrace(
  points: readonly RunningTracePointInput[],
  meta: {
    sessionId: string;
    title: string;
    date: string | null;
    maxPlausibleSpeedMps?: number;
  }
): CleanRunningTraceResult {
  const maxSpeedMps = meta.maxPlausibleSpeedMps ?? 10.5;
  const sorted = points
    .filter(
      (p) =>
        Number.isFinite(p.lat) &&
        Number.isFinite(p.lng) &&
        Number.isFinite(p.timestampMs)
    )
    .slice()
    .sort((a, b) => a.timestampMs - b.timestampMs);

  if (sorted.length < 2) {
    return {
      cleanDistanceM: 0,
      cleanDurationS: 0,
      filteredSpikeCount: 0,
      bestEfforts: computeRunningBestEfforts([], 'UTC'),
    };
  }

  const kept: Array<{ atMs: number; cumDistM: number }> = [
    { atMs: sorted[0].timestampMs, cumDistM: 0 },
  ];
  let lastValid = sorted[0];
  let cumDistM = 0;
  let filteredSpikeCount = 0;

  for (let i = 1; i < sorted.length; i += 1) {
    const cur = sorted[i];
    const dtS = (cur.timestampMs - lastValid.timestampMs) / 1000;
    if (dtS <= 0) continue;
    const distM = haversineMeters(lastValid.lat, lastValid.lng, cur.lat, cur.lng);
    const speedMps = distM / dtS;
    if (speedMps > maxSpeedMps && distM > 25) {
      filteredSpikeCount += 1;
      continue;
    }
    cumDistM += distM;
    lastValid = cur;
    kept.push({ atMs: cur.timestampMs, cumDistM });
  }

  const cleanDurationS =
    kept.length >= 2 ? (kept[kept.length - 1].atMs - kept[0].atMs) / 1000 : 0;

  const bestEfforts: RunningBestEffort[] = RUNNING_BEST_EFFORT_TARGETS.map((target) => {
    const targetM = target.distanceKm * 1000;
    if (cumDistM < targetM || kept.length < 2) {
      return {
        targetId: target.id,
        label: target.label,
        distanceKm: target.distanceKm,
        estimatedTimeS: null,
        paceMinPerKm: null,
        quality: 'unavailable',
        sessionId: null,
        sessionTitle: null,
        achievedDate: null,
        reason:
          filteredSpikeCount > 0
            ? 'Distance nettoyée insuffisante après retrait des sauts GPS.'
            : `Distance trace inférieure à ${target.label}.`,
      };
    }

    let bestS = Number.POSITIVE_INFINITY;
    let left = 0;
    for (let right = 1; right < kept.length; right += 1) {
      while (left < right && kept[right].cumDistM - kept[left + 1].cumDistM >= targetM) {
        left += 1;
      }
      const spanM = kept[right].cumDistM - kept[left].cumDistM;
      if (spanM >= targetM) {
        const spanS = (kept[right].atMs - kept[left].atMs) / 1000;
        const scaledS = spanS * (targetM / spanM);
        if (scaledS > 0 && scaledS < bestS) bestS = scaledS;
      }
    }

    if (!Number.isFinite(bestS)) {
      return {
        targetId: target.id,
        label: target.label,
        distanceKm: target.distanceKm,
        estimatedTimeS: null,
        paceMinPerKm: null,
        quality: 'unavailable',
        sessionId: null,
        sessionTitle: null,
        achievedDate: null,
        reason: 'Fenêtre continue introuvable.',
      };
    }

    return {
      targetId: target.id,
      label: target.label,
      distanceKm: target.distanceKm,
      estimatedTimeS: Math.round(bestS),
      paceMinPerKm: Math.round(((bestS / 60) / target.distanceKm) * 100) / 100,
      quality: 'measured',
      sessionId: meta.sessionId,
      sessionTitle: meta.title,
      achievedDate: meta.date,
      reason: null,
    };
  });

  return {
    cleanDistanceM: Math.round(cumDistM),
    cleanDurationS: Math.round(cleanDurationS),
    filteredSpikeCount,
    bestEfforts,
  };
}
