'use client';

import React, { useMemo, useState } from 'react';
import { Compass } from 'lucide-react';
import { CHATGPT_TERRAIN_CONSTRAINTS } from '../connectors/chatgpt';
import {
  discoverRoutes,
  routeDiscoveryRequestSchema,
  type CompasRouteRow,
} from '../connectors/routeDiscovery';

const SAMPLE_CATALOG_PREVIEW: CompasRouteRow[] = [
  {
    route_id: 1,
    name: 'Tour du Lac Blanc',
    ref: 'GR5',
    region: 'Alpes',
    distance_km: 14.2,
    elevation_gain_m: 820,
    elevation_loss_m: 820,
    duration_hours: 4.5,
    difficulty: 'moderee',
    distance_from_m: 1500,
    start_lat: 45.97,
    start_lng: 6.89,
    community_sessions: 18,
  },
];

export function ConnectorDiscoverySection() {
  const [minGain, setMinGain] = useState<string>('300');
  const [checkSurface, setCheckSurface] = useState<boolean>(false);

  const preview = useMemo(() => {
    const parsedGain = Number(minGain);
    const req = routeDiscoveryRequestSchema.safeParse({
      query: 'Lac',
      constraints: {
        elevationGainM: Number.isFinite(parsedGain) && parsedGain > 0 ? { min: parsedGain } : undefined,
        surface: checkSurface ? ['sentier'] : undefined,
      },
    });
    if (!req.success) return null;
    return discoverRoutes(req.data, SAMPLE_CATALOG_PREVIEW);
  }, [minGain, checkSurface]);

  return (
    <section
      className="lkdv-consent-section"
      aria-labelledby="lkdv-consent-chatgpt-discovery"
      data-testid="connector-discovery-section"
    >
      <header className="lkdv-consent-section-head">
        <h3 id="lkdv-consent-chatgpt-discovery">Découverte de parcours · Connecteur externe (K1.14)</h3>
        <small>Surface externe ChatGPT / MCP</small>
      </header>
      <div className="lkdv-consent-provider" style={{ gridTemplateColumns: '34px minmax(0,1fr)' }}>
        <span className="lkdv-consent-provider-ico" aria-hidden="true">
          <Compass size={17} />
        </span>
        <div className="lkdv-consent-copy" style={{ gap: 6 }}>
          <div className="lkdv-consent-line">
            <b>Contraintes terrain vérifiées</b>
            <span className="lkdv-consent-chip">Endpoint /api/ai-assistant/mcp</span>
          </div>
          <small>
            Disponibles : {CHATGPT_TERRAIN_CONSTRAINTS.available.slice(0, 4).join(' · ')}
          </small>
          <small>
            Non prouvables (signalées explicitement) : surface, boucle, saison, points d’eau/refuges si non agrégés.
          </small>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginTop: 4 }}>
            <label style={{ fontSize: 10.5, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              D+ min (m)
              <input
                type="number"
                value={minGain}
                onChange={(e) => setMinGain(e.target.value)}
                style={{ width: 64, padding: '2px 4px', fontSize: 11 }}
              />
            </label>
            <label style={{ fontSize: 10.5, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              <input
                type="checkbox"
                checked={checkSurface}
                onChange={(e) => setCheckSurface(e.target.checked)}
              />
              Tester contrainte surface non prouvable
            </label>
          </div>
          {preview ? (
            <p style={{ margin: 0, fontSize: 10.5 }}>
              Test contrat : {preview.count} résultat(s) conforme(s)
              {preview.unknownConstraints.length > 0
                ? ` · Inconnues : ${preview.unknownConstraints.join(', ')}`
                : ''}
            </p>
          ) : null}
        </div>
      </div>
    </section>
  );
}
