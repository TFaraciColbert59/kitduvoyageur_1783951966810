import type { CreateKindV2 } from './createSchemasV2';

/**
 * Étapes du moteur V2 : une seule liste par type de création, lue par la
 * mini-capsule de la coque (`Étape i : …`), par le pied (Retour / Suivant /
 * action finale) et par la validation (une seule validation par étape).
 *
 * Convention de libellé : le libellé de l'étape est celui de la mini-capsule ;
 * l'action finale est nommée par type (`Publier`, `Créer le carnet`…).
 */

export interface CreateStepV2 {
  /** Identifiant stable (navigation interne, tests). */
  id: string;
  /** Libellé visible et lu par les lecteurs d'écran. */
  label: string;
  /** Champs validés quand on quitte cette étape. */
  fields: readonly string[];
}

export interface CreateKindConfigV2 {
  kind: CreateKindV2;
  label: string;
  steps: readonly CreateStepV2[];
  finalLabel: string;
  /** Titre de l'île de succès (« Publié », « Story publiée »…). */
  successTitle: string;
}

const POST_STEPS: readonly CreateStepV2[] = [
  { id: 'format', label: 'Format', fields: ['format', 'audience', 'clubId'] },
  {
    id: 'contenu',
    label: 'Contenu',
    fields: ['media', 'title', 'content', 'location', 'locationLat', 'locationLng'],
  },
  // FID-062/FID-064 : Hashtags/Mentions séparés retirés (le hint maquette
  // vit dans la légende) ; la Diffusion ne valide plus de champ propre.
  { id: 'diffusion', label: 'Diffusion', fields: [] },
];

const STORY_STEPS: readonly CreateStepV2[] = [
  { id: 'media', label: 'Média', fields: ['media'] },
  {
    id: 'edition',
    label: 'Édition',
    fields: ['caption', 'altText', 'textLayers', 'stickers', 'trimStartMs', 'trimEndMs'],
  },
  { id: 'diffusion', label: 'Diffusion', fields: ['audience', 'replyPolicy', 'allowReshare'] },
];

const CARNET_STEPS: readonly CreateStepV2[] = [
  {
    id: 'infos',
    label: 'Infos',
    // FID-064 : le stepper « Nombre de jours » vit en Infos (maquette L2970).
    // `days` reste validé à l'étape Jours (moments incomplets).
    fields: ['title', 'destination', 'startDate', 'endDate', 'nbJours', 'description', 'nbVoyageurs', 'visibility'],
  },
  { id: 'trace', label: 'Tracé', fields: ['trace', 'distanceKm', 'deniveleM'] },
  { id: 'jours', label: 'Jours', fields: ['days'] },
  { id: 'partage', label: 'Partage', fields: ['coverMediaId', 'tags', 'collaborators', 'postContent'] },
];

const SORTIE_STEPS: readonly CreateStepV2[] = [
  {
    id: 'activite',
    label: 'Activité et lieu',
    // FID-064 : date, heure et récurrence sont sur l'étape 1 de la maquette
    // (fieldset « Rendez-vous », HTML L3120-3124), avec le lieu du RDV.
    fields: [
      'activity',
      'title',
      'location',
      'meetingPoint',
      'meetingLat',
      'meetingLng',
      'date',
      'startTime',
      'endTime',
      'recurrence',
    ],
  },
  {
    id: 'itineraire',
    label: 'Itinéraire',
    fields: ['level', 'distanceKm', 'elevationGainM', 'duration'],
  },
  {
    id: 'participants',
    label: 'Participants',
    fields: ['maxParticipants', 'waitlist', 'clubId'],
  },
  {
    id: 'securite',
    label: 'Sécurité',
    // FID-064 : le matériel requis (kit) est sur l'étape Sécurité (L3138).
    fields: ['safetyChecklist', 'safetyNotes', 'kitId', 'description', 'announce', 'clientRequestId'],
  },
];

const KIT_STEPS: readonly CreateStepV2[] = [
  { id: 'inventaire', label: 'Inventaire', fields: ['items'] },
  { id: 'completer', label: 'Compléter', fields: ['season', 'cover'] },
  // FID-053 : la description passe en étape 3 (maquette L3208).
  { id: 'partager', label: 'Partager', fields: ['name', 'description', 'isPublic', 'clientRequestId'] },
];

const CLUB_STEPS: readonly CreateStepV2[] = [
  { id: 'identite', label: 'Identité', fields: ['name', 'slug'] },
  {
    id: 'univers',
    label: 'Univers',
    // Images du club (avatar carré + bannière 3:1) sur l'étape Univers, comme
    // la maquette (HTML L3283-3289), avec les activités et la description.
    fields: ['activities', 'description', 'locationLabel', 'zoneRadiusKm', 'avatar', 'banner'],
  },
  { id: 'adhesion', label: 'Adhésion', fields: ['privacy', 'membershipRules', 'joinQuestions'] },
  { id: 'publication', label: 'Publication', fields: ['welcomePost', 'welcomeContent', 'clientRequestId'] },
];

export const CREATE_KIND_CONFIGS: Record<CreateKindV2, CreateKindConfigV2> = {
  post: {
    kind: 'post',
    label: 'Publication',
    steps: POST_STEPS,
    finalLabel: 'Publier',
    successTitle: 'Publié',
  },
  story: {
    kind: 'story',
    label: 'Story',
    steps: STORY_STEPS,
    finalLabel: 'Publier la story',
    successTitle: 'Story publiée',
  },
  carnet: {
    kind: 'carnet',
    label: 'Carnet',
    steps: CARNET_STEPS,
    finalLabel: 'Créer le carnet',
    successTitle: 'Carnet créé',
  },
  sortie: {
    kind: 'sortie',
    label: 'Sortie',
    steps: SORTIE_STEPS,
    finalLabel: 'Créer la sortie',
    successTitle: 'Sortie créée',
  },
  kit: {
    kind: 'kit',
    label: 'Kit',
    steps: KIT_STEPS,
    finalLabel: 'Créer le kit',
    successTitle: 'Kit créé',
  },
  club: {
    kind: 'club',
    label: 'Club',
    steps: CLUB_STEPS,
    finalLabel: 'Créer le club',
    successTitle: 'Club créé',
  },
};

export function createStepsFor(kind: CreateKindV2): readonly CreateStepV2[] {
  return CREATE_KIND_CONFIGS[kind].steps;
}

export function createKindConfig(kind: CreateKindV2): CreateKindConfigV2 {
  return CREATE_KIND_CONFIGS[kind];
}

/**
 * Libellé accessible d'une étape : « Étape 2 : Contenu ». C'est le libellé de
 * la mini-capsule (icône = numéro, texte lu par les lecteurs d'écran).
 */
export function stepAriaLabel(index: number, label: string): string {
  return `Étape ${index + 1} : ${label}`;
}

/** Étape qui contient un champ (repli : 0). */
export function stepIndexOfField(kind: CreateKindV2, field: string): number {
  const steps = createStepsFor(kind);
  const root = field.split('.')[0] ?? field;
  const index = steps.findIndex((step) => step.fields.includes(root));
  return index >= 0 ? index : 0;
}
