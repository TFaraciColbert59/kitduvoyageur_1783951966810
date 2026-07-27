export interface GearItemData {
  id: string;
  user_id?: string;
  name: string;
  brand: string;
  model: string;
  category: 'couchage' | 'portage' | 'cuisine' | 'vêtement' | 'navigation' | 'sécurité' | 'autre';
  condition: 'neuf' | 'excellent' | 'bon' | 'usé' | 'à_remplacer' | 'à_réparer';
  weight_g: number;
  purchase_price: number;
  purchase_date?: string;
  image: string;
  alt: string;
  quantity: number;
  is_favorite: boolean;
  notes?: string;
  loan_status?: string | null;
  loan_to_name?: string | null;
  is_listed_for_sale?: boolean;

  // Premium detail page fields
  rating?: number;
  ref_code?: string;
  description?: string;
  km_parcourus?: number;
  sorties_count?: number;
  reste_km?: number;
  wear_percentage?: number;
  wear_part_name?: string;
  wear_notes?: string;
  size_label?: string;
  materials?: string;
  sole_type?: string;
  waterproof_rating?: string;
  warranty_info?: string;
  purchase_vendor?: string;
  purchase_invoice_no?: string;
  location_city?: string;
  attached_backpack?: string;
  images?: string[];
  history_events?: Array<{
    id: string;
    date: string;
    title: string;
    type: 'Contrôle' | 'Sortie' | 'Entretien' | 'Achat' | 'Prêt' | 'Réparation';
    details: string;
    mileage_added?: string;
    total_mileage?: string;
    cost?: string;
  }>;
}

export interface UserKitData {
  id: string;
  code: string;
  name: string;
  articles_count: number;
  weight_kg: number;
  status?: string;
}

export interface LoanItemData {
  id: string;
  item_name: string;
  borrower_name: string;
  category: string;
  date_lent: string;
}

export interface RepairItemData {
  id: string;
  item_name: string;
  brand: string;
  issue: string;
  status: 'à_réparer' | 'à_remplacer';
  urgency: 'high' | 'medium';
}

