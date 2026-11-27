'use client';

import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  Bookmark,
  Check,
  ChevronDown,
  ChevronLeft,
  Compass,
  Loader2,
  LocateFixed,
  Map as MapIcon,
  MapPin,
  WifiOff,
  X,
} from 'lucide-react';
import { ClubIsland, type ClubIslandToast } from '@/components/clubs/drawer/ClubIsland';
import type { MapBaseStyle } from '../state/types';
import type { ExplorerLoadingPhase } from '../data/spatialLoader';

export interface LocationPermissionBannerProps {
  visible: boolean;
  locating: boolean;
  status: 'prompt' | 'denied' | 'granted';
  errorTitle?: string | null;
  errorHint?: string | null;
  onRequestLocation: () => void;
  onDismiss: () => void;
}

export interface ExplorerMapChromeProps {
  locationLabel: string;
  canGoBack: boolean;
  onBack?: () => void;
  onOpenSearch: () => void;
  bearingDeg: number;
  onCompassClick: () => void;
  onLocateClick: () => void;
  locateState?: 'granted' | 'locating' | 'prompt' | 'denied';
  locationPermissionBanner?: LocationPermissionBannerProps;
  mapBaseStyle: MapBaseStyle;
  hasNationalTopo?: boolean;
  nationalTopoLabel?: string | null;
  onSelectBaseStyle: (style: MapBaseStyle) => void;
  offline?: boolean;
  offlinePending?: number;
  loadingPhase?: ExplorerLoadingPhase;
  loadingLabel?: string;
  islandToast: ClubIslandToast | null;
  onDismissIsland: () => void;
  /** Compact mode for live GPS HUD: hides left search pill and keeps compass/locate/style + island. */
  compactLive?: boolean;
  /** Optional bookmark drawer trigger in explore mode. */
  onOpenSavedPlaces?: () => void;
  savedPlacesCount?: number;
}

interface BaseStyleOption {
  id: MapBaseStyle;
  label: string;
}

