/**
 * Task 8 — Liens de réservation par étape (pur, déterministe).
 *
 * Ce module ne construit JAMAIS d'URL : il expose seulement l'intention de
 * réservation (`category`, `label`, `searchTerms`) puis, côté serveur, la
 * résolution vers le lien partenaire actif le plus pertinent (`slug`). L'URL de
 * suivi `/go/<slug>` reste construite au rendu par les composants existants,
 * qui portent `rel="sponsored nofollow"`.
 *
 * Les restaurants sont volontairement exclus : aucun programme d'affiliation
 * associé (documenté dans la spec §4.4).
 */

import type { AffiliateCategory, AffiliateLink } from '../types/affiliate.types';

export type StepBookingCategory = 'hotel' | 'flight';

/**
 * Intention de réservation affiliée générique (étape OU suggestion LLM) : la
 * catégorie reste un filtre dur, le libellé et les termes de recherche sont
 * affichés tels quels (jamais d'URL construite ici).
 */
export interface AffiliateIntent {
  category: AffiliateCategory;
  label: string;
  searchTerms: string;
}

export interface StepBookingSuggestion extends AffiliateIntent {
  category: StepBookingCategory;
}

export interface StepBookingInput {
  accommodationName?: string | null;
  transportMode?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  dayNumber: number;
}

export interface StepBookingContext {
  destinationName: string;
  startDate?: string | null;
  endDate?: string | null;
}

/** Modes de transport couverts par le comparateur vols/train (Aviasales). */
const FLIGHT_TRANSPORT_MODES = new Set(['plane', 'train']);

function normalize(value: string | null | undefined): string {
  return (value ?? '').trim().replace(/\s+/g, ' ');
}

/**
 * Dérive une intention de réservation affiliée depuis une étape de voyage.
 * - `accommodation_name` → catégorie `hotel` (Booking), recherche hébergement + destination.
 * - `transport_mode` `plane` | `train` → catégorie `flight`, recherche destination.
 * - sinon `null` (rien à réserver, rien n'est inventé).
 */
export function buildStepBookingLink(
  step: StepBookingInput,
  context: StepBookingContext
): StepBookingSuggestion | null {
  const destination = normalize(context.destinationName);
  const accommodation = normalize(step.accommodationName);

  if (accommodation) {
    return {
      category: 'hotel',
      label: `Hébergement — ${accommodation}`,
      searchTerms: [accommodation, destination].filter(Boolean).join(' '),
    };
  }

  const mode = normalize(step.transportMode).toLowerCase();
  if (FLIGHT_TRANSPORT_MODES.has(mode)) {
    const modeLabel = mode === 'train' ? 'Train' : 'Vol';
    return {
      category: 'flight',
      label: destination ? `${modeLabel} vers ${destination}` : modeLabel,
      searchTerms: destination,
    };
  }

  return null;
}

export interface StepBookingSource extends StepBookingInput {
  id: string;
}

/** Indexe les intentions de réservation par id d'étape (les étapes vides sont omises). */
export function buildBookingByStepId(
  steps: readonly StepBookingSource[],
  context: StepBookingContext
): Record<string, StepBookingSuggestion> {
  const out: Record<string, StepBookingSuggestion> = {};

  for (const step of steps) {
    const suggestion = buildStepBookingLink(step, context);
    if (suggestion) {
      out[step.id] = suggestion;
    }
  }

  return out;
}

// ─────────────────────────────────────────────────────────────────────────────
// Résolution serveur : intention → lien partenaire actif (fix round 1, T8)
// ─────────────────────────────────────────────────────────────────────────────

export interface ResolvedAffiliateIntent extends AffiliateIntent {
  /** Slug du lien partenaire actif résolu (redirection /go construite au rendu). */
  slug: string;
  partnerName: string | null;
}

