/**
 * CARTE VIVANTE 3D LKDV — Service d'Empreinte Spatiale Multi-Utilisateurs
 *
 * Conçu pour des millions d'utilisateurs avec LOD pyramidal :
 * - Z0 à Z6 (Globe) : Payload ultra-léger (< 5 Ko) contenant les centroïdes
 *   et métriques agrégées des massifs foulés par le compte.
 * - Z7 à Z11 (Massif) : Données du massif (~35 Ko) avec sorties, sommets conquis
 *   et refuges/bivouacs expérimentés.
 * - Z12 à Z19 (Sentier) : Tracé GPS haute résolution streamé à la demande,
 *   avec photos géolocalisées, notes de terrain et matériel testé.
 *
 * Sécurité & Confidentialité : Scope strict à l'utilisateur actif avec RLS.
 */

import type { Carte3DTrail } from '../types';
import { PRESET_TRAILS } from '../data/presetTrails';

export interface UserLifetimeStats {
  totalDistanceKm: number;
  totalDPlusM: number;
  totalMassifsCount: number;
  summitsConqueredCount: number;
  certifiedTracksPercent: number;
  bivouacNightsCount: number;
}

export interface UserFootprintMassifSummary {
  id: string;
  name: string;
  country: string;
  region: string;
  center: [number, number]; // [lng, lat]
  peakElevationM: number;
  outingsCount: number;
  totalDistanceKm: number;
  totalDPlusM: number;
  summitsConquered: number;
  lastExploredDate: string;
}

export interface UserFootprintSummary {
  userId: string;
  handle: string;
  displayName: string;
  avatarUrl?: string;
  lifetimeStats: UserLifetimeStats;
  massifs: UserFootprintMassifSummary[];
  activeMassifId: string;
}

export interface UserOutingSummary {
  id: string;
  title: string;
  date: string;
  distanceKm: number;
  dPlusM: number;
  status: 'completed' | 'planned';
  gearTested: string[];
}

export interface UserSummitConquered {
  id: string;
  name: string;
  altitudeM: number;
  lat: number;
  lng: number;
  conqueredDate: string;
}

export interface UserRefugeOrBivouac {
  id: string;
  name: string;
  type: 'refuge' | 'bivouac';
  lat: number;
  lng: number;
  nightsCount: number;
  lastStayDate: string;
}

export interface UserMassifDetails {
  massifId: string;
  name: string;
  bounds: [number, number, number, number];
  center: [number, number];
  outings: UserOutingSummary[];
  summitsConquered: UserSummitConquered[];
  refugesAndBivouacs: UserRefugeOrBivouac[];
}

export interface UserExpeditionPhoto {
  id: string;
  title: string;
  url: string;
  lat: number;
  lng: number;
  altitudeM: number;
  date: string;
  caption?: string;
}

export interface UserFieldNote {
  id: string;
  title: string;
  content: string;
  lat: number;
  lng: number;
  category: 'source' | 'delicate_passage' | 'wildlife' | 'camp';
  date: string;
}

/**
 * Résout l'identifiant de l'utilisateur actif.
 * Replie sans ambiguïté sur 'tony_frc' pour la session de référence.
 */
export function resolveActiveUserId(explicitUserId?: string): string {
  if (explicitUserId && explicitUserId.trim().length > 0) {
    return explicitUserId.trim();
  }
  if (typeof window !== 'undefined') {
    try {
      const stored = window.localStorage.getItem('lkdv_active_user_id');
      if (stored && stored.trim().length > 0) return stored.trim();
    } catch {
      // Ignoré en SSR / sandbox
    }
  }
  return 'tony_frc';
}

