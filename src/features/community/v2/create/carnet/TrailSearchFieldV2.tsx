'use client';

import { useEffect, useState } from 'react';
import { Loader2, Search } from 'lucide-react';
import { useFormContext } from 'react-hook-form';

import { joinSegments, type LngLat } from '@/features/community/create/carnet/traceEngine';
import { useHapticFeedback } from '@/hooks/useHapticFeedback';
import type { CarnetFormValuesV2 } from '../engine/createSchemasV2';

/**
 * Recherche d'une randonnée du référentiel Explorer, **dans le formulaire de
 * création de carnet** (étape Tracé) : le tracé réel de la randonnée choisie
 * est importé dans le formulaire, comme un GPX. Aucun tracé inventé — un
 * carnet n'existe pas sans tracé.
 *
 * API existantes : `GET /api/hikes` (recherche, RPC `trails_in_viewport`, la RPC
 * plafonne son viewport à 20° par axe d'où le polygone France explicite) puis
 * `GET /api/hikes/{id}` (géométrie GeoJSON réelle via `get_route_geojson`).
 */
const FRANCE_BBOX = {
  min_lng: '-5',
  min_lat: '41',
  max_lng: '9',
  max_lat: '51',
} as const;

interface TrailSummary {
  id: string;
  name: string | null;
  lat: number;
  lng: number;
  distance_km: number | null;
  elevation_gain: number | null;
  difficulty: string | null;
}

interface TrailDetail {
  geojson?: unknown;
}

/** GeoJSON (LineString, MultiLineString ou Feature) → points [lng, lat]. */
export function traceFromGeoJson(geojson: unknown): LngLat[] {
  if (!geojson || typeof geojson !== 'object') return [];
  const candidate = geojson as { type?: unknown; geometry?: unknown; coordinates?: unknown };
  const geometry =
    candidate.type === 'Feature' && candidate.geometry && typeof candidate.geometry === 'object'
      ? (candidate.geometry as { type?: unknown; coordinates?: unknown })
      : candidate;
  const toLine = (coordinates: unknown): LngLat[] => {
    if (!Array.isArray(coordinates)) return [];
    return coordinates
      .map((pair) => {
        if (!Array.isArray(pair) || pair.length < 2) return null;
        const lng = Number(pair[0]);
        const lat = Number(pair[1]);
        return Number.isFinite(lng) && Number.isFinite(lat) ? ([lng, lat] as LngLat) : null;
      })
      .filter((point): point is LngLat => point !== null);
  };
  if (geometry.type === 'LineString') return toLine(geometry.coordinates);
  if (geometry.type === 'MultiLineString' && Array.isArray(geometry.coordinates)) {
    const segments = geometry.coordinates.map(toLine).filter((segment) => segment.length > 1);
    return joinSegments(segments, 2000);
  }
  return [];
}

function figures(trail: TrailSummary): string {
  const parts: string[] = [];
  if (trail.distance_km != null) parts.push(`${trail.distance_km.toLocaleString('fr-FR')} km`);
  if (trail.elevation_gain != null) parts.push(`+${trail.elevation_gain.toLocaleString('fr-FR')} m`);
  if (trail.difficulty) parts.push(trail.difficulty);
  return parts.join(' · ');
}

export function TrailSearchFieldV2() {
  const form = useFormContext<CarnetFormValuesV2>();
  const { haptic } = useHapticFeedback();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<TrailSummary[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [selectedName, setSelectedName] = useState<string | null>(null);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setResults(null);
      setError(null);
      setLoading(false);
      return;
    }
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams({ ...FRANCE_BBOX, min_dist: '0', limit: '8', search: q });
        const response = await fetch(`/api/hikes?${params.toString()}`, {
          signal: controller.signal,
          headers: { accept: 'application/json' },
        });
        if (!response.ok) throw new Error(`http ${response.status}`);
        const payload = (await response.json()) as unknown;
        const rows = Array.isArray(payload) ? (payload as TrailSummary[]) : [];
        setResults(
          rows.filter((row) => row && typeof row.lat === 'number' && typeof row.lng === 'number')
        );
      } catch (caught) {
        if ((caught as Error)?.name !== 'AbortError') {
          setError('La recherche n’a pas répondu. Réessaie dans un instant.');
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
  }, [query]);

  const pick = async (trail: TrailSummary) => {
    setImporting(true);
    setError(null);
    try {
      const response = await fetch(`/api/hikes/${trail.id}`, { headers: { accept: 'application/json' } });
      if (!response.ok) throw new Error(`http ${response.status}`);
      const detail = (await response.json()) as TrailDetail;
      const points = traceFromGeoJson(detail.geojson);
      if (points.length < 2) {
        setError('Cette randonnée n’a pas de tracé disponible.');
        return;
      }
      form.setValue('trace', points, { shouldDirty: true, shouldValidate: true });
      form.setValue('startLat', points[0][1], { shouldDirty: true });
      form.setValue('startLng', points[0][0], { shouldDirty: true });
      setSelectedName(trail.name?.trim() || 'Randonnée sans titre');
      haptic('success');
    } catch {
      setError('Impossible de charger le tracé de cette randonnée.');
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="lkdv-cv2-field lkdv-cv2c-field lkdv-cv2c-trail-search" data-testid="cv2-trail-search">
      <div className="lkdv-cv2c-field-head">
        <label htmlFor="cv2-trail-search" className="lkdv-cv2-field-label">
          Rechercher une randonnée existante
        </label>
      </div>
      <div style={{ position: 'relative' }}>
        <Search
          size={16}
          aria-hidden="true"
          style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', opacity: 0.6 }}
        />
        <input
          id="cv2-trail-search"
          type="search"
          className="lkdv-cv2-input"
          style={{ paddingLeft: 38 }}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Mont-Blanc, Écrins, GR20…"
          autoComplete="off"
        />
      </div>
      <p className="lkdv-cv2-field-hint">
        La randonnée choisie importe son tracé réel (distance et dénivelé se remplissent seuls).
      </p>

      {query.trim().length < 2 ? null : loading ? (
        <p className="lkdv-cv2-field-hint" role="status">
          <Loader2 size={14} aria-hidden="true" style={{ display: 'inline', verticalAlign: -2, marginRight: 6 }} className="lkdv-spin" />
          Recherche…
        </p>
      ) : error ? (
        <p className="lkdv-cv2-field-error" role="alert">
          {error}
        </p>
      ) : results && results.length === 0 ? (
        <p className="lkdv-cv2-field-hint" role="status">
          Aucune randonnée ne correspond à « {query.trim()} ».
        </p>
      ) : results ? (
        <ul className="lkdv-cv2c-trail-list" role="list">
          {results.map((trail) => (
            <li key={trail.id}>
              <button
                type="button"
                className="lkdv-cv2c-trail-row"
                onClick={() => void pick(trail)}
                disabled={importing}
              >
                <span className="lkdv-cv2c-trail-name">{trail.name?.trim() || 'Randonnée sans titre'}</span>
                <span className="lkdv-cv2c-trail-meta lkdv-cv2-field-hint">
                  {figures(trail) || 'Chiffres non renseignés'}
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      {selectedName ? (
        <p className="lkdv-cv2-field-hint" role="status">
          Tracé « {selectedName} » importé. Tu peux le retoucher sur la carte ou remplacer par un GPX.
        </p>
      ) : null}
    </div>
  );
}
