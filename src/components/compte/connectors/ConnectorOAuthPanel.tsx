'use client';

import React from 'react';
import { Link2, ShieldOff } from 'lucide-react';

import type { ConnectorCardView } from '@/lib/connectors/types';
import { CONNECTOR_PURPOSE_LABELS } from '@/lib/connectors/viewModels';
import { ConnectorAvailabilityBadge } from './ConnectorAvailabilityBadge';

export interface ConnectorOAuthPanelProps {
  connectors: readonly ConnectorCardView[];
  pendingProvider?: ConnectorCardView['id'] | null;
  error?: string | null;
  notice?: string | null;
  onConnect?: (providerId: ConnectorCardView['id']) => void;
  onRevoke?: (providerId: ConnectorCardView['id']) => void;
  onGrantPurpose?: (
    providerId: ConnectorCardView['id'],
    purpose: ConnectorCardView['requiredPurposes'][number],
    granted: boolean
  ) => void;
}

/**
 * Connexion / révocation OAuth.
 * - Sans credentials : bouton désactivé, jamais d'URL fabriquée.
 * - Connecté : révocation immédiate (coupe collecte et envois).
 * - Partenaire sans OAuth web : aucune action factice, le repli natif est rappelé.
 */
export function ConnectorOAuthPanel({
  connectors,
  pendingProvider = null,
  error = null,
  notice = null,
  onConnect,
  onRevoke,
  onGrantPurpose,
}: ConnectorOAuthPanelProps) {
  const oauthConnectors = connectors.filter((connector) => connector.oauthAvailable);
  const nativeConnectors = connectors.filter((connector) => !connector.oauthAvailable);

  return (
    <section className="cn-section" id="connexions-oauth" aria-labelledby="cn-oauth-title">
      <div className="cn-section-head">
        <h2 id="cn-oauth-title">Connexions OAuth</h2>
        <p>Autorisation PKCE · révocation immédiate</p>
      </div>

      {notice ? <p className="cn-success" role="status">{notice}</p> : null}
      {error ? <p className="cn-error" role="alert">{error}</p> : null}

      <ul className="cn-list">
        {oauthConnectors.map((connector) => {
          const isPending = pendingProvider === connector.id;
          const canConnect = connector.canStartOAuth;
          return (
            <li key={connector.id} className="cn-row">
              <div className="cn-row-main">
                <b>{connector.label}</b>
                <span>{connector.statusReason}</span>
              </div>
              <div className="cn-row-side">
                <ConnectorAvailabilityBadge label={connector.statusLabel} tone={connector.statusTone} />
                {connector.oauthLinked ? (
                  <button
                    type="button"
                    className="cn-btn cn-btn--danger"
                    disabled={isPending}
                    onClick={() => onRevoke?.(connector.id)}
                    aria-label={`Révoquer ${connector.label}`}
                  >
                    <ShieldOff size={15} aria-hidden="true" />
                    {isPending ? 'Révocation…' : 'Révoquer'}
                  </button>
                ) : (
                  <button
                    type="button"
                    className="cn-btn cn-btn--primary"
                    disabled={!canConnect || isPending}
                    onClick={() => onConnect?.(connector.id)}
                    aria-label={`Connecter ${connector.label}`}
                    title={
                      canConnect
                        ? undefined
                        : connector.missingEnvVars.length > 0
                          ? `Credentials absents : ${connector.missingEnvVars.join(', ')}`
                          : 'Connexion indisponible'
                    }
                  >
                    <Link2 size={15} aria-hidden="true" />
                    {isPending
                      ? 'Connexion…'
                      : connector.status === 'revoked'
                        ? 'Reconnecter'
                        : 'Connecter'}
                  </button>
                )}
              </div>
              {connector.oauthLinked && !connector.connected && connector.status === 'configured' ? (
                <div className="cn-consent">
                  <p>Connexion autorisée, mais aucune synchronisation avant ce consentement :</p>
                  {connector.requiredPurposes.map((purpose) => {
                    const granted = connector.grantedPurposes.includes(purpose);
                    return (
                      <label key={purpose} className="cn-consent-line">
                        <input
                          type="checkbox"
                          checked={granted}
                          disabled={isPending}
                          onChange={(event) =>
                            onGrantPurpose?.(connector.id, purpose, event.target.checked)
                          }
                        />
                        <span>{CONNECTOR_PURPOSE_LABELS[purpose]}</span>
                      </label>
                    );
                  })}
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>

      {nativeConnectors.length > 0 ? (
        <div>
          <p className="cn-fine">
            Liaisons natives (sans OAuth web) : {nativeConnectors.map((connector) => connector.label).join(', ')}.
            Elles restent soumises au consentement et au repli manuel.
          </p>
        </div>
      ) : null}
    </section>
  );
}

export default ConnectorOAuthPanel;
