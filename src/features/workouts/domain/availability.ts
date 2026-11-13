import type {
  ProviderAvailability,
  WorkoutProviderId,
} from './types';

/**
 * Disponibilité réelle des fournisseurs d'entraînement.
 *
 * Aucun contrat Runna, CTS ou Garmin n'est présent dans ce dépôt. Ces entrées
 * ne sont donc pas des connecteurs « en attente de synchronisation » : elles
 * sont explicitement indisponibles, avec la raison affichable. Les plans
 * LKDV natifs restent, eux, disponibles et ne prétendent pas reproduire un
 * contenu partenaire.
 */
const PROVIDERS: Record<WorkoutProviderId, ProviderAvailability> = {
  lkdv: {
    id: 'lkdv',
    label: 'Plans LKDV',
    kind: 'plan',
    status: 'available',
    reason: null,
    detail:
      'Plans progressifs et séances structurées natifs LKDV, sans API partenaire.',
  },
  runna: {
    id: 'runna',
    label: 'Runna',
    kind: 'plan',
    status: 'unavailable',
    reason: 'no_license',
    detail:
      'Aucun accès Runna sous licence dans ce dépôt : aucun plan Runna ne peut être affiché ni synchronisé.',
  },
  cts: {
    id: 'cts',
    label: 'CTS',
    kind: 'plan',
    status: 'unavailable',
    reason: 'no_license',
    detail:
      'Aucun accès CTS sous licence dans ce dépôt : aucun plan vélo CTS ne peut être affiché ni synchronisé.',
  },
  garmin: {
    id: 'garmin',
    label: 'Montre Garmin',
    kind: 'device',
    status: 'unavailable',
    reason: 'connector_absent',
    detail:
      'Aucun connecteur montre/Garmin enregistré : l’envoi de séance est indisponible, l’exécution locale reste disponible.',
  },
};

export const WORKOUT_PROVIDER_IDS: readonly WorkoutProviderId[] = [
  'lkdv',
  'runna',
  'cts',
  'garmin',
];

export function getProviderAvailability(
  id: WorkoutProviderId
): ProviderAvailability {
  return PROVIDERS[id];
}

export function listProviderAvailability(): ProviderAvailability[] {
  return WORKOUT_PROVIDER_IDS.map((id) => PROVIDERS[id]);
}

/** Vrai uniquement si le fournisseur est réellement exploitable aujourd'hui. */
export function isProviderAvailable(id: WorkoutProviderId): boolean {
  return PROVIDERS[id].status === 'available';
}

/** Les partenaires ne sont jamais présentés comme connectés. */
export function unavailablePartnerLabels(): string[] {
  return listProviderAvailability()
    .filter((provider) => provider.kind === 'plan' && provider.status === 'unavailable')
    .map((provider) => provider.label);
}
