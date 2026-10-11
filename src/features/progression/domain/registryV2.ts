import type { ProgressionFamily, ProgressionRegistryAction, ProgressionRegistryV2 } from './types';

/**
 * Contrat économique Progression 2.0 (T05) — registre versionné, gelé.
 *
 * Autorité : `docs/progression/2.0/economie.md` (montants, quotas, preuves).
 * Ce contrat est une SPÉCIFICATION : sa publication en base (barème v2) est
 * une migration additive (T08) et son activation reste fermée (T47) tant que
 * les preuves et cohortes ne sont pas vérifiées. Les anciens gains gardent
 * leur montant et leur version d'origine — aucun recrédit historique.
 *
 * Invariants portés par le type et vérifiés par `registryV2.spec.ts` :
 * - un seul gain par réalisation, réparti entre les quatre compétences (somme
 *   des poids = 1 exactement) ;
 * - les colonnes jour/semaine/saison sont des nombres d'ACTIONS ;
 * - dates métier immuables : l'application se fait par `effectiveFrom` ;
 * - aucune conversion XP/argent : la section commerciale n'expose que des
 *   unités distinctes et une porte d'activation.
 */

export const PROGRESSION_REGISTRY_V2_VERSION = 'v2';

/** Date métier cible — l'activation réelle passe par la porte P1/P7 (T47). */
export const PROGRESSION_REGISTRY_V2_EFFECTIVE_FROM = '2026-11-01T00:00:00.000Z';

