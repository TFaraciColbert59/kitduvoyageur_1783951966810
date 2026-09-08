import { describe, it, expect } from 'vitest';
import { hubSectionFromPathname } from '@/features/hub/registry/hubSectionRegistry';

/**
 * H3.1 — hubSectionFromPathname (miroir sectionIdFromPathname voyage),
 * ÉCRIT AVANT L'IMPLÉMENTATION. Le shell est URL-driven.
 */

describe('H3 — hubSectionFromPathname : section active depuis l’URL', () => {
  it('PATH-1: /hub = racine (null)', () => {
    expect(hubSectionFromPathname('/hub')).toBeNull();
    expect(hubSectionFromPathname('/hub/')).toBeNull();
    expect(hubSectionFromPathname(null)).toBeNull();
  });

  it('PATH-2: /hub/<segment> = section', () => {
    expect(hubSectionFromPathname('/hub/kit')).toBe('kit');
    expect(hubSectionFromPathname('/hub/alertes')).toBe('alertes');
    expect(hubSectionFromPathname('/hub/invitations')).toBe('invitations');
  });

  it('PATH-3: segment inconnu ou hors hub = null (jamais de crash)', () => {
    expect(hubSectionFromPathname('/hub/inconnu')).toBeNull();
    expect(hubSectionFromPathname('/voyages/gr20/kit')).toBeNull();
    expect(hubSectionFromPathname('/materiel')).toBeNull();
  });

  it('PATH-4: query et hash ignorés', () => {
    expect(hubSectionFromPathname('/hub/kit?x=1#top')).toBe('kit');
  });
});
