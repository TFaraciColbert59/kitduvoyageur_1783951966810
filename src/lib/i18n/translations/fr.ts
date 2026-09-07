export const fr = {
  common: {
    appTitle: 'Le Kit du Voyageur',
    tagline: 'L’intelligence alpine & voyage tout-en-un',
    save: 'Enregistrer',
    cancel: 'Annuler',
    delete: 'Supprimer',
    edit: 'Modifier',
    back: 'Retour',
    loading: 'Chargement...',
    offline: 'Mode hors-ligne',
    syncing: 'Synchronisation...',
    synced: 'Synchronisé',
  },
  navigation: {
    trips: 'Voyages',
    crews: 'Équipages',
    explore: 'Explorer',
    gear: 'Matériel',
    community: 'Communauté',
    account: 'Compte',
  },
  trips: {
    newTrip: 'Nouveau voyage',
    preparePhase: 'Préparer',
    livePhase: 'Vivre',
    journalPhase: 'Raconter',
    elevationGain: 'Dénivelé positif',
    elevationLoss: 'Dénivelé négatif',
    weightTotal: 'Poids total',
    baseWeight: 'Poids de base',
    participants: 'Participants',
    emergency: 'Urgences & Sécurité',
  },
  crews: {
    createCrew: 'Créer un équipage',
    members: 'Membres',
    inviteMember: 'Inviter un membre',
    roleLeader: 'Capitaine',
    roleMember: 'Membre',
    roleViewer: 'Observateur',
  },
  accessibility: {
    skipToContent: 'Aller au contenu principal',
    closeModal: 'Fermer la boîte de dialogue',
  },
} as const;

type StringRecord<T> = {
  [K in keyof T]: T[K] extends string ? string : StringRecord<T[K]>;
};

export type TranslationKeys = StringRecord<typeof fr>;
