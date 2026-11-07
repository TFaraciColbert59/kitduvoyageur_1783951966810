// Choix du mode du studio et état de la page, sans dépendance à Next : testable sans navigateur.
//
// Règle dure (P1, revue Lead) : le jeu de démonstration n'est affiché QUE sur `?debug=1`
// explicite (comme la maquette de référence). Toute autre requête suit le chemin de
// production : session obligatoire, données réelles uniquement, états vides/erreur explicites.
import type { StudioData } from '../domain/studioData';

export type StudioMode = 'debug' | 'production';

/** `?debug=1` → démonstration ; tout le reste → production. Un tableau (param répété) suit la 1re valeur. */
export function studioModeFromParam(debug: string | string[] | undefined): StudioMode {
  const value = Array.isArray(debug) ? debug[0] : debug;
  return value === '1' ? 'debug' : 'production';
}

export type StudioPageState =
  | { readonly kind: 'debug' }
  | { readonly kind: 'login'; readonly next: string }
  | { readonly kind: 'empty' }
  | { readonly kind: 'unavailable' }
  | { readonly kind: 'studio'; readonly data: StudioData };

export interface StudioPageDeps {
  /** Valeur brute de `?debug`. */
  readonly debug: string | string[] | undefined;
  /** Chemin de retour après connexion (`/kit-studio`). */
  readonly next: string;
  readonly getUser: () => Promise<{ readonly id: string } | null>;
  readonly getData: (userId: string) => Promise<StudioData>;
}

/**
 * Décide ce que la page doit afficher :
 * - `debug` : mode démonstration explicite (aucune lecture de session) ;
 * - `login` : pas de session → redirection connexion avec retour (jamais de données factices) ;
 * - `studio` : données réelles d'un compte ayant au moins un kit ;
 * - `empty` : compte connecté sans kit → état vide explicite (création hors P1) ;
 * - `unavailable` : base indisponible → état d'erreur ; le client peut proposer un cache
 *   local RÉEL déjà synchronisé, jamais un état initial de démonstration.
 */
export async function resolveStudioPageState(deps: StudioPageDeps): Promise<StudioPageState> {
  if (studioModeFromParam(deps.debug) === 'debug') return { kind: 'debug' };

  let user: { readonly id: string } | null;
  try {
    user = await deps.getUser();
  } catch {
    // Configuration/session illisible : on traite comme non connecté, jamais comme démo.
    user = null;
  }
  if (!user) return { kind: 'login', next: deps.next };

  try {
    const data = await deps.getData(user.id);
    return data.kits.length > 0 ? { kind: 'studio', data } : { kind: 'empty' };
  } catch {
    return { kind: 'unavailable' };
  }
}
