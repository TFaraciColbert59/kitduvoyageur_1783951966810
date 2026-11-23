import { RefreshCw } from 'lucide-react';
import { XpChips, XpEmpty, XpRow, XpRows } from '@/features/explorer-v2/sheet/blocks';
import { XpIcon } from '@/features/explorer-v2/ui/XpIcon';
import { useCallback } from 'react';
import type { RoutePoiCategory } from '../../../routeAnalysis';
import { ElevationAreaChart, WeatherForecastChart } from '../../RouteAnalysisVisuals';
import { formatProvenanceDate } from '../../../analyse/provenance';
import { profileIndexAtDistance } from '../../../profileLink';
import { stagePlacePoints } from '../../../placesClient';
import {
  AlertsBlock,
  DaylightBlock,
  DifficultyBlock,
  EffortBlock,
  ProfileBlock,
  SurfacesBlock,
  SynthesisBlock,
  WaterBlock,
  WeatherBlock,
} from '../analyse/AnalyseBlocks';
import { Sourced } from '../analyse/Sourced';
import { useAnalyse } from '../analyse/useAnalyse';
import { Banners } from '../Banners';
import { useRouteViewMode } from '../expertMode';
import { ProfileReadoutLine } from '../map/ProfileReadoutLine';
import { loadPlaces } from '../stages/useStagePlaces';
import { useRouteWorkspace } from '../WorkspaceContext';

