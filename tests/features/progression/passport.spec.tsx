// @vitest-environment jsdom
/**
 * T19 — passeport privé (composant de présentation) :
 *   (a) compte par type + provenance lisible + dates ;
 *   (b) aucun contenu interdit (trace, coordonnée, identité) même si un
 *       payload hostile en injecte ;
 *   (c) états vide / indisponible distincts et honnêtes ;
 *   (d) liste bornée à 20 vignettes.
 */
import { describe, it, expect, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';

vi.mock('@/lib/i18n/context', () => ({
  useTranslation: () => ({
    locale: 'fr',
    t: (key: string) => key,
  }),
}));

import PassportSection from '@/components/progression/PassportSection';
import type { UserDiscovery } from '@/features/progression/server/discoveries';

function discovery(overrides: Partial<UserDiscovery> = {}): UserDiscovery {
  return {
    entityType: 'region',
    entityCode: 'occitanie',
    provenance: 'verified',
    firstSeenAt: '2026-10-05T09:00:00.000Z',
    ...overrides,
  };
}

describe('PassportSection', () => {
  it('(a) compte par type, provenance et date visibles', () => {
    render(
      <PassportSection
        status="ready"
        discoveries={[
          discovery({ entityType: 'country', entityCode: 'fr' }),
          discovery(),
          discovery({ entityType: 'massif', entityCode: 'massif central', provenance: 'declared', firstSeenAt: '2026-10-01T00:00:00.000Z' }),
        ]}
      />
    );

    expect(screen.getByText('1 · progression.passportCountries')).toBeTruthy();
    expect(screen.getByText('1 · progression.passportRegions')).toBeTruthy();
    expect(screen.getByText('1 · progression.passportMassifs')).toBeTruthy();
    expect(screen.getByText('occitanie')).toBeTruthy();
    expect(screen.getAllByText(/progression\.passportVerified/).length).toBeGreaterThan(0);
    expect(screen.getByText(/progression\.passportDeclared/)).toBeTruthy();
  });

  it('(b) un payload hostile n’affiche jamais trace ni coordonnée', () => {
    const hostile = {
      ...discovery({ entityType: 'region', entityCode: 'occitanie' }),
      latitude: 45.123456,
      longitude: 6.987654,
      positions_geojson: '[[45.1,6.9]]',
      passport_number: 'X1234567',
    } as unknown as UserDiscovery;

    render(<PassportSection status="ready" discoveries={[hostile]} />);

    expect(screen.queryByText(/45\.123/)).toBeNull();
    expect(screen.queryByText(/6\.987/)).toBeNull();
    expect(screen.queryByText(/X1234567/)).toBeNull();
    expect(screen.queryByText(/geojson/i)).toBeNull();
  });

  it('(c) vide et indisponible sont distincts', () => {
    render(<PassportSection status="ready" discoveries={[]} />);
    expect(screen.getByText('progression.passportEmptyBody')).toBeTruthy();
    cleanup();
    render(<PassportSection status="unavailable" discoveries={[]} />);
    expect(screen.getByText('progression.passportUnavailable')).toBeTruthy();
    cleanup();
    render(<PassportSection status="loading" discoveries={[]} />);
    expect(screen.getByText('progression.passportLoading')).toBeTruthy();
  });

  it('(d) liste bornée à 20 vignettes', () => {
    const many = Array.from({ length: 30 }, (_, index) =>
      discovery({ entityCode: `region-${index}` })
    );
    render(<PassportSection status="ready" discoveries={many} />);
    const items = screen.getAllByText(/^region-\d+$/);
    expect(items.length).toBe(20);
  });
});