export const MOCK_INVENTAIRE_ITEMS: GearItemData[] = [
  // Section 1: Couchage & Abri
  {
    id: 'g-1',
    name: 'Chaussures Salomon Quest 4 GTX',
    brand: 'Salomon',
    model: 'Quest 4 GTX',
    category: 'vêtement',
    condition: 'bon',
    weight_g: 1300,
    purchase_price: 219,
    purchase_date: '2025-02-12',
    image: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=800&q=80',
    images: [
      'https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=800&q=80',
      'https://images.unsplash.com/photo-1595950653106-6c9ebd614d3a?auto=format&fit=crop&w=800&q=80',
      'https://images.unsplash.com/photo-1608231387042-66d1773070a5?auto=format&fit=crop&w=800&q=80',
      'https://images.unsplash.com/photo-1584735935682-2f2b69dff9d2?auto=format&fit=crop&w=800&q=80',
    ],
    alt: 'Chaussures Salomon Quest 4 GTX',
    quantity: 1,
    is_favorite: true,
    rating: 4.6,
    ref_code: 'QST-4-GTX-42',
    description: 'Chaussures de randonnée mid-cut GORE-TEX, achetées en février 2025 pour la traversée du Vercors. Membrane imperméable, semelle Contagrip TD, chaussées 380 km depuis.',
    km_parcourus: 380,
    sorties_count: 24,
    reste_km: 180,
    wear_percentage: 68,
    wear_part_name: 'semelle Contagrip',
    wear_notes: 'Usure moyenne à forte. D\'après les photos de semelle du 5 oct., il reste environ 180 km avant remplacement conseillé. Ressemelage possible chez La Cordonnerie de la Randonnée.',
    size_label: 'EU 42 - UK 8 - US 8.5 - pointure large',
    materials: 'Nubuck - membrane GORE-TEX - galoche ADV-C 4D',
    sole_type: 'Contagrip TD : profondeur crampons 5 mm',
    waterproof_rating: 'GORE-TEX Performance Comfort - validé jusqu\'à 15 min immersion',
    warranty_info: 'Jusqu\'au 12 Février 2027 • 2 ans constructeur',
    purchase_vendor: 'Snowleader',
    purchase_invoice_no: 'SL-2025-8542',
    location_city: 'Grenoble',
    attached_backpack: 'Sac Osprey Aura AG 65',
    notes: '« Confortables dès la première sortie, mais lacets trop courts pour nouer autour de la cheville en descente technique. Racheter des lacets 180 cm au prochain re-conditionnement. Faire attention à ne pas les mettre près du feu (la tige cuir tape sur la malléole en descente rapide)... »',
    history_events: [
      {
        id: 'he-1',
        date: '5 oct. 2026',
        title: 'Photos de semelle — usure 68%',
        type: 'Contrôle',
        details: '3 photos ajoutées : état contrôlé visuellement',
        total_mileage: '380 km',
      },
      {
        id: 'he-2',
        date: '18 sept. 2026',
        title: 'Bivouac au lac d\'Anterne',
        type: 'Sortie',
        details: '+13,6 km • dénivelé 1 240 m • avec Antoine',
        mileage_added: '+13,6 km',
        total_mileage: 'total : 380 km',
      },
      {
        id: 'he-3',
        date: '8 août 2026',
        title: 'Tour du Belleroche — 4 étapes',
        type: 'Sortie',
        details: '+68,4 km • dénivelé 4 850 m • en solo',
        mileage_added: '+68,4 km',
        total_mileage: 'total : 366.4 km',
      },
      {
        id: 'he-4',
        date: '22 juin 2026',
        title: 'Ré-imperméabilisation Vêtement',
        type: 'Entretien',
        details: 'Traitement complet, séchage 24h',
        cost: '14 € (Nikwax Spray)',
      },
      {
        id: 'he-5',
        date: '3 mai 2026',
        title: 'GR20 partiel — 5 jours',
        type: 'Sortie',
        details: '+85 km • avec Julien, Sophie',
        mileage_added: '+85 km',
        total_mileage: 'total : 298 km',
      },
      {
        id: 'he-6',
        date: '12 févr. 2025',
        title: 'Achat chez Snowleader',
        type: 'Achat',
        details: 'Facture #SL-2025-8542 • Livraison en 3j',
        cost: '219 € (-15% Solde)',
      },
    ],
  },
  {
    id: 'g-2',
    name: 'Sac de couchage Cumulus Panyam 450',
    brand: 'Cumulus',
    model: 'Panyam 450',
    category: 'couchage',
    condition: 'excellent',
    weight_g: 830,
    purchase_price: 360,
    purchase_date: '2023-11-05',
    image: 'https://images.unsplash.com/photo-1541675154750-0444c7d51e8e?auto=format&fit=crop&w=800&q=80',
    alt: 'Sac de couchage Cumulus',
    quantity: 1,
    is_favorite: true,
    notes: 'Duvet d’oie 850 cuin, confort -6°C.',
  },
  {
    id: 'g-3',
    name: 'Matelas Therm-a-Rest NeoAir XLite',
    brand: 'Therm-a-Rest',
    model: 'NeoAir XLite Regular',
    category: 'couchage',
    condition: 'à_réparer',
    weight_g: 340,
    purchase_price: 190,
    purchase_date: '2022-06-18',
    image: 'https://images.unsplash.com/photo-1510312305653-8ed496efae75?auto=format&fit=crop&w=800&q=80',
    alt: 'Matelas gonflable',
    quantity: 1,
    is_favorite: true,
    notes: 'Micro-fuite sur la valve supérieure à réparer.',
  },

  // Section 2: Portage & Sacs
  {
    id: 'g-4',
    name: 'Sac Osprey Aura AG 65 femme',
    brand: 'Osprey',
    model: 'Aura AG 65',
    category: 'portage',
    condition: 'excellent',
    weight_g: 2100,
    purchase_price: 280,
    purchase_date: '2023-05-10',
    image: 'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?auto=format&fit=crop&w=800&q=80',
    alt: 'Sac à dos Osprey',
    quantity: 1,
    is_favorite: true,
    notes: 'Dos filet tendu d’un confort inégalé.',
  },
  {
    id: 'g-5',
    name: 'Sac trail Salomon Adv Skin 12',
    brand: 'Salomon',
    model: 'Adv Skin 12',
    category: 'portage',
    condition: 'à_réparer',
    weight_g: 420,
    purchase_price: 160,
    purchase_date: '2022-03-14',
    image: 'https://images.unsplash.com/photo-1622560480605-d83c853bc5c3?auto=format&fit=crop&w=800&q=80',
    alt: 'Gilet trail Salomon',
    quantity: 1,
    is_favorite: false,
    notes: 'Sangles de poitrine usées, couture à renforcer.',
  },
  {
    id: 'g-6',
    name: 'Sac étanche Sea to Summit Ultra-Sil 13L',
    brand: 'Sea to Summit',
    model: 'Ultra-Sil 13L',
    category: 'portage',
    condition: 'neuf',
    weight_g: 65,
    purchase_price: 25,
    purchase_date: '2024-01-20',
    image: 'https://images.unsplash.com/photo-1544816155-12df9643f363?auto=format&fit=crop&w=800&q=80',
    alt: 'Sac étanche',
    quantity: 2,
    is_favorite: false,
  },

  // Section 3: Cuisine & Hydratation
  {
    id: 'g-7',
    name: 'Réchaud MSR PocketRocket 2',
    brand: 'MSR',
    model: 'PocketRocket 2',
    category: 'cuisine',
    condition: 'excellent',
    weight_g: 73,
    purchase_price: 55,
    purchase_date: '2023-04-01',
    image: 'https://images.unsplash.com/photo-1526772662000-3f88f10405ff?auto=format&fit=crop&w=800&q=80',
    alt: 'Réchaud à gaz',
    quantity: 1,
    is_favorite: true,
  },
  {
    id: 'g-8',
    name: 'Popote titane TOAKS 750 ml',
    brand: 'TOAKS',
    model: 'Titanium 750ml',
    category: 'cuisine',
    condition: 'excellent',
    weight_g: 103,
    purchase_price: 45,
    purchase_date: '2023-04-01',
    image: 'https://images.unsplash.com/photo-1534447677768-be436bb09401?auto=format&fit=crop&w=800&q=80',
    alt: 'Popote titane',
    quantity: 1,
    is_favorite: true,
  },
  {
    id: 'g-9',
    name: 'Filtre à eau Katadyn BeFree 1L',
    brand: 'Katadyn',
    model: 'BeFree 1L',
    category: 'cuisine',
    condition: 'usé',
    weight_g: 59,
    purchase_price: 60,
    purchase_date: '2022-07-15',
    image: 'https://images.unsplash.com/photo-1548839140-29a749e1cf4e?auto=format&fit=crop&w=800&q=80',
    alt: 'Filtre à eau',
    quantity: 1,
    is_favorite: false,
    notes: 'Cartouche nettoyée, débit légèrement diminué.',
  },

  // Section 4: Vêtements Techniques
  {
    id: 'g-10',
    name: 'Veste Arc\'teryx Beta AR Gore-Tex',
    brand: 'Arc\'teryx',
    model: 'Beta AR',
    category: 'vêtement',
    condition: 'neuf',
    weight_g: 455,
    purchase_price: 550,
    purchase_date: '2024-05-02',
    image: 'https://images.unsplash.com/photo-1544441893-675973e31985?auto=format&fit=crop&w=800&q=80',
    alt: 'Veste imperméable',
    quantity: 1,
    is_favorite: true,
  },
  {
    id: 'g-11',
    name: 'Chaussures Salomon Quest 4 GTX',
    brand: 'Salomon',
    model: 'Quest 4 GTX',
    category: 'vêtement',
    condition: 'à_remplacer',
    weight_g: 1300,
    purchase_price: 230,
    purchase_date: '2021-09-10',
    image: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=800&q=80',
    alt: 'Chaussures de grande randonnée',
    quantity: 1,
    is_favorite: false,
    notes: 'Semelle lisse à 85%, crampons très fatigués.',
  },

  // Section 5: Navigation & Électronique
  {
    id: 'g-12',
    name: 'Frontale Petzl NAO RL 1500 lm',
    brand: 'Petzl',
    model: 'NAO RL',
    category: 'navigation',
    condition: 'bon',
    weight_g: 145,
    purchase_price: 160,
    purchase_date: '2023-08-20',
    image: 'https://images.unsplash.com/photo-1517649763962-0c623266010b?auto=format&fit=crop&w=800&q=80',
    alt: 'Lampe frontale',
    quantity: 1,
    is_favorite: true,
    loan_status: 'prêté',
    loan_to_name: 'Antoine Durand',
  },
  {
    id: 'g-13',
    name: 'Boussole Silva Ranger 5',
    brand: 'Silva',
    model: 'Ranger 5',
    category: 'navigation',
    condition: 'bon',
    weight_g: 33,
    purchase_price: 35,
    purchase_date: '2022-01-10',
    image: 'https://images.unsplash.com/photo-1509198397868-475647b2a1e5?auto=format&fit=crop&w=800&q=80',
    alt: 'Boussole',
    quantity: 1,
    is_favorite: false,
  },
  {
    id: 'g-14',
    name: 'Batterie Nitecore NB10000 20 000 mAh',
    brand: 'Nitecore',
    model: 'NB10000 Gen2',
    category: 'navigation',
    condition: 'excellent',
    weight_g: 150,
    purchase_price: 65,
    purchase_date: '2023-06-12',
    image: 'https://images.unsplash.com/photo-1609592424009-598689a9be87?auto=format&fit=crop&w=800&q=80',
    alt: 'Powerbank carbone',
    quantity: 2,
    is_favorite: true,
  },
];

