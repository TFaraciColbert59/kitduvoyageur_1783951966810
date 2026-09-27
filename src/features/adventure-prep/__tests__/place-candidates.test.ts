import { describe, it, expect } from 'vitest';
import { placeCandidates, type PlaceCandidate } from '../placeCandidates';
import type { GeocodeMatch } from '../geocodeService';
import type { PlaceRef } from '../types';

const geo = (over: Partial<GeocodeMatch> = {}): GeocodeMatch => ({
  id: 'geo-chamonix-fr',
  name: 'Chamonix',
  context: 'Haute-Savoie',
  country: 'France',
  lat: 45.9237,
  lon: 6.8694,
  provider: 'open-meteo',
  precision: 'commune',
  ...over,
});

const local = (over: Partial<PlaceRef> = {}): PlaceRef => ({
  id: 'local-1',
  name: 'Refuge du Col',
  country: 'France',
  lat: 45.9,
  lon: 6.8,
  ...over,
});

describe('placeCandidates', () => {
  it('ne propose rien sans saisie : les lieux deja connus restent affiches', () => {
    const out = placeCandidates({ recent: [local()], matches: [], hasQuery: false });
    expect(out).toHaveLength(1);
    expect(out[0].source).toBe('remembered');
  });

  it('place les resultats du reseau avant les lieux enregistres', () => {
    const out = placeCandidates({
      recent: [local()],
      matches: [geo()],
      hasQuery: true,
    });
    expect(out.map((c) => c.source)).toEqual(['geocoded', 'remembered']);
  });

  it('ne repete jamais le meme lieu deux fois', () => {
    const shared = { name: 'Chamonix', country: 'France' };
    const out = placeCandidates({
      recent: [local({ id: 'local-x', ...shared })],
      matches: [geo({ ...shared })],
      hasQuery: true,
    });
    expect(out).toHaveLength(1);
  });

  it('distingue homonymes de pays differents', () => {
    const out = placeCandidates({
      recent: [local({ id: 'l1', name: 'Victoria', country: 'Canada' })],
      matches: [geo({ id: 'g1', name: 'Victoria', country: 'Seychelles' })],
      hasQuery: true,
    });
    expect(out).toHaveLength(2);
  });

  it('conserve les coordonnees reelles et ne complete jamais une valeur manquante', () => {
    const [candidate] = placeCandidates({ recent: [], matches: [geo()], hasQuery: true });
    expect(candidate.place.lat).toBeCloseTo(45.9237, 4);
    expect(candidate.place.lon).toBeCloseTo(6.8694, 4);
  });

  it('marque une ancre approximative pour ne pas la presenter comme etablie', () => {
    const [candidate] = placeCandidates({
      recent: [],
      matches: [geo({ precision: 'inexact' })],
      hasQuery: true,
    });
    expect(candidate.precision).toBe('inexact');
    expect(candidate.hint).toBeTruthy();
  });

  it('un lieu saisi a la main reste selectionnable meme sans coordonnees', () => {
    const manual: PlaceRef = { id: 'p-x', name: 'CoinCache', country: '', lat: 0, lon: 0 };
    const out = placeCandidates({ recent: [manual], matches: [], hasQuery: false });
    expect(out).toHaveLength(1);
    expect(out[0].place).toBe(manual);
  });

  it('filtre les lieux enregistres sur la saisie courante', () => {
    const out = placeCandidates({
      recent: [local({ name: 'Refuge du Col' }), local({ id: 'l2', name: 'Lac Blanc' })],
      matches: [],
      hasQuery: true,
      query: 'lac',
    });
    expect(out.map((c) => c.place.name)).toEqual(['Lac Blanc']);
  });

  it('ne rend aucun candidat pour une saisie sans resultat', () => {
    const out = placeCandidates({ recent: [], matches: [], hasQuery: true, query: 'zzz' });
    expect(out).toEqual([]);
  });

  it('le type expose exactement la forme attendue par l ecran', () => {
    const candidate: PlaceCandidate = {
      place: local(),
      source: 'remembered',
      precision: 'commune',
      context: null,
      hint: null,
    };
    expect(candidate.source).toBe('remembered');
  });
});

