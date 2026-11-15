// @vitest-environment jsdom
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SettingsPane } from '../SettingsPane';
import { UNIT_SETTING_EVENT } from '@/lib/i18n/unitSetting';

const BASE_PROFILE = {
  id: 'u-1',
  email: 'alex@lkdv.fr',
  name: 'Alex',
  handle: 'alex',
  bio: '',
  location: 'Grenoble',
  avatarUrl: null,
  coverUrl: null,
  links: [],
  visibility: 'public',
  notificationPrefs: {
    social: true,
    loans: true,
    orders: true,
    system: true,
    quietHours: false,
    kudos: true,
    comments: true,
    segmentsPr: true,
    challenges: true,
    clubEvents: true,
    gearMileageAlerts: true,
    activityDigest: false,
    quietHoursStart: '22:00',
    quietHoursEnd: '07:00',
  },
  twoFaEnabled: false,
};

const BASE_OFFERS = {
  billingConfigured: false,
  entitlementSource: 'default_free',
  plan: 'free',
  coverage: {
    freeRegionId: null,
    freeRegionAllowanceRemaining: 1,
    worldPackRight: {
      status: 'ineligible',
      canUse: false,
      reason: 'Aucun droit actif.',
      actionLabel: 'Voir les formules',
      expiresAtIso: null,
      revokedAtIso: null,
    },
    regions: [
      {
        id: 'fr-chamonix-mont-blanc',
        name: 'Chamonix – Mont-Blanc',
        countryCode: 'FR',
        estimatedSizeMb: 42,
        source: 'locked',
        unlocked: false,
        right: {
          status: 'ineligible',
          canUse: false,
          reason: 'Aucun droit actif.',
          actionLabel: 'Voir les formules',
          expiresAtIso: null,
          revokedAtIso: null,
        },
        installedVersion: null,
        latestVersion: '2026.11.1',
        updateAvailable: false,
      },
    ],
  },
  mapUpdates: {
    premiumRight: {
      status: 'ineligible',
      canUse: false,
      reason: 'Aucun droit actif.',
      actionLabel: 'Voir les formules',
      expiresAtIso: null,
      revokedAtIso: null,
    },
    planLabel: 'Découverte (gratuit)',
    canUsePremiumRouting: false,
    canUseAdvancedTerrain: false,
    catalogVersion: '2026.11.1',
    staleUnlockedRegions: [],
    canRefreshUnlockedMaps: false,
    distinctionNote: 'Cartes indépendantes.',
  },
  commercialOffers: [
    {
      id: 'individual',
      name: 'Abonnement Individuel',
      targetAudience: '1 compte sportif',
      seatsIncluded: 1,
      billingModel: 'subscription',
      indicativePriceLabel: 'Tarif à confirmer',
      checkoutConfigured: false,
      includes: ['Cartes hors ligne'],
    },
  ],
  family: { seatsUsed: 1, seatsAvailable: 3, seats: [] },
  student: { status: 'unverified', eligibleForDiscount: false, institutionHint: null, reason: 'Aucune attestation.' },
  partnerOffers: [],
  supportTier: { level: 'standard', slaLabel: 'Traitement standard sous 48h ouvrées', eligible: false, reason: 'Offre requise.' },
  iosIcons: { selectedIcon: 'default', platformSupported: false, reason: 'iOS natif uniquement', icons: [] },
};

function renderWithQuery(ui: React.ReactElement) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

