import { XpEmpty, XpRow, XpRows } from '@/features/explorer-v2/sheet/blocks';
import type { DrawerHeader } from '../types';
import { Banners } from '../Banners';
import { useRouteWorkspace, type RouteWorkspaceApi } from '../WorkspaceContext';

export function variantsDrawerHeader(ws: RouteWorkspaceApi): DrawerHeader {
  return {
    title: 'Variantes & Comparateur',
    subtitle: `${ws.workspace.variants.length} variante(s) enregistrée(s)`,
  };
}

export function VariantsDrawer() {
  const {
    workspace,
    comparedVariantId,
    setComparedVariantId,
    canEditGeo,
    runOperation,
    handleCreateDetourVariant,
  } = useRouteWorkspace();
  return (
    <div className="rcw-stack" data-testid="subdrawer-variants">
      <Banners />
      {canEditGeo ? (
        <button
          type="button"
          className="xp-primary"
          onClick={() => void handleCreateDetourVariant()}
        >
          + Comparer un détour (+2,1 km)
        </button>
      ) : null}
      {workspace.variants.length === 0 ? (
        <XpEmpty
          title="Aucune variante"
          hint="Créez un détour pour comparer distance, dénivelé, durée et surface connue sur la carte."
        />
      ) : (
        <XpRows>
          {workspace.variants.map((v) => {
            const active = comparedVariantId === v.id;
            const knownPct = Math.round((v.replacements[0]?.surfaceKnownRatio ?? 0) * 100);
            return (
              <div key={v.id} className="rcw-stack">
                <XpRow
                  icon="route"
                  tone={active ? 'warn' : 'ink'}
                  title={v.title}
                  sub={`Δ ${v.deltaDistanceKm > 0 ? '+' : ''}${v.deltaDistanceKm} km · Δ D+ ${v.deltaAscentM ?? '?'} m · Δ ${v.deltaDurationMin ?? '?'} min · Surface connue ${knownPct}%`}
                  badge={{
                    label: active ? 'Sur carte' : v.status,
                    tone: active ? 'warn' : 'muted',
                  }}
                  onClick={() => setComparedVariantId(active ? null : v.id)}
                />
                <div className="rcw-inline-actions">
                  <button
                    type="button"
                    className="xp-secondary"
                    onClick={() => setComparedVariantId(active ? null : v.id)}
                  >
                    {active ? 'Masquer sur carte' : 'Superposer sur carte'}
                  </button>
                  {canEditGeo ? (
                    <button
                      type="button"
                      className="xp-primary"
                      onClick={() => void runOperation({ type: 'apply_variant', variantId: v.id })}
                    >
                      Appliquer
                    </button>
                  ) : null}
                </div>
              </div>
            );
          })}
        </XpRows>
      )}
    </div>
  );
}
