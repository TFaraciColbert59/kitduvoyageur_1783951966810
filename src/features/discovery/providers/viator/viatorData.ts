// src/features/discovery/providers/viator/viatorData.ts
import type { DiscoverySectionName } from '../../types/discovery.types';

// Identifiants de destination Viator OFFICIELS (obtenus via GET /destinations).
// Priorité : IDs de VILLE pour les pays pilotes (résultats plus ciblés), IDs pays
// pour les autres. Aucun ID inventé. Surchargeable via l'env JSON VIATOR_DESTINATION_IDS.
export const VIATOR_DESTINATION_IDS: Record<string, string> = {
  // Pilotes — villes (plus pertinentes qu'un ID national large)
  IS: '905', // Reykjavik
  FR: '479', // Paris
  JP: '334', // Tokyo
  // Pays (agrégats officiels)
  LK: '19', // Sri Lanka
  KE: '801', // Kenya
  PE: '927', // Pérou
  MA: '825', // Maroc
  EG: '722', // Égypte
  IN: '723', // Inde
  HR: '730', // Croatie
  CR: '747', // Costa Rica
  MX: '76', // Mexique
  TZ: '5589', // Tanzanie
  ZA: '11', // Afrique du Sud
  CN: '13', // Chine
  ID: '15', // Indonésie
  TH: '20', // Thaïlande
  VN: '21', // Vietnam
  AU: '22', // Australie
  AT: '44', // Autriche
  BE: '45', // Belgique
  DK: '49', // Danemark
  FI: '50', // Finlande
  DE: '52', // Allemagne
  GR: '53', // Grèce
  HU: '54', // Hongrie
  IE: '56', // Irlande
  IT: '57', // Italie
  NL: '60', // Pays-Bas
  NO: '61', // Norvège
  PL: '62', // Pologne
  PT: '63', // Portugal
  ES: '67', // Espagne
  SE: '68', // Suède
  CH: '69', // Suisse
  TR: '70', // Turquie
  CA: '75', // Canada
  US: '77', // États-Unis
  AR: '78', // Argentine
  BR: '79', // Brésil
  CL: '80', // Chili
  GB: '60457', // Royaume-Uni
};

// Tags Viator OFFICIELS par section (résolus via GET /products/tags).
//   destinations = Attractions et musées (12716)
//   gastronomie  = Circuits gastronomiques (21567) + Cours de cuisine (13283)
export const VIATOR_SECTION_TAGS: Record<DiscoverySectionName, number[]> = {
  destinations: [12716],
  activites: [],
  gastronomie: [21567, 13283],
  hebergements: [],
};

function parseEnvStringMap(raw: string | undefined): Record<string, string> {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const out: Record<string, string> = {};
    for (const [key, value] of Object.entries(parsed)) {
      if (/^[A-Za-z]{2}$/.test(key) && typeof value === 'string') out[key.toUpperCase()] = value;
    }
    return out;
  } catch {
    return {};
  }
}

function parseEnvTagMap(raw: string | undefined): Partial<Record<DiscoverySectionName, number[]>> {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const out: Partial<Record<DiscoverySectionName, number[]>> = {};
    for (const [key, value] of Object.entries(parsed)) {
      if (Array.isArray(value)) {
        const nums = value
          .map((v) => Number(v))
          .filter((n) => Number.isInteger(n) && n > 0);
        if (nums.length) out[key as DiscoverySectionName] = nums;
      }
    }
    return out;
  } catch {
    return {};
  }
}

export function resolveViatorDestinationId(countryCode: string): string | null {
  const code = countryCode.trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(code)) return null;
  const envMap = parseEnvStringMap(process.env.VIATOR_DESTINATION_IDS);
  const value = (envMap[code] || VIATOR_DESTINATION_IDS[code] || '').trim();
  return /^\d+$/.test(value) ? value : null;
}

export function resolveViatorSectionTags(section?: DiscoverySectionName): number[] {
  if (!section) return [];
  const envMap = parseEnvTagMap(process.env.VIATOR_SECTION_TAGS);
  if (envMap[section]?.length) return envMap[section]!;
  if (section === 'gastronomie') {
    const envCulinary = (process.env.VIATOR_CULINARY_TAG_ID || '')
      .split(',')
      .map((v) => v.trim())
      .filter((v) => /^\d+$/.test(v))
      .map(Number);
    if (envCulinary.length) return envCulinary;
  }
  return VIATOR_SECTION_TAGS[section] ?? [];
}
