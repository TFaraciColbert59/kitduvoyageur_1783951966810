import { describe, it, expect, vi } from 'vitest';
import {
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
      'lkdv_cache_boutique',
      'lkdv-critical-query:aaa',
      'lkdv_recent_searches',
      'lkdv_theme',
      'lkdv_cookie_consent',
      'lkdv_glass_intensity',
    ]);

    purgeClientStateOnUserChange('user-a', 'user-b', { localStorage: ls, indexedDB: null });

    expect(ls.has('kdv_cart')).toBe(false);
    expect(ls.has('kdv_wishlist')).toBe(false);
    expect(ls.has('lkdv_participants_state_v1')).toBe(false);
    expect(ls.has('lkdv_adventure_prep_v3')).toBe(false);
    expect(ls.has('lkdv_compte_cache_profile_aaa')).toBe(false);
    expect(ls.has('lkdv_compte_cache_dashboard_aaa')).toBe(false);
    expect(ls.has('lkdv:offline:trip:mont-blanc')).toBe(false);
    expect(ls.has('lkdv_cache_boutique')).toBe(false);
    expect(ls.has('lkdv-critical-query:aaa')).toBe(false);
    expect(ls.has('lkdv_recent_searches')).toBe(false);

    expect(ls.has('lkdv_theme')).toBe(true);
    expect(ls.has('lkdv_cookie_consent')).toBe(true);
    expect(ls.has('lkdv_glass_intensity')).toBe(true);
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

  it('déconnexion (précédent A, courant null) : purge déclenchée', () => {
    const ls = createStorage(['kdv_cart']);
    purgeClientStateOnUserChange('user-a', null, { localStorage: ls, indexedDB: null });
    expect(ls.has('kdv_cart')).toBe(false);
  });

  it('aucun changement (même utilisateur) : no-op', () => {
    const ls = createStorage(['kdv_cart']);
    const idb = createIdb();
    purgeClientStateOnUserChange('user-a', 'user-a', { localStorage: ls, indexedDB: idb });
    expect(ls.has('kdv_cart')).toBe(true);
    expect(idb.deleted).toEqual([]);
  });

  it('premier passage (précédent undefined) : no-op', () => {
    const ls = createStorage(['kdv_cart']);
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
