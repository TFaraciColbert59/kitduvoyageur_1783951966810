'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import MobilePageShell from '@/components/mobile-nav/MobilePageShell';
import Icon from '@/components/ui/AppIcon';
import SocialActions from '@/components/social/SocialActions';
import CommentsSheet, { CommentData } from '@/components/social/CommentsSheet';
import MoreMenuSheet from '@/components/social/MoreMenuSheet';
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

const TAB_LINKS = ['Tous les contenus', 'Sorties', 'Membres', 'Photos', 'Discussions', 'Guides & Astuces', 'Parcours'];

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
  const [activeTab, setActiveTab] = useState('Tous les contenus');
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

  const { user } = useAuth();
  const supabase = useMemo(() => createClient(), []);

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
      const [topicsRes, membersRes, eventsRes] = await Promise.all([
        supabase.from('club_topics').select('*, author:user_profiles!club_topics_author_id_fkey(full_name)').eq('club_id', clubData.id).eq('is_approved', true).order('is_pinned', { ascending: false }).order('created_at', { ascending: false }),
        supabase.from('club_members').select('*, user:user_profiles(full_name, trust_score)').eq('club_id', clubData.id).eq('status', 'active'),
        supabase.from('club_events').select('*').eq('club_id', clubData.id).order('event_date', { ascending: true }),
      ]);
      setTopics((topicsRes.data as ClubTopic[]) ?? []);
      setMembers((membersRes.data as ClubMember[]) ?? []);
      setEvents((eventsRes.data as ClubEvent[]) ?? []);

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

  const [submitting, setSubmitting] = useState(false);

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
            <Footer />
          </div>
        </div>
        {/* MOBILE LOADING */}
        <div className="block md:hidden">
          <MobilePageShell>
            <div style={{ padding: '20px' }}>
              <div style={{ height: '200px', background: 'rgba(11,31,23,0.06)', borderRadius: '24px', marginBottom: '24px' }} />
              <div style={{ height: '24px', background: 'rgba(11,31,23,0.06)', borderRadius: '12px', width: '60%', marginBottom: '16px' }} />
              <div style={{ height: '16px', background: 'rgba(11,31,23,0.06)', borderRadius: '8px', width: '80%', marginBottom: '12px' }} />
              <div style={{ height: '16px', background: 'rgba(11,31,23,0.06)', borderRadius: '8px', width: '40%', marginBottom: '24px' }} />
              <div style={{ height: '200px', background: 'rgba(11,31,23,0.06)', borderRadius: '24px' }} />
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
            <Footer />
          </div>
        </div>
        {/* MOBILE NOT FOUND */}
        <div className="block md:hidden">
          <MobilePageShell>
            <div style={{ padding: '32px 20px', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', paddingTop: '15vh' }}>
              <div style={{ width: 72, height: 72, borderRadius: 24, background: 'rgba(11,31,23,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 20 }}>
                <Icon name="UserGroupIcon" size={28} className="text-emerald-900/40" />
              </div>
              <h1 style={{ fontFamily: 'Georgia, serif', fontSize: 24, fontWeight: 700, color: '#0B1F17', marginBottom: 8 }}>Club introuvable</h1>
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
              <Link href="/clubs" style={{ width: '100%', maxWidth: 300, padding: '14px 0', borderRadius: 999, border: '1px solid rgba(11,31,23,0.2)', color: '#0B1F17', fontSize: 15, fontWeight: 700, textAlign: 'center' }}>
                Tous les clubs
              </Link>
            </div>
          </MobilePageShell>
        </div>
      </>
    );
  }

  if (!club) return null;

  const featuredEvent = events.find(e => e.is_featured) || events[0];
  const admins = members.filter(m => m.role === 'admin' || m.role === 'moderator');

  const renderTabContent = () => {
    if (activeTab === 'Sorties') {
      return (
        <section className="space-y-6">
          <h2 className="font-display font-800 text-2xl">Toutes les sorties</h2>
          {events.length === 0 ? <p className="text-emerald-900/60">Aucune sortie prévue.</p> : events.map((ev) => {
            const dateObj = ev.event_date ? new Date(ev.event_date) : null;
            return (
              <div key={ev.id} className="bg-white rounded-[0.75rem] p-6 flex flex-col sm:flex-row items-start sm:items-center gap-6 border border-emerald-900/5 shadow-sm active:scale-[0.98] active:opacity-95 transition-all duration-150 cursor-pointer">
                <div className="w-20 h-20 bg-emerald-950 text-white rounded-2xl flex flex-col items-center justify-center shrink-0">
                  <span className="text-xs font-800 uppercase tracking-wider">{dateObj ? dateObj.toLocaleDateString('fr-FR', { month: 'short' }).toUpperCase() : 'TBD'}</span>
                  <span className="text-3xl font-900 leading-none">{dateObj ? dateObj.getDate() : '-'}</span>
                </div>
                <div className="flex-1">
                  <h3 className="font-800 text-xl mb-1">{ev.title}</h3>
                  <p className="text-emerald-900/70 text-sm mb-3">{ev.description}</p>
                  <div className="flex items-center gap-4 text-sm text-emerald-900/60 font-600">
                    <span className="flex items-center gap-1"><Icon name="MapPinIcon" size={14} /> {ev.location}</span>
                    <span className="flex items-center gap-1"><Icon name="UsersIcon" size={14} /> {ev.participants_count}/{ev.max_participants} places</span>
                  </div>
                </div>
                <div className="flex flex-col gap-2 w-full sm:w-auto">
                  <button
                    onClick={() => handleRegisterEvent(ev.id, ev.participants_count)}
                    className={`px-6 py-2.5 rounded-full text-sm font-700 transition-colors w-full ${registeredEvents[ev.id] ? 'bg-emerald-100 text-emerald-800' : 'bg-emerald-950 text-white hover:bg-emerald-800'}`}
                  >
                    {registeredEvents[ev.id] ? <><Icon name="CheckIcon" size={14} className="inline mr-1" /> Inscrit</> : "S'inscrire"}
                  </button>
                  <button onClick={() => handleViewParticipants(ev.id)} className="px-6 py-2 text-xs font-700 text-emerald-900/60 hover:text-emerald-900 transition-colors">
                    👁️ Voir les participants
                  </button>
                </div>
              </div>
            );
          })}
        </section>
      );
    }

    if (activeTab === 'Membres') {
      return (
        <section className="bg-white rounded-[0.75rem] p-8 border border-emerald-900/5 shadow-sm active:scale-[0.98] active:opacity-95 transition-all duration-150 cursor-pointer">
          <h2 className="font-display font-800 text-2xl mb-6">Membres du club ({members.length})</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
            {members.map(member => (
              <Link
                key={member.id}
                href={member.user_id ? `/profil/${member.user_id}` : '/clubs'}
                className="flex items-center gap-4 p-4 rounded-xl hover:bg-emerald-50 transition-colors border border-transparent hover:border-emerald-100"
              >
                <div className="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-950 font-800 border border-emerald-200">
                  {member.user?.full_name[0] || '?'}
                </div>
                <div>
                  <h4 className="font-700">{member.user?.full_name}</h4>
                  <span className="text-xs text-emerald-900/60 uppercase font-800 tracking-wider">{member.role}</span>
                </div>
              </Link>
            ))}
          </div>
        </section>
      );
    }

    if (activeTab === 'Photos') {
      return (
        <section className="bg-white rounded-[0.75rem] p-8 border border-emerald-900/5 shadow-sm active:scale-[0.98] active:opacity-95 transition-all duration-150 cursor-pointer">
          <h2 className="font-display font-800 text-2xl mb-6">Photos partagées</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
            {topics.filter(t => t.image_url).map(topic => (
              <div key={topic.id} className="aspect-square rounded-2xl overflow-hidden relative group cursor-pointer bg-emerald-50">
                <img src={topic.image_url} alt="Photo" className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
              </div>
            ))}
            {topics.filter(t => t.image_url).length === 0 && <p className="text-emerald-900/50">Aucune photo partagée pour le moment.</p>}
          </div>
        </section>
      );
    }

    if (activeTab === 'Discussions' || activeTab === 'Guides & Astuces') {
      const filteredTopics = activeTab === 'Guides & Astuces' ? topics.filter(t => t.is_pinned) : topics;
      return (
        <section className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="font-display font-800 text-2xl">{activeTab}</h2>
            <button onClick={() => { if(user) { setCreatePostType(activeTab === 'Guides & Astuces' ? 'guide' : 'discussion'); setCreatePostModalOpen(true); } else { showToast('Connectez-vous pour poster'); } }} className="px-5 py-2 bg-emerald-950 text-white rounded-full text-sm font-700">
              <Icon name="PlusIcon" size={16} className="inline mr-2" /> Créer
            </button>
          </div>
          {filteredTopics.length === 0 ? <p className="text-emerald-900/60">Aucune discussion trouvée.</p> : filteredTopics.map(topic => (
            <div key={topic.id} className="bg-white rounded-[0.75rem] p-6 sm:p-8 border border-emerald-900/5 shadow-sm hover:shadow-md transition-shadow active:scale-[0.98] active:opacity-95 transition-all duration-150 cursor-pointer">
              <div className="flex justify-between items-start mb-4">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-950 font-800">
                    {topic.author?.full_name[0] || '?'}
                  </div>
                  <div>
                    <h4 className="font-800">{topic.author?.full_name || 'Anonyme'}</h4>
                    <span className="text-xs text-emerald-900/50 font-600">Le {new Date(topic.created_at).toLocaleDateString('fr-FR')}</span>
                  </div>
                </div>
              </div>
              <h3 className="font-800 text-xl mb-2">{topic.title}</h3>
              <p className="text-emerald-900/80 leading-relaxed text-sm sm:text-base">{topic.content}</p>
              {topic.image_url && (
                <div className="mt-4 w-full h-64 rounded-2xl overflow-hidden bg-emerald-50 relative">
                  <img src={topic.image_url} alt="Image" className="w-full h-full object-cover" />
                </div>
              )}
              <div className="flex flex-col">
                <SocialActions
                  contentId={topic.id}
                  contentType="club"
                  likesCount={topic.likes_count}
                  commentsCount={topic.replies_count}
                  isLiked={likedTopics[topic.id]}
                  onLike={() => handleLikePost(topic.id, topic.likes_count)}
                  onOpenComments={() => handleOpenCommentsSheet(topic)}
                  onShare={handleShare}
                />
              </div>
            </div>
          ))}
        </section>
      );
    }

    if (activeTab === 'Parcours') {
      return (
        <section className="bg-white rounded-[0.75rem] p-8 border border-emerald-900/5 shadow-sm text-center py-20 active:scale-[0.98] active:opacity-95 transition-all duration-150 cursor-pointer">
          <div className="w-20 h-20 bg-emerald-50 rounded-full flex items-center justify-center mx-auto mb-4 text-emerald-900">
            <Icon name="MapIcon" size={32} />
          </div>
          <h2 className="font-display font-800 text-2xl mb-2">Parcours et Traces GPS</h2>
          <p className="text-emerald-900/60 max-w-md mx-auto">La bibliothèque des traces GPS du club est en cours de construction. Revenez bientôt !</p>
        </section>
      );
    }

    // Default 'Tous les contenus'
    return (
      <>
        {/* Upcoming Events Mini */}
        <section>
          <div className="flex items-center justify-between mb-6">
            <h2 className="font-display font-800 text-2xl">Prochaines sorties <span className="text-sm font-600 text-emerald-900/50 ml-2">{events.length} sorties prévues</span></h2>
            <button onClick={() => setActiveTab('Sorties')} className="text-emerald-700 text-sm font-700 hover:underline">Voir tout</button>
          </div>
          <div className="space-y-4">
            {events.slice(0, 3).map((ev, idx) => {
              const dateObj = ev.event_date ? new Date(ev.event_date) : null;
              const month = dateObj ? dateObj.toLocaleDateString('fr-FR', { month: 'short' }).toUpperCase() : 'TBD';
              const day = dateObj ? dateObj.getDate() : '-';
              return (
                <div key={ev.id} className="bg-white rounded-[0.75rem] p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center gap-5 border border-emerald-900/5 shadow-sm hover:shadow-md transition-shadow active:scale-[0.98] active:opacity-95 transition-all duration-150 cursor-pointer">
                  <div className={`w-16 h-16 sm:w-20 sm:h-20 rounded-2xl flex flex-col items-center justify-center shrink-0 ${idx === 0 ? 'bg-emerald-950 text-white' : 'bg-[#F5F3ED] text-emerald-950'}`}>
                    <span className="text-xs font-800 uppercase tracking-wider">{month}</span>
                    <span className="text-2xl sm:text-3xl font-900 leading-none">{day}</span>
                  </div>
                  <div className="flex-1">
                    <h3 className="font-800 text-lg sm:text-xl mb-1">{ev.title}</h3>
                    <div className="flex items-center gap-3 text-sm text-emerald-900/60 font-600 flex-wrap">
                      <span className="flex items-center gap-1"><Icon name="MapPinIcon" size={14} /> {ev.location}</span>
                      <span>•</span>
                      <span className="flex items-center gap-1"><Icon name="UsersIcon" size={14} /> {ev.participants_count}/{ev.max_participants} places</span>
                    </div>
                  </div>
                  <div className="w-full sm:w-auto flex flex-col items-center justify-between sm:justify-end gap-2 mt-4 sm:mt-0">
                    <button
                      onClick={() => handleRegisterEvent(ev.id, ev.participants_count)}
                      className={`px-6 py-2.5 rounded-full text-sm font-700 transition-colors w-full ${registeredEvents[ev.id] ? 'bg-emerald-100 text-emerald-800' : 'bg-emerald-950 text-white hover:bg-emerald-800'}`}
                    >
                      {registeredEvents[ev.id] ? <><Icon name="CheckIcon" size={14} className="inline mr-1" /> Inscrit</> : "S'inscrire"}
                    </button>
                    <button onClick={() => handleViewParticipants(ev.id)} className="px-6 py-2 text-xs font-700 text-emerald-900/60 hover:text-emerald-900 transition-colors">
                      👁️ Voir les participants
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* Feed */}
        <section>
          <div className="flex items-center justify-between mb-6">
            <h2 className="font-display font-800 text-2xl flex items-center gap-3">Fil d'actualité <span className="px-3 py-1 bg-white border border-emerald-900/10 rounded-full text-xs font-700 text-emerald-900/60">Trier par Récent</span></h2>
            <button onClick={() => { if(user){ setCreatePostType('discussion'); setCreatePostModalOpen(true); } else { showToast('Connectez-vous pour poster'); } }} className="text-emerald-950 flex items-center gap-2 text-sm font-700 hover:opacity-80">
              <Icon name="PlusIcon" size={16} /> Créer un post
            </button>
          </div>
          <div className="space-y-6">
            {topics.slice(0, 5).map(topic => (
              <div key={topic.id} className="bg-white rounded-[0.75rem] p-6 sm:p-8 border border-emerald-900/5 shadow-sm active:scale-[0.98] active:opacity-95 transition-all duration-150 cursor-pointer">
                <div className="flex justify-between items-start mb-4">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-950 font-800 text-lg border border-emerald-200">
                      {topic.author?.full_name[0] || '?'}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="font-800 text-base">{topic.author?.full_name || 'Anonyme'}</h4>
                        <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 rounded text-[10px] font-800 uppercase">Auteur</span>
                      </div>
                      <span className="text-xs text-emerald-900/50 font-600">Posté le {new Date(topic.created_at).toLocaleDateString('fr-FR')}</span>
                    </div>
                  </div>
                  <button onClick={() => handleOpenCommentsSheet(topic)} className="text-emerald-900/40 hover:text-emerald-900" title="Commentaires et options"><Icon name="EllipsisHorizontalIcon" size={24} /></button>
                </div>
                <div className="mb-4">
                  <h3 className="font-800 text-xl mb-2">{topic.title}</h3>
                  <p className="text-emerald-900/80 leading-relaxed text-sm sm:text-base">{topic.content}</p>
                  {topic.image_url && (
                    <div className="mt-4 w-full h-64 sm:h-96 rounded-2xl overflow-hidden bg-emerald-50 relative">
                      <img src={topic.image_url} alt="Post image" className="w-full h-full object-cover" />
                    </div>
                  )}
                </div>
                <div className="flex flex-col">
                  <SocialActions
                    contentId={topic.id}
                    contentType="club"
                    likesCount={topic.likes_count}
                    commentsCount={topic.replies_count}
                    isLiked={likedTopics[topic.id]}
                    onLike={() => handleLikePost(topic.id, topic.likes_count)}
                    onOpenComments={() => handleOpenCommentsSheet(topic)}
                    onShare={handleShare}
                  />
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Discussions mini list */}
        <section className="bg-white rounded-[0.75rem] p-6 sm:p-8 border border-emerald-900/5 shadow-sm active:scale-[0.98] active:opacity-95 transition-all duration-150 cursor-pointer">
          <div className="flex items-center justify-between mb-6">
            <h2 className="font-display font-800 text-2xl">Discussions récentes</h2>
            <button onClick={() => setActiveTab('Discussions')} className="px-4 py-2 bg-emerald-950 text-white rounded-full text-xs font-700">Toutes les discussions</button>
          </div>
          <div className="space-y-4">
            {topics.slice(0, 4).map(t => (
              <div key={'list_'+t.id} onClick={() => setActiveTab('Discussions')} className="flex items-center justify-between py-3 border-b border-emerald-900/5 last:border-0 group cursor-pointer">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-950 font-800 text-sm">
                    {t.author?.full_name[0] || '?'}
                  </div>
                  <div>
                    <h4 className="font-700 group-hover:text-emerald-700 transition-colors">{t.title}</h4>
                    <p className="text-xs text-emerald-900/50">Par {t.author?.full_name} • {t.replies_count} réponses</p>
                  </div>
                </div>
                <Icon name="ChevronRightIcon" size={16} className="text-emerald-900/30 group-hover:text-emerald-900 transition-colors" />
              </div>
            ))}
          </div>
        </section>
      </>
    );
  };

  return (
    <>
      {/* ── DESKTOP ── */}
      <div className="hidden md:block">
        <div className="min-h-screen bg-[#F5F3ED] selection:bg-emerald-900/20 font-sans text-emerald-950">
          <Header />
          <main className="pb-24">
            {/* HERO SECTION */}
            <div className="relative w-full max-w-[1440px] mx-auto pt-20 px-4 sm:px-6">
              <div className="relative w-full h-[380px] sm:h-[450px] lg:h-[500px] rounded-[0.75rem] sm:rounded-[3rem] overflow-hidden shadow-2xl flex flex-col justify-end p-6 sm:p-10 lg:p-14">
                <div className="absolute inset-0 z-0">
                  <img
                    src="https://images.unsplash.com/photo-1504280387948-406560940733?q=80&w=2000&auto=format&fit=crop"
                    alt="Club cover"
                    className="w-full h-full object-cover object-center"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-black/10" />
                </div>

                <div className="absolute top-6 left-6 sm:top-10 sm:left-10 z-20 flex items-center gap-2 text-xs sm:text-sm font-600 text-white/80">
                  <Link href="/" className="hover:text-white">Accueil</Link>
                  <span>›</span>
                  <Link href="/clubs" className="hover:text-white">Les Clubs</Link>
                  <span>›</span>
                  <span className="text-white">Activités / Nature</span>
                </div>

                <div className="absolute top-6 right-6 sm:top-10 sm:right-10 z-20 flex items-center gap-3">
                  <button onClick={() => setActiveTab('Tous les contenus')} className="w-8 h-8 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center text-white hover:bg-white/30 transition-colors" title="Rechercher">
                    <Icon name="MagnifyingGlassIcon" size={16} />
                  </button>
                  <Link href={user ? `/profil/${user.id}` : "/auth"} className="w-8 h-8 rounded-full bg-black/50 overflow-hidden border border-white/20 hover:scale-105 transition-transform">
                    <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${user?.id || 'guest'}`} alt="User" />
                  </Link>
                </div>

                <div className="relative z-10 w-full flex flex-col lg:flex-row justify-between items-end gap-6">

                  <div className="max-w-2xl w-full">
                    <div className="flex items-center gap-3 mb-3">
                      <span className="px-3 py-1 bg-white/10 backdrop-blur-md rounded-full text-xs font-700 text-white uppercase tracking-wide border border-white/20">{club.type}</span>
                      <span className="px-3 py-1 bg-white/10 backdrop-blur-md rounded-full text-xs font-700 text-white uppercase tracking-wide border border-white/20">{club.privacy}</span>
                    </div>
                    <h1 className="font-display font-900 text-5xl sm:text-6xl lg:text-7xl text-white mb-4 leading-tight tracking-tight">
                      {club.name}<span className="text-emerald-400">.</span>
                    </h1>

                    <div className="flex items-center gap-6 sm:gap-10 text-white/90 font-500">
                      <div className="flex flex-col">
                        <span className="text-xl sm:text-2xl font-800 text-white">{club.members_count}</span>
                        <span className="text-xs sm:text-sm text-white/70">Membres</span>
                      </div>
                      <div className="w-[1px] h-8 bg-white/20" />
                      <div className="flex flex-col">
                        <span className="text-xl sm:text-2xl font-800 text-emerald-400">{club.active_this_month}</span>
                        <span className="text-xs sm:text-sm text-white/70">En ligne</span>
                      </div>
                      <div className="w-[1px] h-8 bg-white/20" />
                      <div className="flex flex-col">
                        <span className="text-xl sm:text-2xl font-800 text-white">{events.length}</span>
                        <span className="text-xs sm:text-sm text-white/70">Événements</span>
                      </div>
                    </div>
                  </div>

                  <div className="w-full lg:w-auto flex flex-col items-end gap-4">
                    <div className="flex items-center gap-4 bg-black/40 backdrop-blur-xl border border-white/10 p-3 sm:p-4 rounded-[0.75rem] w-full lg:w-auto shadow-2xl">
                      <div className="flex -space-x-3 sm:-space-x-4 cursor-pointer" onClick={() => setActiveTab('Membres')}>
                        {members.slice(0, 4).map((m, i) => (
                          <div key={m.id} className="w-10 h-10 sm:w-12 sm:h-12 rounded-full border-2 border-black/50 overflow-hidden bg-emerald-900 flex justify-center items-center text-xs font-bold text-white z-10" style={{ zIndex: 10 - i }}>
                            {m.user?.full_name[0]}
                          </div>
                        ))}
                        {members.length > 4 && (
                          <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full border-2 border-black/50 bg-white/10 backdrop-blur-md flex justify-center items-center text-xs sm:text-sm font-bold text-white z-0">
                            +{members.length - 4}
                          </div>
                        )}
                      </div>
                      <button
                        onClick={handleToggleMember}
                        disabled={joining}
                        className={`flex-1 lg:flex-none whitespace-nowrap px-5 sm:px-6 py-3 rounded-full font-800 text-sm transition-transform flex items-center justify-center gap-2 ${isMember ? 'bg-white/20 text-white border border-white/30 hover:bg-white/30' : 'bg-white text-black hover:scale-105'}`}
                      >
                        {isMember ? <><Icon name="CheckIcon" size={16} /> Membre</> : <><Icon name="PlusIcon" size={16} /> Rejoindre le club</>}
                      </button>
                    </div>

                    <div className="flex items-center gap-3">
                      <button onClick={() => setActiveTab('Tous les contenus')} className="w-10 h-10 bg-black/40 backdrop-blur-md rounded-full border border-white/10 text-white flex items-center justify-center hover:bg-white/20 transition-colors" title="Tout consulter"><Icon name="MagnifyingGlassIcon" size={16} /></button>
                      <button onClick={handleShare} className="w-10 h-10 bg-black/40 backdrop-blur-md rounded-full border border-white/10 text-white flex items-center justify-center hover:bg-white/20 transition-colors"><Icon name="ShareIcon" size={16} /></button>
                      <button onClick={() => showToast('Options du club')} className="w-10 h-10 bg-black/40 backdrop-blur-md rounded-full border border-white/10 text-white flex items-center justify-center hover:bg-white/20 transition-colors"><Icon name="EllipsisHorizontalIcon" size={16} /></button>
                    </div>
                  </div>

                </div>
              </div>
            </div>

            {/* SUB-NAVIGATION */}
            <div className="max-w-[1440px] mx-auto px-6 mt-8">
              <div className="flex items-center gap-6 overflow-x-auto pb-4 no-scrollbar border-b border-emerald-900/10">
                {TAB_LINKS.map(tab => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={`whitespace-nowrap text-sm sm:text-base font-700 pb-4 relative transition-colors ${activeTab === tab ? 'text-emerald-950' : 'text-emerald-900/50 hover:text-emerald-900/80'}`}
                  >
                    {tab}
                    {activeTab === tab && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-emerald-950 rounded-t-full" />}
                  </button>
                ))}
              </div>
            </div>

            {/* MAIN LAYOUT */}
            <div className="max-w-[1440px] mx-auto px-4 sm:px-6 mt-8 flex flex-col lg:flex-row gap-8 lg:gap-12">

              <div className="flex-[2] space-y-12">
                {renderTabContent()}
              </div>

              {/* RIGHT COLUMN */}
              <div className="flex-1 space-y-6 lg:max-w-[360px]">
                {featuredEvent && (
                  <div className="bg-emerald-950 rounded-[0.75rem] p-6 text-white shadow-xl relative overflow-hidden">
                    <div className="absolute -top-10 -right-10 w-32 h-32 bg-emerald-800 rounded-full blur-[30px] opacity-50 pointer-events-none" />
                    <div className="relative z-10">
                      <div className="flex items-center gap-2 mb-4">
                        <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                        <span className="text-xs font-800 uppercase tracking-widest text-emerald-300">Sortie en vedette</span>
                      </div>
                      <h3 className="font-display font-800 text-2xl mb-2">{featuredEvent.title}</h3>
                      <p className="text-sm text-emerald-100/80 mb-6 line-clamp-2">{featuredEvent.description}</p>

                      <div className="bg-white/10 backdrop-blur-md rounded-2xl p-4 mb-6">
                        <div className="flex items-center gap-3 text-sm font-600 mb-2">
                          <Icon name="CalendarIcon" size={16} className="text-emerald-300" />
                          <span>{featuredEvent.event_date ? new Date(featuredEvent.event_date).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' }) : 'Date à définir'}</span>
                        </div>
                        <div className="flex items-center gap-3 text-sm font-600">
                          <Icon name="MapPinIcon" size={16} className="text-emerald-300" />
                          <span>{featuredEvent.location}</span>
                        </div>
                      </div>

                      <div className="flex flex-col gap-2">
                        <button
                          onClick={() => handleRegisterEvent(featuredEvent.id, featuredEvent.participants_count)}
                          className={`w-full py-4 rounded-xl font-800 transition-colors ${registeredEvents[featuredEvent.id] ? 'bg-white/20 text-white' : 'bg-white text-emerald-950 hover:bg-emerald-50'}`}
                        >
                          {registeredEvents[featuredEvent.id] ? <><Icon name="CheckIcon" size={16} className="inline mr-2" /> Inscrit(e)</> : "S'inscrire"}
                        </button>
                        <button onClick={() => handleViewParticipants(featuredEvent.id)} className="w-full py-2 text-xs font-700 text-white/60 hover:text-white transition-colors">
                          👁️ Voir les participants
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                <div className="bg-white rounded-[0.75rem] p-6 border border-emerald-900/5 shadow-sm active:scale-[0.98] active:opacity-95 transition-all duration-150 cursor-pointer">
                  <h3 className="font-display font-800 text-xl mb-4">À propos du club</h3>
                  <p className="text-sm text-emerald-900/70 mb-6 leading-relaxed">
                    {club.description}
                  </p>

                  <div className="space-y-4 text-sm font-600">
                    <div className="flex items-center justify-between">
                      <span className="text-emerald-900/50 flex items-center gap-2"><Icon name={club.privacy === 'open' ? 'GlobeAltIcon' : 'LockClosedIcon'} size={16} /> Visibilité</span>
                      <span>{club.privacy === 'open' ? 'Public' : 'Privé'}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-emerald-900/50 flex items-center gap-2"><Icon name="MapPinIcon" size={16} /> Localisation</span>
                      <span>{club.location || 'Monde entier'}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-emerald-900/50 flex items-center gap-2"><Icon name="TagIcon" size={16} /> Catégorie</span>
                      <span>{club.category}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-emerald-900/50 flex items-center gap-2"><Icon name="CalendarDaysIcon" size={16} /> Créé le</span>
                      <span>{club.created_at ? new Date(club.created_at).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' }) : '2023'}</span>
                    </div>
                  </div>
                </div>

                <div className="bg-white rounded-[0.75rem] p-6 border border-emerald-900/5 shadow-sm active:scale-[0.98] active:opacity-95 transition-all duration-150 cursor-pointer">
                  <div className="flex items-center justify-between mb-6">
                    <h3 className="font-display font-800 text-xl">Membres de l'équipe</h3>
                    <button onClick={() => setActiveTab('Membres')} className="text-xs font-700 text-emerald-900/40 hover:text-emerald-900">Afficher tout</button>
                  </div>
                  <div className="space-y-4">
                    {admins.map(admin => (
                      <div key={admin.id} className="flex items-center justify-between group hover:bg-emerald-50 p-2 rounded-xl -mx-2 transition-colors">
                        <Link href={admin.user_id ? `/profil/${admin.user_id}` : '/clubs'} className="flex items-center gap-3 group-hover:text-emerald-700 transition-colors">
                          <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-950 font-800 text-sm">
                            {admin.user?.full_name[0] || '?'}
                          </div>
                          <div>
                            <h4 className="font-700 text-sm group-hover:text-emerald-700 transition-colors">{admin.user?.full_name}</h4>
                            <span className="text-[10px] font-800 uppercase tracking-widest text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded">{admin.role}</span>
                          </div>
                        </Link>
                        <button onClick={(e) => { e.stopPropagation(); showToast('Contacter ' + admin.user?.full_name); }} className="w-8 h-8 rounded-full bg-[#F5F3ED] flex items-center justify-center text-emerald-900/50 hover:bg-emerald-200 hover:text-emerald-900 transition-colors">
                          <Icon name="ChatBubbleLeftIcon" size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="bg-gradient-to-br from-amber-100 to-amber-200 rounded-[0.75rem] p-6 text-amber-950 shadow-sm border border-amber-300/50">
                  <div className="flex items-center gap-2 mb-2">
                    <Icon name="StarIcon" size={18} className="text-amber-600" />
                    <span className="text-xs font-800 uppercase tracking-widest text-amber-700">Outils & Avantages</span>
                  </div>
                  <h3 className="font-display font-800 text-lg mb-2">Passez en compte pro pour gérer votre communauté</h3>
                  <p className="text-sm text-amber-900/70 mb-4">Statistiques avancées, outils de modération et événements payants.</p>
                  <button className="px-5 py-2.5 bg-amber-950 text-white rounded-full text-xs font-800 hover:bg-black transition-colors w-full" onClick={() => router.push('/abonnements')}>
                    Découvrir l'offre Club
                  </button>
                </div>
              </div>
            </div>
          </main>
          <Footer />
        </div>
      </div>

      {/* ── MOBILE ── */}
      <div className="block md:hidden">
        <MobilePageShell>
          <div className="min-h-screen bg-[#FBFAF6] pb-28">
            {/* Instagram-grade Cover & Hero Profile Header */}
            <div className="relative">
              {/* Cover Banner Image with immersive gradient */}
              <div className="relative w-full h-44 sm:h-52 overflow-hidden bg-[#17402C]">
                <img
                  src={club.cover_image || "https://images.unsplash.com/photo-1504280387948-406560940733?q=80&w=1200&auto=format&fit=crop"}
                  alt={club.name}
                  className="w-full h-full object-cover brightness-90"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-black/20" />
                
                {/* Top Nav Action Row */}
                <div className="absolute top-4 left-4 right-4 flex items-center justify-between z-10">
                  <button
                    onClick={() => router.push('/clubs')}
                    className="w-9 h-9 rounded-full bg-black/40 backdrop-blur-xl border border-white/25 flex items-center justify-center text-white active:scale-90 transition-transform shadow-md"
                    aria-label="Retour aux clubs"
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="19" y1="12" x2="5" y2="12" />
                      <polyline points="12 19 5 12 12 5" />
                    </svg>
                  </button>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleShare}
                      className="w-9 h-9 rounded-full bg-black/40 backdrop-blur-xl border border-white/25 flex items-center justify-center text-white active:scale-90 transition-transform shadow-md"
                      aria-label="Partager le club"
                    >
                      <Icon name="ShareIcon" size={16} />
                    </button>
                    <button
                      onClick={() => showToast('Options du club')}
                      className="w-9 h-9 rounded-full bg-black/40 backdrop-blur-xl border border-white/25 flex items-center justify-center text-white active:scale-90 transition-transform shadow-md"
                      aria-label="Plus d'options"
                    >
                      <Icon name="EllipsisHorizontalIcon" size={18} />
                    </button>
                  </div>
                </div>
              </div>

              {/* Profile Card Overlay */}
              <div className="px-4 -mt-10 relative z-20">
                <div className="bg-white rounded-[28px] p-5 shadow-[0_8px_30px_rgba(11,31,23,0.08)] border border-[#1C2620]/8 flex flex-col gap-3.5">
                  <div className="flex items-start justify-between gap-3">
                    {/* Club Story Icon */}
                    <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#17402C] to-[#1E5238] border-2 border-white shadow-md flex items-center justify-center text-3xl shrink-0 -mt-10">
                      {club.emoji || '🏕️'}
                    </div>

                    {/* Join / Leave Action Button */}
                    <button
                      onClick={handleToggleMember}
                      disabled={joining}
                      className={`px-5 py-2.5 rounded-2xl text-xs font-bold transition-all shadow-sm flex items-center gap-1.5 active:scale-95 ${
                        isMember
                          ? 'bg-[#F5F2E8] text-[#17402C] border border-[#17402C]/15 hover:bg-[#EAE6DF]'
                          : 'bg-gradient-to-r from-[#17402C] to-[#1E5238] text-white hover:brightness-110 shadow-[0_4px_12px_rgba(23,64,44,0.3)]'
                      }`}
                    >
                      {joining ? (
                        'Patientez...'
                      ) : isMember ? (
                        <><span>✓</span><span>Membre</span></>
                      ) : (
                        <><span>＋</span><span>Rejoindre</span></>
                      )}
                    </button>
                  </div>

                  <div>
                    <div className="flex items-center gap-1.5">
                      <h1 className="font-display font-bold text-xl text-[#1C2620] tracking-tight">
                        {club.name}
                      </h1>
                      {club.is_verified && (
                        <span className="text-xs text-emerald-600 font-bold" title="Club vérifié">✓</span>
                      )}
                    </div>
                    <p className="text-xs text-[#5C6B5E] font-mono mt-0.5">
                      {club.category || 'Outdoor & Randonnée'} · 📍 {club.location || 'France'}
                    </p>
                  </div>

                  {club.description && (
                    <p className="text-xs text-[#1C2620]/80 leading-relaxed font-normal">
                      {club.description}
                    </p>
                  )}

                  {/* Instagram-style Stat Counters */}
                  <div className="grid grid-cols-3 gap-2 pt-3 border-t border-[#1C2620]/6 text-center">
                    <div className="p-2 rounded-xl bg-[#F5F2E8]/60">
                      <span className="block font-display font-bold text-sm text-[#1C2620]">{club.members_count || 1}</span>
                      <span className="text-[10px] text-[#5C6B5E] uppercase tracking-wider font-mono">Membres</span>
                    </div>
                    <div className="p-2 rounded-xl bg-[#F5F2E8]/60">
                      <span className="block font-display font-bold text-sm text-emerald-700">{club.active_this_month || 0}</span>
                      <span className="text-[10px] text-[#5C6B5E] uppercase tracking-wider font-mono">Actifs</span>
                    </div>
                    <div className="p-2 rounded-xl bg-[#F5F2E8]/60">
                      <span className="block font-display font-bold text-sm text-[#1C2620]">{events.length}</span>
                      <span className="text-[10px] text-[#5C6B5E] uppercase tracking-wider font-mono">Sorties</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Segmented Tab Navigation */}
            <div className="px-4 mt-4">
              <div className="flex gap-2 overflow-x-auto pb-2 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
                {TAB_LINKS.map(tab => (
                  <button
                    key={tab}
                    onClick={() => {
                      triggerHaptic('selection');
                      setActiveTab(tab);
                    }}
                    className={`px-4 py-2 rounded-2xl text-xs font-bold whitespace-nowrap transition-all shrink-0 ${
                      activeTab === tab
                        ? 'bg-[#17402C] text-white shadow-[0_2px_8px_rgba(23,64,44,0.25)]'
                        : 'bg-white text-[#5C6B5E] border border-[#1C2620]/8 hover:text-[#1C2620]'
                    }`}
                  >
                    {tab}
                  </button>
                ))}
              </div>
            </div>

            {/* Tab Content Cards */}
            <div className="px-4 mt-2 space-y-3.5">
              {/* SORTIES */}
              {activeTab === 'Sorties' && (
                <div className="space-y-3">
                  {events.length === 0 ? (
                    <div className="text-center py-14 bg-white rounded-3xl p-6 border border-[#1C2620]/6">
                      <span className="text-3xl block mb-2">🏔️</span>
                      <p className="text-xs font-bold text-[#1C2620]">Aucune sortie prévue pour le moment</p>
                    </div>
                  ) : (
                    events.map((ev) => {
                      const dateObj = ev.event_date ? new Date(ev.event_date) : null;
                      return (
                        <div key={ev.id} className="bg-white rounded-3xl p-4 border border-[#1C2620]/8 shadow-sm flex flex-col gap-3">
                          <div className="flex gap-3 items-start">
                            <div className="w-14 h-14 bg-[#17402C] text-white rounded-2xl flex flex-col items-center justify-center shrink-0 shadow-sm">
                              <span className="text-[9px] font-bold uppercase tracking-wider text-[#A8C4A2]">{dateObj ? dateObj.toLocaleDateString('fr-FR', { month: 'short' }).toUpperCase() : 'TBD'}</span>
                              <span className="text-xl font-bold leading-none">{dateObj ? dateObj.getDate() : '-'}</span>
                            </div>
                            <div className="flex-1 min-w-0">
                              <h4 className="font-bold text-sm text-[#1C2620] truncate">{ev.title}</h4>
                              <p className="text-xs text-[#5C6B5E] line-clamp-2 mt-0.5">{ev.description}</p>
                              <div className="flex items-center gap-3 mt-1 text-[11px] text-[#5C6B5E] font-mono">
                                <span>📍 {ev.location}</span>
                                <span>👥 {ev.participants_count}/{ev.max_participants}</span>
                              </div>
                            </div>
                          </div>
                          <button
                            onClick={() => handleRegisterEvent(ev.id, ev.participants_count)}
                            className={`w-full py-2.5 rounded-xl text-xs font-bold transition-all ${
                              registeredEvents[ev.id]
                                ? 'bg-[#EDF3ED] text-[#17402C]'
                                : 'bg-[#17402C] text-white shadow-sm hover:brightness-110'
                            }`}
                          >
                            {registeredEvents[ev.id] ? '✓ Inscrit(e)' : "S'inscrire à la sortie"}
                          </button>
                        </div>
                      );
                    })
                  )}
                </div>
              )}

              {/* MEMBRES */}
              {activeTab === 'Membres' && (
                <div className="bg-white rounded-3xl p-4 border border-[#1C2620]/8 shadow-sm divide-y divide-gray-100">
                  {members.map(member => (
                    <Link
                      key={member.id}
                      href={member.user_id ? `/profil/${member.user_id}` : '/clubs'}
                      className="flex items-center justify-between py-3 first:pt-0 last:pb-0 hover:opacity-80 transition-opacity"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-10 h-10 rounded-full bg-[#17402C]/10 text-[#17402C] flex items-center justify-center font-bold text-sm shrink-0 border border-[#17402C]/15">
                          {member.user?.full_name?.charAt(0) || '👤'}
                        </div>
                        <div className="truncate">
                          <h4 className="font-bold text-xs text-[#1C2620] truncate">{member.user?.full_name || 'Voyageur'}</h4>
                          <span className="text-[10px] text-[#5C6B5E] uppercase font-mono font-bold tracking-wider">{member.role}</span>
                        </div>
                      </div>
                      <span className="text-xs text-[#17402C] font-bold">Voir ➔</span>
                    </Link>
                  ))}
                  {members.length === 0 && <p className="text-xs text-[#5C6B5E] text-center py-6">Aucun membre répertorié.</p>}
                </div>
              )}

              {/* PHOTOS */}
              {activeTab === 'Photos' && (
                <div className="grid grid-cols-2 gap-2.5">
                  {topics.filter(t => t.image_url).map(topic => (
                    <div key={topic.id} className="aspect-square rounded-2xl overflow-hidden bg-gray-100 shadow-sm border border-black/5">
                      <img src={topic.image_url} alt="" className="w-full h-full object-cover" loading="lazy" />
                    </div>
                  ))}
                  {topics.filter(t => t.image_url).length === 0 && (
                    <div className="col-span-2 py-12 text-center bg-white rounded-3xl border border-[#1C2620]/6">
                      <span className="text-3xl block mb-1">📷</span>
                      <p className="text-xs text-[#5C6B5E]">Aucune photo partagée dans ce club.</p>
                    </div>
                  )}
                </div>
              )}

              {/* DISCUSSIONS & GUIDES */}
              {(activeTab === 'Discussions' || activeTab === 'Guides & Astuces') && (
                <div className="space-y-3">
                  {topics.filter(t => activeTab === 'Guides & Astuces' ? t.is_pinned : true).length === 0 ? (
                    <div className="text-center py-12 bg-white rounded-3xl p-6 border border-[#1C2620]/6">
                      <span className="text-3xl block mb-2">💬</span>
                      <p className="text-xs text-[#5C6B5E]">Aucune discussion publiée.</p>
                    </div>
                  ) : (
                    topics.filter(t => activeTab === 'Guides & Astuces' ? t.is_pinned : true).map(topic => (
                      <div key={topic.id} className="bg-white rounded-3xl p-4 border border-[#1C2620]/8 shadow-sm flex flex-col gap-2.5">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div className="w-8 h-8 rounded-full bg-[#17402C]/10 text-[#17402C] flex items-center justify-center font-bold text-xs shrink-0 border border-[#17402C]/15">
                              {topic.author?.full_name?.charAt(0) || '👤'}
                            </div>
                            <div className="min-w-0">
                              <h5 className="font-bold text-xs text-[#1C2620] truncate">{topic.author?.full_name || 'Anonyme'}</h5>
                              <span className="text-[10px] text-[#5C6B5E] font-mono">{new Date(topic.created_at).toLocaleDateString('fr-FR')}</span>
                            </div>
                          </div>
                          <span className="px-2 py-0.5 bg-[#F5F2E8] text-[#17402C] rounded-full text-[9px] font-mono font-bold uppercase tracking-wider">
                            Discussion
                          </span>
                        </div>

                        <h4 className="font-bold text-sm text-[#1C2620]">{topic.title}</h4>
                        <p className="text-xs text-[#1C2620]/80 leading-relaxed font-normal">{topic.content}</p>

                        <SocialActions
                          contentId={topic.id}
                          contentType="club"
                          likesCount={topic.likes_count}
                          commentsCount={topic.replies_count}
                          isLiked={likedTopics[topic.id]}
                          onLike={() => handleLikePost(topic.id, topic.likes_count)}
                          onOpenComments={() => handleOpenCommentsSheet(topic)}
                          onShare={handleShare}
                        />
                      </div>
                    ))
                  )}
                </div>
              )}

              {/* DEFAULT FEED 'TOUS LES CONTENUS' */}
              {activeTab === 'Tous les contenus' && (
                <div className="space-y-4">
                  {/* Exact Reference Composer Card for Club */}
                  <div
                    onClick={() => {
                      triggerHaptic('selection');
                      router.push(`/communaute/publier?clubId=${club.id}&clubName=${encodeURIComponent(club.name)}`);
                    }}
                    className="p-3 bg-white text-[#1C2620] rounded-[20px] shadow-[0_2px_12px_rgba(11,31,23,0.04)] border border-[#1C2620]/6 flex items-center justify-between cursor-pointer transition-all active:scale-[0.98]"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#17402C] to-[#2D6B4A] text-white flex items-center justify-center font-serif italic text-base shrink-0 shadow-sm">
                        {user?.user_metadata?.full_name?.charAt(0)?.toUpperCase() || user?.email?.charAt(0)?.toUpperCase() || 'M'}
                      </div>
                      <p className="text-xs text-[#5C6B5E] font-normal truncate">
                        Partager un <em className="font-serif italic text-[#17402C]">récit</em> ou une photo dans le club...
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        className="w-8 h-8 rounded-xl bg-[#F5F2E8] text-[#17402C] flex items-center justify-center hover:bg-[#EAE6DF] transition-colors"
                        aria-label="Ajouter une photo"
                      >
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                          <rect x="3" y="3" width="18" height="18" rx="3" />
                          <circle cx="8.5" cy="8.5" r="1.5" />
                          <polyline points="21 15 16 10 5 21" />
                        </svg>
                      </button>
                      <button
                        type="button"
                        className="w-8 h-8 rounded-xl bg-[#F5F2E8] text-[#17402C] flex items-center justify-center hover:bg-[#EAE6DF] transition-colors"
                        aria-label="Ajouter un lieu"
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                          <circle cx="12" cy="10" r="3" />
                          <path d="M12 2a8 8 0 0 1 8 8c0 6-8 12-8 12S4 16 4 10a8 8 0 0 1 8-8z" />
                        </svg>
                      </button>
                    </div>
                  </div>

                  {/* Topics feed */}
                  {topics.slice(0, 5).map(topic => (
                    <div key={topic.id} className="bg-white rounded-[24px] p-4 sm:p-5 border border-[#1C2620]/8 shadow-[0_2px_12px_rgba(11,31,23,0.03)] hover:shadow-md transition-shadow duration-200 flex flex-col gap-3.5">
                      {/* Header : Author info, Origin/Time & context menu */}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3 min-w-0">
                          <a
                            href={topic.author?.full_name ? `#` : '#'}
                            className="w-10 h-10 rounded-full bg-[#EDF3ED] text-[#17402C] border border-[#A8C4A2] flex items-center justify-center font-serif italic text-lg overflow-hidden shrink-0 hover:opacity-90 transition-opacity shadow-sm"
                          >
                            {topic.author?.avatar_url ? (
                              <img
                                src={topic.author?.avatar_url}
                                alt={topic.author?.full_name}
                                className="w-full h-full object-cover"
                                loading="lazy"
                              />
                            ) : (
                              <span>{topic.author?.full_name?.charAt(0)?.toUpperCase() || 'P'}</span>
                            )}
                          </a>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-sm text-[#1C2620] tracking-tight truncate">
                                {topic.author?.full_name || 'Voyageur'}
                              </span>
                            </div>
                            <div className="flex items-center gap-1.5 text-[11px] text-[#5C6B5E] font-mono mt-0.5">
                              <span>{new Date(topic.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}</span>
                              <span>·</span>
                              <span className="text-[#17402C] font-medium truncate">
                                {club.name}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* 3 Dots at top right */}
                        <button
                          type="button"
                          onClick={() => handleOpenCommentsSheet(topic)}
                          className="w-8 h-8 rounded-full flex items-center justify-center text-[#5C6B5E]/60 hover:text-[#1C2620] hover:bg-[#F5F2E8] transition-colors"
                          aria-label="Options"
                        >
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18" strokeLinecap="round">
                            <circle cx="5" cy="12" r="1" fill="currentColor" />
                            <circle cx="12" cy="12" r="1" fill="currentColor" />
                            <circle cx="19" cy="12" r="1" fill="currentColor" />
                          </svg>
                        </button>
                      </div>

                      {/* Body content */}
                      <div className="text-sm text-[#1C2620] leading-relaxed break-words font-sans">
                        <h4 className="font-bold text-sm text-[#1C2620] mb-1">{topic.title}</h4>
                        <p className="whitespace-pre-line text-[#1C2620]/90">
                          {topic.content}
                        </p>
                      </div>

                      {/* Media attachment with top-right date mono badge & bottom-left geo badge ONLY if image_url exists */}
                      {topic.image_url && (
                        <div className="relative w-full rounded-2xl overflow-hidden bg-black/5 max-h-80 flex items-center justify-center border border-[#1C2620]/5 group">
                          <img
                            src={topic.image_url}
                            alt="Média publication"
                            className="w-full h-auto max-h-80 object-cover rounded-2xl"
                            loading="lazy"
                          />
                          <div className="absolute top-2.5 right-2.5 px-2.5 py-1 bg-black/60 backdrop-blur-md rounded-full text-[10px] font-mono text-white tracking-wider">
                            {new Date(topic.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
                          </div>
                        </div>
                      )}

                      {/* Standardized SocialActions Component */}
                      <SocialActions
                        contentId={topic.id}
                        contentType="club"
                        likesCount={topic.likes_count}
                        commentsCount={topic.replies_count}
                        isLiked={likedTopics[topic.id]}
                        onLike={() => handleLikePost(topic.id, topic.likes_count)}
                        onOpenComments={() => handleOpenCommentsSheet(topic)}
                        onShare={handleShare}
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
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

      {/* CREATE POST MODAL (Same as community) */}
      {createPostModalOpen && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-[24px] w-full max-w-lg shadow-2xl overflow-hidden animate-slide-up flex flex-col border border-[#1C2620]/10">
            <div className="p-5 border-b border-[#1C2620]/8 flex justify-between items-center bg-[#FBFAF6]">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-[#17402C]/10 text-[#17402C] flex items-center justify-center font-bold text-xs">
                  🏕️
                </div>
                <h3 className="font-display font-bold text-base text-[#1C2620]">
                  Publier dans {club.name}
                </h3>
              </div>
              <button
                onClick={() => setCreatePostModalOpen(false)}
                className="text-[#5C6B5E] hover:text-[#1C2620] bg-white border border-[#1C2620]/10 w-8 h-8 rounded-full flex items-center justify-center transition-colors shadow-sm"
              >
                <Icon name="XMarkIcon" size={18} />
              </button>
            </div>

            <form onSubmit={handleCreatePost} className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-bold text-[#1C2620] uppercase tracking-wider mb-1.5 font-mono">
                  Titre du récit ou sujet
                </label>
                <input
                  type="text"
                  value={newPostTitle}
                  onChange={(e) => setNewPostTitle(e.target.value)}
                  placeholder="Ex: Nuit au refuge du Habert..."
                  className="w-full bg-[#F5F2E8]/60 border border-[#1C2620]/10 rounded-2xl px-4 py-3 text-xs text-[#1C2620] focus:ring-2 focus:ring-[#17402C] outline-none font-medium"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#1C2620] uppercase tracking-wider mb-1.5 font-mono">
                  Votre message
                </label>
                <textarea
                  value={newPostContent}
                  onChange={(e) => setNewPostContent(e.target.value)}
                  placeholder="Partagez vos impressions, conditions météo, matériel testé..."
                  className="w-full bg-[#F5F2E8]/60 border border-[#1C2620]/10 rounded-2xl px-4 py-3 min-h-[140px] text-xs text-[#1C2620] focus:ring-2 focus:ring-[#17402C] outline-none font-normal resize-none"
                  required
                />
              </div>

              <div className="pt-2 flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => showToast('Lieu défini sur ' + (club.location || club.name))}
                    className="w-9 h-9 rounded-xl bg-[#F5F2E8] text-[#17402C] flex items-center justify-center hover:bg-[#EAE6DF] transition-colors border border-[#17402C]/10"
                    title="Lieu"
                  >
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="10" r="3" />
                      <path d="M12 2a8 8 0 0 1 8 8c0 6-8 12-8 12S4 16 4 10a8 8 0 0 1 8-8z" />
                    </svg>
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setCreatePostModalOpen(false)}
                    className="px-4 py-2.5 text-[#5C6B5E] hover:text-[#1C2620] font-bold text-xs transition-colors"
                  >
                    Annuler
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="px-6 py-2.5 bg-[#17402C] text-white font-bold rounded-2xl text-xs hover:bg-[#122E20] shadow-[0_4px_16px_rgba(23,64,44,0.25)] transition-all disabled:opacity-50 active:scale-95"
                  >
                    {submitting ? 'Publication...' : 'Publier dans le club'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* PARTICIPANTS MODAL */}
      {participantsModalOpen && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-[0.75rem] w-full max-w-sm shadow-2xl overflow-hidden animate-slide-up flex flex-col max-h-[80vh] active:scale-[0.98] active:opacity-95 transition-all duration-150 cursor-pointer">
            <div className="p-6 border-b border-emerald-900/10 flex justify-between items-center">
              <h3 className="font-display font-800 text-xl text-emerald-950">
                Membres inscrits ({eventParticipants.length})
              </h3>
              <button onClick={() => setParticipantsModalOpen(false)} className="text-emerald-900/50 hover:text-emerald-900 bg-emerald-50 w-8 h-8 rounded-full flex items-center justify-center">
                <Icon name="XMarkIcon" size={20} />
              </button>
            </div>
            <div className="p-4 overflow-y-auto flex-1 space-y-3">
              {eventParticipants.length === 0 ? (
                <div className="text-center py-10 text-emerald-900/50 font-600">
                  Personne n'est encore inscrit à cette sortie.
                </div>
              ) : (
                eventParticipants.map(participant => (
                  <Link
                    key={participant.user_id}
                    href={participant.user_id ? `/profil/${participant.user_id}` : '/clubs'}
                    className="flex items-center gap-4 p-3 hover:bg-emerald-50 rounded-2xl transition-colors cursor-pointer border border-transparent hover:border-emerald-100"
                  >
                    <div className="relative">
                      <div className="w-12 h-12 rounded-full overflow-hidden border-2 border-white shadow-sm bg-emerald-100 flex items-center justify-center text-emerald-950 font-800 text-lg">
                        {participant.user?.avatar_url ? (
                          <img src={participant.user.avatar_url} alt={participant.user.full_name} className="w-full h-full object-cover" />
                        ) : (
                          participant.user?.full_name[0] || '?'
                        )}
                      </div>
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
        <div className="fixed bottom-10 left-1/2 -translate-x-1/2 z-[300] bg-emerald-950 text-white px-8 py-4 rounded-full text-sm font-700 shadow-2xl shadow-black/50 animate-fade-in-up flex items-center gap-3">
          <Icon name="CheckCircleIcon" size={18} className="text-white/70" />
          {toast}
        </div>
      )}
    </>
  );
}
