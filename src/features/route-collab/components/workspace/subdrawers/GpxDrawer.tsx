import { FileTools } from '../track/FileTools';
import type { DrawerHeader } from '../types';
import { Banners } from '../Banners';
import type { RouteWorkspaceApi } from '../WorkspaceContext';

export function gpxDrawerHeader(ws: RouteWorkspaceApi): DrawerHeader {
  return {
    title: 'Importer / Exporter',
    subtitle: `Provenance : ${ws.workspace.sourceOrigin.kind}`,
  };
}

/** Import GPX, KML, TCX, GeoJSON (FIT refusé, message) ; export complet ou par étape, validé GPX 1.1 (5.9). */
export function GpxDrawer() {
  return (
    <div className="rcw-stack" data-testid="subdrawer-gpx">
      <Banners />
      <FileTools />
    </div>
  );
}
