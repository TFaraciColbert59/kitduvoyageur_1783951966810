import { UserProfile } from '@/lib/types/profile';
export type { UserProfile };

export interface ProchainVoyage {
  id: string;
  title: string;
  title_highlight: string;
  days_left: number;
  date_range: string;
  companions: string;
  refuges_count: number;
  preparation_percentage: number;
  preparation_detail: string;
  tasks_left: number;
  group_id: string;
}

export interface Aventure {
  id: string;
  title: string;
  date_detail: string;
  duration: string;
  companions: string[];
  distance: string;
  elevation: string;
  status: 'En cours' | 'Terminée' | 'Brouillon' | 'Planifiée';
  image_url: string;
}

export interface Carnet {
  id: string;
  title: string;
  status: 'Publié' | 'Brouillon';
  image_url: string;
  likes?: number;
  views?: number;
  comments?: number;
  draft_detail?: string;
  edit_status?: string;
}

export interface ClubItem {
  id: string;
  name: string;
  role: 'Admin' | 'Membre';
  members_count: number;
  detail: string;
  badge?: string;
  logo_url: string;
  slug: string;
}

export interface Commande {
  id: string;
  product_name: string;
  order_number: string;
  price: string;
  status: 'Expédiée' | 'Préparation' | 'Livrée';
  image_url: string;
}

export interface BadgeItem {
  id: string;
  title: string;
  icon_name: string;
  earned: boolean;
}

export interface ActiviteItem {
  id: string;
  text: string;
  highlight: string;
  time: string;
  icon_type: 'like' | 'badge' | 'order' | 'comment' | 'follow';
}

