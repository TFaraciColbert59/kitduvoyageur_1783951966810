import { describe, it, expect } from 'vitest';
import { getTripDuration } from '@/features/trips/hooks/useTripDuration';
import { getKitCounters } from '@/features/trips/hooks/useKitCounters';
import {
  getTripCounters,
  getCanonicalTripSteps,
} from '@/features/trips/hooks/useTripCounters';
import { getTripDistance } from '@/features/trips/hooks/useTripDistance';
import { getTripStatus } from '@/features/trips/hooks/useTripStatus';
import { getTripPhaseDetails } from '@/features/trips/engine/temporalPhaseEngine';
import type { TripFull, TripStep, TripItem } from '@/features/trips/types/trip.types';

/**
 * CHANTIER Z3 — COHÉRENCE DES CHIFFRES (D20–D26)
 *
 * Principe Z-R3 : UN sélecteur par chiffre. Chaque valeur (durée, compteurs,
 * étapes, participants, dénivelé, statut) est dérivée d'UNE source de vérité
 * pour que tous les onglets affichent la même valeur.
 */

// --- Voyage de référence (miroir du voyage test fdgb-3c3a92) ---
const BASE_TRIP = {
  id: 't1',
  slug: 'fdgb-3c3a92',
  title: 'Test',
  user_id: 'owner-1',
  status: 'draft' as const,
  start_date: '2026-09-29',
  end_date: '2026-10-27',
  steps: [] as TripStep[],
  items: [] as TripItem[],
  collaborators: [],
} as unknown as TripFull;

const NOW = '2026-09-01';

function buildSteps(dayNumbers: number[], titles?: string[]): TripStep[] {
  return dayNumbers.map((d, i) => ({
    id: `step-${i}`,
    trip_id: 't1',
    day_number: d,
    order_index: i,
    title: titles?.[i] || `Jour ${d}`,
    description: null,
    location_name: null,
    latitude: null,
    longitude: null,
    accommodation_name: null,
    transport_mode: null,
    distance_km: null,
    elevation_gain_m: null,
    elevation_loss_m: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }));
}

