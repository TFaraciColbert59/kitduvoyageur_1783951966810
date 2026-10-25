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
  title?: string;
  description?: string;
  content?: string;
  coordinates?: { lat: number; lng: number } | null;
}

export interface CarnetKitItem {
  id: string;
  name: string;
  detail: string;
  weight: string;
  color: string;
  weightG?: number;
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
  distance_km?: number;
  denivele_m?: number;
  duree_jours?: number;
}

export interface CarnetData {
  id?: string;
  meta: {
    badge: string;
    titleLine1: string;
    titleLine2: string;
    subtitleLine1: string;
    subtitleLine2: string;
    voyageurs: number;
    dateRange: string;
    itineraire: string;
    authorId?: string;
    authorName?: string;
    authorAvatar?: string;
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
  traceGeojson?: any;
  hikeSessionId?: string;
  poiEvents?: any[];
}
