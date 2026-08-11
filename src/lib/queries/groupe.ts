import { createClient } from '@/lib/supabase/client';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function displayName(profile: any, fallback = 'Membre'): string {
  if (!profile) return fallback;
  return profile.full_name || profile.first_name || fallback;
}

function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

function formatDateShort(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
}

function seasonLabel(dateIso: string | null | undefined): string {
  if (!dateIso) return 'À CONFIRMER';
  const d = new Date(dateIso);
  if (isNaN(d.getTime())) return 'À CONFIRMER';
  const month = d.getMonth() + 1; // 1-12
  const year = d.getFullYear();
  if (month >= 3 && month <= 5) return `PRINTEMPS ${year}`;
  if (month >= 6 && month <= 8) return `ÉTÉ ${year}`;
  if (month >= 9 && month <= 11) return `AUTOMNE ${year}`;
  return `HIVER ${year}`;
}

/**
 * Récupère un groupe complet (architecture `travel_groups` + `group_*`) avec
 * toutes ses données réelles. Retourne `null` si le groupe est introuvable
 * (contrôlé par RLS) ou si une erreur survient — aucune donnée de secours.
 */
export async function getGroupeComplet(groupeId: string) {
  const supabase = createClient();

  let groupeQuery = supabase.from('groupes').select('*');
  if (UUID_REGEX.test(groupeId)) {
    groupeQuery = groupeQuery.eq('id', groupeId);
  } else {
    groupeQuery = groupeQuery.eq('invite_code', groupeId.toUpperCase());
  }

  const { data: groupe, error: groupeError } = await groupeQuery.maybeSingle();
  if (groupeError || !groupe) return null;

  const realGroupId = groupe.id;

  // Fetch related tables in parallel
  const [
    { data: membres },
    { data: taches },
    { data: equipement },
    { data: depenses },
    { data: messages },
    { data: votes },
  ] = await Promise.all([
    supabase.from('groupe_membres').select('*, profile:user_profiles!groupe_membres_user_id_fkey(full_name, first_name)').eq('group_id', realGroupId).order('joined_at', { ascending: true }),
    supabase.from('group_tasks').select('*, assigne:user_profiles!group_tasks_assigned_to_fkey(full_name, first_name)').eq('group_id', realGroupId).order('created_at', { ascending: false }),
    supabase.from('group_kit_items').select('*, apporte:user_profiles!group_kit_items_assigned_to_fkey(full_name, first_name)').eq('group_id', realGroupId).order('created_at', { ascending: false }),
    supabase.from('group_expenses').select('*, payeur:user_profiles!group_expenses_paid_by_fkey(full_name, first_name)').eq('group_id', realGroupId).order('created_at', { ascending: false }),
    supabase.from('group_messages').select('*, auteur:user_profiles!group_messages_user_id_fkey(full_name, first_name)').eq('group_id', realGroupId).order('created_at', { ascending: false }).limit(200),
    supabase.from('group_polls').select('*').eq('group_id', realGroupId).eq('status', 'open').order('created_at', { ascending: false }),
  ]);

  const activeMembers = (membres || []).filter((m: any) => m.status === 'active');
  const nbMembers = Math.max(activeMembers.length, 1);

  // Fetch votes for all open polls in one query
  const pollIds = (votes || []).map((v: any) => v.id);
  const { data: voteRows } = pollIds.length > 0
    ? await supabase.from('group_poll_votes').select('*').in('poll_id', pollIds)
    : { data: [] };

  // Format tasks
  const formattedTasks = (taches || []).map((t: any) => ({
    id: t.id,
    title: t.title,
    assigneeId: t.assigned_to || undefined,
    assignee: displayName(t.assigne, 'Non attribué'),
    tags: t.status === 'done' ? ['Fait', 'Terminée'] : ['À faire'],
    completed: t.status === 'done',
    details: t.description || '',
  }));

  // Format equipment (group_kit_items)
  const formattedEquipment = (equipement || []).map((e: any) => ({
    id: e.id,
    item: e.name,
    assigneeId: e.assigned_to || undefined,
    assignee: displayName(e.apporte, 'Non attribué'),
    weight: `${((e.weight_grams || 0) / 1000).toFixed(1)} kg`,
    status: e.is_shared ? 'Confirmé' : 'À affecter',
    notes: e.notes || '',
    statusColor: e.is_shared ? 'bg-[#E7E3D6] text-[#5C6B5E]' : 'bg-amber-100 text-amber-700',
  }));

  // Format expenses (amount stocké en euros)
  const totalExpenseEur = (depenses || []).reduce((acc: number, d: any) => acc + Number(d.amount || 0), 0);
  const perPersonEur = Math.round(totalExpenseEur / nbMembers);

  const formattedExpenses = {
    total: Math.round(totalExpenseEur),
    perPerson: perPersonEur,
    userBalance: 0,
    userDebts: `Total engagé : ${Math.round(totalExpenseEur)}€ · Part par personne : ${perPersonEur}€`,
    items: (depenses || []).map((d: any) => ({
      id: d.id,
      title: d.title,
      payer: `${displayName(d.payeur, 'Anonyme')} · ${d.status === 'settled' ? 'réglée' : 'en attente'}`,
      parts: (d.split_between && d.split_between.length ? d.split_between.length : nbMembers),
      amount: Math.round(Number(d.amount || 0)),
    })),
  };

  // Format decisions / votes (group_polls + group_poll_votes)
  const formattedDecisions = (votes || []).map((v: any) => {
    const rawOptions: any[] = Array.isArray(v.options) ? v.options : [];
    const pollVotes = (voteRows || []).filter((c: any) => c.poll_id === v.id);
    const totalChoices = pollVotes.length;

    const options = rawOptions.map((opt: any, index: number) => {
      const label = typeof opt === 'string' ? opt : (opt?.label || '');
      const optVotes = pollVotes.filter((c: any) => c.option_index === index).length;
      return {
        id: typeof opt === 'string' ? `opt-${index}` : (opt?.id || `opt-${index}`),
        index,
        label,
        votes: optVotes,
        percentage: totalChoices > 0 ? Math.round((optVotes / totalChoices) * 100) : 0,
        details: `${optVotes} votes`,
        selected: false,
      };
    });

    return {
      id: v.id,
      author: 'Organisateur',
      tag: 'Admin',
      meta: `Vote actif — ${totalChoices} vote(s)`,
      question: v.question,
      options,
      footer: `${totalChoices} votes exprimés`,
    };
  });

  // Format discussions / messages
  const formattedDiscussions = (messages || []).map((m: any) => ({
    id: m.id,
    author: displayName(m.auteur, 'Membre'),
    time: formatDateTime(m.created_at),
    content: m.content,
    attachment: m.media_url || undefined,
    likes: 0,
    replies: 0,
  }));

  // Format travelers (actif uniquement) — expose user_id + profile pour la gestion
  const formattedTravelers = activeMembers.map((m: any) => {
    const role = m.role === 'organizer' ? 'ORGANISATEUR' : m.role === 'co_organizer' ? 'CO-ORGANISATEUR' : m.role === 'observer' ? 'OBSERVATEUR' : 'MEMBRE';
    return {
      id: m.id,
      user_id: m.user_id,
      name: displayName(m.profile, 'Membre'),
      role,
      status: 'Prêt',
      progress: 100,
      user_profiles: m.profile,
      role_code: m.role,
      status_code: m.status,
    };
  });

  const departure = groupe.departure_date ? new Date(groupe.departure_date) : null;
  const returnd = groupe.return_date ? new Date(groupe.return_date) : null;
  const daysLeft = departure && !isNaN(departure.getTime())
    ? Math.ceil((departure.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    : null;
  const durationDays = departure && returnd && !isNaN(departure.getTime()) && !isNaN(returnd.getTime())
    ? Math.max(1, Math.round((returnd.getTime() - departure.getTime()) / (1000 * 60 * 60 * 24)))
    : null;

  return {
    id: realGroupId,
    meta: {
      titlePrefix: (groupe.name?.split(' ')[0] || 'Groupe'),
      titleSuffix: (groupe.name?.split(' ').slice(1).join(' ') || ''),
      description: groupe.description || '',
      type: 'VOYAGE COLLABORATIF',
      participantsCount: String(nbMembers),
      season: seasonLabel(groupe.departure_date),
      durationDays: durationDays ?? 0,
      distanceKm: 0,
      elevationGain: 0,
      daysLeft: daysLeft ?? 0,
      startDate: formatDateShort(groupe.departure_date),
      endDate: formatDateShort(groupe.return_date),
      fullStartDate: departure && !isNaN(departure.getTime())
        ? departure.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })
        : '',
      massif: groupe.destination || 'À définir',
      difficulty: groupe.group_level ? `Niveau ${groupe.group_level} · dénivelé` : '—',
      budgetEstimate: groupe.budget_target ? `≈ ${Number(groupe.budget_target)}€/pers` : '—',
      privacy: groupe.visibility === 'public' ? 'Groupe public' : 'Groupe privé',
      meetingPoint: 'Point de rendez-vous à définir',
      progression: Math.min(100, Math.max(0, Number(groupe.optimization_score) || 0)),
    },
    tasks: formattedTasks,
    equipment: formattedEquipment,
    expenses: formattedExpenses,
    decisions: formattedDecisions,
    discussions: formattedDiscussions,
    travelers: formattedTravelers,
    activities: [],
  };
}

