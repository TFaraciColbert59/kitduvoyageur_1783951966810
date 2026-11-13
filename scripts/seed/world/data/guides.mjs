// Guides éditoriaux. Les trois premiers slugs sont ceux affichés en dur par
// /guides : sans eux, la page d'index pointe vers des 404.
export const GUIDES = [
  {
    slug: 'preparation-trek-montagne', title: 'Préparation Trek Montagne',
    category: 'Guide pratique', destination: 'Alpes', read_time: 14, difficulty: 'Intermédiaire',
    excerpt: "Le guide complet pour préparer un trek en montagne : choix de l'itinéraire, condition physique, matériel, nourriture, météo et sécurité. Méthode testée sur quinze saisons.",
    tags: ['préparation', 'montagne', 'sécurité', 'matériel'], author: 'mathieu-cabanel', theme: ['mountain', 0], featured: true,
  },
  {
    slug: 'randonnee-jour', title: 'Randonnée d’une journée',
    category: 'Guide pratique', destination: 'France', read_time: 9, difficulty: 'Débutant',
    excerpt: "Tout ce qu'il faut savoir pour réussir sa première randonnée à la journée : durée, dénivelé, eau, chaussures, carte et conduite à tenir en cas d'imprévu.",
    tags: ['débutant', 'journée', 'checklist'], author: 'etienne-vasseur', theme: ['hike', 0], featured: true,
  },
  {
    slug: 'camping-bivouac', title: 'Camping & Bivouac',
    category: 'Guide pratique', destination: 'France', read_time: 12, difficulty: 'Intermédiaire',
    excerpt: "Le guide pratique du bivouac en France : réglementation, choix du spot, matériel léger, météo, respect du milieu et gestion des déchets.",
    tags: ['bivouac', 'réglementation', 'matériel'], author: 'benjamin-nkosi', theme: ['camp', 0], featured: true,
  },
  {
    slug: 'premier-bivouac-hiver', title: 'Réussir son premier bivouac d’hiver',
    category: 'Guide pratique', destination: 'Alpes', read_time: 11, difficulty: 'Confirmé',
    excerpt: "Températures négatives, condensation, sommeil : tout ce qui change quand on dort dehors en hiver, et les erreurs à ne pas commettre.",
    tags: ['hiver', 'bivouac', 'matériel'], author: 'camille-rochat', theme: ['snow', 1], featured: false,
  },
  {
    slug: 'randonner-avec-enfants', title: 'Randonner avec des enfants',
    category: 'Famille', destination: 'France', read_time: 8, difficulty: 'Débutant',
    excerpt: "Distances réalistes par âge, goûters, jeux, sécurité et gestion de la motivation. Les conseils de parents qui marchent chaque semaine.",
    tags: ['famille', 'enfants', 'débutant'], author: 'helene-mercier', theme: ['coast', 4], featured: false,
  },
  {
    slug: 'sentiers-accessibles-france', title: 'Sentiers accessibles en France',
    category: 'Accessibilité', destination: 'France', read_time: 13, difficulty: 'Tous',
    excerpt: "Joëlette, fauteuil tout-terrain et sentiers adaptés : méthode pour évaluer une pente, un revêtement et un point de repos avant de partir.",
    tags: ['accessibilité', 'joëlette', 'famille'], author: 'theo-marchand', theme: ['mountain', 9], featured: false,
  },
  {
    slug: 'marcher-seule-en-montagne', title: 'Marcher seule en montagne',
    category: 'Sécurité', destination: 'France', read_time: 10, difficulty: 'Tous',
    excerpt: "Préparer son itinéraire, annoncer son retour, gérer les rencontres et les imprévus : un guide concret, sans injonctions.",
    tags: ['femmes', 'sécurité', 'solo'], author: 'fatou-diallo', theme: ['forest', 0], featured: false,
  },
  {
    slug: 'photographier-lever-de-soleil', title: 'Photographier un lever de soleil en montagne',
    category: 'Photographie', destination: 'Alpes', read_time: 7, difficulty: 'Intermédiaire',
    excerpt: "Heure bleue, exposition, composition et respect des lieux : la méthode d'une photographe d'altitude pour rapporter une image qui raconte quelque chose.",
    tags: ['photo', 'montagne', 'technique'], author: 'nour-belkacem', theme: ['mountain', 8], featured: false,
  },
  {
    slug: 'randonner-avec-un-chien', title: 'Randonner avec son chien',
    category: 'Guide pratique', destination: 'France', read_time: 9, difficulty: 'Tous',
    excerpt: "Zones interdites, refuges, chaleur, pattes et fatigue : ce qu'il faut vérifier avant de partir avec son chien, et comment adapter le rythme.",
    tags: ['chien', 'réglementation', 'préparation'], author: 'lucie-baron', theme: ['forest', 1], featured: false,
  },
  {
    slug: 'budget-randonnee-etudiant', title: 'Randonner avec un petit budget',
    category: 'Budget', destination: 'France', read_time: 8, difficulty: 'Débutant',
    excerpt: "Train, refuges hors saison, matériel d'occasion et bivouac : comment randonner plusieurs week-ends par mois avec moins de 40 € par sortie.",
    tags: ['budget', 'étudiant', 'bivouac'], author: 'lucas-barbier', theme: ['camp', 3], featured: false,
  },
  {
    slug: 'sac-a-dos-10-kg', title: 'Descendre sous les 10 kg : méthode',
    category: 'Matériel', destination: 'France', read_time: 12, difficulty: 'Intermédiaire',
    excerpt: "Peser, trier, arbitrer : la méthode pour alléger un sac sans sacrifier la sécurité, avec la liste complète d'un kit week-end à 4,2 kg.",
    tags: ['ultralight', 'matériel', 'bivouac'], author: 'lea-fontaine', theme: ['gear', 6], featured: true,
  },
  {
    slug: 'preparer-gr20', title: 'Préparer le GR20',
    category: 'Destination', destination: 'Corse', read_time: 15, difficulty: 'Confirmé',
    excerpt: "Étapes, refuges, eau, météo, entraînement et budget : le guide complet pour aborder le GR20 sans se mettre en danger.",
    tags: ['GR20', 'Corse', 'trek'], author: 'mathieu-cabanel', theme: ['mountain', 13], featured: false,
  },
];
