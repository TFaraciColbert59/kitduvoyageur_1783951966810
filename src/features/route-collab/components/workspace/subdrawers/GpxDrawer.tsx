import { XpEyebrow, XpRow, XpRows } from '@/features/explorer-v2/sheet/blocks';
import { computeStageMetrics } from '../metrics';
import type { DrawerHeader } from '../types';
import { Banners } from '../Banners';
import { useRouteWorkspace, type RouteWorkspaceApi } from '../WorkspaceContext';

export function gpxDrawerHeader(ws: RouteWorkspaceApi): DrawerHeader {
  return {
    title: 'Importer / Exporter GPX',
    subtitle: `Provenance : ${ws.workspace.sourceOrigin.kind}`,
  };
}

export function GpxDrawer() {
  const {
    workspace,
    gpxInput,
    setGpxInput,
    keepOriginalGpx,
    setKeepOriginalGpx,
    canEditGeo,
    orderedPoints,
    handleImportGpx,
    handleDownloadGpx,
  } = useRouteWorkspace();
  return (
    <div className="rcw-stack" data-testid="subdrawer-gpx">
      <Banners />
      <XpEyebrow>Exporter</XpEyebrow>
      <div className="rcw-inline-actions">
        <button type="button" className="xp-primary" onClick={() => handleDownloadGpx()}>
          Exporter GPX complet
        </button>
      </div>
      {workspace.stages.length > 0 ? (
        <XpRows>
          {workspace.stages.map((st) => {
            const stM = computeStageMetrics(st, orderedPoints, workspace.sections);
            return (
              <XpRow
                key={st.id}
                icon="down"
                tone="water"
                title={`Exporter Jour ${st.dayNumber} · ${st.title}`}
                sub={`${stM.distanceKm} km`}
                onClick={() => handleDownloadGpx(st.id)}
              />
            );
          })}
        </XpRows>
      ) : null}

      <XpEyebrow>Importer un GPX</XpEyebrow>
      <label className="rcw-check-row">
        <input
          type="checkbox"
          checked={keepOriginalGpx}
          onChange={(e) => setKeepOriginalGpx(e.target.checked)}
        />
        <span>Garder ma trace (géométrie importée + XML original conservés)</span>
      </label>
      <textarea
        className="rcw-textarea"
        rows={4}
        value={gpxInput}
        onChange={(e) => setGpxInput(e.target.value)}
        placeholder="Collez un fichier GPX 1.1 (<gpx>…</gpx>)"
        aria-label="Contenu GPX à importer"
      />
      <button
        type="button"
        className="xp-primary"
        disabled={!canEditGeo || !gpxInput.trim()}
        onClick={handleImportGpx}
      >
        Importer ce GPX sur la carte
      </button>
    </div>
  );
}