export const MOCK_MARCELINE_DATA = {
  profile: {
    id: 'marceline-chevrier',
    first_name: 'Marceline',
    last_name: 'Chevrier.',
    role_badge: 'VOYAGEUSE · MEMBRE DEPUIS MARS 2023',
    bio: "Randonneuse d'altitude basée à Grenoble. Je marche pour retrouver le silence, j'écris pour ne pas l'oublier. Trois massifs préférés : Chartreuse, Belledonne, Écrins.",
    location: 'Grenoble, Isère',
    tenure: '3 ans · 42 sorties',
    sorties_count: 42,
    last_active: 'Actif il y a 2h',
    avatar_url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80',
    hero_image_url: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=2000&q=85',
    level: {
      number: 'III',
      title: 'Explorateur',
      current_pts: 1240,
      max_pts: 1800,
      next_level_pts: 560,
      next_level_title: 'GUIDE',
    },
    stats: {
      sorties: 42,
      carnets: 12,
      clubs: 4,
      km_this_year: 786,
      distance_2026: { value: '786 km', diff: '↗ +18% vs 2025' },
      elevation_gain: { value: '32,4 km D+', detail: '+2 400 m ce mois' },
      refuge_nights: { value: '28 nuits', detail: '12 refuges différents' },
      co2_saved: { value: '142 kg', detail: 'vs équivalent avion' },
    },
  } as UserProfile,

  prochainVoyage: {
    id: 'traversee-chartreuse',
    title: 'Traversée de la ',
    title_highlight: 'Chartreuse.',
    days_left: 16,
    date_range: '12-14 oct.',
    companions: 'avec Léna, Antoine et 4 autres',
    refuges_count: 3,
    preparation_percentage: 62,
    preparation_detail: 'sac partiel',
    tasks_left: 2,
    group_id: 'traversee-chartreuse',
  } as ProchainVoyage,

  aventures: [
    {
      id: 'av-1',
      title: 'Traversée de la Chartreuse',
      date_detail: '12-14 oct. 2026 · 3 jours · avec 5 autres',
      duration: '3 jours',
      companions: ['Léna', 'Antoine', 'Camille', 'Julien', 'Sophie'],
      distance: '27,4 km',
      elevation: '1 620 m D+',
      status: 'En cours',
      image_url: 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=400&q=80',
    },
    {
      id: 'av-2',
      title: 'Arêtes du Charmant Som',
      date_detail: '28 sept. 2026 · 1 jour · Léna, Camille',
      duration: '1 jour',
      companions: ['Léna', 'Camille'],
      distance: '14,2 km',
      elevation: '860 m D+',
      status: 'Terminée',
      image_url: 'https://images.unsplash.com/photo-1486870591958-9b9d0d1dda99?auto=format&fit=crop&w=400&q=80',
    },
    {
      id: 'av-3',
      title: 'Bivouac au lac Achard',
      date_detail: '15 sept. 2026 · 2 jours · Antoine',
      duration: '2 jours',
      companions: ['Antoine'],
      distance: '18,6 km',
      elevation: '1 240 m D+',
      status: 'Terminée',
      image_url: 'https://images.unsplash.com/photo-1510312305653-8ed496efae75?auto=format&fit=crop&w=400&q=80',
    },
    {
      id: 'av-4',
      title: 'Tour du Belledonne en 4 étapes',
      date_detail: '8-11 août 2026 · 4 jours · en solo',
      duration: '4 jours',
      companions: ['Solo'],
      distance: '68,4 km',
      elevation: '4 850 m D+',
      status: 'Terminée',
      image_url: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=400&q=80',
    },
    {
      id: 'av-5',
      title: 'GR20 partiel · Étape Nord',
      date_detail: 'Prévu 20 mai 2027 · 5 jours · Julien, Sophie',
      duration: '5 jours',
      companions: ['Julien', 'Sophie'],
      distance: '85 km',
      elevation: '6 200 m D+',
      status: 'Brouillon',
      image_url: 'https://images.unsplash.com/photo-1519681393784-d120267933ba?auto=format&fit=crop&w=400&q=80',
    },
  ] as Aventure[],

  carnets: [
    {
      id: 'car-1',
      title: 'Trois jours sur les crêtes du Vercors',
      status: 'Publié',
      image_url: 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=600&q=80',
      likes: 124,
      views: 842,
      comments: 18,
    },
    {
      id: 'car-2',
      title: 'Bivouac au lac Achard · nuit d\'août',
      status: 'Publié',
      image_url: 'https://images.unsplash.com/photo-1510312305653-8ed496efae75?auto=format&fit=crop&w=600&q=80',
      likes: 87,
      views: 412,
      comments: 9,
    },
    {
      id: 'car-3',
      title: 'Tour du Belledonne · 4 jours en solo',
      status: 'Brouillon',
      image_url: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=600&q=80',
      edit_status: '📝 Édition',
      draft_detail: '12 étapes rédigées',
    },
  ] as Carnet[],

  clubs: [
    {
      id: 'club-1',
      name: 'Club Alpin Grenoble',
      role: 'Admin',
      members_count: 248,
      detail: '3 sorties ce mois',
      badge: '3 nouveaux',
      logo_url: 'https://images.unsplash.com/photo-1519681393784-d120267933ba?auto=format&fit=crop&w=200&q=80',
      slug: 'club-alpin-grenoble',
    },
    {
      id: 'club-2',
      name: 'Bivouacs Étoilés',
      role: 'Membre',
      members_count: 89,
      detail: 'prochaine sortie sam. 19',
      logo_url: 'https://images.unsplash.com/photo-1510312305653-8ed496efae75?auto=format&fit=crop&w=200&q=80',
      slug: 'bivouacs-etoiles',
    },
    {
      id: 'club-3',
      name: 'Photo de montagne',
      role: 'Membre',
      members_count: 156,
      detail: 'atelier vendredi',
      logo_url: 'https://images.unsplash.com/photo-1486870591958-9b9d0d1dda99?auto=format&fit=crop&w=200&q=80',
      slug: 'photo-de-montagne',
    },
    {
      id: 'club-4',
      name: 'Trail Chartreuse',
      role: 'Membre',
      members_count: 122,
      detail: '122 membres',
      logo_url: 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=200&q=80',
      slug: 'trail-chartreuse',
    },
  ] as ClubItem[],

  commandes: [
    {
      id: 'cmd-1',
      product_name: "Veste Gore-Tex Arc'teryx Beta AR",
      order_number: 'CMD-2026-1104',
      price: '389€',
      status: 'Expédiée',
      image_url: 'https://images.unsplash.com/photo-1544441893-675973e31985?auto=format&fit=crop&w=200&q=80',
    },
    {
      id: 'cmd-2',
      product_name: 'Frontale Petzl NAO RL 1500 lm',
      order_number: 'CMD-2026-1098',
      price: '189€',
      status: 'Préparation',
      image_url: 'https://images.unsplash.com/photo-1508873696983-2df515122519?auto=format&fit=crop&w=200&q=80',
    },
    {
      id: 'cmd-3',
      product_name: 'Chaussures Salomon Quest 4 GTX',
      order_number: 'CMD-2026-1076',
      price: '219€',
      status: 'Livrée',
      image_url: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=200&q=80',
    },
  ] as Commande[],

  badges: [
    { id: 'b-1', title: 'Sommet 3000', icon_name: 'MountainIcon', earned: true },
    { id: 'b-2', title: '100 km', icon_name: 'SparklesIcon', earned: true },
    { id: 'b-3', title: 'Auteur', icon_name: 'PencilIcon', earned: true },
    { id: 'b-4', title: 'Sac léger', icon_name: 'ShoppingBagIcon', earned: true },
    { id: 'b-5', title: 'Solidaire', icon_name: 'HeartIcon', earned: true },
    { id: 'b-6', title: 'Massif +5', icon_name: 'MapPinIcon', earned: true },
    { id: 'b-7', title: 'Guide', icon_name: 'StarIcon', earned: false },
    { id: 'b-8', title: 'GR complet', icon_name: 'CheckBadgeIcon', earned: false },
  ] as BadgeItem[],

  constance: {
    streak_weeks: 6,
    subtitle: '6 semaines consécutives avec au moins une sortie enregistrée.',
    days: [
      { day: 'L', count: 1, active: false },
      { day: 'M', count: 0, active: false },
      { day: 'M', count: 2, active: false },
      { day: 'J', count: 0, active: false },
      { day: 'V', count: 1, active: false },
      { day: 'S', count: 3, active: false },
      { day: 'D', count: 2, active: true },
    ],
    footer_text: 'Cette semaine · 3 sorties',
    goal_text: 'Objectif : 2 · atteint',
  },

  activite: [
    {
      id: 'act-1',
      text: 'Élise M. a aimé votre carnet ',
      highlight: 'Trois jours sur les crêtes.',
      time: '2h',
      icon_type: 'like',
    },
    {
      id: 'act-2',
      text: 'Nouveau badge ',
      highlight: 'Sommet 3000 débloqué après le lac Achard.',
      time: 'hier',
      icon_type: 'badge',
    },
    {
      id: 'act-3',
      text: 'Commande ',
      highlight: 'CMD-2026-1076 livrée · Chaussures Salomon.',
      time: '3j',
      icon_type: 'order',
    },
    {
      id: 'act-4',
      text: 'Antoine B. a commenté ',
      highlight: 'Bivouac au lac Achard.',
      time: '5j',
      icon_type: 'comment',
    },
    {
      id: 'act-5',
      text: 'Julien M. vous suit désormais.',
      highlight: '',
      time: '1 sem.',
      icon_type: 'follow',
    },
  ] as ActiviteItem[],

  abonnement: {
    type: 'Guide · annuel',
    details: 'Cartes hors-ligne, refuges réservables, -15% boutique',
    price: '89€/an',
    status: 'Actif',
    renewal_date: '4 février 2027',
  },

  inventaire: {
    articles_count: 47,
    kits_count: 4,
  },
};
