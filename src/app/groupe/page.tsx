'use client';

import React, { useState, useEffect, useRef, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
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
const THEME_EMOJI: Record<string, string> = {
  Trek: '🏔️', 'Van Life': '🚐', Randonnée: '🥾', Expédition: '🧭', 'Tour du monde': '🌍',
  Plage: '🏖️', Ski: '⛷️', Vélo: '🚴', Moto: '🏍️', Autre: '🎒',
};
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

const roleLabel = (role: string) => ({ organizer: '👑 Organisateur', co_organizer: '🛡️ Co-org.', member: '👤 Membre', observer: '👁️ Observateur' }[role] || role);
const roleColor = (role: string) => ({ organizer: 'bg-amber-100 text-amber-700', co_organizer: 'bg-blue-100 text-blue-700', member: 'bg-[#E7E3D6] text-[#5C6B5E]', observer: 'bg-gray-100 text-gray-500' }[role] || 'bg-[#E7E3D6] text-[#5C6B5E]');

function GroupePageInner() {
  const { user } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
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
  const [activeTab, setActiveTab] = useState<'overview' | 'chat' | 'kit' | 'budget' | 'planning' | 'ai'>('overview');

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createForm, setCreateForm] = useState({ name: '', description: '', destination: '', theme: 'Trek', visibility: 'public', departure_date: '', return_date: '', budget_target: '', max_members: '20' });
  const [creating, setCreating] = useState(false);

  const [showEditModal, setShowEditModal] = useState(false);
  const [editForm, setEditForm] = useState({ name: '', description: '', destination: '', theme: 'Trek', visibility: 'public', departure_date: '', return_date: '', budget_target: '', max_members: '20' });

  const [newMessage, setNewMessage] = useState('');
  const [sendingMsg, setSendingMsg] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const [showExpenseModal, setShowExpenseModal] = useState(false);
  const [expenseForm, setExpenseForm] = useState({ title: '', amount: '', category: 'Divers', paid_by: '' });
  const [addingExpense, setAddingExpense] = useState(false);

  const [showKitModal, setShowKitModal] = useState(false);
  const [kitForm, setKitForm] = useState({ name: '', weight_grams: '', category: 'Divers', quantity: '1', assigned_to: '' });
  const [addingKit, setAddingKit] = useState(false);

  const [showTaskModal, setShowTaskModal] = useState(false);
  const [taskForm, setTaskForm] = useState({ title: '', due_date: '', assigned_to: '' });
  const [addingTask, setAddingTask] = useState(false);

  const [showPollModal, setShowPollModal] = useState(false);
  const [pollForm, setPollForm] = useState({ question: '', options: ['', '', ''] });
  const [addingPoll, setAddingPoll] = useState(false);

  const [joinCode, setJoinCode] = useState('');
  const [joining, setJoining] = useState(false);

  const [aiPrompt, setAiPrompt] = useState('');
  const [aiConseils, setAiConseils] = useState('');
  const [loadingConseils, setLoadingConseils] = useState(false);

  // Use streaming for real-time AI responses
  const { response: chatResponse, isLoading: aiLoading, error: aiError, sendMessage: sendAiMessage } = useChat('GEMINI', 'gemini/gemini-2.5-flash', true);
  const { response: conseilResponse, isLoading: conseilLoading, error: conseilError, sendMessage: sendConseilMessage } = useChat('GEMINI', 'gemini/gemini-2.5-flash', true);

  const [aiResponse, setAiResponse] = useState('');
  const [aiAsked, setAiAsked] = useState(false);
  const [conseilAsked, setConseilAsked] = useState(false);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { if (aiError) toast(aiError.message, 'error'); }, [aiError]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { if (conseilError) toast(conseilError.message, 'error'); }, [conseilError]);

  // Update AI response as streaming chunks arrive
  useEffect(() => {
    if (aiAsked && chatResponse) {
      setAiResponse(chatResponse);
    }
  }, [chatResponse, aiAsked]);

  // Update conseils as streaming chunks arrive
  useEffect(() => {
    if (conseilAsked && conseilResponse) {
      setAiConseils(conseilResponse);
    }
  }, [conseilResponse, conseilAsked]);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { loadMyGroups(); }, [user]);
  useEffect(() => {
    if (selectedGroup) {
      loadGroupData(selectedGroup.id);
      const cleanup = setupRealtimeChat(selectedGroup.id);
      return cleanup;
    }
    return undefined;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedGroup?.id]);
  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  async function loadMyGroups() {
    setLoading(true);
    const targetGroupId = searchParams?.get('group');
    try {
      if (!user) {
        const { data } = await supabase.from('travel_groups').select('*').eq('visibility', 'public').order('created_at', { ascending: false }).limit(10);
        setMyGroups(data || []);
        if (targetGroupId) setSelectedGroup((data || []).find(g => g.id === targetGroupId) || (data?.[0] ?? null));
        else if (data?.length) setSelectedGroup(data[0]);
        return;
      }
      const { data: memberData } = await supabase.from('group_members').select('group_id, role').eq('user_id', user.id).eq('status', 'active');
      if (memberData?.length) {
        const groupIds = memberData.map(m => m.group_id);
        const { data: groups } = await supabase.from('travel_groups').select('*').in('id', groupIds).order('created_at', { ascending: false });
        const enriched = (groups || []).map(g => ({ ...g, my_role: memberData.find(m => m.group_id === g.id)?.role }));
        setMyGroups(enriched);
        if (targetGroupId) setSelectedGroup(enriched.find(g => g.id === targetGroupId) || (enriched[0] ?? null));
        else if (enriched.length) setSelectedGroup(enriched[0]);
      } else {
        const { data } = await supabase.from('travel_groups').select('*').eq('visibility', 'public').order('created_at', { ascending: false }).limit(6);
        setMyGroups(data || []);
        if (targetGroupId) setSelectedGroup((data || []).find(g => g.id === targetGroupId) || (data?.[0] ?? null));
        else if (data?.length) setSelectedGroup(data[0]);
      }
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }

  async function loadGroupData(groupId: string) {
    const [membersRes, messagesRes, expensesRes, kitRes, tasksRes, pollsRes] = await Promise.all([
      supabase.from('group_members').select('*, user_profiles(full_name, avatar_url, email)').eq('group_id', groupId).eq('status', 'active'),
      supabase.from('group_messages').select('*, user_profiles(full_name, avatar_url)').eq('group_id', groupId).order('created_at', { ascending: true }).limit(50),
      supabase.from('group_expenses').select('*, user_profiles(full_name)').eq('group_id', groupId).order('created_at', { ascending: false }),
      supabase.from('group_kit_items').select('*, user_profiles(full_name)').eq('group_id', groupId),
      supabase.from('group_tasks').select('*, user_profiles!group_tasks_assigned_to_fkey(full_name)').eq('group_id', groupId).order('created_at', { ascending: false }),
      supabase.from('group_polls').select('*').eq('group_id', groupId).order('created_at', { ascending: false }),
    ]);
    setMembers(membersRes.data || []);
    setMessages(messagesRes.data || []);
    setExpenses(expensesRes.data || []);
    setKitItems(kitRes.data || []);
    setTasks(tasksRes.data || []);
    const enrichedPolls = await Promise.all((pollsRes.data || []).map(async (poll) => {
      const { data: votes } = await supabase.from('group_poll_votes').select('option_index').eq('poll_id', poll.id);
      const optionCounts = (poll.options as string[]).map((_, i) => ({ option_index: i, count: (votes || []).filter(v => v.option_index === i).length }));
      let myVote = null;
      if (user) {
        const { data: mv } = await supabase.from('group_poll_votes').select('option_index').eq('poll_id', poll.id).eq('user_id', user.id).maybeSingle();
        myVote = mv?.option_index ?? null;
      }
      return { ...poll, votes: optionCounts, my_vote: myVote };
    }));
    setPolls(enrichedPolls);
  }

  function setupRealtimeChat(groupId: string) {
    const channel = supabase.channel(`group_chat_${groupId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'group_messages', filter: `group_id=eq.${groupId}` }, async (payload) => {
        const { data } = await supabase.from('group_messages').select('*, user_profiles(full_name, avatar_url)').eq('id', payload.new.id).single();
        if (data) setMessages(prev => {
          // Avoid duplicates
          if (prev.find(m => m.id === data.id)) return prev;
          return [...prev, data];
        });
      }).subscribe();
    return () => { supabase.removeChannel(channel); };
  }

  async function handleCreateGroup(e: React.FormEvent) {
    e.preventDefault();
    if (!user) { toast('Connectez-vous pour créer un groupe', 'error'); return; }
    setCreating(true);
    try {
      const { data: group, error } = await supabase.from('travel_groups').insert({
        name: createForm.name, description: createForm.description, destination: createForm.destination,
        theme: createForm.theme, visibility: createForm.visibility,
        departure_date: createForm.departure_date || null, return_date: createForm.return_date || null,
        budget_target: parseFloat(createForm.budget_target) || 0, max_members: parseInt(createForm.max_members) || 20, owner_id: user.id,
      }).select().single();
      if (error) throw error;
      const { error: memberError } = await supabase.from('group_members').insert({ group_id: group.id, user_id: user.id, role: 'organizer', status: 'active' });
      if (memberError) console.error('Member insert error:', memberError);
      toast('Groupe créé avec succès !', 'success');
      setShowCreateModal(false);
      setCreateForm({ name: '', description: '', destination: '', theme: 'Trek', visibility: 'public', departure_date: '', return_date: '', budget_target: '', max_members: '20' });
      await loadMyGroups();
      setSelectedGroup(group);
      router.replace(`/groupe?group=${group.id}`, { scroll: false });
    } catch (err: unknown) { toast((err as Error).message || 'Erreur lors de la création', 'error'); }
    finally { setCreating(false); }
  }

  async function handleEditGroup(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedGroup) return;
    try {
      const { error } = await supabase.from('travel_groups').update({
        name: editForm.name, description: editForm.description, destination: editForm.destination,
        theme: editForm.theme, visibility: editForm.visibility,
        departure_date: editForm.departure_date || null, return_date: editForm.return_date || null,
        budget_target: parseFloat(editForm.budget_target) || 0, max_members: parseInt(editForm.max_members) || 20,
      }).eq('id', selectedGroup.id);
      if (error) throw error;
      toast('Groupe modifié !', 'success');
      setShowEditModal(false);
      await loadMyGroups();
    } catch (err: unknown) { toast((err as Error).message || 'Erreur', 'error'); }
  }

  function openEditModal() {
    if (!selectedGroup) return;
    setEditForm({
      name: selectedGroup.name, description: selectedGroup.description || '', destination: selectedGroup.destination,
      theme: selectedGroup.theme, visibility: selectedGroup.visibility,
      departure_date: selectedGroup.departure_date?.split('T')[0] || '', return_date: selectedGroup.return_date?.split('T')[0] || '',
      budget_target: selectedGroup.budget_target?.toString() || '', max_members: selectedGroup.max_members?.toString() || '20',
    });
    setShowEditModal(true);
  }

  async function handleJoinByCode() {
    if (!user) { toast('Connectez-vous pour rejoindre un groupe', 'error'); return; }
    if (!joinCode.trim()) return;
    setJoining(true);
    try {
      const { data: group } = await supabase.from('travel_groups').select('*').eq('invite_code', joinCode.trim().toUpperCase()).maybeSingle();
      if (!group) { toast('Code invalide', 'error'); return; }
      const { error } = await supabase.from('group_members').insert({ group_id: group.id, user_id: user.id, role: 'member', status: 'active' });
      if (error && error.code !== '23505') throw error;
      toast(`Vous avez rejoint "${group.name}" !`, 'success');
      setJoinCode('');
      await loadMyGroups();
      setSelectedGroup(group);
    } catch (err: unknown) { toast((err as Error).message || 'Erreur', 'error'); }
    finally { setJoining(false); }
  }

  async function handleLeaveGroup() {
    if (!user || !selectedGroup) return;
    if (!confirm('Quitter ce groupe ?')) return;
    try {
      const { error } = await supabase.from('group_members').delete().eq('group_id', selectedGroup.id).eq('user_id', user.id);
      if (error) throw error;
      toast('Vous avez quitté le groupe', 'success');
      setSelectedGroup(null);
      await loadMyGroups();
    } catch (err: unknown) { toast((err as Error).message || 'Erreur', 'error'); }
  }

  async function handleSendMessage(e: React.FormEvent) {
    e.preventDefault();
    if (!user) { toast('Connectez-vous pour envoyer un message', 'error'); return; }
    if (!selectedGroup) { toast('Aucun groupe sélectionné', 'error'); return; }
    if (!newMessage.trim()) return;
    setSendingMsg(true);
    const msgContent = newMessage.trim();
    setNewMessage('');
    try {
      const { error } = await supabase.from('group_messages').insert({
        group_id: selectedGroup.id,
        user_id: user.id,
        content: msgContent,
      });
      if (error) {
        setNewMessage(msgContent);
        throw error;
      }
    } catch (err: unknown) {
      toast((err as Error).message || 'Erreur lors de l\'envoi', 'error');
    } finally {
      setSendingMsg(false);
    }
  }

  async function handleAddExpense(e: React.FormEvent) {
    e.preventDefault();
    if (!user || !selectedGroup) { toast('Connectez-vous pour ajouter une dépense', 'error'); return; }
    if (!expenseForm.title.trim() || !expenseForm.amount) { toast('Remplissez tous les champs obligatoires', 'error'); return; }
    setAddingExpense(true);
    try {
      const payerId = expenseForm.paid_by || user.id;
      const { error } = await supabase.from('group_expenses').insert({
        group_id: selectedGroup.id,
        paid_by: payerId,
        title: expenseForm.title.trim(),
        amount: parseFloat(expenseForm.amount),
        category: expenseForm.category,
        split_between: members.map(m => m.user_id),
        status: 'pending',
      });
      if (error) throw error;
      toast('Dépense ajoutée !', 'success');
      setShowExpenseModal(false);
      setExpenseForm({ title: '', amount: '', category: 'Divers', paid_by: '' });
      await loadGroupData(selectedGroup.id);
    } catch (err: unknown) {
      toast((err as Error).message || 'Erreur lors de l\'ajout de la dépense', 'error');
    } finally {
      setAddingExpense(false);
    }
  }

  async function handleAddKitItem(e: React.FormEvent) {
    e.preventDefault();
    if (!user || !selectedGroup) { toast('Connectez-vous pour ajouter un article', 'error'); return; }
    if (!kitForm.name.trim()) { toast('Le nom de l\'article est requis', 'error'); return; }
    setAddingKit(true);
    try {
      const { error } = await supabase.from('group_kit_items').insert({
        group_id: selectedGroup.id,
        assigned_to: kitForm.assigned_to || user.id,
        name: kitForm.name.trim(),
        weight_grams: parseInt(kitForm.weight_grams) || 0,
        category: kitForm.category,
        quantity: parseInt(kitForm.quantity) || 1,
      });
      if (error) throw error;
      toast('Article ajouté au kit !', 'success');
      setShowKitModal(false);
      setKitForm({ name: '', weight_grams: '', category: 'Divers', quantity: '1', assigned_to: '' });
      await loadGroupData(selectedGroup.id);
    } catch (err: unknown) {
      toast((err as Error).message || 'Erreur lors de l\'ajout au kit', 'error');
    } finally {
      setAddingKit(false);
    }
  }

  async function handleAddTask(e: React.FormEvent) {
    e.preventDefault();
    if (!user || !selectedGroup) { toast('Connectez-vous pour créer une tâche', 'error'); return; }
    if (!taskForm.title.trim()) { toast('Le titre de la tâche est requis', 'error'); return; }
    setAddingTask(true);
    try {
      const { error } = await supabase.from('group_tasks').insert({
        group_id: selectedGroup.id,
        created_by: user.id,
        assigned_to: taskForm.assigned_to || null,
        title: taskForm.title.trim(),
        due_date: taskForm.due_date || null,
        status: 'todo',
      });
      if (error) throw error;
      toast('Tâche créée !', 'success');
      setShowTaskModal(false);
      setTaskForm({ title: '', due_date: '', assigned_to: '' });
      await loadGroupData(selectedGroup.id);
    } catch (err: unknown) {
      toast((err as Error).message || 'Erreur lors de la création de la tâche', 'error');
    } finally {
      setAddingTask(false);
    }
  }

  async function handleUpdateTaskStatus(taskId: string, status: string) {
    try {
      const { error } = await supabase.from('group_tasks').update({ status }).eq('id', taskId);
      if (error) throw error;
      if (selectedGroup) await loadGroupData(selectedGroup.id);
    } catch (err: unknown) {
      toast((err as Error).message || 'Erreur', 'error');
    }
  }

  async function handleVotePoll(pollId: string, optionIndex: number) {
    if (!user) { toast('Connectez-vous pour voter', 'error'); return; }
    try {
      const { error } = await supabase.from('group_poll_votes').upsert(
        { poll_id: pollId, user_id: user.id, option_index: optionIndex },
        { onConflict: 'poll_id,user_id' }
      );
      if (error) throw error;
      if (selectedGroup) await loadGroupData(selectedGroup.id);
    } catch (err: unknown) {
      toast((err as Error).message || 'Erreur lors du vote', 'error');
    }
  }

  async function handleCreatePoll(e: React.FormEvent) {
    e.preventDefault();
    if (!user || !selectedGroup) { toast('Connectez-vous pour créer un sondage', 'error'); return; }
    if (!pollForm.question.trim()) { toast('La question est requise', 'error'); return; }
    const validOptions = pollForm.options.filter(o => o.trim());
    if (validOptions.length < 2) { toast('Minimum 2 options requises', 'error'); return; }
    setAddingPoll(true);
    try {
      const { error } = await supabase.from('group_polls').insert({
        group_id: selectedGroup.id,
        created_by: user.id,
        question: pollForm.question.trim(),
        options: validOptions,
        status: 'open',
      });
      if (error) throw error;
      toast('Sondage créé !', 'success');
      setShowPollModal(false);
      setPollForm({ question: '', options: ['', '', ''] });
      await loadGroupData(selectedGroup.id);
    } catch (err: unknown) {
      toast((err as Error).message || 'Erreur lors de la création du sondage', 'error');
    } finally {
      setAddingPoll(false);
    }
  }

  async function handleAiAnalysis() {
    if (!selectedGroup || !aiPrompt.trim()) return;
    const totalWeight = kitItems.reduce((s, i) => s + i.weight_grams * i.quantity, 0);
    const context = `Groupe: ${selectedGroup.name}, Destination: ${selectedGroup.destination}, Membres: ${members.length}, Kit total: ${formatWeight(totalWeight)}, Articles: ${kitItems.map(i => i.name).join(', ')}, Budget: ${selectedGroup.budget_target}€, Dépenses: ${expenses.reduce((s, e) => s + e.amount, 0)}€`;
    setAiResponse('');
    setAiAsked(true);
    sendAiMessage([
      { role: 'system', content: 'Tu es un expert en voyages d\'aventure et optimisation d\'équipement. Réponds en français de manière concise et pratique.' },
      { role: 'user', content: `Contexte du groupe: ${context}\n\nQuestion: ${aiPrompt}` }
    ], { temperature: 0.7, max_tokens: 800 });
  }

  async function handleGenerateConseils() {
    if (!selectedGroup) return;
    const totalWeight = kitItems.reduce((s, i) => s + i.weight_grams * i.quantity, 0);
    const tasksDoneCount = tasks.filter(t => t.status === 'done').length;
    const totalBudgetSpent = expenses.reduce((s, e) => s + e.amount, 0);
    const context = `
Groupe: ${selectedGroup.name}
Destination: ${selectedGroup.destination}
Thème: ${selectedGroup.theme}
Membres: ${members.length}
Kit total: ${formatWeight(totalWeight)} (${kitItems.length} articles)
Budget objectif: ${selectedGroup.budget_target}€, Dépensé: ${totalBudgetSpent.toFixed(0)}€
Tâches: ${tasksDoneCount}/${tasks.length} complétées
Score d'optimisation: ${selectedGroup.optimization_score}/100
${selectedGroup.departure_date ? `Départ: ${new Date(selectedGroup.departure_date).toLocaleDateString('fr-FR')}` : ''}
    `.trim();
    setAiConseils('');
    setConseilAsked(true);
    setLoadingConseils(true);
    sendConseilMessage([
      { role: 'system', content: 'Tu es un expert en voyages d\'aventure. Génère des conseils personnalisés, pratiques et actionnables pour ce groupe de voyage. Réponds en français avec des emojis pour rendre les conseils visuels et engageants. Structure ta réponse avec 4-5 conseils clés.' },
      { role: 'user', content: `Génère des conseils personnalisés pour notre groupe de voyage:\n\n${context}\n\nDonne-nous des conseils pratiques pour optimiser notre préparation, notre kit, notre budget et notre organisation.` }
    ], { temperature: 0.8, max_tokens: 600 });
    setLoadingConseils(false);
  }

  const totalBudget = expenses.reduce((s, e) => s + e.amount, 0);
  const totalKitWeight = kitItems.reduce((s, i) => s + i.weight_grams * i.quantity, 0);
  const tasksDone = tasks.filter(t => t.status === 'done').length;
  const isOrganizer = selectedGroup?.my_role === 'organizer' || selectedGroup?.my_role === 'co_organizer' || selectedGroup?.owner_id === user?.id;

  const GROUP_TABS = [
    { id: 'overview', label: 'Vue d\'ensemble', icon: 'HomeIcon' },
    { id: 'chat', label: 'Chat', icon: 'ChatBubbleLeftRightIcon' },
    { id: 'kit', label: 'Kit groupe', icon: 'ArchiveBoxIcon' },
    { id: 'budget', label: 'Budget', icon: 'BanknotesIcon' },
    { id: 'planning', label: 'Planning', icon: 'CalendarIcon' },
    { id: 'ai', label: 'IA Gemini', icon: 'SparklesIcon' },
  ];

  const inputCls = "w-full bg-white border border-[#C8C3B0] rounded-xl px-3 py-2.5 text-sm text-[#1C2620] focus:outline-none focus:ring-2 focus:ring-[#E4501C]/30 focus:border-[#E4501C]/40 transition-colors";
  const selectCls = inputCls;
  const labelCls = "block text-[10px] font-mono text-[#5C6B5E] uppercase tracking-[0.15em] mb-1.5";

  return (
    <div className="min-h-screen bg-[#F5F2E8]">
      <Header />

      {/* Hero */}
      <section className="bg-[#1C2620] pt-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex items-center gap-2 mb-3">
            <Link href="/groupes" className="text-white/40 hover:text-white/70 transition-colors text-xs font-mono tracking-widest uppercase flex items-center gap-1">
              <Icon name="ChevronLeftIcon" size={12} />
              Mes groupes
            </Link>
            <span className="text-white/20 text-xs">/</span>
            <span className="font-mono text-xs text-[#E4501C] tracking-widest uppercase">Espace groupe</span>
          </div>
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
            <div>
              <h1 className="font-display font-800 text-2xl md:text-3xl text-white tracking-tight">
                {selectedGroup ? selectedGroup.name : 'Mes groupes de voyage'}
              </h1>
              <p className="text-white/50 text-sm mt-1">Chat temps réel · Kit partagé · Budget commun · Planning collaboratif</p>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <input
                value={joinCode}
                onChange={e => setJoinCode(e.target.value.toUpperCase())}
                placeholder="Code d'invitation"
                className="bg-white/10 border border-white/20 rounded-xl px-3 py-2 text-sm text-white placeholder-white/40 focus:outline-none focus:border-[#E4501C]/60 w-36"
                onKeyDown={e => e.key === 'Enter' && handleJoinByCode()}
              />
              <button onClick={handleJoinByCode} disabled={joining} className="bg-white/10 hover:bg-white/20 border border-white/20 text-white text-sm px-3 py-2 rounded-xl transition-colors">
                {joining ? '...' : 'Rejoindre'}
              </button>
              <button onClick={() => setShowCreateModal(true)} className="flex items-center gap-2 bg-[#E4501C] hover:bg-[#E4501C]/90 text-white text-sm px-4 py-2 rounded-xl transition-colors font-600">
                <Icon name="PlusIcon" size={14} />
                Créer un groupe
              </button>
            </div>
          </div>
        </div>
      </section>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-8 h-8 border-2 border-[#E4501C] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <div className="flex gap-5">
            {/* Sidebar — hidden on mobile when group selected, shown as drawer */}
            <div className={`${selectedGroup ? 'hidden md:block' : 'block'} w-full md:w-60 flex-shrink-0 space-y-2`}>
              <div className="flex items-center justify-between mb-3">
                <p className="text-[10px] font-mono text-[#5C6B5E] uppercase tracking-wider">Mes groupes ({myGroups.length})</p>
                <Link href="/groupes" className="text-[10px] text-[#E4501C] hover:underline flex items-center gap-0.5">
                  <Icon name="ArrowTopRightOnSquareIcon" size={10} />
                  Gérer
                </Link>
              </div>
              {myGroups.length === 0 ? (
                <div className="bg-[#EDEAE0] border border-[#C8C3B0] rounded-2xl p-4 text-center">
                  <p className="text-3xl mb-2">🗺️</p>
                  <p className="text-sm text-[#5C6B5E] mb-3">Aucun groupe</p>
                  <button onClick={() => setShowCreateModal(true)} className="w-full py-2 bg-[#E4501C] text-white rounded-xl text-xs font-600 hover:bg-[#E4501C]/90 transition-colors">Créer</button>
                </div>
              ) : (
                myGroups.map(group => (
                  <button
                    key={group.id}
                    onClick={() => { setSelectedGroup(group); router.replace(`/groupe?group=${group.id}`, { scroll: false }); }}
                    className={`w-full text-left p-3 rounded-2xl border transition-all ${selectedGroup?.id === group.id ? 'border-[#E4501C]/40 bg-[#E4501C]/5' : 'border-[#C8C3B0] bg-[#EDEAE0] hover:border-[#E4501C]/30'}`}
                  >
                    <div className="flex items-center gap-2 mb-1.5">
                      <div className="w-8 h-8 rounded-xl bg-[#1C2620] flex items-center justify-center text-base flex-shrink-0">
                        {THEME_EMOJI[group.theme] || '🎒'}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-600 text-xs text-[#1C2620] truncate">{group.name}</p>
                        <p className="text-[10px] text-[#5C6B5E] truncate">{group.destination}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 flex-wrap">
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[#E7E3D6] text-[#5C6B5E]">{group.theme}</span>
                      {group.my_role && <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${roleColor(group.my_role)}`}>{roleLabel(group.my_role)}</span>}
                    </div>
                  </button>
                ))
              )}
              {/* Quick links */}
              <div className="pt-3 border-t border-[#C8C3B0] space-y-1.5">
                <Link href="/groupes?tab=decouvrir" className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs text-[#5C6B5E] hover:bg-[#EDEAE0] hover:text-[#1C2620] transition-colors">
                  <Icon name="MagnifyingGlassIcon" size={12} /> Découvrir des groupes
                </Link>
                <Link href="/communaute" className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs text-[#5C6B5E] hover:bg-[#EDEAE0] hover:text-[#1C2620] transition-colors">
                  <Icon name="UsersIcon" size={12} /> Communauté
                </Link>
                {user && (
                  <Link href={`/profil/${user.id}`} className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs text-[#5C6B5E] hover:bg-[#EDEAE0] hover:text-[#1C2620] transition-colors">
                    <Icon name="UserCircleIcon" size={12} /> Mon profil
                  </Link>
                )}
              </div>
            </div>

            {/* Main content */}
            {selectedGroup ? (
              <div className="flex-1 min-w-0">
                {/* Back button on mobile */}
                <button
                  onClick={() => setSelectedGroup(null)}
                  className="md:hidden flex items-center gap-2 text-sm text-[#5C6B5E] hover:text-[#1C2620] mb-3 transition-colors"
                >
                  <Icon name="ChevronLeftIcon" size={16} />
                  Mes groupes
                </button>
                {/* Group header */}
                <div className="bg-[#EDEAE0] border border-[#C8C3B0] rounded-2xl p-5 mb-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-4 flex-1">
                      <div className="w-14 h-14 rounded-2xl bg-[#1C2620] flex items-center justify-center text-3xl flex-shrink-0">
                        {THEME_EMOJI[selectedGroup.theme] || '🎒'}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <h2 className="font-display font-800 text-xl text-[#1C2620] tracking-tight">{selectedGroup.name}</h2>
                          <span className="text-xs px-2 py-0.5 rounded-full bg-[#E4501C]/10 text-[#E4501C] font-600">{selectedGroup.theme}</span>
                          <span className={`text-xs px-2 py-0.5 rounded-full font-600 ${selectedGroup.visibility === 'public' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                            {selectedGroup.visibility === 'public' ? '🌍 Public' : selectedGroup.visibility === 'private' ? '🔒 Privé' : '🔗 Sur invitation'}
                          </span>
                        </div>
                        {selectedGroup.description && <p className="text-sm text-[#5C6B5E] mb-2">{selectedGroup.description}</p>}
                        <div className="flex flex-wrap gap-3 text-xs text-[#5C6B5E]">
                          <span className="flex items-center gap-1"><Icon name="MapPinIcon" size={12} /> {selectedGroup.destination}</span>
                          {selectedGroup.departure_date && (
                            <span className="flex items-center gap-1">
                              <Icon name="CalendarIcon" size={12} />
                              {new Date(selectedGroup.departure_date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })}
                              {selectedGroup.return_date && ` → ${new Date(selectedGroup.return_date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })}`}
                            </span>
                          )}
                          <span className="flex items-center gap-1"><Icon name="UsersIcon" size={12} /> {members.length} / {selectedGroup.max_members} membres</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-2 flex-shrink-0">
                      <div className="text-center">
                        <div className="font-mono text-2xl font-700 text-[#E4501C]">{selectedGroup.optimization_score}</div>
                        <div className="text-[10px] text-[#5C6B5E]">Score /100</div>
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="text-amber-500">🏆</span>
                        <span className="text-xs text-[#5C6B5E]">Niv. {selectedGroup.group_level}</span>
                      </div>
                      <div className="text-xs font-mono text-[#5C6B5E]">
                        Code: <span className="text-[#1C2620] font-700 tracking-widest">{selectedGroup.invite_code}</span>
                      </div>
                      <div className="flex gap-1.5">
                        {isOrganizer && (
                          <button onClick={openEditModal} className="flex items-center gap-1.5 text-xs border border-[#C8C3B0] text-[#5C6B5E] px-2.5 py-1.5 rounded-xl hover:border-[#E4501C]/40 hover:text-[#E4501C] transition-colors">
                            <Icon name="PencilIcon" size={11} /> Modifier
                          </button>
                        )}
                        {user && selectedGroup.my_role && selectedGroup.my_role !== 'organizer' && (
                          <button onClick={handleLeaveGroup} className="flex items-center gap-1.5 text-xs border border-[#C8C3B0] text-[#5C6B5E] px-2.5 py-1.5 rounded-xl hover:border-red-300 hover:text-red-500 transition-colors">
                            <Icon name="ArrowRightOnRectangleIcon" size={11} /> Quitter
                          </button>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Quick stats */}
                  <div className="grid grid-cols-4 gap-3 mt-4 pt-4 border-t border-[#C8C3B0]">
                    {[
                      { label: 'Membres', value: members.length, icon: 'UsersIcon' },
                      { label: 'Kit total', value: formatWeight(totalKitWeight), icon: 'ArchiveBoxIcon' },
                      { label: 'Dépenses', value: `${totalBudget.toFixed(0)}€`, icon: 'BanknotesIcon' },
                      { label: 'Tâches', value: `${tasksDone}/${tasks.length}`, icon: 'CheckCircleIcon' },
                    ].map(stat => (
                      <div key={stat.label} className="text-center p-2.5 bg-white/60 rounded-xl border border-[#C8C3B0]/50">
                        <Icon name={stat.icon} size={16} className="text-[#E4501C] mx-auto mb-1" />
                        <div className="font-mono text-sm font-700 text-[#1C2620]">{stat.value}</div>
                        <div className="text-[10px] text-[#5C6B5E]">{stat.label}</div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Tabs */}
                <div className="flex gap-1 bg-[#EDEAE0] border border-[#C8C3B0] rounded-2xl p-1 mb-4 overflow-x-auto scrollbar-hide">
                  {GROUP_TABS.map(tab => (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id as typeof activeTab)}
                      className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-600 transition-all whitespace-nowrap ${activeTab === tab.id ? 'bg-[#E4501C] text-white shadow-sm' : 'text-[#5C6B5E] hover:text-[#1C2620]'}`}
                    >
                      <Icon name={tab.icon} size={13} />
                      {tab.label}
                    </button>
                  ))}
                </div>

                {/* TAB: OVERVIEW */}
                {activeTab === 'overview' && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Members */}
                    <div className="bg-[#EDEAE0] border border-[#C8C3B0] rounded-2xl p-4">
                      <h3 className="font-display font-700 text-sm text-[#1C2620] mb-3">Membres ({members.length})</h3>
                      <div className="space-y-2">
                        {members.map(m => (
                          <div key={m.id} className="flex items-center gap-2 p-2 bg-white/60 rounded-xl border border-[#C8C3B0]/50">
                            <Link href={`/profil/${m.user_id}`} className="w-8 h-8 rounded-xl bg-[#E4501C]/20 flex items-center justify-center text-xs font-700 text-[#E4501C] flex-shrink-0 hover:bg-[#E4501C]/30 transition-colors">
                              {m.user_profiles?.full_name?.charAt(0)?.toUpperCase() || '?'}
                            </Link>
                            <div className="flex-1 min-w-0">
                              <Link href={`/profil/${m.user_id}`} className="text-xs font-600 text-[#1C2620] hover:text-[#E4501C] transition-colors truncate block">{m.user_profiles?.full_name || 'Membre'}</Link>
                              <div className="text-[10px] text-[#5C6B5E]">{formatWeight(m.weight_capacity)} capacité</div>
                            </div>
                            <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-600 ${roleColor(m.role)}`}>{roleLabel(m.role)}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Recent tasks */}
                    <div className="bg-[#EDEAE0] border border-[#C8C3B0] rounded-2xl p-4">
                      <div className="flex items-center justify-between mb-3">
                        <h3 className="font-display font-700 text-sm text-[#1C2620]">Tâches récentes</h3>
                        <button onClick={() => setActiveTab('planning')} className="text-xs text-[#E4501C] hover:underline">Voir tout</button>
                      </div>
                      <div className="space-y-2">
                        {tasks.slice(0, 4).map(task => (
                          <div key={task.id} className="flex items-center gap-2 p-2 bg-white/60 rounded-xl border border-[#C8C3B0]/50">
                            <button onClick={() => handleUpdateTaskStatus(task.id, task.status === 'done' ? 'todo' : 'done')} className="flex-shrink-0">
                              <Icon name={task.status === 'done' ? 'CheckCircleIcon' : 'CircleStackIcon'} size={16} className={task.status === 'done' ? 'text-emerald-500' : 'text-[#5C6B5E]'} variant={task.status === 'done' ? 'solid' : 'outline'} />
                            </button>
                            <span className={`text-xs flex-1 ${task.status === 'done' ? 'line-through text-[#5C6B5E]' : 'text-[#1C2620]'}`}>{task.title}</span>
                            {task.due_date && <span className="text-[10px] text-[#5C6B5E]">{new Date(task.due_date).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })}</span>}
                          </div>
                        ))}
                        {tasks.length === 0 && <p className="text-xs text-[#5C6B5E] text-center py-2">Aucune tâche</p>}
                      </div>
                    </div>

                    {/* Active polls */}
                    <div className="bg-[#EDEAE0] border border-[#C8C3B0] rounded-2xl p-4">
                      <div className="flex items-center justify-between mb-3">
                        <h3 className="font-display font-700 text-sm text-[#1C2620]">Sondages actifs</h3>
                        <button onClick={() => setShowPollModal(true)} className="text-xs text-[#E4501C] hover:underline">+ Créer</button>
                      </div>
                      {polls.filter(p => p.status === 'open').slice(0, 2).map(poll => {
                        const totalVotes = (poll.votes || []).reduce((s, v) => s + v.count, 0);
                        return (
                          <div key={poll.id} className="mb-3 p-3 bg-white/60 rounded-xl border border-[#C8C3B0]/50">
                            <p className="text-xs font-600 text-[#1C2620] mb-2">{poll.question}</p>
                            <div className="space-y-1.5">
                              {(poll.options as string[]).map((opt, i) => {
                                const voteCount = poll.votes?.find(v => v.option_index === i)?.count || 0;
                                const pct = totalVotes > 0 ? Math.round((voteCount / totalVotes) * 100) : 0;
                                const isMyVote = poll.my_vote === i;
                                return (
                                  <button key={i} onClick={() => handleVotePoll(poll.id, i)} className={`w-full text-left p-2 rounded-xl border transition-all text-xs ${isMyVote ? 'border-[#E4501C]/40 bg-[#E4501C]/5' : 'border-[#C8C3B0] hover:border-[#E4501C]/30'}`}>
                                    <div className="flex justify-between mb-1">
                                      <span className={isMyVote ? 'text-[#E4501C] font-600' : 'text-[#1C2620]'}>{opt}</span>
                                      <span className="text-[#5C6B5E]">{pct}%</span>
                                    </div>
                                    <div className="h-1 bg-[#C8C3B0]/40 rounded-full overflow-hidden">
                                      <div className="h-full bg-[#E4501C] rounded-full transition-all" style={{ width: `${pct}%` }} />
                                    </div>
                                  </button>
                                );
                              })}
                            </div>
                            <p className="text-[10px] text-[#5C6B5E] mt-1">{totalVotes} vote{totalVotes !== 1 ? 's' : ''}</p>
                          </div>
                        );
                      })}
                      {polls.filter(p => p.status === 'open').length === 0 && <p className="text-xs text-[#5C6B5E] text-center py-2">Aucun sondage actif</p>}
                    </div>

                    {/* Budget summary */}
                    <div className="bg-[#EDEAE0] border border-[#C8C3B0] rounded-2xl p-4">
                      <div className="flex items-center justify-between mb-3">
                        <h3 className="font-display font-700 text-sm text-[#1C2620]">Budget</h3>
                        <button onClick={() => setActiveTab('budget')} className="text-xs text-[#E4501C] hover:underline">Voir tout</button>
                      </div>
                      <div className="mb-3">
                        <div className="flex justify-between text-xs mb-1">
                          <span className="text-[#5C6B5E]">Dépensé</span>
                          <span className="font-mono font-700 text-[#1C2620]">{totalBudget.toFixed(0)}€ / {selectedGroup.budget_target}€</span>
                        </div>
                        <div className="h-2 bg-[#C8C3B0]/40 rounded-full overflow-hidden">
                          <div className="h-full bg-[#E4501C] rounded-full transition-all" style={{ width: `${Math.min((totalBudget / (selectedGroup.budget_target || 1)) * 100, 100)}%` }} />
                        </div>
                      </div>
                      {expenses.slice(0, 3).map(exp => (
                        <div key={exp.id} className="flex items-center justify-between py-1.5 border-b border-[#C8C3B0]/50 last:border-0">
                          <div>
                            <span className="text-xs text-[#1C2620]">{exp.title}</span>
                            <span className="text-[10px] text-[#5C6B5E] ml-2">{exp.category}</span>
                          </div>
                          <span className="font-mono text-xs font-700 text-[#1C2620]">{exp.amount.toFixed(0)}€</span>
                        </div>
                      ))}
                      {expenses.length === 0 && <p className="text-xs text-[#5C6B5E] text-center py-2">Aucune dépense</p>}
                    </div>
                  </div>
                )}

                {/* TAB: CHAT */}
                {activeTab === 'chat' && (
                  <div className="bg-[#EDEAE0] border border-[#C8C3B0] rounded-2xl flex flex-col" style={{ height: '520px' }}>
                    <div className="flex items-center gap-2 p-4 border-b border-[#C8C3B0]">
                      <Icon name="ChatBubbleLeftRightIcon" size={16} className="text-[#E4501C]" />
                      <span className="font-display font-700 text-sm text-[#1C2620]">Chat du groupe</span>
                      <span className="text-xs text-[#5C6B5E] ml-auto">{members.length} membres</span>
                    </div>
                    <div className="flex-1 overflow-y-auto p-4 space-y-3">
                      {messages.map(msg => {
                        const isMe = msg.user_id === user?.id;
                        return (
                          <div key={msg.id} className={`flex gap-2 ${isMe ? 'flex-row-reverse' : ''}`}>
                            <Link href={`/profil/${msg.user_id}`} className="w-7 h-7 rounded-xl bg-[#E4501C]/20 flex items-center justify-center text-xs font-700 text-[#E4501C] flex-shrink-0 hover:bg-[#E4501C]/30 transition-colors">
                              {msg.user_profiles?.full_name?.charAt(0)?.toUpperCase() || '?'}
                            </Link>
                            <div className={`max-w-xs flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                              {!isMe && <span className="text-[10px] text-[#5C6B5E] mb-0.5">{msg.user_profiles?.full_name}</span>}
                              <div className={`px-3 py-2 rounded-2xl text-xs ${isMe ? 'bg-[#E4501C] text-white rounded-tr-sm' : 'bg-white border border-[#C8C3B0] text-[#1C2620] rounded-tl-sm'}`}>
                                {msg.content}
                              </div>
                              <span className="text-[10px] text-[#5C6B5E] mt-0.5">{timeAgo(msg.created_at)}</span>
                            </div>
                          </div>
                        );
                      })}
                      {messages.length === 0 && (
                        <div className="flex items-center justify-center h-full">
                          <div className="text-center">
                            <p className="text-3xl mb-2">💬</p>
                            <p className="text-sm text-[#5C6B5E]">Soyez le premier à écrire !</p>
                          </div>
                        </div>
                      )}
                      <div ref={messagesEndRef} />
                    </div>
                    {!user && (
                      <div className="p-4 border-t border-[#C8C3B0] bg-amber-50">
                        <p className="text-xs text-amber-700 text-center">
                          <Link href="/connexion" className="font-600 underline">Connectez-vous</Link> pour participer au chat
                        </p>
                      </div>
                    )}
                    {user && (
                      <form onSubmit={handleSendMessage} className="p-4 border-t border-[#C8C3B0] flex gap-2">
                        <input
                          value={newMessage}
                          onChange={e => setNewMessage(e.target.value)}
                          placeholder="Écrire un message..."
                          disabled={sendingMsg}
                          className="flex-1 bg-white border border-[#C8C3B0] rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#E4501C]/30 transition-colors"
                        />
                        <button type="submit" disabled={sendingMsg || !newMessage.trim()} className="bg-[#E4501C] hover:bg-[#E4501C]/90 text-white px-4 py-2 rounded-xl transition-colors disabled:opacity-50">
                          {sendingMsg ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Icon name="PaperAirplaneIcon" size={14} />}
                        </button>
                      </form>
                    )}
                  </div>
                )}

                {/* TAB: KIT */}
                {activeTab === 'kit' && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="font-display font-700 text-base text-[#1C2620]">Kit collectif du groupe</h3>
                        <p className="text-xs text-[#5C6B5E]">Poids total: <span className="font-mono font-700 text-[#1C2620]">{formatWeight(totalKitWeight)}</span> · {kitItems.length} articles</p>
                      </div>
                      <button onClick={() => setShowKitModal(true)} className="flex items-center gap-2 bg-[#E4501C] hover:bg-[#E4501C]/90 text-white text-sm px-3 py-2 rounded-xl transition-colors font-600">
                        <Icon name="PlusIcon" size={13} /> Ajouter
                      </button>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {members.map(m => {
                        const memberItems = kitItems.filter(i => i.assigned_to === m.user_id);
                        const memberWeight = memberItems.reduce((s, i) => s + i.weight_grams * i.quantity, 0);
                        const pct = m.weight_capacity > 0 ? Math.min((memberWeight / m.weight_capacity) * 100, 100) : 0;
                        return (
                          <div key={m.id} className="bg-[#EDEAE0] border border-[#C8C3B0] rounded-2xl p-3">
                            <div className="flex items-center gap-2 mb-2">
                              <Link href={`/profil/${m.user_id}`} className="w-7 h-7 rounded-xl bg-[#E4501C]/20 flex items-center justify-center text-xs font-700 text-[#E4501C] hover:bg-[#E4501C]/30 transition-colors">{m.user_profiles?.full_name?.charAt(0) || '?'}</Link>
                              <div className="flex-1">
                                <Link href={`/profil/${m.user_id}`} className="text-xs font-600 text-[#1C2620] hover:text-[#E4501C] transition-colors">{m.user_profiles?.full_name || 'Membre'}</Link>
                                <div className="text-[10px] text-[#5C6B5E]">{formatWeight(memberWeight)} / {formatWeight(m.weight_capacity)}</div>
                              </div>
                              <span className={`text-[10px] font-600 ${pct > 90 ? 'text-red-500' : pct > 75 ? 'text-amber-500' : 'text-emerald-600'}`}>{Math.round(pct)}%</span>
                            </div>
                            <div className="h-1.5 bg-[#C8C3B0]/40 rounded-full overflow-hidden">
                              <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: pct > 90 ? '#ef4444' : pct > 75 ? '#f59e0b' : '#E4501C' }} />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    <div className="bg-[#EDEAE0] border border-[#C8C3B0] rounded-2xl overflow-hidden">
                      <table className="w-full text-sm">
                        <thead className="bg-[#1C2620]">
                          <tr>
                            {['Article', 'Catégorie', 'Poids', 'Qté', 'Assigné à'].map(h => (
                              <th key={h} className="text-left text-[10px] font-mono text-white/60 uppercase tracking-wider px-4 py-3">{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#C8C3B0]/50">
                          {kitItems.map(item => {
                            const member = members.find(m => m.user_id === item.assigned_to);
                            return (
                              <tr key={item.id} className="hover:bg-white/30 transition-colors">
                                <td className="px-4 py-2.5 font-600 text-xs text-[#1C2620]">{item.name}</td>
                                <td className="px-4 py-2.5"><span className="text-[10px] px-2 py-0.5 rounded-full bg-[#E7E3D6] text-[#5C6B5E]">{item.category}</span></td>
                                <td className="px-4 py-2.5 font-mono text-xs text-[#5C6B5E]">{formatWeight(item.weight_grams)}</td>
                                <td className="px-4 py-2.5 font-mono text-xs text-[#1C2620]">×{item.quantity}</td>
                                <td className="px-4 py-2.5 text-xs text-[#5C6B5E]">{member?.user_profiles?.full_name || '—'}</td>
                              </tr>
                            );
                          })}
                          {kitItems.length === 0 && <tr><td colSpan={5} className="px-4 py-6 text-center text-sm text-[#5C6B5E]">Aucun article dans le kit</td></tr>}
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
                        <h3 className="font-display font-700 text-base text-[#1C2620]">Budget partagé</h3>
                        <p className="text-xs text-[#5C6B5E]">Objectif: <span className="font-mono font-700 text-[#1C2620]">{selectedGroup.budget_target}€</span></p>
                      </div>
                      <button onClick={() => setShowExpenseModal(true)} className="flex items-center gap-2 bg-[#E4501C] hover:bg-[#E4501C]/90 text-white text-sm px-3 py-2 rounded-xl transition-colors font-600">
                        <Icon name="PlusIcon" size={13} /> Dépense
                      </button>
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                      {[
                        { label: 'Dépensé', value: `${totalBudget.toFixed(0)}€`, color: 'text-[#1C2620]' },
                        { label: 'Restant', value: `${Math.max(0, selectedGroup.budget_target - totalBudget).toFixed(0)}€`, color: 'text-emerald-600' },
                        { label: 'Par membre', value: `${members.length > 0 ? (totalBudget / members.length).toFixed(0) : '0'}€`, color: 'text-blue-600' },
                      ].map(stat => (
                        <div key={stat.label} className="bg-[#EDEAE0] border border-[#C8C3B0] rounded-2xl p-3 text-center">
                          <div className={`font-mono text-xl font-700 ${stat.color}`}>{stat.value}</div>
                          <div className="text-xs text-[#5C6B5E]">{stat.label}</div>
                        </div>
                      ))}
                    </div>
                    <div className="bg-[#EDEAE0] border border-[#C8C3B0] rounded-2xl p-4">
                      <div className="flex justify-between text-xs mb-2">
                        <span className="text-[#5C6B5E]">Progression du budget</span>
                        <span className="font-mono font-700 text-[#1C2620]">{Math.round((totalBudget / (selectedGroup.budget_target || 1)) * 100)}%</span>
                      </div>
                      <div className="h-3 bg-[#C8C3B0]/40 rounded-full overflow-hidden">
                        <div className="h-full bg-[#E4501C] rounded-full transition-all" style={{ width: `${Math.min((totalBudget / (selectedGroup.budget_target || 1)) * 100, 100)}%` }} />
                      </div>
                    </div>
                    <div className="bg-[#EDEAE0] border border-[#C8C3B0] rounded-2xl overflow-hidden">
                      <div className="p-4 border-b border-[#C8C3B0]">
                        <h4 className="font-display font-700 text-sm text-[#1C2620]">Historique des dépenses</h4>
                      </div>
                      <div className="divide-y divide-[#C8C3B0]/50">
                        {expenses.map(exp => (
                          <div key={exp.id} className="flex items-center gap-3 px-4 py-3">
                            <div className="w-8 h-8 rounded-xl bg-[#E7E3D6] flex items-center justify-center flex-shrink-0">
                              <Icon name="BanknotesIcon" size={14} className="text-[#5C6B5E]" />
                            </div>
                            <div className="flex-1">
                              <div className="text-sm font-600 text-[#1C2620]">{exp.title}</div>
                              <div className="text-xs text-[#5C6B5E]">{exp.category} · Payé par {exp.user_profiles?.full_name || 'Inconnu'}</div>
                            </div>
                            <div className="text-right">
                              <div className="font-mono font-700 text-[#1C2620] text-sm">{exp.amount.toFixed(0)}€</div>
                              <div className={`text-[10px] ${exp.status === 'settled' ? 'text-emerald-600' : 'text-amber-600'}`}>{exp.status === 'settled' ? 'Réglé' : 'En attente'}</div>
                            </div>
                          </div>
                        ))}
                        {expenses.length === 0 && <div className="px-4 py-6 text-center text-sm text-[#5C6B5E]">Aucune dépense enregistrée</div>}
                      </div>
                    </div>
                  </div>
                )}

                {/* TAB: PLANNING */}
                {activeTab === 'planning' && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="font-display font-700 text-base text-[#1C2620]">Checklist & Planification</h3>
                      <div className="flex gap-2">
                        <button onClick={() => setShowPollModal(true)} className="flex items-center gap-1.5 border border-[#C8C3B0] text-[#5C6B5E] py-2 px-3 text-xs rounded-xl hover:border-[#E4501C]/40 hover:text-[#E4501C] transition-colors">
                          <Icon name="ChartBarIcon" size={12} /> Sondage
                        </button>
                        <button onClick={() => setShowTaskModal(true)} className="flex items-center gap-2 bg-[#E4501C] hover:bg-[#E4501C]/90 text-white text-sm px-3 py-2 rounded-xl transition-colors font-600">
                          <Icon name="PlusIcon" size={13} /> Tâche
                        </button>
                      </div>
                    </div>
                    <div className="bg-[#EDEAE0] border border-[#C8C3B0] rounded-2xl p-4">
                      <div className="flex justify-between text-xs mb-2">
                        <span className="text-[#5C6B5E]">Avancement</span>
                        <span className="font-mono font-700 text-[#1C2620]">{tasksDone}/{tasks.length} tâches</span>
                      </div>
                      <div className="h-2 bg-[#C8C3B0]/40 rounded-full overflow-hidden">
                        <div className="h-full bg-emerald-500 rounded-full transition-all" style={{ width: tasks.length > 0 ? `${(tasksDone / tasks.length) * 100}%` : '0%' }} />
                      </div>
                    </div>
                    {(['todo', 'in_progress', 'done'] as const).map(status => {
                      const statusTasks = tasks.filter(t => t.status === status);
                      const statusLabels = { todo: 'À faire', in_progress: 'En cours', done: 'Terminé' };
                      const statusColors = { todo: 'text-[#5C6B5E]', in_progress: 'text-amber-600', done: 'text-emerald-600' };
                      return (
                        <div key={status} className="bg-[#EDEAE0] border border-[#C8C3B0] rounded-2xl p-4">
                          <h4 className={`font-display font-700 text-sm mb-3 ${statusColors[status]}`}>{statusLabels[status]} ({statusTasks.length})</h4>
                          <div className="space-y-2">
                            {statusTasks.map(task => (
                              <div key={task.id} className="flex items-center gap-2 p-2 bg-white/60 rounded-xl border border-[#C8C3B0]/50">
                                <button onClick={() => { const next = status === 'todo' ? 'in_progress' : status === 'in_progress' ? 'done' : 'todo'; handleUpdateTaskStatus(task.id, next); }}>
                                  <Icon name={status === 'done' ? 'CheckCircleIcon' : 'ArrowRightCircleIcon'} size={16} className={status === 'done' ? 'text-emerald-500' : 'text-[#5C6B5E] hover:text-[#E4501C]'} variant={status === 'done' ? 'solid' : 'outline'} />
                                </button>
                                <span className={`text-xs flex-1 ${status === 'done' ? 'line-through text-[#5C6B5E]' : 'text-[#1C2620]'}`}>{task.title}</span>
                                {task.user_profiles && <span className="text-[10px] text-[#5C6B5E]">{task.user_profiles.full_name}</span>}
                                {task.due_date && <span className="text-[10px] text-[#5C6B5E]">{new Date(task.due_date).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })}</span>}
                              </div>
                            ))}
                            {statusTasks.length === 0 && <p className="text-xs text-[#5C6B5E] text-center py-1">Aucune tâche</p>}
                          </div>
                        </div>
                      );
                    })}
                    {polls.length > 0 && (
                      <div className="bg-[#EDEAE0] border border-[#C8C3B0] rounded-2xl p-4">
                        <h4 className="font-display font-700 text-sm text-[#1C2620] mb-3">Sondages du groupe</h4>
                        <div className="space-y-3">
                          {polls.map(poll => {
                            const totalVotes = (poll.votes || []).reduce((s, v) => s + v.count, 0);
                            return (
                              <div key={poll.id} className="p-3 bg-white/60 rounded-xl border border-[#C8C3B0]/50">
                                <div className="flex items-center justify-between mb-2">
                                  <p className="text-xs font-600 text-[#1C2620]">{poll.question}</p>
                                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${poll.status === 'open' ? 'bg-emerald-100 text-emerald-700' : 'bg-[#E7E3D6] text-[#5C6B5E]'}`}>{poll.status === 'open' ? 'Ouvert' : 'Fermé'}</span>
                                </div>
                                <div className="space-y-1.5">
                                  {(poll.options as string[]).map((opt, i) => {
                                    const voteCount = poll.votes?.find(v => v.option_index === i)?.count || 0;
                                    const pct = totalVotes > 0 ? Math.round((voteCount / totalVotes) * 100) : 0;
                                    const isMyVote = poll.my_vote === i;
                                    return (
                                      <button key={i} onClick={() => poll.status === 'open' && handleVotePoll(poll.id, i)} className={`w-full text-left p-2 rounded-xl border transition-all text-xs ${isMyVote ? 'border-[#E4501C]/40 bg-[#E4501C]/5' : 'border-[#C8C3B0] hover:border-[#E4501C]/30'}`}>
                                        <div className="flex justify-between mb-1">
                                          <span className={isMyVote ? 'text-[#E4501C] font-600' : 'text-[#1C2620]'}>{opt}</span>
                                          <span className="text-[#5C6B5E]">{voteCount} ({pct}%)</span>
                                        </div>
                                        <div className="h-1 bg-[#C8C3B0]/40 rounded-full overflow-hidden">
                                          <div className="h-full bg-[#E4501C] rounded-full" style={{ width: `${pct}%` }} />
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
                    {/* AI Conseils Section */}
                    <div className="bg-gradient-to-br from-[#1C2620] to-[#2A3830] rounded-2xl p-5 border border-white/10">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-xl bg-[#E4501C]/20 flex items-center justify-center">
                            <Icon name="LightBulbIcon" size={16} className="text-[#E4501C]" />
                          </div>
                          <div>
                            <h3 className="font-display font-700 text-base text-white">Conseils IA pour votre groupe</h3>
                            <p className="text-xs text-white/40">Générés par Gemini selon votre contexte</p>
                          </div>
                        </div>
                        <button
                          onClick={handleGenerateConseils}
                          disabled={conseilLoading || loadingConseils}
                          className="flex items-center gap-2 bg-[#E4501C] hover:bg-[#E4501C]/90 text-white py-2 px-4 rounded-xl text-xs font-600 transition-colors disabled:opacity-50"
                        >
                          {(conseilLoading || loadingConseils) ? (
                            <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          ) : (
                            <Icon name="SparklesIcon" size={13} />
                          )}
                          {(conseilLoading || loadingConseils) ? 'Génération...' : 'Générer des conseils'}
                        </button>
                      </div>
                      {(conseilLoading || loadingConseils) && !aiConseils && (
                        <div className="flex items-center gap-3 py-4">
                          <div className="w-5 h-5 border-2 border-[#E4501C] border-t-transparent rounded-full animate-spin flex-shrink-0" />
                          <p className="text-sm text-white/60 animate-pulse">Gemini analyse votre groupe et génère des conseils personnalisés...</p>
                        </div>
                      )}
                      {aiConseils ? (
                        <div className="bg-white/5 rounded-xl p-4 border border-white/10">
                          <div className="text-sm text-white/90 leading-relaxed whitespace-pre-wrap">{aiConseils}</div>
                          {(conseilLoading) && (
                            <span className="inline-block w-1.5 h-4 bg-[#E4501C] animate-pulse ml-1 rounded-sm" />
                          )}
                        </div>
                      ) : !conseilLoading && !loadingConseils && (
                        <div className="text-center py-6">
                          <p className="text-sm text-white/40">Cliquez sur &quot;Générer des conseils&quot; pour obtenir des recommandations IA personnalisées pour votre groupe.</p>
                        </div>
                      )}
                    </div>

                    {/* AI Chat Section */}
                    <div className="bg-[#1C2620] rounded-2xl p-5">
                      <div className="flex items-center gap-2 mb-3">
                        <Icon name="SparklesIcon" size={18} className="text-[#E4501C]" />
                        <h3 className="font-display font-700 text-base text-white">Assistant IA Gemini pour votre groupe</h3>
                      </div>
                      <p className="text-sm text-white/50 mb-4">Analysez votre kit, obtenez des recommandations d&apos;itinéraire, optimisez votre budget et évaluez la compatibilité de votre équipe.</p>
                      <div className="flex flex-wrap gap-2 mb-4">
                        {['Optimise la répartition du kit', 'Analyse les risques du voyage', 'Suggère un itinéraire détaillé', 'Évalue la compatibilité du groupe', 'Calcule le budget optimal'].map(prompt => (
                          <button key={prompt} onClick={() => setAiPrompt(prompt)} className="text-xs px-3 py-1.5 rounded-full border border-white/20 text-white/70 hover:border-[#E4501C]/60 hover:text-white transition-colors">
                            {prompt}
                          </button>
                        ))}
                      </div>
                      <div className="flex gap-2">
                        <input
                          value={aiPrompt}
                          onChange={e => setAiPrompt(e.target.value)}
                          placeholder="Posez une question sur votre groupe..."
                          className="flex-1 bg-white/10 border border-white/20 rounded-xl px-3 py-2.5 text-sm text-white placeholder-white/40 focus:outline-none focus:border-[#E4501C]/60 transition-colors"
                          onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleAiAnalysis()}
                        />
                        <button onClick={handleAiAnalysis} disabled={aiLoading || !aiPrompt.trim()} className="flex items-center gap-2 bg-[#E4501C] hover:bg-[#E4501C]/90 text-white py-2.5 px-4 rounded-xl text-sm font-600 transition-colors disabled:opacity-50">
                          {aiLoading ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Icon name="SparklesIcon" size={14} />}
                          {aiLoading ? 'Analyse...' : 'Analyser'}
                        </button>
                      </div>
                    </div>

                    {/* AI Response */}
                    {(aiResponse || aiLoading) && (
                      <div className="bg-[#EDEAE0] border border-[#C8C3B0] rounded-2xl p-5">
                        <div className="flex items-center gap-2 mb-3">
                          <Icon name="SparklesIcon" size={14} className="text-[#E4501C]" />
                          <span className="font-display font-700 text-sm text-[#1C2620]">Analyse Gemini</span>
                          {aiLoading && <div className="w-3 h-3 border-2 border-[#E4501C] border-t-transparent rounded-full animate-spin ml-auto" />}
                        </div>
                        {aiLoading && !aiResponse && (
                          <div className="flex items-center gap-2 py-2">
                            <div className="w-4 h-4 border-2 border-[#E4501C] border-t-transparent rounded-full animate-spin flex-shrink-0" />
                            <p className="text-sm text-[#5C6B5E] animate-pulse">Gemini analyse votre groupe...</p>
                          </div>
                        )}
                        {aiResponse && (
                          <div className="text-sm text-[#1C2620] leading-relaxed whitespace-pre-wrap">
                            {aiResponse}
                            {aiLoading && <span className="inline-block w-1.5 h-4 bg-[#E4501C] animate-pulse ml-1 rounded-sm" />}
                          </div>
                        )}
                      </div>
                    )}

                    <div className="grid grid-cols-2 gap-3">
                      <div className="bg-[#EDEAE0] border border-[#C8C3B0] rounded-2xl p-4">
                        <h4 className="font-display font-700 text-xs text-[#5C6B5E] mb-2 uppercase tracking-wider">Contexte groupe</h4>
                        <div className="space-y-1.5 text-xs">
                          {[
                            { label: 'Destination', value: selectedGroup.destination },
                            { label: 'Membres', value: members.length },
                            { label: 'Kit total', value: formatWeight(totalKitWeight) },
                            { label: 'Budget', value: `${selectedGroup.budget_target}€` },
                            { label: 'Score optim.', value: `${selectedGroup.optimization_score}/100` },
                          ].map(item => (
                            <div key={item.label} className="flex justify-between">
                              <span className="text-[#5C6B5E]">{item.label}</span>
                              <span className="font-600 text-[#1C2620]">{item.value}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                      <div className="bg-[#EDEAE0] border border-[#C8C3B0] rounded-2xl p-4">
                        <h4 className="font-display font-700 text-xs text-[#5C6B5E] mb-2 uppercase tracking-wider">Gamification</h4>
                        <div className="text-center py-2">
                          <div className="font-mono text-3xl font-700 text-[#E4501C] mb-1">Niv. {selectedGroup.group_level}</div>
                          <div className="text-xs text-[#5C6B5E] mb-2">{selectedGroup.group_xp} XP</div>
                          <div className="h-2 bg-[#C8C3B0]/40 rounded-full overflow-hidden">
                            <div className="h-full bg-[#E4501C] rounded-full" style={{ width: `${(selectedGroup.group_xp % 1000) / 10}%` }} />
                          </div>
                          <div className="text-[10px] text-[#5C6B5E] mt-1">{1000 - (selectedGroup.group_xp % 1000)} XP pour le niveau suivant</div>
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
                  <p className="text-6xl mb-4">🗺️</p>
                  <h3 className="font-display font-700 text-lg text-[#1C2620] mb-2">Aucun groupe sélectionné</h3>
                  <p className="text-sm text-[#5C6B5E] mb-4">Créez un groupe ou rejoignez-en un avec un code d&apos;invitation</p>
                  <div className="flex gap-3 justify-center">
                    <button onClick={() => setShowCreateModal(true)} className="flex items-center gap-2 bg-[#E4501C] hover:bg-[#E4501C]/90 text-white px-4 py-2.5 rounded-xl text-sm font-600 transition-colors">
                      <Icon name="PlusIcon" size={14} /> Créer un groupe
                    </button>
                    <Link href="/groupes?tab=decouvrir" className="flex items-center gap-2 border border-[#C8C3B0] text-[#5C6B5E] px-4 py-2.5 rounded-xl text-sm font-600 hover:text-[#1C2620] transition-colors">
                      <Icon name="MagnifyingGlassIcon" size={14} /> Découvrir
                    </Link>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* MODALS */}
      {/* Edit Group Modal */}
      {showEditModal && selectedGroup && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#EDEAE0] border border-[#C8C3B0] rounded-2xl w-full max-w-lg p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-5">
              <h3 className="font-display font-700 text-lg text-[#1C2620]">Modifier le groupe</h3>
              <button onClick={() => setShowEditModal(false)} className="p-2 rounded-xl hover:bg-[#C8C3B0]/40 transition-colors"><Icon name="XMarkIcon" size={18} /></button>
            </div>
            {selectedGroup.invite_code && (
              <div className="mb-4 p-3 bg-[#E4501C]/5 border border-[#E4501C]/20 rounded-xl flex items-center gap-3">
                <Icon name="LinkIcon" size={14} className="text-[#E4501C] flex-shrink-0" />
                <div>
                  <p className="text-[10px] font-mono text-[#5C6B5E] uppercase tracking-wider">Code d&apos;invitation</p>
                  <p className="font-mono font-700 text-[#E4501C] text-sm tracking-widest">{selectedGroup.invite_code}</p>
                </div>
              </div>
            )}
            <form onSubmit={handleEditGroup} className="space-y-4">
              <div><label className={labelCls}>Nom du groupe *</label><input required value={editForm.name} onChange={e => setEditForm({ ...editForm, name: e.target.value })} className={inputCls} /></div>
              <div><label className={labelCls}>Destination *</label><input required value={editForm.destination} onChange={e => setEditForm({ ...editForm, destination: e.target.value })} className={inputCls} /></div>
              <div><label className={labelCls}>Description</label><textarea value={editForm.description} onChange={e => setEditForm({ ...editForm, description: e.target.value })} rows={2} className={`${inputCls} resize-none`} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className={labelCls}>Thème</label><select value={editForm.theme} onChange={e => setEditForm({ ...editForm, theme: e.target.value })} className={selectCls}>{THEMES.map(t => <option key={t}>{t}</option>)}</select></div>
                <div><label className={labelCls}>Visibilité</label><select value={editForm.visibility} onChange={e => setEditForm({ ...editForm, visibility: e.target.value })} className={selectCls}><option value="public">🌍 Public</option><option value="private">🔒 Privé</option><option value="invite_only">🔗 Sur invitation</option></select></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className={labelCls}>Départ</label><input type="date" value={editForm.departure_date} onChange={e => setEditForm({ ...editForm, departure_date: e.target.value })} className={inputCls} /></div>
                <div><label className={labelCls}>Retour</label><input type="date" value={editForm.return_date} onChange={e => setEditForm({ ...editForm, return_date: e.target.value })} className={inputCls} /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className={labelCls}>Budget (€)</label><input type="number" value={editForm.budget_target} onChange={e => setEditForm({ ...editForm, budget_target: e.target.value })} className={inputCls} /></div>
                <div><label className={labelCls}>Max membres</label><input type="number" min={2} max={50} value={editForm.max_members} onChange={e => setEditForm({ ...editForm, max_members: e.target.value })} className={inputCls} /></div>
              </div>
              <button type="submit" className="w-full py-3 bg-[#E4501C] hover:bg-[#E4501C]/90 text-white rounded-xl font-700 transition-colors">Enregistrer</button>
            </form>
          </div>
        </div>
      )}

      {/* Create Group Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#EDEAE0] border border-[#C8C3B0] rounded-2xl w-full max-w-lg p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-5">
              <h3 className="font-display font-700 text-lg text-[#1C2620]">Créer un groupe de voyage</h3>
              <button onClick={() => setShowCreateModal(false)} className="p-2 rounded-xl hover:bg-[#C8C3B0]/40 transition-colors"><Icon name="XMarkIcon" size={18} /></button>
            </div>
            <form onSubmit={handleCreateGroup} className="space-y-4">
              <div><label className={labelCls}>Nom du groupe *</label><input required value={createForm.name} onChange={e => setCreateForm({ ...createForm, name: e.target.value })} className={inputCls} placeholder="Trek Himalaya 2026" /></div>
              <div><label className={labelCls}>Destination *</label><input required value={createForm.destination} onChange={e => setCreateForm({ ...createForm, destination: e.target.value })} className={inputCls} placeholder="Nepal - Everest Base Camp" /></div>
              <div><label className={labelCls}>Description</label><textarea value={createForm.description} onChange={e => setCreateForm({ ...createForm, description: e.target.value })} rows={2} className={`${inputCls} resize-none`} placeholder="Décrivez votre aventure..." /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className={labelCls}>Thème</label><select value={createForm.theme} onChange={e => setCreateForm({ ...createForm, theme: e.target.value })} className={selectCls}>{THEMES.map(t => <option key={t}>{t}</option>)}</select></div>
                <div><label className={labelCls}>Visibilité</label><select value={createForm.visibility} onChange={e => setCreateForm({ ...createForm, visibility: e.target.value })} className={selectCls}><option value="public">🌍 Public</option><option value="private">🔒 Privé</option><option value="invite_only">🔗 Sur invitation</option></select></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className={labelCls}>Départ</label><input type="date" value={createForm.departure_date} onChange={e => setCreateForm({ ...createForm, departure_date: e.target.value })} className={inputCls} /></div>
                <div><label className={labelCls}>Retour</label><input type="date" value={createForm.return_date} onChange={e => setCreateForm({ ...createForm, return_date: e.target.value })} className={inputCls} /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className={labelCls}>Budget (€)</label><input type="number" value={createForm.budget_target} onChange={e => setCreateForm({ ...createForm, budget_target: e.target.value })} className={inputCls} placeholder="2500" /></div>
                <div><label className={labelCls}>Max membres</label><input type="number" min={2} max={50} value={createForm.max_members} onChange={e => setCreateForm({ ...createForm, max_members: e.target.value })} className={inputCls} /></div>
              </div>
              <button type="submit" disabled={creating} className="w-full py-3 bg-[#E4501C] hover:bg-[#E4501C]/90 text-white rounded-xl font-700 transition-colors disabled:opacity-50">
                {creating ? 'Création...' : 'Créer le groupe'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Expense Modal — with payer selection */}
      {showExpenseModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#EDEAE0] border border-[#C8C3B0] rounded-2xl w-full max-w-md p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-5">
              <h3 className="font-display font-700 text-lg text-[#1C2620]">Ajouter une dépense</h3>
              <button onClick={() => setShowExpenseModal(false)} className="p-2 rounded-xl hover:bg-[#C8C3B0]/40 transition-colors"><Icon name="XMarkIcon" size={18} /></button>
            </div>
            <form onSubmit={handleAddExpense} className="space-y-4">
              <div><label className={labelCls}>Description *</label><input required value={expenseForm.title} onChange={e => setExpenseForm({ ...expenseForm, title: e.target.value })} className={inputCls} placeholder="Nuit refuge Namche" /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className={labelCls}>Montant (€) *</label><input required type="number" step="0.01" min="0.01" value={expenseForm.amount} onChange={e => setExpenseForm({ ...expenseForm, amount: e.target.value })} className={inputCls} placeholder="45.00" /></div>
                <div><label className={labelCls}>Catégorie</label><select value={expenseForm.category} onChange={e => setExpenseForm({ ...expenseForm, category: e.target.value })} className={selectCls}>{EXPENSE_CATEGORIES.map(c => <option key={c}>{c}</option>)}</select></div>
              </div>
              <div>
                <label className={labelCls}>Payé par *</label>
                <select
                  value={expenseForm.paid_by}
                  onChange={e => setExpenseForm({ ...expenseForm, paid_by: e.target.value })}
                  className={selectCls}
                >
                  <option value="">Moi-même ({user?.email?.split('@')[0]})</option>
                  {members.filter(m => m.user_id !== user?.id).map(m => (
                    <option key={m.user_id} value={m.user_id}>
                      {m.user_profiles?.full_name || 'Membre'}
                    </option>
                  ))}
                </select>
                <p className="text-[10px] text-[#5C6B5E] mt-1">La dépense sera répartie entre tous les membres</p>
              </div>
              <button type="submit" disabled={addingExpense} className="w-full py-3 bg-[#E4501C] hover:bg-[#E4501C]/90 text-white rounded-xl font-700 transition-colors disabled:opacity-50">
                {addingExpense ? 'Ajout...' : 'Ajouter la dépense'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Kit Modal */}
      {showKitModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#EDEAE0] border border-[#C8C3B0] rounded-2xl w-full max-w-md p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-5">
              <h3 className="font-display font-700 text-lg text-[#1C2620]">Ajouter au kit</h3>
              <button onClick={() => setShowKitModal(false)} className="p-2 rounded-xl hover:bg-[#C8C3B0]/40 transition-colors"><Icon name="XMarkIcon" size={18} /></button>
            </div>
            <form onSubmit={handleAddKitItem} className="space-y-4">
              <div><label className={labelCls}>Nom de l&apos;article *</label><input required value={kitForm.name} onChange={e => setKitForm({ ...kitForm, name: e.target.value })} className={inputCls} placeholder="Tente 2 places" /></div>
              <div className="grid grid-cols-3 gap-3">
                <div><label className={labelCls}>Poids (g)</label><input type="number" min="0" value={kitForm.weight_grams} onChange={e => setKitForm({ ...kitForm, weight_grams: e.target.value })} className={inputCls} placeholder="1200" /></div>
                <div><label className={labelCls}>Qté</label><input type="number" min={1} value={kitForm.quantity} onChange={e => setKitForm({ ...kitForm, quantity: e.target.value })} className={inputCls} /></div>
                <div><label className={labelCls}>Catégorie</label><select value={kitForm.category} onChange={e => setKitForm({ ...kitForm, category: e.target.value })} className={selectCls}>{KIT_CATEGORIES.map(c => <option key={c}>{c}</option>)}</select></div>
              </div>
              <div>
                <label className={labelCls}>Assigné à</label>
                <select value={kitForm.assigned_to} onChange={e => setKitForm({ ...kitForm, assigned_to: e.target.value })} className={selectCls}>
                  <option value="">Moi-même</option>
                  {members.filter(m => m.user_id !== user?.id).map(m => (
                    <option key={m.user_id} value={m.user_id}>{m.user_profiles?.full_name || 'Membre'}</option>
                  ))}
                </select>
              </div>
              <button type="submit" disabled={addingKit} className="w-full py-3 bg-[#E4501C] hover:bg-[#E4501C]/90 text-white rounded-xl font-700 transition-colors disabled:opacity-50">
                {addingKit ? 'Ajout...' : 'Ajouter au kit'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Task Modal */}
      {showTaskModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#EDEAE0] border border-[#C8C3B0] rounded-2xl w-full max-w-md p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-5">
              <h3 className="font-display font-700 text-lg text-[#1C2620]">Créer une tâche</h3>
              <button onClick={() => setShowTaskModal(false)} className="p-2 rounded-xl hover:bg-[#C8C3B0]/40 transition-colors"><Icon name="XMarkIcon" size={18} /></button>
            </div>
            <form onSubmit={handleAddTask} className="space-y-4">
              <div><label className={labelCls}>Titre *</label><input required value={taskForm.title} onChange={e => setTaskForm({ ...taskForm, title: e.target.value })} className={inputCls} placeholder="Réserver les vols" /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className={labelCls}>Échéance</label><input type="date" value={taskForm.due_date} onChange={e => setTaskForm({ ...taskForm, due_date: e.target.value })} className={inputCls} /></div>
                <div>
                  <label className={labelCls}>Assigné à</label>
                  <select value={taskForm.assigned_to} onChange={e => setTaskForm({ ...taskForm, assigned_to: e.target.value })} className={selectCls}>
                    <option value="">Non assigné</option>
                    {members.map(m => (
                      <option key={m.user_id} value={m.user_id}>{m.user_profiles?.full_name || 'Membre'}</option>
                    ))}
                  </select>
                </div>
              </div>
              <button type="submit" disabled={addingTask} className="w-full py-3 bg-[#E4501C] hover:bg-[#E4501C]/90 text-white rounded-xl font-700 transition-colors disabled:opacity-50">
                {addingTask ? 'Création...' : 'Créer la tâche'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Poll Modal */}
      {showPollModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#EDEAE0] border border-[#C8C3B0] rounded-2xl w-full max-w-md p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-5">
              <h3 className="font-display font-700 text-lg text-[#1C2620]">Créer un sondage</h3>
              <button onClick={() => setShowPollModal(false)} className="p-2 rounded-xl hover:bg-[#C8C3B0]/40 transition-colors"><Icon name="XMarkIcon" size={18} /></button>
            </div>
            <form onSubmit={handleCreatePoll} className="space-y-4">
              <div><label className={labelCls}>Question *</label><input required value={pollForm.question} onChange={e => setPollForm({ ...pollForm, question: e.target.value })} className={inputCls} placeholder="Quelle date préférez-vous ?" /></div>
              <div>
                <label className={labelCls}>Options (minimum 2)</label>
                <div className="space-y-2">
                  {pollForm.options.map((opt, i) => (
                    <div key={i} className="flex gap-2">
                      <input
                        value={opt}
                        onChange={e => { const opts = [...pollForm.options]; opts[i] = e.target.value; setPollForm({ ...pollForm, options: opts }); }}
                        className={inputCls}
                        placeholder={`Option ${i + 1}`}
                      />
                      {pollForm.options.length > 2 && (
                        <button type="button" onClick={() => { const opts = pollForm.options.filter((_, idx) => idx !== i); setPollForm({ ...pollForm, options: opts }); }} className="p-2 text-red-400 hover:text-red-600 transition-colors flex-shrink-0">
                          <Icon name="XMarkIcon" size={16} />
                        </button>
                      )}
                    </div>
                  ))}
                  {pollForm.options.length < 6 && (
                    <button type="button" onClick={() => setPollForm({ ...pollForm, options: [...pollForm.options, ''] })} className="text-xs text-[#E4501C] hover:underline flex items-center gap-1">
                      <Icon name="PlusIcon" size={12} /> Ajouter une option
                    </button>
                  )}
                </div>
              </div>
              <button type="submit" disabled={addingPoll} className="w-full py-3 bg-[#E4501C] hover:bg-[#E4501C]/90 text-white rounded-xl font-700 transition-colors disabled:opacity-50">
                {addingPoll ? 'Création...' : 'Créer le sondage'}
              </button>
            </form>
          </div>
        </div>
      )}

      <Footer />
    </div>
  );
}

export default function GroupePage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#F5F2E8] flex items-center justify-center"><div className="w-8 h-8 border-2 border-[#E4501C] border-t-transparent rounded-full animate-spin" /></div>}>
      <GroupePageInner />
    </Suspense>
  );
}