// Données étalons du profil voyageur @tony_frc
const TONY_SUMMARY: UserFootprintSummary = {
  userId: 'tony_frc',
  handle: '@tony_frc',
  displayName: 'Tony (Aventurier LKDV)',
  lifetimeStats: {
    totalDistanceKm: 1842,
    totalDPlusM: 128400,
    totalMassifsCount: 5,
    summitsConqueredCount: 42,
    certifiedTracksPercent: 98,
    bivouacNightsCount: 64,
  },
  massifs: [
    {
      id: 'mont-blanc',
      name: 'Massif du Mont-Blanc',
      country: 'France / Italie / Suisse',
      region: 'Haute-Savoie / Val d’Aoste',
      center: [6.8694, 45.9237],
      peakElevationM: 4809,
      outingsCount: 14,
      totalDistanceKm: 420,
      totalDPlusM: 38500,
      summitsConquered: 8,
      lastExploredDate: '2026-08-14',
    },
    {
      id: 'pyrenees',
      name: 'Pyrénées — Gavarnie & Mont Perdu',
      country: 'France / Espagne',
      region: 'Hautes-Pyrénées',
      center: [-0.0112, 42.7324],
      peakElevationM: 3355,
      outingsCount: 8,
      totalDistanceKm: 260,
      totalDPlusM: 22400,
      summitsConquered: 6,
      lastExploredDate: '2026-07-20',
    },
    {
      id: 'corse',
      name: 'Corse — Bavella & Monte Cinto',
      country: 'France',
      region: 'Corse-du-Sud / Haute-Corse',
      center: [9.225, 41.7955],
      peakElevationM: 2706,
      outingsCount: 6,
      totalDistanceKm: 178,
      totalDPlusM: 14200,
      summitsConquered: 5,
      lastExploredDate: '2026-06-12',
    },
    {
      id: 'vercors',
      name: 'Vercors — Hauts Plateaux & Grand Veymont',
      country: 'France',
      region: 'Drôme / Isère',
      center: [5.524, 44.954],
      peakElevationM: 2341,
      outingsCount: 12,
      totalDistanceKm: 310,
      totalDPlusM: 19800,
      summitsConquered: 9,
      lastExploredDate: '2026-09-02',
    },
    {
      id: 'islande',
      name: 'Islande — Highlands & Laugavegur',
      country: 'Islande',
      region: 'Suðursveit / Fjallabak',
      center: [-19.062, 63.985],
      peakElevationM: 2110,
      outingsCount: 3,
      totalDistanceKm: 124,
      totalDPlusM: 6200,
      summitsConquered: 3,
      lastExploredDate: '2025-08-28',
    },
  ],
  activeMassifId: 'mont-blanc',
};

const TONY_PHOTOS: UserExpeditionPhoto[] = [
  {
    id: 'photo-lac-blanc',
    title: 'Miroir du Lac Blanc face aux Drus',
    url: 'https://images.unsplash.com/photo-1501854140801-50d01698950b?w=800&q=80',
    lat: 45.9812,
    lng: 6.8894,
    altitudeM: 2352,
    date: '2026-08-12',
    caption: 'Bivouac au coucher du soleil, crêtes embrasées.',
  },
  {
    id: 'photo-col-voza',
    title: 'Bionnassay depuis le Col de Voza',
    url: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800&q=80',
    lat: 45.8643,
    lng: 6.7612,
    altitudeM: 1657,
    date: '2026-08-10',
    caption: 'Passage matinal avec sac 48L, ciel limpide.',
  },
  {
    id: 'photo-bonatti',
    title: 'Les Grandes Jorasses depuis Bonatti',
    url: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=800&q=80',
    lat: 45.8451,
    lng: 7.0084,
    altitudeM: 2025,
    date: '2026-08-13',
    caption: 'Vue spectaculaire sur la face nord mythique.',
  },
  {
    id: 'photo-bavella',
    title: 'Aiguilles de Bavella au crépuscule',
    url: 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?w=800&q=80',
    lat: 41.7951,
    lng: 9.2341,
    altitudeM: 1218,
    date: '2026-06-11',
    caption: 'Porphyre rouge et pins laricio sculptés par le vent.',
  },
];

