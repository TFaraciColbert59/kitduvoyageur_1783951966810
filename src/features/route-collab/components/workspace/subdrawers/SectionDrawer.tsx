import { XpEmpty, XpEyebrow, XpMetrics, XpRow, XpRows } from '@/features/explorer-v2/sheet/blocks';
import { SECTION_MODE_LABELS } from '../labels';
import { SectionActions } from '../track/SectionTools';
import type { DrawerHeader } from '../types';
import { Banners } from '../Banners';
import { useRouteWorkspace, type RouteWorkspaceApi } from '../WorkspaceContext';

export function sectionDrawerHeader(ws: RouteWorkspaceApi): DrawerHeader {
  const sec = ws.selectedSection;
  if (!sec) return { title: 'Détail du tronçon', subtitle: 'Aucun tronçon sélectionné' };
  return {
    title: `Tronçon · ${SECTION_MODE_LABELS[sec.mode] ?? sec.mode}`,
    subtitle: `${sec.distanceKm} km · ${sec.provenance.provider ?? 'non calculé'} · v${sec.entityVersion}`,
  };
}

export function SectionDrawer() {
  const { selectedSection } = useRouteWorkspace();
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
          { label: 'Durée', value: sec.durationMin != null ? `${sec.durationMin} min` : 'Durée inconnue' },
        ]}
      />
      <SectionActions key={`${sec.id}-${sec.entityVersion}`} section={sec} />

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
