/**
 * Confiance — objet normatif du domaine Adventure Intelligence.
 *
 * Aucune collision avec `ConfidenceLevelEnum` (trips) : `Confidence` est
 * l'objet enrichi { score, level, sampleCount, method, reasons }.
 * Domaine pur : zéro I/O, zéro dépendance runtime.
 */

export type ConfidenceLevel = 'high' | 'medium' | 'low';

export interface Confidence {
  score: number;
  level: ConfidenceLevel;
  sampleCount: number;
  method: string;
  reasons: string[];
}

export interface MakeConfidenceInput {
  score: number;
  sampleCount: number;
  method: string;
  reasons?: string[];
}

/** Seuil haut (inclus) : à partir de 0.75 la confiance est `high`. */
export const HIGH_CONFIDENCE_THRESHOLD = 0.75;
/** Seuil médian (inclus) : à partir de 0.5 la confiance est `medium`. */
export const MEDIUM_CONFIDENCE_THRESHOLD = 0.5;
/** Nombre minimal d'observations pour parler de personnalisation. */
export const MIN_PERSONALIZED_SAMPLES = 3;

export const LOW_CONFIDENCE_FALLBACK_REASON =
  'Confiance faible — échantillon insuffisant ou incertitude non documentée';

/** Confiance froide : profil sans aucune donnée personnelle. */
export const COLD_CONFIDENCE: Confidence = {
  score: 0,
  level: 'low',
  sampleCount: 0,
  method: 'cold',
  reasons: ['Profil froid — aucune donnée personnelle disponible'],
};

/** Borne un nombre dans [0,1] ; toute valeur non finie retombe à 0. */
export function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  if (value < 0) return 0;
  if (value > 1) return 1;
  return value;
}

export function confidenceLevelFromScore(score: number): ConfidenceLevel {
  const bounded = clamp01(score);
  if (bounded >= HIGH_CONFIDENCE_THRESHOLD) return 'high';
  if (bounded >= MEDIUM_CONFIDENCE_THRESHOLD) return 'medium';
  return 'low';
}

export function makeConfidence(input: MakeConfidenceInput): Confidence {
  const score = clamp01(input.score);
  const level = confidenceLevelFromScore(score);
  const reasons = [...(input.reasons ?? [])];
  if (level === 'low' && reasons.length === 0) {
    reasons.push(LOW_CONFIDENCE_FALLBACK_REASON);
  }
  return {
    score,
    level,
    sampleCount: Math.max(0, Math.trunc(input.sampleCount)),
    method: input.method,
    reasons,
  };
}

/**
 * Combine plusieurs confiances : la plus prudente gagne (min), les
 * échantillons s'additionnent, les raisons se concatènent dans l'ordre.
 */
export function combineConfidence(...parts: Confidence[]): Confidence {
  if (parts.length === 0) {
    return makeConfidence({
      score: 0,
      sampleCount: 0,
      method: 'combined:min',
      reasons: ['Aucune composante de confiance fournie'],
    });
  }

  const score = Math.min(...parts.map((part) => clamp01(part.score)));
  const sampleCount = parts.reduce((sum, part) => sum + Math.max(0, part.sampleCount), 0);
  const reasons = parts.flatMap((part) => part.reasons);

  return makeConfidence({ score, sampleCount, method: 'combined:min', reasons });
}

/** Une confiance est personnalisée si elle s'appuie sur assez d'observations fiables. */
export function isPersonalized(confidence: Confidence): boolean {
  return (
    confidence.sampleCount >= MIN_PERSONALIZED_SAMPLES &&
    clamp01(confidence.score) >= MEDIUM_CONFIDENCE_THRESHOLD
  );
}