export async function toggleGroupeTaskStatus(taskId: string, currentCompleted: boolean) {
  const supabase = createClient();
  const newStatus = currentCompleted ? 'todo' : 'done';
  return supabase
    .from('group_tasks')
    .update({ status: newStatus })
    .eq('id', taskId);
}

export async function voteInGroupeOption(voteId: string, optionId: string, membreId: string) {
  const supabase = createClient();
  const optionIndex = Number(optionId.replace(/^opt-/, ''));
  return supabase
    .from('group_poll_votes')
    .upsert({ poll_id: voteId, user_id: membreId, option_index: Number.isFinite(optionIndex) ? optionIndex : 0 }, { onConflict: 'poll_id,user_id' });
}

export async function addGroupeTask(groupeId: string, titre: string, categorie: string = 'general', assigneA?: string) {
  const supabase = createClient();
  return supabase
    .from('group_tasks')
    .insert({ group_id: groupeId, title: titre, description: categorie === 'general' ? null : categorie, assigned_to: assigneA || null, status: 'todo' });
}

export async function addGroupeMessage(groupeId: string, contenu: string, auteurId?: string) {
  const supabase = createClient();
  return supabase
    .from('group_messages')
    .insert({ group_id: groupeId, content: contenu, user_id: auteurId || null });
}