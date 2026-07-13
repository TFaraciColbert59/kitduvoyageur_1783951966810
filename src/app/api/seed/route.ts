import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

// Route API pour insérer les données seed directement
// Accessible via POST /api/seed (protégée par un token secret)

const SEED_SECRET = process.env.SEED_SECRET || 'kitduvoyageur-seed-2026';

const u1  = 'a1000000-0000-0000-0000-000000000001';
const u2  = 'a1000000-0000-0000-0000-000000000002';
const u3  = 'a1000000-0000-0000-0000-000000000003';
const u4  = 'a1000000-0000-0000-0000-000000000004';
const u5  = 'a1000000-0000-0000-0000-000000000005';
const u6  = 'a1000000-0000-0000-0000-000000000006';
const u7  = 'a1000000-0000-0000-0000-000000000007';
const u8  = 'a1000000-0000-0000-0000-000000000008';
const u9  = 'a1000000-0000-0000-0000-000000000009';
const u10 = 'a1000000-0000-0000-0000-000000000010';
const u11 = 'a1000000-0000-0000-0000-000000000011';
const u12 = 'a1000000-0000-0000-0000-000000000012';

const c1  = 'b2000000-0000-0000-0000-000000000001';
const c2  = 'b2000000-0000-0000-0000-000000000002';
const c3  = 'b2000000-0000-0000-0000-000000000003';
const c4  = 'b2000000-0000-0000-0000-000000000004';
const c5  = 'b2000000-0000-0000-0000-000000000005';
const c6  = 'b2000000-0000-0000-0000-000000000006';
const c7  = 'b2000000-0000-0000-0000-000000000007';
const c8  = 'b2000000-0000-0000-0000-000000000008';

const cl1 = 'c3000000-0000-0000-0000-000000000001';
const cl2 = 'c3000000-0000-0000-0000-000000000002';
const cl3 = 'c3000000-0000-0000-0000-000000000003';
const cl4 = 'c3000000-0000-0000-0000-000000000004';
const cl5 = 'c3000000-0000-0000-0000-000000000005';

const t1  = 'd4000000-0000-0000-0000-000000000001';
const t2  = 'd4000000-0000-0000-0000-000000000002';
const t3  = 'd4000000-0000-0000-0000-000000000003';
const t4  = 'd4000000-0000-0000-0000-000000000004';
const t5  = 'd4000000-0000-0000-0000-000000000005';
const t6  = 'd4000000-0000-0000-0000-000000000006';

const ch1 = 'e5000000-0000-0000-0000-000000000001';
const ch2 = 'e5000000-0000-0000-0000-000000000002';
const ch3 = 'e5000000-0000-0000-0000-000000000003';

const ev1 = 'f6000000-0000-0000-0000-000000000001';
const ev2 = 'f6000000-0000-0000-0000-000000000002';
const ev3 = 'f6000000-0000-0000-0000-000000000003';

const p1  = 'a7000000-0000-0000-0000-000000000001';
const p2  = 'a7000000-0000-0000-0000-000000000002';
const p3  = 'a7000000-0000-0000-0000-000000000003';
const p4  = 'a7000000-0000-0000-0000-000000000004';
const p5  = 'a7000000-0000-0000-0000-000000000005';
const p6  = 'a7000000-0000-0000-0000-000000000006';
const p7  = 'a7000000-0000-0000-0000-000000000007';
const p8  = 'a7000000-0000-0000-0000-000000000008';
const p9  = 'a7000000-0000-0000-0000-000000000009';
const p10 = 'a7000000-0000-0000-0000-000000000010';

const q1  = 'b8000000-0000-0000-0000-000000000001';
const q2  = 'b8000000-0000-0000-0000-000000000002';
const q3  = 'b8000000-0000-0000-0000-000000000003';
const q4  = 'b8000000-0000-0000-0000-000000000004';
const q5  = 'b8000000-0000-0000-0000-000000000005';
const qa1 = 'c9000000-0000-0000-0000-000000000001';
const qa2 = 'c9000000-0000-0000-0000-000000000002';
const qa3 = 'c9000000-0000-0000-0000-000000000003';
const qa4 = 'c9000000-0000-0000-0000-000000000004';
const qa5 = 'c9000000-0000-0000-0000-000000000005';
const qa6 = 'c9000000-0000-0000-0000-000000000006';

const ama1  = 'd0000000-0000-0000-0000-000000000001';
const ama2  = 'd0000000-0000-0000-0000-000000000002';
const amaq1 = 'e1000000-0000-0000-0000-000000000001';
const amaq2 = 'e1000000-0000-0000-0000-000000000002';
const amaq3 = 'e1000000-0000-0000-0000-000000000003';
const amaq4 = 'e1000000-0000-0000-0000-000000000004';

const oc1 = 'f2000000-0000-0000-0000-000000000001';
const oc2 = 'f2000000-0000-0000-0000-000000000002';
const oc3 = 'f2000000-0000-0000-0000-000000000003';
const oc4 = 'f2000000-0000-0000-0000-000000000004';
const oc5 = 'f2000000-0000-0000-0000-000000000005';
const au1 = 'a3000000-0000-0000-0000-000000000001';
const au2 = 'a3000000-0000-0000-0000-000000000002';
const au3 = 'a3000000-0000-0000-0000-000000000003';
const re1 = 'b4000000-0000-0000-0000-000000000001';
const re2 = 'b4000000-0000-0000-0000-000000000002';
const re3 = 'b4000000-0000-0000-0000-000000000003';
const re4 = 'b4000000-0000-0000-0000-000000000004';

function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString();
}

function daysFromNow(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString();
}

