import { describe, expect, it } from 'vitest';
import { buildCarnetDetail } from '../buildCarnetDetail';
import type { BuildCarnetDetailInput, CarnetRow } from '../types';

const CARNET: CarnetRow = {
  id: 'c1',
  author_id: 'u1',
  title: 'Tour du Mont-Blanc',
  destination: 'France / Italie / Suisse',
  description: 'Dix jours, trois pays.',
  cover_image: 'https://cdn.test/cover.jpg',
  cover_image_alt: 'Crête au lever du jour',
  start_date: '2026-09-26',
  end_date: '2026-10-02',
  visibility: 'public',
  verified: false,
  likes_count: 6,
  comments_count: 3,
  views_count: 2320,
  distance_km: 106.4,
  denivele_m: 2002,
  groupe_id: null,
  lieu_depart: 'Chamonix',
  lieu_arrivee: 'Chamonix',
};

function input(overrides: Partial<BuildCarnetDetailInput> = {}): BuildCarnetDetailInput {
  return {
    carnet: CARNET,
    author: { id: 'u1', full_name: 'Camille Rochat', handle: 'camille', avatar_url: null, trust_score: 94 },
    hikeSession: null,
    etapes: [],
    hebergements: [],
    moments: [],
    kitItems: [],
    viewerId: null,
    liked: false,
    favorited: false,
    ...overrides,
  };
}

describe('buildCarnetDetail — identité', () => {
  it('reprend les compteurs réels du carnet', () => {
    const detail = buildCarnetDetail(input());
    expect(detail.engagement).toEqual({ likes: 6, comments: 3, views: 2320, liked: false, favorited: false });
  });

  it('ne fabrique aucun auteur quand la ligne est absente', () => {
    const detail = buildCarnetDetail(input({ author: null }));
    expect(detail.author).toBeNull();
  });

  it('ne marque vérifié que si la colonne vaut true', () => {
    expect(buildCarnetDetail(input()).verified).toBe(false);
    expect(buildCarnetDetail(input({ carnet: { ...CARNET, verified: true } })).verified).toBe(true);
  });

  it('calcule la propriété avec le lecteur', () => {
    expect(buildCarnetDetail(input({ viewerId: 'u1' })).isOwner).toBe(true);
    expect(buildCarnetDetail(input({ viewerId: 'u2' })).isOwner).toBe(false);
    expect(buildCarnetDetail(input({ viewerId: null })).isOwner).toBe(false);
  });

  it('retombe sur la destination puis sur un libellé honnête quand le titre manque', () => {
    expect(buildCarnetDetail(input({ carnet: { ...CARNET, title: null } })).title).toBe('France / Italie / Suisse');
    expect(
      buildCarnetDetail(input({ carnet: { ...CARNET, title: null, destination: null } })).title,
    ).toBe('Carnet sans titre');
  });

  it('expose la plage de dates formatée', () => {
    expect(buildCarnetDetail(input()).dateRange).toBe('26 sept. – 2 oct. 2026');
  });
});

