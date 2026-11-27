'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  BookOpen,
  Compass,
  Flag,
  Globe2,
  Leaf,
  MapPin,
  Route,
  Search,
  Send,
  X,
} from 'lucide-react';
import { StackSlideView } from '@/components/carnet/v2/CarnetDrawerMotion';
import type { CountryEntry } from '../sheet/context';
import type { PoiItem } from '../data/hooks';
import type { PokedexSpeciesItem } from '../data/unifiedLayersHooks';
import { resolvePoiPresentation } from '../poiTaxonomy';
import { renderPoiIcon } from './lenses/ExplorerPoiDetailView';
import type {
  ExplorerBottleItem,
  ExplorerCarnetItem,
  ExplorerClubItem,
} from './lenses/CommunityCategoryLenses';

export type ExplorerSearchResultKind =
  | 'country'
  | 'poi'
  | 'route'
  | 'species'
  | 'carnet'
  | 'club'
  | 'bottle';

export interface ExplorerSearchResultItem {
  id: string;
  kind: ExplorerSearchResultKind;
  title: string;
  meta?: string | null;
  coordinates?: [number, number] | null;
  iso?: string;
  taxonId?: number;
  routeId?: number;
  poiId?: string;
  poiKind?: string;
  poiSubtype?: string | null;
  elevationM?: number | null;
}

export interface ExplorerSearchSheetProps {
  center: [number, number];
  countries: readonly CountryEntry[];
  pois?: readonly PoiItem[];
  species: readonly PokedexSpeciesItem[];
  carnets: readonly ExplorerCarnetItem[];
  clubs: readonly ExplorerClubItem[];
  bottles: readonly ExplorerBottleItem[];
  onPickResult: (result: ExplorerSearchResultItem) => void;
  onClose: () => void;
}

interface RemoteSearchResponse {
  places?: Array<{
    id: string;
    name: string;
    admin1?: string | null;
    country?: string | null;
    lat: number;
    lon: number;
    elevationM?: number | null;
  }>;
  results?: Array<{
    id: string;
    name: string;
    kind?: string;
    lat?: number;
    lon?: number;
    distanceKm?: number;
  }>;
  routes?: Array<{
    id: number;
    name?: string | null;
    ref?: string | null;
    distance_km?: number | null;
    distanceKm?: number | null;
  }>;
}

