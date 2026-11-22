import { describe, expect, it } from 'vitest';
import { surfaceBreakdown } from '../surfaces';
import { baseWorkspace, basePoints, section } from './fixtures';

describe('surfaceBreakdown', () => {
  it('pourcentages par étape et globaux', () => {
    const [a, b, c] = basePoints();
    const ws = baseWorkspace({
      sections: [
        section('s1', a, b, { surfaceSegments: [{ fromRatio: 0, toRatio: 0.5, surface: 'paved' }, { fromRatio: 0.5, toRatio: 1, surface: 'trail' }] }),
        section('s2', b, c, { surfaceSegments: [{ fromRatio: 0, toRatio: 1, surface: 'unpaved' }] }),
      ],
    });
    const r = surfaceBreakdown(ws);
    expect(r.perStage[0].pct).toEqual({ goudron: 50, piste: 0, sentier: 50, inconnu: 0 });
    expect(r.perStage[1].pct?.piste).toBe(100);
    expect(r.overall.pct).toEqual({ goudron: 25, piste: 50, sentier: 25, inconnu: 0 });
    expect(r.overall.method).toContain('segments de surface');
  });
  it('donnée absente : « inconnu », pas du sentier par défaut', () => {
    const [a, b, c] = basePoints();
    const ws = baseWorkspace({
      sections: [section('s1', a, b, { surfaceSegments: [] }), section('s2', b, c, { surfaceSegments: [{ fromRatio: 0, toRatio: 0.6, surface: 'rock' }, { fromRatio: 0.6, toRatio: 1, surface: 'unknown' }] })],
    });
    const r = surfaceBreakdown(ws);
    expect(r.perStage[0].pct?.inconnu).toBe(100);
    expect(r.perStage[1].pct).toEqual({ goudron: 0, piste: 0, sentier: 60, inconnu: 40 });
  });
  it('segments qui se chevauchent : jamais plus de 100 %', () => {
    const [a, b] = basePoints();
    const ws = baseWorkspace({
      sections: [section('s1', a, b, { surfaceSegments: [{ fromRatio: 0, toRatio: 0.8, surface: 'paved' }, { fromRatio: 0.5, toRatio: 1, surface: 'trail' }] })],
      stages: [],
    });
    const pct = surfaceBreakdown(ws).overall.pct!;
    expect(pct.goudron + pct.piste + pct.sentier + pct.inconnu).toBeCloseTo(100, 0);
  });
  it('aucun tronçon : pas de pourcentage', () => {
    expect(surfaceBreakdown(baseWorkspace({ sections: [] })).overall.pct).toBeNull();
  });
});
