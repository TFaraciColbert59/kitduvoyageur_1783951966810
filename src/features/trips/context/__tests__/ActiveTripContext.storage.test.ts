import { describe, expect, it } from 'vitest';
import { clearPrivateContextStorage, tripStorageKey } from '../ActiveTripContext';

describe('tripStorageKey', () => {
  it('separates private trip data for different accounts', () => {
    expect(tripStorageKey('lkdv_active_trip', 'alice')).not.toBe(tripStorageKey('lkdv_active_trip', 'bob'));
  });

  it('does not provide a private key before authentication', () => {
    expect(tripStorageKey('lkdv_active_trip', null)).toBeNull();
  });
});

describe('clearPrivateContextStorage', () => {
  it('clears the previous account trip and adventure caches without deleting the next account data', () => {
    const values = new Map<string, string>([
      ['lkdv_active_trip:alice', 'old trip'],
      ['lkdv_user_trips_cache:alice', 'old trips'],
      ['lkdv_trip_last_section:alice', 'old section'],
      ['lkdv_active_adventure:alice', 'old adventure'],
      ['lkdv_hub_adventures_cache:alice', 'old groups'],
      ['lkdv_adventure_last_section:alice', 'old hub section'],
      ['lkdv_active_trip:bob', 'new trip'],
    ]);
    clearPrivateContextStorage('alice', { removeItem: (key) => { values.delete(key); } });
    expect([...values]).toEqual([['lkdv_active_trip:bob', 'new trip']]);
  });

  it('discards legacy unscoped keys without touching account-scoped data', () => {
    const values = new Map<string, string>([
      ['lkdv_active_trip', 'legacy trip'],
      ['lkdv_active_adventure', 'legacy adventure'],
      ['lkdv_active_trip:alice', 'current trip'],
    ]);
    clearPrivateContextStorage(null, { removeItem: (key) => { values.delete(key); } });
    expect([...values]).toEqual([['lkdv_active_trip:alice', 'current trip']]);
  });
});
