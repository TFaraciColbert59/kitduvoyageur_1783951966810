'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Map as MapLibreMap,
  setWorkerUrl,
  type GeoJSONSource,
  type MapLayerMouseEvent,
} from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import type { Country } from '@/lib/countries';
import { getCountryCoordinates } from '@/lib/countryCoordinates';
import { DANGER_FILL } from '@/lib/pays/danger';
import { flyToTarget } from '@/components/map/engine/camera';
import { createMapStyle } from '@/components/map/engine/createMapStyle';
import { resolveIsoA2 } from '@/components/map/engine/geo';
import { MAP_COLORS } from '@/components/map/engine/mapTheme';

/**
 * CHANTIER ATLAS — Phase 5
 * Globe pays MapLibre (projection globe) avec la MÊME API de props que
 * `CountryGlobe` (react-globe.gl) : permet de retirer `react-globe.gl`/`three`
 * sans toucher aux pages Earth ni à leur logique.
 *
 * Écarts volontaires documentés :
 *   - auto-rotation supprimée (calme, reduced-motion friendly) ;
 *   - rendu WebGL masqué dans les snapshots visuels via [data-visual-mask].
 */

const GEOJSON_LOCAL = '/data/countries-110m.geojson';

export interface UnifiedCountryGlobeProps {
  countries: Country[];
  onCountryClick: (code: string) => void;
  /** Sélection (aperçu) — remplace la navigation directe quand fourni. */
  onCountrySelect?: (country: Country) => void;
  /** Focus caméra sur un code pays (ex. recherche mobile). */
  focusCode?: string;
  /** Focus caméra sur un point (lat, lng) — ex. zoom continent. */
  focusPoint?: [number, number] | null;
  fullscreen?: boolean;
  /** Mode uniforme : tous les pays en couleurs neutres Sage/Stone. */
  uniform?: boolean;
}

function getFlagEmoji(code: string): string {
  const cps = code.toUpperCase().split('').map((c) => 127397 + c.charCodeAt(0));
  return String.fromCodePoint(...cps);
}

interface CountryFeatureProperties extends Record<string, unknown> {
  atlas_iso: string;
  atlas_name: string;
  atlas_continent: string;
  atlas_fill: string;
}

/**
 * Reconstruit les features depuis le GeoJSON brut + le filtre `countries`
 * courant (le recolorage suit donc les sélections de continent) — jamais de
 * géométrie inventée, seulement les pays réellement fournis.
 */
function buildGlobeFeatures(
  rawFeatures: Array<Record<string, unknown>>,
  countries: Country[],
  uniform: boolean
): Array<{ properties: CountryFeatureProperties } & Record<string, unknown>> {
  const byIso = new Map(countries.map((c) => [c.code.toUpperCase(), c]));
  return rawFeatures.map((feature) => {
    const properties = (feature.properties ?? {}) as Record<string, unknown>;
    const iso = resolveIsoA2(properties) ?? '';
    const country = iso ? byIso.get(iso) : undefined;
    const danger = country?.danger_level ?? 'low';
    return {
      ...feature,
      properties: {
        ...properties,
        atlas_iso: iso,
        atlas_name: country?.nom ?? '',
        atlas_continent: country?.continent ?? '',
        atlas_fill: uniform
          ? MAP_COLORS.sageLight
          : DANGER_FILL[danger as keyof typeof DANGER_FILL] ?? MAP_COLORS.inkTertiary,
      },
    };
  });
}

