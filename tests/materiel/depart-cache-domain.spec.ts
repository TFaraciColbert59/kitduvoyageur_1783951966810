import { describe, it, expect } from 'vitest';
import {
  encodeDepartCache,
  decodeDepartCache,
} from '@/features/materiel/domain/departCache';

interface Payload {
  depart: { id: string };
  weather: null;
  cachedAt: number;
}

describe('departCache (pur)', () => {
  it('encodeDepartCache préfixe le payload avec la version v1', () => {
    expect(encodeDepartCache({ id: 'tmb-4j' })).toBe('v1:{"id":"tmb-4j"}');
  });

  it('decodeDepartCache(encodeDepartCache(x)) — round-trip', () => {
    const payload: Payload = { depart: { id: 'tmb-4j' }, weather: null, cachedAt: 42 };
    expect(decodeDepartCache<Payload>(encodeDepartCache(payload))).toEqual(payload);
  });

  it('decodeDepartCache refuse une version inconnue (v0)', () => {
    expect(decodeDepartCache('v0:{}')).toBeNull();
  });

  it('decodeDepartCache refuse un JSON invalide', () => {
    expect(decodeDepartCache('{invalid')).toBeNull();
    expect(decodeDepartCache('v1:{invalid')).toBeNull();
  });

  it('decodeDepartCache accepte null et renvoie null', () => {
    expect(decodeDepartCache(null)).toBeNull();
  });
});
