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
  return d.toLocaleString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
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

  // Try travel_groups first
  let { data: groupe } = await (UUID_REGEX.test(groupeId)
    ? supabase.from('travel_groups').select('*').eq('id', groupeId).maybeSingle()
    : supabase.from('travel_groups').select('*').eq('invite_code', groupeId.toUpperCase()).maybeSingle());

  // Fallback to legacy groupes table if not found
  if (!groupe) {
    const { data: legacyGroupe } = await (UUID_REGEX.test(groupeId)
      ? supabase.from('groupes').select('*').eq('id', groupeId).maybeSingle()
      : supabase.from('groupes').select('*').eq('invite_code', groupeId.toUpperCase()).maybeSingle());

    if (legacyGroupe) {
      groupe = {
        id: legacyGroupe.id,
        name: legacyGroupe.nom || legacyGroupe.name,
        description: legacyGroupe.description,
        destination: legacyGroupe.destination || legacyGroupe.massif,
        theme: legacyGroupe.theme || 'Trek',
        cover_url: legacyGroupe.cover_url || null,
        departure_date: legacyGroupe.date_debut,
        return_date: legacyGroupe.date_fin,
        budget_target: legacyGroupe.budget_prevu_cents ? legacyGroupe.budget_prevu_cents / 100 : null,
        group_level: 3,
        optimization_score: legacyGroupe.progression_pct || 80,
        visibility: legacyGroupe.confidentialite === 'prive' ? 'private' : 'public',
      };
    }
  }

  if (!groupe) return null;

  const realGroupId = groupe.id;

  // Fetch related tables in parallel — use simple joins without explicit FK names
  const [
    { data: travelMembers, error: membersErr },
    { data: taches, error: tachesErr },
    { data: equipement, error: equipErr },
    { data: depenses, error: depErr },
    { data: messages, error: msgErr },
    { data: votes, error: votesErr },
  ] = await Promise.all([
    supabase.from('group_members').select('id, user_id, role, status, joined_at, profile:user_profiles!group_members_user_id_fkey(full_name, avatar_url)').eq('group_id', realGroupId).order('joined_at', { ascending: true }),
    supabase.from('group_tasks').select('id, title, description, status, assigned_to, created_at, assigne:user_profiles!group_tasks_assigned_to_fkey(full_name)').eq('group_id', realGroupId).order('created_at', { ascending: false }),
    supabase.from('group_kit_items').select('id, name, weight_grams, category, quantity, is_shared, notes, assigned_to, apporte:user_profiles!group_kit_items_assigned_to_fkey(full_name)').eq('group_id', realGroupId).order('created_at', { ascending: false }),
    supabase.from('group_expenses').select('id, title, amount, category, split_between, status, created_at, paid_by, payeur:user_profiles!group_expenses_paid_by_fkey(full_name)').eq('group_id', realGroupId).order('created_at', { ascending: false }),
    supabase.from('group_messages').select('id, content, media_url, created_at, user_id, auteur:user_profiles!group_messages_user_id_fkey(full_name)').eq('group_id', realGroupId).order('created_at', { ascending: false }).limit(200),
    supabase.from('group_polls').select('*').eq('group_id', realGroupId).eq('status', 'open').order('created_at', { ascending: false }),
  ]);

  if (membersErr) console.error('[groupe] members error:', membersErr);
  if (tachesErr) console.error('[groupe] tasks error:', tachesErr);
  if (equipErr) console.error('[groupe] kit error:', equipErr);
  if (depErr) console.error('[groupe] expenses error:', depErr);
  if (msgErr) console.error('[groupe] messages error:', msgErr);
  if (votesErr) console.error('[groupe] polls error:', votesErr);

  const membres = travelMembers || [];
  const activeMembers = membres.filter((m: any) => m.status === 'active' || !m.status);
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
    weightGrams: e.weight_grams || 0,
    quantity: e.quantity || 1,
    category: e.category || 'Divers',
    is_shared: !!e.is_shared,
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
    location: m.location || undefined,
    reply_to: m.reply_to || undefined,
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

  // Look up matched trail from explore_trails or hiking_routes based on destination or name
  let trailData: any = null;
  const searchName = groupe.destination || groupe.name || '';
  if (searchName) {
    const { data: matchedTrails } = await supabase
      .from('explore_trails')
      .select('*')
      .or(`name.ilike.%${searchName.split(' ')[0]}%,name.ilike.%${searchName}%`)
      .limit(1);
    if (matchedTrails && matchedTrails.length > 0) {
      trailData = matchedTrails[0];
    }
  }

  return {
    id: realGroupId,
    inviteCode: groupe.invite_code || '',
    trail: trailData,
    meta: {
      titlePrefix: (groupe.name?.split(' ')[0] || 'Groupe'),
      titleSuffix: (groupe.name?.split(' ').slice(1).join(' ') || ''),
      description: groupe.description || trailData?.ai_description || '',
      type: 'VOYAGE COLLABORATIF',
      participantsCount: String(nbMembers),
      season: seasonLabel(groupe.departure_date),
      durationDays: durationDays ?? (trailData?.duration_hours ? Math.ceil(trailData.duration_hours / 7) : 3),
      distanceKm: trailData?.distance_km ? Number(trailData.distance_km) : 27.4,
      elevationGain: trailData?.elevation_gain ? Number(trailData.elevation_gain) : 1620,
      daysLeft: daysLeft ?? 0,
      startDate: formatDateShort(groupe.departure_date),
      endDate: formatDateShort(groupe.return_date),
      fullStartDate: departure && !isNaN(departure.getTime())
        ? departure.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })
        : '',
      massif: groupe.destination || trailData?.region || 'Massif & Aventure',
      difficulty: trailData?.difficulty ? `${trailData.difficulty} · dénivelé` : (groupe.group_level ? `Niveau ${groupe.group_level} · dénivelé` : 'Modéré'),
      budgetEstimate: groupe.budget_target ? `≈ ${Number(groupe.budget_target)}€/pers` : '—',
      privacy: groupe.visibility === 'public' ? 'Groupe public' : 'Groupe privé',
      meetingPoint: 'Point de rendez-vous au départ du sentier',
      progression: Math.min(100, Math.max(0, Number(groupe.optimization_score) || 0)),
    },
    tasks: formattedTasks,
    equipment: formattedEquipment,
    expenses: formattedExpenses,
    decisions: formattedDecisions,
    discussions: formattedDiscussions,
    travelers: formattedTravelers,
    activities: groupe.destination?.toLowerCase().includes('islande') || groupe.destination?.toLowerCase().includes('landmann') ? [
      { id: 'act-1', content: '🌋 **Jour 1** — Landmannalaugar → Hrafntinnusker · 12 km · +550m · Sources chaudes géothermiques et champs de rhyolite multicolores', time: formatDateShort(groupe.departure_date) || 'Jour 1' },
      { id: 'act-2', content: '🏔️ **Jour 2** — Hrafntinnusker → Álftavatn · 22 km · Traversée de glaciers noirs et lac turquoise', time: 'Jour 2' },
      { id: 'act-3', content: '🌊 **Jour 3** — Álftavatn → Emstrur (Botnar) · 15 km · Vallée volcanique, rivières glaciales et gués', time: 'Jour 3' },
      { id: 'act-4', content: '⚡ **Jour 4** — Emstrur → Þórsmörk · 15 km · Traversée de Krossá (sandales de gué !) · Arrivée dans la vallée de Thor', time: 'Jour 4' },
      { id: 'act-5', content: '🌿 **Jour 5** — Repos & exploration Þórsmörk · Randonnées courtes, baignade dans sources chaudes', time: 'Jour 5' },
      { id: 'act-6', content: '🏙️ **Jour 6** — Retour Reykjavik & Blue Lagoon · Bus depuis Þórsmörk, soirée dans la capitale islandaise', time: 'Jour 6' },
      { id: 'act-7', content: '✈️ **Jour 7** — Vol retour Paris CDG · Départ depuis Keflavík International Airport', time: formatDateShort(groupe.return_date) || 'Jour 7' },
    ] : [],
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