import { describe, it, expect } from 'vitest';
import { projectTraceToSvg } from '../../src/features/trips/lib/traceSvg';

const W = 240;
const H = 90;
const P = 10;

describe('projectTraceToSvg', () => {
  it('retourne null si moins de 2 points géolocalisés', () => {
    expect(projectTraceToSvg([], W, H)).toBeNull();
    expect(projectTraceToSvg([{ lat: 1, lng: 2 }], W, H)).toBeNull();
  });

  it('ignore les points non finis mais garde le tracé si ≥ 2 valides', () => {
    const raw = [
      { lat: 0, lng: 0 },
      { lat: Number.NaN, lng: Number.NaN },
      { lat: 10, lng: 10 },
    ];
    const out = projectTraceToSvg(raw, W, H);
    expect(out).not.toBeNull();
    expect(out!.points).toHaveLength(2);
  });

  it('respecte la viewBox avec padding', () => {
    const raw = [
      { lat: 45.0, lng: 6.0 },
      { lat: 45.5, lng: 6.5 },
      { lat: 45.2, lng: 6.3 },
    ];
    const out = projectTraceToSvg(raw, W, H)!;
    for (const p of out.points) {
      expect(p.x).toBeGreaterThanOrEqual(P - 0.01);
      expect(p.x).toBeLessThanOrEqual(W - P + 0.01);
      expect(p.y).toBeGreaterThanOrEqual(P - 0.01);
      expect(p.y).toBeLessThanOrEqual(H - P + 0.01);
    }
  });

  it('gère les points confondus (aire nulle) sans NaN', () => {
    const raw = [
      { lat: 45.1, lng: 6.1 },
      { lat: 45.1, lng: 6.1 },
      { lat: 45.1, lng: 6.1 },
    ];
    const out = projectTraceToSvg(raw, W, H)!;
    for (const p of out.points) {
      expect(Number.isFinite(p.x)).toBe(true);
      expect(Number.isFinite(p.y)).toBe(true);
    }
    expect(out.polyline).toMatch(/^[\d.,\s]+$/);
  });

  it('place le point le plus au nord en haut (y inversé)', () => {
    const raw = [
      { lat: 45.0, lng: 6.0 },
      { lat: 46.0, lng: 6.0 },
    ];
    const out = projectTraceToSvg(raw, W, H)!;
    const [south, north] = out.points;
    expect(north.y).toBeLessThan(south.y);
  });

  it('sérialise la polyline au format "x,y x,y"', () => {
    const raw = [
      { lat: 45.0, lng: 6.0 },
      { lat: 45.1, lng: 6.1 },
    ];
    const out = projectTraceToSvg(raw, W, H)!;
    expect(out.polyline.split(' ')).toHaveLength(2);
    expect(out.polyline.split(' ')[0]).toMatch(/^\d+\.\d,\d+\.\d$/);
  });
});
