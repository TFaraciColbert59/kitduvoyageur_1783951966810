/**
 * Observabilité par domaine (sans PII/secrets) et propositions réversibles (P08-03, P08-06).
 */

import type { HubWidgetDomain } from './geoCatalog';

export interface DomainTelemetrySample {
  domain: HubWidgetDomain;
  operation: string;
  durationMs: number;
  outcome: 'ok' | 'degraded' | 'error';
  at: string;
}

const MAX_SAMPLES = 200;
const samples: DomainTelemetrySample[] = [];

export function recordDomainTelemetry(
  domain: HubWidgetDomain,
  operation: string,
  durationMs: number,
  outcome: 'ok' | 'degraded' | 'error',
): void {
  samples.push({
    domain,
    operation,
    durationMs: Math.max(0, Math.round(durationMs * 10) / 10),
    outcome,
    at: new Date().toISOString(),
  });
  if (samples.length > MAX_SAMPLES) samples.shift();
}

export function summarizeDomainTelemetry(domain?: HubWidgetDomain) {
  const list = domain ? samples.filter((s) => s.domain === domain) : samples;
  const errors = list.filter((s) => s.outcome === 'error').length;
  const degraded = list.filter((s) => s.outcome === 'degraded').length;
  const durations = list.map((s) => s.durationMs).sort((a, b) => a - b);
  const p95 = durations.length ? durations[Math.min(durations.length - 1, Math.floor(durations.length * 0.95))] : 0;
  return { count: list.length, errors, degraded, p95Ms: p95 };
}

export function clearDomainTelemetry(): void {
  samples.length = 0;
}

export interface ReversibleProposal<TState> {
  id: string;
  label: string;
  before: TState;
  after: TState;
  status: 'proposed' | 'applied' | 'reverted';
}

export function createProposal<TState>(id: string, label: string, before: TState, after: TState): ReversibleProposal<TState> {
  return { id, label, before, after, status: 'proposed' };
}

export function applyProposal<TState>(proposal: ReversibleProposal<TState>): { proposal: ReversibleProposal<TState>; state: TState } {
  return { proposal: { ...proposal, status: 'applied' }, state: proposal.after };
}

export function revertProposal<TState>(proposal: ReversibleProposal<TState>): { proposal: ReversibleProposal<TState>; state: TState } {
  return { proposal: { ...proposal, status: 'reverted' }, state: proposal.before };
}
