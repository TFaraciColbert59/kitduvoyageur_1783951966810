/**
 * Explorer v2 — Human-Readable POI & Route Taxonomy (French, Zero Jargon).
 *
 * Single source of truth for POI badges, icons, colors, route network names,
 * difficulty grades, WMO weather codes, and practical equipment advice.
 * Eliminates generic "Spot", cryptic route refs ("18"), and unexplained scores ("Fit 66").
 */

export type PoiIconKey =
  | 'summit'
  | 'saddle'
  | 'viewpoint'
  | 'water'
  | 'spring'
  | 'refuge'
  | 'cabin'
  | 'shelter'
  | 'bivouac'
  | 'trailhead'
  | 'parking'
  | 'bus'
  | 'train'
  | 'village'
  | 'city'
  | 'bike'
  | 'ebike'
  | 'favorite'
  | 'danger'
  | 'rescue'
  | 'pin';

export interface PoiPresentation {
  /** Clear French category label (e.g. "Refuge gardé", "Gare SNCF", "Arrêt de bus", "Col"). */
  label: string;
  /** Compact badge for grid cards (e.g. "Refuge", "Gare", "Bus", "Col", "Source"). */
  shortBadge: string;
  /** Broad group for filtering. */
  group: 'relief' | 'water' | 'shelter' | 'access' | 'bike' | 'danger' | 'place';
  iconKey: PoiIconKey;
  color: string;
  bgTint: string;
}

