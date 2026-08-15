'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import MobilePageShell from '@/components/mobile-nav/MobilePageShell';
import Icon from '@/components/ui/AppIcon';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface Club {
  id: string;
  slug: string;
  name: string;
  type: 'activité' | 'pays';
  emoji: string;
  description: string;
  cover_color: string;
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

  const handleLoadReplies = async (topicId: string) => {
    const { data } = await supabase.from('club_topic_replies').select('*, author:user_profiles(full_name, avatar_url)').eq('topic_id', topicId).order('created_at', { ascending: true });
    if (data) {
      setTopicReplies(prev => ({ ...prev, [topicId]: data }));
    }
  };

  const handleCreateReply = async (topicId: string) => {
    if (!user) { showToast('Connectez-vous pour répondre'); return; }
    if (!replyContent.trim()) return;

    const { data, error } = await supabase.from('club_topic_replies').insert({
      topic_id: topicId,
      author_id: user.id,
      content: replyContent
    }).select('*, author:user_profiles(full_name, avatar_url)').single();

    if (!error && data) {
      setReplyContent('');
      setReplyingToTopic(null);
      setTopicReplies(prev => ({
        ...prev,
        [topicId]: [...(prev[topicId] || []), data]
      }));
      const topic = topics.find(t => t.id === topicId);
      if (topic) {
        await supabase.from('club_topics').update({ replies_count: (topic.replies_count || 0) + 1 }).eq('id', topicId);
        setTopics(topics.map(t => t.id === topicId ? { ...t, replies_count: (t.replies_count || 0) + 1 } : t));
      }
      showToast("Réponse publiée !");
    } else {
      showToast("Erreur lors de la publication");
    }
  };

  // Répondre directement à un membre précis
  const startReplyTo = (topicId: string, authorName?: string) => {
    if (!user) { showToast('Connectez-vous pour répondre'); return; }
    setReplyingToTopic(topicId);
    setReplyContent(authorName ? `@${authorName} ` : '');
    handleLoadReplies(topicId);
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
                  <div className="h-64 bg-emerald-900/10 rounded-[2rem]" />
                  <div className="h-96 bg-emerald-900/10 rounded-[2rem]" />
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
              <div className="w-20 h-20 rounded-3xl bg-emerald-900/10 flex items-center justify-center mb-6">
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
              <div key={ev.id} className="bg-white rounded-3xl p-6 flex flex-col sm:flex-row items-start sm:items-center gap-6 border border-emerald-900/5 shadow-sm">
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
        <section className="bg-white rounded-[2rem] p-8 border border-emerald-900/5 shadow-sm">
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
        <section className="bg-white rounded-[2rem] p-8 border border-emerald-900/5 shadow-sm">
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
            <div key={topic.id} className="bg-white rounded-[2rem] p-6 sm:p-8 border border-emerald-900/5 shadow-sm hover:shadow-md transition-shadow">
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
                <div className="flex items-center gap-6 pt-4 border-t border-emerald-900/5 mt-4 text-sm font-700 text-emerald-900/60">
                  <button onClick={() => handleLikePost(topic.id, topic.likes_count)} className={`flex items-center gap-2 transition-colors ${likedTopics[topic.id] ? 'text-rose-500' : 'hover:text-emerald-600'}`}>
                    {likedTopics[topic.id] ? <Icon name="HeartIconSolid" size={18} /> : <Icon name="HeartIcon" size={18} />} {topic.likes_count}
                  </button>
                  <button onClick={() => { setReplyingToTopic(replyingToTopic === topic.id ? null : topic.id); if (replyingToTopic !== topic.id) handleLoadReplies(topic.id); }} className={`flex items-center gap-2 transition-colors ${replyingToTopic === topic.id ? 'text-emerald-700' : 'hover:text-emerald-600'}`}>
                    <Icon name="ChatBubbleLeftIcon" size={18} /> {topic.replies_count}
                  </button>
                </div>
                {replyingToTopic === topic.id && (
                  <div className="mt-6 pt-6 border-t border-emerald-900/5">
                    <div className="space-y-4 mb-6">
                      {topicReplies[topic.id]?.map(reply => (
                        <div key={reply.id} className="flex gap-3">
                          <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-950 font-800 text-xs shrink-0">
                            {reply.author?.full_name[0] || '?'}
                          </div>
                          <div className="bg-emerald-50 rounded-2xl rounded-tl-none p-4 flex-1">
                            <div className="flex justify-between items-baseline mb-1">
                              <span className="font-800 text-sm">{reply.author?.full_name || 'Anonyme'}</span>
                              <span className="text-[10px] text-emerald-900/50 flex items-center gap-2">
                                {new Date(reply.created_at).toLocaleDateString('fr-FR')}
                                <button onClick={() => startReplyTo(topic.id, reply.author?.full_name)} className="font-700 text-emerald-700 hover:underline">Répondre</button>
                              </span>
                            </div>
                            <p className="text-sm text-emerald-900/80">{reply.content}</p>
                          </div>
                        </div>
                      ))}
                      {(!topicReplies[topic.id] || topicReplies[topic.id].length === 0) && (
                        <p className="text-sm text-emerald-900/40 italic">Aucun commentaire pour l'instant.</p>
                      )}
                    </div>
                    <div className="flex gap-3">
                      <input
                        type="text"
                        value={replyContent}
                        onChange={(e) => setReplyContent(e.target.value)}
                        placeholder="Écrire un commentaire..."
                        className="flex-1 bg-emerald-900/5 border-none rounded-full px-4 py-2 text-sm focus:ring-2 focus:ring-emerald-500"
                      />
                      <button onClick={() => handleCreateReply(topic.id)} className="px-4 py-2 bg-emerald-950 text-white rounded-full text-sm font-700 hover:bg-emerald-800">
                        Envoyer
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))}
        </section>
      );
    }

    if (activeTab === 'Parcours') {
      return (
        <section className="bg-white rounded-[2rem] p-8 border border-emerald-900/5 shadow-sm text-center py-20">
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
                <div key={ev.id} className="bg-white rounded-3xl p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center gap-5 border border-emerald-900/5 shadow-sm hover:shadow-md transition-shadow">
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
              <div key={topic.id} className="bg-white rounded-[2rem] p-6 sm:p-8 border border-emerald-900/5 shadow-sm">
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
                  <button onClick={() => { setReplyingToTopic(replyingToTopic === topic.id ? null : topic.id); if (replyingToTopic !== topic.id) handleLoadReplies(topic.id); }} className="text-emerald-900/40 hover:text-emerald-900" title="Voir les réponses"><Icon name="EllipsisHorizontalIcon" size={24} /></button>
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
                  <div className="flex items-center gap-6 pt-4 border-t border-emerald-900/5 text-sm font-700 text-emerald-900/60">
                    <button onClick={() => handleLikePost(topic.id, topic.likes_count)} className={`flex items-center gap-2 transition-colors ${likedTopics[topic.id] ? 'text-rose-500' : 'hover:text-emerald-600'}`}>
                      {likedTopics[topic.id] ? <Icon name="HeartIconSolid" size={18} /> : <Icon name="HeartIcon" size={18} />} {topic.likes_count}
                    </button>
                    <button onClick={() => { setReplyingToTopic(replyingToTopic === topic.id ? null : topic.id); if (replyingToTopic !== topic.id) handleLoadReplies(topic.id); }} className={`flex items-center gap-2 transition-colors ${replyingToTopic === topic.id ? 'text-emerald-700' : 'hover:text-emerald-600'}`}>
                      <Icon name="ChatBubbleLeftIcon" size={18} /> {topic.replies_count}
                    </button>
                    <button onClick={handleShare} className="flex items-center gap-2 hover:text-emerald-600 transition-colors ml-auto">
                      <Icon name="ShareIcon" size={18} /> Partager
                    </button>
                  </div>
                  {replyingToTopic === topic.id && (
                    <div className="mt-6 pt-6 border-t border-emerald-900/5">
                      <div className="space-y-4 mb-6">
                        {topicReplies[topic.id]?.map(reply => (
                          <div key={reply.id} className="flex gap-3">
                            <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-950 font-800 text-xs shrink-0">
                              {reply.author?.full_name[0] || '?'}
                            </div>
                            <div className="bg-emerald-50 rounded-2xl rounded-tl-none p-4 flex-1">
                              <div className="flex justify-between items-baseline mb-1">
                                <span className="font-800 text-sm">{reply.author?.full_name || 'Anonyme'}</span>
                                <span className="text-[10px] text-emerald-900/50 flex items-center gap-2">
                                  {new Date(reply.created_at).toLocaleDateString('fr-FR')}
                                  <button onClick={() => startReplyTo(topic.id, reply.author?.full_name)} className="font-700 text-emerald-700 hover:underline">Répondre</button>
                                </span>
                              </div>
                              <p className="text-sm text-emerald-900/80">{reply.content}</p>
                            </div>
                          </div>
                        ))}
                        {(!topicReplies[topic.id] || topicReplies[topic.id].length === 0) && (
                          <p className="text-sm text-emerald-900/40 italic">Aucun commentaire pour l'instant.</p>
                        )}
                      </div>
                      <div className="flex gap-3">
                        <input
                          type="text"
                          value={replyContent}
                          onChange={(e) => setReplyContent(e.target.value)}
                          placeholder="Écrire un commentaire..."
                          className="flex-1 bg-emerald-900/5 border-none rounded-full px-4 py-2 text-sm focus:ring-2 focus:ring-emerald-500"
                        />
                        <button onClick={() => handleCreateReply(topic.id)} className="px-4 py-2 bg-emerald-950 text-white rounded-full text-sm font-700 hover:bg-emerald-800">
                          Envoyer
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Discussions mini list */}
        <section className="bg-white rounded-[2rem] p-6 sm:p-8 border border-emerald-900/5 shadow-sm">
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
              <div className="relative w-full h-[380px] sm:h-[450px] lg:h-[500px] rounded-[2rem] sm:rounded-[3rem] overflow-hidden shadow-2xl flex flex-col justify-end p-6 sm:p-10 lg:p-14">
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
                    <div className="flex items-center gap-4 bg-black/40 backdrop-blur-xl border border-white/10 p-3 sm:p-4 rounded-3xl w-full lg:w-auto shadow-2xl">
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
                  <div className="bg-emerald-950 rounded-[2rem] p-6 text-white shadow-xl relative overflow-hidden">
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

                <div className="bg-white rounded-[2rem] p-6 border border-emerald-900/5 shadow-sm">
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

                <div className="bg-white rounded-[2rem] p-6 border border-emerald-900/5 shadow-sm">
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

                <div className="bg-gradient-to-br from-amber-100 to-amber-200 rounded-[2rem] p-6 text-amber-950 shadow-sm border border-amber-300/50">
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
          <div>
            {/* Hero */}
            <div style={{ background: 'linear-gradient(to bottom, #0B1F17, #17402C)', borderRadius: '0 0 24px 24px', padding: '24px 16px', marginBottom: '16px', position: 'relative', overflow: 'hidden' }}>
              <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.6)', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>
                <Link href="/clubs" style={{ color: 'rgba(255,255,255,0.6)', textDecoration: 'none' }}>Clubs</Link> › {club.type}
              </div>
              <h1 style={{ fontSize: '28px', fontWeight: 800, color: '#fff', marginBottom: '4px', letterSpacing: '-0.02em', lineHeight: 1.1 }}>
                {club.name}
              </h1>
              <div style={{ display: 'flex', gap: '16px', marginBottom: '16px', color: 'rgba(255,255,255,0.7)', fontSize: '12px' }}>
                <span><strong style={{ color: '#fff' }}>{club.members_count}</strong> membres</span>
                <span><strong style={{ color: '#A3C4A3' }}>{club.active_this_month}</strong> en ligne</span>
                <span><strong style={{ color: '#fff' }}>{events.length}</strong> événements</span>
              </div>
              <button
                onClick={handleToggleMember}
                disabled={joining}
                style={{
                  padding: '10px 24px',
                  borderRadius: '999px',
                  border: 'none',
                  fontSize: '13px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  background: isMember ? 'rgba(255,255,255,0.2)' : '#fff',
                  color: isMember ? '#fff' : '#0B1F17',
                  width: '100%',
                  fontFamily: 'inherit',
                }}
              >
                {isMember ? '✓ Membre' : 'Rejoindre le club'}
              </button>
            </div>

            {/* Sub-navigation tabs */}
            <div style={{ display: 'flex', gap: '4px', overflowX: 'auto', padding: '0 16px 12px', marginBottom: '8px', borderBottom: '1px solid rgba(11,31,23,0.06)', WebkitOverflowScrolling: 'touch' }}>
              {TAB_LINKS.map(tab => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  style={{
                    padding: '8px 14px',
                    borderRadius: '20px',
                    border: 'none',
                    fontSize: '12px',
                    fontWeight: 600,
                    whiteSpace: 'nowrap',
                    cursor: 'pointer',
                    background: activeTab === tab ? '#17402C' : 'transparent',
                    color: activeTab === tab ? '#fff' : '#6B7A72',
                    fontFamily: 'inherit',
                    flexShrink: 0,
                  }}
                >
                  {tab}
                </button>
              ))}
            </div>

            {/* Tab content */}
            <div style={{ padding: '0 16px 16px' }}>
              {/* Render a simplified version of tab content */}
              {activeTab === 'Sorties' && (
                <div>
                  {events.length === 0 ? (
                    <p style={{ color: '#6B7A72', fontSize: '13px' }}>Aucune sortie prévue.</p>
                  ) : events.map((ev) => {
                    const dateObj = ev.event_date ? new Date(ev.event_date) : null;
                    return (
                      <div key={ev.id} style={{ background: '#FBFAF6', borderRadius: '16px', padding: '14px', marginBottom: '12px', border: '1px solid rgba(11,31,23,0.06)' }}>
                        <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                          <div style={{ width: '56px', height: '56px', background: '#0B1F17', color: '#fff', borderRadius: '12px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                            <span style={{ fontSize: '9px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{dateObj ? dateObj.toLocaleDateString('fr-FR', { month: 'short' }).toUpperCase() : 'TBD'}</span>
                            <span style={{ fontSize: '20px', fontWeight: 900, lineHeight: 1 }}>{dateObj ? dateObj.getDate() : '-'}</span>
                          </div>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontSize: '14px', fontWeight: 700, color: '#0B1F17', marginBottom: '4px' }}>{ev.title}</div>
                            <div style={{ fontSize: '11px', color: '#6B7A72', marginBottom: '8px' }}>{ev.description}</div>
                            <div style={{ display: 'flex', gap: '12px', fontSize: '11px', color: '#6B7A72' }}>
                              <span>📍 {ev.location}</span>
                              <span>👥 {ev.participants_count}/{ev.max_participants}</span>
                            </div>
                          </div>
                        </div>
                        <button
                          onClick={() => handleRegisterEvent(ev.id, ev.participants_count)}
                          style={{
                            marginTop: '10px',
                            padding: '8px 20px',
                            borderRadius: '999px',
                            border: 'none',
                            fontSize: '12px',
                            fontWeight: 700,
                            cursor: 'pointer',
                            width: '100%',
                            background: registeredEvents[ev.id] ? '#EDF3ED' : '#0B1F17',
                            color: registeredEvents[ev.id] ? '#17402C' : '#fff',
                            fontFamily: 'inherit',
                          }}
                        >
                          {registeredEvents[ev.id] ? '✓ Inscrit' : "S'inscrire"}
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
              {activeTab === 'Membres' && (
                <div>
                  {members.map(member => (
                    <Link
                      key={member.id}
                      href={member.user_id ? `/profil/${member.user_id}` : '/clubs'}
                      style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 0', borderBottom: '1px solid rgba(11,31,23,0.04)', textDecoration: 'none' }}
                    >
                      <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: '#EDF3ED', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, color: '#0B1F17', fontSize: '14px' }}>
                        {member.user?.full_name[0] || '?'}
                      </div>
                      <div>
                        <div style={{ fontSize: '13px', fontWeight: 700, color: '#0B1F17' }}>{member.user?.full_name}</div>
                        <div style={{ fontSize: '10px', color: '#6B7A72', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.05em' }}>{member.role}</div>
                      </div>
                    </Link>
                  ))}
                  {members.length === 0 && <p style={{ color: '#6B7A72', fontSize: '13px' }}>Aucun membre.</p>}
                </div>
              )}
              {activeTab === 'Photos' && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                  {topics.filter(t => t.image_url).map(topic => (
                    <div key={topic.id} style={{ aspectRatio: '1/1', borderRadius: '12px', overflow: 'hidden', background: '#EDF3ED' }}>
                      <img src={topic.image_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    </div>
                  ))}
                  {topics.filter(t => t.image_url).length === 0 && <p style={{ color: '#6B7A72', fontSize: '13px', gridColumn: '1/-1' }}>Aucune photo.</p>}
                </div>
              )}
              {(activeTab === 'Discussions' || activeTab === 'Guides & Astuces') && (
                <div>
                  {topics.filter(t => activeTab === 'Guides & Astuces' ? t.is_pinned : true).length === 0 ? (
                    <p style={{ color: '#6B7A72', fontSize: '13px' }}>Aucune discussion.</p>
                  ) : topics.filter(t => activeTab === 'Guides & Astuces' ? t.is_pinned : true).map(topic => (
                    <div key={topic.id} style={{ background: '#FBFAF6', borderRadius: '16px', padding: '14px', marginBottom: '12px', border: '1px solid rgba(11,31,23,0.06)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                        <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: '#EDF3ED', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, color: '#0B1F17', fontSize: '12px' }}>
                          {topic.author?.full_name[0] || '?'}
                        </div>
                        <div>
                          <div style={{ fontSize: '12px', fontWeight: 700, color: '#0B1F17' }}>{topic.author?.full_name || 'Anonyme'}</div>
                          <div style={{ fontSize: '10px', color: '#6B7A72' }}>{new Date(topic.created_at).toLocaleDateString('fr-FR')}</div>
                        </div>
                      </div>
                      <div style={{ fontSize: '14px', fontWeight: 700, color: '#0B1F17', marginBottom: '4px' }}>{topic.title}</div>
                      <div style={{ fontSize: '12px', color: '#0B1F17', opacity: 0.8, marginBottom: '8px' }}>{topic.content}</div>
                      <div style={{ display: 'flex', gap: '12px', fontSize: '11px', color: '#6B7A72' }}>
                        <span>❤️ {topic.likes_count}</span>
                        <span>💬 {topic.replies_count}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {activeTab === 'Parcours' && (
                <div style={{ textAlign: 'center', padding: '40px 0', color: '#6B7A72' }}>
                  <div style={{ fontSize: '32px', marginBottom: '8px' }}>🗺️</div>
                  <p style={{ fontSize: '13px' }}>Parcours en construction.</p>
                </div>
              )}
              {/* Default 'Tous les contenus' tab - show feed + events + discussions */}
              {activeTab === 'Tous les contenus' && (
                <>
                  {/* Upcoming events */}
                  {events.length > 0 && (
                    <div style={{ marginBottom: '20px' }}>
                      <div style={{ fontSize: '16px', fontWeight: 800, color: '#0B1F17', marginBottom: '10px' }}>Prochaines sorties</div>
                      {events.slice(0, 3).map((ev) => {
                        const dateObj = ev.event_date ? new Date(ev.event_date) : null;
                        return (
                          <div key={ev.id} style={{ background: '#FBFAF6', borderRadius: '14px', padding: '12px', marginBottom: '8px', border: '1px solid rgba(11,31,23,0.06)' }}>
                            <div style={{ fontSize: '13px', fontWeight: 700, color: '#0B1F17' }}>{ev.title}</div>
                            <div style={{ fontSize: '11px', color: '#6B7A72', marginTop: '4px' }}>📍 {ev.location} · {dateObj ? dateObj.toLocaleDateString('fr-FR') : 'Date TBD'}</div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Recent posts */}
                  {topics.length > 0 && (
                    <div>
                      <div style={{ fontSize: '16px', fontWeight: 800, color: '#0B1F17', marginBottom: '10px' }}>Fil d'actualité</div>
                      {topics.slice(0, 5).map(topic => (
                        <div key={topic.id} style={{ background: '#FBFAF6', borderRadius: '16px', padding: '14px', marginBottom: '12px', border: '1px solid rgba(11,31,23,0.06)' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                            <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: '#EDF3ED', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, color: '#0B1F17', fontSize: '12px' }}>
                              {topic.author?.full_name[0] || '?'}
                            </div>
                            <div>
                              <div style={{ fontSize: '12px', fontWeight: 700, color: '#0B1F17' }}>{topic.author?.full_name || 'Anonyme'}</div>
                              <div style={{ fontSize: '10px', color: '#6B7A72' }}>{new Date(topic.created_at).toLocaleDateString('fr-FR')}</div>
                            </div>
                          </div>
                          <div style={{ fontSize: '13px', fontWeight: 700, color: '#0B1F17', marginBottom: '4px' }}>{topic.title}</div>
                          <div style={{ fontSize: '12px', color: '#0B1F17', opacity: 0.8, marginBottom: '8px' }}>{topic.content}</div>
                          {topic.image_url && (
                            <div style={{ width: '100%', height: '180px', borderRadius: '12px', overflow: 'hidden', marginBottom: '8px', background: '#EDF3ED' }}>
                              <img src={topic.image_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            </div>
                          )}
                          <div style={{ display: 'flex', gap: '16px', fontSize: '11px', color: '#6B7A72' }}>
                            <button onClick={() => handleLikePost(topic.id, topic.likes_count)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: likedTopics[topic.id] ? '#e11d48' : '#6B7A72', fontSize: '11px', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: '4px' }}>❤️ {topic.likes_count}</button>
                            <button onClick={() => { setReplyingToTopic(replyingToTopic === topic.id ? null : topic.id); if (replyingToTopic !== topic.id) handleLoadReplies(topic.id); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6B7A72', fontSize: '11px', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: '4px' }}>💬 {topic.replies_count}</button>
                          </div>
                          {replyingToTopic === topic.id && (
                            <div style={{ marginTop: '10px', paddingTop: '10px', borderTop: '1px solid rgba(11,31,23,0.06)' }}>
                              {topicReplies[topic.id]?.map(reply => (
                                <div key={reply.id} style={{ display: 'flex', gap: '8px', marginBottom: '8px', fontSize: '12px' }}>
                                  <div style={{ width: '24px', height: '24px', borderRadius: '50%', background: '#EDF3ED', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '9px', color: '#0B1F17', flexShrink: 0 }}>{reply.author?.full_name[0] || '?'}</div>
                                  <div style={{ background: '#EDF3ED', borderRadius: '12px', padding: '8px 12px', flex: 1 }}>
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '2px' }}>
                                      <span style={{ fontWeight: 700 }}>{reply.author?.full_name || 'Anonyme'}</span>
                                      <button onClick={() => startReplyTo(topic.id, reply.author?.full_name)} style={{ background: 'none', border: 'none', fontSize: '10px', fontWeight: 700, color: '#17402C', cursor: 'pointer', fontFamily: 'inherit' }}>Répondre</button>
                                    </div>
                                    <div style={{ color: '#0B1F17', opacity: 0.8 }}>{reply.content}</div>
                                  </div>
                                </div>
                              ))}
                              <input
                                type="text"
                                value={replyContent}
                                onChange={(e) => setReplyContent(e.target.value)}
                                placeholder="Écrire un commentaire..."
                                style={{ width: '100%', padding: '8px 14px', borderRadius: '999px', border: '1px solid rgba(11,31,23,0.06)', background: '#EDF3ED', fontSize: '12px', color: '#0B1F17', outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit' }}
                              />
                              <button onClick={() => handleCreateReply(topic.id)} style={{ marginTop: '6px', padding: '6px 16px', borderRadius: '999px', border: 'none', background: '#0B1F17', color: '#fff', fontSize: '11px', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>Envoyer</button>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* About club section */}
                  <div style={{ background: '#FBFAF6', borderRadius: '16px', padding: '16px', border: '1px solid rgba(11,31,23,0.06)', marginTop: '16px' }}>
                    <div style={{ fontSize: '15px', fontWeight: 800, color: '#0B1F17', marginBottom: '8px' }}>À propos du club</div>
                    <p style={{ fontSize: '12px', color: '#6B7A72', marginBottom: '12px' }}>{club.description}</p>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '11px', color: '#6B7A72' }}>
                      <div>Visibilité: {club.privacy === 'open' ? 'Public' : 'Privé'}</div>
                      <div>Lieu: {club.location || 'Monde'}</div>
                      <div>Catégorie: {club.category}</div>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </MobilePageShell>
        
      </div>

      {/* CREATE POST MODAL */}
      {createPostModalOpen && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden animate-slide-up">
            <div className="p-6 border-b border-emerald-900/10 flex justify-between items-center">
              <h3 className="font-display font-800 text-2xl text-emerald-950">{createPostType === 'guide' ? 'Créer un guide' : 'Créer une discussion'}</h3>
              <button onClick={() => setCreatePostModalOpen(false)} className="text-emerald-900/50 hover:text-emerald-900 bg-emerald-50 w-8 h-8 rounded-full flex items-center justify-center">
                <Icon name="XMarkIcon" size={20} />
              </button>
            </div>
            <form onSubmit={handleCreatePost} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-700 text-emerald-950 mb-2">Titre {createPostType === 'guide' ? 'du guide' : 'de la discussion'}</label>
                <input
                  type="text"
                  value={newPostTitle}
                  onChange={(e) => setNewPostTitle(e.target.value)}
                  placeholder={createPostType === 'guide' ? "Ex: Quel matelas pour le GR20 ?" : "Ex: Vos retours sur la tente MSR ?"}
                  className="w-full bg-[#F5F3ED] border-none rounded-xl px-4 py-3 focus:ring-2 focus:ring-emerald-500 font-600"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-700 text-emerald-950 mb-2">Contenu</label>
                <textarea
                  value={newPostContent}
                  onChange={(e) => setNewPostContent(e.target.value)}
                  placeholder="Détaillez votre question ou votre partage..."
                  className="w-full bg-[#F5F3ED] border-none rounded-xl px-4 py-3 min-h-[150px] focus:ring-2 focus:ring-emerald-500 font-500 resize-none"
                  required
                />
              </div>
              <div className="pt-4 flex justify-end gap-3">
                <button type="button" onClick={() => setCreatePostModalOpen(false)} className="px-6 py-3 text-emerald-900 font-700 hover:bg-emerald-50 rounded-full">
                  Annuler
                </button>
                <button type="submit" disabled={submitting} className="px-6 py-3 bg-emerald-950 text-white font-800 rounded-full hover:bg-emerald-800 shadow-lg hover:shadow-xl transition-all disabled:opacity-50">
                  {submitting ? 'Publication...' : 'Publier'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* PARTICIPANTS MODAL */}
      {participantsModalOpen && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-3xl w-full max-w-sm shadow-2xl overflow-hidden animate-slide-up flex flex-col max-h-[80vh]">
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
