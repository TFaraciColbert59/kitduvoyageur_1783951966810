import { describe, expect, it } from 'vitest';
import {
  fromMinorUnits,
  kmToMeters,
  metersToKm,
  normalizeCivilDate,
  normalizeCurrency,
  normalizeIanaTimeZone,
  toMinorUnits,
} from '@/features/hub/cockpit/normalization';
import { parseAdventureRef, validateMutationEnvelope } from '@/features/hub/cockpit/adventureRef';
import {
  cumulativeDistances,
  profileMetrics,
  projectPositionOnTrace,
} from '@/features/hub/cockpit/geoKernelContract';
import {
  applyProposal,
  clearDomainTelemetry,
  createProposal,
  recordDomainTelemetry,
  revertProposal,
  summarizeDomainTelemetry,
} from '@/features/hub/cockpit/hubObservability';

describe('cockpit core contracts (P01-14, P02-01/06/14, P04, P08-03/06)', () => {
  it('normalizes IANA timezones, civil dates, currencies and units', () => {
    expect(normalizeIanaTimeZone('Europe/Paris')).toBe('Europe/Paris');
    expect(normalizeIanaTimeZone('Invalid/Zone')).toBe('Europe/Paris');
    expect(normalizeCivilDate('2026-11-21T23:45:00Z', 'Europe/Paris')).toBe('2026-11-21');
    expect(normalizeCurrency('chf')).toBe('CHF');
    expect(normalizeCurrency('XYZ')).toBe('EUR');
    expect(toMinorUnits(19.99)).toBe(1999);
    expect(fromMinorUnits(1999)).toBe(19.99);
    expect(metersToKm(1450)).toBe(1.45);
    expect(kmToMeters(1.45)).toBe(1450);
  });

  it('parses canonical AdventureRef including activite_libre and validates mutation envelopes', () => {
    const id = 'a0000000-0000-4000-8000-000000000001';
    const op = 'b0000000-0000-4000-8000-000000000002';
    const ref = parseAdventureRef({ nature: 'activite_libre', id, slug: 'sortie-2h', title: 'Boucle 2h', routeRevision: 3 });
    expect(ref?.nature).toBe('activite_libre');
    expect(ref?.routeRevision).toBe(3);
    expect(parseAdventureRef({ nature: 'unknown', id })).toBeNull();

    expect(validateMutationEnvelope({ adventureId: id, operationId: op, expectedVersion: 1, source: 'hub', payload: {} })).toEqual({ ok: true });
    expect(validateMutationEnvelope({ adventureId: 'bad', operationId: op, expectedVersion: 1, source: 'hub', payload: {} }).ok).toBe(false);
  });

  it('computes TypedArray geo metrics across anti-meridian and detects missing elevation', () => {
    const trace = new Float64Array([179.99, 0, -179.99, 0]);
    const dists = cumulativeDistances(trace);
    expect(dists[0]).toBe(0);
    // 0.02° à l'équateur ≈ 2 224 m (et non ~40 000 km !)
    expect(dists[1]).toBeGreaterThan(2000);
    expect(dists[1]).toBeLessThan(2500);

    const metrics = profileMetrics(
      new Float32Array([1000, 1250, NaN, 1100]),
      new Uint8Array([1, 1, 0, 1]),
      new Float64Array([0, 1000, 2000, 3000]),
    );
    expect(metrics).toEqual({ gainM: 250, lossM: 150, coveredM: 3000 });

    const proj = projectPositionOnTrace(
      new Float64Array([6.86, 45.92, 6.87, 45.92, 6.88, 45.92]),
      cumulativeDistances(new Float64Array([6.86, 45.92, 6.87, 45.92, 6.88, 45.92])),
      6.87,
      45.9201,
    );
    expect(proj).not.toBeNull();
    expect(proj!.segmentIndex).toBe(1);
    expect(proj!.crossM).toBeLessThan(20);
  });

  it('tracks domain telemetry and applies/reverts proposals cleanly', () => {
    clearDomainTelemetry();
    recordDomainTelemetry('meteo', 'fetch_point', 85, 'ok');
    recordDomainTelemetry('meteo', 'fetch_point', 210, 'degraded');
    expect(summarizeDomainTelemetry('meteo')).toEqual({ count: 2, errors: 0, degraded: 1, p95Ms: 210 });

    const prop = createProposal('p1', 'Décaler départ', { start: '08:00' }, { start: '07:00' });
    const applied = applyProposal(prop);
    expect(applied.state).toEqual({ start: '07:00' });
    expect(applied.proposal.status).toBe('applied');
    const reverted = revertProposal(applied.proposal);
    expect(reverted.state).toEqual({ start: '08:00' });
    expect(reverted.proposal.status).toBe('reverted');
  });
});
