import { describe, expect, it } from 'vitest';
import { homonymsFarApart, isNotablePlace, parsePhoton, pickDestination, pickNatural } from '../engine/places';
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
