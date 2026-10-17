import { describe, expect, it } from 'vitest';
import {
  buildGeoSitesQuery,
  densestSite,
  findSitesByName,
  normalizeSiteName,
  parseGeoSites,
  siteKindsFor,
  sitesAround,
  type GeoSiteRow,
} from '../engine/geoSites';

// Coordonnées et noms des éléments ci-dessous : des données d'essai, pas des relevés OSM.
const node = (id: number, tags: Record<string, string>, lat = 37.0, lon = 26.95) => ({
  type: 'node',
  id,
  lat,
  lon,
  tags,
});
const way = (id: number, tags: Record<string, string>, lat = 46.5, lon = 11.8) => ({
  type: 'way',
  id,
  center: { lat, lon },
  tags,
});

describe('buildGeoSitesQuery', () => {
  const q = buildGeoSitesQuery([26.8, 36.9, 27.2, 37.1]);
  it('fait UNE requête de la tuile, centre et étiquettes seulement', () => {
    expect(q.startsWith('[out:json][timeout:180];(')).toBe(true);
    expect(q.endsWith(');out center tags;')).toBe(true);
    expect(q.match(/out /g)).toHaveLength(1);
  });
  it('demande falaises et secteurs d’escalade, via ferrata, domaines skiables et gares nommées', () => {
    const bb = '(36.9000,26.8000,37.1000,27.2000)';
    expect(q).toContain(`nwr["sport"~"(^|;)climbing(;|$)"]["climbing"~"^(crag|area)$"]${bb};`);
    expect(q).toContain(`way["highway"="via_ferrata"]${bb};`);
    expect(q).toContain(`nwr["climbing"="via_ferrata"]${bb};`);
    expect(q).toContain(`nwr["landuse"="winter_sports"]${bb};`);
    expect(q).toContain(`nwr["aerialway"="station"]["name"]${bb};`);
    // Jamais chaque voie : des dizaines de milliers d'objets sans intérêt pour une étape.
    expect(q).not.toContain('route_bottom');
  });
});

