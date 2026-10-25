import { describe, it, expect } from 'vitest';
import {
  serializeActiveTrip,
  deserializeActiveTrip,
  activeTripSchema,
  type ActiveTripData,
} from '@/features/trips/context/activeTripSchema';

describe('Phase 6.1 — Contexte de Voyage Actif (Cookie httpOnly & Sécurité)', () => {
  const mockTripData: ActiveTripData = {
    id: '1b694721-8e08-46b9-9e83-aae4de36d1c9',
    slug: 'trek-mercantour-2026',
    title: 'Trek du Mercantour',
    crewSlug: 'alpinistes-du-nord',
  };

  it('validates active trip schema strictly and ignores sensitive fields', () => {
    const rawData = {
      ...mockTripData,
      password: 'sensitive_leak',
      auth_token: 'secret_token_123',
    };

    const parsed = activeTripSchema.safeParse(rawData);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data).toEqual(mockTripData);
      expect((parsed.data as any).password).toBeUndefined();
      expect((parsed.data as any).auth_token).toBeUndefined();
    }
  });

  it('serializes active trip to a compact URL-safe base64/json string', () => {
    const serialized = serializeActiveTrip(mockTripData);
    expect(typeof serialized).toBe('string');
    expect(serialized.length).toBeGreaterThan(10);
    expect(serialized).not.toContain('sensitive_leak');
  });

  it('deserializes a valid active trip string accurately', () => {
    const serialized = serializeActiveTrip(mockTripData);
    const deserialized = deserializeActiveTrip(serialized);
    expect(deserialized).toEqual(mockTripData);
  });

  it('gracefully handles corrupted, tampered, or invalid cookie values', () => {
    expect(deserializeActiveTrip('')).toBeNull();
    expect(deserializeActiveTrip('not-valid-base64-json!')).toBeNull();
    expect(deserializeActiveTrip(JSON.stringify({ bad: 'structure' }))).toBeNull();
    expect(deserializeActiveTrip(null as any)).toBeNull();
  });
});
