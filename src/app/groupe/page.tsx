'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';

import Header from '@/components/Header';
import Footer from '@/components/Footer';
import Icon from '@/components/ui/AppIcon';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useChat } from '@/lib/hooks/useChat';
import { useToast } from '@/contexts/ToastContext';

interface TravelGroup {
  id: string;
  name: string;
  description: string;
  destination: string;
  theme: string;
  cover_url: string | null;
  visibility: 'public' | 'private' | 'invite_only';
  invite_code: string;
  max_members: number;
  departure_date: string | null;
  return_date: string | null;
  budget_target: number;
  owner_id: string;
  group_level: number;
  group_xp: number;
  optimization_score: number;
  created_at: string;
  member_count?: number;
  my_role?: string;
}

interface GroupMember {
  id: string;
  user_id: string;
  role: string;
  status: string;
  weight_capacity: number;
  user_profiles?: { full_name: string; avatar_url: string; email: string };
}

interface GroupMessage {
  id: string;
  group_id: string;
  user_id: string;
  content: string;
  created_at: string;
  user_profiles?: { full_name: string; avatar_url: string };
}

interface GroupExpense {
  id: string;
  title: string;
  amount: number;
  category: string;
  paid_by: string;
  status: string;
  created_at: string;
  user_profiles?: { full_name: string };
}

interface GroupKitItem {
  id: string;
  name: string;
  weight_grams: number;
  category: string;
  quantity: number;
  assigned_to: string | null;
  user_profiles?: { full_name: string };
}

interface GroupTask {
  id: string;
  title: string;
  status: string;
  due_date: string | null;
  assigned_to: string | null;
  user_profiles?: { full_name: string };
}

interface GroupPoll {
  id: string;
  question: string;
  options: string[];
  status: string;
  created_at: string;
  votes?: { option_index: number; count: number }[];
  my_vote?: number | null;
}

const THEMES = ['Trek', 'Van Life', 'Randonnée', 'Expédition', 'Tour du monde', 'Plage', 'Ski', 'Vélo', 'Moto', 'Autre'];
const EXPENSE_CATEGORIES = ['Transport', 'Hébergement', 'Nourriture', 'Équipement', 'Administratif', 'Activités', 'Divers'];
const KIT_CATEGORIES = ['Abri', 'Cuisine', 'Eau', 'Sécurité', 'Nourriture', 'Technique', 'Vêtements', 'Navigation', 'Divers'];

function formatWeight(g: number): string {
  return g >= 1000 ? `${(g / 1000).toFixed(1)} kg` : `${g} g`;
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'À l\'instant';
  if (mins < 60) return `${mins}min`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  return `${Math.floor(hrs / 24)}j`;
}

