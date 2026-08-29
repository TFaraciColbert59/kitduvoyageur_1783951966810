'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import Header from '@/components/Header';
import MobilePageShell from '@/components/mobile-nav/MobilePageShell';
import Icon from '@/components/ui/AppIcon';
import CompteBackground from '@/components/compte/CompteBackground';
import CommunityHubNav from '@/components/social/CommunityHubNav';
import SocialActions from '@/components/social/SocialActions';
import CommentsSheet, { CommentData } from '@/components/social/CommentsSheet';
import MoreMenuSheet from '@/components/social/MoreMenuSheet';
import ClubDiscussionCard, { ClubMessage } from '@/components/clubs/ClubDiscussionCard';
import ClubHero from '@/components/clubs/ClubHero';
import ClubVerticalTabs from '@/components/clubs/ClubVerticalTabs';
import ClubFeaturedEventCard from '@/components/clubs/ClubFeaturedEventCard';
import ClubTeamCard from '@/components/clubs/ClubTeamCard';
import ClubAboutCard from '@/components/clubs/ClubAboutCard';
import ClubProCard from '@/components/clubs/ClubProCard';
import MobileClubDetailView from '@/components/clubs/MobileClubDetailView';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useHapticFeedback } from '@/hooks/useHapticFeedback';

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

const TAB_LINKS = ['Vue d\'ensemble', 'Sorties', 'Membres', 'Photos', 'Discussions', 'Guides & Astuces', 'Parcours'];

