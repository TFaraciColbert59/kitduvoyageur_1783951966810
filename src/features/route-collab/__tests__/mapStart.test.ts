import { describe, expect, it } from 'vitest';
import {
  HIKING_ZOOM,
  MIN_ADD_ZOOM,
  NEUTRAL_LANDMARK,
  addPointGate,
  countUnverified,
  describeRoutingFailure,
  isUnverifiedSection,
  readLastKnown,
  startView,
  writeLastKnown,
} from '../mapStart';

describe('cadrage de départ de la carte', () => {
  it('le premier point du tracé prime, puis l’ancre du voyage, puis la dernière position, puis le repère neutre', () => {
    const first = { lon: 6, lat: 45 };
    const anchor = { lon: 7, lat: 44 };
    const last = { lon: 8, lat: 43 };
    expect(startView({ first, anchor, lastKnown: last })).toEqual({ center: [6, 45], zoom: HIKING_ZOOM, kind: 'track' });
    expect(startView({ anchor, lastKnown: last }).kind).toBe('trip');
    expect(startView({ lastKnown: last })).toEqual({ center: [8, 43], zoom: HIKING_ZOOM, kind: 'last-known' });
    const neutral = startView({});
    expect(neutral.kind).toBe('neutral');
    expect(neutral.center).toEqual([NEUTRAL_LANDMARK[0], NEUTRAL_LANDMARK[1]]);
    expect(neutral.zoom).toBeGreaterThanOrEqual(MIN_ADD_ZOOM);
  });

  it('refuse une coordonnée non finie (garde null) et retombe sur le cas suivant', () => {
    expect(startView({ first: { lon: NaN, lat: 1 }, anchor: null }).kind).toBe('neutral');
  });

  it('la dernière position connue se relit, arrondie, et une valeur corrompue est ignorée', () => {
    const store = new Map<string, string>();
    const storage = { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v) };
    expect(readLastKnown(storage)).toBeNull();
    writeLastKnown(storage, { lon: 2.349912, lat: 48.85341 });
    expect(readLastKnown(storage)).toEqual({ lon: 2.3499, lat: 48.8534 });
    store.set([...store.keys()][0], '{"lon":999,"lat":1}');
    expect(readLastKnown(storage)).toBeNull();
    store.set([...store.keys()][0], 'pas du json');
    expect(readLastKnown(storage)).toBeNull();
  });
});

describe('garde de pose', () => {
  it('sous le zoom minimal, on zoome au lieu de poser ; à partir de 9, on pose', () => {
    const low = addPointGate(MIN_ADD_ZOOM - 0.1);
    expect(low.ok).toBe(false);
    if (!low.ok) {
      expect(low.zoomTo).toBe(HIKING_ZOOM);
      expect(low.message).toMatch(/zoome/i);
    }
    expect(addPointGate(MIN_ADD_ZOOM).ok).toBe(true);
    expect(addPointGate(14).ok).toBe(true);
    expect(addPointGate(undefined).ok).toBe(true);
  });
});

describe('tronçon non calculé', () => {
  const sec = (mode: 'routed' | 'manual', provider: string | null, confidence: 'verified' | 'estimated') => ({
    mode,
    provenance: { provider, calculatedAt: null, profile: 'marche' as const, confidence },
  });
  it('seule une ligne droite routée sans fournisseur ni vérification est « non vérifiée »', () => {
    expect(isUnverifiedSection(sec('routed', null, 'estimated'))).toBe(true);
    expect(isUnverifiedSection(sec('routed', 'valhalla', 'verified'))).toBe(false);
    expect(isUnverifiedSection(sec('manual', null, 'estimated'))).toBe(false);
    expect(countUnverified([sec('routed', null, 'estimated'), sec('routed', 'valhalla', 'verified')])).toBe(1);
  });
  it('dit l’erreur réelle du routeur, sans l’inventer', () => {
    const r = describeRoutingFailure({ status: 503, reason: 'provider_unavailable' });
    expect(r.detail).toBe('HTTP 503 · provider_unavailable');
    expect(r.text).toMatch(/^Tronçon non calculé/);
    expect(describeRoutingFailure({ status: 503, reason: 'off_network' }).text).toMatch(/atteignable/);
    expect(describeRoutingFailure({ network: true }).detail).toBe('réseau injoignable');
    expect(describeRoutingFailure({ status: 418, reason: null }).detail).toBe('HTTP 418');
  });
});
