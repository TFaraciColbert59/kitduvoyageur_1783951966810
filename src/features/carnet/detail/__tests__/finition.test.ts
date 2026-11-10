import { describe, expect, it } from 'vitest';
import { buildEcrinsDetail } from '../fixtures/ecrinsDetail';
import { MOMENT_TYPES, parseMomentMeta, resolveMomentType } from '../momentTypes';
import { momentInsertRow, validateMomentInput } from '../createMoment';
import { dayMetric, parseDurationMinutes, resolveDayStats, selectDayData } from '../dayView';
import { buildDayTraces, selectMapLayers } from '../mapLayers';
import { applyHighlightPrefs, buildDefaultHighlights } from '../highlights';
import { isParticipantRole } from '../viewerRole';
import { buildCarnetDetail } from '../buildCarnetDetail';

describe('types de moment', () => {
  it('déduit le type de ce que le moment porte, sans rien inventer', () => {
    expect(resolveMomentType({ imageUrl: 'https://x.test/a.jpg' })).toBe('photo');
    expect(resolveMomentType({ imageUrl: 'https://x.test/a.MP4?x=1' })).toBe('video');
    expect(resolveMomentType({ caption: 'Un mot' })).toBe('text');
    expect(resolveMomentType({})).toBeNull();
    expect(resolveMomentType({ raw: 'rencontre' })).toBe('meet');
    expect(resolveMomentType({ raw: 'faune_flore' })).toBe('species');
    expect(resolveMomentType({ raw: 'spend', imageUrl: 'x.jpg' })).toBe('spend');
  });

  it('connaît les neuf types de la maquette', () => {
    expect([...MOMENT_TYPES]).toEqual([
      'photo', 'video', 'voice', 'text', 'meet', 'spend', 'kit', 'species', 'inc',
    ]);
  });

  it('ignore tout champ de moment_meta hors format', () => {
    expect(parseMomentMeta({ amountEur: 14, category: 'Repas', evil: '<script>' })).toEqual({
      amountEur: 14,
      category: 'Repas',
    });
    expect(parseMomentMeta([1])).toBeNull();
    expect(parseMomentMeta({ amountEur: 'x' })).toBeNull();
  });
});

