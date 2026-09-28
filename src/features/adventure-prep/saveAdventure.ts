/**
 * Enregistrement d une aventure : le SEUL passage qui cree le voyage.
 *
 * Module PUR. Aucun `fetch` direct, aucun `next/navigation`, aucun store : on
 * decrit la sequence, ses echecs et ses messages, et le composant ne fait
 * qu appeler `saveAdventure` puis suivre le resultat. C est ce qui rend le
 * flux verifiable hors ligne.
 *
 * Regle de confiance : la redirection vers le hub n existe QUE si la base a
 * repondu avec un identifiant de voyage. Un `200` sans `tripId`, une panne ou
 * un refus de quota restent des echecs visibles — jamais un « enregistre » que
 * le hub ne sa pas afficher.
 */

import { blockersBeforeSave } from './adventureRequest';
import type { AdventurePrepDraft } from './types';

/** Ce que l ecriture a reellement obtenu. */
export type SaveOutcome =
  | { readonly status: 'saved'; readonly tripId: string; readonly slug: string | null }
  /** Refus metier : il manque une donnee, l utilisateur n est pas connecte. */
  | { readonly status: 'rejected'; readonly message: string }
  /** Panne : reseau, quota, base indisponible. Reessai possible. */
  | { readonly status: 'failed'; readonly message: string };

/** Injection de tests : le module ne connait que cette forme. */
export interface SaveAdventureDeps {
  post: (url: string, body: unknown, init: { signal?: AbortSignal }) => Promise<Response>;
}

export const COMMIT_ENDPOINT = '/api/adventure/commit';

const OFFLINE_MESSAGE = 'Impossible de joindre le serveur. Vérifie ta connexion, puis réessaie.';
const GENERIC_FAILURE = "Ton aventure n’a pas pu être enregistrée. Réessaie dans un instant.";

function messageFromPayload(payload: unknown, fallback: string): string {
  if (payload && typeof payload === 'object') {
    const error = (payload as { error?: unknown }).error;
    if (typeof error === 'string' && error.trim().length > 0) return error;
  }
  return fallback;
}

/** Traduit une reponse HTTP en resultat honnete, sans jamais declarer reussi. */
export async function readSaveResponse(response: Response): Promise<SaveOutcome> {
  const payload: unknown = await response.json().catch(() => null);

  if (response.ok) {
    const tripId = (payload as { tripId?: unknown } | null)?.tripId;
    if (typeof tripId === 'string' && tripId.length > 0) {
      const slug = (payload as { slug?: unknown } | null)?.slug;
      return { status: 'saved', tripId, slug: typeof slug === 'string' ? slug : null };
    }
    return {
      status: 'failed',
      message: "Le serveur n\u2019a pas confirm\u00e9 la cr\u00e9ation du voyage. V\u00e9rifie ton hub.",
    };
  }

  if (response.status === 401) {
    return {
      status: 'rejected',
      message: 'Connecte-toi pour enregistrer ton aventure, puis r\u00e9essaie.',
    };
  }

  if (response.status === 422 || response.status === 400) {
    return {
      status: 'rejected',
      message: messageFromPayload(
        payload,
        'Ton aventure est incompl\u00e8te. Compl\u00e8te-la puis r\u00e9essaie.',
      ),
    };
  }

  if (response.status === 429) {
    return {
      status: 'failed',
      message: 'Trop d\u2019enregistrements d\u2019affil\u00e9e. Patiente un instant, puis r\u00e9essaie.',
    };
  }

  return { status: 'failed', message: messageFromPayload(payload, GENERIC_FAILURE) };
}


/**
 * Enregistre l aventure. Ne leve jamais : tout echec revient dans le resultat,
 * parce qu un rejet non rattrape laisserait l ecran dans un etat « saving »
 * indefini.
 */
export async function saveAdventure(
  draft: AdventurePrepDraft,
  deps: SaveAdventureDeps,
  signal?: AbortSignal,
): Promise<SaveOutcome> {
  const blockers = blockersBeforeSave(draft);
  if (blockers.length > 0) {
    return {
      status: 'rejected',
      message: `Il manque ${blockers.join(', ')} avant d’enregistrer ton aventure.`,
    };
  }

  try {
    const response = await deps.post(
      COMMIT_ENDPOINT,
      { draft },
      signal ? { signal } : {},
    );
    return await readSaveResponse(response);
  } catch (error) {
    if (signal?.aborted) {
      return { status: 'failed', message: 'Enregistrement annulé.' };
    }
    return { status: 'failed', message: OFFLINE_MESSAGE };
  }
}
