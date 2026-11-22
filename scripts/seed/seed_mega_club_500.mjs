import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';
import pg from 'pg';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '../..');
const envPath = path.join(rootDir, '.env.local');

const env = Object.fromEntries(
  fs
    .readFileSync(envPath, 'utf8')
    .split('\n')
    .filter((l) => l && !l.startsWith('#') && l.includes('='))
    .map((l) => {
      const idx = l.indexOf('=');
      return [l.slice(0, idx).trim(), l.slice(idx + 1).trim().replace(/^"|"$/g, '')];
    }),
);

const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = env.SUPABASE_SERVICE_ROLE_KEY;
const DATABASE_URL = env.DATABASE_URL;

if (!SUPABASE_URL || !SERVICE_KEY || !DATABASE_URL) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, or DATABASE_URL in .env.local');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const CLUB_SLUG = 'cordee-des-alpes';
const DEMO_USER_ID = '9c0b1015-21a5-40cc-b670-f14d55ad4a0c';
const TARGET_MEMBERS = 500;

const FIRST_NAMES = [
  'Lucas', 'Camille', 'Théo', 'Léa', 'Nathan', 'Chloé', 'Hugo', 'Manon', 'Raphaël', 'Jade',
  'Gabriel', 'Louise', 'Arthur', 'Emma', 'Louis', 'Alice', 'Jules', 'Inès', 'Maël', 'Lina',
  'Noah', 'Mila', 'Adam', 'Rose', 'Sacha', 'Anna', 'Liam', 'Juliette', 'Paul', 'Zoé',
  'Gabin', 'Agathe', 'Tom', 'Clara', 'Martin', 'Sarah', 'Baptiste', 'Eva', 'Romain', 'Margaux',
  'Maxime', 'Charlotte', 'Antoine', 'Elena', 'Thomas', 'Victoire', 'Alexandre', 'Romane', 'Clément', 'Ambre',
  'Valentin', 'Mathilde', 'Adrien', 'Nina', 'Julien', 'Lucie', 'Quentin', 'Océane', 'Nicolas', 'Pauline',
  'Victor', 'Laura', 'Bastien', 'Céline', 'Benjamin', 'Audrey', 'Guillaume', 'Marine', 'Florian', 'Élodie',
  'Damien', 'Sophie', 'Pierre', 'Claire', 'Matthieu', 'Julie', 'Sébastien', 'Caroline', 'Vincent', 'Aurore',
];

const LAST_NAMES = [
  'Marchand', 'Fontaine', 'Lefèvre', 'Roux', 'Moreau', 'Laurent', 'Simon', 'Michel', 'Bernard', 'Thomas',
  'Petit', 'Robert', 'Richard', 'Durand', 'Dubois', 'Girard', 'Bonnet', 'Dupont', 'Lambert', 'Rousseau',
  'Vincent', 'Muller', 'Faure', 'Andre', 'Mercier', 'Blanc', 'Guerin', 'Boyer', 'Garnier', 'Chevalier',
  'François', 'Legrand', 'Gauthier', 'Garcia', 'Perrin', 'Robin', 'Clement', 'Morin', 'Nicolas', 'Henry',
  'Roussel', 'Mathieu', 'Gautier', 'Masson', 'Duval', 'Denis', 'Dumont', 'Marie', 'Lemaire', 'Noel',
  'Meyer', 'Dufour', 'Meunier', 'Brun', 'Blanchard', 'Giraud', 'Joly', 'Riviere', 'Lucas', 'Brunet',
  'Gaillard', 'Barbier', 'Arnaud', 'Martinez', 'Gerard', 'Roche', 'Renard', 'Schmitt', 'Roy', 'Leroy',
  'Vidal', 'Caron', 'Picard', 'Roger', 'Fabre', 'Aubert', 'Lemoine', 'Renaud', 'Dumas', 'Lacroix',
];