describe('création de moment (zod)', () => {
  it('refuse un lieu vide avec le message de la maquette', () => {
    const r = validateMomentInput({ type: 'text', day: 1, place: '  ', caption: 'a' });
    expect(r).toEqual({ ok: false, error: 'Indique un lieu.' });
  });

  it('refuse un texte vide, un montant négatif et un type forgé', () => {
    expect(validateMomentInput({ type: 'text', day: 1, place: 'Col', caption: '' }).ok).toBe(false);
    expect(
      validateMomentInput({ type: 'spend', day: 1, place: 'Col', amountEur: -3, category: 'Repas' }).ok
    ).toBe(false);
    expect(validateMomentInput({ type: 'drop table', day: 1, place: 'Col' }).ok).toBe(false);
  });

  it('écrit une ligne carnet_moments complète pour une dépense', () => {
    const r = validateMomentInput({
      type: 'spend', day: 2, place: 'Pré de l’Alp', amountEur: 38, category: 'Repas', caption: 'Pique-nique',
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const row = momentInsertRow(r.value, {
      carnetId: 'c1', userId: 'u1', authorName: 'Camille', imageUrl: null, now: new Date('2026-07-14T12:05:00'),
    });
    expect(row).toMatchObject({
      carnet_id: 'c1', jour_numero: 2, heure: '12:05', citation: 'Pique-nique', auteur_id: 'u1',
      lieu: 'Pré de l’Alp', source: 'manuel', moment_type: 'spend',
      moment_meta: { amountEur: 38, category: 'Repas' },
    });
  });

  it('accepte chacun des neuf types avec une saisie minimale valide', () => {
    const base = { day: 1, place: 'Col' };
    const inputs = [
      { type: 'photo' }, { type: 'video' },
      { type: 'voice', caption: 't', durationLabel: '0:30' },
      { type: 'text', caption: 't' }, { type: 'meet', caption: 'c', who: 'Marc' },
      { type: 'spend', amountEur: 12, category: 'Repas' }, { type: 'kit', itemId: 'sac' },
      { type: 'species', caption: 'Bouquetin' }, { type: 'inc', caption: 'Chute' },
    ];
    for (const input of inputs) {
      expect(validateMomentInput({ ...base, ...input }).ok, input.type).toBe(true);
    }
  });
});

describe('un seul état de jour', () => {
  const detail = buildEcrinsDetail();

  it('filtre moments, étapes, nuits et kit sur le même jour', () => {
    const d2 = selectDayData(detail, 2);
    expect(d2.moments.every((m) => m.dayNumber === 2)).toBe(true);
    expect(d2.moments.length).toBeGreaterThan(0);
    expect(d2.etapes.map((e) => e.dayNumber)).toEqual([2]);
    expect(d2.nights.map((n) => n.dayNumber)).toEqual([2]);
    expect(d2.kitItems.every((i) => i.joursUtilises?.includes(2))).toBe(true);
    expect(selectDayData(detail, 0).moments).toHaveLength(detail.moments.length);
  });

  it('la carte du bas lit le même jour : traces, moments et nuits', () => {
    const closedJ3 = selectMapLayers({ detail, activeDay: 3, context: null });
    expect(closedJ3.markers.filter((m) => m.type === 'moment').every((m) => m.day === 3)).toBe(true);
    expect(buildDayTraces(detail.days).map((t) => t.day)).toEqual([1, 2, 3, 4]);
    const nightsAll = selectMapLayers({ detail, activeDay: 0, context: null });
    expect(nightsAll.markers.filter((m) => m.badge).map((m) => m.badge)).toEqual(['N1', 'N2', 'N3']);
  });

  it('chiffres : jour contre moyenne, sans valeur inventée', () => {
    const km = dayMetric(detail, 2, 'distance');
    expect(km.current).toBe(18.4);
    expect(km.total).toBeCloseTo(72.4, 1);
    expect(km.deltaPct).toBe(Math.round((18.4 / 18.1 - 1) * 100));
    expect(dayMetric(detail, 0, 'distance').current).toBeNull();
    expect(parseDurationMinutes('6 h 40')).toBe(400);
    expect(resolveDayStats({ days: [], etapes: [] })).toEqual([]);
  });
});

describe('couches de carte par tiroir', () => {
  const detail = buildEcrinsDetail();
  const kinds = (slot: Parameters<typeof selectMapLayers>[0]['context'], day = 0) => [
    ...new Set(selectMapLayers({ detail, activeDay: day, context: slot }).markers.map((m) => m.type)),
  ];

  it('Fil → moments, filtrés par lentille', () => {
    expect(kinds({ slot: 'fil', lensId: 'moments' })).toEqual(['moment']);
    const rencontres = selectMapLayers({ detail, activeDay: 0, context: { slot: 'fil', lensId: 'rencontres' } });
    expect(rencontres.markers).toHaveLength(detail.moments.filter((m) => m.type === 'meet').length);
  });

  it('Route → étapes ou nuits, rien sur Météo', () => {
    expect(kinds({ slot: 'route', lensId: 'etapes' })).toEqual(['poi']);
    expect(kinds({ slot: 'route', lensId: 'nuits' })).toEqual(['night']);
    expect(kinds({ slot: 'route', lensId: 'meteo' })).toEqual([]);
  });

  it('Sac → moments objet du kit ; Équipage → position seule', () => {
    const sac = selectMapLayers({ detail, activeDay: 0, context: { slot: 'sac', lensId: 'kit' } });
    expect(sac.markers).toHaveLength(detail.moments.filter((m) => m.type === 'kit').length);
    expect(sac.showLive).toBe(false);
    const equ = selectMapLayers({ detail, activeDay: 0, context: { slot: 'equipage', lensId: 'participants' } });
    expect(equ.markers).toEqual([]);
    expect(equ.showLive).toBe(true);
    expect(equ.contextMode).toBe(true);
  });

  it('un carnet sans point GPS ne produit aucun marqueur inventé', () => {
    const bare = { ...detail, days: detail.days.map((d) => ({ ...d, points: [] })) };
    expect(selectMapLayers({ detail: bare, activeDay: 0, context: { slot: 'fil', lensId: 'moments' } }).markers).toEqual([]);
    expect(buildDayTraces(bare.days)).toEqual([]);
  });
});

describe('pastilles À la une et rôles', () => {
  const detail = buildEcrinsDetail();

  it('cinq pastilles : trois voyageurs puis deux arrivées d’étape', () => {
    const list = buildDefaultHighlights(detail);
    expect(list).toHaveLength(5);
    expect(list.slice(0, 3).every((h) => h.kind === 'crew')).toBe(true);
    expect(list.slice(3).every((h) => h.kind === 'etape')).toBe(true);
  });

  it('retrait et renommage de l’utilisateur', () => {
    const list = buildDefaultHighlights(detail);
    const out = applyHighlightPrefs(list, { hidden: [list[0].id], labels: { [list[1].id]: 'Léo le photographe' } });
    expect(out).toHaveLength(4);
    expect(out[0].label).toBe('Léo le photographe');
  });

  it('owner et co_author sont des participants, un rôle absent est visiteur', () => {
    expect(isParticipantRole('participant')).toBe(true);
    expect(isParticipantRole('owner')).toBe(true);
    expect(isParticipantRole('co_author')).toBe(true);
    expect(isParticipantRole('visitor')).toBe(false);
    expect(isParticipantRole(undefined)).toBe(false);
  });

  it('le visiteur n’a ni budget ni propriétaire', () => {
    const v = buildEcrinsDetail({ role: 'visitor' });
    expect(v.budget).toBeNull();
    expect(v.isOwner).toBe(false);
  });
});

describe('totaux du carnet', () => {
  it('somme toutes les sorties, pas la dernière seule', () => {
    const session = (id: string, km: number, dp: number) => ({
      id, carnet_id: 'c', distance_km: km, elevation_gain_m: dp, duration_seconds: 3600,
      started_at: '2026-07-13T06:00:00Z', positions_geojson: null,
    });
    const sessions = [session('s4', 15, 860), session('s3', 22, 1340), session('s2', 18.4, 1080), session('s1', 17, 1240)];
    const detail = buildCarnetDetail({
      carnet: { id: 'c', author_id: 'a', title: 'T', destination: null, description: null, cover_image: null, cover_image_alt: null, start_date: null, end_date: null, visibility: 'public', verified: false, likes_count: 0, comments_count: 0, views_count: 0, distance_km: null, denivele_m: null, groupe_id: null, lieu_depart: null, lieu_arrivee: null },
      author: null, hikeSession: sessions[0], sessions, moments: [], kitItems: [], viewerId: null, liked: false, favorited: false,
    });
    expect(detail.distanceKm).toBeCloseTo(72.4, 5);
    expect(detail.elevationM).toBe(4520);
  });
});
