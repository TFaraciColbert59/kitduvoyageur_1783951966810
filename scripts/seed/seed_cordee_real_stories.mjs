#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { createClient } from '@supabase/supabase-js';

const CLUB_ID = 'db8623d4-fc9b-4c39-ae3a-c93daf2a5075';
const SEED_TAG = 'cordee-stories-v1';

function readEnv(key) {
  const envPath = path.resolve(process.cwd(), '.env.local');
  const raw = fs.readFileSync(envPath, 'utf8');
  const match = raw.match(new RegExp(`^${key}=(.+)$`, 'm'));
  if (!match) throw new Error(`${key} introuvable dans .env.local`);
  return match[1].trim().replace(/^["']|["']$/g, '');
}

function deterministicUuid(seed) {
  const hash = crypto.createHash('sha256').update(`${SEED_TAG}:${seed}`).digest('hex');
  return `${hash.slice(0, 8)}-${hash.slice(8, 12)}-4${hash.slice(13, 16)}-a${hash.slice(17, 20)}-${hash.slice(20, 32)}`;
}

function snapCoord(trace, progress) {
  if (!Array.isArray(trace) || trace.length === 0) return null;
  const idx = Math.max(0, Math.min(trace.length - 1, Math.round(progress * (trace.length - 1))));
  const pt = trace[idx];
  if (Array.isArray(pt) && pt.length >= 2 && Number.isFinite(pt[0]) && Number.isFinite(pt[1])) {
    return [pt[0], pt[1]];
  }
  return null;
}

const STORY_TEMPLATES = [
  // GRP Tour du Lac d'Annecy (4 stories -> demonstrates compact cluster on track!)
  {
    match: 'GRP Tour du Lac d’Annecy',
    album: 'Lac d’Annecy',
    stories: [
      { image: '/assets/images/lake-1.jpg', caption: 'Lever de soleil miroir sur le lac d’Annecy depuis le Roc de Chère', spot: 'Roc de Chère', progress: 0.16, hoursAgo: 4 },
      { image: '/assets/images/club-kayak.jpg', caption: 'Pause fraîcheur sur les rives navigables de Talloires avant la montée', spot: 'Baie de Talloires', progress: 0.21, hoursAgo: 18 },
      { image: '/assets/images/hero-editorial.jpg', caption: 'Crêtes du Semnoz face à la Tournette : 84 km de bonheur pur', spot: 'Crête du Semnoz', progress: 0.58, hoursAgo: 42 },
      { image: '/assets/images/community-morning.jpg', caption: 'Descente dorée vers Veyrier-du-Lac avec toute la cordée', spot: 'Col de la Forclaz', progress: 0.82, hoursAgo: 68 },
    ],
  },
  // Circuit de Leschaux (3 stories -> demonstrates compact cluster on track!)
  {
    match: 'Circuit de Leschaux',
    album: 'Lac d’Annecy',
    stories: [
      { image: '/assets/images/journal-trail.jpg', caption: 'Montée régulière au col de Leschaux à la fraîche, zéro voiture', spot: 'Col de Leschaux', progress: 0.32, hoursAgo: 9 },
      { image: '/assets/images/lake-1.jpg', caption: 'Retour par la voie verte le long des bouées du lac d’Annecy', spot: 'Rive de Sévrier', progress: 0.37, hoursAgo: 29 },
      { image: '/assets/images/community-hikers.jpg', caption: 'Café-croissant d’équipe après les 56 km dans les Bauges', spot: 'Bellecombe-en-Bauges', progress: 0.74, hoursAgo: 55 },
    ],
  },
  // GR 55 La Vanoise (4 stories)
  {
    match: 'GR 55 La Vanoise',
    album: 'GR & Sommets',
    stories: [
      { image: '/assets/images/mountain-1.jpg', caption: 'Traversée sur les dalles du Lac des Vaches face à la Grande Casse', spot: 'Lac des Vaches', progress: 0.24, hoursAgo: 12 },
      { image: '/assets/images/journal-refuge.jpg', caption: 'Pause soupe chaude au Refuge du Col de la Vanoise (2 517 m)', spot: 'Col de la Vanoise', progress: 0.28, hoursAgo: 36 },
      { image: '/assets/images/mountain-2.jpg', caption: 'Glaciers de la Vanoise sous un ciel bleu cobalt', spot: 'Vallon de la Leisse', progress: 0.62, hoursAgo: 88 },
      { image: '/assets/images/adventure-hiking.jpg', caption: 'Derniers lacets du col de Chavière avant la redescente', spot: 'Col de Chavière', progress: 0.84, hoursAgo: 112 },
    ],
  },
  // Tour des Lacs des Sept Laux (3 stories)
  {
    match: 'Tour des Lacs des Sept Laux',
    album: 'Bivouacs',
    stories: [
      { image: '/assets/images/club-bivouac.jpg', caption: 'Tentes ultralight posées au-dessus du lac Cottepens au crépuscule', spot: 'Lac Cottepens', progress: 0.28, hoursAgo: 16 },
      { image: '/assets/images/adventure-bivouac.jpg', caption: 'Réveil à 3°C et café fumant face aux pics de Belledonne', spot: 'Col de la Vache', progress: 0.34, hoursAgo: 62 },
      { image: '/assets/images/hero-solar.jpg', caption: 'Miroir glaciaire sur les Sept Laux avant la bascule', spot: 'Lac Blanc Sept Laux', progress: 0.71, hoursAgo: 120 },
    ],
  },
  // Lac Blanc — Aiguilles Rouges (3 stories)
  {
    match: 'Lac Blanc — Balcon des Aiguilles Rouges',
    album: 'Bivouacs',
    stories: [
      { image: '/assets/images/mountain-2.jpg', caption: 'Reflet parfait du Mont-Blanc et des Grandes Jorasses au Lac Blanc', spot: 'Lac Blanc (2 352 m)', progress: 0.46, hoursAgo: 7 },
      { image: '/assets/images/club-photo.jpg', caption: 'Bouquetins curieux près des lacs des Chéserys ce matin', spot: 'Lacs des Chéserys', progress: 0.51, hoursAgo: 48 },
      { image: '/assets/images/hero-misty.jpg', caption: 'Mer de nuages dans la vallée de Chamonix depuis les échelles', spot: 'Balcon Sud', progress: 0.79, hoursAgo: 96 },
    ],
  },
  // Boucle du Mont Veyrier (2 stories)
  {
    match: 'Boucle du Mont Veyrier',
    album: 'Trail & VTT',
    stories: [
      { image: '/assets/images/club-trail.jpg', caption: 'Frontales allumées à 06h00 sur les crêtes du Mont Veyrier', spot: 'Mont Baron', progress: 0.45, hoursAgo: 20 },
      { image: '/assets/images/community-morning.jpg', caption: '1 269 m D+ avalés avant le boulot face au lac d’Annecy', spot: 'Sommet Mont Veyrier', progress: 0.52, hoursAgo: 74 },
    ],
  },
  // Petit Balcon Nord VTT (2 stories)
  {
    match: 'Petit Balcon Nord VTT',
    album: 'Trail & VTT',
    stories: [
      { image: '/assets/images/forest-1.jpg', caption: 'Single en flow entre racines et mélèzes face aux Drus', spot: 'Bois des Tines', progress: 0.38, hoursAgo: 31 },
      { image: '/assets/images/journal-trail.jpg', caption: 'Arrivée à Argentière sous le glacier, banane jusqu’aux oreilles', spot: 'Argentière', progress: 0.76, hoursAgo: 104 },
    ],
  },
  // La Brèche Pacave (2 stories)
  {
    match: 'La Brèche Pacave',
    album: 'Alpinisme',
    stories: [
      { image: '/assets/images/club-alpin.jpg', caption: 'Alpenglow sur les faces nord de La Meije depuis la Brèche Pacave', spot: 'Brèche Pacave', progress: 0.52, hoursAgo: 26 },
      { image: '/assets/images/mountain-1.jpg', caption: 'Crampons chaussés sur le névé matinal du sentier CA17', spot: 'Glacier de la Girose', progress: 0.57, hoursAgo: 132 },
    ],
  },
  // Boucle d'Ailefroide (2 stories)
  {
    match: 'Boucle d’Ailefroide',
    album: 'Alpinisme',
    stories: [
      { image: '/assets/images/club-alpin.jpg', caption: 'Révision encordement et mouflage face au Pelvoux', spot: 'Refuge d’Ailefroide', progress: 0.42, hoursAgo: 52 },
      { image: '/assets/images/hero-editorial.jpg', caption: 'Lumière cristalline sur le granit d’Ailefroide', spot: 'Pré de Madame Carle', progress: 0.72, hoursAgo: 146 },
    ],
  },
  // GR 58 Tour du Queyras (3 stories)
  {
    match: 'GR 58',
    album: 'GR & Sommets',
    stories: [
      { image: '/assets/images/mountain-2.jpg', caption: 'Pyramide du Mont Viso depuis le col Vieux à 2 806 m', spot: 'Col Vieux', progress: 0.25, hoursAgo: 80 },
      { image: '/assets/images/journal-refuge.jpg', caption: 'Gîte chaleureux à Saint-Véran, plus haut village d’Europe', spot: 'Saint-Véran', progress: 0.55, hoursAgo: 164 },
      { image: '/assets/images/adventure-hiking.jpg', caption: 'Lacs du Grand Laus sous un soleil radieux dans le Queyras', spot: 'Col du Malrif', progress: 0.81, hoursAgo: 210 },
    ],
  },
  // GR 57 Clarée (2 stories)
  {
    match: 'GR 57',
    album: 'GR & Sommets',
    stories: [
      { image: '/assets/images/adventure-hiking.jpg', caption: 'Lacs Laramon et Serpent reflétant les Écrins sur le GR 57', spot: 'Lac Laramon', progress: 0.35, hoursAgo: 92 },
      { image: '/assets/images/adventure-bivouac.jpg', caption: 'Bivouac sous la Voie Lactée en Haute Vallée de la Clarée', spot: 'Refuge de Buffère', progress: 0.68, hoursAgo: 188 },
    ],
  },
  // Tour du Mont Thabor (2 stories)
  {
    match: 'Tour du Mont Thabor',
    album: 'Bivouacs',
    stories: [
      { image: '/assets/images/club-bivouac.jpg', caption: 'Schistes pourpres et lacs glaciaires au col des Méandes', spot: 'Col des Méandes', progress: 0.44, hoursAgo: 140 },
      { image: '/assets/images/hero-solar.jpg', caption: 'Étape italienne en Vallée Étroite après 65 km de tour', spot: 'Vallée Étroite', progress: 0.78, hoursAgo: 230 },
    ],
  },
  // Pas de l'Aiguille (1 story)
  {
    match: 'Pas de l’Aiguille',
    album: 'Alpinisme',
    stories: [
      { image: '/assets/images/adventure-hiking.jpg', caption: 'Débouché sur les Hauts Plateaux du Vercors face au Mont Aiguille', spot: 'Pas de l’Aiguille', progress: 0.5, hoursAgo: 118 },
    ],
  },
  // Tour des Petites Roches (1 story)
  {
    match: 'Tour des Petites Roches',
    album: 'Trail & VTT',
    stories: [
      { image: '/assets/images/hero-misty.jpg', caption: 'Balcon de Chartreuse suspendu au-dessus de la mer de nuages', spot: 'Saint-Hilaire', progress: 0.48, hoursAgo: 152 },
    ],
  },
  // Croix de Pralognan (1 story)
  {
    match: 'Croix de Pralognan',
    album: 'Trail & VTT',
    stories: [
      { image: '/assets/images/forest-1.jpg', caption: 'Mélèzes dorés et sentier souple face à la Grande Casse', spot: 'Croix de Pralognan', progress: 0.5, hoursAgo: 175 },
    ],
  },
  // Cirque du Gioberney (1 story)
  {
    match: 'Boucle du Pigeonnier',
    album: 'Alpinisme',
    stories: [
      { image: '/assets/images/mountain-1.jpg', caption: 'Refuge du Pigeonnier face aux glaciers des Rouies', spot: 'Cirque du Gioberney', progress: 0.55, hoursAgo: 196 },
    ],
  },
];

const ALBUM_DEFS = [
  { title: 'Lac d’Annecy', cover: '/assets/images/lake-1.jpg', position: 0 },
  { title: 'GR & Sommets', cover: '/assets/images/mountain-1.jpg', position: 1 },
  { title: 'Bivouacs', cover: '/assets/images/club-bivouac.jpg', position: 2 },
  { title: 'Trail & VTT', cover: '/assets/images/club-trail.jpg', position: 3 },
  { title: 'Alpinisme', cover: '/assets/images/club-alpin.jpg', position: 4 },
];

async function main() {
  const sb = createClient(readEnv('NEXT_PUBLIC_SUPABASE_URL'), readEnv('SUPABASE_SERVICE_ROLE_KEY'));

  const { data: club, error: clubErr } = await sb
    .from('clubs')
    .select('id, name, created_by')
    .eq('id', CLUB_ID)
    .single();
  if (clubErr || !club) throw new Error(`Club introuvable: ${clubErr?.message}`);

  const { data: events, error: evErr } = await sb
    .from('club_events')
    .select('id, title, location, lat, lng, route_id')
    .eq('club_id', CLUB_ID);
  if (evErr || !events?.length) throw new Error(`Sorties introuvables: ${evErr?.message}`);

  const routeIds = events
    .map((e) => Number(e.route_id))
    .filter((n) => Number.isFinite(n));
  const { data: routes } = await sb
    .from('hiking_routes')
    .select('id, tags')
    .in('id', routeIds);
  const traceByRouteId = new Map();
  for (const r of routes || []) {
    if (r.tags && Array.isArray(r.tags.trace_3d)) {
      traceByRouteId.set(String(r.id), r.tags.trace_3d);
    }
  }

  const { data: memberRows } = await sb
    .from('club_members')
    .select('user_id')
    .eq('club_id', CLUB_ID)
    .eq('status', 'active')
    .limit(60);
  const memberIds = (memberRows || []).map((m) => m.user_id);
  const { data: profiles } = await sb
    .from('user_profiles')
    .select('id, full_name, handle, avatar_url')
    .in('id', memberIds);
  const humanMembers = (profiles || []).filter(
    (p) =>
      p.full_name &&
      !p.full_name.toLowerCase().includes('lkdv') &&
      !p.full_name.toLowerCase().includes('coéquipier y'),
  );
  if (humanMembers.length === 0) throw new Error('Aucun membre actif humain trouvé');

  // 1. Nettoyage idempotent des anciens albums club et stories seedées
  const { data: oldHls } = await sb
    .from('story_highlights')
    .select('id')
    .eq('club_id', CLUB_ID);
  if (oldHls?.length) {
    await sb
      .from('story_highlight_items')
      .delete()
      .in('highlight_id', oldHls.map((h) => h.id));
    await sb.from('story_highlights').delete().eq('club_id', CLUB_ID);
  }
  await sb.from('post_stories').delete().eq('club_id', CLUB_ID);

  // 2. Insertion des vraies post_stories attribuées aux membres réels
  const nowMs = Date.now();
  const storyIdsByAlbum = new Map(ALBUM_DEFS.map((a) => [a.title, []]));
  let memberIdx = 0;
  let insertedStories = 0;

  for (const tpl of STORY_TEMPLATES) {
    const ev = events.find((e) => e.title.includes(tpl.match));
    if (!ev) continue;
    const trace = ev.route_id ? traceByRouteId.get(String(ev.route_id)) : null;

    for (let sIdx = 0; sIdx < tpl.stories.length; sIdx += 1) {
      const st = tpl.stories[sIdx];
      const author = humanMembers[memberIdx % humanMembers.length];
      memberIdx += 1;

      const snapped = snapCoord(trace, st.progress);
      const lng = snapped ? snapped[0] : Number(ev.lng || 6.1294);
      const lat = snapped ? snapped[1] : Number(ev.lat || 45.8992);

      const createdAt = new Date(nowMs - st.hoursAgo * 3600_000);
      // Les stories < 24h sont actives, les plus anciennes sont archivées naturellement (expires_at < now)
      const expiresAt = new Date(createdAt.getTime() + 24 * 3600_000);
      const storyId = deterministicUuid(`story:${ev.id}:${sIdx}`);

      const { error: stErr } = await sb.from('post_stories').insert({
        id: storyId,
        author_id: author.id,
        club_id: CLUB_ID,
        image_url: st.image,
        caption: st.caption,
        visibility: 'public',
        media_type: 'image',
        status: 'ready',
        moderation_state: 'visible',
        created_at: createdAt.toISOString(),
        expires_at: expiresAt.toISOString(),
        composition: {
          seed_tag: SEED_TAG,
          outing_id: ev.id,
          outing_title: ev.title,
          massif: ev.location || 'Alpes',
          spot: st.spot,
          lat,
          lng,
          track_progress: st.progress,
        },
      });
      if (stErr) throw new Error(`Insert post_stories failed: ${stErr.message}`);
      insertedStories += 1;
      storyIdsByAlbum.get(tpl.album)?.push({ id: storyId, image: st.image });
    }
  }

  // 3. Insertion des 5 vrais albums "Stories à la une" dans story_highlights + story_highlight_items
  let insertedHighlights = 0;
  let insertedItems = 0;

  for (const album of ALBUM_DEFS) {
    const items = storyIdsByAlbum.get(album.title) || [];
    if (items.length === 0) continue;
    const hlId = deterministicUuid(`highlight:${album.title}`);

    const { error: hlErr } = await sb.from('story_highlights').insert({
      id: hlId,
      owner_id: club.created_by || humanMembers[0].id,
      club_id: CLUB_ID,
      title: album.title,
      cover_story_id: items[0].id,
      cover_image_url: album.cover,
      position: album.position,
    });
    if (hlErr) throw new Error(`Insert story_highlights failed: ${hlErr.message}`);
    insertedHighlights += 1;

    const itemRows = items.map((it, idx) => ({
      highlight_id: hlId,
      story_id: it.id,
      position: idx,
    }));
    const { error: itemErr } = await sb.from('story_highlight_items').insert(itemRows);
    if (itemErr) throw new Error(`Insert story_highlight_items failed: ${itemErr.message}`);
    insertedItems += itemRows.length;
  }

  console.log(
    JSON.stringify(
      {
        clubId: CLUB_ID,
        insertedStories,
        insertedHighlights,
        insertedItems,
      },
      null,
      2,
    ),
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
