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

import { setActiveAdventureAction } from '@/features/hub/context/activeAdventureServer';
import { blockersBeforeSave } from './adventureRequest';
import { tripTitle } from './tripCommit';
import type { AdventurePrepDraft } from './types';

/** Ce que l ecriture a reellement obtenu. */
export type SaveOutcome =
  | { readonly status: 'saved'; readonly tripId: string; readonly slug: string | null }
  /** Refus metier : il manque une donnee, l utilisateur n est pas connecte. */
  | { readonly status: 'rejected'; readonly message: string }
  /** Panne : reseau, quota, base indisponible. Reessai possible. */
  | { readonly status: 'failed'; readonly message: string };

/** Injection de tests : le module ne connait que cette forme. */
/**
 * L'aventure que le hub doit ouvrir. Meme forme que le cookie
 * `lkv_active_adventure` : c'est ce contrat-la que le hub relit ensuite.
 */
export interface ActiveSortie {
  readonly nature: 'sortie';
  readonly id: string;
  readonly slug: string;
  readonly title: string;
}

export type ActivateAdventure = (adventure: ActiveSortie) => Promise<{ success: boolean }>;

export interface SaveAdventureDeps {
  post: (url: string, body: unknown, init: { signal?: AbortSignal }) => Promise<Response>;
  /**
   * Pose l'aventure active cote serveur (cookie httpOnly). Par defaut, la
   * VRAIE action serveur ; injectee dans les tests.
   */
  activate?: ActivateAdventure;
  /**
   * Recoit le motif quand le hub n'a pas pu etre oriente vers le nouveau
   * voyage. Le voyage, lui, existe deja : on ne le declare pas perdu.
   */
  onActivationIssue?: (issue: string) => void;
}

export const COMMIT_ENDPOINT = '/api/adventure/commit';

/** Ou le hub lit l'aventure qu'on vient de creer. */
export const HUB_HREF = '/hub';

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
 * Signale un echec d'orientation sans jamais le laisser remonter : un rappel
 * de rapport qui leve transformerait un voyage enregistre en panne.
 */
function reportActivationIssue(deps: SaveAdventureDeps, issue: string): void {
  try {
    deps.onActivationIssue?.(issue);
  } catch (error) {
    console.error("[LKDV] le signalement d'un echec d'orientation a echoue:", error);
  }
}

/**
 * Oriente le hub vers l'aventure qui vient d'etre creee.
 *
 * Le hub ne devine pas l'aventure affichee : il relit le cookie
 * `lkv_active_adventure`. On y ecrit donc l'identifiant et le slug renvoyes
 * par la BASE, et le titre de la ligne `trips` — celui que `buildTripCommit`
 * a produit, pas un second libelle invente a cote.
 *
 * Un echec ici ne remet pas en cause l'ecriture : la ligne existe deja. On le
 * signale, et le resultat reste `saved` — un cookie non pose se voit et se
 * rejoue, un voyage declare perdu, non.
 */
export async function activateSavedAdventure(
  draft: AdventurePrepDraft,
  outcome: SaveOutcome,
  deps: SaveAdventureDeps,
): Promise<boolean> {
  if (outcome.status !== 'saved') return false;

  const slug = outcome.slug;
  if (!slug) {
    reportActivationIssue(deps, "Le serveur n'a pas renvoye d'adresse pour ce voyage.");
    return false;
  }

  const activate = deps.activate ?? setActiveAdventureAction;
  try {
    const result = await activate({
      nature: 'sortie',
      id: outcome.tripId,
      slug,
      title: tripTitle(draft),
    });
    if (result?.success) return true;
    reportActivationIssue(deps, "Le hub n'a pas pu etre oriente vers ce voyage.");
    return false;
  } catch (error) {
    console.error("[LKDV] orientation du hub vers le nouveau voyage impossible:", error);
    reportActivationIssue(deps, "Le hub n'a pas pu etre oriente vers ce voyage.");
    return false;
  }
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
      message: `Il manque : ${blockers.join(', ')} (nécessaire pour enregistrer ton aventure).`,
    };
  }

  try {
    const response = await deps.post(
      COMMIT_ENDPOINT,
      { draft },
      signal ? { signal } : {},
    );
    const outcome = await readSaveResponse(response);

    // L'aventure active est pointee AVANT de rendre la main : le composant
    // redirige aussitot vers le hub, qui ne doit donc jamais relire
    // l'aventure precedente parce que l'ecriture de la ligne a ete plus
    // rapide que celle de l'orientation.
    if (outcome.status === 'saved') {
      await activateSavedAdventure(draft, outcome, deps);
    }
    return outcome;
  } catch (error) {
    if (signal?.aborted) {
      return { status: 'failed', message: 'Enregistrement annulé.' };
    }
    return { status: 'failed', message: OFFLINE_MESSAGE };
  }
}