function normalize(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

const CONTINENT_FR: Readonly<Record<string, string>> = {
  africa: 'Afrique',
  antarctica: 'Antarctique',
  asia: 'Asie',
  europe: 'Europe',
  'north america': 'Amérique du Nord',
  oceania: 'Océanie',
  'south america': 'Amérique du Sud',
  'seven seas (open ocean)': 'Océans',
};

function translateContinent(continent: string | null | undefined): string | null {
  if (!continent) return null;
  const trimmed = continent.trim();
  if (!trimmed) return null;
  return CONTINENT_FR[trimmed.toLowerCase()] ?? trimmed;
}

function iconForKind(kind: ExplorerSearchResultKind) {
  switch (kind) {
    case 'country':
      return <Globe2 size={15} aria-hidden="true" />;
    case 'route':
      return <Route size={15} aria-hidden="true" />;
    case 'species':
      return <Leaf size={15} aria-hidden="true" />;
    case 'carnet':
      return <BookOpen size={15} aria-hidden="true" />;
    case 'club':
      return <Flag size={15} aria-hidden="true" />;
    case 'bottle':
      return <Send size={15} aria-hidden="true" />;
    default:
      return <MapPin size={15} aria-hidden="true" />;
  }
}

function labelForKind(kind: ExplorerSearchResultKind): string {
  switch (kind) {
    case 'country':
      return 'Pays';
    case 'route':
      return 'Trace';
    case 'species':
      return 'Pokédex';
    case 'carnet':
      return 'Carnet';
    case 'club':
      return 'Club';
    case 'bottle':
      return 'Bouteille';
    default:
      return 'Lieu';
  }
}

export function ExplorerSearchSheet({
  center,
  countries,
  pois = [],
  species,
  carnets,
  clubs,
  bottles,
  onPickResult,
  onClose,
}: ExplorerSearchSheetProps) {
  const [query, setQuery] = useState('');
  const [remoteItems, setRemoteItems] = useState<ExplorerSearchResultItem[]>([]);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus({ preventScroll: true });
  }, []);

  // Debounced 250 ms remote /api/explorer/v2/search
  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setRemoteItems([]);
      setLoading(false);
      return;
    }

    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setLoading(true);
      try {
        const qs = new URLSearchParams({
          q: trimmed,
          lat: String(center[1]),
          lng: String(center[0]),
        });
        const res = await fetch(`/api/explorer/v2/search?${qs.toString()}`, {
          headers: { Accept: 'application/json' },
          signal: controller.signal,
        });
        if (!res.ok) {
          setRemoteItems([]);
          return;
        }
        const json = (await res.json()) as RemoteSearchResponse;
        const mapped: ExplorerSearchResultItem[] = [];

        for (const place of (json.places ?? []).slice(0, 6)) {
          if (
            typeof place.lon === 'number' &&
            typeof place.lat === 'number' &&
            Number.isFinite(place.lon) &&
            Number.isFinite(place.lat)
          ) {
            const metaParts = [place.admin1, place.country].filter(Boolean);
            mapped.push({
              id: `place-${place.id}`,
              kind: 'poi',
              poiId: place.id,
              poiKind: 'place',
              poiSubtype: 'village',
              elevationM: place.elevationM ?? null,
              title: place.name,
              meta:
                metaParts.length > 0
                  ? metaParts.join(' · ')
                  : place.elevationM != null
                    ? `${place.elevationM} m`
                    : 'Localité',
              coordinates: [place.lon, place.lat],
            });
          }
        }

        for (const r of (json.routes ?? []).slice(0, 6)) {
          mapped.push({
            id: `route-${r.id}`,
            kind: 'route',
            routeId: r.id,
            title: r.name?.trim() || r.ref?.trim() || `Itinéraire #${r.id}`,
            meta: r.distance_km != null ? `${r.distance_km.toFixed(1)} km` : 'Itinéraire',
          });
        }

        for (const poi of (json.results ?? []).slice(0, 8)) {
          const coords: [number, number] | null =
            typeof poi.lon === 'number' &&
            typeof poi.lat === 'number' &&
            Number.isFinite(poi.lon) &&
            Number.isFinite(poi.lat)
              ? [poi.lon, poi.lat]
              : null;
          const pres = resolvePoiPresentation(poi.kind, (poi as { subtype?: string | null }).subtype);
          const distLabel =
            typeof poi.distanceKm === 'number' && Number.isFinite(poi.distanceKm)
              ? `${poi.distanceKm < 1 ? `${Math.round(poi.distanceKm * 1000)} m` : `${poi.distanceKm.toFixed(1)} km`}`
              : null;
          mapped.push({
            id: `poi-${poi.id}`,
            kind: 'poi',
            poiId: poi.id,
            poiKind: poi.kind ?? 'place',
            poiSubtype: (poi as { subtype?: string | null }).subtype ?? null,
            title: poi.name,
            meta: distLabel ? `${pres.shortBadge} · ${distLabel}` : pres.shortBadge,
            coordinates: coords,
          });
        }

        if (!controller.signal.aborted) {
          setRemoteItems(mapped);
        }
      } catch {
        if (!controller.signal.aborted) {
          setRemoteItems([]);
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }, 250);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [query, center]);

  const sortedCountries = useMemo<CountryEntry[]>(
    () =>
      [...countries].sort((a, b) =>
        a.name.localeCompare(b.name, 'fr', { sensitivity: 'base' }),
      ),
    [countries],
  );

  // Instant local matching across loaded countries, species, carnets, clubs, bottles
  const localItems = useMemo<ExplorerSearchResultItem[]>(() => {
    const q = normalize(query);
    if (!q) {
      return sortedCountries.slice(0, 6).map((c) => ({
        id: `country-${c.iso}`,
        kind: 'country',
        iso: c.iso,
        title: c.name,
        meta: translateContinent(c.continent) ?? c.iso,
        coordinates: c.center,
      }));
    }

    const out: ExplorerSearchResultItem[] = [];

    for (const c of sortedCountries) {
      if (normalize(c.name).includes(q) || normalize(c.iso) === q) {
        out.push({
          id: `country-${c.iso}`,
          kind: 'country',
          iso: c.iso,
          title: c.name,
          meta: translateContinent(c.continent) ?? c.iso,
          coordinates: c.center,
        });
        if (out.length >= 4) break;
      }
    }

    for (const p of pois) {
      const pres = resolvePoiPresentation(p.kind, p.subtype);
      if (normalize(`${p.name} ${pres.label}`).includes(q)) {
        out.push({
          id: `poi-${p.id}`,
          kind: 'poi',
          poiId: p.id,
          poiKind: p.kind,
          poiSubtype: p.subtype,
          elevationM: p.ele_m,
          title: p.name,
          meta: p.ele_m != null ? `${pres.shortBadge} · ${Math.round(p.ele_m)} m` : pres.shortBadge,
          coordinates: [p.lon, p.lat],
        });
        if (out.length >= 8) break;
      }
    }

    for (const b of bottles) {
      if (normalize(`${b.name} ${b.destination ?? ''} ${b.countryIso ?? ''}`).includes(q)) {
        out.push({
          id: `bottle-${b.id}`,
          kind: 'bottle',
          title: b.name,
          meta: b.countryIso ? `${b.countryIso.toUpperCase()} · ${b.spotsLeft} libre(s)` : 'Bouteille',
          coordinates: b.coordinates ?? null,
        });
      }
    }

    for (const sp of species) {
      if (normalize(`${sp.commonName} ${sp.scientificName}`).includes(q)) {
        out.push({
          id: `species-${sp.taxonId}`,
          kind: 'species',
          taxonId: sp.taxonId,
          title: sp.commonName,
          meta: sp.scientificName,
        });
      }
    }

    for (const carnet of carnets) {
      if (normalize(`${carnet.title} ${carnet.destination ?? ''}`).includes(q)) {
        out.push({
          id: `carnet-${carnet.id}`,
          kind: 'carnet',
          title: carnet.title,
          meta: carnet.destination ?? 'Carnet',
          coordinates: carnet.coordinates ?? null,
        });
      }
    }

    for (const club of clubs) {
      if (normalize(`${club.name} ${club.locationLabel ?? ''}`).includes(q)) {
        out.push({
          id: `club-${club.id}`,
          kind: 'club',
          title: club.name,
          meta: club.locationLabel ?? 'Club',
          coordinates: club.coordinates ?? null,
        });
      }
    }

    return out.slice(0, 14);
  }, [query, sortedCountries, pois, bottles, species, carnets, clubs]);

  const combined = useMemo(() => {
    const seen = new Set<string>();
    const list: ExplorerSearchResultItem[] = [];
    for (const item of [...localItems, ...remoteItems]) {
      if (seen.has(item.id)) continue;
      seen.add(item.id);
      list.push(item);
    }
    return list;
  }, [localItems, remoteItems]);

  return (
    <StackSlideView stackKey="explorer-search">
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          height: '100%',
          minHeight: 0,
        }}
      >
        {/* Sticky search header */}
        <div
          style={{
            position: 'sticky',
            top: 0,
            zIndex: 6,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '4px 12px 10px',
            background: 'rgba(249, 248, 244, 0.94)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            borderBottom: '0.5px solid rgba(23, 64, 44, 0.08)',
          }}
        >
          <div
            className="club-search-box-v2"
            style={{
              flex: '1 1 auto',
              minWidth: 0,
              height: 40,
              padding: '0 12px',
              borderRadius: 999,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              background: 'rgba(255, 255, 255, 0.9)',
              border: '0.5px solid rgba(23, 64, 44, 0.16)',
            }}
          >
            <Search size={15} color="#17402C" aria-hidden="true" style={{ flex: 'none' }} />
            <input
              ref={inputRef}
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Lieu, trace, espèce, club…"
              aria-label="Rechercher un territoire, un itinéraire ou une espèce"
              style={{
                flex: '1 1 auto',
                minWidth: 0,
                border: 0,
                outline: 'none',
                background: 'transparent',
                fontSize: 13.5,
                fontWeight: 600,
                color: '#172B24',
              }}
            />
            {query ? (
              <button
                type="button"
                onClick={() => setQuery('')}
                aria-label="Effacer la recherche"
                style={{
                  width: 22,
                  height: 22,
                  borderRadius: 999,
                  border: 0,
                  background: 'rgba(23, 64, 44, 0.1)',
                  color: '#17402C',
                  display: 'grid',
                  placeItems: 'center',
                  cursor: 'pointer',
                  flex: 'none',
                }}
              >
                <X size={12} aria-hidden="true" />
              </button>
            ) : null}
          </div>

          <button
            type="button"
            className="xp20-close-pill"
            onClick={onClose}
            aria-label="Fermer"
          >
            <X size={15} aria-hidden="true" />
          </button>
        </div>

        {/* Results list */}
        <div
          style={{
            flex: '1 1 auto',
            minHeight: 0,
            overflowY: 'auto',
            padding: '10px 12px 28px',
            display: 'flex',
            flexDirection: 'column',
            gap: 7,
          }}
        >
          {combined.map((item) => {
            const poiPres =
              item.kind === 'poi' && (item.poiKind || item.poiSubtype)
                ? resolvePoiPresentation(item.poiKind, item.poiSubtype)
                : null;
            return (
              <button
                key={item.id}
                type="button"
                className="club-glass-card"
                onClick={() => onPickResult(item)}
                style={{
                  width: '100%',
                  minWidth: 0,
                  boxSizing: 'border-box',
                  overflow: 'hidden',
                  padding: '9px 11px',
                  borderRadius: 16,
                  border: 0,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  textAlign: 'left',
                  cursor: 'pointer',
                }}
              >
                <span
                  aria-hidden="true"
                  style={{
                    width: 34,
                    height: 34,
                    borderRadius: 999,
                    background: poiPres ? poiPres.bgTint : 'rgba(150, 186, 142, 0.24)',
                    color: poiPres ? poiPres.color : '#17402C',
                    display: 'grid',
                    placeItems: 'center',
                    flex: 'none',
                  }}
                >
                  {poiPres ? renderPoiIcon(poiPres.iconKey, 15, poiPres.color) : iconForKind(item.kind)}
                </span>

                <span
                  style={{
                    flex: '1 1 0%',
                    minWidth: 0,
                    fontSize: 13.5,
                    fontWeight: 700,
                    color: '#172B24',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {item.title}
                </span>

                <span
                  style={{
                    flex: '0 1 auto',
                    minWidth: 0,
                    maxWidth: '42%',
                    height: 22,
                    padding: '0 8px',
                    borderRadius: 999,
                    background: poiPres ? poiPres.bgTint : 'rgba(23, 64, 44, 0.08)',
                    color: poiPres ? poiPres.color : '#17402C',
                    fontSize: 10.5,
                    fontWeight: 700,
                    display: 'inline-flex',
                    alignItems: 'center',
                    overflow: 'hidden',
                    boxSizing: 'border-box',
                  }}
                >
                  <span
                    style={{
                      display: 'block',
                      minWidth: 0,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {item.meta || labelForKind(item.kind)}
                  </span>
                </span>
              </button>
            );
          })}

          {!loading && combined.length === 0 && query.trim().length >= 2 ? (
            <div
              className="club-glass-card"
              style={{
                padding: '20px 14px',
                borderRadius: 18,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 6,
                color: '#56665D',
                textAlign: 'center',
              }}
            >
              <Compass size={18} color="#17402C" aria-hidden="true" />
              <span style={{ fontSize: 13, fontWeight: 700, color: '#172B24' }}>
                Aucun résultat pour « {query.trim()} »
              </span>
            </div>
          ) : null}

          {loading ? (
            <div
              style={{
                textAlign: 'center',
                padding: 8,
                fontSize: 11.5,
                fontWeight: 600,
                color: '#56665D',
              }}
            >
              Recherche…
            </div>
          ) : null}
        </div>
      </div>
    </StackSlideView>
  );
}

export default ExplorerSearchSheet;
