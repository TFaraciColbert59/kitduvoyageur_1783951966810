'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import Icon from '@/components/ui/AppIcon';
import { createClient } from '@/lib/supabase/client';

export default function ClubDetailModal({
  club,
  onClose,
  currentUserId,
  onRefresh
}: {
  club: any | null;
  onClose: () => void;
  currentUserId?: string;
  onRefresh: () => void;
}) {
  const [activeTab, setActiveTab] = useState<'topics' | 'members' | 'challenges' | 'events' | 'moderation'>('topics');
  const [topics, setTopics] = useState<any[]>([]);
  const [members, setMembers] = useState<any[]>([]);
  const [challenges, setChallenges] = useState<any[]>([]);
  const [events, setEvents] = useState<any[]>([]);
  const [pendingRequests, setPendingRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [newTopic, setNewTopic] = useState({ title: '', content: '' });
  const [postingTopic, setPostingTopic] = useState(false);
  const [newEvent, setNewEvent] = useState({ title: '', description: '', event_date: '', location: '', max_participants: 20 });
  const [postingEvent, setPostingEvent] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(null), 3000); };
  const isAdmin = club?.is_member && (club?.member_role === 'admin' || club?.member_role === 'moderator');

  const loadData = useCallback(async () => {
    if (!club) return;
    setLoading(true);
    const supabase = createClient();
    const [topicsRes, membersRes, challengesRes, eventsRes] = await Promise.all([
      supabase.from('club_topics').select('*, author:user_profiles(full_name)').eq('club_id', club.id).order('is_pinned', { ascending: false }).order('created_at', { ascending: false }),
      supabase.from('club_members').select('*, user:user_profiles(full_name, avatar_url, trust_score)').eq('club_id', club.id).eq('status', 'active'),
      supabase.from('club_challenges').select('*').eq('club_id', club.id).eq('active', true),
      supabase.from('club_events').select('*').eq('club_id', club.id).order('event_date', { ascending: true }),
    ]);
    setTopics(topicsRes.data || []);
    setMembers(membersRes.data || []);
    setChallenges(challengesRes.data || []);
    setEvents(eventsRes.data || []);

    if (isAdmin) {
      const { data: pending } = await supabase.from('club_join_requests').select('*, user:user_profiles(full_name, avatar_url, trust_score)').eq('club_id', club.id).eq('status', 'pending');
      setPendingRequests(pending || []);
    }
    setLoading(false);
  }, [club, isAdmin]);

  useEffect(() => { if (club) loadData(); }, [club, loadData]);

  const handlePostTopic = async () => {
    if (!club || !currentUserId || !newTopic.title.trim()) return;
    setPostingTopic(true);
    const supabase = createClient();
    await supabase.from('club_topics').insert({ club_id: club.id, author_id: currentUserId, title: newTopic.title, content: newTopic.content });
    setNewTopic({ title: '', content: '' });
    setPostingTopic(false);
    showToast('Discussion publiée !');
    loadData();
  };

  const handlePostEvent = async () => {
    if (!club || !currentUserId || !newEvent.title.trim()) return;
    setPostingEvent(true);
    const supabase = createClient();
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
    showToast('Événement créé !');
    loadData();
  };

  const handleApproveRequest = async (requestId: string, userId: string, approve: boolean) => {
    const supabase = createClient();
    await supabase.from('club_join_requests').update({ status: approve ? 'approved' : 'rejected' }).eq('id', requestId);
    if (approve && club) {
      await supabase.from('club_members').insert({ club_id: club.id, user_id: userId, role: 'member', status: 'active' });
      await supabase.from('clubs').update({ members_count: (club.members_count || 0) + 1 }).eq('id', club.id);
    }
    showToast(approve ? 'Demande approuvée !' : 'Demande refusée.');
    loadData();
    onRefresh();
  };

  if (!club) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
      <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} className="bg-[#F5F2E8] border border-[#E8E4D8] shadow-2xl rounded-[2.5rem] w-full max-w-3xl my-4 overflow-hidden flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="bg-[#1C2620] text-white p-6 sm:p-8 relative overflow-hidden shrink-0">
          <div className="absolute top-0 right-0 w-48 h-48 bg-[#17402C] rounded-full blur-[80px] opacity-30 pointer-events-none" />
          <div className="relative z-10 flex items-start justify-between">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 bg-white/10 backdrop-blur-md rounded-2xl flex items-center justify-center text-3xl shadow-inner border border-white/20">
                {club.emoji || '🏔️'}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="font-display font-800 text-2xl text-white">{club.name}</h2>
                  {club.is_verified && <span className="bg-[#2D5A3D] text-white text-[9px] font-mono px-2 py-0.5 rounded-full">✓ VÉRIFIÉ</span>}
                </div>
                <p className="text-xs text-white/70 mt-1">
                  {club.members_count || 0} membres · {club.category || 'Général'} · {club.privacy === 'open' ? '🌍 Ouvert' : '🔒 Sur demande'}
                </p>
              </div>
            </div>
            <button onClick={onClose} className="p-2 bg-white/10 hover:bg-white/20 rounded-full text-white transition-colors">
              <Icon name="XMarkIcon" size={18} />
            </button>
          </div>
          {club.description && (
            <p className="text-xs text-white/80 mt-4 leading-relaxed max-w-xl">{club.description}</p>
          )}
        </div>

        {/* Navigation Tabs */}
        <div className="bg-white border-b border-[#E8E4D8] px-6 py-3 flex gap-2 overflow-x-auto scrollbar-hide shrink-0">
          {[
            { id: 'topics', label: '💬 Discussions', count: topics.length },
            { id: 'members', label: '👥 Membres', count: members.length },
            { id: 'challenges', label: '🏆 Défis', count: challenges.length },
            { id: 'events', label: '📅 Agenda', count: events.length },
            ...(isAdmin ? [{ id: 'moderation', label: `🛡️ Modération (${pendingRequests.length})`, count: pendingRequests.length }] : [])
          ].map(t => (
            <button key={t.id} onClick={() => setActiveTab(t.id as any)} className={`px-4 py-2 rounded-full text-xs font-bold transition-all whitespace-nowrap ${activeTab === t.id ? 'bg-[#1C2620] text-white shadow-sm' : 'text-[#5C6B5E] hover:bg-[#F5F2E8]'}`}>
              {t.label}
            </button>
          ))}
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar">
          {loading ? (
            <div className="flex justify-center py-12"><div className="w-6 h-6 border-2 border-[#2D5A3D] border-t-transparent rounded-full animate-spin"></div></div>
          ) : activeTab === 'topics' ? (
            <div className="space-y-4">
              {club.is_member && (
                <div className="bg-white p-4 rounded-2xl border border-[#E8E4D8] space-y-3">
                  <h4 className="font-bold text-xs text-[#1C2620] uppercase tracking-wider">Lancer un sujet</h4>
                  <input type="text" placeholder="Titre du sujet..." className="w-full bg-[#F5F2E8] border-none rounded-xl px-3 py-2 text-xs focus:ring-1 focus:ring-[#2D5A3D]" value={newTopic.title} onChange={e => setNewTopic({ ...newTopic, title: e.target.value })} />
                  <textarea rows={2} placeholder="Description..." className="w-full bg-[#F5F2E8] border-none rounded-xl px-3 py-2 text-xs focus:ring-1 focus:ring-[#2D5A3D] resize-none" value={newTopic.content} onChange={e => setNewTopic({ ...newTopic, content: e.target.value })} />
                  <button onClick={handlePostTopic} disabled={postingTopic || !newTopic.title.trim()} className="px-4 py-2 bg-[#2D5A3D] text-white rounded-full text-xs font-bold disabled:opacity-50">
                    {postingTopic ? 'Publication...' : 'Publier'}
                  </button>
                </div>
              )}

              {topics.length === 0 ? (
                <div className="text-center py-10 bg-white rounded-2xl border border-[#E8E4D8]">
                  <p className="text-xs text-[#5C6B5E]">Aucune discussion lancée dans ce club pour le moment.</p>
                </div>
              ) : (
                topics.map(t => (
                  <div key={t.id} className="bg-white p-4 rounded-2xl border border-[#E8E4D8] space-y-2">
                    <div className="flex items-center justify-between">
                      <h4 className="font-bold text-sm text-[#1C2620]">{t.title}</h4>
                      {t.is_pinned && <span className="bg-[#2D5A3D]/10 text-[#2D5A3D] text-[9px] font-mono px-2 py-0.5 rounded-full font-bold">📌 ÉPINGLÉ</span>}
                    </div>
                    {t.content && <p className="text-xs text-[#4A574C] leading-relaxed">{t.content}</p>}
                    <div className="flex items-center justify-between text-[10px] text-[#5C6B5E] pt-2 border-t border-[#F5F2E8]">
                      <span>Par {t.author?.full_name || 'Anonyme'}</span>
                      <span>❤️ {t.likes_count || 0} likes</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          ) : activeTab === 'members' ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {members.map(m => (
                <div key={m.id} className="bg-white p-3 rounded-2xl border border-[#E8E4D8] flex items-center gap-3">
                  <img src={m.user?.avatar_url || 'https://i.pravatar.cc/150'} className="w-9 h-9 rounded-full object-cover border border-[#E8E4D8]" />
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-xs text-[#1C2620] truncate">{m.user?.full_name || 'Membre'}</p>
                    <span className="text-[9px] font-mono text-[#2D5A3D] bg-[#EAF0EB] px-2 py-0.5 rounded-full uppercase">
                      {m.role === 'admin' ? '👑 Admin' : m.role === 'moderator' ? '🛡️ Modo' : 'Membre'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : activeTab === 'challenges' ? (
            <div className="space-y-3">
              {challenges.length === 0 ? (
                <div className="text-center py-10 bg-white rounded-2xl border border-[#E8E4D8]">
                  <p className="text-xs text-[#5C6B5E]">Aucun défi actif actuellement.</p>
                </div>
              ) : (
                challenges.map(ch => (
                  <div key={ch.id} className="bg-white p-4 rounded-2xl border border-[#E8E4D8] flex items-center justify-between gap-4">
                    <div>
                      <h4 className="font-bold text-sm text-[#1C2620] mb-1">{ch.title}</h4>
                      <p className="text-xs text-[#4A574C] mb-2">{ch.description}</p>
                      <span className="bg-[#17402C]/10 text-[#17402C] text-[10px] font-bold px-2.5 py-1 rounded-full">+{ch.xp} XP</span>
                    </div>
                    <button className="px-4 py-2 bg-[#1C2620] text-white rounded-full text-xs font-bold hover:bg-[#2D5A3D] transition-colors">Relever</button>
                  </div>
                ))
              )}
            </div>
          ) : activeTab === 'events' ? (
            <div className="space-y-4">
              {isAdmin && (
                <div className="bg-white p-4 rounded-2xl border border-[#E8E4D8] space-y-3">
                  <h4 className="font-bold text-xs text-[#1C2620] uppercase tracking-wider">Planifier une sortie</h4>
                  <input type="text" placeholder="Titre de la sortie..." className="w-full bg-[#F5F2E8] border-none rounded-xl px-3 py-2 text-xs focus:ring-1 focus:ring-[#2D5A3D]" value={newEvent.title} onChange={e => setNewEvent({ ...newEvent, title: e.target.value })} />
                  <div className="grid grid-cols-2 gap-2">
                    <input type="datetime-local" className="bg-[#F5F2E8] border-none rounded-xl px-3 py-2 text-xs" value={newEvent.event_date} onChange={e => setNewEvent({ ...newEvent, event_date: e.target.value })} />
                    <input type="text" placeholder="Lieu..." className="bg-[#F5F2E8] border-none rounded-xl px-3 py-2 text-xs" value={newEvent.location} onChange={e => setNewEvent({ ...newEvent, location: e.target.value })} />
                  </div>
                  <button onClick={handlePostEvent} disabled={postingEvent || !newEvent.title.trim()} className="px-4 py-2 bg-[#2D5A3D] text-white rounded-full text-xs font-bold disabled:opacity-50">
                    {postingEvent ? 'Création...' : "Créer l'événement"}
                  </button>
                </div>
              )}
              {events.length === 0 ? (
                <div className="text-center py-10 bg-white rounded-2xl border border-[#E8E4D8]">
                  <p className="text-xs text-[#5C6B5E]">Aucune sortie planifiée.</p>
                </div>
              ) : (
                events.map(ev => (
                  <div key={ev.id} className="bg-white p-4 rounded-2xl border border-[#E8E4D8] flex items-center justify-between gap-4">
                    <div>
                      <h4 className="font-bold text-sm text-[#1C2620]">{ev.title}</h4>
                      <p className="text-xs text-[#5C6B5E] mt-0.5">📍 {ev.location || 'En ligne'} · {ev.event_date ? new Date(ev.event_date).toLocaleDateString('fr-FR') : 'Date à venir'}</p>
                    </div>
                    <button className="px-4 py-2 bg-[#2D5A3D] text-white rounded-full text-xs font-bold">Participer</button>
                  </div>
                ))
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {pendingRequests.length === 0 ? (
                <div className="text-center py-10 bg-white rounded-2xl border border-[#E8E4D8]">
                  <p className="text-xs text-[#5C6B5E]">Aucune demande en attente.</p>
                </div>
              ) : (
                pendingRequests.map(r => (
                  <div key={r.id} className="bg-white p-4 rounded-2xl border border-[#E8E4D8] flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <img src={r.user?.avatar_url || 'https://i.pravatar.cc/150'} className="w-8 h-8 rounded-full object-cover" />
                      <span className="font-bold text-xs text-[#1C2620]">{r.user?.full_name || 'Utilisateur'}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button onClick={() => handleApproveRequest(r.id, r.user_id, true)} className="px-3 py-1.5 bg-[#2D5A3D] text-white rounded-full text-xs font-bold">Accepter</button>
                      <button onClick={() => handleApproveRequest(r.id, r.user_id, false)} className="px-3 py-1.5 bg-[#F5F2E8] text-[#5C6B5E] rounded-full text-xs font-bold">Refuser</button>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        {toast && (
          <div className="bg-[#1C2620] text-white text-xs font-bold px-4 py-2 text-center">
            {toast}
          </div>
        )}
      </motion.div>
    </div>
  );
}
