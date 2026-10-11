/**
 * T12 — Catalogue de missions versionné :
 *   (a) les huit catégories du brief sont couvertes (modèle ouvert ou
 *       dépendance fermée explicite) ;
 *   (b) aucun modèle disponible ne cite un producteur indisponible ;
 *   (c) aucune promesse de points/XP dans le catalogue (fin de mission =
 *       distinction, 0 XP supplémentaire) ;
 *   (d) identifiants uniques, versions et provenances complètes.
 */
import { describe, it, expect } from 'vitest';
import {
  ACTIVE_PRODUCER_ACTIONS,
  MISSION_CATALOG_V2,
  MISSION_CATEGORIES,
  availableMissionModels,
  findMissionModel,
  missionCompletionGrantsXp,
} from '@/features/progression/domain/missionCatalog';

const ACTIVE = new Set<string>(ACTIVE_PRODUCER_ACTIONS);

describe('catalogue de missions T12', () => {
  it('(a) couvre les huit catégories : modèle ouvert ou dépendance fermée explicite', () => {
    expect(MISSION_CATEGORIES).toHaveLength(8);
    for (const category of MISSION_CATEGORIES) {
      const models = MISSION_CATALOG_V2.filter((model) => model.category === category);
      expect(models.length, `catégorie sans modèle : ${category}`).toBeGreaterThan(0);
    }
    // Les catégories sans producteur prêt sont fermées AVEC leur raison.
    for (const category of ['cooperation', 'collection', 'formation', 'personnelle'] as const) {
      const models = MISSION_CATALOG_V2.filter((model) => model.category === category);
      expect(models.every((model) => model.status === 'closed')).toBe(true);
      expect(models.every((model) => (model.closedReason ?? '').length > 10)).toBe(true);
    }
    expect(availableMissionModels().length).toBeGreaterThan(0);
  });

  it('(b) aucun modèle disponible ne cite un producteur indisponible ; les fermés n’en citent aucun', () => {
    for (const model of MISSION_CATALOG_V2) {
      for (const action of model.sourceActions) {
        expect(ACTIVE.has(action), `${model.id} cite ${action}`).toBe(true);
      }
      if (model.status === 'available') {
        expect(model.sourceActions.length, `${model.id} sans action source`).toBeGreaterThan(0);
        expect(model.closedReason).toBeUndefined();
      } else {
        expect(model.sourceActions).toHaveLength(0);
      }
    }
  });

  it('(c) aucune promesse de points : pas de champ montant, textes sans montant', () => {
    const forbiddenKeys = /point|xp|reward|grant/i;
    for (const model of MISSION_CATALOG_V2) {
      for (const key of Object.keys(model)) {
        expect(forbiddenKeys.test(key), `${model.id}.${key}`).toBe(false);
      }
      const text = `${model.title} ${model.description}`;
      expect(/\d+\s*(points?|xp)/i.test(text), model.id).toBe(false);
      expect(/\b(xp|points)\b/i.test(text), model.id).toBe(false);
    }
    expect(missionCompletionGrantsXp()).toBe(false);
  });

  it('(d) identifiants uniques, versions ≥ 1, provenance canonique, seuils valides', () => {
    const ids = MISSION_CATALOG_V2.map((model) => model.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const model of MISSION_CATALOG_V2) {
      expect(Number.isInteger(model.version) && model.version >= 1, model.id).toBe(true);
      expect(model.provenance).toBe('canonical_v2');
      expect(model.targetCount).toBeGreaterThanOrEqual(1);
      expect(['ever', 'week', 'season']).toContain(model.period);
    }
  });

  it('findMissionModel : connu → modèle, inconnu → null', () => {
    expect(findMissionModel('mission_prep_departure_checks')?.title).toBe('Contrôles de départ');
    expect(findMissionModel('mission_inexistante')).toBeNull();
  });
});
