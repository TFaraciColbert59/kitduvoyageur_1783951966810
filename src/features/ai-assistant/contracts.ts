/**
 * A08 — contrats communs des assistants et bilans interprétés.
 *
 * Trois surfaces, un même socle :
 *   • K1.14 — découverte de parcours pour un assistant externe (ChatGPT) ;
 *   • S2.37 — bilan post-activité privé et contextualisé ;
 *   • S2.38 — questions sur l'historique via Claude / Gemini.
 *
 * Règle cardinale : une valeur absente n'est jamais zéro, jamais une
 * estimation. Elle porte le statut `absent` et la raison exacte. L'IA ne
 * fabrique aucune métrique : elle commente uniquement les faits fournis.
 */

export const AI_ASSISTANT_CONTRACT_VERSION = 'a08-v1';

/** Ce que la valeur est, et non ce qu'on aimerait qu'elle soit. */
export type DataStatus = 'measured' | 'calculated' | 'declared' | 'absent';

export interface DataPoint<T> {
  /** `null` uniquement quand `status === 'absent'`. */
  value: T | null;
  status: DataStatus;
  /** Provenance lisible : colonne, calcul, service ou absence. */
  source: string;
  unit?: string;
  /** Pourquoi la valeur manque (statut `absent`), ou précision de calcul. */
  reason?: string;
}

export interface DataCitation {
  /** Clé stable du fait cité (ex. `metrics.distanceKm`). */
  field: string;
  label: string;
  /** Valeur déjà formatée pour l'affichage ; absente si le fait est absent. */
  value: string | null;
  status: DataStatus;
  source: string;
}

export type AiUnavailableReason =
  | 'not_requested'
  | 'provider_unconfigured'
  | 'provider_unavailable'
  | 'invalid_response'
  | 'consent_required'
  | 'no_data'
  | 'connector_not_configured'
  | 'connector_disabled';

export type AiGeneration =
  | {
      status: 'available';
      provider: string;
      model: string;
      text: string;
      generatedAt: string;
    }
  | {
      status: 'unavailable';
      reason: AiUnavailableReason;
      message: string;
    };

export type AssistantProviderId = 'claude' | 'gemini';

export interface AssistantCompletionRequest {
  system: string;
  prompt: string;
  maxTokens: number;
}

export interface AssistantCompletionResult {
  text: string;
  provider: string;
  model: string;
}

/**
 * Port de complétion : les services A08 ne connaissent jamais un SDK ni une
 * clé. Les tests injectent un double ; la route injecte l'adaptateur réel.
 */
export interface AssistantCompletionPort {
  readonly id: string;
  isAvailable(): boolean;
  complete(request: AssistantCompletionRequest): Promise<AssistantCompletionResult>;
}

export function measured<T>(value: T, source: string, unit?: string): DataPoint<T> {
  return { value, status: 'measured', source, ...(unit ? { unit } : {}) };
}

export function calculated<T>(value: T, source: string, unit?: string): DataPoint<T> {
  return { value, status: 'calculated', source, ...(unit ? { unit } : {}) };
}

export function declared<T>(value: T, source: string, unit?: string): DataPoint<T> {
  return { value, status: 'declared', source, ...(unit ? { unit } : {}) };
}

export function absent<T>(reason: string, source = 'non disponible'): DataPoint<T> {
  return { value: null, status: 'absent', source, reason };
}

/**
 * Convertit une valeur numérique Supabase (`numeric` arrive souvent en texte)
 * sans confondre `null` et `0`. Toute valeur non finie devient `absent`.
 */
export function numericDataPoint(
  value: unknown,
  options: {
    status: 'measured' | 'calculated' | 'declared';
    source: string;
    unit?: string;
    absentReason: string;
  }
): DataPoint<number> {
  const parsed =
    typeof value === 'number'
      ? value
      : typeof value === 'string' && value.trim().length > 0
        ? Number(value)
        : Number.NaN;
  if (!Number.isFinite(parsed)) {
    return absent<number>(options.absentReason);
  }
  return {
    value: parsed,
    status: options.status,
    source: options.source,
    ...(options.unit ? { unit: options.unit } : {}),
  };
}

/** Vrai si le point porte une valeur réellement exploitable. */
export function hasValue<T>(point: DataPoint<T>): point is DataPoint<T> & { value: T } {
  return point.status !== 'absent' && point.value !== null;
}

export function unavailable(
  reason: AiUnavailableReason,
  message: string
): Extract<AiGeneration, { status: 'unavailable' }> {
  return { status: 'unavailable', reason, message };
}

/** Formate un nombre avec une virgule française, sans arrondir au-delà du nécessaire. */
export function formatNumberFr(value: number, digits = 1): string {
  return new Intl.NumberFormat('fr-FR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: digits,
  }).format(value);
}

export function formatDurationFr(seconds: number): string {
  const total = Math.max(0, Math.round(seconds));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  if (hours > 0) return `${hours} h ${String(minutes).padStart(2, '0')}`;
  return `${minutes} min`;
}

export function formatPaceFr(secondsPerKm: number): string {
  const total = Math.max(0, Math.round(secondsPerKm));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${minutes} min ${String(seconds).padStart(2, '0')} s/km`;
}
