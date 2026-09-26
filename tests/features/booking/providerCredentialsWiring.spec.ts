import { describe, expect, it, vi } from 'vitest';

import { createRouteStackBookingProvider } from '@/features/booking/server/routeStackBookingProvider';
import { createViatorBookingProvider } from '@/features/booking/server/viatorBookingProvider';
import { BOOKING_PROVIDER_ERROR_CODES } from '@/features/booking/server/bookingProviderErrors';

/**
 * W2 — le contrat de credentials n'a de valeur que si les TRANSPORTS le
 * consomment. Ces tests verrouillent ce raccordement : un fournisseur qui
 * relirait l'environnement de son côté contournerait le fail-closed.
 */
describe('raccordement des transports au contrat de credentials', () => {
  it('RouteStack : production sans clé full → non configuré, aucun appel réseau', async () => {
    const callTool = vi.fn();
    const provider = createRouteStackBookingProvider({
      env: {
        ROUTESTACK_MODE: 'production',
        ROUTESTACK_SANDBOX_API_KEY: 'sandbox-key',
        ROUTESTACK_SANDBOX_PARTNER_SECRET: 'sandbox-secret',
      },
      callTool,
    });

    expect(provider.mode).toBe('disabled');
    expect(provider.isConfigured()).toBe(false);

    await expect(
      provider.search({ vertical: 'flight', origin: 'CDG', destination: 'JFK', date: '2026-11-12' })
    ).rejects.toMatchObject({ code: BOOKING_PROVIDER_ERROR_CODES.config });

    // Point dur : aucune requête ne doit partir avec la clé sandbox.
    expect(callTool).not.toHaveBeenCalled();
  });

  it('RouteStack : sandbox → configuré, la clé sandbox est réellement utilisée', () => {
    const callTool = vi.fn();
    const provider = createRouteStackBookingProvider({
      env: {
        ROUTESTACK_MODE: 'sandbox',
        ROUTESTACK_SANDBOX_API_KEY: 'sandbox-key',
        ROUTESTACK_SANDBOX_PARTNER_SECRET: 'sandbox-secret',
      },
      callTool,
    });

    expect(provider.mode).toBe('sandbox');
    expect(provider.isConfigured()).toBe(true);
  });

  it('RouteStack : les deux clés coexistent, le mode choisit la bonne base', () => {
    // La session est indexée sur base+clé : deux modes ne doivent jamais
    // partager une entrée de cache, sinon un token fuite d'un slot à l'autre.
    const sandbox = createRouteStackBookingProvider({
      env: {
        ROUTESTACK_MODE: 'sandbox',
        ROUTESTACK_SANDBOX_API_KEY: 'k',
        ROUTESTACK_FULL_API_KEY: 'k2',
      },
    });
    const live = createRouteStackBookingProvider({
      env: {
        ROUTESTACK_MODE: 'production',
        ROUTESTACK_SANDBOX_API_KEY: 'k',
        ROUTESTACK_FULL_API_KEY: 'k2',
      },
    });

    expect(sandbox.mode).toBe('sandbox');
    expect(live.mode).toBe('live');
    expect(sandbox.isConfigured()).toBe(true);
    expect(live.isConfigured()).toBe(true);
  });

  it('Viator : full sans clé full → non configuré malgré la clé sandbox', async () => {
    const searchProducts = vi.fn();
    const provider = createViatorBookingProvider({
      env: {
        VIATOR_MODE: 'full',
        VIATOR_SANDBOX_API_KEY: 'sandbox-key',
        VIATOR_BOOKING_ENABLED: 'true',
      },
      searchProducts,
    });

    expect(provider.mode).toBe('disabled');
    expect(provider.isConfigured()).toBe(false);
    expect(searchProducts).not.toHaveBeenCalled();
  });

  it('Viator : le contrat historique reste accepté (aucune régression)', () => {
    const provider = createViatorBookingProvider({
      env: { VIATOR_API_KEY: 'legacy-key' },
      searchProducts: vi.fn(),
    });

    expect(provider.mode).toBe('sandbox');
    expect(provider.isConfigured()).toBe(true);
  });
});