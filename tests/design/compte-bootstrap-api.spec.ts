import { describe, it, expect, vi } from 'vitest';
import {
  mapProfile,
  mapCarnets,
  mapOutings,
  mapPosts,
  mapOrders,
  mapNotifications,
  mapTribu,
  mapClubs,
  mapKits,
  mapStories,
  mapHighlights,
  mapCompanions,
  mapReposts,
  mapChallenges,
  mapStamps,
  mapStats,
  mapTrust,
  mapLoans,
  mapVisibility,
  mapBadges,
  loadAccountBootstrap,
  resolveKitImages,
} from '../../src/features/compte/data/accountBootstrap';

describe('Compte bootstrap — mapping réel', () => {
  it('mappe le profil et les compteurs', () => {
    const p = mapProfile({ id: 'u1', handle: 'tony_frc', full_name: 'Tony', location: 'Lyon', bio: 'Bivouac' }, 12, 3);
    expect(p.handle).toBe('tony_frc');
    expect(p.name).toBe('Tony');
    expect(p.followersCount).toBe(12);
    expect(p.followingCount).toBe(3);
    expect(p.bioLine).toBe('Lyon · Bivouac');
    expect(p.isGuest).toBe(false);
  });

  it('mappe les carnets avec des positions stables', () => {
    const rows = mapCarnets([
      { id: 'c1', title: 'Lac Blanc', destination: 'Mont-Blanc', description: 'Aube', likes_count: 4, views_count: 12, visibility: 'public', created_at: '2026-09-19T08:00:00Z' },
      { id: 'c2', title: 'Vercors', destination: 'Vercors', visibility: 'private' },
    ]);
    expect(rows).toHaveLength(2);
    expect(rows[0].status).toBe('pub');
    expect(rows[1].status).toBe('draft');
    expect(rows[0].likes).toBe(4);
    expect(rows[0].x).toBeGreaterThan(0);
    expect(rows[1].h).toBeGreaterThan(100);
  });

  it('mappe les publications community_posts, pas les carnets', () => {
    const rows = mapPosts([
      { id: 'p1', title: 'Lac Blanc', content: 'Aube parfaite', image_url: 'x.jpg', media_urls: [], likes_count: 7, comments_count: 2, audience: 'public', created_at: '2026-09-19T08:00:00Z' },
    ]);
    expect(rows[0].postId).toBe('p1');
    expect(rows[0].title).toBe('Lac Blanc');
    expect(rows[0].likes).toBe(7);
    expect(rows[0].views).toBe(2);
  });

  it('mappe les sorties et le statut fait/à venir', () => {
    const rows = mapOutings(
      [
        { id: 'h1', route_id: 1, started_at: '2026-09-01T06:00:00Z', ended_at: '2026-09-01T15:00:00Z', distance_km: 12.5, elevation_gain_m: 800, positions_timed: [], kit_id: 'k1' },
        { id: 'h2', route_id: 2, started_at: '2026-10-28T06:00:00Z', ended_at: '2026-10-28T15:00:00Z' },
      ],
      [{ id: 1, name: 'Lac Blanc', region: 'Mont-Blanc' }, { id: 2, name: 'Néouvielle', region: 'Pyrénées' }]
    );
    expect(rows[0].status).toBe('done');
    expect(rows[0].mass).toBe('Mont-Blanc');
    expect(rows[0].km).toBe(12.5);
    expect(rows[0].dplus).toBe(800);
    expect(rows[0].startedAt).toBe('2026-09-01T06:00:00Z');
    expect(rows[0].photos).toEqual([]);
    expect(rows[1].status).toBe('upcoming');
  });

  it('capitalise les noms de massifs pour l’affichage sans changer les identifiants', () => {
    const rows = mapOutings(
      [
        {
          id: 'h1',
          route_id: 1,
          started_at: '2026-09-01T06:00:00Z',
          ended_at: '2026-09-01T15:00:00Z',
        },
      ],
      [{ id: 1, name: 'Lac Blanc', region: 'mont blanc' }]
    );
    expect(rows[0].id).toBe('h1');
    expect(rows[0].mass).toBe('Mont Blanc');

    const companions = mapCompanions(
      [{ session_id: 's1', user_id: 'u2', started_at: '2026-09-01T06:00:00Z', massif: 'pyrénées' }],
      new Map([['u2', { handle: 'lea', full_name: 'Léa' }]])
    );
    expect(companions[0].id).toBe('u2');
    expect(companions[0].massif).toBe('Pyrénées');
    expect(companions[0].mass).toBe('Pyrénées');
  });

  it('mappe les kits réels et les stories actives', () => {
    const kits = mapKits(
      [
        { id: 'k1', name: 'Kit test', description: 'Sac réel', total_weight_g: 4200, generation: 2, field_proven_count: 3, ancestors: ['root'], is_souche: false },
        { id: 'k2', name: 'Souche', generation: 0, is_souche: true },
      ],
      new Map([['k1', 7]])
    );
    expect(kits[0].n).toBe('Kit test');
    expect(kits[0].gen).toBe('Lignée G2');
    expect(kits[0].items).toBe(7);
    expect(kits[0].prop).toBe(1);
    expect(kits[0].w).toBe(4200);
    expect(kits[1].gen).toBe('Kit souche');

    const stories = mapStories([
      { id: 's1', caption: 'Sommet', storage_path: 'u/s1.jpg', created_at: '2026-10-21T10:00:00Z' },
      { id: 's2', caption: 'Sans média' },
    ]);
    expect(stories).toHaveLength(1);
    expect(stories[0].storyId).toBe('s1');
    expect(stories[0].image).toBe('/api/stories/s1/media');
    expect(stories[0].title).toBe('Sommet');
  });

  it('mappe commandes, notifications, tribu et clubs', () => {
    const { orders, bookings } = mapOrders([
      { id: 'o1', order_number: '#LK-1', status: 'paid', total_eur: 42, created_at: '2026-09-01T10:00:00Z', items: [{ product_name: 'Duvet' }] },
    ]);
    expect(orders[0].id).toBe('#LK-1');
    expect(orders[0].amt).toBe(42);
    expect(bookings).toEqual([]);

    const notifications = mapNotifications([{ id: 'n1', type: 'like', title: 'Nouveau like', read: false }]);
    expect(notifications[0].type).toBe('like');
    expect(notifications[0].read).toBe(false);

    const tribu = mapTribu([{ id: 'u2', handle: 'lea', full_name: 'Léa', trust_score: 91 }]);
    expect(tribu[0].ps).toBe('lea');
    expect(tribu[0].i).toBe('L');

    const clubs = mapClubs(
      [{ club_id: 'c1', role: 'Membre', status: 'active' }],
      [{ id: 'c1', name: 'Club Alpin', members_count: 142 }]
    );
    expect(clubs[0].n).toBe('Club Alpin');
    expect(clubs[0].joined).toBe(true);
  });

  it('mappe les kits avec image de repli', () => {
    const kits = mapKits(
      [{ id: 'k1', name: 'Kit', cover_image_url: null, total_weight_g: 4200 }],
      new Map([['k1', 10]]),
      new Map([['k1', 'https://img/x.jpg']])
    );
    expect(kits[0].image).toBe('https://img/x.jpg');

    const covered = mapKits(
      [{ id: 'k2', name: 'Kit couvert', cover_image_url: 'https://img/cover.jpg' }],
      new Map(),
      new Map([['k2', 'https://img/x.jpg']])
    );
    expect(covered[0].image).toBe('https://img/cover.jpg');
  });

  it('mappe les À la une avec leur nombre d’éléments', () => {
    const highlights = mapHighlights(
      [{ id: 'h1', title: 'Néouvielle', cover_story_id: 's1', position: 1 }],
      new Map([['h1', 4]])
    );
    expect(highlights[0].id).toBe('h1');
    expect(highlights[0].title).toBe('Néouvielle');
    expect(highlights[0].items).toBe(4);
    expect(highlights[0].coverStoryId).toBe('s1');
    expect(highlights[0].position).toBe(1);
  });

  it('mappe les compagnons avec leurs sorties communes', () => {
    const companions = mapCompanions(
      [
        { session_id: 's1', user_id: 'u2' },
        { session_id: 's2', user_id: 'u2' },
        { session_id: 's3', user_id: 'u3' },
      ],
      new Map([['u2', { handle: 'lea', full_name: 'Léa', avatar_url: 'https://img/lea.jpg' }]])
    );
    expect(companions).toHaveLength(2);
    expect(companions[0].id).toBe('u2');
    expect(companions[0].ps).toBe('lea');
    expect(companions[0].n).toBe('Léa');
    expect(companions[0].i).toBe('L');
    expect(companions[0].outings).toBe(2);
    expect(companions[0].avatar).toBe('https://img/lea.jpg');
    expect(companions[1].outings).toBe(1);
  });

  it('mappe les republications avec l’attribution de la source', () => {
    const reposts = mapReposts(
      [
        {
          id: 'p2',
          reposted_from_id: 'p1',
          created_at: '2026-10-01T08:00:00Z',
          audience: 'public',
          club_id: null,
        },
      ],
      [
        {
          id: 'p1',
          title: 'Lac Blanc',
          content: 'Aube parfaite',
          author_id: 'u2',
          image_url: 'https://img/lac.jpg',
          created_at: '2026-09-19T08:00:00Z',
        },
      ],
      new Map([['u2', { handle: 'lea', full_name: 'Léa' }]])
    );
    expect(reposts).toHaveLength(1);
    expect(reposts[0].id).toBe('p2');
    expect(reposts[0].sourceId).toBe('p1');
    expect(reposts[0].sourceTitle).toBe('Lac Blanc');
    expect(reposts[0].sourceAuthor).toBe('@lea');
    expect(reposts[0].sourceImageUrl).toBe('https://img/lac.jpg');
    expect(reposts[0].sourceCreatedAt).toBe('2026-09-19T08:00:00Z');
    expect(reposts[0].sourceUnavailable).toBeUndefined();
    expect(reposts[0].audience).toBe('public');
    expect(reposts[0]).not.toHaveProperty('clubId');
  });

  it('replie une republication chaînée sur sa ligne copiée quand la racine est invisible', () => {
    const reposts = mapReposts(
      [
        {
          id: 'p3',
          reposted_from_id: 'racine-invisible',
          title: 'Refuge du Lac',
          content: 'Aube au refuge',
          author_id: 'u9',
          created_at: '2026-10-02T08:00:00Z',
          audience: 'public',
        },
        {
          id: 'p4',
          reposted_from_id: 'autre-racine-invisible',
          content: 'Première ligne\nDeuxième ligne',
          author_id: 'u9',
        },
      ],
      [],
      new Map([['u9', { handle: 'tony', full_name: 'Tony' }]])
    );
    expect(reposts[0].sourceId).toBe('p3');
    expect(reposts[0].sourceTitle).toBe('Refuge du Lac');
    // La racine est cachée : son auteur est inconnu, jamais celui du relayeur.
    expect(reposts[0].sourceAuthor).toBeNull();
    expect(reposts[0].sourceUnavailable).toBe(true);
    expect(reposts[0].sourceImageUrl).toBeNull();
    expect(reposts[0].sourceCreatedAt).toBe('');
    // Sans titre copié, la première ligne du contenu sert de titre lisible.
    expect(reposts[1].sourceTitle).toBe('Première ligne');
    expect(reposts[1].sourceAuthor).toBeNull();
    expect(reposts[1].sourceUnavailable).toBe(true);
  });

  it('pointe la republication vers sa ligne visible quand la racine est invisible', () => {
    const reposts = mapReposts(
      [
        {
          id: 'p5',
          reposted_from_id: 'racine-inaccessible',
          title: 'Refuge du Lac',
          content: 'Aube au refuge',
          author_id: 'u9',
        },
      ],
      [],
      new Map([['u9', { handle: 'tony', full_name: 'Tony' }]])
    );
    // La carte ne doit jamais renvoyer vers une racine que la RLS cache.
    expect(reposts[0].sourceId).toBe('p5');
    expect(reposts[0].sourceId).not.toBe('racine-inaccessible');
    expect(reposts[0].sourceTitle).toBe('Refuge du Lac');
    expect(reposts[0].sourceAuthor).toBeNull();
    expect(reposts[0].sourceUnavailable).toBe(true);
  });

  it('préfère le badge actif puis obtenu entre deux homonymes', () => {
    const badges = mapBadges(
      [
        { id: 'b-inactive', name: 'Explorateur', active: false, points_reward: 10 },
        { id: 'b-active', name: 'Explorateur', active: true, points_reward: 20 },
        { id: 'b-locked', name: 'Bivouac', active: true },
        { id: 'b-earned', name: 'Bivouac', active: true },
      ],
      [{ badge_id: 'b-earned', earned_at: '2026-09-01T10:00:00Z' }]
    );
    // Le doublon actif gagne même s'il arrive après une fiche inactive.
    expect(badges[0].id).toBe('b-active');
    expect(badges[0].earned).toBe(false);
    // À statut actif égal, la fiche réellement obtenue est conservée.
    expect(badges[1].id).toBe('b-earned');
    expect(badges[1].earned).toBe(true);
  });

  it('mappe les défis avec la progression réelle', () => {
    const challenges = mapChallenges(
      [
        {
          id: 'c1',
          title: 'Bivouac étoilé',
          category: 'Explorer',
          difficulty: 'Moyen',
          xp: 120,
          total: 5,
          deadline: '2026-11-30',
        },
        { id: 'c2', title: 'Sans progression', total: 3, xp: 50 },
        { id: 'c3', title: 'Sans cible', xp: 10, active: false },
      ],
      new Map([['c1', { progress: 3, completed: false }]])
    );
    expect(challenges[0].progress).toBe(3);
    expect(challenges[0].target).toBe(5);
    expect(challenges[0].completed).toBe(false);
    expect(challenges[0].xp).toBe(120);
    expect(challenges[0].active).toBe(true);
    expect(challenges[1].progress).toBe(0);
    expect(challenges[1].target).toBe(3);
    // Aucune cible inventée quand `total` est absent.
    expect(challenges[2].target).toBeNull();
    expect(challenges[2].active).toBe(false);
  });

  it('dérive les tampons du passeport des sorties réelles', () => {
    const stamps = mapStamps(
      [
        { id: 's1', route_id: 1, started_at: '2026-08-01T06:00:00Z', ended_at: '2026-08-01T15:00:00Z', positions_timed: [{ lat: 1 }] },
        { id: 's2', route_id: 1, started_at: '2026-08-02T06:00:00Z', ended_at: '2026-08-02T15:00:00Z' },
        { id: 's3', route_id: 2, started_at: '2026-08-03T06:00:00Z', ended_at: '2026-08-03T15:00:00Z', positions_timed: [] },
      ],
      [
        { id: 1, name: 'Lac Blanc', region: 'Mont-Blanc' },
        { id: 2, name: 'Néouvielle', region: 'Pyrénées' },
      ],
      [{ geoname_id: 9001, name: 'Mont-Blanc', name_plain: 'mont-blanc', country_code: 'FR' }]
    );
    expect(stamps).toHaveLength(2);
    expect(stamps[0].name).toBe('Mont-Blanc');
    expect(stamps[0].kind).toBe('massif');
    expect(stamps[0].outings).toBe(2);
    expect(stamps[0].verified).toBe(true);
    expect(stamps[1].name).toBe('Pyrénées');
    expect(stamps[1].verified).toBe(false);
  });

  it('mapClubs renvoie null sans événement futur', () => {
    const clubs = mapClubs(
      [{ club_id: 'c1', role: 'Membre', status: 'active' }],
      [{ id: 'c1', name: 'Club Alpin', members_count: 42 }],
      []
    );
    expect(clubs[0].nextEvent).toBeNull();
  });

  it('mapClubs ignore un événement passé', () => {
    const past = new Date(Date.now() - 3 * 86_400_000).toISOString();
    const clubs = mapClubs(
      [{ club_id: 'c1', role: 'Membre', status: 'active' }],
      [{ id: 'c1', name: 'Club Alpin', members_count: 42 }],
      [{ id: 'e1', club_id: 'c1', title: 'Sortie passée', event_date: past }]
    );
    expect(clubs[0].nextEvent).toBeNull();
  });

  it('mapClubs garde le prochain événement le plus proche avec son identifiant', () => {
    const soon = new Date(Date.now() + 3 * 86_400_000).toISOString();
    const later = new Date(Date.now() + 10 * 86_400_000).toISOString();
    const clubs = mapClubs(
      [{ club_id: 'c1', role: 'Membre', status: 'active' }],
      [{ id: 'c1', name: 'Club Alpin', members_count: 42 }],
      [
        { id: 'e-later', club_id: 'c1', title: 'Sortie lointaine', event_date: later },
        { id: 'e-soon', club_id: 'c1', title: 'Sortie proche', event_date: soon, participants_count: 8, max_participants: 12 },
      ]
    );
    expect(clubs[0].nextEvent?.id).toBe('e-soon');
    expect(clubs[0].nextEvent?.title).toBe('Sortie proche');
    expect(clubs[0].nextEvent?.event_date).toBe(soon);
    expect(clubs[0].nextEvent?.participants).toBe(8);
    expect(clubs[0].nextEvent?.max).toBe(12);
  });

  it('expose la participation de l’appelant au prochain événement', () => {
    const soon = new Date(Date.now() + 3 * 86_400_000).toISOString();
    const members = [{ club_id: 'c1', role: 'Membre', status: 'active' }];
    const clubs = [{ id: 'c1', name: 'Club Alpin', members_count: 42 }];
    const events = [{ id: 'e1', club_id: 'c1', title: 'Sortie proche', event_date: soon }];

    const attended = mapClubs(members, clubs, events, [], [], [{ event_id: 'e1', user_id: 'u1' }]);
    expect(attended[0].nextEvent?.attending).toBe(true);

    const absent = mapClubs(members, clubs, events, [], [], []);
    expect(absent[0].nextEvent?.attending).toBe(false);
  });

  it('expose le nombre réel de membres actifs et les métadonnées du club', () => {
    const members = [{ club_id: 'c1', role: 'Membre', status: 'active' }];
    const clubs = [
      {
        id: 'c1',
        name: 'Club Alpin',
        members_count: 142,
        emoji: '⛰️',
        category: 'Alpinisme',
      },
    ];

    const mapped = mapClubs(
      members,
      clubs,
      [],
      [],
      [],
      [],
      new Map([['c1', 7]])
    );
    expect(mapped[0].members).toBe(7);
    expect(mapped[0].emoji).toBe('⛰️');
    expect(mapped[0].category).toBe('Alpinisme');

    // Décompte indisponible : repli honnête sur le compteur dénormalisé.
    const fallback = mapClubs(members, clubs, [], [], [], [], null);
    expect(fallback[0].members).toBe(142);
    // Compteur dénormalisé absent : aucun membre inventé.
    const empty = mapClubs(members, [{ id: 'c1', name: 'Club Alpin' }], [], [], [], [], null);
    expect(empty[0].members).toBe(0);
    expect(empty[0].emoji).toBeNull();
    expect(empty[0].category).toBeNull();
  });

  it('résout l’image d’un kit : objet possédé puis catalogue, sinon rien', () => {
    const images = resolveKitImages(
      [
        { kit_id: 'k1', name: 'Osprey Exos 58', product_ownership_id: 'o1' },
        { kit_id: 'k2', name: 'Osprey Exos 58', product_ownership_id: 'o2' },
        { kit_id: 'k3', name: 'Sans visuel', product_ownership_id: null },
        { kit_id: 'k4', name: 'Osprey Exos 58', product_ownership_id: null },
      ],
      [{ nom: 'Osprey Exos 58', image: 'https://img/catalogue.jpg' }],
      [
        { id: 'o1', photo_url: 'https://img/objet1.jpg' },
        { id: 'o2', photo_url: null },
      ]
    );
    // Chaîne requise : photo de l'objet possédé AVANT l'image catalogue.
    expect(images.get('k1')).toBe('https://img/objet1.jpg');
    expect(images.get('k2')).toBe('https://img/catalogue.jpg');
    expect(images.get('k4')).toBe('https://img/catalogue.jpg');
    expect(images.has('k3')).toBe(false);

    // Tout vide : aucune image inventée.
    expect(resolveKitImages([], [], []).size).toBe(0);
    expect(resolveKitImages([{ kit_id: 'k5', name: 'Sans données' }], [], []).size).toBe(0);
  });

  it('ne fabrique aucun tampon pour un itinéraire sans massif identifié', () => {
    const stamps = mapStamps(
      [{ id: 's1', route_id: 7, started_at: '2026-08-01T06:00:00Z', ended_at: '2026-08-01T15:00:00Z', positions_timed: [] }],
      [{ id: 7, name: 'Itinéraire sans région', region: null }],
      []
    );
    expect(stamps).toEqual([]);
  });

  it('calcule les stats sur toutes les sessions, sans plafond de liste', () => {
    const year = new Date().getUTCFullYear();
    const stats = mapStats(
      [
        {
          id: 'h1',
          route_id: 1,
          started_at: `${year}-01-10T22:00:00Z`,
          ended_at: `${year}-01-12T06:00:00Z`,
          distance_km: 10,
          elevation_gain_m: 500,
        },
        {
          id: 'h2',
          route_id: 2,
          started_at: `${year}-01-20T06:00:00Z`,
          ended_at: `${year}-01-20T15:00:00Z`,
          distance_km: 5.5,
          elevation_gain_m: 300,
        },
        {
          id: 'h3',
          route_id: 3,
          started_at: `${year}-02-02T06:00:00Z`,
          ended_at: `${year}-02-02T15:00:00Z`,
          distance_km: 4,
          elevation_gain_m: 100,
        },
      ],
      [
        { id: 1, name: 'Massif', region: 'mont blanc' },
        { id: 2, name: 'Sans massif', region: null },
        { id: 3, name: 'Autre massif', region: 'vosges' },
      ],
      [
        { geoname_id: 1, name: 'Mont Blanc', name_plain: 'mont blanc', country_code: 'FR' },
        { geoname_id: 2, name: 'Vosges', name_plain: 'vosges', country_code: 'FR' },
      ]
    );
    expect(stats.km).toBe(19.5);
    expect(stats.dplus).toBe(900);
    expect(stats.outings).toBe(3);
    expect(stats.nights).toBe(2);
    expect(stats.massifs).toBe(2);
    expect(stats.countries).toBe(1);
    expect(stats.longestOuting).toBe(10);
    expect(stats.yearMonths).toHaveLength(12);
    expect(stats.yearMonths[0]).toBe(15.5);
    expect(stats.yearMonths[1]).toBe(4);
    expect(stats.bestMonth).toBe('Janvier');
  });

  it('agrège la confiance du propriétaire, sans les notes qu’il a données', () => {
    const trust = mapTrust(
      [
        // Côté prêteur : seule la note reçue de l'emprunteur compte, et le
        // retour de l'emprunteur ne pèse pas sur le taux du propriétaire.
        { id: 'l1', product_ownership_id: 'o1', lender_id: 'me', borrower_id: 'u2', status: 'rendu', loaned_at: '2026-01-01', due_date: '2026-01-10', returned_at: '2026-01-09', borrower_rating: 5, lender_rating: 1 },
        { id: 'l2', product_ownership_id: 'o1', lender_id: 'me', borrower_id: 'u3', status: 'rendu', loaned_at: '2026-01-01', due_date: '2026-01-10', returned_at: '2026-01-12', borrower_rating: 4 },
        // Côté emprunteur : seule la note reçue du prêteur compte, et seuls
        // ces retours alimentent le taux de retour à temps.
        { id: 'l3', product_ownership_id: 'o1', lender_id: 'u5', borrower_id: 'me', status: 'rendu', loaned_at: '2026-02-01', due_date: '2026-02-10', returned_at: '2026-02-08', lender_rating: 3, borrower_rating: 1 },
        { id: 'l4', product_ownership_id: 'o1', lender_id: 'u6', borrower_id: 'me', status: 'rendu', loaned_at: '2026-02-01', due_date: '2026-03-10', returned_at: '2026-03-12', lender_rating: null, borrower_rating: 5 },
        { id: 'l5', product_ownership_id: 'o1', lender_id: 'me', borrower_id: 'u7', status: 'en_cours', loaned_at: '2026-03-01', due_date: '2026-03-10', returned_at: null, borrower_rating: null },
        { id: 'l6', product_ownership_id: 'o1', lender_id: 'u8', borrower_id: 'me', status: 'en_retard', loaned_at: '2026-03-01', due_date: '2026-03-10', returned_at: null, lender_rating: null },
        // Prêt entre deux tiers : il ne concerne pas le propriétaire.
        { id: 'l7', product_ownership_id: 'o1', lender_id: 'u9', borrower_id: 'u10', status: 'en_cours', loaned_at: '2026-03-01', due_date: '2026-03-10', returned_at: null, borrower_rating: 1 },
      ],
      'me',
      true
    );
    expect(trust).toEqual({ verified: true, active: 2, onTimeRate: 50, rating: 4 });
  });

  it('ne fabrique ni note ni taux de retour sans donnée réelle', () => {
    const trust = mapTrust(
      [
        { id: 'l1', product_ownership_id: 'o1', lender_id: 'me', borrower_id: 'u2', status: 'en_cours', loaned_at: '2026-01-01', due_date: '2026-01-10', returned_at: null, borrower_rating: null },
        // Retour côté prêteur uniquement : il ne dit rien du comportement de
        // l'emprunteur, donc le taux reste inconnu.
        { id: 'l2', product_ownership_id: 'o1', lender_id: 'me', borrower_id: 'u3', status: 'rendu', loaned_at: '2026-01-01', due_date: '2026-01-10', returned_at: '2026-01-09', borrower_rating: null },
      ],
      'me',
      false
    );
    expect(trust.rating).toBeNull();
    expect(trust.onTimeRate).toBeNull();
    expect(trust.active).toBe(1);
    expect(trust.verified).toBe(false);
  });

  it('mappe les prêts emprunteur avec le prêteur, jamais le contact personnel', () => {
    const loanRows = [
      {
        id: 'l1',
        product_ownership_id: 'o1',
        lender_id: 'u9',
        borrower_id: 'me',
        borrower_contact: 'Mon propre contact',
        status: 'en_cours',
        loaned_at: '2026-01-01',
        due_date: '2026-02-01',
        returned_at: null,
        lender_rating: 4.5,
      },
    ];
    const ownership = new Map([['o1', { id: 'o1', name: 'Tente MSR' }]]);
    const loans = mapLoans(loanRows, ownership, new Map([['u9', { handle: 'lea', full_name: 'Léa' }]]), 'me');
    expect(loans[0].role).toBe('borrower');
    expect(loans[0].itemName).toBe('Tente MSR');
    expect(loans[0].counterpart).toBe('Léa');
    expect(loans[0].counterpart).not.toBe('Mon propre contact');
    expect(loans[0].rating).toBe(4.5);

    const sansProfil = mapLoans(loanRows, ownership, new Map(), 'me');
    expect(sansProfil[0].counterpart).toBe('Prêteur');
  });

  it('mappe la visibilité public/privé et l’invitation', () => {
    expect(mapVisibility({ profile_visibility: 'prive' })).toEqual({ profile: 'prive', invited: true });
    expect(mapVisibility({ profile_visibility: 'public' }, false)).toEqual({ profile: 'public', invited: false });
    expect(mapVisibility(null).profile).toBe('public');
  });

  it('charge club_event_participants pour l’appelant et expose attending', async () => {
    const soon = new Date(Date.now() + 3 * 86_400_000).toISOString();
    const { client, filters, selections } = createBootstrapClient({
      user_profiles: [{ id: 'u1', handle: 'tony', full_name: 'Tony' }],
      club_members: [{ club_id: 'c1', role: 'Membre', status: 'active' }],
      clubs: [{ id: 'c1', name: 'Club Alpin', members_count: 3 }],
      club_events: [
        {
          id: 'e1',
          club_id: 'c1',
          title: 'Névache',
          event_date: soon,
          location: 'Névache',
          participants_count: 1,
          max_participants: 10,
        },
      ],
      club_event_participants: [{ event_id: 'e1', user_id: 'u1' }],
    });

    const payload = await loadAccountBootstrap(client as never);
    if (!payload.authenticated) throw new Error('bootstrap non authentifié');
    expect(payload.clubs[0].nextEvent?.id).toBe('e1');
    expect(payload.clubs[0].nextEvent?.attending).toBe(true);
    expect(selections).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          table: 'club_event_participants',
          columns: expect.stringContaining('event_id'),
        }),
      ])
    );
    expect(filters).toContainEqual({
      table: 'club_event_participants',
      column: 'user_id',
      value: 'u1',
    });
  });

  it('laisse attending à false quand aucune participation n’est persistée', async () => {
    const soon = new Date(Date.now() + 3 * 86_400_000).toISOString();
    const { client } = createBootstrapClient({
      user_profiles: [{ id: 'u1', handle: 'tony', full_name: 'Tony' }],
      club_members: [{ club_id: 'c1', role: 'Membre', status: 'active' }],
      clubs: [{ id: 'c1', name: 'Club Alpin', members_count: 3 }],
      club_events: [{ id: 'e1', club_id: 'c1', title: 'Névache', event_date: soon }],
    });

    const payload = await loadAccountBootstrap(client as never);
    if (!payload.authenticated) throw new Error('bootstrap non authentifié');
    expect(payload.clubs[0].nextEvent?.attending).toBe(false);
  });

  it('charge la ligne copiée d’une republication chaînée quand la racine reste invisible', async () => {
    const { client, selections } = createBootstrapClient({
      user_profiles: [{ id: 'u1', handle: 'tony', full_name: 'Tony' }],
      community_posts: [
        {
          id: 'p3',
          reposted_from_id: 'racine-invisible',
          title: 'Refuge du Lac',
          content: 'Aube au refuge',
          author_id: 'u1',
          audience: 'public',
          created_at: '2026-10-02T08:00:00Z',
          likes_count: 0,
          comments_count: 0,
        },
      ],
    });

    const payload = await loadAccountBootstrap(client as never);
    if (!payload.authenticated) throw new Error('bootstrap non authentifié');
    expect(payload.reposts).toHaveLength(1);
    expect(payload.reposts[0].sourceId).toBe('p3');
    expect(payload.reposts[0].sourceTitle).toBe('Refuge du Lac');
    // Le relayeur n'est jamais présenté comme l'auteur de la source cachée.
    expect(payload.reposts[0].sourceAuthor).toBeNull();
    expect(payload.reposts[0].sourceUnavailable).toBe(true);
    expect(payload.reposts[0].sourceImageUrl).toBeNull();
    expect(payload.reposts[0].sourceCreatedAt).toBe('');
    expect(selections).toEqual(
      expect.arrayContaining([
        {
          table: 'community_posts',
          columns: 'id,title,content,author_id,image_url,created_at',
        },
      ])
    );
  });

  it('charge le décompte réel des membres actifs et les métadonnées du club', async () => {
    const { client, selections, filters } = createBootstrapClient({
      user_profiles: [{ id: 'u1', handle: 'tony', full_name: 'Tony' }],
      club_members: [
        { club_id: 'c1', user_id: 'u1', role: 'Membre', status: 'active' },
        { club_id: 'c1', user_id: 'u2', role: 'Membre', status: 'active' },
        { club_id: 'c1', user_id: 'u3', role: 'Membre', status: 'active' },
        { club_id: 'c1', user_id: 'u4', role: 'Membre', status: 'banned' },
      ],
      clubs: [
        {
          id: 'c1',
          name: 'Club Alpin',
          members_count: 42,
          emoji: '⛰️',
          category: 'Alpinisme',
        },
      ],
    });

    const payload = await loadAccountBootstrap(client as never);
    if (!payload.authenticated) throw new Error('bootstrap non authentifié');
    expect(payload.clubs).toHaveLength(1);
    // 3 adhésions actives réelles, pas le compteur dénormalisé 42.
    expect(payload.clubs[0].members).toBe(3);
    expect(payload.clubs[0].emoji).toBe('⛰️');
    expect(payload.clubs[0].category).toBe('Alpinisme');
    expect(selections).toContainEqual({
      table: 'clubs',
      columns: 'id,name,members_count,emoji,category',
    });
    expect(selections).toContainEqual({ table: 'club_members', columns: 'club_id,status' });
    expect(filters).toContainEqual({
      table: 'club_members',
      column: 'status',
      value: 'active',
    });
  });

  it('replie sur members_count quand le décompte actif échoue', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      const { client } = createBootstrapClient(
        {
          user_profiles: [{ id: 'u1', handle: 'tony', full_name: 'Tony' }],
          club_members: [
            { club_id: 'c1', user_id: 'u1', role: 'Membre', status: 'active' },
          ],
          clubs: [{ id: 'c1', name: 'Club Alpin', members_count: 42 }],
        },
        'u1',
        {
          fail: (table, ins) =>
            table === 'club_members' && ins.some(([column]) => column === 'club_id'),
        }
      );

      const payload = await loadAccountBootstrap(client as never);
      if (!payload.authenticated) throw new Error('bootstrap non authentifié');
      expect(payload.clubs).toHaveLength(1);
      expect(payload.clubs[0].members).toBe(42);
    } finally {
      warn.mockRestore();
    }
  });

  it('calcule le passeport et les compagnons sur toutes les sessions, au-delà des 24 affichées', async () => {
    const sessions = Array.from({ length: 25 }, (_, index) => {
      const startedAt = new Date(Date.UTC(2025, 0, 25 - index, 8));
      return {
        id: `s${index + 1}`,
        user_id: 'u1',
        route_id: index + 1,
        started_at: startedAt.toISOString(),
        ended_at: new Date(startedAt.getTime() + 7 * 3_600_000).toISOString(),
        distance_km: 5,
        elevation_gain_m: 100,
        positions_timed: [],
      };
    });
    const routes = Array.from({ length: 25 }, (_, index) => ({
      id: index + 1,
      name: `Itinéraire ${index + 1}`,
      region: `Massif ${index + 1}`,
    }));
    const oldest = sessions[24];

    const { client } = createBootstrapClient({
      user_profiles: [{ id: 'u1', handle: 'tony', full_name: 'Tony' }],
      hike_sessions: [
        ...sessions,
        {
          id: 's-compagnon',
          user_id: 'u2',
          route_id: 25,
          started_at: oldest.started_at,
          ended_at: oldest.ended_at,
          distance_km: 4,
          elevation_gain_m: 80,
          positions_timed: [],
        },
      ],
      hiking_routes: routes,
      public_profiles: [{ id: 'u2', handle: 'lea', full_name: 'Léa' }],
    });

    const payload = await loadAccountBootstrap(client as never);
    if (!payload.authenticated) throw new Error('bootstrap non authentifié');
    // La liste d'affichage reste bornée à 24 sorties…
    expect(payload.outings).toHaveLength(24);
    // …mais le passeport et la Cordée portent sur l'historique complet.
    expect(payload.stamps).toHaveLength(25);
    expect(payload.stamps.some((stamp) => stamp.name === 'Massif 25')).toBe(true);
    expect(payload.companions).toHaveLength(1);
    expect(payload.companions[0].outings).toBe(1);
  });
});

