import { describe, expect, it } from 'vitest';

import { COMMAND_STATUS, buildCommandIdempotencyKey, canonicalJson } from '@/server/admin/commands';

describe('command engine', () => {
  it('expose les 11 statuts canoniques', () => {
    expect(COMMAND_STATUS).toEqual([
      'drafted',
      'validated',
      'awaiting_approval',
      'approved',
      'executing',
      'succeeded',
      'partially_succeeded',
      'failed',
      'unknown',
      'cancelled',
      'rolled_back',
    ]);
  });

  it('construit une clé idempotence déterministe', () => {
    const a = buildCommandIdempotencyKey({ command_key: 'commerce.refund', resource_type: 'order', resource_id: 'o1', reason: 'x' });
    const b = buildCommandIdempotencyKey({ command_key: 'commerce.refund', resource_type: 'order', resource_id: 'o1', reason: 'x' });
    expect(a).toBe(b);
    expect(a.length).toBeGreaterThan(16);
  });

  it('payload différent → clé différente (anti flip-flop)', () => {
    const fp = { command_key: 'marketplace.listing.restrict', resource_type: 'listing', resource_id: 'l1', reason: 'motif suffisant ici' };
    const a = buildCommandIdempotencyKey(fp, { status: 'restreinte' });
    const b = buildCommandIdempotencyKey(fp, { status: 'actif' });
    expect(a).not.toBe(b);
  });

  it('canonicalJson trie les clés (ordre insertion indifférent)', () => {
    expect(canonicalJson({ b: 1, a: 2 })).toBe(canonicalJson({ a: 2, b: 1 }));
  });
});
