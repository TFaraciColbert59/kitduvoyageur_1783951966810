'use client';

import { useMemo } from 'react';
import { Layers, LocateFixed } from 'lucide-react';
import { deviationFromTrack, type LonLat } from '../../../mapGeometry';
import { describeLive } from '../../../liveTrack';
import {
  describePoiProvenance,
  layerAvailability,
  layersForSport,
  poisForLayer,
  type SportLayerId,
} from '../../../mapLayers';
import { countUnverified, type StartKind } from '../../../mapStart';
import { useRouteViewMode } from '../expertMode';
import { XpEyebrow } from '@/features/explorer-v2/sheet/blocks';
import { MapSettingsBody } from '../subdrawers/MapSettingsDrawer';
import { AddByAddress } from '../AddByAddress';
import { useRouteWorkspace } from '../WorkspaceContext';
import { EntryChips } from './EntryChips';
import { ProfileReadoutLine } from './ProfileReadoutLine';
import type { LiveState } from './useLivePosition';
import type { LiveFix } from '../../../liveTrack';

export type MapLens = 'days' | 'slope' | 'surface';

export interface LegendDay {
  readonly stageId: string;
  readonly day: number;
  readonly color: string;
  readonly distanceKm: number | null;
}

export interface LensLegendItem {
  readonly label: string;
  readonly color: string;
}

const LENS_LABEL: Record<MapLens, string> = { days: 'Jours', slope: 'Pente', surface: 'Surface' };

const AVAILABILITY_TEXT = {
  loading: 'Relevé en cours…',
  ready: '',
  empty: 'Aucun point relevé sur ce tracé.',
  unavailable: 'Calque indisponible : aucune source n’a répondu.',
} as const;