describe('parseGeoSites', () => {
  it('lit chaque nature : falaise, secteur, via ferrata, domaine skiable, gare de remontée', () => {
    const { rows, elements } = parseGeoSites({
      elements: [
        node(1, { sport: 'climbing', climbing: 'crag', name: 'Falaise Essai', ele: '120' }),
        way(2, { sport: 'climbing;bouldering', climbing: 'area', name: 'Secteur Essai' }),
        way(3, { highway: 'via_ferrata', name: 'Via ferrata Essai', via_ferrata_scale: '4' }),
        way(4, { landuse: 'winter_sports', name: 'Domaine Essai' }),
        node(5, { aerialway: 'station', name: 'Gare Essai', ele: '2 105' }),
        node(6, { climbing: 'via_ferrata', name: 'Klettersteig Essai' }),
      ],
    });
    expect(elements).toBe(6);
    expect(rows.map((r) => [r.osm_id, r.kind])).toEqual([
      ['n1', 'crag'],
      ['n5', 'aerialway_station'],
      ['n6', 'via_ferrata'],
      ['w2', 'climbing_area'],
      ['w3', 'via_ferrata'],
      ['w4', 'winter_sports'],
    ]);
    expect(rows[0]).toEqual({
      osm_id: 'n1',
      kind: 'crag',
      name: 'Falaise Essai',
      lat: 37,
      lon: 26.95,
      ele_m: 120,
    });
  });
  it('ne devine pas une altitude : absente ou illisible, elle reste null', () => {
    const { rows } = parseGeoSites({
      elements: [
        node(1, { sport: 'climbing', climbing: 'crag', name: 'Sans altitude' }),
        node(2, { sport: 'climbing', climbing: 'crag', name: 'Altitude floue', ele: 'env. 300' }),
      ],
    });
    expect(rows.map((r) => r.ele_m)).toEqual([null, null]);
  });
  it('écarte et compte privé, abandonné, sans nom, sans position, salle, hors sujet et doublon', () => {
    const { rows, dropped } = parseGeoSites({
      elements: [
        node(1, { sport: 'climbing', climbing: 'crag', name: 'Gardée' }),
        node(1, { sport: 'climbing', climbing: 'crag', name: 'Gardée' }),
        node(2, { sport: 'climbing', climbing: 'crag', name: 'Interdite', access: 'no' }),
        node(3, { landuse: 'winter_sports', name: 'Fermée', disused: 'yes' }),
        node(4, { sport: 'climbing', climbing: 'crag' }),
        { type: 'node', id: 5, tags: { sport: 'climbing', climbing: 'crag', name: 'Perdue' } },
        node(6, { sport: 'climbing', climbing: 'area', name: 'Salle', leisure: 'sports_centre' }),
        node(7, { sport: 'climbing', climbing: 'route_bottom', name: 'Voie 12' }),
        node(8, { climbing: 'crag', name: 'Sans sport' }),
      ],
    });
    expect(rows.map((r) => r.osm_id)).toEqual(['n1']);
    expect(dropped).toEqual({
      doublon: 1,
      prive: 1,
      abandonne: 1,
      sans_nom: 1,
      sans_position: 1,
      salle: 1,
      sans_nature: 2,
    });
  });
  it('jamais un nom commun : « Via ferrata », « Falaise », « Klettersteig » ne sont pas des noms', () => {
    const { rows, dropped } = parseGeoSites({
      elements: [
        way(1, { highway: 'via_ferrata', name: 'Via ferrata' }),
        node(2, { sport: 'climbing', climbing: 'crag', name: 'Falaise' }),
        way(3, { highway: 'via_ferrata', name: 'Klettersteig' }),
        node(4, { aerialway: 'station', name: 'Bergstation' }),
        way(5, { landuse: 'winter_sports', name: 'Ski area' }),
      ],
    });
    expect(rows).toEqual([]);
    expect(dropped).toEqual({ sans_nom: 5 });
  });
  it('préfère le nom français, sinon le nom local', () => {
    const { rows } = parseGeoSites({
      elements: [
        way(1, {
          highway: 'via_ferrata',
          name: 'Ferrata Essai',
          'name:fr': 'Via ferrata Essai FR',
        }),
        way(2, { highway: 'via_ferrata', name: 'Ferrata Locale' }, 46.0, 12.0),
      ],
    });
    expect(rows.map((r) => r.name)).toEqual(['Via ferrata Essai FR', 'Ferrata Locale']);
  });
  it('fond les tronçons d’une même via ferrata (même nom, même nature, à moins de 2 km)', () => {
    const { rows, dropped } = parseGeoSites({
      elements: [
        way(30, { highway: 'via_ferrata', name: 'Via ferrata Essai' }, 46.5, 11.8),
        way(31, { highway: 'via_ferrata', name: 'VIA FERRATA  essai' }, 46.505, 11.8),
        way(32, { highway: 'via_ferrata', name: 'Via ferrata Essai' }, 46.7, 11.8),
      ],
    });
    expect(rows.map((r) => r.osm_id)).toEqual(['w30', 'w32']);
    expect(dropped).toEqual({ meme_site: 1 });
  });
  it('rend un résultat vide pour une réponse sans éléments', () => {
    expect(parseGeoSites(null)).toEqual({ rows: [], dropped: {}, elements: 0 });
    expect(parseGeoSites({ remark: 'timeout' })).toEqual({ rows: [], dropped: {}, elements: 0 });
  });
});

describe('normalizeSiteName', () => {
  it('range accents, casse et ponctuation sous une même clé', () => {
    expect(normalizeSiteName('  Grotte Érodée ')).toBe('grotte erodee');
    expect(normalizeSiteName('Ferrata  “Brigata”-Essai')).toBe('ferrata brigata essai');
    expect(normalizeSiteName('')).toBe('');
  });
});

const row = (
  osm_id: string,
  kind: GeoSiteRow['kind'],
  lat: number,
  lon: number,
  name = osm_id
): GeoSiteRow => ({ osm_id, kind, name, lat, lon, ele_m: null });

describe('sitesAround', () => {
  const rows = [
    row('n1', 'crag', 37.0, 26.95),
    row('n2', 'crag', 37.05, 26.95),
    row('n3', 'winter_sports', 37.001, 26.95),
    row('n4', 'crag', 37.5, 26.95),
  ];
  it('rend les sites du rayon, du plus proche au plus loin, avec leur distance', () => {
    const got = sitesAround(rows, { lat: 37.0, lon: 26.95 }, 10);
    expect(got.map((r) => r.osm_id)).toEqual(['n1', 'n3', 'n2']);
    expect(got[0].distance_km).toBe(0);
    expect(got[2].distance_km).toBeCloseTo(5.56, 1);
  });
  it('filtre par nature', () => {
    const got = sitesAround(rows, { lat: 37.0, lon: 26.95 }, 10, ['crag']);
    expect(got.map((r) => r.osm_id)).toEqual(['n1', 'n2']);
  });
});

