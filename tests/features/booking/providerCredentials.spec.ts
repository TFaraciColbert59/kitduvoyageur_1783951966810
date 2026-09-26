import { describe, expect, it } from 'vitest';

import {
  getActiveProviderMode,
  getProviderCredentialSummary,
  resolveProviderCredentials,
} from '@/features/booking/server/providerCredentials';

/**
 * D-07 / PROMPT §12.1C — contrat de credentials double-clé.
 *
 * Invariant central vérifié ici : les deux jeux de clés coexistent, et un mode
 * qui réclame le slot full SANS sa clé ne doit JAMAIS retomber sur le sandbox.
 * Un repli silencieux réserverait en test en croyant être en production.
 */
describe('providerCredentials — RouteStack', () => {
  const sandboxPair = {
    ROUTESTACK_SANDBOX_API_KEY: 'sandbox-key',
    ROUTESTACK_SANDBOX_PARTNER_SECRET: 'sandbox-secret',
    ROUTESTACK_SANDBOX_BASE_URL: 'https://sandbox.example.test',
  } as const;
  const fullPair = {
    ROUTESTACK_FULL_API_KEY: 'full-key',
    ROUTESTACK_FULL_PARTNER_SECRET: 'full-secret',
    ROUTESTACK_FULL_BASE_URL: 'https://full.example.test',
  } as const;

  it('sandbox → base sandbox', () => {
    const resolved = resolveProviderCredentials('routestack', {
      ROUTESTACK_MODE: 'sandbox',
      ...sandboxPair,
      ...fullPair,
    });
    expect(resolved.mode).toBe('sandbox');
    expect(resolved.slot).toBe('sandbox');
    expect(resolved.source).toBe('canonical');
    expect(resolved.baseUrl).toBe('https://sandbox.example.test');
    expect(resolved.reason).toBeNull();
  });

  it('production + clé full → mode live, base Full', () => {
    const resolved = resolveProviderCredentials('routestack', {
      ROUTESTACK_MODE: 'production',
      ...sandboxPair,
      ...fullPair,
    });
    expect(resolved.mode).toBe('live');
    expect(resolved.slot).toBe('full');
    expect(resolved.baseUrl).toBe('https://full.example.test');
    expect(resolved.reason).toBeNull();
  });

  it('production + clé sandbox seule → credentials_incomplete, AUCUN repli', () => {
    const resolved = resolveProviderCredentials('routestack', {
      ROUTESTACK_MODE: 'production',
      ...sandboxPair,
    });
    expect(resolved.mode).toBe('disabled');
    expect(resolved.reason).toBe('credentials_incomplete');
    // Le point dur du test : la clé sandbox est là et n'est surtout pas servie.
    expect(resolved.apiKey).toBeNull();
    expect(resolved.baseUrl).toBeNull();
  });

  it('sandbox sans aucune clé → credentials_missing', () => {
    const resolved = resolveProviderCredentials('routestack', { ROUTESTACK_MODE: 'sandbox' });
    expect(resolved.mode).toBe('disabled');
    expect(resolved.reason).toBe('credentials_missing');
  });

  it('mode absent → repli contrat historique (legacy)', () => {
    const resolved = resolveProviderCredentials('routestack', {
      ROUTESTACK_API_KEY: 'legacy-key',
      ROUTESTACK_API_SECRET: 'legacy-secret',
      ROUTESTACK_MCP_URL: 'https://legacy.example.test',
    });
    expect(resolved.source).toBe('legacy');
    expect(resolved.mode).toBe('sandbox');
    expect(resolved.baseUrl).toBe('https://legacy.example.test');
  });

  it('le contrat canonique ignore totalement les variables historiques', () => {
    // ROUTESTACK_MODE pose => aucune lecture du contrat historique, même
    // complète : c'est ce qui rend le mode fail-closed et non ambigu.
    const resolved = resolveProviderCredentials('routestack', {
      ROUTESTACK_MODE: 'production',
      ROUTESTACK_API_KEY: 'legacy-key',
      ROUTESTACK_MCP_URL: 'https://legacy.example.test',
    });
    expect(resolved.source).toBe('canonical');
    expect(resolved.mode).toBe('disabled');
    // Aucune cle canonique dans un slot : missing, et surtout pas de repli legacy.
    expect(resolved.reason).toBe('credentials_missing');
    expect(resolved.apiKey).toBeNull();
  });

  it('mode inconnu → sandbox, jamais un mode permissif', () => {
    const resolved = resolveProviderCredentials('routestack', {
      ROUTESTACK_MODE: 'production-ish',
      ...sandboxPair,
      ...fullPair,
    });
    expect(resolved.mode).toBe('sandbox');
  });

  it('aucune clé → base par défaut documentée', () => {
    const resolved = resolveProviderCredentials('routestack', {
      ROUTESTACK_MODE: 'sandbox',
      ROUTESTACK_SANDBOX_API_KEY: 'sandbox-key',
    });
    expect(resolved.baseUrl).toBe('https://mcp.routestack.ai');
  });
});

