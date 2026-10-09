import { describe, it, expect, vi } from 'vitest';
import {
  decidePurgeOnAuth,
  purgeClientStateOnUserChange,
  type PurgeStorageLike,
} from '@/lib/security/purgeClientState';

function createStorage(initial: string[]): PurgeStorageLike & { has(key: string): boolean } {
  const store = new Set(initial);
  return {
    get length() {
      return store.size;
    },
    key(index: number) {
      return Array.from(store)[index] ?? null;
    },
    removeItem(key: string) {
      store.delete(key);
    },
    has(key: string) {
      return store.has(key);
    },
  };
}

function createIdb() {
  const deleted: string[] = [];
  return {
    deleted,
    deleteDatabase(name: string) {
      deleted.push(name);
      return undefined;
    },
  };
}

describe('decidePurgeOnAuth — transitions de compte (F-011)', () => {
  it('première connexion connue : aucune purge', () => {
    expect(decidePurgeOnAuth(null, 'user-a')).toBe('none');
  });

  it('déconnexion (courant null) : aucune purge, mémoire conservée', () => {
    expect(decidePurgeOnAuth('user-a', null)).toBe('none');
  });

  it('reconnexion du même compte (y compris après déconnexion) : aucune purge', () => {
    expect(decidePurgeOnAuth('user-a', 'user-a')).toBe('none');
  });

  it('changement de compte A→B : purge', () => {
    expect(decidePurgeOnAuth('user-a', 'user-b')).toBe('purge');
  });

  it('session persistée différente au démarrage (A stocké, B connecté) : purge', () => {
    expect(decidePurgeOnAuth('user-a', 'user-b')).toBe('purge');
  });
});

describe('purgeClientStateOnUserChange — isolation inter-comptes (F-011)', () => {
  it('purge les clés privées exactes et préfixées, garde les préférences d’appareil', () => {
    const ls = createStorage([
      'kdv_cart',
      'kdv_wishlist',
      'lkdv_participants_state_v1',
      'lkdv_adventure_prep_v3',
      'lkdv_compte_cache_profile_aaa',
      'lkdv_compte_cache_dashboard_aaa',
      'lkdv:offline:trip:mont-blanc',
      'lkdv:offline:manifest',
      'lkdv_offline_reports_queue',
      'lkdv_offline_decisions_queue',
      'lkdv_cache_boutique',
      'lkdv-critical-query:aaa',
      'lkdv_active_trip:aaa',
      'lkdv_user_trips_cache:aaa',
      'lkdv_trip_last_section:aaa',
      'lkdv_active_adventure:aaa',
      'lkdv_hub_adventures_cache:aaa',
      'lkdv_adventure_last_section:aaa',
      'lkdv_recent_searches',
      'lkdv-depart-order',
      'lkdv-kits-cockpit-order',
      'lkdv-materiel-cockpit-order-v3',
      'lkdv_pref_theme',
      'lkdv_theme',
      'lkdv_cookie_consent',
      'lkdv_glass_intensity',
      'lkdv_last_authed_user',
    ]);

    purgeClientStateOnUserChange('user-a', 'user-b', { localStorage: ls, indexedDB: null });

    for (const purged of [
      'kdv_cart',
      'kdv_wishlist',
      'lkdv_participants_state_v1',
      'lkdv_adventure_prep_v3',
      'lkdv_compte_cache_profile_aaa',
      'lkdv_compte_cache_dashboard_aaa',
      'lkdv:offline:trip:mont-blanc',
      'lkdv:offline:manifest',
      'lkdv_offline_reports_queue',
      'lkdv_offline_decisions_queue',
      'lkdv_cache_boutique',
      'lkdv-critical-query:aaa',
      'lkdv_active_trip:aaa',
      'lkdv_user_trips_cache:aaa',
      'lkdv_trip_last_section:aaa',
      'lkdv_active_adventure:aaa',
      'lkdv_hub_adventures_cache:aaa',
      'lkdv_adventure_last_section:aaa',
      'lkdv_recent_searches',
    ]) {
      expect(ls.has(purged), purged).toBe(false);
    }

    for (const preserved of [
      'lkdv-depart-order',
      'lkdv-kits-cockpit-order',
      'lkdv-materiel-cockpit-order-v3',
      'lkdv_pref_theme',
      'lkdv_theme',
      'lkdv_cookie_consent',
      'lkdv_glass_intensity',
      'lkdv_last_authed_user',
    ]) {
      expect(ls.has(preserved), preserved).toBe(true);
    }
  });

  it('purge sessionStorage et supprime les bases IndexedDB connues + celle du compte précédent', () => {
    const ls = createStorage([]);
    const ss = createStorage(['lkdv_hub_switcher_autopen', 'autre_clef']);
    const idb = createIdb();

    purgeClientStateOnUserChange('user-a', 'user-b', {
      localStorage: ls,
      sessionStorage: ss,
      indexedDB: idb,
    });

    expect(ss.has('lkdv_hub_switcher_autopen')).toBe(false);
    expect(ss.has('autre_clef')).toBe(true);

    expect(idb.deleted).toContain('lkdv-trips');
    expect(idb.deleted).toContain('lkdv-trip-sync');
    expect(idb.deleted).toContain('lkdv-materiel');
    expect(idb.deleted).toContain('lkdv-cache');
    expect(idb.deleted).toContain('lkdv-local-vault');
    expect(idb.deleted).toContain('lkdv-adventure-offline-v2-user-a');
  });

  it('même utilisateur : no-op', () => {
    const ls = createStorage(['kdv_cart']);
    const idb = createIdb();
    purgeClientStateOnUserChange('user-a', 'user-a', { localStorage: ls, indexedDB: idb });
    expect(ls.has('kdv_cart')).toBe(true);
    expect(idb.deleted).toEqual([]);
  });

  it('déconnexion seule (courant null) : no-op', () => {
    const ls = createStorage(['kdv_cart']);
    purgeClientStateOnUserChange('user-a', null, { localStorage: ls, indexedDB: null });
    expect(ls.has('kdv_cart')).toBe(true);
  });

  it('premier passage (précédent null/undefined) : no-op', () => {
    const ls = createStorage(['kdv_cart']);
    purgeClientStateOnUserChange(null, 'user-b', { localStorage: ls, indexedDB: null });
    purgeClientStateOnUserChange(undefined, 'user-b', { localStorage: ls, indexedDB: null });
    expect(ls.has('kdv_cart')).toBe(true);
  });

  it('environnement sans storage : aucun throw', () => {
    expect(() =>
      purgeClientStateOnUserChange('a', 'b', { localStorage: null, sessionStorage: null, indexedDB: null })
    ).not.toThrow();
  });

  it('deleteDatabase en échec : ne casse pas la purge', () => {
    const ls = createStorage(['kdv_cart']);
    const idb = {
      deleteDatabase: vi.fn(() => {
        throw new Error('idb indisponible');
      }),
    };
    expect(() =>
      purgeClientStateOnUserChange('a', 'b', { localStorage: ls, indexedDB: idb })
    ).not.toThrow();
    expect(ls.has('kdv_cart')).toBe(false);
  });
});
