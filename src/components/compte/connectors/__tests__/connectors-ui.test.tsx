// @vitest-environment jsdom

import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  resolveConnectorState,
  type CanonicalRouteForSync,
  type ConnectorConsentSnapshot,
} from '@/features/connectors';
import { buildConnectorCard, buildSyncJobView, groupConnectorCards, summarizeCatalog, summarizeSyncQueue } from '@/lib/connectors/viewModels';
import type { ConnectorCatalogResponse, ConnectorSyncQueueResponse, RouteSendResponse } from '@/lib/connectors/types';
import { ConnectorOAuthPanel } from '../ConnectorOAuthPanel';
import { ConnectorSyncQueue } from '../ConnectorSyncQueue';
import { PartnerConnectorCatalog } from '../PartnerConnectorCatalog';
import { RouteSendToGpsPanel } from '../RouteSendToGpsPanel';

afterEach(cleanup);

const GRANTED_SNAPSHOT: ConnectorConsentSnapshot = {
  userId: 'user-ui',
  policyVersion: 'd01-ui-test',
  purposes: { personal_performance: true, collective_terrain: true },
  providers: {
    garmin: {
      providerId: 'garmin',
      connected: true,
      allowedScopes: ['activity_import', 'route_export', 'waypoint_export', 'live_sync'],
      grantedAt: '2026-11-13T10:00:00.000Z',
      revokedAt: null,
    },
  },
};

const ENV = {
  GARMIN_CLIENT_ID: 'garmin_id',
  GARMIN_CLIENT_SECRET: 'garmin_secret',
  GARMIN_WEBHOOK_SECRET: 'garmin_webhook',
};

function catalogOf(cards: ReturnType<typeof buildConnectorCard>[]): ConnectorCatalogResponse {
  return {
    generatedAt: '2026-11-13T12:00:00.000Z',
    policyVersion: 'd01-ui-test',
    connectors: cards,
    groups: groupConnectorCards(cards),
    summary: summarizeCatalog(cards),
  };
}

function queueOf(jobs: ReturnType<typeof buildSyncJobView>[]): ConnectorSyncQueueResponse {
  return {
    generatedAt: '2026-11-13T12:00:00.000Z',
    jobs,
    summary: summarizeSyncQueue(jobs),
  };
}

const route: CanonicalRouteForSync = {
  routeId: 'gr20-sud',
  revision: 2,
  title: 'GR20 sud',
  sportType: 'hiking',
  totalDistanceMeters: 54_000,
  elevationGainMeters: 3_200,
  elevationLossMeters: 3_400,
  coordinates: [
    [42.1, 9.1],
    [42.11, 9.12],
  ],
  waypoints: [],
};

