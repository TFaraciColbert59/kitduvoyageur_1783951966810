import { describe, expect, it } from 'vitest';
import {
  getProviderAvailability,
  isProviderAvailable,
  listProviderAvailability,
  unavailablePartnerLabels,
} from '../domain/availability';

describe('disponibilité des fournisseurs', () => {
  it('déclare les plans LKDV disponibles', () => {
    const lkdv = getProviderAvailability('lkdv');
    expect(lkdv.status).toBe('available');
    expect(lkdv.reason).toBeNull();
    expect(isProviderAvailable('lkdv')).toBe(true);
  });

  it('déclare Runna et CTS indisponibles faute de licence', () => {
    for (const id of ['runna', 'cts'] as const) {
      const provider = getProviderAvailability(id);
      expect(provider.status).toBe('unavailable');
      expect(provider.reason).toBe('no_license');
      expect(isProviderAvailable(id)).toBe(false);
    }
    expect(unavailablePartnerLabels()).toEqual(['Runna', 'CTS']);
  });

  it('déclare Garmin indisponible faute de connecteur', () => {
    const garmin = getProviderAvailability('garmin');
    expect(garmin.kind).toBe('device');
    expect(garmin.status).toBe('unavailable');
    expect(garmin.reason).toBe('connector_absent');
  });

  it('n’expose jamais un partenaire comme disponible', () => {
    const partners = listProviderAvailability().filter(
      (provider) => provider.id !== 'lkdv'
    );
    expect(partners.every((provider) => provider.status === 'unavailable')).toBe(
      true
    );
  });
});
