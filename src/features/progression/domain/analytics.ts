/**
 * T46 — Mesure produit : événements MINIMAUX, sans contenu privé.
 *
 * Interdits absolus dans tout payload analytics : traces, coordonnées,
 * conversations, documents, données de santé, contenu de carnet/avis, email.
 * Les événements sont des compteurs et des issues, jamais des récits.
 */

export const PROGRESSION_ANALYTICS_EVENTS = [
  'progression_card_viewed',
  'progression_card_error',
  'gain_confirmed_seen',
  'gain_pending_seen',
  'mission_chosen',
  'mission_completed',
  'history_page_loaded',
  'passport_opened',
  'rhythm_set',
  'pause_toggled',
  'suggestion_shown',
] as const;

export type ProgressionAnalyticsEvent = (typeof PROGRESSION_ANALYTICS_EVENTS)[number];

const FORBIDDEN_KEY_PATTERN =
  /(trace|geojson|positions?|lat|lng|longitude|latitude|coordinate|conversation|message|content|document|passport_number|health|diagnostic|email|note|comment)/i;

const FORBIDDEN_VALUE_PATTERN = /@|\d+\.\d{4,}/; // emails et coordonnées décimales

export interface SanitizedAnalyticsPayload {
  ok: boolean;
  payload: Record<string, string | number | boolean | null>;
  droppedKeys: string[];
}

/**
 * Assainit un payload analytics : clés interdites supprimées, valeurs
 * suspectes (email/coordonnée) remplacées par null, profondeur bornée.
 */
export function sanitizeAnalyticsPayload(
  raw: Record<string, unknown> | null | undefined
): SanitizedAnalyticsPayload {
  if (!raw || typeof raw !== 'object') {
    return { ok: false, payload: {}, droppedKeys: [] };
  }
  const payload: Record<string, string | number | boolean | null> = {};
  const droppedKeys: string[] = [];

  for (const [key, value] of Object.entries(raw)) {
    if (FORBIDDEN_KEY_PATTERN.test(key)) {
      droppedKeys.push(key);
      continue;
    }
    if (value === null || typeof value === 'boolean') {
      payload[key] = value;
      continue;
    }
    if (typeof value === 'number' && Number.isFinite(value)) {
      payload[key] = value;
      continue;
    }
    if (typeof value === 'string') {
      if (value.length > 64 || FORBIDDEN_VALUE_PATTERN.test(value)) {
        droppedKeys.push(key);
        continue;
      }
      payload[key] = value;
      continue;
    }
    // Objets, tableaux, fonctions : jamais transmis.
    droppedKeys.push(key);
  }

  return { ok: true, payload, droppedKeys };
}

/** T46 — la mesure ne remplace jamais la réussite : rappel de la doctrine. */
export function analyticsDoctrine(): { xpAloneIsSuccess: false; cohortRequired: true } {
  return { xpAloneIsSuccess: false, cohortRequired: true };
}