const TOKEN_PRESENTATIONS: Record<string, PoiPresentation> = {
  peak: {
    label: 'Sommet',
    shortBadge: 'Sommet',
    group: 'relief',
    iconKey: 'summit',
    color: '#17402C',
    bgTint: 'rgba(23, 64, 44, 0.12)',
  },
  summit: {
    label: 'Sommet',
    shortBadge: 'Sommet',
    group: 'relief',
    iconKey: 'summit',
    color: '#17402C',
    bgTint: 'rgba(23, 64, 44, 0.12)',
  },
  saddle: {
    label: 'Col de montagne',
    shortBadge: 'Col',
    group: 'relief',
    iconKey: 'saddle',
    color: '#334155',
    bgTint: 'rgba(51, 65, 85, 0.12)',
  },
  viewpoint: {
    label: 'Point de vue · Panorama',
    shortBadge: 'Panorama',
    group: 'relief',
    iconKey: 'viewpoint',
    color: '#0369A1',
    bgTint: 'rgba(3, 105, 161, 0.12)',
  },
  drinking_water: {
    label: 'Point d’eau potable',
    shortBadge: 'Eau potable',
    group: 'water',
    iconKey: 'water',
    color: '#0284C7',
    bgTint: 'rgba(2, 132, 199, 0.12)',
  },
  water: {
    label: 'Point d’eau',
    shortBadge: 'Eau',
    group: 'water',
    iconKey: 'water',
    color: '#0284C7',
    bgTint: 'rgba(2, 132, 199, 0.12)',
  },
  spring: {
    label: 'Source naturelle',
    shortBadge: 'Source',
    group: 'water',
    iconKey: 'spring',
    color: '#0891B2',
    bgTint: 'rgba(8, 145, 178, 0.12)',
  },
  alpine_hut: {
    label: 'Refuge de montagne',
    shortBadge: 'Refuge',
    group: 'shelter',
    iconKey: 'refuge',
    color: '#9A3412',
    bgTint: 'rgba(194, 120, 56, 0.16)',
  },
  refuge: {
    label: 'Refuge de montagne',
    shortBadge: 'Refuge',
    group: 'shelter',
    iconKey: 'refuge',
    color: '#9A3412',
    bgTint: 'rgba(194, 120, 56, 0.16)',
  },
  wilderness_hut: {
    label: 'Cabane non gardée',
    shortBadge: 'Cabane',
    group: 'shelter',
    iconKey: 'cabin',
    color: '#78350F',
    bgTint: 'rgba(146, 64, 14, 0.14)',
  },
  shelter: {
    label: 'Abri de randonnée',
    shortBadge: 'Abri',
    group: 'shelter',
    iconKey: 'shelter',
    color: '#57534E',
    bgTint: 'rgba(120, 113, 108, 0.14)',
  },
  camp_site: {
    label: 'Bivouac · Camping',
    shortBadge: 'Bivouac',
    group: 'shelter',
    iconKey: 'bivouac',
    color: '#B45309',
    bgTint: 'rgba(217, 119, 6, 0.14)',
  },
  bivouac: {
    label: 'Zone de bivouac',
    shortBadge: 'Bivouac',
    group: 'shelter',
    iconKey: 'bivouac',
    color: '#B45309',
    bgTint: 'rgba(217, 119, 6, 0.14)',
  },
  trailhead: {
    label: 'Départ de sentier',
    shortBadge: 'Départ',
    group: 'access',
    iconKey: 'trailhead',
    color: '#15803D',
    bgTint: 'rgba(22, 163, 74, 0.12)',
  },
  parking: {
    label: 'Parking randonnée',
    shortBadge: 'Parking',
    group: 'access',
    iconKey: 'parking',
    color: '#1D4ED8',
    bgTint: 'rgba(37, 99, 235, 0.12)',
  },
  bus_stop: {
    label: 'Arrêt de bus · Navette',
    shortBadge: 'Bus',
    group: 'access',
    iconKey: 'bus',
    color: '#B45309',
    bgTint: 'rgba(245, 158, 11, 0.14)',
  },
  train_station: {
    label: 'Gare ferroviaire',
    shortBadge: 'Gare',
    group: 'access',
    iconKey: 'train',
    color: '#334155',
    bgTint: 'rgba(100, 116, 139, 0.14)',
  },
  village: {
    label: 'Village',
    shortBadge: 'Village',
    group: 'place',
    iconKey: 'village',
    color: '#92400E',
    bgTint: 'rgba(180, 83, 9, 0.12)',
  },
  hamlet: {
    label: 'Hameau',
    shortBadge: 'Hameau',
    group: 'place',
    iconKey: 'village',
    color: '#92400E',
    bgTint: 'rgba(180, 83, 9, 0.12)',
  },
  town: {
    label: 'Commune · Bourg',
    shortBadge: 'Commune',
    group: 'place',
    iconKey: 'city',
    color: '#334155',
    bgTint: 'rgba(51, 65, 85, 0.12)',
  },
  city: {
    label: 'Ville',
    shortBadge: 'Ville',
    group: 'place',
    iconKey: 'city',
    color: '#1E293B',
    bgTint: 'rgba(30, 41, 59, 0.12)',
  },
  bike_shop: {
    label: 'Magasin / Atelier vélo',
    shortBadge: 'Atelier vélo',
    group: 'bike',
    iconKey: 'bike',
    color: '#047857',
    bgTint: 'rgba(5, 150, 105, 0.12)',
  },
  bike_repair: {
    label: 'Borne réparation vélo',
    shortBadge: 'Réparation',
    group: 'bike',
    iconKey: 'bike',
    color: '#4338CA',
    bgTint: 'rgba(79, 70, 229, 0.12)',
  },
  ebike_charging: {
    label: 'Borne recharge VAE',
    shortBadge: 'Borne VAE',
    group: 'bike',
    iconKey: 'ebike',
    color: '#059669',
    bgTint: 'rgba(16, 185, 129, 0.14)',
  },
  saved_place: {
    label: 'Lieu favori',
    shortBadge: 'Favori',
    group: 'place',
    iconKey: 'favorite',
    color: '#A16207',
    bgTint: 'rgba(234, 179, 8, 0.16)',
  },
  rescue: {
    label: 'Secours · Poste médical',
    shortBadge: 'Secours',
    group: 'danger',
    iconKey: 'rescue',
    color: '#B91C1C',
    bgTint: 'rgba(220, 38, 38, 0.14)',
  },
  danger: {
    label: 'Vigilance terrain',
    shortBadge: 'Danger',
    group: 'danger',
    iconKey: 'danger',
    color: '#991B1B',
    bgTint: 'rgba(220, 38, 38, 0.14)',
  },
  access: {
    label: 'Point d’accès',
    shortBadge: 'Accès',
    group: 'access',
    iconKey: 'trailhead',
    color: '#17402C',
    bgTint: 'rgba(23, 64, 44, 0.1)',
  },
};

