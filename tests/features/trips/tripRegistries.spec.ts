import { describe, it, expect } from 'vitest';
import {
  tripSectionRegistry,
  tripSectionHref,
  sectionIdFromPathname,
  visibleSections,
} from '@/features/trips/registry/tripSectionRegistry';
import {
  tripWidgetRegistry,
  widgetDef,
  widgetsForPhase,
  estimatedHeight,
  WIDGET_COLUMN_MAX_HEIGHT,
} from '@/features/trips/registry/tripWidgetRegistry';
import {
  TRIP_SECTION_ORDER,
  deriveTripProfile,
} from '@/features/trips/engine/tripProfileEngine';
import type { TripFull } from '@/features/trips/types/trip.types';
import fs from 'node:fs';
import path from 'node:path';

const NOW = new Date('2026-06-01T09:00:00Z');

describe('Y1.3 — registre des sections', () => {
  it('couvre exactement l’ordre canonique du moteur', () => {
    expect(tripSectionRegistry.map((s) => s.id)).toEqual(TRIP_SECTION_ORDER);
  });

  it('identifiants et segments uniques', () => {
    const ids = tripSectionRegistry.map((s) => s.id);
    const segments = tripSectionRegistry.map((s) => s.segment);
    expect(new Set(ids).size).toBe(ids.length);
    expect(new Set(segments).size).toBe(segments.length);
  });

  it('chaque section a un libellé non vide et une icône', () => {
    for (const s of tripSectionRegistry) {
      expect(s.label.length).toBeGreaterThan(0);
      // lucide-react exporte des ForwardRefExoticComponent (objets, pas fonctions)
      expect(['function', 'object']).toContain(typeof s.icon);
      expect(s.phases.length).toBeGreaterThan(0);
    }
  });

  // Y2 : toutes les routes de sections existent désormais (layout de segment).
  // Cette liste doit rester VIDE — elle documentait le contrat pré-Y2.
  const PENDING_ROUTE_SEGMENTS: string[] = [];

  it('segments cohérents avec les dossiers de routes réels (ou en attente Y2/Y4)', () => {
    const slugsDir = path.join(process.cwd(), 'src', 'app', 'voyages', '[slug]');
    const realSegments = fs
      .readdirSync(slugsDir, { withFileTypes: true })
      .filter((e) => e.isDirectory())
      .map((e) => e.name);
    for (const s of tripSectionRegistry) {
      if (s.segment === '') continue; // racine = page.tsx
      if (PENDING_ROUTE_SEGMENTS.includes(s.segment)) continue; // créé en Y2/Y4
      expect(realSegments, `segment ${s.segment} doit exister comme route`).toContain(s.segment);
    }
    // La liste des en attente ne référence que des segments du registre.
    const registrySegments = tripSectionRegistry.map((s) => s.segment);
    for (const pending of PENDING_ROUTE_SEGMENTS) {
      expect(registrySegments).toContain(pending);
    }
  });

  it('tripSectionHref : racine, segment, et rejet d’une section inconnue', () => {
    expect(tripSectionHref('abc', 'overview')).toBe('/voyages/abc');
    expect(tripSectionHref('abc', 'itinerary')).toBe('/voyages/abc/itineraire');
    expect(tripSectionHref('abc', 'safety')).toBe('/voyages/abc/securite');
    expect(() => tripSectionHref('abc', 'inconnu' as never)).toThrow();
  });

  it('sectionIdFromPathname : racine, segments, sous-chemins, hors hub', () => {
    expect(sectionIdFromPathname('/voyages/abc')).toBe('overview');
    expect(sectionIdFromPathname('/voyages/abc/itineraire')).toBe('itinerary');
    expect(sectionIdFromPathname('/voyages/abc/kit')).toBe('gear');
    expect(sectionIdFromPathname('/voyages')).toBeNull();
    expect(sectionIdFromPathname('/materiel')).toBeNull();
  });

  it('permissions déclarées uniquement sur budget et docs', () => {
    const permitted = tripSectionRegistry.filter((s) => s.permission);
    expect(permitted.map((s) => s.id).sort()).toEqual(['budget', 'docs']);
    expect(permitted.find((s) => s.id === 'budget')?.permission).toBe('canManageBudget');
    expect(permitted.find((s) => s.id === 'docs')?.permission).toBe('canViewDocuments');
  });
});

