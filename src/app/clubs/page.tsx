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
import { fetchPublicProfilesWith } from '@/lib/queries/publicProfilesCore';
import { useAuth } from '@/contexts/AuthContext';
import {
  Badge,
  Button,
  Card,
  Chip,
  ConfirmDialog,
  EmptyState,
  IconButton,
  LoadingState,
  Modal,
  SkeletonClubCard,
  Tabs,
} from '@/components/ui';

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

const COVER_GRADIENTS: Record<string, string> = {
  'from-emerald-600 to-teal-700': 'from-[var(--lkv-forest-600)] to-[var(--lkv-primary)]',
  'from-blue-600 to-indigo-700': 'from-[var(--lkv-info)] to-[var(--lkv-sky-600)]',
  'from-amber-600 to-orange-700': 'from-[var(--lkv-warning)] to-[var(--lkv-warning)]',
  'from-stone-600 to-stone-800': 'from-[var(--lkv-text-subtle)] to-[var(--lkv-text-muted)]',
  'from-cyan-600 to-blue-700': 'from-[var(--lkv-info)] to-[var(--lkv-info)]',
  'from-slate-600 to-gray-800': 'from-[var(--lkv-text-muted)] to-[var(--lkv-text-primary)]',
};
const normalizeCover = (c: string) => COVER_GRADIENTS[c] ?? c;

const _COVER_COLORS: { label: string; value: string }[] = [
  { label: 'Sauge', value: 'from-[var(--lkv-forest-600)] to-[var(--lkv-primary)]' },
  { label: 'Info', value: 'from-[var(--lkv-info)] to-[var(--lkv-sky-600)]' },
  { label: 'Warn', value: 'from-[var(--lkv-warning)] to-[var(--lkv-warning)]' },
  { label: 'Pierre', value: 'from-[var(--lkv-text-subtle)] to-[var(--lkv-text-muted)]' },
  { label: 'Océan', value: 'from-[var(--lkv-info)] to-[var(--lkv-info)]' },
  { label: 'Ardoise', value: 'from-[var(--lkv-text-muted)] to-[var(--lkv-text-primary)]' },
];

const FIELD_CLASS =
  'w-full rounded-[var(--lkv-radius-md)] border border-[color:var(--lkv-border)] bg-[color:var(--lkv-field-bg)] px-[var(--space-3)] py-[var(--space-2)] text-[length:var(--lkv-text-caption)] text-[color:var(--lkv-text-primary)] placeholder:text-[color:var(--lkv-text-muted)] focus:outline-none focus:ring-2 focus:ring-[color:var(--lkv-focus-ring)]';