export function AnalyserTab() {
  const {
    workspace,
    setFocusCoord,
    knowledgeLoading,
    knowledgePois,
    liveWeather,
    placeLabel,
    knowledgeSources,
    knowledgeLoadedAt,
    focusedPoiId,
    setFocusedPoiId,
    poiFilter,
    setPoiFilter,
    analyserSection,
    setOverlayDetail,
    setHoveredCoord,
    elevation,
    profileModel,
    profileReadout,
    setProfileCursor,
    terrainStats,
    elevationStats,
    poiCounts,
    filteredKnowledgePois,
    openSubDrawer,
    refreshKnowledgeBank,
  } = useRouteWorkspace();
  const { expert } = useRouteViewMode();
  const { analysis, remote, reload } = useAnalyse({ load: true });

  // Profil → carte (2.6, 7.3) : le kilomètre est lu dans le modèle de profil, jamais deviné par ratio.
  const hoverKm = useCallback(
    (km: number | null) => {
      if (km == null) {
        setHoveredCoord(null);
        setProfileCursor(null);
        return;
      }
      const idx = profileIndexAtDistance(profileModel, km * 1000);
      setProfileCursor(idx);
      const hit = idx == null ? null : profileModel.points[idx];
      setHoveredCoord(hit ? [hit.lon, hit.lat] : null);
    },
    [profileModel, setHoveredCoord, setProfileCursor]
  );
  const focusKm = useCallback(
    (km: number) => {
      const idx = profileIndexAtDistance(profileModel, km * 1000);
      setProfileCursor(idx);
      const hit = idx == null ? null : profileModel.points[idx];
      if (hit) setFocusCoord([hit.lon, hit.lat]);
    },
    [profileModel, setFocusCoord, setProfileCursor]
  );
  const dayLabel = useCallback(
    (day: number) => {
      const st = workspace.stages.find((x) => x.dayNumber === day);
      return st?.dateIso
        ? `Jour ${day} · ${formatProvenanceDate(`${st.dateIso.slice(0, 10)}T00:00:00Z`)}`
        : `Jour ${day}`;
    },
    [workspace.stages]
  );
  const waterLoaded = analysis.water.some((w) => w.provenance.at != null);
  const loadWater = useCallback(async () => {
    for (const st of workspace.stages) await loadPlaces(stagePlacePoints(workspace, st));
  }, [workspace]);
  const poiProvenance = {
    source: knowledgeSources.length > 0 ? knowledgeSources.join(' · ') : 'Base LKDV, OpenStreetMap',
    at: knowledgeLoadedAt,
  };
  return (
    <div
      className="rcw-stack"
      data-testid="tab-panel-analyser"
      data-view={expert ? 'expert' : 'simple'}
    >
      <Banners />

      {analyserSection === 'terrain' ? (
        <>
          {!expert ? <SynthesisBlock analysis={analysis} expert={expert} /> : null}

          <EffortBlock analysis={analysis} expert={expert} onFocusKm={focusKm} />
          <DifficultyBlock analysis={analysis} expert={expert} />

          <Sourced id="elevation-profile" provenance={analysis.profileProvenance} expert={expert}>
            <ElevationAreaChart
              samples={elevation.samples}
              minEleM={elevationStats.minEleM}
              avgEleM={terrainStats.avgAltitudeM}
              maxEleM={elevationStats.maxEleM}
              cursorKm={profileReadout ? profileReadout.km : null}
              onHoverKm={hoverKm}
            />
            <ProfileReadoutLine readout={profileReadout} hasElevation={profileModel.hasElevation} />
          </Sourced>
          <ProfileBlock
            analysis={analysis}
            expert={expert}
            onHoverKm={hoverKm}
            onFocusKm={focusKm}
          />
          <SurfacesBlock analysis={analysis} expert={expert} />

          <XpRows>
            <XpRow
              icon="spark"
              tone="warn"
              title="Variantes & Comparateur"
              sub="Comparer un détour sur la carte"
              badge={{ label: `${workspace.variants.length}`, tone: 'muted' }}
              trailing={<XpIcon name="chevr" size={15} />}
              onClick={() => openSubDrawer('variants')}
            />
          </XpRows>
        </>
      ) : null}

      {analyserSection === 'milieu' ? (
        <>
          <WeatherBlock
            analysis={analysis}
            remote={remote}
            expert={expert}
            dayLabel={dayLabel}
            onReload={reload}
          />
          <DaylightBlock analysis={analysis} expert={expert} dayLabel={dayLabel} />
          <WaterBlock
            analysis={analysis}
            expert={expert}
            dayLabel={dayLabel}
            anyLoaded={waterLoaded}
            onLoad={() => void loadWater()}
          />
          <AlertsBlock analysis={analysis} expert={expert} fireStatus={remote.status} />

          {expert && liveWeather ? (
            <Sourced
              id="center-forecast"
              provenance={{ source: liveWeather.source, at: liveWeather.fetchedAt }}
              expert={expert}
            >
              <WeatherForecastChart weather={liveWeather} loading={knowledgeLoading} />
            </Sourced>
          ) : null}

          {placeLabel ? <div className="rcw-sub-note">Secteur : {placeLabel}</div> : null}

          <XpRows>
            <XpRow
              icon="alert"
              tone="warn"
              title="Observations terrain, eau & dangers"
              sub="Potabilité, arrêtés, dates de vérification"
              trailing={<XpIcon name="chevr" size={15} />}
              onClick={() => openSubDrawer('terrain')}
            />
          </XpRows>
        </>
      ) : null}

      {analyserSection === 'chemin' ? (
        <>
          <div className="rcw-bar-head">
            <XpChips
              ariaLabel="Filtrer les repères"
              value={poiFilter}
              items={[
                { id: 'all', label: `Tout (${knowledgePois.length})` },
                { id: 'water', label: `Eau (${poiCounts.water})` },
                { id: 'shelter', label: `Refuges (${poiCounts.shelter})` },
                { id: 'summit', label: `Sommets (${poiCounts.summit})` },
                { id: 'food_lodging', label: `Ravit. (${poiCounts.food_lodging})` },
                { id: 'access', label: `Accès (${poiCounts.access})` },
              ]}
              onChange={(id) => setPoiFilter(id as 'all' | RoutePoiCategory)}
            />
            <button
              type="button"
              className="xp-chip"
              aria-label="Actualiser la banque d’informations"
              disabled={knowledgeLoading}
              onClick={() => void refreshKnowledgeBank()}
            >
              <RefreshCw size={12} />
            </button>
          </div>

          {knowledgeLoading && knowledgePois.length === 0 ? (
            <XpEmpty
              title="Analyse en cours…"
              hint="Interrogation Base LKDV, OpenStreetMap et MET Norway."
            />
          ) : filteredKnowledgePois.length === 0 ? (
            <XpEmpty
              title="Aucun repère dans cette catégorie"
              hint="Aucune donnée recensée sur ce corridor — prévoyez votre autonomie."
            />
          ) : (
            <XpRows>
              {filteredKnowledgePois.slice(0, 30).map((poi) => (
                <Sourced
                  key={poi.id}
                  id={`poi-${poi.id}`}
                  provenance={{ source: poi.source || poiProvenance.source, at: poiProvenance.at }}
                  expert={false}
                  className="rcw-src-contents"
                >
                  <XpRow
                    icon={
                      poi.category === 'water'
                        ? 'drop'
                        : poi.category === 'shelter'
                          ? 'tent'
                          : poi.category === 'summit'
                            ? 'mtn'
                            : poi.category === 'food_lodging'
                              ? 'house'
                              : 'pin'
                    }
                    tone={
                      focusedPoiId === poi.id ? 'warn' : poi.category === 'water' ? 'water' : 'good'
                    }
                    title={poi.name}
                    sub={`${poi.rawCategory}${poi.altitudeM != null ? ` · ${Math.round(poi.altitudeM)} m` : ''} · ${poi.source}`}
                    badge={{
                      label:
                        poi.distanceToTrackM < 1000
                          ? `${poi.distanceToTrackM} m`
                          : `${(poi.distanceToTrackM / 1000).toFixed(1)} km`,
                      tone: poi.distanceToTrackM <= 500 ? 'good' : 'muted',
                    }}
                    onClick={() => {
                      setFocusedPoiId(poi.id);
                      setFocusCoord([poi.lon, poi.lat]);
                      setOverlayDetail({ kind: 'poi', poi, precision: 2 });
                    }}
                  />
                </Sourced>
              ))}
            </XpRows>
          )}

          {knowledgeSources.length > 0 ? (
            <p className="rcw-sub-note">Sources : {knowledgeSources.join(' · ')}.</p>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