const FALLBACK_PRESENTATION: PoiPresentation = {
  label: 'Lieu remarquable',
  shortBadge: 'Lieu',
  group: 'place',
  iconKey: 'pin',
  color: '#17402C',
  bgTint: 'rgba(23, 64, 44, 0.1)',
};

/**
 * Resolves a human-friendly French label, short badge, color & icon for any POI,
 * always preferring granular `subtype` over broad bucket `kind`.
 */
export function resolvePoiPresentation(
  kind?: string | null,
  subtype?: string | null,
): PoiPresentation {
  const sub = (subtype ?? '').trim().toLowerCase();
  if (sub && TOKEN_PRESENTATIONS[sub]) {
    return TOKEN_PRESENTATIONS[sub];
  }
  const k = (kind ?? '').trim().toLowerCase();
  if (k && TOKEN_PRESENTATIONS[k]) {
    return TOKEN_PRESENTATIONS[k];
  }
  return FALLBACK_PRESENTATION;
}

export interface RouteNetworkPresentation {
  /** Clear human label, e.g. "Grande Randonnée · GR 5" or "Sentier local · n° 18". */
  label: string;
  /** Compact pill for grid cards, e.g. "GR 5", "PR", "VTT", "Sentier". */
  shortBadge: string;
}

/**
 * Converts cryptic OSM `network` ("iwn", "lwn", "rwn") and raw numeric `ref` ("18")
 * into immediately understandable French labels.
 */
export function formatRouteNetworkLabel(
  network?: string | null,
  ref?: string | null,
): RouteNetworkPresentation {
  const net = (network ?? '').trim().toLowerCase();
  const cleanRef = (ref ?? '').trim();
  const refFormatted = cleanRef
    ? /^\d+[a-z]?$/i.test(cleanRef)
      ? `n° ${cleanRef}`
      : cleanRef.toUpperCase()
    : '';

  if (net === 'iwn') {
    return {
      label: refFormatted ? `Grande Randonnée · ${refFormatted}` : 'Grande Randonnée internationale',
      shortBadge: cleanRef && !/^\d+$/.test(cleanRef) ? cleanRef.toUpperCase() : 'GR Int.',
    };
  }
  if (net === 'nwn') {
    return {
      label: refFormatted ? `Grande Randonnée · ${refFormatted}` : 'Grande Randonnée (GR)',
      shortBadge: cleanRef && !/^\d+$/.test(cleanRef) ? cleanRef.toUpperCase() : 'GR',
    };
  }
  if (net === 'rwn') {
    return {
      label: refFormatted ? `Itinéraire régional · ${refFormatted}` : 'Itinéraire régional (GRP)',
      shortBadge: 'GRP',
    };
  }
  if (net === 'lwn') {
    return {
      label: refFormatted ? `Petite Randonnée · ${refFormatted}` : 'Petite Randonnée (PR)',
      shortBadge: 'PR',
    };
  }
  if (net === 'mtb') {
    return {
      label: refFormatted ? `Parcours VTT · ${refFormatted}` : 'Parcours VTT balisé',
      shortBadge: 'VTT',
    };
  }
  if (net === 'icn' || net === 'ncn' || net === 'rcn' || net === 'lcn') {
    return {
      label: refFormatted ? `Véloroute · ${refFormatted}` : 'Véloroute balisée',
      shortBadge: 'Vélo',
    };
  }
  return {
    label: refFormatted ? `Sentier balisé · ${refFormatted}` : 'Sentier de randonnée',
    shortBadge: 'Rando',
  };
}