export interface ResolvedStepBookingLink extends StepBookingSuggestion {
  /** Slug du lien partenaire actif résolu (redirection /go construite au rendu). */
  slug: string;
  partnerName: string | null;
}

export interface StepBookingResolutionContext extends StepBookingContext {
  /** Localisation réelle de l'étape — prioritaire pour le rapprochement destination. */
  stepLocationName?: string | null;
}

/** Normalisation casse + diacritiques + ponctuation pour le rapprochement. */
function normalizeForMatch(value: string | null | undefined): string {
  return (value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/** Contenance bidirectionnelle insensible à la casse et aux diacritiques. */
function destinationMatches(
  linkDestination: string | null | undefined,
  target: string | null | undefined
): boolean {
  const a = normalizeForMatch(linkDestination);
  const b = normalizeForMatch(target);
  if (!a || !b) return false;
  return a.includes(b) || b.includes(a);
}

/** Destination (étape = 2, voyage = 1) d'abord, catégorie en filtre dur, puis récence. */
function scoreCandidate(link: AffiliateLink, context: StepBookingResolutionContext): number {
  let score = 0;
  if (destinationMatches(link.destination_name, context.stepLocationName)) score += 2;
  if (destinationMatches(link.destination_name, context.destinationName)) score += 1;
  return score;
}

/**
 * Résout une intention affiliée (étape ou suggestion LLM) vers UN lien
 * partenaire actif.
 * - La catégorie est un filtre dur (un hôtel ne renvoie jamais vers un vol).
 * - Au moins une correspondance de destination est exigée : localisation de
 *   l'étape (score 2) ou destination du voyage (score 1), rapprochées de
 *   `link.destination_name` (casse/diacritiques ignorés). AUCUN candidat ne
 *   correspond → `null` : jamais de lien vers une mauvaise destination.
 * - La récence ne départage que les candidats déjà correspondants.
 */
export function resolveAffiliateIntent<T extends AffiliateIntent>(
  intent: T,
  candidates: readonly AffiliateLink[],
  context: StepBookingResolutionContext
): (T & { slug: string; partnerName: string | null }) | null {
  const scored = candidates
    .filter((link) => link.category === intent.category)
    .map((link) => ({ link, score: scoreCandidate(link, context) }))
    .filter((entry) => entry.score > 0)
    .sort(
      (a, b) =>
        b.score - a.score || (b.link.created_at ?? '').localeCompare(a.link.created_at ?? '')
    );

  if (scored.length === 0) return null;

  const best = scored[0].link;
  return { ...intent, slug: best.slug, partnerName: best.partner?.name ?? null };
}

/**
 * Résout l'intention de réservation d'une étape vers UN lien partenaire actif
 * (même moteur que les suggestions d'enrichissement).
 */
export function resolveStepBookingLink(
  booking: StepBookingSuggestion,
  candidates: readonly AffiliateLink[],
  context: StepBookingResolutionContext
): ResolvedStepBookingLink | null {
  return resolveAffiliateIntent(booking, candidates, context);
}

export interface ResolvedStepBookingSource extends StepBookingSource {
  locationName?: string | null;
}

/**
 * Carte `bookingByStepId` résolue côté serveur (loader hub) : chaque étape
 * porte le slug exact du lien partenaire à rendre — les vues clientes n'ont
 * plus à rapprocher par catégorie.
 */
export function resolveBookingByStepId(
  steps: readonly ResolvedStepBookingSource[],
  candidates: readonly AffiliateLink[],
  context: StepBookingContext
): Record<string, ResolvedStepBookingLink> {
  const out: Record<string, ResolvedStepBookingLink> = {};

  for (const step of steps) {
    const booking = buildStepBookingLink(step, context);
    if (!booking) continue;
    const resolved = resolveStepBookingLink(booking, candidates, {
      ...context,
      stepLocationName: step.locationName,
    });
    if (resolved) {
      out[step.id] = resolved;
    }
  }

  return out;
}
