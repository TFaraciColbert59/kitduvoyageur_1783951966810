import { describe, expect, it } from 'vitest';
import { homonymsFarApart, isNotablePlace, leadingProperName, parsePhoton, pickDestination, pickLoose, pickNatural, withinPlaceExtent } from '../engine/places';
import looseSemnoz from './fixtures/photon-loose-semnoz.json';
import looseLofoten from './fixtures/photon-loose-lofoten.json';
import looseVietnam from './fixtures/photon-loose-vietnam-nord-sud.json';
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
