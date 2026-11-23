'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Cap, PBtn } from '@/features/compas/v5/ui/primitives';
import {
  TILE_PROVIDER_CREDIT,
  downloadTilePack,
  formatMo,
  planCorridorTiles,
  readTilePack,
  type LonLat,
  type TilePackMeta,
  type TilePlan,
  type TileProgress,
} from '../../../offlineTiles';
import { V5Scope } from '../ui/V5Scope';
import { useRouteWorkspace } from '../WorkspaceContext';

export type TilePackStatus = 'idle' | 'running' | 'done' | 'error';

export interface TilePackState {
  readonly plan: TilePlan;
  readonly meta: TilePackMeta | null;
  readonly status: TilePackStatus;
  readonly progress: TileProgress | null;
  readonly message: string | null;
  readonly start: () => Promise<void>;
}

/** Le fond de carte du corridor : taille annoncée avant, téléchargement dans un cache neuf, copie précédente intacte. */
export function useTilePack(): TilePackState {
  const { workspace, online } = useRouteWorkspace();
  const line = useMemo<LonLat[]>(
    () => workspace.sections.flatMap((s) => s.geometry.coordinates.map((c): LonLat => [c[0], c[1]])),
    [workspace.sections]
  );
  const plan = useMemo(() => planCorridorTiles(line), [line]);
  const [meta, setMeta] = useState<TilePackMeta | null>(null);
  const [status, setStatus] = useState<TilePackStatus>('idle');
  const [progress, setProgress] = useState<TileProgress | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const running = useRef(false);
  const revisionNo = workspace.publishedRevisionNo ?? workspace.packs[workspace.packs.length - 1]?.revisionNo ?? 0;

  useEffect(() => setMeta(readTilePack(workspace.id)), [workspace.id]);

  const start = useCallback(async () => {
    if (running.current) return;
    if (!online) {
      setStatus('error');
      setMessage('Hors ligne : le fond de carte se télécharge avec du réseau.');
      return;
    }
    running.current = true;
    setStatus('running');
    setMessage(null);
    setProgress({ done: 0, total: plan.tiles.length, bytes: 0 });
    const res = await downloadTilePack({ workspaceId: workspace.id, revisionNo, line, onProgress: setProgress });
    running.current = false;
    if (res.ok) {
      setMeta(res.meta);
      setStatus('done');
      setMessage(res.message);
    } else {
      setMeta(res.previous);
      setStatus('error');
      setMessage(res.reason);
    }
  }, [online, plan.tiles.length, workspace.id, revisionNo, line]);

  return { plan, meta, status, progress, message, start };
}

export function TilePackBlock({ state }: { state: TilePackState }) {
  const { plan, meta, status, progress, message, start } = state;
  const running = status === 'running';
  return (
    <V5Scope>
      <div className="rcw-block" data-testid="tile-pack-block" data-status={status}>
        <Cap>Fond de carte hors ligne</Cap>
        <p className="rcw-publish-sentence" data-testid="tile-pack-size">
          {plan.announcement}
        </p>
        {plan.capMessage ? (
          <p className="rcw-sub-note" data-testid="tile-pack-cap" role="status">
            {plan.capMessage}
          </p>
        ) : null}
        {meta ? (
          <p className="rcw-sub-note" data-testid="tile-pack-current">
            Sur l’appareil : {meta.tiles} tuiles, zooms {meta.minZoom} à {meta.maxZoom}, {formatMo(meta.bytes)} (v{meta.revisionNo}).
          </p>
        ) : null}
        {running && progress ? (
          <p className="rcw-sub-note" role="status" data-testid="tile-pack-progress">
            Téléchargement : {progress.done} / {progress.total} tuiles · {formatMo(progress.bytes)}
          </p>
        ) : null}
        {message ? (
          <p className="rcw-sub-note" role="status" data-testid="tile-pack-message" data-tone={status === 'error' ? 'bad' : 'good'}>
            {message}
          </p>
        ) : null}
        <p className="rcw-sub-note">Fond : {TILE_PACK_CREDIT_SHORT}. Hors ligne, le tracé se pose sur ce fond (Plan).</p>
        <PBtn onClick={() => void start()} disabled={!plan.fits || running}>
          {meta ? 'Mettre à jour le fond de carte' : 'Télécharger le fond de carte'}
        </PBtn>
      </div>
    </V5Scope>
  );
}

const TILE_PACK_CREDIT_SHORT = TILE_PROVIDER_CREDIT;