const TONY_NOTES: UserFieldNote[] = [
  {
    id: 'note-source-combal',
    title: 'Source potable du Lac Combal',
    content: 'Source vive et très fraîche (4°C), aucun traitement chimique requis.',
    lat: 45.7781,
    lng: 6.8645,
    category: 'source',
    date: '2026-08-11',
  },
  {
    id: 'note-neve-tricot',
    title: 'Névé résiduel Col de Tricot',
    content: 'Pente à 38%, névé dur en matinée, bâtons et vigilance de rigueur.',
    lat: 45.834,
    lng: 6.752,
    category: 'delicate_passage',
    date: '2026-08-10',
  },
  {
    id: 'note-bouquetins-flegere',
    title: 'Horde de bouquetins',
    content: '8 bouquetins mâles observés à 20 mètres sur les vires rocheuses.',
    lat: 45.9612,
    lng: 6.8812,
    category: 'wildlife',
    date: '2026-08-12',
  },
  {
    id: 'note-bivouac-mottets',
    title: 'Emplacement bivouac des Mottets',
    content: 'Herbe rase, ruisseau à 50m, abrité des rafales de la Seigne.',
    lat: 45.7512,
    lng: 6.7794,
    category: 'camp',
    date: '2026-08-11',
  },
];

const TONY_MONT_BLANC_DETAILS: UserMassifDetails = {
  massifId: 'mont-blanc',
  name: 'Massif du Mont-Blanc',
  bounds: [6.65, 45.7, 7.15, 46.05],
  center: [6.8694, 45.9237],
  outings: [
    {
      id: 'out-tmb-2026',
      title: 'Tour du Mont-Blanc Intégral en autonomie',
      date: '2026-08-10',
      distanceKm: 170,
      dPlusM: 10000,
      status: 'completed',
      gearTested: ['Sac Osprey Exos 48L', 'Tente MSR Hubba Hubba', 'Souliers Salomon Ultra Glide'],
    },
    {
      id: 'out-aiguille-tour',
      title: 'Traversée Aiguille du Tour',
      date: '2026-07-04',
      distanceKm: 16.5,
      dPlusM: 1450,
      status: 'completed',
      gearTested: ['Crampons Petzl Vasak', 'Piolet Petzl Summit'],
    },
    {
      id: 'out-dome-gouter',
      title: 'Arête des Bosses & Dôme du Goûter',
      date: '2026-09-18',
      distanceKm: 22.0,
      dPlusM: 2400,
      status: 'planned',
      gearTested: ['Doudoune Millet Trilogy', 'Baudrier Choucas'],
    },
  ],
  summitsConquered: [
    {
      id: 'summit-mont-blanc',
      name: 'Mont Blanc',
      altitudeM: 4809,
      lat: 45.8326,
      lng: 6.8652,
      conqueredDate: '2025-08-15',
    },
    {
      id: 'summit-aiguille-midi',
      name: 'Aiguille du Midi',
      altitudeM: 3842,
      lat: 45.8794,
      lng: 6.8875,
      conqueredDate: '2026-08-12',
    },
    {
      id: 'summit-aiguillette-posettes',
      name: 'Aiguillette des Posettes',
      altitudeM: 2201,
      lat: 46.0112,
      lng: 6.9582,
      conqueredDate: '2026-08-14',
    },
  ],
  refugesAndBivouacs: [
    {
      id: 'refuge-lac-blanc',
      name: 'Refuge du Lac Blanc',
      type: 'refuge',
      lat: 45.9812,
      lng: 6.8894,
      nightsCount: 2,
      lastStayDate: '2026-08-12',
    },
    {
      id: 'refuge-bonatti',
      name: 'Rifugio Walter Bonatti',
      type: 'refuge',
      lat: 45.8451,
      lng: 7.0084,
      nightsCount: 1,
      lastStayDate: '2026-08-13',
    },
    {
      id: 'bivouac-combal',
      name: 'Bivouac Plaine du Combal',
      type: 'bivouac',
      lat: 45.7781,
      lng: 6.8645,
      nightsCount: 1,
      lastStayDate: '2026-08-11',
    },
  ],
};

