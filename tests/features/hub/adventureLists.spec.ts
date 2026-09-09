import { describe, it, expect } from 'vitest';
import {
  adventureKey,
  groupAdventures,
  filterAdventures,
  resolveAdventureHref,
  shouldToggleSwitcher,
  consumeSwitcherAutoOpen,
  isHubSurfacePathname,
  HUB_SWITCHER_AUTOPEN_KEY,
  type AdventureEntry,
} from '@/features/hub/context/adventureLists';

/**
 * H2.1 — Tests des helpers purs du sélecteur, ÉCRITS AVANT L'IMPLÉMENTATION.
 * Toute la logique testable de l'AdventureSwitcher vit ici (pas de RTL).
 */

const TRIPS = [
  { id: 't1', slug: 'gr20', title: 'GR20 Corse', status: 'planned', primary_activity: 'trekking' },
  { id: 't2', slug: 'vanlife', title: 'Vanlife Portugal', status: 'done', primary_activity: 'roadtrip' },
];
const GROUPS = [{ id: 'g1', name: 'Alpes Team', member_count: 4, my_role: 'owner' }];
const CREWS = [
  {
    id: 'c1',
    name: 'Équipage Sud',
    slug: 'equipage-sud',
    member_count: 3,
    active_trips_count: 1,
    next_trip: { slug: 'mercanteur', title: 'Mercantour' },
  },
];
const POSSESSION = { itemsCount: 12, loansCount: 1, alertsCount: 2 };

describe('H2 — adventureKey : identité stable', () => {
  it('KEY-1: possession = "possession"', () => {
    expect(adventureKey({ nature: 'possession', itemsCount: 0, loansCount: 0, alertsCount: 0 })).toBe('possession');
  });

  it('KEY-2: sortie = sortie:slug', () => {
    expect(adventureKey({ nature: 'sortie', id: 't1', slug: 'gr20', title: 'x' })).toBe('sortie:gr20');
  });

  it('KEY-3: collectif = collectif:kind:id', () => {
    expect(
      adventureKey({ nature: 'collectif', kind: 'groupe', id: 'g1', title: 'x', membersCount: 1, subtitle: '', linkedTripSlug: null }),
    ).toBe('collectif:groupe:g1');
    expect(
      adventureKey({ nature: 'collectif', kind: 'equipage', id: 'c1', title: 'x', membersCount: 1, subtitle: '', linkedTripSlug: null }),
    ).toBe('collectif:equipage:c1');
  });
});

describe('H2 — groupAdventures : 3 natures groupées', () => {
  it('GRP-1: possession toujours présente même à zéro', () => {
    const g = groupAdventures([], [], [], { itemsCount: 0, loansCount: 0, alertsCount: 0 });
    expect(g.possession).toHaveLength(1);
    expect(g.sorties).toEqual([]);
    expect(g.collectifs).toEqual([]);
  });

  it('GRP-2: sorties dans l’ordre reçu', () => {
    const g = groupAdventures(TRIPS, [], [], POSSESSION);
    expect(g.sorties.map((s) => s.slug)).toEqual(['gr20', 'vanlife']);
  });

  it('GRP-3: groupes puis équipages, sous-titres de contexte', () => {
    const g = groupAdventures([], GROUPS, CREWS, POSSESSION);
    expect(g.collectifs.map((c) => c.kind)).toEqual(['groupe', 'equipage']);
    expect(g.collectifs[0].subtitle).toMatch(/4 membre/);
    expect(g.collectifs[1].subtitle).toMatch(/3 membre/);
    expect(g.collectifs[1].subtitle).toMatch(/1 voyage/);
    expect(g.collectifs[1].linkedTripSlug).toBe('mercanteur');
  });

  it('GRP-4: équipage sans voyage lié = linkedTripSlug null', () => {
    const g = groupAdventures([], [], [{ ...CREWS[0], active_trips_count: 0, next_trip: null }], POSSESSION);
    expect(g.collectifs[0].linkedTripSlug).toBeNull();
    expect(g.collectifs[0].subtitle).not.toMatch(/voyage/);
  });
});

describe('H2 — filterAdventures : recherche', () => {
  const full = groupAdventures(TRIPS, GROUPS, CREWS, POSSESSION);

  it('FIL-1: query vide = identité', () => {
    expect(filterAdventures(full, '')).toEqual(full);
    expect(filterAdventures(full, '   ')).toEqual(full);
  });

  it('FIL-2: filtre insensible à la casse (titre, statut, activité)', () => {
    expect(filterAdventures(full, 'gr20').sorties).toHaveLength(1);
    expect(filterAdventures(full, 'ROADTRIP').sorties.map((s) => s.slug)).toEqual(['vanlife']);
    expect(filterAdventures(full, 'alpes').collectifs.map((c) => c.title)).toEqual(['Alpes Team']);
  });

  it('FIL-3: possession conservée sur requête vide ou match matériel', () => {
    expect(filterAdventures(full, 'zzz').possession).toHaveLength(0);
    expect(filterAdventures(full, 'matériel').possession).toHaveLength(1);
    expect(filterAdventures(full, 'materiel').possession).toHaveLength(1);
  });

  it('FIL-4: cap 8 par groupe', () => {
    const many = Array.from({ length: 20 }, (_, i) => ({ id: `t${i}`, slug: `s${i}`, title: `Voyage ${i}` }));
    const g = groupAdventures(many, [], [], POSSESSION);
    expect(filterAdventures(g, 'voyage').sorties).toHaveLength(8);
  });
});

