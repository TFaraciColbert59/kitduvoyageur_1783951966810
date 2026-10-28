'use client';

import React, { Suspense, useCallback, useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { CommunityStoriesBar } from '@/components/communaute/CommunityStoriesBar';
import { CommunityFeedShell } from '@/features/community/feed/CommunityFeedShell';
import { CommunityFeedTopBar } from '@/features/community/feed/CommunityFeedTopBar';
import { CommunityFeed } from '@/features/community/feed/CommunityFeed';
import type { CreateKind } from '@/features/community/create/CreateDrawer';
import type { ProposeKind } from '@/features/community/explore/ExplorerDrawer';
import '@/styles/community-card.css';
import type { SectionTabId } from '@/features/community/sections/sectionTabs';

// Les deux drawers ne servent qu'au clic : hors du JS initial du fil. Leurs morceaux sont préchargés
// quand le navigateur est au repos et au premier appui sur un bouton du haut, avant le clic.
const loadCreateDrawer = () => import('@/features/community/create/CreateDrawer');
const loadExplorerDrawer = () => import('@/features/community/explore/ExplorerDrawer');
const CreateDrawer = dynamic(loadCreateDrawer, { ssr: false });
const ExplorerDrawer = dynamic(loadExplorerDrawer, { ssr: false });

function prefetchDrawers() {
  void loadCreateDrawer();
  void loadExplorerDrawer();
}

function CommunauteFeedContent() {
  const { user } = useAuth();
  const { toast } = useToast();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [createOpen, setCreateOpen] = useState(false);
  // Monté au premier usage puis conservé : le brouillon et la position dans les volets survivent à la fermeture.
  const [createMounted, setCreateMounted] = useState(false);
  const [sectionsMounted, setSectionsMounted] = useState(false);
  const [createKind, setCreateKind] = useState<CreateKind>('post');
  const [feedRefreshKey, setFeedRefreshKey] = useState(0);
  const [storiesRefreshKey, setStoriesRefreshKey] = useState(0);
  const [sectionsOpen, setSectionsOpen] = useState(false);
  const [sectionsTab, setSectionsTab] = useState<SectionTabId>('carnets');
  const [sectionsSearch, setSectionsSearch] = useState(false);

  useEffect(() => {
    const idle = (window as Window & { requestIdleCallback?: (cb: () => void, options?: { timeout: number }) => number }).requestIdleCallback;
    if (idle) {
      const handle = idle(prefetchDrawers, { timeout: 4000 });
      return () => (window as Window & { cancelIdleCallback?: (h: number) => void }).cancelIdleCallback?.(handle);
    }
    const timer = window.setTimeout(prefetchDrawers, 2500);
    return () => window.clearTimeout(timer);
  }, []);

  const initialPostId = searchParams?.get('post') ?? null;
  const initialCommentId = searchParams?.get('comment') ?? null;

  const requireAuth = useCallback(() => {
    const anonymous = Boolean(user?.id && user.is_anonymous);
    toast(
      anonymous
        ? 'Créez un compte pour enregistrer, commenter ou publier.'
        : 'Connectez-vous pour continuer.',
      'info',
    );
    router.push(anonymous ? '/inscription?next=/communaute' : '/connexion?next=/communaute');
  }, [router, toast, user?.id, user?.is_anonymous]);

  const handleCreated = useCallback((kind: CreateKind) => {
    setCreateOpen(false);
    if (kind === 'story') setStoriesRefreshKey((key) => key + 1);
    else setFeedRefreshKey((key) => key + 1);
    toast('Création publiée.', 'success');
  }, [toast]);

  const proposeCreate = useCallback(
    (kind: ProposeKind) => {
      if (!user?.id || user.is_anonymous) {
        requireAuth();
        return;
      }
      setSectionsOpen(false);
      setSectionsSearch(false);
      setCreateKind(kind);
      setCreateMounted(true);
      setCreateOpen(true);
    },
    [requireAuth, user?.id, user?.is_anonymous],
  );

  return (
    <>
      <h1 className="sr-only">Communauté — Le Kit du Voyageur</h1>

      <CommunityFeedShell
        topBar={
          <CommunityFeedTopBar
            user={user}
            onPrefetch={prefetchDrawers}
            onCreate={() => {
              if (!user?.id || user.is_anonymous) {
                requireAuth();
                return;
              }
              setSectionsOpen(false);
              setCreateKind('post');
              setCreateMounted(true);
              setCreateOpen(true);
            }}
            onOpenSection={(id) => {
              setCreateOpen(false);
              setSectionsTab(id);
              setSectionsSearch(false);
              setSectionsMounted(true);
              setSectionsOpen(true);
            }}
            onSearch={() => {
              setCreateOpen(false);
              setSectionsSearch(true);
              setSectionsMounted(true);
              setSectionsOpen(true);
            }}
          />
        }
        drawerOpen={createOpen || sectionsOpen}
        drawer={
          <>
            {createMounted ? (
              <CreateDrawer open={createOpen} onClose={() => setCreateOpen(false)} user={user} onCreated={handleCreated} initialKind={createKind} />
            ) : null}
            {sectionsMounted ? (
            <ExplorerDrawer
              open={sectionsOpen}
              initialTab={sectionsTab}
              initialSearch={sectionsSearch}
              user={user}
              onClose={() => {
                setSectionsOpen(false);
                setSectionsSearch(false);
              }}
              onRequireAuth={requireAuth}
              onPropose={proposeCreate}
            />
            ) : null}
          </>
        }
        stories={
          <CommunityStoriesBar
            key={storiesRefreshKey}
            currentUser={user}
            showHeading={false}
          />
        }
      >
        <CommunityFeed
          user={user}
          userId={user?.id}
          initialPostId={initialPostId}
          initialCommentId={initialCommentId}
          onRequireAuth={requireAuth}
          refreshKey={feedRefreshKey}
        />
      </CommunityFeedShell>
    </>
  );
}

export default function CommunautePage() {
  return (
    <Suspense
      fallback={
        <div className="lkdv-feed-shell lkdv-account-glass">
          <div className="lkdv-feed-column">
            <div className="lkdv-feed-header" />
            <div className="lkdv-feed-skeleton" aria-hidden="true" />
          </div>
        </div>
      }
    >
      <CommunauteFeedContent />
    </Suspense>
  );
}