const MASSIFS = [
  { label: 'Chamonix, Mont-Blanc', lat: 45.9237, lng: 6.8694 },
  { label: 'Grenoble, Belledonne', lat: 45.1885, lng: 5.7245 },
  { label: 'Annecy, Aravis', lat: 45.8992, lng: 6.1294 },
  { label: 'Briançon, Écrins', lat: 44.8994, lng: 6.6432 },
  { label: 'Bourg-Saint-Maurice, Vanoise', lat: 45.6167, lng: 6.7667 },
  { label: 'Gap, Queyras', lat: 44.5594, lng: 6.0786 },
  { label: 'Chambéry, Chartreuse', lat: 45.5646, lng: 5.9178 },
  { label: 'Sallanches, Mont-Blanc', lat: 45.9367, lng: 6.6319 },
  { label: 'Villard-de-Lans, Vercors', lat: 45.0706, lng: 5.5508 },
  { label: 'Marseille, Calanques', lat: 43.2141, lng: 5.4487 },
  { label: 'Pau, Pyrénées', lat: 43.2951, lng: -0.3708 },
  { label: 'Nice, Mercantour', lat: 43.7102, lng: 7.262 },
];

const BIOS = [
  'Alpiniste & bivouac 4 saisons. Toujours partant pour une arête à l’aube.',
  'Traileur longue distance et amateur de crêtes techniques en autonomie.',
  'Accompagnateur en montagne · partage de traces GPX et reco météo.',
  'Photographe de haute altitude, adepte du matériel ultraléger (< 5 kg).',
  'Passionné de ski de rando l’hiver et de grandes traversées l’été.',
  'Membre actif de la cordée · covoiturage régulier au départ de la vallée.',
  'Amateur de bivouacs sous les étoiles et de refuges non gardés.',
  'Préparation UTMB & courses d’endurance en massif alpin.',
  'Secouriste bénévole, sensibilisation DVA et sécurité nivologique.',
  'Trekkeur itinérant GR20 / TMB / HRP · fan de popote minimaliste.',
];

function slugifyHandle(str) {
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '')
    .slice(0, 22);
}

