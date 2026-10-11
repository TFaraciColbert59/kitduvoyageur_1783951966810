/**
 * T05 — Contrat économique v2 : validation du registre gelé.
 *
 * Vérifie : structure des 29 actions, poids exacts, plafonds d'actions,
 * groupes de quotas, jalons de compétences, dix seuils inchangés, date
 * d'effet, absence de toute conversion XP/argent et absence de promesse
 * commerciale activable.
 */
import { describe, it, expect } from 'vitest';
import { LEVEL_TIERS } from '@/features/progression/domain/rules';
import {
  PROGRESSION_REGISTRY_V2,
  PROGRESSION_REGISTRY_V2_VERSION,
  PROGRESSION_REGISTRY_V2_EFFECTIVE_FROM,
  capGroupFor,
  familyCapFor,
  findRegistryV2Action,
  skillMilestoneReached,
} from '@/features/progression/domain/registryV2';
import { PROGRESSION_FAMILIES } from '@/features/progression/domain/types';

const REGISTRY = PROGRESSION_REGISTRY_V2;
const SKILLS = ['explorer', 'preparer', 'partager', 'entraider'] as const;

describe('registre v2 — structure', () => {
  it('expose 29 actions, identifiants uniques, toutes familles et phases valides', () => {
    expect(REGISTRY.version).toBe(PROGRESSION_REGISTRY_V2_VERSION);
    expect(REGISTRY.actions.length).toBe(29);
    const ids = REGISTRY.actions.map((action) => action.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const action of REGISTRY.actions) {
      expect(PROGRESSION_FAMILIES).toContain(action.family);
      expect(['P1', 'P2', 'P3', 'P4', 'P5', 'P6', 'P7']).toContain(action.firstPhase);
      expect(action.proof.length).toBeGreaterThan(10);
    }
  });

  it('répartit chaque gain entre les quatre compétences (somme des poids = 1)', () => {
    for (const action of REGISTRY.actions) {
      const sum = SKILLS.reduce((acc, skill) => acc + (action.weights[skill] ?? 0), 0);
      expect(Math.abs(sum - 1)).toBeLessThan(1e-9);
      for (const skill of SKILLS) {
        const weight = action.weights[skill] ?? 0;
        expect(weight).toBeGreaterThanOrEqual(0);
        expect(weight).toBeLessThanOrEqual(1);
      }
    }
  });

  it('applique des plafonds d’actions ordonnés jour ≤ semaine ≤ saison', () => {
    for (const action of REGISTRY.actions) {
      const { day, week, season } = action.caps;
      expect(day).toBeGreaterThan(0);
      expect(week).toBeGreaterThanOrEqual(day);
      expect(season).toBeGreaterThanOrEqual(week);
    }
  });

  it('référence des groupes de quotas définis et cohérents', () => {
    const groupIds = REGISTRY.capGroups.map((group) => group.id);
    expect(new Set(groupIds).size).toBe(groupIds.length);
    for (const action of REGISTRY.actions) {
      if (!action.capGroup) continue;
      expect(groupIds).toContain(action.capGroup);
      const group = capGroupFor(action.id);
      expect(group).not.toBeNull();
      expect(group?.members).toContain(action.id);
      expect(group?.caps).toEqual(action.caps);
    }
    // Les trois regroupements de l'économie sont présents et complets.
    expect(capGroupFor('hike_session_processed')?.id).toBe('terrain_activity');
    expect(capGroupFor('activity_completed')?.id).toBe('terrain_activity');
    expect(capGroupFor('trail_prepared')?.id).toBe('preparation_authored');
    expect(capGroupFor('compas_prepared')?.id).toBe('preparation_authored');
    expect(capGroupFor('loan_lent')?.id).toBe('loan_roles');
    expect(capGroupFor('loan_returned')?.id).toBe('loan_roles');
  });

  it('borne chaque montant et plafond de gain', () => {
    for (const action of REGISTRY.actions) {
      const { points } = action;
      expect(points.base).toBeGreaterThanOrEqual(0);
      if (points.max !== undefined) {
        expect(points.max).toBeGreaterThanOrEqual(points.base);
      }
      if (points.kind === 'duration_tiers') {
        expect(points.tiers?.length ?? 0).toBeGreaterThanOrEqual(2);
        const tiers = points.tiers ?? [];
        for (let i = 1; i < tiers.length; i += 1) {
          expect(tiers[i].minActiveMinutes).toBeGreaterThan(tiers[i - 1].minActiveMinutes);
          expect(tiers[i].points).toBeGreaterThanOrEqual(tiers[i - 1].points);
        }
        expect(tiers.at(-1)?.points).toBeLessThanOrEqual(points.max ?? Infinity);
        expect(points.adaptedObjectiveFloor).toBeLessThanOrEqual(tiers[0].points);
      }
      if (points.kind === 'items_bonus') {
        expect(points.itemsBonus).toBeDefined();
        const bonus = points.itemsBonus!;
        expect(points.base + bonus.perItem * bonus.maxItems).toBeLessThanOrEqual(
          points.max ?? Infinity
        );
      }
      if (points.kind === 'tiered_by_proof') {
        expect(points.proofTiers).toBeDefined();
        expect(points.proofTiers!.withProof).toBeGreaterThan(points.proofTiers!.withoutProof);
        expect(points.proofTiers!.withProof).toBeLessThanOrEqual(points.max ?? Infinity);
      }
      if (action.novelty) {
        expect(action.novelty.points).toBeGreaterThan(0);
        expect(action.novelty.perSeason).toBe(true);
        expect(action.novelty.scope).toBe('canonical_trail');
      }
    }
  });

  it('porte les montants de la première phase exactement comme l’économie', () => {
    const expectations: Record<string, number> = {
      hike_session_processed: 40,
      trail_prepared: 30,
      checklist_completed: 25,
      kit_field_report: 20,
      place_review: 15,
      carnet_published: 60,
      itinerancy_completed: 45,
    };
    for (const [actionId, base] of Object.entries(expectations)) {
      expect(findRegistryV2Action(actionId)?.points.base).toBe(base);
    }
    expect(findRegistryV2Action('hike_session_processed')?.novelty?.points).toBe(20);
    expect(findRegistryV2Action('hike_session_processed')?.novelty?.maxTotal).toBe(150);
    expect(findRegistryV2Action('place_review')?.points.proofTiers?.withProof).toBe(40);
  });

  it('conserve les dix seuils de niveau à l’identique', () => {
    const thresholds = LEVEL_TIERS.map((tier) => tier.minPoints);
    expect(thresholds).toEqual([0, 100, 300, 700, 1500, 3000, 5500, 9000, 14000, 20000]);
    expect(LEVEL_TIERS.length).toBe(10);
  });

  it('jalonne les compétences sans crédit : 100/300/700/1500/3000', () => {
    expect(REGISTRY.skillMilestones).toEqual([100, 300, 700, 1500, 3000]);
    expect(skillMilestoneReached(0)).toBe(0);
    expect(skillMilestoneReached(99)).toBe(0);
    expect(skillMilestoneReached(100)).toBe(100);
    expect(skillMilestoneReached(2999)).toBe(1500);
    expect(skillMilestoneReached(3000)).toBe(3000);
    expect(skillMilestoneReached(100000)).toBe(3000);
  });

  it('gèle une date d’effet métier parseable et une politique de retard explicite', () => {
    const effective = new Date(PROGRESSION_REGISTRY_V2_EFFECTIVE_FROM);
    expect(Number.isNaN(effective.getTime())).toBe(false);
    expect(REGISTRY.latePolicy).toBe('lifetime_only');
    expect(REGISTRY.graceDays).toBe(14);
    expect(REGISTRY.seasonDurationWeeks).toBe(8);
  });

  it('applique les plafonds d’XP par famille de l’économie', () => {
    expect(REGISTRY.familyCaps).toEqual([
      { family: 'terrain', weekPoints: 600, seasonPoints: 4800 },
      { family: 'preparation', weekPoints: 120, seasonPoints: 960 },
      { family: 'partage', weekPoints: 180, seasonPoints: 1440 },
      { family: 'entraide', weekPoints: 180, seasonPoints: 1440 },
    ]);
    for (const family of PROGRESSION_FAMILIES) {
      expect(familyCapFor(family)).not.toBeNull();
    }
  });

  it('interdit toute conversion XP/argent et toute activation commerciale implicite', () => {
    const serialized = JSON.stringify(REGISTRY.commercial);
    expect(REGISTRY.commercial.conversionXpToMoney).toBe(false);
    expect(serialized).not.toMatch(/conversion(?!XpToMoney)[A-Za-z]*XpTo(Eur|Euro|Money|Cents)/i);
    // Aucun champ monétaire dans les actions : les montants sont en XP seulement.
    for (const action of REGISTRY.actions) {
      const keys = Object.keys(action);
      expect(keys).not.toContain('euros');
      expect(keys).not.toContain('cents');
      expect(keys).not.toContain('price');
      if (action.partsOnAward !== undefined) {
        expect(action.partsOnAward).toBeGreaterThan(0);
      }
    }
    expect(REGISTRY.commercial.activationGate).toMatch(/P6/);
  });

  it('déclare les comportements sans XP (garde-fous de gouvernance)', () => {
    expect(REGISTRY.nonAwarded.length).toBeGreaterThanOrEqual(20);
    const joined = REGISTRY.nonAwarded.join(' | ').toLowerCase();
    for (const marker of [
      'connexion',
      'like',
      'import gpx seul',
      'sos',
      'parrainage',
      'conversion de xp en argent',
    ]) {
      expect(joined).toContain(marker);
    }
  });

  it('déclare les actions des producteurs P1 comme sous-ensemble activable', () => {
    const p1 = REGISTRY.actions.filter((action) => action.firstPhase === 'P1').map((action) => action.id);
    expect(new Set(p1)).toEqual(
      new Set([
        'hike_session_processed',
        'itinerancy_completed',
        'trail_prepared',
        'checklist_completed',
        'kit_field_report',
        'place_review',
        'carnet_published',
      ])
    );
  });
});
