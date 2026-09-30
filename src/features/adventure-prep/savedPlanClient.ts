/**
 * Chantier configurateur (L0.6 / L0.7) — client HTTP du plan enregistré.
 *
 * Une seule porte pour lire et écrire une aventure depuis le préparateur :
 *   - `loadSavedPlan`  : GET /api/adventure/[id] → brouillon éditable ;
 *   - `saveAdventure`  : POST generate (création) ou PUT [id] (modification).
 *
 * Aucune dépendance React : `fetch` est injectable, chaque issue est un
 * résultat typé avec une phrase actionnable. Jamais de code HTTP ni de charge
 * utile brute à l'écran.
 */

import { draftFromAcceptedPlan, parseAcceptedPlan } from './acceptedPlan';
import { buildAcceptedPlan, buildAdventureGenerateRequest } from './adventureRequest';
import type { AdventurePrepDraft } from './types';

type FetchLike = typeof fetch;

export type LoadSavedPlanResult =
  | { ok: true; planId: string; planVersion: number; draft: AdventurePrepDraft }
  | { ok: false; reason: 'introuvable' | 'non_modifiable' | 'ancien_format' | 'connexion' | 'reseau' | 'serveur'; message: string };

export type SaveAdventureResult =
  | { ok: true; planId: string; planVersion: number }
  | {
      ok: false;
      reason: 'connexion' | 'conflit' | 'quota' | 'en_cours' | 'invalide' | 'indisponible' | 'reseau' | 'serveur';
      message: string;
      /** Délai conseillé avant réessai, quand le serveur le connaît. */
      retryAfterS?: number;
      /** Réessayer avec la MÊME clé d'idempotence est sûr. */
      retryable: boolean;
    };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** Seul un UUID de plan est accepté depuis l'URL. */
export function isPlanId(value: unknown): value is string {
  return typeof value === 'string' && UUID.test(value);
}