type BootstrapRow = Record<string, unknown>;

/** Client Supabase minimal : seules les lectures du bootstrap sont simulées. */
function createBootstrapClient(
  rowsByTable: Record<string, BootstrapRow[]>,
  userId = 'u1',
  options: {
    fail?: (table: string, ins: Array<[string, unknown]>) => boolean;
  } = {}
) {
  const selections: Array<{ table: string; columns: string }> = [];
  const filters: Array<{ table: string; column: string; value: unknown }> = [];

  const from = (table: string) => {
    const ins: Array<[string, unknown]> = [];
    const eqs: Array<[string, unknown]> = [];
    const neqs: Array<[string, unknown]> = [];
    let limit: number | null = null;
    const chain: any = {};
    const self = () => chain;
    const rows = () => {
      // La lecture des racines de republication filtre par identifiant : une
      // racine absente de la table reste invisible, comme sous RLS.
      if (table === 'community_posts' && ins.some(([column]) => column === 'id')) return [];
      // Filtres et plafond réels pour reproduire la pagination PostgREST. Une
      // fixture sans la colonne filtrée reste considérée comme correspondante,
      // pour ne pas alourdir les cas qui ne portent pas cette colonne.
      let data = (rowsByTable[table] ?? []).filter(
        (row) =>
          eqs.every(([column, value]) => !(column in row) || row[column] === value) &&
          neqs.every(([column, value]) => !(column in row) || row[column] !== value)
      );
      if (limit !== null) data = data.slice(0, limit);
      return data;
    };
    chain.select = (columns: string) => {
      selections.push({ table, columns });
      return chain;
    };
    chain.eq = (column: string, value: unknown) => {
      filters.push({ table, column, value });
      eqs.push([column, value]);
      return chain;
    };
    chain.in = (column: string, values: unknown) => {
      ins.push([column, values]);
      return chain;
    };
    chain.order = self;
    chain.limit = (value: number) => {
      limit = value;
      return chain;
    };
    chain.gt = self;
    chain.gte = self;
    chain.neq = (column: string, value: unknown) => {
      neqs.push([column, value]);
      return chain;
    };
    chain.or = self;
    chain.maybeSingle = async () => ({ data: rows()[0] ?? null, error: null });
    chain.single = async () => ({ data: rows()[0] ?? null, error: null });
    chain.then = (resolveThen: (value: { data: BootstrapRow[] | null; error: unknown }) => unknown) => {
      if (options.fail?.(table, ins)) {
        return Promise.resolve({ data: null, error: { message: 'boom' } }).then(resolveThen);
      }
      return Promise.resolve({ data: rows(), error: null }).then(resolveThen);
    };
    return chain;
  };

  const client = {
    auth: {
      getUser: async () => ({
        data: {
          user: { id: userId, email_confirmed_at: '2026-01-01T00:00:00Z' },
        },
      }),
    },
    from,
  };

  return { client, selections, filters };
}
