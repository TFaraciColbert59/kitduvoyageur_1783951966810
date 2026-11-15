/**
 * S2.38 — contrat de l'assistant sur l'historique sportif.
 *
 * Seules des données agrégées et des métadonnées non localisantes sont
 * exposées : distance, durée, dénivelé, date, itinéraire nommé, région.
 * Jamais de coordonnées, de trace GPS, de notes libres ni de titre personnel.
 * Un refus de consentement laisse l'historique hors de portée : aucune
 * lecture n'est faite avant le contrôle.
 */

import {
  AI_ASSISTANT_CONTRACT_VERSION,
  calculated,
  formatDurationFr,
  formatNumberFr,
  hasValue,
  type DataCitation,
  type DataPoint,
} from '../contracts';

export const HISTORY_ASSISTANT_POLICY_VERSION = 'a08-history-v1';

/** Champs autorisés dans le contexte envoyé à un assistant externe. */
export const HISTORY_ALLOWED_FIELDS = [
  'id',
  'started_at',
  'distance_km',
  'duration_seconds',
  'elevation_gain_m',
  'route_name',
  'region',
] as const;

/** Champs explicitement exclus, même s'ils existent dans la base. */
export const HISTORY_FORBIDDEN_FIELDS = [
  'positions_geojson',
  'positions_timed',
  'last_lat',
  'last_lng',
  'notes',
  'title',
  'narratives',
  'carnet_moments',
] as const;

export interface HistoryActivityRow {
  id: string;
  started_at: string;
  distance_km?: number | string | null;
  duration_seconds?: number | string | null;
  elevation_gain_m?: number | string | null;
  route_name?: string | null;
  region?: string | null;
}

export interface HistoryActivity {
  id: string;
  startedAt: string;
  distanceKm: DataPoint<number>;
  durationSeconds: DataPoint<number>;
  elevationGainM: DataPoint<number>;
  routeName: string | null;
  region: string | null;
}

export interface HistoryFacts {
  contractVersion: string;
  policyVersion: string;
  window: {
    activities: number;
    firstStartedAt: string | null;
    lastStartedAt: string | null;
  };
  totals: {
    distanceKm: DataPoint<number>;
    durationSeconds: DataPoint<number>;
    elevationGainM: DataPoint<number>;
  };
  averages: {
    distanceKm: DataPoint<number>;
    durationSeconds: DataPoint<number>;
    elevationGainM: DataPoint<number>;
  };
  longest: HistoryActivity | null;
  activities: HistoryActivity[];
  citations: DataCitation[];
  missing: DataCitation[];
  /** Champs que le contrat n'expose jamais. */
  excludedFields: readonly string[];
}

