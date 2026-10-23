'use client';

import React, { useState, useEffect, useCallback, useMemo, useRef, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { createClient } from '@/lib/supabase/client';
import { fetchPublicProfilesWith } from '@/lib/queries/publicProfilesCore';
import { CommunityHubTab } from '@/components/social/CommunityHubNav';
import AppShell from '@/components/shell/AppShell';
import MobileCommunityHub from '@/components/communaute/MobileCommunityHub';
import MobileCommunityHeader from '@/components/communaute/MobileCommunityHeader';
import { CommunityShell } from '@/components/communaute/shell/CommunityShell';
import { CommunityHeroCard } from '@/components/communaute/shell/CommunityHeroCard';
import { CommunityContextDrawer } from '@/components/communaute/shell/CommunityContextDrawer';
import { useCommunityTotals } from '@/features/community/useCommunityTotals';
import { LoadingState } from '@/components/ui';

const POSTS_PAGE_SIZE = 20;
const HUB_TABS: CommunityHubTab[] = ['fil', 'carnets', 'clubs', 'groupes', 'evenements', 'entraide'];

function formatEventDate(value?: string | null): string {
  if (!value) return '';
  const [y, m, d] = value.split('-').map(Number);
  if (!y || !m || !d) return value;
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

function CommunautePageContent() {
  const { user } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const totals = useCommunityTotals();

  const paramTab = searchParams?.get('tab') || 'fil';
  const initialTab = (HUB_TABS.includes(paramTab as CommunityHubTab) ? paramTab : 'fil') as CommunityHubTab;

  const [activeTab, setActiveTab] = useState<CommunityHubTab>(initialTab);

  useEffect(() => {
    const t = searchParams?.get('tab');
    if (t && HUB_TABS.includes(t as CommunityHubTab)) setActiveTab(t as CommunityHubTab);
  }, [searchParams]);

  useEffect(() => {
    if (searchParams?.get('tab') === 'entraide') router.replace('/entraide');
  }, [searchParams, router]);

  const handleTabSelect = useCallback(
    (tab: CommunityHubTab) => {
      setActiveTab(tab);
      if (tab === 'carnets') router.push('/carnets');
      else if (tab === 'clubs') router.push('/clubs');
      else if (tab === 'groupes') router.push('/groupes');
      else if (tab === 'entraide') router.push('/entraide');
      else router.push(`/communaute?tab=${tab}`);
    },
    [router],
  );

  const [posts, setPosts] = useState<any[]>([]);
  const [carnets, setCarnets] = useState<any[]>([]);
  const [clubs, setClubs] = useState<any[]>([]);
  const [groups, setGroups] = useState<any[]>([]);
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [postsLimit, setPostsLimit] = useState(POSTS_PAGE_SIZE);
  const [hasMorePosts, setHasMorePosts] = useState(false);
  const [sectionErrors, setSectionErrors] = useState<Record<string, string>>({});
  const [joinedEventIds, setJoinedEventIds] = useState<Record<string, boolean>>({});
  const [contextOpen, setContextOpen] = useState(false);

  const heroMassifs = useMemo(() => {
    const set = new Set<string>();
    for (const carnet of carnets) if (carnet?.destination) set.add(String(carnet.destination));
    for (const group of groups) if (group?.massif) set.add(String(group.massif));
    return Array.from(set).slice(0, 8);
  }, [carnets, groups]);

  const memberClubs = useMemo(() => clubs.filter((club) => club?.is_member), [clubs]);
  const nextEvent = events.length > 0 ? events[0] : null;

  const handleJoinEvent = useCallback(
    async (eventId: string | number) => {
      if (!user) {
        router.push('/connexion');
        return;
      }
      const supabase = createClient();
      const { data, error } = await supabase.rpc('join_event', { p_event_id: eventId });
      if (error) {
        console.error('join_event refusé:', error.message);
        return;
      }
      const result = data as {
        registered?: boolean;
        current_participants?: number;
        status?: string;
      } | null;
      setJoinedEventIds((prev) => ({ ...prev, [String(eventId)]: true }));
      if (result && typeof result.current_participants === 'number') {
        setEvents((prev) =>
          prev.map((ev) =>
            String(ev.id) === String(eventId)
              ? {
                  ...ev,
                  current_participants: result.current_participants,
                  participants: result.current_participants,
                  status: result.status ?? ev.status,
                }
              : ev,
          ),
        );
      }
    },
    [user, router],
  );

  const loadedSectionsRef = useRef<Record<string, boolean>>({});

  const fetchData = useCallback(
    async (requested?: string[], limitOverride?: number) => {
      const supabase = createClient();
      const want = (name: string) => !requested || requested.includes(name);
      const limit = limitOverride ?? postsLimit;
      const idle = Promise.resolve({ data: null, error: null });

      try {
        const [postsRes, carnetsRes, clubsRes, groupsRes, eventsRes] = await Promise.allSettled([
          want('posts')
            ? supabase
                .from('community_posts')
                .select('*')
                .order('created_at', { ascending: false })
                .limit(limit)
            : idle,
          want('carnets')
            ? supabase.from('carnets').select('*').order('created_at', { ascending: false }).limit(20)
            : idle,
          want('clubs')
            ? supabase.from('clubs').select('*').order('members_count', { ascending: false }).limit(50)
            : idle,
          want('groups')
            ? supabase
                .from('travel_groups')
                .select('id, name, description, destination, theme, visibility, max_members, cover_url, created_at')
                .order('created_at', { ascending: false })
                .limit(20)
            : idle,
          want('events')
            ? supabase
                .from('events')
                .select('*')
                .neq('status', 'past')
                .gte('event_date', new Date().toISOString().split('T')[0])
                .order('event_date', { ascending: true })
                .limit(20)
            : idle,
        ]);

        const sec = (
          res: PromiseSettledResult<{ data: unknown; error: { message: string } | null }>,
        ): { data: unknown[]; error: string | null } => {
          if (res.status !== 'fulfilled') return { data: [], error: 'réseau indisponible' };
          if (res.value.error) return { data: [], error: res.value.error.message };
          return { data: (res.value.data ?? []) as unknown[], error: null };
        };

        const postsSection = sec(postsRes as PromiseSettledResult<{ data: unknown; error: { message: string } | null }>);
        const carnetsSection = sec(carnetsRes as PromiseSettledResult<{ data: unknown; error: { message: string } | null }>);
        const clubsSection = sec(clubsRes as PromiseSettledResult<{ data: unknown; error: { message: string } | null }>);
        const groupsSection = sec(groupsRes as PromiseSettledResult<{ data: unknown; error: { message: string } | null }>);
        const eventsSection = sec(eventsRes as PromiseSettledResult<{ data: unknown; error: { message: string } | null }>);

        setSectionErrors((prev) => {
          const next = { ...prev };
          const apply = (key: string, err: string | null) => {
            if (!want(key)) return;
            if (err) next[key] = err;
            else delete next[key];
          };
          apply('posts', postsSection.error);
          apply('carnets', carnetsSection.error);
          apply('clubs', clubsSection.error);
          apply('groups', groupsSection.error);
          apply('events', eventsSection.error);
          return next;
        });

        const postsData = want('posts') ? (postsSection.data as any[]) : [];
        const carnetsData = want('carnets') ? (carnetsSection.data as any[]) : [];
        const clubsData = want('clubs') ? (clubsSection.data as any[]) : [];
        const groupsData = want('groups')
          ? (groupsSection.data as any[]).map((g: any) => ({ ...g, massif: g.destination || null }))
          : [];
        const seenEventIds = new Set<string>();
        const eventsData = want('events')
          ? (eventsSection.data as any[]).filter((ev: any) => {
              const key = String(ev.id || `${ev.title}_${ev.event_date}`);
              if (seenEventIds.has(key)) return false;
              seenEventIds.add(key);
              return true;
            })
          : [];

        if (want('posts')) {
          setHasMorePosts(postsData.length >= limit);
          setPostsLimit(limit);
          loadedSectionsRef.current.posts = true;
        }
        if (want('carnets')) loadedSectionsRef.current.carnets = true;
        if (want('groups')) loadedSectionsRef.current.groups = true;
        if (want('events')) loadedSectionsRef.current.events = true;

        let clubsWithMembership: any[] = [];
        if (want('clubs')) {
          const myClubIds = new Set<string>();
          if (user?.id) {
            const { data: membershipRows } = await supabase
              .from('club_members')
              .select('club_id')
              .eq('user_id', user.id)
              .eq('status', 'active');
            for (const row of membershipRows ?? []) {
              if ((row as { club_id?: string }).club_id) myClubIds.add((row as { club_id: string }).club_id);
            }
          }
          clubsWithMembership = clubsData.map((c: any) => ({ ...c, is_member: myClubIds.has(c.id) }));
          loadedSectionsRef.current.clubs = true;
        }

        let postsWithPersonalState = postsData;
        if (want('posts') && user?.id && postsData.length > 0) {
          const postIds = postsData.map((p: any) => p.id).filter(Boolean);
          if (postIds.length > 0) {
            const [likesRes, savesRes] = await Promise.all([
              supabase.from('post_likes').select('post_id').eq('user_id', user.id).in('post_id', postIds),
              supabase.from('post_saves').select('post_id').eq('user_id', user.id).in('post_id', postIds),
            ]);
            const likedIds = new Set((likesRes.data ?? []).map((r: any) => r.post_id));
            const savedIds = new Set((savesRes.data ?? []).map((r: any) => r.post_id));
            postsWithPersonalState = postsData.map((p: any) => ({
              ...p,
              user_liked: likedIds.has(p.id),
              user_saved: savedIds.has(p.id),
            }));
          }
        }

        const authorProfiles = await fetchPublicProfilesWith(supabase, [
          ...postsData.map((p: any) => p.author_id as string),
          ...carnetsData.map((c: any) => c.author_id as string),
          ...eventsData.map((e: any) => e.organizer_id as string),
        ]);
        const withAuthor = <T extends { author_id?: string | null }>(row: T) => {
          const profile = row.author_id ? authorProfiles[row.author_id] : undefined;
          return {
            ...row,
            author: profile
              ? {
                  id: profile.id,
                  full_name: profile.full_name,
                  avatar_url: profile.avatar_url,
                  loyalty_level: profile.loyalty_level,
                }
              : undefined,
          };
        };

        if (want('posts')) setPosts(postsWithPersonalState.map(withAuthor));
        if (want('carnets')) setCarnets(carnetsData.map(withAuthor));
        if (want('clubs')) setClubs(clubsWithMembership);
        if (want('groups')) setGroups(groupsData);
        if (want('events')) {
          setEvents(
            eventsData.map((ev: any) => {
              const organizer = ev.organizer_id ? authorProfiles[ev.organizer_id] : undefined;
              return {
                ...ev,
                date: formatEventDate(ev.event_date),
                participants: ev.current_participants ?? 0,
                maxParticipants: ev.max_participants ?? 0,
                guide: organizer?.full_name || null,
              };
            }),
          );
        }
      } catch (err) {
        console.error('[CommunautePage] Error loading data:', err);
      } finally {
        setLoading(false);
      }
    },
    [user?.id, postsLimit],
  );

  const sectionsForTab = (tab: string): string[] => {
    switch (tab) {
      case 'fil':
        return ['posts', 'carnets', 'clubs', 'groups', 'events'];
      case 'carnets':
        return ['carnets'];
      case 'clubs':
        return ['clubs'];
      case 'groupes':
        return ['groups'];
      case 'evenements':
        return ['events'];
      default:
        return ['posts'];
    }
  };

  const lastLoadUserRef = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (lastLoadUserRef.current !== user?.id) {
      lastLoadUserRef.current = user?.id;
      loadedSectionsRef.current = {};
    }
    const needed = sectionsForTab(activeTab).filter((s) => !loadedSectionsRef.current[s]);
    if (needed.length === 0) return;
    void fetchData(needed);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetchData, activeTab]);

  const loadMorePosts = useCallback(async () => {
    if (loadingMore || !hasMorePosts) return;
    setLoadingMore(true);
    try {
      await fetchData(['posts'], posts.length + POSTS_PAGE_SIZE);
    } finally {
      setLoadingMore(false);
    }
  }, [fetchData, hasMorePosts, loadingMore, posts.length]);

  const [highlightPostId, setHighlightPostId] = useState<string | null>(null);
  const deepLinkedCommentId = searchParams?.get('comment') ?? null;
  useEffect(() => {
    const target = searchParams?.get('post');
    if (!target || loading) return;
    setHighlightPostId(target);
    const timer = window.setTimeout(() => {
      document.querySelector(`#post-${target}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 200);
    return () => window.clearTimeout(timer);
  }, [searchParams, loading]);

  return (
    <div className="lkdv-community-experience relative min-h-screen font-sans text-[color:var(--lkv-text-primary)] selection:bg-[color:var(--lkv-primary)]/10">
      <h1 className="sr-only">Communauté — Le Kit du Voyageur</h1>
      <AppShell videoBackground={false} background="transparent" safeTop={false}>
        <CommunityShell
          className="lkdv-community-hub"
          header={<MobileCommunityHeader />}
          hero={
            <CommunityHeroCard
              user={user}
              totals={totals}
              nextEvent={nextEvent}
              massifs={heroMassifs}
              onPublish={() => router.push('/communaute/publier')}
              onDiscover={() => router.push('/communaute/decouvrir')}
              onOpenContext={() => setContextOpen(true)}
            />
          }
        >
          <MobileCommunityHub
            posts={posts}
            carnets={carnets}
            clubs={clubs}
            groups={groups}
            events={events}
            activeTab={activeTab as any}
            onTabChange={(tab) => handleTabSelect(tab as any)}
            loading={loading}
            user={user}
            onRefresh={fetchData}
            joinedEventIds={joinedEventIds}
            onJoinEvent={handleJoinEvent}
            highlightPostId={highlightPostId}
            focusCommentId={deepLinkedCommentId}
            hasMorePosts={hasMorePosts}
            onLoadMorePosts={loadMorePosts}
            loadingMore={loadingMore}
            sectionError={
              Object.keys(sectionErrors).length > 0
                ? `Sections indisponibles : ${Object.keys(sectionErrors).join(', ')}`
                : null
            }
          />
        </CommunityShell>
      </AppShell>

      <CommunityContextDrawer
        open={contextOpen}
        onOpenChange={setContextOpen}
        massifs={heroMassifs}
        clubs={memberClubs}
      />
    </div>
  );
}

export default function CommunautePage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-[color:var(--glass-bg-medium)]">
          <LoadingState label="Chargement du Hub Communauté..." />
        </div>
      }
    >
      <CommunautePageContent />
    </Suspense>
  );
}