async function jsonOrNull(response: Response): Promise<Record<string, unknown> | null> {
  try {
    const body = (await response.json()) as unknown;
    return body !== null && typeof body === 'object' ? (body as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

function retryAfterOf(response: Response, body: Record<string, unknown> | null): number | undefined {
  const fromBody = body?.retryAfterS;
  if (typeof fromBody === 'number' && Number.isFinite(fromBody) && fromBody > 0) return Math.ceil(fromBody);
  const header = Number(response.headers.get('retry-after'));
  return Number.isFinite(header) && header > 0 ? Math.ceil(header) : undefined;
}

function minutesLabel(seconds: number | undefined): string {
  if (!seconds) return 'dans un moment';
  if (seconds < 90) return 'dans une minute';
  return `dans ${Math.ceil(seconds / 60)} minutes`;
}

export async function loadSavedPlan(
  planId: string,
  options: { fetchImpl?: FetchLike; signal?: AbortSignal } = {},
): Promise<LoadSavedPlanResult> {
  if (!isPlanId(planId)) {
    return { ok: false, reason: 'introuvable', message: 'Cette aventure est introuvable.' };
  }
  const fetchImpl = options.fetchImpl ?? fetch;
  let response: Response;
  try {
    response = await fetchImpl(`/api/adventure/${encodeURIComponent(planId)}`, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      cache: 'no-store',
      signal: options.signal,
    });
  } catch {
    return {
      ok: false,
      reason: 'reseau',
      message: 'Impossible de charger ton aventure. Vérifie ta connexion, puis réessaie.',
    };
  }

  if (response.status === 401) {
    return { ok: false, reason: 'connexion', message: 'Connecte-toi pour ouvrir cette aventure.' };
  }
  if (response.status === 404) {
    return { ok: false, reason: 'introuvable', message: 'Cette aventure est introuvable ou ne t’est pas accessible. Vérifie que tu es connecté avec le bon compte.' };
  }
  if (!response.ok) {
    return { ok: false, reason: 'serveur', message: 'Ton aventure n’a pas pu être chargée. Réessaie dans un instant.' };
  }

  const body = await jsonOrNull(response);
  if (body?.canEdit !== true) {
    return {
      ok: false,
      reason: 'non_modifiable',
      message: 'Seule la personne qui a créé cette aventure peut la modifier ici.',
    };
  }
  const accepted = parseAcceptedPlan(body.acceptedPlan);
  const versionValue = (body.version as { version?: unknown } | null)?.version;
  const planVersion =
    typeof versionValue === 'number' && Number.isInteger(versionValue) && versionValue >= 1 ? versionValue : null;
  if (!accepted || planVersion === null) {
    return {
      ok: false,
      reason: 'ancien_format',
      message: 'Cette aventure a été créée avant le nouveau préparateur : ouvre-la depuis ton hub.',
    };
  }
  return { ok: true, planId, planVersion, draft: draftFromAcceptedPlan(accepted) };
}

export interface SaveAdventureInput {
  draft: AdventurePrepDraft;
  /** Plan modifié ; `null` = création. */
  planId: string | null;
  planVersion: number | null;
  /** Clé d'idempotence de la tentative (création uniquement). */
  idempotencyKey: string;
  fetchImpl?: FetchLike;
  signal?: AbortSignal;
}

function failure(
  reason: Extract<SaveAdventureResult, { ok: false }>['reason'],
  message: string,
  retryable: boolean,
  retryAfterS?: number,
): SaveAdventureResult {
  return { ok: false, reason, message, retryable, ...(retryAfterS ? { retryAfterS } : {}) };
}

/** Enregistre l'aventure : création (POST) ou nouvelle version (PUT). */
export async function saveAdventure(input: SaveAdventureInput): Promise<SaveAdventureResult> {
  const fetchImpl = input.fetchImpl ?? fetch;
  const editing = isPlanId(input.planId) && typeof input.planVersion === 'number';
  let response: Response;
  try {
    response = editing
      ? await fetchImpl(`/api/adventure/${encodeURIComponent(input.planId as string)}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            expectedVersion: input.planVersion,
            acceptedPlan: buildAcceptedPlan(input.draft),
          }),
          signal: input.signal,
        })
      : await fetchImpl('/api/adventure/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Idempotency-Key': input.idempotencyKey },
          body: JSON.stringify(buildAdventureGenerateRequest(input.draft)),
          signal: input.signal,
        });
  } catch {
    return failure('reseau', 'Impossible de joindre le serveur. Vérifie ta connexion, puis réessaie.', true);
  }

  const body = await jsonOrNull(response);

  if (response.ok) {
    const planId = body?.planId;
    const version = body?.version;
    if (!isPlanId(planId) || typeof version !== 'number') {
      return failure('serveur', 'Le parcours a été enregistré sans identifiant. Vérifie ton hub.', false);
    }
    return { ok: true, planId, planVersion: version };
  }

  const retryAfterS = retryAfterOf(response, body);
  switch (response.status) {
    case 401:
      return failure('connexion', 'Connecte-toi pour enregistrer ton aventure, puis réessaie.', true);
    case 400:
      return failure('invalide', 'Certaines informations ne sont pas valides. Vérifie les étapes, puis réessaie.', false);
    case 404:
      return failure('serveur', 'Cette aventure n’existe plus ou ne t’est plus accessible.', false);
    case 409:
      return editing
        ? failure(
            'conflit',
            'Cette aventure a été modifiée ailleurs. Recharge-la avant d’enregistrer pour ne rien écraser.',
            false,
          )
        : failure('en_cours', 'Un enregistrement est déjà en cours. Réessaie dans quelques secondes.', true, retryAfterS ?? 5);
    case 429:
      return failure(
        'quota',
        `Tu as atteint la limite d’enregistrements pour l’instant. Réessaie ${minutesLabel(retryAfterS)}.`,
        true,
        retryAfterS,
      );
    case 402:
    case 403:
      return failure('invalide', 'Ton offre actuelle ne permet pas cet enregistrement.', false);
    case 503:
      return failure('indisponible', 'Le service est momentanément indisponible. Réessaie dans un instant.', true, retryAfterS);
    default:
      return failure('serveur', 'Ton aventure n’a pas pu être enregistrée. Réessaie dans un instant.', true);
  }
}
