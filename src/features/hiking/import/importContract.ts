/**
 * Contrat d'entrée de l'import de trace, séparé de la route HTTP.
 *
 * Le module reste pur : il ne lit aucun fichier, n'appelle aucun réseau et ne
 * connaît ni Supabase ni Next. Il décide seulement si un corps de requête porte
 * le contrat d'import (`source` + empreinte), puis borne les valeurs avant
 * l'appel RPC. La RPC revalide ces bornes : ce module rend l'erreur lisible et
 * évite de construire une requête inutile.
 */

import { TRACE_IMPORT_LIMITS } from './model';
import { TRACE_IMPORT_MAX_PAYLOAD_POINTS } from './preview';

export type TraceImportFileSource = 'fit' | 'tcx' | 'gpx';

/** Sous-ensemble du corps HTTP suffisant pour identifier et borner un import. */
export interface TraceImportRequestFields {
  startedAt?: string;
  endedAt?: string;
  distanceKm?: number;
  durationSeconds?: number;
  elevationGainM?: number | null;
  maxAltitudeM?: number | null;
  positions?: Array<{ latitude: number; longitude: number }>;
  positionsTimed?: unknown[] | null;
  source?: string | null;
  sourceFingerprint?: string | null;
  sourceFileName?: string | null;
  sourceByteLength?: number | null;
}

export type TraceImportIdentity =
  | { kind: 'none' }
  | { kind: 'invalid'; message: string }
  | { kind: 'import'; source: TraceImportFileSource; fingerprint: string };

const TRACE_IMPORT_SOURCES: readonly TraceImportFileSource[] = ['fit', 'tcx', 'gpx'];
const TRACE_IMPORT_FINGERPRINT_PATTERN = /^sha256:[0-9a-f]{64}$/;
/**
 * Un import n'est enregistrable que si le parseur a établi une base UTC. La
 * borne doit donc porter un fuseau (`Z` ou `+02:00`) : une heure civile nue ne
 * peut pas être convertie sans invention.
 */
const TRACE_IMPORT_INSTANT_PATTERN =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?(?:Z|[+-]\d{2}:\d{2})$/;

function isTraceImportFileSource(value: string): value is TraceImportFileSource {
  return (TRACE_IMPORT_SOURCES as readonly string[]).includes(value);
}

/**
 * Sépare le contrat historique (GPS, sans empreinte) du contrat d'import.
 *
 * L'import exige les deux champs ensemble : un format source et une empreinte
 * SHA-256 au format produit par le parseur. Un appel qui ne fournit ni l'un ni
 * l'autre reste un enregistrement GPS historique.
 */
export function resolveTraceImportIdentity(body: TraceImportRequestFields): TraceImportIdentity {
  const rawSource = typeof body.source === 'string' ? body.source.trim().toLowerCase() : '';
  const rawFingerprint =
    typeof body.sourceFingerprint === 'string'
      ? body.sourceFingerprint.trim().toLowerCase()
      : '';

  if (!rawSource && !rawFingerprint) return { kind: 'none' };

  if (rawSource === 'gps') {
    return rawFingerprint
      ? { kind: 'invalid', message: 'Une empreinte de fichier ne peut pas accompagner une source GPS.' }
      : { kind: 'none' };
  }

  if (!isTraceImportFileSource(rawSource)) {
    return { kind: 'invalid', message: 'Source de trace non prise en charge.' };
  }
  if (!rawFingerprint) {
    return { kind: 'invalid', message: 'Empreinte de trace requise pour un import.' };
  }
  if (!TRACE_IMPORT_FINGERPRINT_PATTERN.test(rawFingerprint)) {
    return { kind: 'invalid', message: 'Empreinte de trace invalide.' };
  }

  return { kind: 'import', source: rawSource, fingerprint: rawFingerprint };
}

/**
 * Bornes d'un import avant l'appel RPC. Aucune valeur absente n'est remplacée
 * par zéro : un champ manquant produit un refus, jamais une valeur inventée.
 */
export function validateTraceImportPayload(body: TraceImportRequestFields): string | null {
  if (
    typeof body.startedAt !== 'string' ||
    typeof body.endedAt !== 'string' ||
    !TRACE_IMPORT_INSTANT_PATTERN.test(body.startedAt) ||
    !TRACE_IMPORT_INSTANT_PATTERN.test(body.endedAt)
  ) {
    return 'Bornes de la sortie invalides.';
  }

  const started = Date.parse(body.startedAt);
  const ended = Date.parse(body.endedAt);
  if (!Number.isFinite(started) || !Number.isFinite(ended) || ended <= started) {
    return 'Bornes de la sortie invalides.';
  }

  if (
    typeof body.distanceKm !== 'number' ||
    !Number.isFinite(body.distanceKm) ||
    body.distanceKm < 0 ||
    body.distanceKm > 100_000
  ) {
    return 'Distance invalide.';
  }

  if (
    typeof body.durationSeconds !== 'number' ||
    !Number.isFinite(body.durationSeconds) ||
    body.durationSeconds < 1 ||
    body.durationSeconds > 31_536_000
  ) {
    return 'Durée invalide.';
  }

  if (
    body.elevationGainM != null &&
    (typeof body.elevationGainM !== 'number' ||
      !Number.isFinite(body.elevationGainM) ||
      body.elevationGainM < 0 ||
      body.elevationGainM > 30_000)
  ) {
    return 'Dénivelé invalide.';
  }

  if (
    body.maxAltitudeM != null &&
    (typeof body.maxAltitudeM !== 'number' ||
      !Number.isFinite(body.maxAltitudeM) ||
      body.maxAltitudeM < -500 ||
      body.maxAltitudeM > 9_000)
  ) {
    return 'Altitude invalide.';
  }

  if (
    body.sourceByteLength != null &&
    (typeof body.sourceByteLength !== 'number' ||
      !Number.isFinite(body.sourceByteLength) ||
      body.sourceByteLength < 1 ||
      body.sourceByteLength > TRACE_IMPORT_LIMITS.maxBytes)
  ) {
    return 'Taille de fichier invalide.';
  }

  if (!Array.isArray(body.positions) || body.positions.length > TRACE_IMPORT_MAX_PAYLOAD_POINTS) {
    return 'Trace trop volumineuse.';
  }
  for (const position of body.positions) {
    if (
      !position ||
      !Number.isFinite(position.latitude) ||
      !Number.isFinite(position.longitude) ||
      Math.abs(position.latitude) > 90 ||
      Math.abs(position.longitude) > 180
    ) {
      return 'Positions invalides.';
    }
  }

  if (
    body.positionsTimed != null &&
    (!Array.isArray(body.positionsTimed) ||
      body.positionsTimed.length > TRACE_IMPORT_MAX_PAYLOAD_POINTS)
  ) {
    return 'Trace trop volumineuse.';
  }

  return null;
}

/** Nom de fichier réduit au dernier segment, borné et sans balisage. */
export function boundedImportFileName(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const base = value.trim().split(/[\\/]/).pop() ?? '';
  const cleaned = base.replace(/[<>]/g, '').replace(/[\u0000-\u001f\u007f]/g, '').trim();
  if (!cleaned || cleaned === '.' || cleaned === '..') return null;
  return cleaned.slice(0, 255);
}