export interface RouteDifficultyInfo {
  level: 'Facile' | 'Modéré' | 'Difficile' | 'Exigeant';
  color: string;
  bgTint: string;
  summary: string;
}

/**
 * Computes an understandable French difficulty rating from real distance, elevation gain & max altitude.
 */
export function computeRouteDifficulty(
  distanceKm?: number | null,
  elevGainM?: number | null,
  maxAltM?: number | null,
): RouteDifficultyInfo {
  const km = typeof distanceKm === 'number' && Number.isFinite(distanceKm) ? distanceKm : 0;
  const dPlus = typeof elevGainM === 'number' && Number.isFinite(elevGainM) ? elevGainM : 0;
  const alt = typeof maxAltM === 'number' && Number.isFinite(maxAltM) ? maxAltM : 0;

  // Classic IBP-like hiking effort score
  const score = km * 2.2 + dPlus / 28 + (alt >= 2500 ? 12 : alt >= 2000 ? 6 : 0);

  if (score >= 66 || dPlus >= 1100 || alt >= 2800) {
    return {
      level: 'Exigeant',
      color: '#991B1B',
      bgTint: 'rgba(220, 38, 38, 0.13)',
      summary: 'Dénivelé soutenu ou haute altitude : bonne condition physique et équipement complet.',
    };
  }
  if (score >= 34 || dPlus >= 600 || km >= 14) {
    return {
      level: 'Difficile',
      color: '#9A3412',
      bgTint: 'rgba(234, 88, 12, 0.13)',
      summary: 'Sortie sportive avec effort prolongé en montée.',
    };
  }
  if (score >= 16 || dPlus >= 250 || km >= 6) {
    return {
      level: 'Modéré',
      color: '#92400E',
      bgTint: 'rgba(217, 119, 6, 0.14)',
      summary: 'Accessible aux marcheurs réguliers, chaussures de rando conseillées.',
    };
  }
  return {
    level: 'Facile',
    color: '#166534',
    bgTint: 'rgba(22, 163, 74, 0.13)',
    summary: 'Balade accessible avec peu de dénivelé.',
  };
}

/**
 * Translates WMO weather codes (Open-Meteo) into plain French labels.
 */
export function describeWmoWeatherCode(code?: number | null): {
  label: string;
  symbol: 'sun' | 'cloud' | 'rain' | 'snow' | 'storm';
} {
  if (typeof code !== 'number' || !Number.isFinite(code)) {
    return { label: 'Conditions variables', symbol: 'cloud' };
  }
  if (code === 0) return { label: 'Ciel dégagé', symbol: 'sun' };
  if (code === 1) return { label: 'Peu nuageux', symbol: 'sun' };
  if (code === 2) return { label: 'Éclaircies', symbol: 'cloud' };
  if (code === 3) return { label: 'Ciel couvert', symbol: 'cloud' };
  if (code === 45 || code === 48) return { label: 'Brouillard', symbol: 'cloud' };
  if (code >= 51 && code <= 57) return { label: 'Bruine', symbol: 'rain' };
  if (code >= 61 && code <= 67) return { label: 'Pluie', symbol: 'rain' };
  if (code >= 71 && code <= 77) return { label: 'Chutes de neige', symbol: 'snow' };
  if (code >= 80 && code <= 82) return { label: 'Averses de pluie', symbol: 'rain' };
  if (code === 85 || code === 86) return { label: 'Averses de neige', symbol: 'snow' };
  if (code >= 95) return { label: 'Risque d’orage', symbol: 'storm' };
  return { label: 'Nuageux', symbol: 'cloud' };
}

/**
 * Generates concise, actionable outdoor clothing/safety advice in plain French.
 */