export const MOCK_USER_KITS: UserKitData[] = [
  { id: 'k-1', code: 'A', name: 'Bivouac Estival', articles_count: 22, weight_kg: 9.8, status: 'Prêt à partir' },
  { id: 'k-2', code: 'B', name: 'Bivouac Hivernal', articles_count: 30, weight_kg: 12.2, status: 'En révision' },
  { id: 'k-3', code: 'C', name: 'Randonnée journée', articles_count: 14, weight_kg: 4.6, status: 'Complet' },
  { id: 'k-4', code: 'D', name: 'Trail compétition', articles_count: 8, weight_kg: 2.1, status: 'Minimal' },
];

export const MOCK_LOANS: LoanItemData[] = [
  { id: 'l-1', item_name: 'Tente MSR Hubba Hubba', borrower_name: 'Antoine Durand', category: 'Couchage', date_lent: '12 oct. 2026' },
  { id: 'l-2', item_name: 'Réchaud Jetboil Flash', borrower_name: 'Camille Roy', category: 'Cuisine', date_lent: '04 oct. 2026' },
  { id: 'l-3', item_name: 'Popote Primus Essential', borrower_name: 'Sophie Raimbault', category: 'Cuisine', date_lent: '28 sept. 2026' },
];

export const MOCK_REPAIRS: RepairItemData[] = [
  { id: 'r-1', item_name: 'Sangles Salomon Adv Skin 12', brand: 'Salomon', issue: 'Sangles de poitrine usées', status: 'à_réparer', urgency: 'high' },
  { id: 'r-2', item_name: 'Matelas NeoAir XLite', brand: 'Therm-a-Rest', issue: 'Fuite valve - réparation colle', status: 'à_réparer', urgency: 'medium' },
  { id: 'r-3', item_name: 'Chaussures Salomon Quest 4 GTX', brand: 'Salomon', issue: 'Semelle lisse à 85% - remplacer', status: 'à_remplacer', urgency: 'high' },
];

export const MOCK_RECOMMENDATIONS = [
  {
    id: 'p-1',
    name: 'Chaussures Scarpa Rush Trek GTX',
    brand: 'Scarpa',
    reason: 'Remplace vos Quest 4 usées',
    price_eur: 220,
    image: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=600&q=80',
  },
  {
    id: 'p-2',
    name: 'Matelas Therm-a-Rest NeoAir XTherm',
    brand: 'Therm-a-Rest',
    reason: 'Hiver / R-Value 7.3',
    price_eur: 210,
    image: 'https://images.unsplash.com/photo-1510312305653-8ed496efae75?auto=format&fit=crop&w=600&q=80',
  },
  {
    id: 'p-3',
    name: 'Piolet Petzl Summit Evo 66 cm',
    brand: 'Petzl',
    reason: 'Pour sorties hiver/alpinisme',
    price_eur: 135,
    image: 'https://images.unsplash.com/photo-1517649763962-0c623266010b?auto=format&fit=crop&w=600&q=80',
  },
];
