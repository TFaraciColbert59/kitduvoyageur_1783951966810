import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import {
  attachRouteToSegments,
  distancePointToSegmentM,
} from '../../scripts/coverage/segmentAttach';
import {
  classifyOsmTags,
  validateAffiliateRecord,
  validateOfferRecord,
  splitPoiInventory,
} from '../../scripts/coverage/poiImport';
import { normalizePoiRecords } from '../../scripts/coverage/normalize';
import type { NormalizedRoute } from '../../scripts/coverage/types';

const FIXTURES = path.join(__dirname, 'fixtures');

describe('Phase 4 — rattachement segments (étape 7)', () => {
  const segment = {
    id: 42,
    points: [
      { lat: 45.0, lng: 6.0 },
      { lat: 45.05, lng: 6.1 },
      { lat: 45.0, lng: 6.2 },
    ],
  };

  it('mesure une distance point-segment nulle sur le segment', () => {
    const distance = distancePointToSegmentM({ lat: 45.0, lng: 6.0 }, segment.points[0], segment.points[1]);
    expect(distance).toBeLessThan(1);
  });

  it('rattache les points proches et signale les points distants', () => {
    const route: NormalizedRoute = {
      externalId: 'r1',
      name: 'Boucle de test',
      source: 'fixture',
      points: [
        { lat: 45.0, lng: 6.0 },
        { lat: 45.001, lng: 6.001 },
        { lat: 48.0, lng: 2.0 },
      ],
      tags: {},
    };
    const attachment = attachRouteToSegments(route, [segment], 75);
    expect(attachment.segmentIds).toEqual([42]);
    expect(attachment.matchedPoints).toBe(2);
    expect(attachment.unmatchedPoints).toBe(1);
    expect(attachment.matchRatio).toBeCloseTo(0.667, 2);
  });
});

describe('Phase 4 — classification POI (étape 8)', () => {
  it('classe eau, refuge, abri, secours et restriction', () => {
    expect(classifyOsmTags({ amenity: 'drinking_water' }).category).toBe('water');
    expect(classifyOsmTags({ tourism: 'alpine_hut' }).category).toBe('refuge');
    expect(classifyOsmTags({ amenity: 'shelter' }).category).toBe('shelter');
    expect(classifyOsmTags({ emergency: 'rescue_station' }).category).toBe('rescue');
    expect(classifyOsmTags({ access: 'private' }).category).toBe('restriction');
    expect(classifyOsmTags({ amenity: 'restaurant' }).category).toBe('food');
    expect(classifyOsmTags({ railway: 'station' }).category).toBe('transport');
    expect(classifyOsmTags({ tourism: 'hotel' }).category).toBe('lodging');
    expect(classifyOsmTags({ natural: 'peak' }).category).toBe('summit');
  });

  it('ne range jamais un tag inconnu dans une catégorie approximative', () => {
    const result = classifyOsmTags({ amenity: 'quai_de_bac' });
    expect(result.category).toBe('unknown');
    expect(result.reasons.length).toBeGreaterThan(0);
  });
});

describe('Phase 4 — séparation POI / offres / affiliation', () => {
  function loadPois() {
    const raw = JSON.parse(readFileSync(path.join(FIXTURES, 'pois.json'), 'utf8')) as unknown;
    return normalizePoiRecords(raw);
  }

  it('rejette un POI sans source lors de la normalisation', () => {
    const result = loadPois();
    expect(result.errors.some((error) => error.includes('source obligatoire'))).toBe(true);
    expect(result.items.every((poi) => poi.id !== 'g-nosource')).toBe(true);
  });

  it('rejette une catégorie inconnue lors de la normalisation', () => {
    const result = loadPois();
    expect(result.errors.some((error) => error.includes('catégorie inconnue'))).toBe(true);
    expect(result.items.every((poi) => poi.id !== 'g-unknown')).toBe(true);
  });

  it('refuse un prix sans horodatage et expose la raison', () => {
    const result = loadPois();
    const offer = result.items.find((poi) => poi.id === 'o2');
    expect(offer).toBeDefined();
    const validation = validateOfferRecord(offer!);
    expect(validation.valid).toBe(false);
    expect(validation.reasons.join(' ')).toContain('horodatage');
  });

  it('accepte une offre avec prix et disponibilité horodatés', () => {
    const result = loadPois();
    const offer = result.items.find((poi) => poi.id === 'o1');
    expect(offer).toBeDefined();
    expect(validateOfferRecord(offer!).valid).toBe(true);
  });

  it('refuse un lien affilié HTTP ou sans divulgation', () => {
    const result = loadPois();
    const affiliate = result.items.find((poi) => poi.id === 'a2');
    expect(affiliate).toBeDefined();
    const validation = validateAffiliateRecord(affiliate!);
    expect(validation.valid).toBe(false);
    expect(validation.reasons.join(' ')).toContain('divulgation');
  });

  it('sépare les trois natures et expose le drapeau affilié', () => {
    const result = loadPois();
    const split = splitPoiInventory(result.items);
    expect(split.geographic.length).toBe(2);
    expect(split.commercialOffers.length).toBe(1);
    expect(split.affiliateLinks.length).toBe(1);
    expect(split.rejected.length).toBe(2);
    expect(split.hasAffiliateLink).toBe(true);
  });
});