export function buildWeatherAdviceFr(
  tempC?: number | null,
  windKmh?: number | null,
  precipMm?: number | null,
  symbol?: string | null,
): string | null {
  const tips: string[] = [];
  if (typeof tempC === 'number' && Number.isFinite(tempC)) {
    if (tempC <= -2) {
      tips.push('Grand froid : doudoune, gants et bonnet indispensables');
    } else if (tempC <= 6) {
      tips.push('Frais en altitude : prévoir polaire et coupe-vent');
    } else if (tempC >= 27) {
      tips.push('Chaleur : emporter au moins 2 L d’eau et protection solaire');
    }
  }
  if (typeof windKmh === 'number' && windKmh >= 35) {
    tips.push(`Vent soutenu (${Math.round(windKmh)} km/h) sur les crêtes`);
  }
  if ((typeof precipMm === 'number' && precipMm > 0.2) || symbol === 'rain') {
    tips.push('Veste imperméable recommandée');
  } else if (symbol === 'snow') {
    tips.push('Terrain potentiellement enneigé ou glissant');
  } else if (symbol === 'storm') {
    tips.push('Risque d’orage : éviter les sommets et crêtes exposées');
  }
  return tips.length > 0 ? tips.slice(0, 2).join(' · ') : null;
}

/**
 * Formats an hour/minute duration cleanly in French ("2 h 15" or "45 min").
 */
export function formatDurationFr(totalMinutes?: number | null): string {
  if (typeof totalMinutes !== 'number' || !Number.isFinite(totalMinutes) || totalMinutes <= 0) {
    return '—';
  }
  const rounded = Math.max(5, Math.round(totalMinutes / 5) * 5);
  const h = Math.floor(rounded / 60);
  const m = rounded % 60;
  if (h === 0) return `${m} min`;
  if (m === 0) return `${h} h`;
  return `${h} h ${String(m).padStart(2, '0')}`;
}

const ICONIC_TAXON_FR: Record<string, string> = {
  aves: 'Oiseaux',
  mammalia: 'Mammifères',
  plantae: 'Plantes',
  fungi: 'Champignons',
  insecta: 'Insectes',
  arachnida: 'Arachnides',
  reptilia: 'Reptiles',
  amphibia: 'Amphibiens',
  actinopterygii: 'Poissons',
  mollusca: 'Mollusques',
  chromista: 'Algues',
  animalia: 'Faune',
  protozoa: 'Micro-organismes',
};

/** Translates iNaturalist Latin `iconicTaxon` codes into plain French. */
export function formatIconicTaxonFr(taxon?: string | null): string {
  const key = (taxon ?? '').trim().toLowerCase();
  if (!key) return 'Espèce';
  return ICONIC_TAXON_FR[key] ?? taxon!.trim();
}

const HAZARD_SEVERITY_FR: Record<string, string> = {
  extreme: 'Extrême',
  severe: 'Sévère',
  moderate: 'Modéré',
  minor: 'Faible',
};

/** Translates CAP alert severity labels from English to plain French. */
export function formatHazardSeverityFr(severity?: string | null): string | undefined {
  const key = (severity ?? '').trim().toLowerCase();
  if (!key || key === 'unknown') return undefined;
  return HAZARD_SEVERITY_FR[key] ?? severity!.trim();
}

const EMERGENCY_LABELS_FR: Record<string, string> = {
  general: 'Urgences',
  emergency: 'Urgences',
  ambulance: 'SAMU',
  medical: 'SAMU',
  fire: 'Pompiers',
  police: 'Police',
  mountain: 'Secours montagne',
  sea: 'Secours mer',
};

/** Returns a clear French service label for an emergency phone number button. */
export function formatEmergencyServiceLabelFr(rawKey: string, phoneNumber: string): string {
  const dial = phoneNumber.replace(/[^+\d]/g, '');
  if (dial === '112') return 'Urgences';
  if (dial === '15') return 'SAMU';
  if (dial === '17') return 'Police';
  if (dial === '18') return 'Pompiers';
  if (dial === '114') return 'SMS urgence';
  const k = rawKey.trim().toLowerCase();
  return EMERGENCY_LABELS_FR[k] ?? 'Urgences';
}

