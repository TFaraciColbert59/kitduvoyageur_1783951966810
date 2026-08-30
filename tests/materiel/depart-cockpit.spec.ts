import { describe, it, expect } from 'vitest';
import { getDepartDetail } from '@/features/materiel/services/getDepartDetail';
import { toggleKitItem } from '@/features/materiel/actions/toggleKitItem';
import { updateDepartStatus } from '@/features/materiel/actions/updateDepartStatus';
import { buildDepartNotificationPlan } from '@/features/materiel/services/departNotifications';
import { generateSmartPrompts } from '@/features/materiel/services/generateSmartPrompts';
import {
  calcBaseWeight,
  calcWornWeight,
  calcConsumablesWeight,
  calcTotalPackWeight,
  calcReadinessPct,
  calcWeightedReadinessScore,
} from '@/features/materiel/domain/departCalculations';

describe('Depart Cockpit - Complete V2 Test Suite', () => {
  describe('Modèle de Données & Showcase', () => {
    it('fournit des données de showcase complètes avec distinction base/worn/consumables', async () => {
      const tmb = await getDepartDetail('tmb-4j');
      expect(tmb).toBeDefined();
      expect(tmb.id).toBe('tmb-4j');
      expect(typeof tmb.destination).toBe('string');
      expect(tmb.destination.length).toBeGreaterThan(0);
      expect(tmb.assignedKit.items.length).toBeGreaterThan(0);
      expect(tmb.baseWeightG).toBeGreaterThan(0);
      expect(tmb.wornWeightG).toBeGreaterThan(0);
      expect(tmb.totalPackWeightG).toBeGreaterThanOrEqual(tmb.baseWeightG);
      expect(tmb.checklistPct).toBeGreaterThanOrEqual(0);
      expect(tmb.checklistPct).toBeLessThanOrEqual(100);
      expect(tmb.participants.length).toBeGreaterThanOrEqual(1);
      expect(tmb.consumables.water).toBeGreaterThan(0);
    });

    it('charge correctement le showcase vercors-ultra avec des valeurs cohérentes', async () => {
      const vercors = await getDepartDetail('vercors-ultra');
      expect(vercors.id).toBe('vercors-ultra');
      expect(vercors.destination).toContain('Vercors');
      expect(vercors.durationDays).toBe(3);
      expect(vercors.participants.length).toBe(1);
    });

    it('fournit un fallback sûr en cas d ID inconnu ou none sans tracé fictif forcé', async () => {
      const fallback = await getDepartDetail('none');
      expect(fallback).toBeDefined();
      expect(fallback.assignedKit.items.length).toBeGreaterThan(0);
    });
  });

  describe('Sécurité & Mutations Server Actions', () => {
    it('rejette les appels toggleKitItem avec des identifiants invalides', async () => {
      const res1 = await toggleKitItem('', false);
      expect(res1.success).toBe(false);
      expect(res1.error).toBe('ID invalide');

      const res2 = await toggleKitItem('a'.repeat(200), false);
      expect(res2.success).toBe(false);
      expect(res2.error).toBe('ID invalide');
    });

    it('rejette les mutations de statut avec des identifiants invalides', async () => {
      const res = await updateDepartStatus('', 'active');
      expect(res.success).toBe(false);
      expect(res.error).toBeDefined();
    });
  });

  describe('Moteur de Notifications Tactiques', () => {
    it('génère un plan de notification cohérent pour un départ à J+8', () => {
      const futureDate = new Date(Date.now() + 8 * 86400000).toISOString();
      const plan = buildDepartNotificationPlan({
        destination: 'Tour du Mont-Blanc',
        startsAt: futureDate,
        hasMissingVitals: true,
        hasRainRisk: false,
      });

      expect(plan.jMinus7).toBeDefined();
      expect(plan.jMinus7?.title).toContain('J-7');
      expect(plan.jMinus2).toBeDefined();
      expect(plan.jMinus1).toBeDefined();
    });

    it('renvoie un plan vide si la date de départ est null ou passée', () => {
      expect(buildDepartNotificationPlan({ destination: 'Test', startsAt: null, hasMissingVitals: false, hasRainRisk: false })).toEqual({});
      const pastDate = new Date(Date.now() - 86400000).toISOString();
      expect(buildDepartNotificationPlan({ destination: 'Test', startsAt: pastDate, hasMissingVitals: false, hasRainRisk: false })).toEqual({});
    });
  });

  describe('Génération des Alertes Intelligentes', () => {
    it('génère 0 alerte décorative si aucun problème n est détecté', () => {
      const items = [
        { name: 'Tente', category: 'Bivouac', weight_g: 1500, is_checked: true, is_vital: true },
        { name: 'Gourde', category: 'Hydratation', weight_g: 200, is_checked: true, is_vital: true },
      ];
      const alerts = generateSmartPrompts({
        items,
        participants: [{ name: 'Vous', initial: 'V', color: '#17402C' }],
        emergencyContact: '+33612345678',
      });

      expect(alerts.length).toBe(0);
    });

    it('détecte et priorise les équipements vitaux manquants en sévérité critique', () => {
      const items = [
        { name: 'Tente 2P', category: 'Bivouac', weight_g: 1500, is_checked: false, is_vital: true },
      ];
      const alerts = generateSmartPrompts({
        items,
        participants: [{ name: 'Vous', initial: 'V', color: '#17402C' }],
        emergencyContact: '+33612345678',
      });

      expect(alerts.length).toBeGreaterThan(0);
      expect(alerts[0].severity).toBe('critical');
      expect(alerts[0].title).toContain('vital');
    });
  });
});
