import { createClient } from '@/lib/supabase/client';
import { mockChartreuseData } from '@/lib/mock/groupe-chartreuse';

export async function getGroupeComplet(groupeId: string) {
  try {
    const supabase = createClient();

    // Find group by ID or by name
    let query = supabase.from('travel_groups').select('*');
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(groupeId);
    
    if (isUuid) {
      query = query.eq('id', groupeId);
    } else {
      query = query.eq('name', 'Traversée de la Chartreuse');
    }

    const { data: groupe } = await query.single();
    if (!groupe) return mockChartreuseData;

    const realGroupId = groupe.id;

    // Fetch related tables in parallel
    const [
      { data: membres },
      { data: etapes },
      { data: hebergements },
      { data: taches },
      { data: equipement },
      { data: depenses },
      { data: votes },
      { data: voteOptions },
      { data: voteChoix },
      { data: messages },
      { data: activites },
    ] = await Promise.all([
      supabase.from('groupe_membres').select('*').eq('groupe_id', realGroupId).order('created_at', { ascending: true }),
      supabase.from('groupe_etapes').select('*').eq('groupe_id', realGroupId).order('ordre', { ascending: true }),
      supabase.from('groupe_hebergements').select('*').eq('groupe_id', realGroupId).order('apres_jour_numero', { ascending: true }),
      supabase.from('groupe_taches').select('*, assigne:groupe_membres(nom_affichage)').eq('groupe_id', realGroupId).order('created_at', { ascending: false }),
      supabase.from('groupe_equipement').select('*, apporte:groupe_membres(nom_affichage)').eq('groupe_id', realGroupId),
      supabase.from('groupe_depenses').select('*, payeur:groupe_membres(nom_affichage)').eq('groupe_id', realGroupId).order('created_at', { ascending: false }),
      supabase.from('groupe_votes').select('*').eq('groupe_id', realGroupId).eq('statut', 'actif'),
      supabase.from('groupe_vote_options').select('*'),
      supabase.from('groupe_vote_choix').select('*'),
      supabase.from('groupe_messages').select('*, auteur:groupe_membres(nom_affichage, role)').eq('groupe_id', realGroupId).order('created_at', { ascending: false }).limit(5),
      supabase.from('groupe_activites').select('*, membre:groupe_membres(nom_affichage)').eq('groupe_id', realGroupId).order('created_at', { ascending: false }).limit(5),
    ]);

    // Format tasks
    const formattedTasks = (taches && taches.length > 0) ? taches.map((t: any) => ({
      id: t.id,
      title: t.titre,
      assignee: t.assigne?.nom_affichage || 'Non attribué',
      tags: t.statut === 'fait' ? ['Fait', t.categorie] : [t.categorie],
      completed: t.statut === 'fait',
      details: t.note || `${t.categorie} · ${t.statut === 'fait' ? 'résolu' : 'à faire'}`,
    })) : mockChartreuseData.tasks;

    // Format equipment
    const formattedEquipment = (equipement && equipement.length > 0) ? equipement.map((e: any) => ({
      id: e.id,
      item: e.nom,
      assignee: e.apporte?.nom_affichage || 'Non attribué',
      weight: `${(e.poids_g / 1000).toFixed(1)} kg`,
      status: e.statut === 'confirme' ? 'Confirmé' : e.statut === 'a_verifier' ? 'À vérifier' : 'À affecter',
      notes: e.note || '',
      statusColor: e.statut === 'confirme' ? 'bg-[#E7E3D6] text-[#5C6B5E]' : e.statut === 'a_verifier' ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700',
    })) : mockChartreuseData.equipment;

    // Format expenses & calculation
    const totalExpenseCents = (depenses || []).reduce((acc: number, d: any) => acc + (d.montant_cents || 0), 0);
    const totalExpenseEur = Math.round(totalExpenseCents / 100);
    const nbMembers = (membres && membres.length > 0) ? membres.length : 6;
    const perPersonEur = Math.round(totalExpenseEur / (nbMembers || 1));

    const formattedExpenses = {
      total: totalExpenseEur || mockChartreuseData.expenses.total,
      perPerson: perPersonEur || mockChartreuseData.expenses.perPerson,
      userBalance: 0,
      userDebts: `Total engagé : ${totalExpenseEur}€ · Part par personne : ${perPersonEur}€`,
      items: (depenses && depenses.length > 0) ? depenses.map((d: any) => ({
        id: d.id,
        title: d.titre,
        payer: `${d.payeur?.nom_affichage || 'Anonyme'} · ${d.statut}`,
        parts: d.nb_parts || nbMembers,
        amount: Math.round(d.montant_cents / 100),
      })) : mockChartreuseData.expenses.items,
    };

    // Format decisions / votes
    const formattedDecisions = (votes && votes.length > 0) ? votes.map((v: any) => {
      const options = (voteOptions || []).filter((o: any) => o.vote_id === v.id);
      const choices = (voteChoix || []).filter((c: any) => c.vote_id === v.id);
      const totalChoices = choices.length || 1;

      return {
        id: v.id,
        author: 'Léna Vaudois',
        tag: 'Admin',
        meta: `Vote actif — ${v.contexte || ''}`,
        question: v.question,
        options: options.map((opt: any) => {
          const optVotes = choices.filter((c: any) => c.option_id === opt.id).length;
          const pct = Math.round((optVotes / totalChoices) * 100);
          return {
            id: opt.id,
            label: opt.libelle,
            votes: optVotes,
            percentage: pct,
            details: `${optVotes} votes · ${opt.detail || ''}`,
            selected: false,
          };
        }),
        footer: `${choices.length} votes exprimés`,
      };
    }) : mockChartreuseData.decisions;

    // Format discussions / messages
    const formattedDiscussions = (messages && messages.length > 0) ? messages.map((m: any) => ({
      id: m.id,
      author: m.auteur?.nom_affichage || 'Membre',
      tag: m.auteur?.role || 'Membre',
      time: new Date(m.created_at).toLocaleDateString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
      content: m.contenu,
      attachment: m.lieu_nom ? `📍 ${m.lieu_nom}` : undefined,
      likes: m.likes_count || 0,
      replies: m.comments_count || 0,
    })) : mockChartreuseData.discussions;

    // Format travelers
    const formattedTravelers = (membres && membres.length > 0) ? membres.map((m: any) => ({
      id: m.id,
      name: m.nom_affichage,
      role: `${m.role.toUpperCase()} · ${m.role_note || ''}`,
      status: m.statut_preparation === 'pret' ? 'Prêt' : 'En cours',
      progress: m.pourcentage_pret || 100,
    })) : mockChartreuseData.travelers;

    // Format activities
    const formattedActivities = (activites && activites.length > 0) ? activites.map((a: any) => ({
      id: a.id,
      content: `${a.membre?.nom_affichage || 'Un membre'} ${a.description}`,
      time: new Date(a.created_at).toLocaleDateString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
    })) : mockChartreuseData.activities;

    return {
      id: realGroupId,
      meta: {
        titlePrefix: groupe.name.split(' ')[0] || 'Traversée',
        titleSuffix: groupe.name.split(' ').slice(1).join(' ') || 'de la Chartreuse',
        description: groupe.description || mockChartreuseData.meta.description,
        type: 'VOYAGE COLLABORATIF',
        participantsCount: groupe.max_members || 6,
        season: 'AUTOMNE 2026',
        durationDays: groupe.departure_date && groupe.return_date ? Math.round((new Date(groupe.return_date).getTime() - new Date(groupe.departure_date).getTime()) / (1000 * 60 * 60 * 24)) : 3,
        distanceKm: Number(groupe.group_xp) || 27.4,
        elevationGain: groupe.optimization_score || 1620,
        daysLeft: groupe.departure_date ? Math.round((new Date(groupe.departure_date).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)) : 16,
        startDate: groupe.departure_date ? new Date(groupe.departure_date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }) : '12 oct.',
        endDate: groupe.return_date ? new Date(groupe.return_date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }) : '14 oct.',
        fullStartDate: groupe.departure_date ? new Date(groupe.departure_date).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' }) : 'Vendredi 12 octobre',
        massif: groupe.destination || 'Chartreuse · Isère',
        difficulty: `${groupe.group_level || 'Moyenne'} · dénivelé`,
        budgetEstimate: `≈ ${groupe.budget_target || 85}€/pers`,
        privacy: groupe.visibility === 'public' ? 'Groupe public' : 'Groupe privé',
        meetingPoint: 'Point de rendez-vous à définir',
        progression: 60,
      },
      tasks: formattedTasks,
      equipment: formattedEquipment,
      expenses: formattedExpenses,
      decisions: formattedDecisions,
      discussions: formattedDiscussions,
      travelers: formattedTravelers,
      activities: formattedActivities,
    };
  } catch (err) {
    console.error('getGroupeComplet error:', err);
    return mockChartreuseData;
  }
}

