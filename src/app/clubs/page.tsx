'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
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
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-card border border-border rounded-2xl w-full max-w-lg my-4">
        <div className="flex items-center justify-between p-6 border-b border-border">
          <h2 className="font-display font-700 text-foreground text-xl">{initial ? 'Modifier le club' : 'Créer un club'}</h2>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-muted transition-colors"><Icon name="XMarkIcon" size={20} /></button>
        </div>
        <div className="p-6 space-y-4 max-h-[65vh] overflow-y-auto">
          <div className="grid grid-cols-4 gap-3">
            <div>
              <label className="text-xs font-700 text-muted-foreground uppercase tracking-wider block mb-1.5">Emoji</label>
              <input className="w-full bg-background border border-border rounded-xl px-3 py-2.5 text-center text-xl focus:outline-none focus:ring-2 focus:ring-primary/30" value={form.emoji} onChange={(e) => set('emoji', e.target.value)} />
            </div>
            <div className="col-span-3">
              <label className="text-xs font-700 text-muted-foreground uppercase tracking-wider block mb-1.5">Nom du club *</label>
              <input className="w-full bg-background border border-border rounded-xl px-4 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30" placeholder="Ex: Club Sahara" value={form.name} onChange={(e) => set('name', e.target.value)} />
            </div>
          </div>
          <div>
            <label className="text-xs font-700 text-muted-foreground uppercase tracking-wider block mb-2">Type</label>
            <div className="grid grid-cols-2 gap-2">
              {[{ v: 'activite', l: '🎯 Activité' }, { v: 'pays', l: '🌍 Destination' }].map((opt) => (
                <button key={opt.v} type="button" onClick={() => set('type', opt.v)} className={`py-2 px-3 rounded-xl border-2 text-sm font-600 transition-all ${form.type === opt.v ? 'border-primary bg-primary/5 text-primary' : 'border-border text-muted-foreground hover:border-primary/50'}`}>{opt.l}</button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-xs font-700 text-muted-foreground uppercase tracking-wider block mb-1.5">Catégorie</label>
            <input className="w-full bg-background border border-border rounded-xl px-4 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30" placeholder="Ex: Randonnée, Alpinisme, Islande..." value={form.category} onChange={(e) => set('category', e.target.value)} />
          </div>
          <div>
            <label className="text-xs font-700 text-muted-foreground uppercase tracking-wider block mb-1.5">Description</label>
            <textarea rows={3} className="w-full bg-background border border-border rounded-xl px-4 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none" placeholder="Décrivez l'objectif du club..." value={form.description} onChange={(e) => set('description', e.target.value)} />
          </div>
          <div>
            <label className="text-xs font-700 text-muted-foreground uppercase tracking-wider block mb-1.5">Règles du club</label>
            <textarea rows={2} className="w-full bg-background border border-border rounded-xl px-4 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none" placeholder="Règles de bonne conduite..." value={form.rules} onChange={(e) => set('rules', e.target.value)} />
          </div>
          <div>
            <label className="text-xs font-700 text-muted-foreground uppercase tracking-wider block mb-2">Confidentialité</label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { v: 'open', l: '🌍 Ouvert', d: 'Tout le monde peut rejoindre' },
                { v: 'closed', l: '🔒 Fermé', d: 'Sur demande d\'adhésion' },
                { v: 'secret', l: '🕵️ Secret', d: 'Sur invitation uniquement' },
              ].map((opt) => (
                <button key={opt.v} type="button" onClick={() => set('privacy', opt.v)} className={`p-2.5 rounded-xl border-2 text-left transition-all ${form.privacy === opt.v ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'}`}>
                  <p className="text-xs font-700 text-foreground">{opt.l}</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">{opt.d}</p>
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="flex gap-3 p-6 border-t border-border">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-border text-sm font-600 text-muted-foreground hover:bg-muted transition-colors">Annuler</button>
          <button onClick={() => onSave(form)} disabled={saving || !form.name.trim()} className="flex-1 py-2.5 rounded-xl bg-primary text-white text-sm font-700 hover:bg-primary/90 transition-colors disabled:opacity-50">
            {saving ? 'Enregistrement...' : initial ? 'Mettre à jour' : 'Créer le club'}
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
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-background border border-border rounded-2xl w-full max-w-3xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className={`bg-gradient-to-br ${club.cover_color} p-5 rounded-t-2xl`}>
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <span className="text-3xl">{club.emoji}</span>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="font-display font-700 text-white text-xl">{club.name}</h2>
                  {club.is_verified && <span className="text-[10px] bg-white/20 text-white px-2 py-0.5 rounded-full font-700">✓ Vérifié</span>}
                </div>
                <p className="text-white/60 text-xs">{club.members_count.toLocaleString()} membres · {club.privacy}</p>
              </div>
            </div>
            <button onClick={onClose} className="p-2 bg-white/20 rounded-xl hover:bg-white/30 transition-colors"><Icon name="XMarkIcon" size={18} className="text-white" /></button>
          </div>
          {club.rules && (
            <div className="mt-3 bg-white/10 rounded-xl px-3 py-2">
              <p className="text-[10px] text-white/60 font-700 uppercase tracking-wider mb-0.5">Règles</p>
              <p className="text-xs text-white/80">{club.rules}</p>
            </div>
          )}
        </div>

        {/* Tabs */}
        <div className="flex overflow-x-auto border-b border-border bg-card scrollbar-hide">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as typeof activeTab)}
              className={`flex items-center gap-1.5 px-4 py-3 text-xs font-600 border-b-2 transition-all whitespace-nowrap ${activeTab === tab.id ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
            >
              <Icon name={tab.icon} size={13} />
              {tab.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5">
          {loading ? (
            <div className="text-center py-10 text-muted-foreground text-sm">Chargement...</div>
          ) : (
            <>
              {/* Topics */}
              {activeTab === 'topics' && (
                <div className="space-y-4">
                  {club.is_member && (
                    <div className="bg-muted rounded-xl p-4 space-y-3">
                      <input className="w-full bg-background border border-border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" placeholder="Titre de la discussion..." value={newTopic.title} onChange={(e) => setNewTopic((f) => ({ ...f, title: e.target.value }))} />
                      <textarea rows={2} className="w-full bg-background border border-border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none" placeholder="Contenu (optionnel)..." value={newTopic.content} onChange={(e) => setNewTopic((f) => ({ ...f, content: e.target.value }))} />
                      <button onClick={handlePostTopic} disabled={postingTopic || !newTopic.title.trim()} className="px-4 py-2 bg-primary text-white rounded-xl text-sm font-600 disabled:opacity-50 hover:bg-primary/90 transition-colors">
                        {postingTopic ? 'Publication...' : 'Publier'}
                      </button>
                    </div>
                  )}
                  {topics.length === 0 ? (
                    <div className="text-center py-10 text-muted-foreground text-sm">Aucune discussion pour l&apos;instant.</div>
                  ) : (
                    topics.map((topic) => (
                      <div key={topic.id} className={`topo-card p-4 ${topic.is_pinned ? 'border-primary/30 bg-primary/5' : ''}`}>
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap mb-1">
                              {topic.is_pinned && <span className="text-[10px] bg-primary/10 text-primary px-2 py-0.5 rounded-full font-700">📌 Épinglé</span>}
                              {topic.is_announcement && <span className="text-[10px] bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-700">📢 Annonce</span>}
                              <h4 className="font-600 text-foreground text-sm">{topic.title}</h4>
                            </div>
                            {topic.content && <p className="text-xs text-muted-foreground mb-2 line-clamp-2">{topic.content}</p>}
                            <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
                              <span>{topic.author?.full_name ?? 'Anonyme'}</span>
                              <span>❤️ {topic.likes_count}</span>
                              <span>💬 {topic.replies_count}</span>
                            </div>
                          </div>
                          {isAdmin && (
                            <div className="flex items-center gap-1 flex-shrink-0">
                              <button onClick={() => handlePinTopic(topic)} title={topic.is_pinned ? 'Désépingler' : 'Épingler'} className="p-1.5 rounded-lg hover:bg-muted transition-colors">
                                <Icon name="BookmarkIcon" size={13} className={topic.is_pinned ? 'text-primary' : 'text-muted-foreground'} />
                              </button>
                              <button onClick={() => handleDeleteTopic(topic.id)} title="Supprimer" className="p-1.5 rounded-lg hover:bg-red-50 transition-colors">
                                <Icon name="TrashIcon" size={13} className="text-red-500" />
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
                <div className="space-y-3">
                  {members.map((m) => (
                    <div key={m.id} className="flex items-center gap-3 p-3 topo-card">
                      <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center font-700 text-primary text-sm flex-shrink-0">
                        {m.user?.full_name?.[0] ?? '?'}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-600 text-foreground text-sm truncate">{m.user?.full_name ?? 'Anonyme'}</p>
                          <span className={`text-[10px] px-2 py-0.5 rounded-full font-700 ${m.role === 'admin' ? 'bg-amber-100 text-amber-700' : m.role === 'moderator' ? 'bg-blue-100 text-blue-700' : 'bg-muted text-muted-foreground'}`}>
                            {m.role === 'admin' ? '👑 Admin' : m.role === 'moderator' ? '🛡️ Modo' : '👤 Membre'}
                          </span>
                        </div>
                        <p className="text-[10px] text-muted-foreground">Trust {m.user?.trust_score ?? 0}</p>
                      </div>
                      {isAdmin && m.user_id !== currentUserId && (
                        <div className="flex items-center gap-1">
                          <select
                            value={m.role}
                            onChange={(e) => handlePromoteMember(m, e.target.value as 'admin' | 'moderator' | 'member')}
                            className="text-xs bg-background border border-border rounded-lg px-2 py-1 focus:outline-none"
                          >
                            <option value="member">Membre</option>
                            <option value="moderator">Modérateur</option>
                            <option value="admin">Admin</option>
                          </select>
                          <button onClick={() => handleBanMember(m)} className="p-1.5 rounded-lg hover:bg-red-50 transition-colors" title="Bannir">
                            <Icon name="NoSymbolIcon" size={13} className="text-red-500" />
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Challenges */}
              {activeTab === 'challenges' && (
                <div className="space-y-4">
                  {challenges.length === 0 ? (
                    <div className="text-center py-10 text-muted-foreground text-sm">Aucun défi actif.</div>
                  ) : (
                    challenges.map((ch) => (
                      <div key={ch.id} className="topo-card p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <h4 className="font-700 text-foreground text-sm mb-1">{ch.title}</h4>
                            <p className="text-xs text-muted-foreground mb-2">{ch.description}</p>
                            <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
                              <span className="text-amber-600 font-700">+{ch.xp} XP</span>
                              {ch.deadline && <span>⏰ {new Date(ch.deadline).toLocaleDateString('fr-FR')}</span>}
                            </div>
                          </div>
                          <button className="flex-shrink-0 px-3 py-1.5 bg-primary text-white rounded-xl text-xs font-700 hover:bg-primary/90 transition-colors">
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
                <div className="space-y-4">
                  {isAdmin && (
                    <div className="bg-muted rounded-xl p-4 space-y-3">
                      <p className="text-xs font-700 text-foreground uppercase tracking-wider">Ajouter un événement</p>
                      <input className="w-full bg-background border border-border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" placeholder="Titre de l'événement..." value={newEvent.title} onChange={(e) => setNewEvent((f) => ({ ...f, title: e.target.value }))} />
                      <div className="grid grid-cols-2 gap-3">
                        <input type="datetime-local" className="w-full bg-background border border-border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" value={newEvent.event_date} onChange={(e) => setNewEvent((f) => ({ ...f, event_date: e.target.value }))} />
                        <input className="w-full bg-background border border-border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" placeholder="Lieu..." value={newEvent.location} onChange={(e) => setNewEvent((f) => ({ ...f, location: e.target.value }))} />
                      </div>
                      <textarea rows={2} className="w-full bg-background border border-border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none" placeholder="Description..." value={newEvent.description} onChange={(e) => setNewEvent((f) => ({ ...f, description: e.target.value }))} />
                      <button onClick={handlePostEvent} disabled={postingEvent || !newEvent.title.trim()} className="px-4 py-2 bg-primary text-white rounded-xl text-sm font-600 disabled:opacity-50 hover:bg-primary/90 transition-colors">
                        {postingEvent ? 'Ajout...' : 'Ajouter à l\'agenda'}
                      </button>
                    </div>
                  )}
                  {events.length === 0 ? (
                    <div className="text-center py-10 text-muted-foreground text-sm">Aucun événement planifié.</div>
                  ) : (
                    events.map((ev) => (
                      <div key={ev.id} className="topo-card p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <h4 className="font-700 text-foreground text-sm mb-1">{ev.title}</h4>
                            {ev.description && <p className="text-xs text-muted-foreground mb-2">{ev.description}</p>}
                            <div className="flex items-center gap-3 text-[10px] text-muted-foreground flex-wrap">
                              {ev.event_date && <span className="flex items-center gap-1"><Icon name="CalendarIcon" size={11} />{new Date(ev.event_date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })}</span>}
                              {ev.location && <span className="flex items-center gap-1"><Icon name="MapPinIcon" size={11} />{ev.location}</span>}
                              <span>{ev.participants_count}/{ev.max_participants} participants</span>
                            </div>
                          </div>
                          <button className="flex-shrink-0 px-3 py-1.5 bg-primary text-white rounded-xl text-xs font-700 hover:bg-primary/90 transition-colors">
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
                <div className="space-y-4">
                  <div>
                    <h3 className="font-700 text-foreground text-sm mb-3">Demandes d&apos;adhésion ({pendingRequests.length})</h3>
                    {pendingRequests.length === 0 ? (
                      <p className="text-sm text-muted-foreground">Aucune demande en attente.</p>
                    ) : (
                      pendingRequests.map((req) => (
                        <div key={req.id} className="flex items-center gap-3 p-3 topo-card mb-2">
                          <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center font-700 text-primary text-sm flex-shrink-0">
                            {(req as unknown as { user?: { full_name: string } }).user?.full_name?.[0] ?? '?'}
                          </div>
                          <div className="flex-1">
                            <p className="font-600 text-foreground text-sm">{(req as unknown as { user?: { full_name: string } }).user?.full_name ?? 'Anonyme'}</p>
                            <p className="text-[10px] text-muted-foreground">Trust {(req as unknown as { user?: { trust_score: number } }).user?.trust_score ?? 0}</p>
                          </div>
                          <div className="flex gap-2">
                            <button onClick={() => handleApproveRequest(req.id, req.user_id, true)} className="px-3 py-1.5 bg-emerald-500 text-white rounded-xl text-xs font-700 hover:bg-emerald-600 transition-colors">✓ Accepter</button>
                            <button onClick={() => handleApproveRequest(req.id, req.user_id, false)} className="px-3 py-1.5 bg-red-500 text-white rounded-xl text-xs font-700 hover:bg-red-600 transition-colors">✗ Refuser</button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {toast && (
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-foreground text-background px-4 py-2 rounded-xl text-sm font-600 shadow-xl z-10">
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

  const handleToggle = async () => {
    setJoining(true);
    await onToggleMember(club.id, !!club.is_member);
    setJoining(false);
  };

  return (
    <div className="topo-card overflow-hidden flex flex-col">
      <div className={`bg-gradient-to-br ${club.cover_color} p-5 text-white relative`}>
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-3">
            <span className="text-3xl">{club.emoji}</span>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-display font-700 text-white text-lg leading-tight">{club.name}</h3>
                {club.is_verified && <span className="text-[10px] bg-white/20 text-white px-1.5 py-0.5 rounded-full font-700">✓</span>}
              </div>
              <span className="text-white/60 text-[10px] uppercase tracking-wider font-600">
                {club.type === 'activite' ? 'Club activité' : 'Club destination'}
                {club.privacy !== 'open' && ` · ${club.privacy === 'closed' ? '🔒 Fermé' : '🕵️ Secret'}`}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-1">
            {isOwner && (
              <>
                <button onClick={() => onEdit(club)} className="p-1.5 bg-white/20 rounded-lg hover:bg-white/30 transition-colors"><Icon name="PencilIcon" size={13} className="text-white" /></button>
                <button onClick={() => onDelete(club)} className="p-1.5 bg-red-500/70 rounded-lg hover:bg-red-500 transition-colors"><Icon name="TrashIcon" size={13} className="text-white" /></button>
              </>
            )}
            <button
              onClick={handleToggle}
              disabled={joining}
              className={`px-3 py-1.5 rounded-full text-xs font-700 transition-all ${club.is_member ? 'bg-white/20 text-white border border-white/30' : 'bg-white text-gray-800'}`}
            >
              {joining ? '...' : club.is_member ? '✓ Membre' : 'Rejoindre'}
            </button>
          </div>
        </div>
        <div className="flex items-center gap-4 text-xs text-white/70">
          <span className="flex items-center gap-1"><Icon name="UsersIcon" size={11} />{club.members_count.toLocaleString()} membres</span>
          <span className="flex items-center gap-1"><Icon name="BoltIcon" size={11} />{club.active_this_month} actifs</span>
        </div>
      </div>

      <div className="p-5 flex-1 flex flex-col">
        <p className="text-sm text-muted-foreground mb-4 leading-relaxed line-clamp-2">{club.description}</p>

        {club.topics && club.topics.length > 0 && (
          <div className="mb-4 flex-1">
            <p className="text-[10px] font-700 text-muted-foreground uppercase tracking-wider mb-2">Discussions récentes</p>
            <div className="space-y-1">
              {club.topics.slice(0, 3).map((t, i) => (
                <p key={i} className="text-xs text-muted-foreground flex items-start gap-1.5">
                  <span className="text-primary mt-0.5 flex-shrink-0">›</span>
                  <span className="truncate">{t.title}</span>
                </p>
              ))}
            </div>
          </div>
        )}

        <div className="flex gap-2 mt-auto">
          <Link
            href={`/clubs/${club.id}`}
            className="flex-1 btn-secondary justify-center py-2 text-sm text-center"
          >
            Accéder au club
          </Link>
          <button
            onClick={() => onOpenDetail(club)}
            className="px-3 py-2 border border-border rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            title="Aperçu rapide"
          >
            <Icon name="EyeIcon" size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function ClubsPage() {
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

      setClubs(
        (clubsData ?? []).map((c) => ({
          ...c,
          is_member: !!memberMap[c.id] && memberMap[c.id].status === 'active',
          member_role: memberMap[c.id]?.role,
          member_status: memberMap[c.id]?.status,
        }))
      );
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erreur de chargement');
    } finally {
      setLoading(false);
    }
  }, [user, supabase]);

  useEffect(() => { loadClubs(); }, [loadClubs]);

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
      showToast('Demande d\'adhésion envoyée !');
    }
  };

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
        showToast('Club créé ! Vous en êtes l\'administrateur.');
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
    <main className="min-h-screen bg-background">
      <Header />
      <div className="pt-16 lg:pt-18">
        {/* Hero */}
        <section className="bg-dark-bg text-white py-14 px-4 relative overflow-hidden">
          <div className="absolute inset-0 opacity-10 pointer-events-none">
            <div className="absolute top-0 right-0 w-96 h-96 rounded-full bg-secondary blur-3xl" />
          </div>
          <div className="max-w-7xl mx-auto relative">
            <div className="flex items-center gap-2 mb-4">
              <span className="tag-badge bg-secondary/30 text-emerald-300 border border-emerald-500/30 text-[10px]">COMMUNAUTÉ</span>
              <span className="text-white/50 text-xs font-mono">CLUBS THÉMATIQUES</span>
            </div>
            <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6">
              <div>
                <h1 className="text-section-title text-white mb-3">
                  Clubs par activité<br />
                  <span className="text-primary">et par destination</span>
                </h1>
                <p className="text-white/60 text-base max-w-xl">
                  Chaque club a son fil dédié, ses événements, ses défis, ses kits recommandés et sa modération communautaire.
                </p>
              </div>
              <button onClick={() => { setEditClub(null); setShowCreateModal(true); }} className="btn-primary flex-shrink-0 self-start lg:self-auto">
                <Icon name="PlusIcon" size={16} />
                Créer un club
              </button>
            </div>
          </div>
        </section>

        {/* Tabs */}
        <section className="sticky top-16 z-30 bg-background/95 backdrop-blur-md border-b border-border">
          <div className="max-w-7xl mx-auto px-4">
            <div className="flex gap-0">
              {[
                { id: 'activite', label: 'Clubs activité', icon: 'BoltIcon', count: activityClubs.length },
                { id: 'pays', label: 'Clubs destination', icon: 'GlobeAltIcon', count: countryClubs.length },
                { id: 'mes-clubs', label: 'Mes clubs', icon: 'UserGroupIcon', count: myClubs.length },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as typeof activeTab)}
                  className={`flex items-center gap-2 px-5 py-4 text-sm font-600 border-b-2 transition-all ${activeTab === tab.id ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
                >
                  <Icon name={tab.icon} size={15} />
                  {tab.label}
                  {tab.count > 0 && <span className="text-[10px] bg-muted text-muted-foreground px-1.5 py-0.5 rounded-full font-700">{tab.count}</span>}
                </button>
              ))}
            </div>
          </div>
        </section>

        {/* Content */}
        <div className="max-w-7xl mx-auto px-4 py-10">
          {error && <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">{error}</div>}

          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
              {[1, 2, 3].map((i) => <div key={i} className="topo-card h-80 animate-pulse bg-muted" />)}
            </div>
          ) : displayedClubs.length === 0 ? (
            <div className="text-center py-20">
              <div className="text-5xl mb-4">👥</div>
              <p className="font-display font-700 text-foreground text-xl mb-2">
                {activeTab === 'mes-clubs' ? 'Aucun club rejoint' : 'Aucun club pour l\'instant'}
              </p>
              <p className="text-muted-foreground text-sm mb-6">
                {activeTab === 'mes-clubs' ?'Rejoignez un club pour accéder à son fil dédié, ses événements et ses défis.' :'Soyez le premier à créer un club et rassemblez votre communauté !'}
              </p>
              {activeTab !== 'mes-clubs' && (
                <button
                  onClick={() => { setEditClub(null); setShowCreateModal(true); }}
                  className="btn-primary inline-flex items-center gap-2 px-6 py-3"
                >
                  <Icon name="PlusIcon" size={16} />
                  Créer le premier club
                </button>
              )}
              {activeTab === 'mes-clubs' && !user && (
                <a href="/connexion" className="btn-primary inline-flex items-center gap-2 px-6 py-3">
                  Se connecter pour rejoindre un club
                </a>
              )}
              {activeTab === 'mes-clubs' && user && (
                <button
                  onClick={() => setActiveTab('activite')}
                  className="btn-secondary inline-flex items-center gap-2 px-6 py-3"
                >
                  Parcourir les clubs
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
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

      {/* Delete confirm */}
      {deleteClub && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-2xl p-6 max-w-sm w-full">
            <div className="text-center mb-5">
              <div className="w-14 h-14 rounded-2xl bg-red-100 flex items-center justify-center mx-auto mb-3">
                <Icon name="TrashIcon" size={24} className="text-red-500" />
              </div>
              <h3 className="font-display font-700 text-foreground text-lg mb-1">Supprimer &quot;{deleteClub.name}&quot; ?</h3>
              <p className="text-sm text-muted-foreground">Tous les membres, discussions et événements seront supprimés.</p>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setDeleteClub(null)} className="flex-1 py-2.5 rounded-xl border border-border text-sm font-600 text-muted-foreground hover:bg-muted transition-colors">Annuler</button>
              <button onClick={handleDeleteClub} disabled={deleting} className="flex-1 py-2.5 rounded-xl bg-red-500 text-white text-sm font-700 hover:bg-red-600 transition-colors disabled:opacity-50">
                {deleting ? 'Suppression...' : 'Supprimer'}
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-foreground text-background px-5 py-3 rounded-xl text-sm font-600 shadow-xl">
          {toast}
        </div>
      )}

      <Footer />
    </main>
  );
}

export const dynamic = 'force-dynamic';
