'use client';

import React, { Suspense, useCallback, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import {
  CommunityStoriesBar,
  type CommunityStoriesBarHandle,
} from '@/components/communaute/CommunityStoriesBar';
import { AccountBottomBar } from '@/components/account/AccountBottomBar';
import { CommunityFeedShell } from '@/features/community/feed/CommunityFeedShell';
import { CommunityFeedTopBar } from '@/features/community/feed/CommunityFeedTopBar';
import { CommunityFeed } from '@/features/community/feed/CommunityFeed';
import { CommunityCreateDrawer } from '@/features/community/feed/CommunityCreateDrawer';
import { CommunitySectionsDrawer } from '@/features/community/sections/CommunitySectionsDrawer';
import type { SectionTabId } from '@/features/community/sections/CommunityTabSelector';

function CommunauteFeedContent() {
  const { user } = useAuth();
  const { toast } = useToast();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [createOpen, setCreateOpen] = useState(false);
  const [sectionsOpen, setSectionsOpen] = useState(false);
  const [sectionsTab, setSectionsTab] = useState<Exclude<SectionTabId, 'pour-toi'>>('carnets');
  const [sectionsSearch, setSectionsSearch] = useState(false);
  const storiesRef = useRef<CommunityStoriesBarHandle>(null);

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

  const openStoryPicker = useCallback(() => {
    if (!user?.id || user.is_anonymous) {
      requireAuth();
      return;
    }
    storiesRef.current?.openPicker();
  }, [requireAuth, user?.id, user?.is_anonymous]);

  return (
    <>
      <h1 className="sr-only">Communauté — Le Kit du Voyageur</h1>

      <CommunityFeedShell
        topBar={
          <CommunityFeedTopBar
            user={user}
            onCreate={() => setCreateOpen(true)}
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
            ref={storiesRef}
            currentUser={user}
            showHeading={false}
          />
        }
        bottomBar={<AccountBottomBar />}
      >
        <CommunityFeed
          user={user}
          userId={user?.id}
          initialPostId={initialPostId}
          initialCommentId={initialCommentId}
          onRequireAuth={requireAuth}
        />
      </CommunityFeedShell>

      <CommunityCreateDrawer
        open={createOpen}
        onOpenChange={setCreateOpen}
        onStory={openStoryPicker}
      />

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
