import { VariantsPanel } from '../track/VariantsPanel';
import type { DrawerHeader } from '../types';
import { Banners } from '../Banners';
import type { RouteWorkspaceApi } from '../WorkspaceContext';

export function variantsDrawerHeader(ws: RouteWorkspaceApi): DrawerHeader {
  return {
    title: 'Variantes & Comparateur',
    subtitle: `${ws.workspace.variants.length} variante(s) enregistrée(s)`,
  };
}

/** Variantes réelles côte à côte (km, D+, durée, surface) puis « Appliquer » (5.8). */
export function VariantsDrawer() {
  return (
    <div className="rcw-stack" data-testid="subdrawer-variants">
      <Banners />
      <VariantsPanel />
    </div>
  );
}