describe('Connecteurs — composants UI', () => {
  it('affiche un connecteur indisponible sans bouton de connexion dans le catalogue', () => {
    const garmin = buildConnectorCard(resolveConnectorState('garmin', { env: {} }));
    render(<PartnerConnectorCatalog catalog={catalogOf([garmin])} />);

    expect(screen.getByText('Indisponible — credentials absents')).toBeTruthy();
    expect(screen.getByText(/Credentials serveur absents : GARMIN_CLIENT_ID/)).toBeTruthy();
    expect(screen.getByText(/Aucun jeton n’est simulé/)).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Gérer la connexion' }).getAttribute('href')).toBe(
      '#connexions-oauth'
    );
    expect(screen.queryByRole('button', { name: /Connecter Garmin/ })).toBeNull();
  });

  it('désactive la connexion OAuth quand les credentials manquent', () => {
    const garmin = buildConnectorCard(resolveConnectorState('garmin', { env: {} }));
    render(<ConnectorOAuthPanel connectors={[garmin]} />);

    const button = screen.getByRole('button', { name: 'Connecter Garmin Connect' }) as HTMLButtonElement;
    expect(button.disabled).toBe(true);
    expect(button.getAttribute('title')).toContain('GARMIN_CLIENT_ID');
  });

  it('propose la révocation uniquement quand le connecteur est réellement lié', () => {
    const connected = buildConnectorCard(
      resolveConnectorState('garmin', { env: ENV, consentSnapshot: GRANTED_SNAPSHOT })
    );
    const revoke = vi.fn();
    render(<ConnectorOAuthPanel connectors={[connected]} onRevoke={revoke} />);

    fireEvent.click(screen.getByRole('button', { name: 'Révoquer Garmin Connect' }));
    expect(revoke).toHaveBeenCalledWith('garmin');
  });

  it('demande le consentement P01 après OAuth au lieu de reconnecter', () => {
    const linkedWithoutConsent = buildConnectorCard(
      resolveConnectorState('garmin', {
        env: ENV,
        consentSnapshot: { ...GRANTED_SNAPSHOT, purposes: {} },
      }),
      { oauthLinked: true }
    );
    const grant = vi.fn();
    render(<ConnectorOAuthPanel connectors={[linkedWithoutConsent]} onGrantPurpose={grant} />);

    expect(screen.getByText('Lié — consentement requis')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Connecter Garmin Connect' })).toBeNull();

    const checkbox = screen.getByRole('checkbox', { name: 'Performance personnelle' }) as HTMLInputElement;
    expect(checkbox.checked).toBe(false);
    fireEvent.click(checkbox);
    expect(grant).toHaveBeenCalledWith('garmin', 'personal_performance', true);
  });

  it('affiche les jobs bloqués et leur erreur, jamais comme terminés', () => {
    const blocked = buildSyncJobView(
      {
        jobId: 'job-blocked',
        idempotencyKey: 'key',
        userId: 'user-ui',
        providerId: 'garmin',
        kind: 'route_push',
        targetEntityId: 'gr20-sud',
        revision: 2,
        status: 'blocked_credentials_missing',
        attempts: 0,
        maxAttempts: 3,
        nextRetryAtMs: 1_700_000_180_000,
        lastError: 'Credentials partenaires absents (GARMIN_CLIENT_ID).',
        createdAtMs: 1_700_000_000_000,
        updatedAtMs: 1_700_000_000_000,
      },
      'Garmin Connect'
    );

    render(<ConnectorSyncQueue queue={queueOf([blocked])} />);
    expect(screen.getByText('Bloqué — credentials absents')).toBeTruthy();
    expect(screen.getByText(/Credentials partenaires absents/)).toBeTruthy();
    expect(screen.getByText(/tentative 0\/3/)).toBeTruthy();
  });

  it('annonce l’absence d’itinéraire et n’invente pas de destinataire', () => {
    render(<RouteSendToGpsPanel targets={[]} route={null} />);
    expect(screen.getByText('Aucun itinéraire sélectionné')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Envoyer/ })).toBeNull();
  });

  it('envoie l’itinéraire au connecteur choisi et expose le repli GPX', () => {
    const send = vi.fn();
    const result: RouteSendResponse = {
      plan: {
        providerId: 'garmin',
        providerLabel: 'Garmin Connect',
        routeId: 'gr20-sud',
        revision: 2,
        deliveryMode: 'manual_file_fallback',
        deliveryLabel: 'Repli manuel FIT',
        exportedWaypointsCount: 0,
        truncatedWaypointsCount: 0,
        fallbackFormat: 'fit',
        reason: 'Credentials absents : repli FIT manuel prêt.',
        gpxFallbackXml: '<gpx></gpx>',
        jobId: 'job-1',
        jobStatus: 'blocked_credentials_missing',
        jobStatusLabel: 'Bloqué — credentials absents',
      },
      garminCourse: null,
      hammerheadPois: null,
    };

    render(
      <RouteSendToGpsPanel
        targets={[
          {
            providerId: 'garmin',
            label: 'Garmin Connect',
            status: 'credentials_missing',
            canSend: true,
            modeLabel: 'Repli manuel FIT/GPX',
            manualFallbackFormats: ['fit', 'gpx'],
            deviceCount: 1,
          },
        ]}
        route={route}
        result={result}
        onSend={send}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /Envoyer/ }));
    expect(send).toHaveBeenCalledWith('garmin', undefined);

    expect(screen.getByText('Repli manuel FIT')).toBeTruthy();
    expect(screen.getByText(/job job-1/)).toBeTruthy();
    expect(screen.getByRole('button', { name: /Télécharger le repli GPX/ })).toBeTruthy();
  });
});
