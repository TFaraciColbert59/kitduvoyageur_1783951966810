/**
 * A5 — Terrain Live (Phase 5) — moteurs purs.
 *
 * Cycle de vie des signalements, confiance collective, déduplication et
 * modération. Aucune I/O : les accès base de données appartiennent à
 * `server/terrainReports.ts` (client injecté). Aucune identité : le domaine
 * ne manipule que des identifiants opaques.
 *
 * L'autorité DDL reste `supabase/migrations/20260911134000_a1_terrain_live.sql`.
 */
import { makeConfidence, type Confidence } from './confidence';
import { haversineM } from './geo';
import type { TerrainReportCategory, TerrainReportStatus } from '../schemas/live.schema';

/**
 * Catégories MVP actives (UI limitée à ces six) — les treize catégories du
 * schéma A1 restent acceptées côté logique.
 */
export const MVP_TERRAIN_CATEGORIES = [
  'obstacle',
  'closure',
  'mud',
  'snow_ice',
  'water',
  'danger',
] as const;

export type MvpTerrainCategory = (typeof MVP_TERRAIN_CATEGORIES)[number];

/** Événements normatifs du cycle de vie d'un signalement. */
export type TerrainLifecycleEvent =
  | 'confirm'
  | 'auto_confirm'
  | 'age'
  | 'resolve'
  | 'reject'
  | 'expire';

/** Statuts finaux : aucune transition ne les quitte. */
export const TERMINAL_REPORT_STATUSES: readonly TerrainReportStatus[] = [
  'resolved',
  'expired',
  'rejected',
];

/** Confirmations présentes nécessaires pour passer de `confirmed` à `active`. */
export const CONFIRMATIONS_TO_ACTIVATE = 2;
/** Contradictions « disparu » nécessaires pour résoudre un signalement. */
export const CONTRADICTIONS_TO_RESOLVE = 3;

export interface LifecycleContext {
  /** Instant de référence ISO 8601. */
  now: string;
  /** Fin de validité du signalement (ISO 8601), si connue. */
  expiresAt?: string | null;
  /** Nombre de confirmations « toujours présent » connues. */
  confirmationsPresent: number;
  /** Nombre de confirmations « disparu » connues. */
  contradicts: number;
}

function isTerminal(status: TerrainReportStatus): boolean {
  return TERMINAL_REPORT_STATUSES.includes(status);
}

function isPastExpiry(ctx: LifecycleContext): boolean {
  if (ctx.expiresAt == null) return false;
  const expiry = Date.parse(ctx.expiresAt);
  const now = Date.parse(ctx.now);
  return Number.isFinite(expiry) && Number.isFinite(now) && now >= expiry;
}

/**
 * `true` si le rapport est expiré à `now` : statut non terminal, `expiresAt`
 * présent et dépassé. Un `expiresAt` illisible ne périme jamais.
 */
export function shouldExpire(
  report: { status: TerrainReportStatus; expiresAt?: string | null },
  now: string
): boolean {
  if (isTerminal(report.status)) return false;
  return isPastExpiry({
    now,
    expiresAt: report.expiresAt ?? null,
    confirmationsPresent: 0,
    contradicts: 0,
  });
}

/**
 * Transition normative du cycle de vie :
 * `pending → confirmed → active → stale → verify → resolved | expired | rejected`.
 *
 * Règles structurantes :
 * - les statuts terminaux sont immuables ;
 * - `confirm`/`auto_confirm` publient (`active`) à partir de
 *   `CONFIRMATIONS_TO_ACTIVATE` présents et raniment `stale`/`verify` ;
 * - `resolve` exige ≥ `CONTRADICTIONS_TO_RESOLVE` « disparu » **et** plus de
 *   disparus que de présents (jamais depuis `pending`) ;
 * - `age` constate l'expiration dépassée puis fait vieillir `active → stale →
 *   verify` ;
 * - `expire` est refusé avant `expiresAt` (ou autorisé sans expiration connue),
 *   sinon `expired`.
 */
