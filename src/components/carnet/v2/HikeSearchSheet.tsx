'use client';

import { useEffect, useState } from 'react';
import { Loader2, Search } from 'lucide-react';

import { OverlaySheet } from '@/components/compte/overlay/OverlaySheet';

/**
 * Recherche d'une randonnée existante, branchée sur l'API de l'Explorer
 * (`GET /api/hikes`, RPC `trails_in_viewport` déjà utilisée par la carte) :
 * aucune donnée inventée, seules les randonnées du référentiel remontent.
 *
 * Le polygone France est fourni explicitement : la RPC plafonne son viewport à
 * 20° par axe et un viewport mondial ne renverrait rien.
 */
const FRANCE_BBOX = {
  min_lng: '-5',
  min_lat: '41',
  max_lng: '9',
  max_lat: '51',
} as const;

export interface HikeSearchResult {
  id: string;
  name: string | null;
  lat: number;
  lng: number;
  distance_km: number | null;
  elevation_gain: number | null;
  difficulty: string | null;
}

export interface HikeSearchSheetProps {
  open: boolean;
  onClose: () => void;
  /** Randonnée choisie : l'écran recentre la carte et referme la feuille. */
  onPick: (trail: HikeSearchResult) => void;
}

function figures(trail: HikeSearchResult): string {
  const parts: string[] = [];
  if (trail.distance_km != null) parts.push(`${trail.distance_km.toLocaleString('fr-FR')} km`);
  if (trail.elevation_gain != null) parts.push(`+${trail.elevation_gain.toLocaleString('fr-FR')} m`);
  if (trail.difficulty) parts.push(trail.difficulty);
  return parts.join(' · ');
}

export function HikeSearchSheet({ open, onClose, onPick }: HikeSearchSheetProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<HikeSearchResult[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!open) return;
    const q = query.trim();
    if (q.length < 2) {
      setResults(null);
      setError(false);
      setLoading(false);
      return;
    }
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setLoading(true);
      setError(false);
      try {
        const params = new URLSearchParams({
          ...FRANCE_BBOX,
          min_dist: '0',
          limit: '8',
          search: q,
        });
        const response = await fetch(`/api/hikes?${params.toString()}`, {
          signal: controller.signal,
          headers: { accept: 'application/json' },
        });
        if (!response.ok) throw new Error(`http ${response.status}`);
        const payload = (await response.json()) as unknown;
        const rows = Array.isArray(payload) ? (payload as HikeSearchResult[]) : [];
        setResults(rows.filter((row) => row && typeof row.lat === 'number' && typeof row.lng === 'number'));
      } catch (caught) {
        if ((caught as Error)?.name !== 'AbortError') {
          setError(true);
          setResults([]);
        }
      } finally {
        setLoading(false);
      }
    }, 300);
    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [query, open]);

  if (!open) return null;

  return (
    <OverlaySheet
      title="Rechercher une randonnée"
      subtitle="Référentiel de l’Explorer"
      onClose={onClose}
    >
      <div className="lkdv-overlay-field">
        <label htmlFor="lkdv-hike-search">Nom ou massif</label>
        <input
          id="lkdv-hike-search"
          type="search"
          value={query}
          autoFocus
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Mont-Blanc, Écrins, GR20…"
          autoComplete="off"
        />
      </div>

      {query.trim().length < 2 ? (
        <p className="lkdv-mute" role="status" style={{ padding: '4px 2px' }}>
          Tape au moins deux lettres pour chercher une randonnée du référentiel.
        </p>
      ) : loading ? (
        <p className="lkdv-mute" role="status" style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '4px 2px' }}>
          <Loader2 size={16} aria-hidden="true" className="lkdv-spin" /> Recherche…
        </p>
      ) : error ? (
        <p className="lkdv-mute" role="alert" style={{ padding: '4px 2px' }}>
          La recherche n’a pas répondu. Réessaie dans un instant.
        </p>
      ) : results && results.length === 0 ? (
        <p className="lkdv-mute" role="status" style={{ padding: '4px 2px' }}>
          Aucune randonnée ne correspond à « {query.trim()} ».
        </p>
      ) : results ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {results.map((trail) => (
            <button
              key={trail.id}
              type="button"
              className="lkdv-etape"
              onClick={() => onPick(trail)}
              style={{ textAlign: 'left' }}
            >
              <Search size={15} aria-hidden="true" />
              <b>{trail.name?.trim() || 'Randonnée sans nom'}</b>
              <small className="lkdv-mono">{figures(trail) || 'Chiffres non renseignés'}</small>
            </button>
          ))}
        </div>
      ) : null}
    </OverlaySheet>
  );
}
