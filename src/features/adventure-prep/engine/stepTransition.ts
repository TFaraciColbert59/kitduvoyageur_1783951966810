import { isBuildable } from './itinerary';
import type { AdventurePrepDraft } from '../types';

/**
 * Passage de l'etape 1 (« Ce que tu veux ») a l'etape 2 (« En avant ! »).
 *
 * Ce module est la DECISION, en pur. Les composants ne font que la lire.
 *
 * Pourquoi elle existe seule : le defaut observe etait un bouton qui
 * construisait un parcours par les regles ET demandait l'etape 2 dans le meme
 * geste. L'ecran arrivait donc toujours avec un modele deja present, la
 * generation IA n'etait jamais declenchee, et l'utilisateur voyait un parcours
 * generique en croyant avoir obtenu une proposition de l'IA.
 *
 * La regle tient en une phrase : l'ecran 1 ne construit rien, il passe la
 * main. C'est l'etape 2 qui demarre la generation, une seule fois, et seulement
 * s'il reste effectivement quelque chose a construire.
 */

/**
 * Une generation deja vivante sur cet ecran. C est le seul cas ou le statut
 * « en_cours » ne suffit pas a decider : il faut savoir si CET ecran porte
 * deja la generation.
 */
export interface LiveRun {
  /** Le composant courant detient deja un AbortController de generation. */
  live: boolean;
}

/**
 * Faut-il demarrer la generation en arrivant sur l etape 2 ?
 *
 * Cinq refus, tous explicites :
 *
 * - une generation tourne deja sur cet ecran : le rail n est pas un minuteur,
 *   il ne se relance pas tout seul ;
 * - un parcours existe deja : on ne jette pas le travail de l utilisateur ;
 * - une generation terminee, en echec ou arretee par l utilisateur : elle se
 *   relance d un clic, jamais toute seule ;
 * - le brouillon ne peut rien construire : l ecran affiche alors ce qui manque,
 *   ce qui est plus honnete qu une generation qui echouerait aussitos.
 *
 * Le cas « en_cours » SANS generation vivante est deliberement accepte : c est
 * le correctif d un blocage observe et reproduit. Le nettoyage de l ecran coupe
 * l appel en cours au demontage, mais le statut, lui, persiste. Sans ce cas, un
 * simple remontage de l ecran laissait le rail fige indefiniment sur la premiere
 * phase, avec un parcours qui n aboutissait jamais et aucun message a l ecran.
 */
export function shouldLaunchGeneration(
  draft: AdventurePrepDraft,
  run?: LiveRun,
): boolean {
  if (run?.live === true) return false;
  if (draft.itinerary !== null) return false;
  const status = draft.generation.status;
  if (status === 'termine' || status === 'echec' || status === 'interrompu') return false;
  if (status !== 'idle' && status !== 'en_cours') return false;
  return isBuildable(draft);
}
