'use client';

import '@/styles/explorer-v2.css';
import './routeCollab.css';

import dynamic from 'next/dynamic';
import { ExplorerSheet } from '@/features/explorer-v2/sheet/ExplorerSheet';
import type { RouteCollabMapProps } from './RouteCollabMap';
import { ListModeSurface } from './workspace/ListModeSurface';
import { MapSettingsDrawer, OverlayDetailDrawer, renderSubDrawer } from './workspace/subdrawers';
import { MAIN_TABS } from './workspace/tabs';
import { TopStack } from './workspace/TopStack';
import type { RouteCollabWorkspaceProps } from './workspace/types';
import { useRouteWorkspaceState } from './workspace/useRouteWorkspaceState';
import { RouteWorkspaceProvider } from './workspace/WorkspaceContext';

export type { RouteCollabWorkspaceProps, SubDrawerId } from './workspace/types';

const DynamicRouteMap = dynamic<RouteCollabMapProps>(
  () => import('./RouteCollabMap').then((m) => m.RouteCollabMap),
  {
    ssr: false,
    loading: () => <div className="xp-map" aria-hidden="true" />,
  }
);

/**
 * Assemblage du Compas itinéraire : carte plein écran + tiroir Explorer.
 * L'état et les handlers vivent dans `workspace/useRouteWorkspaceState`, partagés par contexte ;
 * chaque onglet (`workspace/tabs/*`) et chaque sous-tiroir (`workspace/subdrawers/*`) est un fichier à part.
 */
