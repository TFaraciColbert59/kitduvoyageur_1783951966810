export interface ConfiguratorOption {
  id: string;
  titlePrefix: string;
  titleItalic: string;
  titleSuffix?: string;
  subtext: string;
  icon: string;
  defaultChecked?: boolean;
}

export interface ConfiguratorStep {
  id: number;
  badge: string;
  titlePrefix: string;
  titleItalic: string;
  titleSuffix?: string;
  subtitle: string;
  options: ConfiguratorOption[];
}

export interface KitItemRecommendation {
  id: string;
  name: string;
  category: string;
  price: number;
  weightKg: number;
  checked: boolean;
}

export const CONFIGURATOR_STEPS: ConfiguratorStep[] = [
  {
    id: 1,
    badge: '01 USAGE PRINCIPAL · SÉLECTIONNEZ VOTRE PRATIQUE',
    titlePrefix: "Quel type d'aventure ",
    titleItalic: 'préparez-vous ?',
    subtitle: "Nous sélectionnons l'architecture de votre sac et les composants indispensables selon le terrain et le mode de déplacement.",
    options: [
      {
        id: 'trek',
        titlePrefix: 'Trek & ',
        titleItalic: 'randonnée.',
        subtext: '1 à plusieurs jours en autonomie. Portage équilibré sur sentier.',
        icon: 'mountain',
        defaultChecked: true,
      },
      {
        id: 'bikepacking',
        titlePrefix: 'Bikepacking ',
        titleItalic: 'sauvage.',
        subtext: 'Voyage à vélo & bivouac. Matériel compact adapté aux sacoches.',
        icon: 'bike',
      },
      {
        id: 'alpinisme',
        titlePrefix: 'Alpinisme ',
        titleItalic: 'technique.',
        subtext: 'Haute montagne, cols escarpés & froid. Matériel renforcé.',
        icon: 'compass',
      },
      {
        id: 'voyage',
        titlePrefix: 'Voyage ',
        titleItalic: 'nomade.',
        subtext: 'Itinérance mixte train/bus/marche. Polyvalence & discrétion.',
        icon: 'bag',
      },
    ],
  },
  {
    id: 2,
    badge: '02 DURÉE · ESTIMATION DE L’AUTONOMIE',
    titlePrefix: 'Combien de temps ',
    titleItalic: 'partirez-vous ?',
    subtitle: 'La durée détermine le volume du sac à dos, la réserve d’eau et la capacité calorique nécessaire.',
    options: [
      {
        id: '1-2d',
        titlePrefix: '1 à 2 ',
        titleItalic: 'jours.',
        subtext: 'Week-end escapade. Sac léger 30 à 35 L.',
        icon: 'sun',
      },
      {
        id: '3-5d',
        titlePrefix: '3 à 5 ',
        titleItalic: 'jours.',
        subtext: 'Trek intermédiaire. Sac 45 L, autonomie nourriture 4j.',
        icon: 'calendar',
        defaultChecked: true,
      },
      {
        id: '1-2w',
        titlePrefix: '1 à 2 ',
        titleItalic: 'semaines.',
        subtext: 'Grande traversée. Sac 55-60 L avec ravitaillement.',
        icon: 'map',
      },
      {
        id: '2w+',
        titlePrefix: '2 semaines ',
        titleItalic: 'et +',
        subtext: 'Expédition au long cours. Matériel haute durabilité.',
        icon: 'globe',
      },
    ],
  },
  {
    id: 3,
    badge: '03 MÉTÉO ATTENDUE · SÉLECTIONNEZ UNE RÉPONSE',
    titlePrefix: 'Quelle météo ',
    titleItalic: 'vous attend ?',
    subtitle: 'On adapte l’épaisseur du duvet, la respirabilité de la veste et la sensibilité de vos couches. Une seule réponse : la plus fréquente.',
    options: [
      {
        id: 'sec_chaud',
        titlePrefix: 'Sec et ',
        titleItalic: 'chaud.',
        subtext: '15 à 25 °C, faible humidité. On priorise la respirabilité.',
        icon: 'sun',
      },
      {
        id: 'frais_brumeux',
        titlePrefix: 'Frais et ',
        titleItalic: 'brumeux.',
        subtext: '5 à 15 °C avec humidité. Notre configuration par défaut.',
        icon: 'cloud-fog',
        defaultChecked: true,
      },
      {
        id: 'pluvieux_vente',
        titlePrefix: 'Pluvieux et ',
        titleItalic: 'venté.',
        subtext: '0 à 10 °C, précipitations fréquentes. Coques imper renforcées.',
        icon: 'rain',
      },
      {
        id: 'froid_sec',
        titlePrefix: 'Froid ',
        titleItalic: 'sec.',
        subtext: '-5 à 5 °C. Duvet gonflant, base couche lourde.',
        icon: 'snowflake',
      },
    ],
  },
  {
    id: 4,
    badge: '04 NIVEAU DE CONFORT · PHILOSOPHIE DE PORTAGE',
    titlePrefix: 'Quel style de portage ',
    titleItalic: 'recherchez-vous ?',
    subtitle: 'Ajuste le compromis entre poids sur le dos et confort lors des pauses et des nuits au bivouac.',
    options: [
      {
        id: 'ultralight',
        titlePrefix: 'Ultra-léger ',
        titleItalic: '& rapide.',
        subtext: 'Poids minimal, équipements épurés, vitesse de marche maximale.',
        icon: 'zap',
      },
      {
        id: 'equilibre',
        titlePrefix: 'Équilibré ',
        titleItalic: 'standard.',
        subtext: 'Compromis parfait entre légèreté, robustesse et confort de nuit.',
        icon: 'scale',
        defaultChecked: true,
      },
      {
        id: 'grand_confort',
        titlePrefix: 'Grand ',
        titleItalic: 'confort.',
        subtext: 'Matelas épais, tente spacieuse, accessoires de confort au camp.',
        icon: 'shield',
      },
    ],
  },
  {
    id: 5,
    badge: '05 RÉCAPITULATIF · DÉCOUVREZ VOTRE SAC FINALISÉ',
    titlePrefix: 'Votre sac est ',
    titleItalic: 'prêt à partir !',
    subtitle: 'Voici la composition optimale générée pour votre aventure. Vous pouvez ajuster chaque article avant la mise au panier.',
    options: [],
  },
];

