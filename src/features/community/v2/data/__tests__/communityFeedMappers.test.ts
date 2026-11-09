import { describe, expect, it } from 'vitest';
import {
  activityLabel,
  countSearchHits,
  eventDateTimeLabel,
  eventDurationLabel,
  groupSearchHits,
  hasMoreRows,
  isPastEvent,
  mapAgendaRows,
  mapAvatar,
  mapCarnetRow,
  mapClubRow,
  mapEventDetailRow,
  mapEventRow,
  mapFeedPeople,
  mapSearchHit,
  mapTrendingRow,
  nextFeedCursor,
  nonEmptyText,
  normalizeClubPrivacy,
  normalizeEventLevel,
  normalizeEventRegistration,
  normalizeMemberStatus,
  normalizeRouteTrace,
  normalizeSearchKind,
  normalizeVisibility,
  toNumber,
  UNLIMITED_SPOTS,
} from '../communityFeedMappers';
import type {
  AgendaFeedRow,
  CarnetFeedRow,
  ClubFeedRow,
  EventFeedRow,
  SearchFeedRow,
} from '../communityFeedRpc';

const NOW = new Date('2026-11-08T10:00:00+01:00');

function carnetRow(overrides: Partial<CarnetFeedRow> = {}): CarnetFeedRow {
  return {
    id: 'carnet-1',
    title: 'Tour des Écrins',
    destination: 'Hauts-Alpes',
    cover_image: 'https://cdn.example/cover.jpg',
    author_id: 'user-1',
    author_name: 'Camille Roux',
    author_avatar: null,
    start_date: '2026-11-01',
    end_date: '2026-11-04',
    nb_nuits: 3,
    route_distance_km: 62.4,
    elevation_gain_m: 3200,
    likes_count: 128,
    comments_count: 14,
    liked_by_me: true,
    travelers: {
      total: 3,
      avatars: [
        { id: 'user-1', name: 'Camille Roux', avatar: null },
        { id: 'user-2', name: 'Marc', avatar: 'https://cdn.example/marc.jpg' },
      ],
    },
    is_live: true,
    lat: 44.92,
    lng: 6.3,
    distance_km: 12.5,
    visibility: 'public',
    sort_key: 1762000000,
    ...overrides,
  };
}

function clubRow(overrides: Partial<ClubFeedRow> = {}): ClubFeedRow {
  return {
    id: 'club-1',
    slug: 'la-cordee-du-vercors',
    name: 'La Cordée du Vercors',
    emoji: null,
    privacy: 'closed',
    cover_image: null,
    cover_color: null,
    category: 'rando',
    activities: ['rando', 'trail'],
    location_label: 'Grenoble',
    members_count: 312,
    is_verified: true,
    my_status: 'pending',
    events_this_month: 5,
    last_post_at: '2026-11-08T08:00:00Z',
    friends: { total: 3, avatars: [{ id: 'u3', name: 'Julie', avatar: null }] },
    lat: 45.18,
    lng: 5.72,
    distance_km: 8,
    sort_key: 1762500000,
    ...overrides,
  };
}

function eventRow(overrides: Partial<EventFeedRow> = {}): EventFeedRow {
  return {
    id: 'event-1',
    title: 'Footing de la Bastille',
    activity: 'trail',
    emoji: '🥾',
    organizer_id: 'user-9',
    organizer_name: 'Nora S.',
    organizer_avatar: null,
    event_date: '2026-11-14',
    starts_at: '2026-11-14T08:00:00+01:00',
    ends_at: '2026-11-14T09:30:00+01:00',
    location: 'Grenoble',
    meeting_point: 'Téléphérique de la Bastille',
    level: 'facile',
    route_distance_km: 7,
    elevation_gain_m: 260,
    max_participants: 20,
    current_participants: 6,
    spots_left: 14,
    waitlist_enabled: true,
    status: 'upcoming',
    cover_image: null,
    my_status: 'registered',
    friends: { total: 1, avatars: [{ id: 'u4', name: 'Eli', avatar: null }] },
    lat: 45.19,
    lng: 5.73,
    distance_km: 2.2,
    sort_key: 1763107200,
    ...overrides,
  };
}