export function nextReportStatus(
  current: TerrainReportStatus,
  event: TerrainLifecycleEvent,
  ctx: LifecycleContext
): TerrainReportStatus {
  if (isTerminal(current)) return current;

  switch (event) {
    case 'reject':
      return 'rejected';

    case 'expire':
      return isPastExpiry(ctx) || ctx.expiresAt == null ? 'expired' : current;

    case 'resolve':
      if (!['confirmed', 'active', 'stale', 'verify'].includes(current)) return current;
      if (ctx.contradicts < CONTRADICTIONS_TO_RESOLVE) return current;
      if (ctx.contradicts <= ctx.confirmationsPresent) return current;
      return 'resolved';

    case 'age':
      if (isPastExpiry(ctx)) return 'expired';
      if (current === 'confirmed' || current === 'active') return 'stale';
      if (current === 'stale') return 'verify';
      return current;

    case 'confirm':
    case 'auto_confirm':
      if (isPastExpiry(ctx)) return 'expired';
      if (current === 'pending') return 'confirmed';
      if (current === 'confirmed') {
        return ctx.confirmationsPresent >= CONFIRMATIONS_TO_ACTIVATE ? 'active' : 'confirmed';
      }
      if (current === 'stale' || current === 'verify') return 'active';
      return current;

    default:
      return current;
  }
}

/** Méthode de confiance normative d'un signalement Terrain Live. */
export const REPORT_CONFIDENCE_METHOD = 'terrain_report_confidence_a5';
/** Au-delà de cet âge, le bonus de récence est nul (heures). */
export const REPORT_CONFIDENCE_MAX_AGE_HOURS = 72;
/** Précision GPS considérée comme bonne (mètres). */
export const GOOD_GPS_ACCURACY_M = 15;
/** Précision GPS au-delà de laquelle le signal est pénalisé (mètres). */
export const POOR_GPS_ACCURACY_M = 100;

export interface ReportConfidenceInput {
  presentCount: number;
  goneCount: number;
  unknownCount: number;
  distinctUsers: number;
  ageHours: number;
  gpsAccuracyM?: number | null;
  hasPhoto: boolean;
  officialSource: boolean;
  traceCorroboration: boolean;
}

function nonNegative(value: number): number {
  return Number.isFinite(value) ? Math.max(0, value) : 0;
}

/**
 * Confiance d'un signalement, bornée [0,1] via `makeConfidence`.
 *
 * Positifs : part de « toujours présent », utilisateurs distincts, récence,
 * précision GPS, photo, source officielle, corroboration de trace.
 * Négatifs : part de « disparu », ancienneté, GPS imprécis.
 * « Sais pas » reste neutre (jamais pénalisé).
 */
export function computeReportConfidence(input: ReportConfidenceInput): Confidence {
  const present = nonNegative(input.presentCount);
  const gone = nonNegative(input.goneCount);
  const unknown = nonNegative(input.unknownCount);
  const votes = present + gone + unknown;
  const distinctUsers = nonNegative(input.distinctUsers);
  const ageHours = nonNegative(input.ageHours);
  const reasons: string[] = [];

  let score = 0.2;

  if (votes > 0 && present > 0) {
    score += 0.25 * (present / votes);
    reasons.push(`confirmations_presentes_${Math.trunc(present)}`);
  }

  if (distinctUsers > 0) {
    score += 0.15 * Math.min(1, distinctUsers / 5);
    if (distinctUsers >= 2) {
      reasons.push(`utilisateurs_distincts_${Math.trunc(distinctUsers)}`);
    }
  }

  if (ageHours <= REPORT_CONFIDENCE_MAX_AGE_HOURS) {
    score += 0.1 * (1 - ageHours / REPORT_CONFIDENCE_MAX_AGE_HOURS);
    if (ageHours <= 6) reasons.push('signalement_recent');
  } else {
    score -= 0.1 * Math.min(1, (ageHours - REPORT_CONFIDENCE_MAX_AGE_HOURS) / 168);
    reasons.push('signalement_ancien');
  }

  const accuracy = input.gpsAccuracyM;
  if (accuracy != null && Number.isFinite(accuracy)) {
    if (accuracy <= GOOD_GPS_ACCURACY_M) {
      score += 0.1;
      reasons.push('gps_precis');
    } else if (accuracy <= 50) {
      score += 0.05;
    } else if (accuracy <= POOR_GPS_ACCURACY_M) {
      score += 0.02;
    } else {
      score -= 0.05;
      reasons.push('gps_imprecis');
    }
  }

  if (input.hasPhoto) {
    score += 0.05;
    reasons.push('photo_fournie');
  }
  if (input.officialSource) {
    score += 0.1;
    reasons.push('source_officielle');
  }
  if (input.traceCorroboration) {
    score += 0.1;
    reasons.push('corroboration_trace');
  }

  if (gone > 0 && votes > 0) {
    score -= 0.35 * (gone / votes);
    reasons.push(`contradictions_disparu_${Math.trunc(gone)}`);
  }

  return makeConfidence({
    score,
    sampleCount: votes,
    method: REPORT_CONFIDENCE_METHOD,
    reasons,
  });
}

