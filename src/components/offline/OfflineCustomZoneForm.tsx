'use client';

/**
 * Lot N02-UI / K4.15 — Sélecteur d’emprise libre et zones multiples.
 *
 * Toute validation et toute estimation passent par
 * `validateAndEstimateCustomZone` / `evaluateMultiZoneSelection` : les limites
 * affichées sont exactement le GeoJSON du contrat, sans arrondi inventé.
 */

import React from 'react';
import {
  DEFAULT_MAX_CUSTOM_ZONE_AREA_KM2,
  DEFAULT_MAX_MULTI_ZONES,
  DEFAULT_MAX_TILES_PER_CUSTOM_ZONE,
  DEFAULT_MIN_CUSTOM_ZONE_AREA_KM2,
  evaluateMultiZoneSelection,
  validateAndEstimateCustomZone,
  type CustomZoneSelectionDraft,
  type MultiZoneSelectionState,
  type OfflineCoverageFeatureCollection,
  type OfflineInstalledPackRecord,
  type ZoneBounds,
} from '@/features/offline';
import { XpIcon } from '@/features/explorer-v2/ui/XpIcon';
import {
  OfflineButton,
  OfflineEmpty,
  OfflineNotice,
  OfflinePanel,
  OfflinePanelHeader,
  OfflineStat,
  formatBytes,
  formatCount,
} from './primitives';
import styles from './offlineUi.module.css';

export interface OfflineCustomZoneFormProps {
  installedPacks?: readonly OfflineInstalledPackRecord[];
  initialZones?: readonly CustomZoneSelectionDraft[];
  initialBounds?: ZoneBounds;
  maxZonesAllowed?: number;
  maxTilesPerZone?: number;
  maxAreaKm2?: number;
  minAreaKm2?: number;
  onZonesChange?: (
    zones: readonly CustomZoneSelectionDraft[],
    multi: MultiZoneSelectionState
  ) => void;
  onShowLimits?: (geoJson: OfflineCoverageFeatureCollection) => void;
  onDownload?: (multi: MultiZoneSelectionState) => void;
}

const DEFAULT_BOUNDS: ZoneBounds = {
  west: 6.75,
  south: 45.87,
  east: 6.81,
  north: 45.91,
};

const VALIDATION_LABEL: Readonly<
  Record<NonNullable<CustomZoneSelectionDraft['validationError']>, string>
> = {
  invalid_coordinates: 'Coordonnées invalides : vérifiez les quatre bornes.',
  inverted_bounds: 'Emprise invalide : l’ouest doit être inférieur à l’est et le sud au nord.',
  area_too_small: 'Emprise trop petite : agrandissez la zone pour qu’elle soit utile.',
  exceeds_max_tiles_limit: 'Trop de tuiles : réduisez l’emprise ou le zoom maximal.',
  exceeds_max_area_km2: 'Emprise trop grande : réduisez la surface ou le zoom maximal.',
};

function numberValue(raw: string): number {
  if (raw.trim() === '') return Number.NaN;
  return Number.parseFloat(raw.replace(',', '.'));
}