export default function ClubDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { triggerHaptic } = useHapticFeedback();
  const clubId = params?.id as string;
  const [club, setClub] = useState<Club | null>(null);
  const [topics, setTopics] = useState<ClubTopic[]>([]);
  const [members, setMembers] = useState<ClubMember[]>([]);
  const [events, setEvents] = useState<ClubEvent[]>([]);
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
        const [topicsRes, membersRes, eventsRes] = await Promise.all([
          supabase.from('club_topics').select('*, author:user_profiles(full_name, avatar_url)').eq('club_id', clubData.id).order('is_pinned', { ascending: false }).order('created_at', { ascending: false }),
          supabase.from('club_members').select('*, user:user_profiles(full_name, trust_score)').eq('club_id', clubData.id).eq('status', 'active'),
          supabase.from('club_events').select('*').eq('club_id', clubData.id).order('event_date', { ascending: true }),
        ]);
        setTopics((topicsRes.data as ClubTopic[]) ?? []);
        setMembers((membersRes.data as ClubMember[]) ?? []);
        setEvents((eventsRes.data as ClubEvent[]) ?? []);
      } catch (err) {
        console.warn('Error loading club relations:', err);
      }

      if (user) {
        const { data: membership } = await supabase.from('club_members').select('id').eq('club_id', clubData.id).eq('user_id', user.id).eq('status', 'active').maybeSingle();
        setIsMember(!!membership);

        // Fetch registered events
        const { data: myEvents } = await supabase.from('club_event_participants').select('event_id').eq('user_id', user.id);
        if (myEvents) {
          const regMap: Record<string, boolean> = {};
          myEvents.forEach(e => regMap[e.event_id] = true);
          setRegisteredEvents(regMap);
        }

        // Fetch liked topics
        const { data: myLikes } = await supabase.from('club_topic_likes').select('topic_id').eq('user_id', user.id);
        if (myLikes) {
          const likeMap: Record<string, boolean> = {};
          myLikes.forEach(e => likeMap[e.topic_id] = true);
          setLikedTopics(likeMap);
        }
      }
    } else {
      // Club introuvable (ou inaccessible) : vrai état vide, aucune donnée fictive.
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
      // Closed / secret club: send a join request instead of auto-joining
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
        .select('id, content, created_at, author_id, parent_id, author:user_profiles(full_name, avatar_url)')
        .eq('topic_id', topic.id)
        .order('created_at', { ascending: true });

      if (data) {
        const formatted: CommentData[] = data.map((r: any) => ({
          id: r.id,
          author_id: r.author_id,
          author_name: r.author?.full_name || 'Voyageur',
          author_avatar: r.author?.avatar_url,
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

    // Update topic counter in topics list
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
        .select('id, content, created_at, author_id, parent_id, author:user_profiles(full_name, avatar_url)')
        .single();

      if (!error && data) {
        setCommentsList(prev =>
          prev.map(c =>
            c.id === tempId
              ? {
                  id: (data as any).id,
                  author_id: (data as any).author_id,
                  author_name: (data as any).author?.full_name || 'Moi',
                  author_avatar: (data as any).author?.avatar_url,
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
      loadData(); // reload data immediately
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
    setEventParticipants([]); // loading state
    const { data } = await supabase.from('club_event_participants').select('*, user:user_profiles(full_name, avatar_url, trust_score)').eq('event_id', eventId);
    if (data) {
      setEventParticipants(data);
    }
  };

  if (loading) {
    return (
      <>
        {/* DESKTOP LOADING */}
        <div className="hidden md:block">
          <div className="min-h-screen bg-[#F5F3ED] selection:bg-emerald-900/20 flex flex-col">
            <Header />
            <main className="flex-1 animate-pulse">
              <div className="h-[400px] bg-emerald-900/10 mx-auto w-full max-w-[1400px] rounded-b-[3rem] mt-16" />
              <div className="max-w-7xl mx-auto px-6 py-12 flex gap-8">
                <div className="flex-[2] space-y-6">
                  <div className="h-64 bg-emerald-900/10 rounded-[0.75rem]" />
                  <div className="h-96 bg-emerald-900/10 rounded-[0.75rem]" />
                </div>
              </div>
            </main>
          </div>
        </div>
        {/* MOBILE LOADING */}
        <div className="block md:hidden">
          <MobilePageShell>
            <div style={{ padding: '20px' }}>
              <div style={{ height: '200px', background: 'rgba(23,64,44,0.06)', borderRadius: '24px', marginBottom: '24px' }} />
              <div style={{ height: '24px', background: 'rgba(23,64,44,0.06)', borderRadius: '12px', width: '60%', marginBottom: '16px' }} />
              <div style={{ height: '16px', background: 'rgba(23,64,44,0.06)', borderRadius: '8px', width: '80%', marginBottom: '12px' }} />
              <div style={{ height: '16px', background: 'rgba(23,64,44,0.06)', borderRadius: '8px', width: '40%', marginBottom: '24px' }} />
              <div style={{ height: '200px', background: 'rgba(23,64,44,0.06)', borderRadius: '24px' }} />
            </div>
          </MobilePageShell>
          
        </div>
      </>
    );
  }

  if (!club && notFound) {
    return (
      <>
        {/* DESKTOP NOT FOUND */}
        <div className="hidden md:block">
          <div className="min-h-screen bg-[#F5F3ED] selection:bg-emerald-900/20 flex flex-col">
            <Header />
            <main className="flex-1 flex flex-col items-center justify-center text-center px-6 py-24">
              <div className="w-20 h-20 rounded-[0.75rem] bg-emerald-900/10 flex items-center justify-center mb-6">
                <Icon name="UserGroupIcon" size={32} className="text-emerald-900/40" />
              </div>
              <h1 className="font-display font-800 text-3xl mb-3">Club introuvable</h1>
              <p className="text-emerald-900/60 max-w-md mb-8">
                Ce club n'existe pas, a été supprimé, ou vous n'en êtes pas membre.
              </p>
              <div className="flex items-center gap-4">
                <button
                  type="button"
                  onClick={() => { setNotFound(false); loadData(); }}
                  className="px-6 py-3 rounded-full bg-emerald-900 text-white text-sm font-700 hover:bg-emerald-800 transition-colors"
                >
                  Réessayer
                </button>
                <Link href="/clubs" className="px-6 py-3 rounded-full border border-emerald-900/20 text-emerald-900 text-sm font-700 hover:bg-emerald-900/5 transition-colors">
                  Tous les clubs
                </Link>
              </div>
            </main>
          </div>
        </div>
        {/* MOBILE NOT FOUND */}
        <div className="block md:hidden">
          <MobilePageShell>
            <div style={{ padding: '32px 20px', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', paddingTop: '15vh' }}>
              <div style={{ width: 72, height: 72, borderRadius: 24, background: 'rgba(23,64,44,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 20 }}>
                <Icon name="UserGroupIcon" size={28} className="text-emerald-900/40" />
              </div>
              <h1 style={{ fontFamily: 'Georgia, serif', fontSize: 24, fontWeight: 700, color: '#17402C', marginBottom: 8 }}>Club introuvable</h1>
              <p style={{ color: '#6B7A72', fontSize: 15, lineHeight: 1.5, maxWidth: 300, marginBottom: 24 }}>
                Ce club n'existe pas, a été supprimé, ou vous n'en êtes pas membre.
              </p>
              <button
                type="button"
                onClick={() => { setNotFound(false); loadData(); }}
                style={{ width: '100%', maxWidth: 300, padding: '14px 0', borderRadius: 999, background: '#17402C', color: '#FBFAF6', fontSize: 15, fontWeight: 700, marginBottom: 12 }}
              >
                Réessayer
              </button>
              <Link href="/clubs" style={{ width: '100%', maxWidth: 300, padding: '14px 0', borderRadius: 999, border: '1px solid rgba(23,64,44,0.2)', color: '#17402C', fontSize: 15, fontWeight: 700, textAlign: 'center' }}>
                Tous les clubs
              </Link>
            </div>
          </MobilePageShell>
        </div>
      </>
    );
  }

  if (!club) return null;

  const featuredEvent = (events || []).find(e => e.is_featured) || (events || [])[0];
  const admins = (members || []).filter(m => m.role === 'admin' || m.role === 'moderator');

  const renderTabContent = () => {
    if (activeTab === 'Sorties') {
      return (
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-display font-bold text-xl text-[#17402C]">Toutes les sorties ({events.length})</h2>
            <button
              onClick={() => { if (user) { showToast('Création de sortie à venir'); } else { showToast('Connectez-vous pour proposer une sortie'); } }}
              className="glass-capsule-btn primary py-2 px-4 text-xs font-bold"
            >
              <Icon name="PlusIcon" size={14} className="inline mr-1 relative z-10" />
              <span className="relative z-10">Proposer une sortie</span>
            </button>
          </div>
          {events.length === 0 ? (
            <div className="glass p-12 text-center rounded-2xl">
              <span className="text-3xl block mb-2">🏔️</span>
              <p className="text-sm font-bold text-[#17402C]">Aucune sortie prévue pour le moment</p>
              <p className="text-xs text-[#5C6B5E] mt-1">Revenez bientôt ou proposez une première sortie aux membres !</p>
            </div>
          ) : (
            events.map((ev) => {
              const dateObj = ev.event_date ? new Date(ev.event_date) : null;
              const month = dateObj ? dateObj.toLocaleDateString('fr-FR', { month: 'short' }).toUpperCase() : 'TBD';
              const day = dateObj ? dateObj.getDate() : '-';
              const isReg = registeredEvents[ev.id];
              return (
                <div key={ev.id} className="glass rounded-2xl p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 transition-all">
                  <div className="flex items-center gap-4 min-w-0">
                    <div className="w-16 h-16 rounded-2xl bg-[#17402C] text-white flex flex-col items-center justify-center shrink-0 shadow-sm">
                      <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-emerald-300">{month}</span>
                      <span className="text-2xl font-display font-bold leading-none">{day}</span>
                    </div>
                    <div className="min-w-0">
                      <h3 className="font-display font-bold text-base text-[#17402C] truncate">{ev.title}</h3>
                      <p className="text-xs text-[#5C6B5E] line-clamp-1 mt-0.5">{ev.description}</p>
                      <div className="flex items-center gap-3 text-xs text-[#5C6B5E] mt-1.5 flex-wrap">
                        <span className="flex items-center gap-1">📍 {ev.location}</span>
                        <span>•</span>
                        <span className="flex items-center gap-1 font-mono">👥 {ev.participants_count}/{ev.max_participants} places</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 w-full sm:w-auto shrink-0">
                    <button
                      onClick={() => handleRegisterEvent(ev.id, ev.participants_count)}
                      className={`glass-capsule-btn py-2.5 px-5 text-xs font-bold w-full sm:w-auto ${isReg ? '' : 'primary'}`}
                    >
                      <span className="relative z-10">{isReg ? '✓ Inscrit(e)' : "S'inscrire"}</span>
                    </button>
                    <button
                      onClick={() => handleViewParticipants(ev.id)}
                      className="glass-capsule-btn p-2.5 shrink-0"
                      title="Voir les participants"
                    >
                      <Icon name="UsersIcon" size={14} className="relative z-10" />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </section>
      );
    }

    if (activeTab === 'Membres') {
      return (
        <section className="glass rounded-2xl p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-display font-bold text-xl text-[#17402C]">Membres du club ({members.length})</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {members.map(member => (
              <Link
                key={member.id}
                href={member.user_id ? `/profil/${member.user_id}` : '/clubs'}
                className="flex items-center gap-3 p-3 rounded-xl glass-sub-card hover:bg-white/50 transition-colors"
              >
                <div className="w-10 h-10 rounded-full bg-[#17402C] text-white flex items-center justify-center font-bold text-sm shadow-sm shrink-0">
                  {member.user?.full_name?.[0] || '👤'}
                </div>
                <div className="min-w-0">
                  <h4 className="font-bold text-xs text-[#17402C] truncate">{member.user?.full_name || 'Membre'}</h4>
                  <span className="glass-pill text-[9px] uppercase font-mono mt-0.5 inline-block">{member.role}</span>
                </div>
              </Link>
            ))}
          </div>
        </section>
      );
    }

    if (activeTab === 'Photos') {
      return (
        <section className="glass rounded-2xl p-6 space-y-4">
          <h2 className="font-display font-bold text-xl text-[#17402C]">Photos partagées</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {topics.filter(t => t.image_url).map(topic => (
              <div key={topic.id} className="aspect-square rounded-2xl overflow-hidden relative group cursor-pointer bg-black/5">
                <img src={topic.image_url} alt="Photo du club" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
              </div>
            ))}
            {topics.filter(t => t.image_url).length === 0 && (
              <p className="text-xs text-[#5C6B5E] col-span-full py-8 text-center">Aucune photo partagée pour le moment.</p>
            )}
          </div>
        </section>
      );
    }

    if (activeTab === 'Discussions' || activeTab === 'Guides & Astuces') {
      return (
        <section className="space-y-4">
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

    if (activeTab === 'Parcours') {
      return (
        <section className="glass rounded-2xl p-12 text-center text-[#5C6B5E]">
          <div className="w-16 h-16 bg-[#17402C]/10 text-[#17402C] rounded-2xl flex items-center justify-center mx-auto mb-3">
            <Icon name="MapIcon" size={28} />
          </div>
          <h2 className="font-display font-bold text-lg text-[#17402C] mb-1">Parcours et Traces GPS</h2>
          <p className="text-xs text-[#5C6B5E] max-w-md mx-auto">La bibliothèque des traces GPS du club est en cours de déploiement.</p>
        </section>
      );
    }

    // Default 'Vue d'ensemble'
    return (
      <>
        {/* Prochaines sorties (Mini) */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h2 className="font-display font-bold text-lg text-[#17402C]">Prochaines sorties</h2>
              <span className="glass-pill text-[10px] font-mono font-bold">{events.length} sorties</span>
            </div>
            {events.length > 0 && (
              <button onClick={() => setActiveTab('Sorties')} className="text-xs font-bold text-[#17402C] hover:underline">
                Voir tout →
              </button>
            )}
          </div>
          {events.length === 0 ? (
            <div className="glass p-8 text-center rounded-2xl">
              <span className="text-2xl block mb-1">🏔️</span>
              <p className="text-xs font-bold text-[#17402C]">Aucune sortie programmée</p>
            </div>
          ) : (
            <div className="space-y-3">
              {events.slice(0, 2).map((ev) => {
                const dateObj = ev.event_date ? new Date(ev.event_date) : null;
                const month = dateObj ? dateObj.toLocaleDateString('fr-FR', { month: 'short' }).toUpperCase() : 'TBD';
                const day = dateObj ? dateObj.getDate() : '-';
                const isReg = registeredEvents[ev.id];
                return (
                  <div key={ev.id} className="glass rounded-2xl p-4 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3.5 min-w-0">
                      <div className="w-12 h-12 rounded-xl bg-[#17402C] text-white flex flex-col items-center justify-center shrink-0">
                        <span className="text-[8.5px] font-mono font-bold uppercase text-emerald-300 leading-none">{month}</span>
                        <span className="text-lg font-display font-bold leading-tight">{day}</span>
                      </div>
                      <div className="min-w-0">
                        <h4 className="font-display font-bold text-sm text-[#17402C] truncate">{ev.title}</h4>
                        <div className="flex items-center gap-2 text-xs text-[#5C6B5E] mt-0.5 font-mono">
                          <span>📍 {ev.location}</span>
                          <span>•</span>
                          <span>👥 {ev.participants_count}/{ev.max_participants}</span>
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={() => handleRegisterEvent(ev.id, ev.participants_count)}
                      className={`glass-capsule-btn py-2 px-4 text-xs font-bold shrink-0 ${isReg ? '' : 'primary'}`}
                    >
                      <span className="relative z-10">{isReg ? '✓ Inscrit(e)' : "S'inscrire"}</span>
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Discussions & Fil d'actualité */}
        <section className="space-y-4">
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
      {/* ── DESKTOP (3-Column Fullscreen 100dvh + CompteBackground) ── */}
      <div className="hidden md:block">
        <div className="h-[100dvh] max-h-[100dvh] overflow-hidden bg-transparent font-sans text-[#17402C] relative flex flex-col">
          <CompteBackground />
          <Header />
          <main className="flex-1 min-h-0 overflow-hidden w-full max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 pt-24 pb-4 flex gap-5">
            {/* COLONNE GAUCHE (Nav & Vertical Cockpit Tabs) - 230px */}
            <aside className="w-[230px] shrink-0 h-full overflow-y-auto custom-scrollbar flex flex-col gap-3">
              <CommunityHubNav layoutVariant="vertical" activeTab="clubs" />
              <ClubVerticalTabs
                activeTab={activeTab}
                setActiveTab={setActiveTab}
                eventsCount={events.length}
                membersCount={members.length}
                topicsCount={topics.length}
              />
            </aside>

            {/* COLONNE CENTRALE (Scrollable Unique) */}
            <div className="flex-1 min-w-0 h-full overflow-y-auto custom-scrollbar pr-2 space-y-5">
              {/* Breadcrumbs */}
              <div className="flex items-center gap-2 text-xs font-medium text-[#5C6B5E]">
                <Link href="/communaute" className="hover:text-[#17402C] transition-colors">Communauté</Link>
                <Icon name="ChevronRightIcon" size={12} className="text-[#5C6B5E]" />
                <Link href="/clubs" className="hover:text-[#17402C] transition-colors">Les Clubs</Link>
                <Icon name="ChevronRightIcon" size={12} className="text-[#5C6B5E]" />
                <span className="text-[#17402C] font-semibold">{club.name}</span>
              </div>

              {/* OVERVIEW TAB ONLY: Hero */}
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

              {/* TAB CONTENT */}
              <div className="space-y-5">
                {renderTabContent()}
              </div>
            </div>

            {/* COLONNE DROITE (Widgets Sidebar) - 300px */}
            <aside className="w-[300px] shrink-0 h-full overflow-y-auto custom-scrollbar flex flex-col gap-4">
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

      {/* ── MOBILE ── */}
      <div className="block md:hidden">
        <MobilePageShell safeTop={false} videoBackground={false} background="#FAF8F5">
          <MobileClubDetailView
            club={club}
            topics={topics}
            members={members}
            events={events}
            user={user}
            isMember={isMember}
            onJoinToggle={handleToggleMember}
            joining={joining}
            onOpenCreatePost={() => setCreatePostModalOpen(true)}
            onRefresh={loadData}
          />
        </MobilePageShell>
      </div>

      {/* Modern Liquid Glass CommentsSheet */}
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

      {/* CREATE POST MODAL (Bottom Sheet Drawer on Mobile) */}
      {createPostModalOpen && (
        <div className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="glass bg-white/95 backdrop-blur-2xl w-full sm:max-w-lg rounded-t-3xl sm:rounded-3xl overflow-hidden animate-slide-up flex flex-col border border-white shadow-2xl max-h-[90vh]">
            {/* Drag Handle for Mobile */}
            <div className="w-full flex items-center justify-center pt-3 pb-1 sm:hidden">
              <div className="w-10 h-1 rounded-full bg-[#17402C]/20" />
            </div>

            <div className="p-4 sm:p-5 border-b border-[#17402C]/8 flex justify-between items-center bg-transparent">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-[#17402C]/10 text-[#17402C] flex items-center justify-center font-bold text-xs">
                  🏕️
                </div>
                <h3 className="font-display font-bold text-base text-[#17402C]">
                  Publier dans {club.name}
                </h3>
              </div>
              <button
                onClick={() => setCreatePostModalOpen(false)}
                className="text-[#5C6B5E] hover:text-[#17402C] glass w-8 h-8 rounded-full border border-white flex items-center justify-center transition-colors"
              >
                <Icon name="XMarkIcon" size={16} />
              </button>
            </div>

            <form onSubmit={handleCreatePost} className="p-4 sm:p-5 space-y-3.5 overflow-y-auto">
              <div>
                <label className="block text-[11px] font-bold text-[#17402C] uppercase tracking-wider mb-1 font-mono">
                  Titre du récit ou sujet
                </label>
                <input
                  type="text"
                  value={newPostTitle}
                  onChange={(e) => setNewPostTitle(e.target.value)}
                  placeholder="Ex: Nuit au refuge du Habert..."
                  className="w-full bg-[#F5F2E8]/60 border border-[#17402C]/10 rounded-2xl px-3.5 py-2.5 text-xs text-[#17402C] focus:ring-1 focus:ring-[#17402C] outline-none font-medium"
                  required
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-[#17402C] uppercase tracking-wider mb-1 font-mono">
                  Votre message
                </label>
                <textarea
                  value={newPostContent}
                  onChange={(e) => setNewPostContent(e.target.value)}
                  placeholder="Partagez vos impressions, conditions météo, matériel testé..."
                  className="w-full bg-[#F5F2E8]/60 border border-[#17402C]/10 rounded-2xl px-3.5 py-2.5 min-h-[120px] text-xs text-[#17402C] focus:ring-1 focus:ring-[#17402C] outline-none font-normal resize-none"
                  required
                />
              </div>

              <div className="pt-2 flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => showToast('Lieu défini sur ' + (club.location || club.name))}
                    className="w-8 h-8 rounded-full bg-[#F5F2E8] text-[#17402C] flex items-center justify-center hover:bg-[#EAE6DF] transition-colors border border-[#17402C]/10"
                    title="Lieu"
                  >
                    <Icon name="MapPinIcon" size={14} />
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setCreatePostModalOpen(false)}
                    className="px-3.5 py-2 text-[#5C6B5E] hover:text-[#17402C] font-bold text-xs transition-colors"
                  >
                    Annuler
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="px-5 py-2 rounded-full text-xs font-bold bg-[#17402C] text-white shadow-xs disabled:opacity-50 active:scale-95"
                  >
                    {submitting ? 'Publication...' : 'Publier'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* PARTICIPANTS MODAL */}
      {participantsModalOpen && (
        <div className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="glass bg-white/95 backdrop-blur-2xl rounded-t-3xl sm:rounded-3xl w-full sm:max-w-sm overflow-hidden animate-slide-up flex flex-col max-h-[80vh] border border-white shadow-2xl">
            <div className="w-full flex items-center justify-center pt-3 pb-1 sm:hidden">
              <div className="w-10 h-1 rounded-full bg-[#17402C]/20" />
            </div>

            <div className="p-4 border-b border-[#17402C]/8 flex justify-between items-center">
              <h3 className="font-display font-bold text-sm text-[#17402C]">
                Membres inscrits ({eventParticipants.length})
              </h3>
              <button
                onClick={() => setParticipantsModalOpen(false)}
                className="text-[#5C6B5E] hover:text-[#17402C] w-7 h-7 rounded-full flex items-center justify-center"
              >
                <Icon name="XMarkIcon" size={16} />
              </button>
            </div>
            <div className="p-4 overflow-y-auto flex-1 space-y-2.5">
              {eventParticipants.length === 0 ? (
                <div className="text-center py-8 text-[#5C6B5E] text-xs font-mono">
                  Personne n'est encore inscrit à cette sortie.
                </div>
              ) : (
                eventParticipants.map((participant) => (
                  <Link
                    key={participant.user_id}
                    href={participant.user_id ? `/profil/${participant.user_id}` : '/clubs'}
                    className="flex items-center gap-3 p-2.5 bg-white/60 hover:bg-white rounded-2xl transition-colors cursor-pointer border border-white"
                  >
                    <div className="relative">
                      {participant.user?.trust_score && participant.user.trust_score > 80 && (
                        <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-emerald-500 rounded-full border-2 border-white flex items-center justify-center text-white">
                          <Icon name="CheckIcon" size={10} />
                        </div>
                      )}
                    </div>
                    <div>
                      <h4 className="font-800 text-emerald-950">{participant.user?.full_name || 'Utilisateur'}</h4>
                      <p className="text-xs text-emerald-900/50">Inscrit le {new Date(participant.joined_at).toLocaleDateString('fr-FR')}</p>
                    </div>
                  </Link>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Global Toast */}
      {toast && (
        <div className="fixed bottom-10 left-1/2 -translate-x-1/2 z-[300] bg-emerald-950 text-white px-8 py-4 rounded-full text-sm font-700 animate-fade-in-up flex items-center gap-3">
          <Icon name="CheckCircleIcon" size={18} className="text-white/70" />
          {toast}
        </div>
      )}
    </>
  );
}
