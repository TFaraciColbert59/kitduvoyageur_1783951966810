'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Bookmark,
  Cloud,
  CloudOff,
  Mountain,
  Navigation,
  Route,
  Search,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import { CARNET_SPRING } from '@/components/carnet/v2/CarnetDrawerMotion';
import type { SavedPlace } from '../savedPlaces';
import { resolvePoiPresentation } from '../poiTaxonomy';
import { renderPoiIcon } from './lenses/ExplorerPoiDetailView';

export interface SavedPlacesDrawerProps {
  places: ReadonlyArray<SavedPlace>;
  syncedToCloud?: boolean;
  onSelectPlace: (place: SavedPlace) => void;
  onRouteToPlace?: (place: SavedPlace) => void;
  onRemovePlace: (place: SavedPlace) => void;
  onImportGpxFile?: (file: File) => void;
  onClose: () => void;
}

const KIND_FALLBACK_LABELS: Record<SavedPlace['kind'], string> = {
  poi: 'Repère',
  highlight: 'À découvrir',
  place: 'Lieu',
  route: 'Parcours',
};

function resolveSavedPlaceVisual(place: SavedPlace) {
  if (place.kind === 'route') {
    return {
      badge: 'Parcours',
      color: '#17402C',
      bgTint: 'rgba(23, 64, 44, 0.12)',
      icon: <Route size={16} color="#17402C" aria-hidden="true" />,
    };
  }
  const pres = resolvePoiPresentation(place.kind, place.subtype);
  const badge =
    place.subtype || place.kind === 'poi'
      ? pres.shortBadge
      : KIND_FALLBACK_LABELS[place.kind] ?? pres.shortBadge;
  return {
    badge,
    color: pres.color,
    bgTint: pres.bgTint,
    icon: renderPoiIcon(pres.iconKey, 16, pres.color),
  };
}

