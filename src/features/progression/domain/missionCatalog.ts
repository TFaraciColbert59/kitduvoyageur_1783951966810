/**
 * T12 — Catalogue de missions versionné (Progression 2.0, P2).
 *
 * Règles de l'économie appliquées ici :
 *   • une mission n'accorde AUCUN XP supplémentaire : sa fin est une
 *     DISTINCTION, et le gain annoncé est la somme des actions sources encore
 *     éligibles (calcul vivant, T14) ;
 *   • un modèle ne cite que des producteurs réellement disponibles (les sept
 *     preuves T09 — voir docs/progression/PRODUCER_MATRIX.md). Toute
 *     catégorie sans producteur prêt est explicitement FERMÉE avec sa
 *     dépendance, jamais promise ;
 *   • chaque modèle porte : critères (actions sources + seuil), période,
 *     provenance et version. Aucun montant en points n'est stocké.
 *
 * Les huit catégories du brief : découverte, préparation, progression,
 * communauté, coopération, collection, formation, personnelle.
 */

export type MissionCategory =
  | 'decouverte'
  | 'preparation'
  | 'progression'
  | 'communaute'
  | 'cooperation'
  | 'collection'
  | 'formation'
  | 'personnelle';

export const MISSION_CATEGORIES: readonly MissionCategory[] = [
  'decouverte',
  'preparation',
  'progression',
  'communaute',
  'cooperation',
  'collection',
  'formation',
  'personnelle',
] as const;

/** Producteurs disposant d'une preuve serveur vérifiée (T09). */
export const ACTIVE_PRODUCER_ACTIONS = [
  'hike_session_processed',
  'trail_prepared',
  'checklist_completed',
  'kit_field_report',
  'place_review',
  'carnet_published',
  'trip_completed',
] as const;

export type ActiveProducerAction = (typeof ACTIVE_PRODUCER_ACTIONS)[number];

export type MissionPeriod = 'ever' | 'week' | 'season';

export interface MissionModel {
  id: string;
  version: number;
  category: MissionCategory;
  title: string;
  /** Texte neutre : jamais de promesse de points, d'expertise ou de rôle. */
  description: string;
  /** Actions sources réellement comptabilisées (réalisations distinctes). */
  sourceActions: readonly ActiveProducerAction[];
  targetCount: number;
  period: MissionPeriod;
  provenance: 'canonical_v2';
  status: 'available' | 'closed';
  /** Raison exacte quand la catégorie est fermée (dépendance manquante). */
  closedReason?: string;
}

export const MISSION_CATALOG_V2: readonly MissionModel[] = [
  {
    id: 'mission_discovery_first_activity',
    version: 1,
    category: 'decouverte',
    title: 'Première aventure vérifiée',
    description: 'Accomplir une sortie réellement enregistrée et traitée.',
    sourceActions: ['hike_session_processed'],
    targetCount: 1,
    period: 'ever',
    provenance: 'canonical_v2',
    status: 'available',
  },
  {
    id: 'mission_prep_departure_checks',
    version: 1,
    category: 'preparation',
    title: 'Contrôles de départ',
    description: 'Terminer au moins trois contrôles dus sur une préparation.',
    sourceActions: ['checklist_completed'],
    targetCount: 1,
    period: 'ever',
    provenance: 'canonical_v2',
    status: 'available',
  },
  {
    id: 'mission_prep_kit_debrief',
    version: 1,
    category: 'preparation',
    title: 'Débrief terrain',
    description: 'Finaliser un débrief de kit après une sortie traitée.',
    sourceActions: ['kit_field_report'],
    targetCount: 1,
    period: 'ever',
    provenance: 'canonical_v2',
    status: 'available',
  },
  {
    id: 'mission_prep_trail_week',
    version: 1,
    category: 'preparation',
    title: 'Préparer sa semaine',
    description: 'Préparer une aventure depuis un sentier réel.',
    sourceActions: ['trail_prepared'],
    targetCount: 1,
    period: 'week',
    provenance: 'canonical_v2',
    status: 'available',
  },
  {
    id: 'mission_progress_itinerancy',
    version: 1,
    category: 'progression',
    title: 'Itinérance accomplie',
    description: 'Clôturer une aventure de plusieurs journées réellement vécue.',
    sourceActions: ['trip_completed'],
    targetCount: 1,
    period: 'ever',
    provenance: 'canonical_v2',
    status: 'available',
  },
  {
    id: 'mission_community_review',
    version: 1,
    category: 'communaute',
    title: 'Avis utile publié',
    description: 'Publier un avis qualifié sur un lieu.',
    sourceActions: ['place_review'],
    targetCount: 1,
    period: 'ever',
    provenance: 'canonical_v2',
    status: 'available',
  },
  {
    id: 'mission_community_carnet',
    version: 1,
    category: 'communaute',
    title: 'Carnet partagé',
    description: 'Publier un carnet d’aventure relié à une réalisation.',
    sourceActions: ['carnet_published'],
    targetCount: 1,
    period: 'ever',
    provenance: 'canonical_v2',
    status: 'available',
  },
  {
    id: 'mission_cooperation_outing',
    version: 1,
    category: 'cooperation',
    title: 'Sortie collective tenue',
    description: 'Coopération en préparation (preuve de présence collective à construire).',
    sourceActions: [],
    targetCount: 1,
    period: 'ever',
    provenance: 'canonical_v2',
    status: 'closed',
    closedReason: 'T30 — présence collective vérifiée non encore implémentée.',
  },
  {
    id: 'mission_collection_passport',
    version: 1,
    category: 'collection',
    title: 'Tampons de voyage',
    description: 'Collection géographique en préparation (découvertes canoniques à construire).',
    sourceActions: [],
    targetCount: 1,
    period: 'season',
    provenance: 'canonical_v2',
    status: 'closed',
    closedReason: 'T18 — table de découvertes géographiques non encore implémentée.',
  },
  {
    id: 'mission_formation_module',
    version: 1,
    category: 'formation',
    title: 'Module de préparation',
    description: 'Formation en préparation (module éditorial évalué côté serveur à construire).',
    sourceActions: [],
    targetCount: 1,
    period: 'ever',
    provenance: 'canonical_v2',
    status: 'closed',
    closedReason: 'P3 — producteur learning_module_completed non disponible (T22).',
  },
  {
    id: 'mission_personal_rhythm',
    version: 1,
    category: 'personnelle',
    title: 'Rythme choisi',
    description: 'Objectif personnel en préparation (rythme et pause à construire).',
    sourceActions: [],
    targetCount: 1,
    period: 'week',
    provenance: 'canonical_v2',
    status: 'closed',
    closedReason: 'T16 — rythme hebdomadaire et pause non encore implémentés.',
  },
] as const;

export function findMissionModel(id: string): MissionModel | null {
  return MISSION_CATALOG_V2.find((model) => model.id === id) ?? null;
}

export function availableMissionModels(): MissionModel[] {
  return MISSION_CATALOG_V2.filter((model) => model.status === 'available');
}

/**
 * T12 — Une mission n'accorde aucun XP propre : seul le moteur attribue, sur
 * les actions sources. Ce garde-fou est vérifié par les tests et l'interface
 * ne doit jamais afficher un montant de fin de mission.
 */
export function missionCompletionGrantsXp(): false {
  return false;
}
