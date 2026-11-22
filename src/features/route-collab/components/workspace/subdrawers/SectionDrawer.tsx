import { XpEmpty, XpEyebrow, XpMetrics, XpRow, XpRows } from '@/features/explorer-v2/sheet/blocks';
import { SECTION_MODE_LABELS } from '../labels';
import type { DrawerHeader } from '../types';
import { Banners } from '../Banners';
import { useRouteWorkspace, type RouteWorkspaceApi } from '../WorkspaceContext';

export function sectionDrawerHeader(ws: RouteWorkspaceApi): DrawerHeader {
  const sec = ws.selectedSection;
  if (!sec) return { title: 'Détail du tronçon', subtitle: 'Aucun tronçon sélectionné' };
  return {
    title: `Tronçon · ${SECTION_MODE_LABELS[sec.mode] ?? sec.mode}`,
    subtitle: `${sec.distanceKm} km · ${sec.provenance.provider} · v${sec.entityVersion}`,
  };
}

export function SectionDrawer() {
  const { routingBusy, canEditGeo, selectedSection, runOperation, handleRealRouteSection } =
    useRouteWorkspace();
  const sec = selectedSection;
  if (!sec) {
    return (
      <XpEmpty title="Aucun tronçon" hint="Ajoutez au moins deux points pour former un tronçon." />
    );
  }
  return (
    <div className="rcw-stack" data-testid="subdrawer-section">
      <Banners />
      <XpMetrics
        items={[
          { label: 'Distance', value: `${sec.distanceKm} km` },
          { label: 'D+', value: sec.ascentM != null ? `${sec.ascentM} m` : 'Inconnu' },
          { label: 'D−', value: sec.descentM != null ? `${sec.descentM} m` : 'Inconnu' },
          { label: 'Durée', value: sec.durationMin != null ? `${sec.durationMin} min` : '—' },
        ]}
      />
      <XpEyebrow>Routage & Mode</XpEyebrow>
      <XpRows>
        <XpRow
          icon="route"
          tone="good"
          title="Mode du tronçon"
          sub={`Provenance : ${sec.provenance.provider} (${sec.provenance.confidence})`}
          badge={{
            label: SECTION_MODE_LABELS[sec.mode] ?? sec.mode,
            tone: sec.mode === 'manual' ? 'warn' : 'good',
          }}
        />
      </XpRows>
      {canEditGeo ? (
        <div className="rcw-inline-actions">
          <button
            type="button"
            className="xp-primary"
            disabled={routingBusy}
            onClick={() => void handleRealRouteSection(sec.id)}
          >
            {routingBusy ? 'Calcul Valhalla + DEM…' : 'Recalculer via routeur'}
          </button>
          <button
            type="button"
            className="xp-secondary"
            onClick={() =>
              void runOperation(
                {
                  type: 'set_section_mode',
                  sectionId: sec.id,
                  mode: sec.mode === 'manual' ? 'routed' : 'manual',
                },
                { [sec.id]: sec.entityVersion }
              )
            }
          >
            {sec.mode === 'manual' ? 'Repasser en routé' : 'Passer en manuel'}
          </button>
        </div>
      ) : null}

      {sec.warnings.length > 0 ? (
        <>
          <XpEyebrow>Alertes sur ce tronçon</XpEyebrow>
          <XpRows>
            {sec.warnings.map((w, i) => (
              <XpRow key={i} icon="alert" tone="warn" title={w} />
            ))}
          </XpRows>
        </>
      ) : null}
    </div>
  );
}