/** Tout ce qui flotte sur la carte, hors tracé : pastilles d'entrée, légende des jours, lentilles, calques, position, curseur. */
export function MapOverlays({
  lens,
  onLens,
  lensLegend,
  legendDays,
  onFocusStage,
  activeLayers,
  onToggleLayer,
  live,
  dragInfo,
  startKind = null,
}: {
  lens: MapLens;
  onLens: (l: MapLens) => void;
  lensLegend: readonly LensLegendItem[];
  legendDays: readonly LegendDay[];
  onFocusStage: (stageId: string) => void;
  activeLayers: ReadonlySet<SportLayerId>;
  onToggleLayer: (id: SportLayerId) => void;
  live: { state: LiveState; fix: (LiveFix & { heading: number | null }) | null; start: () => void; stop: () => void };
  dragInfo: string | null;
  /** D'où vient le cadrage de départ ; `neutral` = rien ne dit où la personne se trouve. */
  startKind?: StartKind | null;
}) {
  const {
    workspace,
    online,
    verifiedPack,
    knowledgePois,
    knowledgeLoading,
    knowledgeLoadedAt,
    knowledgeSources,
    refreshKnowledgeBank,
    focusedPoiId,
    profileReadout,
    profileModel,
    flattenedCoords,
    selectedStageId,
    mapMenuOpen: layersOpen,
    setMapMenuOpen,
    orderedPoints,
    routingIssue,
    routingBusy,
    canEditGeo,
  } = useRouteWorkspace();
  const { expert } = useRouteViewMode();

  const layers = useMemo(() => layersForSport(workspace.sport), [workspace.sport]);
  const focusedPoi = focusedPoiId ? (knowledgePois.find((p) => p.id === focusedPoiId) ?? null) : null;
  const hasTrack = workspace.sections.length > 0;
  const unverified = countUnverified(workspace.sections);
  const needsPlacing = orderedPoints.length === 0 && canEditGeo && startKind === 'neutral';

  const liveStatus = useMemo(() => {
    if (live.state !== 'on' || !live.fix) return null;
    const dev = deviationFromTrack(flattenedCoords as readonly LonLat[], [live.fix.lon, live.fix.lat]);
    return describeLive(dev, live.fix.heading, live.fix.accuracyM);
  }, [live.state, live.fix, flattenedCoords]);

  const openLayers = () => {
    const next = !layersOpen;
    setMapMenuOpen(next);
    // Premier ouverture : on relève les points réels (eau, abris, ateliers) s'ils ne l'ont pas encore été.
    if (next && !knowledgeLoadedAt && !knowledgeLoading && hasTrack) void refreshKnowledgeBank();
  };

  return (
    <>
      <div className="rcw-map-left">
        <EntryChips />
        {legendDays.length > 1 && lens === 'days' ? (
          <ul className="rcw-legend" aria-label="Légende des jours" data-testid="map-legend">
            {legendDays.map((d) => (
              <li key={d.stageId}>
                <button
                  type="button"
                  className="rcw-legend-item"
                  aria-pressed={selectedStageId === d.stageId}
                  onClick={() => onFocusStage(d.stageId)}
                  data-testid={`legend-day-${d.day}`}
                >
                  <span className="rcw-legend-swatch" style={{ background: d.color }} aria-hidden="true" />
                  J{d.day}
                  {d.distanceKm != null ? <span className="rcw-legend-km"> · {d.distanceKm.toLocaleString('fr-FR')} km</span> : null}
                </button>
              </li>
            ))}
          </ul>
        ) : null}
        {lens !== 'days' ? (
          <ul className="rcw-legend" aria-label={`Légende ${LENS_LABEL[lens]}`} data-testid="map-lens-legend">
            {lensLegend.map((i) => (
              <li key={i.label} className="rcw-legend-item rcw-legend-item--static">
                <span className="rcw-legend-swatch" style={{ background: i.color }} aria-hidden="true" />
                {i.label}
              </li>
            ))}
          </ul>
        ) : null}
        {expert && hasTrack ? (
          <div className="rcw-lens" role="group" aria-label="Lentille de la ligne" data-testid="map-lens">
            {(Object.keys(LENS_LABEL) as MapLens[]).map((l) => (
              <button
                key={l}
                type="button"
                className="rcw-lens-btn"
                aria-pressed={lens === l}
                data-testid={`lens-${l}`}
                onClick={() => onLens(l)}
              >
                {LENS_LABEL[l]}
              </button>
            ))}
          </div>
        ) : null}
      </div>

      <div className="rcw-map-right">
        <button
          type="button"
          className="xp-icon-btn"
          aria-label="Carte et affichage"
          aria-expanded={layersOpen}
          data-testid="map-settings-trigger"
          onClick={openLayers}
        >
          <Layers size={18} aria-hidden="true" />
        </button>
        <button
          type="button"
          className="xp-icon-btn"
          aria-label={live.state === 'on' ? 'Arrêter le suivi de ma position' : 'Suivre ma position'}
          aria-pressed={live.state === 'on' || live.state === 'starting'}
          data-testid="map-locate"
          onClick={() => (live.state === 'on' || live.state === 'starting' ? live.stop() : live.start())}
        >
          <LocateFixed size={18} aria-hidden="true" />
        </button>
        {layersOpen ? (
          <div className="rcw-map-popover rcw-map-popover--menu" data-testid="map-settings-popover" role="dialog" aria-label="Carte et affichage">
            <MapSettingsBody />
            <XpEyebrow>Calques du sport</XpEyebrow>
          <div className="rcw-layers" role="group" aria-label="Calques selon le sport" data-testid="map-layers-panel">
            {layers.map((layer) => {
              const count = poisForLayer(knowledgePois, layer).length;
              const avail = layerAvailability({
                loading: knowledgeLoading,
                loadedAt: knowledgeLoadedAt,
                sources: knowledgeSources,
                count,
              });
              return (
                <div key={layer.id} className="rcw-layer-row">
                  <label className="rcw-layer-label">
                    <input
                      type="checkbox"
                      checked={activeLayers.has(layer.id)}
                      onChange={() => onToggleLayer(layer.id)}
                      data-testid={`layer-${layer.id}`}
                    />
                    <span>
                      {layer.label}
                      {avail === 'ready' ? ` · ${count}` : ''}
                    </span>
                  </label>
                  {avail !== 'ready' ? (
                    <p className="rcw-layer-note" data-testid={`layer-${layer.id}-note`}>
                      {hasTrack ? AVAILABILITY_TEXT[avail] : 'Tracez d’abord un itinéraire : les points se relèvent le long du tracé.'}
                    </p>
                  ) : expert ? (
                    <p className="rcw-layer-note">
                      Sources : {knowledgeSources.length > 0 ? knowledgeSources.join(', ') : 'inconnues'} · relevé{' '}
                      {knowledgeLoadedAt ? new Date(knowledgeLoadedAt).toLocaleString('fr-FR') : 'à une date inconnue'}
                    </p>
                  ) : null}
                </div>
              );
            })}
          </div>
          </div>
        ) : null}
      </div>

      {needsPlacing ? (
        <div className="rcw-map-start" data-testid="place-yourself">
          <p className="rcw-map-start-msg" role="status">
            Place-toi : recherche un lieu ou utilise ta position
          </p>
          <AddByAddress />
        </div>
      ) : null}

      <div className="rcw-map-bottom">
        {unverified > 0 ? (
          <div className="rcw-chip rcw-chip--warn rcw-chip--note" role="status" data-testid="unverified-sections">
            <strong>
              {unverified > 1 ? `${unverified} tronçons non calculés` : 'Tronçon non calculé'}
              {routingBusy ? ' · calcul en cours…' : ''}
            </strong>
            {routingIssue && !routingBusy ? (
              <>
                <span>{routingIssue.text.replace(/^Tronçon non calculé : /, '').replace(/^./, (c) => c.toUpperCase())}</span>
                <span data-testid="routing-issue-detail">Réponse du routeur : {routingIssue.detail}</span>
              </>
            ) : (
              <span>Pointillé = ligne droite, non vérifiée sur les chemins.</span>
            )}
          </div>
        ) : null}
        {dragInfo ? (
          <div className="rcw-chip rcw-chip--info" role="status" data-testid="drag-info">
            {dragInfo}
          </div>
        ) : null}
        <ProfileReadoutLine readout={profileReadout} hasElevation={profileModel.hasElevation} className="rcw-readout rcw-readout--map" />
        {focusedPoi ? (
          <div className="rcw-chip rcw-chip--poi" data-testid="poi-provenance">
            <strong>{focusedPoi.name}</strong> · {focusedPoi.distanceToTrackM} m du tracé ·{' '}
            {describePoiProvenance(focusedPoi, knowledgeLoadedAt).text}
          </div>
        ) : null}
        {liveStatus ? (
          <div className={`rcw-chip rcw-chip--live rcw-chip--${liveStatus.tone}`} role="status" data-testid="live-status">
            {liveStatus.text}
          </div>
        ) : live.state === 'starting' ? (
          <div className="rcw-chip" role="status">Recherche de votre position…</div>
        ) : live.state === 'denied' ? (
          <div className="rcw-chip rcw-chip--warn" role="status" data-testid="live-denied">
            Position refusée : autorisez la localisation dans votre navigateur.
          </div>
        ) : live.state === 'unavailable' ? (
          <div className="rcw-chip rcw-chip--warn" role="status" data-testid="live-unavailable">Position indisponible sur cet appareil.</div>
        ) : null}
        {!online ? (
          <div
            className="rcw-chip rcw-chip--offline"
            data-testid="offline-badge"
            role="status"
            title="Hors ligne, le fond de carte se limite aux tuiles déjà vues ; le tracé vient de la copie téléchargée."
          >
            {verifiedPack
              ? `Hors ligne · v${verifiedPack.revision.revisionNo}`
              : 'Hors ligne · aucune copie téléchargée'}
          </div>
        ) : null}
      </div>
    </>
  );
}