export const ExplorerMapChrome = React.memo(function ExplorerMapChrome({
  locationLabel,
  canGoBack,
  onBack,
  onOpenSearch,
  bearingDeg,
  onCompassClick,
  onLocateClick,
  locateState = 'prompt',
  locationPermissionBanner,
  mapBaseStyle,
  hasNationalTopo = false,
  nationalTopoLabel = null,
  onSelectBaseStyle,
  offline = false,
  offlinePending = 0,
  loadingPhase = 'idle',
  loadingLabel = 'Fond de carte',
  islandToast,
  onDismissIsland,
  compactLive = false,
  onOpenSavedPlaces,
  savedPlacesCount = 0,
}: ExplorerMapChromeProps) {
  const [styleOpen, setStyleOpen] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);
  const styleBtnRef = useRef<HTMLButtonElement>(null);
  const styleMenuId = useId();

  const styleOptions = useMemo<BaseStyleOption[]>(() => {
    const base: BaseStyleOption[] = [
      { id: 'relief', label: 'Relief 3D' },
      { id: 'satellite', label: 'Satellite' },
      { id: 'plan', label: 'Plan' },
    ];
    if (hasNationalTopo) {
      base.push({
        id: 'national',
        label: nationalTopoLabel?.trim() || 'IGN / National',
      });
    }
    return base;
  }, [hasNationalTopo, nationalTopoLabel]);

  useEffect(() => {
    if (!styleOpen) return;

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node | null;
      if (!target) return;
      if (popoverRef.current?.contains(target) || styleBtnRef.current?.contains(target)) {
        return;
      }
      setStyleOpen(false);
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        setStyleOpen(false);
        styleBtnRef.current?.focus({ preventScroll: true });
      }
    };

    document.addEventListener('pointerdown', handlePointerDown, true);
    document.addEventListener('keydown', handleKeyDown, true);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown, true);
      document.removeEventListener('keydown', handleKeyDown, true);
    };
  }, [styleOpen]);

  return (
    <div
      className="xp20-top-chrome"
      data-testid="xp20-top-chrome"
      data-compact-live={compactLive ? 'true' : undefined}
    >
      <div className="xp20-top-left">
        {!compactLive ? (
          <div className="xp20-loc-pill">
            {canGoBack && onBack ? (
              <button
                type="button"
                className="xp20-loc-back"
                onClick={onBack}
                aria-label="Revenir à l'échelle précédente"
              >
                <ChevronLeft size={16} strokeWidth={2.2} aria-hidden="true" />
              </button>
            ) : null}
            <button
              type="button"
              className="xp20-loc-trigger"
              onClick={onOpenSearch}
              aria-label={`Rechercher ou changer de territoire : ${locationLabel}`}
            >
              <MapPin size={14} strokeWidth={2.2} className="xp20-loc-pin" aria-hidden="true" />
              <span className="xp20-loc-label">{locationLabel}</span>
              <ChevronDown size={14} strokeWidth={2.2} className="xp20-loc-caret" aria-hidden="true" />
            </button>
          </div>
        ) : null}

        {offline ? (
          <span className="xp20-offline-pill" role="status" aria-live="polite">
            <span className="xp20-offline-dot" aria-hidden="true" />
            <WifiOff size={12} strokeWidth={2.1} aria-hidden="true" />
            <span>Hors-ligne{offlinePending > 0 ? ` · ${offlinePending}` : ''}</span>
          </span>
        ) : null}

        {!compactLive && locationPermissionBanner?.visible ? (
          <div
            className="xp20-loc-perm-pill"
            data-status={locationPermissionBanner.errorHint ? 'warn' : locationPermissionBanner.status}
            role="region"
            aria-label="Autorisation de localisation de l’appareil"
          >
            <div className="xp20-loc-perm-row">
              <span className="xp20-loc-perm-ico" aria-hidden="true">
                {locationPermissionBanner.locating ? (
                  <Loader2 size={14} className="xp20-route-spin" />
                ) : locationPermissionBanner.errorHint ? (
                  <AlertTriangle size={14} />
                ) : (
                  <LocateFixed size={14} />
                )}
              </span>
              <div className="xp20-loc-perm-copy">
                <strong>
                  {locationPermissionBanner.locating
                    ? 'Localisation en cours…'
                    : locationPermissionBanner.errorTitle || 'Partager ma localisation'}
                </strong>
                <span>
                  {locationPermissionBanner.errorHint ||
                    'Requis pour centrer la carte, calculer un trajet et lancer le guidage.'}
                </span>
              </div>
              <button
                type="button"
                className="xp20-loc-perm-cta"
                disabled={locationPermissionBanner.locating}
                onClick={locationPermissionBanner.onRequestLocation}
              >
                {locationPermissionBanner.locating
                  ? '…'
                  : locationPermissionBanner.errorHint
                    ? 'Réessayer'
                    : 'Autoriser'}
              </button>
              <button
                type="button"
                className="xp20-loc-perm-close"
                onClick={locationPermissionBanner.onDismiss}
                aria-label="Masquer la demande de localisation"
              >
                <X size={13} aria-hidden="true" />
              </button>
            </div>
          </div>
        ) : null}
      </div>

      <ClubIsland toast={islandToast} onDismiss={onDismissIsland} />

      <div className="xp20-top-right">
        <div className="xp20-map-stack" role="toolbar" aria-label="Contrôles de la carte">
          <button
            type="button"
            className="xp20-map-stack-btn"
            onClick={onCompassClick}
            aria-label="Réorienter la carte au Nord"
            title="Nord en haut"
          >
            <Compass
              size={17}
              strokeWidth={2}
              className="xp20-compass-icon"
              style={{ transform: `rotate(${-bearingDeg}deg)` }}
              aria-hidden="true"
            />
          </button>

          <span className="xp20-map-stack-sep" aria-hidden="true" />

          <button
            type="button"
            className="xp20-map-stack-btn xp20-locate-btn"
            data-gps-state={locateState}
            onClick={onLocateClick}
            aria-label={locateState === 'granted' ? 'Centrer sur ma position' : 'Autoriser ma localisation GPS'}
            title={locateState === 'granted' ? 'Ma position' : 'Activer la localisation'}
          >
            {locateState === 'locating' ? (
              <Loader2 size={17} strokeWidth={2.2} className="xp20-route-spin" aria-hidden="true" />
            ) : (
              <LocateFixed size={17} strokeWidth={2} aria-hidden="true" />
            )}
            {locateState === 'prompt' || locateState === 'denied' ? (
              <span className="xp20-locate-dot" data-state={locateState} aria-hidden="true" />
            ) : null}
          </button>

          <span className="xp20-map-stack-sep" aria-hidden="true" />

          <button
            ref={styleBtnRef}
            type="button"
            className="xp20-map-stack-btn xp20-layers-sync-btn"
            data-testid="xp20-layers-sync-btn"
            data-loading-phase={loadingPhase}
            onClick={() => setStyleOpen((open) => !open)}
            aria-label={loadingPhase === 'idle' ? 'Fond de carte' : `Fond de carte · ${loadingLabel}`}
            aria-busy={loadingPhase === 'loading'}
            aria-haspopup="menu"
            aria-expanded={styleOpen}
            aria-controls={styleOpen ? styleMenuId : undefined}
            title={loadingLabel}
          >
            <svg
              className="xp20-sync-ring"
              viewBox="0 0 36 36"
              width="34"
              height="34"
              aria-hidden="true"
            >
              <circle className="xp20-sync-ring-track" cx="18" cy="18" r="15.5" />
              <circle className="xp20-sync-ring-arc" cx="18" cy="18" r="15.5" />
            </svg>
            {loadingPhase === 'ready' ? (
              <Check
                size={16}
                strokeWidth={2.5}
                className="xp20-sync-ready-check"
                aria-hidden="true"
              />
            ) : (
              <MapIcon
                size={17}
                strokeWidth={2}
                className="xp20-sync-layers-icon"
                aria-hidden="true"
              />
            )}
          </button>

          {!compactLive && onOpenSavedPlaces ? (
            <>
              <span className="xp20-map-stack-sep" aria-hidden="true" />
              <button
                type="button"
                className="xp20-map-stack-btn"
                data-testid="xp20-saved-places-btn"
                onClick={onOpenSavedPlaces}
                aria-label={
                  savedPlacesCount > 0
                    ? `Mes lieux enregistrés (${savedPlacesCount})`
                    : 'Mes lieux enregistrés et import GPX'
                }
                title="Mes lieux enregistrés"
                style={{ position: 'relative' }}
              >
                <Bookmark size={16} strokeWidth={2} aria-hidden="true" />
                {savedPlacesCount > 0 ? (
                  <span
                    aria-hidden="true"
                    style={{
                      position: 'absolute',
                      top: 3,
                      right: 3,
                      minWidth: 14,
                      height: 14,
                      padding: '0 3px',
                      borderRadius: 999,
                      background: '#17402C',
                      color: '#FBFAF6',
                      fontSize: 9,
                      fontWeight: 800,
                      lineHeight: '14px',
                      textAlign: 'center',
                      fontVariantNumeric: 'tabular-nums',
                    }}
                  >
                    {savedPlacesCount > 99 ? '99+' : savedPlacesCount}
                  </span>
                ) : null}
              </button>
            </>
          ) : null}
        </div>

        {styleOpen ? (
          <div
            ref={popoverRef}
            id={styleMenuId}
            className="xp20-style-popover"
            role="menu"
            aria-label="Fond de carte"
          >
            {styleOptions.map((option) => {
              const selected = option.id === mapBaseStyle;
              return (
                <button
                  key={option.id}
                  type="button"
                  role="menuitemradio"
                  aria-checked={selected}
                  className="xp20-style-opt"
                  onClick={() => {
                    onSelectBaseStyle(option.id);
                    setStyleOpen(false);
                  }}
                >
                  <span>{option.label}</span>
                  {selected ? <Check size={15} strokeWidth={2.2} aria-hidden="true" /> : null}
                </button>
              );
            })}
          </div>
        ) : null}
      </div>
    </div>
  );
});

export default ExplorerMapChrome;
