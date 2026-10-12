import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';
import META from '../data/entryRequirements.meta.json';
import CURRENCIES_META from '../data/countryCurrencies.meta.json';
import FUEL_META from '../data/fuelPrices.meta.json';
import ICP_META from '../data/icpPriceLevels.meta.json';
import MAINS_META from '../data/mainsElectricity.meta.json';
import { tollSources } from '../engine/tolls';
import { DATA_SOURCES, DataSources } from '@/app/mentions-legales/DataSources';

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

  it('le carburant cite le bulletin pétrolier de la Commission (CC BY 4.0), sa date, la conversion, et l’estimation hors UE', () => {
    expect(text).toContain('Carburant :');
    expect(text).toMatch(/Weekly Oil Bulletin, Commission européenne \(DG Énergie\), licence CC BY 4\.0/);
    expect(text).toContain(`prix du ${FUEL_META.pricesDate}, convertis en euros par litre et arrondis au millième`);
    expect(text).toMatch(/Hors de l’UE, aucune source gratuite : le prix est une estimation/);
    expect(markup).toContain(`href="${FUEL_META.page}"`);
  });

  it('les péages et vignettes créditent chaque page officielle lue : nom, adresse cliquable, jour de lecture', () => {
    expect(text).toContain('Péages et vignettes :');
    expect(text).toMatch(/Péages et vignettes :.*à vérifier avant de partir/);
    expect(text).toMatch(/reste « non chiffré », dit comme tel/);
    const sources = tollSources();
    expect(sources.length).toBe(8);
    for (const src of sources) {
      for (const ref of src.refs) {
        expect(text, ref.name).toContain(ref.name);
        expect(markup, ref.url).toContain(`href="${ref.url.replace(/&/g, '&amp;')}"`);
      }
      expect(text).toContain(`${src.name} : `);
    }
    // Le jour de lecture est dit pour chacune des huit entrées.
    expect(text.match(/\(lu le 12 octobre 2026\)/g)?.length).toBeGreaterThanOrEqual(8);
  });

  it('les niveaux de prix des repas citent la Banque mondiale (ICP 2021, CC BY 4.0), la série, les dates et le changement', () => {
    expect(text).toContain('Niveaux de prix des repas :');
    expect(text).toContain('The World Bank: ICP 2021 (International Comparison Program)');
    expect(text).toContain(`année ${ICP_META.year}, mis à jour le 4 août 2024, lu le 12 octobre 2026 (licence CC BY 4.0)`);
    expect(text).toContain('Ramené à la France = 100 et arrondi par le Compas');
    expect(markup).toContain(`href="${ICP_META.page}"`);
    expect(markup).toContain(`href="${ICP_META.licenceUrl}"`);
    expect(ICP_META.lastUpdated).toBe('2024-08-04');
  });

  it('les devises des pays citent la liste ISO 4217 de SIX, avec sa date de publication', () => {
    expect(text).toContain('Devises des pays :');
    expect(text).toMatch(/liste n° 1 de la norme ISO 4217, publiée par SIX/);
    expect(text).toContain(`liste du ${CURRENCIES_META.published}`);
  });

  it('la page des mentions légales affiche ces sources (mobile et bureau)', () => {
    const page = readFileSync(path.resolve(__dirname, '..', '..', '..', 'app', 'mentions-legales', 'page.tsx'), 'utf8');
    expect(page).toMatch(/import \{ DataSources \} from '\.\/DataSources'/);
    expect(page.match(/<DataSources /g)).toHaveLength(2);
  });
  it('les prises et le courant citent la révision de Wikipédia lue (CC BY-SA 4.0), ses auteurs, les changements, et la source première retirée', () => {
    expect(text).toContain('Prises et courant :');
    expect(text).toContain(`révision ${MAINS_META.revision} du 11 octobre 2026, lue le 12 octobre 2026`);
    expect(text).toContain('licence CC BY-SA 4.0');
    expect(text).toMatch(/Prises et courant :.*Ce jeu dérivé reste sous la même licence/);
    expect(text).toMatch(/Prises et courant :.*retiré en septembre 2026/);
    expect(text).toMatch(/Prises et courant :.*Changements : lettres, tensions du foyer et fréquences extraites/);
    for (const href of [MAINS_META.page, MAINS_META.revisionUrl, MAINS_META.historyUrl, MAINS_META.licenceUrl, MAINS_META.primarySourceUrl])
      expect(markup, href).toContain(`href="${href.replace(/&/g, '&amp;')}"`);
  });
});