function toNumber(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'string' && value.trim().length > 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function point(
  value: unknown,
  label: string,
  source: string,
  unit: string
): DataPoint<number> {
  const parsed = toNumber(value);
  if (parsed === null) {
    return { value: null, status: 'absent', source, unit, reason: `${label} absent de cette sortie` };
  }
  return { value: parsed, status: 'measured', source, unit };
}

function sumPoints(
  activities: HistoryActivity[],
  key: 'distanceKm' | 'durationSeconds' | 'elevationGainM',
  source: string,
  unit: string
): DataPoint<number> {
  const values = activities.map((activity) => activity[key]).filter(hasValue);
  if (values.length === 0) {
    return { value: null, status: 'absent', source, unit, reason: 'aucune valeur disponible dans l’historique' };
  }
  const sum = values.reduce((total, entry) => total + entry.value, 0);
  return {
    value: sum,
    status: 'calculated',
    source: values.length === activities.length ? source : `${source} (somme partielle sur ${values.length}/${activities.length})`,
    unit,
  };
}

function averagePoints(
  activities: HistoryActivity[],
  key: 'distanceKm' | 'durationSeconds' | 'elevationGainM',
  source: string,
  unit: string
): DataPoint<number> {
  const total = sumPoints(activities, key, source, unit);
  if (!hasValue(total)) return total;
  const count = activities.filter((activity) => hasValue(activity[key])).length;
  return calculated(total.value / count, source, unit);
}

function citation(field: string, label: string, pointValue: DataPoint<number>, unit: string): DataCitation | null {
  if (!hasValue(pointValue)) return null;
  const formatted =
    unit === 's'
      ? formatDurationFr(pointValue.value)
      : `${formatNumberFr(pointValue.value, unit === 'km' ? 2 : 0)} ${unit}`;
  return {
    field,
    label,
    value: formatted,
    status: pointValue.status,
    source: pointValue.source,
  };
}

export function buildHistoryFacts(rows: HistoryActivityRow[]): HistoryFacts {
  const activities: HistoryActivity[] = rows.map((row) => ({
    id: row.id,
    startedAt: row.started_at,
    distanceKm: point(row.distance_km, 'distance', 'hike_sessions.distance_km', 'km'),
    durationSeconds: point(row.duration_seconds, 'durée', 'hike_sessions.duration_seconds', 's'),
    elevationGainM: point(row.elevation_gain_m, 'dénivelé', 'hike_sessions.elevation_gain_m', 'm'),
    routeName: typeof row.route_name === 'string' && row.route_name.trim() ? row.route_name.trim() : null,
    region: typeof row.region === 'string' && row.region.trim() ? row.region.trim() : null,
  }));

  const sorted = [...activities].sort((a, b) => Date.parse(a.startedAt) - Date.parse(b.startedAt));
  const withDistance = [...activities]
    .filter((activity) => hasValue(activity.distanceKm))
    .sort((a, b) => {
      const aValue = hasValue(a.distanceKm) ? a.distanceKm.value : 0;
      const bValue = hasValue(b.distanceKm) ? b.distanceKm.value : 0;
      return bValue - aValue;
    });

  const totals = {
    distanceKm: sumPoints(activities, 'distanceKm', 'calculé : somme des distances', 'km'),
    durationSeconds: sumPoints(activities, 'durationSeconds', 'calculé : somme des durées', 's'),
    elevationGainM: sumPoints(activities, 'elevationGainM', 'calculé : somme des dénivelés', 'm'),
  };
  const averages = {
    distanceKm: averagePoints(activities, 'distanceKm', 'calculé : moyenne des distances', 'km'),
    durationSeconds: averagePoints(activities, 'durationSeconds', 'calculé : moyenne des durées', 's'),
    elevationGainM: averagePoints(activities, 'elevationGainM', 'calculé : moyenne des dénivelés', 'm'),
  };

  const citations = [
    citation('totals.distanceKm', 'Distance cumulée', totals.distanceKm, 'km'),
    citation('totals.durationSeconds', 'Durée cumulée', totals.durationSeconds, 's'),
    citation('totals.elevationGainM', 'Dénivelé cumulé', totals.elevationGainM, 'm'),
    citation('averages.distanceKm', 'Distance moyenne', averages.distanceKm, 'km'),
    citation('averages.durationSeconds', 'Durée moyenne', averages.durationSeconds, 's'),
    citation('averages.elevationGainM', 'Dénivelé moyen', averages.elevationGainM, 'm'),
  ].filter((entry): entry is DataCitation => entry !== null);

  const missing: DataCitation[] = [];
  for (const [field, label, source] of [
    ['totals.distanceKm', 'Distance cumulée', 'hike_sessions.distance_km'],
    ['totals.durationSeconds', 'Durée cumulée', 'hike_sessions.duration_seconds'],
    ['totals.elevationGainM', 'Dénivelé cumulé', 'hike_sessions.elevation_gain_m'],
  ] as const) {
    const current = field.startsWith('totals.distance')
      ? totals.distanceKm
      : field.startsWith('totals.duration')
        ? totals.durationSeconds
        : totals.elevationGainM;
    if (!hasValue(current)) {
      missing.push({ field, label, value: null, status: 'absent', source });
    }
  }

  return {
    contractVersion: AI_ASSISTANT_CONTRACT_VERSION,
    policyVersion: HISTORY_ASSISTANT_POLICY_VERSION,
    window: {
      activities: activities.length,
      firstStartedAt: sorted[0]?.startedAt ?? null,
      lastStartedAt: sorted[sorted.length - 1]?.startedAt ?? null,
    },
    totals,
    averages,
    longest: withDistance[0] ?? null,
    activities,
    citations,
    missing,
    excludedFields: HISTORY_FORBIDDEN_FIELDS,
  };
}

/**
 * Questions proposées sans IA : elles dépendent uniquement de ce que
 * l'historique contient réellement. Aucun historique ⇒ aucune question.
 */
export function suggestHistoryQuestions(facts: HistoryFacts): string[] {
  if (facts.window.activities === 0) return [];
  const questions: string[] = [];
  if (hasValue(facts.totals.distanceKm)) {
    questions.push('Quelle distance ai-je parcourue sur la période couverte par mon historique ?');
  }
  if (hasValue(facts.totals.elevationGainM)) {
    questions.push('Quel dénivelé positif ai-je accumulé sur ces sorties ?');
  }
  if (facts.longest) {
    questions.push('Quelle est ma sortie la plus longue, et comment se situe-t-elle par rapport aux autres ?');
  }
  if (hasValue(facts.averages.durationSeconds)) {
    questions.push('Quelle est la durée moyenne de mes sorties ?');
  }
  if (facts.activities.some((activity) => activity.routeName)) {
    questions.push('Sur quels itinéraires nommés ai-je marché le plus souvent ?');
  }
  if (facts.missing.length > 0) {
    questions.push('Quelles données me manquent pour suivre mon dénivelé ou ma charge sur la durée ?');
  }
  return questions.slice(0, 6);
}

export function buildHistoryPrompt(
  question: string,
  facts: HistoryFacts
): { system: string; prompt: string } {
  const factLines = facts.citations
    .map((entry) => `- ${entry.label} : ${entry.value} (${entry.status}, ${entry.source})`)
    .join('\n');
  const missingLines = facts.missing.map((entry) => `- ${entry.label} : absent (${entry.source})`).join('\n');
  const activityLines = facts.activities
    .slice(0, 50)
    .map((activity) => {
      const distance = hasValue(activity.distanceKm)
        ? `${formatNumberFr(activity.distanceKm.value, 2)} km`
        : 'distance indisponible';
      const duration = hasValue(activity.durationSeconds)
        ? formatDurationFr(activity.durationSeconds.value)
        : 'durée indisponible';
      return `- ${activity.startedAt.slice(0, 10)} · ${distance} · ${duration}${
        activity.routeName ? ` · ${activity.routeName}` : ''
      }${activity.region ? ` · ${activity.region}` : ''}`;
    })
    .join('\n');

  return {
    system:
      'Tu es l’assistant historique de Le Kit du Voyageur. Tu réponds en français, ' +
      'uniquement à partir des agrégats et des métadonnées fournis. Tu n’inventes aucune ' +
      'sortie, aucune métrique, aucune coordonnée. Si une donnée est absente, tu le dis. ' +
      'Tu ne donnes aucun conseil médical. Réponse courte, sans markdown, sans URL.',
    prompt:
      `Question : ${question}\n\n` +
      `Agrégats disponibles :\n${factLines || '- aucun agrégat disponible'}\n\n` +
      `Données absentes :\n${missingLines || '- aucune'}\n\n` +
      `Sorties autorisées (sans coordonnées ni notes) :\n${activityLines || '- aucune'}\n\n` +
      'Réponds en citant les agrégats utilisés, sans ajouter de chiffre extérieur.',
  };
}

/** Refuse les réponses vides, trop longues, en HTML ou contenant des coordonnées. */
export function sanitizeHistoryAnswer(text: unknown): string | null {
  if (typeof text !== 'string') return null;
  const cleaned = text
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (cleaned.length < 20 || cleaned.length > 2_000) return null;
  if (/https?:\/\//i.test(cleaned)) return null;
  if (/-?\d{1,3}\.\d{4,}\s*[,;]\s*-?\d{1,3}\.\d{4,}/.test(cleaned)) return null;
  return cleaned;
}
