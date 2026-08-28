'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Header from '@/components/Header';
import MobilePageShell from '@/components/mobile-nav/MobilePageShell';
import MobileClubsHub from '@/components/clubs/MobileClubsHub';
import CompteBackground from '@/components/compte/CompteBackground';
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

// Dégradés officiels (tokens sage / warn / info / stone) — remplace les classes Tailwind legacy
const COVER_GRADIENTS: Record<string, string> = {
  'from-emerald-600 to-teal-700': 'from-[#365233] to-[#17402C]',
  'from-blue-600 to-indigo-700': 'from-[#4B6B7C] to-[#2A5A6E]',
  'from-amber-600 to-orange-700': 'from-[#C89A3B] to-[#8C6418]',
  'from-stone-600 to-stone-800': 'from-[#7A7365] to-[#5B554A]',
  'from-cyan-600 to-blue-700': 'from-[#3E6B7A] to-[#4B6B7C]',
  'from-slate-600 to-gray-800': 'from-[#5A574E] to-[#3F3B34]',
};
const normalizeCover = (c: string) => COVER_GRADIENTS[c] ?? c;

const _COVER_COLORS: { label: string; value: string }[] = [
  { label: 'Sauge', value: 'from-[#365233] to-[#17402C]' },
  { label: 'Info', value: 'from-[#4B6B7C] to-[#2A5A6E]' },
  { label: 'Warn', value: 'from-[#C89A3B] to-[#8C6418]' },
  { label: 'Pierre', value: 'from-[#7A7365] to-[#5B554A]' },
  { label: 'Océan', value: 'from-[#3E6B7A] to-[#4B6B7C]' },
  { label: 'Ardoise', value: 'from-[#5A574E] to-[#3F3B34]' },
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
      <div className="glass rounded-2xl w-full max-w-xl my-4 overflow-hidden flex flex-col transform transition-transform duration-300 scale-100">
        
        {/* Header */}
        <div className="flex items-center justify-between p-6 sm:px-8 pt-8 pb-4 relative z-10">
          <div>
            <h2 className="font-display font-800 text-[#17402C] text-2xl tracking-tight">
              {initial ? 'Modifier le club' : 'Créer un club'}
            </h2>
            <p className="text-[#365233] text-sm mt-1">Configurez l&apos;espace de votre communauté.</p>
          </div>
          <button onClick={onClose} className="p-3 bg-white/40 rounded-full hover:bg-[#FBFAF6] text-[#17402C] transition-colors self-start">
            <Icon name="XMarkIcon" size={20} />
          </button>
        </div>

        {/* Form Body */}
        <div className="p-6 sm:px-8 space-y-6 max-h-[60vh] overflow-y-auto custom-scrollbar relative z-10">
          <div className="flex gap-4">
            <div className="w-24">
              <label className="text-[11px] font-700 text-[#5A7064] uppercase tracking-widest block mb-2">Emoji</label>
              <input 
                className="glass-input w-full text-center text-3xl" 
                value={form.emoji} 
                onChange={(e) => set('emoji', e.target.value)} 
              />
            </div>
            <div className="flex-1">
              <label className="text-[11px] font-700 text-[#5A7064] uppercase tracking-widest block mb-2">Nom du club <span className="text-[#5B7F55]">*</span></label>
              <input 
                className="glass-input w-full text-base" 
                placeholder="Ex: Club Sahara" 
                value={form.name} 
                onChange={(e) => set('name', e.target.value)} 
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div>
              <label className="text-[11px] font-700 text-[#5A7064] uppercase tracking-widest block mb-2">Type</label>
              <div className="glass-capsule-bar w-full p-1.5">
                {[{ v: 'activite', l: '🎯 Activité' }, { v: 'pays', l: '🌍 Pays' }].map((opt) => (
                  <button 
                    key={opt.v} 
                    type="button" 
                    onClick={() => set('type', opt.v)} 
                    className={`glass-capsule-segment flex-1 ${form.type === opt.v ? 'active' : ''}`}
                  >
                    {opt.l}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-[11px] font-700 text-[#5A7064] uppercase tracking-widest block mb-2">Catégorie</label>
              <input 
                className="glass-input w-full text-sm" 
                placeholder="Ex: Randonnée, Islande..." 
                value={form.category} 
                onChange={(e) => set('category', e.target.value)} 
              />
            </div>
          </div>

          <div>
            <label className="text-[11px] font-700 text-[#5A7064] uppercase tracking-widest block mb-2">Description</label>
            <textarea 
              rows={3} 
              className="glass-input w-full text-sm resize-none" 
              placeholder="Décrivez l'objectif et l'ambiance du club..." 
              value={form.description} 
              onChange={(e) => set('description', e.target.value)} 
            />
          </div>

          <div>
            <label className="text-[11px] font-700 text-[#5A7064] uppercase tracking-widest block mb-2">Règles du club</label>
            <textarea 
              rows={2} 
              className="glass-input w-full text-sm resize-none" 
              placeholder="Règles de bonne conduite (optionnel)..." 
              value={form.rules} 
              onChange={(e) => set('rules', e.target.value)} 
            />
          </div>

          <div>
            <label className="text-[11px] font-700 text-[#5A7064] uppercase tracking-widest block mb-3">Confidentialité</label>
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
                  className={`p-4 rounded-2xl border text-left transition-all flex flex-col items-start glass-sub-card ${form.privacy === opt.v ? '!border-[#5B7F55]' : ''}`}
                >
                  <p className="text-sm font-700 text-[#17402C] mb-1">{opt.l}</p>
                  <p className="text-[11px] text-[#5A7064]">{opt.d}</p>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center gap-3 p-6 sm:px-8 border-t border-border bg-white/40 relative z-10">
          <button onClick={onClose} className="px-6 py-3 glass-capsule-btn secondary text-sm">
            Annuler
          </button>
          <button 
            onClick={() => onSave(form)} 
            disabled={saving || !form.name.trim()} 
            className="flex-1 glass-capsule-btn primary text-sm disabled:opacity-50 disabled:cursor-not-allowed"
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
  const [joinedChallenges, setJoinedChallenges] = useState<Record<string, boolean>>({});
  const [registeredEvents, setRegisteredEvents] = useState<Record<string, boolean>>({});
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

    if (currentUserId) {
      const [entriesRes, partsRes] = await Promise.all([
        supabase.from('club_challenge_entries').select('challenge_id').eq('user_id', currentUserId),
        supabase.from('club_event_participants').select('event_id').eq('user_id', currentUserId),
      ]);
      setJoinedChallenges(Object.fromEntries(((entriesRes.data as { challenge_id: string }[]) ?? []).map(e => [e.challenge_id, true])));
      setRegisteredEvents(Object.fromEntries(((partsRes.data as { event_id: string }[]) ?? []).map(e => [e.event_id, true])));
    }

    if (isAdmin) {
      const { data: pending } = await supabase.from('club_join_requests').select('*, user:user_profiles(full_name, avatar_url, trust_score)').eq('club_id', club.id).eq('status', 'pending');
      setPendingRequests((pending as ClubMember[]) ?? []);
    }
    setLoading(false);
  }, [club, supabase, isAdmin, currentUserId]);

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

  const handleJoinChallenge = async (challengeId: string) => {
    if (!currentUserId) { showToast('Connectez-vous pour participer'); return; }
    if (joinedChallenges[challengeId]) { showToast('Vous participez déjà à ce défi'); return; }
    const { error } = await supabase.from('club_challenge_entries').insert({ challenge_id: challengeId, user_id: currentUserId });
    if (error) {
      showToast('Erreur lors de la participation');
      return;
    }
    setJoinedChallenges(prev => ({ ...prev, [challengeId]: true }));
    showToast('Vous participez au défi !');
  };

  const handleToggleEventRegistration = async (eventId: string) => {
    if (!currentUserId) { showToast('Connectez-vous pour vous inscrire'); return; }
    const isReg = registeredEvents[eventId];
    if (isReg) {
      await supabase.from('club_event_participants').delete().eq('event_id', eventId).eq('user_id', currentUserId);
      setEvents(prev => prev.map(ev => ev.id === eventId ? { ...ev, participants_count: Math.max(0, (ev.participants_count || 0) - 1) } : ev));
      setRegisteredEvents(prev => ({ ...prev, [eventId]: false }));
      showToast('Désinscription validée');
    } else {
      const { error } = await supabase.from('club_event_participants').insert({ event_id: eventId, user_id: currentUserId });
      if (error) { showToast("Erreur d'inscription"); return; }
      setEvents(prev => prev.map(ev => ev.id === eventId ? { ...ev, participants_count: (ev.participants_count || 0) + 1 } : ev));
      setRegisteredEvents(prev => ({ ...prev, [eventId]: true }));
      showToast("Inscription validée !");
    }
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
      <div className="glass rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header - Immersive */}
        <div className={`bg-gradient-to-br ${normalizeCover(club.cover_color)} p-8 relative overflow-hidden shrink-0`}>
          <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 blur-[80px] rounded-full pointer-events-none" />
          <div className="relative z-10 flex items-start justify-between">
            <div className="flex items-start gap-5">
              <div className="w-16 h-16 bg-white/20 backdrop-blur-md rounded-2xl flex items-center justify-center text-4xl border border-white/20">
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

        {/* Tabs - Liquid Glass Capsule Bar */}
        <div className="px-6 py-4 border-b border-border bg-white/40 shrink-0">
          <div className="glass-capsule-bar">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as typeof activeTab)}
                className={`glass-capsule-segment ${activeTab === tab.id ? 'active' : ''}`}
              >
                <Icon name={tab.icon} size={15} className="relative z-10" />
                <span className="relative z-10">{tab.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 sm:p-8 custom-scrollbar bg-white/40">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 opacity-50">
              <div className="w-8 h-8 border-4 border-[#5B7F55] border-t-transparent rounded-full animate-spin mb-4" />
              <p className="text-sm text-[#5A7064] font-500">Chargement des données du club...</p>
            </div>
          ) : (
            <div className="max-w-3xl mx-auto">
              {/* Topics */}
              {activeTab === 'topics' && (
                <div className="space-y-6">
                  {club.is_member && (
                    <div className="glass p-5 space-y-4">
                      <div className="flex items-center gap-3 mb-2">
                        <div className="w-8 h-8 rounded-full bg-[#5B7F55]/10 flex items-center justify-center text-[#5B7F55]">
                          <Icon name="PencilIcon" size={14} />
                        </div>
                        <h3 className="font-700 text-[#17402C] text-base">Lancer une discussion</h3>
                      </div>
                      <input 
                        className="glass-input w-full text-sm" 
                        placeholder="De quoi voulez-vous parler ?" 
                        value={newTopic.title} 
                        onChange={(e) => setNewTopic((f) => ({ ...f, title: e.target.value }))} 
                      />
                      <textarea 
                        rows={3} 
                        className="glass-input w-full text-sm resize-none" 
                        placeholder="Détaillez votre sujet (optionnel)..." 
                        value={newTopic.content} 
                        onChange={(e) => setNewTopic((f) => ({ ...f, content: e.target.value }))} 
                      />
                      <div className="flex justify-end">
                        <button 
                          onClick={handlePostTopic} 
                          disabled={postingTopic || !newTopic.title.trim()} 
                          className="px-6 py-2.5 glass-capsule-btn primary text-sm disabled:opacity-50"
                        >
                          {postingTopic ? 'Publication...' : 'Publier'}
                        </button>
                      </div>
                    </div>
                  )}
                  {topics.length === 0 ? (
                    <div className="text-center py-16 border border-dashed border-[#17402C]/15 rounded-2xl bg-white/40">
                      <div className="text-5xl mb-4 opacity-50">💬</div>
                      <p className="text-[#17402C] font-700 text-lg mb-1">Aucune discussion</p>
                      <p className="text-[#5A7064] text-sm">Soyez le premier à lancer un sujet !</p>
                    </div>
                  ) : (
                    topics.map((topic) => (
                      <div key={topic.id} className={`group glass p-5 transition-all hover:interactive ${topic.is_pinned ? '!border-[#5B7F55]/40' : ''}`}>
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap mb-2">
                              {topic.is_pinned && <span className="glass-pill">📌 ÉPINGLÉ</span>}
                              {topic.is_announcement && <span className="glass-pill pill-warn">📢 ANNONCE</span>}
                              <h4 className="font-700 text-[#17402C] text-base group-hover:text-[#5B7F55] transition-colors">{topic.title}</h4>
                            </div>
                            {topic.content && <p className="text-sm text-[#5A7064] mb-4 line-clamp-2 leading-relaxed">{topic.content}</p>}
                            <div className="flex items-center gap-4 text-xs font-500 text-[#5A7064]">
                              <span className="flex items-center gap-1.5 bg-white/40 px-2 py-1 rounded-md">
                                <Icon name="UserIcon" size={12} /> {topic.author?.full_name ?? 'Anonyme'}
                              </span>
                              <span className="flex items-center gap-1.5">
                                <Icon name="HeartIcon" size={14} className="text-[#A8443A]/70" /> {topic.likes_count}
                              </span>
                              <span className="flex items-center gap-1.5">
                                <Icon name="ChatBubbleLeftIcon" size={14} className="text-[#4B6B7C]/70" /> {topic.replies_count}
                              </span>
                            </div>
                          </div>
                          {isAdmin && (
                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 bg-white/50 rounded-xl p-1">
                              <button onClick={() => handlePinTopic(topic)} title={topic.is_pinned ? 'Désépingler' : 'Épingler'} className="p-2 rounded-lg hover:bg-white transition-colors">
                                <Icon name="BookmarkIcon" size={15} className={topic.is_pinned ? 'text-[#5B7F55]' : 'text-[#5A7064]'} />
                              </button>
                              <button onClick={() => handleDeleteTopic(topic.id)} title="Supprimer" className="p-2 rounded-lg hover:bg-[#A8443A]/20 transition-colors">
                                <Icon name="TrashIcon" size={15} className="text-[#A8443A]" />
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
                    <div key={m.id} className="flex flex-col gap-3 p-4 glass hover:interactive">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[#5B7F55]/20 to-[#5B7F55]/5 flex items-center justify-center font-800 text-[#5B7F55] text-lg">
                            {m.user?.full_name?.[0] ?? '?'}
                          </div>
                          <div>
                            <p className="font-700 text-[#17402C] text-sm truncate">{m.user?.full_name ?? 'Anonyme'}</p>
                            <span className={`glass-pill mt-1 ${m.role === 'admin' ? 'pill-warn' : m.role === 'moderator' ? 'pill-info' : ''}`}>
                              {m.role === 'admin' ? '👑 ADMIN' : m.role === 'moderator' ? '🛡️ MODO' : '👤 MEMBRE'}
                            </span>
                          </div>
                        </div>
                        {isAdmin && m.user_id !== currentUserId && (
                          <button onClick={() => handleBanMember(m)} className="p-2 rounded-full hover:bg-[#A8443A]/20 text-[#5A7064] hover:text-[#A8443A] transition-colors" title="Bannir">
                            <Icon name="NoSymbolIcon" size={15} />
                          </button>
                        )}
                      </div>
                      <div className="flex items-center justify-between mt-2 pt-3 border-t border-border">
                        <p className="text-[11px] text-[#5A7064] font-600">Trust Score: {m.user?.trust_score ?? 0}</p>
                        {isAdmin && m.user_id !== currentUserId && (
                          <select
                            value={m.role}
                            onChange={(e) => handlePromoteMember(m, e.target.value as 'admin' | 'moderator' | 'member')}
                            className="text-[11px] font-600 glass-input !min-h-0 py-1.5 px-2"
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
                    <div className="text-center py-16 border border-dashed border-[#17402C]/15 rounded-2xl bg-white/40">
                      <div className="text-5xl mb-4 opacity-50">🏆</div>
                      <p className="text-[#17402C] font-700 text-lg mb-1">Aucun défi en cours</p>
                    </div>
                  ) : (
                    challenges.map((ch) => (
                      <div key={ch.id} className="glass p-6 transition-all relative overflow-hidden group hover:interactive">
                        <div className="absolute -right-10 -top-10 w-40 h-40 bg-[#C89A3B]/10 rounded-full blur-3xl group-hover:bg-[#C89A3B]/20 transition-colors" />
                        <div className="relative z-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
                          <div>
                            <div className="flex items-center gap-3 mb-2">
                              <span className="p-2 bg-[#C89A3B]/20 text-[#8C6418] rounded-xl"><Icon name="TrophyIcon" size={16} /></span>
                              <h4 className="font-800 text-[#17402C] text-lg">{ch.title}</h4>
                            </div>
                            <p className="text-sm text-[#5A7064] mb-4 max-w-xl">{ch.description}</p>
                            <div className="flex items-center gap-4 text-xs font-600">
                              <span className="glass-pill pill-warn">+{ch.xp} XP à gagner</span>
                              {ch.deadline && <span className="text-[#5A7064] flex items-center gap-1.5"><Icon name="ClockIcon" size={14} /> Fin le {new Date(ch.deadline).toLocaleDateString('fr-FR')}</span>}
                            </div>
                          </div>
                          <button
                            onClick={() => handleJoinChallenge(ch.id)}
                            className={`w-full sm:w-auto px-6 py-3 glass-capsule-btn text-sm ${joinedChallenges[ch.id] ? 'secondary' : 'primary'}`}
                          >
                            {joinedChallenges[ch.id] ? '✓ Vous participez' : 'Participer'}
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
                    <div className="glass p-6 space-y-4">
                      <div className="flex items-center gap-3 mb-4">
                        <div className="w-8 h-8 rounded-full bg-[#5B7F55]/10 flex items-center justify-center text-[#5B7F55]">
                          <Icon name="CalendarIcon" size={14} />
                        </div>
                        <h3 className="font-700 text-[#17402C] text-base">Planifier un événement</h3>
                      </div>
                      
                      <div className="space-y-4">
                        <div>
                          <label className="text-[11px] font-700 text-[#5A7064] uppercase tracking-widest block mb-2">Titre</label>
                          <input className="glass-input w-full text-sm" placeholder="Titre de l'événement..." value={newEvent.title} onChange={(e) => setNewEvent((f) => ({ ...f, title: e.target.value }))} />
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div>
                            <label className="text-[11px] font-700 text-[#5A7064] uppercase tracking-widest block mb-2">Date et Heure</label>
                            <input type="datetime-local" className="glass-input w-full text-sm text-[#17402C]" value={newEvent.event_date} onChange={(e) => setNewEvent((f) => ({ ...f, event_date: e.target.value }))} />
                          </div>
                          <div>
                            <label className="text-[11px] font-700 text-[#5A7064] uppercase tracking-widest block mb-2">Lieu / Lien</label>
                            <input className="glass-input w-full text-sm" placeholder="Chamonix ou Lien Zoom..." value={newEvent.location} onChange={(e) => setNewEvent((f) => ({ ...f, location: e.target.value }))} />
                          </div>
                        </div>
                        <div>
                          <label className="text-[11px] font-700 text-[#5A7064] uppercase tracking-widest block mb-2">Description</label>
                          <textarea rows={2} className="glass-input w-full text-sm resize-none" placeholder="Détails de l'événement..." value={newEvent.description} onChange={(e) => setNewEvent((f) => ({ ...f, description: e.target.value }))} />
                        </div>
                        <div className="flex justify-end pt-2">
                          <button onClick={handlePostEvent} disabled={postingEvent || !newEvent.title.trim()} className="px-6 py-2.5 glass-capsule-btn primary text-sm disabled:opacity-50">
                            {postingEvent ? 'Création...' : 'Créer l\'événement'}
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                  {events.length === 0 ? (
                    <div className="text-center py-16 border border-dashed border-[#17402C]/15 rounded-2xl bg-white/40">
                      <div className="text-5xl mb-4 opacity-50">📅</div>
                      <p className="text-[#17402C] font-700 text-lg mb-1">Aucun événement planifié</p>
                    </div>
                  ) : (
                    events.map((ev) => (
                      <div key={ev.id} className="glass p-5 transition-colors flex flex-col sm:flex-row gap-6">
                        <div className="glass-sub-card rounded-xl p-4 flex flex-col items-center justify-center min-w-[100px]">
                          {ev.event_date ? (
                            <>
                              <span className="text-sm font-800 text-[#5B7F55] uppercase">{new Date(ev.event_date).toLocaleDateString('fr-FR', { month: 'short' })}</span>
                              <span className="text-3xl font-900 text-[#17402C]">{new Date(ev.event_date).getDate()}</span>
                            </>
                          ) : (
                            <span className="text-sm font-700 text-[#5A7064]">À DÉFINIR</span>
                          )}
                        </div>
                        <div className="flex-1 flex flex-col justify-center">
                          <h4 className="font-800 text-[#17402C] text-lg mb-1">{ev.title}</h4>
                          {ev.description && <p className="text-sm text-[#5A7064] mb-4 line-clamp-2">{ev.description}</p>}
                          <div className="flex items-center gap-4 text-xs font-600 text-[#5A7064] flex-wrap mt-auto">
                            {ev.location && <span className="flex items-center gap-1.5 bg-white/40 px-2.5 py-1 rounded-md"><Icon name="MapPinIcon" size={14} />{ev.location}</span>}
                            <span className="flex items-center gap-1.5 bg-white/40 px-2.5 py-1 rounded-md">
                              <Icon name="UsersIcon" size={14} />{ev.participants_count} / {ev.max_participants} inscrits
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center sm:border-l sm:border-border sm:pl-6">
                          <button
                            onClick={() => handleToggleEventRegistration(ev.id)}
                            className={`w-full sm:w-auto px-6 py-3 glass-capsule-btn text-sm ${registeredEvents[ev.id] ? 'secondary' : 'primary'}`}
                          >
                            {registeredEvents[ev.id] ? '✓ Inscrit' : 'S&apos;inscrire'}
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
                    <h3 className="font-700 text-[#17402C] text-lg mb-4 flex items-center gap-2">
                      <Icon name="ShieldCheckIcon" size={20} className="text-[#8C6418]" />
                      Demandes d&apos;adhésion en attente
                      <span className="glass-pill pill-warn">{pendingRequests.length}</span>
                    </h3>
                    {pendingRequests.length === 0 ? (
                      <div className="text-center py-12 border border-dashed border-[#17402C]/15 rounded-2xl bg-white/40">
                        <p className="text-[#5A7064] text-sm font-500">Aucune demande en attente pour le moment.</p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {pendingRequests.map((req) => (
                          <div key={req.id} className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 glass hover:interactive">
                            <div className="flex items-center gap-4">
                              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-white/50 to-white/20 flex items-center justify-center font-800 text-[#17402C] text-lg border border-border">
                                {(req as unknown as { user?: { full_name: string } }).user?.full_name?.[0] ?? '?'}
                              </div>
                              <div>
                                <p className="font-700 text-[#17402C] text-base">{(req as unknown as { user?: { full_name: string } }).user?.full_name ?? 'Anonyme'}</p>
                                <p className="text-xs text-[#5A7064] font-600 mt-0.5">Trust Score: {(req as unknown as { user?: { trust_score: number } }).user?.trust_score ?? 0}</p>
                              </div>
                            </div>
                            <div className="flex gap-2 w-full sm:w-auto">
                              <button onClick={() => handleApproveRequest(req.id, req.user_id, true)} className="flex-1 sm:flex-none px-4 py-2 glass-capsule-btn primary text-sm">Accepter</button>
                              <button onClick={() => handleApproveRequest(req.id, req.user_id, false)} className="flex-1 sm:flex-none px-4 py-2 glass-capsule-btn secondary text-sm text-[#A8443A]">Refuser</button>
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
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-[100] bg-[#17402C] text-[#FAF8F5] px-6 py-3 rounded-full text-sm font-700  animate-fade-in-up">
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
  onOpenDetail,
  onEdit,
  onDelete,
  currentUserId,
}: {
  club: Club;
  onToggleMember: (clubId: string, joined: boolean) => void;
  onOpenDetail: (club: Club) => void;
  onEdit: (club: Club) => void;
  onDelete: (club: Club) => void;
  currentUserId?: string;
}) {
  const [joining, setJoining] = useState(false);
  const isOwner = currentUserId === club.created_by;

  const handleToggle = async (e: React.MouseEvent) => {
    e.stopPropagation(); // prevent opening modal if clicking join
    setJoining(true);
    await onToggleMember(club.id, !!club.is_member);
    setJoining(false);
  };

  return (
    <Link 
      href={`/clubs/${club.slug}`}
      className="group relative flex flex-col glass rounded-[1.25rem] hover:interactive transition-all duration-300 overflow-hidden cursor-pointer h-full block"
    >
      {/* Decorative Blur Background */}
      <div className={`absolute -top-32 -right-32 w-64 h-64 bg-gradient-to-br ${normalizeCover(club.cover_color)} rounded-full blur-[80px] opacity-20 group-hover:opacity-40 transition-opacity duration-500 pointer-events-none`} />

      <div className="p-6 relative z-10 flex flex-col h-full">
        {/* Card Header */}
        <div className="flex items-start justify-between mb-5">
          <div className="w-16 h-16 rounded-2xl glass-sub-card flex items-center justify-center text-3xl group-hover:scale-110 group-hover:rotate-3 transition-transform duration-300">
            {club.emoji}
          </div>
          
          <div className="flex items-center gap-1.5">
            {isOwner && (
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button 
                  onClick={(e) => { e.stopPropagation(); onEdit(club); }} 
                  className="p-2 bg-white/40 hover:bg-[#17402C] hover:text-[#FAF8F5] rounded-full transition-colors text-[#5A7064]"
                  title="Modifier"
                >
                  <Icon name="PencilIcon" size={14} />
                </button>
                <button 
                  onClick={(e) => { e.stopPropagation(); onDelete(club); }} 
                  className="p-2 bg-[#A8443A]/10 hover:bg-[#A8443A] text-[#A8443A] hover:text-white rounded-full transition-colors"
                  title="Supprimer"
                >
                  <Icon name="TrashIcon" size={14} />
                </button>
              </div>
            )}
            {club.is_member && (
              <span className="bg-[#5B7F55]/20 text-[#5B7F55] border border-[#5B7F55]/30 p-2 rounded-full" title="Vous êtes membre">
                <Icon name="CheckIcon" size={14} />
              </span>
            )}
          </div>
        </div>

        {/* Content */}
        <div className="mb-4">
          <div className="flex items-center gap-2 mb-1.5">
            <span className="text-[10px] font-800 tracking-widest uppercase text-[#5A7064]">
              {club.type === 'activite' ? 'Activité' : 'Destination'}
            </span>
            {club.privacy !== 'open' && (
              <span className="glass-pill">
                <Icon name={club.privacy === 'closed' ? 'LockClosedIcon' : 'EyeSlashIcon'} size={10} />
                {club.privacy === 'closed' ? 'Fermé' : 'Secret'}
              </span>
            )}
          </div>
          <h3 className="font-display font-800 text-[#17402C] text-xl leading-tight flex items-center gap-2 group-hover:text-[#5B7F55] transition-colors">
            {club.name}
            {club.is_verified && <Icon name="CheckBadgeIcon" size={18} className="text-[#4B6B7C]" />}
          </h3>
        </div>

        <p className="text-sm text-[#5A7064] leading-relaxed line-clamp-3 mb-6 flex-1">
          {club.description}
        </p>

        {/* Footer Stats & Action */}
        <div className="mt-auto pt-5 border-t border-border flex items-center justify-between">
          <div className="flex flex-col gap-1">
            <span className="text-xs font-700 text-[#17402C] flex items-center gap-1.5">
              <Icon name="UsersIcon" size={14} className="text-[#5A7064]" />
              {club.members_count.toLocaleString()} membres
            </span>
            <span className="text-[11px] font-600 text-[#5A7064] flex items-center gap-1.5">
              <Icon name="BoltIcon" size={12} className="text-[#C89A3B]/70" />
              {club.active_this_month} actifs ce mois
            </span>
          </div>

          <button
            onClick={handleToggle}
            disabled={joining}
            className={`px-4 py-2.5 glass-capsule-btn text-xs font-800 ${
              club.is_member 
                ? 'secondary text-[#A8443A]' 
                : 'primary'
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
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
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
  }, [user, supabase]);

  useEffect(() => { 
    loadClubs(); 
    
    const handleClubCreated = () => {
      loadClubs();
    };
    window.addEventListener('club_created', handleClubCreated);
    return () => window.removeEventListener('club_created', handleClubCreated);
  }, [loadClubs]);

  const handleToggleMember = async (clubId: string, isCurrentlyMember: boolean) => {
    if (!user) { showToast('Connectez-vous pour rejoindre un club'); return; }
    const club = clubs.find((c) => c.id === clubId);
    if (!club) return;

    if (isCurrentlyMember) {
      await supabase.from('club_members').delete().eq('club_id', clubId).eq('user_id', user.id);
      await supabase.from('clubs').update({ members_count: Math.max(0, club.members_count - 1) }).eq('id', clubId);
      setClubs((prev) => prev.map((c) => c.id === clubId ? { ...c, is_member: false, member_role: undefined, members_count: Math.max(0, c.members_count - 1) } : c));
      showToast('Vous avez quitté le club');
    } else if (club.privacy === 'open') {
      await supabase.from('club_members').insert({ club_id: clubId, user_id: user.id, role: 'member', status: 'active' });
      await supabase.from('clubs').update({ members_count: club.members_count + 1 }).eq('id', clubId);
      setClubs((prev) => prev.map((c) => c.id === clubId ? { ...c, is_member: true, member_role: 'member', members_count: c.members_count + 1 } : c));
      showToast('Bienvenue dans le club !');
    } else {
      // Closed/secret: send join request
      await supabase.from('club_join_requests').upsert({ club_id: clubId, user_id: user.id, status: 'pending' }, { onConflict: 'club_id,user_id' });
      showToast("Demande d'adhésion envoyée !");
    }
  };

  const handleSaveClub = async (form: ClubForm) => {
    if (!user) return;
    setSaving(true);
    try {
      const colorMap: Record<string, string> = {
        'activite': 'from-[#365233] to-[#17402C]',
        'pays': 'from-[#4B6B7C] to-[#2A5A6E]',
      };
      const payload = {
        name: form.name,
        type: form.type,
        emoji: form.emoji,
        description: form.description,
        category: form.category,
        rules: form.rules,
        privacy: form.privacy,
        cover_color: colorMap[form.type] ?? 'from-[#365233] to-[#17402C]',
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
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erreur');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteClub = async () => {
    if (!deleteClub) return;
    setDeleting(true);
    await supabase.from('clubs').delete().eq('id', deleteClub.id);
    setDeleteClub(null);
    setDeleting(false);
    showToast('Club supprimé');
    await loadClubs();
  };

  const activityClubs = clubs.filter((c) => c.type === 'activite');
  const countryClubs = clubs.filter((c) => c.type === 'pays');
  const myClubs = clubs.filter((c) => c.is_member);

  const editForm: ClubForm | undefined = editClub ? {
    name: editClub.name,
    type: editClub.type,
    emoji: editClub.emoji,
    description: editClub.description,
    category: editClub.category,
    rules: editClub.rules,
    privacy: editClub.privacy,
  } : undefined;

  const displayedClubs = activeTab === 'activite' ? activityClubs : activeTab === 'pays' ? countryClubs : myClubs;

  return (
    <>
      {/* ── DESKTOP ── */}
      <div className="hidden md:block">
        <main className="h-dvh overflow-hidden bg-[#FAF8F5] flex flex-col">
          <Header />
          <div className="flex-1 min-h-0 overflow-y-auto">
          {/* Immersive Hero Section */}
          <section className="relative pt-32 pb-20 lg:pt-40 lg:pb-32 overflow-hidden border-b border-white/5">
            <div className="absolute inset-0 bg-[#FAF8F5] pointer-events-none" />
            <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-[#5B7F55]/20 rounded-full blur-[120px] opacity-60 mix-blend-screen pointer-events-none animate-pulse-slow" />
            <div className="absolute -bottom-40 -left-40 w-[600px] h-[600px] bg-[#4B6B7C]/10 rounded-full blur-[120px] opacity-50 mix-blend-screen pointer-events-none" />

            <div className="max-w-7xl mx-auto px-6 relative z-10">
              <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-10">
                <div className="max-w-3xl">
                  <div className="inline-flex items-center gap-2 mb-6 px-3 py-1.5 rounded-full bg-white/5 border border-white/10 backdrop-blur-md">
                    <span className="w-2 h-2 rounded-full bg-[#5B7F55] animate-pulse" />
                    <span className="text-xs font-700 tracking-widest uppercase text-[#17402C]/80">Espaces Communautaires</span>
                  </div>
                  <h1 className="font-display font-900 text-5xl lg:text-7xl text-[#17402C] tracking-tight leading-[1.1] mb-6">
                    Rejoignez le <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#5B7F55] to-[#A6C1A0]">Club.</span><br />
                    Vivez l&apos;aventure.
                  </h1>
                  <p className="text-lg lg:text-xl text-[#5A7064] font-500 leading-relaxed max-w-2xl">
                    Trouvez vos compagnons de route, échangez sur votre matériel favori et participez aux défis thématiques de la communauté Le Kit du Voyageur.
                  </p>
                </div>

                <div className="flex-shrink-0">
                  <Link
                    href="/clubs/nouveau"
                    className="glass-capsule-btn primary px-8 py-4 text-sm"
                  >
                    <Icon name="PlusIcon" size={18} className="relative z-10 transition-transform group-hover:rotate-90 duration-300" />
                    <span className="relative z-10">Fonder un Club</span>
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
                <div className="glass-capsule-bar p-1.5">
                  {[
                    { id: 'activite', label: 'Par Activité', icon: 'BoltIcon', count: activityClubs.length },
                    { id: 'pays', label: 'Par Destination', icon: 'GlobeAltIcon', count: countryClubs.length },
                    { id: 'mes-clubs', label: 'Mes Clubs', icon: 'UserGroupIcon', count: myClubs.length },
                  ].map((tab) => (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id as typeof activeTab)}
                      className={`glass-capsule-segment flex items-center gap-2 ${activeTab === tab.id ? 'active' : ''}`}
                    >
                      <Icon name={tab.icon} size={16} className="relative z-10" />
                      <span className="relative z-10">{tab.label}</span>
                      {tab.count > 0 && (
                        <span className="ml-1 glass-pill text-[10px] px-2 py-0.5 font-800 relative z-10">
                          {tab.count}
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              </div>

              {error && (
                <div className="mb-10 p-5 bg-[#A8443A]/10 border border-[#A8443A]/25 rounded-2xl flex items-center gap-3 text-[#A8443A]">
                  <Icon name="ExclamationTriangleIcon" size={20} />
                  <p className="font-600 text-sm">{error}</p>
                </div>
              )}

              {/* Grid Content */}
              {loading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                  {[1, 2, 3, 4, 5, 6].map((i) => (
                    <div key={i} className="h-80 rounded-[1.25rem] glass animate-pulse flex flex-col p-6">
                      <div className="w-16 h-16 rounded-2xl bg-white/40 mb-6" />
                      <div className="w-1/3 h-4 bg-white/40 rounded-full mb-3" />
                      <div className="w-2/3 h-6 bg-white/40 rounded-full mb-6" />
                      <div className="w-full h-16 bg-white/40 rounded-xl mt-auto" />
                    </div>
                  ))}
                </div>
              ) : displayedClubs.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 px-4 text-center glass rounded-[3rem] border-dashed">
                  <div className="w-24 h-24 bg-white/50 rounded-full flex items-center justify-center text-4xl mb-6">
                    {activeTab === 'mes-clubs' ? '🏕️' : '✨'}
                  </div>
                  <h3 className="font-display font-800 text-2xl text-[#17402C] mb-3">
                    {activeTab === 'mes-clubs' ? "Vous n'avez rejoint aucun club" : 'Espace encore vierge'}
                  </h3>
                  <p className="text-[#5A7064] text-base max-w-md mb-8">
                    {activeTab === 'mes-clubs'
                      ? 'Explorez les clubs existants et trouvez votre prochaine équipe de choc pour vos aventures.'
                      : "Il n'y a pas encore de club dans cette catégorie. Soyez le pionnier et créez le vôtre !"}
                  </p>

                  {activeTab === 'mes-clubs' ? (
                    user ? (
                      <button onClick={() => setActiveTab('activite')} className="px-8 py-3.5 glass-capsule-btn primary text-sm">
                        Explorer les clubs
                      </button>
                    ) : (
                      <Link href="/connexion" className="px-8 py-3.5 glass-capsule-btn primary text-sm">
                        Se connecter pour rejoindre
                      </Link>
                    )
                  ) : (
                    <Link href="/clubs/nouveau" className="glass-capsule-btn primary px-8 py-3.5 text-sm items-center gap-2">
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

          </div>
        </main>
      </div>

      {/* ── MOBILE VIEW ── */}
      <div className="block md:hidden min-h-screen relative font-sans text-[#17402C]">
        <MobilePageShell videoBackground={true} background="transparent">
          <MobileClubsHub
            clubs={clubs}
            myClubs={clubs.filter(c => c.is_member)}
            loading={loading}
            user={user}
            onJoinClub={async (clubId) => {
              const target = clubs.find(c => c.id === clubId);
              if (target) handleToggleMember(clubId, !!target.is_member);
            }}
            onOpenCreateModal={() => {
              if (!user) {
                setToast('Veuillez vous connecter pour créer un club.');
                return;
              }
              setEditClub(null);
              setShowCreateModal(true);
            }}
            onRefresh={loadClubs}
          />
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
          <div className="glass rounded-2xl p-8 max-w-sm w-full text-center transform transition-all scale-100">
            <div className="w-20 h-20 rounded-full bg-[#A8443A]/10 flex items-center justify-center mx-auto mb-5">
              <Icon name="ExclamationTriangleIcon" size={32} className="text-[#A8443A]" />
            </div>
            <h3 className="font-display font-800 text-[#17402C] text-xl mb-2">Supprimer le club ?</h3>
            <p className="text-sm text-[#5A7064] mb-8">Cette action est irréversible. Toutes les données, membres et discussions de &quot;{deleteClub.name}&quot; seront perdus à jamais.</p>

            <div className="flex flex-col gap-3">
              <button
                onClick={handleDeleteClub}
                disabled={deleting}
                className="w-full py-3.5 glass-capsule-btn glass-btn-danger text-sm disabled:opacity-50"
              >
                {deleting ? 'Destruction en cours...' : 'Oui, supprimer définitivement'}
              </button>
              <button
                onClick={() => setDeleteClub(null)}
                className="w-full py-3.5 glass-capsule-btn secondary text-sm"
              >
                Annuler
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Global Toast */}
      {toast && (
        <div className="fixed bottom-10 left-1/2 -translate-x-1/2 z-[110] bg-[#17402C] text-[#FAF8F5] px-8 py-4 rounded-full text-sm font-700  animate-fade-in-up flex items-center gap-3">
          <Icon name="CheckCircleIcon" size={18} className="text-[#FAF8F5]/70" />
          {toast}
        </div>
      )}
    </>
  );
}

export const dynamic = 'force-dynamic';
