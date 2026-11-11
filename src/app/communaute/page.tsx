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
import type { CreateKindV2 } from '@/features/community/v2/shared/types';
import type { SectionTabId } from '@/features/community/sections/CommunityTabSelector';
// Feuilles du chantier Communauté v2 (coque + contenu) : importées au niveau de
// la page, seules surfaces qui les utilisent (chargées avec la route).
import '@/styles/communaute-v2.css';
import '@/styles/communaute-v2-shell.css';

// Les deux tiroirs (Explorer + Création) ne s'affichent qu'à l'ouverture : ils sont
// hors du JS initial de la page, montés à la première ouverture et préchargés au repos.
// Les tiroirs v1 (CreateDrawer / CommunitySectionsDrawer) ont été retirés : la V2 est
// désormais la seule surface de la Communauté (suites : migrations prod, J-08).
const loadCreateSheetV2 = () =>
  import('@/features/community/v2/create/CreateSheetV2').then((m) => ({
    default: m.CreateSheetV2,
  }));
const loadExploreSheetV2 = () =>
  import('@/features/community/v2/explore/CommunityExploreSheetV2').then((m) => ({
    default: m.CommunityExploreSheetV2,
  }));
const CreateSheetV2 = dynamic(loadCreateSheetV2, { ssr: false });
const CommunityExploreSheetV2 = dynamic(loadExploreSheetV2, { ssr: false });

function CommunauteFeedContent() {
  const { user } = useAuth();
  const { toast } = useToast();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [createOpen, setCreateOpen] = useState(false);
  const [createKind, setCreateKind] = useState<CreateKindV2>('post');
  const [feedRefreshKey, setFeedRefreshKey] = useState(0);
  const [storiesRefreshKey, setStoriesRefreshKey] = useState(0);
  const [sectionsOpen, setSectionsOpen] = useState(false);
  const [sectionsTab, setSectionsTab] = useState<SectionTabId>('carnets');
  const [sectionsSearch, setSectionsSearch] = useState(false);
  // Un tiroir est monté dès sa première ouverture, puis reste monté (fermeture animée, état conservé).
  const [createMounted, setCreateMounted] = useState(false);
  const [sectionsMounted, setSectionsMounted] = useState(false);
  // Passerelle V2 entre les deux tiroirs : un état vide d'Explorer (« Créer mon
  // premier carnet », « Organiser une sortie », « Créer un club ») ouvre Création
  // sur le bon type, avec un préremplissage éventuel (club, kit, lieu).
  const [createPrefill, setCreatePrefill] = useState<Record<string, unknown> | null>(null);

  useEffect(() => {
    if (createOpen) setCreateMounted(true);
  }, [createOpen]);
  useEffect(() => {
    if (sectionsOpen) setSectionsMounted(true);
  }, [sectionsOpen]);

  // Préchargement au repos : la première ouverture n'attend pas le réseau.
  useEffect(() => {
    const prefetch = () => {
      void loadCreateSheetV2().catch(() => {});
      void loadExploreSheetV2().catch(() => {});
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

  // La V2 affiche sa propre île de confirmation (« … publié(e) » + Voir/Partager)
  // puis ferme le tiroir : la page ne fait que rafraîchir le fil ou les stories.
  const handleCreatedV2 = useCallback((kind: CreateKindV2) => {
    setCreateOpen(false);
    setCreatePrefill(null);
    if (kind === 'story') setStoriesRefreshKey((key) => key + 1);
    else setFeedRefreshKey((key) => key + 1);
  }, []);

  const handleCreateRequestedV2 = useCallback(
    (kind: CreateKindV2, prefill?: Record<string, unknown>) => {
      setCreateKind(kind);
      setCreatePrefill(prefill ?? null);
      setSectionsOpen(false);
      setSectionsSearch(false);
      setCreateOpen(true);
    },
    [],
  );

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
              setCreateKind('post');
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
            onCreateStory={() => {
              if (!user?.id || user.is_anonymous) {
                requireAuth();
                return;
              }
              setCreateKind('story');
              setCreateOpen(true);
            }}
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
        <CreateSheetV2
          open={createOpen}
          initialKind={createKind}
          onClose={() => setCreateOpen(false)}
          user={user}
          onCreated={handleCreatedV2}
          onRequireAuth={requireAuth}
          initialPrefill={createPrefill}
          onCreateRequested={handleCreateRequestedV2}
        />
      )}

      {(sectionsOpen || sectionsMounted) && (
        <CommunityExploreSheetV2
          open={sectionsOpen}
          initialTab={sectionsTab}
          initialSearch={sectionsSearch}
          user={user}
          onClose={() => {
            setSectionsOpen(false);
            setSectionsSearch(false);
          }}
          onRequireAuth={requireAuth}
          onCreateRequested={handleCreateRequestedV2}
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
