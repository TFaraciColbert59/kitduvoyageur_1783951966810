'use client';

import { useEffect, useRef, useState } from 'react';
import { XpRow, XpRows } from '@/features/explorer-v2/sheet/blocks';
import { placeLabel, readGeocodeMatches, type PlaceMatch } from '../../startIntent';
import { useRouteWorkspace } from './WorkspaceContext';

/**
 * « Ajouter un point par adresse » (1.10) : pour qu'aucun appareil sans carte ne reste bloqué. Le lieu est
 * cherché par l'API de géocodage du dépôt (`/api/geocode`), choisi dans la liste, puis ajouté en fin de tracé.
 */
export function AddByAddress() {
  const { canEditGeo, placePoint } = useRouteWorkspace();
  const [query, setQuery] = useState('');
  const [matches, setMatches] = useState<PlaceMatch[]>([]);
  const [status, setStatus] = useState<'idle' | 'searching' | 'none' | 'unavailable'>('idle');
  const [adding, setAdding] = useState(false);
  const abort = useRef<AbortController | null>(null);

  useEffect(() => () => abort.current?.abort(), []);

  if (!canEditGeo) return null;

  const search = async () => {
    const q = query.trim();
    if (q.length < 2) return;
    abort.current?.abort();
    const ctl = new AbortController();
    abort.current = ctl;
    setStatus('searching');
    try {
      const res = await fetch(`/api/geocode?q=${encodeURIComponent(q)}`, { signal: ctl.signal });
      if (!res.ok) {
        setMatches([]);
        setStatus(res.status === 503 ? 'unavailable' : 'none');
        return;
      }
      const found = readGeocodeMatches(await res.json());
      setMatches(found);
      setStatus(found.length > 0 ? 'idle' : 'none');
    } catch {
      if (!ctl.signal.aborted) setStatus('unavailable');
    }
  };

  const add = async (m: PlaceMatch) => {
    setAdding(true);
    try {
      const ok = await placePoint({ role: 'waypoint', lat: m.lat, lon: m.lon, thresholdM: 0, name: m.name });
      if (ok) {
        setMatches([]);
        setQuery('');
        setStatus('idle');
      }
    } finally {
      setAdding(false);
    }
  };

  return (
    <div className="rcw-address" data-testid="add-by-address">
      <label className="rcw-address-label" htmlFor="rcw-address-input">
        Ajouter un point par adresse
      </label>
      <div className="rcw-address-row">
        <input
          id="rcw-address-input"
          className="rcw-address-input"
          type="text"
          maxLength={200}
          placeholder="Commune, lieu-dit, adresse…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') void search();
          }}
          data-testid="address-input"
        />
        <button
          type="button"
          className="xp-secondary"
          onClick={() => void search()}
          disabled={query.trim().length < 2 || status === 'searching'}
          data-testid="address-search"
        >
          Chercher
        </button>
      </div>
      {status === 'searching' ? <p className="rcw-sub-note" role="status">Recherche…</p> : null}
      {status === 'none' ? (
        <p className="rcw-sub-note" role="status" data-testid="address-none">Aucun lieu retrouvé pour cette recherche.</p>
      ) : null}
      {status === 'unavailable' ? (
        <p className="rcw-sub-note" role="status" data-testid="address-unavailable">
          Recherche de lieu indisponible pour l’instant. Réessayez dans un instant.
        </p>
      ) : null}
      {matches.length > 0 ? (
        <XpRows>
          {matches.map((m) => (
            <XpRow
              key={m.id}
              icon="pin"
              tone="ink"
              title={placeLabel(m)}
              sub={m.precision === 'inexact' ? 'Position approximative' : 'Ajouter en fin de tracé'}
              onClick={adding ? undefined : () => void add(m)}
            />
          ))}
        </XpRows>
      ) : null}
    </div>
  );
}
