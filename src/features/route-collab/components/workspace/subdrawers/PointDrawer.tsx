import { XpEmpty, XpEyebrow, XpMetrics, XpRow, XpRows } from '@/features/explorer-v2/sheet/blocks';
import type { DrawerHeader } from '../types';
import { Banners } from '../Banners';
import { useRouteWorkspace, type RouteWorkspaceApi } from '../WorkspaceContext';

export function pointDrawerHeader(ws: RouteWorkspaceApi): DrawerHeader {
  const pt = ws.selectedPoint;
  if (!pt) return { title: 'Détail du point', subtitle: 'Aucun point sélectionné' };
  return {
    title: pt.name || pt.kind,
    subtitle: `${pt.lat.toFixed(5)}, ${pt.lon.toFixed(5)} · v${pt.entityVersion}${pt.eleM != null ? ` · ${Math.round(pt.eleM)} m` : ''}`,
  };
}

export function PointDrawer() {
  const {
    workspace,
    setSubDrawer,
    commentBody,
    setCommentBody,
    canEditGeo,
    canComment,
    orderedPoints,
    selectedPoint,
    runOperation,
    handleAddComment,
  } = useRouteWorkspace();
  const pt = selectedPoint;
  if (!pt) {
    return (
      <XpEmpty
        title="Aucun point"
        hint="Ajoutez un point sur la carte ou depuis l’onglet Tracer."
      />
    );
  }
  const ptComments = workspace.comments.filter((c) => c.anchor.entityId === pt.id);
  return (
    <div className="rcw-stack" data-testid="subdrawer-point">
      <Banners />
      <XpMetrics
        items={[
          { label: 'Latitude', value: pt.lat.toFixed(4) },
          { label: 'Longitude', value: pt.lon.toFixed(4) },
          { label: 'Altitude', value: pt.eleM != null ? `${Math.round(pt.eleM)} m` : 'Inconnue' },
        ]}
      />
      {canEditGeo ? (
        <>
          <XpEyebrow>Actions sur ce point</XpEyebrow>
          <div className="rcw-inline-actions">
            <button
              type="button"
              className="xp-primary"
              onClick={() =>
                void runOperation(
                  {
                    type: 'move_point',
                    pointId: pt.id,
                    lat: Number((pt.lat + 0.003).toFixed(5)),
                    lon: Number((pt.lon + 0.003).toFixed(5)),
                  },
                  { [pt.id]: pt.entityVersion }
                )
              }
            >
              Déplacer (+300 m NE)
            </button>
            {orderedPoints.length > 2 ? (
              <button
                type="button"
                className="xp-secondary"
                onClick={() => {
                  void runOperation(
                    { type: 'delete_point', pointId: pt.id },
                    { [pt.id]: pt.entityVersion }
                  );
                  setSubDrawer(null);
                }}
              >
                Supprimer ce point
              </button>
            ) : null}
          </div>
        </>
      ) : null}

      <XpEyebrow>Commentaires ancrés ({ptComments.length})</XpEyebrow>
      {ptComments.length > 0 ? (
        <XpRows>
          {ptComments.map((c) => (
            <XpRow
              key={c.id}
              icon="msg"
              tone={c.status === 'needs_relocation' ? 'warn' : 'ink'}
              title={`${c.authorName} · ${c.body}`}
              sub={`Rév. v${c.baseRevisionNo}`}
              badge={{
                label: c.status === 'needs_relocation' ? 'À repositionner' : 'Ouvert',
                tone: c.status === 'needs_relocation' ? 'warn' : 'good',
              }}
            />
          ))}
        </XpRows>
      ) : (
        <p className="rcw-sub-note">Aucun commentaire ancré sur ce point.</p>
      )}

      {canComment ? (
        <div className="xp-form">
          <label>
            Nouveau commentaire sur ce point
            <input
              type="text"
              value={commentBody}
              onChange={(e) => setCommentBody(e.target.value)}
              placeholder="Ex : source à vérifier, refuge complet…"
            />
          </label>
          <button type="button" className="xp-primary" onClick={() => void handleAddComment(pt.id)}>
            Ancrer le commentaire
          </button>
        </div>
      ) : null}
    </div>
  );
}
