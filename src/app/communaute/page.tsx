'use client';

import React, { Suspense, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import {
  CommunityStoriesBar,
  type CommunityStoriesBarHandle,
} from '@/components/communaute/CommunityStoriesBar';
import { AccountBottomBar } from '@/components/account/AccountBottomBar';
import { AccountCreateSheet } from '@/components/account/AccountCreateSheet';
import { CommunityFeedShell } from '@/features/community/feed/CommunityFeedShell';
import { CommunityFeedTopBar } from '@/features/community/feed/CommunityFeedTopBar';
import { CommunityFeed } from '@/features/community/feed/CommunityFeed';

function CommunauteFeedContent() {
  const { user } = useAuth();
  const searchParams = useSearchParams();
  const [createOpen, setCreateOpen] = useState(false);
  const storiesRef = useRef<CommunityStoriesBarHandle>(null);

  const initialPostId = searchParams?.get('post') ?? null;
  const initialCommentId = searchParams?.get('comment') ?? null;

  return (
    <>
      <h1 className="sr-only">Communauté — Le Kit du Voyageur</h1>

      <CommunityFeedShell
        topBar={<CommunityFeedTopBar user={user} onCreate={() => setCreateOpen(true)} />}
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
        />
      </CommunityFeedShell>

      <AccountCreateSheet
        open={createOpen}
        onOpenChange={setCreateOpen}
        onStory={() => storiesRef.current?.openPicker()}
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