describe('SettingsPane — D01/D02/D03, O01, Accessibilité et O02', () => {
  let profileState = structuredClone(BASE_PROFILE);
  const patchCalls: Array<Record<string, unknown>> = [];

  beforeEach(() => {
    window.localStorage.clear();
    document.cookie = 'lkdv_units=; Max-Age=0; Path=/';
    profileState = structuredClone(BASE_PROFILE);
    patchCalls.length = 0;

    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        if (url.startsWith('/api/compte/compte/profile')) {
          if (init?.method === 'PATCH') {
            const patchBody = JSON.parse(String(init.body)) as Record<string, unknown>;
            patchCalls.push(patchBody);
            if (patchBody.notificationPrefs) {
              profileState = {
                ...profileState,
                notificationPrefs: {
                  ...profileState.notificationPrefs,
                  ...(patchBody.notificationPrefs as Record<string, unknown>),
                },
              };
            }
          }
          return new Response(JSON.stringify(profileState), { status: 200 });
        }
        if (url.startsWith('/api/compte/offers')) {
          return new Response(JSON.stringify(BASE_OFFERS), { status: 200 });
        }
        return new Response(JSON.stringify({}), { status: 404 });
      }),
    );
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('expose les liens D01/D02/D03 et synchronise le basculement Impérial', async () => {
    const unitListener = vi.fn();
    window.addEventListener(UNIT_SETTING_EVENT, unitListener);

    renderWithQuery(<SettingsPane />);

    await waitFor(() => expect(screen.getByText('Appareils et services')).toBeTruthy());

    expect(screen.getByRole('link', { name: /Connecteurs/i }).getAttribute('href')).toBe('/compte/connecteurs');
    expect(screen.getByRole('link', { name: /Capteurs & Santé/i }).getAttribute('href')).toBe('/compte/sensors');
    expect(screen.getByRole('link', { name: /Montres/i }).getAttribute('href')).toBe('/compte/montres');

    fireEvent.click(screen.getByRole('button', { name: /Impérial/i }));
    expect(window.localStorage.getItem('user_account_settings_v1')).toContain('"unitSystem":"imperial"');
    expect(unitListener).toHaveBeenCalled();

    window.removeEventListener(UNIT_SETTING_EVENT, unitListener);
  });

  it('ouvre et referme les sous-drawers Langue/Unités, Alertes sportives S6.20, Accessibilité et Offres O02', async () => {
    renderWithQuery(<SettingsPane />);
    await waitFor(() => expect(screen.getByText('Langue et unités sportives')).toBeTruthy());

    // 1. Langue & unités sportives (S6.21)
    const unitsTrigger = screen.getByRole('button', { name: 'Personnaliser' });
    fireEvent.click(unitsTrigger);
    expect(screen.getByRole('dialog', { name: 'Langue et unités sportives' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Pieds (ft)' }));
    expect(window.localStorage.getItem('user_account_settings_v1')).toContain('"elevationUnit":"ft"');
    fireEvent.click(screen.getByRole('button', { name: /Fermer/i }));
    await waitFor(() =>
      expect(screen.queryByRole('dialog', { name: 'Langue et unités sportives' })).toBeNull(),
    );

    // 2. Alertes sportives S6.20
    fireEvent.click(screen.getByRole('button', { name: 'Alertes sportives' }));
    expect(screen.getByRole('dialog', { name: /Notifications sportives/i })).toBeTruthy();
    fireEvent.click(screen.getByRole('switch', { name: /Alertes usure matériel/i }));
    await waitFor(() => expect(patchCalls.length).toBeGreaterThan(0));
    expect(patchCalls[0]).toEqual({ notificationPrefs: { gearMileageAlerts: false } });
    fireEvent.click(screen.getByRole('button', { name: /Fermer/i }));

    // 3. Accessibilité (O01-A11Y)
    fireEvent.click(screen.getByRole('button', { name: 'Régler' }));
    expect(screen.getByRole('dialog', { name: 'Accessibilité et affichage' })).toBeTruthy();
    expect(screen.getByRole('link', { name: /Ouvrir la page complète d’accessibilité/i }).getAttribute('href')).toBe('/accessibilite');
    fireEvent.click(screen.getByRole('button', { name: /Fermer/i }));

    // 4. Offres & régions (O02)
    fireEvent.click(screen.getByRole('button', { name: 'Gérer' }));
    await waitFor(() =>
      expect(screen.getByRole('dialog', { name: 'Abonnement, régions et avantages' })).toBeTruthy(),
    );
    expect(screen.getByText(/Formule actuelle : Découverte/i)).toBeTruthy();
    fireEvent.click(screen.getByRole('tab', { name: 'Régions & Cartes' }));
    expect(screen.getByText('Chamonix – Mont-Blanc')).toBeTruthy();
  });
});