function searchRow(overrides: Partial<SearchFeedRow> = {}): SearchFeedRow {
  return {
    kind: 'carnet',
    id: 'carnet-1',
    title: 'Lac Blanc au lever du jour',
    subtitle: 'Chamonix',
    cover: null,
    href: '',
    score: 0.42,
    lat: 45.98,
    lng: 6.9,
    distance_km: 4.4,
    starts_at: null,
    ...overrides,
  };
}

describe('toNumber / nonEmptyText', () => {
  it('convertit les numeric PostgREST et rejette le non fini', () => {
    expect(toNumber(12)).toBe(12);
    expect(toNumber('12.5')).toBe(12.5);
    expect(toNumber(null)).toBeNull();
    expect(toNumber('abc')).toBeNull();
    expect(toNumber(Number.NaN)).toBeNull();
  });

  it('nettoie les textes vides (colonnes text default \'\')', () => {
    expect(nonEmptyText('  ')).toBeNull();
    expect(nonEmptyText('  Grenoble ')).toBe('Grenoble');
    expect(nonEmptyText(null)).toBeNull();
  });
});

describe('mapAvatar / mapFeedPeople', () => {
  it('calcule les initiales et le nom de repli', () => {
    const avatar = mapAvatar({ id: 'u1', name: 'Camille Roux', avatar: 'https://x/a.jpg' });
    expect(avatar).toMatchObject({ id: 'u1', name: 'Camille Roux', initials: 'CR', avatarUrl: 'https://x/a.jpg' });
    expect(mapAvatar({ id: null, name: null }).name).toBe('Voyageur');
    expect(mapAvatar({ id: null, name: null }).initials).toBe('VO');
  });

  it('conserve le total réel et plafonne les avatars fournis', () => {
    const people = mapFeedPeople({
      total: 7,
      avatars: [
        { id: 'a', name: 'A' },
        { id: 'b', name: 'B' },
      ],
    });
    expect(people.avatars.map((avatar) => avatar.id)).toEqual(['a', 'b']);
    expect(people.total).toBe(7);
    expect(mapFeedPeople(null)).toEqual({ avatars: [], total: 0 });
  });
});

describe('mapCarnetRow', () => {
  it('mappe une tuile carnet complète (compteurs serveur, voyageurs, en route)', () => {
    const vm = mapCarnetRow(carnetRow());
    expect(vm).toMatchObject({
      id: 'carnet-1',
      title: 'Tour des Écrins',
      destination: 'Hauts-Alpes',
      days: 4,
      distanceKm: 62.4,
      likesCount: 128,
      commentsCount: 14,
      likedByMe: true,
      isLive: true,
      travelersTotal: 3,
      visibility: 'public',
      distanceKmFromMe: 12.5,
      verifiedGps: false,
      routeTrace: null,
    });
    expect(vm.author.initials).toBe('CR');
    expect(vm.travelers).toHaveLength(2);
  });

  it('remplit les extras de la tuile (trace normalisée + badge GPS)', () => {
    const vm = mapCarnetRow(carnetRow(), {
      verifiedGps: true,
      routeTrace: [
        [0, 0],
        [100, 100],
      ],
    });
    expect(vm.verifiedGps).toBe(true);
    expect(vm.routeTrace).toEqual([
      [0, 0],
      [100, 100],
    ]);
  });

  it('replie les champs absents sans inventer de valeurs', () => {
    const vm = mapCarnetRow(
      carnetRow({ title: '', destination: null, nb_nuits: null, start_date: null, end_date: null, likes_count: null }),
    );
    expect(vm.title).toBe('Carnet sans titre');
    expect(vm.destination).toBe('');
    expect(vm.days).toBeNull();
    expect(vm.likesCount).toBe(0);
  });
});

