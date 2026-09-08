import { describe, it, expect } from 'vitest';
import {
  hubSectionRegistry,
  hubSectionHref,
  visibleHubSections,
} from '@/features/hub/registry/hubSectionRegistry';
import {
  hubWidgetRegistry,
  hubWidgetsForNature,
  hubEstimatedHeight,
  HUB_WIDGET_COLUMN_MAX_HEIGHT,
} from '@/features/hub/registry/hubWidgetRegistry';
import { HUB_SECTION_ORDER } from '@/features/hub/engine/hubProfileEngine';

/**
 * H1.2 — Tests des registres hub (chantier H), ÉCRITS AVANT L'IMPLÉMENTATION.
 * Source de vérité : docs/CHANTIER_H_HUB_VOYAGEUR.md §2.2 + plan H1.
 */

describe('H1 — hubSectionRegistry : source unique des sections', () => {
  it('REG-1: 19 ids uniques, dans l’ordre HUB_SECTION_ORDER', () => {
    const ids = hubSectionRegistry.map((s) => s.id);
    expect(new Set(ids).size).toBe(19);
    expect(ids).toEqual([...HUB_SECTION_ORDER]);
  });

  it('REG-2: chaque entrée a label, segment, icône et ≥1 nature', () => {
    for (const def of hubSectionRegistry) {
      expect(def.label.length, `${def.id} label`).toBeGreaterThan(0);
      expect(def.icon, `${def.id} icon`).toBeDefined();
      expect(def.natures.length, `${def.id} natures`).toBeGreaterThan(0);
    }
  });

  it('REG-3: href possession = /hub/<segment>', () => {
    expect(hubSectionHref({ nature: 'possession' }, 'kit')).toBe('/hub/kit');
    expect(hubSectionHref({ nature: 'possession' }, 'alertes')).toBe('/hub/alertes');
    expect(hubSectionHref({ nature: 'possession' }, 'inventaire')).toBe('/hub/inventaire');
  });

  it('REG-4: href sortie délègue au registre voyage (zéro duplication)', () => {
    expect(hubSectionHref({ nature: 'sortie', slug: 'gr20' }, 'itinerary')).toBe(
      '/voyages/gr20/itineraire',
    );
    expect(hubSectionHref({ nature: 'sortie', slug: 'gr20' }, 'overview')).toBe('/voyages/gr20');
  });

  it('REG-5: href sortie sans slug = erreur explicite', () => {
    expect(() => hubSectionHref({ nature: 'sortie' }, 'itinerary')).toThrow(/slug/);
  });

  it('REG-6: href nature incompatible = erreur explicite', () => {
    expect(() => hubSectionHref({ nature: 'possession' }, 'itinerary')).toThrow(/incompatible/);
    expect(() => hubSectionHref({ nature: 'collectif' }, 'budget')).toThrow(/incompatible/);
  });

  it('REG-7: href collectif = /hub/<segment>', () => {
    expect(hubSectionHref({ nature: 'collectif' }, 'groupe')).toBe('/hub/groupe');
    expect(hubSectionHref({ nature: 'collectif' }, 'invitations')).toBe('/hub/invitations');
  });

  it('REG-8: team partagée sortie+collectif (une seule source)', () => {
    const team = hubSectionRegistry.find((s) => s.id === 'team');
    expect(team?.natures).toEqual(['sortie', 'collectif']);
    expect(hubSectionHref({ nature: 'sortie', slug: 'x' }, 'team')).toBe('/voyages/x/equipage');
    expect(hubSectionHref({ nature: 'collectif' }, 'team')).toBe('/hub/equipage');
  });

  it('REG-9: visibleHubSections filtre par profil dans l’ordre', () => {    const defs = visibleHubSections({
      nature: 'possession',
      scale: null,
      party: 'solo',
      density: 'comfortable',
      sections: ['kit', 'inventaire', 'alertes'],
      widgets: [],
      reason: {} as never,
    });
    expect(defs.map((d) => d.id)).toEqual(['inventaire', 'kit', 'alertes']);
  });

  it('REG-10: sections cœur déclarées au registre (intégrité par nature)', () => {
    const coreOf = (id: string) =>
      hubSectionRegistry.find((s) => s.id === id)?.coreNatures ?? [];
    expect(coreOf('inventaire')).toEqual(['possession']);
    expect(coreOf('overview')).toEqual(['sortie']);
    expect(coreOf('safety')).toEqual(['sortie']);
    expect(coreOf('groupe')).toEqual(['collectif']);
    expect(coreOf('kit')).toEqual([]);
  });
});

describe('H1 — hubWidgetRegistry : budgets de hauteur', () => {
  it('WID-1: limite colonne = 1800 (2 × 900)', () => {
    expect(HUB_WIDGET_COLUMN_MAX_HEIGHT).toBe(1800);
  });

  it('WID-2: total par nature ≤ 1800 (contrainte Y)', () => {
    for (const nature of ['possession', 'sortie', 'collectif'] as const) {
      const ids = hubWidgetsForNature(nature);
      expect(hubEstimatedHeight(ids), `nature ${nature}`).toBeLessThanOrEqual(1800);
    }
  });

  it('WID-3: widgets sortie importés du registre voyage (mêmes ids, mêmes priorités)', () => {
    const ids = hubWidgetsForNature('sortie');
    expect(ids).toContain('countdown');
    expect(ids).toContain('primary-action');
    expect(ids[0]).toBe('countdown');
  });

  it('WID-4: widgets possession/collectif présents avec hauteurs > 0', () => {
    expect(hubWidgetsForNature('possession')).toEqual(
      expect.arrayContaining(['stock-apercu', 'alertes-materiel', 'dispo-apercu', 'prochain-depart']),
    );
    expect(hubWidgetsForNature('collectif')).toEqual(
      expect.arrayContaining(['invitations-apercu', 'presence-groupe', 'entrer-voyage']),
    );
    for (const w of hubWidgetRegistry) {
      expect(w.estimatedHeight, w.id).toBeGreaterThan(0);
    }
  });

  it('WID-5: compteurs du registre ne plantent jamais (données partielles)', () => {
    for (const def of hubSectionRegistry) {
      expect(() => def.counter({})).not.toThrow();
      const n = def.counter({});
      expect(n === null || (typeof n === 'number' && n >= 0)).toBe(true);
    }
  });
});