describe('buildCarnetDetail — statistiques', () => {
  it('affiche distance et dénivelé une seule fois, sans division', () => {
    const detail = buildCarnetDetail(input({ hikeSession: null }));
    expect(detail.stats.map((s) => s.key)).toEqual(['distance', 'elevation']);
    expect(detail.stats[0].value).toBe('106,4 km');
    expect(detail.stats[1].value).toBe('2\u202f002 m');
  });

  it('dessine la trace trouvée sur une autre sortie que la plus récente', () => {
    const trace = {
      type: 'LineString',
      coordinates: [
        [6.86, 45.83],
        [6.87, 45.84],
      ],
    };
    const detail = buildCarnetDetail(
      input({
        /* La sortie la plus récente n'a pas de trace : elle ne doit plus
           effacer le parcours d'une sortie plus ancienne (constat Vercors). */
        hikeSession: {
          id: 'recent',
          carnet_id: 'c1',
          distance_km: '22',
          elevation_gain_m: '1120',
          duration_seconds: 18000,
          started_at: '2026-09-27T05:00:00Z',
          positions_geojson: null,
        },
        trace,
      }),
    );
    expect(detail.trace).toBe(trace);
    expect(detail.distanceKm).toBe(22);
    expect(detail.place.lat).toBeCloseTo(45.83, 6);
  });

  it('ne rend aucune trace quand la base n’en porte aucune', () => {
    const detail = buildCarnetDetail(input({ trace: null }));
    expect(detail.trace).toBeNull();
  });

  it('préfère la trace GPS aux colonnes du carnet', () => {
    const detail = buildCarnetDetail(
      input({
        hikeSession: {
          id: 'h1',
          carnet_id: 'c1',
          distance_km: '118.2',
          elevation_gain_m: '2410',
          duration_seconds: 36000,
          started_at: '2026-09-26T06:00:00Z',
          positions_geojson: { type: 'LineString', coordinates: [] },
        },
      }),
    );
    expect(detail.distanceKm).toBe(118.2);
    expect(detail.elevationM).toBe(2410);
    expect(detail.stats[0].value).toBe('118,2 km');
  });

  it('compte les jours réels des étapes, jamais une division', () => {
    const detail = buildCarnetDetail(
      input({
        etapes: [
          { id: 'e1', jour_numero: 1, ordre: 1, date_etape: null, lieu_depart: 'Chamonix', lieu_arrivee: 'Les Houches', recit: null, distance_km: 12, denivele_m: 800, duree_texte: '5h', meteo: null, temperature_c: null },
          { id: 'e2', jour_numero: 2, ordre: 2, date_etape: null, lieu_depart: 'Les Houches', lieu_arrivee: 'Contamines', recit: null, distance_km: 18, denivele_m: 1200, duree_texte: '7h', meteo: null, temperature_c: null },
        ],
      }),
    );
    const days = detail.stats.find((s) => s.key === 'days');
    expect(days?.value).toBe('2');
    expect(detail.stats.map((s) => s.key)).toEqual(['distance', 'elevation', 'days']);
  });

  it('supprime toute cellule absente', () => {
    const detail = buildCarnetDetail(
      input({ carnet: { ...CARNET, distance_km: null, denivele_m: null } }),
    );
    expect(detail.stats).toEqual([]);
  });
});

describe('buildCarnetDetail — jours, moments, kit', () => {
  it('construit un jour par étape réelle avec son hébergement', () => {
    const detail = buildCarnetDetail(
      input({
        etapes: [
          { id: 'e1', jour_numero: 1, ordre: 1, date_etape: '2026-09-26', lieu_depart: 'Chamonix', lieu_arrivee: 'Les Houches', recit: 'Départ sous la pluie.', distance_km: 12, denivele_m: 800, duree_texte: '5h', meteo: 'pluie', temperature_c: 11 },
        ],
        hebergements: [
          { id: 'h1', apres_jour_numero: 1, nom: 'Refuge de Bellachat', prix_cents: 4600, prix_note: 'demi-pension', altitude_m: 2100, note: null, hote: null },
        ],
      }),
    );
    expect(detail.days).toHaveLength(1);
    expect(detail.days[0]).toMatchObject({
      dayNumber: 1,
      label: 'JOUR 1 · 26 sept.',
      from: 'Chamonix',
      to: 'Les Houches',
      note: 'Départ sous la pluie.',
      distanceKm: 12,
      elevationM: 800,
      overnight: 'Refuge de Bellachat',
    });
  });

  it('déduit les jours des moments quand il n’y a pas d’étapes, sans inventer de récit', () => {
    const detail = buildCarnetDetail(
      input({
        moments: [
          { id: 'm1', jour_numero: 2, heure: '18:30', citation: 'Bivouac au col.', auteur_nom: 'Camille', lieu: 'Col de la Seigne', image_url: 'https://cdn.test/1.jpg' },
          { id: 'm2', jour_numero: 2, heure: '20:10', citation: 'Ciel dégagé.', auteur_nom: null, lieu: null, image_url: null },
          { id: 'm3', jour_numero: 4, heure: null, citation: null, auteur_nom: null, lieu: 'Courmayeur', image_url: 'https://cdn.test/2.jpg' },
        ],
      }),
    );
    expect(detail.days.map((d) => d.dayNumber)).toEqual([2, 4]);
    expect(detail.days[0].label).toBe('JOUR 2');
    expect(detail.days[0].note).toBeNull();
    expect(detail.days[0].from).toBe('Col de la Seigne');
    expect(detail.stats.some((s) => s.key === 'days')).toBe(true);
  });

  it('ne peuple la grille photo qu’avec les moments qui ont une image', () => {
    const detail = buildCarnetDetail(
      input({
        moments: [
          { id: 'm1', jour_numero: 1, heure: null, citation: 'a', auteur_nom: null, lieu: null, image_url: 'https://cdn.test/1.jpg' },
          { id: 'm2', jour_numero: 1, heure: null, citation: 'b', auteur_nom: null, lieu: null, image_url: null },
        ],
      }),
    );
    expect(detail.moments).toHaveLength(2);
    expect(detail.photoMoments.map((m) => m.id)).toEqual(['m1']);
  });

  it('additionne seulement les poids réels et renvoie null sans aucun poids', () => {
    const detail = buildCarnetDetail(
      input({
        kitItems: [
          { id: 'k1', nom: 'Sac 45 L', detail: 'Hybride', poids_g: 1400, couleur_tag: null, sort_order: 1 },
          { id: 'k2', nom: 'Tente', detail: null, poids_g: null, couleur_tag: null, sort_order: 2 },
          { id: 'k3', nom: 'Réchaud', detail: null, poids_g: 2800, couleur_tag: null, sort_order: 3 },
        ],
      }),
    );
    expect(detail.kit.totalWeightG).toBe(4200);
    expect(detail.kit.items.map((i) => i.name)).toEqual(['Sac 45 L', 'Tente', 'Réchaud']);
    expect(detail.kit.items[1].weightG).toBeNull();
    expect(buildCarnetDetail(input()).kit.totalWeightG).toBeNull();
  });

  it('n’ajoute aucun texte d’introduction au matériel', () => {
    const detail = buildCarnetDetail(
      input({ kitItems: [{ id: 'k1', nom: 'Sac', detail: null, poids_g: 900, couleur_tag: null, sort_order: 1 }] }),
    );
    expect(JSON.stringify(detail.kit)).not.toContain('Matériel embarqué');
  });
});

