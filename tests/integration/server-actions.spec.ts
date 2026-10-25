import { describe, it, expect } from 'vitest';
import { createCrewSchema, joinCrewCodeSchema } from '@/features/crews/schemas/crew.schema';
import { createTripSchema } from '@/features/trips';
import { parseTripGpx } from '@/features/trips/engine/exportEngine';

describe('Phase 11.2 — Tests d’Intégration Server Actions (Succès, Échecs, Sécurité)', () => {
  describe('createTripSchema & validation', () => {
    it('valide avec succès une charge utile conforme (France 28 jours)', () => {
      const input = {
        title: 'Traversée des Pyrénées 2026',
        destination_country_code: 'FR',
        start_date: '2026-08-01',
        end_date: '2026-08-28',
        visibility: 'private' as const,
        primary_activity: 'trekking' as const,
        difficulty: 'hard' as const,
        budget_currency: 'EUR',
      };

      const parsed = createTripSchema.safeParse(input);
      expect(parsed.success).toBe(true);
    });

    it('rejette la création si le titre est vide ou le pays invalide (Validation échouée)', () => {
      const invalidInput = {
        title: '   ',
        destination_country_code: 'FRANCE', // Doit être code 2 lettres
        start_date: '2026-08-01',
        end_date: '2026-08-10',
      };

      const parsed = createTripSchema.safeParse(invalidInput);
      expect(parsed.success).toBe(false);
    });
  });

  describe('createCrewSchema & joinCrewCodeSchema validation', () => {
    it('valide avec succès la création d’un équipage', () => {
      const raw = {
        name: 'Équipage du Mercantour',
        description: 'Groupe autonome de haute randonnée',
        theme: 'Trek',
        visibility: 'private',
        max_members: 8,
      };

      const parsed = createCrewSchema.safeParse(raw);
      expect(parsed.success).toBe(true);
      if (parsed.success) {
        expect(parsed.data.name).toBe('Équipage du Mercantour');
      }
    });

    it('rejette un code de ralliement altéré ou malformé', () => {
      const badCodes = ['abc', '12', '', 'CODE-AVEC-ESPACES', '!@#$%'];
      for (const code of badCodes) {
        const parsed = joinCrewCodeSchema.safeParse({ code });
        expect(parsed.success).toBe(false);
      }
    });
  });

  describe('importGpxToTripAction validation & résilience', () => {
    it('détecte un fichier GPX vide ou malformé avec isValid=false sans crasher', () => {
      expect(parseTripGpx('').isValid).toBe(false);
      expect(parseTripGpx('<xml>pas de gpx</xml>').isValid).toBe(false);
    });

    it('analyse avec succès un flux GPX 1.1 valide sans dépendance DOM', () => {
      const validGpx = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="LKDV">
  <trk>
    <name>Col du Bonhomme</name>
    <trkseg>
      <trkpt lat="45.728" lon="6.712"><ele>2329</ele></trkpt>
      <trkpt lat="45.735" lon="6.720"><ele>2479</ele></trkpt>
    </trkseg>
  </trk>
</gpx>`;

      const parsed = parseTripGpx(validGpx);
      expect(parsed.trackPoints.length).toBe(2);
      expect(parsed.totalElevationGainM).toBe(150);
      expect(parsed.totalDistanceKm).toBeGreaterThan(0);
    });
  });
});
