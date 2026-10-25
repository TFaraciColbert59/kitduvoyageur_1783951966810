import { describe, it, expect } from 'vitest';
import {
  PHASE10_SLOS,
  alertDecision,
  evaluatePhase10Slos,
  evaluateSlo,
  type SloDefinition,
} from '@/lib/observability/slo';

describe('Phase 10 — SLO & alertes comme code (TEST-P10-SLO)', () => {
  it('TEST-P10-SLO-01: le tableau Phase 10 est versionné (dispo, p95 lecture/écriture, 5xx, zéro, jobs)', () => {
    const byId = Object.fromEntries(PHASE10_SLOS.map((slo) => [slo.id, slo]));

    expect(byId.api_availability_ratio.target).toBe(0.999);
    expect(byId.api_read_p95_ms.target).toBe(300);
    expect(byId.api_write_p95_ms.target).toBe(500);
    expect(byId.http_5xx_ratio.target).toBe(0.01);
    for (const id of [
      'destructive_syncs',
      'rls_violations',
      'carnet_entry_loss',
    ] as const) {
      expect(byId[id].target).toBe(0);
      expect(byId[id].comparator).toBe('eq');
    }
    expect(byId.jobs_pending_events.target).toBe(50);
    expect(byId.jobs_oldest_pending_min.target).toBe(60);
    for (const slo of PHASE10_SLOS) {
      expect(slo.source.length).toBeGreaterThan(0);
      expect(slo.label.length).toBeGreaterThan(0);
    }
  });

  it('TEST-P10-SLO-02: mesure absente ⇒ insufficient_data, jamais pass', () => {
    const definition = PHASE10_SLOS.find((slo) => slo.id === 'api_write_p95_ms') as SloDefinition;

    const missing = evaluateSlo(definition, {});
    expect(missing.status).toBe('insufficient_data');
    expect(missing.observed).toBeNull();

    const nulled = evaluateSlo(definition, { api_write_p95_ms: null });
    expect(nulled.status).toBe('insufficient_data');

    const nan = evaluateSlo(definition, { api_write_p95_ms: Number.NaN });
    expect(nan.status).toBe('insufficient_data');
  });

  it('TEST-P10-SLO-03: seuils évalués correctement (gte / lte / eq)', () => {
    expect(evaluateSlo(PHASE10_SLOS[0], { api_availability_ratio: 0.9995 }).status).toBe('pass');
    expect(evaluateSlo(PHASE10_SLOS[0], { api_availability_ratio: 0.9989 }).status).toBe('fail');

    const read = PHASE10_SLOS.find((slo) => slo.id === 'api_read_p95_ms') as SloDefinition;
    expect(evaluateSlo(read, { api_read_p95_ms: 299 }).status).toBe('pass');
    expect(evaluateSlo(read, { api_read_p95_ms: 301 }).status).toBe('fail');

    const rls = PHASE10_SLOS.find((slo) => slo.id === 'rls_violations') as SloDefinition;
    expect(evaluateSlo(rls, { rls_violations: 0 }).status).toBe('pass');
    expect(evaluateSlo(rls, { rls_violations: 1 }).status).toBe('fail');

    const pending = PHASE10_SLOS.find((slo) => slo.id === 'jobs_pending_events') as SloDefinition;
    expect(evaluateSlo(pending, { jobs_pending_events: 50 }).status).toBe('pass');
    expect(evaluateSlo(pending, { jobs_pending_events: 51 }).status).toBe('fail');
  });

  it('TEST-P10-SLO-04: rapport complet — échecs ⇒ ok=false, alertes paginables', () => {
    const report = evaluatePhase10Slos(
      {
        api_availability_ratio: 0.9999,
        api_read_p95_ms: 142,
        http_5xx_ratio: 0.002,
        destructive_syncs: 0,
        rls_violations: 1,
        carnet_entry_loss: 0,
        jobs_pending_events: 12,
        jobs_oldest_pending_min: 4,
      },
      PHASE10_SLOS,
      '2026-09-12T00:00:00.000Z'
    );

    expect(report.ok).toBe(false);
    expect(report.complete).toBe(false);
    expect(report.failures).toHaveLength(1);
    expect(report.failures[0].id).toBe('rls_violations');
    expect(report.alerts[0]).toContain('[SLO rls_violations]');
    expect(report.insufficient.map((item) => item.id)).toEqual(['api_write_p95_ms']);

    const decision = alertDecision(report);
    expect(decision.level).toBe('alert');
    expect(decision.page).toBe(true);
    expect(decision.messages.join(' ')).toContain('rls_violations');
  });

  it('TEST-P10-SLO-05: tout vert n’est « complet » que si toutes les mesures sont présentes', () => {
    const partial = evaluatePhase10Slos({
      api_read_p95_ms: 100,
      jobs_pending_events: 0,
    });
    expect(partial.ok).toBe(true);
    expect(partial.complete).toBe(false);
    expect(alertDecision(partial).level).toBe('incomplete');
    expect(alertDecision(partial).page).toBe(false);
    expect(alertDecision(partial).messages.join(' ')).toContain('instrumentation requise');

    const full = evaluatePhase10Slos({
      api_availability_ratio: 0.9999,
      api_read_p95_ms: 100,
      api_write_p95_ms: 200,
      http_5xx_ratio: 0,
      destructive_syncs: 0,
      rls_violations: 0,
      carnet_entry_loss: 0,
      jobs_pending_events: 0,
      jobs_oldest_pending_min: 0,
    });
    expect(full.ok).toBe(true);
    expect(full.complete).toBe(true);
    expect(alertDecision(full)).toEqual({ level: 'none', page: false, messages: [] });
  });
});