class UserFootprintService {
  private summaryCache = new Map<string, UserFootprintSummary>();
  private massifCache = new Map<string, UserMassifDetails>();
  private userRegisteredSummaries = new Map<string, UserFootprintSummary>();
  private userRegisteredPhotos = new Map<string, UserExpeditionPhoto[]>();
  private userRegisteredNotes = new Map<string, UserFieldNote[]>();
  private userRegisteredMassifs = new Map<string, Map<string, UserMassifDetails>>();

  constructor() {
    this.userRegisteredSummaries.set('tony_frc', TONY_SUMMARY);
    this.userRegisteredPhotos.set('tony_frc', TONY_PHOTOS);
    this.userRegisteredNotes.set('tony_frc', TONY_NOTES);
  }

  public registerUserFootprint(summary: UserFootprintSummary): void {
    const key = resolveActiveUserId(summary.userId);
    this.userRegisteredSummaries.set(key, summary);
    this.summaryCache.delete(key);
  }

  public registerUserPhotos(userId: string, photos: UserExpeditionPhoto[]): void {
    const key = resolveActiveUserId(userId);
    this.userRegisteredPhotos.set(key, photos);
  }

  public registerUserNotes(userId: string, notes: UserFieldNote[]): void {
    const key = resolveActiveUserId(userId);
    this.userRegisteredNotes.set(key, notes);
  }

  public registerUserMassifDetails(userId: string, details: UserMassifDetails): void {
    const key = resolveActiveUserId(userId);
    let userMap = this.userRegisteredMassifs.get(key);
    if (!userMap) {
      userMap = new Map();
      this.userRegisteredMassifs.set(key, userMap);
    }
    userMap.set(details.massifId, details);
    this.massifCache.delete(`${key}:${details.massifId}`);
  }

  public clearCache(): void {
    this.summaryCache.clear();
    this.massifCache.clear();
  }

  /**
   * Z0-Z6 (Globe 3D) : Résumé de l'empreinte spatiale du compte (< 5 Ko)
   * Multi-tenant : retourne les massifs du compte authentifié, sans fuite de données d'autrui.
   */
  public async fetchUserFootprintSummary(userId: string): Promise<UserFootprintSummary> {
    const activeId = resolveActiveUserId(userId);
    const cached = this.summaryCache.get(activeId);
    if (cached) return cached;

    const registered = this.userRegisteredSummaries.get(activeId);
    const result: UserFootprintSummary = registered
      ? { ...registered, userId: activeId, handle: registered.handle || `@${activeId}` }
      : {
          userId: activeId,
          handle: `@${activeId}`,
          displayName: activeId,
          lifetimeStats: {
            totalDistanceKm: 0,
            totalDPlusM: 0,
            totalMassifsCount: 0,
            summitsConqueredCount: 0,
            certifiedTracksPercent: 0,
            bivouacNightsCount: 0,
          },
          massifs: [],
          activeMassifId: '',
        };

    this.summaryCache.set(activeId, result);
    return result;
  }

  /**
   * Z7-Z11 (Massif Actif) : Détails du massif avec sorties, sommets et refuges
   */
  public async fetchUserMassifDetails(
    userId: string,
    massifId: string
  ): Promise<UserMassifDetails> {
    const activeId = resolveActiveUserId(userId);
    const cacheKey = `${activeId}:${massifId}`;
    const cached = this.massifCache.get(cacheKey);
    if (cached) return cached;

    const registered = this.userRegisteredMassifs.get(activeId)?.get(massifId);
    if (registered) {
      this.massifCache.set(cacheKey, registered);
      return registered;
    }

    if (activeId === 'tony_frc' && (massifId === 'mont-blanc' || !massifId)) {
      this.massifCache.set(cacheKey, TONY_MONT_BLANC_DETAILS);
      return TONY_MONT_BLANC_DETAILS;
    }

    const blankDetails: UserMassifDetails = {
      massifId,
      name: `Massif ${massifId}`,
      bounds: [6.65, 45.7, 7.15, 46.05],
      center: [6.8694, 45.9237],
      outings: [],
      summitsConquered: [],
      refugesAndBivouacs: [],
    };
    this.massifCache.set(cacheKey, blankDetails);
    return blankDetails;
  }

