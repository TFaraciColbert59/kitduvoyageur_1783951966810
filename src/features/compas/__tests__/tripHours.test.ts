import { describe, expect, it } from 'vitest';
import { tripHours } from '../components/CompasRuler';
import type { CompasModel } from '../engine/compasModel';

const model = (hours: number | null, durationMin: number | null) =>
  ({ dates: { hours }, route: { durationMin } }) as unknown as CompasModel;

describe('tripHours', () => {
  it('sans date, la durée dite (« 5 jours ») prime sur le temps de marche du tracé', () => {
    expect(tripHours(model(null, 11_160), 5)).toBe(120);
  });
  it('les dates priment, puis le tracé', () => {
    expect(tripHours(model(48, 11_160), 5)).toBe(48);
    expect(tripHours(model(null, 90), null)).toBe(1.5);
    expect(tripHours(model(null, null))).toBeNull();
  });
});