export async function toggleGroupeTaskStatus(taskId: string, currentCompleted: boolean) {
  const supabase = createClient();
  const newStatut = currentCompleted ? 'a_faire' : 'fait';
  const completedAt = newStatut === 'fait' ? new Date().toISOString() : null;

  return supabase
    .from('groupe_taches')
    .update({ statut: newStatut, completed_at: completedAt })
    .eq('id', taskId);
}

export async function voteInGroupeOption(voteId: string, optionId: string, membreId: string) {
  const supabase = createClient();
  return supabase
    .from('groupe_vote_choix')
    .upsert({ vote_id: voteId, option_id: optionId, membre_id: membreId }, { onConflict: 'vote_id,membre_id' });
}

export async function addGroupeTask(groupeId: string, titre: string, categorie: string = 'general', assigneA?: string) {
  const supabase = createClient();
  return supabase
    .from('groupe_taches')
    .insert({ groupe_id: groupeId, titre, categorie, assigne_a: assigneA, statut: 'a_faire' });
}

export async function addGroupeMessage(groupeId: string, contenu: string, auteurId?: string, lieuNom?: string) {
  const supabase = createClient();
  return supabase
    .from('groupe_messages')
    .insert({ groupe_id: groupeId, contenu, auteur_id: auteurId, lieu_nom: lieuNom });
}
