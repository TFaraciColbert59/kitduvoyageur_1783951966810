'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import MobilePageShell from '@/components/mobile-nav/MobilePageShell';
import Icon from '@/components/ui/AppIcon';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

// ─── Types ────────────────────────────────────────────────────────────────────
interface Club {
  id: string;
  slug: string;
  name: string;
  type: 'activite' | 'pays';
  emoji: string;
  description: string;
  cover_color: string;
  cover_image: string;
  category: string;
  rules: string;
  privacy: 'open' | 'closed' | 'secret';
  members_count: number;
  active_this_month: number;
  is_verified: boolean;
  created_by: string;
  topics?: ClubTopic[];
  is_member?: boolean;
  member_role?: string;
  member_status?: string;
}

interface ClubTopic {
  id: string;
  club_id: string;
  author_id: string;
  title: string;
  content: string;
  is_pinned: boolean;
  is_announcement: boolean;
  is_approved: boolean;
  likes_count: number;
  replies_count: number;
  reports_count: number;
  created_at: string;
  author?: { full_name: string };
}

interface ClubMember {
  id: string;
  club_id: string;
  user_id: string;
  role: 'admin' | 'moderator' | 'member';
  status: 'active' | 'banned' | 'pending';
  joined_at: string;
  user?: { full_name: string; avatar_url: string; trust_score: number };
}

interface ClubChallenge {
  id: string;
  club_id: string;
  title: string;
  description: string;
  xp: number;
  deadline: string | null;
  active: boolean;
}

interface ClubEvent {
  id: string;
  club_id: string;
  organizer_id: string;
  title: string;
  description: string;
  event_date: string | null;
  location: string;
  max_participants: number;
  participants_count: number;
}

interface ClubForm {
  name: string;
  type: 'activite' | 'pays';
  emoji: string;
  description: string;
  category: string;
  rules: string;
  privacy: 'open' | 'closed' | 'secret';
}

const EMPTY_CLUB_FORM: ClubForm = {
  name: '',
  type: 'activite',
  emoji: '🏕️',
  description: '',
  category: '',
  rules: '',
  privacy: 'open',
};

const _COVER_COLORS: { label: string; value: string }[] = [
  { label: 'Vert', value: 'from-emerald-600 to-teal-700' },
  { label: 'Bleu', value: 'from-blue-600 to-indigo-700' },
  { label: 'Orange', value: 'from-amber-600 to-orange-700' },
  { label: 'Gris', value: 'from-stone-600 to-stone-800' },
  { label: 'Cyan', value: 'from-cyan-600 to-blue-700' },
  { label: 'Ardoise', value: 'from-slate-600 to-gray-800' },
];

