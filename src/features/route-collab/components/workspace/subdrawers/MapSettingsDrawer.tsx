import { Layers } from 'lucide-react';
import { ATLAS_TILES } from '@/components/map/engine/createMapStyle';
import type { MapBase } from '@/features/compas/engine/mapStyle';
import { XpChips, XpEyebrow } from '@/features/explorer-v2/sheet/blocks';
import { useRouteWorkspace } from '../WorkspaceContext';

/** Popover « Carte et affichage » (fond de carte, recentrage, mode liste) en haut à droite de la carte. */
export function MapSettingsDrawer() {
  const {
    mapBase,
    setMapBase,
    mapMenuOpen,
    setMapMenuOpen,
    setFitTrigger,
    listMode,
    setListMode,
    setStatusMessage,
  } = useRouteWorkspace();
  return (
    <div className="rcw-map-topright">
      <button
        type="button"
        className="xp-icon-btn"
        data-testid="map-settings-trigger"
        aria-label="Carte et affichage"
        aria-expanded={mapMenuOpen}
        onClick={() => setMapMenuOpen((v) => !v)}
      >
        <Layers size={18} aria-hidden="true" />
      </button>
      {mapMenuOpen ? (
        <div
          className="rcw-map-popover"
          data-testid="map-settings-popover"
          role="dialog"
          aria-label="Carte et affichage"
        >
          <XpEyebrow>Fond de carte</XpEyebrow>
          <XpChips
            ariaLabel="Fond de carte"
            value={mapBase}
            items={[
              { id: 'osm', label: 'Plan OSM' },
              { id: 'topo', label: 'Relief' },
              { id: 'satellite', label: 'Satellite' },
            ]}
            onChange={(id) => setMapBase(id as MapBase)}
          />
          <p className="rcw-sub-note">{ATLAS_TILES[mapBase].short}</p>
          <button
            type="button"
            className="xp-secondary"
            style={{ marginBottom: 0 }}
            onClick={() => {
              setFitTrigger((n) => n + 1);
              setMapMenuOpen(false);
              setStatusMessage('Carte recentrée sur l’itinéraire.');
            }}
          >
            Recentrer sur l’itinéraire
          </button>
          <button
            type="button"
            className="xp-secondary"
            style={{ marginBottom: 0 }}
            onClick={() => {
              setListMode((v) => !v);
              setMapMenuOpen(false);
            }}
          >
            {listMode ? 'Revenir à la vue carte' : 'Mode liste sans carte'}
          </button>
        </div>
      ) : null}
    </div>
  );
}
