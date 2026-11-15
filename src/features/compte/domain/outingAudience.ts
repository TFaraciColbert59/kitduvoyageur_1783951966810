/**
 * S6.13 / K7.04 — contrat d'affichage de l'audience d'une sortie.
 *
 * Le schéma réel ne connaît que deux valeurs pour `hike_sessions.visibility` :
 * `private` et `collective_anonymized` (contrainte
 * `hike_sessions_visibility_check`). `followers` et `public` sont demandés par
 * la fiche, mais n'ont aujourd'hui ni valeur stockable, ni policy RLS de
 * lecture, ni route de partage. Ce module les décrit donc comme indisponibles
 * au lieu de les simuler dans l'interface.
 *
 * Il est volontairement pur et sans import serveur : il peut être utilisé par
 * les écrans Compte, la carte et les futurs réglages de confidentialité.
 */

export type StoredOutingVisibility =
  | 'private'
  | 'followers'
  | 'public'
  | 'collective_anonymized';

export type OutingAudienceKey = StoredOutingVisibility;

export interface OutingAudienceOption {
  key: OutingAudienceKey;
  /** Libellé court, affiché comme choix principal. */
  label: string;
  /** Ce que l'option ferait si le contrat serveur la portait. */
  hint: string;
  /** Valeur réellement acceptée par l'API. */
  storedVisibility: StoredOutingVisibility | null;
  available: boolean;
  /** Raison visible quand l'option est indisponible. */
  reason?: string;
  /** Information visible pour une option disponible mais encadrée. */
  note?: string;
}

/**
 * Ordre volontaire : Moi uniquement, Mes abonnés, Public, puis Collectif anonymisé.
 */
export const OUTING_AUDIENCE_OPTIONS: readonly OutingAudienceOption[] = [
  {
    key: 'private',
    label: 'Moi uniquement',
    hint: 'La sortie reste privée. Toi seul·e peux la lire et la modifier ; tout lien existant est révoqué.',
    storedVisibility: 'private',
    available: true,
  },
  {
    key: 'followers',
    label: 'Mes abonnés',
    hint: 'Lecture réservée aux personnes qui te suivent, avec zones privées et métriques masquées.',
    storedVisibility: 'followers',
    available: true,
  },
  {
    key: 'public',
    label: 'Public',
    hint: 'Visible par la communauté ou via lien de partage révocable, avec zones privées protégées.',
    storedVisibility: 'public',
    available: true,
  },
  {
    key: 'collective_anonymized',
    label: 'Collectif anonymisé',
    hint: 'Contribution anonyme aux agrégats et cartes collectives sans exposer ton identité.',
    storedVisibility: 'collective_anonymized',
    available: true,
    note:
      'Les zones privées, le masquage départ/arrivée et tes choix de métriques s’appliquent automatiquement.',
  },
];

export const OUTING_AUDIENCE_CONTRACT_NOTE =
  'Chaque niveau applique tes zones privées, le masquage départ/arrivée et tes réglages de métriques côté serveur. Passer sur Privé révoque immédiatement les liens partagés.';

/** Normalise une valeur lue en base sans jamais inventer une audience publique. */
export function normalizeStoredOutingVisibility(
  value: unknown
): StoredOutingVisibility {
  if (
    value === 'followers' ||
    value === 'public' ||
    value === 'collective_anonymized'
  ) {
    return value;
  }
  return 'private';
}

export function outingVisibilityLabel(value: StoredOutingVisibility): string {
  switch (value) {
    case 'followers':
      return 'Mes abonnés';
    case 'public':
      return 'Public';
    case 'collective_anonymized':
      return 'Collectif anonymisé';
    default:
      return 'Moi uniquement';
  }
}

export function outingAudienceOption(
  value: StoredOutingVisibility
): OutingAudienceOption {
  return (
    OUTING_AUDIENCE_OPTIONS.find(
      (option) => option.storedVisibility === value
    ) ?? OUTING_AUDIENCE_OPTIONS[0]
  );
}

/** Options réellement applicables par l'API actuelle. */
export function availableOutingAudiences(): readonly OutingAudienceOption[] {
  return OUTING_AUDIENCE_OPTIONS.filter(
    (option) => option.available && option.storedVisibility !== null
  );
}