export function SavedPlacesDrawer({
  places,
  syncedToCloud = false,
  onSelectPlace,
  onRouteToPlace,
  onRemovePlace,
  onImportGpxFile,
  onClose,
}: SavedPlacesDrawerProps) {
  const [query, setQuery] = useState('');
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  const filteredPlaces = useMemo(() => {
    const clean = query.trim().toLowerCase();
    if (!clean) return places;
    return places.filter((place) => {
      const hay = [
        place.name,
        place.areaLabel ?? '',
        place.subtype ?? '',
        KIND_FALLBACK_LABELS[place.kind] ?? '',
      ]
        .join(' ')
        .toLowerCase();
      return hay.includes(clean);
    });
  }, [places, query]);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && onImportGpxFile) {
      onImportGpxFile(file);
    }
    event.target.value = '';
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Mes lieux enregistrés"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 72,
        background: 'rgba(15, 29, 24, 0.28)',
        backdropFilter: 'blur(6px)',
        WebkitBackdropFilter: 'blur(6px)',
        display: 'flex',
        justifyContent: 'flex-end',
        padding: 12,
      }}
    >
      <motion.div
        initial={{ opacity: 0, x: 24, scale: 0.98 }}
        animate={{ opacity: 1, x: 0, scale: 1 }}
        exit={{ opacity: 0, x: 20, scale: 0.98 }}
        transition={CARNET_SPRING}
        style={{
          width: 'min(410px, 100%)',
          height: '100%',
          maxHeight: '100%',
          borderRadius: 26,
          background: 'rgba(251, 250, 246, 0.88)',
          backdropFilter: 'blur(26px) saturate(1.4)',
          WebkitBackdropFilter: 'blur(26px) saturate(1.4)',
          border: '0.5px solid rgba(255, 255, 255, 0.72)',
          boxShadow:
            'inset 0 1px 0 rgba(255, 255, 255, 0.95), 0 22px 48px rgba(17, 36, 28, 0.22)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '16px 16px 12px',
            borderBottom: '0.5px solid rgba(23, 64, 44, 0.1)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 10,
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7, minWidth: 0 }}>
              <span
                style={{
                  width: 30,
                  height: 30,
                  borderRadius: 10,
                  background: 'rgba(23, 64, 44, 0.1)',
                  color: '#17402C',
                  display: 'inline-grid',
                  placeItems: 'center',
                  flex: 'none',
                }}
              >
                <Bookmark size={15} aria-hidden="true" />
              </span>
              <h2
                style={{
                  margin: 0,
                  fontSize: 15.5,
                  fontWeight: 800,
                  color: '#172B24',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                Mes lieux enregistrés
              </h2>
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 800,
                  padding: '2px 7px',
                  borderRadius: 999,
                  background: 'rgba(23, 64, 44, 0.1)',
                  color: '#17402C',
                  fontVariantNumeric: 'tabular-nums',
                  flex: 'none',
                }}
              >
                {places.length}
              </span>
            </div>

            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
                width: 'fit-content',
                padding: '2px 8px',
                borderRadius: 999,
                background: syncedToCloud
                  ? 'rgba(21, 128, 61, 0.11)'
                  : 'rgba(86, 102, 93, 0.1)',
                color: syncedToCloud ? '#15803D' : '#56665D',
                fontSize: 10.5,
                fontWeight: 700,
              }}
            >
              {syncedToCloud ? (
                <Cloud size={11} aria-hidden="true" />
              ) : (
                <CloudOff size={11} aria-hidden="true" />
              )}
              <span>{syncedToCloud ? 'Synchronisé cloud' : 'Enregistré sur cet appareil'}</span>
            </span>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer mes lieux enregistrés"
            style={{
              width: 34,
              height: 34,
              flex: 'none',
              borderRadius: 999,
              border: '0.5px solid rgba(23, 64, 44, 0.16)',
              background: 'rgba(255, 255, 255, 0.9)',
              color: '#17402C',
              display: 'inline-grid',
              placeItems: 'center',
              cursor: 'pointer',
              boxShadow: 'inset 0 1px 0 #fff, 0 2px 6px rgba(23, 43, 36, 0.06)',
            }}
          >
            <X size={16} aria-hidden="true" />
          </button>
        </div>

        {/* Search + Optional GPX Import */}
        <div
          style={{
            padding: '10px 16px',
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
            borderBottom: '0.5px solid rgba(23, 64, 44, 0.08)',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              height: 38,
              padding: '0 12px',
              borderRadius: 14,
              background: 'rgba(255, 255, 255, 0.85)',
              border: '0.5px solid rgba(23, 64, 44, 0.15)',
              boxShadow: 'inset 0 1px 2px rgba(23, 43, 36, 0.04)',
            }}
          >
            <Search size={14} color="#56665D" aria-hidden="true" style={{ flex: 'none' }} />
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Rechercher un refuge, sommet, trace…"
              aria-label="Rechercher dans mes lieux enregistrés"
              style={{
                flex: 1,
                minWidth: 0,
                border: 0,
                outline: 'none',
                background: 'transparent',
                fontSize: 13,
                fontWeight: 500,
                color: '#172B24',
              }}
            />
            {query ? (
              <button
                type="button"
                onClick={() => setQuery('')}
                aria-label="Effacer la recherche"
                style={{
                  border: 0,
                  background: 'transparent',
                  color: '#56665D',
                  display: 'inline-grid',
                  placeItems: 'center',
                  cursor: 'pointer',
                  padding: 2,
                }}
              >
                <X size={13} aria-hidden="true" />
              </button>
            ) : null}
          </div>

          {onImportGpxFile ? (
            <>
              <input
                ref={fileInputRef}
                type="file"
                accept=".gpx,application/gpx+xml"
                onChange={handleFileChange}
                style={{ display: 'none' }}
                aria-hidden="true"
                tabIndex={-1}
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                style={{
                  height: 34,
                  padding: '0 12px',
                  borderRadius: 12,
                  border: '0.5px dashed rgba(23, 64, 44, 0.28)',
                  background: 'rgba(23, 64, 44, 0.05)',
                  color: '#17402C',
                  fontSize: 12,
                  fontWeight: 700,
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                  cursor: 'pointer',
                }}
              >
                <Upload size={13} aria-hidden="true" />
                <span>Importer une trace GPX</span>
              </button>
            </>
          ) : null}
        </div>

        {/* Saved Places List */}
        <div
          style={{
            flex: 1,
            minHeight: 0,
            overflowY: 'auto',
            padding: '12px 16px 20px',
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
          }}
        >
          {filteredPlaces.length === 0 ? (
            <div
              className="club-glass-card"
              style={{
                padding: '26px 18px',
                borderRadius: 20,
                background:
                  'linear-gradient(180deg, rgba(240, 249, 244, 0.85), rgba(255, 255, 255, 0.82))',
                border: '0.5px solid rgba(23, 64, 44, 0.14)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 8,
                textAlign: 'center',
                marginTop: 12,
              }}
            >
              <span
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 999,
                  background: 'rgba(23, 64, 44, 0.1)',
                  color: '#17402C',
                  display: 'inline-grid',
                  placeItems: 'center',
                }}
              >
                <Bookmark size={20} aria-hidden="true" />
              </span>
              <strong style={{ fontSize: 14, fontWeight: 800, color: '#172B24' }}>
                {places.length === 0
                  ? 'Aucun lieu enregistré'
                  : 'Aucun lieu ne correspond à votre recherche'}
              </strong>
              <span style={{ fontSize: 12, color: '#56665D', lineHeight: 1.45, maxWidth: 260 }}>
                {places.length === 0
                  ? 'Enregistrez vos refuges, points d’eau, sommets ou parcours favoris pour les retrouver rapidement.'
                  : 'Essayez un autre mot-clé ou effacez le filtre.'}
              </span>
            </div>
          ) : (
            filteredPlaces.map((place) => {
              const visual = resolveSavedPlaceVisual(place);
              return (
                <div
                  key={place.id}
                  className="club-glass-card"
                  style={{
                    borderRadius: 18,
                    background: 'rgba(255, 255, 255, 0.86)',
                    border: '0.5px solid rgba(23, 64, 44, 0.12)',
                    boxShadow:
                      'inset 0 1px 0 rgba(255, 255, 255, 0.96), 0 4px 12px rgba(23, 43, 36, 0.05)',
                    padding: '10px 11px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                  }}
                >
                  <button
                    type="button"
                    onClick={() => onSelectPlace(place)}
                    style={{
                      flex: 1,
                      minWidth: 0,
                      border: 0,
                      padding: 0,
                      background: 'transparent',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      textAlign: 'left',
                      cursor: 'pointer',
                    }}
                  >
                    <span
                      style={{
                        width: 36,
                        height: 36,
                        borderRadius: 12,
                        background: visual.bgTint,
                        color: visual.color,
                        display: 'inline-grid',
                        placeItems: 'center',
                        flex: 'none',
                      }}
                    >
                      {visual.icon}
                    </span>

                    <div
                      style={{
                        minWidth: 0,
                        flex: 1,
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 3,
                      }}
                    >
                      <span
                        style={{
                          fontSize: 13,
                          fontWeight: 700,
                          color: '#172B24',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}
                      >
                        {place.name}
                      </span>

                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 5,
                          flexWrap: 'wrap',
                        }}
                      >
                        <span
                          style={{
                            fontSize: 10,
                            fontWeight: 700,
                            padding: '1.5px 7px',
                            borderRadius: 999,
                            background: visual.bgTint,
                            color: visual.color,
                          }}
                        >
                          {visual.badge}
                        </span>
                        {typeof place.eleM === 'number' && Number.isFinite(place.eleM) ? (
                          <span
                            style={{
                              fontSize: 10.5,
                              fontWeight: 600,
                              color: '#56665D',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 2,
                              fontVariantNumeric: 'tabular-nums',
                            }}
                          >
                            <Mountain size={10} aria-hidden="true" />
                            {Math.round(place.eleM)} m
                          </span>
                        ) : null}
                        {place.areaLabel ? (
                          <span
                            style={{
                              fontSize: 10.5,
                              fontWeight: 600,
                              color: '#6E7F76',
                              whiteSpace: 'nowrap',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              maxWidth: 130,
                            }}
                          >
                            {place.areaLabel}
                          </span>
                        ) : null}
                      </div>
                    </div>
                  </button>

                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5, flex: 'none' }}>
                    {onRouteToPlace ? (
                      <button
                        type="button"
                        onClick={() => onRouteToPlace(place)}
                        aria-label={`Itinéraire vers ${place.name}`}
                        style={{
                          height: 30,
                          padding: '0 10px',
                          borderRadius: 999,
                          border: 0,
                          background: 'linear-gradient(180deg, #1f543a, #17402c)',
                          color: '#FBFAF6',
                          fontSize: 11,
                          fontWeight: 700,
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 4,
                          cursor: 'pointer',
                          boxShadow: '0 3px 8px rgba(23, 64, 44, 0.2)',
                        }}
                      >
                        <Navigation size={11} aria-hidden="true" />
                        <span>Y aller</span>
                      </button>
                    ) : null}

                    <button
                      type="button"
                      onClick={() => onRemovePlace(place)}
                      aria-label={`Supprimer ${place.name}`}
                      title="Supprimer"
                      style={{
                        width: 30,
                        height: 30,
                        borderRadius: 999,
                        border: '0.5px solid rgba(220, 38, 38, 0.18)',
                        background: 'rgba(220, 38, 38, 0.06)',
                        color: '#B91C1C',
                        display: 'inline-grid',
                        placeItems: 'center',
                        cursor: 'pointer',
                      }}
                    >
                      <Trash2 size={13} aria-hidden="true" />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </motion.div>
    </div>
  );
}
