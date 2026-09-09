import { describe, it, expect } from 'vitest';
import {
  widgetCatalog,
  selectWidgets,
  catalogWidgetDef,
  type WidgetConditionContext,
  type ActivityBlockId,
} from '@/features/hub/registry/widgetCatalog';
import type { ActivityType } from '@/features/hub/engine/activityTypes';
import type { HubWidgetId } from '@/features/hub/engine/hubProfileEngine';

/**
 * H-ACT §2 — Catalogue central de widgets + sélection.
 */

function ctx(overrides: Partial<WidgetConditionContext> = {}): WidgetConditionContext {
  return {
    activity: 'travel',
    party: 'solo',
    hasSteps: false,
    hasItems: false,
    hasExpenses: false,
    hasDocuments: false,
    hasNotes: false,
    hasPois: false,
    hasSafety: false,
    hasRoute: false,
    hasWeather: false,
    hasBudget: false,
    hasDates: false,
    hasCountry: false,
    crewMemberCount: 0,
    pendingInvites: 0,
    waterPointsCount: 0,
    ...overrides,
  };
}

describe('H-ACT — widgetCatalog : déclarations complètes', () => {
  it('CAT-1: chaque widget déclare activité, données, priorité, position, condition, action', () => {
    for (const w of widgetCatalog) {
      expect(typeof w.id).toBe('string');
      expect(typeof w.label).toBe('string');
      expect(Array.isArray(w.requiredData)).toBe(true);
      expect(typeof w.priority).toBe('number');
      expect(['overview', 'sidebar']).toContain(w.position);
      expect(typeof w.condition).toBe('function');
    }
  });

  it('CAT-2: le bloc Groupe est universel (toutes activités)', () => {
    const g = catalogWidgetDef('groupe-bloc')!;
    expect(g.activities).toBe('all');
    expect(g.position).toBe('overview');
  });

  it('CAT-3: les blocs randonnée sont marqués hiking, voyage travel', () => {
    const hiking = ['cta-randonnee-active', 'parcours-apercu', 'meteo-rando', 'points-passage'];
    const travel = ['reservations'];
    for (const id of hiking as ActivityBlockId[]) {
      expect(catalogWidgetDef(id)!.activities).toContain('hiking');
    }
    expect(catalogWidgetDef('reservations')!.activities).toContain('travel');
  });

  it('CAT-4: catalogWidgetDef inconnu -> undefined', () => {
    expect(catalogWidgetDef('nope' as ActivityBlockId)).toBeUndefined();
  });

  it('CAT-5: les 8 widgets de sidebar existants sont déclarés au catalogue central', () => {
    const sidebarIds = widgetCatalog.filter((w) => w.position === 'sidebar').map((w) => w.id);
    // 1 widget trip (déroulé du jour) + 7 widgets hub = 8
    expect(sidebarIds.length).toBe(8);
    expect(sidebarIds).toContain('steps-timeline');
    expect(sidebarIds).toContain('alertes-materiel');
    expect(sidebarIds).toContain('presence-groupe');
  });
});

describe('H-ACT — selectWidgets : composition par activité', () => {
  const hikingCtx = (extra: Partial<WidgetConditionContext> = {}) =>
    ctx({
      activity: 'hiking',
      hasSteps: true,
      hasDates: true,
      hasPois: true,
      hasWeather: true,
      crewMemberCount: 1,
      ...extra,
    });
  const travelCtx = (extra: Partial<WidgetConditionContext> = {}) =>
    ctx({ activity: 'travel', hasSteps: true, hasDates: true, hasBudget: true, hasDocuments: true, crewMemberCount: 1, ...extra });

  it('SEL-1: randonnée -> blocs hiking, PAS reservations voyage', () => {
    const { overview } = selectWidgets(hikingCtx(), []);
    const ids = overview.map((w) => w.id);
    expect(ids).toContain('cta-randonnee-active');
    expect(ids).toContain('parcours-apercu');
    expect(ids).toContain('meteo-rando');
    expect(ids).not.toContain('reservations');
  });

  it('SEL-2: voyage -> reservations, PAS blocs hiking', () => {
    const { overview } = selectWidgets(travelCtx(), []);
    const ids = overview.map((w) => w.id);
    expect(ids).toContain('reservations');
    expect(ids).not.toContain('cta-randonnee-active');
    expect(ids).not.toContain('parcours-apercu');
  });

  it('SEL-3: groupe-bloc présent dans les deux activités (universel)', () => {
    expect(selectWidgets(hikingCtx(), []).overview.some((w) => w.id === 'groupe-bloc')).toBe(true);
    expect(selectWidgets(travelCtx(), []).overview.some((w) => w.id === 'groupe-bloc')).toBe(true);
  });

  it('SEL-4: ordre par priorité décroissante (CTA en tête randonnée)', () => {
    const { overview } = selectWidgets(hikingCtx(), []);
    expect(overview[0].id).toBe('cta-randonnee-active');
    const priorities = overview.map((w) => w.priority);
    expect([...priorities].sort((a, b) => b - a)).toEqual(priorities);
  });

  it('SEL-5: météo masquée sans données weather', () => {
    const { overview } = selectWidgets(hikingCtx({ hasWeather: false }), []);
    expect(overview.some((w) => w.id === 'meteo-rando')).toBe(false);
  });

  it('SEL-6: points-passage masqués sans POI', () => {
    const { overview } = selectWidgets(hikingCtx({ hasPois: false }), []);
    expect(overview.some((w) => w.id === 'points-passage')).toBe(false);
  });

  it('SEL-8: points-eau visible uniquement avec des points d\'eau détectés', () => {
    const sans = selectWidgets(hikingCtx(), []).overview;
    expect(sans.some((w) => w.id === 'points-eau')).toBe(false);
    const avec = selectWidgets(hikingCtx({ waterPointsCount: 3 }), []).overview;
    expect(avec.some((w) => w.id === 'points-eau')).toBe(true);
  });

  it('SEL-7: sidebar filtrée par données (catalogue central)', () => {
    const ids: HubWidgetId[] = ['steps-timeline', 'alertes-materiel'];
    const { sidebar } = selectWidgets(hikingCtx(), ids);
    const sidebarIds = sidebar.map((w) => w.id);
    expect(sidebarIds).toContain('steps-timeline'); // toutes activités + hasSteps
    expect(sidebarIds).toContain('alertes-materiel'); // possession/collectif, aucune donnée requise
  });

  it('SEL-9: steps-timeline masqué sans étapes (requiredData)', () => {
    const { sidebar } = selectWidgets(hikingCtx({ hasSteps: false }), ['steps-timeline']);
    expect(sidebar).toEqual([]);
  });
});