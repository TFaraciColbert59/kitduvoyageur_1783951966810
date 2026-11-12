'use client';

import React, { useCallback, useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { RotateCcw } from 'lucide-react';
import { ActionPill } from '@/components/ui/ActionPill';
import type { BootstrapOverlayData } from './DetailDrawers';

const PostDrawer = dynamic(() => import('./PostDrawer').then((mod) => mod.PostDrawer), { ssr: false });
const SavedPostsDrawer = dynamic(() => import('./DetailDrawers').then((mod) => mod.SavedPostsDrawer), { ssr: false });
const BadgeDetailSheet = dynamic(() => import('./DetailDrawers').then((mod) => mod.BadgeDetailSheet), { ssr: false });
const GearDetailSheet = dynamic(() => import('./DetailDrawers').then((mod) => mod.GearDetailSheet), { ssr: false });
const ProfilePreviewDrawer = dynamic(() => import('./DetailDrawers').then((mod) => mod.ProfilePreviewDrawer), { ssr: false });
const SealDrawer = dynamic(() => import('./DetailDrawers').then((mod) => mod.SealDrawer), { ssr: false });
const TrustDetailSheet = dynamic(() => import('./DetailDrawers').then((mod) => mod.TrustDetailSheet), { ssr: false });
const CreateDrawer = dynamic(() => import('../create/CreateDrawer').then((mod) => mod.CreateDrawer), { ssr: false });

type CompteOverlay =
  | { kind: 'post'; postId: string; pane?: 'post' | 'comments' | 'share'; commentId?: string | null }
  | { kind: 'saved' }
  | { kind: 'badge'; badgeId: string }
  | { kind: 'gear'; gearId: string }
  | { kind: 'seal' }
  | { kind: 'trust' }
  | { kind: 'profile'; userId: string }
  | { kind: 'create'; type?: string };

type Entry = { key: string; overlay: CompteOverlay };

function keyOf(overlay: CompteOverlay) {
  if (overlay.kind === 'post') return `post:${overlay.postId}:${overlay.pane || 'post'}`;
  if (overlay.kind === 'badge') return `badge:${overlay.badgeId}`;
  if (overlay.kind === 'gear') return `gear:${overlay.gearId}`;
  if (overlay.kind === 'profile') return `profile:${overlay.userId}`;
  if (overlay.kind === 'create') return `create:${overlay.type || 'menu'}`;
  return overlay.kind;
}

const OVERLAY_DATA_KEYS = [
  'profile',
  'stats',
  'badges',
  'gearItems',
  'kits',
  'followers',
  'following',
  'tribu',
  'species',
  'trust',
] as const;

/**
 * Un 200 JSON n'est pas forcément un bootstrap exploitable : `{}` ou
 * `{ authenticated: true }` ne portent aucune donnée et afficheraient des
 * zéros. On exige au moins un champ connu, sans erreur ni invité.
 */
function isUsableBootstrap(payload: unknown): payload is BootstrapOverlayData {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return false;
  const record = payload as Record<string, unknown>;
  if (record.error) return false;
  if (record.authenticated === false) return false;
  return OVERLAY_DATA_KEYS.some((key) => key in record);
}

export function CompteOverlayHost({ onChanged }: { onChanged?: () => void }) {
  const [stack, setStack] = useState<Entry[]>([]);
  const [bootstrap, setBootstrap] = useState<BootstrapOverlayData | null>(null);
  const [bootstrapError, setBootstrapError] = useState(false);

  const invalidate = useCallback(() => {
    setBootstrap(null);
    setBootstrapError(false);
  }, []);
  const handleChanged = useCallback(() => {
    invalidate();
    onChanged?.();
  }, [invalidate, onChanged]);

  const push = useCallback((overlay: CompteOverlay) => {
    setStack((current) => {
      const key = keyOf(overlay);
      const base = current.filter((entry) => !entry.key.startsWith(`${key}:`));
      return [...base, { key, overlay }];
    });
  }, []);
  const pop = useCallback(() => setStack((current) => current.slice(0, -1)), []);

  useEffect(() => {
    const api = {
      openPost: (postId: string, options?: { pane?: 'post' | 'comments' | 'share'; commentId?: string | null }) => push({ kind: 'post', postId, pane: options?.pane ?? 'post', commentId: options?.commentId ?? null }),
      openSaved: () => push({ kind: 'saved' }),
      openBadge: (badgeId: string) => push({ kind: 'badge', badgeId }),
      openGear: (gearId: string) => push({ kind: 'gear', gearId }),
      openSeal: () => push({ kind: 'seal' }),
      openTrust: () => push({ kind: 'trust' }),
      openProfile: (userId: string) => push({ kind: 'profile', userId }),
      openCreate: (type?: string) => push({ kind: 'create', type }),
      close: pop,
      closeAll: () => setStack([]),
    };
    (window as any).__lkdvCompteOverlay = api;
    (window as any).__lkdvOpenPost = api.openPost;
    (window as any).__lkdvOpenSaved = api.openSaved;
    (window as any).__lkdvOpenBadge = api.openBadge;
    (window as any).__lkdvOpenGear = api.openGear;
    (window as any).__lkdvOpenSeal = api.openSeal;
    (window as any).__lkdvOpenTrust = api.openTrust;
    (window as any).__lkdvOpenCreate = api.openCreate;
    return () => {
      if ((window as any).__lkdvCompteOverlay === api) {
        delete (window as any).__lkdvCompteOverlay;
        delete (window as any).__lkdvOpenPost;
        delete (window as any).__lkdvOpenSaved;
        delete (window as any).__lkdvOpenBadge;
        delete (window as any).__lkdvOpenGear;
        delete (window as any).__lkdvOpenSeal;
        delete (window as any).__lkdvOpenTrust;
        delete (window as any).__lkdvOpenCreate;
      }
    };
  }, [pop, push]);

  const top = stack[stack.length - 1];
  const needsBootstrap = top && ['badge', 'gear', 'seal', 'trust'].includes(top.overlay.kind);

  // Une fermeture complète invalide le snapshot : la prochaine ouverture relit
  // les données au lieu d'afficher un état figé après un suivi ou du matériel
  // ajouté. Un échec est également remis à zéro pour permettre un nouvel essai.
  useEffect(() => {
    if (stack.length > 0) return;
    setBootstrap(null);
    setBootstrapError(false);
  }, [stack.length]);

  useEffect(() => {
    if (!needsBootstrap || bootstrap || bootstrapError) return;
    let cancelled = false;
    fetch('/api/compte/bootstrap', {
      cache: 'no-store',
      credentials: 'same-origin',
      headers: { accept: 'application/json' },
    })
      .then((response) => {
        if (!response.ok) throw new Error(`bootstrap_http_${response.status}`);
        return response.json();
      })
      .then((payload) => {
        if (cancelled) return;
        // La route répond 200 avec un payload d'erreur explicite : un simple
        // `response.ok` ne suffit pas. On refuse aussi un corps vide pour ne
        // jamais afficher des zéros à la place d'une panne.
        if (!isUsableBootstrap(payload)) {
          setBootstrapError(true);
          return;
        }
        setBootstrap(payload);
      })
      .catch(() => { if (!cancelled) setBootstrapError(true); });
    return () => { cancelled = true; };
  }, [bootstrap, bootstrapError, needsBootstrap]);

  if (!top) return null;
  const overlay = top.overlay;

  if (overlay.kind === 'post') {
    return <PostDrawer postId={overlay.postId} initialPane={overlay.pane} initialCommentId={overlay.commentId} onClose={pop} onOpenProfile={(userId) => push({ kind: 'profile', userId })} onDeleted={() => { handleChanged(); pop(); }} />;
  }
  if (overlay.kind === 'saved') {
    return <SavedPostsDrawer onClose={pop} onOpenPost={(postId) => push({ kind: 'post', postId })} />;
  }
  if (overlay.kind === 'profile') return <ProfilePreviewDrawer userId={overlay.userId} onClose={pop} />;
  if (overlay.kind === 'create') return <CreateDrawer initialType={overlay.type} onClose={pop} onCreated={handleChanged} />;

  if (needsBootstrap && !bootstrap) {
    return (
      <div className="lkdv-compte-overlay">
        <div className="lkdv-overlay-scrim" />
        <div className="lkdv-overlay-sheet">
          <div className="lkdv-overlay-empty" role={bootstrapError ? 'alert' : undefined}>
            <p>{bootstrapError ? 'Impossible de charger les données.' : 'Chargement…'}</p>
            {bootstrapError ? (
              <ActionPill
                label="Réessayer"
                text="Réessayer"
                tone="primary"
                icon={<RotateCcw size={15} aria-hidden="true" />}
                onClick={() => setBootstrapError(false)}
              />
            ) : null}
          </div>
        </div>
      </div>
    );
  }
  if (!bootstrap) return null;

  if (overlay.kind === 'badge') {
    const badge = (bootstrap.badges ?? []).find((entry) => entry.id === overlay.badgeId);
    return badge ? <BadgeDetailSheet badge={badge} onClose={pop} /> : null;
  }
  if (overlay.kind === 'gear') {
    const gear = (bootstrap.gearItems ?? []).find((entry) => entry.id === overlay.gearId || entry.realId === overlay.gearId);
    return gear ? <GearDetailSheet item={gear} onClose={pop} /> : null;
  }
  if (overlay.kind === 'seal') return <SealDrawer data={bootstrap} onClose={pop} />;
  if (overlay.kind === 'trust') return <TrustDetailSheet data={bootstrap} trustScore={bootstrap.profile?.trustScore} onClose={pop} />;
  return null;
}

export default CompteOverlayHost;