describe('buildCarnetDetail — compteurs réels', () => {
  it('préfère les compteurs agrégés aux colonnes décoratives', () => {
    const detail = buildCarnetDetail(input({ counts: { likes: 3, comments: 1 } }));
    expect(detail.engagement.likes).toBe(3);
    expect(detail.engagement.comments).toBe(1);
  });

  it('retombe sur les colonnes quand aucun comptage n’est fourni', () => {
    const detail = buildCarnetDetail(input());
    expect(detail.engagement.likes).toBe(6);
    expect(detail.engagement.comments).toBe(3);
  });
});

describe('buildCarnetDetail — lieu réel', () => {
  it('expose un lieu à partir des colonnes réelles du carnet', () => {
    const detail = buildCarnetDetail(
      input({ carnet: { ...CARNET, country_iso: 'FR', lieu_depart: 'Chamonix-Mont-Blanc' } }),
    );
    expect(detail.place).toEqual({
      country: 'France',
      region: null,
      locality: 'Chamonix-Mont-Blanc',
      lat: null,
      lng: null,
    });
  });

  it('ajoute la coordonnée du premier point réel de la trace', () => {
    const detail = buildCarnetDetail(
      input({
        hikeSession: {
          id: 'h1',
          carnet_id: 'c1',
          distance_km: 12,
          elevation_gain_m: 800,
          duration_seconds: 14400,
          started_at: '2026-09-26T08:00:00Z',
          positions_geojson: { type: 'LineString', coordinates: [[6.86, 45.83], [6.87, 45.84]] },
        },
      }),
    );
    expect(detail.place.lat).toBeCloseTo(45.83, 6);
    expect(detail.place.lng).toBeCloseTo(6.86, 6);
  });

  it('ne devine rien quand les colonnes sont vides et qu’il n’y a pas de trace', () => {
    const detail = buildCarnetDetail(
      input({
        carnet: { ...CARNET, destination: '', lieu_depart: null, lieu_arrivee: null, country_iso: null },
      }),
    );
    expect(detail.place).toEqual({ country: null, region: null, locality: null, lat: null, lng: null });
  });
});
