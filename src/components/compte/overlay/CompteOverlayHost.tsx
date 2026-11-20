'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { RotateCcw } from 'lucide-react';
import { ActionPill } from '@/components/ui/ActionPill';
import type { BootstrapOverlayData } from './DetailDrawers';
import {
  EffortExpertDrawer,
  EffortFatigueDrawer,
  EffortGroupDrawer,
  EffortPrivacyDrawer,
  type EffortSubDrawerKind,
  EffortWhyDrawer,
} from './EffortSubDrawers';

const PostDrawer = dynamic(() => import('./PostDrawer').then((mod) => mod.PostDrawer), { ssr: false });
const SavedPostsDrawer = dynamic(() => import('./DetailDrawers').then((mod) => mod.SavedPostsDrawer), { ssr: false });
const BadgeDetailSheet = dynamic(() => import('./DetailDrawers').then((mod) => mod.BadgeDetailSheet), { ssr: false });
const GearDetailSheet = dynamic(() => import('./DetailDrawers').then((mod) => mod.GearDetailSheet), { ssr: false });
const ProfilePreviewDrawer = dynamic(() => import('./DetailDrawers').then((mod) => mod.ProfilePreviewDrawer), { ssr: false });
const SealDrawer = dynamic(() => import('./DetailDrawers').then((mod) => mod.SealDrawer), { ssr: false });
const TrustDetailSheet = dynamic(() => import('./DetailDrawers').then((mod) => mod.TrustDetailSheet), { ssr: false });
const CreateDrawer = dynamic(() => import('../create/CreateDrawer').then((mod) => mod.CreateDrawer), { ssr: false });

export type CompteOverlay =
  | { kind: 'post'; postId: string; pane?: 'post' | 'comments' | 'share'; commentId?: string | null }
  | { kind: 'saved' }
  | { kind: 'badge'; badgeId: string }
  | { kind: 'gear'; gearId: string }
  | { kind: 'seal' }
  | { kind: 'trust' }
  | { kind: 'profile'; userId: string }
  | { kind: 'create'; type?: string }
  | { kind: 'effort-why' }
  | { kind: 'effort-group' }
  | { kind: 'effort-fatigue' }
  | { kind: 'effort-privacy' }
  | { kind: 'effort-expert' };

type Entry = { key: string; overlay: CompteOverlay };

export function keyOf(overlay: CompteOverlay): string {
  if (overlay.kind === 'post') return `post:${overlay.postId}:${overlay.pane || 'post'}`;
  if (overlay.kind === 'badge') return `badge:${overlay.badgeId}`;
  if (overlay.kind === 'gear') return `gear:${overlay.gearId}`;
  if (overlay.kind === 'profile') return `profile:${overlay.userId}`;
  if (overlay.kind === 'create') return `create:${overlay.type || 'menu'}`;
  return overlay.kind;
}

const BOOTSTRAP_OVERLAY_KINDS = new Set<CompteOverlay['kind']>([
  'badge',
  'gear',
  'seal',
  'trust',
  'effort-why',
  'effort-group',
  'effort-fatigue',
  'effort-privacy',
  'effort-expert',
]);

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
  'lastOutingEffort',
  'nextPlannedOutingEffort',
  'effortGroupSummary',
  'effortFatigueSummary',
  'effortPrivacySummary',
  'effortExpertSummary',
] as const;

function hasMeaningfulValue(value: unknown): boolean {
  if (Array.isArray(value)) return value.length > 0;
  if (!value || typeof value !== 'object') return false;
  return Object.keys(value as Record<string, unknown>).length > 0;
}

/**
 * Un 200 JSON n'est pas forcément un bootstrap exploitable : `{}`,
 * `{ authenticated: true }` ou `{ profile: null, stats: {} }` ne portent
 * aucune donnée et afficheraient des zéros. On exige au moins un champ connu
 * réellement renseigné, sans erreur ni invité.
 */
function isUsableBootstrap(payload: unknown): payload is BootstrapOverlayData {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return false;
  const record = payload as Record<string, unknown>;
  if (record.error) return false;
  if (record.authenticated === false) return false;
  return OVERLAY_DATA_KEYS.some((key) => hasMeaningfulValue(record[key]));
}