export async function POST(request: Request) {
  const { searchParams } = new URL(request.url);
  const secret = searchParams.get('secret');

  if (secret !== SEED_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Use service role key for bypassing RLS
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const results: Record<string, unknown> = {};

  // 1. USER PROFILES
  const { error: upErr } = await supabase.from('user_profiles').upsert([
    { id: u1,  email: 'marie.dupont@email.fr',    full_name: 'Marie Dupont',    avatar_url: 'https://i.pravatar.cc/150?img=1',  trust_score: 92, loyalty_points: 3450, loyalty_level: 'Explorateur Elite', created_at: daysAgo(180) },
    { id: u2,  email: 'thomas.martin@email.fr',   full_name: 'Thomas Martin',   avatar_url: 'https://i.pravatar.cc/150?img=2',  trust_score: 88, loyalty_points: 2800, loyalty_level: 'Aventurier',        created_at: daysAgo(150) },
    { id: u3,  email: 'sophie.bernard@email.fr',  full_name: 'Sophie Bernard',  avatar_url: 'https://i.pravatar.cc/150?img=3',  trust_score: 85, loyalty_points: 2200, loyalty_level: 'Aventurier',        created_at: daysAgo(120) },
    { id: u4,  email: 'lucas.petit@email.fr',     full_name: 'Lucas Petit',     avatar_url: 'https://i.pravatar.cc/150?img=4',  trust_score: 79, loyalty_points: 1650, loyalty_level: 'Explorateur',       created_at: daysAgo(90)  },
    { id: u5,  email: 'camille.leroy@email.fr',   full_name: 'Camille Leroy',   avatar_url: 'https://i.pravatar.cc/150?img=5',  trust_score: 74, loyalty_points: 1200, loyalty_level: 'Explorateur',       created_at: daysAgo(75)  },
    { id: u6,  email: 'antoine.moreau@email.fr',  full_name: 'Antoine Moreau',  avatar_url: 'https://i.pravatar.cc/150?img=6',  trust_score: 68, loyalty_points:  890, loyalty_level: 'Explorateur',       created_at: daysAgo(60)  },
    { id: u7,  email: 'julie.simon@email.fr',     full_name: 'Julie Simon',     avatar_url: 'https://i.pravatar.cc/150?img=7',  trust_score: 65, loyalty_points:  720, loyalty_level: 'Découvreur',        created_at: daysAgo(45)  },
    { id: u8,  email: 'maxime.garcia@email.fr',   full_name: 'Maxime Garcia',   avatar_url: 'https://i.pravatar.cc/150?img=8',  trust_score: 61, loyalty_points:  540, loyalty_level: 'Découvreur',        created_at: daysAgo(30)  },
    { id: u9,  email: 'lea.roux@email.fr',        full_name: 'Léa Roux',        avatar_url: 'https://i.pravatar.cc/150?img=9',  trust_score: 58, loyalty_points:  380, loyalty_level: 'Découvreur',        created_at: daysAgo(20)  },
    { id: u10, email: 'nicolas.blanc@email.fr',   full_name: 'Nicolas Blanc',   avatar_url: 'https://i.pravatar.cc/150?img=10', trust_score: 55, loyalty_points:  210, loyalty_level: 'Novice',            created_at: daysAgo(15)  },
    { id: u11, email: 'emma.henry@email.fr',      full_name: 'Emma Henry',      avatar_url: 'https://i.pravatar.cc/150?img=11', trust_score: 52, loyalty_points:  120, loyalty_level: 'Novice',            created_at: daysAgo(10)  },
    { id: u12, email: 'pierre.lambert@email.fr',  full_name: 'Pierre Lambert',  avatar_url: 'https://i.pravatar.cc/150?img=12', trust_score: 50, loyalty_points:   60, loyalty_level: 'Novice',            created_at: daysAgo(5)   },
  ], { onConflict: 'id' });
  results.user_profiles = upErr ? upErr.message : 'ok';

  // 2. FOLLOWS
  const { error: followErr } = await supabase.from('user_follows').upsert([
    { follower_id: u2, following_id: u1, created_at: daysAgo(140) },
    { follower_id: u3, following_id: u1, created_at: daysAgo(110) },
    { follower_id: u4, following_id: u1, created_at: daysAgo(80)  },
    { follower_id: u5, following_id: u1, created_at: daysAgo(60)  },
    { follower_id: u1, following_id: u2, created_at: daysAgo(130) },
    { follower_id: u3, following_id: u2, created_at: daysAgo(100) },
    { follower_id: u1, following_id: u3, created_at: daysAgo(115) },
    { follower_id: u2, following_id: u3, created_at: daysAgo(95)  },
    { follower_id: u5, following_id: u3, created_at: daysAgo(55)  },
  ], { onConflict: 'follower_id,following_id', ignoreDuplicates: true });
  results.user_follows = followErr ? followErr.message : 'ok';

  // 3. CARNETS
  const { error: carnetsErr } = await supabase.from('carnets').upsert([
    { id: c1, author_id: u1, title: 'Trek au Népal : Tour des Annapurnas', destination: 'Népal', description: 'Un périple inoubliable de 21 jours autour du massif des Annapurnas. Cols à plus de 5000m, villages sherpa authentiques.', cover_image: 'https://images.unsplash.com/photo-1544735716-392fe2489ffa?w=800', cover_image_alt: 'Vue panoramique sur les sommets enneigés des Annapurnas', start_date: '2025-10-01', end_date: '2025-10-21', weather: 'Ensoleillé avec quelques chutes de neige', route_rating: 4.8, visibility: 'public', tags: ['népal','trek','haute altitude','annapurnas'], map_points: [], is_collaborative: false, likes_count: 127, comments_count: 34, favorites_count: 89, views_count: 2840, verified: true, created_at: daysAgo(60) },
    { id: c2, author_id: u2, title: 'Traversée des Pyrénées en VTT', destination: 'Pyrénées, France/Espagne', description: 'La traversée complète des Pyrénées à vélo tout-terrain en 18 jours.', cover_image: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800', cover_image_alt: 'Cycliste sur un sentier de montagne dans les Pyrénées', start_date: '2025-07-15', end_date: '2025-08-02', weather: 'Beau temps dominant', route_rating: 4.6, visibility: 'public', tags: ['vélo','pyrénées','bikepacking'], map_points: [], is_collaborative: false, likes_count: 98, comments_count: 28, favorites_count: 67, views_count: 1920, verified: true, created_at: daysAgo(45) },
    { id: c3, author_id: u3, title: 'Randonnée en Islande : Laugavegur Trail', destination: 'Islande', description: 'Le sentier Laugavegur, 55km de paysages lunaires entre volcans et geysers.', cover_image: 'https://images.unsplash.com/photo-1504893524553-b855bce32c67?w=800', cover_image_alt: 'Paysage volcanique islandais avec vapeurs géothermiques', start_date: '2025-08-10', end_date: '2025-08-15', weather: 'Vent fort, pluie intermittente', route_rating: 4.9, visibility: 'public', tags: ['islande','randonnée','volcans'], map_points: [], is_collaborative: true, likes_count: 156, comments_count: 42, favorites_count: 112, views_count: 3210, verified: true, created_at: daysAgo(35) },
    { id: c4, author_id: u4, title: 'Ski de randonnée dans les Alpes', destination: 'Alpes françaises', description: 'Semaine de ski de rando dans le massif du Mont-Blanc.', cover_image: 'https://images.unsplash.com/photo-1551698618-1dfe5d97d256?w=800', cover_image_alt: 'Skieur de randonnée avec le Mont Blanc en arrière-plan', start_date: '2025-02-20', end_date: '2025-02-27', weather: 'Grand froid (-20°C au sommet)', route_rating: 4.7, visibility: 'public', tags: ['ski','alpes','mont-blanc'], map_points: [], is_collaborative: false, likes_count: 84, comments_count: 19, favorites_count: 58, views_count: 1650, verified: false, created_at: daysAgo(25) },
    { id: c5, author_id: u5, title: 'Kayak de mer en Bretagne', destination: 'Bretagne, France', description: 'Tour de la presqu\'île de Crozon en kayak de mer sur 7 jours.', cover_image: 'https://images.unsplash.com/photo-1544551763-46a013bb70d5?w=800', cover_image_alt: 'Kayakiste pagayant dans une crique bretonne', start_date: '2025-06-01', end_date: '2025-06-07', weather: 'Mer belle à peu agitée', route_rating: 4.5, visibility: 'public', tags: ['kayak','bretagne','mer'], map_points: [], is_collaborative: false, likes_count: 73, comments_count: 22, favorites_count: 45, views_count: 1380, verified: false, created_at: daysAgo(20) },
    { id: c6, author_id: u1, title: 'Traversée du Sahara à pied', destination: 'Maroc/Algérie', description: 'Expédition de 14 jours à travers les dunes de l\'Erg Chebbi.', cover_image: 'https://images.unsplash.com/photo-1509316785289-025f5b846b35?w=800', cover_image_alt: 'Randonneur marchant sur une dune au coucher du soleil', start_date: '2025-03-05', end_date: '2025-03-19', weather: 'Chaleur extrême (45°C le jour)', route_rating: 4.9, visibility: 'public', tags: ['sahara','désert','maroc'], map_points: [], is_collaborative: false, likes_count: 203, comments_count: 56, favorites_count: 145, views_count: 4120, verified: true, created_at: daysAgo(15) },
    { id: c7, author_id: u6, title: 'Via Ferrata dans les Dolomites', destination: 'Dolomites, Italie', description: 'Semaine de via ferrata dans les Dolomites italiennes.', cover_image: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800', cover_image_alt: 'Grimpeur sur une via ferrata avec vue sur les Dolomites', start_date: '2025-09-08', end_date: '2025-09-14', weather: 'Beau temps', route_rating: 4.4, visibility: 'public', tags: ['via-ferrata','dolomites','escalade'], map_points: [], is_collaborative: false, likes_count: 61, comments_count: 15, favorites_count: 38, views_count: 1120, verified: false, created_at: daysAgo(10) },
    { id: c8, author_id: u3, title: 'Ultratrail du Mont-Blanc : Préparation et récit', destination: 'Chamonix, France', description: 'Mon aventure à l\'UTMB 2025 : 171km et 10 000m de dénivelé positif.', cover_image: 'https://images.unsplash.com/photo-1571008887538-b36bb32f4571?w=800', cover_image_alt: 'Coureur de trail sur un sentier de montagne près de Chamonix', start_date: '2025-08-25', end_date: '2025-08-30', weather: 'Variable : soleil, pluie, neige', route_rating: 5.0, visibility: 'public', tags: ['utmb','trail','chamonix'], map_points: [], is_collaborative: true, likes_count: 312, comments_count: 78, favorites_count: 198, views_count: 6540, verified: true, created_at: daysAgo(5) },
  ], { onConflict: 'id' });
  results.carnets = carnetsErr ? carnetsErr.message : 'ok';

  // 4. CARNET LIKES
  const { error: clErr } = await supabase.from('carnet_likes').upsert([
    { carnet_id: c1, user_id: u2, reaction: 'heart',  created_at: daysAgo(58) },
    { carnet_id: c1, user_id: u3, reaction: 'fire',   created_at: daysAgo(55) },
    { carnet_id: c1, user_id: u4, reaction: 'bag',    created_at: daysAgo(50) },
    { carnet_id: c3, user_id: u1, reaction: 'fire',   created_at: daysAgo(33) },
    { carnet_id: c3, user_id: u2, reaction: 'heart',  created_at: daysAgo(30) },
    { carnet_id: c6, user_id: u2, reaction: 'fire',   created_at: daysAgo(13) },
    { carnet_id: c6, user_id: u3, reaction: 'heart',  created_at: daysAgo(12) },
    { carnet_id: c8, user_id: u1, reaction: 'fire',   created_at: daysAgo(4)  },
    { carnet_id: c8, user_id: u2, reaction: 'heart',  created_at: daysAgo(4)  },
  ], { onConflict: 'carnet_id,user_id', ignoreDuplicates: true });
  results.carnet_likes = clErr ? clErr.message : 'ok';

  // 5. CARNET COMMENTS
  const { error: ccErr } = await supabase.from('carnet_comments').insert([
    { carnet_id: c1, author_id: u2, content: 'Incroyable récit ! Le col Thorong La reste un des moments les plus intenses de ma vie.', likes_count: 12, created_at: daysAgo(57) },
    { carnet_id: c1, author_id: u3, content: 'Quel kit as-tu utilisé pour les nuits en altitude ? Je prépare le même trek.', likes_count: 5, created_at: daysAgo(55) },
    { carnet_id: c3, author_id: u1, content: 'Le Laugavegur est sur ma liste depuis des années. Combien de kg portais-tu ?', likes_count: 9, created_at: daysAgo(32) },
    { carnet_id: c6, author_id: u2, content: 'Traversée du Sahara... quel courage. Comment tu as géré la chaleur ?', likes_count: 18, created_at: daysAgo(14) },
    { carnet_id: c8, author_id: u2, content: 'UTMB 2025 ! Bravo pour cette performance. Le récit heure par heure est captivant.', likes_count: 24, created_at: daysAgo(4) },
    { carnet_id: c8, author_id: u4, content: 'Merci pour les détails sur la nutrition. Je prépare mon premier 100km.', likes_count: 16, created_at: daysAgo(3) },
  ]).select();
  results.carnet_comments = ccErr ? ccErr.message : 'ok';

  // 6. CARNET FAVORITES
  const { error: cfErr } = await supabase.from('carnet_favorites').upsert([
    { carnet_id: c1, user_id: u2, created_at: daysAgo(58) },
    { carnet_id: c1, user_id: u3, created_at: daysAgo(55) },
    { carnet_id: c3, user_id: u1, created_at: daysAgo(33) },
    { carnet_id: c6, user_id: u2, created_at: daysAgo(14) },
    { carnet_id: c8, user_id: u1, created_at: daysAgo(4)  },
    { carnet_id: c8, user_id: u2, created_at: daysAgo(4)  },
  ], { onConflict: 'carnet_id,user_id', ignoreDuplicates: true });
  results.carnet_favorites = cfErr ? cfErr.message : 'ok';

  // 7. CLUBS
  const { error: clubsErr } = await supabase.from('clubs').upsert([
    { id: cl1, slug: 'trekkeurs-alpes',      name: 'Trekkeurs des Alpes',  type: 'activité', emoji: '🏔️', description: 'Club dédié aux passionnés de randonnée et trekking dans les Alpes.', cover_color: 'from-blue-600 to-indigo-700',   category: 'Randonnée',    rules: 'Respectez les autres membres.', privacy: 'open', members_count: 847, active_this_month: 234, is_verified: true,  created_by: u1, created_at: daysAgo(150) },
    { id: cl2, slug: 'bikepacking-france',   name: 'Bikepacking France',   type: 'activité', emoji: '🚵', description: 'La communauté française du bikepacking.', cover_color: 'from-green-600 to-emerald-700',  category: 'Cyclisme',     rules: 'Bienveillance obligatoire.', privacy: 'open', members_count: 523, active_this_month: 178, is_verified: true,  created_by: u2, created_at: daysAgo(120) },
    { id: cl3, slug: 'kayak-mer-atlantique', name: 'Kayak Mer Atlantique', type: 'activité', emoji: '🚣', description: 'Club des kayakistes de mer sur la façade atlantique.', cover_color: 'from-cyan-600 to-blue-700',    category: 'Kayak',        rules: 'Sécurité en mer avant tout.', privacy: 'open', members_count: 312, active_this_month: 89,  is_verified: false, created_by: u5, created_at: daysAgo(90)  },
    { id: cl4, slug: 'ultra-trail-runners',  name: 'Ultra Trail Runners',  type: 'activité', emoji: '🏃', description: 'Pour les coureurs de trail et d\'ultra-trail.', cover_color: 'from-orange-600 to-red-700',    category: 'Course à pied', rules: 'Respect des niveaux de chacun.', privacy: 'open', members_count: 689, active_this_month: 312, is_verified: true,  created_by: u3, created_at: daysAgo(100) },
    { id: cl5, slug: 'voyageurs-maroc',      name: 'Voyageurs du Maroc',   type: 'pays',     emoji: '🇲🇦', description: 'Communauté des voyageurs passionnés par le Maroc.', cover_color: 'from-amber-600 to-orange-700', category: 'Voyage',       rules: 'Respect de la culture locale.', privacy: 'open', members_count: 428, active_this_month: 156, is_verified: false, created_by: u1, created_at: daysAgo(80)  },
  ], { onConflict: 'id' });
  results.clubs = clubsErr ? clubsErr.message : 'ok';

  // 8. CLUB MEMBERS
  const { error: cmErr } = await supabase.from('club_members').upsert([
    { club_id: cl1, user_id: u1, role: 'admin',     status: 'active', joined_at: daysAgo(150) },
    { club_id: cl1, user_id: u2, role: 'moderator', status: 'active', joined_at: daysAgo(140) },
    { club_id: cl1, user_id: u3, role: 'member',    status: 'active', joined_at: daysAgo(110) },
    { club_id: cl1, user_id: u4, role: 'member',    status: 'active', joined_at: daysAgo(85)  },
    { club_id: cl1, user_id: u5, role: 'member',    status: 'active', joined_at: daysAgo(70)  },
    { club_id: cl2, user_id: u2, role: 'admin',     status: 'active', joined_at: daysAgo(120) },
    { club_id: cl2, user_id: u1, role: 'member',    status: 'active', joined_at: daysAgo(115) },
    { club_id: cl2, user_id: u4, role: 'moderator', status: 'active', joined_at: daysAgo(90)  },
    { club_id: cl3, user_id: u5, role: 'admin',     status: 'active', joined_at: daysAgo(90)  },
    { club_id: cl3, user_id: u7, role: 'member',    status: 'active', joined_at: daysAgo(35)  },
    { club_id: cl4, user_id: u3, role: 'admin',     status: 'active', joined_at: daysAgo(100) },
    { club_id: cl4, user_id: u1, role: 'moderator', status: 'active', joined_at: daysAgo(95)  },
    { club_id: cl4, user_id: u2, role: 'member',    status: 'active', joined_at: daysAgo(80)  },
    { club_id: cl5, user_id: u1, role: 'admin',     status: 'active', joined_at: daysAgo(80)  },
    { club_id: cl5, user_id: u3, role: 'member',    status: 'active', joined_at: daysAgo(75)  },
  ], { onConflict: 'club_id,user_id', ignoreDuplicates: true });
  results.club_members = cmErr ? cmErr.message : 'ok';

  // 9. CLUB TOPICS
  const { error: ctErr } = await supabase.from('club_topics').upsert([
    { id: t1, club_id: cl1, author_id: u1, title: 'Bienvenue dans le club Trekkeurs des Alpes !', content: 'Bonjour à tous ! Ce club est l\'endroit idéal pour partager vos aventures alpines.', is_pinned: true,  is_announcement: true,  is_approved: true, likes_count: 45, replies_count: 67, created_at: daysAgo(148) },
    { id: t2, club_id: cl1, author_id: u2, title: 'Itinéraire GR5 : conseils pour la section Lac Léman - Nice', content: 'Je prépare la traversée complète du GR5. Des retours sur les refuges ?', is_pinned: false, is_announcement: false, is_approved: true, likes_count: 23, replies_count: 18, created_at: daysAgo(30)  },
    { id: t3, club_id: cl1, author_id: u3, title: 'Comparatif chaussures de randonnée 2025', content: 'Entre les Salomon X Ultra 4 et les Hoka Anacapa, vous conseillez quoi ?', is_pinned: false, is_announcement: false, is_approved: true, likes_count: 31, replies_count: 24, created_at: daysAgo(15)  },
    { id: t4, club_id: cl2, author_id: u2, title: 'Sortie bikepacking Pyrénées - Juillet 2026', content: 'On organise une traversée des Pyrénées en groupe. Qui est partant ?', is_pinned: true,  is_announcement: true,  is_approved: true, likes_count: 38, replies_count: 29, created_at: daysAgo(45)  },
    { id: t5, club_id: cl4, author_id: u3, title: 'Retour UTMB 2025 - Analyse et conseils', content: 'Je viens de terminer l\'UTMB en 38h12. Je partage mon analyse complète.', is_pinned: false, is_announcement: false, is_approved: true, likes_count: 67, replies_count: 45, created_at: daysAgo(5)   },
    { id: t6, club_id: cl5, author_id: u1, title: 'Traversée du Sahara : guide complet', content: 'Je compile tous les conseils pratiques pour une traversée en sécurité.', is_pinned: true,  is_announcement: false, is_approved: true, likes_count: 52, replies_count: 31, created_at: daysAgo(12)  },
  ], { onConflict: 'id' });
  results.club_topics = ctErr ? ctErr.message : 'ok';

  // 10. CLUB TOPIC REPLIES
  const { error: ctrErr } = await supabase.from('club_topic_replies').insert([
    { topic_id: t1, author_id: u2, content: 'Bonjour ! Thomas ici, passionné de randonnée depuis 15 ans.', is_approved: true, likes_count: 8,  created_at: daysAgo(147) },
    { topic_id: t1, author_id: u3, content: 'Sophie, randonneuse et coureuse de trail. Ravie de rejoindre cette communauté !', is_approved: true, likes_count: 6,  created_at: daysAgo(145) },
    { topic_id: t2, author_id: u4, content: 'J\'ai fait le GR5 complet en 2023. Réserve le Refuge de la Vanoise 3 mois à l\'avance.', is_approved: true, likes_count: 15, created_at: daysAgo(28)  },
    { topic_id: t3, author_id: u1, content: 'J\'ai les Salomon X Ultra 4 depuis 2 ans, environ 800km. Excellentes sur terrain mixte.', is_approved: true, likes_count: 18, created_at: daysAgo(14)  },
    { topic_id: t5, author_id: u2, content: 'Bravo pour cette performance ! Comment tu as géré le sommeil sur la montée du Grand Col Ferret ?', is_approved: true, likes_count: 22, created_at: daysAgo(4)   },
  ]).select();
  results.club_topic_replies = ctrErr ? ctrErr.message : 'ok';

  // 11. CLUB CHALLENGES
  const { error: chErr } = await supabase.from('club_challenges').upsert([
    { id: ch1, club_id: cl1, title: 'Défi 3 Cols en 3 Jours', description: 'Réalisez 3 cols alpins de plus de 2500m en 3 jours consécutifs.', xp: 500,  deadline: daysFromNow(60),  active: true, created_at: daysAgo(20) },
    { id: ch2, club_id: cl4, title: 'Challenge 1000km de trail en 2026', description: 'Courez 1000km de trail cumulés avant le 31 décembre 2026.', xp: 1000, deadline: daysFromNow(170), active: true, created_at: daysAgo(10) },
    { id: ch3, club_id: cl2, title: 'Bikepacking Solo 500km', description: 'Réalisez un voyage bikepacking en solo d\'au moins 500km en une semaine.', xp: 750,  deadline: daysFromNow(90),  active: true, created_at: daysAgo(15) },
  ], { onConflict: 'id' });
  results.club_challenges = chErr ? chErr.message : 'ok';

  // 12. CLUB EVENTS
  const { error: evErr } = await supabase.from('club_events').upsert([
    { id: ev1, club_id: cl1, organizer_id: u1, title: 'Sortie collective Tour du Beaufortain', description: 'Randonnée de 3 jours autour du massif du Beaufortain.', event_date: daysFromNow(45), location: 'Beaufort, Savoie',                max_participants: 12, participants_count: 8,  created_at: daysAgo(20) },
    { id: ev2, club_id: cl4, organizer_id: u3, title: 'Entraînement trail nocturne - Fontainebleau', description: 'Sortie trail nocturne de 25km dans la forêt de Fontainebleau.', event_date: daysFromNow(15), location: 'Fontainebleau, Seine-et-Marne', max_participants: 20, participants_count: 14, created_at: daysAgo(10) },
    { id: ev3, club_id: cl2, organizer_id: u2, title: 'Atelier bikepacking débutants - Paris', description: 'Journée d\'initiation au bikepacking.', event_date: daysFromNow(30), location: 'Paris, 11ème arrondissement',  max_participants: 15, participants_count: 11, created_at: daysAgo(8)  },
  ], { onConflict: 'id' });
  results.club_events = evErr ? evErr.message : 'ok';

  // 13. COMMUNITY POSTS
  const { error: postsErr } = await supabase.from('community_posts').upsert([
    { id: p1,  author_id: u1, content: 'Retour de 3 semaines au Népal ! Le Tour des Annapurnas reste l\'expérience la plus intense de ma vie. 21 jours, 160km, 7000m de dénivelé. Mon kit ultraléger de 8kg a été parfait. 🎒', image_url: 'https://images.unsplash.com/photo-1544735716-392fe2489ffa?w=600', image_alt: 'Panorama sur les Annapurnas', post_type: 'share',    likes_count: 127, comments_count: 34, shares_count: 23, is_trending: true,  created_at: daysAgo(58) },
    { id: p2,  author_id: u2, content: 'Conseil du jour 🚵 Pour votre premier bikepacking, commencez par un week-end de 2 jours max. La légèreté, c\'est la liberté.', image_url: null, image_alt: null, post_type: 'tip',     likes_count: 98,  comments_count: 28, shares_count: 15, is_trending: true,  created_at: daysAgo(45) },
    { id: p3,  author_id: u3, content: 'Question pour les ultra-traileurs : comment gérez-vous la nutrition sur les courses de plus de 24h ? Des solutions ?', image_url: null, image_alt: null, post_type: 'question', likes_count: 45,  comments_count: 67, shares_count: 8,  is_trending: false, created_at: daysAgo(30) },
    { id: p4,  author_id: u4, content: 'Magnifique semaine de ski de rando dans le massif du Mont-Blanc. La Vallée Blanche en conditions hivernales, c\'est une autre dimension ❄️', image_url: 'https://images.unsplash.com/photo-1551698618-1dfe5d97d256?w=600', image_alt: 'Skieurs de randonnée sur glacier', post_type: 'post',    likes_count: 84,  comments_count: 19, shares_count: 12, is_trending: false, created_at: daysAgo(23) },
    { id: p5,  author_id: u5, content: 'Astuce kayak 🚣 Pour les sorties en mer, toujours vérifier les coefficients de marée ET la météo marine 48h à l\'avance. La sécurité avant l\'aventure !', image_url: null, image_alt: null, post_type: 'tip',     likes_count: 73,  comments_count: 22, shares_count: 19, is_trending: false, created_at: daysAgo(18) },
    { id: p6,  author_id: u1, content: 'Traversée du Sahara terminée ! 14 jours, 380km à pied dans les dunes et les regs. Une expérience qui change une vie. Le silence du désert la nuit, les étoiles... 🌟', image_url: 'https://images.unsplash.com/photo-1509316785289-025f5b846b35?w=600', image_alt: 'Randonneur au sommet d\'une dune au coucher du soleil', post_type: 'share',    likes_count: 203, comments_count: 56, shares_count: 41, is_trending: true,  created_at: daysAgo(13) },
    { id: p7,  author_id: u6, content: 'Via ferrata dans les Dolomites : 5 itinéraires en 7 jours. Les Dolomites sont le terrain de jeu ultime pour les amateurs de verticalité.', image_url: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=600', image_alt: 'Vue depuis une via ferrata sur les Dolomites', post_type: 'question', likes_count: 61,  comments_count: 15, shares_count: 9,  is_trending: false, created_at: daysAgo(9)  },
    { id: p8,  author_id: u3, content: 'UTMB 2025 : 38h12 de bonheur et de souffrance. 171km, 10 000m D+, 2 nuits sans dormir. Je publie mon récit complet demain. Stay tuned ! 🏃‍♀️🔥', image_url: 'https://images.unsplash.com/photo-1571008887538-b36bb32f4571?w=600', image_alt: 'Coureuse franchissant la ligne d\'arrivée de l\'UTMB', post_type: 'share',    likes_count: 312, comments_count: 78, shares_count: 67, is_trending: true,  created_at: daysAgo(4)  },
    { id: p9,  author_id: u7, content: 'Première sortie surf de la saison à Hossegor ! Les vagues étaient parfaites ce matin, 1.5m bien formées. 🏄', image_url: 'https://images.unsplash.com/photo-1502680390469-be75c86b636f?w=600', image_alt: 'Surfeur sur une vague à Hossegor', post_type: 'post',    likes_count: 48,  comments_count: 11, shares_count: 7,  is_trending: false, created_at: daysAgo(2)  },
    { id: p10, author_id: u8, content: 'Conseil équipement : j\'ai testé la tente MSR Hubba Hubba NX pendant 3 semaines en Écosse. Imperméable même sous des pluies torrentielles, montage en 3 minutes, 1.7kg.', image_url: null, image_alt: null, post_type: 'tip',     likes_count: 56,  comments_count: 18, shares_count: 14, is_trending: false, created_at: daysAgo(1)  },
  ], { onConflict: 'id' });
  results.community_posts = postsErr ? postsErr.message : 'ok';

  // 14. POST COMMENTS
  const { error: pcErr } = await supabase.from('post_comments').insert([
    { post_id: p1, author_id: u2, content: 'Félicitations pour cette aventure ! Tu as utilisé quel sac à dos ?', likes_count: 8,  created_at: daysAgo(57) },
    { post_id: p1, author_id: u3, content: 'Incroyable ! 8kg de kit pour 21 jours, c\'est impressionnant.', likes_count: 12, created_at: daysAgo(56) },
    { post_id: p3, author_id: u1, content: 'Pour la nutrition après 15h : passer au salé ! Chips, fromage, charcuterie.', likes_count: 24, created_at: daysAgo(29) },
    { post_id: p6, author_id: u2, content: 'Traversée du Sahara... tu es une légende ! J\'attends le carnet complet.', likes_count: 15, created_at: daysAgo(12) },
    { post_id: p8, author_id: u2, content: 'BRAVO ! 38h12 c\'est une performance exceptionnelle.', likes_count: 28, created_at: daysAgo(3)  },
    { post_id: p8, author_id: u4, content: 'Récit attendu avec impatience ! Tes posts pendant la course étaient captivants.', likes_count: 19, created_at: daysAgo(3)  },
  ]).select();
  results.post_comments = pcErr ? pcErr.message : 'ok';

  // 15. QA QUESTIONS
  const { error: qaQErr } = await supabase.from('qa_questions').upsert([
    { id: q1, author_id: u4,  title: 'Quelle tente pour le trek en haute altitude (>4000m) ?', content: 'Je prépare un trek au Népal avec des nuits à plus de 4000m. Budget max 600€.', tags: ['tente','haute-altitude','népal'], category: 'équipement', votes_count: 34, answers_count: 5, views_count: 892,  is_solved: true,  created_at: daysAgo(40) },
    { id: q2, author_id: u7,  title: 'Comment prévenir les ampoules en randonnée longue distance ?', content: 'Je pars sur le Chemin de Compostelle (800km) dans 2 mois.', tags: ['ampoules','chaussures','prévention'], category: 'santé', votes_count: 28, answers_count: 7, views_count: 1240, is_solved: true,  created_at: daysAgo(25) },
    { id: q3, author_id: u9,  title: 'Meilleur GPS pour le trail et la randonnée en 2025 ?', content: 'Hésitation entre Garmin Fenix 8, Suunto Vertical et Coros Vertix 3.', tags: ['gps','montre','garmin'], category: 'équipement', votes_count: 41, answers_count: 6, views_count: 1580, is_solved: false, created_at: daysAgo(15) },
    { id: q4, author_id: u10, title: 'Comment gérer la nourriture sur un trek de 10 jours en autonomie ?', content: 'Comment calculer les rations ? Quels aliments privilégier ?', tags: ['nutrition','autonomie','trek'], category: 'nutrition', votes_count: 22, answers_count: 4, views_count: 756,  is_solved: false, created_at: daysAgo(8)  },
    { id: q5, author_id: u11, title: 'Sac à dos 40L ou 60L pour un trek de 2 semaines ?', content: 'Je pars 2 semaines en Norvège. Je vise le ultralight mais c\'est mon premier trek long.', tags: ['sac-à-dos','ultralight','norvège'], category: 'équipement', votes_count: 18, answers_count: 3, views_count: 534,  is_solved: false, created_at: daysAgo(3)  },
  ], { onConflict: 'id' });
  results.qa_questions = qaQErr ? qaQErr.message : 'ok';

  // 16. QA ANSWERS
  const { error: qaAErr } = await supabase.from('qa_answers').upsert([
    { id: qa1, question_id: q1, author_id: u1, content: 'Pour les nuits à 4000m+, je recommande la MSR Remote 2 ou la Hilleberg Akto. Si budget limité, la Naturehike Cloud-Up 2 est un excellent compromis à 200€.', votes_count: 28, is_accepted: true,  created_at: daysAgo(38) },
    { id: qa2, question_id: q1, author_id: u2, content: 'J\'ai utilisé la Hubba Hubba jusqu\'à 5000m au Népal sans problème. L\'essentiel est de bien choisir son emplacement.', votes_count: 15, is_accepted: false, created_at: daysAgo(37) },
    { id: qa3, question_id: q2, author_id: u1, content: 'Mes 5 règles anti-ampoules : 1) Chaussures rodées 200km minimum. 2) Chaussettes laine mérinos. 3) Talc chaque matin. 4) Compeed dès les premiers signes. 5) Sécher les pieds à chaque pause.', votes_count: 45, is_accepted: true,  created_at: daysAgo(23) },
    { id: qa4, question_id: q2, author_id: u3, content: 'Ajoute les guêtres légères pour éviter les gravillons. Et si tu as les pieds larges, essaie les chaussures Altra ou Hoka.', votes_count: 22, is_accepted: false, created_at: daysAgo(22) },
    { id: qa5, question_id: q3, author_id: u2, content: 'J\'ai le Garmin Fenix 8 depuis 6 mois. Autonomie exceptionnelle (28 jours), cartographie topo intégrée. Le Coros Vertix 3 est une excellente alternative moins chère.', votes_count: 31, is_accepted: false, created_at: daysAgo(13) },
    { id: qa6, question_id: q4, author_id: u1, content: 'Pour 10 jours en autonomie : compte 600-700g de nourriture sèche par jour. Privilégie lyophilisés, barres énergétiques, fruits secs, noix.', votes_count: 19, is_accepted: false, created_at: daysAgo(6)  },
  ], { onConflict: 'id' });
  results.qa_answers = qaAErr ? qaAErr.message : 'ok';

  // 17. AMA SESSIONS
  const { error: amaErr } = await supabase.from('ama_sessions').upsert([
    { id: ama1, expert_id: u1, title: 'AMA : Trekking en haute altitude - Tout ce que vous voulez savoir', description: 'Marie Dupont, guide de haute montagne, répond à toutes vos questions.', scheduled_at: daysAgo(20), duration_minutes: 90,  status: 'ended',    participants_count: 234, questions_count: 45, created_at: daysAgo(25) },
    { id: ama2, expert_id: u3, title: 'AMA : Courir un ultra-trail - De 0 à l\'UTMB', description: 'Sophie Bernard, finisher UTMB 2025, partage son expérience.', scheduled_at: daysFromNow(10), duration_minutes: 120, status: 'upcoming', participants_count: 189, questions_count: 28, created_at: daysAgo(3)  },
  ], { onConflict: 'id' });
  results.ama_sessions = amaErr ? amaErr.message : 'ok';

  // 18. AMA QUESTIONS
  const { error: amaQErr } = await supabase.from('ama_questions').upsert([
    { id: amaq1, session_id: ama1, author_id: u4, content: 'Comment préparer son acclimatation avant un trek à plus de 5000m ?', votes_count: 34, is_answered: true,  answer: 'L\'acclimatation est cruciale. Ne montez pas de plus de 300-500m par jour au-dessus de 3000m. Prévoyez au minimum 2 jours à Katmandou.', answered_at: daysAgo(20), created_at: daysAgo(21) },
    { id: amaq2, session_id: ama1, author_id: u7, content: 'Quel est le budget réaliste pour un trek de 3 semaines au Népal tout compris ?', votes_count: 28, is_answered: true,  answer: 'Budget réaliste : Vol A/R 600-900€, visa 30€, permis 50€, hébergement 5-15€/nuit, repas 3-8€, guide 25-35€/jour. Total : 1500-2500€.', answered_at: daysAgo(20), created_at: daysAgo(21) },
    { id: amaq3, session_id: ama2, author_id: u2, content: 'Comment gérer le sommeil pendant un ultra de plus de 24h ?', votes_count: 41, is_answered: false, answer: '', answered_at: null, created_at: daysAgo(2) },
    { id: amaq4, session_id: ama2, author_id: u8, content: 'Quel plan d\'entraînement pour passer du marathon à un 100km en 18 mois ?', votes_count: 35, is_answered: false, answer: '', answered_at: null, created_at: daysAgo(1) },
  ], { onConflict: 'id' });
  results.ama_questions = amaQErr ? amaQErr.message : 'ok';

  // 19. OCCASION ITEMS
  const { error: ocErr } = await supabase.from('occasion_items').upsert([
    { id: oc1, seller_id: u1, title: 'Tente MSR Remote 2 - Excellent état',          price: 320,  original_price: 550,  condition: 'excellent', location: 'Lyon, 69',     image: 'https://images.unsplash.com/photo-1504280390367-361c6d9f38f4?w=400', alt: 'Tente MSR Remote 2 orange montée dans un paysage alpin',                 negotiable: true,  shipping: true,  status: 'active', created_at: daysAgo(15) },
    { id: oc2, seller_id: u2, title: 'Sac à dos Osprey Atmos 65L - Très bon état',   price: 145,  original_price: 280,  condition: 'bon',       location: 'Paris, 75',    image: 'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=400', alt: 'Sac à dos de randonnée Osprey bleu posé sur un rocher en montagne',      negotiable: true,  shipping: true,  status: 'active', created_at: daysAgo(10) },
    { id: oc3, seller_id: u4, title: 'Chaussures Salomon X Ultra 4 GTX - Taille 43', price: 85,   original_price: 160,  condition: 'bon',       location: 'Grenoble, 38', image: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=400', alt: 'Chaussures de randonnée Salomon grises et vertes sur fond blanc',         negotiable: false, shipping: false, status: 'active', created_at: daysAgo(7)  },
    { id: oc4, seller_id: u5, title: 'Kayak de mer Prijon Seayak - Complet',          price: 890,  original_price: 1800, condition: 'bon',       location: 'Brest, 29',    image: 'https://images.unsplash.com/photo-1544551763-46a013bb70d5?w=400', alt: 'Kayak de mer jaune sur une plage bretonne avec équipement complet',      negotiable: true,  shipping: false, status: 'active', created_at: daysAgo(5)  },
    { id: oc5, seller_id: u3, title: 'Réchaud MSR Windburner + casserole 1L',         price: 65,   original_price: 120,  condition: 'excellent', location: 'Bordeaux, 33', image: 'https://images.unsplash.com/photo-1504280390367-361c6d9f38f4?w=400', alt: 'Réchaud de camping MSR avec casserole sur une table de pique-nique',     negotiable: false, shipping: true,  status: 'active', created_at: daysAgo(3)  },
  ], { onConflict: 'id' });
  results.occasion_items = ocErr ? ocErr.message : 'ok';

  // 20. AUCTION ITEMS
  const { error: auErr } = await supabase.from('auction_items').upsert([
    { id: au1, seller_id: u6, title: 'Veste Gore-Tex Arc\'teryx Beta AR - Taille M', start_price: 180, current_bid: 245, buy_now_price: 420, condition: 'bon',       ends_at: daysFromNow(3), bids_count: 8,  watchers_count: 23, image: 'https://images.unsplash.com/photo-1551698618-1dfe5d97d256?w=400', alt: 'Veste imperméable Arc\'teryx rouge portée par un randonneur', status: 'active', created_at: daysAgo(4) },
    { id: au2, seller_id: u7, title: 'Sac de couchage Cumulus Panyam 450 - Duvet',   start_price: 120, current_bid: 165, buy_now_price: 280, condition: 'excellent', ends_at: daysFromNow(5), bids_count: 5,  watchers_count: 17, image: 'https://images.unsplash.com/photo-1504280390367-361c6d9f38f4?w=400', alt: 'Sac de couchage en duvet bleu déplié sur un matelas de camping', status: 'active', created_at: daysAgo(2) },
    { id: au3, seller_id: u8, title: 'Montre Garmin Fenix 7 Sapphire Solar',         start_price: 350, current_bid: 412, buy_now_price: 650, condition: 'bon',       ends_at: daysFromNow(7), bids_count: 11, watchers_count: 34, image: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=400', alt: 'Montre GPS Garmin Fenix 7 noire avec bracelet sport',         status: 'active', created_at: daysAgo(1) },
  ], { onConflict: 'id' });
  results.auction_items = auErr ? auErr.message : 'ok';

  // 21. RENTAL ITEMS
  const { error: reErr } = await supabase.from('rental_items').upsert([
    { id: re1, owner_id: u1, title: 'Kit complet trekking haute montagne', price_per_day: 25, price_per_week: 140, deposit: 200, condition: 'excellent', location: 'Lyon, 69',     distance_km: 2.5, available: true, rating: 4.9, reviews_count: 23, image: 'https://images.unsplash.com/photo-1504280390367-361c6d9f38f4?w=400', alt: 'Kit de camping complet avec tente, sac à dos et réchaud', created_at: daysAgo(60) },
    { id: re2, owner_id: u2, title: 'Vélo de bikepacking Salsa Cutthroat - Taille M', price_per_day: 35, price_per_week: 200, deposit: 300, condition: 'bon',       location: 'Paris, 75',    distance_km: 5.0, available: true, rating: 4.7, reviews_count: 15, image: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=400', alt: 'Vélo de bikepacking gris avec sacoches chargées',         created_at: daysAgo(45) },
    { id: re3, owner_id: u5, title: 'Kayak de mer double + pagaies + gilets',         price_per_day: 45, price_per_week: 250, deposit: 400, condition: 'bon',       location: 'Brest, 29',    distance_km: 1.2, available: true, rating: 4.8, reviews_count: 18, image: 'https://images.unsplash.com/photo-1544551763-46a013bb70d5?w=400', alt: 'Kayak de mer double rouge avec deux pagaies et gilets',   created_at: daysAgo(30) },
    { id: re4, owner_id: u4, title: 'Skis de randonnée Dynafit + chaussures + peaux', price_per_day: 40, price_per_week: 220, deposit: 350, condition: 'excellent', location: 'Grenoble, 38', distance_km: 3.8, available: true, rating: 4.6, reviews_count: 12, image: 'https://images.unsplash.com/photo-1551698618-1dfe5d97d256?w=400', alt: 'Skis de randonnée Dynafit avec chaussures et peaux',      created_at: daysAgo(20) },
  ], { onConflict: 'id' });
  results.rental_items = reErr ? reErr.message : 'ok';

  const errors = Object.entries(results).filter(([, v]) => v !== 'ok');
  
  return NextResponse.json({
    success: errors.length === 0,
    results,
    errors: errors.length > 0 ? errors : undefined,
    message: errors.length === 0 
      ? '✅ Toutes les données seed ont été insérées avec succès !' 
      : `⚠️ ${errors.length} erreur(s) lors de l'insertion`,
  });
}

export async function GET() {
  return NextResponse.json({ 
    message: 'Utilisez POST /api/seed?secret=kitduvoyageur-seed-2026 pour insérer les données seed' 
  });
}
