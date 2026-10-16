import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * `resolvePlaceByName` : la recherche d'un lieu par son nom, de bout en bout (nom exact, lieu naturel,
 * dernier recours, début du nom). La carte est simulée à sa frontière (`fetch`) avec des réponses
 * Photon réelles (13 et 16 octobre 2026) ; le choix du lieu est réel. Aucun serveur public appelé.
 */
vi.mock('server-only', () => ({}));
vi.mock('../server/sharedCache', async (orig) => ({
  ...(await orig<typeof import('../server/sharedCache')>()),
  cached: vi.fn(async (_kind: string, _key: string, _ttl: number, fn: () => Promise<unknown>) => fn()),
  readShared: vi.fn(async () => undefined),
  writeShared: vi.fn(async () => undefined),
}));
vi.mock('@/lib/siteSlot', () => ({ photonSlot: vi.fn(async () => true) }));
vi.mock('@/lib/rate-limit/routes', () => ({ enforceRateLimit: vi.fn(async () => null) }));
vi.mock('../server/geoapify', () => ({ geoapifyReverse: vi.fn(async () => null), geoapifySearch: vi.fn(async () => null) }));
vi.mock('../server/locationIq', () => ({ nominatimJson: vi.fn(async () => null) }));

import { resolvePlaceByName } from '../server/placeSearch';
import beauval from './fixtures/photon-loose-zoo-de-beauval.json';
import arcs1800 from './fixtures/photon-loose-les-arcs-1800.json';
import futuroscope from './fixtures/photon-loose-futuroscope.json';
import disney from './fixtures/photon-loose-disneyland-paris.json';
import eiffel from './fixtures/photon-loose-tour-eiffel.json';
import nepalCamp from './fixtures/photon-loose-nepal-camp-everest.json';
import leadNepal from './fixtures/photon-lead-nepal.json';
import leadZoo from './fixtures/photon-lead-zoo.json';
import leadLesArcs from './fixtures/photon-lead-les-arcs.json';
import semnoz from './fixtures/photon-loose-semnoz.json';
import lofoten from './fixtures/photon-loose-lofoten.json';
import vietnam from './fixtures/photon-loose-vietnam-nord-sud.json';

/** Ce que Photon répond à chaque recherche libre ; toute autre demande : aucun résultat. */
const PHOTON: Record<string, unknown> = {
  'Zoo de Beauval': beauval,
  'Les Arcs 1800': arcs1800,
  Futuroscope: futuroscope,
  'Disneyland Paris': disney,
  'Tour Eiffel': eiffel,
  'Népal camp de base de l’Everest': nepalCamp,
  Népal: leadNepal,
  Zoo: leadZoo,
  'Les Arcs': leadLesArcs,
  Semnoz: semnoz,
  Lofoten: lofoten,
  'Vietnam du nord au sud': vietnam,
};
const EMPTY = { type: 'FeatureCollection', features: [] };

let asked: string[];

beforeEach(() => {
  asked = [];
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
    const url = new URL(String(input));
    if (url.hostname !== 'photon.komoot.io') throw new Error('hors Photon');
    const q = url.searchParams.get('q') ?? '';
    // Les recherches ciblées (lieu naturel, sentier : `osm_tag` sans « ! ») ne trouvent rien ici.
    const targeted = url.searchParams.getAll('osm_tag').some((t) => !t.startsWith('!'));
    if (!targeted) asked.push(q);
    const body = !targeted && q in PHOTON ? PHOTON[q] : EMPTY;
    return new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } });
  });
});
afterEach(() => vi.restoreAllMocks());

describe('dernier recours de la recherche d’un lieu (IA éteinte, lieu de départ)', () => {
  it('« Zoo de Beauval » : le ZooParc, pas « Zoo », quartier de Hanovre', async () => {
    const place = await resolvePlaceByName('Zoo de Beauval');
    expect(place).toMatchObject({ name: 'ZooParc de Beauval', countryCode: 'FR', locality: 'Saint-Aignan' });
    // Le début du nom (« Zoo ») n'a même pas été cherché.
    expect(asked).not.toContain('Zoo');
  });

  it('« Les Arcs 1800 » : la station Arc 1800 (Bourg-Saint-Maurice), pas le village des Arcs dans le Var', async () => {
    const place = await resolvePlaceByName('Les Arcs 1800');
    expect(place).toMatchObject({ name: 'Arc 1800', locality: 'Bourg-Saint-Maurice', countryCode: 'FR' });
    expect(asked).not.toContain('Les Arcs');
  });

  it('« Futuroscope » et « Disneyland Paris » : trouvés sous leur nom exact', async () => {
    expect(await resolvePlaceByName('Futuroscope')).toMatchObject({ name: 'Futuroscope', locality: 'Chasseneuil-du-Poitou' });
    expect(await resolvePlaceByName('Disneyland Paris')).toMatchObject({ name: 'Disneyland Paris', locality: 'Coupvray' });
  });

  it('« Népal camp de base de l’Everest » : la carte ne le connaît pas, son début donne le pays', async () => {
    const place = await resolvePlaceByName('Népal camp de base de l’Everest');
    expect(place).toMatchObject({ name: 'Népal', kind: 'country', countryCode: 'NP' });
    expect(asked).toContain('Népal');
  });

  it('le début d’un nom inconnu n’est gardé que s’il rend un pays ou une région', async () => {
    // « Zoo » est un quartier de Hanovre, « Les Arcs » un village du Var : ce n'est pas le lieu demandé.
    expect(await resolvePlaceByName('Zoo de Fantômas')).toBeNull();
    expect(await resolvePlaceByName('Les Arcs en famille')).toBeNull();
    // Le début a bien été cherché, puis refusé.
    expect(asked).toEqual(expect.arrayContaining(['Zoo', 'Les Arcs']));
  });

  it('les faux amis du 13 octobre restent écartés (Semnoz, Lofoten, Vietnam du nord au sud, tour Eiffel)', async () => {
    expect(await resolvePlaceByName('Semnoz')).toBeNull();
    // « Lofoten » : plus la maison isolée de Suède ; la table des régions célèbres de main (`knownRegion`)
    // rend l'archipel norvégien, base Svolvær, avant toute recherche sur la carte.
    expect(await resolvePlaceByName('Lofoten')).toMatchObject({ name: 'Lofoten', countryCode: 'NO', lat: 68.2342 });
    expect(await resolvePlaceByName('Vietnam du nord au sud')).toBeNull();
    // L'ouvrage de Paris est écarté, son homonyme de Kintzheim (point de vue) ne le remplace pas.
    expect(await resolvePlaceByName('Tour Eiffel')).toBeNull();
  });
});
