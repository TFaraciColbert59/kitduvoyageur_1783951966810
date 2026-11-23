import { DepartureTilesGrid, ReadinessRadialRing } from '../../RouteAnalysisVisuals';
import { Banners } from '../Banners';
import { useRouteWorkspace } from '../WorkspaceContext';

export function DepartTab() {
  const {
    workspace,
    liveWeather,
    departChecks,
    setDepartChecks,
    canPublish,
    orderedPoints,
    totals,
    verifiedPack,
    kitToRevalidateCount,
    totalWarnings,
    openSubDrawer,
    handleDownloadGpx,
    handlePublish,
    handleDownloadPack,
  } = useRouteWorkspace();
  const hasTrack = orderedPoints.length >= 2;
  const hasPack = Boolean(verifiedPack);
  const kitReady = kitToRevalidateCount === 0;
  const weatherReady = Boolean(liveWeather) || departChecks.weather;
  const checks = [
    hasTrack && departChecks.track,
    hasPack,
    kitReady,
    weatherReady,
    departChecks.safety,
  ];
  const scorePct = Math.round((checks.filter(Boolean).length / checks.length) * 100);
  return (
    <div className="rcw-stack" data-testid="tab-panel-depart">
      <Banners />

      <ReadinessRadialRing
        scorePct={scorePct}
        label={
          scorePct >= 80
            ? 'Prêt pour le départ'
            : scorePct >= 50
              ? 'Préparation avancée'
              : 'Préparation à finaliser'
        }
        sublabel={`${workspace.sections.length > 0 ? `${totals.distanceKm} km` : 'distance inconnue'} · ${workspace.stages.length} étape(s) · ${
          workspace.publishedRevisionNo
            ? `Version v${workspace.publishedRevisionNo}`
            : `Brouillon seq ${workspace.headSeq}`
        }`}
      />

      <DepartureTilesGrid
        items={[
          {
            id: 'track',
            label: 'Tracé',
            value: `${orderedPoints.length} pts · ${totalWarnings} alerte(s)`,
            ok: hasTrack && departChecks.track,
            icon: 'track',
            onClick: () => setDepartChecks((c) => ({ ...c, track: !c.track })),
          },
          {
            id: 'pack',
            label: 'Pack local',
            value: verifiedPack ? `Pack v${verifiedPack.manifest.revisionNo}` : 'À télécharger',
            ok: hasPack,
            icon: 'pack',
            onClick: () => openSubDrawer('offline-carnet'),
          },
          {
            id: 'kit',
            label: 'Sac & Matériel',
            value: kitReady
              ? `${workspace.kitItems.length} article(s) OK`
              : `${kitToRevalidateCount} à revoir`,
            ok: kitReady,
            icon: 'kit',
            onClick: () => openSubDrawer('kit'),
          },
          {
            id: 'weather',
            label: 'Météo & Secours',
            value: liveWeather
              ? `${liveWeather.temperatureC ?? '—'}°C · ${liveWeather.windKph ?? '—'} km/h`
              : departChecks.weather
                ? 'Vérifié'
                : 'À vérifier',
            ok: weatherReady && departChecks.safety,
            icon: 'weather',
            onClick: () => setDepartChecks((c) => ({ ...c, weather: true, safety: !c.safety })),
          },
        ]}
      />

      <div className="rcw-inline-actions">
        {canPublish ? (
          <button type="button" className="xp-primary" onClick={() => void handlePublish()}>
            Publier v{(workspace.publishedRevisionNo ?? 0) + 1}
          </button>
        ) : null}
        <button
          type="button"
          className="xp-secondary"
          onClick={() => void handleDownloadPack(false)}
        >
          Pack hors ligne
        </button>
        <button type="button" className="xp-secondary" onClick={() => handleDownloadGpx()}>
          Export GPX
        </button>
        <button
          type="button"
          className="xp-secondary"
          onClick={() => openSubDrawer('offline-carnet')}
        >
          Activité & Carnet
        </button>
      </div>
    </div>
  );
}
