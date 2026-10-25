/**
 * Phase 4 — Étape 8 du pipeline : import POI et séparation des natures.
 *
 * Trois natures distinctes, jamais mélangées :
 *   • POI géographique  : eau, refuge, abri, secours, restriction, etc. ;
 *   • offre commerciale : prix/disponibilité HORODATÉS (sinon non servis) ;
 *   • affiliation       : URL cible https + divulgation obligatoire.
 *
 * Un enregistrement non conforme est rejeté avec ses raisons — aucune
 * valeur (prix, disponibilité, catégorie) n'est inventée.
 */
import type { NormalizedPoi, PoiCategory } from './types';

export interface PoiClassification {
  category: PoiCategory | 'unknown';
  reasons: string[];
}

/**
 * Classification OSM → catégorie de couverture. `unknown` = rejeté, jamais
 * rangé d'office dans une catégorie approximative.
 */
export function classifyOsmTags(tags: Record<string, string>): PoiClassification {
  const reasons: string[] = [];
  const tag = (key: string): string | undefined => tags[key]?.toLowerCase();

  if (tag('access') === 'no' || tag('access') === 'private') {
    return { category: 'restriction', reasons: ['Accès interdit ou privé (restriction signalée).'] };
  }

  const amenity = tag('amenity');
  const tourism = tag('tourism');
  const natural = tag('natural');
  const highway = tag('highway');
  const emergency = tag('emergency');
  const shop = tag('shop');

  if (amenity === 'drinking_water' || natural === 'spring' || amenity === 'water_point') {
    return { category: 'water', reasons: ["Point d'eau identifié."] };
  }
  if (amenity === 'shelter' || tourism === 'wilderness_hut') {
    return { category: 'shelter', reasons: ['Abri identifié.'] };
  }
  if (tourism === 'alpine_hut' || tourism === 'mountain_hut') {
    return { category: 'refuge', reasons: ['Refuge identifié.'] };
  }
  if (
    emergency === 'rescue_station' ||
    emergency === 'mountain_rescue' ||
    amenity === 'ranger_station'
  ) {
    return { category: 'rescue', reasons: ['Poste de secours identifié.'] };
  }
  if (tourism === 'viewpoint') {
    return { category: 'viewpoint', reasons: ['Point de vue identifié.'] };
  }
  if (tourism === 'camp_site' || tourism === 'caravan_site') {
    return { category: 'camping', reasons: ['Camping/bivouac identifié.'] };
  }
  if (amenity === 'restaurant' || amenity === 'cafe' || amenity === 'fast_food') {
    return { category: 'food', reasons: ['Restauration identifiée.'] };
  }
  if (
    highway === 'bus_stop' ||
    amenity === 'bus_station' ||
    tag('railway') === 'station' ||
    tag('public_transport') === 'station'
  ) {
    return { category: 'transport', reasons: ['Transport identifié.'] };
  }
  if (tourism === 'hotel' || tourism === 'guest_house' || tourism === 'hostel') {
    return { category: 'lodging', reasons: ['Hébergement identifié.'] };
  }
  if (natural === 'peak' || natural === 'volcano') {
    return { category: 'summit', reasons: ['Sommet identifié.'] };
  }
  if (shop) {
    reasons.push('Commerce sans catégorie de couverture connue.');
  } else {
    reasons.push('Tags OSM sans catégorie de couverture reconnue.');
  }
  return { category: 'unknown', reasons };
}

export interface PoiRecordValidation {
  valid: boolean;
  reasons: string[];
}

/** Contrat offre commerciale : prix/disponibilité exposés seulement si horodatés. */
export function validateOfferRecord(poi: NormalizedPoi): PoiRecordValidation {
  const reasons: string[] = [];
  if (poi.kind !== 'commercial_offer') {
    reasons.push('Nature inattendue : offre commerciale requise.');
  }
  if (poi.price !== null && !poi.priceCheckedAt) {
    reasons.push('Prix sans horodatage de vérification : non servi (jamais inventé).');
  }
  if (poi.availability !== null && !poi.availabilityCheckedAt) {
    reasons.push('Disponibilité sans horodatage de vérification : non servie.');
  }
  if (poi.price !== null && (!poi.currency || poi.currency.length !== 3)) {
    reasons.push('Prix sans devise ISO 4217 : refusé.');
  }
  return { valid: reasons.length === 0, reasons };
}

/** Contrat affiliation : URL https + divulgation explicite « lien affilié ». */
export function validateAffiliateRecord(poi: NormalizedPoi): PoiRecordValidation {
  const reasons: string[] = [];
  if (poi.kind !== 'affiliate_link') {
    reasons.push('Nature inattendue : lien affilié requis.');
  }
  if (!poi.affiliateTargetUrl || !poi.affiliateTargetUrl.startsWith('https://')) {
    reasons.push('Lien affilié sans URL cible HTTPS.');
  }
  if (!poi.affiliateDisclosure || poi.affiliateDisclosure.trim().length === 0) {
    reasons.push('Lien affilié sans mention de divulgation : exposition interdite.');
  }
  return { valid: reasons.length === 0, reasons };
}

export interface PoiSplit {
  geographic: NormalizedPoi[];
  commercialOffers: NormalizedPoi[];
  affiliateLinks: NormalizedPoi[];
  rejected: { poi: NormalizedPoi; reasons: string[] }[];
  /** Le drapeau servi : vrai uniquement pour un lien affilié valide et divulgué. */
  hasAffiliateLink: boolean;
}

export function splitPoiInventory(pois: readonly NormalizedPoi[]): PoiSplit {
  const geographic: NormalizedPoi[] = [];
  const commercialOffers: NormalizedPoi[] = [];
  const affiliateLinks: NormalizedPoi[] = [];
  const rejected: { poi: NormalizedPoi; reasons: string[] }[] = [];

  for (const poi of pois) {
    if (poi.kind === 'geographic') {
      if (poi.category === null) {
        rejected.push({ poi, reasons: ['Catégorie géographique absente.'] });
      } else {
        geographic.push(poi);
      }
      continue;
    }
    if (poi.kind === 'commercial_offer') {
      const validation = validateOfferRecord(poi);
      if (validation.valid) commercialOffers.push(poi);
      else rejected.push({ poi, reasons: validation.reasons });
      continue;
    }
    const validation = validateAffiliateRecord(poi);
    if (validation.valid) affiliateLinks.push(poi);
    else rejected.push({ poi, reasons: validation.reasons });
  }

  return {
    geographic,
    commercialOffers,
    affiliateLinks,
    rejected,
    hasAffiliateLink: affiliateLinks.length > 0,
  };
}
