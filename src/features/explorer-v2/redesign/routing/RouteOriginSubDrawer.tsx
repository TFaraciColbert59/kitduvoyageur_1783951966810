'use client';

import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  CheckCircle2,
  Compass,
  Crosshair,
  Loader2,
  MapPin,
  Navigation,
  Search,
  X,
} from 'lucide-react';
import type { RoutePlanEndpoint } from '../../routing/types';
import { distanceKm } from '../../sheet/context';

const GPS_LOCATING_TIMEOUT_MS = 3500;
const DESTINATION_PROXIMITY_KM = 0.15;

function normalizePlaceName(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

export interface VerifiedGpsState {
  status: 'idle' | 'locating' | 'verified' | 'denied' | 'error';
  lat?: number;
  lng?: number;
  accuracyM?: number | null;
  label?: string;
  errorTitle?: string;
  errorHint?: string;
}

interface GeocodeMatch {
  id: string;
  name: string;
  context: string;
  country: string;
  lat: number;
  lon: number;
}

export interface RouteOriginSubDrawerProps {
  currentOrigin: RoutePlanEndpoint | null;
  destination?: {
    id?: string | null;
    name?: string | null;
    lat?: number | null;
    lng?: number | null;
  } | null;
  mapCenterFallback?: [number, number] | null;
  verifiedGps: VerifiedGpsState;
  savedPlaces?: ReadonlyArray<{ id: string; name: string; lat: number; lng: number; kind?: string }>;
  onRequestVerifiedGps: () => void;
  onSelectOrigin: (origin: RoutePlanEndpoint) => void;
  onBack: () => void;
}

export function RouteOriginSubDrawer({
  currentOrigin,
  destination = null,
  mapCenterFallback = null,
  verifiedGps,
  savedPlaces = [],
  onRequestVerifiedGps,
  onSelectOrigin,
  onBack,
}: RouteOriginSubDrawerProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<GeocodeMatch[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchErr, setSearchErr] = useState<string | null>(null);
  const [gpsTimedOut, setGpsTimedOut] = useState(false);
  const [gpsAttemptNonce, setGpsAttemptNonce] = useState(0);

  useEffect(() => {
    if (verifiedGps.status !== 'locating') {
      setGpsTimedOut(false);
      return;
    }
    setGpsTimedOut(false);
    const timer = window.setTimeout(() => {
      setGpsTimedOut(true);
    }, GPS_LOCATING_TIMEOUT_MS);
    return () => window.clearTimeout(timer);
  }, [verifiedGps.status, gpsAttemptNonce]);

  const effectiveGps: VerifiedGpsState =
    gpsTimedOut && verifiedGps.status === 'locating'
      ? {
          status: 'error',
          errorTitle: 'Signal GPS indisponible',
          errorHint: 'Saisissez un lieu ci-dessus ou choisissez un point de départ.',
        }
      : verifiedGps;

  const triggerGpsRequest = () => {
    setGpsTimedOut(false);
    setGpsAttemptNonce((n) => n + 1);
    onRequestVerifiedGps();
  };

  const filteredSavedPlaces = useMemo(() => {
    if (!savedPlaces.length) return [];
    const destId = destination?.id ?? null;
    const destLat = typeof destination?.lat === 'number' && Number.isFinite(destination.lat) ? destination.lat : null;
    const destLng = typeof destination?.lng === 'number' && Number.isFinite(destination.lng) ? destination.lng : null;
    const destNormName = destination?.name ? normalizePlaceName(destination.name) : '';

    return savedPlaces.filter((sp) => {
      if (destId && sp.id === destId) return false;
      if (destLat !== null && destLng !== null) {
        if (distanceKm([sp.lng, sp.lat], [destLng, destLat]) < DESTINATION_PROXIMITY_KM) {
          return false;
        }
      }
      if (destNormName && normalizePlaceName(sp.name) === destNormName) {
        return false;
      }
      return true;
    });
  }, [savedPlaces, destination]);

  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setResults([]);
      setSearching(false);
      setSearchErr(null);
      return;
    }
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      setSearching(true);
      setSearchErr(null);
      void fetch(`/api/geocode?q=${encodeURIComponent(trimmed)}`, {
        signal: controller.signal,
      })
        .then((res) => (res.ok ? res.json() : null))
        .then((data: { matches?: GeocodeMatch[] } | null) => {
          if (controller.signal.aborted) return;
          setResults(Array.isArray(data?.matches) ? data.matches.slice(0, 8) : []);
          setSearching(false);
        })
        .catch(() => {
          if (controller.signal.aborted) return;
          setSearchErr('Recherche indisponible');
          setSearching(false);
        });
    }, 260);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [query]);

  return (
    <div className="xp20-route-subsheet" role="region" aria-label="Choisir le point de départ">
      <div className="xp20-route-header">
        <button
          type="button"
          className="xp20-route-icon-btn"
          onClick={onBack}
          aria-label="Retour à l’itinéraire"
        >
          <ArrowLeft size={16} aria-hidden="true" />
        </button>
        <div className="xp20-route-header-copy">
          <h2 className="xp20-route-title">Point de départ</h2>
          <p className="xp20-route-subtitle">
            {currentOrigin ? `Actuel : ${currentOrigin.label || 'Position'}` : 'Vérifiez votre GPS ou choisissez un lieu'}
          </p>
        </div>
      </div>

      {/* Real place search bar (/api/geocode) */}
      <div className="xp20-origin-search-wrap">
        <Search size={15} className="xp20-origin-search-icon" aria-hidden="true" />
        <input
          type="search"
          className="xp20-origin-search-input"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Ville, gare, col ou adresse…"
          aria-label="Rechercher un lieu de départ"
          autoFocus
        />
        {query ? (
          <button
            type="button"
            className="xp20-origin-clear-btn"
            onClick={() => setQuery('')}
            aria-label="Effacer"
          >
            <X size={13} aria-hidden="true" />
          </button>
        ) : null}
      </div>

      <div className="xp20-route-scroll">
        {/* Verified Live GPS Card */}
        <button
          type="button"
          className="xp20-origin-gps-card"
          data-status={effectiveGps.status}
          onClick={() => {
            if (
              effectiveGps.status === 'verified' &&
              typeof effectiveGps.lat === 'number' &&
              typeof effectiveGps.lng === 'number'
            ) {
              onSelectOrigin({
                lat: effectiveGps.lat,
                lng: effectiveGps.lng,
                label: effectiveGps.label ? `Ma position (${effectiveGps.label})` : 'Ma position GPS',
              });
            } else {
              triggerGpsRequest();
            }
          }}
        >
          <span className="xp20-origin-gps-icon">
            {effectiveGps.status === 'locating' ? (
              <Loader2 size={16} className="xp20-route-spin" aria-hidden="true" />
            ) : effectiveGps.status === 'verified' ? (
              <CheckCircle2 size={16} aria-hidden="true" />
            ) : (
              <Crosshair size={16} aria-hidden="true" />
            )}
          </span>
          <div className="xp20-origin-gps-copy">
            <strong>
              {effectiveGps.status === 'locating'
                ? 'Localisation GPS précise…'
                : effectiveGps.status === 'verified'
                  ? `Ma position · ${effectiveGps.label || 'GPS vérifié'}`
                  : effectiveGps.status === 'denied' || effectiveGps.status === 'error'
                    ? (effectiveGps.errorTitle ?? 'GPS bloqué — cliquer pour autoriser')
                    : 'Utiliser ma position GPS exacte'}
            </strong>
            <span>
              {effectiveGps.status === 'verified' &&
              typeof effectiveGps.lat === 'number' &&
              typeof effectiveGps.lng === 'number'
                ? `${effectiveGps.lat.toFixed(4)}, ${effectiveGps.lng.toFixed(4)}${effectiveGps.accuracyM ? ` · ±${Math.round(effectiveGps.accuracyM)} m` : ''}`
                : effectiveGps.errorHint
                  ? effectiveGps.errorHint
                  : 'Haute précision navigateur + vérification commune'}
            </span>
          </div>
          {effectiveGps.status === 'verified' ? (
            <span
              role="button"
              tabIndex={0}
              className="xp20-origin-recalib-chip"
              onClick={(e) => {
                e.stopPropagation();
                triggerGpsRequest();
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  e.stopPropagation();
                  triggerGpsRequest();
                }
              }}
            >
              Recalibrer
            </span>
          ) : null}
        </button>

        {/* Map center quick fallback when GPS is unavailable */}
        {query.trim().length < 2 &&
        mapCenterFallback &&
        effectiveGps.status !== 'verified' ? (
          <button
            type="button"
            className="xp20-origin-result-row"
            onClick={() =>
              onSelectOrigin({
                lat: mapCenterFallback[1],
                lng: mapCenterFallback[0],
                label: 'Centre de la carte',
              })
            }
          >
            <Compass size={15} className="xp20-origin-pin" aria-hidden="true" />
            <div className="xp20-origin-result-copy">
              <strong>Partir du centre de la carte</strong>
              <span>
                {mapCenterFallback[1].toFixed(4)}, {mapCenterFallback[0].toFixed(4)}
              </span>
            </div>
            <Navigation size={13} className="xp20-origin-arrow" aria-hidden="true" />
          </button>
        ) : null}

        {/* Geocoded search results */}
        {searching ? (
          <div className="xp20-origin-status">
            <Loader2 size={14} className="xp20-route-spin" aria-hidden="true" />
            <span>Recherche en cours…</span>
          </div>
        ) : searchErr ? (
          <div className="xp20-origin-status">{searchErr}</div>
        ) : results.length > 0 ? (
          <div className="xp20-origin-results">
            {results.map((m) => (
              <button
                key={m.id}
                type="button"
                className="xp20-origin-result-row"
                onClick={() =>
                  onSelectOrigin({
                    lat: m.lat,
                    lng: m.lon,
                    label: m.name,
                  })
                }
              >
                <MapPin size={15} className="xp20-origin-pin" aria-hidden="true" />
                <div className="xp20-origin-result-copy">
                  <strong>{m.name}</strong>
                  <span>{[m.context, m.country].filter(Boolean).join(' · ')}</span>
                </div>
                <Navigation size={13} className="xp20-origin-arrow" aria-hidden="true" />
              </button>
            ))}
          </div>
        ) : query.trim().length >= 2 ? (
          <div className="xp20-origin-status">Aucun lieu trouvé pour « {query.trim()} ».</div>
        ) : null}

        {/* Saved places shortcuts (excluding current destination) */}
        {query.trim().length < 2 && filteredSavedPlaces.length > 0 ? (
          <div className="xp20-origin-results">
            <div className="xp20-route-section-eyebrow" style={{ paddingLeft: 4 }}>
              Lieux enregistrés
            </div>
            {filteredSavedPlaces.slice(0, 5).map((sp) => (
              <button
                key={sp.id}
                type="button"
                className="xp20-origin-result-row"
                onClick={() =>
                  onSelectOrigin({
                    lat: sp.lat,
                    lng: sp.lng,
                    label: sp.name,
                  })
                }
              >
                <MapPin size={15} className="xp20-origin-pin" aria-hidden="true" />
                <div className="xp20-origin-result-copy">
                  <strong>{sp.name}</strong>
                  <span>{sp.lat.toFixed(4)}, {sp.lng.toFixed(4)}</span>
                </div>
              </button>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}
