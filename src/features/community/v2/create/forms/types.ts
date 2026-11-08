import type { CreateNavV2 } from '../engine/nav';

/** Props communes des six formulaires V2, fournies par `CreateSheetV2`. */
export interface CreateFormV2Props {
  /** Le type est-il celui affiché ? (changement de type = étapes à zéro). */
  active: boolean;
  /**
   * Préremplissage (enchaînements internes et états vides) :
   * `{clubId, clubName}` pour une sortie de club, `{kitId, kitName}`, etc.
   */
  prefill?: Record<string, unknown> | null;
  /** Change à chaque nouveau préremplissage (réappliqué même à formulaire monté). */
  prefillNonce: number;
  /** Remonte le pied / la mini-capsule / l'erreur serveur à la coque. */
  onNavChange: (nav: CreateNavV2) => void;
  /**
   * Pages d'étapes fournies par la coque (`mini.pages`) : le moteur porte le
   * contenu de chaque étape dans sa page (glisser = étapes, pas de type).
   */
  stepHosts?: (HTMLElement | null)[] | null;
}

/** Valeurs de préremplissage connues (lecture sûre, aucune coercition). */
export function prefillString(prefill: Record<string, unknown> | null | undefined, key: string): string {
  const value = prefill?.[key];
  return typeof value === 'string' ? value : '';
}
