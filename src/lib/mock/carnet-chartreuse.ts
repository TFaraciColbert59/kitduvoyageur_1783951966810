export interface CarnetJour {
  id: string;
  dayNumber: number;
  label: string;
  title: string;
  titleItalic: string;
  recit: string;
  stats: { icon: string; label: string }[];
}

export interface CarnetHebergement {
  id: string;
  nightNumber: number;
  name: string;
  nameItalic?: string;
  price: number;
  priceLabel: string;
  detail: string;
}

export interface CarnetMoment {
  id: string;
  label: string;
  citation: string;
  author: string;
  location: string;
  imageUrl?: string;
}

export interface CarnetKitItem {
  id: string;
  name: string;
  detail: string;
  weight: string;
  color: string;
}

export interface CarnetRandonnee {
  id: string;
  title: string;
  stats: string;
  badge?: string;
}

export interface CarnetStatItem {
  value: string;
  label: string;
  sublabel?: string;
  hidden?: boolean;
}

export interface CarnetData {
  meta: {
    badge: string;
    titleLine1: string;
    titleLine2: string;
    subtitleLine1: string;
    subtitleLine2: string;
    voyageurs: number;
    dateRange: string;
    itineraire: string;
  };
  stats: CarnetStatItem[];
  jours: CarnetJour[];
  hebergements: CarnetHebergement[];
  moments: CarnetMoment[];
  kit: {
    intro: string;
    totalWeight: string;
    items: CarnetKitItem[];
  };
  randonnees: CarnetRandonnee[];
}

export const mockCarnetChartreuse: CarnetData = {
  meta: {
    badge: 'CARNET OUVERT · TRAVERSÉE · AUTOMNE 2026',
    titleLine1: 'Trois jours dans',
    titleLine2: 'la Chartreuse,',
    subtitleLine1: 'et le silence qu\'on a',
    subtitleLine2: 'rapporté.',
    voyageurs: 6,
    dateRange: '12 – 14 octobre 2026',
    itineraire: 'Saint-Pierre-de-Chartreuse → Col de la Charmette',
  },
  stats: [
    { value: '27,4 km', label: 'DISTANCE' },
    { value: '1 620 m', label: 'DÉNIVELÉ +' },
    { value: '2', label: 'NUITS' },
    { value: '14', label: 'MOMENTS' },
    { value: '62', label: 'PHOTOS' },
    { value: '3', label: 'HÉBERGEMENTS', sublabel: 'refuges' },
  ],
  jours: [
    {
      id: 'j1',
      dayNumber: 1,
      label: 'JOUR 1 · VEN. 12 OCTOBRE',
      title: 'Saint-Pierre → ',
      titleItalic: 'Charmant Som',
      recit: 'On a rangé la voiture derrière l\'église de Saint-Pierre à 9h40. Ciel bas, feuillage roux, un vent net qui vient du sud. Léna a mené sur les cinq premiers kilomètres, on n\'a presque pas parlé — juste écouté nos semelles. À midi, casse-croûte contre un mur de pierre sèche.',
      stats: [
        { icon: '📏', label: '10,4 km' },
        { icon: '⛰', label: '620 m D+' },
        { icon: '🕐', label: '4h20' },
        { icon: '☁️', label: 'Ciel bas · 12°C' },
      ],
    },
    {
      id: 'j2',
      dayNumber: 2,
      label: 'JOUR 2 · SAM. 13 OCTOBRE',
      title: 'La longue journée du ',
      titleItalic: 'Grand Vaneau',
      recit: 'Départ à 7h20, thé chaud dans les thermos. Antoine a proposé la variante haute par le Balcon Est — nous avons suivi. Le passage du col Vert au petit matin restera. Rien ne bougeait sauf le brouillard qui remontait la vallée. Douze kilomètres, sept heures de marche, un déjeuner sec sur une pierre plate.',
      stats: [
        { icon: '📏', label: '12,8 km' },
        { icon: '⛰', label: '720 m D+' },
        { icon: '🕐', label: '7h05' },
        { icon: '🌫', label: 'Brouillard · 6°C' },
      ],
    },
    {
      id: 'j3',
      dayNumber: 3,
      label: 'JOUR 3 · DIM. 14 OCTOBRE',
      title: 'Descente sur le ',
      titleItalic: 'col de la Charmette',
      recit: 'Réveil tôt, ciel dégagé. On a longé la crête pendant deux heures, presque sans vent. Descente technique jusqu\'à la voiture — arrivés à 15h, sales, contents, un peu tristes. Marceline a acheté du gruyère à la ferme du bas.',
      stats: [
        { icon: '📏', label: '4,2 km' },
        { icon: '⛰', label: '280 m D+' },
        { icon: '🕐', label: '2h40' },
        { icon: '☀️', label: 'Ensoleillé · 14°C' },
      ],
    },
  ],
  hebergements: [
    {
      id: 'h1',
      nightNumber: 1,
      name: 'Refuge du Charmant Som',
      price: 48,
      priceLabel: 'par personne, demi-pension',
      detail: '2 100 m · dortoir 8 places · Marie & Bertrand',
    },
    {
      id: 'h2',
      nightNumber: 2,
      name: 'Cabane du ',
      nameItalic: 'Grand Vaneau',
      price: 52,
      priceLabel: 'demi-pension',
      detail: '2 100 m · gardienne Hélène · soupe corail',
    },
  ],
  moments: [
    {
      id: 'm1',
      label: 'JOUR 1 · 18H30',
      citation: '« Marie a servi la soupe sans dire un mot. On l\'a bue debout, appuyés contre la porte du refuge, en regardant la nuit tomber sur le vallon. »',
      author: 'Marceline',
      location: 'Charmant Som',
    },
    {
      id: 'm2',
      label: 'JOUR 2 · 7H50',
      citation: '« Le brouillard remontait la vallée par vagues. Antoine s\'est arrêté et a juste dit : « c\'est pour ça qu\'on marche ». »',
      author: 'Antoine',
      location: 'Col Vert',
    },
    {
      id: 'm3',
      label: 'JOUR 3 · 15H20',
      citation: '« À la ferme, la femme nous a donné un morceau de gruyère « pour la route ». On l\'a mangé dans la voiture, sans pain. »',
      author: 'Léna',
      location: 'Charmette',
    },
  ],
  kit: {
    intro: 'Sac 45L configuré pour la Chartreuse — 2,98 kg total, un chargement inhabituellement léger.',
    totalWeight: '2,98 kg',
    items: [
      { id: 'k1', name: 'Sac 45L toile huilée', detail: 'Assemblé à Digne-les-Bains', weight: '1,4 kg', color: '#B5652D' },
      { id: 'k2', name: 'Duvet plumes 800', detail: 'Confort -5°C', weight: '920 g', color: '#3A6EA5' },
      { id: 'k3', name: 'Veste 3 couches', detail: 'Portée les 3 jours', weight: '400 g', color: '#33463C' },
      { id: 'k4', name: 'Gourde inox 1L', detail: 'Remplie à la source', weight: '188 g', color: '#17402C' },
    ],
  },
  randonnees: [
    { id: 'r1', title: 'St-Pierre → Charmant Som', stats: '10,4 km · 620 m · 4h20' },
    { id: 'r2', title: 'Balcon Est - Col Vert', stats: '12,8 km · +720 m · Officielle', badge: 'Officielle' },
    { id: 'r3', title: 'Grand Vaneau → Charmette', stats: '4,2 km · +280 m · Facile', badge: 'Facile' },
  ],
};
