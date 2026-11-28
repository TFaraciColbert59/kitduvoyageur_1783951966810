'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import type { User } from '@supabase/supabase-js';
import { Camera, PenLine } from 'lucide-react';
import { useRouter } from 'next/navigation';
import '@/features/community/v2/create/create-v2.css';
import { CommunitySheetShell } from '@/features/community/v2/shared/CommunitySheetShell';
import { SheetPreviewContext } from '@/features/community/v2/shared/SheetPreview';
import {
  CreateSheetContext,
  type CreateDetailRequest,
  type CreateSheetContextValue,
} from '@/features/community/v2/create/CreateSheetContext';
import type { CreateNavV2 } from '@/features/community/v2/create/engine/nav';
import { stepAriaLabel } from '@/features/community/v2/create/engine/steps';
import type { CreateKindV2 } from '@/features/community/v2/create/engine/createSchemasV2';
import { createClient } from '@/lib/supabase/client';
import type { FeedPost } from '@/features/community/feed/useCommunityFeed';

const PostFormV2 = dynamic(
  () => import('@/features/community/v2/create/forms/PostFormV2').then((m) => ({ default: m.PostFormV2 })),
  { ssr: false, loading: () => <div className="lkdv-cv2c-form-loading" aria-busy="true" /> },
);
const StoryFormV2 = dynamic(
  () => import('@/features/community/v2/create/forms/StoryFormV2').then((m) => ({ default: m.StoryFormV2 })),
  { ssr: false, loading: () => <div className="lkdv-cv2c-form-loading" aria-busy="true" /> },
);
const PostSharePanel = dynamic(
  () => import('@/features/community/feed/PostSharePanel').then((m) => ({ default: m.PostSharePanel })),
  { ssr: false },
);

export type HubSocialAction =
  | { kind: 'post'; prefill?: Record<string, unknown> }
  | { kind: 'story'; prefill?: Record<string, unknown> }
  | { kind: 'share'; title: string; subtitle?: string | null; permalink: string; entityId: string };

const CREATE_TABS = [
  { id: 'post' as const, label: 'Post', icon: <PenLine size={20} aria-hidden="true" /> },
  { id: 'story' as const, label: 'Story', icon: <Camera size={20} aria-hidden="true" /> },
];

export function HubSocialBridge({
  action,
  onClose,
}: {
  action: HubSocialAction;
  onClose: () => void;
}) {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [tabIndex, setTabIndex] = useState(() => (action.kind === 'story' ? 1 : 0));
  const [navs, setNavs] = useState<Map<CreateKindV2, CreateNavV2>>(() => new Map());
  const [detail, setDetail] = useState<CreateDetailRequest | null>(null);
  const [previewSlot, setPreviewSlot] = useState<HTMLDivElement | null>(null);
  const stepHostsRef = useRef<Array<HTMLDivElement | null>>([]);
  const [, bumpHosts] = useState(0);

  useEffect(() => {
    let active = true;
    const supabase = createClient();
    void supabase.auth.getUser().then(({ data }) => {
      if (active) setUser(data.user ?? null);
    });
    return () => {
      active = false;
    };
  }, []);

  const activeTab = CREATE_TABS[tabIndex]?.id ?? 'post';

  const onNavChange = useCallback((kind: CreateKindV2, nav: CreateNavV2) => {
    setNavs((prev) => {
      const next = new Map(prev);
      next.set(kind, nav);
      return next;
    });
  }, []);

  const onPostNavChange = useCallback((nav: CreateNavV2) => onNavChange('post', nav), [onNavChange]);
  const onStoryNavChange = useCallback((nav: CreateNavV2) => onNavChange('story', nav), [onNavChange]);

  const contextValue = useMemo<CreateSheetContextValue>(
    () => ({
      user,
      requireAuth: () => router.push('/connexion?next=/hub'),
      reportCreated: () => {
        onClose();
      },
      openDetail: (req) => setDetail(req),
      closeDetail: () => setDetail(null),
      requestCreate: (kind) => {
        if (kind === 'story') setTabIndex(1);
        else if (kind === 'post') setTabIndex(0);
      },
    }),
    [user, router, onClose],
  );

  const activeNav = navs.get(activeTab);

  const registerStepHost = useCallback((index: number, el: HTMLDivElement | null) => {
    if (stepHostsRef.current[index] !== el) {
      stepHostsRef.current[index] = el;
      bumpHosts((n) => n + 1);
    }
  }, []);

  if (action.kind === 'share') {
    const sharePost = {
      id: action.entityId,
      content: [action.title, action.subtitle].filter(Boolean).join(' · '),
      author_id: user?.id ?? '',
      created_at: new Date().toISOString(),
    } as FeedPost;

    return (
      <PostSharePanel
        post={sharePost}
        user={user}
        permalinkOverride={action.permalink}
        onClose={onClose}
        onRequireAuth={() => router.push('/connexion?next=/hub')}
      />
    );
  }

  const stepCount = activeNav?.steps.length ?? 1;
  const mini = activeNav && stepCount > 1
    ? {
        items: activeNav.steps.map((s) => ({ id: s.id, label: s.label })),
        active: activeNav.stepIndex,
        onChange: activeNav.goToStep,
        ariaLabel: stepAriaLabel(activeTab),
        pages: activeNav.steps.map((s, idx) => (
          <div key={`${activeTab}-${s.id}`} ref={(el) => registerStepHost(idx, el)} />
        )),
      }
    : null;

  const footer = activeNav?.footer ?? null;
  const sheetDetail = detail
    ? {
        pages: [detail.node],
        index: 0,
        title: detail.title,
        meta: detail.meta,
        onBack: () => setDetail(null),
      }
    : null;

  return (
    <CreateSheetContext.Provider value={contextValue}>
      <SheetPreviewContext.Provider value={previewSlot}>
        <CommunitySheetShell
          open
          onClose={onClose}
          kind="create"
          guestNotice={!user?.id || user.is_anonymous === true}
          label={activeTab === 'story' ? 'Créer une Story' : 'Publier depuis le Hub'}
          capsule={{
            items: CREATE_TABS.map((t) => ({ id: t.id, label: t.label, icon: t.icon })),
            active: tabIndex,
            onChange: setTabIndex,
            ariaLabel: 'Format de publication',
          }}
          mini={detail ? null : mini}
          footer={detail ? null : footer}
          panes={CREATE_TABS.map((t) => (
            <div key={t.id} ref={t.id === activeTab && !mini ? (el) => registerStepHost(0, el) : undefined} />
          ))}
          detail={sheetDetail}
          resetKey={activeTab}
          previewSlotRef={setPreviewSlot}
        >
          {activeTab === 'post' ? (
            <div className="lkdv-cv2c-form-mount" data-kind="post">
              <PostFormV2
                active
                prefill={action.prefill ?? null}
                prefillNonce={1}
                onNavChange={onPostNavChange}
                stepHosts={stepHostsRef.current}
              />
            </div>
          ) : (
            <div className="lkdv-cv2c-form-mount" data-kind="story">
              <StoryFormV2
                active
                prefill={action.prefill ?? null}
                prefillNonce={1}
                onNavChange={onStoryNavChange}
                stepHosts={stepHostsRef.current}
              />
            </div>
          )}
        </CommunitySheetShell>
      </SheetPreviewContext.Provider>
    </CreateSheetContext.Provider>
  );
}
