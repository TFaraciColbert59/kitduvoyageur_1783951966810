import { describe, expect, it } from 'vitest';
import { parsePhoton, pickNatural } from '../engine/places';
import chartreuse from './fixtures/photon-natural-chartreuse.json';
import loire from './fixtures/photon-natural-loire.json';
import jura from './fixtures/photon-natural-jura.json';
import calanques from './fixtures/photon-natural-calanques.json';

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

  it('« Jura » en France : le parc du Haut-Jura, jamais le Jura souabe allemand', () => {
    const p = pickNatural(parsePhoton(jura), 'Jura', 'FR');
    expect(p?.countryCode).toBe('FR');
    expect(p?.name).toMatch(/Jura/);
  });

  it('« Calanques » : le parc national (le plus étendu), pas une crique de Corse', () => {
    const p = pickNatural(parsePhoton(calanques), 'Calanques', 'FR');
    expect(p?.name).toMatch(/Parc national des Calanques/);
  });
});
