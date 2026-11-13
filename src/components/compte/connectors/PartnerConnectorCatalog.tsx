'use client';

import React, { useId, useState } from 'react';
import { Search, ShieldCheck } from 'lucide-react';

import type { ConnectorCardView, ConnectorCatalogResponse } from '@/lib/connectors/types';
import { ConnectorAvailabilityBadge } from './ConnectorAvailabilityBadge';

function matchesQuery(card: ConnectorCardView, query: string): boolean {
  if (!query) return true;
  const haystack = [
    card.label,
    card.categoryLabel,
    card.statusLabel,
    ...card.fiches,
    ...card.usageLabels,
    ...card.capabilities.map((capability) => capability.label),
  ]
    .join(' ')
    .toLowerCase();
  return haystack.includes(query);
}

/**
 * Catalogue partenaires : état réel, capacités et replis.
 * Une carte sans credentials affiche « indisponible » et ne propose aucun
 * bouton de connexion : le composant ne simule jamais un connecteur prêt.
 */
export function PartnerConnectorCatalog({ catalog }: { catalog: ConnectorCatalogResponse }) {
  const [query, setQuery] = useState('');
  const searchId = useId();
  const normalized = query.trim().toLowerCase();
  const visibleGroups = catalog.groups
    .map((group) => ({
      ...group,
      connectors: group.connectors.filter((card) => matchesQuery(card, normalized)),
    }))
    .filter((group) => group.connectors.length > 0);

  return (
    <section className="cn-section" aria-labelledby="cn-catalogue-title">
      <div className="cn-section-head">
        <h2 id="cn-catalogue-title">Catalogue des partenaires</h2>
        <p>
          {catalog.summary.total} connecteurs · {catalog.summary.connected} connecté
          {catalog.summary.connected > 1 ? 's' : ''} · {catalog.summary.credentialsMissing} sans credentials
        </p>
      </div>

      <label className="cn-field" htmlFor={searchId}>
        <span className="cn-visually-hidden">Rechercher un partenaire</span>
        <span style={{ position: 'relative', display: 'block' }}>
          <Search
            size={16}
            aria-hidden="true"
            style={{ position: 'absolute', left: 13, top: 14, color: 'var(--cn-muted)' }}
          />
          <input
            id={searchId}
            className="cn-search"
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Garmin, Wahoo, Strava, indoor…"
            style={{ paddingLeft: 38 }}
          />
        </span>
      </label>

      {visibleGroups.length === 0 ? (
        <div className="cn-empty" role="status">
          <b>Aucun partenaire ne correspond</b>
          Efface la recherche pour revoir tout le catalogue.
        </div>
      ) : (
        visibleGroups.map((group) => (
          <div key={group.category} className="cn-section" aria-labelledby={`cn-group-${group.category}`}>
            <div className="cn-section-head">
              <h3 id={`cn-group-${group.category}`} style={{ margin: 0, fontSize: 13, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                {group.label}
              </h3>
              <p>{group.connectors.length}</p>
            </div>
            <div className="cn-grid">
              {group.connectors.map((card) => (
                <article key={card.id} className="cn-card" aria-labelledby={`cn-card-${card.id}`}>
                  <div className="cn-card-top">
                    <div>
                      <h3 id={`cn-card-${card.id}`}>{card.label}</h3>
                      <p className="cn-card-meta">
                        {card.fiches.join(' · ')} — {card.categoryLabel}
                      </p>
                    </div>
                    <ConnectorAvailabilityBadge label={card.statusLabel} tone={card.statusTone} />
                  </div>

                  <p className="cn-reason">{card.statusReason}</p>

                  {card.credentialHint ? (
                    <p className="cn-warn" role="note">
                      {card.credentialHint}
                    </p>
                  ) : null}

                  {card.privacyNotice ? (
                    <p className="cn-warn" role="note">
                      <ShieldCheck size={13} aria-hidden="true" style={{ verticalAlign: '-2px', marginRight: 4 }} />
                      {card.privacyNotice}
                    </p>
                  ) : null}

                  {card.capabilities.length > 0 ? (
                    <ul className="cn-caps" aria-label={`Capacités ${card.label}`}>
                      {card.capabilities.map((capability) => (
                        <li key={capability.key} className="cn-cap" data-tone={capability.tone}>
                          {capability.label}
                          <span className="cn-visually-hidden"> : {capability.stateLabel}</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="cn-fine">Aucune capacité cloud disponible pour ce partenaire.</p>
                  )}

                  <details className="cn-details">
                    <summary>Usages autorisés et repli manuel</summary>
                    <ul>
                      {card.usageLabels.map((usage) => (
                        <li key={usage}>{usage}</li>
                      ))}
                      {card.manualFallbackFormats.length > 0 ? (
                        <li>
                          Repli manuel : {card.manualFallbackFormats.map((format) => format.toUpperCase()).join(', ')}
                        </li>
                      ) : null}
                    </ul>
                  </details>

                  <div className="cn-actions">
                    <a className="cn-btn" href="#connexions-oauth">
                      Gérer la connexion
                    </a>
                  </div>
                </article>
              ))}
            </div>
          </div>
        ))
      )}

      <p className="cn-fine">
        Version de politique : {catalog.policyVersion}. Dernière lecture :{' '}
        {new Date(catalog.generatedAt).toLocaleString('fr-FR')}.
      </p>
    </section>
  );
}

export default PartnerConnectorCatalog;
