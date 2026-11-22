import fs from 'node:fs';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';

for (const line of fs.readFileSync(path.resolve(process.cwd(), '.env.local'), 'utf8').split('\n')) {
  const m = line.match(/^([^#=]+)=(.*)$/);
  if (m) process.env[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, '');
}

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
);

const UNSPLASH_MOUNTAIN_PHOTOS = [
  'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=900&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1551632811-561732d1e306?w=900&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1519681393784-d120267933ba?w=900&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1454496522488-7a8e488e8606?w=900&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1501555088652-021faa106b9b?w=900&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1483728642387-6c3bdd6c93e5?w=900&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1522163182402-834f871fd851?w=900&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=900&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?w=900&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1510312305653-8ed496efae75?w=900&auto=format&fit=crop&q=80',
];

const TOPIC_TEMPLATES = [
  {
    title: 'Reco Arête des Cosmiques — Mont-Blanc',
    content: 'Neige portante dès 06h00 au-dessus du refuge des Cosmiques. Passages mixtes secs, broches inutiles sur le bas mais utiles pour le rappel final.',
  },
  {
    title: 'Conditions Col de la Croix de Fer',
    content: 'Trace propre et balcon encore bien sec malgré les pluies d’hier. Prévoir coupe-vent au sommet, rafales à 45 km/h.',
  },
  {
    title: 'Bivouac au Lac Blanc — Belledonne',
    content: 'Lever de soleil mémorable face au Mont-Blanc. Eau encore abondante aux sources sous le refuge Jean Collet.',
  },
  {
    title: 'Topo Grand Veymont par le Pas de la Ville',
    content: 'Boucle de 16 km et +1 120 m D+ bouclée en 5h10. Bouquetins nombreux sur le plateau, pensez à garder vos distances.',
  },
  {
    title: 'Sortie trail longue — Dent de Crolles',
    content: 'Montée par le Pas de l’Oeille en 1h18, descente fluide par le Col du Coq. Bâtons vraiment appréciables sur la crête.',
  },
  {
    title: 'Test sac ultralight 32L sur 2 jours en Vanoise',
    content: 'Poids de base stabilisé à 5,4 kg avec duvet 0°C et réchaud titane. Retour complet dispo si ça intéresse du monde pour la prochaine traversée.',
  },
  {
    title: 'Covoit départ Grenoble — Vercors samedi 06h30',
    content: '3 places dispo dans le break depuis Porte de France, porte-skis et coffre grand format pour les sacs d’expé.',
  },
  {
    title: 'Tour des Aiguilles Rouges — étape Brévent',
    content: 'Visibilité parfaite sur le massif du Mont-Blanc toute la matinée. Quelques névés résiduels en face nord facilement contournables.',
  },
  {
    title: 'Séance révision mouflage & encordement glacier',
    content: 'Petit atelier pratique prévu dimanche matin sur la falaise école. Ouvert à tous les membres motivés pour préparer la saison haute montagne.',
  },
  {
    title: 'Aiguille de la Grande Sassière (3 747 m)',
    content: 'Montée efficace depuis le Saut, arête sommitale ventée mais panorama à 360° jusqu’au Cervin et au Viso.',
  },
];

const EVENT_SPOTS = [
  { title: 'Traversée des Dômes de Miage', location: 'Les Contamines · Mont-Blanc', sport: 'Alpinisme', km: 22, dplus: 1850, lat: 45.802, lng: 6.768 },
  { title: 'Crête du Grand Veymont au lever du jour', location: 'Gresse-en-Vercors · Vercors', sport: 'Randonnée', km: 15, dplus: 1080, lat: 44.872, lng: 5.526 },
  { title: 'Croix de Belledonne par les Lacs Robert', location: 'Chamrousse · Belledonne', sport: 'Trail', km: 19, dplus: 1420, lat: 45.169, lng: 5.987 },
  { title: 'Boucle du Pic de Bure — Plateau', location: 'Superdévoluy · Dévoluy', sport: 'Randonnée', km: 17, dplus: 1290, lat: 44.627, lng: 5.936 },
  { title: 'Tour du Lac du Lauvitel & Refuge', location: 'Bourg-d’Oisans · Écrins', sport: 'Bivouac', km: 14, dplus: 960, lat: 44.968, lng: 6.064 },
  { title: 'Arête Nord de Chamechaude', location: 'Col de Porte · Chartreuse', sport: 'Randonnée', km: 11, dplus: 840, lat: 45.288, lng: 5.789 },
  { title: 'Col de la Vanoise & Pointe de la Réchasse', location: 'Pralognan · Vanoise', sport: 'Alpinisme', km: 20, dplus: 1510, lat: 45.394, lng: 6.784 },
  { title: 'Mont Aiguille — Voie Normale encadrée', location: 'Chichilianne · Trièves', sport: 'Alpinisme', km: 9, dplus: 780, lat: 44.841, lng: 5.552 },
];

const GEAR_CATALOG = [
  { name: 'Crampons Petzl Irvis 10 pointes', brand: 'Petzl', category: 'Alpinisme', weight_g: 736 },
  { name: 'Piolet Black Diamond Raven 60 cm', brand: 'Black Diamond', category: 'Alpinisme', weight_g: 438 },
  { name: 'Tente MSR Hubba Hubba NX 2P', brand: 'MSR', category: 'Bivouac & Abri', weight_g: 1540 },
  { name: 'Duvet Cumulus Lite Line 400', brand: 'Cumulus', category: 'Couchage', weight_g: 705 },
  { name: 'Réchaud Jetboil Flash', brand: 'Jetboil', category: 'Cuisine', weight_g: 371 },
  { name: 'Bâtons Black Diamond Distance Carbon Z', brand: 'Black Diamond', category: 'Marche', weight_g: 280 },
  { name: 'DVA Mammut Barryvox S', brand: 'Mammut', category: 'Sécurité', weight_g: 210 },
  { name: 'Frontale Petzl Swift RL 1100 lm', brand: 'Petzl', category: 'Éclairage', weight_g: 100 },
  { name: 'Matelas Therm-a-Rest NeoAir XLite NXT', brand: 'Therm-a-Rest', category: 'Couchage', weight_g: 370 },
  { name: 'Corde à double Beal Opera 8.5mm 60m', brand: 'Beal', category: 'Alpinisme', weight_g: 2880 },
];

function roleKeyFor(m, createdBy) {
  if (m.user_id === createdBy) return 'founder';
  if (m.role === 'admin') return 'guide';
  if (m.role === 'moderator') return 'encadrant';
  return 'member';
}

async function main() {
  const { data: club, error: clubErr } = await sb
    .from('clubs')
    .select('id, name, created_by')
    .eq('slug', 'cordee-des-alpes')
    .single();
  if (clubErr || !club) throw clubErr || new Error('Club cordee-des-alpes introuvable');

  // 1. Fix demo account full_name + 3 hidden moderators so public_profiles exposes everyone cleanly
  await sb
    .from('user_profiles')
    .update({ full_name: 'Alexandre Dumas' })
    .eq('id', '9c0b1015-21a5-40cc-b670-f14d55ad4a0c');

  await sb
    .from('user_profiles')
    .update({ is_demo: false, profile_visibility: 'public' })
    .in('id', [
      'af967189-0d1e-4b81-86dd-77f820993347',
      'cdcfe9a6-8fa0-4b34-90c9-7303a17715ba',
      'ce7df194-b35a-4088-b4bc-e786abc77d9c',
    ]);

  // Fetch all 500 club_members
  const { data: members } = await sb
    .from('club_members')
    .select('id, user_id, role, joined_at')
    .eq('club_id', club.id)
    .limit(600);
  const memberList = members || [];
  console.log(`Membres trouvés: ${memberList.length}`);

  const now = Date.now();

  // 2. Modulate joined_at + user_profiles (xp, level, trust_score) by role
  const newMemberIds = new Set();
  for (let i = 0; i < memberList.length; i++) {
    const m = memberList[i];
    const rk = roleKeyFor(m, club.created_by);
    const isRecentNewcomer = rk === 'member' && i % 7 === 0; // ~14% Nouveaux, ~86% Membres actifs
    if (isRecentNewcomer) newMemberIds.add(m.user_id);

    const daysAgo =
      rk === 'founder'
        ? 320
        : rk === 'guide'
          ? 140 + (i % 120)
          : rk === 'encadrant'
            ? 60 + (i % 90)
            : isRecentNewcomer
              ? (i % 5) + 1
              : 14 + (i % 160);

    await sb
      .from('club_members')
      .update({ joined_at: new Date(now - daysAgo * 86_400_000).toISOString() })
      .eq('id', m.id);

    if (m.user_id !== club.created_by) {
      const level =
        rk === 'guide'
          ? 7 + (i % 3)
          : rk === 'encadrant'
            ? 5 + (i % 3)
            : isRecentNewcomer
              ? 1 + (i % 2)
              : 2 + (i % 4);
      const xp = level * 480 + (i % 350);
      const trust =
        rk === 'guide'
          ? 92 + (i % 7)
          : rk === 'encadrant'
            ? 86 + (i % 8)
            : isRecentNewcomer
              ? 72 + (i % 8)
              : 78 + (i % 12);
      await sb
        .from('user_profiles')
        .update({ level, xp, trust_score: trust })
        .eq('id', m.user_id);
    }
  }

  // 3. Topics modulated by role: Founder=5, Guide=3-4, Encadrant=2-3, Membre actif=1-2, Nouveau=1
  const { data: existingTopics } = await sb
    .from('club_topics')
    .select('id, author_id, media_url')
    .eq('club_id', club.id)
    .limit(1500);

  const topicCountByAuthor = new Map();
  const topicsWithoutMedia = [];
  for (const t of existingTopics || []) {
    topicCountByAuthor.set(t.author_id, (topicCountByAuthor.get(t.author_id) || 0) + 1);
    if (!t.media_url) topicsWithoutMedia.push(t.id);
  }

  for (let i = 0; i < topicsWithoutMedia.length; i++) {
    if (i % 3 === 2) continue;
    await sb
      .from('club_topics')
      .update({ media_url: UNSPLASH_MOUNTAIN_PHOTOS[i % UNSPLASH_MOUNTAIN_PHOTOS.length] })
      .eq('id', topicsWithoutMedia[i]);
  }

  const topicsToInsert = [];
  memberList.forEach((m, idx) => {
    const rk = roleKeyFor(m, club.created_by);
    const existing = topicCountByAuthor.get(m.user_id) || 0;
    const target =
      rk === 'founder'
        ? 5
        : rk === 'guide'
          ? 3 + (idx % 2)
          : rk === 'encadrant'
            ? 2 + (idx % 2)
            : newMemberIds.has(m.user_id)
              ? 1
              : 1 + (idx % 3 === 0 ? 1 : 0);

    for (let k = existing; k < target; k++) {
      const tpl = TOPIC_TEMPLATES[(idx + k) % TOPIC_TEMPLATES.length];
      const hasMedia = (idx + k) % 10 < 7;
      topicsToInsert.push({
        club_id: club.id,
        author_id: m.user_id,
        title: tpl.title,
        content: tpl.content,
        is_pinned: rk === 'founder' && k === existing,
        is_announcement: false,
        is_approved: true,
        likes_count: ((idx * 7 + k * 3) % 24) + (rk === 'founder' || rk === 'guide' ? 8 : 1),
        replies_count: (idx + k) % 6,
        media_url: hasMedia ? UNSPLASH_MOUNTAIN_PHOTOS[(idx + k) % UNSPLASH_MOUNTAIN_PHOTOS.length] : null,
        created_at: new Date(now - ((idx * 37 + k * 19) % 720) * 3600_000).toISOString(),
      });
    }
  });

  for (let i = 0; i < topicsToInsert.length; i += 100) {
    const { error } = await sb.from('club_topics').insert(topicsToInsert.slice(i, i + 100));
    if (error) throw error;
  }
  console.log(`Topics ajoutés (modulés par rôle): ${topicsToInsert.length}`);

  // 4. Events modulated by role: Founder=4, Guide=2-3, Encadrant=1-2
  const { data: existingEvents } = await sb
    .from('club_events')
    .select('id, organizer_id')
    .eq('club_id', club.id)
    .limit(500);

  const eventCountByOrganizer = new Map();
  for (const ev of existingEvents || []) {
    eventCountByOrganizer.set(ev.organizer_id, (eventCountByOrganizer.get(ev.organizer_id) || 0) + 1);
  }

  const leaders = memberList.filter((m) => roleKeyFor(m, club.created_by) !== 'member');
  const eventsToInsert = [];
  leaders.forEach((m, idx) => {
    const rk = roleKeyFor(m, club.created_by);
    const existing = eventCountByOrganizer.get(m.user_id) || 0;
    const target = rk === 'founder' ? 4 : rk === 'guide' ? 2 + (idx % 2) : 1 + (idx % 2);
    for (let k = existing; k < target; k++) {
      const spot = EVENT_SPOTS[(idx + k) % EVENT_SPOTS.length];
      const daysOffset = ((idx + k) % 24) + 1;
      const start = new Date(now + daysOffset * 86_400_000);
      const end = new Date(start.getTime() + 6 * 3600_000);
      eventsToInsert.push({
        club_id: club.id,
        organizer_id: m.user_id,
        title: `${spot.title} (${spot.km} km · +${spot.dplus} m)`,
        description: `Sortie encadrée ${spot.sport} au départ de ${spot.location}. Covoiturage et brief sécurité organisés via le salon du club.`,
        event_date: start.toISOString(),
        starts_at: start.toISOString(),
        ends_at: end.toISOString(),
        location: spot.location,
        meeting_point: spot.location.split('·')[0].trim(),
        sport: spot.sport,
        format: 'trail_outing',
        visibility: 'club_only',
        max_participants: 12,
        participants_count: 4 + ((idx + k) % 7),
        lat: spot.lat,
        lng: spot.lng,
        waitlist_enabled: true,
        surface_type: 'trail',
      });
    }
  });

  if (eventsToInsert.length > 0) {
    for (let i = 0; i < eventsToInsert.length; i += 50) {
      const { error } = await sb.from('club_events').insert(eventsToInsert.slice(i, i + 50));
      if (error) throw error;
    }
  }
  console.log(`Sorties ajoutées (modulées par rôle): ${eventsToInsert.length}`);

  // 5. Gear modulated by role: Founder=4, Guide=2-3, Encadrant=1-2, Membre actif=0-1, Nouveau=0
  const { data: existingGear } = await sb
    .from('club_gear_items')
    .select('id, owner_id')
    .eq('club_id', club.id)
    .limit(500);

  const gearCountByOwner = new Map();
  for (const g of existingGear || []) {
    gearCountByOwner.set(g.owner_id, (gearCountByOwner.get(g.owner_id) || 0) + 1);
  }

  const gearToInsert = [];
  memberList.forEach((m, idx) => {
    const rk = roleKeyFor(m, club.created_by);
    const existing = gearCountByOwner.get(m.user_id) || 0;
    const target =
      rk === 'founder'
        ? 4
        : rk === 'guide'
          ? 2 + (idx % 2)
          : rk === 'encadrant'
            ? 1 + (idx % 2)
            : newMemberIds.has(m.user_id)
              ? 0
              : idx % 3 === 0
                ? 1
                : 0;
    for (let k = existing; k < target; k++) {
      const item = GEAR_CATALOG[(idx + k) % GEAR_CATALOG.length];
      gearToInsert.push({
        club_id: club.id,
        owner_id: m.user_id,
        name: item.name,
        brand: item.brand,
        category: item.category,
        weight_g: item.weight_g,
        available: (idx + k) % 5 !== 0,
      });
    }
  });

  if (gearToInsert.length > 0) {
    for (let i = 0; i < gearToInsert.length; i += 50) {
      const { error } = await sb.from('club_gear_items').insert(gearToInsert.slice(i, i + 50));
      if (error) throw error;
    }
  }
  console.log(`Équipements ajoutés (modulés par rôle): ${gearToInsert.length}`);

  const [{ count: tc }, { count: ec }, { count: gc }] = await Promise.all([
    sb.from('club_topics').select('*', { count: 'exact', head: true }).eq('club_id', club.id),
    sb.from('club_events').select('*', { count: 'exact', head: true }).eq('club_id', club.id),
    sb.from('club_gear_items').select('*', { count: 'exact', head: true }).eq('club_id', club.id),
  ]);
  console.log('FINAL COUNTS cordee-des-alpes:', { members: memberList.length, topics: tc, events: ec, gear: gc });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
