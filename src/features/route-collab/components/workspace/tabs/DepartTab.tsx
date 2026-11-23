import { useMemo } from 'react';
import { publishPreview } from '../../../depart/publishSummary';
import { ReadinessRadialRing } from '../../RouteAnalysisVisuals';
import { Banners } from '../Banners';
import { ClubRouteBlock } from '../depart/ClubRouteBlock';
import { TilePackBlock, useTilePack } from '../depart/TilePackBlock';
import { ActivityBlock, ChecklistBlock, PackBlock, ParticipantsBlock, PublishPanel, ReadinessBlock } from '../depart/DepartBlocks';
import { useDepart } from '../depart/useDepart';
import { useRouteWorkspace } from '../WorkspaceContext';

/**
 * Départ : « chacun a la bonne version, le bon sac et une copie qui marche sans réseau ». Les faits sont lus
 * (tracé, version, copie hors ligne, sac, liste du HUB, contact de sécurité, participants) ; rien n'est coché à
 * la main. La liste de départ est celle de « Préparer » du HUB (9.7).
 */
export function DepartTab() {
  const {
    workspace,
    canPublish,
    verifiedPack,
    activeActivity,
    openSubDrawer,
    handleDownloadGpx,
    handlePublish,
    handleDownloadPack,
    handleStartActivity,
    totals,
  } = useRouteWorkspace();
  const { linked, data, toggle, contacts, participants, reading } = useDepart({ load: true });
  const preview = useMemo(() => publishPreview(workspace), [workspace]);
  const tiles = useTilePack();
  const latestPack = workspace.packs[workspace.packs.length - 1] ?? null;
  return (
    <div className="rcw-stack" data-testid="tab-panel-depart">
      <Banners />

      {reading.scorePct != null ? (
        <ReadinessRadialRing
          scorePct={reading.scorePct}
          label={reading.label}
          sublabel={`${workspace.sections.length > 0 ? `${totals.distanceKm} km` : 'distance inconnue'} · ${workspace.stages.length} étape(s) · ${
            workspace.publishedRevisionNo ? `Version v${workspace.publishedRevisionNo}` : `Brouillon seq ${workspace.headSeq}`
          }`}
        />
      ) : null}
      <ReadinessBlock reading={reading} onOpen={(id) => openSubDrawer(id === 'kit' ? 'kit' : 'offline-carnet')} />

      {canPublish ? <PublishPanel preview={preview} onPublish={(summary) => void handlePublish(summary)} /> : null}

      <PackBlock
        workspace={workspace}
        latest={latestPack}
        deviceRevisionNo={verifiedPack?.manifest.revisionNo ?? null}
        onDownload={() => {
          void handleDownloadPack(false);
          // 2.10 : la copie hors ligne comprend le fond de carte du corridor (taille annoncée plus bas).
          if (tiles.plan.fits) void tiles.start();
        }}
      />
      <TilePackBlock state={tiles} />

      <ClubRouteBlock workspaceId={workspace.id} canPublish={canPublish} hasPublished={workspace.publishedRevisionNo != null} />

      <ChecklistBlock linked={linked} data={data} onToggle={(id, done) => void toggle(id, done)} />

      {participants ? <ParticipantsBlock rows={participants} /> : null}

      <ActivityBlock
        tripId={workspace.tripId}
        linked={linked}
        revisionNo={workspace.publishedRevisionNo ?? verifiedPack?.manifest.revisionNo ?? null}
        contacts={contacts}
        active={activeActivity ? { revisionNo: activeActivity.revisionNo, kitCount: activeActivity.kitSnapshot.length } : null}
        onStart={handleStartActivity}
      />

      <div className="rcw-inline-actions">
        <button type="button" className="xp-secondary" onClick={() => handleDownloadGpx()}>
          Export GPX
        </button>
        <button type="button" className="xp-secondary" onClick={() => openSubDrawer('offline-carnet')}>
          Activité & Carnet
        </button>
      </div>
    </div>
  );
}
