import { describe, it, expect } from 'vitest';
import {
  tripSectionRegistry,
  tripSectionHref,
  tripSwitchHref,
  sectionIdFromPathname,
  visibleSections,
} from '@/features/trips/registry/tripSectionRegistry';
import { hubSectionRegistry } from '@/features/hub/registry/hubSectionRegistry';
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

  // Étape 2 — Hub unique : les sections sortie vivent dans /hub. Le shim
  // /voyages/[slug]/[section] est le SEUL dossier de route restant.
  it('segments cohérents avec le registre hub (rendu canonique /hub)', () => {
    const hubDir = path.join(process.cwd(), 'src', 'app', 'hub', '[section]');
    expect(fs.existsSync(path.join(hubDir, 'page.tsx'))).toBe(true);
    const shimDir = path.join(process.cwd(), 'src', 'app', 'voyages', '[slug]', '[section]');
    expect(fs.existsSync(path.join(shimDir, 'page.tsx'))).toBe(true);
    // Chaque segment du registre voyage correspond au segment hub de même id.
    for (const s of tripSectionRegistry) {
      if (s.segment === '') continue; // racine = /hub
      const hubDef = hubSectionRegistry.find((h) => h.id === s.id);
      expect(hubDef, `section ${s.id} doit exister dans le registre hub`).toBeDefined();
      expect(hubDef?.segment).toBe(s.segment === 'kit' ? 'kit-voyage' : s.segment);
    }
  });

  it('tripSectionHref : racine hub, segment hub, rejet d’une section inconnue', () => {
    expect(tripSectionHref('abc', 'overview')).toBe('/hub');
    expect(tripSectionHref('abc', 'itinerary')).toBe('/hub/itineraire');
    expect(tripSectionHref('abc', 'safety')).toBe('/hub/securite');
    expect(() => tripSectionHref('abc', 'inconnu' as never)).toThrow();
  });

  it('tripSwitchHref : URL de bascule vers un voyage précis (shim /voyages/[slug])', () => {
    expect(tripSwitchHref('abc')).toBe('/voyages/abc');
  });

  it('sectionIdFromPathname : hub canonique + héritage /voyages, hors hub = null', () => {
    expect(sectionIdFromPathname('/hub')).toBe('overview');
    expect(sectionIdFromPathname('/hub/itineraire')).toBe('itinerary');
    expect(sectionIdFromPathname('/hub/kit-voyage')).toBe('gear');
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