/** Candidat de fusion : signalement existant ou entrant. */
export interface DedupCandidate {
  id: string;
  category: TerrainReportCategory;
  segmentId?: number | null;
  lat: number;
  lng: number;
  createdAt: string;
}

export interface DedupOptions {
  /** Distance maximale de fusion sans segment commun (défaut 150 m). */
  maxDistanceM?: number;
  /** Fenêtre temporelle de fusion (défaut 6 h). */
  windowHours?: number;
}

export interface DedupResult {
  mergedWith: string | null;
  reason: string;
}

export const DEDUP_MAX_DISTANCE_M = 150;
export const DEDUP_WINDOW_HOURS = 6;

/**
 * Déduplication : même catégorie **et** (même segment **ou** ≤ 150 m) **et**
 * fenêtre ≤ 6 h. Le candidat le plus proche gagne ; les raisons sont
 * explicites (`doublon_meme_segment`, `doublon_proximite`,
 * `aucun_doublon_hors_fenetre`, `aucun_doublon_hors_distance`,
 * `aucun_doublon_categorie_differente`).
 */
export function deduplicateReports(
  candidates: DedupCandidate[],
  incoming: DedupCandidate,
  options: DedupOptions = {}
): DedupResult {
  const maxDistanceM = options.maxDistanceM ?? DEDUP_MAX_DISTANCE_M;
  const windowHours = options.windowHours ?? DEDUP_WINDOW_HOURS;
  const incomingAt = Date.parse(incoming.createdAt);
  const windowMs = nonNegative(windowHours) * 3600000;

  const sameCategory = candidates.filter((entry) => entry.category === incoming.category);
  if (sameCategory.length === 0) {
    return { mergedWith: null, reason: 'aucun_doublon_categorie_differente' };
  }

  let closest: { id: string; distanceM: number; sameSegment: boolean } | null = null;
  let outOfWindow = false;

  for (const entry of sameCategory) {
    const entryAt = Date.parse(entry.createdAt);
    const withinWindow =
      Number.isFinite(incomingAt) &&
      Number.isFinite(entryAt) &&
      Math.abs(incomingAt - entryAt) <= windowMs;
    if (!withinWindow) {
      outOfWindow = true;
      continue;
    }

    const sameSegment =
      incoming.segmentId != null &&
      entry.segmentId != null &&
      incoming.segmentId === entry.segmentId;
    const distanceM = haversineM(incoming, entry);
    const withinDistance = Number.isFinite(distanceM) && distanceM <= maxDistanceM;

    if (!sameSegment && !withinDistance) continue;
    if (closest === null || distanceM < closest.distanceM) {
      closest = { id: entry.id, distanceM, sameSegment };
    }
  }

  if (closest === null) {
    return {
      mergedWith: null,
      reason: outOfWindow ? 'aucun_doublon_hors_fenetre' : 'aucun_doublon_hors_distance',
    };
  }

  return {
    mergedWith: closest.id,
    reason: closest.sameSegment ? 'doublon_meme_segment' : 'doublon_proximite',
  };
}

