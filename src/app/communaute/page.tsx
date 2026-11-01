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
import type { SectionTabId } from '@/features/community/sections/CommunityTabSelector';

// Les deux tiroirs (formulaires de création + sections) ne s'affichent qu'à l'ouverture :
// ils sont hors du JS initial de la page, montés à la première ouverture et préchargés au repos.
// Fermés, ils ne rendaient déjà rien (`open` faux -> `null`) : aucun changement visuel.
const loadCreateDrawer = () =>
  import('@/features/community/create/CreateDrawer').then((m) => ({ default: m.CreateDrawer }));
const loadSectionsDrawer = () =>
  import('@/features/community/sections/CommunitySectionsDrawer').then((m) => ({
    default: m.CommunitySectionsDrawer,
  }));
const CreateDrawer = dynamic(loadCreateDrawer, { ssr: false });
const CommunitySectionsDrawer = dynamic(loadSectionsDrawer, { ssr: false });

function CommunauteFeedContent() {
  const { user } = useAuth();
  const { toast } = useToast();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [createOpen, setCreateOpen] = useState(false);
  const [feedRefreshKey, setFeedRefreshKey] = useState(0);
  const [storiesRefreshKey, setStoriesRefreshKey] = useState(0);
  const [sectionsOpen, setSectionsOpen] = useState(false);
  const [sectionsTab, setSectionsTab] = useState<SectionTabId>('carnets');
  const [sectionsSearch, setSectionsSearch] = useState(false);
  // Un tiroir est monté dès sa première ouverture, puis reste monté (fermeture animée, état conservé).
  const [createMounted, setCreateMounted] = useState(false);
  const [sectionsMounted, setSectionsMounted] = useState(false);

  useEffect(() => {
    if (createOpen) setCreateMounted(true);
  }, [createOpen]);
  useEffect(() => {
    if (sectionsOpen) setSectionsMounted(true);
  }, [sectionsOpen]);

  // Préchargement au repos : la première ouverture n'attend pas le réseau.
  useEffect(() => {
    const prefetch = () => {
      void loadCreateDrawer().catch(() => {});
      void loadSectionsDrawer().catch(() => {});
    };
    if (typeof window.requestIdleCallback === 'function') {
      const id = window.requestIdleCallback(prefetch, { timeout: 5000 });
      return () => window.cancelIdleCallback(id);
    }
    const id = window.setTimeout(prefetch, 3000);
    return () => window.clearTimeout(id);
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

  return (
    <>
      <h1 className="sr-only">Communauté — Le Kit du Voyageur</h1>

      <CommunityFeedShell
        topBar={
          <CommunityFeedTopBar
            user={user}
            onCreate={() => {
              if (!user?.id || user.is_anonymous) {
                requireAuth();
                return;
              }
              setCreateOpen(true);
            }}
            onOpenSection={(id) => {
              setSectionsTab(id);
              setSectionsSearch(false);
              setSectionsOpen(true);
            }}
            onSearch={() => {
              setSectionsSearch(true);
              setSectionsOpen(true);
            }}
          />
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

      {(createOpen || createMounted) && (
        <CreateDrawer open={createOpen} onClose={() => setCreateOpen(false)} user={user} onCreated={handleCreated} />
      )}

      {(sectionsOpen || sectionsMounted) && (
        <CommunitySectionsDrawer
          open={sectionsOpen}
          initialTab={sectionsTab}
          initialSearch={sectionsSearch}
          user={user}
          onClose={() => {
            setSectionsOpen(false);
            setSectionsSearch(false);
          }}
          onRequireAuth={requireAuth}
        />
      )}
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
