import { describe, expect, it } from 'vitest';
import { homonymsFarApart, isCountryOrRegion, isNotablePlace, leadingProperName, parsePhoton, pickDestination, pickLoose, pickNatural, withinPlaceExtent } from '../engine/places';
import looseSemnoz from './fixtures/photon-loose-semnoz.json';
import looseLofoten from './fixtures/photon-loose-lofoten.json';
import looseVietnam from './fixtures/photon-loose-vietnam-nord-sud.json';
import looseBeauval from './fixtures/photon-loose-zoo-de-beauval.json';
import looseArcs1800 from './fixtures/photon-loose-les-arcs-1800.json';
import looseFuturoscope from './fixtures/photon-loose-futuroscope.json';
import looseDisney from './fixtures/photon-loose-disneyland-paris.json';
import looseEiffel from './fixtures/photon-loose-tour-eiffel.json';
import looseNepalCamp from './fixtures/photon-loose-nepal-camp-everest.json';
import leadNepal from './fixtures/photon-lead-nepal.json';
import leadZoo from './fixtures/photon-lead-zoo.json';
import leadLesArcs from './fixtures/photon-lead-les-arcs.json';
import puyDeDome from './fixtures/photon-natural-puy-de-dome.json';
import alsace from './fixtures/photon-alsace.json';
import chartreuse from './fixtures/photon-natural-chartreuse.json';
import loire from './fixtures/photon-natural-loire.json';
import jura from './fixtures/photon-natural-jura.json';
import calanques from './fixtures/photon-natural-calanques.json';
import tarn from './fixtures/photon-natural-tarn.json';
import leTarn from './fixtures/photon-natural-le-tarn.json';

// Réponses Photon réelles (7 octobre 2026), lieux naturels seulement.
describe('lieu naturel pour une activité de plein air', () => {
  it('« Chartreuse » : le massif en Isère, pas le quartier de Toulouse', () => {
    const p = pickNatural(parsePhoton(chartreuse), 'Chartreuse', 'FR');
    expect(p?.name).toMatch(/Chartreuse/);
    expect(p!.lat).toBeGreaterThan(45);
    expect(p!.lon).toBeGreaterThan(5.5);
  });

  it('« Loire » : le fleuve pour le vélo, jamais pour une randonnée', () => {
    const river = pickNatural(parsePhoton(loire), 'Loire', 'FR', true);
    expect(river?.osmTag).toBe('waterway=river');
    const foot = pickNatural(parsePhoton(loire), 'Loire', 'FR', false);
    expect(foot?.osmTag ?? '').not.toMatch(/^waterway=/);
  });

  it('« Tarn » sur l’eau : la carte ne rend la rivière que sous son article (« Le Tarn »)', () => {
    // Sans article : des plans d'eau homonymes, jamais la rivière (d'où lookupRiver).
    expect(pickNatural(parsePhoton(tarn), 'Tarn', 'FR', true)?.osmTag ?? '').not.toMatch(/^waterway=/);
    const river = pickNatural(parsePhoton(leTarn), 'Le Tarn', 'FR', true);
    expect(river?.osmTag).toBe('waterway=river');
    // La rivière entière (du Lozère au Tarn-et-Garonne), pas un tronçon.
    expect(river!.extent![2] - river!.extent![0]).toBeGreaterThan(2);
  });

  it('« Jura » en France : le parc du Haut-Jura, jamais le Jura souabe allemand', () => {
    const p = pickNatural(parsePhoton(jura), 'Jura', 'FR');
    expect(p?.countryCode).toBe('FR');
    expect(p?.name).toMatch(/Jura/);
  });

  it('« Calanques » : le parc national (le plus étendu), pas une crique de Corse', () => {
    const p = pickNatural(parsePhoton(calanques), 'Calanques', 'FR');
    expect(p?.name).toMatch(/Parc national des Calanques/);
    // Sans pays connu (repli d'une destination sans nom exact) : idem.
    expect(pickNatural(parsePhoton(calanques), 'Calanques', null)?.name).toMatch(/Parc national des Calanques/);
  });

  it('« Alsace » : homonymes lointains sans lieu notable → pas de tirage au sort (jamais Los Angeles)', () => {
    const found = parsePhoton(alsace);
    const pick = pickDestination(found, 'Alsace');
    expect(homonymsFarApart(found, 'Alsace')).toBe(true);
    expect(pick && isNotablePlace(pick)).toBe(false);
  });
});

