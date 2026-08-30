import { describe, it, expect } from 'vitest';
import { getDepartDetail } from '@/features/materiel/services/getDepartDetail';
import { toggleKitItem } from '@/features/materiel/actions/toggleKitItem';
import {
  calcBaseWeight,
  calcReadinessPct,
  deriveStatus,
  calcWeightBreakdown,
} from '@/features/materiel/domain/departCalculations';

describe('Depart Cockpit - Integration & Data Flow', () => {
  it('fournit des données de showcase complètes et cohérentes pour les kits modèles', async () => {
    const tmb = await getDepartDetail('tmb-4j');
    expect(tmb).toBeDefined();
    expect(tmb.id).toBe('tmb-4j');
    expect(typeof tmb.destination).toBe('string');
    expect(tmb.destination.length).toBeGreaterThan(0);
    expect(tmb.assignedKit.items.length).toBeGreaterThan(0);
    expect(tmb.checklistPct).toBeGreaterThanOrEqual(0);
    expect(tmb.checklistPct).toBeLessThanOrEqual(100);
    expect(tmb.trail).toBeDefined();
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

  it('fournit un fallback sûr en cas d ID inconnu ou none', async () => {
    const fallback = await getDepartDetail('none');
    expect(fallback).toBeDefined();
    expect(fallback.assignedKit.items.length).toBeGreaterThan(0);
  });

  it('rejette les appels toggleKitItem avec des identifiants invalides', async () => {
    const res1 = await toggleKitItem('', false);
    expect(res1.success).toBe(false);
    expect(res1.error).toBe('ID invalide');

    const res2 = await toggleKitItem('a'.repeat(200), false);
    expect(res2.success).toBe(false);
    expect(res2.error).toBe('ID invalide');
  });

  it('gère correctement le recalcul du poids et de la readiness', () => {
    const items = [
      { name: 'Tente', category: 'Bivouac', weight_g: 1500, is_checked: true },
      { name: 'Sac', category: 'Portage', weight_g: 1200, is_checked: false },
      { name: 'Gourde', category: 'Hydratation', weight_g: 200, is_checked: true },
    ];

    const weight = calcBaseWeight(items);
    expect(weight).toBe(2900);

    const readiness = calcReadinessPct(items);
    expect(readiness).toBe(67);

    const status = deriveStatus(readiness);
    expect(status).toBe('warning');

    const breakdown = calcWeightBreakdown(items);
    expect(breakdown.length).toBe(3);
    expect(breakdown[0].category).toBe('Bivouac');
    expect(breakdown[0].weightG).toBe(1500);
  });
});
