// @vitest-environment jsdom
/**
 * T20 — couche personnelle de la carte :
 *   (a) vide → rien (jamais de blocage de la carte) ;
 *   (b) payload valide → compteurs pays/régions, extras hostiles ignorés ;
 *   (c) panne réseau → rien ;
 *   (d) charge bornée à 100 entités.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';

vi.mock('@/lib/i18n/context', () => ({
  useTranslation: () => ({ locale: 'fr', t: (key: string) => key }),
}));

import DiscoveryMapLayer from '@/features/progression/components/DiscoveryMapLayer';

const fetchMock = vi.fn<typeof fetch>();
const response = (payload: unknown, ok = true) =>
  ({ ok, json: async () => payload } as Response);

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('DiscoveryMapLayer', () => {
  it('(a) aucune découverte → ne rend rien', async () => {
    fetchMock.mockResolvedValueOnce(response({ success: true, discoveries: [] }));
    const { container } = render(<DiscoveryMapLayer />);
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(container.firstChild).toBeNull();
  });

  it('(b) compteurs pays/régions, extras hostiles ignorés', async () => {
    fetchMock.mockResolvedValueOnce(
      response({
        success: true,
        discoveries: [
          { entityType: 'country', entityCode: 'fr', provenance: 'verified', firstSeenAt: 'x', latitude: 45.1, longitude: 6.1 },
          { entityType: 'region', entityCode: 'occitanie', provenance: 'verified', firstSeenAt: 'y' },
        ],
      })
    );
    render(<DiscoveryMapLayer />);

    await screen.findByLabelText('progression.mapDiscoveriesLayer');
    expect(screen.getByText(/1 · progression\.passportCountries/)).toBeTruthy();
    expect(screen.getByText(/1 · progression\.passportRegions/)).toBeTruthy();
    expect(screen.queryByText(/45\.1/)).toBeNull();
  });

  it('(c) panne réseau ou 401 → rien', async () => {
    fetchMock.mockRejectedValueOnce(new TypeError('offline'));
    const { container } = render(<DiscoveryMapLayer />);
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(container.firstChild).toBeNull();

    fetchMock.mockResolvedValueOnce(response({}, false));
    const second = render(<DiscoveryMapLayer />);
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(second.container.firstChild).toBeNull();
  });

  it('(d) charge bornée : plus de 100 entités → 100 comptées', async () => {
    const many = Array.from({ length: 130 }, () => ({
      entityType: 'region',
      entityCode: 'occitanie',
      provenance: 'verified',
      firstSeenAt: 'x',
    }));
    fetchMock.mockResolvedValueOnce(response({ success: true, discoveries: many }));
    render(<DiscoveryMapLayer />);

    await screen.findByLabelText('progression.mapDiscoveriesLayer');
    expect(screen.getByText(/100 · progression\.passportRegions/)).toBeTruthy();
  });
});