describe('mapClubRow', () => {
  it('mappe une tuile club (privacy, statut, activités, amis)', () => {
    const vm = mapClubRow(clubRow());
    expect(vm).toMatchObject({
      id: 'club-1',
      slug: 'la-cordee-du-vercors',
      name: 'La Cordée du Vercors',
      privacy: 'closed',
      myStatus: 'pending',
      membersCount: 312,
      eventsThisMonth: 5,
      friendsTotal: 3,
      zoneLabel: 'Grenoble',
      distanceKmFromMe: 8,
    });
    expect(vm.activities).toEqual(['rando', 'trail']);
    expect(vm.friends).toHaveLength(1);
    expect(vm.rules).toBeNull();
    expect(vm.joinQuestions).toEqual([]);
  });

  it('tolère une ligne incomplète', () => {
    const vm = mapClubRow(clubRow({ name: null, slug: null, privacy: null, members_count: null, activities: null }));
    expect(vm.name).toBe('Club sans nom');
    expect(vm.slug).toBe('club-1');
    expect(vm.privacy).toBe('open');
    expect(vm.membersCount).toBe(0);
    expect(vm.activities).toEqual([]);
  });
});

describe('mapEventRow', () => {
  it('mappe un billet de sortie (places, niveau, durée, organisateur)', () => {
    const vm = mapEventRow(eventRow(), NOW);
    expect(vm).toMatchObject({
      id: 'event-1',
      title: 'Footing de la Bastille',
      activity: 'Trail',
      eventDate: '2026-11-14',
      level: 'facile',
      maxParticipants: 20,
      currentParticipants: 6,
      spotsLeft: 14,
      waitlistEnabled: true,
      myStatus: 'registered',
      participantsTotal: 6,
      past: false,
      distanceKmFromMe: 2.2,
      duration: '1 h 30',
    });
    expect(vm.organizer.name).toBe('Nora S.');
  });

  it('encode une capacité illimitée sans la déclarer complète', () => {
    const vm = mapEventRow(
      eventRow({ max_participants: 0, spots_left: null, current_participants: 3 }),
      NOW,
    );
    expect(vm.maxParticipants).toBe(0);
    expect(vm.spotsLeft).toBe(UNLIMITED_SPOTS);
  });

  it('marque une sortie passée et calcule la date depuis starts_at', () => {
    const vm = mapEventRow(
      eventRow({ event_date: null, starts_at: '2026-11-01T09:00:00+01:00', ends_at: '2026-11-01T12:00:00+01:00' }),
      NOW,
    );
    expect(vm.eventDate).toBe('2026-11-01');
    expect(vm.past).toBe(true);
    expect(vm.duration).toBe('3 h');
  });

  it('rejette un niveau inconnu et un statut inconnu', () => {
    const vm = mapEventRow(eventRow({ level: 'expert', my_status: 'peut-être' }), NOW);
    expect(vm.level).toBeNull();
    expect(vm.myStatus).toBe('none');
  });
});