export default function UnifiedCountryGlobe({
  countries,
  onCountryClick,
  onCountrySelect,
  focusCode,
  focusPoint,
  fullscreen,
  uniform,
}: UnifiedCountryGlobeProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const countriesRef = useRef<Country[]>(countries);
  const callbacksRef = useRef({ onCountryClick, onCountrySelect });
  const featuresRef = useRef<Array<{ properties: CountryFeatureProperties }>>([]);
  const rawFeaturesRef = useRef<Array<Record<string, unknown>>>([]);
  const uniformRef = useRef<boolean>(Boolean(uniform));

  const [mapReady, setMapReady] = useState(false);
  const [geoLoaded, setGeoLoaded] = useState(false);
  const [geoError, setGeoError] = useState(false);
  const [featuresVersion, setFeaturesVersion] = useState(0);
  const [hovered, setHovered] = useState<{
    code: string;
    nom: string;
    continent: string;
    x: number;
    y: number;
  } | null>(null);

  callbacksRef.current = { onCountryClick, onCountrySelect };
  countriesRef.current = countries;
  uniformRef.current = Boolean(uniform);

  // ── Chargement GeoJSON — timeout 4 s, état d'erreur explicite (parité CountryGlobe) ──
  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 4_000);
    let cancelled = false;
    fetch(GEOJSON_LOCAL, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response.json();
      })
      .then((data) => {
        if (cancelled) return;
        if (!Array.isArray(data?.features)) {
          throw new Error('GeoJSON pays invalide : propriété "features" absente');
        }
        rawFeaturesRef.current = data.features;
        setFeaturesVersion((version) => version + 1);
        setGeoLoaded(true);
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        if ((error as Error)?.name !== 'AbortError') {
          console.error('[UnifiedCountryGlobe] GeoJSON load failed', {
            url: GEOJSON_LOCAL,
            error,
          });
        }
        setGeoError(true);
        setGeoLoaded(true);
      })
      .finally(() => clearTimeout(timer));
    return () => {
      cancelled = true;
      controller.abort();
      clearTimeout(timer);
    };
  }, [uniform]);

  // ── Initialisation du globe (création différée StrictMode-safe) ──────────────
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let cancelled = false;
    let map: MapLibreMap | null = null;

    const startTimer = window.setTimeout(() => {
      if (cancelled || !containerRef.current) return;

      setWorkerUrl('/maplibre/maplibre-gl-worker.mjs');

      let instance: MapLibreMap;
      try {
        instance = new MapLibreMap({
          container,
          style: createMapStyle('topo', { withTiles: false, transparentBackground: true }),
          center: [10, 20],
          zoom: 1.4,
          attributionControl: false,
          dragRotate: false,
          pitchWithRotate: false,
          canvasContextAttributes: { alpha: true },
        });
      } catch (caught) {
        // Jamais de globe blanc sans message : erreur explicite + log contextuel.
        console.error("[UnifiedCountryGlobe] échec d'initialisation MapLibre", caught);
        setGeoError(true);
        setGeoLoaded(true);
        return;
      }
      map = instance;
      mapRef.current = instance;

      instance.on('style.load', () => {
        if (cancelled) return;
        try {
          instance.setSky({
            'sky-color': MAP_COLORS.sageLight,
            'horizon-color': 'rgba(255,255,255,0)',
            'fog-color': MAP_COLORS.background,
            'sky-horizon-blend': 0.4,
            'atmosphere-blend': 0.85,
          });
        } catch (error) {
          console.error('[UnifiedCountryGlobe] setSky indisponible:', error);
        }

        instance.addSource('globe-countries', {
          type: 'geojson',
          data: {
            type: 'FeatureCollection',
            features: buildGlobeFeatures(
              rawFeaturesRef.current,
              countriesRef.current,
              uniformRef.current
            ),
          } as unknown as GeoJSON.GeoJSON,
        });
        instance.addLayer({
          id: 'globe-countries-fill',
          type: 'fill',
          source: 'globe-countries',
          paint: {
            'fill-color': ['get', 'atlas_fill'],
            'fill-opacity': uniform ? 0.72 : 0.55,
            'fill-antialias': true,
          },
        });
        instance.addLayer({
          id: 'globe-countries-line',
          type: 'line',
          source: 'globe-countries',
          paint: {
            'line-color': MAP_COLORS.white,
            'line-opacity': 0.45,
            'line-width': 0.7,
          },
        });

        const findCountry = (iso: string): Country | undefined =>
          countriesRef.current.find((candidate) => candidate.code.toUpperCase() === iso);

        instance.on('click', 'globe-countries-fill', (event: MapLayerMouseEvent) => {
          const iso = String(event.features?.[0]?.properties?.atlas_iso ?? '');
          const country = iso ? findCountry(iso) : undefined;
          if (!country) return;
          if (callbacksRef.current.onCountrySelect) {
            callbacksRef.current.onCountrySelect(country);
          } else {
            callbacksRef.current.onCountryClick(country.code);
          }
        });

        instance.on('mousemove', 'globe-countries-fill', (event: MapLayerMouseEvent) => {
          instance.getCanvas().style.cursor = 'pointer';
          if (typeof window !== 'undefined' && window.innerWidth < 768) return;
          const feature = event.features?.[0];
          const iso = String(feature?.properties?.atlas_iso ?? '');
          const country = iso ? findCountry(iso) : undefined;
          if (!country) {
            setHovered(null);
            return;
          }
          setHovered({
            code: country.code,
            nom: country.nom,
            continent: country.continent,
            x: event.point.x,
            y: event.point.y,
          });
        });
        instance.on('mouseleave', 'globe-countries-fill', () => {
          instance.getCanvas().style.cursor = '';
          setHovered(null);
        });

        setMapReady(true);
      });

      instance.on('error', (event) => {
        console.error('[UnifiedCountryGlobe] MapLibre error', event?.error ?? event);
      });
    }, 0);

    return () => {
      cancelled = true;
      window.clearTimeout(startTimer);
      if (map) {
        map.remove();
        mapRef.current = null;
      }
      setMapReady(false);
    };
    // uniform influence les couleurs de remplissage des features (pas de remap nécessaire ici)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Synchronisation des features (GeoJSON brut × filtre pays × mode uniforme)
  //    Le recolorage suit les sélections de continent de la page Earth. ─────────
  useEffect(() => {
    const mapped = buildGlobeFeatures(
      rawFeaturesRef.current,
      countries,
      Boolean(uniform)
    ) as Array<{ properties: CountryFeatureProperties }>;
    featuresRef.current = mapped;

    const map = mapRef.current;
    if (!map || !mapReady || featuresVersion === 0) return;
    const source = map.getSource('globe-countries') as GeoJSONSource | undefined;
    source?.setData({
      type: 'FeatureCollection',
      features: mapped,
    } as unknown as GeoJSON.GeoJSON);
  }, [mapReady, featuresVersion, countries, uniform]);

  // ── Focus caméra (focusPoint prioritaire sur focusCode) ─────────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;
    if (focusPoint) {
      const [lat, lng] = focusPoint;
      flyToTarget(map, { center: [lng, lat], zoom: 3.2, duration: 1_200 });
      return;
    }
    if (!focusCode) return;
    const coords = getCountryCoordinates(focusCode);
    if (coords) {
      flyToTarget(map, { center: [coords.lng, coords.lat], zoom: 1.9, duration: 1_000 });
    }
  }, [mapReady, focusCode, focusPoint]);

  const handleMouseDown = useCallback(() => {
    if (typeof document !== 'undefined') document.body.style.cursor = 'grabbing';
  }, []);
  const handleMouseUp = useCallback(() => {
    if (typeof document !== 'undefined') document.body.style.cursor = 'grab';
  }, []);

  return (
    <div
      ref={containerRef}
      data-visual-mask
      className="relative w-full h-full"
      style={fullscreen ? undefined : { width: '100%', height: '100%' }}
      onMouseDown={handleMouseDown}
      onMouseUp={handleMouseUp}
    >
      {/* Spinner pendant le chargement du GeoJSON (parité CountryGlobe) */}
      {!geoLoaded && (
        <div className="absolute inset-0 z-[5] flex flex-col items-center justify-center gap-3 pointer-events-none">
          <div
            className="w-8 h-8 rounded-full border-[3px] border-[#17402C] border-t-transparent animate-spin"
            style={{ animationDuration: '0.8s' }}
          />
          <span className="text-[11px] font-bold tracking-[0.06em] text-[#17402C] font-mono">
            Chargement des pays…
          </span>
        </div>
      )}

      {/* État d'erreur explicite (jamais un spinner infini) */}
      {geoLoaded && geoError && (
        <div className="absolute inset-0 z-[5] flex flex-col items-center justify-center gap-2 pointer-events-none">
          <span className="text-[13px] font-bold text-[#A8443A]">⚠ Impossible de charger la carte</span>
          <span className="text-[11px] text-[#5A7064]">Vérifiez votre connexion et rechargez la page.</span>
        </div>
      )}

      {/* Tooltip pays (desktop) — pilule glass, contenu React échappé */}
      {hovered && !uniform && (
        <div
          className="absolute z-[10] pointer-events-none"
          style={{ left: hovered.x, top: hovered.y, transform: 'translate(-50%, -150%)' }}
        >
          <div className="glass rounded-full px-3.5 py-1.5 flex items-center gap-2 whitespace-nowrap shadow-lg">
            <span className="text-[15px] leading-none">{getFlagEmoji(hovered.code)}</span>
            <span className="text-[12px] font-bold text-[#17402C]">{hovered.nom}</span>
            <span className="text-[10.5px] font-mono font-semibold text-[#5A7064]">· {hovered.continent}</span>
          </div>
        </div>
      )}
    </div>
  );
}
