import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';
import META from '../data/entryRequirements.meta.json';
import CURRENCIES_META from '../data/countryCurrencies.meta.json';
import { DATA_SOURCES, DataSources } from '@/app/mentions-legales/dataSources';

/**
 * Sources des données et licences (mentions légales, PLAN-100 5.3) : le crédit exact de
 * l'éditeur de la table passeport × destination (CC BY 4.0), à côté de celui d'OurAirports.
 */
const CREDIT =
  'TravelRequirements.info — Entry Requirements Dataset v1.3.0, AXG Sp. z o.o., https://travelrequirements.info/data/ (CC BY 4.0)';
const markup = renderToStaticMarkup(<DataSources linkClass="lien" />);
const text = markup
  .replace(/<[^>]+>/g, '')
  .replace(/&amp;/g, '&')
  .replace(/&#x27;/g, "'");

describe('mentions légales — sources des données', () => {
  it('le crédit exact de l’éditeur de la table passeport × destination est affiché', () => {
    expect(text).toContain(CREDIT);
  });

  it('c’est celui que le fichier généré porte (une mise à jour du jeu change les deux, ou le test casse)', () => {
    expect(META.credit).toBe(CREDIT);
  });

  it('le lien vers le jeu est cliquable, ouvert à part, sans référent', () => {
    expect(markup).toMatch(
      /<a [^>]*href="https:\/\/travelrequirements\.info\/data\/"[^>]*target="_blank"[^>]*rel="noopener noreferrer"[^>]*>https:\/\/travelrequirements\.info\/data\/<\/a>/
    );
  });

  it('il est dans la section des sources, juste après le crédit d’OurAirports', () => {
    const labels = DATA_SOURCES.map((s) => s.label);
    expect(labels[labels.indexOf('Aéroports') + 1]).toBe('Papiers d’entrée');
    expect(text.indexOf('OurAirports')).toBeGreaterThan(-1);
    expect(text.indexOf(CREDIT)).toBeGreaterThan(text.indexOf('OurAirports'));
  });

  it('la table est dite indicative et à confirmer auprès du service officiel', () => {
    expect(text).toMatch(/Papiers d’entrée :.*à confirmer auprès du service officiel/);
  });

  it('aucun jeu dérivé de Passport Index n’est crédité ni cité', () => {
    expect(text).not.toMatch(/passport ?index/i);
  });

  it('les devises des pays citent la liste ISO 4217 de SIX, avec sa date de publication', () => {
    expect(text).toContain('Devises des pays :');
    expect(text).toMatch(/liste n° 1 de la norme ISO 4217, publiée par SIX/);
    expect(text).toContain(`liste du ${CURRENCIES_META.published}`);
  });

  it('la page des mentions légales affiche ces sources (mobile et bureau)', () => {
    const page = readFileSync(path.resolve(__dirname, '..', '..', '..', 'app', 'mentions-legales', 'page.tsx'), 'utf8');
    expect(page).toMatch(/import \{ DataSources \} from '\.\/dataSources'/);
    expect(page.match(/<DataSources /g)).toHaveLength(2);
  });
});
