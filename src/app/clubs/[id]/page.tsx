'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import Header from '@/components/Header';
import MobilePageShell from '@/components/mobile-nav/MobilePageShell';
import Icon from '@/components/ui/AppIcon';
import CompteBackground from '@/components/compte/CompteBackground';
import CommentsSheet, { CommentData } from '@/components/social/CommentsSheet';
import ClubDiscussionCard, { ClubMessage } from '@/components/clubs/ClubDiscussionCard';
import ClubHero from '@/components/clubs/ClubHero';
import ClubVerticalTabs from '@/components/clubs/ClubVerticalTabs';
import ClubFeaturedEventCard from '@/components/clubs/ClubFeaturedEventCard';
import ClubTeamCard from '@/components/clubs/ClubTeamCard';
import ClubAboutCard from '@/components/clubs/ClubAboutCard';
import ClubProCard from '@/components/clubs/ClubProCard';
import MobileClubDetailView from '@/components/clubs/MobileClubDetailView';
import ClubGroupsTab from '@/components/clubs/ClubGroupsTab';
import { createClient } from '@/lib/supabase/client';
import { fetchPublicProfilesWith } from '@/lib/queries/publicProfilesCore';
import { useAuth } from '@/contexts/AuthContext';
import { useHapticFeedback } from '@/hooks/useHapticFeedback';
import { setActiveAdventureAction } from '@/features/hub/context/activeAdventureServer';
import { hubSectionHref } from '@/features/hub/registry/hubSectionRegistry';
import { createGroupFromClub } from '@/features/tribu/actions/createGroupFromClub';
import { Badge, Button, Card, EmptyState, ErrorState, IconButton, LoadingState, Modal, Skeleton } from '@/components/ui';

interface Club {
  id: string;
  slug: string;
  name: string;
  type: 'activité' | 'pays';
  emoji: string;
  description: string;
  cover_color: string;
  cover_image?: string;
  category: string;
  rules: string;
  privacy: 'open' | 'closed' | 'secret';
  members_count: number;
  active_this_month: number;
  is_verified: boolean;
  created_by: string;
  created_at?: string;
  location?: string;
}

interface ClubTopic {
  id: string;
  title: string;
  content: string;
  is_pinned: boolean;
  is_announcement: boolean;
  likes_count: number;
  replies_count: number;
  created_at: string;
  author?: { full_name: string, avatar_url?: string };
  image_url?: string;
}

interface ClubMember {
  id: string;
  user_id: string;
  role: 'admin' | 'moderator' | 'member';
  joined_at: string;
  user?: { full_name: string; trust_score: number; avatar_url?: string };
}

interface ClubEvent {
  id: string;
  title: string;
  description: string;
  event_date: string | null;
  location: string;
  max_participants: number;
  participants_count: number;
  is_featured?: boolean;
}

const FIELD_CLASS =
  'w-full rounded-[var(--lkv-radius-md)] border border-[color:var(--lkv-border)] bg-[color:var(--lkv-field-bg)] px-[var(--space-3)] py-[var(--space-2)] text-[length:var(--lkv-text-caption)] text-[color:var(--lkv-text-primary)] placeholder:text-[color:var(--lkv-text-muted)] focus:outline-none focus:ring-2 focus:ring-[color:var(--lkv-focus-ring)]';

