import { describe, it, expect } from 'vitest';
import { getDepartDetail } from '@/features/materiel/services/getDepartDetail';
import { toggleKitItem } from '@/features/materiel/actions/toggleKitItem';
import { updateDepartStatus } from '@/features/materiel/actions/updateDepartStatus';
import { addDepartItem } from '@/features/materiel/actions/addDepartItem';
import { updateItemQuantity } from '@/features/materiel/actions/updateItemQuantity';
import { deleteDepartItem } from '@/features/materiel/actions/deleteDepartItem';
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

    it('fournit des métadonnées enrichies de Header (Phase 1) : couverture, activité et horodatage', async () => {
      const tmb = await getDepartDetail('tmb-4j');
      expect(tmb.activityType).toBe('Bivouac');
      expect(tmb.updatedAt).toBeDefined();
      expect(tmb.coverImageUrl).toBeDefined();

      const vercors = await getDepartDetail('vercors-ultra');
      expect(vercors.activityType).toBe('Fastpacking');
      expect(vercors.comparableTrip).toBeDefined();
      expect(vercors.comparableTrip?.name).toContain('Jura');
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

    it('rejette les ajouts d équipements avec des données incomplètes ou invalides (Phase 3)', async () => {
      const res1 = await addDepartItem({ kitId: '', name: '', category: 'Bivouac', weightG: 100 });
      expect(res1.success).toBe(false);
      expect(res1.error).toBeDefined();

      const res2 = await addDepartItem({ kitId: 'kit-123', name: '', category: 'Bivouac', weightG: 100 });
      expect(res2.success).toBe(false);
      expect(res2.error).toBe('Informations incomplètes');
    });

    it('rejette les modifications de quantités avec des valeurs hors limites (Phase 3)', async () => {
      const res1 = await updateItemQuantity('item-1', 0);
      expect(res1.success).toBe(false);
      expect(res1.error).toBe('Paramètres invalides');

      const res2 = await updateItemQuantity('item-1', 100);
      expect(res2.success).toBe(false);
      expect(res2.error).toBe('Paramètres invalides');
    });

    it('rejette les suppressions avec des identifiants invalides (Phase 3)', async () => {
      const res = await deleteDepartItem('');
      expect(res.success).toBe(false);
      expect(res.error).toBe('ID invalide');
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
      expect(alerts[0].whyExplanation).toBeDefined();
    });

    it('détecte le matériel prêté et fournit une action vers la disponibilité (Phase 2)', () => {
      const items = [
        { id: 'item-rechaud-1', name: 'Réchaud Optimus', category: 'Cuisine', weight_g: 180, is_checked: true },
      ];
      const loans = [
        {
          id: 'loan-1',
          product_ownership_id: 'item-rechaud-1',
          lender_id: 'user-1',
          borrower_id: null,
          borrower_contact: 'Lucas',
          status: 'en_cours' as const,
          loaned_at: '2026-08-10',
          due_date: '2026-09-02',
          returned_at: null,
        },
      ];

      const alerts = generateSmartPrompts({
        items,
        participants: [{ name: 'Vous', initial: 'V', color: '#17402C' }],
        emergencyContact: '+33612345678',
        loans,
      });

      expect(alerts.some((a) => a.id.includes('alert-loan'))).toBe(true);
      const loanAlert = alerts.find((a) => a.id.includes('alert-loan'));
      expect(loanAlert?.severity).toBe('critical');
      expect(loanAlert?.actionType).toBe('view_dispo');
      expect(loanAlert?.whyExplanation).toContain('prêté');
    });

    it('intègre les alertes réelles d inventaire pour le matériel du kit (Phase 2)', () => {
      const items = [
        { id: 'item-filtre-1', name: 'Filtre Katadyn BeFree', category: 'Hydratation', weight_g: 65, is_checked: true },
      ];
      const inventoryAlerts = [
        {
          id: 'item-filtre-1',
          type: 'expiration_cartouche',
          severity: 'warning' as const,
          message: 'Cartouche filtrante à remplacer (dépassée)',
          is_resolved: false,
          due_at: '2026-08-01',
          created_at: '2026-08-01',
        },
      ];

      const alerts = generateSmartPrompts({
        items,
        participants: [{ name: 'Vous', initial: 'V', color: '#17402C' }],
        emergencyContact: '+33612345678',
        inventoryAlerts,
      });

      expect(alerts.some((a) => a.id.includes('alert-inv'))).toBe(true);
      const invAlert = alerts.find((a) => a.id.includes('alert-inv'));
      expect(invAlert?.title).toContain('Inventaire');
      expect(invAlert?.whyExplanation).toBeDefined();
    });
  });
});