describe('mapEventDetailRow', () => {
  it('mappe une sortie lue hors RPC (sécurité, récurrence, club)', () => {
    const vm = mapEventDetailRow(
      {
        id: 'event-2',
        title: 'Lac Blanc au lever du jour',
        activity: 'rando',
        organizer_id: 'u9',
        event_date: '2026-11-20',
        starts_at: '2026-11-20T06:30:00+01:00',
        ends_at: null,
        location: 'Chamonix',
        meeting_point: 'Parking de la Flégère',
        level: 'difficile',
        distance_km: '9.8',
        elevation_gain_m: 710,
        max_participants: 10,
        current_participants: 7,
        waitlist_enabled: false,
        status: 'upcoming',
        cover_image: null,
        duration: '5 h',
        description: 'Lever de soleil sur le massif.',
        safety_notes: 'Frontale obligatoire.',
        safety_checklist: ['DVA', 'Frontale', ''],
        recurrence: 'weekly',
        club_id: 'club-1',
        club_name: 'La Cordée',
        kit_id: null,
      },
      { name: 'Nora S.', avatar: null },
      'waitlist',
      NOW,
    );
    expect(vm).toMatchObject({
      title: 'Lac Blanc au lever du jour',
      distanceKm: 9.8,
      level: 'difficile',
      spotsLeft: 3,
      myStatus: 'waitlist',
      duration: '5 h',
      description: 'Lever de soleil sur le massif.',
      safetyNotes: 'Frontale obligatoire.',
      safetyChecklist: ['DVA', 'Frontale'],
      recurrence: 'weekly',
      clubId: 'club-1',
      clubName: 'La Cordée',
      past: false,
    });
    expect(vm.organizer.name).toBe('Nora S.');
  });
});

describe('normalizeRouteTrace', () => {
  it('normalise une trace en 0-100 sans déformation et inverse l’axe Y', () => {
    const trace = normalizeRouteTrace([
      [6, 45],
      [6.5, 45],
      [6.5, 45.5],
    ]);
    expect(trace).not.toBeNull();
    const points = trace as Array<[number, number]>;
    expect(points).toHaveLength(3);
    // x va de 0 à 100 (trajet le plus large), y est inversé (max lat en haut).
    expect(points[0]?.[0]).toBe(0);
    expect(points[1]?.[0]).toBe(100);
    expect(points[0]?.[1]).toBe(100);
    expect(points[2]?.[1]).toBe(0);
  });

  it('renvoie null pour une trace absente, trop courte ou dégénérée', () => {
    expect(normalizeRouteTrace(null)).toBeNull();
    expect(normalizeRouteTrace([])).toBeNull();
    expect(normalizeRouteTrace([[6, 45]])).toBeNull();
    expect(
      normalizeRouteTrace([
        [6, 45],
        [6, 45],
      ]),
    ).toBeNull();
  });
});

describe('nextFeedCursor / hasMoreRows', () => {
  it('renvoie le curseur de la dernière ligne d’une page pleine', () => {
    const rows = Array.from({ length: 3 }, (_, index) => ({ id: `id-${index}`, sort_key: 100 - index }));
    expect(nextFeedCursor(rows, 3)).toEqual({ v: 98, id: 'id-2' });
    expect(hasMoreRows(rows, 3)).toBe(true);
  });

  it('renvoie null quand la page est incomplète ou la clé absente', () => {
    expect(nextFeedCursor([{ id: 'a', sort_key: 5 }], 3)).toBeNull();
    expect(nextFeedCursor([{ id: 'a', sort_key: null }], 1)).toBeNull();
    expect(hasMoreRows([{}], 3)).toBe(false);
  });
});

describe('mapSearchHit / regroupement', () => {
  it('mappe un résultat et reconstruit le lien de repli', () => {
    const hit = mapSearchHit(searchRow());
    expect(hit).toMatchObject({
      kind: 'carnet',
      id: 'carnet-1',
      title: 'Lac Blanc au lever du jour',
      subtitle: 'Chamonix',
      href: '/carnets/carnet-1',
      score: 0.42,
      distanceKm: 4.4,
    });
  });

  it('écarte un type inconnu', () => {
    expect(mapSearchHit(searchRow({ kind: 'inconnu' }))).toBeNull();
    expect(normalizeSearchKind('club')).toBe('club');
    expect(normalizeSearchKind('autre')).toBeNull();
  });

  it('groupe dans l’ordre Publications, Carnets, Clubs, Sorties, Membres', () => {
    const hits = [
      mapSearchHit(searchRow({ kind: 'membre', id: 'm1' })),
      mapSearchHit(searchRow({ kind: 'sortie', id: 's1' })),
      mapSearchHit(searchRow({ kind: 'carnet', id: 'c1' })),
      mapSearchHit(searchRow({ kind: 'post', id: 'p1' })),
      mapSearchHit(searchRow({ kind: 'club', id: 'k1' })),
    ].filter((hit): hit is NonNullable<typeof hit> => hit != null);
    expect(groupSearchHits(hits).map((group) => group.kind)).toEqual([
      'post',
      'carnet',
      'club',
      'sortie',
      'membre',
    ]);
    expect(countSearchHits(hits, 'carnet')).toBe(1);
    expect(groupSearchHits([])).toEqual([]);
  });
});

