'use client';

import React, { useEffect, useState } from 'react';
import { RouteCollabWorkspace } from './RouteCollabWorkspace';
import { getLastVerifiedPack, type StoredDeparturePack } from '../offlinePackStore';
import type { RouteWorkspaceState } from '../types';

function findLatestVerifiedPackOnDevice(): { userId: string; pack: StoredDeparturePack } | null {
  if (typeof window === 'undefined' || !window.localStorage) return null;
  const prefix = 'lkdv:route-collab:offline:v1:';
  const params = new URLSearchParams(window.location.search);
  const requestedUser = params.get('userId');
  const requestedWs = params.get('workspaceId');

  if (requestedUser && requestedWs) {
    const exact = getLastVerifiedPack(requestedUser, requestedWs);
    if (exact) return { userId: requestedUser, pack: exact };
  }

  let best: { userId: string; pack: StoredDeparturePack } | null = null;
  for (let i = 0; i < window.localStorage.length; i += 1) {
    const key = window.localStorage.key(i);
    if (!key || !key.startsWith(prefix)) continue;
    const uid = key.slice(prefix.length);
    if (requestedUser && uid !== requestedUser) continue;
    try {
      const parsed = JSON.parse(window.localStorage.getItem(key) || '{}') as {
        verifiedPacks?: Record<string, StoredDeparturePack>;
      };
      for (const wsId of Object.keys(parsed.verifiedPacks ?? {})) {
        if (requestedWs && wsId !== requestedWs) continue;
        const verified = getLastVerifiedPack(uid, wsId);
        if (verified && (!best || verified.verifiedAt > best.pack.verifiedAt)) {
          best = { userId: uid, pack: verified };
        }
      }
    } catch {
      /* ignore */
    }
  }
  return best;
}

export function RouteCollabOfflineClient() {
  const [found, setFound] = useState<{ userId: string; pack: StoredDeparturePack } | null>(null);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    setFound(findLatestVerifiedPackOnDevice());
    setChecked(true);
  }, []);

  if (!checked) {
    return (
      <div className="xp-root rcw-empty-screen" data-theme="light">
        <div className="rcw-empty-card">Vérification des packs locaux…</div>
      </div>
    );
  }

  if (!found) {
    return (
      <div className="xp-root rcw-empty-screen" data-theme="light" data-testid="offline-pack-empty">
        <div className="rcw-empty-card">
          <strong>Aucun pack hors ligne vérifié sur cet appareil</strong>
          <p className="rcw-sub-note">
            Téléchargez une version publiée depuis Compas avant de passer en mode avion.
          </p>
        </div>
      </div>
    );
  }

  const rev = found.pack.revision;
  const ws: RouteWorkspaceState = {
    id: rev.workspaceId,
    tripId: `offline-${rev.workspaceId}`,
    title: rev.summary || `Itinéraire v${rev.revisionNo} (hors ligne)`,
    status: 'published',
    sport: 'marche',
    shapeMode: 'one_way',
    routingOptions: {},
    headSeq: rev.basedOnSeq,
    reviewedSeq: rev.basedOnSeq,
    publishedRevisionId: rev.id,
    publishedRevisionNo: rev.revisionNo,
    sourceOrigin: { kind: 'blank', importedAt: rev.createdAt },
    points: rev.points,
    sections: rev.sections,
    stages: rev.stages,
    variants: [],
    proposals: [],
    comments: [],
    kitItems: rev.kitSnapshot,
    members: [{ userId: found.userId, displayName: 'Mode hors ligne', role: 'editor' }],
    revisions: [rev],
    packs: [found.pack.manifest],
    participantPacks: [
      {
        userId: found.userId,
        displayName: 'Mode hors ligne',
        preparedRevisionNo: rev.revisionNo,
        downloadedRevisionNo: rev.revisionNo,
        verifiedLocalAt: found.pack.verifiedAt,
        status: 'ready',
      },
    ],
    updatedAt: found.pack.verifiedAt,
  };

  return (
    <RouteCollabWorkspace
      initialWorkspace={ws}
      currentUserId={found.userId}
      currentUserName="Voyageur hors ligne"
      serverSynced={true}
    />
  );
}