export function CompteOverlayHost({ onChanged }: { onChanged?: () => void }) {
  const [stack, setStack] = useState<Entry[]>([]);
  const [bootstrap, setBootstrap] = useState<BootstrapOverlayData | null>(null);
  const [bootstrapError, setBootstrapError] = useState(false);

  const stackLengthRef = useRef(0);
  stackLengthRef.current = stack.length;

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
      const base = current.filter((entry) => entry.key !== key && !entry.key.startsWith(`${key}:`));
      const next = [...base, { key, overlay }];
      stackLengthRef.current = next.length;
      return next;
    });
  }, []);

  const pop = useCallback(() => {
    setStack((current) => {
      const next = current.slice(0, -1);
      stackLengthRef.current = next.length;
      return next;
    });
  }, []);

  const handleHardwareBackButton = useCallback(
    (info?: { canGoBack?: boolean }): boolean => {
      if (stackLengthRef.current > 0) {
        pop();
        return true;
      }
      if (info && info.canGoBack !== false && typeof window !== 'undefined') {
        window.history.back();
      }
      return false;
    },
    [pop]
  );

  useEffect(() => {
    const api = {
      openPost: (postId: string, options?: { pane?: 'post' | 'comments' | 'share'; commentId?: string | null }) =>
        push({ kind: 'post', postId, pane: options?.pane ?? 'post', commentId: options?.commentId ?? null }),
      openSaved: () => push({ kind: 'saved' }),
      openBadge: (badgeId: string) => push({ kind: 'badge', badgeId }),
      openGear: (gearId: string) => push({ kind: 'gear', gearId }),
      openSeal: () => push({ kind: 'seal' }),
      openTrust: () => push({ kind: 'trust' }),
      openProfile: (userId: string) => push({ kind: 'profile', userId }),
      openCreate: (type?: string) => push({ kind: 'create', type }),
      openEffortWhy: () => push({ kind: 'effort-why' }),
      openEffortGroup: () => push({ kind: 'effort-group' }),
      openEffortFatigue: () => push({ kind: 'effort-fatigue' }),
      openEffortPrivacy: () => push({ kind: 'effort-privacy' }),
      openEffortExpert: () => push({ kind: 'effort-expert' }),
      openEffortSubDrawer: (kind: EffortSubDrawerKind) => push({ kind }),
      handleBackButton: handleHardwareBackButton,
      close: pop,
      closeAll: () => {
        stackLengthRef.current = 0;
        setStack([]);
      },
    };
    (window as any).__lkdvCompteOverlay = api;
    (window as any).__lkdvOpenPost = api.openPost;
    (window as any).__lkdvOpenSaved = api.openSaved;
    (window as any).__lkdvOpenBadge = api.openBadge;
    (window as any).__lkdvOpenGear = api.openGear;
    (window as any).__lkdvOpenSeal = api.openSeal;
    (window as any).__lkdvOpenTrust = api.openTrust;
    (window as any).__lkdvOpenCreate = api.openCreate;
    (window as any).__lkdvOpenEffortWhy = api.openEffortWhy;
    (window as any).__lkdvOpenEffortGroup = api.openEffortGroup;
    (window as any).__lkdvOpenEffortFatigue = api.openEffortFatigue;
    (window as any).__lkdvOpenEffortPrivacy = api.openEffortPrivacy;
    (window as any).__lkdvOpenEffortExpert = api.openEffortExpert;
    (window as any).__lkdvOpenEffortSubDrawer = api.openEffortSubDrawer;

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
        delete (window as any).__lkdvOpenEffortWhy;
        delete (window as any).__lkdvOpenEffortGroup;
        delete (window as any).__lkdvOpenEffortFatigue;
        delete (window as any).__lkdvOpenEffortPrivacy;
        delete (window as any).__lkdvOpenEffortExpert;
        delete (window as any).__lkdvOpenEffortSubDrawer;
      }
    };
  }, [handleHardwareBackButton, pop, push]);

  // Listener Capacitor Android App.addListener('backButton') + événement DOM testable :
  // dépile l'overlay actif (close()) lorsque stack.length > 0 avant tout history.back().
  useEffect(() => {
    if (typeof window === 'undefined') return;
    let removed = false;
    let listenerHandle: { remove?: () => void | Promise<void> } | null = null;

    const capacitorApp = (window as any).Capacitor?.Plugins?.App;
    if (capacitorApp && typeof capacitorApp.addListener === 'function') {
      try {
        const maybePromise = capacitorApp.addListener(
          'backButton',
          (info?: { canGoBack?: boolean }) => {
            handleHardwareBackButton(info ?? { canGoBack: true });
          }
        );
        if (maybePromise && typeof maybePromise.then === 'function') {
          void maybePromise.then((handle: { remove?: () => void }) => {
            if (removed) {
              void handle?.remove?.();
            } else {
              listenerHandle = handle;
            }
          });
        } else if (maybePromise && typeof maybePromise === 'object') {
          listenerHandle = maybePromise as { remove?: () => void };
        }
      } catch {
        // Environnement web sans plugin natif Capacitor App.
      }
    }

    const onDomBackButton = (event: Event) => {
      if (stackLengthRef.current > 0) {
        event.preventDefault();
        event.stopPropagation();
        pop();
      }
    };

    window.addEventListener('lkdv:backButton', onDomBackButton);
    document.addEventListener('backbutton', onDomBackButton);

    return () => {
      removed = true;
      void listenerHandle?.remove?.();
      window.removeEventListener('lkdv:backButton', onDomBackButton);
      document.removeEventListener('backbutton', onDomBackButton);
    };
  }, [handleHardwareBackButton, pop]);

  const top = stack[stack.length - 1];
  const needsBootstrap = Boolean(top && BOOTSTRAP_OVERLAY_KINDS.has(top.overlay.kind));

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
      .catch(() => {
        if (!cancelled) setBootstrapError(true);
      });
    return () => {
      cancelled = true;
    };
  }, [bootstrap, bootstrapError, needsBootstrap]);

  if (!top) return null;
  const overlay = top.overlay;

  if (overlay.kind === 'post') {
    return (
      <PostDrawer
        postId={overlay.postId}
        initialPane={overlay.pane}
        initialCommentId={overlay.commentId}
        onClose={pop}
        onOpenProfile={(userId) => push({ kind: 'profile', userId })}
        onDeleted={() => {
          handleChanged();
          pop();
        }}
      />
    );
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
  if (overlay.kind === 'seal') {
    return (
      <SealDrawer
        data={bootstrap}
        onClose={pop}
        onOpenSubDrawer={(kind) => push({ kind })}
        onRetryEffort={invalidate}
      />
    );
  }
  if (overlay.kind === 'trust') {
    return <TrustDetailSheet data={bootstrap} trustScore={bootstrap.profile?.trustScore} onClose={pop} />;
  }

  const sealUnavailable = bootstrap.sealUnavailable === true;
  const lastOuting = sealUnavailable ? null : bootstrap.lastOutingEffort ?? null;
  const nextOuting = sealUnavailable ? null : bootstrap.nextPlannedOutingEffort ?? null;
  const effortState = bootstrap.effortState ?? 'ready';

  if (overlay.kind === 'effort-why') {
    return (
      <EffortWhyDrawer
        outing={lastOuting ?? nextOuting}
        state={effortState}
        diagnosticId={bootstrap.effortDiagnosticId}
        errorMessage={bootstrap.effortErrorMessage}
        cachedAt={bootstrap.effortCachedAt}
        onRetry={invalidate}
        onClose={pop}
      />
    );
  }
  if (overlay.kind === 'effort-group') {
    return (
      <EffortGroupDrawer
        groupData={sealUnavailable ? null : bootstrap.effortGroupSummary}
        state={effortState}
        diagnosticId={bootstrap.effortDiagnosticId}
        errorMessage={bootstrap.effortErrorMessage}
        cachedAt={bootstrap.effortCachedAt}
        onRetry={invalidate}
        onClose={pop}
      />
    );
  }
  if (overlay.kind === 'effort-fatigue') {
    return (
      <EffortFatigueDrawer
        fatigueData={sealUnavailable ? null : bootstrap.effortFatigueSummary}
        state={effortState}
        diagnosticId={bootstrap.effortDiagnosticId}
        errorMessage={bootstrap.effortErrorMessage}
        cachedAt={bootstrap.effortCachedAt}
        onRetry={invalidate}
        onClose={pop}
      />
    );
  }
  if (overlay.kind === 'effort-privacy') {
    return (
      <EffortPrivacyDrawer
        privacyData={
          sealUnavailable
            ? null
            : bootstrap.effortPrivacySummary ?? {
                dataLevel: lastOuting?.dataLevel ?? null,
                evidence: lastOuting?.evidence ?? [],
                consents: [],
              }
        }
        state={effortState}
        diagnosticId={bootstrap.effortDiagnosticId}
        errorMessage={bootstrap.effortErrorMessage}
        cachedAt={bootstrap.effortCachedAt}
        onRetry={invalidate}
        onClose={pop}
      />
    );
  }
  if (overlay.kind === 'effort-expert') {
    return (
      <EffortExpertDrawer
        expertData={
          sealUnavailable
            ? null
            : bootstrap.effortExpertSummary ??
              (lastOuting
                ? {
                    scoreVersion: lastOuting.scoreVersion || 'effort-score-v1',
                    snapshotHash: lastOuting.snapshotHash ?? null,
                    iea: lastOuting.iea ?? null,
                    erp: lastOuting.erp ?? null,
                    eFlatKm: lastOuting.eFlatKm ?? null,
                    rawDose: lastOuting.rawDose ?? null,
                    multipliers: lastOuting.multipliers ?? null,
                    ablations: [],
                    rawSegments: [],
                  }
                : null)
        }
        state={effortState}
        diagnosticId={bootstrap.effortDiagnosticId}
        errorMessage={bootstrap.effortErrorMessage}
        cachedAt={bootstrap.effortCachedAt}
        onRetry={invalidate}
        onClose={pop}
      />
    );
  }

  return null;
}

export default CompteOverlayHost;