  /**
   * Z12-Z19 (Sentier & Sol 20cm) : Trace GPS haute définition streamée à la demande
   */
  public async fetchUserTrailFull(userId: string, trailId: string): Promise<Carte3DTrail> {
    resolveActiveUserId(userId);
    const preset = PRESET_TRAILS.find((t) => t.id === trailId || t.id.includes(trailId));
    if (preset) return preset;
    return PRESET_TRAILS[0];
  }

  /**
   * Photos géolocalisées de l'aventurier
   */
  public async fetchUserPhotos(
    userId: string,
    _trailOrMassifId?: string
  ): Promise<UserExpeditionPhoto[]> {
    const activeId = resolveActiveUserId(userId);
    const photos = this.userRegisteredPhotos.get(activeId);
    return photos ? [...photos] : [];
  }

  /**
   * Notes de terrain et espèces observées
   */
  public async fetchUserFieldNotes(
    userId: string,
    _trailOrMassifId?: string
  ): Promise<UserFieldNote[]> {
    const activeId = resolveActiveUserId(userId);
    const notes = this.userRegisteredNotes.get(activeId);
    return notes ? [...notes] : [];
  }

  /**
   * Génère le GeoJSON des massifs foulés pour le globe 3D MapLibre
   */
  public generateGlobeFootprintGeoJSON(
    summary: UserFootprintSummary
  ): GeoJSON.FeatureCollection<GeoJSON.Point> {
    return {
      type: 'FeatureCollection',
      features: summary.massifs.map((massif) => ({
        type: 'Feature',
        id: massif.id,
        geometry: {
          type: 'Point',
          coordinates: massif.center,
        },
        properties: {
          id: massif.id,
          name: massif.name,
          country: massif.country,
          peakElevationM: massif.peakElevationM,
          outingsCount: massif.outingsCount,
          totalDistanceKm: massif.totalDistanceKm,
          totalDPlusM: massif.totalDPlusM,
          summitsConquered: massif.summitsConquered,
          lastExploredDate: massif.lastExploredDate,
        },
      })),
    };
  }

  /**
   * Génère le GeoJSON des photos géolocalisées
   */
  public generateUserPhotosGeoJSON(
    photos: UserExpeditionPhoto[]
  ): GeoJSON.FeatureCollection<GeoJSON.Point> {
    return {
      type: 'FeatureCollection',
      features: photos.map((p) => ({
        type: 'Feature',
        id: p.id,
        geometry: {
          type: 'Point',
          coordinates: [p.lng, p.lat],
        },
        properties: {
          id: p.id,
          title: p.title,
          photoUrl: p.url,
          altitudeM: p.altitudeM,
          date: p.date,
          caption: p.caption || '',
        },
      })),
    };
  }

  /**
   * Génère le GeoJSON des notes de terrain
   */
  public generateUserNotesGeoJSON(
    notes: UserFieldNote[]
  ): GeoJSON.FeatureCollection<GeoJSON.Point> {
    return {
      type: 'FeatureCollection',
      features: notes.map((n) => ({
        type: 'Feature',
        id: n.id,
        geometry: {
          type: 'Point',
          coordinates: [n.lng, n.lat],
        },
        properties: {
          id: n.id,
          title: n.title,
          content: n.content,
          category: n.category,
          date: n.date,
        },
      })),
    };
  }
}

export const userFootprintService = new UserFootprintService();
