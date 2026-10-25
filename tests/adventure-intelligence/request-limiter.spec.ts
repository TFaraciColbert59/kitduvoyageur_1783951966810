import { describe, it, expect } from 'vitest';
import {
  consumeToken,
  createTokenBucket,
  DEFAULT_BUCKET_CAPACITY,
  DEFAULT_REFILL_PER_SECOND,
  PUBLIC_READ_BUCKET_CAPACITY,
  PUBLIC_READ_REFILL_PER_SECOND,
  type TokenBucket,
} from '@/features/adventure-intelligence/domain/requestLimiter';

describe('A11 — limiteur à jetons pur (TEST-A11-LIM)', () => {
  it('TEST-A11-LIM-01: autorise la rafale initiale puis refuse avec Retry-After', () => {
    let bucket = createTokenBucket(0, 3);

    for (let index = 0; index < 3; index += 1) {
      const result = consumeToken(bucket, 0, { capacity: 3, refillPerSecond: 1 });
      expect(result.allowed).toBe(true);
      bucket = result.bucket;
    }

    const denied = consumeToken(bucket, 0, { capacity: 3, refillPerSecond: 1 });
    expect(denied.allowed).toBe(false);
    expect(denied.bucket.tokens).toBe(0);
    expect(denied.retryAfterSeconds).toBe(1);
  });

  it('TEST-A11-LIM-02: recharge linéairement et plafonne à la capacité', () => {
    const afterBurst = consumeToken(createTokenBucket(0, 2), 0, {
      capacity: 2,
      refillPerSecond: 1,
    }).bucket;

    const later = consumeToken(afterBurst, 1000, { capacity: 2, refillPerSecond: 1 });
    expect(later.allowed).toBe(true);
    expect(later.bucket.tokens).toBe(1);

    const capped = consumeToken({ tokens: 0, updatedAtMs: 0 }, 3_600_000, {
      capacity: 2,
      refillPerSecond: 1,
    });
    expect(capped.allowed).toBe(true);
    expect(capped.bucket.tokens).toBe(1);
  });

  it('TEST-A11-LIM-03: une horloge inversée ne recharge jamais et ne mute pas l’entrée', () => {
    const original: TokenBucket = { tokens: 0.2, updatedAtMs: 1000 };

    const denied = consumeToken(original, 500, { capacity: 1, refillPerSecond: 1 });

    expect(denied.allowed).toBe(false);
    expect(denied.bucket.tokens).toBeCloseTo(0.2, 5);
    expect(original).toEqual({ tokens: 0.2, updatedAtMs: 1000 });
  });

  it('TEST-A11-LIM-04: les constantes des lectures publiques sont bornées', () => {
    expect(DEFAULT_BUCKET_CAPACITY).toBe(60);
    expect(DEFAULT_REFILL_PER_SECOND).toBe(1);
    expect(PUBLIC_READ_BUCKET_CAPACITY).toBe(30);
    expect(PUBLIC_READ_REFILL_PER_SECOND).toBe(0.5);
    expect(PUBLIC_READ_BUCKET_CAPACITY).toBeGreaterThan(0);
  });
});