export default function GroupePage() {
  const { user, profile } = useAuth();
  const router = useRouter();
  const supabase = createClient();
  const { toast } = useToast();

  const [myGroups, setMyGroups] = useState<TravelGroup[]>([]);
  const [selectedGroup, setSelectedGroup] = useState<TravelGroup | null>(null);
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [messages, setMessages] = useState<GroupMessage[]>([]);
  const [expenses, setExpenses] = useState<GroupExpense[]>([]);
  const [kitItems, setKitItems] = useState<GroupKitItem[]>([]);
  const [tasks, setTasks] = useState<GroupTask[]>([]);
  const [polls, setPolls] = useState<GroupPoll[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'chat' | 'kit' | 'budget' | 'planning' | 'album' | 'ai'>('overview');

  // Create group modal
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createForm, setCreateForm] = useState({ name: '', description: '', destination: '', theme: 'Trek', visibility: 'public', departure_date: '', return_date: '', budget_target: '', max_members: '20' });
  const [creating, setCreating] = useState(false);

  // Chat
  const [newMessage, setNewMessage] = useState('');
  const [sendingMsg, setSendingMsg] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Budget
  const [showExpenseModal, setShowExpenseModal] = useState(false);
  const [expenseForm, setExpenseForm] = useState({ title: '', amount: '', category: 'Divers' });

  // Kit
  const [showKitModal, setShowKitModal] = useState(false);
  const [kitForm, setKitForm] = useState({ name: '', weight_grams: '', category: 'Divers', quantity: '1', assigned_to: '' });

  // Tasks
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [taskForm, setTaskForm] = useState({ title: '', due_date: '', assigned_to: '' });

  // Poll
  const [showPollModal, setShowPollModal] = useState(false);
  const [pollForm, setPollForm] = useState({ question: '', options: ['', '', ''] });

  // Join by code
  const [joinCode, setJoinCode] = useState('');
  const [joining, setJoining] = useState(false);

  // AI
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiResponse, setAiResponse] = useState('');
  const { response: chatResponse, isLoading: aiLoading, error: aiError, sendMessage: sendAiMessage } = useChat('GEMINI', 'gemini/gemini-2.5-flash', false);

  useEffect(() => {
    if (aiError) toast(aiError.message, 'error');
  }, [aiError]);

  useEffect(() => {
    if (chatResponse) setAiResponse(chatResponse);
  }, [chatResponse]);

  useEffect(() => {
    loadMyGroups();
  }, [user]);

  useEffect(() => {
    if (selectedGroup) {
      loadGroupData(selectedGroup.id);
      setupRealtimeChat(selectedGroup.id);
    }
  }, [selectedGroup]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function loadMyGroups() {
    setLoading(true);
    try {
      if (!user) {
        // Load public groups for non-authenticated users
        const { data } = await supabase
          .from('travel_groups')
          .select('*')
          .eq('visibility', 'public')
          .order('created_at', { ascending: false })
          .limit(10);
        setMyGroups(data || []);
        if (data && data.length > 0) setSelectedGroup(data[0]);
        return;
      }

      // Get groups where user is a member
      const { data: memberData } = await supabase
        .from('group_members')
        .select('group_id, role')
        .eq('user_id', user.id)
        .eq('status', 'active');

      if (memberData && memberData.length > 0) {
        const groupIds = memberData.map(m => m.group_id);
        const { data: groups } = await supabase
          .from('travel_groups')
          .select('*')
          .in('id', groupIds)
          .order('updated_at', { ascending: false });

        const enriched = (groups || []).map(g => ({
          ...g,
          my_role: memberData.find(m => m.group_id === g.id)?.role
        }));
        setMyGroups(enriched);
        if (enriched.length > 0) setSelectedGroup(enriched[0]);
      } else {
        // Show public groups if no memberships
        const { data } = await supabase
          .from('travel_groups')
          .select('*')
          .eq('visibility', 'public')
          .order('created_at', { ascending: false })
          .limit(6);
        setMyGroups(data || []);
        if (data && data.length > 0) setSelectedGroup(data[0]);
      }
    } catch (e) {
      console.error('loadMyGroups error:', e);
    } finally {
      setLoading(false);
    }
  }

  async function loadGroupData(groupId: string) {
    const [membersRes, messagesRes, expensesRes, kitRes, tasksRes, pollsRes] = await Promise.all([
      supabase.from('group_members').select('*, user_profiles(full_name, avatar_url, email)').eq('group_id', groupId).eq('status', 'active'),
      supabase.from('group_messages').select('*, user_profiles(full_name, avatar_url)').eq('group_id', groupId).order('created_at', { ascending: true }).limit(50),
      supabase.from('group_expenses').select('*, user_profiles(full_name)').eq('group_id', groupId).order('created_at', { ascending: false }),
      supabase.from('group_kit_items').select('*, user_profiles(full_name)').eq('group_id', groupId),
      supabase.from('group_tasks').select('*, user_profiles(full_name)').eq('group_id', groupId).order('created_at', { ascending: false }),
      supabase.from('group_polls').select('*').eq('group_id', groupId).order('created_at', { ascending: false }),
    ]);

    setMembers(membersRes.data || []);
    setMessages(messagesRes.data || []);
    setExpenses(expensesRes.data || []);
    setKitItems(kitRes.data || []);
    setTasks(tasksRes.data || []);

    // Enrich polls with vote counts
    const enrichedPolls = await Promise.all((pollsRes.data || []).map(async (poll) => {
      const { data: votes } = await supabase.from('group_poll_votes').select('option_index').eq('poll_id', poll.id);
      const optionCounts = (poll.options as string[]).map((_, i) => ({
        option_index: i,
        count: (votes || []).filter(v => v.option_index === i).length
      }));
      let myVote = null;
      if (user) {
        const { data: myVoteData } = await supabase.from('group_poll_votes').select('option_index').eq('poll_id', poll.id).eq('user_id', user.id).maybeSingle();
        myVote = myVoteData?.option_index ?? null;
      }
      return { ...poll, votes: optionCounts, my_vote: myVote };
    }));
    setPolls(enrichedPolls);
  }

  function setupRealtimeChat(groupId: string) {
    const channel = supabase
      .channel(`group_chat_${groupId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'group_messages', filter: `group_id=eq.${groupId}` },
        async (payload) => {
          const { data: msgWithProfile } = await supabase
            .from('group_messages')
            .select('*, user_profiles(full_name, avatar_url)')
            .eq('id', payload.new.id)
            .single();
          if (msgWithProfile) {
            setMessages(prev => [...prev, msgWithProfile]);
          }
        }
      ).subscribe();
    return () => supabase.removeChannel(channel);
  }

  async function handleCreateGroup(e: React.FormEvent) {
    e.preventDefault();
    if (!user) { toast('Connectez-vous pour créer un groupe', 'error'); return; }
    setCreating(true);
    try {
      const { data: group, error } = await supabase
        .from('travel_groups')
        .insert({
          name: createForm.name,
          description: createForm.description,
          destination: createForm.destination,
          theme: createForm.theme,
          visibility: createForm.visibility,
          departure_date: createForm.departure_date || null,
          return_date: createForm.return_date || null,
          budget_target: parseFloat(createForm.budget_target) || 0,
          max_members: parseInt(createForm.max_members) || 20,
          owner_id: user.id,
        })
        .select()
        .single();

      if (error) throw error;

      // Auto-join as organizer
      await supabase.from('group_members').insert({
        group_id: group.id,
        user_id: user.id,
        role: 'organizer',
        status: 'active',
      });

      toast('Groupe créé avec succès !', 'success');
      setShowCreateModal(false);
      setCreateForm({ name: '', description: '', destination: '', theme: 'Trek', visibility: 'public', departure_date: '', return_date: '', budget_target: '', max_members: '20' });
      await loadMyGroups();
      setSelectedGroup(group);
    } catch (err: any) {
      toast(err.message || 'Erreur lors de la création', 'error');
    } finally {
      setCreating(false);
    }
  }

  async function handleJoinByCode() {
    if (!user) { toast('Connectez-vous pour rejoindre un groupe', 'error'); return; }
    if (!joinCode.trim()) return;
    setJoining(true);
    try {
      const { data: group, error } = await supabase
        .from('travel_groups')
        .select('*')
        .eq('invite_code', joinCode.trim().toUpperCase())
        .maybeSingle();

      if (error || !group) { toast('Code invalide', 'error'); return; }

      const { error: joinError } = await supabase.from('group_members').insert({
        group_id: group.id,
        user_id: user.id,
        role: 'member',
        status: 'active',
      });

      if (joinError && joinError.code !== '23505') throw joinError;
      toast(`Vous avez rejoint "${group.name}" !`, 'success');
      setJoinCode('');
      await loadMyGroups();
    } catch (err: any) {
      toast(err.message || 'Erreur', 'error');
    } finally {
      setJoining(false);
    }
  }

  async function handleSendMessage(e: React.FormEvent) {
    e.preventDefault();
    if (!user || !selectedGroup || !newMessage.trim()) return;
    setSendingMsg(true);
    try {
      await supabase.from('group_messages').insert({
        group_id: selectedGroup.id,
        user_id: user.id,
        content: newMessage.trim(),
      });
      setNewMessage('');
    } catch (err: any) {
      toast('Erreur envoi message', 'error');
    } finally {
      setSendingMsg(false);
    }
  }

  async function handleAddExpense(e: React.FormEvent) {
    e.preventDefault();
    if (!user || !selectedGroup) return;
    try {
      const memberIds = members.map(m => m.user_id);
      await supabase.from('group_expenses').insert({
        group_id: selectedGroup.id,
        paid_by: user.id,
        title: expenseForm.title,
        amount: parseFloat(expenseForm.amount),
        category: expenseForm.category,
        split_between: memberIds,
      });
      toast('Dépense ajoutée', 'success');
      setShowExpenseModal(false);
      setExpenseForm({ title: '', amount: '', category: 'Divers' });
      loadGroupData(selectedGroup.id);
    } catch (err: any) {
      toast('Erreur', 'error');
    }
  }

  async function handleAddKitItem(e: React.FormEvent) {
    e.preventDefault();
    if (!user || !selectedGroup) return;
    try {
      await supabase.from('group_kit_items').insert({
        group_id: selectedGroup.id,
        assigned_to: kitForm.assigned_to || user.id,
        name: kitForm.name,
        weight_grams: parseInt(kitForm.weight_grams) || 0,
        category: kitForm.category,
        quantity: parseInt(kitForm.quantity) || 1,
      });
      toast('Article ajouté', 'success');
      setShowKitModal(false);
      setKitForm({ name: '', weight_grams: '', category: 'Divers', quantity: '1', assigned_to: '' });
      loadGroupData(selectedGroup.id);
    } catch (err: any) {
      toast('Erreur', 'error');
    }
  }

  async function handleAddTask(e: React.FormEvent) {
    e.preventDefault();
    if (!user || !selectedGroup) return;
    try {
      await supabase.from('group_tasks').insert({
        group_id: selectedGroup.id,
        created_by: user.id,
        assigned_to: taskForm.assigned_to || null,
        title: taskForm.title,
        due_date: taskForm.due_date || null,
        status: 'todo',
      });
      toast('Tâche ajoutée', 'success');
      setShowTaskModal(false);
      setTaskForm({ title: '', due_date: '', assigned_to: '' });
      loadGroupData(selectedGroup.id);
    } catch (err: any) {
      toast('Erreur', 'error');
    }
  }

  async function handleUpdateTaskStatus(taskId: string, status: string) {
    await supabase.from('group_tasks').update({ status }).eq('id', taskId);
    loadGroupData(selectedGroup!.id);
  }

  async function handleVotePoll(pollId: string, optionIndex: number) {
    if (!user) { toast('Connectez-vous pour voter', 'error'); return; }
    try {
      await supabase.from('group_poll_votes').upsert({ poll_id: pollId, user_id: user.id, option_index: optionIndex }, { onConflict: 'poll_id,user_id' });
      loadGroupData(selectedGroup!.id);
    } catch (err: any) {
      toast('Erreur vote', 'error');
    }
  }

  async function handleCreatePoll(e: React.FormEvent) {
    e.preventDefault();
    if (!user || !selectedGroup) return;
    const validOptions = pollForm.options.filter(o => o.trim());
    if (validOptions.length < 2) { toast('Minimum 2 options', 'error'); return; }
    try {
      await supabase.from('group_polls').insert({
        group_id: selectedGroup.id,
        created_by: user.id,
        question: pollForm.question,
        options: validOptions,
        status: 'open',
      });
      toast('Sondage créé', 'success');
      setShowPollModal(false);
      setPollForm({ question: '', options: ['', '', ''] });
      loadGroupData(selectedGroup.id);
    } catch (err: any) {
      toast('Erreur', 'error');
    }
  }

  async function handleAiAnalysis() {
    if (!selectedGroup || !aiPrompt.trim()) return;
    const totalWeight = kitItems.reduce((s, i) => s + i.weight_grams * i.quantity, 0);
    const context = `Groupe: ${selectedGroup.name}, Destination: ${selectedGroup.destination}, Membres: ${members.length}, Kit total: ${formatWeight(totalWeight)}, Articles: ${kitItems.map(i => i.name).join(', ')}, Budget: ${selectedGroup.budget_target}€, Dépenses: ${expenses.reduce((s, e) => s + e.amount, 0)}€`;
    sendAiMessage([
      { role: 'system', content: 'Tu es un expert en voyages d\'aventure et optimisation d\'équipement. Réponds en français de manière concise et pratique.' },
      { role: 'user', content: `Contexte du groupe: ${context}\n\nQuestion: ${aiPrompt}` }
    ], { temperature: 0.7, max_tokens: 800 });
  }

  const totalBudget = expenses.reduce((s, e) => s + e.amount, 0);
  const totalKitWeight = kitItems.reduce((s, i) => s + i.weight_grams * i.quantity, 0);
  const tasksDone = tasks.filter(t => t.status === 'done').length;

  const TABS = [
    { id: 'overview', label: 'Vue d\'ensemble', icon: 'HomeIcon' },
    { id: 'chat', label: 'Chat', icon: 'ChatBubbleLeftRightIcon' },
    { id: 'kit', label: 'Kit groupe', icon: 'ArchiveBoxIcon' },
    { id: 'budget', label: 'Budget', icon: 'BanknotesIcon' },
    { id: 'planning', label: 'Planning', icon: 'CalendarIcon' },
    { id: 'ai', label: 'IA Gemini', icon: 'SparklesIcon' },
  ];

  const roleLabel = (role: string) => ({ organizer: 'Organisateur', co_organizer: 'Co-org.', member: 'Membre', observer: 'Observateur' }[role] || role);
  const roleColor = (role: string) => ({ organizer: 'bg-primary/10 text-primary', co_organizer: 'bg-blue-100 text-blue-700', member: 'bg-muted text-muted-foreground', observer: 'bg-gray-100 text-gray-500' }[role] || 'bg-muted text-muted-foreground');

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Header />

      {/* Hero */}
      <section className="pt-20 bg-dark-bg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
          <p className="font-mono text-xs text-primary tracking-widest uppercase mb-2" style={{ fontFamily: 'var(--font-mono)' }}>VOYAGES EN GROUPE</p>
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
            <div>
              <h1 className="font-display font-800 text-3xl md:text-4xl text-white tracking-tight" style={{ fontFamily: 'var(--font-display)', fontWeight: 800 }}>
                Mes groupes de voyage
              </h1>
              <p className="text-white/60 text-sm mt-1">Planification collaborative, kit partagé, budget commun, chat temps réel</p>
            </div>
            <div className="flex gap-2">
              <div className="flex gap-2">
                <input
                  value={joinCode}
                  onChange={e => setJoinCode(e.target.value)}
                  placeholder="Code d'invitation"
                  className="bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-sm text-white placeholder-white/40 focus:outline-none focus:border-primary w-36"
                />
                <button onClick={handleJoinByCode} disabled={joining} className="bg-white/10 hover:bg-white/20 border border-white/20 text-white text-sm px-3 py-2 rounded-lg transition-colors">
                  {joining ? '...' : 'Rejoindre'}
                </button>
              </div>
              <button onClick={() => setShowCreateModal(true)} className="btn-primary py-2 px-4 text-sm flex items-center gap-2">
                <Icon name="PlusIcon" size={14} variant="outline" />
                Créer un groupe
              </button>
            </div>
          </div>
        </div>
      </section>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <div className="flex gap-6">
            {/* Sidebar: group list */}
            <div className="w-64 flex-shrink-0 space-y-2">
              <p className="text-xs font-mono text-muted-foreground uppercase tracking-wider mb-3" style={{ fontFamily: 'var(--font-mono)' }}>Mes groupes ({myGroups.length})</p>
              {myGroups.length === 0 ? (
                <div className="topo-card p-4 text-center">
                  <Icon name="UserGroupIcon" size={32} className="text-muted-foreground mx-auto mb-2" variant="outline" />
                  <p className="text-sm text-muted-foreground">Aucun groupe</p>
                  <button onClick={() => setShowCreateModal(true)} className="btn-primary py-1.5 px-3 text-xs mt-3">Créer</button>
                </div>
              ) : (
                myGroups.map(group => (
                  <button
                    key={group.id}
                    onClick={() => setSelectedGroup(group)}
                    className={`w-full text-left p-3 rounded-xl border transition-all ${selectedGroup?.id === group.id ? 'border-primary bg-primary/5' : 'border-border bg-card hover:border-primary/40'}`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                        <Icon name="UserGroupIcon" size={14} className="text-primary" variant="outline" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-xs text-foreground truncate">{group.name}</div>
                        <div className="text-[10px] text-muted-foreground truncate">{group.destination}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 mt-1">
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">{group.theme}</span>
                      {group.my_role && <span className={`text-[10px] px-1.5 py-0.5 rounded ${roleColor(group.my_role)}`}>{roleLabel(group.my_role)}</span>}
                    </div>
                  </button>
                ))
              )}
            </div>

            {/* Main content */}
            {selectedGroup ? (
              <div className="flex-1 min-w-0">
                {/* Group header */}
                <div className="topo-card p-5 mb-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h2 className="font-display font-700 text-xl text-foreground" style={{ fontFamily: 'var(--font-display)' }}>{selectedGroup.name}</h2>
                        <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium">{selectedGroup.theme}</span>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${selectedGroup.visibility === 'public' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                          {selectedGroup.visibility === 'public' ? 'Public' : selectedGroup.visibility === 'private' ? 'Privé' : 'Sur invitation'}
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground mb-3">{selectedGroup.description}</p>
                      <div className="flex flex-wrap gap-4 text-sm">
                        <div className="flex items-center gap-1.5 text-muted-foreground">
                          <Icon name="MapPinIcon" size={14} variant="outline" />
                          <span>{selectedGroup.destination}</span>
                        </div>
                        {selectedGroup.departure_date && (
                          <div className="flex items-center gap-1.5 text-muted-foreground">
                            <Icon name="CalendarIcon" size={14} variant="outline" />
                            <span>{new Date(selectedGroup.departure_date).toLocaleDateString('fr-FR')} → {selectedGroup.return_date ? new Date(selectedGroup.return_date).toLocaleDateString('fr-FR') : '?'}</span>
                          </div>
                        )}
                        <div className="flex items-center gap-1.5 text-muted-foreground">
                          <Icon name="UsersIcon" size={14} variant="outline" />
                          <span>{members.length} / {selectedGroup.max_members} membres</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <div className="text-center">
                        <div className="font-mono text-2xl font-700 text-primary" style={{ fontFamily: 'var(--font-mono)' }}>{selectedGroup.optimization_score}</div>
                        <div className="text-xs text-muted-foreground">Score /100</div>
                      </div>
                      <div className="flex items-center gap-1">
                        <Icon name="TrophyIcon" size={12} className="text-amber-500" variant="outline" />
                        <span className="text-xs text-muted-foreground">Niv. {selectedGroup.group_level}</span>
                      </div>
                      <div className="text-xs font-mono text-muted-foreground" style={{ fontFamily: 'var(--font-mono)' }}>
                        Code: <span className="text-foreground font-700">{selectedGroup.invite_code}</span>
                      </div>
                    </div>
                  </div>

                  {/* Quick stats */}
                  <div className="grid grid-cols-4 gap-3 mt-4 pt-4 border-t border-border">
                    {[
                      { label: 'Membres', value: members.length, icon: 'UsersIcon' },
                      { label: 'Kit total', value: formatWeight(totalKitWeight), icon: 'ArchiveBoxIcon' },
                      { label: 'Dépenses', value: `${totalBudget.toFixed(0)}€`, icon: 'BanknotesIcon' },
                      { label: 'Tâches', value: `${tasksDone}/${tasks.length}`, icon: 'CheckCircleIcon' },
                    ].map(stat => (
                      <div key={stat.label} className="text-center p-2 bg-background rounded-lg border border-border">
                        <Icon name={stat.icon} size={16} className="text-primary mx-auto mb-1" variant="outline" />
                        <div className="font-mono text-sm font-700 text-foreground" style={{ fontFamily: 'var(--font-mono)' }}>{stat.value}</div>
                        <div className="text-[10px] text-muted-foreground">{stat.label}</div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Tabs */}
                <div className="flex gap-1 bg-card border border-border rounded-xl p-1 mb-4 overflow-x-auto">
                  {TABS.map(tab => (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id as typeof activeTab)}
                      className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-all whitespace-nowrap ${activeTab === tab.id ? 'bg-primary text-white shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
                    >
                      <Icon name={tab.icon} size={13} variant="outline" />
                      {tab.label}
                    </button>
                  ))}
                </div>

                {/* TAB: OVERVIEW */}
                {activeTab === 'overview' && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Members */}
                    <div className="topo-card p-4">
                      <h3 className="font-display font-700 text-sm text-foreground mb-3" style={{ fontFamily: 'var(--font-display)' }}>Membres ({members.length})</h3>
                      <div className="space-y-2">
                        {members.map(m => (
                          <div key={m.id} className="flex items-center gap-2 p-2 bg-background rounded-lg border border-border">
                            <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-xs font-700 text-primary flex-shrink-0">
                              {m.user_profiles?.full_name?.charAt(0)?.toUpperCase() || '?'}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="text-xs font-medium text-foreground truncate">{m.user_profiles?.full_name || 'Membre'}</div>
                              <div className="text-[10px] text-muted-foreground">{formatWeight(m.weight_capacity)} capacité</div>
                            </div>
                            <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${roleColor(m.role)}`}>{roleLabel(m.role)}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Recent tasks */}
                    <div className="topo-card p-4">
                      <div className="flex items-center justify-between mb-3">
                        <h3 className="font-display font-700 text-sm text-foreground" style={{ fontFamily: 'var(--font-display)' }}>Tâches récentes</h3>
                        <button onClick={() => setActiveTab('planning')} className="text-xs text-primary hover:underline">Voir tout</button>
                      </div>
                      <div className="space-y-2">
                        {tasks.slice(0, 4).map(task => (
                          <div key={task.id} className="flex items-center gap-2 p-2 bg-background rounded-lg border border-border">
                            <button onClick={() => handleUpdateTaskStatus(task.id, task.status === 'done' ? 'todo' : 'done')} className="flex-shrink-0">
                              <Icon name={task.status === 'done' ? 'CheckCircleIcon' : 'CircleStackIcon'} size={16} className={task.status === 'done' ? 'text-emerald-500' : 'text-muted-foreground'} variant={task.status === 'done' ? 'solid' : 'outline'} />
                            </button>
                            <span className={`text-xs flex-1 ${task.status === 'done' ? 'line-through text-muted-foreground' : 'text-foreground'}`}>{task.title}</span>
                            {task.due_date && <span className="text-[10px] text-muted-foreground">{new Date(task.due_date).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })}</span>}
                          </div>
                        ))}
                        {tasks.length === 0 && <p className="text-xs text-muted-foreground text-center py-2">Aucune tâche</p>}
                      </div>
                    </div>

                    {/* Polls */}
                    <div className="topo-card p-4">
                      <div className="flex items-center justify-between mb-3">
                        <h3 className="font-display font-700 text-sm text-foreground" style={{ fontFamily: 'var(--font-display)' }}>Sondages actifs</h3>
                        <button onClick={() => setShowPollModal(true)} className="text-xs text-primary hover:underline">+ Créer</button>
                      </div>
                      {polls.filter(p => p.status === 'open').slice(0, 2).map(poll => {
                        const totalVotes = (poll.votes || []).reduce((s, v) => s + v.count, 0);
                        return (
                          <div key={poll.id} className="mb-3 p-3 bg-background rounded-lg border border-border">
                            <p className="text-xs font-medium text-foreground mb-2">{poll.question}</p>
                            <div className="space-y-1.5">
                              {(poll.options as string[]).map((opt, i) => {
                                const voteCount = poll.votes?.find(v => v.option_index === i)?.count || 0;
                                const pct = totalVotes > 0 ? Math.round((voteCount / totalVotes) * 100) : 0;
                                const isMyVote = poll.my_vote === i;
                                return (
                                  <button key={i} onClick={() => handleVotePoll(poll.id, i)} className={`w-full text-left p-2 rounded-lg border transition-all text-xs ${isMyVote ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/40'}`}>
                                    <div className="flex justify-between mb-1">
                                      <span className={isMyVote ? 'text-primary font-medium' : 'text-foreground'}>{opt}</span>
                                      <span className="text-muted-foreground">{pct}%</span>
                                    </div>
                                    <div className="h-1 bg-muted rounded-full overflow-hidden">
                                      <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${pct}%` }} />
                                    </div>
                                  </button>
                                );
                              })}
                            </div>
                            <p className="text-[10px] text-muted-foreground mt-1">{totalVotes} vote{totalVotes !== 1 ? 's' : ''}</p>
                          </div>
                        );
                      })}
                      {polls.filter(p => p.status === 'open').length === 0 && <p className="text-xs text-muted-foreground text-center py-2">Aucun sondage actif</p>}
                    </div>

                    {/* Budget summary */}
                    <div className="topo-card p-4">
                      <div className="flex items-center justify-between mb-3">
                        <h3 className="font-display font-700 text-sm text-foreground" style={{ fontFamily: 'var(--font-display)' }}>Budget</h3>
                        <button onClick={() => setActiveTab('budget')} className="text-xs text-primary hover:underline">Voir tout</button>
                      </div>
                      <div className="mb-3">
                        <div className="flex justify-between text-xs mb-1">
                          <span className="text-muted-foreground">Dépensé</span>
                          <span className="font-mono font-700 text-foreground" style={{ fontFamily: 'var(--font-mono)' }}>{totalBudget.toFixed(2)}€ / {selectedGroup.budget_target}€</span>
                        </div>
                        <div className="h-2 bg-muted rounded-full overflow-hidden">
                          <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${Math.min((totalBudget / (selectedGroup.budget_target || 1)) * 100, 100)}%` }} />
                        </div>
                      </div>
                      {expenses.slice(0, 3).map(exp => (
                        <div key={exp.id} className="flex items-center justify-between py-1.5 border-b border-border last:border-0">
                          <div>
                            <span className="text-xs text-foreground">{exp.title}</span>
                            <span className="text-[10px] text-muted-foreground ml-2">{exp.category}</span>
                          </div>
                          <span className="font-mono text-xs font-700 text-foreground" style={{ fontFamily: 'var(--font-mono)' }}>{exp.amount.toFixed(2)}€</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* TAB: CHAT */}
                {activeTab === 'chat' && (
                  <div className="topo-card flex flex-col" style={{ height: '500px' }}>
                    <div className="flex items-center gap-2 p-4 border-b border-border">
                      <Icon name="ChatBubbleLeftRightIcon" size={16} className="text-primary" variant="outline" />
                      <span className="font-display font-700 text-sm text-foreground" style={{ fontFamily: 'var(--font-display)' }}>Chat du groupe</span>
                      <span className="text-xs text-muted-foreground ml-auto">{members.length} membres</span>
                    </div>
                    <div className="flex-1 overflow-y-auto p-4 space-y-3">
                      {messages.map(msg => {
                        const isMe = msg.user_id === user?.id;
                        return (
                          <div key={msg.id} className={`flex gap-2 ${isMe ? 'flex-row-reverse' : ''}`}>
                            <div className="w-7 h-7 rounded-full bg-primary/20 flex items-center justify-center text-xs font-700 text-primary flex-shrink-0">
                              {msg.user_profiles?.full_name?.charAt(0)?.toUpperCase() || '?'}
                            </div>
                            <div className={`max-w-xs ${isMe ? 'items-end' : 'items-start'} flex flex-col`}>
                              {!isMe && <span className="text-[10px] text-muted-foreground mb-0.5">{msg.user_profiles?.full_name}</span>}
                              <div className={`px-3 py-2 rounded-2xl text-xs ${isMe ? 'bg-primary text-white rounded-tr-sm' : 'bg-card border border-border text-foreground rounded-tl-sm'}`}>
                                {msg.content}
                              </div>
                              <span className="text-[10px] text-muted-foreground mt-0.5">{timeAgo(msg.created_at)}</span>
                            </div>
                          </div>
                        );
                      })}
                      {messages.length === 0 && (
                        <div className="flex items-center justify-center h-full">
                          <p className="text-sm text-muted-foreground">Soyez le premier à écrire !</p>
                        </div>
                      )}
                      <div ref={messagesEndRef} />
                    </div>
                    <form onSubmit={handleSendMessage} className="p-4 border-t border-border flex gap-2">
                      <input
                        value={newMessage}
                        onChange={e => setNewMessage(e.target.value)}
                        placeholder={user ? 'Écrire un message...' : 'Connectez-vous pour écrire'}
                        disabled={!user || sendingMsg}
                        className="flex-1 bg-background border border-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-primary transition-colors"
                      />
                      <button type="submit" disabled={!user || sendingMsg || !newMessage.trim()} className="btn-primary py-2 px-4 text-sm">
                        <Icon name="PaperAirplaneIcon" size={14} variant="outline" />
                      </button>
                    </form>
                  </div>
                )}

                {/* TAB: KIT */}
                {activeTab === 'kit' && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="font-display font-700 text-base text-foreground" style={{ fontFamily: 'var(--font-display)' }}>Kit collectif du groupe</h3>
                        <p className="text-xs text-muted-foreground">Poids total: <span className="font-mono font-700 text-foreground">{formatWeight(totalKitWeight)}</span> · {kitItems.length} articles</p>
                      </div>
                      <button onClick={() => setShowKitModal(true)} className="btn-primary py-2 px-3 text-sm flex items-center gap-1.5">
                        <Icon name="PlusIcon" size={13} variant="outline" />
                        Ajouter
                      </button>
                    </div>

                    {/* Weight by member */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {members.map(m => {
                        const memberItems = kitItems.filter(i => i.assigned_to === m.user_id);
                        const memberWeight = memberItems.reduce((s, i) => s + i.weight_grams * i.quantity, 0);
                        const pct = Math.min((memberWeight / m.weight_capacity) * 100, 100);
                        return (
                          <div key={m.id} className="topo-card p-3">
                            <div className="flex items-center gap-2 mb-2">
                              <div className="w-7 h-7 rounded-full bg-primary/20 flex items-center justify-center text-xs font-700 text-primary">{m.user_profiles?.full_name?.charAt(0) || '?'}</div>
                              <div className="flex-1">
                                <div className="text-xs font-medium text-foreground">{m.user_profiles?.full_name || 'Membre'}</div>
                                <div className="text-[10px] text-muted-foreground">{formatWeight(memberWeight)} / {formatWeight(m.weight_capacity)}</div>
                              </div>
                              <span className={`text-[10px] font-medium ${pct > 90 ? 'text-red-500' : pct > 75 ? 'text-amber-500' : 'text-emerald-500'}`}>{Math.round(pct)}%</span>
                            </div>
                            <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                              <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: pct > 90 ? '#ef4444' : pct > 75 ? '#f59e0b' : 'var(--primary)' }} />
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Items table */}
                    <div className="topo-card overflow-hidden">
                      <table className="w-full text-sm">
                        <thead className="bg-card/50">
                          <tr className="border-b border-border">
                            {['Article', 'Catégorie', 'Poids', 'Qté', 'Assigné à'].map(h => (
                              <th key={h} className="text-left text-xs font-mono text-muted-foreground uppercase tracking-wider px-4 py-3" style={{ fontFamily: 'var(--font-mono)' }}>{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                          {kitItems.map(item => {
                            const member = members.find(m => m.user_id === item.assigned_to);
                            return (
                              <tr key={item.id} className="hover:bg-card/30 transition-colors">
                                <td className="px-4 py-2.5 font-medium text-xs text-foreground">{item.name}</td>
                                <td className="px-4 py-2.5"><span className="text-[10px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground">{item.category}</span></td>
                                <td className="px-4 py-2.5 font-mono text-xs text-muted-foreground" style={{ fontFamily: 'var(--font-mono)' }}>{formatWeight(item.weight_grams)}</td>
                                <td className="px-4 py-2.5 font-mono text-xs text-foreground" style={{ fontFamily: 'var(--font-mono)' }}>×{item.quantity}</td>
                                <td className="px-4 py-2.5 text-xs text-muted-foreground">{member?.user_profiles?.full_name || '—'}</td>
                              </tr>
                            );
                          })}
                          {kitItems.length === 0 && (
                            <tr><td colSpan={5} className="px-4 py-6 text-center text-sm text-muted-foreground">Aucun article dans le kit</td></tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* TAB: BUDGET */}
                {activeTab === 'budget' && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="font-display font-700 text-base text-foreground" style={{ fontFamily: 'var(--font-display)' }}>Budget partagé</h3>
                        <p className="text-xs text-muted-foreground">Objectif: <span className="font-mono font-700 text-foreground">{selectedGroup.budget_target}€</span></p>
                      </div>
                      <button onClick={() => setShowExpenseModal(true)} className="btn-primary py-2 px-3 text-sm flex items-center gap-1.5">
                        <Icon name="PlusIcon" size={13} variant="outline" />
                        Dépense
                      </button>
                    </div>

                    {/* Budget overview */}
                    <div className="grid grid-cols-3 gap-3">
                      {[
                        { label: 'Dépensé', value: `${totalBudget.toFixed(2)}€`, color: 'text-foreground' },
                        { label: 'Restant', value: `${Math.max(0, selectedGroup.budget_target - totalBudget).toFixed(2)}€`, color: 'text-emerald-600' },
                        { label: 'Par membre', value: `${members.length > 0 ? (totalBudget / members.length).toFixed(2) : '0'}€`, color: 'text-blue-600' },
                      ].map(stat => (
                        <div key={stat.label} className="topo-card p-3 text-center">
                          <div className={`font-mono text-lg font-700 ${stat.color}`} style={{ fontFamily: 'var(--font-mono)' }}>{stat.value}</div>
                          <div className="text-xs text-muted-foreground">{stat.label}</div>
                        </div>
                      ))}
                    </div>

                    {/* Progress */}
                    <div className="topo-card p-4">
                      <div className="flex justify-between text-xs mb-2">
                        <span className="text-muted-foreground">Progression du budget</span>
                        <span className="font-mono font-700" style={{ fontFamily: 'var(--font-mono)' }}>{Math.round((totalBudget / (selectedGroup.budget_target || 1)) * 100)}%</span>
                      </div>
                      <div className="h-3 bg-muted rounded-full overflow-hidden">
                        <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${Math.min((totalBudget / (selectedGroup.budget_target || 1)) * 100, 100)}%` }} />
                      </div>
                    </div>

                    {/* Expenses list */}
                    <div className="topo-card overflow-hidden">
                      <div className="p-4 border-b border-border">
                        <h4 className="font-display font-700 text-sm text-foreground" style={{ fontFamily: 'var(--font-display)' }}>Historique des dépenses</h4>
                      </div>
                      <div className="divide-y divide-border">
                        {expenses.map(exp => (
                          <div key={exp.id} className="flex items-center gap-3 px-4 py-3">
                            <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
                              <Icon name="BanknotesIcon" size={14} className="text-muted-foreground" variant="outline" />
                            </div>
                            <div className="flex-1">
                              <div className="text-sm font-medium text-foreground">{exp.title}</div>
                              <div className="text-xs text-muted-foreground">{exp.category} · Payé par {exp.user_profiles?.full_name || 'Inconnu'}</div>
                            </div>
                            <div className="text-right">
                              <div className="font-mono font-700 text-foreground text-sm" style={{ fontFamily: 'var(--font-mono)' }}>{exp.amount.toFixed(2)}€</div>
                              <div className={`text-[10px] ${exp.status === 'settled' ? 'text-emerald-600' : 'text-amber-600'}`}>{exp.status === 'settled' ? 'Réglé' : 'En attente'}</div>
                            </div>
                          </div>
                        ))}
                        {expenses.length === 0 && <div className="px-4 py-6 text-center text-sm text-muted-foreground">Aucune dépense enregistrée</div>}
                      </div>
                    </div>
                  </div>
                )}

                {/* TAB: PLANNING */}
                {activeTab === 'planning' && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="font-display font-700 text-base text-foreground" style={{ fontFamily: 'var(--font-display)' }}>Checklist & Planification</h3>
                      <div className="flex gap-2">
                        <button onClick={() => setShowPollModal(true)} className="border border-border text-foreground py-2 px-3 text-xs rounded-lg hover:border-primary transition-colors flex items-center gap-1.5">
                          <Icon name="ChartBarIcon" size={12} variant="outline" />
                          Sondage
                        </button>
                        <button onClick={() => setShowTaskModal(true)} className="btn-primary py-2 px-3 text-sm flex items-center gap-1.5">
                          <Icon name="PlusIcon" size={13} variant="outline" />
                          Tâche
                        </button>
                      </div>
                    </div>

                    {/* Progress bar */}
                    <div className="topo-card p-4">
                      <div className="flex justify-between text-xs mb-2">
                        <span className="text-muted-foreground">Avancement</span>
                        <span className="font-mono font-700" style={{ fontFamily: 'var(--font-mono)' }}>{tasksDone}/{tasks.length} tâches</span>
                      </div>
                      <div className="h-2 bg-muted rounded-full overflow-hidden">
                        <div className="h-full bg-emerald-500 rounded-full transition-all" style={{ width: tasks.length > 0 ? `${(tasksDone / tasks.length) * 100}%` : '0%' }} />
                      </div>
                    </div>

                    {/* Tasks by status */}
                    {(['todo', 'in_progress', 'done'] as const).map(status => {
                      const statusTasks = tasks.filter(t => t.status === status);
                      const statusLabels = { todo: 'À faire', in_progress: 'En cours', done: 'Terminé' };
                      const statusColors = { todo: 'text-muted-foreground', in_progress: 'text-amber-600', done: 'text-emerald-600' };
                      return (
                        <div key={status} className="topo-card p-4">
                          <h4 className={`font-display font-700 text-sm mb-3 ${statusColors[status]}`} style={{ fontFamily: 'var(--font-display)' }}>{statusLabels[status]} ({statusTasks.length})</h4>
                          <div className="space-y-2">
                            {statusTasks.map(task => (
                              <div key={task.id} className="flex items-center gap-2 p-2 bg-background rounded-lg border border-border">
                                <button onClick={() => {
                                  const next = status === 'todo' ? 'in_progress' : status === 'in_progress' ? 'done' : 'todo';
                                  handleUpdateTaskStatus(task.id, next);
                                }}>
                                  <Icon name={status === 'done' ? 'CheckCircleIcon' : 'ArrowRightCircleIcon'} size={16} className={status === 'done' ? 'text-emerald-500' : 'text-muted-foreground hover:text-primary'} variant={status === 'done' ? 'solid' : 'outline'} />
                                </button>
                                <span className={`text-xs flex-1 ${status === 'done' ? 'line-through text-muted-foreground' : 'text-foreground'}`}>{task.title}</span>
                                {task.user_profiles && <span className="text-[10px] text-muted-foreground">{task.user_profiles.full_name}</span>}
                                {task.due_date && <span className="text-[10px] text-muted-foreground">{new Date(task.due_date).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })}</span>}
                              </div>
                            ))}
                            {statusTasks.length === 0 && <p className="text-xs text-muted-foreground text-center py-1">Aucune tâche</p>}
                          </div>
                        </div>
                      );
                    })}

                    {/* Polls */}
                    {polls.length > 0 && (
                      <div className="topo-card p-4">
                        <h4 className="font-display font-700 text-sm text-foreground mb-3" style={{ fontFamily: 'var(--font-display)' }}>Sondages du groupe</h4>
                        <div className="space-y-3">
                          {polls.map(poll => {
                            const totalVotes = (poll.votes || []).reduce((s, v) => s + v.count, 0);
                            return (
                              <div key={poll.id} className="p-3 bg-background rounded-lg border border-border">
                                <div className="flex items-center justify-between mb-2">
                                  <p className="text-xs font-medium text-foreground">{poll.question}</p>
                                  <span className={`text-[10px] px-1.5 py-0.5 rounded ${poll.status === 'open' ? 'bg-green-100 text-green-700' : 'bg-muted text-muted-foreground'}`}>{poll.status === 'open' ? 'Ouvert' : 'Fermé'}</span>
                                </div>
                                <div className="space-y-1.5">
                                  {(poll.options as string[]).map((opt, i) => {
                                    const voteCount = poll.votes?.find(v => v.option_index === i)?.count || 0;
                                    const pct = totalVotes > 0 ? Math.round((voteCount / totalVotes) * 100) : 0;
                                    const isMyVote = poll.my_vote === i;
                                    return (
                                      <button key={i} onClick={() => poll.status === 'open' && handleVotePoll(poll.id, i)} className={`w-full text-left p-2 rounded border transition-all text-xs ${isMyVote ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/40'}`}>
                                        <div className="flex justify-between mb-1">
                                          <span className={isMyVote ? 'text-primary font-medium' : 'text-foreground'}>{opt}</span>
                                          <span className="text-muted-foreground">{voteCount} vote{voteCount !== 1 ? 's' : ''} ({pct}%)</span>
                                        </div>
                                        <div className="h-1 bg-muted rounded-full overflow-hidden">
                                          <div className="h-full bg-primary rounded-full" style={{ width: `${pct}%` }} />
                                        </div>
                                      </button>
                                    );
                                  })}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* TAB: AI */}
                {activeTab === 'ai' && (
                  <div className="space-y-4">
                    <div className="topo-card p-5 border border-primary/20 bg-primary/5">
                      <div className="flex items-center gap-2 mb-3">
                        <Icon name="SparklesIcon" size={18} className="text-primary" variant="outline" />
                        <h3 className="font-display font-700 text-base text-foreground" style={{ fontFamily: 'var(--font-display)' }}>Assistant IA Gemini pour votre groupe</h3>
                      </div>
                      <p className="text-sm text-muted-foreground mb-4">Analysez votre kit, obtenez des recommandations d'itinéraire, optimisez votre budget et évaluez la compatibilité de votre équipe.</p>

                      {/* Quick prompts */}
                      <div className="flex flex-wrap gap-2 mb-4">
                        {[
                          'Optimise la répartition du kit',
                          'Analyse les risques du voyage',
                          'Suggère un itinéraire détaillé',
                          'Évalue la compatibilité du groupe',
                          'Calcule le budget optimal',
                        ].map(prompt => (
                          <button key={prompt} onClick={() => setAiPrompt(prompt)} className="text-xs px-3 py-1.5 rounded-full border border-border hover:border-primary hover:text-primary transition-colors">
                            {prompt}
                          </button>
                        ))}
                      </div>

                      <div className="flex gap-2">
                        <input
                          value={aiPrompt}
                          onChange={e => setAiPrompt(e.target.value)}
                          placeholder="Posez une question sur votre groupe..."
                          className="flex-1 bg-background border border-border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-primary transition-colors"
                          onKeyDown={e => e.key === 'Enter' && handleAiAnalysis()}
                        />
                        <button onClick={handleAiAnalysis} disabled={aiLoading || !aiPrompt.trim()} className="btn-primary py-2.5 px-4 text-sm flex items-center gap-2">
                          {aiLoading ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Icon name="SparklesIcon" size={14} variant="outline" />}
                          {aiLoading ? 'Analyse...' : 'Analyser'}
                        </button>
                      </div>
                    </div>

                    {aiResponse && (
                      <div className="topo-card p-5">
                        <div className="flex items-center gap-2 mb-3">
                          <Icon name="SparklesIcon" size={14} className="text-primary" variant="outline" />
                          <span className="font-display font-700 text-sm text-foreground" style={{ fontFamily: 'var(--font-display)' }}>Analyse Gemini</span>
                        </div>
                        <div className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">{aiResponse}</div>
                      </div>
                    )}

                    {/* Group stats for AI */}
                    <div className="grid grid-cols-2 gap-3">
                      <div className="topo-card p-4">
                        <h4 className="font-display font-700 text-xs text-muted-foreground mb-2 uppercase tracking-wider" style={{ fontFamily: 'var(--font-display)' }}>Contexte groupe</h4>
                        <div className="space-y-1.5 text-xs">
                          <div className="flex justify-between"><span className="text-muted-foreground">Destination</span><span className="text-foreground font-medium">{selectedGroup.destination}</span></div>
                          <div className="flex justify-between"><span className="text-muted-foreground">Membres</span><span className="text-foreground font-medium">{members.length}</span></div>
                          <div className="flex justify-between"><span className="text-muted-foreground">Kit total</span><span className="font-mono text-foreground font-medium">{formatWeight(totalKitWeight)}</span></div>
                          <div className="flex justify-between"><span className="text-muted-foreground">Budget</span><span className="font-mono text-foreground font-medium">{selectedGroup.budget_target}€</span></div>
                          <div className="flex justify-between"><span className="text-muted-foreground">Score optim.</span><span className="font-mono text-primary font-700">{selectedGroup.optimization_score}/100</span></div>
                        </div>
                      </div>
                      <div className="topo-card p-4">
                        <h4 className="font-display font-700 text-xs text-muted-foreground mb-2 uppercase tracking-wider" style={{ fontFamily: 'var(--font-display)' }}>Gamification</h4>
                        <div className="text-center py-2">
                          <div className="font-mono text-3xl font-700 text-primary mb-1" style={{ fontFamily: 'var(--font-mono)' }}>Niv. {selectedGroup.group_level}</div>
                          <div className="text-xs text-muted-foreground mb-2">{selectedGroup.group_xp} XP</div>
                          <div className="h-2 bg-muted rounded-full overflow-hidden">
                            <div className="h-full bg-primary rounded-full" style={{ width: `${(selectedGroup.group_xp % 1000) / 10}%` }} />
                          </div>
                          <div className="text-[10px] text-muted-foreground mt-1">{1000 - (selectedGroup.group_xp % 1000)} XP pour le niveau suivant</div>
                        </div>
                        <div className="flex flex-wrap gap-1 mt-2">
                          {['🏔️ Alpiniste', '🎒 Léger', '💰 Économe'].map(badge => (
                            <span key={badge} className="text-[10px] px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">{badge}</span>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex-1 flex items-center justify-center">
                <div className="text-center">
                  <Icon name="UserGroupIcon" size={48} className="text-muted-foreground mx-auto mb-4" variant="outline" />
                  <h3 className="font-display font-700 text-lg text-foreground mb-2" style={{ fontFamily: 'var(--font-display)' }}>Aucun groupe sélectionné</h3>
                  <p className="text-sm text-muted-foreground mb-4">Créez un groupe ou rejoignez-en un avec un code d'invitation</p>
                  <button onClick={() => setShowCreateModal(true)} className="btn-primary py-2 px-4 text-sm">Créer mon premier groupe</button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* CREATE GROUP MODAL */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-background rounded-2xl border border-border w-full max-w-lg p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-5">
              <h3 className="font-display font-700 text-lg text-foreground" style={{ fontFamily: 'var(--font-display)' }}>Créer un groupe de voyage</h3>
              <button onClick={() => setShowCreateModal(false)} className="p-1 text-muted-foreground hover:text-foreground"><Icon name="XMarkIcon" size={18} variant="outline" /></button>
            </div>
            <form onSubmit={handleCreateGroup} className="space-y-4">
              <div>
                <label className="block text-xs font-mono text-muted-foreground uppercase tracking-wider mb-1.5" style={{ fontFamily: 'var(--font-mono)' }}>Nom du groupe *</label>
                <input required value={createForm.name} onChange={e => setCreateForm({ ...createForm, name: e.target.value })} className="w-full bg-background border border-border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-primary transition-colors" placeholder="Trek Himalaya 2026" />
              </div>
              <div>
                <label className="block text-xs font-mono text-muted-foreground uppercase tracking-wider mb-1.5" style={{ fontFamily: 'var(--font-mono)' }}>Destination *</label>
                <input required value={createForm.destination} onChange={e => setCreateForm({ ...createForm, destination: e.target.value })} className="w-full bg-background border border-border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-primary transition-colors" placeholder="Nepal - Everest Base Camp" />
              </div>
              <div>
                <label className="block text-xs font-mono text-muted-foreground uppercase tracking-wider mb-1.5" style={{ fontFamily: 'var(--font-mono)' }}>Description</label>
                <textarea value={createForm.description} onChange={e => setCreateForm({ ...createForm, description: e.target.value })} rows={2} className="w-full bg-background border border-border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-primary transition-colors resize-none" placeholder="Décrivez votre aventure..." />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-mono text-muted-foreground uppercase tracking-wider mb-1.5" style={{ fontFamily: 'var(--font-mono)' }}>Thème</label>
                  <select value={createForm.theme} onChange={e => setCreateForm({ ...createForm, theme: e.target.value })} className="w-full bg-background border border-border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-primary transition-colors">
                    {THEMES.map(t => <option key={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-mono text-muted-foreground uppercase tracking-wider mb-1.5" style={{ fontFamily: 'var(--font-mono)' }}>Visibilité</label>
                  <select value={createForm.visibility} onChange={e => setCreateForm({ ...createForm, visibility: e.target.value })} className="w-full bg-background border border-border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-primary transition-colors">
                    <option value="public">Public</option>
                    <option value="private">Privé</option>
                    <option value="invite_only">Sur invitation</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-mono text-muted-foreground uppercase tracking-wider mb-1.5" style={{ fontFamily: 'var(--font-mono)' }}>Départ</label>
                  <input type="date" value={createForm.departure_date} onChange={e => setCreateForm({ ...createForm, departure_date: e.target.value })} className="w-full bg-background border border-border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-primary transition-colors" />
                </div>
                <div>
                  <label className="block text-xs font-mono text-muted-foreground uppercase tracking-wider mb-1.5" style={{ fontFamily: 'var(--font-mono)' }}>Retour</label>
                  <input type="date" value={createForm.return_date} onChange={e => setCreateForm({ ...createForm, return_date: e.target.value })} className="w-full bg-background border border-border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-primary transition-colors" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-mono text-muted-foreground uppercase tracking-wider mb-1.5" style={{ fontFamily: 'var(--font-mono)' }}>Budget (€)</label>
                  <input type="number" value={createForm.budget_target} onChange={e => setCreateForm({ ...createForm, budget_target: e.target.value })} className="w-full bg-background border border-border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-primary transition-colors" placeholder="2500" />
                </div>
                <div>
                  <label className="block text-xs font-mono text-muted-foreground uppercase tracking-wider mb-1.5" style={{ fontFamily: 'var(--font-mono)' }}>Max membres</label>
                  <input type="number" min={2} max={50} value={createForm.max_members} onChange={e => setCreateForm({ ...createForm, max_members: e.target.value })} className="w-full bg-background border border-border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-primary transition-colors" />
                </div>
              </div>
              <button type="submit" disabled={creating} className="btn-primary w-full justify-center py-3">
                {creating ? 'Création...' : 'Créer le groupe'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* EXPENSE MODAL */}
      {showExpenseModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-background rounded-2xl border border-border w-full max-w-md p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-5">
              <h3 className="font-display font-700 text-lg text-foreground" style={{ fontFamily: 'var(--font-display)' }}>Ajouter une dépense</h3>
              <button onClick={() => setShowExpenseModal(false)} className="p-1 text-muted-foreground hover:text-foreground"><Icon name="XMarkIcon" size={18} variant="outline" /></button>
            </div>
            <form onSubmit={handleAddExpense} className="space-y-4">
              <div>
                <label className="block text-xs font-mono text-muted-foreground uppercase tracking-wider mb-1.5" style={{ fontFamily: 'var(--font-mono)' }}>Description *</label>
                <input required value={expenseForm.title} onChange={e => setExpenseForm({ ...expenseForm, title: e.target.value })} className="w-full bg-background border border-border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-primary transition-colors" placeholder="Nuit refuge Namche" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-mono text-muted-foreground uppercase tracking-wider mb-1.5" style={{ fontFamily: 'var(--font-mono)' }}>Montant (€) *</label>
                  <input required type="number" step="0.01" value={expenseForm.amount} onChange={e => setExpenseForm({ ...expenseForm, amount: e.target.value })} className="w-full bg-background border border-border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-primary transition-colors" />
                </div>
                <div>
                  <label className="block text-xs font-mono text-muted-foreground uppercase tracking-wider mb-1.5" style={{ fontFamily: 'var(--font-mono)' }}>Catégorie</label>
                  <select value={expenseForm.category} onChange={e => setExpenseForm({ ...expenseForm, category: e.target.value })} className="w-full bg-background border border-border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-primary transition-colors">
                    {EXPENSE_CATEGORIES.map(c => <option key={c}>{c}</option>)}
                  </select>
                </div>
              </div>
              <button type="submit" className="btn-primary w-full justify-center">Ajouter</button>
            </form>
          </div>
        </div>
      )}

      {/* KIT MODAL */}
      {showKitModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-background rounded-2xl border border-border w-full max-w-md p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-5">
              <h3 className="font-display font-700 text-lg text-foreground" style={{ fontFamily: 'var(--font-display)' }}>Ajouter au kit</h3>
              <button onClick={() => setShowKitModal(false)} className="p-1 text-muted-foreground hover:text-foreground"><Icon name="XMarkIcon" size={18} variant="outline" /></button>
            </div>
            <form onSubmit={handleAddKitItem} className="space-y-4">
              <div>
                <label className="block text-xs font-mono text-muted-foreground uppercase tracking-wider mb-1.5" style={{ fontFamily: 'var(--font-mono)' }}>Nom de l'article *</label>
                <input required value={kitForm.name} onChange={e => setKitForm({ ...kitForm, name: e.target.value })} className="w-full bg-background border border-border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-primary transition-colors" />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-mono text-muted-foreground uppercase tracking-wider mb-1.5" style={{ fontFamily: 'var(--font-mono)' }}>Poids (g)</label>
                  <input type="number" value={kitForm.weight_grams} onChange={e => setKitForm({ ...kitForm, weight_grams: e.target.value })} className="w-full bg-background border border-border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-primary transition-colors" />
                </div>
                <div>
                  <label className="block text-xs font-mono text-muted-foreground uppercase tracking-wider mb-1.5" style={{ fontFamily: 'var(--font-mono)' }}>Qté</label>
                  <input type="number" min={1} value={kitForm.quantity} onChange={e => setKitForm({ ...kitForm, quantity: e.target.value })} className="w-full bg-background border border-border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-primary transition-colors" />
                </div>
                <div>
                  <label className="block text-xs font-mono text-muted-foreground uppercase tracking-wider mb-1.5" style={{ fontFamily: 'var(--font-mono)' }}>Catégorie</label>
                  <select value={kitForm.category} onChange={e => setKitForm({ ...kitForm, category: e.target.value })} className="w-full bg-background border border-border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-primary transition-colors">
                    {KIT_CATEGORIES.map(c => <option key={c}>{c}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-mono text-muted-foreground uppercase tracking-wider mb-1.5" style={{ fontFamily: 'var(--font-mono)' }}>Assigné à</label>
                <select value={kitForm.assigned_to} onChange={e => setKitForm({ ...kitForm, assigned_to: e.target.value })} className="w-full bg-background border border-border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-primary transition-colors">
                  <option value="">Moi-même</option>
                  {members.map(m => <option key={m.user_id} value={m.user_id}>{m.user_profiles?.full_name || 'Membre'}</option>)}
                </select>
              </div>
              <button type="submit" className="btn-primary w-full justify-center">Ajouter au kit</button>
            </form>
          </div>
        </div>
      )}

      {/* TASK MODAL */}
      {showTaskModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-background rounded-2xl border border-border w-full max-w-md p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-5">
              <h3 className="font-display font-700 text-lg text-foreground" style={{ fontFamily: 'var(--font-display)' }}>Ajouter une tâche</h3>
              <button onClick={() => setShowTaskModal(false)} className="p-1 text-muted-foreground hover:text-foreground"><Icon name="XMarkIcon" size={18} variant="outline" /></button>
            </div>
            <form onSubmit={handleAddTask} className="space-y-4">
              <div>
                <label className="block text-xs font-mono text-muted-foreground uppercase tracking-wider mb-1.5" style={{ fontFamily: 'var(--font-mono)' }}>Titre *</label>
                <input required value={taskForm.title} onChange={e => setTaskForm({ ...taskForm, title: e.target.value })} className="w-full bg-background border border-border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-primary transition-colors" placeholder="Réserver les vols" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-mono text-muted-foreground uppercase tracking-wider mb-1.5" style={{ fontFamily: 'var(--font-mono)' }}>Échéance</label>
                  <input type="date" value={taskForm.due_date} onChange={e => setTaskForm({ ...taskForm, due_date: e.target.value })} className="w-full bg-background border border-border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-primary transition-colors" />
                </div>
                <div>
                  <label className="block text-xs font-mono text-muted-foreground uppercase tracking-wider mb-1.5" style={{ fontFamily: 'var(--font-mono)' }}>Assigné à</label>
                  <select value={taskForm.assigned_to} onChange={e => setTaskForm({ ...taskForm, assigned_to: e.target.value })} className="w-full bg-background border border-border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-primary transition-colors">
                    <option value="">Non assigné</option>
                    {members.map(m => <option key={m.user_id} value={m.user_id}>{m.user_profiles?.full_name || 'Membre'}</option>)}
                  </select>
                </div>
              </div>
              <button type="submit" className="btn-primary w-full justify-center">Créer la tâche</button>
            </form>
          </div>
        </div>
      )}

      {/* POLL MODAL */}
      {showPollModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-background rounded-2xl border border-border w-full max-w-md p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-5">
              <h3 className="font-display font-700 text-lg text-foreground" style={{ fontFamily: 'var(--font-display)' }}>Créer un sondage</h3>
              <button onClick={() => setShowPollModal(false)} className="p-1 text-muted-foreground hover:text-foreground"><Icon name="XMarkIcon" size={18} variant="outline" /></button>
            </div>
            <form onSubmit={handleCreatePoll} className="space-y-4">
              <div>
                <label className="block text-xs font-mono text-muted-foreground uppercase tracking-wider mb-1.5" style={{ fontFamily: 'var(--font-mono)' }}>Question *</label>
                <input required value={pollForm.question} onChange={e => setPollForm({ ...pollForm, question: e.target.value })} className="w-full bg-background border border-border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-primary transition-colors" placeholder="Quelle date préférez-vous ?" />
              </div>
              <div>
                <label className="block text-xs font-mono text-muted-foreground uppercase tracking-wider mb-1.5" style={{ fontFamily: 'var(--font-mono)' }}>Options</label>
                <div className="space-y-2">
                  {pollForm.options.map((opt, i) => (
                    <input key={i} value={opt} onChange={e => { const opts = [...pollForm.options]; opts[i] = e.target.value; setPollForm({ ...pollForm, options: opts }); }} className="w-full bg-background border border-border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-primary transition-colors" placeholder={`Option ${i + 1}`} />
                  ))}
                  <button type="button" onClick={() => setPollForm({ ...pollForm, options: [...pollForm.options, ''] })} className="text-xs text-primary hover:underline">+ Ajouter une option</button>
                </div>
              </div>
              <button type="submit" className="btn-primary w-full justify-center">Créer le sondage</button>
            </form>
          </div>
        </div>
      )}

      <Footer />
    </div>
  );
}
