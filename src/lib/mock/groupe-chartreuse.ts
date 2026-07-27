export const mockChartreuseData = {
  id: 'chartreuse-1',
  meta: {
    titlePrefix: 'Traversée de la',
    titleSuffix: 'Chartreuse.',
    description: 'Trois jours en refuge gardé, du 12 au 14 octobre. On prépare le sac à plusieurs, on se répartit les repas, on tranche les décisions par vote. Au retour, le voyage devient un carnet.',
    type: 'VOYAGE COLLABORATIF',
    participantsCount: 6,
    season: 'AUTOMNE 2026',
    durationDays: 3,
    distanceKm: 27.4,
    elevationGain: 1620,
    daysLeft: 16,
    startDate: '12 oct.',
    endDate: '14 oct.',
    fullStartDate: 'Vendredi 12 octobre',
    massif: 'Chartreuse · Isère',
    difficulty: 'Moyenne · dénivelé',
    budgetEstimate: '≈ 85€/pers',
    privacy: 'Groupe privé',
    meetingPoint: 'Saint-Pierre-de-Chartreuse — rendez-vous à 9h à l\'église',
    progression: 68
  },
  
  tasks: [
    { id: 't1', title: 'Fixer les dates du week-end', assignee: 'Léna', tags: ['Fait'], completed: true, details: '2 sondages · résolu' },
    { id: 't2', title: 'Réserver le refuge du Charmant Som', assignee: 'Antoine', tags: ['Fait', 'Refuge'], completed: true, details: 'Nuit 1 · 6 places confirmées' },
    { id: 't3', title: 'Confirmer le Grand Vaneau (nuit 2)', assignee: 'Marceline', tags: ['Dans 3 j', 'Refuge'], completed: false, details: 'Attente réponse d\'Hélène — relancer par téléphone' },
    { id: 't4', title: 'Acheter le gaz pour le réchaud', assignee: 'Antoine', tags: ['Dans 6 j', 'Matériel'], completed: false, details: '2 cartouches 230g suffisent pour le groupe' },
    { id: 't5', title: 'Préparer les repas du samedi midi', assignee: 'Léna', tags: ['Dans 9 j', 'Repas'], completed: false, details: 'Menu proposé : polenta + charcuterie du plateau' }
  ],

  equipment: [
    { id: 'e1', item: 'Tente 3-places MSR', assignee: 'Léna', weight: '2,1 kg', status: 'Confirmé', notes: 'Prêt Léna, testé cet été', statusColor: 'bg-[#E7E3D6] text-[#5C6B5E]' },
    { id: 'e2', item: 'Réchaud MSR PocketRocket', assignee: 'Antoine', weight: '340 g', status: 'Confirmé', notes: '+ 2 cartouches 230g', statusColor: 'bg-[#E7E3D6] text-[#5C6B5E]' },
    { id: 'e3', item: 'Trousse pharmacie collective', assignee: 'Marceline', weight: '280 g', status: 'À vérifier', notes: 'À compléter avec antihistaminique', statusColor: 'bg-amber-100 text-amber-700' },
    { id: 'e4', item: 'Cartes IGN 25 000 · secteur Chartreuse', assignee: 'Non attribué', weight: '280 g', status: 'À affecter', notes: '3324OT et 3333OT', statusColor: 'bg-red-100 text-red-700' },
    { id: 'e5', item: 'Corde 30m + cordelette', assignee: 'Antoine', weight: '1,8 kg', status: 'Confirmé', notes: 'Précaution passage col Vert', statusColor: 'bg-[#E7E3D6] text-[#5C6B5E]' }
  ],

  expenses: {
    total: 468,
    perPerson: 78,
    userBalance: -26,
    userDebts: 'Antoine vous doit 12€ · Vous devez 38€ à Léna. Solde net : -26€',
    items: [
      { id: 'ex1', title: 'Réservation Charmant Som', payer: 'Antoine · versé le 2 oct.', parts: 6, amount: 288 },
      { id: 'ex2', title: 'Cartes IGN + gaz', payer: 'Léna · versé le 8 oct.', parts: 6, amount: 54 },
      { id: 'ex3', title: 'Courses samedi midi', payer: 'Marceline · à venir', parts: 6, amount: 72 },
      { id: 'ex4', title: 'Essence trajet aller', payer: 'Antoine · covoiturage 3 places', parts: 3, amount: 54 }
    ]
  },

  decisions: [
    {
      id: 'd1',
      author: 'Léna Vaudois',
      tag: 'Admin',
      meta: 'Vote lancé il y a 5 jours — clôt vendredi 20h',
      question: 'Variante haute par le col Vert, ou tracé bleu par le refuge ? Antoine a signalé le sentier délavé après la source du Guiers — on doit trancher avant vendredi.',
      options: [
        { id: 'o1', label: 'Variante haute - col Vert (12,8 km)', votes: 4, percentage: 67, details: '4 votes · vous avez voté pour', selected: true },
        { id: 'o2', label: 'Tracé bleu - descente refuge (11,2 km)', votes: 2, percentage: 33, details: '2 votes', selected: false }
      ],
      footer: '6 votes exprimés · 67% pour variante haute'
    }
  ],

  discussions: [
    {
      id: 'msg1',
      author: 'Antoine Béraud',
      tag: 'Guide',
      time: 'hier · 21h40 · Retour de repérage',
      content: 'Retour du repérage de la variante haute. Passage du col Vert confortable, mais sentier délavé après la source du Guiers. Trace GPX corrigée en pièce jointe. #chartreuse #reperage',
      attachment: '📍 Col Vert - Chartreuse',
      likes: 5,
      replies: 3
    },
    {
      id: 'msg2',
      author: 'Marceline Chevrier',
      time: 'il y a 3 jours · Retour du Grand Vaneau',
      content: 'Hélène est enfin joignable. Refuge confirmé pour la nuit 2, dortoir 8 places, demi-pension 52€. Elle prépare la soupe corail — j\'ai promis le pain. #refuge',
      likes: 6,
      replies: 3
    }
  ],

  travelers: [
    { id: 'v1', name: 'Léna Vaudois', role: 'Admin · Organisatrice', status: 'Prêt', progress: 100 },
    { id: 'v2', name: 'Antoine Béraud', role: 'Guide · fait le repérage', status: 'Prêt', progress: 100 },
    { id: 'v3', name: 'Marceline Chevrier', role: '2 tâches en cours · sac parti', progress: 62 },
    { id: 'v4', name: 'Camille Rey', role: 'Photographe · sac prêt', status: 'Prêt', progress: 100 },
    { id: 'v5', name: 'Julien Marchal', role: '1 tâche restante · pharmacie', progress: 75 },
    { id: 'v6', name: 'Sophie Astier', role: 'Retour vendredi · pas encore vu', status: 'Hors ligne', progress: 0 }
  ],

  activities: [
    { id: 'a1', content: 'Antoine a validé sa tâche **Réserver le Charmant Som** — 6 places confirmées.', time: 'il y a 2h' },
    { id: 'a2', content: 'Antoine a ajouté une trace GPX corrigée après le repérage du col Vert.', time: 'hier' },
    { id: 'a3', content: 'Léna a lancé un **vote** sur la variante haute vs tracé bleu.', time: 'il y a 5j' },
    { id: 'a4', content: 'Marceline a partagé 3 photos du repérage précédent.', time: 'il y a 6j' },
    { id: 'a5', content: 'Léna a créé le groupe **Traversée de la Chartreuse**.', time: 'il y a 3 sem.' }
  ]
};
