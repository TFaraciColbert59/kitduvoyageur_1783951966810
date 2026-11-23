import {
  Download,
  Grip,
  LocateFixed,
  PenLine,
  Plus,
  Redo2,
  Trash2,
  Undo2,
  Upload,
} from 'lucide-react';
import { XpIcon } from '@/features/explorer-v2/ui/XpIcon';
import { RouteShapeMiniStrip } from '../../RouteAnalysisVisuals';
import { Banners } from '../Banners';
import { useRouteViewMode } from '../expertMode';
import { PointList } from '../track/PointList';
import { ProfilePicker } from '../track/ProfilePicker';
import { SectionList } from '../track/SectionTools';
import { PendingRouting, ShapeTools } from '../track/ShapeTools';
import { VersionTimeline } from '../track/VersionTimeline';
import { Block, Btn } from '../track/atoms';
import { RouteRow, RouteRows } from '../ui/RouteRow';
import { useTrackTools } from '../useTrackTools';
import { TRACK_FILE_ACCEPT } from '../../../trackIo';
import { useRouteWorkspace } from '../WorkspaceContext';

export function TracerTab() {
  const {
    workspace,
    setSheetOpen,
    drawingMode,
    setDrawingMode,
    editingMode,
    setEditingMode,
    undoStack,
    redoStack,
    fileInputRef,
    historyOpen,
    setHistoryOpen,
    historyLoading,
    historyItems,
    setStatusMessage,
    canEditGeo,
    orderedPoints,
    flattenedCoords,
    handleUndo,
    handleRedo,
    runOperation,
    handleCenterMyPosition,
    handleLoadHistory,
    handleImportHistoryEntry,
    handleRemoveLastSegment,
    handleClearTrack,
    openSubDrawer,
    listMode,
  } = useRouteWorkspace();
  const { expert } = useRouteViewMode();
  const tools = useTrackTools();
  return (
    <div className="rcw-stack" data-testid="tab-panel-tracer">
      <Banners />

      <div className="rcw-import-grid">
        <button
          type="button"
          className="rcw-import-card"
          onClick={() => void handleLoadHistory()}
          aria-expanded={historyOpen}
          title="Sorties, carnets et randonnées enregistrés"
        >
          <span className="xp-row-ico" data-tone="good" aria-hidden="true">
            <Download size={15} />
          </span>
          <span className="rcw-import-card-text">
            <strong>Mes sorties</strong>
            <span>Carnets, randos</span>
          </span>
        </button>
        <button
          type="button"
          className="rcw-import-card"
          onClick={() => fileInputRef.current?.click()}
          title="Importer un fichier GPX, KML, TCX ou GeoJSON"
        >
          <span className="xp-row-ico" data-tone="water" aria-hidden="true">
            <Upload size={15} />
          </span>
          <span className="rcw-import-card-text">
            <strong>Importer un fichier</strong>
            <span>GPX, KML, TCX</span>
          </span>
        </button>
      </div>
      <input
        ref={fileInputRef}
        type="file"
        accept={TRACK_FILE_ACCEPT}
        className="xp-visually-hidden"
        aria-label="Importer un fichier GPX, KML, TCX ou GeoJSON"
        onChange={(e) => {
          void tools.importFile(e.target.files?.[0]);
          e.target.value = '';
        }}
      />

      {historyOpen ? (
        <div className="rcw-stat-card" data-testid="history-import-list">
          <div className="rcw-bar-head">
            <span>Tracés disponibles</span>
            <button type="button" className="xp-chip" onClick={() => setHistoryOpen(false)}>
              Fermer
            </button>
          </div>
          {historyLoading ? (
            <p className="rcw-sub-note">Chargement…</p>
          ) : !historyItems || historyItems.length === 0 ? (
            <p className="rcw-sub-note">
              Aucune sortie GPS ou randonnée enregistrée trouvée pour ce compte.
            </p>
          ) : (
            <RouteRows testId="history-rows">
              {historyItems.map((entry) => (
                <RouteRow
                  key={entry.id}
                  icon={entry.kind === 'carnet' ? 'map' : entry.kind === 'sortie' ? 'hike' : 'route'}
                  title={entry.title}
                  subtitle={`${entry.subtitle}${entry.distanceKm != null ? ` · ${entry.distanceKm} km` : ''}${entry.ascentM != null ? ` · D+ ${entry.ascentM} m` : ''}`}
                  value={entry.kind}
                  onClick={() => handleImportHistoryEntry(entry)}
                  testId={`history-row-${entry.id}`}
                />
              ))}
            </RouteRows>
          )}
        </div>
      ) : null}

      <div className="rcw-icon-toolbar" role="toolbar" aria-label="Outils de tracé et d’édition">
        <button
          type="button"
          className="rcw-icon-tool"
          aria-label={drawingMode ? 'Terminer le tracé' : 'Tracer sur la carte'}
          title={drawingMode ? 'Terminer le tracé' : 'Tracer sur la carte'}
          aria-pressed={drawingMode}
          disabled={!canEditGeo}
          onClick={() => {
            const next = !drawingMode;
            setDrawingMode(next);
            if (next) {
              setEditingMode(false);
              setSheetOpen(false);
              setStatusMessage('Dessinez votre tracé directement sur la carte.');
            }
          }}
        >
          <PenLine size={16} aria-hidden="true" />
        </button>
        <button
          type="button"
          className="rcw-icon-tool"
          aria-label="Éditer les points sur la carte"
          title="Éditer les points sur la carte"
          aria-pressed={editingMode}
          disabled={!canEditGeo}
          onClick={() => {
            const next = !editingMode;
            setEditingMode(next);
            if (next) {
              setDrawingMode(false);
              setStatusMessage('Glissez les repères numérotés directement sur la carte.');
            }
          }}
        >
          <Grip size={16} aria-hidden="true" />
        </button>
        <button
          type="button"
          className="rcw-icon-tool"
          aria-label="Ma position"
          title="Ma position"
          onClick={() => void handleCenterMyPosition()}
        >
          <LocateFixed size={16} aria-hidden="true" />
        </button>
        <button
          type="button"
          className="rcw-icon-tool"
          aria-label="Annuler le dernier geste"
          title="Annuler"
          disabled={undoStack.length === 0}
          onClick={handleUndo}
        >
          <Undo2 size={16} aria-hidden="true" />
        </button>
        <button
          type="button"
          className="rcw-icon-tool"
          aria-label="Rétablir le geste annulé"
          title="Rétablir"
          disabled={redoStack.length === 0}
          onClick={handleRedo}
        >
          <Redo2 size={16} aria-hidden="true" />
        </button>
        {canEditGeo ? (
          <>
            <button
              type="button"
              className="rcw-icon-tool"
              aria-label="Retirer le dernier point"
              title="Retirer le dernier point"
              onClick={handleRemoveLastSegment}
            >
              <Trash2 size={16} aria-hidden="true" />
            </button>
            <button
              type="button"
              className="rcw-icon-tool"
              aria-label="Effacer le tracé"
              title="Effacer le tracé"
              onClick={handleClearTrack}
            >
              <XpIcon name="x" size={16} />
            </button>
            <button
              type="button"
              className="rcw-icon-tool rcw-icon-tool--primary"
              aria-label="Ajouter un point"
              title="Ajouter un point"
              onClick={() => {
                const last = orderedPoints[orderedPoints.length - 1];
                void runOperation({
                  type: 'insert_point',
                  pointId: `pt-${Date.now().toString(36)}`,
                  afterPointId: last?.id ?? null,
                  lat: Number(((last?.lat ?? 45.05) + 0.01).toFixed(5)),
                  lon: Number(((last?.lon ?? 5.51) + 0.01).toFixed(5)),
                  name: `Passage ${orderedPoints.length + 1}`,
                });
              }}
            >
              <Plus size={16} aria-hidden="true" />
            </button>
          </>
        ) : null}
      </div>

      <ProfilePicker />
      <ShapeTools />
      <PendingRouting />
      {/* Mode liste : la surface liste de l'écran énumère déjà les points (un toucher ouvre leur tiroir, où se modifient nom, coordonnées et suppression). */}
      {listMode ? null : <PointList />}
      {expert ? <SectionList /> : null}
      <Block title="Aller plus loin" testId="track-more">
        <div className="rts-actions">
          <Btn onClick={() => openSubDrawer('variants')} testId="open-variants">
            Comparer des variantes
          </Btn>
          <Btn onClick={() => openSubDrawer('gpx')} testId="open-files">
            Importer / exporter
          </Btn>
        </div>
      </Block>
      <VersionTimeline />

      <RouteShapeMiniStrip
        coords={flattenedCoords}
        pointsCount={orderedPoints.length}
        sectionsCount={workspace.sections.length}
        shapeLabel={
          workspace.shapeMode === 'loop'
            ? 'Boucle'
            : workspace.shapeMode === 'out_and_back'
              ? 'Aller-retour'
              : 'Aller simple'
        }
      />
    </div>
  );
}
