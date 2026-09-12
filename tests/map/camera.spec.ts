import { describe, it, expect } from 'vitest';
import {
  animationDuration,
  buildFlyToParams,
  computeCountryFlight,
  haversineKm,
} from '@/components/map/engine/camera';
import { resolveCountryName, resolveIsoA2 } from '@/components/map/engine/geo';

describe('ATLAS — caméra (Phase 4)', () => {
  it('respecte prefers-reduced-motion (durée 0) et garde la durée native sinon', () => {
    expect(animationDuration(700, true)).toBe(0);
    expect(animationDuration(700, false)).toBe(700);
    expect(animationDuration(0, false)).toBe(0);
  });
});

describe('FLUIDITÉ — vol pays courbe, principe Van Wijk (F1)', () => {
  it('calcule une distance haversine réaliste (Paris–Londres ≈ 344 km)', () => {
    const km = haversineKm([2.3522, 48.8566], [-0.1276, 51.5072]);
    expect(km).toBeGreaterThan(320);
    expect(km).toBeLessThan(370);
  });

  it('vol antipodal (France → Nouvelle-Zélande) : Van Wijk + garde-fous', () => {
    const flight = computeCountryFlight(
      { center: [2.3, 46.6], zoom: 5 },
      { center: [174, -41], zoom: 4.6 },
      { isMobile: false }
    );
    expect(flight.curve).toBe(1.42);
    expect(flight.essential).toBe(true);
    expect(flight.maxDuration).toBe(8000);
    expect(flight.minZoom).toBe(2);
    expect(flight.speed).toBeGreaterThanOrEqual(0.8);
    expect(flight.speed).toBeLessThanOrEqual(2);
  });

  it('vol court : la vitesse ne descend jamais sous la borne basse', () => {
    const flight = computeCountryFlight(
      { center: [2.3, 46.6], zoom: 5 },
      { center: [8.7, 50.1], zoom: 4.6 },
      { isMobile: false }
    );
    expect(flight.speed).toBeGreaterThanOrEqual(0.8);
  });

  it('les très longs trajets ralentissent légèrement (mesure F1 : le bonus inversait la perception)', () => {
    const near = computeCountryFlight(
      { center: [2.3, 46.6], zoom: 5 },
      { center: [8.7, 50.1], zoom: 4.6 },
      { isMobile: false }
    );
    const far = computeCountryFlight(
      { center: [2.3, 46.6], zoom: 1.2 },
      { center: [174, -41], zoom: 4.6 },
      { isMobile: false }
    );
    expect(far.speed).toBeLessThan(near.speed);
    expect(far.speed).toBeGreaterThanOrEqual(0.8);
  });

  it('mobile : vitesse perçue légèrement réduite à distance égale', () => {
    const from = { center: [2.3, 46.6] as [number, number], zoom: 5 };
    const to = { center: [174, -41] as [number, number], zoom: 4.6 };
    const desktop = computeCountryFlight(from, to, { isMobile: false });
    const mobile = computeCountryFlight(from, to, { isMobile: true });
    expect(mobile.speed).toBeLessThanOrEqual(desktop.speed);
  });

  it('buildFlyToParams : reduced-motion ⇒ saut instantané, AUCUN curve/speed (FLU-R3)', () => {
    const params = buildFlyToParams(
      { center: [2, 46], zoom: 4.6, curve: 1.42, speed: 1.5, maxDuration: 8000, minZoom: 2, essential: true },
      true
    );
    expect(params).toEqual({ center: [2, 46], zoom: 4.6, duration: 0 });
  });

  it('buildFlyToParams : vol normal ⇒ transmet curve/speed/maxDuration/minZoom/essential', () => {
    const params = buildFlyToParams(
      { center: [2, 46], zoom: 4.6, curve: 1.42, speed: 1.5, maxDuration: 8000, minZoom: 2, essential: true },
      false
    );
    expect(params).toMatchObject({
      curve: 1.42,
      speed: 1.5,
      maxDuration: 8000,
      minZoom: 2,
      essential: true,
    });
    expect('duration' in params).toBe(false);
  });

  it('les sauts courts gardent leur duration fixe (pas de sur-ingénierie)', () => {
    const params = buildFlyToParams({ center: [2, 46], zoom: 12, duration: 600 }, false);
    expect(params).toEqual({ center: [2, 46], zoom: 12, duration: 600 });
  });
});

describe('ATLAS — résolution ISO / nom pays (couche monde)', () => {
  it('résout dans l’ordre ISO_A2 > ISO_A2_EH > WB_A2 > ADM0_A3 en excluant -99/-3', () => {
    expect(resolveIsoA2({ ISO_A2: 'FR' })).toBe('FR');
    expect(resolveIsoA2({ ISO_A2: '-99', ISO_A2_EH: 'NO' })).toBe('NO');
    expect(resolveIsoA2({ ISO_A2: '-99', WB_A2: 'BE' })).toBe('BE');
    expect(resolveIsoA2({ ISO_A2: '-99' })).toBeNull();
    expect(resolveIsoA2({ ADM0_A3: 'FRA' })).toBeNull();
    expect(resolveIsoA2(null)).toBeNull();
  });

  it('résout le nom d’affichage sans inventer', () => {
    expect(resolveCountryName({ NAME: 'France' })).toBe('France');
    expect(resolveCountryName({ NAME_EN: 'Belgium' })).toBe('Belgium');
    expect(resolveCountryName({})).toBe('');
    expect(resolveCountryName(null)).toBe('');
  });
});
