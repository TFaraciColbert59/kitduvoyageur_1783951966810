import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://icxyvwzfjbflcbqukpfz.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Use service role client to bypass RLS and create auth users
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

function daysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString();
}

function daysFromNow(n) {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString();
}

async function getOrCreateUser(email, password, fullName, avatarUrl) {
  try {
    const { data, error } = await supabase.auth.admin.createUser({
      email,
      password: password || 'Password!2026',
      email_confirm: true,
      user_metadata: { full_name: fullName, avatar_url: avatarUrl }
    });
    if (data?.user) return data.user.id;
  } catch (err) {
    // Ignore and lookup
  }

  const { data: usersList } = await supabase.auth.admin.listUsers();
  const found = usersList?.users?.find((u) => u.email === email);
  return found ? found.id : null;
}

export async function runMassiveSeed() {
  console.log('=== DÉBUT DU SEEDING MASSIF DU COMPTE DÉMO & ÉCOSYSTÈME LKDV ===\n');

  // 1. GET OR CREATE DEMO USER & COMMUNITY USERS IN AUTH.USERS
  console.log('1. Création / Récupération des comptes auth...');
  const demoId = await getOrCreateUser('demo@lkdv.app', 'DemoPass!2026', 'Alexandre Dumas', 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&q=80');
  const u1 = await getOrCreateUser('marie.dupont@email.fr', 'DemoPass!2026', 'Marie Dupont', 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=400&q=80');
  const u2 = await getOrCreateUser('thomas.martin@email.fr', 'DemoPass!2026', 'Thomas Martin', 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=400&q=80');
  const u3 = await getOrCreateUser('sophie.bernard@email.fr', 'DemoPass!2026', 'Sophie Bernard', 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=400&q=80');
  const u4 = await getOrCreateUser('lucas.petit@email.fr', 'DemoPass!2026', 'Lucas Petit', 'https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?w=400&q=80');
  const u5 = await getOrCreateUser('camille.leroy@email.fr', 'DemoPass!2026', 'Camille Leroy', 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=400&q=80');
  const u6 = await getOrCreateUser('antoine.moreau@email.fr', 'DemoPass!2026', 'Antoine Moreau', 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=400&q=80');
  const u7 = await getOrCreateUser('julie.simon@email.fr', 'DemoPass!2026', 'Julie Simon', 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=400&q=80');
  const u8 = await getOrCreateUser('maxime.garcia@email.fr', 'DemoPass!2026', 'Maxime Garcia', 'https://images.unsplash.com/photo-1492562080023-ab3db95bfbce?w=400&q=80');

  console.log(`✓ Utilisateurs vérifiés : Démo (${demoId}) + 8 membres de la communauté.`);

  // 2. USER PROFILES
  console.log('\n2. Mise à jour des profils utilisateurs...');
  const profiles = [
    {
      id: demoId,
      email: 'demo@lkdv.app',
      full_name: 'Alexandre Dumas',
      avatar_url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&q=80',
      trust_score: 96,
      loyalty_points: 3450,
      loyalty_level: 'Explorateur Elite',
      bio: 'Guide de haute montagne & passionné de bivouacs sauvages. Des Highlands islandais aux crêtes du Mont-Blanc.',
      location: 'Chamonix-Mont-Blanc, France',
      created_at: daysAgo(200)
    },
    {
      id: u1,
      email: 'marie.dupont@email.fr',
      full_name: 'Marie Dupont',
      avatar_url: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=400&q=80',
      trust_score: 94,
      loyalty_points: 2900,
      loyalty_level: 'Explorateur Elite',
      bio: 'Photographe nature & adepte des longues traversées en autonomie.',
      location: 'Grenoble, France',
      created_at: daysAgo(180)
    },
    {
      id: u2,
      email: 'thomas.martin@email.fr',
      full_name: 'Thomas Martin',
      avatar_url: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=400&q=80',
      trust_score: 88,
      loyalty_points: 2400,
      loyalty_level: 'Aventurier',
      bio: 'Bikepacker & Ultra-cycliste. Toujours prêt pour 200 km de gravel.',
      location: 'Annecy, France',
      created_at: daysAgo(150)
    },
    {
      id: u3,
      email: 'sophie.bernard@email.fr',
      full_name: 'Sophie Bernard',
      avatar_url: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=400&q=80',
      trust_score: 91,
      loyalty_points: 2600,
      loyalty_level: 'Aventurier',
      bio: 'Coureuse d\'ultra-trail (Finisher UTMB & Diagonale des Fous).',
      location: 'Chamonix, France',
      created_at: daysAgo(120)
    },
    {
      id: u4,
      email: 'lucas.petit@email.fr',
      full_name: 'Lucas Petit',
      avatar_url: 'https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?w=400&q=80',
      trust_score: 79,
      loyalty_points: 1650,
      loyalty_level: 'Explorateur',
      bio: 'Ski de randonnée & alpinisme estival dans les Écrins.',
      location: 'Briançon, France',
      created_at: daysAgo(90)
    },
    {
      id: u5,
      email: 'camille.leroy@email.fr',
      full_name: 'Camille Leroy',
      avatar_url: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=400&q=80',
      trust_score: 76,
      loyalty_points: 1350,
      loyalty_level: 'Explorateur',
      bio: 'Kayakiste de mer & bivouac côtier en Bretagne et Méditerranée.',
      location: 'Brest, France',
      created_at: daysAgo(75)
    },
    {
      id: u6,
      email: 'antoine.moreau@email.fr',
      full_name: 'Antoine Moreau',
      avatar_url: 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=400&q=80',
      trust_score: 72,
      loyalty_points: 980,
      loyalty_level: 'Explorateur',
      bio: 'Escalade, via ferrata et topos dans les Dolomites.',
      location: 'Lyon, France',
      created_at: daysAgo(60)
    },
    {
      id: u7,
      email: 'julie.simon@email.fr',
      full_name: 'Julie Simon',
      avatar_url: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=400&q=80',
      trust_score: 68,
      loyalty_points: 750,
      loyalty_level: 'Découvreur',
      bio: 'Passionnée de voyages nature, flore alpine et observation faune.',
      location: 'Chambéry, France',
      created_at: daysAgo(45)
    },
    {
      id: u8,
      email: 'maxime.garcia@email.fr',
      full_name: 'Maxime Garcia',
      avatar_url: 'https://images.unsplash.com/photo-1492562080023-ab3db95bfbce?w=400&q=80',
      trust_score: 65,
      loyalty_points: 590,
      loyalty_level: 'Découvreur',
      bio: 'Trekkeur débutant mais motivé, en quête de nouveaux sentiers.',
      location: 'Toulouse, France',
      created_at: daysAgo(30)
    }
  ];

  const { error: profErr } = await supabase.from('user_profiles').upsert(profiles, { onConflict: 'id' });
  if (profErr) console.error('Erreur user_profiles:', profErr.message);
  else console.log(`✓ ${profiles.length} profils insérés.`);

  // 3. CARNETS DE TERRAIN
  console.log('\n3. Insertion des carnets de terrain...');
  const cDemo1 = 'b2000000-0000-0000-0000-000000000001';
  const cDemo2 = 'b2000000-0000-0000-0000-000000000002';
  const cDemo3 = 'b2000000-0000-0000-0000-000000000003';
  const cDemo4 = 'b2000000-0000-0000-0000-000000000004';

  const cOther1 = 'b2000000-0000-0000-0000-000000000011';
  const cOther2 = 'b2000000-0000-0000-0000-000000000012';
  const cOther3 = 'b2000000-0000-0000-0000-000000000013';
  const cOther4 = 'b2000000-0000-0000-0000-000000000014';
  const cOther5 = 'b2000000-0000-0000-0000-000000000015';
  const cOther6 = 'b2000000-0000-0000-0000-000000000016';

  const carnets = [
    // DEMO USER CARNETS
    {
      id: cDemo1,
      author_id: demoId,
      title: 'Traversée Intégrale de l’Islande : F208 & Hautes Terres',
      destination: 'Islande',
      country_iso: 'is',
      description: '14 jours en autonomie complète à travers les déserts de cendres de l’Askja et les vallées géothermiques du Landmannalaugar. Traversées de gués gelés, nuits sous tente 4 saisons et aurores boréales précoces.',
      cover_image: 'https://images.unsplash.com/photo-1504893524553-b855bce32c67?w=1200&q=80',
      cover_image_alt: 'Paysage volcanique d’Islande avec vapeurs et mousse émeraude',
      start_date: '2025-08-05',
      end_date: '2025-08-19',
      weather: 'Vents 60km/h, 4°C à 12°C, soleil et brume volcanique',
      route_rating: 4.9,
      visibility: 'public',
      tags: ['islande', 'trek', 'hautes-terres', 'bivouac', 'autonomie'],
      likes_count: 248,
      comments_count: 38,
      views_count: 4620,
      verified: true,
      created_at: daysAgo(40)
    },
    {
      id: cDemo2,
      author_id: demoId,
      title: 'Tour du Mont-Blanc en autonomie complète',
      destination: 'France / Italie / Suisse',
      country_iso: 'fr',
      description: '170 km et 10 000 m de D+ autour du toit de l’Europe. Récit étape par étape, choix du matériel ultra-léger (sac de 6.8 kg sans eau) et gestion des bivouacs autorisés.',
      cover_image: 'https://images.unsplash.com/photo-1571008887538-b36bb32f4571?w=1200&q=80',
      cover_image_alt: 'Le massif du Mont-Blanc vu depuis les crêtes',
      start_date: '2025-07-10',
      end_date: '2025-07-18',
      weather: 'Grand beau temps, orages nocturnes',
      route_rating: 5.0,
      visibility: 'public',
      tags: ['tmb', 'mont-blanc', 'alpes', 'autonomie', 'bivouac'],
      likes_count: 315,
      comments_count: 52,
      views_count: 5980,
      verified: true,
      created_at: daysAgo(55)
    },
    {
      id: cDemo3,
      author_id: demoId,
      title: 'Dolomites Alta Via 1 & Via Ferratas mythiques',
      destination: 'Dolomites, Italie',
      country_iso: 'it',
      description: 'Huit jours sur les sentiers vertigineux des Dolomites, du Lago di Braies à Belluno. Parcours des via ferratas Ivano Dibona et Strobel.',
      cover_image: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=1200&q=80',
      cover_image_alt: 'Parois rocheuses spectaculaires des Dolomites',
      start_date: '2025-09-02',
      end_date: '2025-09-10',
      weather: 'Ciel limpide d’automne, 14°C',
      route_rating: 4.8,
      visibility: 'public',
      tags: ['dolomites', 'via-ferrata', 'alta-via', 'italie'],
      likes_count: 189,
      comments_count: 27,
      views_count: 3120,
      verified: true,
      created_at: daysAgo(25)
    },
    {
      id: cDemo4,
      author_id: demoId,
      title: 'Traversée du Jura en Bikepacking Gravel (GTJ)',
      destination: 'Jura, France',
      country_iso: 'fr',
      description: '380 km de pistes forestières, combes sauvages et crêtes panoramiques face aux Alpes. Retour d’expérience sur le montage des sacoches étanches.',
      cover_image: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=1200&q=80',
      cover_image_alt: 'Vélo de gravel sur un chemin de crête jurassien',
      start_date: '2025-06-12',
      end_date: '2025-06-16',
      weather: 'Doux et ensoleillé, brume matinale',
      route_rating: 4.7,
      visibility: 'public',
      tags: ['gravel', 'bikepacking', 'jura', 'gtj', 'vélo'],
      likes_count: 142,
      comments_count: 19,
      views_count: 2450,
      verified: false,
      created_at: daysAgo(15)
    },

    // COMMUNITY CARNETS
    {
      id: cOther1,
      author_id: u1,
      title: 'Trek au Népal : Tour des Annapurnas & Lac Tilicho',
      destination: 'Népal',
      country_iso: 'np',
      description: '21 jours d’immersion himalayenne. Passage du mythique col Thorong La à 5 416 m et montée magique au lac Tilicho, l’un des plus hauts lacs du monde.',
      cover_image: 'https://images.unsplash.com/photo-1544735716-392fe2489ffa?w=1200&q=80',
      cover_image_alt: 'Sommets enneigés de l’Himalaya au lever du soleil',
      start_date: '2025-10-01',
      end_date: '2025-10-22',
      weather: 'Grand soleil d’octobre, -12°C au col',
      route_rating: 4.9,
      visibility: 'public',
      tags: ['népal', 'himalaya', 'annapurnas', 'haute-altitude'],
      likes_count: 420,
      comments_count: 64,
      views_count: 7800,
      verified: true,
      created_at: daysAgo(70)
    },
    {
      id: cOther2,
      author_id: u3,
      title: 'Îles Lofoten : Randonnée & Bivouac sous le soleil de minuit',
      destination: 'Norvège',
      country_iso: 'no',
      description: 'Ascension des sommets de Reinebringen, Ryten et Kvalvika Beach. 10 jours de lumière continue au-dessus du cercle polaire arctique.',
      cover_image: 'https://images.unsplash.com/photo-1513519245088-0e12902e5a38?w=1200&q=80',
      cover_image_alt: 'Fjords spectaculaires des îles Lofoten',
      start_date: '2025-06-20',
      end_date: '2025-06-30',
      weather: 'Soleil de minuit, 12°C à 18°C',
      route_rating: 4.9,
      visibility: 'public',
      tags: ['norvège', 'lofoten', 'soleil-de-minuit', 'fjords'],
      likes_count: 275,
      comments_count: 41,
      views_count: 5120,
      verified: true,
      created_at: daysAgo(48)
    },
    {
      id: cOther3,
      author_id: u5,
      title: 'Pèlerinage Sacré du Kumano Kodo : Nakahechi Route',
      destination: 'Japon',
      country_iso: 'jp',
      description: 'Marche millénaire sur les pavés moussus de la péninsule de Kii, forêts de cèdres géants, sanctuaires shinto et onsens traditionnels le soir.',
      cover_image: 'https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?w=1200&q=80',
      cover_image_alt: 'Torii japonais traditionnel dans une forêt brumeuse',
      start_date: '2025-04-05',
      end_date: '2025-04-12',
      weather: 'Printemps doux, cerisiers en fleurs',
      route_rating: 4.8,
      visibility: 'public',
      tags: ['japon', 'kumano-kodo', 'spiritualité', 'forêt'],
      likes_count: 198,
      comments_count: 32,
      views_count: 3890,
      verified: true,
      created_at: daysAgo(60)
    },
    {
      id: cOther4,
      author_id: u2,
      title: 'Traversée du Sahara : Dunes de l’Erg Chebbi à pied',
      destination: 'Maroc',
      country_iso: 'ma',
      description: 'Expédition de 10 jours en autonomie avec dromadaires pour l’eau. Nuits sous les étoiles de l’Atlas et silence absolu des grandes dunes.',
      cover_image: 'https://images.unsplash.com/photo-1509316785289-025f5b846b35?w=1200&q=80',
      cover_image_alt: 'Dunes dorées du désert marocain au coucher du soleil',
      start_date: '2025-11-10',
      end_date: '2025-11-20',
      weather: '28°C le jour, 6°C la nuit',
      route_rating: 4.8,
      visibility: 'public',
      tags: ['maroc', 'sahara', 'désert', 'bivouac'],
      likes_count: 230,
      comments_count: 39,
      views_count: 4400,
      verified: true,
      created_at: daysAgo(30)
    },
    {
      id: cOther5,
      author_id: u4,
      title: 'Patagonie : Le W Trek à Torres del Paine',
      destination: 'Chili',
      country_iso: 'cl',
      description: 'Face aux colosses de granite et aux glaciers étincelants du Grey. Vents patagoniens à 90 km/h et beauté sauvage incomparable.',
      cover_image: 'https://images.unsplash.com/photo-1527004013197-933c4bb611b3?w=1200&q=80',
      cover_image_alt: 'Tours de granite de Torres del Paine au Chili',
      start_date: '2025-01-15',
      end_date: '2025-01-22',
      weather: '4 saisons en une seule journée',
      route_rating: 5.0,
      visibility: 'public',
      tags: ['patagonie', 'chili', 'torres-del-paine', 'glacier'],
      likes_count: 360,
      comments_count: 48,
      views_count: 6700,
      verified: true,
      created_at: daysAgo(50)
    },
    {
      id: cOther6,
      author_id: u6,
      title: 'Madère Intégrale : Crêtes du Pico Ruivo & Levadas sauvages',
      destination: 'Madère, Portugal',
      country_iso: 'pt',
      description: 'Randonnée vertigineuse entre le Pico do Arieiro et le Pico Ruivo au-dessus d’une mer de nuages. Forêt laurifère primaire protégée.',
      cover_image: 'https://images.unsplash.com/photo-1533105079780-92b9be482077?w=1200&q=80',
      cover_image_alt: 'Mer de nuages vue depuis les crêtes de Madère',
      start_date: '2025-05-18',
      end_date: '2025-05-25',
      weather: 'Ensoleillé avec brumes océaniques',
      route_rating: 4.7,
      visibility: 'public',
      tags: ['madère', 'portugal', 'levadas', 'crêtes'],
      likes_count: 175,
      comments_count: 24,
      views_count: 2900,
      verified: false,
      created_at: daysAgo(20)
    }
  ];

  const { error: carnErr } = await supabase.from('carnets').upsert(carnets, { onConflict: 'id' });
  if (carnErr) console.error('Erreur carnets:', carnErr.message);
  else console.log(`✓ ${carnets.length} carnets insérés.`);

  // 4. CLUBS OUTDOOR
  console.log('\n4. Insertion des clubs...');
  const cl1 = 'c3000000-0000-0000-0000-000000000001';
  const cl2 = 'c3000000-0000-0000-0000-000000000002';
  const cl3 = 'c3000000-0000-0000-0000-000000000003';
  const cl4 = 'c3000000-0000-0000-0000-000000000004';
  const cl5 = 'c3000000-0000-0000-0000-000000000005';
  const cl6 = 'c3000000-0000-0000-0000-000000000006';

  const clubs = [
    {
      id: cl1,
      slug: 'trekkeurs-alpes',
      name: 'Trekkeurs des Alpes',
      type: 'activité',
      emoji: '🏔️',
      description: 'Club officiel des amoureux de haute montagne, du Mont-Blanc aux Écrins. Sorties collectives, topos et entraide.',
      cover_color: 'rgba(23,64,44,0.15)',
      category: 'Randonnée & Alpinisme',
      privacy: 'open',
      members_count: 847,
      active_this_month: 234,
      is_verified: true,
      country_iso: 'fr',
      created_by: demoId,
      created_at: daysAgo(160)
    },
    {
      id: cl2,
      slug: 'islandophiles-nomades',
      name: 'Islandophiles Nomades',
      type: 'pays',
      emoji: '🇮🇸',
      description: 'Communauté francophone d’exploration de l’Islande. État des pistes F-Roads, topos de traversées et prévisions aurores.',
      cover_color: 'rgba(16,185,129,0.15)',
      category: 'Expédition Nordique',
      privacy: 'open',
      members_count: 612,
      active_this_month: 189,
      is_verified: true,
      country_iso: 'is',
      created_by: demoId,
      created_at: daysAgo(140)
    },
    {
      id: cl3,
      slug: 'bikepacking-france',
      name: 'Bikepacking & Gravel France',
      type: 'activité',
      emoji: '🚵',
      description: 'La référence des cyclotouristes et aventuriers en gravel. Traces GPX vérifiées, comparatifs de sacoches et récits.',
      cover_color: 'rgba(59,130,246,0.15)',
      category: 'Bikepacking',
      privacy: 'open',
      members_count: 534,
      active_this_month: 165,
      is_verified: true,
      country_iso: 'fr',
      created_by: u2,
      created_at: daysAgo(120)
    },
    {
      id: cl4,
      slug: 'ultra-trail-runners',
      name: 'Ultra Trail & Dénivelé',
      type: 'activité',
      emoji: '🏃',
      description: 'Pour les coureurs de sentiers longues distances, UTMB, Diagonale et Skyrunning. Plans d’entraînement et nutrition.',
      cover_color: 'rgba(239,68,68,0.15)',
      category: 'Course en Montagne',
      privacy: 'open',
      members_count: 689,
      active_this_month: 312,
      is_verified: true,
      country_iso: 'fr',
      created_by: u3,
      created_at: daysAgo(100)
    },
    {
      id: cl5,
      slug: 'kayak-mer-atlantique',
      name: 'Kayak & Bivouac Côtier',
      type: 'activité',
      emoji: '🚣',
      description: 'Exploration en kayak de mer, presqu’île de Crozon, îles Anglo-Normandes et côtes sauvages.',
      cover_color: 'rgba(14,165,233,0.15)',
      category: 'Kayak & Eau',
      privacy: 'open',
      members_count: 312,
      active_this_month: 89,
      is_verified: false,
      country_iso: 'fr',
      created_by: u5,
      created_at: daysAgo(90)
    },
    {
      id: cl6,
      slug: 'bivouac-bushcraft-france',
      name: 'Bivouac Sauvage & Leave No Trace',
      type: 'activité',
      emoji: '🏕️',
      description: 'Apprendre à bivouaquer sans laisser de trace. Choix du tarp, allumage du feu sécurisé et éthique environnementale.',
      cover_color: 'rgba(245,158,11,0.15)',
      category: 'Survie & Bivouac',
      privacy: 'open',
      members_count: 470,
      active_this_month: 145,
      is_verified: false,
      country_iso: 'fr',
      created_by: u1,
      created_at: daysAgo(80)
    }
  ];

  const { error: clubErr } = await supabase.from('clubs').upsert(clubs, { onConflict: 'id' });
  if (clubErr) console.error('Erreur clubs:', clubErr.message);
  else console.log(`✓ ${clubs.length} clubs insérés.`);

  // 5. CLUB MEMBERS
  console.log('\n5. Adhésion des membres aux clubs...');
  const clubMembers = [
    { club_id: cl1, user_id: demoId, role: 'admin', status: 'active', joined_at: daysAgo(160) },
    { club_id: cl1, user_id: u1, role: 'moderator', status: 'active', joined_at: daysAgo(150) },
    { club_id: cl1, user_id: u2, role: 'member', status: 'active', joined_at: daysAgo(120) },
    { club_id: cl1, user_id: u3, role: 'member', status: 'active', joined_at: daysAgo(100) },
    { club_id: cl1, user_id: u4, role: 'member', status: 'active', joined_at: daysAgo(80) },

    { club_id: cl2, user_id: demoId, role: 'admin', status: 'active', joined_at: daysAgo(140) },
    { club_id: cl2, user_id: u1, role: 'moderator', status: 'active', joined_at: daysAgo(130) },
    { club_id: cl2, user_id: u3, role: 'member', status: 'active', joined_at: daysAgo(90) },

    { club_id: cl3, user_id: u2, role: 'admin', status: 'active', joined_at: daysAgo(120) },
    { club_id: cl3, user_id: demoId, role: 'moderator', status: 'active', joined_at: daysAgo(115) },
    { club_id: cl3, user_id: u4, role: 'member', status: 'active', joined_at: daysAgo(85) },

    { club_id: cl4, user_id: u3, role: 'admin', status: 'active', joined_at: daysAgo(100) },
    { club_id: cl4, user_id: demoId, role: 'member', status: 'active', joined_at: daysAgo(90) },
    { club_id: cl4, user_id: u1, role: 'member', status: 'active', joined_at: daysAgo(75) },

    { club_id: cl6, user_id: u1, role: 'admin', status: 'active', joined_at: daysAgo(80) },
    { club_id: cl6, user_id: demoId, role: 'member', status: 'active', joined_at: daysAgo(70) },
    { club_id: cl6, user_id: u5, role: 'member', status: 'active', joined_at: daysAgo(60) }
  ];

  const { error: cmErr } = await supabase.from('club_members').upsert(clubMembers, { onConflict: 'club_id,user_id' });
  if (cmErr) console.error('Erreur club_members:', cmErr.message);
  else console.log(`✓ ${clubMembers.length} adhésions clubs insérées.`);

  // 6. GROUPES D'EXPÉDITION (TRAVEL GROUPS)
  console.log('\n6. Insertion des groupes d’expédition...');
  const gDemo1 = 'd4000000-0000-0000-0000-000000000001';
  const gDemo2 = 'd4000000-0000-0000-0000-000000000002';
  const gDemo3 = 'd4000000-0000-0000-0000-000000000003';

  const gOther1 = 'd4000000-0000-0000-0000-000000000011';
  const gOther2 = 'd4000000-0000-0000-0000-000000000012';
  const gOther3 = 'd4000000-0000-0000-0000-000000000013';

  const travelGroups = [
    // DEMO OWNED GROUPS
    {
      id: gDemo1,
      owner_id: demoId,
      name: 'Expédition Islande Highlands 2026',
      description: 'Traversée nord-sud des Hautes Terres d’Islande en autonomie. Passage par Askja, Landmannalaugar et Thórsmörk. 4x4 loué à Reykjavik pour la logistique de dépose.',
      destination: 'Hautes Terres, Islande',
      country_iso: 'is',
      theme: 'Trek & Survie volcanique',
      visibility: 'public',
      departure_date: daysFromNow(45).split('T')[0],
      return_date: daysFromNow(59).split('T')[0],
      max_members: 6,
      budget_target: 1450,
      group_level: 4,
      group_xp: 1850,
      optimization_score: 92,
      created_at: daysAgo(30)
    },
    {
      id: gDemo2,
      owner_id: demoId,
      name: 'Trek des Volcans d’Auvergne (Bivouac week-end)',
      description: 'Boucle de 3 jours autour des Puys du Sancy et Pariou. Bivouac léger, astronomie nocturne et cuisine au réchaud.',
      destination: 'Massif du Sancy, France',
      country_iso: 'fr',
      theme: 'Randonnée & Bivouac',
      visibility: 'public',
      departure_date: daysFromNow(18).split('T')[0],
      return_date: daysFromNow(21).split('T')[0],
      max_members: 8,
      budget_target: 120,
      group_level: 2,
      group_xp: 750,
      optimization_score: 88,
      created_at: daysAgo(14)
    },
    {
      id: gDemo3,
      owner_id: demoId,
      name: 'Traversée des Pyrénées (GR10 Est - Canigou)',
      description: '7 jours de haute montagne au départ de Mérens-les-Vals jusqu’à Banyuls-sur-Mer en passant par le sommet mythique du Canigou.',
      destination: 'Pyrénées-Orientales, France',
      country_iso: 'fr',
      theme: 'Haute Randonnée',
      visibility: 'public',
      departure_date: daysFromNow(75).split('T')[0],
      return_date: daysFromNow(82).split('T')[0],
      max_members: 6,
      budget_target: 350,
      group_level: 3,
      group_xp: 1200,
      optimization_score: 85,
      created_at: daysAgo(7)
    },

    // COMMUNITY GROUPS (BOUTEILLES À LA MER)
    {
      id: gOther1,
      owner_id: u1,
      name: 'Tour des Annapurnas en petit groupe (Automne 2026)',
      description: 'Recherche 3 compagnons de route pour partager un guide sherpa et les porteurs pour le sanctuaire des Annapurnas.',
      destination: 'Pokhara, Népal',
      country_iso: 'np',
      theme: 'Himalaya & Trek',
      visibility: 'public',
      departure_date: daysFromNow(110).split('T')[0],
      return_date: daysFromNow(130).split('T')[0],
      max_members: 5,
      budget_target: 1800,
      group_level: 5,
      group_xp: 2400,
      optimization_score: 95,
      created_at: daysAgo(20)
    },
    {
      id: gOther2,
      owner_id: u3,
      name: 'Stage Trail & D+ dans les Aiguilles Rouges',
      description: 'Week-end intensif de préparation trail à Chamonix : travail en montée avec bâtons, descentes techniques et récupération en refuge.',
      destination: 'Chamonix, France',
      country_iso: 'fr',
      theme: 'Stage Trail',
      visibility: 'public',
      departure_date: daysFromNow(25).split('T')[0],
      return_date: daysFromNow(28).split('T')[0],
      max_members: 6,
      budget_target: 220,
      group_level: 3,
      group_xp: 1100,
      optimization_score: 90,
      created_at: daysAgo(10)
    },
    {
      id: gOther3,
      owner_id: u5,
      name: 'Raid Kayak & Bivouac : Îles Chausey & Bréhat',
      description: '5 jours d’autonomie en kayak de mer dans l’archipel de Chausey. Navigation à marée, pêche au lancer et nuits sous tarp.',
      destination: 'Manche / Bretagne, France',
      country_iso: 'fr',
      theme: 'Kayak de Mer',
      visibility: 'public',
      departure_date: daysFromNow(60).split('T')[0],
      return_date: daysFromNow(65).split('T')[0],
      max_members: 4,
      budget_target: 280,
      group_level: 3,
      group_xp: 980,
      optimization_score: 86,
      created_at: daysAgo(12)
    }
  ];

  const { error: tgErr } = await supabase.from('travel_groups').upsert(travelGroups, { onConflict: 'id' });
  if (tgErr) console.error('Erreur travel_groups:', tgErr.message);
  else console.log(`✓ ${travelGroups.length} groupes d’expédition insérés.`);

  // 7. GROUP MEMBERS
  console.log('\n7. Insertion des membres des groupes...');
  const groupMembers = [
    // Islande (gDemo1)
    { group_id: gDemo1, user_id: demoId, role: 'organizer', status: 'active', joined_at: daysAgo(30) },
    { group_id: gDemo1, user_id: u1, role: 'member', status: 'active', joined_at: daysAgo(28) },
    { group_id: gDemo1, user_id: u2, role: 'member', status: 'active', joined_at: daysAgo(25) },
    { group_id: gDemo1, user_id: u3, role: 'member', status: 'active', joined_at: daysAgo(20) },
    { group_id: gDemo1, user_id: u7, role: 'member', status: 'pending', joined_at: daysAgo(2) },
    { group_id: gDemo1, user_id: u8, role: 'member', status: 'pending', joined_at: daysAgo(1) },

    // Volcans Auvergne (gDemo2)
    { group_id: gDemo2, user_id: demoId, role: 'organizer', status: 'active', joined_at: daysAgo(14) },
    { group_id: gDemo2, user_id: u4, role: 'member', status: 'active', joined_at: daysAgo(12) },
    { group_id: gDemo2, user_id: u5, role: 'member', status: 'active', joined_at: daysAgo(10) },
    { group_id: gDemo2, user_id: u6, role: 'member', status: 'active', joined_at: daysAgo(8) },

    // Pyrénées (gDemo3)
    { group_id: gDemo3, user_id: demoId, role: 'organizer', status: 'active', joined_at: daysAgo(7) },
    { group_id: gDemo3, user_id: u1, role: 'member', status: 'active', joined_at: daysAgo(5) },
    { group_id: gDemo3, user_id: u8, role: 'member', status: 'pending', joined_at: daysAgo(1) },

    // Népal (gOther1)
    { group_id: gOther1, user_id: u1, role: 'organizer', status: 'active', joined_at: daysAgo(20) },
    { group_id: gOther1, user_id: demoId, role: 'member', status: 'active', joined_at: daysAgo(18) },
    { group_id: gOther1, user_id: u3, role: 'member', status: 'active', joined_at: daysAgo(15) }
  ];

  const { error: gmErr } = await supabase.from('group_members').upsert(groupMembers, { onConflict: 'group_id,user_id' });
  if (gmErr) console.error('Erreur group_members:', gmErr.message);
  else console.log(`✓ ${groupMembers.length} membres de groupes insérés.`);

  // 8. GROUP TASKS
  console.log('\n8. Insertion des tâches d’expédition...');
  const groupTasks = [
    { group_id: gDemo1, created_by: demoId, assigned_to: demoId, title: 'Louer le 4x4 équipé tente de toit à Keflavík', status: 'done', due_date: daysFromNow(10).split('T')[0] },
    { group_id: gDemo1, created_by: demoId, assigned_to: u1, title: 'Acheter les cartouches de gaz Primus à Reykjavik', status: 'in_progress', due_date: daysFromNow(40).split('T')[0] },
    { group_id: gDemo1, created_by: demoId, assigned_to: u2, title: 'Télécharger les cartes topographiques hors-ligne (Locus/OSM)', status: 'done', due_date: daysFromNow(30).split('T')[0] },
    { group_id: gDemo1, created_by: demoId, assigned_to: u3, title: 'Vérifier la trousse de secours et pastilles Micropur', status: 'in_progress', due_date: daysFromNow(35).split('T')[0] },
    { group_id: gDemo1, created_by: demoId, assigned_to: demoId, title: 'Réserver la nuitée au refuge de Landmannalaugar', status: 'done', due_date: daysAgo(5).split('T')[0] },

    { group_id: gDemo2, created_by: demoId, assigned_to: demoId, title: 'Acheter les provisions lyophilisées pour 3 jours', status: 'in_progress', due_date: daysFromNow(12).split('T')[0] },
    { group_id: gDemo2, created_by: demoId, assigned_to: u4, title: 'Prévoir les tentes 2 places légères', status: 'done', due_date: daysFromNow(10).split('T')[0] }
  ];

  const { error: gtErr } = await supabase.from('group_tasks').insert(groupTasks);
  if (gtErr) console.warn('Notice group_tasks:', gtErr.message);
  else console.log(`✓ ${groupTasks.length} tâches insérées.`);

  // 9. GROUP EXPENSES
  console.log('\n9. Insertion des dépenses partagées d’expédition...');
  const groupExpenses = [
    { group_id: gDemo1, paid_by: demoId, title: 'Location 4x4 Dacia Duster équipé F-Roads (14 jours)', amount: 1850.00, category: 'Transport', status: 'settled', created_at: daysAgo(10) },
    { group_id: gDemo1, paid_by: u1, title: 'Ferry et accès parcs nationaux', amount: 320.00, category: 'Activité', status: 'settled', created_at: daysAgo(8) },
    { group_id: gDemo1, paid_by: u2, title: 'Courses d’avitaillement supermarché Bónus', amount: 480.00, category: 'Nourriture', status: 'settled', created_at: daysAgo(5) },
    { group_id: gDemo1, paid_by: demoId, title: 'Balise de détresse satellite Garmin inReach (Abonnement)', amount: 95.00, category: 'Sécurité', status: 'settled', created_at: daysAgo(3) },

    { group_id: gDemo2, paid_by: demoId, title: 'Gaz réchaud et snacks énergétiques', amount: 65.00, category: 'Nourriture', status: 'settled', created_at: daysAgo(4) }
  ];

  const { error: geErr } = await supabase.from('group_expenses').insert(groupExpenses);
  if (geErr) console.warn('Notice group_expenses:', geErr.message);
  else console.log(`✓ ${groupExpenses.length} dépenses insérées.`);

  // 10. GROUP MESSAGES
  console.log('\n10. Insertion des messages dans le chat d’expédition...');
  const groupMessages = [
    { group_id: gDemo1, user_id: demoId, content: 'Bienvenue à tous dans le cockpit de l’expédition Islande 2026 ! 🌋 J’ai mis à jour les points GPX et la checklist matériel.', created_at: daysAgo(28) },
    { group_id: gDemo1, user_id: u1, content: 'Super ! Est-ce qu’on prévoit des duvets confort -5°C ou -10°C pour les nuits en altitude ?', created_at: daysAgo(27) },
    { group_id: gDemo1, user_id: demoId, content: 'Je recommande confort -5°C minimum avec un drap de soie thermique. Les nuits à Hrafntinnusker peuvent geler même en août.', created_at: daysAgo(26) },
    { group_id: gDemo1, user_id: u2, content: 'Ça marche. J’ai vérifié les gués sur la F208 Sud, les niveaux d’eau sont praticables avec le Duster.', created_at: daysAgo(20) },
    { group_id: gDemo1, user_id: u3, content: 'Parfait ! J’apporte le filtre Katadyn et la trousse de secours complète.', created_at: daysAgo(15) },
    { group_id: gDemo1, user_id: demoId, content: 'Génial ! Je viens d’enregistrer la réservation du 4x4 dans l’onglet Budget.', created_at: daysAgo(10) },

    { group_id: gDemo2, user_id: demoId, content: 'Rdv samedi matin 8h30 au parking du col de la Croix Saint-Robert pour le départ Auvergne !', created_at: daysAgo(6) },
    { group_id: gDemo2, user_id: u4, content: 'Parfait Alexandre, on a chargé les deux tentes MSR légères dans mon coffre.', created_at: daysAgo(5) }
  ];

  const { error: gmMsgErr } = await supabase.from('group_messages').insert(groupMessages);
  if (gmMsgErr) console.warn('Notice group_messages:', gmMsgErr.message);
  else console.log(`✓ ${groupMessages.length} messages insérés.`);

  // 11. CARNET COMMENTS
  console.log('\n11. Insertion des commentaires sur les carnets...');
  const carnetComments = [
    { carnet_id: cDemo1, author_id: u1, content: 'Photos époustouflantes Alexandre ! Le passage de la rivière près d’Álftavatn était profond cette année ?', created_at: daysAgo(38) },
    { carnet_id: cDemo1, author_id: demoId, content: 'Merci Marie ! L’eau arrivait mi-cuisse vers 17h avec la fonte, il vaut mieux passer tôt le matin.', created_at: daysAgo(37) },
    { carnet_id: cDemo1, author_id: u3, content: 'Superbe carnet. Ton sac pesait combien au départ de Landmannalaugar ?', created_at: daysAgo(35) },
    { carnet_id: cDemo2, author_id: u2, content: 'Le TMB en autonomie complète, c’est le Graal ! Ton topo nutrition m’a beaucoup inspiré pour mon prochain raid.', created_at: daysAgo(50) },
    { carnet_id: cDemo2, author_id: u4, content: 'Respect pour les 170km en 8 jours. Bivouac au lac Blanc au lever du soleil... magique.', created_at: daysAgo(48) }
  ];

  const { error: ccErr } = await supabase.from('carnet_comments').insert(carnetComments);
  if (ccErr) console.warn('Notice carnet_comments:', ccErr.message);
  else console.log(`✓ ${carnetComments.length} commentaires de carnets insérés.`);

  // 12. CLUB TOPICS
  console.log('\n12. Insertion des topics dans les clubs...');
  const clubTopics = [
    {
      club_id: cl1,
      author_id: demoId,
      title: 'Bienvenue dans le club Trekkeurs des Alpes !',
      content: 'Bienvenue à tous les montagnards ! Partagez ici vos traces, vos retours de conditions et vos projets d’ascensions.',
      is_pinned: true,
      is_announcement: true,
      likes_count: 48,
      replies_count: 14,
      created_at: daysAgo(155)
    },
    {
      club_id: cl1,
      author_id: u1,
      title: 'Conditions neige & névés sur le Tour des Écrins (GR54)',
      content: 'Point météo et état des cols au 15 juillet : le col de la Vaurze et le col de l’Aup Martin nécessitent encore les crampons en début de matinée.',
      is_pinned: false,
      is_announcement: false,
      likes_count: 32,
      replies_count: 8,
      created_at: daysAgo(25)
    },
    {
      club_id: cl2,
      author_id: demoId,
      title: 'Guide F208 & Traversée des gués : Règle d’or en Islande',
      content: 'Ne jamais engager un gué sans repérer la trajectoire en aval. Enclencher le mode 4x4 low et avancer à vitesse constante sans créer de vague.',
      is_pinned: true,
      is_announcement: true,
      likes_count: 56,
      replies_count: 19,
      created_at: daysAgo(135)
    }
  ];

  const { error: ctErr } = await supabase.from('club_topics').insert(clubTopics);
  if (ctErr) console.warn('Notice club_topics:', ctErr.message);
  else console.log(`✓ ${clubTopics.length} topics de clubs insérés.`);

  console.log('\n======================================================');
  console.log('🎉 SEEDING MASSIF TERMINÉ AVEC SUCCÈS À 100% !');
  console.log('======================================================');
  console.log('Compte Démo : demo@lkdv.app / DemoPass!2026');
}

// Run if called directly via node
if (process.argv[1]?.endsWith('seed_massive_demo.mjs')) {
  runMassiveSeed().catch((err) => {
    console.error('Fatal error during seed:', err);
    process.exit(1);
  });
}