export const PROGRESSION_REGISTRY_V2: ProgressionRegistryV2 = {
  version: PROGRESSION_REGISTRY_V2_VERSION,
  effectiveFrom: PROGRESSION_REGISTRY_V2_EFFECTIVE_FROM,
  latePolicy: 'lifetime_only',
  graceDays: 14,
  seasonDurationWeeks: 8,
  familyCaps: [
    { family: 'terrain', weekPoints: 600, seasonPoints: 4800 },
    { family: 'preparation', weekPoints: 120, seasonPoints: 960 },
    { family: 'partage', weekPoints: 180, seasonPoints: 1440 },
    { family: 'entraide', weekPoints: 180, seasonPoints: 1440 },
  ],
  capGroups: [
    {
      id: 'terrain_activity',
      label: 'Activités de terrain (randonnée et adaptateurs)',
      caps: { day: 2, week: 8, season: 48 },
      members: ['hike_session_processed', 'activity_completed'],
    },
    {
      id: 'preparation_authored',
      label: 'Préparations écrites (sentier et Compas)',
      caps: { day: 1, week: 3, season: 18 },
      members: ['trail_prepared', 'compas_prepared'],
    },
    {
      id: 'loan_roles',
      label: 'Rôles de prêt (prêteur et emprunteur)',
      caps: { day: 1, week: 2, season: 8 },
      members: ['loan_lent', 'loan_returned'],
    },
  ],
  skillMilestones: [100, 300, 700, 1500, 3000],
  actions: [
    /* ------------------------------- Terrain ------------------------------ */
    {
      id: 'hike_session_processed',
      label: 'Randonnée réellement accomplie',
      family: 'terrain',
      firstPhase: 'P1',
      weights: { explorer: 1, preparer: 0, partager: 0, entraider: 0 },
      points: {
        kind: 'duration_tiers',
        base: 40,
        max: 150,
        tiers: [
          { minActiveMinutes: 20, points: 40 },
          { minActiveMinutes: 60, points: 70 },
          { minActiveMinutes: 120, points: 100 },
          { minActiveMinutes: 240, points: 130 },
        ],
        adaptedObjectiveFloor: 40,
      },
      novelty: { points: 20, perSeason: true, maxTotal: 150, scope: 'canonical_trail' },
      caps: { day: 2, week: 8, season: 48 },
      capGroup: 'terrain_activity',
      claims: {
        kinds: ['source', 'activity', 'novelty'],
        note: 'Durée active recalculée serveur ; pauses exclues ; nouveauté une fois par parcours canonique et par saison.',
      },
      proof:
        'Session traitée serveur avec durée active recalculée ; le rapprochement de parcours contrôle géométrie et activité, pas seulement un identifiant OSM.',
    },
    {
      id: 'activity_completed',
      label: 'Vélo, activité urbaine, sortie accessible ou autre activité accomplie',
      family: 'terrain',
      firstPhase: 'P3',
      weights: { explorer: 1, preparer: 0, partager: 0, entraider: 0 },
      points: {
        kind: 'duration_tiers',
        base: 40,
        max: 150,
        tiers: [
          { minActiveMinutes: 20, points: 40 },
          { minActiveMinutes: 60, points: 70 },
          { minActiveMinutes: 120, points: 100 },
          { minActiveMinutes: 240, points: 130 },
        ],
        adaptedObjectiveFloor: 40,
      },
      novelty: { points: 20, perSeason: true, maxTotal: 150, scope: 'canonical_trail' },
      caps: { day: 2, week: 8, season: 48 },
      capGroup: 'terrain_activity',
      claims: {
        kinds: ['source', 'activity', 'novelty'],
        note: 'Clé d’activité commune : une même sortie multitag ne produit qu’un gain, quel que soit l’adaptateur.',
      },
      proof:
        'Nouveau producteur par adaptateur métier ; réalisation vérifiée, objectif accessible et consentement ; durées contrôlées côté serveur.',
    },
    {
      id: 'itinerancy_completed',
      label: 'Clôturer une itinérance réellement accomplie',
      family: 'terrain',
      firstPhase: 'P1',
      weights: { explorer: 0.7, preparer: 0.3, partager: 0, entraider: 0 },
      points: { kind: 'fixed', base: 45, max: 45 },
      caps: { day: 1, week: 2, season: 8 },
      claims: {
        kinds: ['source', 'aventure'],
        note: 'Une checklist seule ne prouve plus le voyage ; cumul avec les sorties journalières uniquement si l’itinérance est un accomplissement distinct.',
      },
      proof:
        'Au moins 2 journées distinctes et 2 réalisations liées, propriété et couverture vérifiées.',
    },

    /* ----------------------------- Préparation ---------------------------- */
    {
      id: 'trail_prepared',
      label: 'Préparer une aventure depuis un sentier',
      family: 'preparation',
      firstPhase: 'P1',
      weights: { explorer: 0, preparer: 1, partager: 0, entraider: 0 },
      points: { kind: 'fixed', base: 30, max: 30 },
      caps: { day: 1, week: 3, season: 18 },
      capGroup: 'preparation_authored',
      claims: {
        kinds: ['source', 'aventure'],
        exclusiveWith: ['compas_prepared'],
        note: 'La création seule ne suffit plus ; préparation pertinente terminée et rattachée à un sentier réel.',
      },
      proof: 'Sentier réel et préparation pertinente terminée ; claim partagé avec le Compas pour la même aventure.',
    },
    {
      id: 'compas_prepared',
      label: 'Préparer une aventure sans sentier, dans le Compas',
      family: 'preparation',
      firstPhase: 'P3',
      weights: { explorer: 0, preparer: 1, partager: 0, entraider: 0 },
      points: { kind: 'fixed', base: 30, max: 30 },
      caps: { day: 1, week: 3, season: 18 },
      capGroup: 'preparation_authored',
      claims: {
        kinds: ['source', 'aventure'],
        exclusiveWith: ['trail_prepared'],
      },
      proof: 'Mêmes contrôles de pertinence que le sentier ; exclut le gain trail_prepared pour la même aventure.',
    },
    {
      id: 'checklist_completed',
      label: 'Terminer les contrôles de départ',
      family: 'preparation',
      firstPhase: 'P1',
      weights: { explorer: 0, preparer: 1, partager: 0, entraider: 0 },
      points: { kind: 'fixed', base: 25, max: 25 },
      caps: { day: 1, week: 4, season: 24 },
      claims: {
        kinds: ['source'],
        note: 'Une création vide ou un item libre coché ne suffit pas.',
      },
      proof: 'Checklist serveur non vide, au moins 3 contrôles dus pertinents ; un item libre coché ne suffit pas.',
    },
    {
      id: 'kit_field_report',
      label: 'Finaliser le débrief terrain du kit',
      family: 'preparation',
      firstPhase: 'P1',
      weights: { explorer: 0, preparer: 0.7, partager: 0.3, entraider: 0 },
      points: {
        kind: 'items_bonus',
        base: 20,
        max: 40,
        itemsBonus: { perItem: 2, maxItems: 10 },
      },
      caps: { day: 1, week: 3, season: 18 },
      claims: {
        kinds: ['source'],
        exclusiveWith: ['gear_review'],
        note: 'Attribution à la finalisation du débrief, observations sauvegardées ; le même débrief transformé en avis ne recrédite pas.',
      },
      proof: '20 + 2 par équipement distinct évalué (maximum 10), snapshot final sur activité vérifiée.',
    },
    {
      id: 'learning_module_completed',
      label: 'Réussir un module de préparation, orientation ou sécurité',
      family: 'preparation',
      firstPhase: 'P3',
      weights: { explorer: 0, preparer: 1, partager: 0, entraider: 0 },
      points: { kind: 'fixed', base: 30, max: 30 },
      caps: { day: 1, week: 2, season: 8 },
      claims: { kinds: ['source'], note: 'Une fois par module substantiel.' },
      proof:
        'Évaluation côté serveur, module éditorial validé ; aucune qualification professionnelle promise.',
    },
    {
      id: 'gear_maintenance',
      label: 'Effectuer un entretien documenté du matériel',
      family: 'preparation',
      firstPhase: 'P5',
      weights: { explorer: 0, preparer: 1, partager: 0, entraider: 0 },
      points: { kind: 'fixed', base: 20, max: 20 },
      caps: { day: 1, week: 1, season: 4 },
      claims: { kinds: ['source', 'object'], perObjectCooldownDays: 90 },
      proof:
        'Intervention réelle et confirmation proportionnée ; une simple alerte résolue ne suffit pas ; objet 1/90 jours.',
    },
    {
      id: 'kit_improved',
      label: 'Améliorer un kit à partir d’un retour terrain',
      family: 'preparation',
      firstPhase: 'P3',
      weights: { explorer: 0, preparer: 1, partager: 0, entraider: 0 },
      points: { kind: 'fixed', base: 25, max: 25 },
      caps: { day: 1, week: 1, season: 4 },
      claims: {
        kinds: ['source'],
        note: 'Version inverse et réduction de poids seule exclues ; éléments de sécurité conservés.',
      },
      proof:
        'Différence persistée avec problème terrain résolu et éléments de sécurité conservés ; auto-forks exclus.',
    },

    /* ------------------------------- Partage ------------------------------ */
    {
      id: 'place_review',
      label: 'Publier un avis utile sur un lieu',
      family: 'partage',
      firstPhase: 'P1',
      weights: { explorer: 0, preparer: 0, partager: 1, entraider: 0 },
      points: {
        kind: 'tiered_by_proof',
        base: 15,
        min: 15,
        max: 40,
        proofTiers: { withoutProof: 15, withProof: 40 },
      },
      caps: { day: 2, week: 6, season: 24 },
      claims: {
        kinds: ['source'],
        note: 'Publication et éditions = une seule demande ; une visite ajoutée après attribution ne crée pas de seconde récompense.',
      },
      proof:
        '15 après contrôle du contenu, 40 si preuve de visite contrôlée dès attribution ; pas de crédit d’édition.',
    },
    {
      id: 'carnet_published',
      label: 'Publier un carnet d’aventure utile',
      family: 'partage',
      firstPhase: 'P1',
      weights: { explorer: 0, preparer: 0, partager: 1, entraider: 0 },
      points: { kind: 'fixed', base: 60, max: 60 },
      caps: { day: 1, week: 2, season: 12 },
      claims: {
        kinds: ['source', 'media'],
        note: 'Mêmes médias non recrédités ailleurs (lieu, photo).',
      },
      proof: 'Publication volontaire public/amis, réalisation réelle liée et contenu original suffisant.',
    },
    {
      id: 'kit_shared',
      label: 'Partager un kit éprouvé et documenté',
      family: 'partage',
      firstPhase: 'P3',
      weights: { explorer: 0, preparer: 0.2, partager: 0.8, entraider: 0 },
      points: { kind: 'fixed', base: 30, max: 30 },
      caps: { day: 1, week: 2, season: 8 },
      claims: { kinds: ['source'], note: 'Une fois par kit racine et contributeur ; auto-forks exclus.' },
      proof: 'Kit porté sur terrain et commentaire utile.',
    },
    {
      id: 'place_photo',
      label: 'Ajouter une photo de terrain utile à un lieu',
      family: 'partage',
      firstPhase: 'P4',
      weights: { explorer: 0, preparer: 0, partager: 1, entraider: 0 },
      points: { kind: 'fixed', base: 10, max: 10 },
      caps: { day: 3, week: 5, season: 20 },
      claims: { kinds: ['source', 'media'], maxPerActivity: 3 },
      proof:
        'Photo originale, visitée, consentie et acceptée ; pas de gain si le même média est rémunéré dans un carnet.',
    },
    {
      id: 'guide_contribution',
      label: 'Faire accepter une contribution substantielle à un guide',
      family: 'partage',
      firstPhase: 'P4',
      weights: { explorer: 0, preparer: 0, partager: 0.5, entraider: 0.5 },
      points: { kind: 'fixed', base: 80, max: 80 },
      caps: { day: 1, week: 1, season: 4 },
      claims: { kinds: ['source'], note: 'Delta inédit — pas le recopiage d’un carnet déjà crédité.' },
      proof: 'Révision identifiable relue et acceptée.',
    },
    {
      id: 'translation_accepted',
      label: 'Faire accepter une traduction utile',
      family: 'partage',
      firstPhase: 'P4',
      weights: { explorer: 0, preparer: 0, partager: 0.7, entraider: 0.3 },
      points: { kind: 'fixed', base: 20, max: 20 },
      caps: { day: 2, week: 3, season: 12 },
      claims: { kinds: ['source'], note: 'Génération brute IA non éligible.' },
      proof: 'Révision relue, licence permise, langue cible et contenu utiles.',
    },
    {
      id: 'trace_contribution',
      label: 'Contribuer une trace utile et authentifiée',
      family: 'partage',
      firstPhase: 'P4',
      weights: { explorer: 0, preparer: 0, partager: 0.6, entraider: 0.4 },
      points: { kind: 'fixed', base: 40, max: 40 },
      caps: { day: 1, week: 2, season: 8 },
      claims: {
        kinds: ['source', 'media'],
        note: 'Import seul ou répétition de la même trace exclu.',
      },
      proof:
        'Trace d’une réalisation contrôlée apportant une donnée nouvelle acceptée ; licence et zones sensibles conservées.',
    },
    {
      id: 'gear_review',
      label: 'Publier un avis matériel fondé sur son utilisation',
      family: 'partage',
      firstPhase: 'P4',
      weights: { explorer: 0, preparer: 0, partager: 1, entraider: 0 },
      points: { kind: 'fixed', base: 15, max: 15 },
      caps: { day: 1, week: 2, season: 8 },
      claims: {
        kinds: ['source'],
        exclusiveWith: ['kit_field_report'],
        note: 'Avis recopié du même débrief ne double pas le gain ; équipement emprunté ou possédé traité également.',
      },
      proof: 'Équipement porté/utilisé, acheté ou emprunté ; contenu utile.',
    },
    {
      id: 'nature_observation',
      label: 'Faire valider une observation naturaliste utile',
      family: 'partage',
      firstPhase: 'P5',
      weights: { explorer: 0, preparer: 0, partager: 0.8, entraider: 0.2 },
      points: { kind: 'fixed', base: 15, max: 15 },
      caps: { day: 2, week: 3, season: 12 },
      claims: {
        kinds: ['source', 'media'],
        note: 'Prédiction IA seule exclue ; lieu sensible protégé.',
      },
      proof: 'Validation éditoriale/partenaire.',
    },

    /* ------------------------------- Entraide ----------------------------- */
    {
      id: 'place_report_accepted',
      label: 'Faire accepter une correction de lieu ou de sentier',
      family: 'entraide',
      firstPhase: 'P4',
      weights: { explorer: 0, preparer: 0, partager: 0.5, entraider: 0.5 },
      points: { kind: 'fixed', base: 40, max: 40 },
      caps: { day: 1, week: 3, season: 12 },
      claims: {
        kinds: ['source', 'report'],
        exclusiveWith: ['accessibility_info_accepted'],
        note: 'Doublon de problème exclu ; rapport pending reste sans gain.',
      },
      proof: 'Delta utile et récent accepté par modérateur indépendant.',
    },
    {
      id: 'answer_accepted',
      label: 'Apporter une réponse acceptée et utile',
      family: 'entraide',
      firstPhase: 'P4',
      weights: { explorer: 0, preparer: 0, partager: 0, entraider: 1 },
      points: { kind: 'fixed', base: 25, max: 25 },
      caps: { day: 2, week: 4, season: 16 },
      claims: {
        kinds: ['source'],
        note: 'Un gain par question ; demandeur et répondant distincts.',
      },
      proof: 'Réponse acceptée par demandeur distinct, contrôle anti-collusion.',
    },
    {
      id: 'mentoring_session',
      label: 'Accomplir une séance d’entraide ou d’accompagnement',
      family: 'entraide',
      firstPhase: 'P5',
      weights: { explorer: 0, preparer: 0.2, partager: 0, entraider: 0.8 },
      points: { kind: 'fixed', base: 40, max: 40 },
      caps: { day: 1, week: 2, season: 8 },
      claims: { kinds: ['source', 'pair'], perPairCooldownDays: 30 },
      proof:
        'Session consentie et double confirmation, présence objectivée sans enregistrer la conversation ; paire limitée à 1/mois.',
    },
    {
      id: 'group_event_organized',
      label: 'Organiser une sortie de club réellement tenue',
      family: 'entraide',
      firstPhase: 'P5',
      weights: { explorer: 0, preparer: 0.4, partager: 0, entraider: 0.6 },
      points: { kind: 'fixed', base: 60, max: 60 },
      caps: { day: 1, week: 1, season: 4 },
      claims: {
        kinds: ['source'],
        note: 'Créer l’événement ne rapporte rien ; une simple inscription ne suffit pas.',
      },
      proof: 'Un organisateur désigné et au moins 3 autres participants vérifiés.',
    },
    {
      id: 'group_task_completed',
      label: 'Accomplir une tâche collective utile',
      family: 'entraide',
      firstPhase: 'P5',
      weights: { explorer: 0, preparer: 0.2, partager: 0, entraider: 0.8 },
      points: { kind: 'fixed', base: 20, max: 20 },
      caps: { day: 2, week: 3, season: 12 },
      claims: {
        kinds: ['source'],
        note: 'Pas de micropartition ni de double crédit comme organisateur.',
      },
      proof: 'Tâche du catalogue, contribution confirmée par un autre membre distinct.',
    },
    {
      id: 'loan_returned',
      label: 'Restituer un matériel emprunté',
      family: 'entraide',
      firstPhase: 'P5',
      weights: { explorer: 0, preparer: 0, partager: 0, entraider: 1 },
      points: { kind: 'fixed', base: 25, max: 25 },
      caps: { day: 1, week: 2, season: 8 },
      capGroup: 'loan_roles',
      claims: {
        kinds: ['source', 'pair', 'object'],
        perPairCooldownDays: 90,
        perObjectCooldownDays: 90,
        note: 'Un gain par rôle et par prêt ; prêteur et emprunteur distincts.',
      },
      proof: 'Prêt réel ≥ 24 h, retour confirmé par les deux parties.',
    },
    {
      id: 'loan_lent',
      label: 'Prêter un matériel jusqu’à son retour',
      family: 'entraide',
      firstPhase: 'P5',
      weights: { explorer: 0, preparer: 0, partager: 0, entraider: 1 },
      points: { kind: 'fixed', base: 25, max: 25 },
      caps: { day: 1, week: 2, season: 8 },
      capGroup: 'loan_roles',
      claims: {
        kinds: ['source', 'pair', 'object'],
        perPairCooldownDays: 90,
        perObjectCooldownDays: 90,
        note: 'Même prêt validé, pour le prêteur ; ne peut se créditer le gain emprunteur.',
      },
      proof: 'Deux confirmations avant attribution ; paire/objet 1 par 90 jours.',
    },
    {
      id: 'environmental_action',
      label: 'Participer à une action environnementale encadrée',
      family: 'entraide',
      firstPhase: 'P5',
      weights: { explorer: 0.2, preparer: 0, partager: 0, entraider: 0.8 },
      points: { kind: 'fixed', base: 40, max: 40 },
      caps: { day: 1, week: 1, season: 4 },
      claims: {
        kinds: ['source'],
        note: 'Ne pousse ni hors sentier ni vers un site fragile ; aucun « score carbone » inventé.',
      },
      proof: 'Action confirmée par organisateur indépendant.',
    },
    {
      id: 'gear_repaired',
      label: 'Réparer un équipement et documenter une méthode utile',
      family: 'entraide',
      firstPhase: 'P5',
      weights: { explorer: 0, preparer: 0.5, partager: 0, entraider: 0.5 },
      points: { kind: 'fixed', base: 40, max: 40 },
      caps: { day: 1, week: 1, season: 4 },
      claims: {
        kinds: ['source', 'object'],
        perObjectCooldownDays: 90,
        exclusiveWith: ['gear_maintenance'],
        note: 'Même acte exclu de la maintenance ; pas de justificatif d’achat obligatoire.',
      },
      proof:
        'Intervention confirmée et tutoriel relu, sans achat requis ni certification de sûreté.',
    },
    {
      id: 'accessibility_info_accepted',
      label: 'Faire accepter une information d’accessibilité',
      family: 'entraide',
      firstPhase: 'P4',
      weights: { explorer: 0, preparer: 0, partager: 0.5, entraider: 0.5 },
      points: { kind: 'fixed', base: 40, max: 40 },
      caps: { day: 1, week: 2, season: 8 },
      claims: {
        kinds: ['source', 'report'],
        exclusiveWith: ['place_report_accepted'],
        note: 'Remplace place_report_accepted pour le même rapport ; aucune santé inférée.',
      },
      proof: 'Observation concrète datée relue.',
    },
  ],
  nonAwarded: [
    'Inscription, connexion, temps d’écran, clic, ouverture d’un module',
    'Like, commentaire simple, message privé ou de groupe',
    'Publication brute, photo non qualifiée ou contenu IA non relu',
    'Invitation ou parrainage',
    'Achat ou abonnement',
    'Anniversaire',
    'Import GPX seul',
    'Badge, titre, fin de mission ou montée de ligue (0 supplémentaire)',
    'Tampon de ville, région, pays ou massif (0 supplémentaire)',
    'Alerte SOS ou intervention d’urgence',
    'Vitesse, danger, altitude extrême, météo défavorable (0 de bonus)',
    'Numéro de série, achat de matériel cher ou baisse du poids seule',
    'Consentement à la localisation ou au partage public (0 de bonus)',
    'Vue supplémentaire du même fait (passeport, carte, résumé, mission)',
    'Récompense de déblocage d’un badge ou d’un cosmétique',
    'Conversion de XP en argent ou en part économique',
    'Paiement d’un niveau par achat, abonnement ou parrainage',
    'Compétition entre démos ou agrégat alimenté par des comptes démo',
    'Rôle, permission ou certification obtenu par XP seul',
    'Bonus d’édition d’un avis déjà récompensé',
    'Double crédit accessibilité d’un rapport déjà corrigé',
    'Double crédit débrief transformé en avis matériel',
    'Double crédit préparation sentier/Compas pour la même aventure',
    'Double crédit emprunteur/prêteur pour la même personne',
  ],
  commercial: {
    loyaltyCreditsPerEuro: 10,
    loyaltyBons: [
      { credits: 1000, euros: 2 },
      { credits: 2500, euros: 5 },
      { credits: 5000, euros: 10 },
    ],
    partsWeeklyCap: 50,
    partsPeriodCap: 200,
    conversionXpToMoney: false,
    activationGate:
      'P6 — encaissement et financement vérifiés, réserve constituée ; émission future des likes/messages fermée, droits historiques préservés.',
  },
};

export function findRegistryV2Action(actionId: string): ProgressionRegistryAction | null {
  return PROGRESSION_REGISTRY_V2.actions.find((action) => action.id === actionId) ?? null;
}

export function familyCapFor(family: ProgressionFamily) {
  return PROGRESSION_REGISTRY_V2.familyCaps.find((entry) => entry.family === family) ?? null;
}

export function capGroupFor(actionId: string) {
  return (
    PROGRESSION_REGISTRY_V2.capGroups.find((group) => group.members.includes(actionId)) ?? null
  );
}

/** Jalons de présentation d'une compétence : montant du dernier jalon atteint. */
export function skillMilestoneReached(points: number): number {
  const safe = Math.max(0, Math.floor(points));
  let reached = 0;
  for (const milestone of PROGRESSION_REGISTRY_V2.skillMilestones) {
    if (safe >= milestone) reached = milestone;
  }
  return reached;
}