/**
 * Textes du Kit Studio : français, tutoiement, vocabulaire du dépôt (« kit », « lignée »).
 * Jamais de grade, de classement ni de vocabulaire génétique.
 * Espace insécable U+00A0 avant « % », « € », « : » et entre le nombre et son unité (voir les fonctions ci-dessous).
 */

/** Espace insécable. */
const NB = ' ';

const fr = (n: number, digits = 0) =>
  n.toLocaleString('fr-FR', { minimumFractionDigits: digits, maximumFractionDigits: digits });

/** Pourcentage : « 40 % ». */
export const pct = (p: number) => `${Math.round(p)}${NB}%`;

/** Montant en euros : « 1 250 € ». */
export const eur = (n: number) => `${fr(n)}${NB}€`;

/** Poids : « 820 g » sous 1 kg, « 10,3 kg » au-dessus. */
export const kgText = (kg: number) => (kg < 1 ? `${fr(Math.round(kg * 1000))}${NB}g` : `${fr(kg, 1)}${NB}kg`);

/** Libellé du bouton de commande, selon le nombre d'articles et le total. */
export const orderCta = (n: number, prix: number) =>
  n > 0 ? `Commander ${n} article${n > 1 ? 's' : ''} · ${eur(prix)}` : `Ma configuration`;

/** Progression vers le sac prêt : « Prêt à 80 % ». */
export const readyText = (p: number) => `Prêt à ${pct(p)}`;

/** Nombre d'alertes : « 1 alerte », « 2 alertes ». */
export const alertsText = (n: number) => `${n} alerte${n > 1 ? 's' : ''}`;

/** Jour courant d'une sortie : « Jour 2 sur 5 ». */
export const dayText = (day: number, total: number) => `Jour ${day} sur ${total}`;

/** Libellé d'une page du tiroir : « Page 1 sur 3 ». */
export const pageText = (i: number, total: number) => `Page ${i} sur ${total}`;

/** Nom accessible d'une carte d'objet : « Duvet, 820 g, sur toi ». */
export const tileLabel = (name: string, weight: string, tag?: string) =>
  tag ? `${name}, ${weight}, ${tag}` : `${name}, ${weight}`;

/** Nom accessible du bouton pilule : « Ouvrir le bilan, 10,3 kg, 2 alertes ». */
export const pillLabel = (kg: number, alerts: number) =>
  alerts > 0 ? `Ouvrir le bilan, ${kgText(kg)}, ${alertsText(alerts)}` : `Ouvrir le bilan, ${kgText(kg)}`;

export const S = {
  drawer: {
    grab: 'Fermer le tiroir',
    grabOpen: 'Ouvrir le tiroir',
    hint: 'Glisse vers le bas ou touche pour fermer',
  },

  pill: {
    open: 'Ouvrir le bilan',
    openBag: 'Rouvrir le studio du sac',
  },

  cards: {
    addToBag: 'Ajouter un objet à l’inventaire',
    empty: 'Aucun objet à proposer pour cette zone.',
    weightUnknown: 'Poids non renseigné',
  },

  modes: {
    group: 'Mode du studio',
    content: 'Contenu du sac',
    look: 'Apparence du sac',
  },

  families: {
    group: 'Familles d’objets',
    all: 'Toutes les familles',
  },

  categories: {
    shape: 'Corps',
    mod: 'Modules',
    col: 'Coloris',
    mat: 'Matière',
    fin: 'Finition',
    acc: 'Accessoires',
  },

  zones: {
    worn: 'Sur toi',
    lid: 'Couvercle',
    main: 'Principal',
    front: 'Extérieur',
    sides: 'Côtés',
    hip: 'Ceinture',
    back: 'Dos',
  },

  bilan: {
    title: 'Bilan',
    openBag: 'Ouvrir le bilan du sac',
    profile: `Vue de profil du sac${NB}: centre de gravité`,
    balanced: 'bien placé',
    unbalanced: 'mal placé',
    onBack: 'Sur le dos',
    base: 'Base sèche',
    consumables: 'Eau et vivres',
    worn: 'Porté sur toi',
    limit: `Repère courant${NB}: 20${NB}% maximum.`,
    toFull: `Le chemin vers 100${NB}%`,
    fill: 'Remplir le sac',
    debrief: 'Débrief de sortie',
    nothingMissing: 'Rien ne manque.',
    rented: 'À louer',
    bought: 'À acheter',
    more: 'Plus d’actions',
  },

  item: {
    title: 'Fiche',
    back: 'Retour',
    removeFromBag: 'Retirer du sac',
    addToBag: 'Mettre dans le sac',
    swap: 'Échanger',
    noEquivalent: 'Rien d’équivalent dans ton inventaire ni en boutique pour l’instant.',
    swapHint: 'Le sac se recalcule dès que tu touches une option.',
    history: 'Son histoire',
    notRecorded: 'Pas encore sorti',
    weight: 'Poids',
    volume: 'Volume',
    storage: 'Rangement',
    condition: 'État',
    trips: 'Sorties',
    location: 'Stockage',
    lent: 'En prêt',
    expired: 'Périmée',
    care: 'À entretenir',
    shop: 'À acheter',
    rent: 'À louer',
    good: 'Bon état',
    unknownWeight: `Poids non renseigné par la boutique${NB}: impossible de comparer.`,
  },

  bag: {
    title: 'Sac',
    config: 'Configuration',
    lineage: 'Lignée',
    lineageOrigin: 'Kit d’origine, créé par toi.',
    options: 'Options',
    objectsOpen: 'Ouvrir le tiroir des objets',
    objects: 'Objets',
    objectsToAdd: 'Objets à ajouter au sac',
    backToObjects: 'Retour aux objets',
    back: 'Retour',
    customize: 'Personnaliser',
    stowAuto: 'Touche pour ranger le sac automatiquement.',
  },

  order: {
    title: 'Commande',
    engraving: 'Prénom brodé sur l’étiquette',
    notifyEachStep: 'Me prévenir à chaque étape',
    addToInventory: 'Ajouter à mon inventaire',
    empty: 'Aucun article dans la commande.',
  },

  deck: {
    title: 'Remplir le sac',
    fillHint: 'Glisse à droite quand l’objet est dans le sac, à gauche pour plus tard.',
    debriefHint: 'Glisse à droite si tu t’en es servi, à gauche sinon.',
    yes: 'Dans le sac',
    no: 'Plus tard',
    done: 'Tout est passé en revue.',
  },

  states: {
    loading: 'Chargement…',
    empty: 'Rien à afficher pour l’instant.',
    error: 'Une erreur est survenue. Réessaie dans un instant.',
    offline: 'Hors connexion. Les données affichées peuvent être anciennes.',
  },

  a11y: {
    bag3d:
      'Sac à dos en 3D. Flèches gauche et droite pour en faire le tour, espace pour l’ouvrir, R pour le ranger, M pour passer du contenu à l’apparence, flèche haut pour l’inventaire ou la fiche de la pièce, flèche bas pour le bilan, Échap pour sortir.',
    pages: 'Pages',
    page: pageText,
    pillValue: pillLabel,
    alerts: alertsText,
  },
} as const;
