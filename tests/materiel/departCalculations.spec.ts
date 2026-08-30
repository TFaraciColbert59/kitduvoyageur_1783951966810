import { describe, it, expect } from 'vitest';
import {
  calcBaseWeight,
  calcWornWeight,
  calcConsumablesWeight,
  calcTotalPackWeight,
  calcReadinessPct,
  calcWeightedReadinessScore,
  deriveStatus,
  calcWeightBreakdown,
  formatWeight,
  formatDistanceKm,
  isVitalItem,
} from '@/features/materiel/domain/departCalculations';
import type { ChecklistItem } from '@/features/materiel/types/trekHub';

describe('departCalculations — Domain Tests (Phase 0)', () => {
  describe('isVitalItem', () => {
    it('identifie correctement les équipements vitaux de sécurité et d abri', () => {
      expect(isVitalItem('Tente Ultralight 2P', 'Bivouac')).toBe(true);
      expect(isVitalItem('Sac de couchage 0°C', 'Couchage')).toBe(true);
      expect(isVitalItem('Trousse de premiers secours', 'Sécurité')).toBe(true);
      expect(isVitalItem('Gourde filtrante 1L', 'Hydratation')).toBe(true);
      expect(isVitalItem('Veste imperméable Hardshell', 'Vêtements')).toBe(true);
      expect(isVitalItem('Couverture de survie', 'Sécurité')).toBe(true);
    });

    it('ne marque pas comme vitaux les articles non critiques', () => {
      expect(isVitalItem('Livre de poche', 'Loisirs')).toBe(false);
      expect(isVitalItem('Jeu de cartes', 'Autre')).toBe(false);
      expect(isVitalItem('Oreiller gonflable', 'Confort')).toBe(false);
    });
  });

  describe('calcBaseWeight & calcWornWeight', () => {
    it('exclut rigoureusement les articles portés (is_worn) et consommables (is_consumable)', () => {
      const items: ChecklistItem[] = [
        { name: 'Tente', category: 'Bivouac', weight_g: 1200, is_checked: true },
        { name: 'Chaussures de trek', category: 'Vêtements', weight_g: 900, is_checked: true, is_worn: true },
        { name: 'Veste sur soi', category: 'Vêtements', weight_g: 400, is_checked: true, is_worn: true },
        { name: 'Barres énergétiques', category: 'Nutrition', weight_g: 300, is_checked: true, is_consumable: true },
        { name: 'Sac de couchage', category: 'Couchage', weight_g: 800, is_checked: true },
      ];

      // Base weight = Tente (1200) + Sac de couchage (800) = 2000g
      expect(calcBaseWeight(items)).toBe(2000);
      // Worn weight = Chaussures (900) + Veste (400) = 1300g
      expect(calcWornWeight(items)).toBe(1300);
      // Consumables = Barres (300)
      expect(calcConsumablesWeight(items)).toBe(300);
      // Total Pack Weight = Base (2000) + Consumables (300) = 2300g
      expect(calcTotalPackWeight(2000, 300)).toBe(2300);
    });

    it('gère les listes vides et poids nuls sans erreur', () => {
      expect(calcBaseWeight([])).toBe(0);
      expect(calcWornWeight([])).toBe(0);
      expect(calcConsumablesWeight([])).toBe(0);
      expect(calcTotalPackWeight(0, 0)).toBe(0);
    });
  });

  describe('calcWeightedReadinessScore', () => {
    it('classe en Critique si au moins un équipement vital manque', () => {
      const items: ChecklistItem[] = [
        { name: 'Tente 2P', category: 'Bivouac', weight_g: 1500, is_checked: false }, // VITAL MANQUANT
        { name: 'Veste imperméable', category: 'Vêtements', weight_g: 400, is_checked: true },
        { name: 'Gourde 1L', category: 'Hydratation', weight_g: 200, is_checked: true },
        { name: 'Couteau', category: 'Cuisine', weight_g: 80, is_checked: true },
      ];

      const res = calcWeightedReadinessScore(items, null, '+33612345678');
      expect(res.status).toBe('critical');
      expect(res.grade).toBe('Critique');
      expect(res.missingVitals.length).toBeGreaterThan(0);
      expect(res.label).toContain('départ déconseillé');
    });

    it('classe en Warning (À finaliser) si les vitaux sont prêts mais pas tous les items', () => {
      const items: ChecklistItem[] = [
        { name: 'Tente 2P', category: 'Bivouac', weight_g: 1500, is_checked: true },
        { name: 'Trousse de secours', category: 'Sécurité', weight_g: 300, is_checked: true },
        { name: 'Gourde 1L', category: 'Hydratation', weight_g: 200, is_checked: true },
        { name: 'Oreiller gonflable', category: 'Confort', weight_g: 100, is_checked: false }, // Non vital manquant
      ];

      const res = calcWeightedReadinessScore(items, null, '+33612345678');
      expect(res.status).toBe('warning');
      expect(res.percentage).toBe(75);
      expect(res.label).toBe('À finaliser');
    });

    it('classe en OK (Prêt pour le départ) si 100% est coché avec contact ICE', () => {
      const items: ChecklistItem[] = [
        { name: 'Tente 2P', category: 'Bivouac', weight_g: 1500, is_checked: true },
        { name: 'Trousse de secours', category: 'Sécurité', weight_g: 300, is_checked: true },
        { name: 'Gourde 1L', category: 'Hydratation', weight_g: 200, is_checked: true },
      ];

      const res = calcWeightedReadinessScore(items, null, '+33612345678');
      expect(res.status).toBe('ok');
      expect(res.grade).toBe('A+');
      expect(res.percentage).toBe(100);
      expect(res.label).toBe('Prêt pour le départ');
    });
  });

  describe('formatDistanceKm & formatWeight', () => {
    it('formate proprement les distances kilométriques sans décimales parasites', () => {
      expect(formatDistanceKm(28.600000381469727)).toBe('28.6 km');
      expect(formatDistanceKm(14.0)).toBe('14 km');
      expect(formatDistanceKm(0)).toBe('--');
      expect(formatDistanceKm(null)).toBe('--');
    });

    it('formate proprement les poids', () => {
      expect(formatWeight(450)).toBe('450 g');
      expect(formatWeight(1250)).toBe('1.3 kg');
      expect(formatWeight(0)).toBe('--');
    });
  });
});
