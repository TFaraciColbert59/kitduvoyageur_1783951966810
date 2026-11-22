import { XpEyebrow, XpMetrics, XpRow, XpRows } from '@/features/explorer-v2/sheet/blocks';
import type { DrawerHeader } from '../types';
import { Banners } from '../Banners';
import { useRouteWorkspace, type RouteWorkspaceApi } from '../WorkspaceContext';

export function offlineCarnetDrawerHeader(ws: RouteWorkspaceApi): DrawerHeader {
  const { verifiedPack, online } = ws;
  return {
    title: 'Hors ligne, Activité & Carnet',
    subtitle: verifiedPack
      ? `Pack v${verifiedPack.manifest.revisionNo} vérifié · ${online ? 'En ligne' : 'Mode avion'}`
      : online
        ? 'Aucun pack local · En ligne'
        : 'Mode avion',
  };
}

export function OfflineCarnetDrawer() {
  const {
    workspace,
    online,
    setOnline,
    carnetRecord,
    canPublish,
    verifiedPack,
    offlineQueue,
    activeActivity,
    handleReplayOffline,
    handlePublish,
    handleDownloadPack,
    handleStartActivity,
    handleFinishToCarnet,
    handleDuplicateFromCarnet,
  } = useRouteWorkspace();
  return (
    <div className="rcw-stack" data-testid="subdrawer-offline-carnet">
      <Banners />

      <XpEyebrow>Publication & Pack de départ</XpEyebrow>
      <XpMetrics
        items={[
          {
            label: 'Publiée',
            value: workspace.publishedRevisionNo ? `v${workspace.publishedRevisionNo}` : 'Aucune',
          },
          {
            label: 'Sur appareil',
            value: verifiedPack ? `v${verifiedPack.manifest.revisionNo}` : 'Aucun',
          },
          { label: 'File locale', value: `${offlineQueue.length} op` },
        ]}
      />
      {verifiedPack ? (
        <div className="rcw-code-box" data-testid="pack-manifest-info">
          Manifeste v{verifiedPack.manifest.revisionNo} ·{' '}
          {(verifiedPack.manifest.estimatedBytes / 1024).toFixed(1)} Ko · Checksum{' '}
          {verifiedPack.manifest.checksum.slice(0, 10)} · Vérifié le{' '}
          {verifiedPack.verifiedAt.slice(0, 19).replace('T', ' ')}
          <br />
          Inclus : {verifiedPack.manifest.includedItems.join(', ')}
          {verifiedPack.manifest.unavailableItems.length > 0
            ? ` · Indisponibles : ${verifiedPack.manifest.unavailableItems.join(', ')}`
            : ''}
        </div>
      ) : null}

      <div className="rcw-inline-actions">
        {canPublish ? (
          <button type="button" className="xp-primary" onClick={() => void handlePublish()}>
            Publier v{(workspace.publishedRevisionNo ?? 0) + 1}
          </button>
        ) : null}
        <button type="button" className="xp-primary" onClick={() => void handleDownloadPack(false)}>
          Télécharger le pack
        </button>
      </div>
      <div className="rcw-inline-actions">
        <button
          type="button"
          className="xp-secondary"
          onClick={() => void handleDownloadPack(true)}
        >
          Simuler coupure pack
        </button>
        <button type="button" className="xp-secondary" onClick={() => setOnline((v) => !v)}>
          {online ? 'Simuler mode avion' : 'Revenir en ligne'}
        </button>
      </div>

      {offlineQueue.length > 0 ? (
        <>
          <XpEyebrow>Opérations locales en attente ({offlineQueue.length})</XpEyebrow>
          <XpRows>
            {offlineQueue.map((q) => (
              <XpRow
                key={q.opId}
                icon="clock"
                tone="warn"
                title={q.operation.type}
                sub={`Base seq ${q.baseSeq} · ${q.queuedAt.slice(11, 19)}`}
                badge={{ label: 'En attente', tone: 'warn' }}
              />
            ))}
          </XpRows>
          <button
            type="button"
            className="xp-primary"
            disabled={!online}
            onClick={() => void handleReplayOffline()}
          >
            Synchroniser ({offlineQueue.length})
          </button>
        </>
      ) : null}

      <XpEyebrow>Activité & Carnet de retour</XpEyebrow>
      {activeActivity ? (
        <div className="rcw-stack" data-testid="active-activity-card">
          <XpRow
            icon="play"
            tone="good"
            title={`Activité en cours · Plan v${activeActivity.revisionNo}`}
            sub={`Snapshot du kit : ${activeActivity.kitSnapshot.length} article(s) figés`}
            badge={{ label: 'Active', tone: 'good' }}
          />
          {workspace.publishedRevisionNo &&
          workspace.publishedRevisionNo > activeActivity.revisionNo ? (
            <p className="rcw-sub-note">
              Une version v{workspace.publishedRevisionNo} existe : changer de route en séance
              demande une action explicite.
            </p>
          ) : null}
          <button type="button" className="xp-primary" onClick={handleFinishToCarnet}>
            Terminer et ouvrir le carnet
          </button>
        </div>
      ) : (
        <button type="button" className="xp-primary" onClick={handleStartActivity}>
          Démarrer l’activité
        </button>
      )}

      {carnetRecord ? (
        <div className="rcw-stack" data-testid="carnet-return-card">
          <XpEyebrow>Bilan Carnet (immuable)</XpEyebrow>
          <XpMetrics
            items={[
              { label: 'Plan suivi', value: `v${carnetRecord.plannedRevisionNo}` },
              { label: 'Distance', value: `${carnetRecord.recordedDistanceKm} km` },
              { label: 'Kit emporté', value: `${carnetRecord.kitSnapshot.length} art.` },
            ]}
          />
          <button type="button" className="xp-primary" onClick={handleDuplicateFromCarnet}>
            Reprendre cette sortie
          </button>
        </div>
      ) : null}
    </div>
  );
}