describe('densestSite', () => {
  it('trouve le cœur d’une zone d’escalade (une falaise isolée ne l’emporte pas sur un groupe)', () => {
    const rows = [
      row('n9', 'crag', 36.95, 26.98),
      row('n1', 'crag', 37.03, 26.93),
      row('n2', 'crag', 37.035, 26.935),
      row('n3', 'crag', 37.04, 26.93),
      row('n4', 'climbing_area', 37.032, 26.94),
      row('n5', 'winter_sports', 36.95, 26.981),
    ];
    const got = densestSite(rows, 2, ['crag', 'climbing_area']);
    expect(got?.count).toBe(4);
    expect(['n1', 'n2', 'n3', 'n4']).toContain(got?.site.osm_id);
  });
  it('à égalité, le résultat est stable (identifiant le plus petit) ; rien si aucun site', () => {
    const rows = [row('n7', 'crag', 37, 26), row('n3', 'crag', 38, 26)];
    expect(densestSite(rows, 2)?.site.osm_id).toBe('n3');
    expect(densestSite([], 2)).toBeNull();
    expect(densestSite(rows, 2, ['via_ferrata'])).toBeNull();
  });
  it('second signal (ski) : à égalité de domaines, les gares de remontée voisines départagent', () => {
    const rows = [
      // Deux domaines chacun, n1 a le plus petit identifiant mais aucune gare ; n5 en a deux.
      row('n1', 'winter_sports', 45.0, 6.0),
      row('n2', 'winter_sports', 45.005, 6.005),
      row('n5', 'winter_sports', 45.3, 6.3),
      row('n6', 'winter_sports', 45.305, 6.305),
      row('n7', 'aerialway_station', 45.301, 6.301),
      row('n8', 'aerialway_station', 45.302, 6.302),
      // Gares en masse sans domaine : jamais le cœur (ce n'est pas la nature comptée).
      row('n10', 'aerialway_station', 44.0, 5.0),
      row('n11', 'aerialway_station', 44.001, 5.0),
      row('n12', 'aerialway_station', 44.002, 5.0),
    ];
    const got = densestSite(rows, 5, ['winter_sports'], ['aerialway_station']);
    expect(got?.site.osm_id).toBe('n5');
    expect(got?.count).toBe(2);
    expect(got?.second).toBe(2);
    // Sans second signal : l'ordre d'avant (plus petit identifiant).
    expect(densestSite(rows, 5, ['winter_sports'])?.site.osm_id).toBe('n1');
    expect(densestSite(rows, 5, ['winter_sports'], ['aerialway_station'])?.site.kind).toBe(
      'winter_sports'
    );
    // Aucun domaine : rien, même avec des gares.
    expect(densestSite(rows.slice(4), 5, ['winter_sports'], ['aerialway_station'])).toBeNull();
  });
});

describe('findSitesByName', () => {
  const rows = [
    row('w1', 'via_ferrata', 46.5, 11.8, 'Via ferrata Essai Nord'),
    row('w2', 'via_ferrata', 46.6, 11.9, 'Via ferrata Essai'),
    row('n3', 'crag', 37, 26.9, 'Essaimage'),
  ];
  it('le nom exact d’abord, puis les noms qui contiennent les mots demandés', () => {
    expect(findSitesByName(rows, 'via ferrata essai').map((r) => r.osm_id)).toEqual(['w2', 'w1']);
  });
  it('des mots entiers seulement : « Essai » ne trouve pas « Essaimage » ; vide ne trouve rien', () => {
    expect(findSitesByName(rows, 'essai').map((r) => r.osm_id)).toEqual(['w2', 'w1']);
    expect(findSitesByName(rows, '  ')).toEqual([]);
  });
});

describe('siteKindsFor', () => {
  it('relie l’activité du Compas aux natures utiles, rien pour les autres', () => {
    expect(siteKindsFor('climbing')).toEqual(['crag', 'climbing_area', 'via_ferrata']);
    expect(siteKindsFor('ski')).toEqual(['winter_sports', 'aerialway_station']);
    expect(siteKindsFor('hiking')).toBeNull();
  });
});
