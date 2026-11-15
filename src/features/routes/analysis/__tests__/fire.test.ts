import { describe, expect, it } from 'vitest';
import { analyzeFireAlerts, type FireIncident } from '../fire';

const source = {
  name: 'Source de test',
  retrievedAt: '2026-07-01T10:00:00Z',
  license: 'test',
};

function route() {
  return Array.from({ length: 11 }, (_, index) => ({
    lat: 45,
    lon: 5 + index * 0.001,
  }));
}

describe('K2.23 — feux actifs et zones brûlées', () => {
  it('rend unavailable quand aucune source de feux n’est branchée', () => {
    const result = analyzeFireAlerts({ incidents: null, points: route() });

    expect(result.status).toBe('unavailable');
    expect(result.missing[0].code).toBe('fire_source_unavailable');
    expect(result.impacts).toEqual([]);
  });

  it('signale une alerte officielle qui recoupe le tracé', () => {
    const incident: FireIncident = {
      id: 'official-1',
      kind: 'official_alert',
      label: 'Massif fermé',
      geometry: {
        type: 'Polygon',
        coordinates: [
          [
            [5.004, 44.999],
            [5.006, 44.999],
            [5.006, 45.001],
            [5.004, 45.001],
            [5.004, 44.999],
          ],
        ] as const,
      },
    };

    const result = analyzeFireAlerts({
      incidents: [incident],
      points: route(),
      source,
      now: '2026-07-01T12:00:00Z',
    });

    expect(result.status).toBe('alerts');
    expect(result.impacts).toHaveLength(1);
    expect(result.impacts[0].official).toBe(true);
    expect(result.impacts[0].severity).toBe('warning');
    expect(result.impacts[0].closureStatus).toBe('unknown');
    expect(result.impacts[0].fromM).toBeGreaterThan(0);
    expect(result.layer[0].mapStyleKey).toBe('fire-official');
  });

  it('ne transforme pas un point chaud en fermeture de sentier', () => {
    const incident: FireIncident = {
      id: 'hotspot-1',
      kind: 'hotspot',
      geometry: { type: 'Point', coordinates: [5.005, 45] as const },
      radiusM: 100,
    };

    const result = analyzeFireAlerts({
      incidents: [incident],
      points: route(),
      source,
      now: '2026-07-01T12:00:00Z',
    });

    expect(result.status).toBe('alerts');
    expect(result.impacts[0].official).toBe(false);
    expect(result.impacts[0].severity).toBe('info');
    expect(result.impacts[0].closureStatus).toBe('not_a_closure');
    expect(result.impacts[0].message).toContain('pas une fermeture');
  });

  it('ignore un incident expiré et rend clear avec une source à jour', () => {
    const incident: FireIncident = {
      id: 'expired-1',
      kind: 'official_alert',
      geometry: { type: 'Point', coordinates: [5.005, 45] as const },
      radiusM: 100,
      validUntil: '2026-06-01T00:00:00Z',
    };

    const result = analyzeFireAlerts({
      incidents: [incident],
      points: route(),
      source,
      now: '2026-07-01T12:00:00Z',
    });

    expect(result.impacts).toHaveLength(0);
    expect(result.status).toBe('clear');
    expect(result.warnings.map((warning) => warning.code)).toContain('fire_incident_expired');
  });

  it('rend clear quand la source existe et ne contient aucun incident', () => {
    const result = analyzeFireAlerts({ incidents: [], points: route(), source });
    expect(result.status).toBe('clear');
  });
});