export function getRecommendedItems(answers: Record<number, string>): {
  items: KitItemRecommendation[];
  totalPrice: number;
  totalWeightKg: number;
  durationLabel: string;
  weatherLabel: string;
} {
  const weatherChoice = answers[3] || 'frais_brumeux';
  const durationChoice = answers[2] || '3-5d';

  const durationMap: Record<string, string> = {
    '1-2d': '1 à 2 jours',
    '3-5d': '3 jours',
    '1-2w': '10 jours',
    '2w+': '14+ jours',
  };

  const weatherMap: Record<string, string> = {
    sec_chaud: 'Sec, chaud',
    frais_brumeux: 'Frais, brumeux',
    pluvieux_vente: 'Pluvieux, venté',
    froid_sec: 'Froid, sec',
  };

  const baseItems: KitItemRecommendation[] = [
    { id: 'sac-45l', name: 'Sac 45 L toile cirée', category: 'Sac à dos', price: 340, weightKg: 0.85, checked: true },
    { id: 'duvet-3s', name: 'Duvet 3 saisons (800 cuin)', category: 'Couchage', price: 248, weightKg: 0.45, checked: true },
    { id: 'gourde-titane', name: 'Gourde titane 1 L', category: 'Hydratation', price: 68, weightKg: 0.12, checked: true },
    { id: 'veste-3c', name: 'Veste 3 couches imperméable', category: 'Vêtements', price: 290, weightKg: 0.32, checked: answers[3] !== 'sec_chaud' },
    { id: 'matelas-isole', name: 'Matelas isolant R-value 4.2', category: 'Couchage', price: 135, weightKg: 0.36, checked: answers[4] === 'grand_confort' || answers[3] === 'froid_sec' },
  ];

  const activeItems = baseItems.filter((i) => i.checked);
  const totalPrice = activeItems.reduce((acc, item) => acc + item.price, 0);
  const totalWeightKg = Number(activeItems.reduce((acc, item) => acc + item.weightKg, 0).toFixed(1));

  return {
    items: baseItems,
    totalPrice,
    totalWeightKg,
    durationLabel: durationMap[durationChoice] || '3 jours',
    weatherLabel: weatherMap[weatherChoice] || 'Frais, brumeux',
  };
}