const LABEL_CLASS = 'mb-[var(--space-2)] block font-mono text-[length:var(--lkv-text-caption-2)] font-bold uppercase tracking-widest text-[color:var(--lkv-text-muted)]';

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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const set = (k: keyof ClubForm, v: any) => setForm((f) => ({ ...f, [k]: v }));

  return (
    <Modal
      open={open}
      onOpenChange={(next) => { if (!next) onClose(); }}
      title={initial ? 'Modifier le club' : 'Créer un club'}
      description="Configurez l'espace de votre communauté."
      size="lg"
      loading={saving}
      footer={
        <div className="flex w-full items-center gap-[var(--space-3)]">
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Annuler
          </Button>
          <Button
            onClick={() => onSave(form)}
            disabled={saving || !form.name.trim()}
            loading={saving}
            fullWidth
          >
            {saving ? 'Enregistrement...' : initial ? 'Mettre à jour le club' : 'Créer le club'}
          </Button>
        </div>
      }
    >
      <div className="space-y-[var(--space-5)]">
        <div className="flex gap-[var(--space-4)]">
          <div className="w-24">
            <label htmlFor="club-form-emoji" className={LABEL_CLASS}>Emoji</label>
            <input
              id="club-form-emoji"
              className={`${FIELD_CLASS} text-center text-[length:var(--lkv-text-title-sm)]`}
              value={form.emoji}
              onChange={(e) => set('emoji', e.target.value)}
            />
          </div>
          <div className="flex-1">
            <label htmlFor="club-form-name" className={LABEL_CLASS}>Nom du club <span className="text-[color:var(--lkv-secondary)]">*</span></label>
            <input
              id="club-form-name"
              className={FIELD_CLASS}
              placeholder="Ex: Club Sahara"
              value={form.name}
              onChange={(e) => set('name', e.target.value)}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-[var(--space-4)] sm:grid-cols-2">
          <div>
            <span className={LABEL_CLASS}>Type</span>
            <Tabs
              variant="segmented"
              ariaLabel="Type de club"
              value={form.type}
              onChange={(id) => set('type', id)}
              options={[
                { id: 'activite', label: '🎯 Activité' },
                { id: 'pays', label: '🌍 Pays' },
              ]}
            />
          </div>
          <div>
            <label htmlFor="club-form-category" className={LABEL_CLASS}>Catégorie</label>
            <input
              id="club-form-category"
              className={FIELD_CLASS}
              placeholder="Ex: Randonnée, Islande..."
              value={form.category}
              onChange={(e) => set('category', e.target.value)}
            />
          </div>
        </div>

        <div>
          <label htmlFor="club-form-description" className={LABEL_CLASS}>Description</label>
          <textarea
            id="club-form-description"
            rows={3}
            className={`${FIELD_CLASS} resize-none`}
            placeholder="Décrivez l'objectif et l'ambiance du club..."
            value={form.description}
            onChange={(e) => set('description', e.target.value)}
          />
        </div>

        <div>
          <label htmlFor="club-form-rules" className={LABEL_CLASS}>Règles du club</label>
          <textarea
            id="club-form-rules"
            rows={2}
            className={`${FIELD_CLASS} resize-none`}
            placeholder="Règles de bonne conduite (optionnel)..."
            value={form.rules}
            onChange={(e) => set('rules', e.target.value)}
          />
        </div>

        <div>
          <span className={LABEL_CLASS}>Confidentialité</span>
          <div className="grid grid-cols-1 gap-[var(--space-3)] sm:grid-cols-3">
            {[
              { v: 'open', l: '🌍 Ouvert', d: 'Tout le monde' },
              { v: 'closed', l: '🔒 Fermé', d: 'Sur demande' },
              { v: 'secret', l: '🕵️ Secret', d: 'Sur invitation' },
            ].map((opt) => (
              <Chip
                key={opt.v}
                selected={form.privacy === opt.v}
                onClick={() => set('privacy', opt.v)}
                className="h-auto flex-col items-start justify-start gap-[var(--space-1)] px-[var(--space-4)] py-[var(--space-3)]"
              >
                <span className="text-[length:var(--lkv-text-caption)] font-bold">{opt.l}</span>
                <span className="text-[length:var(--lkv-text-caption-2)] font-normal">{opt.d}</span>
              </Chip>
            ))}
          </div>
        </div>
      </div>
    </Modal>
  );
}

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
      supabase.from('club_topics').select('*').eq('club_id', club.id).eq('is_approved', true).order('is_pinned', { ascending: false }).order('created_at', { ascending: false }),
      supabase.from('club_members').select('*').eq('club_id', club.id).eq('status', 'active'),
      supabase.from('club_challenges').select('*').eq('club_id', club.id).eq('active', true),
      supabase.from('club_events').select('*').eq('club_id', club.id).order('event_date', { ascending: true }),
    ]);
    // F1 — auteurs/membres via la vue `public_profiles` (deux étapes, sans embed).
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
          ? { full_name: profiles[t.author_id].full_name ?? '' }
          : undefined,
      })) as ClubTopic[]
    );
    setMembers(
      memberRows.map((m) => ({
        ...m,
        user: profiles[m.user_id]
          ? {
              full_name: profiles[m.user_id].full_name ?? 'Anonyme',
              avatar_url: profiles[m.user_id].avatar_url ?? '',
              trust_score: profiles[m.user_id].trust_score ?? 0,
            }
          : undefined,
      })) as ClubMember[]
    );
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
      const { data: pending } = await supabase.from('club_join_requests').select('*').eq('club_id', club.id).eq('status', 'pending');
      const pendingRows = (pending as any[]) ?? [];
      const pendingProfiles = await fetchPublicProfilesWith(
        supabase,
        pendingRows.map((r) => r.user_id as string)
      );
      setPendingRequests(
        pendingRows.map((r) => ({
          ...r,
          user: pendingProfiles[r.user_id]
            ? {
                full_name: pendingProfiles[r.user_id].full_name ?? 'Anonyme',
                avatar_url: pendingProfiles[r.user_id].avatar_url ?? '',
                trust_score: pendingProfiles[r.user_id].trust_score ?? 0,
              }
            : undefined,
        })) as ClubMember[]
      );
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

  const tabs = [
    { id: 'topics', label: 'Discussions', icon: <Icon name="ChatBubbleLeftRightIcon" size={15} aria-hidden="true" /> },
    { id: 'members', label: `Membres (${members.length})`, icon: <Icon name="UsersIcon" size={15} aria-hidden="true" /> },
    { id: 'challenges', label: 'Défis', icon: <Icon name="TrophyIcon" size={15} aria-hidden="true" /> },
    { id: 'events', label: 'Agenda', icon: <Icon name="CalendarIcon" size={15} aria-hidden="true" /> },
    ...(isAdmin ? [{ id: 'moderation', label: `Modération${pendingRequests.length > 0 ? ` (${pendingRequests.length})` : ''}`, icon: <Icon name="ShieldCheckIcon" size={15} aria-hidden="true" /> }] : []),
  ];

  return (
    <Modal
      open={!!club}
      onOpenChange={(next) => { if (!next) onClose(); }}
      title={club?.name ?? 'Club'}
      size="lg"
      hideTitle
      footer={
        toast ? (
          <p role="status" className="text-[length:var(--lkv-text-caption)] font-bold text-[color:var(--lkv-text-primary)]">{toast}</p>
        ) : undefined
      }
    >
      {!club ? null : (
        <div className="space-y-[var(--space-5)]">
          <div className={`relative overflow-hidden rounded-[var(--lkv-radius-md)] bg-gradient-to-br ${normalizeCover(club.cover_color)} p-[var(--space-6)]`}>
            <div aria-hidden className="pointer-events-none absolute right-0 top-0 h-64 w-64 rounded-full bg-[color:var(--lkv-text-inverted)]/10 blur-[80px]" />
            <div className="relative z-10 flex items-start justify-between">
              <div className="flex items-start gap-[var(--space-5)]">
                <div className="flex h-16 w-16 items-center justify-center rounded-[var(--lkv-radius-2xl)] border border-[color:var(--glass-border)] bg-[color:var(--card-tint-strong)] text-[length:var(--lkv-text-title-lg)] backdrop-blur-[var(--blur-md)]" aria-hidden>
                  {club.emoji}
                </div>
                <div className="mt-[var(--space-1)]">
                  <div className="mb-[var(--space-1)] flex flex-wrap items-center gap-[var(--space-3)]">
                    <h2 className="font-display text-[length:var(--lkv-text-title-sm)] font-extrabold tracking-tight text-[color:var(--lkv-text-inverted)]">{club.name}</h2>
                    {club.is_verified && (
                      <Badge className="border-[color:var(--glass-border)] bg-[color:var(--card-tint-strong)] font-mono font-bold text-[color:var(--lkv-text-inverted)]">✓ VÉRIFIÉ</Badge>
                    )}
                  </div>
                  <p className="text-[length:var(--lkv-text-caption)] text-[color:var(--lkv-text-inverted)]/70">
                    {club.members_count.toLocaleString()} membres · {club.type === 'activite' ? 'Activité' : 'Destination'} · {club.privacy}
                  </p>
                </div>
              </div>
              <IconButton variant="glass" onClick={onClose} aria-label="Fermer le club">
                <Icon name="XMarkIcon" size={18} aria-hidden="true" />
              </IconButton>
            </div>
            {club.rules && (
              <div className="relative z-10 mt-[var(--space-5)] flex items-start gap-[var(--space-3)] rounded-[var(--lkv-radius-md)] border border-[color:var(--glass-border)] bg-[color:var(--btn-tint)] saturate-[var(--btn-saturate)] lkv-rim-btn px-[var(--space-4)] py-[var(--space-3)] backdrop-blur-[var(--btn-blur)]">
                <Icon name="ShieldCheckIcon" size={16} className="mt-[2px] shrink-0 text-[color:var(--lkv-text-inverted)]/80" aria-hidden="true" />
                <div>
                  <p className="mb-[var(--space-1)] font-mono text-[length:var(--lkv-text-caption-2)] font-bold uppercase tracking-widest text-[color:var(--lkv-text-inverted)]/50">Règles du club</p>
                  <p className="text-[length:var(--lkv-text-caption)] leading-relaxed text-[color:var(--lkv-text-inverted)]/90">{club.rules}</p>
                </div>
              </div>
            )}
          </div>

          <Tabs
            variant="scrollable"
            ariaLabel="Sections du club"
            value={activeTab}
            onChange={(id) => setActiveTab(id as typeof activeTab)}
            options={tabs}
          />

          {loading ? (
            <LoadingState label="Chargement des données du club..." />
          ) : (
            <div className="mx-auto max-w-3xl">
              {activeTab === 'topics' && (
                <div className="space-y-[var(--space-5)]">
                  {club.is_member && (
                    <Card className="space-y-[var(--space-4)]">
                      <div className="flex items-center gap-[var(--space-3)]">
                        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[color:var(--lkv-secondary)]/10 text-[color:var(--lkv-secondary)]">
                          <Icon name="PencilIcon" size={14} aria-hidden="true" />
                        </span>
                        <h3 className="text-[length:var(--lkv-text-caption)] font-bold text-[color:var(--lkv-text-primary)]">Lancer une discussion</h3>
                      </div>
                      <input
                        className={FIELD_CLASS}
                        placeholder="De quoi voulez-vous parler ?"
                        aria-label="Titre de la discussion"
                        value={newTopic.title}
                        onChange={(e) => setNewTopic((f) => ({ ...f, title: e.target.value }))}
                      />
                      <textarea
                        rows={3}
                        className={`${FIELD_CLASS} resize-none`}
                        placeholder="Détaillez votre sujet (optionnel)..."
                        aria-label="Contenu de la discussion"
                        value={newTopic.content}
                        onChange={(e) => setNewTopic((f) => ({ ...f, content: e.target.value }))}
                      />
                      <div className="flex justify-end">
                        <Button
                          onClick={handlePostTopic}
                          disabled={postingTopic || !newTopic.title.trim()}
                          loading={postingTopic}
                        >
                          {postingTopic ? 'Publication...' : 'Publier'}
                        </Button>
                      </div>
                    </Card>
                  )}
                  {topics.length === 0 ? (
                    <EmptyState
                      icon={<span className="text-[length:var(--lkv-text-title-lg)]" aria-hidden>💬</span>}
                      title="Aucune discussion"
                      description="Soyez le premier à lancer un sujet !"
                    />
                  ) : (
                    topics.map((topic) => (
                      <Card key={topic.id} className={`group transition-all ${topic.is_pinned ? 'border-[color:var(--lkv-secondary)]/40' : ''}`}>
                        <div className="flex items-start justify-between gap-[var(--space-4)]">
                          <div className="min-w-0 flex-1">
                            <div className="mb-[var(--space-2)] flex flex-wrap items-center gap-[var(--space-2)]">
                              {topic.is_pinned && <Badge>📌 ÉPINGLÉ</Badge>}
                              {topic.is_announcement && <Badge tone="warn">📢 ANNONCE</Badge>}
                              <h4 className="text-[length:var(--lkv-text-caption)] font-bold text-[color:var(--lkv-text-primary)] transition-colors group-hover:text-[color:var(--lkv-secondary)]">{topic.title}</h4>
                            </div>
                            {topic.content && <p className="mb-[var(--space-4)] line-clamp-2 text-[length:var(--lkv-text-caption)] leading-relaxed text-[color:var(--lkv-text-muted)]">{topic.content}</p>}
                            <div className="flex items-center gap-[var(--space-4)] text-[length:var(--lkv-text-caption-2)] font-medium text-[color:var(--lkv-text-muted)]">
                              <span className="flex items-center gap-[var(--space-1)] rounded-[var(--lkv-radius-sm)] bg-[color:var(--glass-bg-medium)] border border-[color:var(--glass-border)] backdrop-blur-[var(--glass-blur-sm)] saturate-[var(--glass-sat)] lkv-rim-inset px-[var(--space-2)] py-[var(--space-1)]">
                                <Icon name="UserIcon" size={12} aria-hidden="true" /> {topic.author?.full_name ?? 'Anonyme'}
                              </span>
                              <span className="flex items-center gap-[var(--space-1)]">
                                <Icon name="HeartIcon" size={14} className="text-[color:var(--lkv-danger)]/70" aria-hidden="true" /> {topic.likes_count}
                              </span>
                              <span className="flex items-center gap-[var(--space-1)]">
                                <Icon name="ChatBubbleLeftIcon" size={14} className="text-[color:var(--lkv-info)]/70" aria-hidden="true" /> {topic.replies_count}
                              </span>
                            </div>
                          </div>
                          {isAdmin && (
                            <div className="flex shrink-0 items-center gap-[var(--space-1)] rounded-[var(--lkv-radius-md)] bg-[color:var(--glass-bg-medium)] border border-[color:var(--glass-border)] backdrop-blur-[var(--glass-blur-sm)] saturate-[var(--glass-sat)] lkv-rim-inset p-[var(--space-1)] opacity-0 transition-opacity group-hover:opacity-100">
                              <IconButton
                                variant="ghost"
                                size="sm"
                                onClick={() => handlePinTopic(topic)}
                                aria-label={topic.is_pinned ? 'Désépingler la discussion' : 'Épingler la discussion'}
                              >
                                <Icon name="bookmark" size={15} className={topic.is_pinned ? 'text-[color:var(--lkv-secondary)]' : 'text-[color:var(--lkv-text-muted)]'} aria-hidden="true" />
                              </IconButton>
                              <IconButton
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDeleteTopic(topic.id)}
                                aria-label="Supprimer la discussion"
                                className="text-[color:var(--lkv-danger)]"
                              >
                                <Icon name="trash2" size={15} aria-hidden="true" />
                              </IconButton>
                            </div>
                          )}
                        </div>
                      </Card>
                    ))
                  )}
                </div>
              )}

              {activeTab === 'members' && (
                <div className="grid grid-cols-1 gap-[var(--space-4)] sm:grid-cols-2">
                  {members.map((m) => (
                    <Card key={m.id} className="flex flex-col gap-[var(--space-3)]">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-[var(--space-3)]">
                          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[color:var(--lkv-secondary)]/10 text-[length:var(--lkv-text-subheadline)] font-extrabold text-[color:var(--lkv-secondary)]" aria-hidden>
                            {m.user?.full_name?.[0] ?? '?'}
                          </div>
                          <div>
                            <p className="truncate text-[length:var(--lkv-text-caption)] font-bold text-[color:var(--lkv-text-primary)]">{m.user?.full_name ?? 'Anonyme'}</p>
                            <Badge tone={m.role === 'admin' ? 'warn' : m.role === 'moderator' ? 'info' : 'stone'} className="mt-[var(--space-1)]">
                              {m.role === 'admin' ? '👑 ADMIN' : m.role === 'moderator' ? '🛡️ MODO' : '👤 MEMBRE'}
                            </Badge>
                          </div>
                        </div>
                        {isAdmin && m.user_id !== currentUserId && (
                          <IconButton
                            variant="ghost"
                            size="sm"
                            onClick={() => handleBanMember(m)}
                            aria-label={`Bannir ${m.user?.full_name ?? 'ce membre'}`}
                            className="text-[color:var(--lkv-text-muted)] hover:text-[color:var(--lkv-danger)]"
                          >
                            <Icon name="NoSymbolIcon" size={15} aria-hidden="true" />
                          </IconButton>
                        )}
                      </div>
                      <div className="mt-[var(--space-2)] flex items-center justify-between border-t border-[color:var(--lkv-border)] pt-[var(--space-3)]">
                        <p className="text-[length:var(--lkv-text-caption-2)] font-semibold text-[color:var(--lkv-text-muted)]">Trust Score: {m.user?.trust_score ?? 0}</p>
                        {isAdmin && m.user_id !== currentUserId && (
                          <select
                            value={m.role}
                            onChange={(e) => handlePromoteMember(m, e.target.value as 'admin' | 'moderator' | 'member')}
                            aria-label={`Rôle de ${m.user?.full_name ?? 'ce membre'}`}
                            className={`${FIELD_CLASS} w-auto py-[var(--space-1)] text-[length:var(--lkv-text-caption-2)] font-semibold`}
                          >
                            <option value="member">Membre</option>
                            <option value="moderator">Modérateur</option>
                            <option value="admin">Admin</option>
                          </select>
                        )}
                      </div>
                    </Card>
                  ))}
                </div>
              )}

              {activeTab === 'challenges' && (
                <div className="space-y-[var(--space-4)]">
                  {challenges.length === 0 ? (
                    <EmptyState
                      icon={<span className="text-[length:var(--lkv-text-title-lg)]" aria-hidden>🏆</span>}
                      title="Aucun défi en cours"
                    />
                  ) : (
                    challenges.map((ch) => (
                      <Card key={ch.id} className="group relative overflow-hidden">
                        <div aria-hidden className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-[color:var(--lkv-warning)]/10 blur-3xl transition-colors group-hover:bg-[color:var(--lkv-warning)]/20" />
                        <div className="relative z-10 flex flex-col items-start justify-between gap-[var(--space-6)] sm:flex-row sm:items-center">
                          <div>
                            <div className="mb-[var(--space-2)] flex items-center gap-[var(--space-3)]">
                              <span className="rounded-[var(--lkv-radius-md)] bg-[color:var(--lkv-warning)]/20 p-[var(--space-2)] text-[color:var(--lkv-warning-dark)]">
                                <Icon name="TrophyIcon" size={16} aria-hidden="true" />
                              </span>
                              <h4 className="text-[length:var(--lkv-text-subheadline)] font-extrabold text-[color:var(--lkv-text-primary)]">{ch.title}</h4>
                            </div>
                            <p className="mb-[var(--space-4)] max-w-xl text-[length:var(--lkv-text-caption)] text-[color:var(--lkv-text-muted)]">{ch.description}</p>
                            <div className="flex items-center gap-[var(--space-4)] text-[length:var(--lkv-text-caption-2)] font-semibold">
                              <Badge tone="warn">+{ch.xp} XP à gagner</Badge>
                              {ch.deadline && (
                                <span className="flex items-center gap-[var(--space-1)] text-[color:var(--lkv-text-muted)]">
                                  <Icon name="ClockIcon" size={14} aria-hidden="true" /> Fin le {new Date(ch.deadline).toLocaleDateString('fr-FR')}
                                </span>
                              )}
                            </div>
                          </div>
                          <Button
                            onClick={() => handleJoinChallenge(ch.id)}
                            variant={joinedChallenges[ch.id] ? 'secondary' : 'primary'}
                            className="w-full sm:w-auto"
                          >
                            {joinedChallenges[ch.id] ? '✓ Vous participez' : 'Participer'}
                          </Button>
                        </div>
                      </Card>
                    ))
                  )}
                </div>
              )}

              {activeTab === 'events' && (
                <div className="space-y-[var(--space-5)]">
                  {isAdmin && (
                    <Card className="space-y-[var(--space-4)]">
                      <div className="flex items-center gap-[var(--space-3)]">
                        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[color:var(--lkv-secondary)]/10 text-[color:var(--lkv-secondary)]">
                          <Icon name="CalendarIcon" size={14} aria-hidden="true" />
                        </span>
                        <h3 className="text-[length:var(--lkv-text-caption)] font-bold text-[color:var(--lkv-text-primary)]">Planifier un événement</h3>
                      </div>

                      <div className="space-y-[var(--space-4)]">
                        <div>
                          <label htmlFor="club-event-title" className={LABEL_CLASS}>Titre</label>
                          <input id="club-event-title" className={FIELD_CLASS} placeholder="Titre de l'événement..." value={newEvent.title} onChange={(e) => setNewEvent((f) => ({ ...f, title: e.target.value }))} />
                        </div>
                        <div className="grid grid-cols-1 gap-[var(--space-4)] sm:grid-cols-2">
                          <div>
                            <label htmlFor="club-event-date" className={LABEL_CLASS}>Date et Heure</label>
                            <input id="club-event-date" type="datetime-local" className={FIELD_CLASS} value={newEvent.event_date} onChange={(e) => setNewEvent((f) => ({ ...f, event_date: e.target.value }))} />
                          </div>
                          <div>
                            <label htmlFor="club-event-location" className={LABEL_CLASS}>Lieu / Lien</label>
                            <input id="club-event-location" className={FIELD_CLASS} placeholder="Chamonix ou Lien Zoom..." value={newEvent.location} onChange={(e) => setNewEvent((f) => ({ ...f, location: e.target.value }))} />
                          </div>
                        </div>
                        <div>
                          <label htmlFor="club-event-description" className={LABEL_CLASS}>Description</label>
                          <textarea id="club-event-description" rows={2} className={`${FIELD_CLASS} resize-none`} placeholder="Détails de l'événement..." value={newEvent.description} onChange={(e) => setNewEvent((f) => ({ ...f, description: e.target.value }))} />
                        </div>
                        <div className="flex justify-end pt-[var(--space-2)]">
                          <Button onClick={handlePostEvent} disabled={postingEvent || !newEvent.title.trim()} loading={postingEvent}>
                            {postingEvent ? 'Création...' : 'Créer l\'événement'}
                          </Button>
                        </div>
                      </div>
                    </Card>
                  )}
                  {events.length === 0 ? (
                    <EmptyState
                      icon={<span className="text-[length:var(--lkv-text-title-lg)]" aria-hidden>📅</span>}
                      title="Aucun événement planifié"
                    />
                  ) : (
                    events.map((ev) => (
                      <Card key={ev.id} className="flex flex-col gap-[var(--space-6)] sm:flex-row">
                        <Card variant="compact" className="flex min-w-[100px] flex-col items-center justify-center">
                          {ev.event_date ? (
                            <>
                              <span className="text-[length:var(--lkv-text-caption)] font-extrabold uppercase text-[color:var(--lkv-secondary)]">{new Date(ev.event_date).toLocaleDateString('fr-FR', { month: 'short' })}</span>
                              <span className="text-[length:var(--lkv-text-title-sm)] font-extrabold text-[color:var(--lkv-text-primary)]">{new Date(ev.event_date).getDate()}</span>
                            </>
                          ) : (
                            <span className="text-[length:var(--lkv-text-caption)] font-bold text-[color:var(--lkv-text-muted)]">À DÉFINIR</span>
                          )}
                        </Card>
                        <div className="flex flex-1 flex-col justify-center">
                          <h4 className="mb-[var(--space-1)] text-[length:var(--lkv-text-subheadline)] font-extrabold text-[color:var(--lkv-text-primary)]">{ev.title}</h4>
                          {ev.description && <p className="mb-[var(--space-4)] line-clamp-2 text-[length:var(--lkv-text-caption)] text-[color:var(--lkv-text-muted)]">{ev.description}</p>}
                          <div className="mt-auto flex flex-wrap items-center gap-[var(--space-4)] text-[length:var(--lkv-text-caption-2)] font-semibold text-[color:var(--lkv-text-muted)]">
                            {ev.location && (
                              <span className="flex items-center gap-[var(--space-1)] rounded-[var(--lkv-radius-sm)] bg-[color:var(--glass-bg-medium)] border border-[color:var(--glass-border)] backdrop-blur-[var(--glass-blur-sm)] saturate-[var(--glass-sat)] lkv-rim-inset px-[var(--space-2)] py-[var(--space-1)]">
                                <Icon name="MapPinIcon" size={14} aria-hidden="true" />{ev.location}
                              </span>
                            )}
                            <span className="flex items-center gap-[var(--space-1)] rounded-[var(--lkv-radius-sm)] bg-[color:var(--glass-bg-medium)] border border-[color:var(--glass-border)] backdrop-blur-[var(--glass-blur-sm)] saturate-[var(--glass-sat)] lkv-rim-inset px-[var(--space-2)] py-[var(--space-1)]">
                              <Icon name="UsersIcon" size={14} aria-hidden="true" />{ev.participants_count} / {ev.max_participants} inscrits
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center sm:border-l sm:border-[color:var(--lkv-border)] sm:pl-[var(--space-6)]">
                          <Button
                            onClick={() => handleToggleEventRegistration(ev.id)}
                            variant={registeredEvents[ev.id] ? 'secondary' : 'primary'}
                            className="w-full sm:w-auto"
                          >
                            {registeredEvents[ev.id] ? '✓ Inscrit' : 'S&apos;inscrire'}
                          </Button>
                        </div>
                      </Card>
                    ))
                  )}
                </div>
              )}

              {activeTab === 'moderation' && isAdmin && (
                <div className="space-y-[var(--space-5)]">
                  <div>
                    <h3 className="mb-[var(--space-4)] flex items-center gap-[var(--space-2)] text-[length:var(--lkv-text-subheadline)] font-bold text-[color:var(--lkv-text-primary)]">
                      <Icon name="ShieldCheckIcon" size={20} className="text-[color:var(--lkv-warning-dark)]" aria-hidden="true" />
                      Demandes d&apos;adhésion en attente
                      <Badge tone="warn">{pendingRequests.length}</Badge>
                    </h3>
                    {pendingRequests.length === 0 ? (
                      <EmptyState
                        icon={<Icon name="ShieldCheckIcon" size={22} aria-hidden="true" />}
                        title="Aucune demande en attente"
                        description="Aucune demande en attente pour le moment."
                      />
                    ) : (
                      <div className="space-y-[var(--space-3)]">
                        {pendingRequests.map((req) => (
                          <Card key={req.id} className="flex flex-col items-start justify-between gap-[var(--space-4)] sm:flex-row sm:items-center">
                            <div className="flex items-center gap-[var(--space-4)]">
                              <div className="flex h-12 w-12 items-center justify-center rounded-full border border-[color:var(--btn-glass-border)] bg-[color:var(--btn-tint)] backdrop-blur-[var(--btn-blur)] saturate-[var(--btn-saturate)] lkv-rim-btn text-[length:var(--lkv-text-subheadline)] font-extrabold text-[color:var(--lkv-text-primary)]" aria-hidden>
                                {(req as unknown as { user?: { full_name: string } }).user?.full_name?.[0] ?? '?'}
                              </div>
                              <div>
                                <p className="text-[length:var(--lkv-text-caption)] font-bold text-[color:var(--lkv-text-primary)]">{(req as unknown as { user?: { full_name: string } }).user?.full_name ?? 'Anonyme'}</p>
                                <p className="mt-[var(--space-1)] text-[length:var(--lkv-text-caption-2)] font-semibold text-[color:var(--lkv-text-muted)]">Trust Score: {(req as unknown as { user?: { trust_score: number } }).user?.trust_score ?? 0}</p>
                              </div>
                            </div>
                            <div className="flex w-full gap-[var(--space-2)] sm:w-auto">
                              <Button onClick={() => handleApproveRequest(req.id, req.user_id, true)} className="flex-1 sm:flex-none">Accepter</Button>
                              <Button onClick={() => handleApproveRequest(req.id, req.user_id, false)} variant="secondary" className="flex-1 text-[color:var(--lkv-danger)] sm:flex-none">Refuser</Button>
                            </div>
                          </Card>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}

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
    e.stopPropagation();
    setJoining(true);
    await onToggleMember(club.id, !!club.is_member);
    setJoining(false);
  };

  return (
    <Link
      href={`/clubs/${club.slug}`}
      className="group relative block h-full"
    >
      <Card className="relative flex h-full flex-col overflow-hidden transition-all duration-[var(--motion-control-duration)] group-hover:shadow-elevation-2">
        <div aria-hidden className={`pointer-events-none absolute -right-32 -top-32 h-64 w-64 rounded-full bg-gradient-to-br ${normalizeCover(club.cover_color)} opacity-20 blur-[80px] transition-opacity duration-500 group-hover:opacity-40`} />

        <div className="relative z-10 flex h-full flex-col">
          <div className="mb-[var(--space-5)] flex items-start justify-between">
            <div className="flex h-16 w-16 items-center justify-center rounded-[var(--lkv-radius-2xl)] bg-[color:var(--glass-bg-medium)] border border-[color:var(--glass-border)] backdrop-blur-[var(--glass-blur-sm)] saturate-[var(--glass-sat)] lkv-rim-inset text-[length:var(--lkv-text-title-lg)] transition-transform duration-300 group-hover:rotate-3 group-hover:scale-110" aria-hidden>
              {club.emoji}
            </div>

            <div className="flex items-center gap-[var(--space-1)]">
              {isOwner && (
                <div className="flex items-center gap-[var(--space-1)] opacity-0 transition-opacity group-hover:opacity-100">
                  <IconButton
                    variant="ghost"
                    size="sm"
                    onClick={(e) => { e.stopPropagation(); onEdit(club); }}
                    aria-label={`Modifier ${club.name}`}
                    className="text-[color:var(--lkv-text-muted)] hover:text-[color:var(--lkv-text-primary)]"
                  >
                    <Icon name="pencil" size={14} aria-hidden="true" />
                  </IconButton>
                  <IconButton
                    variant="ghost"
                    size="sm"
                    onClick={(e) => { e.stopPropagation(); onDelete(club); }}
                    aria-label={`Supprimer ${club.name}`}
                    className="text-[color:var(--lkv-danger)]"
                  >
                    <Icon name="trash2" size={14} aria-hidden="true" />
                  </IconButton>
                </div>
              )}
              {club.is_member && (
                <span className="rounded-full border border-[color:var(--lkv-secondary)]/30 bg-[color:var(--lkv-secondary)]/20 p-[var(--space-2)] text-[color:var(--lkv-secondary)]" title="Vous êtes membre">
                  <Icon name="CheckIcon" size={14} aria-hidden="true" />
                </span>
              )}
            </div>
          </div>

          <div className="mb-[var(--space-4)]">
            <div className="mb-[var(--space-1)] flex items-center gap-[var(--space-2)]">
              <span className="font-mono text-[length:var(--lkv-text-caption-2)] font-extrabold uppercase tracking-widest text-[color:var(--lkv-text-muted)]">
                {club.type === 'activite' ? 'Activité' : 'Destination'}
              </span>
              {club.privacy !== 'open' && (
                <Badge>
                  <Icon name={club.privacy === 'closed' ? 'LockClosedIcon' : 'EyeSlashIcon'} size={10} aria-hidden="true" />
                  {club.privacy === 'closed' ? 'Fermé' : 'Secret'}
                </Badge>
              )}
            </div>
            <h3 className="flex items-center gap-[var(--space-2)] font-display text-[length:var(--lkv-text-subheadline)] font-extrabold leading-tight text-[color:var(--lkv-text-primary)] transition-colors group-hover:text-[color:var(--lkv-secondary)]">
              {club.name}
              {club.is_verified && <Icon name="CheckBadgeIcon" size={18} className="text-[color:var(--lkv-info)]" aria-hidden="true" />}
            </h3>
          </div>

          <p className="mb-[var(--space-6)] line-clamp-3 flex-1 text-[length:var(--lkv-text-caption)] leading-relaxed text-[color:var(--lkv-text-muted)]">
            {club.description}
          </p>

          <div className="mt-auto flex items-center justify-between border-t border-[color:var(--lkv-border)] pt-[var(--space-5)]">
            <div className="flex flex-col gap-[var(--space-1)]">
              <span className="flex items-center gap-[var(--space-1)] text-[length:var(--lkv-text-caption-2)] font-bold text-[color:var(--lkv-text-primary)]">
                <Icon name="UsersIcon" size={14} className="text-[color:var(--lkv-text-muted)]" aria-hidden="true" />
                {club.members_count.toLocaleString()} membres
              </span>
              <span className="flex items-center gap-[var(--space-1)] text-[length:var(--lkv-text-caption-2)] font-semibold text-[color:var(--lkv-text-muted)]">
                <Icon name="BoltIcon" size={12} className="text-[color:var(--lkv-warning-dark)]/70" aria-hidden="true" />
                {club.active_this_month} actifs ce mois
              </span>
            </div>

            <Button
              onClick={handleToggle}
              disabled={joining}
              loading={joining}
              variant={club.is_member ? 'secondary' : 'primary'}
              size="sm"
              className={club.is_member ? 'text-[color:var(--lkv-danger)]' : ''}
            >
              {joining ? '...' : club.is_member ? 'Quitter' : 'Rejoindre'}
            </Button>
          </div>
        </div>
      </Card>
    </Link>
  );
}

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
      await supabase.from('club_join_requests').upsert({ club_id: clubId, user_id: user.id, status: 'pending' }, { onConflict: 'club_id,user_id' });
      showToast("Demande d'adhésion envoyée !");
    }
  };

  const handleSaveClub = async (form: ClubForm) => {
    if (!user) return;
    setSaving(true);
    try {
      const colorMap: Record<string, string> = {
        'activite': 'from-[var(--lkv-forest-600)] to-[var(--lkv-primary)]',
        'pays': 'from-[var(--lkv-info)] to-[var(--lkv-sky-600)]',
      };
      const payload = {
        name: form.name,
        type: form.type,
        emoji: form.emoji,
        description: form.description,
        category: form.category,
        rules: form.rules,
        privacy: form.privacy,
        cover_color: colorMap[form.type] ?? 'from-[var(--lkv-forest-600)] to-[var(--lkv-primary)]',
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

  const tabOptions = [
    { id: 'activite', label: 'Par Activité', count: activityClubs.length },
    { id: 'pays', label: 'Par Destination', count: countryClubs.length },
    { id: 'mes-clubs', label: 'Mes Clubs', count: myClubs.length },
  ];

  return (
    <>
      <div className="hidden md:block">
        <main className="flex h-dvh flex-col overflow-hidden bg-[color:var(--glass-bg-medium)] backdrop-blur-[var(--glass-blur-sm)]">
          <Header />
          <div className="min-h-0 flex-1 overflow-y-auto">
            <section className="relative overflow-hidden border-b border-[color:var(--glass-border)] pb-[var(--space-16)] pt-32 lg:pb-24 lg:pt-40">
              <div aria-hidden className="pointer-events-none absolute right-0 top-0 h-[500px] w-[500px] animate-pulse rounded-full bg-[color:var(--lkv-secondary)]/20 opacity-60 mix-blend-screen blur-[120px]" />
              <div aria-hidden className="pointer-events-none absolute -bottom-40 -left-40 h-[600px] w-[600px] rounded-full bg-[color:var(--lkv-info)]/10 opacity-50 mix-blend-screen blur-[120px]" />

              <div className="relative z-10 mx-auto max-w-7xl px-[var(--space-6)]">
                <div className="flex flex-col justify-between gap-[var(--space-10)] lg:flex-row lg:items-end">
                  <div className="max-w-3xl">
                    <Badge className="mb-[var(--space-6)] border-[color:var(--glass-border)] bg-[color:var(--card-tint-strong)] px-[var(--space-3)] py-[var(--space-1)] backdrop-blur-[var(--blur-md)]">
                      <span aria-hidden className="h-2 w-2 animate-pulse rounded-full bg-[var(--lkv-secondary)]" />
                      <span className="text-[length:var(--lkv-text-caption-2)] font-bold uppercase tracking-widest text-[color:var(--lkv-text-primary)]/80">Espaces Communautaires</span>
                    </Badge>
                    <h1 className="mb-[var(--space-6)] font-display text-[length:var(--lkv-text-title-xl)] font-extrabold leading-[1.1] tracking-tight text-[color:var(--lkv-text-primary)] lg:text-6xl">
                      Rejoignez le <span className="bg-gradient-to-r from-[color:var(--lkv-secondary)] to-[color:var(--lkv-secondary-subtle)] bg-clip-text text-transparent">Club.</span><br />
                      Vivez l&apos;aventure.
                    </h1>
                    <p className="max-w-2xl text-[length:var(--lkv-text-body)] font-medium leading-relaxed text-[color:var(--lkv-text-muted)] lg:text-[length:var(--lkv-text-title-sm)]">
                      Trouvez vos compagnons de route, échangez sur votre matériel favori et participez aux défis thématiques de la communauté Le Kit du Voyageur.
                    </p>
                  </div>

                  <div className="shrink-0">
                    <Link
                      href="/clubs/nouveau"
                      className="inline-flex min-h-[var(--control-height-lg)] items-center gap-[var(--space-2)] rounded-full bg-[color:var(--btn-tint)] border border-[color:var(--btn-glass-border)] backdrop-blur-[var(--btn-blur)] saturate-[var(--btn-saturate)] lkv-rim-btn px-[var(--space-8)] text-[length:var(--lkv-text-caption)] font-bold text-[color:var(--lkv-text-primary)]"
                    >
                      <Icon name="PlusIcon" size={18} aria-hidden="true" />
                      <span>Fonder un Club</span>
                    </Link>
                  </div>
                </div>
              </div>
            </section>

            <section className="relative z-20 -mt-[var(--space-8)] px-[var(--space-6)] pb-32">
              <div className="mx-auto max-w-7xl">
                <div className="mb-[var(--space-12)] flex justify-center">
                  <Tabs
                    variant="segmented"
                    ariaLabel="Catégories de clubs"
                    value={activeTab}
                    onChange={(id) => setActiveTab(id as typeof activeTab)}
                    options={tabOptions}
                    className="w-auto"
                  />
                </div>

                {error && (
                  <div className="mb-[var(--space-10)] flex items-center gap-[var(--space-3)] rounded-[var(--lkv-radius-md)] border border-[color:var(--lkv-danger)]/25 bg-[color:var(--lkv-danger-bg)] p-[var(--space-5)] text-[color:var(--lkv-danger-dark)]" role="alert">
                    <Icon name="ExclamationTriangleIcon" size={20} aria-hidden="true" />
                    <p className="text-[length:var(--lkv-text-caption)] font-semibold">{error}</p>
                  </div>
                )}

                {loading ? (
                  <div className="grid grid-cols-1 gap-[var(--space-8)] md:grid-cols-2 lg:grid-cols-3">
                    {[1, 2, 3, 4, 5, 6].map((i) => (
                      <SkeletonClubCard key={i} />
                    ))}
                  </div>
                ) : displayedClubs.length === 0 ? (
                  <Card className="p-[var(--space-12)]">
                    <EmptyState
                      icon={<span className="text-[length:var(--lkv-text-title-xl)]" aria-hidden>{activeTab === 'mes-clubs' ? '🏕️' : '✨'}</span>}
                      title={activeTab === 'mes-clubs' ? "Vous n'avez rejoint aucun club" : 'Espace encore vierge'}
                      description={
                        activeTab === 'mes-clubs'
                          ? 'Explorez les clubs existants et trouvez votre prochaine équipe de choc pour vos aventures.'
                          : "Il n'y a pas encore de club dans cette catégorie. Soyez le pionnier et créez le vôtre !"
                      }
                      actionLabel={activeTab === 'mes-clubs' ? (user ? 'Explorer les clubs' : 'Se connecter pour rejoindre') : 'Fonder le premier club'}
                      actionHref={activeTab === 'mes-clubs' && !user ? '/connexion' : activeTab === 'mes-clubs' ? undefined : '/clubs/nouveau'}
                      onAction={activeTab === 'mes-clubs' && user ? () => setActiveTab('activite') : undefined}
                    />
                  </Card>
                ) : (
                  <div className="grid grid-cols-1 gap-[var(--space-8)] md:grid-cols-2 lg:grid-cols-3">
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

      <div className="relative block min-h-screen font-sans text-[color:var(--lkv-text-primary)] md:hidden">
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

      <ConfirmDialog
        open={!!deleteClub}
        title="Supprimer le club ?"
        description={deleteClub ? `Cette action est irréversible. Toutes les données, membres et discussions de "${deleteClub.name}" seront perdus à jamais.` : undefined}
        confirmLabel={deleting ? 'Destruction en cours...' : 'Oui, supprimer définitivement'}
        cancelLabel="Annuler"
        variant="destructive"
        loading={deleting}
        onConfirm={handleDeleteClub}
        onCancel={() => setDeleteClub(null)}
      />

      {toast && (
        <div className="fixed bottom-10 left-1/2 z-[var(--z-toast)] flex -translate-x-1/2 items-center gap-[var(--space-3)] rounded-full bg-[color:var(--btn-tint)] border border-[color:var(--btn-glass-border)] backdrop-blur-[var(--btn-blur)] saturate-[var(--btn-saturate)] px-[var(--space-8)] py-[var(--space-4)] text-[length:var(--lkv-text-caption)] font-bold text-[color:var(--lkv-text-primary)] shadow-elevation-4">
          <Icon name="CheckCircleIcon" size={18} className="text-[color:var(--lkv-text-inverted)]/70" aria-hidden="true" />
          {toast}
        </div>
      )}
    </>
  );
}

export const dynamic = 'force-dynamic';
