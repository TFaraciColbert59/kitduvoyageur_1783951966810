'use server';

import { createInviteToken } from '@/features/crews/lib/invitations';
import { requestDraftedItinerary } from '@/features/adventure-prep/engine/aiItinerary';
import type { ProposalResult } from '@/features/adventure-prep/engine/itineraryPhases';
import type { PlaceInventory } from '@/features/adventure-prep/engine/places';
import type { AdventurePrepDraft } from '@/features/adventure-prep/types';

/**
 * Pont serveur entre l'ecran de preparation et le moteur IA.
 *
 * Pourquoi une Server Action : `askAI` est explicitement serveur-only (la cle
 * NVIDIA vit dans `.env.local` et ne doit jamais atteindre le bundle). Le
 * composant client ne peut donc pas importer le moteur. Cette action est le
 * seul endroit ou le brouillon traverse vers la couche IA.
 *
 * Elle ne fait QUE la phase reseau. La verification, le classement des
 * reservations et l'assemblage restent dans `itineraryPhases.ts`, en pur, cote
 * navigateur : c'est ce qui permet au rail de cocher chaque phase apres son
 * propre travail au lieu d'animer un minuteur.
 */
export async function fetchItineraryProposal(
  draft: AdventurePrepDraft,
  availablePlaces?: readonly PlaceInventory[],
): Promise<ProposalResult> {
  // Aucune erreur ne sort d'ici : le repli regles est une reponse valide, pas
  // une exception. `requestDraftedItinerary` degrade deja en `null`.
  // L inventaire est fourni par l ecran, pas relu ici : `/api/pois` est une
  // route relative au navigateur, donc le serveur ne peut pas la rappeler, et
  // une deuxieme lecture de la meme source risquerait de diverger de celle du
  // resolveur. Il ne contient que des noms et des categories, donc il traverse
  // la frontiere serveur sans rien reveler.
  return requestDraftedItinerary(draft, new AbortController().signal, availablePlaces);
}

/* ------------------------------------------------------------------ */
/* Invitation — lien signe                                               */
/* ------------------------------------------------------------------ */

/**
 * Resolution du lien d'invitation. Meme frontiere que `fetchItineraryProposal` :
 * la cle de signature vit cote serveur et ne doit JAMAIS atteindre le bundle.
 *
 * Le jeton est celui de l'infra `crews` (`createInviteToken`, HMAC-SHA256) :
 * on ne reimplemente pas une seconde signature. La cle vient de
 * `CREW_INVITE_SECRET` ; sans elle, `createInviteToken` leve — on renvoie
 * `null` plutot que de laisser remonter une exception, et l'ecran affiche
 * alors son explication (« aucun lien ne partira d'ici ») plutot qu'un
 * bouton qui echoue en silence.
 *
 * LIEN ET ETAT DE L'AVENTURE : la cible `/rejoindre/<slug>` existe et sait
 * repondre honnêtement quand l'activite n'est pas encore publiee. tant que le
 * preparateur ne publie pas l'aventure, ce lien n ouvrira pas un equipage
 * existant : c'est une etape du chantier, pas une invention de notre part.
 */
export async function buildPrepInviteUrl(request: {
  adventureId: string;
  expiresInHours: number;
}): Promise<string | null> {
  const adventureId = typeof request?.adventureId === 'string' ? request.adventureId.trim() : '';
  if (adventureId === '') return null;

  const expiresInHours =
    Number.isFinite(request.expiresInHours) && request.expiresInHours > 0
      ? Math.min(Math.floor(request.expiresInHours), 24 * 30)
      : 72;

  let token: string;
  try {
    token = createInviteToken({
      crewId: adventureId,
      inviterId: 'anonyme',
      role: 'member',
      expiresInHours,
    });
  } catch {
    // Fail-closed : pas de cle de signature = pas de jeton, pas de faux lien.
    return null;
  }

  return `/rejoindre/${encodeURIComponent(adventureId)}?token=${encodeURIComponent(token)}`;
}
