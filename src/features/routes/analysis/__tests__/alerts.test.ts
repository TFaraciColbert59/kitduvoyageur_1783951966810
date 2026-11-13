import { describe, expect, it } from 'vitest';
import { analyzeRouteAlerts } from '../alerts';
import type { GeoPointInput } from '../geo';

function line(count = 6): GeoPointInput[] {
  return Array.from({ length: count }, (_, index) => ({
    lat: 45,
    lon: 5 + index * 0.001,
  }));
}

describe('K2.22 — escaliers, ferry et petit aller-retour', () => {
  it('signale les escaliers et le ferry à partir des étiquettes de tronçon', () => {
    const result = analyzeRouteAlerts({
      points: line(),
      totalLengthM: 1000,
      sport: 'vtt',
      sections: [
        { fromM: 0, toM: 100, wayType: 'steps' },
        { fromM: 200, toM: 300, wayType: 'ferry' },
      ],
    });

    expect(result.status).toBe('alerts');
    expect(result.alerts.map((alert) => alert.kind)).toEqual(['stairs', 'ferry']);
    expect(result.alerts[0].severity).toBe('warning');
    expect(result.alerts[0].suggestedAction).toBe('avoid_steps');
    expect(result.alerts[1].recalculable).toBe(false);
  });

  it('détecte un petit aller-retour sur la géométrie', () => {
    const result = analyzeRouteAlerts({
      points: [
        { lat: 45, lon: 5 },
        { lat: 45, lon: 5.001 },
        { lat: 45, lon: 5.002 },
        { lat: 45, lon: 5.001 },
        { lat: 45, lon: 5 },
      ],
      sections: [],
      totalLengthM: 400,
    });

    expect(result.status).toBe('alerts');
    expect(result.alerts).toHaveLength(1);
    expect(result.alerts[0].kind).toBe('out_and_back');
    expect(result.alerts[0].recalculable).toBe(true);
    expect(result.alerts[0].lengthM).toBeGreaterThan(300);
  });

  it('ne confond pas une petite boucle avec un aller-retour', () => {
    const result = analyzeRouteAlerts({
      points: [
        { lat: 45, lon: 5 },
        { lat: 45, lon: 5.002 },
        { lat: 45.001, lon: 5.002 },
        { lat: 45.001, lon: 5 },
        { lat: 45, lon: 5 },
      ],
      sections: [],
      totalLengthM: 600,
    });

    expect(result.alerts.filter((alert) => alert.kind === 'out_and_back')).toHaveLength(0);
  });

  it('dit explicitement que les escaliers et le ferry ne sont pas vérifiables sans tronçons', () => {
    const result = analyzeRouteAlerts({ points: line(), totalLengthM: 1000 });

    expect(result.status).toBe('partial');
    expect(result.checked.stairs).toBe(false);
    expect(result.checked.ferry).toBe(false);
    expect(result.unavailableChecks.map((gap) => gap.code)).toContain('alert_sections_unavailable');
  });

  it('rend unavailable quand aucune source ni géométrie ne permet de vérifier', () => {
    const result = analyzeRouteAlerts({ sections: null, points: null });

    expect(result.status).toBe('unavailable');
    expect(result.missing.length).toBeGreaterThan(0);
  });
});
