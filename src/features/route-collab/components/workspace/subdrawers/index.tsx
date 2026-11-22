import type { ReactNode } from 'react';
import type { RouteWorkspaceApi } from '../WorkspaceContext';
import { GpxDrawer, gpxDrawerHeader } from './GpxDrawer';
import { KitDrawer, kitDrawerHeader } from './KitDrawer';
import { OfflineCarnetDrawer, offlineCarnetDrawerHeader } from './OfflineCarnetDrawer';
import { PointDrawer, pointDrawerHeader } from './PointDrawer';
import { ProposalsDrawer, proposalsDrawerHeader } from './ProposalsDrawer';
import { SectionDrawer, sectionDrawerHeader } from './SectionDrawer';
import { SharingDrawer, sharingDrawerHeader } from './SharingDrawer';
import { StageDrawer, stageDrawerHeader } from './StageDrawer';
import { TerrainDrawer, terrainDrawerHeader } from './TerrainDrawer';
import { VariantsDrawer, variantsDrawerHeader } from './VariantsDrawer';

export { MapSettingsDrawer } from './MapSettingsDrawer';
export { OverlayDetailDrawer } from './OverlayDetailDrawer';

/** Sous-tiroir actif (titre, sous-titre, corps) ou `null` quand seul le tiroir principal est ouvert. */
export function renderSubDrawer(
  ws: RouteWorkspaceApi
): { title: string; subtitle: string; body: ReactNode } | null {
  switch (ws.subDrawer) {
    case null:
      return null;
    case 'point':
      return { ...pointDrawerHeader(ws), body: <PointDrawer /> };
    case 'section':
      return { ...sectionDrawerHeader(ws), body: <SectionDrawer /> };
    case 'stage':
      return { ...stageDrawerHeader(ws), body: <StageDrawer /> };
    case 'gpx':
      return { ...gpxDrawerHeader(ws), body: <GpxDrawer /> };
    case 'variants':
      return { ...variantsDrawerHeader(ws), body: <VariantsDrawer /> };
    case 'kit':
      return { ...kitDrawerHeader(ws), body: <KitDrawer /> };
    case 'terrain':
      return { ...terrainDrawerHeader(ws), body: <TerrainDrawer /> };
    case 'proposals':
      return { ...proposalsDrawerHeader(ws), body: <ProposalsDrawer /> };
    case 'sharing':
      return { ...sharingDrawerHeader(ws), body: <SharingDrawer /> };
    default:
      return { ...offlineCarnetDrawerHeader(ws), body: <OfflineCarnetDrawer /> };
  }
}