/** Rate limit : signalements par heure avant blocage. */
export const MAX_REPORTS_PER_HOUR = 10;
/** Cooldown : confirmations avant blocage temporaire. */
export const MAX_CONFIRMATIONS_COOLDOWN = 2;
/** Longueur maximale d'une description. */
export const MAX_DESCRIPTION_LENGTH = 1000;
/** Réputation plafonnée (jamais au-dessus). */
export const MAX_REPUTATION = 100;
/** Taille maximale d'une photo téléversée (5 Mo). */
export const MAX_PHOTO_BYTES = 5 * 1024 * 1024;
/** Comptes de moins d'un jour limités à 3 signalements/heure. */
export const NEW_ACCOUNT_MAX_REPORTS = 3;
/** En dessous, la réputation est signalée (informative) mais ne bloque pas seule. */
export const LOW_REPUTATION_THRESHOLD = 10;

export interface ModerationInput {
  reportsLastHour: number;
  confirmationsLastHour: number;
  accountAgeDays: number;
  reputation: number;
  hasPhoto: boolean;
  descriptionLength: number;
  /** Extension additive : source officielle (prioritaire, non bloquée). */
  officialSource?: boolean;
  /** Extension additive : URL du téléversement à valider. */
  photoUrl?: string | null;
  /** Extension additive : taille du téléversement à valider (octets). */
  photoSizeBytes?: number | null;
}

export interface ModerationDecision {
  allowed: boolean;
  reasons: string[];
}

export const MODERATION_REASONS = {
  rateLimit: 'limite_signalements_atteinte',
  cooldown: 'cooldown_confirmations_actif',
  description: 'description_trop_longue',
  photo: 'photo_invalide',
  official: 'source_officielle_prioritaire',
  lowReputation: 'reputation_faible',
} as const;

function isValidPhotoUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:';
  } catch {
    return false;
  }
}

/** Réputation normalisée : plafonnée à 100 et jamais négative. */
export function cappedReputation(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(MAX_REPUTATION, value));
}

/**
 * Modération d'un signalement :
 * - rate limit 10/h (3/h pour un compte de moins d'un jour) ;
 * - cooldown de 2 confirmations récentes ;
 * - réputation normalisée sur [0, 100] ;
 * - description ≤ 1000 caractères ;
 * - photo déclarée : URL http(s) **et** taille bornée (5 Mo) ;
 * - source officielle prioritaire : neutralise rate limit/cooldown, mais reste
 *   soumise à la validation de contenu.
 */
export function moderationDecision(input: ModerationInput): ModerationDecision {
  const blocking: string[] = [];
  const notes: string[] = [];
  const descriptionLength = nonNegative(input.descriptionLength);
  const accountAgeDays = nonNegative(input.accountAgeDays);
  const reputation = cappedReputation(input.reputation);

  if (descriptionLength > MAX_DESCRIPTION_LENGTH) {
    blocking.push(MODERATION_REASONS.description);
  }

  if (input.hasPhoto) {
    const photoUrl = typeof input.photoUrl === 'string' ? input.photoUrl : null;
    const size = input.photoSizeBytes;
    const validUrl = photoUrl !== null && isValidPhotoUrl(photoUrl);
    const validSize =
      typeof size === 'number' && Number.isFinite(size) && size > 0 && size <= MAX_PHOTO_BYTES;
    if (!validUrl || !validSize) blocking.push(MODERATION_REASONS.photo);
  }

  if (input.officialSource === true) {
    const allowed = blocking.length === 0;
    return {
      allowed,
      reasons: allowed ? [...blocking, MODERATION_REASONS.official] : blocking,
    };
  }

  const reportLimit = accountAgeDays < 1 ? NEW_ACCOUNT_MAX_REPORTS : MAX_REPORTS_PER_HOUR;
  if (input.reportsLastHour >= reportLimit) blocking.push(MODERATION_REASONS.rateLimit);
  if (input.confirmationsLastHour >= MAX_CONFIRMATIONS_COOLDOWN) {
    blocking.push(MODERATION_REASONS.cooldown);
  }
  // La réputation est normalisée (plafond 100, plancher 0) ; une réputation
  // faible est signalée mais ne bloque jamais seule.
  if (reputation < LOW_REPUTATION_THRESHOLD) notes.push(MODERATION_REASONS.lowReputation);

  return { allowed: blocking.length === 0, reasons: [...blocking, ...notes] };
}