// Réponses Photon réelles (13 octobre 2026) : le dernier recours ne prend plus n'importe quoi.
describe('dernier recours : jamais un nom voisin, un bâtiment ni une maison isolée', () => {
  it('« Semnoz » n’est pas Semond (Côte-d’Or), « Lofoten » pas une maison de Suède', () => {
    expect(pickLoose(parsePhoton(looseSemnoz), 'Semnoz')).toBeNull();
    expect(pickLoose(parsePhoton(looseLofoten), 'Lofoten')).toBeNull();
  });
  it('« Vietnam du nord au sud » : aucun mémorial (étapes en Australie le 13 oct.)', () => {
    expect(pickLoose(parsePhoton(looseVietnam), 'Vietnam du nord au sud')).toBeNull();
  });
  it('un lieu habité dont le nom contient la demande reste accepté (« Hossegor » → Soorts-Hossegor)', () => {
    const town = { name: 'Soorts-Hossegor', kind: 'city', lat: 43.66, lon: -1.43, countryCode: 'FR', country: 'France', settlement: true, osmTag: 'place=village', extent: null };
    expect(pickLoose([town as never], 'Hossegor')?.name).toBe('Soorts-Hossegor');
  });
});

// Réponses Photon réelles (16 octobre 2026) : ce que le dernier recours trouvait avant le 13 octobre
// (premier lieu habité, sinon premier lieu) ne doit pas se perdre avec le tri des faux amis.
describe('dernier recours : un site touristique sous son nom exact, un lieu habité au pluriel près', () => {
  it('« Futuroscope » et « Disneyland Paris » : le parc d’attractions, pas « introuvable »', () => {
    const futuroscope = pickLoose(parsePhoton(looseFuturoscope), 'Futuroscope');
    expect(futuroscope?.name).toBe('Futuroscope');
    expect(futuroscope?.osmTag).toBe('tourism=theme_park');
    const disney = pickLoose(parsePhoton(looseDisney), 'Disneyland Paris');
    expect(disney?.name).toBe('Disneyland Paris');
    expect(disney?.countryCode).toBe('FR');
  });

  it('« Zoo de Beauval » : le ZooParc, dont le nom accole « Zoo » à « Parc »', () => {
    const zoo = pickLoose(parsePhoton(looseBeauval), 'Zoo de Beauval');
    expect(zoo?.name).toBe('ZooParc de Beauval');
    expect(zoo?.osmTag).toBe('tourism=zoo');
  });

  it('« Les Arcs 1800 » : la station « Arc 1800 » de la carte (le pluriel de la demande ne l’écarte pas)', () => {
    const arc = pickLoose(parsePhoton(looseArcs1800), 'Les Arcs 1800');
    expect(arc?.name).toBe('Arc 1800');
    expect(arc?.locality).toBe('Bourg-Saint-Maurice');
  });

  it('un nom voisin n’est pas le site : « Everest Camp de base » n’est pas « Népal camp de base de l’Everest »', () => {
    expect(pickLoose(parsePhoton(looseNepalCamp), 'Népal camp de base de l’Everest')).toBeNull();
    // Le musée « Lofoten Krigsminnemuseum » reste écarté pour « Lofoten » (fixture du 13 oct.).
    expect(pickLoose(parsePhoton(looseLofoten), 'Lofoten')).toBeNull();
  });

  it('le premier lieu de ce nom décide : la tour Eiffel (ouvrage, écartée) n’est pas remplacée par son homonyme de Kintzheim', () => {
    const found = parsePhoton(looseEiffel);
    // Le point de vue « Tour Eiffel » de Kintzheim est bien un site touristique de même nom…
    expect(found.some((p) => p.osmTag === 'tourism=viewpoint' && p.name === 'Tour Eiffel')).toBe(true);
    // … mais le premier « Tour Eiffel » de la carte est l'ouvrage de Paris : rien plutôt qu'un faux lieu.
    expect(found[0].osmTag).toBe('man_made=tower');
    expect(pickLoose(found, 'Tour Eiffel')).toBeNull();
  });

  it('un site touristique ne se trouve que sous son nom : jamais un mot en moins ou en plus', () => {
    const base = { kind: 'house', lat: 47.2, lon: 0.7, countryCode: 'FR', country: 'France', extent: null, osmTag: 'tourism=theme_park' };
    const parc = { ...base, name: 'Parc des Rapaces' } as never;
    expect(pickLoose([parc], 'Parc des Rapaces')?.name).toBe('Parc des Rapaces');
    expect(pickLoose([parc], 'Parc')).toBeNull();
    expect(pickLoose([parc], 'Rapaces de Loire')).toBeNull();
    // Une œuvre d'art, un panneau, une aire de pique-nique n'est jamais une destination, même au nom exact.
    for (const osmTag of ['tourism=artwork', 'tourism=information', 'tourism=picnic_site']) {
      expect(pickLoose([{ ...base, osmTag, name: 'Futuroscope' } as never], 'Futuroscope')).toBeNull();
    }
  });
});