const REPORT_CATEGORY_FR: Record<string, string> = {
  obstacle: 'Obstacle sur le sentier',
  closure: 'Fermeture / interdit',
  mud: 'Boue / terrain gras',
  snow_ice: 'Neige / verglas',
  water: 'Point d’eau',
  danger: 'Danger terrain',
  bridge: 'Passerelle / pont',
  flood: 'Crue / passage noyé',
  marking: 'Balisage / accès',
  shelter: 'Refuge / abri',
  crowding: 'Forte affluence',
  animal: 'Faune / troupeau',
  rockfall: 'Éboulement / pierres',
};

/** Translates terrain report category slugs into clear French labels. */
export function formatReportCategoryFr(category?: string | null): string {
  const k = (category ?? '').trim().toLowerCase();
  return REPORT_CATEGORY_FR[k] ?? 'Signalement terrain';
}

/** Formats OSM `direction` tag (degrees or cardinal letters) into readable French panorama orientation. */
export function formatCompassDirectionFr(raw?: string | null): string | null {
  const val = (raw ?? '').trim();
  if (!val) return null;
  if (/^0-360$|^360$/.test(val)) return 'Panorama 360°';
  const map: Record<string, string> = {
    n: 'Nord',
    ne: 'Nord-Est',
    e: 'Est',
    se: 'Sud-Est',
    s: 'Sud',
    sw: 'Sud-Ouest',
    w: 'Ouest',
    nw: 'Nord-Ouest',
  };
  const lower = val.toLowerCase();
  if (map[lower]) return map[lower];
  const rangeMatch = /^(\d{1,3})\s*-\s*(\d{1,3})$/.exec(val);
  if (rangeMatch) {
    const a = Number(rangeMatch[1]);
    const b = Number(rangeMatch[2]);
    if (Number.isFinite(a) && Number.isFinite(b)) {
      const span = ((b - a + 360) % 360) || 360;
      return span >= 320 ? 'Panorama 360°' : `Secteur ${a}° – ${b}°`;
    }
  }
  const deg = Number(val);
  if (Number.isFinite(deg) && deg >= 0 && deg <= 360) {
    const dirs = ['Nord', 'Nord-Est', 'Est', 'Sud-Est', 'Sud', 'Sud-Ouest', 'Ouest', 'Nord-Ouest'];
    return `${dirs[Math.round(((deg % 360) / 45)) % 8]} (${Math.round(deg)}°)`;
  }
  return val;
}

export type SpotsFilterKind =
  | 'all'
  | 'routes'
  | 'gr'
  | 'pr'
  | 'vtt'
  | 'relief'
  | 'water_refuge'
  | 'bivouac'
  | 'access';

/** Unified filter predicate shared between the Spots & Itinéraires grid and 3D map pins. */
export function poiMatchesSpotsFilter(
  poi: { kind?: string | null; subtype?: string | null },
  filter: SpotsFilterKind,
): boolean {
  if (filter === 'all') return true;
  if (filter === 'routes' || filter === 'gr' || filter === 'pr' || filter === 'vtt') return false;
  const pres = resolvePoiPresentation(poi.kind, poi.subtype);
  const sub = (poi.subtype ?? '').trim().toLowerCase();
  const k = (poi.kind ?? '').trim().toLowerCase();
  if (filter === 'relief') {
    return pres.group === 'relief';
  }
  if (filter === 'water_refuge') {
    return pres.group === 'water' || (pres.group === 'shelter' && sub !== 'camp_site' && k !== 'bivouac');
  }
  if (filter === 'bivouac') {
    return sub === 'camp_site' || k === 'bivouac' || sub === 'shelter' || sub === 'wilderness_hut';
  }
  if (filter === 'access') {
    return pres.group === 'access' || pres.group === 'place' || pres.group === 'bike';
  }
  return true;
}
