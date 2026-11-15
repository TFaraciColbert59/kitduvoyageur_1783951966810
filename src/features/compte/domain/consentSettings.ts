/**
 * Contrat d'affichage des consentements du Compte (client-serveur).
 *
 * La persistance existante est `public.adventure_data_consents` : une ligne
 * par `(user_id, purpose, policy_version)`. Il n'existe **aucune** colonne
 * fournisseur, aucun jeton OAuth et aucun connecteur santé réel. Les
 * fournisseurs ci-dessous sont donc des dépendances déclarées, jamais des
 * connexions simulées : `connected` reste false et aucun consentement
 * fournisseur n'est écrit.
 */

export type ConsentPurposeId =
  | 'personal_performance'
  | 'collective_terrain'
  | 'live_location'
  | 'group_location'
  | 'external_readiness';

export interface ConsentUsageDefinition {
  id: ConsentPurposeId;
  label: string;
  summary: string;
  detail: string;
  sensitivity: 'standard' | 'localisation' | 'sante';
}

export const CONSENT_USAGE_DEFINITIONS: readonly ConsentUsageDefinition[] = [
  {
    id: 'personal_performance',
    label: 'Performance personnelle',
    summary: 'Profils, prédictions et observations dérivés de tes sorties.',
    detail:
      'Sert uniquement à ton analyse personnelle. Aucune trace brute ni observation dérivée n’est publiée.',
    sensitivity: 'standard',
  },
  {
    id: 'collective_terrain',
    label: 'Terrain collectif',
    summary: 'Contribuer aux agrégats de sentiers, sans identité ni trace brute.',
    detail:
      'Seules des mesures agrégées et un seuil minimal de contributeurs distincts peuvent être publiés. Le retrait déclenche la purge prévue par le traitement serveur.',
    sensitivity: 'standard',
  },
  {
    id: 'live_location',
    label: 'Partage en direct',
    summary: 'Diffuser ta position pendant une sortie, avec arrêt immédiat.',
    detail:
      'La position n’est diffusée qu’aux destinataires explicitement choisis et pour la durée annoncée. L’arrêt coupe les accès futurs ; une copie déjà reçue ne peut pas être effacée.',
    sensitivity: 'localisation',
  },
  {
    id: 'group_location',
    label: 'Position du groupe',
    summary: 'Partager ta position avec les membres d’une sortie.',
    detail:
      'Réservé aux membres de la sortie concernée. Aucun historique de position n’est exposé aux autres surfaces.',
    sensitivity: 'localisation',
  },
  {
    id: 'external_readiness',
    label: 'Données de santé',
    summary: 'Sommeil, VFC, fréquence cardiaque et récupération.',
    detail:
      'Désactivé par le contrat Phase 1 : aucun connecteur HealthKit, Health Connect, Garmin ou BLE n’est livré. Aucune donnée de santé n’est lue, stockée ou transmise.',
    sensitivity: 'sante',
  },
];

export type ConsentProviderKind = 'health' | 'gps' | 'oauth' | 'sensor';

export interface ConsentProviderDefinition {
  id: string;
  label: string;
  kind: ConsentProviderKind;
  platforms: string;
  /** Usages que le fournisseur servirait s'il était connecté. */
  usageIds: readonly ConsentPurposeId[];
  /** Dépendance de chantier qui doit livrer le contrat de connexion. */
  dependency: string;
}

/**
 * Fournisseurs nommés par les fiches voisines (S6.03, S6.04, S6.06, S6.27).
 * Aucun adaptateur, aucune autorisation et aucun jeton ne sont présents dans
 * le dépôt à ce stade. Cette liste sert à rendre la dépendance lisible, pas à
 * simuler une intégration.
 */
export const CONSENT_PROVIDER_DEFINITIONS: readonly ConsentProviderDefinition[] = [
  {
    id: 'apple_health',
    label: 'Apple Santé',
    kind: 'health',
    platforms: 'iOS',
    usageIds: ['external_readiness'],
    dependency: 'D02 · HealthKit',
  },
  {
    id: 'health_connect',
    label: 'Health Connect',
    kind: 'health',
    platforms: 'Android',
    usageIds: ['external_readiness'],
    dependency: 'D02 · Health Connect',
  },
  {
    id: 'garmin',
    label: 'Garmin',
    kind: 'gps',
    platforms: 'Web · mobile',
    usageIds: ['personal_performance', 'collective_terrain'],
    dependency: 'D01 · OAuth Garmin',
  },
  {
    id: 'strava',
    label: 'Strava',
    kind: 'oauth',
    platforms: 'Web · mobile',
    usageIds: ['personal_performance', 'collective_terrain'],
    dependency: 'D01 · OAuth Strava',
  },
  {
    id: 'ble_sensors',
    label: 'Capteurs Bluetooth',
    kind: 'sensor',
    platforms: 'iOS · Android',
    usageIds: ['personal_performance'],
    dependency: 'D02 · BLE',
  },
];

export type ConsentProviderStatus = 'contract_missing';

export interface ConsentUsageState extends ConsentUsageDefinition {
  granted: boolean;
  disabled: boolean;
  policyVersion: string | null;
  grantedAt: string | null;
  revokedAt: string | null;
}

export interface ConsentProviderState extends ConsentProviderDefinition {
  connected: false;
  revocable: false;
  status: ConsentProviderStatus;
  reason: string;
}

export interface ConsentSettingsPayload {
  purposes: ConsentUsageState[];
  providers: ConsentProviderState[];
  policyVersion: string;
  externalReadinessDisabled: boolean;
  fetchedAt: string;
}

/** Copie stable côté client pour les libellés, sans requête supplémentaire. */
export const CONSENT_USAGE_COPY: Record<ConsentPurposeId, ConsentUsageDefinition> =
  Object.fromEntries(CONSENT_USAGE_DEFINITIONS.map((usage) => [usage.id, usage])) as Record<
    ConsentPurposeId,
    ConsentUsageDefinition
  >;