describe('providerCredentials — Viator', () => {
  const sandboxKey = { VIATOR_SANDBOX_API_KEY: 'sandbox-key' } as const;
  const fullKey = { VIATOR_FULL_API_KEY: 'full-key' } as const;

  it('sandbox → base sandbox, réservation verrouillée', () => {
    const resolved = resolveProviderCredentials('viator', {
      VIATOR_MODE: 'sandbox',
      ...sandboxKey,
      ...fullKey,
      VIATOR_BOOKING_ENABLED: 'true',
    });
    expect(resolved.mode).toBe('sandbox');
    expect(resolved.baseUrl).toBe('https://api.sandbox.viator.com/partner');
    // Le drapeau seul ne suffit pas : le mode doit être full.
    expect(resolved.bookingEnabled).toBe(false);
  });

  it('full + clé full + drapeau → réservation autorisée', () => {
    const resolved = resolveProviderCredentials('viator', {
      VIATOR_MODE: 'full',
      ...sandboxKey,
      ...fullKey,
      VIATOR_BOOKING_ENABLED: 'true',
    });
    expect(resolved.mode).toBe('live');
    expect(resolved.baseUrl).toBe('https://api.viator.com/partner');
    expect(resolved.bookingEnabled).toBe(true);
  });

  it('full sans le drapeau → mode live mais réservation verrouillée', () => {
    const resolved = resolveProviderCredentials('viator', {
      VIATOR_MODE: 'full',
      ...fullKey,
    });
    expect(resolved.mode).toBe('live');
    expect(resolved.bookingEnabled).toBe(false);
  });

  it('full + clé sandbox seule → credentials_incomplete, AUCUN repli', () => {
    const resolved = resolveProviderCredentials('viator', {
      VIATOR_MODE: 'full',
      ...sandboxKey,
    });
    expect(resolved.mode).toBe('disabled');
    expect(resolved.reason).toBe('credentials_incomplete');
    expect(resolved.apiKey).toBeNull();
  });

  it('repli historique : mode full sans FULL_ENABLED → incomplet', () => {
    const resolved = resolveProviderCredentials('viator', {
      VIATOR_API_KEY: 'legacy-key',
      VIATOR_BOOKING_MODE: 'full',
    });
    expect(resolved.source).toBe('legacy');
    expect(resolved.mode).toBe('disabled');
    expect(resolved.reason).toBe('credentials_incomplete');
  });

  it('repli historique cohérent → live + réservation autorisée', () => {
    const resolved = resolveProviderCredentials('viator', {
      VIATOR_API_KEY: 'legacy-key',
      VIATOR_BOOKING_MODE: 'full',
      VIATOR_BOOKING_FULL_ENABLED: 'true',
    });
    expect(resolved.mode).toBe('live');
    expect(resolved.bookingEnabled).toBe(true);
  });
});

describe('providerCredentials — observation', () => {
  it('getActiveProviderMode reflète les deux fournisseurs', () => {
    const modes = getActiveProviderMode({
      ROUTESTACK_MODE: 'sandbox',
      ROUTESTACK_SANDBOX_API_KEY: 'sandbox-key',
      VIATOR_MODE: 'sandbox',
      VIATOR_SANDBOX_API_KEY: 'sandbox-key',
    });
    expect(modes).toEqual({ routestack: 'sandbox', viator: 'sandbox' });
  });

  it('le résumé ne contient que des booléens, jamais une valeur', () => {
    const summary = getProviderCredentialSummary({
      ROUTESTACK_MODE: 'sandbox',
      ROUTESTACK_SANDBOX_API_KEY: 'sb_rst_super_secret_value',
      ROUTESTACK_SANDBOX_PARTNER_SECRET: 'sb_cc_super_secret_value',
      VIATOR_MODE: 'sandbox',
      VIATOR_SANDBOX_API_KEY: 'viator-super-secret',
    });
    expect(summary).toHaveLength(2);
    for (const row of summary) {
      expect(Object.keys(row).sort()).toEqual([
        'bookingEnabled',
        'hasApiKey',
        'hasBaseUrl',
        'hasSecret',
        'mode',
        'provider',
        'reason',
        'source',
      ]);
      // Garde-fou : aucune valeur ne doit fuiter dans la trace de démarrage.
      expect(JSON.stringify(row)).not.toContain('super_secret');
    }
  });

  it('le message de désactivation ne cite que des noms de variables', () => {
    const resolved = resolveProviderCredentials('routestack', {
      ROUTESTACK_MODE: 'production',
      ROUTESTACK_SANDBOX_API_KEY: 'sb_rst_do_not_expose',
    });
    expect(resolved.reason).toBe('credentials_incomplete');
    expect(resolved.message).toContain('ROUTESTACK_FULL_API_KEY');
    expect(resolved.message).not.toContain('sb_rst_do_not_expose');
  });
});