describe('CHANTIER Z3 — COHÉRENCE DES CHIFFRES', () => {
  describe('Z-D20 — Durée unique (header, Aperçu, Vivre, pastille, Checklist)', () => {
    it('Z-D20.1 : la durée est de 29 jours (depuis les dates), pas 2 (nb d\'étapes)', () => {
      const d = getTripDuration(BASE_TRIP, NOW);
      // Le voyage dure du 29/09 au 27/10 → 29 jours. Un calcul depuis les étapes
      // (max day_number=2) donnerait 2 : c'est LA divergence à neutraliser.
      expect(d.durationDays).toBe(29);
    });

    it('Z-D20.2 : durationDays est cohérent avec getTripPhaseDetails().totalDays', () => {
      const d = getTripDuration(BASE_TRIP, NOW);
      const phase = getTripPhaseDetails(BASE_TRIP, NOW);
      expect(d.durationDays).toBe(phase.totalDays);
    });

    it('Z-D20.3 : daysUntilDeparture est cohérent avec getTripPhaseDetails().daysUntilStart', () => {
      const d = getTripDuration(BASE_TRIP, NOW);
      const phase = getTripPhaseDetails(BASE_TRIP, NOW);
      expect(d.daysUntilDeparture).toBe(phase.daysUntilStart);
      expect(d.daysUntilDeparture).toBeGreaterThan(0); // voyage futur
    });
  });

  describe('Z-D21 — Compteurs de kit identiques (Aperçu et Vue Kit)', () => {
    it('Z-D21.1 : getKitCounters dérive ready/total de LA même liste trip.items', () => {
      const items: TripItem[] = Array.from({ length: 11 }, (_, i) => ({
        id: `i${i}`,
        trip_id: 't1',
        item_name: `Objet ${i}`,
        category: 'misc',
        quantity: 1,
        weight_grams: null,
        is_packed: i < 3,
        status: i < 3 ? 'packed' : 'needed',
        packed_by: null,
        inventory_item_id: null,
        affiliate_link_id: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }));
      const c = getKitCounters(items);
      // Aperçu (« 3/11 objets prêts ») et Vue Kit doivent afficher le MÊME couple.
      expect(c.ready).toBe(3);
      expect(c.total).toBe(11);
      expect(c.ready).toBeLessThanOrEqual(c.total);
    });
  });

  describe('Z-D22 — Compteur d\'étapes unique (2, 39 ou 29 selon l\'onglet)', () => {
    it('Z-D22.1 : stagesCount dédupliqué = nb de day_number uniques (pas 39, pas 29)', () => {
      // Données dégradées : deux étapes partagent le jour 1.
      const trip = { ...BASE_TRIP, steps: buildSteps([1, 1, 2]) } as unknown as TripFull;
      const counters = getTripCounters(trip);
      // 2 étapes réelles renumérotées, jamais 39 (génération) ni 29 (jours calendaires).
      expect(counters.itinerary).toBe(2);
      expect(counters.itinerary).toBe(
        new Set(trip.steps.map((s) => s.day_number)).size
      );
    });
  });

  describe('Z-D23 — Participants : une seule source de vérité', () => {
    it('Z-D23.1 : participantsCount compte l\'owner + les collaborateurs uniques', () => {
      const trip = {
        ...BASE_TRIP,
        collaborators: [
          { id: 'c1', user_id: 'owner-1' as string, role: 'owner' as const },
          { id: 'c2', user_id: 'mate-1' as string, role: 'editor' as const },
          { id: 'c3', user_id: 'mate-2' as string, role: 'viewer' as const },
        ],
      } as unknown as TripFull;
      const counters = getTripCounters(trip);
      // owner-1 compte UNE fois (pas de double +1), mate-1 et mate-2.
      expect(counters.participantsCount).toBe(3);
      expect(counters.team).toBe(counters.participantsCount);
    });

    it('Z-D23.2 : sans collaborateurs, le header affiche 1 (l\'owner), pas 0', () => {
      const counters = getTripCounters(BASE_TRIP);
      expect(counters.participantsCount).toBe(1);
      expect(counters.team).toBe(1);
    });
  });

  describe('Z-D24 — Dénivelé : un seul nombre, pas de slash', () => {
    it('Z-D24.1 : dPlus est toujours un nombre fini, jamais "54 / 422"', () => {
      // Donnée dégradée : elevation_gain_m stocké comme "54 / 422" (deux valeurs).
      const steps = buildSteps([1]);
      (steps[0] as any).elevation_gain_m = '54 / 422';
      (steps[0] as any).elevation_loss_m = '30 / 45';

      const dist = getTripDistance(steps);
      expect(Number.isFinite(dist.dPlus)).toBe(true);
      expect(String(dist.dPlus)).not.toContain('/');
      expect(Number.isFinite(dist.dMinus)).toBe(true);
    });

    it('Z-D24.2 : le dPlus total est une somme cohérente de nombres', () => {
      const steps = buildSteps([1, 2]);
      steps[0].elevation_gain_m = 200;
      steps[1].elevation_gain_m = 222;
      const dist = getTripDistance(steps);
      expect(dist.dPlus).toBe(422);
    });

    it('Z-D24.3 : distance totale = somme des distances d\'étapes', () => {
      const steps = buildSteps([1, 2]);
      steps[0].distance_km = 30;
      steps[1].distance_km = 24;
      const dist = getTripDistance(steps);
      expect(dist.totalKm).toBe(54);
    });
  });

  describe('Z-D25 — Statut : draft et active mutuellement exclusifs', () => {
    it('Z-D25.1 : un voyage draft n\'est jamais "isActive"', () => {
      const v = getTripStatus({ ...BASE_TRIP, status: 'draft' });
      expect(v.isActive).toBe(false);
      expect(v.status).toBe('draft');
    });

    it('Z-D25.2 : un voyage active est "isActive"', () => {
      const v = getTripStatus({ ...BASE_TRIP, status: 'active' });
      expect(v.isActive).toBe(true);
      expect(v.status).toBe('active');
    });

    it('Z-D25.3 : invariant — isActive === (status === "active")', () => {
      for (const status of ['draft', 'planned', 'active', 'completed', 'cancelled'] as const) {
        const v = getTripStatus({ ...BASE_TRIP, status });
        expect(v.isActive).toBe(status === 'active');
        expect(!(v.isActive && v.status === 'draft')).toBe(true);
      }
    });
  });

  describe('Z-D26 — Pas deux étapes avec le même day_number', () => {
    it('Z-D26.1 : getCanonicalTripSteps déduplique par day_number', () => {
      const steps = buildSteps([1, 1, 2, 2, 3], ['JOUR 1', 'JOUR 1', 'JOUR 2', 'JOUR 2', 'JOUR 3']);
      const canonical = getCanonicalTripSteps(steps);
      const days = canonical.map((s) => s.day_number);
      expect(days).toEqual([1, 2, 3]);
      expect(new Set(days).size).toBe(days.length); // aucun doublon
    });
  });
});