async function main() {
  const pgClient = new pg.Client({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });
  await pgClient.connect();

  try {
    console.log('1. Checking existing users & profiles...');
    const { rows: existingProfiles } = await pgClient.query(
      `SELECT id, email, handle, full_name FROM user_profiles ORDER BY created_at ASC`,
    );
    const existingIds = existingProfiles.map((p) => p.id);
    const usedHandles = new Set(existingProfiles.map((p) => (p.handle || '').toLowerCase()).filter(Boolean));
    console.log(`   Existing user_profiles: ${existingIds.length}`);

    const needed = Math.max(0, TARGET_MEMBERS - existingIds.length);
    console.log(`2. Creating ${needed} additional real auth.users + user_profiles...`);

    const createdUserIds = [];
    const batchSize = 15;
    for (let i = 0; i < needed; i += batchSize) {
      const sliceCount = Math.min(batchSize, needed - i);
      const tasks = Array.from({ length: sliceCount }, async (_, offset) => {
        const idx = i + offset;
        const fn = FIRST_NAMES[(idx * 7 + 3) % FIRST_NAMES.length];
        const ln = LAST_NAMES[(idx * 13 + 11) % LAST_NAMES.length];
        const fullName = `${fn} ${ln}`;
        let baseHandle = slugifyHandle(`${fn}_${ln}_${idx + 101}`);
        while (usedHandles.has(baseHandle)) {
          baseHandle = `${baseHandle}_${Math.floor(Math.random() * 90 + 10)}`;
        }
        usedHandles.add(baseHandle);
        const email = `${baseHandle}@voyageurs.lkdv.app`;
        const massif = MASSIFS[idx % MASSIFS.length];
        const bio = BIOS[idx % BIOS.length];
        const avatarUrl = `https://i.pravatar.cc/150?u=${encodeURIComponent(baseHandle)}`;

        const { data, error } = await supabase.auth.admin.createUser({
          email,
          password: 'LkdvClub2026!Password',
          email_confirm: true,
          user_metadata: { full_name: fullName, handle: baseHandle },
        });
        if (error || !data?.user?.id) {
          throw new Error(`createUser failed for ${email}: ${error?.message || 'unknown'}`);
        }
        return {
          id: data.user.id,
          email,
          fullName,
          handle: baseHandle,
          massif: massif.label,
          bio,
          avatarUrl,
          xp: 120 + ((idx * 97) % 4800),
          level: 1 + ((idx * 3) % 18),
          trustScore: 75 + (idx % 25),
          loyaltyPoints: 50 + ((idx * 41) % 1500),
        };
      });

      const createdBatch = await Promise.all(tasks);
      for (const u of createdBatch) {
        await pgClient.query(
          `INSERT INTO user_profiles (
            id, email, full_name, handle, avatar_url, bio, location,
            trust_score, loyalty_points, loyalty_level, xp, level,
            is_demo, profile_visibility, role
          ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,false,'public','user')
          ON CONFLICT (id) DO UPDATE SET
            full_name = EXCLUDED.full_name,
            handle = EXCLUDED.handle,
            avatar_url = EXCLUDED.avatar_url,
            bio = EXCLUDED.bio,
            location = EXCLUDED.location,
            is_demo = false,
            profile_visibility = 'public'`,
          [
            u.id,
            u.email,
            u.fullName,
            u.handle,
            u.avatarUrl,
            u.bio,
            u.massif,
            u.trustScore,
            u.loyaltyPoints,
            u.level >= 10 ? 'Pionnier' : u.level >= 5 ? 'Éclaireur' : 'Voyageur',
            u.xp,
            u.level,
          ],
        );
        createdUserIds.push(u.id);
      }
      if ((i + sliceCount) % 90 === 0 || i + sliceCount === needed) {
        console.log(`   Created ${i + sliceCount}/${needed} users...`);
      }
    }

    // Ensure demo user profile is public & complete
    await pgClient.query(
      `UPDATE user_profiles
       SET profile_visibility = 'public',
           full_name = COALESCE(NULLIF(full_name, ''), 'Tony Faraci'),
           handle = COALESCE(NULLIF(handle, ''), 'tony_frc'),
           location = COALESCE(NULLIF(location, ''), 'Chamonix, Mont-Blanc')
       WHERE id = $1`,
      [DEMO_USER_ID],
    );

    const allMemberIds = Array.from(new Set([DEMO_USER_ID, ...existingIds, ...createdUserIds])).slice(0, TARGET_MEMBERS);
    console.log(`3. Total member pool ready: ${allMemberIds.length}`);

    // Upsert mega working club
    console.log(`4. Upserting mega club '${CLUB_SLUG}'...`);
    const { rows: clubRows } = await pgClient.query(
      `INSERT INTO clubs (
        slug, name, type, emoji, description, cover_color, cover_image,
        category, privacy, members_count, active_this_month, is_verified,
        created_by, country_iso, rules, activities, location_label,
        zone_radius_km, primary_sport, sports, verification_status,
        verified_at, verification_badge_label, verification_sports, who_can_post
      ) VALUES (
        $1,
        'Cordée des Alpes',
        'club',
        '🏔️',
        'Club alpin & trekking de référence : 500 passionnés réunis par Pôles (Alpinisme, Rando & Bivouac, Trail & Crêtes). Traces GPX vérifiées, covoiturage massif et coffre matériel partagé.',
        '#17402C',
        '/assets/images/account-bg.webp',
        'Alpinisme & Trekking',
        'public',
        $2,
        184,
        true,
        $3,
        'FR',
        'Respect strict de la montagne, vérification systématique du BERA et du trio DVA/pelle/sonde en hiver, zéro déchet en bivouac et bienveillance en cordée.',
        ARRAY['Alpinisme', 'Randonnée', 'Bivouac', 'Trail'],
        'Chamonix · Mont-Blanc',
        120,
        'Alpinisme',
        ARRAY['Alpinisme', 'Trekking', 'Trail', 'Ski de randonnée'],
        'verified',
        now(),
        'Club Alpin Vérifié',
        ARRAY['Alpinisme', 'Trekking', 'Trail'],
        'members'
      )
      ON CONFLICT (slug) DO UPDATE SET
        name = EXCLUDED.name,
        description = EXCLUDED.description,
        cover_image = EXCLUDED.cover_image,
        members_count = EXCLUDED.members_count,
        is_verified = true,
        created_by = EXCLUDED.created_by,
        location_label = EXCLUDED.location_label,
        primary_sport = EXCLUDED.primary_sport,
        sports = EXCLUDED.sports,
        updated_at = now()
      RETURNING id`,
      [CLUB_SLUG, allMemberIds.length, DEMO_USER_ID],
    );
    const clubId = clubRows[0].id;
    console.log(`   Club ID: ${clubId}`);

    // Clean existing synthetic rows for this club so re-running is idempotent
    await pgClient.query(`DELETE FROM club_members WHERE club_id = $1`, [clubId]);
    await pgClient.query(`DELETE FROM club_topics WHERE club_id = $1`, [clubId]);
    await pgClient.query(`DELETE FROM club_events WHERE club_id = $1`, [clubId]);
    await pgClient.query(`DELETE FROM club_gear_items WHERE club_id = $1`, [clubId]);
    await pgClient.query(`DELETE FROM club_challenges WHERE club_id = $1`, [clubId]);
    await pgClient.query(`DELETE FROM club_channel_messages WHERE club_id = $1`, [clubId]);
    await pgClient.query(`DELETE FROM club_channels WHERE club_id = $1`, [clubId]);

    console.log('5. Inserting 500 club_members...');
    const now = Date.now();
    for (let idx = 0; idx < allMemberIds.length; idx++) {
      const uid = allMemberIds[idx];
      const role =
        uid === DEMO_USER_ID || idx <= 12
          ? 'admin'
          : idx <= 38
            ? 'moderator'
            : 'member';
      const daysAgo = idx >= 39 && idx < 74 ? (idx % 6) + 1 : 14 + ((idx * 7) % 520);
      const joinedAt = new Date(now - daysAgo * 86_400_000).toISOString();
      const isPro = idx > 0 && idx <= 8;
      const verifiedSports = isPro ? ['Alpinisme', 'Trail'] : idx % 5 === 0 ? ['Randonnée'] : [];
      await pgClient.query(
        `INSERT INTO club_members (
          club_id, user_id, role, status, joined_at, leaderboard_opt_in, is_pro_athlete, verified_sports
        ) VALUES ($1, $2, $3, 'active', $4, true, $5, $6)`,
        [clubId, uid, role, joinedAt, isPro, verifiedSports],
      );
    }

    // Add 40 user_follows for demo user so "Suivis" filter & social proof work
    for (let idx = 1; idx <= 40 && idx < allMemberIds.length; idx++) {
      await pgClient.query(
        `INSERT INTO user_follows (follower_id, following_id)
         VALUES ($1, $2) ON CONFLICT DO NOTHING`,
        [DEMO_USER_ID, allMemberIds[idx]],
      );
    }

    console.log('6. Inserting 18 realistic sorties (club_events)...');
    const outingsSpec = [
      { title: 'Arête des Cosmiques — Mont-Blanc (14 km · +1 150 m)', loc: 'Aiguille du Midi · Chamonix', daysOffset: 0.1, sport: 'Alpinisme', maxP: 10, count: 8, lat: 45.8792, lng: 6.8872 },
      { title: 'Bivouac Lacs Robert & Grand Van (21 km · +1 420 m)', loc: 'Chamrousse · Belledonne', daysOffset: 3, sport: 'Randonnée', maxP: 16, count: 13, lat: 45.1267, lng: 5.9086 },
      { title: 'Tour du Mont Thabor en 2 jours (34 km · +2 100 m)', loc: 'Névache · Clarée', daysOffset: 5, sport: 'Trekking', maxP: 14, count: 11, lat: 45.1133, lng: 6.5644 },
      { title: 'Trail des Crêtes des Aravis (26 km · +1 850 m)', loc: 'La Clusaz · Aravis', daysOffset: 7, sport: 'Trail', maxP: 24, count: 19, lat: 45.9044, lng: 6.4231 },
      { title: 'Aiguille du Tour par le Refuge Albert 1er (18 km · +1 680 m)', loc: 'Le Tour · Mont-Blanc', daysOffset: 10, sport: 'Alpinisme', maxP: 8, count: 6, lat: 45.9936, lng: 7.0094 },
      { title: 'Traversée des Dents de Lanfon (15 km · +1 290 m)', loc: 'Talloires · Annecy', daysOffset: 13, sport: 'Randonnée', maxP: 18, count: 12, lat: 45.8406, lng: 6.2456 },
      { title: 'Sommet du Pelvoux — Reconnaissance (22 km · +1 950 m)', loc: 'Ailefroide · Écrins', daysOffset: 17, sport: 'Alpinisme', maxP: 8, count: 5, lat: 44.8986, lng: 6.3911 },
      { title: 'Atelier Sécurité DVA & Neige de printemps (8 km · +650 m)', loc: 'Col du Lautaret · Écrins', daysOffset: 21, sport: 'Alpinisme', maxP: 20, count: 15, lat: 45.0353, lng: 6.4053 },
      { title: 'Grand Veymont par Pas de la Ville (19 km · +1 120 m)', loc: 'Gresse-en-Vercors', daysOffset: -4, sport: 'Randonnée', maxP: 16, count: 16, lat: 44.8694, lng: 5.5264 },
      { title: 'Dôme des Écrins — Trace GPX certifiée (24 km · +1 780 m)', loc: 'Pré de Madame Carle', daysOffset: -9, sport: 'Alpinisme', maxP: 10, count: 10, lat: 44.9228, lng: 6.3536 },
      { title: 'Grande Casse — Face Nord-Ouest (20 km · +1 640 m)', loc: 'Pralognan · Vanoise', daysOffset: -15, sport: 'Alpinisme', maxP: 8, count: 8, lat: 45.4053, lng: 6.8269 },
      { title: 'Boucle du Mont Aiguille & Chichilianne (22 km · +1 310 m)', loc: 'Vercors Sud', daysOffset: -22, sport: 'Trekking', maxP: 18, count: 17, lat: 44.8419, lng: 5.5525 },
      { title: 'Kilomètre Vertical de Fully — Sortie Club (6 km · +1 000 m)', loc: 'Valais · Mont-Blanc', daysOffset: -29, sport: 'Trail', maxP: 25, count: 22, lat: 46.1375, lng: 7.1153 },
      { title: 'Pointe Percée par la Cheminée de Sallanches (16 km · +1 450 m)', loc: 'Sallanches · Aravis', daysOffset: -36, sport: 'Alpinisme', maxP: 12, count: 12, lat: 45.9553, lng: 6.5553 },
      { title: 'Traversée Belledonne Nord — 3 jours (48 km · +3 400 m)', loc: 'Allevard · Belledonne', daysOffset: -45, sport: 'Trekking', maxP: 12, count: 11, lat: 45.3936, lng: 6.0744 },
      { title: 'Pic du Midi d’Ossau — Tour complet (18 km · +1 250 m)', loc: 'Vallée d’Ossau · Pyrénées', daysOffset: -54, sport: 'Randonnée', maxP: 15, count: 14, lat: 42.8428, lng: -0.4383 },
      { title: 'Mont Viso par le Refuge Vallanta (25 km · +1 920 m)', loc: 'Queyras · Viso', daysOffset: -63, sport: 'Alpinisme', maxP: 10, count: 10, lat: 44.6675, lng: 7.0906 },
      { title: 'Calanques Express — Crêtes de Marseilleveyre (17 km · +980 m)', loc: 'Marseille · Calanques', daysOffset: -72, sport: 'Trail', maxP: 22, count: 20, lat: 43.2194, lng: 5.3831 },
    ];

    for (let i = 0; i < outingsSpec.length; i++) {
      const o = outingsSpec[i];
      const organizerId = allMemberIds[(i * 3) % 20];
      const startsAt = new Date(now + o.daysOffset * 86_400_000);
      const endsAt = new Date(startsAt.getTime() + 6 * 3600_000);
      await pgClient.query(
        `INSERT INTO club_events (
          club_id, organizer_id, title, description, event_date, starts_at, ends_at,
          location, meeting_point, max_participants, participants_count,
          sport, format, visibility, lat, lng, waitlist_enabled, pace_groups
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,'collective','club',$13,$14,true,$15)`,
        [
          clubId,
          organizerId,
          o.title,
          `Sortie encadrée ${o.sport} au départ de ${o.loc}. Covoiturage organisé depuis la vallée, brief sécurité la veille sur le salon.`,
          startsAt.toISOString(),
          startsAt.toISOString(),
          endsAt.toISOString(),
          o.loc,
          o.loc.split('·')[0].trim(),
          o.maxP,
          o.count,
          o.sport,
          o.lat,
          o.lng,
          JSON.stringify(['Cordée rapide', 'Allure contemplative']),
        ],
      );
    }

    console.log('7. Inserting 28 realistic publications (club_topics) across Pôles...');
    const MEDIA_IMAGES = [
      '/images/ridge-line.jpg',
      '/images/mountain-vista.jpg',
      '/assets/images/adventure-bivouac.jpg',
      '/assets/images/account-bg.webp',
    ];
    const topicsSpec = [
      { title: 'Pôle Alpinisme · Brief Arête des Cosmiques', content: 'Rappel matos pour samedi : crampons réglés, piolet, baudrier + 2 broches. Départ benne 07h30 pétantes, météo grand beau annoncé sur le Mont-Blanc.', pinned: true, img: MEDIA_IMAGES[0] },
      { title: 'Pôle Rando & Bivouac · Lacs Robert en conditions', content: 'Reconnaissance faite hier soir : sentier sec jusqu’à 2 050 m, petits névés résiduels faciles à contourner. Couchers de soleil incroyables sur Belledonne.', pinned: true, img: MEDIA_IMAGES[2] },
      { title: 'Pôle Trail & Crêtes · Sortie rythme Aravis dimanche', content: 'Départ 06h45 de La Clusaz pour 26 km et 1 850 m D+. Deux groupes d’allure prévus pour que personne ne reste isolé sur les crêtes.', pinned: false, img: MEDIA_IMAGES[1] },
      { title: 'Covoiturage Grenoble → Chamonix samedi 05h30', content: 'Il me reste 3 places dans le break avec porte-skis/sacs. Partage des péages et bonne humeur assurée !', pinned: false, img: null },
      { title: 'Retour test tente MSR Hubba NX après 14 nuits', content: 'Tenue irréprochable face aux rafales à 55 km/h au col de la Vanoise. Poids vérifié à 1 540 g sur balance.', pinned: false, img: MEDIA_IMAGES[2] },
      { title: 'Conditions glacier Blanc — Écrins', content: 'Trace bien marquée depuis le refuge, ponts de neige encore solides tôt le matin avant 10h. Prévoir frontale à 04h30.', pinned: false, img: MEDIA_IMAGES[3] },
      { title: 'Pôle Alpinisme · Atelier encordement glacier jeudi', content: 'Séance pratique mouflages et nœuds de freinage au mur + parc. Ouvert aux nouveaux membres qui préparent leur premier 4 000.', pinned: false, img: null },
      { title: 'Pôle Rando & Bivouac · Menu lyophilisé maison 48h', content: 'Je partage ma fiche recette semoule-noisettes-épices à 135 g la portion pour 520 kcal. Zéro déchet sur place.', pinned: false, img: null },
      { title: 'Pôle Trail & Crêtes · Trace GPX Grand Veymont', content: 'Lien vers le tracé vérifié sans neige sur le plateau. Attention au vent fort sur l’arête sommitale.', pinned: false, img: MEDIA_IMAGES[0] },
      { title: 'Prêt de DVA Barryvox disponible ce week-end', content: 'Je dépose deux kits complets DVA/pelle/sonde dans le coffre du club pour ceux qui rejoignent la sortie Lautaret.', pinned: false, img: null },
      { title: 'Lever de soleil depuis le Refuge du Goûter', content: 'Mer de nuages à 3 200 m ce matin, ambiance magique avec toute la cordée !', pinned: false, img: MEDIA_IMAGES[1] },
      { title: 'Bilan collectif : 12 400 m D+ cumulés cette semaine !', content: 'Bravo aux 42 membres qui ont partagé leurs traces cette semaine sur le défi d’automne.', pinned: false, img: null },
    ];

    for (let i = 0; i < 28; i++) {
      const base = topicsSpec[i % topicsSpec.length];
      const authorId = allMemberIds[(i * 5) % Math.min(80, allMemberIds.length)];
      const createdAt = new Date(now - (i * 5 + 1) * 3600_000).toISOString();
      await pgClient.query(
        `INSERT INTO club_topics (
          club_id, author_id, title, content, is_pinned, is_announcement, is_approved, likes_count, replies_count, created_at
        ) VALUES ($1,$2,$3,$4,$5,$6,true,$7,$8,$9)`,
        [
          clubId,
          authorId,
          i < topicsSpec.length ? base.title : `${base.title} (#${i + 1})`,
          base.content,
          i < 2,
          i === 0,
          4 + ((i * 7) % 34),
          1 + (i % 9),
          createdAt,
        ],
      );
    }

    console.log('8. Inserting 24 gear items in club_gear_items...');
    const gearSpec = [
      { name: 'Tente MSR Hubba Hubba NX 2P', brand: 'MSR', cat: 'Bivouac & Abri', w: 1540, avail: true },
      { name: 'Pack DVA Mammut Barryvox + Pelle + Sonde', brand: 'Mammut', cat: 'Sécurité & DVA', w: 980, avail: true },
      { name: 'Crampons Vasak Leverlock 12 pointes', brand: 'Petzl', cat: 'Cordes & Alpi', w: 840, avail: true },
      { name: 'Piolet Summit Evo 59 cm', brand: 'Petzl', cat: 'Cordes & Alpi', w: 400, avail: true },
      { name: 'Corde à double Cobra II 2×50 m', brand: 'Beal', cat: 'Cordes & Alpi', w: 2450, avail: false },
      { name: 'Réchaud PocketRocket Deluxe + Popote Titane', brand: 'MSR / Toaks', cat: 'Cuisine & Eau', w: 285, avail: true },
      { name: 'Sac de couchage Spark SpIII (-8°C)', brand: 'Sea to Summit', cat: 'Bivouac & Abri', w: 665, avail: true },
      { name: 'Matelas NeoAir XLite NXT Regular', brand: 'Therm-a-Rest', cat: 'Bivouac & Abri', w: 354, avail: true },
      { name: 'Filtre à eau BeFree 1L', brand: 'Katadyn', cat: 'Cuisine & Eau', w: 63, avail: true },
      { name: 'Balise satellite inReach Mini 2', brand: 'Garmin', cat: 'Sécurité & DVA', w: 100, avail: true },
      { name: 'Casque Sirocco ultraléger', brand: 'Petzl', cat: 'Cordes & Alpi', w: 170, avail: true },
      { name: 'Tarp TrailStar Dyneema 3P', brand: 'Mountain Laurel', cat: 'Bivouac & Abri', w: 410, avail: true },
      { name: 'Frontale Swift RL 1100 lm', brand: 'Petzl', cat: 'Sécurité & DVA', w: 100, avail: true },
      { name: 'Bâtons Distance Carbon Z 120 cm', brand: 'Black Diamond', cat: 'Portage', w: 288, avail: true },
      { name: 'Broches à glace Laser Speed Light (jeu de 4)', brand: 'Petzl', cat: 'Cordes & Alpi', w: 380, avail: true },
      { name: 'Trousse secours haute montagne complète', brand: 'Ortovox', cat: 'Sécurité & DVA', w: 320, avail: true },
      { name: 'Sac à dos Mutant 38 L', brand: 'Osprey', cat: 'Portage', w: 1190, avail: true },
      { name: 'Baudrier Altitude ultra-light', brand: 'Petzl', cat: 'Cordes & Alpi', w: 150, avail: true },
      { name: 'Sur-sac Gore-Tex Bivy Pro', brand: 'Outdoor Research', cat: 'Bivouac & Abri', w: 460, avail: false },
      { name: 'Panneau solaire Nomad 10W', brand: 'Goal Zero', cat: 'Électronique', w: 510, avail: true },
      { name: 'Réchaud Jetboil Flash 1L', brand: 'Jetboil', cat: 'Cuisine & Eau', w: 371, avail: true },
      { name: 'Gants guide cuir isolés', brand: 'Black Diamond', cat: 'Vêtements', w: 290, avail: true },
      { name: 'Micro-crampons Trail Pro', brand: 'Nortec', cat: 'Sécurité & DVA', w: 340, avail: true },
      { name: 'Tente 4 saisons Access 2P', brand: 'MSR', cat: 'Bivouac & Abri', w: 1860, avail: true },
    ];

    for (let i = 0; i < gearSpec.length; i++) {
      const g = gearSpec[i];
      const ownerId = allMemberIds[(i * 2) % 30];
      await pgClient.query(
        `INSERT INTO club_gear_items (club_id, owner_id, name, brand, category, weight_g, available)
         VALUES ($1,$2,$3,$4,$5,$6,$7)`,
        [clubId, ownerId, g.name, g.brand, g.cat, g.w, g.avail],
      );
    }

    console.log('9. Inserting 4 challenges in club_challenges...');
    const challengesSpec = [
      { title: 'Défi 50 000 m D+ Automne', desc: 'Cumul collectif de dénivelé positif sur le massif alpin.', metric: 'elevation_gain_m', target: 50000, xp: 500, badge: 'Grimpeur Alpin' },
      { title: 'Traversée des 3 Massifs (600 km)', desc: 'Distance cumulée en rando, trail et alpinisme.', metric: 'distance_m', target: 600000, xp: 450, badge: 'Grand Voyageur' },
      { title: '20 Sorties de Cordée', desc: 'Sorties collectives partagées et tracées en GPX.', metric: 'outings_count', target: 20, xp: 350, badge: 'Chef de Cordée' },
      { title: '120 h en Altitude', desc: 'Temps actif cumulé au-dessus de 1 500 m.', metric: 'duration_s', target: 432000, xp: 400, badge: 'Haute Montagne' },
    ];
    for (const ch of challengesSpec) {
      await pgClient.query(
        `INSERT INTO club_challenges (
          club_id, title, description, xp_reward, active, start_date, end_date,
          scope, sport, metric, target_value, starts_at, ends_at, badge_title, created_by
        ) VALUES ($1,$2,$3,$4,true,now() - interval '15 days',now() + interval '45 days','club','Alpinisme',$5,$6,now() - interval '15 days',now() + interval '45 days',$7,$8)`,
        [clubId, ch.title, ch.desc, ch.xp, ch.metric, ch.target, ch.badge, DEMO_USER_ID],
      );
    }

    console.log('10. Inserting 3 salons + 15 messages...');
    const channelsSpec = [
      { name: 'Général · Cordée', kind: 'general' },
      { name: 'Covoiturage & Départs', kind: 'carpool' },
      { name: 'Sécurité & Conditions Massif', kind: 'safety' },
    ];
    const channelIds = [];
    for (const ch of channelsSpec) {
      const { rows } = await pgClient.query(
        `INSERT INTO club_channels (club_id, name, kind, read_only_for_members, notifications_enabled_by_default, created_by)
         VALUES ($1,$2,$3,false,true,$4) RETURNING id`,
        [clubId, ch.name, ch.kind, DEMO_USER_ID],
      );
      channelIds.push(rows[0].id);
    }

    const chatLines = [
      'Salut la cordée ! Qui monte vers Chamonix samedi matin tôt ?',
      'Je pars de Grenoble à 05h30, j’ai 3 places dispo dans le break.',
      'Top, je prends le coffre avec les deux jeux de crampons + corde à double.',
      'Météo confirmée grand beau jusqu’à 14h sur l’Aiguille du Midi, iso 0°C vers 3 100 m.',
      'Merci pour le bulletin ! N’oubliez pas la frontale et le fond de sac chaud.',
      'Quelqu’un a les conditions récentes sur les Lacs Robert en Belledonne ?',
      'Passé hier soir : sentier sec jusqu’au lac, juste deux petits névés sans crampons.',
      'Bienvenue aux 35 nouveaux membres qui ont rejoint le club cette semaine !',
    ];
    for (let i = 0; i < chatLines.length; i++) {
      await pgClient.query(
        `INSERT INTO club_channel_messages (channel_id, club_id, author_id, body, created_at)
         VALUES ($1,$2,$3,$4,$5)`,
        [
          channelIds[i % channelIds.length],
          clubId,
          allMemberIds[(i * 4) % 25],
          chatLines[i],
          new Date(now - (chatLines.length - i) * 1800_000).toISOString(),
        ],
      );
    }

    console.log('✅ SEED COMPLETE!');
    console.log(`   Club: Cordée des Alpes`);
    console.log(`   Club ID: ${clubId}`);
    console.log(`   Club Slug: ${CLUB_SLUG}`);
    console.log(`   URL: http://localhost:4029/clubs/${CLUB_SLUG}`);
    console.log(`   Members inserted: ${allMemberIds.length}`);
    console.log(`   Demo account (${DEMO_USER_ID}) added as admin/Fondateur.`);
  } finally {
    await pgClient.end();
  }
}

main().catch((err) => {
  console.error('❌ Seed failed:', err);
  process.exit(1);
});