describe('H2 — resolveAdventureHref : restauration dernière section', () => {
  const none = () => null;

  it('HREF-1: possession sans mémoire = /hub/inventaire', () => {
    const e: AdventureEntry = { nature: 'possession', itemsCount: 1, loansCount: 0, alertsCount: 0 };
    expect(resolveAdventureHref(e, none)).toBe('/hub/inventaire');
  });

  it('HREF-2: possession avec mémoire valide = section mémorisée', () => {
    const e: AdventureEntry = { nature: 'possession', itemsCount: 1, loansCount: 0, alertsCount: 0 };
    expect(resolveAdventureHref(e, () => 'alertes')).toBe('/hub/alertes');
  });

  it('HREF-3: mémoire d’une autre nature = fallback (jamais d’URL cassée)', () => {
    const e: AdventureEntry = { nature: 'possession', itemsCount: 1, loansCount: 0, alertsCount: 0 };
    expect(resolveAdventureHref(e, () => 'budget')).toBe('/hub/inventaire');
    const c: AdventureEntry = { nature: 'collectif', kind: 'groupe', id: 'g', title: 't', membersCount: 1, subtitle: '', linkedTripSlug: null };
    expect(resolveAdventureHref(c, () => 'inventaire')).toBe('/hub/groupe');
  });

  it('HREF-4: sortie = sections hub + mémoire (Étape 2 — hub unique)', () => {
    const e: AdventureEntry = { nature: 'sortie', id: 't1', slug: 'gr20', title: 'x' };
    expect(resolveAdventureHref(e, none)).toBe('/hub');
    expect(resolveAdventureHref(e, () => 'itinerary')).toBe('/hub/itineraire');
    expect(resolveAdventureHref(e, () => 'inventaire')).toBe('/hub');
  });

  it('HREF-5: collectif avec mémoire valide', () => {
    const e: AdventureEntry = { nature: 'collectif', kind: 'equipage', id: 'c', title: 't', membersCount: 1, subtitle: '', linkedTripSlug: null };
    expect(resolveAdventureHref(e, none)).toBe('/hub/groupe');
    expect(resolveAdventureHref(e, () => 'invitations')).toBe('/hub/invitations');
  });
});

describe('H2 — shouldToggleSwitcher : clavier', () => {
  it('KBD-1: Ctrl/Cmd+K ou J = toggle', () => {
    expect(shouldToggleSwitcher({ metaKey: true, ctrlKey: false, key: 'k' })).toBe(true);
    expect(shouldToggleSwitcher({ metaKey: false, ctrlKey: true, key: 'K' })).toBe(true);
    expect(shouldToggleSwitcher({ metaKey: true, ctrlKey: false, key: 'j' })).toBe(true);
    expect(shouldToggleSwitcher({ metaKey: false, ctrlKey: true, key: 'J' })).toBe(true);
  });

  it('KBD-2: sans modificateur ou autre touche = non', () => {
    expect(shouldToggleSwitcher({ metaKey: false, ctrlKey: false, key: 'k' })).toBe(false);
    expect(shouldToggleSwitcher({ metaKey: true, ctrlKey: false, key: 'x' })).toBe(false);
    expect(shouldToggleSwitcher({ metaKey: true, ctrlKey: false, key: 'Control' })).toBe(false);
  });
});

describe('H-AUTO-41 — surface hub + signal one-shot (appui long tab Hub)', () => {
  it('SURF-1: isHubSurfacePathname — racine, profonde, hors hub, null', () => {
    expect(isHubSurfacePathname('/hub')).toBe(true);
    expect(isHubSurfacePathname('/hub/kit')).toBe(true);
    expect(isHubSurfacePathname('/hub/inventaire')).toBe(true);
    expect(isHubSurfacePathname('/hub/')).toBe(true);
    expect(isHubSurfacePathname('/hubx')).toBe(false);
    expect(isHubSurfacePathname('/voyages/gr20')).toBe(false);
    expect(isHubSurfacePathname('/explorer')).toBe(false);
    expect(isHubSurfacePathname(null)).toBe(false);
    expect(isHubSurfacePathname(undefined)).toBe(false);
  });

  it('AUTO-1: consumeSwitcherAutoOpen lit puis retire le signal (one-shot)', () => {
    const store = new Map<string, string>();
    (globalThis as { sessionStorage?: unknown }).sessionStorage = {
      getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
      setItem: (k: string, v: string) => void store.set(k, v),
      removeItem: (k: string) => void store.delete(k),
    };
    try {
      expect(consumeSwitcherAutoOpen()).toBe(false);
      store.set(HUB_SWITCHER_AUTOPEN_KEY, '1');
      expect(consumeSwitcherAutoOpen()).toBe(true);
      expect(store.has(HUB_SWITCHER_AUTOPEN_KEY)).toBe(false);
      expect(consumeSwitcherAutoOpen()).toBe(false);
    } finally {
      delete (globalThis as { sessionStorage?: unknown }).sessionStorage;
    }
  });

  it('AUTO-2: storage indisponible = jamais de crash (repli navigation simple)', () => {
    (globalThis as { sessionStorage?: unknown }).sessionStorage = undefined;
    try {
      expect(consumeSwitcherAutoOpen()).toBe(false);
    } finally {
      delete (globalThis as { sessionStorage?: unknown }).sessionStorage;
    }
  });
});