export function RouteCollabWorkspace(props: RouteCollabWorkspaceProps) {
  const ws = useRouteWorkspaceState(props);
  const {
    workspace,
    sheetOpen,
    setSheetOpen,
    detent,
    setDetent,
    tabIndex,
    setTabIndex,
    setSubDrawer,
    mapBase,
    fitTrigger,
    focusCoord,
    setFocusCoord,
    listMode,
    setListMode,
    webglAvailable,
    setWebglAvailable,
    drawingMode,
    editingMode,
    knowledgePois,
    focusedPoiId,
    setFocusedPoiId,
    analyserSection,
    setAnalyserSection,
    selectedPointId,
    setSelectedPointId,
    selectedSectionId,
    setSelectedSectionId,
    hoveredCoord,
    setHoveredCoord,
    comparedVariant,
    setStatusMessage,
    canEditGeo,
    orderedPoints,
    runOperation,
    openSubDrawer,
    snapSectionsAroundPoint,
    handleFreehandDrawComplete,
    handleDragPoint,
    overlayDetail,
  } = ws;

  const activeSubDrawer = renderSubDrawer(ws);

  return (
    <RouteWorkspaceProvider value={ws}>
      <div
        className="xp-root rcw-explorer-root"
        data-theme="light"
        data-sheet-open={sheetOpen ? 'true' : 'false'}
        data-testid="route-collab-workspace"
        data-head-seq={workspace.headSeq}
      >
        {/* ÉLÉMENT 1 : CARTE PLEIN ÉCRAN (ou surface liste accessible sans WebGL) */}
        {!listMode && webglAvailable ? (
          <DynamicRouteMap
            points={orderedPoints}
            sections={workspace.sections}
            base={mapBase}
            fitTrigger={fitTrigger}
            focusCoord={focusCoord}
            comparedVariant={comparedVariant}
            hoveredCoord={hoveredCoord}
            selectedPointId={selectedPointId}
            selectedSectionId={selectedSectionId}
            analysisPois={knowledgePois}
            focusedPoiId={focusedPoiId}
            canEdit={canEditGeo}
            drawingMode={drawingMode}
            editingMode={editingMode}
            onMapClickAddPoint={(lat, lon) => {
              const last = orderedPoints[orderedPoints.length - 1];
              const newId = `pt-${Date.now().toString(36)}`;
              void (async () => {
                await runOperation({
                  type: 'insert_point',
                  pointId: newId,
                  afterPointId: last?.id ?? null,
                  lat,
                  lon,
                  name: `Passage ${orderedPoints.length + 1}`,
                });
                await snapSectionsAroundPoint(newId);
              })();
              setSelectedPointId(newId);
              setFocusCoord([lon, lat]);
            }}
            onFreehandDrawComplete={handleFreehandDrawComplete}
            onDragPoint={handleDragPoint}
            onSelectPoint={(pointId) => {
              const pt = orderedPoints.find((p) => p.id === pointId);
              setSelectedPointId(pointId);
              setSelectedSectionId(null);
              if (pt) {
                setFocusCoord([pt.lon, pt.lat]);
                setHoveredCoord([pt.lon, pt.lat]);
              }
              openSubDrawer('point');
            }}
            onSelectSection={(sectionId) => {
              setSelectedSectionId(sectionId);
              setSelectedPointId(null);
              openSubDrawer('section');
            }}
            onSelectPoi={(poi) => {
              setFocusedPoiId(poi.id);
              setFocusCoord([poi.lon, poi.lat]);
              setStatusMessage(
                `${poi.name} (${poi.rawCategory} · ${poi.distanceToTrackM} m du tracé).`
              );
            }}
            onMapError={(reason) => {
              setWebglAvailable(false);
              setListMode(true);
              setSheetOpen(true);
              setStatusMessage(`Mode liste activé automatiquement (${reason}).`);
            }}
          />
        ) : (
          <ListModeSurface />
        )}

        {/* PILULE TÉLÉMÉTRIE / NOTIFICATIONS ÉPHÉMÈRES (2 s, Framer Motion) EN TOP ÉCRAN */}
        <TopStack />

        {/* CARTE & AFFICHAGE EN HAUT À DROITE DE LA CARTE */}
        <MapSettingsDrawer />

        {/* ÉLÉMENT 2 : TIROIR EXPLORER (ou pilule 3 petits points en bas lorsque fermé) */}
        {sheetOpen ? (
          <ExplorerSheet
            title={activeSubDrawer ? activeSubDrawer.title : ''}
            subtitle={activeSubDrawer ? activeSubDrawer.subtitle : null}
            tabs={activeSubDrawer ? undefined : MAIN_TABS}
            tab={tabIndex}
            onTab={(idx) => setTabIndex(idx)}
            detent={detent}
            onDetent={(d) => setDetent(d)}
            onBack={activeSubDrawer ? () => setSubDrawer(null) : undefined}
            onClose={
              activeSubDrawer
                ? () => {
                    setSubDrawer(null);
                    setSheetOpen(false);
                  }
                : undefined
            }
            bottomInset={64}
            labelledBy="rcw-sheet-title"
            tabsBottom={false}
            mini={
              !activeSubDrawer && tabIndex === 2
                ? {
                    items: [
                      { id: 'terrain', label: 'Terrain', icon: 'mtn' },
                      { id: 'milieu', label: 'Milieu & Météo', icon: 'cloud' },
                      {
                        id: 'chemin',
                        label: `Sur le chemin (${knowledgePois.length})`,
                        icon: 'pin',
                      },
                    ],
                    value: analyserSection === 'terrain' ? 0 : analyserSection === 'milieu' ? 1 : 2,
                    onChange: (idx) =>
                      setAnalyserSection(idx === 0 ? 'terrain' : idx === 1 ? 'milieu' : 'chemin'),
                  }
                : null
            }
          >
            {activeSubDrawer ? activeSubDrawer.body : null}
          </ExplorerSheet>
        ) : (
          <button
            type="button"
            className="xp-sheet-pill-launcher"
            data-testid="route-drawer-pill"
            aria-label="Ouvrir le tiroir d’itinéraire"
            onClick={() => {
              setSheetOpen(true);
              setDetent('low');
            }}
          >
            <span className="xp-pill-dots" aria-hidden="true">
              <span />
              <span />
              <span />
            </span>
          </button>
        )}

        {/* TIROIR SUPERPOSÉ HIÉRARCHIQUE (Étapes -> Catégories -> Sous-catégories avec +/- précision) */}
        {overlayDetail ? <OverlayDetailDrawer /> : null}
      </div>
    </RouteWorkspaceProvider>
  );
}

export default RouteCollabWorkspace;
