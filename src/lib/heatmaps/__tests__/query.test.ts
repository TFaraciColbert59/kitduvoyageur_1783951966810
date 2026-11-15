import { describe, expect, it } from 'vitest';
import {
  parseCommunityHeatmapQuery,
  parseOptOutBody,
  parsePersonalHeatmapQuery,
  parsePreferencesPatch,
} from '@/lib/heatmaps/query';

describe('parseCommunityHeatmapQuery', () => {
  it('applique les valeurs par défaut et le plancher public de 5 contributeurs', () => {
    const parsed = parseCommunityHeatmapQuery(new URLSearchParams(''));
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.value).toMatchObject({
      sport: 'all',
      timeWindow: 'global',
      minContributors: 5,
      gridResolutionDeg: 0.001,
    });
  });

  it("refuse un sport inconnu et une fenêtre inconnue", () => {
    expect(parseCommunityHeatmapQuery(new URLSearchParams('sport=surf'))).toMatchObject({
      ok: false,
      code: 'invalid_sport',
    });
    expect(parseCommunityHeatmapQuery(new URLSearchParams('window=month'))).toMatchObject({
      ok: false,
      code: 'invalid_window',
    });
  });

  it('ne laisse jamais descendre minContributors sous 5', () => {
    const parsed = parseCommunityHeatmapQuery(new URLSearchParams('minContributors=1'));
    expect(parsed.ok).toBe(true);
    if (parsed.ok) expect(parsed.value.minContributors).toBe(5);
  });

  it('borne la résolution de grille pour empêcher une reconstruction fine', () => {
    const parsed = parseCommunityHeatmapQuery(new URLSearchParams('gridResolutionDeg=0.00001'));
    expect(parsed.ok).toBe(true);
    if (parsed.ok) expect(parsed.value.gridResolutionDeg).toBeGreaterThanOrEqual(0.0002);
  });

  it('accepte les trois fenêtres S3.16, S3.17 et S3.18', () => {
    for (const window of ['global', 'last_7_days', 'nocturnal']) {
      expect(parseCommunityHeatmapQuery(new URLSearchParams(`window=${window}`)).ok).toBe(true);
    }
  });
});

describe('parsePersonalHeatmapQuery', () => {
  it('parse une période relative et une comparaison', () => {
    const parsed = parsePersonalHeatmapQuery(
      new URLSearchParams('period=last_30_days&comparePeriod=last_90_days')
    );
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.value.period).toEqual({ kind: 'last_30_days' });
    expect(parsed.value.comparePeriod).toEqual({ kind: 'last_90_days' });
  });

  it('exige des bornes valides pour une période personnalisée', () => {
    expect(parsePersonalHeatmapQuery(new URLSearchParams('period=custom'))).toMatchObject({
      ok: false,
      code: 'invalid_period_range',
    });
    expect(
      parsePersonalHeatmapQuery(
        new URLSearchParams('period=custom&from=2026-06-01T00:00:00.000Z&to=2026-05-01T00:00:00.000Z')
      )
    ).toMatchObject({ ok: false, code: 'invalid_period_range' });
  });

  it('transporte le filtre nocturne de la vue personnelle', () => {
    const parsed = parsePersonalHeatmapQuery(new URLSearchParams('nocturnalOnly=true'));
    expect(parsed.ok).toBe(true);
    if (parsed.ok) expect(parsed.value.period.nocturnalOnly).toBe(true);
  });
});

describe('parsePreferencesPatch', () => {
  it('accepte les quatre finalités S6.17', () => {
    const parsed = parsePreferencesPatch({
      globalHeatmap: true,
      globalHeatmapOptOut: false,
      routeRecommendations: true,
      mobilityAggregates: false,
    });
    expect(parsed.ok).toBe(true);
  });

  it('refuse un userId dans le corps (l’identité vient de la session)', () => {
    expect(parsePreferencesPatch({ userId: 'autre', globalHeatmap: true })).toMatchObject({
      ok: false,
      code: 'invalid_preferences',
    });
  });

  it('refuse un corps vide', () => {
    expect(parsePreferencesPatch({})).toMatchObject({ ok: false, code: 'empty_preferences' });
  });
});

describe('parseOptOutBody', () => {
  it('accepte un corps absent et un opt-out élargi', () => {
    expect(parseOptOutBody(null)).toEqual({ ok: true, value: { revokeAllAggregates: false } });
    expect(parseOptOutBody({ revokeAllAggregates: true })).toEqual({
      ok: true,
      value: { revokeAllAggregates: true },
    });
  });
});