export function OfflineCustomZoneForm({
  installedPacks = [],
  initialZones = [],
  initialBounds = DEFAULT_BOUNDS,
  maxZonesAllowed = DEFAULT_MAX_MULTI_ZONES,
  maxTilesPerZone = DEFAULT_MAX_TILES_PER_CUSTOM_ZONE,
  maxAreaKm2 = DEFAULT_MAX_CUSTOM_ZONE_AREA_KM2,
  minAreaKm2 = DEFAULT_MIN_CUSTOM_ZONE_AREA_KM2,
  onZonesChange,
  onShowLimits,
  onDownload,
}: OfflineCustomZoneFormProps) {
  const [bounds, setBounds] = React.useState<ZoneBounds>({ ...initialBounds });
  const [minZoom, setMinZoom] = React.useState(10);
  const [maxZoom, setMaxZoom] = React.useState(14);
  const [zones, setZones] = React.useState<CustomZoneSelectionDraft[]>([...initialZones]);
  const [error, setError] = React.useState<string | null>(null);

  const multi = evaluateMultiZoneSelection(zones, {
    installedPacks,
    maxZonesAllowed,
    maxTilesPerZone,
  });
  const maxReached = zones.length >= maxZonesAllowed;

  const commit = (next: CustomZoneSelectionDraft[]) => {
    setZones(next);
    onZonesChange?.(
      next,
      evaluateMultiZoneSelection(next, { installedPacks, maxZonesAllowed, maxTilesPerZone })
    );
  };

  const updateBound = (key: keyof ZoneBounds, raw: string) => {
    setBounds((current) => ({ ...current, [key]: numberValue(raw) }));
  };

  const addZone = () => {
    if (maxReached) {
      setError(`Vous pouvez sélectionner au plus ${maxZonesAllowed} zones.`);
      return;
    }

    if (
      !Number.isFinite(minZoom) ||
      !Number.isFinite(maxZoom) ||
      minZoom < 0 ||
      maxZoom > 16 ||
      minZoom > maxZoom
    ) {
      setError('Plage de zooms invalide : le zoom minimal doit être inférieur ou égal au maximal.');
      return;
    }

    const nextNumber =
      zones.reduce((highest, zone) => {
        const match = /^Zone libre (\d+)$/.exec(zone.label);
        return match ? Math.max(highest, Number.parseInt(match[1], 10)) : highest;
      }, 0) + 1;

    const draft = validateAndEstimateCustomZone({
      zoneId: `custom-${Date.now()}-${nextNumber}`,
      label: `Zone libre ${nextNumber}`,
      bounds,
      minZoom,
      maxZoom,
      maxTilesLimit: maxTilesPerZone,
      maxAreaKm2,
      minAreaKm2,
      installedPacks,
    });

    if (!draft.valid) {
      setError(VALIDATION_LABEL[draft.validationError ?? 'invalid_coordinates']);
      return;
    }

    setError(null);
    commit([...zones, draft]);
  };

  const removeZone = (zoneId: string) => {
    setError(null);
    commit(zones.filter((zone) => zone.zoneId !== zoneId));
  };

  return (
    <OfflinePanel ariaLabel="Zone hors ligne personnalisée">
      <OfflinePanelHeader
        eyebrow="K4.15 · Emprise libre"
        title="Dessiner une zone hors ligne"
        subtitle={`Jusqu’à ${maxZonesAllowed} zones, ${formatCount(maxTilesPerZone)} tuiles par zone.`}
      />

      <div className={styles.stack}>
        <div className={styles.grid4}>
          <label className={styles.field}>
            <span className={styles.label}>Ouest (°)</span>
            <input
              className={styles.input}
              type="number"
              step="0.001"
              min={-180}
              max={180}
              value={Number.isFinite(bounds.west) ? bounds.west : ''}
              onChange={(event) => updateBound('west', event.target.value)}
              aria-label="Longitude ouest"
            />
          </label>
          <label className={styles.field}>
            <span className={styles.label}>Sud (°)</span>
            <input
              className={styles.input}
              type="number"
              step="0.001"
              min={-90}
              max={90}
              value={Number.isFinite(bounds.south) ? bounds.south : ''}
              onChange={(event) => updateBound('south', event.target.value)}
              aria-label="Latitude sud"
            />
          </label>
          <label className={styles.field}>
            <span className={styles.label}>Est (°)</span>
            <input
              className={styles.input}
              type="number"
              step="0.001"
              min={-180}
              max={180}
              value={Number.isFinite(bounds.east) ? bounds.east : ''}
              onChange={(event) => updateBound('east', event.target.value)}
              aria-label="Longitude est"
            />
          </label>
          <label className={styles.field}>
            <span className={styles.label}>Nord (°)</span>
            <input
              className={styles.input}
              type="number"
              step="0.001"
              min={-90}
              max={90}
              value={Number.isFinite(bounds.north) ? bounds.north : ''}
              onChange={(event) => updateBound('north', event.target.value)}
              aria-label="Latitude nord"
            />
          </label>
        </div>

        <div className={styles.grid2}>
          <label className={styles.field}>
            <span className={styles.label}>Zoom minimal</span>
            <input
              className={styles.input}
              type="number"
              min={0}
              max={16}
              value={minZoom}
              onChange={(event) => setMinZoom(Math.trunc(numberValue(event.target.value)))}
              aria-label="Zoom minimal de la zone"
            />
          </label>
          <label className={styles.field}>
            <span className={styles.label}>Zoom maximal</span>
            <input
              className={styles.input}
              type="number"
              min={0}
              max={16}
              value={maxZoom}
              onChange={(event) => setMaxZoom(Math.trunc(numberValue(event.target.value)))}
              aria-label="Zoom maximal de la zone"
            />
          </label>
        </div>

        <OfflineButton
          fullWidth
          onClick={addZone}
          disabled={maxReached}
          aria-label="Ajouter cette emprise aux zones sélectionnées"
        >
          <XpIcon name="plus" size={16} />
          Ajouter cette zone
        </OfflineButton>

        {error ? (
          <OfflineNotice tone="danger" icon="alert">
            {error}
          </OfflineNotice>
        ) : null}
        {maxReached && !error ? (
          <OfflineNotice tone="warning" icon="info">
            Limite de {maxZonesAllowed} zones atteinte. Retirez une zone pour en ajouter une autre.
          </OfflineNotice>
        ) : null}
      </div>

      <hr className={styles.divider} />

      {zones.length === 0 ? (
        <OfflineEmpty
          title="Aucune zone sélectionnée"
          hint="Saisissez une emprise puis ajoutez-la pour estimer le téléchargement."
          icon="layers"
        />
      ) : (
        <>
          <ul className={styles.list}>
            {zones.map((zone) => (
              <li key={zone.zoneId} className={styles.listItem}>
                <span className={styles.iconBubble}>
                  <XpIcon name="layers" size={18} />
                </span>
                <div className={styles.grow}>
                  <p className={styles.itemTitle}>{zone.label}</p>
                  <p className={styles.itemMeta}>
                    {formatCount(zone.estimatedTiles)} tuiles nettes ·{' '}
                    {formatBytes(zone.estimatedBytes)} · {zone.areaKm2.toFixed(2).replace('.', ',')}{' '}
                    km² · zooms {zone.minZoom}–{zone.maxZoom}
                  </p>
                </div>
                <button
                  type="button"
                  className={styles.button}
                  data-variant="ghost"
                  aria-label={`Retirer ${zone.label}`}
                  onClick={() => removeZone(zone.zoneId)}
                >
                  <XpIcon name="x" size={16} />
                </button>
              </li>
            ))}
          </ul>

          <div className={styles.metrics}>
            <OfflineStat label="Zones" value={`${multi.zones.length} / ${multi.maxZonesAllowed}`} />
            <OfflineStat label="Tuiles nettes" value={formatCount(multi.combinedNetTileCount)} />
            <OfflineStat label="Total estimé" value={formatBytes(multi.combinedEstimatedBytes)} />
          </div>

          <OfflineNotice tone="info" icon="map">
            {multi.visibleLimitsGeoJson.features.length} limite(s) visible(s) sur la carte,
            dédupliquées avec les paquets déjà installés.
          </OfflineNotice>

          <div className={styles.regionActions}>
            {onShowLimits ? (
              <OfflineButton
                variant="secondary"
                aria-label="Afficher les limites des zones sur la carte"
                onClick={() => onShowLimits(multi.visibleLimitsGeoJson)}
              >
                <XpIcon name="map" size={16} />
                Voir les limites
              </OfflineButton>
            ) : null}
            {onDownload ? (
              <OfflineButton
                aria-label="Télécharger les zones sélectionnées"
                onClick={() => onDownload(multi)}
              >
                <XpIcon name="down" size={16} />
                Télécharger ces zones
              </OfflineButton>
            ) : null}
          </div>
        </>
      )}
    </OfflinePanel>
  );
}