export default function ClubDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { triggerHaptic } = useHapticFeedback();
  const clubId = params?.id as string;
  const [club, setClub] = useState<Club | null>(null);
  const [topics, setTopics] = useState<ClubTopic[]>([]);
  const [members, setMembers] = useState<ClubMember[]>([]);
  const [events, setEvents] = useState<ClubEvent[]>([]);
  const [clubGroups, setClubGroups] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [activeTab, setActiveTab] = useState('Vue d\'ensemble');
  const [isMember, setIsMember] = useState(false);
  const [joining, setJoining] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [createPostModalOpen, setCreatePostModalOpen] = useState(false);
  const [createPostType, setCreatePostType] = useState<'discussion' | 'guide'>('discussion');
  const [newPostContent, setNewPostContent] = useState('');
  const [newPostTitle, setNewPostTitle] = useState('');
  const [registeredEvents, setRegisteredEvents] = useState<Record<string, boolean>>({});
  const [likedTopics, setLikedTopics] = useState<Record<string, boolean>>({});
  const [participantsModalOpen, setParticipantsModalOpen] = useState(false);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [eventParticipants, setEventParticipants] = useState<any[]>([]);
  const [replyingToTopic, setReplyingToTopic] = useState<string | null>(null);
  const [replyContent, setReplyContent] = useState('');
  const [topicReplies, setTopicReplies] = useState<Record<string, any[]>>({});
  const [activeCommentsTopic, setActiveCommentsTopic] = useState<ClubTopic | null>(null);
  const [commentsList, setCommentsList] = useState<CommentData[]>([]);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const { user } = useAuth();
  const supabase = useMemo(() => createClient(), []);

  const clubDiscussions: ClubMessage[] = useMemo(() => {
    if (!topics || !Array.isArray(topics)) return [];
    return topics.map((t: any) => {
      const authorObj = Array.isArray(t.author) ? t.author[0] : t.author;
      return {
        id: t.id || `topic-${Math.random().toString(36).slice(2)}`,
        author: authorObj?.full_name || 'Voyageur',
        author_avatar: authorObj?.avatar_url,
        tag: t.is_pinned ? 'Guide' : undefined,
        time: t.created_at ? new Date(t.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '',
        content: t.content || '',
        attachment: t.image_url || null,
        likes: typeof t.likes_count === 'number' ? t.likes_count : 0,
        replies: typeof t.replies_count === 'number' ? t.replies_count : 0,
        is_pinned: !!t.is_pinned,
        title: t.title || '',
      };
    });
  }, [topics]);

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(null), 3000); };

  const handleOpenClubGroup = async (group: any) => {
    const res = await setActiveAdventureAction({ nature: 'collectif', id: group.id, title: group.name });
    if (!res.success) {
      showToast("Impossible d'ouvrir ce groupe pour le moment.");
      return;
    }
    triggerHaptic('light');
    router.push(hubSectionHref({ nature: 'collectif' }, 'groupe'));
  };

  const handleCreateClubGroup = async (name: string, memberIds: string[]) => {
    if (!club) return { ok: false, error: 'Club introuvable.' };
    const res = await createGroupFromClub({ clubId: club.id, name, memberIds });
    if (!res.ok) return { ok: false, error: res.error };
    if (res.warning) showToast(res.warning);
    await handleOpenClubGroup({ id: res.groupId, name: res.name });
    return { ok: true };
  };

  const loadData = async () => {
    if (!clubId) return;
    setLoading(true);
    let { data: clubData } = await supabase.from('clubs').select('*').eq('slug', clubId).maybeSingle();
    if (!clubData) {
      const { data: clubById } = await supabase.from('clubs').select('*').eq('id', clubId).maybeSingle();
      if (clubById) clubData = clubById;
    }

    if (clubData) {
      setClub(clubData as Club);
      try {
        const [topicsRes, membersRes, eventsRes, groupsRes] = await Promise.all([
          supabase.from('club_topics').select('*').eq('club_id', clubData.id).order('is_pinned', { ascending: false }).order('created_at', { ascending: false }),
          supabase.from('club_members').select('*').eq('club_id', clubData.id).eq('status', 'active'),
          supabase.from('club_events').select('*').eq('club_id', clubData.id).order('event_date', { ascending: true }),
          supabase
            .from('travel_groups')
            .select('id, name, destination, theme, cover_url, departure_date, return_date, visibility, owner_id, parent_club_id')
            .eq('parent_club_id', clubData.id)
            .order('created_at', { ascending: false }),
        ]);
        setClubGroups((groupsRes.data as any[]) ?? []);
        // F1 — auteurs/membres via la vue `public_profiles` (deux étapes).
        const topicRows = (topicsRes.data as any[]) ?? [];
        const memberRows = (membersRes.data as any[]) ?? [];
        const profiles = await fetchPublicProfilesWith(supabase, [
          ...topicRows.map((t) => t.author_id as string),
          ...memberRows.map((m) => m.user_id as string),
        ]);
        setTopics(
          topicRows.map((t) => ({
            ...t,
            author: profiles[t.author_id]
              ? {
                  full_name: profiles[t.author_id].full_name ?? '',
                  avatar_url: profiles[t.author_id].avatar_url ?? undefined,
                }
              : undefined,
          })) as ClubTopic[]
        );
        setMembers(
          memberRows.map((m) => ({
            ...m,
            user: profiles[m.user_id]
              ? {
                  full_name: profiles[m.user_id].full_name ?? '',
                  trust_score: profiles[m.user_id].trust_score ?? 0,
                  avatar_url: profiles[m.user_id].avatar_url ?? undefined,
                }
              : undefined,
          })) as ClubMember[]
        );
        setEvents((eventsRes.data as ClubEvent[]) ?? []);
      } catch (err) {
        console.warn('Error loading club relations:', err);
      }

      if (user) {
        const { data: membership } = await supabase.from('club_members').select('id').eq('club_id', clubData.id).eq('user_id', user.id).eq('status', 'active').maybeSingle();
        setIsMember(!!membership);

        const { data: myEvents } = await supabase.from('club_event_participants').select('event_id').eq('user_id', user.id);
        if (myEvents) {
          const regMap: Record<string, boolean> = {};
          myEvents.forEach(e => regMap[e.event_id] = true);
          setRegisteredEvents(regMap);
        }

        const { data: myLikes } = await supabase.from('club_topic_likes').select('topic_id').eq('user_id', user.id);
        if (myLikes) {
          const likeMap: Record<string, boolean> = {};
          myLikes.forEach(e => likeMap[e.topic_id] = true);
          setLikedTopics(likeMap);
        }
      }
    } else {
      setClub(null);
      setNotFound(true);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, [clubId, supabase, user]);

  const handleToggleMember = async () => {
    if (!user) { showToast('Connectez-vous pour rejoindre ce club'); return; }
    if (!club) { showToast('Club indisponible'); return; }
    setJoining(true);
    if (isMember) {
      await supabase.from('club_members').delete().eq('club_id', club.id).eq('user_id', user.id);
      setIsMember(false);
      showToast('Vous avez quitté le club');
    } else if (club.privacy === 'open') {
      const { error } = await supabase.from('club_members').insert({ club_id: club.id, user_id: user.id, role: 'member', status: 'active' });
      if (error) {
        showToast("Erreur lors de l'adhésion");
      } else {
        setIsMember(true);
        showToast('Bienvenue dans le club !');
      }
    } else {
      const { error } = await supabase.from('club_join_requests').upsert(
        { club_id: club.id, user_id: user.id, status: 'pending' },
        { onConflict: 'club_id,user_id' }
      );
      if (error) {
        showToast("Erreur lors de la demande d'adhésion");
      } else {
        showToast("Demande d'adhésion envoyée !");
      }
    }
    setJoining(false);
  };

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title: club?.name, url: window.location.href });
      } catch (err) {}
    } else {
      navigator.clipboard.writeText(window.location.href);
      showToast('Lien copié dans le presse-papiers');
    }
  };

  const handleLikePost = async (topicId: string, currentLikes: number) => {
    if (!user) { showToast('Connectez-vous pour liker'); return; }

    const isLiked = likedTopics[topicId];
    setLikedTopics(prev => ({ ...prev, [topicId]: !isLiked }));
    setTopics(topics.map(t => t.id === topicId ? { ...t, likes_count: t.likes_count + (isLiked ? -1 : 1) } : t));

    if (isLiked) {
      await supabase.from('club_topic_likes').delete().eq('topic_id', topicId).eq('user_id', user.id);
      await supabase.from('club_topics').update({ likes_count: currentLikes - 1 }).eq('id', topicId);
    } else {
      await supabase.from('club_topic_likes').insert({ topic_id: topicId, user_id: user.id });
      await supabase.from('club_topics').update({ likes_count: currentLikes + 1 }).eq('id', topicId);
    }
  };

  const handleOpenCommentsSheet = async (topic: ClubTopic) => {
    setActiveCommentsTopic(topic);
    setCommentsLoading(true);
    try {
      const { data } = await supabase
        .from('club_topic_replies')
        .select('id, content, created_at, author_id, parent_id')
        .eq('topic_id', topic.id)
        .order('created_at', { ascending: true });

      if (data) {
        // F1 — auteurs via la vue `public_profiles` (deux étapes).
        const profiles = await fetchPublicProfilesWith(
          supabase,
          data.map((r: any) => r.author_id as string)
        );
        const formatted: CommentData[] = data.map((r: any) => ({
          id: r.id,
          author_id: r.author_id,
          author_name: profiles[r.author_id]?.full_name || 'Voyageur',
          author_avatar: profiles[r.author_id]?.avatar_url ?? undefined,
          created_at: r.created_at,
          content: r.content,
          reply_to_id: r.parent_id,
          likes_count: 0,
          user_liked: false,
        }));
        setCommentsList(formatted);
      }
    } finally {
      setCommentsLoading(false);
    }
  };

  const handleAddTopicComment = async (content: string, replyToId?: string) => {
    if (!user) { showToast('Connectez-vous pour répondre'); return; }
    if (!activeCommentsTopic) return;

    const tempId = `temp-${Date.now()}`;
    const optimistic: CommentData = {
      id: tempId,
      author_id: user.id,
      author_name: 'Moi',
      created_at: new Date().toISOString(),
      content,
      reply_to_id: replyToId,
      likes_count: 0,
      user_liked: false,
    };
    setCommentsList(prev => [...prev, optimistic]);

    setTopics(prev =>
      prev.map(t => (t.id === activeCommentsTopic.id ? { ...t, replies_count: (t.replies_count || 0) + 1 } : t))
    );

    try {
      const { data, error } = await supabase
        .from('club_topic_replies')
        .insert({
          topic_id: activeCommentsTopic.id,
          author_id: user.id,
          content,
          parent_id: replyToId || null,
        })
        .select('id, content, created_at, author_id, parent_id')
        .single();

      if (!error && data) {
        // F1 — auteur via la vue `public_profiles`.
        const profiles = await fetchPublicProfilesWith(supabase, [user.id]);
        const ownProfile = profiles[user.id];
        setCommentsList(prev =>
          prev.map(c =>
            c.id === tempId
              ? {
                  id: (data as any).id,
                  author_id: (data as any).author_id,
                  author_name: ownProfile?.full_name || 'Moi',
                  author_avatar: ownProfile?.avatar_url ?? undefined,
                  created_at: (data as any).created_at,
                  content: (data as any).content,
                  reply_to_id: (data as any).parent_id || replyToId,
                  likes_count: 0,
                  user_liked: false,
                }
              : c
          )
        );
      }
    } catch (err) {
      console.warn('Error inserting topic comment:', err);
    }
  };

  const handleDeleteTopicComment = async (commentId: string) => {
    await supabase.from('club_topic_replies').delete().eq('id', commentId);
    setCommentsList(prev => {
      const toRemove = prev.filter(c => c.id === commentId || c.reply_to_id === commentId);
      if (activeCommentsTopic) {
        setTopics(tList =>
          tList.map(t =>
            t.id === activeCommentsTopic.id ? { ...t, replies_count: Math.max(0, (t.replies_count || 0) - toRemove.length) } : t
          )
        );
      }
      return prev.filter(c => c.id !== commentId && c.reply_to_id !== commentId);
    });
  };

  const handleCreatePost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) { showToast('Connectez-vous pour poster'); return; }
    if (!newPostTitle || !newPostContent) { showToast('Titre et contenu requis'); return; }
    if (submitting) return;

    setSubmitting(true);
    const { data, error } = await supabase.from('club_topics').insert({
      club_id: club!.id,
      author_id: user.id,
      title: newPostTitle,
      content: newPostContent,
      is_pinned: createPostType === 'guide',
    }).select().single();

    setSubmitting(false);

    if (error) {
      console.error('Error creating topic:', error);
      showToast(`Erreur: ${error.message || 'Création échouée'}`);
    } else {
      showToast(createPostType === 'guide' ? 'Guide créé avec succès !' : 'Post créé avec succès !');
      setCreatePostModalOpen(false);
      setNewPostTitle('');
      setNewPostContent('');
      loadData();
    }
  };

  const handleRegisterEvent = async (eventId: string, currentCount: number) => {
    if (!user) { showToast('Connectez-vous pour vous inscrire'); return; }

    const isReg = registeredEvents[eventId];
    setRegisteredEvents(prev => ({ ...prev, [eventId]: !isReg }));
    setEvents(events.map(e => e.id === eventId ? { ...e, participants_count: e.participants_count + (isReg ? -1 : 1) } : e));

    if (isReg) {
      await supabase.from('club_event_participants').delete().eq('event_id', eventId).eq('user_id', user.id);
      await supabase.from('club_events').update({ participants_count: currentCount - 1 }).eq('id', eventId);
      showToast("Désinscription validée");
    } else {
      await supabase.from('club_event_participants').insert({ event_id: eventId, user_id: user.id });
      await supabase.from('club_events').update({ participants_count: currentCount + 1 }).eq('id', eventId);
      showToast("Inscription validée !");
    }
  };

  const handleViewParticipants = async (eventId: string) => {
    setSelectedEventId(eventId);
    setParticipantsModalOpen(true);
    setEventParticipants([]);
    const { data } = await supabase.from('club_event_participants').select('*').eq('event_id', eventId);
    if (data) {
      // F1 — profils des participants via la vue `public_profiles`.
      const profiles = await fetchPublicProfilesWith(
        supabase,
        data.map((p: any) => p.user_id as string)
      );
      setEventParticipants(
        data.map((p: any) => ({
          ...p,
          user: profiles[p.user_id]
            ? {
                full_name: profiles[p.user_id].full_name ?? '',
                trust_score: profiles[p.user_id].trust_score ?? 0,
                avatar_url: profiles[p.user_id].avatar_url,
              }
            : undefined,
        }))
      );
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen flex-col bg-transparent">
        <Header />
        <main className="mx-auto w-full max-w-[1400px] flex-1 space-y-[var(--space-6)] px-[var(--space-6)] py-[var(--space-12)]">
          <Skeleton className="h-[400px] w-full rounded-[var(--lkv-radius-card)]" />
          <LoadingState label="Chargement du club…" />
        </main>
      </div>
    );
  }

  if (!club && notFound) {
    return (
      <div className="flex min-h-screen flex-col bg-transparent">
        <Header />
        <main className="flex flex-1 flex-col items-center justify-center px-[var(--space-6)] py-[var(--space-12)]">
          <ErrorState
            title="Club introuvable"
            message="Ce club n'existe pas, a été supprimé, ou vous n'en êtes pas membre."
            onRetry={() => { setNotFound(false); loadData(); }}
          />
          <Link
            href="/clubs"
            className="mt-[var(--space-4)] inline-flex min-h-[var(--control-height-md)] items-center rounded-full border border-[color:var(--lkv-border)] bg-[color:var(--card-tint-strong)] px-[var(--space-5)] text-[length:var(--lkv-text-caption)] font-bold text-[color:var(--lkv-text-primary)]"
          >
            Tous les clubs
          </Link>
        </main>
      </div>
    );
  }

  if (!club) return null;

  const featuredEvent = (events || []).find(e => e.is_featured) || (events || [])[0];
  const admins = (members || []).filter(m => m.role === 'admin' || m.role === 'moderator');

  const renderTabContent = () => {
    if (activeTab === 'Sorties') {
      return (
        <section className="space-y-[var(--space-4)]">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-[length:var(--lkv-text-title-sm)] font-bold text-[color:var(--lkv-text-primary)]">Toutes les sorties ({events.length})</h2>
            <Button
              onClick={() => { if (user) { showToast('Création de sortie à venir'); } else { showToast('Connectez-vous pour proposer une sortie'); } }}
              icon={<Icon name="PlusIcon" size={14} aria-hidden="true" />}
            >
              Proposer une sortie
            </Button>
          </div>
          {events.length === 0 ? (
            <Card className="p-[var(--space-12)]">
              <EmptyState
                icon={<span className="text-[length:var(--lkv-text-title-sm)]" aria-hidden>🏔️</span>}
                title="Aucune sortie prévue pour le moment"
                description="Revenez bientôt ou proposez une première sortie aux membres !"
              />
            </Card>
          ) : (
            events.map((ev) => {
              const dateObj = ev.event_date ? new Date(ev.event_date) : null;
              const month = dateObj ? dateObj.toLocaleDateString('fr-FR', { month: 'short' }).toUpperCase() : 'TBD';
              const day = dateObj ? dateObj.getDate() : '-';
              const isReg = registeredEvents[ev.id];
              return (
                <Card key={ev.id} className="flex flex-col items-start justify-between gap-[var(--space-4)] transition-all sm:flex-row sm:items-center">
                  <div className="flex min-w-0 items-center gap-[var(--space-4)]">
                    <div className="flex h-16 w-16 shrink-0 flex-col items-center justify-center rounded-[var(--lkv-radius-2xl)] bg-[color:var(--lkv-primary)] text-[color:var(--lkv-text-inverted)]">
                      <span className="font-mono text-[length:var(--lkv-text-caption-2)] font-bold uppercase tracking-wider text-[color:var(--lkv-forest-300)]">{month}</span>
                      <span className="font-display text-[length:var(--lkv-text-title-sm)] font-bold leading-none">{day}</span>
                    </div>
                    <div className="min-w-0">
                      <h3 className="truncate font-display text-[length:var(--lkv-text-caption)] font-bold text-[color:var(--lkv-text-primary)]">{ev.title}</h3>
                      <p className="mt-[var(--space-1)] line-clamp-1 text-[length:var(--lkv-text-caption-2)] text-[color:var(--lkv-text-muted)]">{ev.description}</p>
                      <div className="mt-[var(--space-1)] flex flex-wrap items-center gap-[var(--space-3)] text-[length:var(--lkv-text-caption-2)] text-[color:var(--lkv-text-muted)]">
                        <span className="flex items-center gap-[var(--space-1)]">📍 {ev.location}</span>
                        <span aria-hidden>•</span>
                        <span className="flex items-center gap-[var(--space-1)] font-mono">👥 {ev.participants_count}/{ev.max_participants} places</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex w-full shrink-0 items-center gap-[var(--space-2)] sm:w-auto">
                    <Button
                      onClick={() => handleRegisterEvent(ev.id, ev.participants_count)}
                      variant={isReg ? 'secondary' : 'primary'}
                      className="w-full sm:w-auto"
                    >
                      {isReg ? '✓ Inscrit(e)' : "S'inscrire"}
                    </Button>
                    <IconButton
                      variant="glass"
                      onClick={() => handleViewParticipants(ev.id)}
                      aria-label={`Voir les participants de ${ev.title}`}
                      className="shrink-0"
                    >
                      <Icon name="UsersIcon" size={14} aria-hidden="true" />
                    </IconButton>
                  </div>
                </Card>
              );
            })
          )}
        </section>
      );
    }

    if (activeTab === 'Membres') {
      return (
        <Card className="space-y-[var(--space-4)] p-[var(--space-6)]">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-[length:var(--lkv-text-title-sm)] font-bold text-[color:var(--lkv-text-primary)]">Membres du club ({members.length})</h2>
          </div>
          <div className="grid grid-cols-1 gap-[var(--space-3)] sm:grid-cols-2 md:grid-cols-3">
            {members.map(member => (
              <Link
                key={member.id}
                href={member.user_id ? `/profil/${member.user_id}` : '/clubs'}
                className="flex items-center gap-[var(--space-3)] rounded-[var(--lkv-radius-md)] bg-[color:var(--lkv-surface-muted)] p-[var(--space-3)] transition-colors"
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[color:var(--lkv-primary)] text-[length:var(--lkv-text-caption)] font-bold text-[color:var(--lkv-text-inverted)]" aria-hidden>
                  {member.user?.full_name?.[0] || '👤'}
                </div>
                <div className="min-w-0">
                  <h4 className="truncate text-[length:var(--lkv-text-caption-2)] font-bold text-[color:var(--lkv-text-primary)]">{member.user?.full_name || 'Membre'}</h4>
                  <Badge className="mt-[var(--space-1)] font-mono uppercase">{member.role}</Badge>
                </div>
              </Link>
            ))}
          </div>
        </Card>
      );
    }

    if (activeTab === 'Photos') {
      return (
        <Card className="space-y-[var(--space-4)] p-[var(--space-6)]">
          <h2 className="font-display text-[length:var(--lkv-text-title-sm)] font-bold text-[color:var(--lkv-text-primary)]">Photos partagées</h2>
          <div className="grid grid-cols-2 gap-[var(--space-3)] sm:grid-cols-3 md:grid-cols-4">
            {topics.filter(t => t.image_url).map(topic => (
              <div key={topic.id} className="group relative aspect-square cursor-pointer overflow-hidden rounded-[var(--lkv-radius-2xl)] bg-[color:var(--lkv-surface-muted)]">
                <img src={topic.image_url} alt="Photo du club" className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105 motion-reduce:transition-none" />
              </div>
            ))}
            {topics.filter(t => t.image_url).length === 0 && (
              <div className="col-span-full">
                <EmptyState
                  icon={<Icon name="PhotoIcon" size={22} aria-hidden="true" />}
                  title="Aucune photo partagée"
                  description="Aucune photo partagée pour le moment."
                />
              </div>
            )}
          </div>
        </Card>
      );
    }

    if (activeTab === 'Discussions' || activeTab === 'Guides & Astuces') {
      return (
        <section className="space-y-[var(--space-4)]">
          <ClubDiscussionCard
            clubId={club.id}
            clubName={club.name}
            discussions={clubDiscussions}
            onRefresh={loadData}
            user={user}
            filterType={activeTab === 'Guides & Astuces' ? 'guides' : 'all'}
            onFilterChange={(f) => setActiveTab(f === 'guides' ? 'Guides & Astuces' : 'Discussions')}
          />
        </section>
      );
    }

    if (activeTab === 'Groupes') {
      return (
        <ClubGroupsTab
          club={club}
          groups={clubGroups}
          members={members}
          user={user}
          isMember={isMember}
          onCreate={handleCreateClubGroup}
          onOpenGroup={handleOpenClubGroup}
        />
      );
    }

    if (activeTab === 'Parcours') {
      return (
        <Card className="p-[var(--space-12)]">
          <EmptyState
            icon={<Icon name="MapIcon" size={28} aria-hidden="true" />}
            title="Parcours et Traces GPS"
            description="La bibliothèque des traces GPS du club est en cours de déploiement."
          />
        </Card>
      );
    }

    return (
      <>
        <section className="space-y-[var(--space-3)]">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-[var(--space-2)]">
              <h2 className="font-display text-[length:var(--lkv-text-subheadline)] font-bold text-[color:var(--lkv-text-primary)]">Prochaines sorties</h2>
              <Badge className="font-mono font-bold">{events.length} sorties</Badge>
            </div>
            {events.length > 0 && (
              <Button variant="secondary" size="sm" onClick={() => setActiveTab('Sorties')}>
                Voir tout →
              </Button>
            )}
          </div>
          {events.length === 0 ? (
            <Card className="p-[var(--space-8)]">
              <EmptyState
                compact
                icon={<span className="text-[length:var(--lkv-text-subheadline)]" aria-hidden>🏔️</span>}
                title="Aucune sortie programmée"
              />
            </Card>
          ) : (
            <div className="space-y-[var(--space-3)]">
              {events.slice(0, 2).map((ev) => {
                const dateObj = ev.event_date ? new Date(ev.event_date) : null;
                const month = dateObj ? dateObj.toLocaleDateString('fr-FR', { month: 'short' }).toUpperCase() : 'TBD';
                const day = dateObj ? dateObj.getDate() : '-';
                const isReg = registeredEvents[ev.id];
                return (
                  <Card key={ev.id} className="flex items-center justify-between gap-[var(--space-4)]">
                    <div className="flex min-w-0 items-center gap-[var(--space-3)]">
                      <div className="flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-[var(--lkv-radius-md)] bg-[color:var(--lkv-primary)] text-[color:var(--lkv-text-inverted)]">
                        <span className="font-mono text-[length:var(--lkv-text-caption-2)] font-bold uppercase leading-none text-[color:var(--lkv-forest-300)]">{month}</span>
                        <span className="font-display text-[length:var(--lkv-text-subheadline)] font-bold leading-tight">{day}</span>
                      </div>
                      <div className="min-w-0">
                        <h4 className="truncate font-display text-[length:var(--lkv-text-caption)] font-bold text-[color:var(--lkv-text-primary)]">{ev.title}</h4>
                        <div className="mt-[var(--space-1)] flex items-center gap-[var(--space-2)] font-mono text-[length:var(--lkv-text-caption-2)] text-[color:var(--lkv-text-muted)]">
                          <span>📍 {ev.location}</span>
                          <span aria-hidden>•</span>
                          <span>👥 {ev.participants_count}/{ev.max_participants}</span>
                        </div>
                      </div>
                    </div>
                    <Button
                      onClick={() => handleRegisterEvent(ev.id, ev.participants_count)}
                      variant={isReg ? 'secondary' : 'primary'}
                      size="sm"
                      className="shrink-0"
                    >
                      {isReg ? '✓ Inscrit(e)' : "S'inscrire"}
                    </Button>
                  </Card>
                );
              })}
            </div>
          )}
        </section>

        <section className="space-y-[var(--space-4)]">
          <ClubDiscussionCard
            clubId={club.id}
            clubName={club.name}
            discussions={clubDiscussions}
            onRefresh={loadData}
            user={user}
            filterType="all"
          />
        </section>
      </>
    );
  };

  return (
    <>
      <div className="hidden md:block">
        <div className="relative flex h-[100dvh] max-h-[100dvh] flex-col overflow-hidden bg-transparent font-sans text-[color:var(--lkv-text-primary)]">
          <CompteBackground />
          <Header />
          <main className="mx-auto flex min-h-0 w-full max-w-[1440px] flex-1 gap-[var(--space-5)] overflow-hidden px-[var(--space-4)] pb-[var(--space-4)] pt-24 sm:px-[var(--space-6)] lg:px-[var(--space-8)]">
            <div className="h-full w-[230px] shrink-0 overflow-hidden">
              <ClubVerticalTabs
                activeTab={activeTab}
                setActiveTab={setActiveTab}
              />
            </div>

            <div className="h-full min-w-0 flex-1 space-y-[var(--space-5)] overflow-y-auto pr-[var(--space-2)]">
              <div className="flex items-center gap-[var(--space-2)] text-[length:var(--lkv-text-caption-2)] font-medium text-[color:var(--lkv-text-muted)]">
                <Link href="/communaute" className="transition-colors hover:text-[color:var(--lkv-text-primary)]">Communauté</Link>
                <Icon name="ChevronRightIcon" size={12} className="text-[color:var(--lkv-text-muted)]" aria-hidden="true" />
                <Link href="/clubs" className="transition-colors hover:text-[color:var(--lkv-text-primary)]">Les Clubs</Link>
                <Icon name="ChevronRightIcon" size={12} className="text-[color:var(--lkv-text-muted)]" aria-hidden="true" />
                <span className="font-semibold text-[color:var(--lkv-text-primary)]">{club.name}</span>
              </div>

              {activeTab === "Vue d'ensemble" && (
                <ClubHero
                  club={club}
                  eventsCount={events.length}
                  isMember={isMember}
                  joining={joining}
                  onToggleMember={handleToggleMember}
                  onShare={handleShare}
                />
              )}

              <div className="space-y-[var(--space-5)]">
                {renderTabContent()}
              </div>
            </div>

            <aside className="flex h-full w-[300px] shrink-0 flex-col gap-[var(--space-4)] overflow-y-auto">
              {featuredEvent && (
                <ClubFeaturedEventCard
                  event={featuredEvent}
                  isRegistered={!!registeredEvents[featuredEvent.id]}
                  onRegister={() => handleRegisterEvent(featuredEvent.id, featuredEvent.participants_count)}
                  onViewParticipants={() => handleViewParticipants(featuredEvent.id)}
                />
              )}
              <ClubTeamCard
                admins={admins}
                onViewAll={() => setActiveTab('Membres')}
                onContact={(name) => showToast('Contacter ' + name)}
              />
              <ClubAboutCard club={club} />
              <ClubProCard />
            </aside>
          </main>
        </div>
      </div>

      <div className="block md:hidden">
        <MobilePageShell safeTop={false} videoBackground={false} background="transparent">
          <MobileClubDetailView
            club={club}
            topics={topics}
            members={members}
            events={events}
            groups={clubGroups}
            user={user}
            isMember={isMember}
            onJoinToggle={handleToggleMember}
            joining={joining}
            onOpenCreatePost={() => setCreatePostModalOpen(true)}
            onOpenGroup={handleOpenClubGroup}
            onCreateGroup={handleCreateClubGroup}
            onRefresh={loadData}
          />
        </MobilePageShell>
      </div>

      <CommentsSheet
        isOpen={!!activeCommentsTopic}
        onClose={() => setActiveCommentsTopic(null)}
        title={activeCommentsTopic?.title || 'Commentaires'}
        comments={commentsList}
        loading={commentsLoading}
        currentUserId={user?.id}
        onAddComment={handleAddTopicComment}
        onDeleteComment={handleDeleteTopicComment}
      />

      <Modal
        open={createPostModalOpen}
        onOpenChange={(next) => { if (!next) setCreatePostModalOpen(false); }}
        title={`Publier dans ${club.name}`}
        size="md"
        footer={
          <div className="flex w-full items-center justify-between">
            <IconButton
              variant="glass"
              onClick={() => showToast('Lieu défini sur ' + (club.location || club.name))}
              aria-label="Définir le lieu"
            >
              <Icon name="map-pin" size={14} aria-hidden="true" />
            </IconButton>
            <div className="flex items-center gap-[var(--space-2)]">
              <Button variant="secondary" onClick={() => setCreatePostModalOpen(false)}>
                Annuler
              </Button>
              <Button type="submit" form="club-post-form" disabled={submitting} loading={submitting}>
                {submitting ? 'Publication...' : 'Publier'}
              </Button>
            </div>
          </div>
        }
      >
        <form id="club-post-form" onSubmit={handleCreatePost} className="space-y-[var(--space-4)]">
          <div>
            <label htmlFor="club-post-title" className="mb-[var(--space-1)] block font-mono text-[length:var(--lkv-text-caption-2)] font-bold uppercase tracking-wider text-[color:var(--lkv-text-primary)]">
              Titre du récit ou sujet
            </label>
            <input
              id="club-post-title"
              type="text"
              value={newPostTitle}
              onChange={(e) => setNewPostTitle(e.target.value)}
              placeholder="Ex: Nuit au refuge du Habert..."
              className={FIELD_CLASS}
              required
            />
          </div>

          <div>
            <label htmlFor="club-post-content" className="mb-[var(--space-1)] block font-mono text-[length:var(--lkv-text-caption-2)] font-bold uppercase tracking-wider text-[color:var(--lkv-text-primary)]">
              Votre message
            </label>
            <textarea
              id="club-post-content"
              value={newPostContent}
              onChange={(e) => setNewPostContent(e.target.value)}
              placeholder="Partagez vos impressions, conditions météo, matériel testé..."
              className={`${FIELD_CLASS} min-h-[120px] resize-none`}
              required
            />
          </div>
        </form>
      </Modal>

      <Modal
        open={participantsModalOpen}
        onOpenChange={(next) => { if (!next) setParticipantsModalOpen(false); }}
        title={`Membres inscrits (${eventParticipants.length})`}
        size="sm"
      >
        <div className="space-y-[var(--space-2)]">
          {eventParticipants.length === 0 ? (
            <EmptyState
              compact
              icon={<Icon name="UsersIcon" size={22} aria-hidden="true" />}
              title="Personne n'est encore inscrit"
              description="Personne n'est encore inscrit à cette sortie."
            />
          ) : (
            eventParticipants.map((participant) => (
              <Link
                key={participant.user_id}
                href={participant.user_id ? `/profil/${participant.user_id}` : '/clubs'}
                className="flex items-center gap-[var(--space-3)] rounded-[var(--lkv-radius-md)] bg-[color:var(--lkv-surface-muted)] p-[var(--space-3)] transition-colors"
              >
                <div className="relative">
                  {participant.user?.trust_score && participant.user.trust_score > 80 && (
                    <span className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full border-2 border-[color:var(--lkv-surface-card)] bg-[color:var(--lkv-forest-500)] text-[color:var(--lkv-text-inverted)]">
                      <Icon name="CheckIcon" size={10} aria-hidden="true" />
                    </span>
                  )}
                </div>
                <div>
                  <h4 className="font-bold text-[color:var(--lkv-text-primary)]">{participant.user?.full_name || 'Utilisateur'}</h4>
                  <p className="text-[length:var(--lkv-text-caption-2)] text-[color:var(--lkv-text-muted)]">Inscrit le {new Date(participant.joined_at).toLocaleDateString('fr-FR')}</p>
                </div>
              </Link>
            ))
          )}
        </div>
      </Modal>

      {toast && (
        <div className="fixed bottom-10 left-1/2 z-[var(--z-toast)] flex -translate-x-1/2 items-center gap-[var(--space-3)] rounded-full bg-[color:var(--lkv-forest-950)] px-[var(--space-8)] py-[var(--space-4)] text-[length:var(--lkv-text-caption)] font-bold text-[color:var(--lkv-text-inverted)] shadow-elevation-4">
          <Icon name="CheckCircleIcon" size={18} className="text-[color:var(--lkv-text-inverted)]/70" aria-hidden="true" />
          {toast}
        </div>
      )}
    </>
  );
}