describe('pays ou région : seuls ceux-là valent le début d’un nom long', () => {
  it('« Népal » est un pays ; « Zoo » (quartier de Hanovre) et « Les Arcs » (village du Var) n’en sont pas', () => {
    expect(isCountryOrRegion(parsePhoton(leadNepal)[0])).toBe(true);
    expect(isCountryOrRegion(parsePhoton(leadZoo)[0])).toBe(false);
    expect(isCountryOrRegion(parsePhoton(leadLesArcs)[0])).toBe(false);
  });
  it('une région, un département ou une province comptent ; Photon range « Patagonie » sous « other » : l’étiquette OSM le dit', () => {
    const at = { lat: 0, lon: 0, countryCode: 'AR', country: 'Argentine', extent: null };
    expect(isCountryOrRegion({ ...at, name: 'Normandie', kind: 'state' })).toBe(true);
    expect(isCountryOrRegion({ ...at, name: 'Isère', kind: 'county' })).toBe(true);
    expect(isCountryOrRegion({ ...at, name: 'Patagonie', kind: 'other', osmTag: 'place=region' })).toBe(true);
    expect(isCountryOrRegion({ ...at, name: 'Zoo', kind: 'district', osmTag: 'boundary=administrative' })).toBe(false);
    expect(isCountryOrRegion({ ...at, name: 'Normandie', kind: 'district', osmTag: 'place=hamlet' })).toBe(false);
  });
});

describe('un sommet sans emprise compte sous son nom exact', () => {
  it('« Puy-de-Dôme » en randonnée : le volcan, pas le département ni le Petit Puy de Dôme', () => {
    const p = pickNatural(parsePhoton(puyDeDome), 'Puy-de-Dôme', 'FR');
    expect(p?.name).toBe('Puy de Dôme');
    expect(p?.osmTag).toBe('natural=volcano');
  });
});

describe('nom long inconnu de la carte : son début en noms propres', () => {
  it('« Népal camp de base de l’Everest » → « Népal » ; un nom court reste tel quel', () => {
    expect(leadingProperName('Népal camp de base de l’Everest')).toBe('Népal');
    expect(leadingProperName('Swiss Alps near Zermatt')).toBe('Swiss Alps');
    expect(leadingProperName('Chamonix')).toBeNull();
    expect(leadingProperName('la Chartreuse')).toBeNull();
  });
});

describe('une grande entité n’est remplacée que par un lieu naturel qui s’y trouve', () => {
  // Emprise de la Normandie (région) et du Puy-de-Dôme (département), [ouest, nord, est, sud].
  const normandie: [number, number, number, number] = [-1.95, 50.07, 1.8, 48.18];
  const puyDeDome: [number, number, number, number] = [2.39, 46.26, 3.98, 45.29];
  it('un sommet « Normandie » près du Mont-Dore n’est pas en Normandie (13 oct.)', () => {
    expect(withinPlaceExtent({ lat: 45.57, lon: 2.81 }, normandie)).toBe(false);
  });
  it('le volcan du Puy de Dôme est dans son département', () => {
    expect(withinPlaceExtent({ lat: 45.7726, lon: 2.9644 }, puyDeDome)).toBe(true);
  });
  it('emprise à cheval sur l’antiméridien (Fidji)', () => {
    expect(withinPlaceExtent({ lat: -17.8, lon: -179.9 }, [176.8, -12.4, -178.2, -21.1])).toBe(true);
  });
});