describe('Y1.4 — registre des widgets', () => {
  it('identifiants uniques, couverture du type TripWidgetId', () => {
    const ids = tripWidgetRegistry.map((w) => w.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('priorités strictement distinctes (ordre déterministe)', () => {
    const priorities = tripWidgetRegistry.map((w) => w.priority);
    expect(new Set(priorities).size).toBe(priorities.length);
  });

  it('somme des hauteurs estimées de TOUS les widgets sous la limite de colonne', () => {
    const all = tripWidgetRegistry.map((w) => w.id);
    expect(estimatedHeight(all)).toBeLessThanOrEqual(WIDGET_COLUMN_MAX_HEIGHT);
  });

  it('somme sous la limite pour chacun des 8 profils de la matrice', () => {
    const cases: Array<[number, number]> = [
      [1, 0], [1, 2], [3, 0], [3, 2], [9, 0], [9, 2], [18, 0], [18, 2],
    ];
    for (const [days, collabs] of cases) {
      const trip = {
        id: 't', slug: 't', title: 'T', description: null,
        destination_country_code: 'FR', destination_name: 'X',
        start_date: '2026-06-10', end_date: '2026-06-09', // écrasé ci-dessous
        status: 'planned', visibility: 'private', difficulty: 'moderate',
        primary_activity: 'trekking', estimated_budget: 500, budget_currency: 'EUR',
        cover_image_url: null, user_id: 'u', group_id: null, share_token: null,
        metadata: {}, created_at: '', updated_at: '',
        collaborators: Array.from({ length: collabs }, (_, i) => ({
          id: `c${i}`, trip_id: 't', user_id: `u-${i}`, role: 'viewer', joined_at: '',
        })),
        steps: [], items: [], expenses: [], documents: [], pois: [],
        safety_checkpoints: [], notes: [], user_role: 'owner',
        permissions: { canEdit: true, canDelete: true, canInvite: true, canManageBudget: true, canViewDocuments: true },
      } as unknown as TripFull;
      const start = new Date('2026-06-10T00:00:00Z');
      trip.start_date = start.toISOString().slice(0, 10);
      trip.end_date = new Date(start.getTime() + (days - 1) * 86400000).toISOString().slice(0, 10);

      const profile = deriveTripProfile(trip, NOW);
      // Pire cas : tous les documents/étapes/objets présents pour maximiser la colonne
      const rich = deriveTripProfile(
        { ...trip, steps: [{ id: 's' } as TripFull['steps'][number]], items: [{ id: 'i' } as TripFull['items'][number]], documents: [{ id: 'd' } as TripFull['documents'][number]] },
        NOW
      );
      expect(estimatedHeight(profile.widgets)).toBeLessThanOrEqual(WIDGET_COLUMN_MAX_HEIGHT);
      expect(estimatedHeight(rich.widgets)).toBeLessThanOrEqual(WIDGET_COLUMN_MAX_HEIGHT);
    }
  });

  it('widgetDef retrouve chaque définition ; widgetsForPhase filtre et trie', () => {
    expect(widgetDef('countdown')?.priority).toBe(100);
    const live = widgetsForPhase(tripWidgetRegistry.map((w) => w.id), 'live');
    expect(live).toContain('next-step');
    expect(live).not.toContain('kit-balance'); // prepare uniquement
    expect(live.indexOf('countdown')).toBeLessThan(live.indexOf('offline-toggle'));
  });

  it('visibleSections projette le profil sur le registre, dans l’ordre', () => {
    const trip = {
      id: 't', slug: 't', title: 'T', start_date: '2026-06-10', end_date: '2026-06-10',
      status: 'planned', primary_activity: 'hiking', difficulty: 'easy',
      estimated_budget: null, collaborators: [], steps: [], items: [], expenses: [],
      documents: [], pois: [], safety_checkpoints: [], notes: [],
    } as unknown as TripFull;
    const profile = deriveTripProfile(trip, NOW);
    expect(visibleSections(profile).map((s) => s.id)).toEqual(profile.sections);
  });
});