// ─── Club Create/Edit Modal ───────────────────────────────────────────────────
function ClubFormModal({
  open,
  onClose,
  onSave,
  initial,
  saving,
}: {
  open: boolean;
  onClose: () => void;
  onSave: (form: ClubForm) => void;
  initial?: ClubForm;
  saving: boolean;
}) {
  const [form, setForm] = useState<ClubForm>(initial ?? EMPTY_CLUB_FORM);
  useEffect(() => { setForm(initial ?? EMPTY_CLUB_FORM); }, [initial, open]);
  if (!open) return null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const set = (k: keyof ClubForm, v: any) => setForm((f) => ({ ...f, [k]: v }));

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-md flex items-center justify-center p-4 sm:p-6 overflow-y-auto transition-opacity duration-300">
      <div className="bg-card/95 backdrop-blur-xl border border-white/10 shadow-2xl rounded-[2rem] w-full max-w-xl my-4 overflow-hidden flex flex-col transform transition-transform duration-300 scale-100">
        
        {/* Header */}
        <div className="flex items-center justify-between p-6 sm:px-8 pt-8 pb-4 relative z-10">
          <div>
            <h2 className="font-display font-800 text-foreground text-2xl tracking-tight">
              {initial ? 'Modifier le club' : 'Créer un club'}
            </h2>
            <p className="text-muted-foreground text-sm mt-1">Configurez l&apos;espace de votre communauté.</p>
          </div>
          <button onClick={onClose} className="p-3 bg-muted/50 rounded-full hover:bg-muted text-foreground transition-colors self-start">
            <Icon name="XMarkIcon" size={20} />
          </button>
        </div>

        {/* Form Body */}
        <div className="p-6 sm:px-8 space-y-6 max-h-[60vh] overflow-y-auto custom-scrollbar relative z-10">
          <div className="flex gap-4">
            <div className="w-24">
              <label className="text-[11px] font-700 text-muted-foreground uppercase tracking-widest block mb-2">Emoji</label>
              <input 
                className="w-full bg-muted/30 border border-white/10 rounded-2xl px-3 py-4 text-center text-3xl focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all hover:bg-muted/50" 
                value={form.emoji} 
                onChange={(e) => set('emoji', e.target.value)} 
              />
            </div>
            <div className="flex-1">
              <label className="text-[11px] font-700 text-muted-foreground uppercase tracking-widest block mb-2">Nom du club <span className="text-primary">*</span></label>
              <input 
                className="w-full bg-muted/30 border border-white/10 rounded-2xl px-5 py-4 text-base text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all hover:bg-muted/50" 
                placeholder="Ex: Club Sahara" 
                value={form.name} 
                onChange={(e) => set('name', e.target.value)} 
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div>
              <label className="text-[11px] font-700 text-muted-foreground uppercase tracking-widest block mb-2">Type</label>
              <div className="flex bg-muted/30 p-1.5 rounded-2xl border border-white/10">
                {[{ v: 'activite', l: '🎯 Activité' }, { v: 'pays', l: '🌍 Pays' }].map((opt) => (
                  <button 
                    key={opt.v} 
                    type="button" 
                    onClick={() => set('type', opt.v)} 
                    className={`flex-1 py-2.5 px-3 rounded-xl text-sm font-600 transition-all ${form.type === opt.v ? 'bg-background shadow-md text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                  >
                    {opt.l}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-[11px] font-700 text-muted-foreground uppercase tracking-widest block mb-2">Catégorie</label>
              <input 
                className="w-full bg-muted/30 border border-white/10 rounded-2xl px-5 py-3.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all hover:bg-muted/50" 
                placeholder="Ex: Randonnée, Islande..." 
                value={form.category} 
                onChange={(e) => set('category', e.target.value)} 
              />
            </div>
          </div>

          <div>
            <label className="text-[11px] font-700 text-muted-foreground uppercase tracking-widest block mb-2">Description</label>
            <textarea 
              rows={3} 
              className="w-full bg-muted/30 border border-white/10 rounded-2xl px-5 py-4 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all hover:bg-muted/50 resize-none" 
              placeholder="Décrivez l'objectif et l'ambiance du club..." 
              value={form.description} 
              onChange={(e) => set('description', e.target.value)} 
            />
          </div>

          <div>
            <label className="text-[11px] font-700 text-muted-foreground uppercase tracking-widest block mb-2">Règles du club</label>
            <textarea 
              rows={2} 
              className="w-full bg-muted/30 border border-white/10 rounded-2xl px-5 py-4 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all hover:bg-muted/50 resize-none" 
              placeholder="Règles de bonne conduite (optionnel)..." 
              value={form.rules} 
              onChange={(e) => set('rules', e.target.value)} 
            />
          </div>

          <div>
            <label className="text-[11px] font-700 text-muted-foreground uppercase tracking-widest block mb-3">Confidentialité</label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {[
                { v: 'open', l: '🌍 Ouvert', d: 'Tout le monde' },
                { v: 'closed', l: '🔒 Fermé', d: 'Sur demande' },
                { v: 'secret', l: '🕵️ Secret', d: 'Sur invitation' },
              ].map((opt) => (
                <button 
                  key={opt.v} 
                  type="button" 
                  onClick={() => set('privacy', opt.v)} 
                  className={`p-4 rounded-2xl border-2 text-left transition-all flex flex-col items-start ${form.privacy === opt.v ? 'border-primary bg-primary/10 shadow-[0_0_15px_rgba(var(--primary),0.2)]' : 'border-white/5 bg-muted/20 hover:border-white/20 hover:bg-muted/40'}`}
                >
                  <p className="text-sm font-700 text-foreground mb-1">{opt.l}</p>
                  <p className="text-[11px] text-muted-foreground">{opt.d}</p>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center gap-3 p-6 sm:px-8 border-t border-white/10 bg-background/50 relative z-10">
          <button onClick={onClose} className="px-6 py-3.5 rounded-2xl text-sm font-700 text-foreground hover:bg-muted transition-colors">
            Annuler
          </button>
          <button 
            onClick={() => onSave(form)} 
            disabled={saving || !form.name.trim()} 
            className="flex-1 py-3.5 rounded-2xl bg-primary text-white text-sm font-700 hover:bg-primary/90 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-primary/25 hover:shadow-primary/40 hover:-translate-y-0.5 active:translate-y-0"
          >
            {saving ? 'Enregistrement...' : initial ? 'Mettre à jour le club' : 'Créer le club'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Club Detail Modal ────────────────────────────────────────────────────────
function ClubDetailModal({
  club,
  onClose,
  currentUserId,
  onRefresh,
}: {
  club: Club | null;
  onClose: () => void;
  currentUserId?: string;
  onRefresh: () => void;
}) {
  const [activeTab, setActiveTab] = useState<'topics' | 'members' | 'challenges' | 'events' | 'moderation'>('topics');
  const [topics, setTopics] = useState<ClubTopic[]>([]);
  const [members, setMembers] = useState<ClubMember[]>([]);
  const [challenges, setChallenges] = useState<ClubChallenge[]>([]);
  const [events, setEvents] = useState<ClubEvent[]>([]);
  const [pendingRequests, setPendingRequests] = useState<ClubMember[]>([]);
  const [loading, setLoading] = useState(false);
  const [newTopic, setNewTopic] = useState({ title: '', content: '' });
  const [postingTopic, setPostingTopic] = useState(false);
  const [newEvent, setNewEvent] = useState({ title: '', description: '', event_date: '', location: '', max_participants: 20 });
  const [postingEvent, setPostingEvent] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const supabase = useMemo(() => createClient(), []);

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(null), 3000); };

  const isAdmin = club?.is_member && (club?.member_role === 'admin' || club?.member_role === 'moderator');

  const loadData = useCallback(async () => {
    if (!club) return;
    setLoading(true);
    const [topicsRes, membersRes, challengesRes, eventsRes] = await Promise.all([
      supabase.from('club_topics').select('*, author:user_profiles(full_name)').eq('club_id', club.id).eq('is_approved', true).order('is_pinned', { ascending: false }).order('created_at', { ascending: false }),
      supabase.from('club_members').select('*, user:user_profiles(full_name, avatar_url, trust_score)').eq('club_id', club.id).eq('status', 'active'),
      supabase.from('club_challenges').select('*').eq('club_id', club.id).eq('active', true),
      supabase.from('club_events').select('*').eq('club_id', club.id).order('event_date', { ascending: true }),
    ]);
    setTopics((topicsRes.data as ClubTopic[]) ?? []);
    setMembers((membersRes.data as ClubMember[]) ?? []);
    setChallenges((challengesRes.data as ClubChallenge[]) ?? []);
    setEvents((eventsRes.data as ClubEvent[]) ?? []);

    if (isAdmin) {
      const { data: pending } = await supabase.from('club_join_requests').select('*, user:user_profiles(full_name, avatar_url, trust_score)').eq('club_id', club.id).eq('status', 'pending');
      setPendingRequests((pending as ClubMember[]) ?? []);
    }
    setLoading(false);
  }, [club, supabase, isAdmin]);

  useEffect(() => { if (club) loadData(); }, [club, loadData]);

  const handlePostTopic = async () => {
    if (!club || !currentUserId || !newTopic.title.trim()) return;
    setPostingTopic(true);
    await supabase.from('club_topics').insert({ club_id: club.id, author_id: currentUserId, title: newTopic.title, content: newTopic.content });
    setNewTopic({ title: '', content: '' });
    setPostingTopic(false);
    showToast('Discussion publiée !');
    await loadData();
  };

  const handlePinTopic = async (topic: ClubTopic) => {
    await supabase.from('club_topics').update({ is_pinned: !topic.is_pinned }).eq('id', topic.id);
    showToast(topic.is_pinned ? 'Désépinglé' : 'Épinglé en haut');
    await loadData();
  };

  const handleDeleteTopic = async (topicId: string) => {
    await supabase.from('club_topics').delete().eq('id', topicId);
    showToast('Discussion supprimée');
    await loadData();
  };

  const handleBanMember = async (member: ClubMember) => {
    await supabase.from('club_members').update({ status: 'banned' }).eq('id', member.id);
    showToast(`${member.user?.full_name} banni du club`);
    await loadData();
  };

  const handlePromoteMember = async (member: ClubMember, role: 'admin' | 'moderator' | 'member') => {
    await supabase.from('club_members').update({ role }).eq('id', member.id);
    showToast(`Rôle mis à jour : ${role}`);
    await loadData();
  };

  const handleApproveRequest = async (requestId: string, userId: string, approve: boolean) => {
    await supabase.from('club_join_requests').update({ status: approve ? 'approved' : 'rejected', reviewed_by: currentUserId }).eq('id', requestId);
    if (approve && club) {
      await supabase.from('club_members').insert({ club_id: club.id, user_id: userId, role: 'member', status: 'active' });
      await supabase.from('clubs').update({ members_count: club.members_count + 1 }).eq('id', club.id);
    }
    showToast(approve ? 'Demande approuvée' : 'Demande rejetée');
    await loadData();
    onRefresh();
  };

  const handlePostEvent = async () => {
    if (!club || !currentUserId || !newEvent.title.trim()) return;
    setPostingEvent(true);
    await supabase.from('club_events').insert({
      club_id: club.id,
      organizer_id: currentUserId,
      title: newEvent.title,
      description: newEvent.description,
      event_date: newEvent.event_date || null,
      location: newEvent.location,
      max_participants: newEvent.max_participants,
    });
    setNewEvent({ title: '', description: '', event_date: '', location: '', max_participants: 20 });
    setPostingEvent(false);
    showToast('Événement ajouté à l\'agenda !');
    await loadData();
  };

  if (!club) return null;

  const tabs = [
    { id: 'topics', label: 'Discussions', icon: 'ChatBubbleLeftRightIcon' },
    { id: 'members', label: `Membres (${members.length})`, icon: 'UsersIcon' },
    { id: 'challenges', label: 'Défis', icon: 'TrophyIcon' },
    { id: 'events', label: 'Agenda', icon: 'CalendarIcon' },
    ...(isAdmin ? [{ id: 'moderation', label: `Modération${pendingRequests.length > 0 ? ` (${pendingRequests.length})` : ''}`, icon: 'ShieldCheckIcon' }] : []),
  ];

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-md flex items-center justify-center p-4 transition-opacity duration-300">
      <div className="bg-card border border-white/5 shadow-2xl rounded-3xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header - Immersive */}
        <div className={`bg-gradient-to-br ${club.cover_color} p-8 relative overflow-hidden shrink-0`}>
          <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 blur-[80px] rounded-full pointer-events-none" />
          <div className="relative z-10 flex items-start justify-between">
            <div className="flex items-start gap-5">
              <div className="w-16 h-16 bg-white/20 backdrop-blur-md rounded-2xl flex items-center justify-center text-4xl shadow-xl border border-white/20">
                {club.emoji}
              </div>
              <div className="mt-1">
                <div className="flex items-center gap-3 flex-wrap mb-1">
                  <h2 className="font-display font-800 text-white text-3xl tracking-tight">{club.name}</h2>
                  {club.is_verified && <span className="text-[10px] bg-white/20 text-white px-2.5 py-1 rounded-full font-700 tracking-wider">✓ VÉRIFIÉ</span>}
                </div>
                <p className="text-white/70 text-sm font-500">
                  {club.members_count.toLocaleString()} membres · {club.type === 'activite' ? 'Activité' : 'Destination'} · {club.privacy}
                </p>
              </div>
            </div>
            <button onClick={onClose} className="p-3 bg-black/20 hover:bg-black/40 backdrop-blur-md rounded-full transition-colors text-white">
              <Icon name="XMarkIcon" size={18} />
            </button>
          </div>
          {club.rules && (
            <div className="mt-6 bg-black/20 backdrop-blur-sm border border-white/10 rounded-xl px-4 py-3 relative z-10 flex items-start gap-3">
              <Icon name="ShieldCheckIcon" size={16} className="text-white/80 shrink-0 mt-0.5" />
              <div>
                <p className="text-[10px] text-white/50 font-700 uppercase tracking-widest mb-1">Règles du club</p>
                <p className="text-sm text-white/90 leading-relaxed">{club.rules}</p>
              </div>
            </div>
          )}
        </div>

        {/* Tabs - Modern Pills */}
        <div className="px-6 py-4 border-b border-border bg-background/50 flex overflow-x-auto scrollbar-hide gap-2 shrink-0">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as typeof activeTab)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-full text-sm font-600 transition-all whitespace-nowrap ${
                activeTab === tab.id 
                  ? 'bg-foreground text-background shadow-md' 
                  : 'bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground'
              }`}
            >
              <Icon name={tab.icon} size={15} />
              {tab.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 sm:p-8 custom-scrollbar bg-background">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 opacity-50">
              <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mb-4" />
              <p className="text-sm text-muted-foreground font-500">Chargement des données du club...</p>
            </div>
          ) : (
            <div className="max-w-3xl mx-auto">
              {/* Topics */}
              {activeTab === 'topics' && (
                <div className="space-y-6">
                  {club.is_member && (
                    <div className="bg-card border border-border shadow-sm rounded-2xl p-5 space-y-4">
                      <div className="flex items-center gap-3 mb-2">
                        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                          <Icon name="PencilIcon" size={14} />
                        </div>
                        <h3 className="font-700 text-foreground text-base">Lancer une discussion</h3>
                      </div>
                      <input 
                        className="w-full bg-muted/30 border border-white/5 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all" 
                        placeholder="De quoi voulez-vous parler ?" 
                        value={newTopic.title} 
                        onChange={(e) => setNewTopic((f) => ({ ...f, title: e.target.value }))} 
                      />
                      <textarea 
                        rows={3} 
                        className="w-full bg-muted/30 border border-white/5 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all resize-none" 
                        placeholder="Détaillez votre sujet (optionnel)..." 
                        value={newTopic.content} 
                        onChange={(e) => setNewTopic((f) => ({ ...f, content: e.target.value }))} 
                      />
                      <div className="flex justify-end">
                        <button 
                          onClick={handlePostTopic} 
                          disabled={postingTopic || !newTopic.title.trim()} 
                          className="px-6 py-2.5 bg-primary text-white rounded-xl text-sm font-700 disabled:opacity-50 hover:bg-primary/90 hover:shadow-lg hover:-translate-y-0.5 transition-all"
                        >
                          {postingTopic ? 'Publication...' : 'Publier'}
                        </button>
                      </div>
                    </div>
                  )}
                  {topics.length === 0 ? (
                    <div className="text-center py-16 border border-dashed border-border rounded-3xl">
                      <div className="text-5xl mb-4 opacity-50">💬</div>
                      <p className="text-foreground font-700 text-lg mb-1">Aucune discussion</p>
                      <p className="text-muted-foreground text-sm">Soyez le premier à lancer un sujet !</p>
                    </div>
                  ) : (
                    topics.map((topic) => (
                      <div key={topic.id} className={`group bg-card border border-border rounded-2xl p-5 transition-all hover:shadow-lg ${topic.is_pinned ? 'border-primary/40 bg-primary/5' : 'hover:border-foreground/20'}`}>
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap mb-2">
                              {topic.is_pinned && <span className="text-[10px] bg-primary/20 text-primary px-2.5 py-1 rounded-full font-800 tracking-wider">📌 ÉPINGLÉ</span>}
                              {topic.is_announcement && <span className="text-[10px] bg-amber-500/20 text-amber-500 px-2.5 py-1 rounded-full font-800 tracking-wider">📢 ANNONCE</span>}
                              <h4 className="font-700 text-foreground text-base group-hover:text-primary transition-colors">{topic.title}</h4>
                            </div>
                            {topic.content && <p className="text-sm text-muted-foreground mb-4 line-clamp-2 leading-relaxed">{topic.content}</p>}
                            <div className="flex items-center gap-4 text-xs font-500 text-muted-foreground">
                              <span className="flex items-center gap-1.5 bg-muted px-2 py-1 rounded-md">
                                <Icon name="UserIcon" size={12} /> {topic.author?.full_name ?? 'Anonyme'}
                              </span>
                              <span className="flex items-center gap-1.5">
                                <Icon name="HeartIcon" size={14} className="text-red-400/70" /> {topic.likes_count}
                              </span>
                              <span className="flex items-center gap-1.5">
                                <Icon name="ChatBubbleLeftIcon" size={14} className="text-blue-400/70" /> {topic.replies_count}
                              </span>
                            </div>
                          </div>
                          {isAdmin && (
                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 bg-muted/50 rounded-xl p-1">
                              <button onClick={() => handlePinTopic(topic)} title={topic.is_pinned ? 'Désépingler' : 'Épingler'} className="p-2 rounded-lg hover:bg-background transition-colors">
                                <Icon name="BookmarkIcon" size={15} className={topic.is_pinned ? 'text-primary' : 'text-muted-foreground'} />
                              </button>
                              <button onClick={() => handleDeleteTopic(topic.id)} title="Supprimer" className="p-2 rounded-lg hover:bg-red-500/20 transition-colors">
                                <Icon name="TrashIcon" size={15} className="text-red-500" />
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}

              {/* Members */}
              {activeTab === 'members' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {members.map((m) => (
                    <div key={m.id} className="flex flex-col gap-3 p-4 bg-card border border-border rounded-2xl hover:border-foreground/20 transition-colors">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center font-800 text-primary text-lg shadow-inner">
                            {m.user?.full_name?.[0] ?? '?'}
                          </div>
                          <div>
                            <p className="font-700 text-foreground text-sm truncate">{m.user?.full_name ?? 'Anonyme'}</p>
                            <span className={`inline-flex items-center mt-1 text-[10px] px-2.5 py-0.5 rounded-full font-800 tracking-wider ${m.role === 'admin' ? 'bg-amber-500/20 text-amber-500' : m.role === 'moderator' ? 'bg-blue-500/20 text-blue-500' : 'bg-muted text-muted-foreground'}`}>
                              {m.role === 'admin' ? '👑 ADMIN' : m.role === 'moderator' ? '🛡️ MODO' : '👤 MEMBRE'}
                            </span>
                          </div>
                        </div>
                        {isAdmin && m.user_id !== currentUserId && (
                          <button onClick={() => handleBanMember(m)} className="p-2 rounded-full hover:bg-red-500/20 text-muted-foreground hover:text-red-500 transition-colors" title="Bannir">
                            <Icon name="NoSymbolIcon" size={15} />
                          </button>
                        )}
                      </div>
                      <div className="flex items-center justify-between mt-2 pt-3 border-t border-border">
                        <p className="text-[11px] text-muted-foreground font-600">Trust Score: {m.user?.trust_score ?? 0}</p>
                        {isAdmin && m.user_id !== currentUserId && (
                          <select
                            value={m.role}
                            onChange={(e) => handlePromoteMember(m, e.target.value as 'admin' | 'moderator' | 'member')}
                            className="text-[11px] font-600 bg-muted/50 border border-white/5 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer"
                          >
                            <option value="member">Membre</option>
                            <option value="moderator">Modérateur</option>
                            <option value="admin">Admin</option>
                          </select>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Challenges */}
              {activeTab === 'challenges' && (
                <div className="space-y-4">
                  {challenges.length === 0 ? (
                    <div className="text-center py-16 border border-dashed border-border rounded-3xl">
                      <div className="text-5xl mb-4 opacity-50">🏆</div>
                      <p className="text-foreground font-700 text-lg mb-1">Aucun défi en cours</p>
                    </div>
                  ) : (
                    challenges.map((ch) => (
                      <div key={ch.id} className="bg-card border border-border rounded-2xl p-6 hover:shadow-lg transition-all relative overflow-hidden group">
                        <div className="absolute -right-10 -top-10 w-40 h-40 bg-amber-500/10 rounded-full blur-3xl group-hover:bg-amber-500/20 transition-colors" />
                        <div className="relative z-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
                          <div>
                            <div className="flex items-center gap-3 mb-2">
                              <span className="p-2 bg-amber-500/20 text-amber-500 rounded-xl"><Icon name="TrophyIcon" size={16} /></span>
                              <h4 className="font-800 text-foreground text-lg">{ch.title}</h4>
                            </div>
                            <p className="text-sm text-muted-foreground mb-4 max-w-xl">{ch.description}</p>
                            <div className="flex items-center gap-4 text-xs font-600">
                              <span className="bg-amber-500/10 text-amber-500 px-3 py-1.5 rounded-lg">+{ch.xp} XP à gagner</span>
                              {ch.deadline && <span className="text-muted-foreground flex items-center gap-1.5"><Icon name="ClockIcon" size={14} /> Fin le {new Date(ch.deadline).toLocaleDateString('fr-FR')}</span>}
                            </div>
                          </div>
                          <button className="w-full sm:w-auto px-6 py-3 bg-foreground text-background rounded-xl text-sm font-700 hover:bg-primary hover:text-white hover:-translate-y-1 hover:shadow-xl transition-all">
                            Participer
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}

              {/* Events / Agenda */}
              {activeTab === 'events' && (
                <div className="space-y-6">
                  {isAdmin && (
                    <div className="bg-card border border-border shadow-sm rounded-2xl p-6 space-y-4">
                      <div className="flex items-center gap-3 mb-4">
                        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                          <Icon name="CalendarIcon" size={14} />
                        </div>
                        <h3 className="font-700 text-foreground text-base">Planifier un événement</h3>
                      </div>
                      
                      <div className="space-y-4">
                        <div>
                          <label className="text-[11px] font-700 text-muted-foreground uppercase tracking-widest block mb-2">Titre</label>
                          <input className="w-full bg-muted/30 border border-white/5 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all" placeholder="Titre de l'événement..." value={newEvent.title} onChange={(e) => setNewEvent((f) => ({ ...f, title: e.target.value }))} />
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div>
                            <label className="text-[11px] font-700 text-muted-foreground uppercase tracking-widest block mb-2">Date et Heure</label>
                            <input type="datetime-local" className="w-full bg-muted/30 border border-white/5 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all text-foreground" value={newEvent.event_date} onChange={(e) => setNewEvent((f) => ({ ...f, event_date: e.target.value }))} />
                          </div>
                          <div>
                            <label className="text-[11px] font-700 text-muted-foreground uppercase tracking-widest block mb-2">Lieu / Lien</label>
                            <input className="w-full bg-muted/30 border border-white/5 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all" placeholder="Chamonix ou Lien Zoom..." value={newEvent.location} onChange={(e) => setNewEvent((f) => ({ ...f, location: e.target.value }))} />
                          </div>
                        </div>
                        <div>
                          <label className="text-[11px] font-700 text-muted-foreground uppercase tracking-widest block mb-2">Description</label>
                          <textarea rows={2} className="w-full bg-muted/30 border border-white/5 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all resize-none" placeholder="Détails de l'événement..." value={newEvent.description} onChange={(e) => setNewEvent((f) => ({ ...f, description: e.target.value }))} />
                        </div>
                        <div className="flex justify-end pt-2">
                          <button onClick={handlePostEvent} disabled={postingEvent || !newEvent.title.trim()} className="px-6 py-2.5 bg-primary text-white rounded-xl text-sm font-700 disabled:opacity-50 hover:bg-primary/90 hover:shadow-lg hover:-translate-y-0.5 transition-all">
                            {postingEvent ? 'Création...' : 'Créer l\'événement'}
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                  {events.length === 0 ? (
                    <div className="text-center py-16 border border-dashed border-border rounded-3xl">
                      <div className="text-5xl mb-4 opacity-50">📅</div>
                      <p className="text-foreground font-700 text-lg mb-1">Aucun événement planifié</p>
                    </div>
                  ) : (
                    events.map((ev) => (
                      <div key={ev.id} className="bg-card border border-border rounded-2xl p-5 hover:border-foreground/20 transition-colors flex flex-col sm:flex-row gap-6">
                        <div className="bg-muted/50 rounded-xl p-4 flex flex-col items-center justify-center min-w-[100px] border border-white/5">
                          {ev.event_date ? (
                            <>
                              <span className="text-sm font-800 text-primary uppercase">{new Date(ev.event_date).toLocaleDateString('fr-FR', { month: 'short' })}</span>
                              <span className="text-3xl font-900 text-foreground">{new Date(ev.event_date).getDate()}</span>
                            </>
                          ) : (
                            <span className="text-sm font-700 text-muted-foreground">À DÉFINIR</span>
                          )}
                        </div>
                        <div className="flex-1 flex flex-col justify-center">
                          <h4 className="font-800 text-foreground text-lg mb-1">{ev.title}</h4>
                          {ev.description && <p className="text-sm text-muted-foreground mb-4 line-clamp-2">{ev.description}</p>}
                          <div className="flex items-center gap-4 text-xs font-600 text-muted-foreground flex-wrap mt-auto">
                            {ev.location && <span className="flex items-center gap-1.5 bg-muted px-2.5 py-1 rounded-md"><Icon name="MapPinIcon" size={14} />{ev.location}</span>}
                            <span className="flex items-center gap-1.5 bg-muted px-2.5 py-1 rounded-md">
                              <Icon name="UsersIcon" size={14} />{ev.participants_count} / {ev.max_participants} inscrits
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center sm:border-l sm:border-border sm:pl-6">
                          <button className="w-full sm:w-auto px-6 py-3 bg-primary/10 text-primary border border-primary/20 rounded-xl text-sm font-700 hover:bg-primary hover:text-white transition-all">
                            S&apos;inscrire
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}

              {/* Moderation */}
              {activeTab === 'moderation' && isAdmin && (
                <div className="space-y-6">
                  <div>
                    <h3 className="font-700 text-foreground text-lg mb-4 flex items-center gap-2">
                      <Icon name="ShieldCheckIcon" size={20} className="text-amber-500" />
                      Demandes d&apos;adhésion en attente
                      <span className="bg-amber-500/20 text-amber-500 text-xs px-2.5 py-0.5 rounded-full">{pendingRequests.length}</span>
                    </h3>
                    {pendingRequests.length === 0 ? (
                      <div className="text-center py-12 border border-dashed border-border rounded-2xl">
                        <p className="text-muted-foreground text-sm font-500">Aucune demande en attente pour le moment.</p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {pendingRequests.map((req) => (
                          <div key={req.id} className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 bg-card border border-border rounded-2xl hover:border-foreground/20 transition-colors">
                            <div className="flex items-center gap-4">
                              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-muted to-background flex items-center justify-center font-800 text-foreground text-lg shadow-inner border border-border">
                                {(req as unknown as { user?: { full_name: string } }).user?.full_name?.[0] ?? '?'}
                              </div>
                              <div>
                                <p className="font-700 text-foreground text-base">{(req as unknown as { user?: { full_name: string } }).user?.full_name ?? 'Anonyme'}</p>
                                <p className="text-xs text-muted-foreground font-600 mt-0.5">Trust Score: {(req as unknown as { user?: { trust_score: number } }).user?.trust_score ?? 0}</p>
                              </div>
                            </div>
                            <div className="flex gap-2 w-full sm:w-auto">
                              <button onClick={() => handleApproveRequest(req.id, req.user_id, true)} className="flex-1 sm:flex-none px-4 py-2 bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500 hover:text-white rounded-xl text-sm font-700 transition-all border border-emerald-500/20 hover:border-emerald-500 shadow-sm">Accepter</button>
                              <button onClick={() => handleApproveRequest(req.id, req.user_id, false)} className="flex-1 sm:flex-none px-4 py-2 bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white rounded-xl text-sm font-700 transition-all border border-red-500/20 hover:border-red-500 shadow-sm">Refuser</button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Modal Toast Overlay */}
        {toast && (
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-[100] bg-foreground text-background px-6 py-3 rounded-full text-sm font-700 shadow-2xl animate-fade-in-up">
            {toast}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Club Card ────────────────────────────────────────────────────────────────
function ClubCard({
  club,
  onToggleMember,
  onOpenDetail: _onOpenDetail,
  onEdit,
  onDelete,
  currentUserId,
}: {
  club: Club;
  onToggleMember: (club: Club) => void;
  onOpenDetail: (_club: Club) => void;
  onEdit: (club: Club) => void;
  onDelete: (club: Club) => void;
  currentUserId?: string;
}) {
  const [joining, setJoining] = useState(false);
  const isOwner = currentUserId === club.created_by;

  const handleToggle = async (e: React.MouseEvent) => {
    e.stopPropagation(); // prevent opening modal if clicking join
    setJoining(true);
    await onToggleMember(club);
    setJoining(false);
  };

  return (
    <Link 
      href={`/clubs/${club.slug}`}
      className="group relative flex flex-col bg-card rounded-[2rem] border border-border hover:border-white/20 hover:shadow-2xl hover:-translate-y-1.5 transition-all duration-300 overflow-hidden cursor-pointer h-full block"
    >
      {/* Decorative Blur Background */}
      <div className={`absolute -top-32 -right-32 w-64 h-64 bg-gradient-to-br ${club.cover_color} rounded-full blur-[80px] opacity-20 group-hover:opacity-40 transition-opacity duration-500 pointer-events-none`} />

      <div className="p-6 relative z-10 flex flex-col h-full">
        {/* Card Header */}
        <div className="flex items-start justify-between mb-5">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-background to-muted flex items-center justify-center text-3xl shadow-sm border border-border group-hover:scale-110 group-hover:rotate-3 transition-transform duration-300">
            {club.emoji}
          </div>
          
          <div className="flex items-center gap-1.5">
            {isOwner && (
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button 
                  onClick={(e) => { e.stopPropagation(); onEdit(club); }} 
                  className="p-2 bg-muted/50 hover:bg-foreground hover:text-background rounded-full transition-colors text-muted-foreground"
                  title="Modifier"
                >
                  <Icon name="PencilIcon" size={14} />
                </button>
                <button 
                  onClick={(e) => { e.stopPropagation(); onDelete(club); }} 
                  className="p-2 bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-white rounded-full transition-colors"
                  title="Supprimer"
                >
                  <Icon name="TrashIcon" size={14} />
                </button>
              </div>
            )}
            {club.is_member && (
              <span className="bg-primary/20 text-primary border border-primary/30 p-2 rounded-full" title="Vous êtes membre">
                <Icon name="CheckIcon" size={14} />
              </span>
            )}
          </div>
        </div>

        {/* Content */}
        <div className="mb-4">
          <div className="flex items-center gap-2 mb-1.5">
            <span className="text-[10px] font-800 tracking-widest uppercase text-muted-foreground">
              {club.type === 'activite' ? 'Activité' : 'Destination'}
            </span>
            {club.privacy !== 'open' && (
              <span className="text-[10px] bg-muted px-2 py-0.5 rounded-md font-700 text-muted-foreground flex items-center gap-1">
                <Icon name={club.privacy === 'closed' ? 'LockClosedIcon' : 'EyeSlashIcon'} size={10} />
                {club.privacy === 'closed' ? 'Fermé' : 'Secret'}
              </span>
            )}
          </div>
          <h3 className="font-display font-800 text-foreground text-xl leading-tight flex items-center gap-2 group-hover:text-primary transition-colors">
            {club.name}
            {club.is_verified && <Icon name="CheckBadgeIcon" size={18} className="text-blue-500" />}
          </h3>
        </div>

        <p className="text-sm text-muted-foreground leading-relaxed line-clamp-3 mb-6 flex-1">
          {club.description}
        </p>

        {/* Footer Stats & Action */}
        <div className="mt-auto pt-5 border-t border-border flex items-center justify-between">
          <div className="flex flex-col gap-1">
            <span className="text-xs font-700 text-foreground flex items-center gap-1.5">
              <Icon name="UsersIcon" size={14} className="text-muted-foreground" />
              {club.members_count.toLocaleString()} membres
            </span>
            <span className="text-[11px] font-600 text-muted-foreground flex items-center gap-1.5">
              <Icon name="BoltIcon" size={12} className="text-amber-500/70" />
              {club.active_this_month} actifs ce mois
            </span>
          </div>

          <button
            onClick={handleToggle}
            disabled={joining}
            className={`px-4 py-2.5 rounded-xl text-xs font-800 transition-all ${
              club.is_member 
                ? 'bg-muted text-muted-foreground hover:bg-red-500/10 hover:text-red-500' 
                : 'bg-primary text-white hover:bg-primary/90 hover:shadow-lg hover:shadow-primary/20 hover:-translate-y-0.5'
            }`}
          >
            {joining ? '...' : club.is_member ? 'Quitter' : 'Rejoindre'}
          </button>
        </div>
      </div>
    </Link>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function ClubsPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'activite' | 'pays' | 'mes-clubs'>('activite');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editClub, setEditClub] = useState<Club | null>(null);
  const [deleteClub, setDeleteClub] = useState<Club | null>(null);
  const [detailClub, setDetailClub] = useState<Club | null>(null);
  const [clubs, setClubs] = useState<Club[]>([]);
  const [loading, setLoading] = useState(true);
  const [_search, _setSearch] = useState('');
  const [_filterType, _setFilterType] = useState<'all' | 'activite' | 'pays'>('all');
  const [_filterPrivacy, _setFilterPrivacy] = useState<'all' | 'open' | 'closed'>('all');
  const [_selectedClub, _setSelectedClub] = useState<Club | null>(null);
  const [editingClub, setEditingClub] = useState<Club | null>(null);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const { user } = useAuth();
  const supabase = useMemo(() => createClient(), []);

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(null), 3000); };

  const loadClubs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data: clubsData, error: clubsError } = await supabase
        .from('clubs')
        .select('*, topics:club_topics(id, title, is_pinned, is_announcement)')
        .order('members_count', { ascending: false });

      if (clubsError) throw clubsError;

      let memberMap: Record<string, { role: string; status: string }> = {};
      if (user) {
        const { data: memberships } = await supabase
          .from('club_members')
          .select('club_id, role, status')
          .eq('user_id', user.id);
        memberMap = Object.fromEntries((memberships ?? []).map((m) => [m.club_id, { role: m.role, status: m.status }]));
      }

      let finalClubs = (clubsData ?? []).map((c) => ({
        ...c,
        is_member: !!memberMap[c.id] && memberMap[c.id].status === 'active',
        member_role: memberMap[c.id]?.role,
        member_status: memberMap[c.id]?.status,
      }));

      try {
        const localClubs = JSON.parse(localStorage.getItem('user_clubs_data') || '[]');
        if (localClubs.length > 0) {
          const localFormatted = localClubs.map((lc: any) => ({
            ...lc,
            is_member: true,
            member_role: 'admin',
            member_status: 'active',
            is_verified: false,
          }));
          // Merge avoiding duplicates by id or name
          const existingIds = new Set(finalClubs.map(c => c.id));
          const existingNames = new Set(finalClubs.map(c => c.name));
          const uniqueLocals = localFormatted.filter((lc: any) => !existingIds.has(lc.id) && !existingNames.has(lc.name));
          finalClubs = [...uniqueLocals, ...finalClubs];
        }
      } catch (e) {
        console.error(e);
      }

      setClubs(finalClubs);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erreur de chargement');
    } finally {
      setLoading(false);
    }
  }, [supabase, user]);

  useEffect(() => { 
    loadClubs(); 
    
    const handleClubCreated = () => {
      loadClubs();
    };
    window.addEventListener('club_created', handleClubCreated);
    return () => window.removeEventListener('club_created', handleClubCreated);
  }, [loadClubs]);

  const handleSaveClub = async (form: ClubForm) => {
    if (!user) return;
    setSaving(true);
    try {
      const colorMap: Record<string, string> = {
        'activite': 'from-emerald-600 to-teal-700',
        'pays': 'from-blue-600 to-indigo-700',
      };
      const payload = {
        name: form.name,
        type: form.type,
        emoji: form.emoji,
        description: form.description,
        category: form.category,
        rules: form.rules,
        privacy: form.privacy,
        cover_color: colorMap[form.type] ?? 'from-emerald-600 to-teal-700',
        created_by: user.id,
      };

      if (editClub) {
        const { error: uErr } = await supabase.from('clubs').update(payload).eq('id', editClub.id);
        if (uErr) throw uErr;
        showToast('Club mis à jour !');
      } else {
        const slug = `c-${form.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')}-${Date.now()}`;
        const { data: newClub, error: iErr } = await supabase.from('clubs').insert({ ...payload, slug, members_count: 1, active_this_month: 0 }).select().single();
        if (iErr) throw iErr;
        // Auto-join as admin
        if (newClub) {
          await supabase.from('club_members').insert({ club_id: newClub.id, user_id: user.id, role: 'admin', status: 'active' });
        }
        showToast("Club créé ! Vous en êtes l'administrateur.");
      }
      setShowCreateModal(false);
      setEditClub(null);
      await loadClubs();
    } catch { showToast('Erreur lors de la création'); }
    finally { setSaving(false); }
  };

  const _handleEditClub = async (form: ClubForm) => {
    if (!editingClub) return;
    setSaving(true);
    try {
      await supabase.from('clubs').update(form).eq('id', editingClub.id);
      showToast('Club mis à jour !');
      setEditingClub(null);
      await loadClubs();
    } catch { showToast('Erreur lors de la mise à jour'); }
    finally { setSaving(false); }
  };

  const handleToggleMember = async (club: Club) => {
    if (!user) { showToast('Connectez-vous pour rejoindre un club'); return; }
    if (club.is_member) {
      await supabase.from('club_members').delete().eq('club_id', club.id).eq('user_id', user.id);
      await supabase.from('clubs').update({ members_count: Math.max(0, club.members_count - 1) }).eq('id', club.id);
      showToast('Vous avez quitté le club');
    } else {
      if (club.privacy === 'closed') {
        await supabase.from('club_join_requests').upsert({ club_id: club.id, user_id: user.id, status: 'pending' }, { onConflict: 'club_id,user_id' });
        showToast('Demande d\'adhésion envoyée');
      } else {
        await supabase.from('club_members').insert({ club_id: club.id, user_id: user.id, role: 'member', status: 'active' });
        await supabase.from('clubs').update({ members_count: club.members_count + 1 }).eq('id', club.id);
        showToast('Bienvenue dans le club !');
      }
    }
    await loadClubs();
  };

  const handleDeleteClub = async () => {
    if (!deleteClub) return;
    setDeleting(true);
    try {
      await supabase.from('clubs').delete().eq('id', deleteClub.id);
      showToast('Club supprimé');
      setDeleteClub(null);
      await loadClubs();
    } catch { showToast('Erreur lors de la suppression'); }
    finally { setDeleting(false); }
  };

  const _filtered = clubs.filter((c) => {
    if (_filterType !== 'all' && c.type !== _filterType) return false;
    if (_filterPrivacy !== 'all' && c.privacy !== _filterPrivacy) return false;
    if (_search && !c.name.toLowerCase().includes(_search.toLowerCase()) && !c.category.toLowerCase().includes(_search.toLowerCase())) return false;
    return true;
  });

  const activityClubs = clubs.filter((c) => c.type === 'activite');
  const countryClubs = clubs.filter((c) => c.type === 'pays');
  const myClubs = clubs.filter((c) => c.is_member);
  const displayedClubs = activeTab === 'activite' ? activityClubs : activeTab === 'pays' ? countryClubs : myClubs;
  const editForm: ClubForm | undefined = editClub ? {
    name: editClub.name,
    type: editClub.type,
    emoji: editClub.emoji,
    description: editClub.description,
    category: editClub.category,
    rules: editClub.rules,
    privacy: editClub.privacy,
  } : undefined;

  const _PRIVACY_CFG: Record<string, { label: string; icon: string; color: string }> = {
    open: { label: 'Ouvert', icon: '🌍', color: 'text-emerald-700 bg-emerald-50 border-emerald-200' },
    closed: { label: 'Fermé', icon: '🔒', color: 'text-amber-700 bg-amber-50 border-amber-200' },
    secret: { label: 'Secret', icon: '🕵️', color: 'text-purple-700 bg-purple-50 border-purple-200' },
  };

  return (
    <>
      {/* ── DESKTOP ── */}
      <div className="hidden md:block">
        <main className="min-h-screen bg-background selection:bg-primary/20">
          <Header />

          {/* Immersive Hero Section */}
          <section className="relative pt-32 pb-20 lg:pt-40 lg:pb-32 overflow-hidden border-b border-white/5">
            <div className="absolute inset-0 bg-background pointer-events-none" />
            <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-primary/20 rounded-full blur-[120px] opacity-60 mix-blend-screen pointer-events-none animate-pulse-slow" />
            <div className="absolute -bottom-40 -left-40 w-[600px] h-[600px] bg-blue-500/10 rounded-full blur-[120px] opacity-50 mix-blend-screen pointer-events-none" />

            <div className="max-w-7xl mx-auto px-6 relative z-10">
              <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-10">
                <div className="max-w-3xl">
                  <div className="inline-flex items-center gap-2 mb-6 px-3 py-1.5 rounded-full bg-white/5 border border-white/10 backdrop-blur-md">
                    <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                    <span className="text-xs font-700 tracking-widest uppercase text-foreground/80">Espaces Communautaires</span>
                  </div>
                  <h1 className="font-display font-900 text-5xl lg:text-7xl text-foreground tracking-tight leading-[1.1] mb-6">
                    Rejoignez le <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-orange-400">Club.</span><br />
                    Vivez l&apos;aventure.
                  </h1>
                  <p className="text-lg lg:text-xl text-muted-foreground font-500 leading-relaxed max-w-2xl">
                    Trouvez vos compagnons de route, échangez sur votre matériel favori et participez aux défis thématiques de la communauté Le Kit du Voyageur.
                  </p>
                </div>

                <div className="flex-shrink-0">
                  <Link
                    href="/clubs/nouveau"
                    className="group relative inline-flex items-center justify-center gap-3 px-8 py-4 bg-foreground text-background rounded-full font-800 text-sm overflow-hidden transition-all hover:scale-105 hover:shadow-2xl hover:shadow-foreground/20"
                  >
                    <span className="absolute inset-0 w-full h-full bg-gradient-to-r from-primary to-orange-500 opacity-0 group-hover:opacity-100 transition-opacity duration-300 ease-out" />
                    <Icon name="PlusIcon" size={18} className="relative z-10 transition-transform group-hover:rotate-90 duration-300" />
                    <span className="relative z-10 group-hover:text-white transition-colors duration-300">Fonder un Club</span>
                  </Link>
                </div>
              </div>
            </div>
          </section>

          {/* Main Content Area */}
          <section className="relative z-20 -mt-8 px-6 pb-32">
            <div className="max-w-7xl mx-auto">

              {/* Floating Navigation Tabs */}
              <div className="flex justify-center mb-12">
                <div className="inline-flex items-center p-1.5 bg-card/80 backdrop-blur-xl border border-white/10 rounded-full shadow-2xl">
                  {[
                    { id: 'activite', label: 'Par Activité', icon: 'BoltIcon', count: activityClubs.length },
                    { id: 'pays', label: 'Par Destination', icon: 'GlobeAltIcon', count: countryClubs.length },
                    { id: 'mes-clubs', label: 'Mes Clubs', icon: 'UserGroupIcon', count: myClubs.length },
                  ].map((tab) => (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id as typeof activeTab)}
                      className={`relative flex items-center gap-2 px-6 py-3 rounded-full text-sm font-700 transition-all duration-300 ${
                        activeTab === tab.id
                          ? 'text-background shadow-md'
                          : 'text-muted-foreground hover:text-foreground hover:bg-white/5'
                      }`}
                    >
                      {activeTab === tab.id && (
                        <span className="absolute inset-0 bg-foreground rounded-full -z-10" />
                      )}
                      <Icon name={tab.icon} size={16} className={activeTab === tab.id ? 'text-background' : 'text-muted-foreground'} />
                      {tab.label}
                      {tab.count > 0 && (
                        <span className={`ml-1 text-[10px] px-2 py-0.5 rounded-full ${activeTab === tab.id ? 'bg-background/20' : 'bg-muted'} font-800`}>
                          {tab.count}
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              </div>

              {error && (
                <div className="mb-10 p-5 bg-red-500/10 border border-red-500/20 rounded-2xl flex items-center gap-3 text-red-500">
                  <Icon name="ExclamationTriangleIcon" size={20} />
                  <p className="font-600 text-sm">{error}</p>
                </div>
              )}

              {/* Grid Content */}
              {loading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                  {[1, 2, 3, 4, 5, 6].map((i) => (
                    <div key={i} className="h-80 rounded-[2rem] bg-card border border-white/5 animate-pulse flex flex-col p-6">
                      <div className="w-16 h-16 rounded-2xl bg-muted/50 mb-6" />
                      <div className="w-1/3 h-4 bg-muted/50 rounded-full mb-3" />
                      <div className="w-2/3 h-6 bg-muted/50 rounded-full mb-6" />
                      <div className="w-full h-16 bg-muted/50 rounded-xl mt-auto" />
                    </div>
                  ))}
                </div>
              ) : displayedClubs.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 px-4 text-center bg-card/30 border border-dashed border-border rounded-[3rem]">
                  <div className="w-24 h-24 bg-muted/50 rounded-full flex items-center justify-center text-4xl mb-6 shadow-inner">
                    {activeTab === 'mes-clubs' ? '🏕️' : '✨'}
                  </div>
                  <h3 className="font-display font-800 text-2xl text-foreground mb-3">
                    {activeTab === 'mes-clubs' ? "Vous n'avez rejoint aucun club" : 'Espace encore vierge'}
                  </h3>
                  <p className="text-muted-foreground text-base max-w-md mb-8">
                    {activeTab === 'mes-clubs' ?'Explorez les clubs existants et trouvez votre prochaine équipe de choc pour vos aventures.' : "Il n'y a pas encore de club dans cette catégorie. Soyez le pionnier et créez le vôtre !"}
                  </p>

                  {activeTab === 'mes-clubs' ? (
                    user ? (
                      <button onClick={() => setActiveTab('activite')} className="px-8 py-3.5 bg-foreground text-background rounded-full font-800 hover:scale-105 transition-transform shadow-lg">
                        Explorer les clubs
                      </button>
                    ) : (
                      <Link href="/connexion" className="px-8 py-3.5 bg-primary text-white rounded-full font-800 hover:scale-105 transition-transform shadow-lg shadow-primary/20">
                        Se connecter pour rejoindre
                      </Link>
                    )
                  ) : (
                    <Link href="/clubs/nouveau" className="inline-flex px-8 py-3.5 bg-primary text-white rounded-full font-800 hover:scale-105 transition-transform shadow-lg shadow-primary/20 items-center gap-2">
                      <Icon name="PlusIcon" size={16} /> Fonder le premier club
                    </Link>
                  )}
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                  {displayedClubs.map((c) => (
                    <ClubCard
                      key={c.id}
                      club={c}
                      onToggleMember={handleToggleMember}
                      onOpenDetail={setDetailClub}
                      onEdit={(club) => { setEditClub(club); setShowCreateModal(true); }}
                      onDelete={setDeleteClub}
                      currentUserId={user?.id}
                    />
                  ))}
                </div>
              )}
            </div>
          </section>

          <Footer />
        </main>
      </div>

      {/* ── MOBILE ── */}
      <div className="block md:hidden">
        <MobilePageShell>
          <div style={{ padding: '16px' }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
              <div>
                <div style={{ fontSize: '10px', color: '#6B7A72', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '4px' }}>Les Clubs</div>
                <h1 style={{ fontSize: '24px', fontWeight: 800, color: '#0B1F17', margin: 0, letterSpacing: '-0.02em', lineHeight: 1.1 }}>
                  Clubs <em style={{ fontFamily: 'Georgia, serif', fontStyle: 'italic', color: '#17402C', fontWeight: 400 }}>voyageurs</em>
                </h1>
              </div>
              <Link
                href="/clubs/nouveau"
                style={{ padding: '10px 18px', background: '#17402C', color: '#fff', borderRadius: '999px', fontSize: '12px', fontWeight: 600, textDecoration: 'none', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                + Nouveau
              </Link>
            </div>

            {/* Filter Tabs */}
            <div style={{ display: 'flex', gap: '6px', marginBottom: '16px', overflowX: 'auto', paddingBottom: '4px' }}>
              {[
                { id: 'activite', label: 'Par Activité', count: activityClubs.length },
                { id: 'pays', label: 'Par Destination', count: countryClubs.length },
                { id: 'mes-clubs', label: 'Mes Clubs', count: myClubs.length },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as typeof activeTab)}
                  style={{
                    padding: '8px 16px',
                    borderRadius: '999px',
                    border: 'none',
                    fontSize: '12px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                    background: activeTab === tab.id ? '#17402C' : '#F4F1EA',
                    color: activeTab === tab.id ? '#fff' : '#6B7A72',
                    fontFamily: 'inherit',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                  }}
                >
                  {tab.label}
                  {tab.count > 0 && (
                    <span style={{
                      fontSize: '10px',
                      padding: '1px 6px',
                      borderRadius: '999px',
                      background: activeTab === tab.id ? 'rgba(255,255,255,0.2)' : '#EDF3ED',
                      color: activeTab === tab.id ? '#fff' : '#6B7A72',
                    }}>
                      {tab.count}
                    </span>
                  )}
                </button>
              ))}
            </div>

            {/* Error */}
            {error && (
              <div style={{ padding: '12px', background: 'rgba(239,68,68,0.08)', borderRadius: '12px', border: '1px solid rgba(239,68,68,0.2)', color: '#ef4444', fontSize: '12px', fontWeight: 600, marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                ⚠️ {error}
              </div>
            )}

            {/* Clubs Content */}
            {loading ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {[1, 2, 3].map((i) => (
                  <div key={i} style={{ height: '140px', background: '#F4F1EA', borderRadius: '16px', opacity: 0.5 }} />
                ))}
              </div>
            ) : displayedClubs.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px 16px', background: 'rgba(244,241,234,0.5)', borderRadius: '24px', border: '1px dashed rgba(11,31,23,0.1)' }}>
                <div style={{ fontSize: '36px', marginBottom: '12px' }}>{activeTab === 'mes-clubs' ? '🏕️' : '✨'}</div>
                <h3 style={{ fontSize: '18px', fontWeight: 800, color: '#0B1F17', marginBottom: '8px' }}>
                  {activeTab === 'mes-clubs' ? "Vous n'avez rejoint aucun club" : 'Espace encore vierge'}
                </h3>
                <p style={{ fontSize: '13px', color: '#6B7A72', marginBottom: '16px' }}>
                  {activeTab === 'mes-clubs' ?'Explorez les clubs existants et trouvez votre prochaine équipe.'
                    : "Soyez le pionnier et créez le vôtre !"}
                </p>
                {activeTab === 'mes-clubs' ? (
                  user ? (
                    <button onClick={() => setActiveTab('activite')} style={{ padding: '12px 28px', background: '#0B1F17', color: '#fff', borderRadius: '999px', border: 'none', fontSize: '13px', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
                      Explorer les clubs
                    </button>
                  ) : (
                    <Link href="/connexion" style={{ padding: '12px 28px', background: '#17402C', color: '#fff', borderRadius: '999px', fontSize: '13px', fontWeight: 700, textDecoration: 'none', display: 'inline-block', fontFamily: 'inherit' }}>
                      Se connecter
                    </Link>
                  )
                ) : (
                  <Link href="/clubs/nouveau" style={{ padding: '12px 28px', background: '#17402C', color: '#fff', borderRadius: '999px', fontSize: '13px', fontWeight: 700, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '6px', fontFamily: 'inherit' }}>
                    + Fonder le premier club
                  </Link>
                )}
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {displayedClubs.map((c) => (
                  <div
                    key={c.id}
                    style={{ background: '#FBFAF6', borderRadius: '16px', padding: '14px', border: '1px solid rgba(11,31,23,0.06)', cursor: 'pointer' }}
                    onClick={() => router.push(`/clubs/${c.slug}`)}
                  >
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '8px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div style={{ width: '44px', height: '44px', borderRadius: '12px', background: 'linear-gradient(135deg, #F4F1EA, #EDF3ED)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '24px' }}>
                          {c.emoji || '🏔️'}
                        </div>
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <span style={{ fontSize: '14px', fontWeight: 700, color: '#0B1F17' }}>{c.name}</span>
                            {c.is_verified && <span style={{ fontSize: '14px', color: '#17402C' }}>✓</span>}
                          </div>
                          <span style={{ fontSize: '10px', color: '#6B7A72', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{c.type === 'pays' ? 'Destination' : 'Activité'} · {c.privacy === 'open' ? 'Public' : 'Privé'}</span>
                        </div>
                      </div>
                      {c.is_member && (
                        <span style={{ fontSize: '10px', color: '#17402C', background: '#EDF3ED', padding: '2px 8px', borderRadius: '999px', fontWeight: 700 }}>Membre</span>
                      )}
                    </div>
                    <p style={{ fontSize: '12px', color: '#6B7A72', margin: '0 0 10px', lineHeight: 1.4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.description}</p>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div style={{ display: 'flex', gap: '12px', fontSize: '11px', color: '#6B7A72' }}>
                        <span>👥 {c.members_count} membres</span>
                        <span>⚡ {c.active_this_month} actifs</span>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleToggleMember(c);
                        }}
                        style={{
                          padding: '6px 14px',
                          borderRadius: '999px',
                          border: 'none',
                          fontSize: '11px',
                          fontWeight: 700,
                          cursor: 'pointer',
                          background: c.is_member ? '#F4F1EA' : '#17402C',
                          color: c.is_member ? '#0B1F17' : '#fff',
                          fontFamily: 'inherit',
                        }}
                      >
                        {c.is_member ? 'Quitter' : 'Rejoindre'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </MobilePageShell>
        
      </div>

      {/* Modals */}
      <ClubFormModal
        open={showCreateModal}
        onClose={() => { setShowCreateModal(false); setEditClub(null); }}
        onSave={handleSaveClub}
        initial={editForm}
        saving={saving}
      />

      <ClubDetailModal
        club={detailClub}
        onClose={() => setDetailClub(null)}
        currentUserId={user?.id}
        onRefresh={loadClubs}
      />

      {/* Delete confirm Modal */}
      {deleteClub && (
        <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-card border border-border shadow-2xl rounded-3xl p-8 max-w-sm w-full text-center transform transition-all scale-100">
            <div className="w-20 h-20 rounded-full bg-red-500/10 flex items-center justify-center mx-auto mb-5">
              <Icon name="ExclamationTriangleIcon" size={32} className="text-red-500" />
            </div>
            <h3 className="font-display font-800 text-foreground text-xl mb-2">Supprimer le club ?</h3>
            <p className="text-sm text-muted-foreground mb-8">Cette action est irréversible. Toutes les données, membres et discussions de &quot;{deleteClub.name}&quot; seront perdus à jamais.</p>

            <div className="flex flex-col gap-3">
              <button
                onClick={handleDeleteClub}
                disabled={deleting}
                className="w-full py-3.5 rounded-xl bg-red-500 text-white text-sm font-800 hover:bg-red-600 transition-colors disabled:opacity-50 shadow-lg shadow-red-500/20"
              >
                {deleting ? 'Destruction en cours...' : 'Oui, supprimer définitivement'}
              </button>
              <button
                onClick={() => setDeleteClub(null)}
                className="w-full py-3.5 rounded-xl border border-transparent text-sm font-700 text-foreground hover:bg-muted transition-colors"
              >
                Annuler
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Global Toast */}
      {toast && (
        <div className="fixed bottom-10 left-1/2 -translate-x-1/2 z-[110] bg-foreground text-background px-8 py-4 rounded-full text-sm font-700 shadow-2xl shadow-black/50 animate-fade-in-up flex items-center gap-3">
          <Icon name="CheckCircleIcon" size={18} className="text-background/70" />
          {toast}
        </div>
      )}
    </>
  );
}

export const dynamic = 'force-dynamic';
