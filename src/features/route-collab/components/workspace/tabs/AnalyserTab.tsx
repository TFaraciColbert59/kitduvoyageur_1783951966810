import { RefreshCw } from 'lucide-react';
import { XpChips, XpEmpty, XpRow, XpRows } from '@/features/explorer-v2/sheet/blocks';
import { XpIcon } from '@/features/explorer-v2/ui/XpIcon';
import type { RoutePoiCategory } from '../../../routeAnalysis';
import {
  EffortRadialGauge,
  ElevationAreaChart,
  SlopeStackedVisual,
  SunDaylightArc,
  SurfaceStackedVisual,
  WeatherForecastChart,
} from '../../RouteAnalysisVisuals';
import { profileIndexAtDistance } from '../../../profileLink';
import { Banners } from '../Banners';
import { ProfileReadoutLine } from '../map/ProfileReadoutLine';
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
    totalWarnings,
    terrainStats,
    elevationStats,
    poiCounts,
    filteredKnowledgePois,
    openSubDrawer,
    refreshKnowledgeBank,
  } = useRouteWorkspace();
  return (
    <div className="rcw-stack" data-testid="tab-panel-analyser">
      <Banners />

      {analyserSection === 'terrain' ? (
        <>
          <ElevationAreaChart
            samples={elevation.samples}
            minEleM={elevationStats.minEleM}
            avgEleM={terrainStats.avgAltitudeM}
            maxEleM={elevationStats.maxEleM}
            cursorKm={profileReadout ? profileReadout.km : null}
            onHoverKm={(km) => {
              // Profil → carte (2.6) : le kilomètre survolé est lu dans le modèle de profil, pas deviné par ratio.
              if (km == null) {
                setHoveredCoord(null);
                setProfileCursor(null);
                return;
              }
              const idx = profileIndexAtDistance(profileModel, km * 1000);
              setProfileCursor(idx);
              const hit = idx == null ? null : profileModel.points[idx];
              setHoveredCoord(hit ? [hit.lon, hit.lat] : null);
            }}
          />
          <ProfileReadoutLine readout={profileReadout} hasElevation={profileModel.hasElevation} />

          <EffortRadialGauge stats={terrainStats} />

          <SlopeStackedVisual stats={terrainStats} />

          <SurfaceStackedVisual
            stats={terrainStats}
            sectionsCount={workspace.sections.length}
            warningsCount={totalWarnings}
          />

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
          <SunDaylightArc stats={terrainStats} />

          <WeatherForecastChart weather={liveWeather} loading={knowledgeLoading} />

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
                <XpRow
                  key={poi.id}
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
