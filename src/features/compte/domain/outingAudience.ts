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

export type StoredOutingVisibility = 'private' | 'collective_anonymized';

export type OutingAudienceKey =
  | 'private'
  | 'followers'
  | 'public'
  | 'collective_anonymized';

export interface OutingAudienceOption {
  key: OutingAudienceKey;
  /** Libellé court, affiché comme choix principal. */
  label: string;
  /** Ce que l'option ferait si le contrat serveur la portait. */
  hint: string;
  /** Valeur réellement acceptée par l'API, ou `null` si l'option est bloquée. */
  storedVisibility: StoredOutingVisibility | null;
  available: boolean;
  /** Raison visible quand l'option est indisponible (jamais une infobulle seule). */
  reason?: string;
  /** Information visible pour une option disponible mais non publique. */
  note?: string;
}

/**
 * Ordre volontaire : les trois audiences demandées par la fiche d'abord
 * (moi, abonnés, public), puis la valeur historique réellement stockée.
 */
export const OUTING_AUDIENCE_OPTIONS: readonly OutingAudienceOption[] = [
  {
    key: 'private',
    label: 'Moi uniquement',
    hint: 'La sortie reste privée. Toi seul·e peux la lire et la modifier.',
    storedVisibility: 'private',
    available: true,
  },
  {
    key: 'followers',
    label: 'Mes abonnés',
    hint: 'Lecture réservée aux personnes qui te suivent.',
    storedVisibility: null,
    available: false,
    reason:
      'Indisponible : la contrainte de hike_sessions.visibility n’accepte pas followers et aucune policy RLS ne lit une sortie via user_follows.',
  },
  {
    key: 'public',
    label: 'Public',
    hint: 'Lecture par toute personne disposant d’un lien.',
    storedVisibility: null,
    available: false,
    reason:
      'Indisponible : aucune valeur public, aucune policy de lecture publique directe (seul un carnet public expose sa session liée) et aucun lien de partage de sortie. La valeur collective_anonymized ne rend pas la sortie publique.',
  },
  {
    key: 'collective_anonymized',
    label: 'Collectif anonymisé',
    hint: 'Valeur historique de contribution collective ; elle ne publie pas la sortie.',
    storedVisibility: 'collective_anonymized',
    available: true,
    note:
      'Valeur existante en base, mais aucune vue ni policy ne l’expose en raison de cette valeur. Elle ne remplace ni Public ni Abonnés.',
  },
];

export const OUTING_AUDIENCE_CONTRACT_NOTE =
  'Le contrat serveur actuel ne stocke que private et collective_anonymized. Public et Abonnés exigent une migration (valeurs, policies RLS et lien de partage) : ils restent affichés désactivés, jamais simulés.';

/** Normalise une valeur lue en base sans jamais inventer une audience publique. */
export function normalizeStoredOutingVisibility(
  value: unknown
): StoredOutingVisibility {
  return value === 'collective_anonymized' ? 'collective_anonymized' : 'private';
}

export function outingVisibilityLabel(value: StoredOutingVisibility): string {
  return value === 'collective_anonymized' ? 'Collectif anonymisé' : 'Moi uniquement';
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