describe('tendances et agenda', () => {
  it('mappe une tendance lieu ou tag', () => {
    expect(mapTrendingRow({ kind: 'lieu', label: 'Lac Blanc', hits: '40' })).toEqual({
      kind: 'place',
      label: 'Lac Blanc',
      hits: 40,
    });
    expect(mapTrendingRow({ kind: 'tag', label: '#bivouac', hits: 2 })?.kind).toBe('term');
    expect(mapTrendingRow({ kind: 'lieu', label: '   ', hits: 1 })).toBeNull();
  });

  it('indexe l’agenda par date ISO et ignore les lignes invalides', () => {
    const rows: AgendaFeedRow[] = [
      { day: '2026-11-08', events_count: 0 },
      { day: '2026-11-14T00:00:00', events_count: 2 },
      { day: '', events_count: 3 },
      { day: '2026-11-15', events_count: -1 },
    ];
    expect(mapAgendaRows(rows)).toEqual({ '2026-11-08': 0, '2026-11-14': 2 });
    expect(mapAgendaRows(null)).toEqual({});
  });
});

describe('étiquettes et énumérations', () => {
  it('normalise visibilité, privacy, statut d’adhésion et inscription', () => {
    expect(normalizeVisibility('friends')).toBe('friends');
    expect(normalizeVisibility('privé')).toBe('private');
    expect(normalizeVisibility(null)).toBe('public');
    expect(normalizeClubPrivacy('closed')).toBe('closed');
    expect(normalizeClubPrivacy('secret')).toBe('secret');
    expect(normalizeClubPrivacy('autre')).toBe('open');
    expect(normalizeMemberStatus('admin')).toBe('admin');
    expect(normalizeMemberStatus('pending')).toBe('pending');
    expect(normalizeMemberStatus('x')).toBe('none');
    expect(normalizeEventRegistration('waitlist')).toBe('waitlist');
    expect(normalizeEventRegistration('in')).toBe('registered');
    expect(normalizeEventLevel('moyen')).toBe('moyen');
    expect(normalizeEventLevel('expert')).toBeNull();
  });

  it('traduit les activités connues et capitalise les autres', () => {
    expect(activityLabel('rando')).toBe('Randonnée');
    expect(activityLabel('vélo')).toBe('Vélo');
    expect(activityLabel('kayak')).toBe('Kayak');
    expect(activityLabel('')).toBe('');
  });

  it('formate une durée depuis les heures quand la colonne est vide', () => {
    expect(eventDurationLabel('', '2026-11-14T08:00:00+01:00', '2026-11-14T10:05:00+01:00')).toBe('2 h 05');
    expect(eventDurationLabel('', '2026-11-14T08:00:00+01:00', '2026-11-14T08:45:00+01:00')).toBe('45 min');
    expect(eventDurationLabel('2 h', null, null)).toBe('2 h');
    expect(eventDurationLabel('', null, null)).toBeNull();
  });

  it('détecte une sortie passée et lit entièrement la date', () => {
    expect(isPastEvent('2026-11-07', null, NOW)).toBe(true);
    expect(isPastEvent('2026-11-08', null, NOW)).toBe(false);
    expect(isPastEvent(null, null, NOW)).toBe(false);
    const label = eventDateTimeLabel(mapEventRow(eventRow(), NOW));
    expect(label).toContain('samedi 14 novembre');
    expect(label).toContain('08:00');
  });
});
