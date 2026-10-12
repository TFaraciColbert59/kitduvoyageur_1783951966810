import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import type { FxRate } from '../engine/currency';
import { estimateCarTrip } from '../engine/autofill';
import { planTravelLeg, travelOrigin, type TravelDeps } from '../engine/travel';
import {
  PER_KM_TOLLS,
  PER_KM_UNQUANTIFIED,
  TOLLS_REASON,
  VIGNETTES,
  chooseVignette,
  needsVignette,
  perKmHint,
  perKmProblems,
  tollCurrency,
  tollSources,
  tollsBasis,
  tripTolls,
  unquantifiedProblems,
  vignetteProblems,
} from '../engine/tolls';

/**
 * Péages et vignettes (PLAN-100 4.6) : des tables datées et sourcées, rien d'inventé. Chaque ligne porte sa
 * source (https), son jour de lecture et ce que son tarif couvre ; une ligne amputée fait échouer le test.
 * Aucun réseau : les taux de change sont donnés, l'heure du système n'est jamais lue.
 */

const flat = (s: string) => s.replace(/[  ]/g, ' ');
const rate = (currency: string, value: number): FxRate => ({
  base: 'EUR',
  currency,
  rate: value,
  date: '2026-10-09',
  source: 'Frankfurter (banques centrales)',
});
const row = (country: string) => VIGNETTES.find((r) => r.country === country)!;
const price = (country: string, label: string) => row(country).products.find((p) => p.label === label)!.amount;

describe('tables : chaque ligne porte sa source, sa date de lecture et ce qu’elle couvre', () => {
  it('toutes les lignes de vignette sont complètes', () => {
    for (const r of VIGNETTES) expect(vignetteProblems(r), r.country).toEqual([]);
  });

  it('toutes les lignes de péage au kilomètre et tous les pays « non chiffrés » sont complets', () => {
    for (const r of PER_KM_TOLLS) expect(perKmProblems(r), r.country).toEqual([]);
    for (const r of PER_KM_UNQUANTIFIED) expect(unquantifiedProblems(r), r.country).toEqual([]);
  });

  it('chaque source est une adresse https, lue un jour réel de 2026', () => {
    for (const s of tollSources()) {
      expect(s.refs.length, s.country).toBeGreaterThan(0);
      for (const ref of s.refs) {
        expect(ref.url.startsWith('https://'), `${s.country} ${ref.url}`).toBe(true);
        expect(() => new URL(ref.url)).not.toThrow();
        expect(ref.name.length).toBeGreaterThan(3);
      }
      expect(s.readOn).toMatch(/^2026-\d{2}-\d{2}$/);
    }
  });

  it('les six pays à vignette, les deux pays au kilomètre chiffrés et les quatre non chiffrés sont là, sans recouvrement', () => {
    expect(VIGNETTES.map((r) => r.country).sort()).toEqual(['AT', 'CH', 'CZ', 'HU', 'SI', 'SK']);
    expect(PER_KM_TOLLS.map((r) => r.country).sort()).toEqual(['FR', 'IT']);
    expect(PER_KM_UNQUANTIFIED.map((r) => r.country).sort()).toEqual(['ES', 'GR', 'HR', 'PT']);
    const all = [...VIGNETTES, ...PER_KM_TOLLS, ...PER_KM_UNQUANTIFIED].map((r) => r.country);
    // Un pays à vignette ne figure pas en doublon dans les péages au kilomètre, ni l’inverse.
    expect(new Set(all).size).toBe(all.length);
  });

  it('MUTATION : retirer la source, la date, la durée ou le montant d’une ligne la fait échouer', () => {
    const at = row('AT');
    expect(vignetteProblems({ ...at, source: '' })).not.toEqual([]);
    expect(vignetteProblems({ ...at, source: 'http://www.oesterreich.gv.at/vignette' })).not.toEqual([]);
    expect(vignetteProblems({ ...at, readOn: '' })).not.toEqual([]);
    expect(vignetteProblems({ ...at, readOn: '2026-02-30' })).not.toEqual([]);
    expect(vignetteProblems({ ...at, sourceName: ' ' })).not.toEqual([]);
    expect(vignetteProblems({ ...at, products: [] })).not.toEqual([]);
    expect(vignetteProblems({ ...at, products: [{ ...at.products[0], minDays: null, until: null }] })).not.toEqual([]);
    expect(vignetteProblems({ ...at, products: [{ ...at.products[0], amount: 0 }] })).not.toEqual([]);
    expect(vignetteProblems({ ...at, products: [{ ...at.products[0], period: '' }] })).not.toEqual([]);
    expect(vignetteProblems({ ...at, corroboratedBy: [{ name: 'x y z', url: 'ftp://exemple.fr' }] })).not.toEqual([]);
    // Et la ligne d’origine, elle, passe.
    expect(vignetteProblems(at)).toEqual([]);

    const fr = PER_KM_TOLLS.find((r) => r.country === 'FR')!;
    expect(perKmProblems({ ...fr, source: '' })).not.toEqual([]);
    expect(perKmProblems({ ...fr, readOn: 'hier' })).not.toEqual([]);
    expect(perKmProblems({ ...fr, asOf: '' })).not.toEqual([]);
    expect(perKmProblems({ ...fr, period: '' })).not.toEqual([]);
    expect(perKmProblems({ ...fr, rates: [] })).not.toEqual([]);
    // Un prix hors taxes sans source de la TVA n’est pas admis.
    expect(perKmProblems({ ...fr, vatSources: [] })).not.toEqual([]);
    expect(unquantifiedProblems({ ...PER_KM_UNQUANTIFIED[0], reason: '' })).not.toEqual([]);
    expect(unquantifiedProblems({ ...PER_KM_UNQUANTIFIED[0], checkedOn: '' })).not.toEqual([]);
  });

  it('chaque ligne de vignette garde une remarque de lecture pour le mainteneur, hôte refusé ou piège compris', () => {
    for (const r of VIGNETTES) expect(typeof r.readingNote, r.country).toBe('string');
    expect(row('AT').readingNote).toMatch(/ASFINAG a refusé la lecture/);
    expect(row('SI').readingNote).toMatch(/DARS était illisible/);
    expect(row('CZ').readingNote).toMatch(/prix de 2025/);
  });

  it('les valeurs sont celles lues aux sources officielles le 12 octobre 2026', () => {
    expect(VIGNETTES.every((r) => r.readOn === '2026-10-12')).toBe(true);
    // Suisse : ch.ch et OFDF, 40 CHF, du 1er décembre 2025 au 31 janvier 2027.
    expect(row('CH')).toMatchObject({ currency: 'CHF', tariffFrom: '2025-12-01', lastStart: '2027-01-31' });
    expect(price('CH', 'annuelle')).toBe(40);
    // Autriche : oesterreich.gv.at (ASFINAG), voiture, depuis le 1er décembre 2025.
    expect(row('AT')).toMatchObject({ currency: 'EUR', tariffFrom: '2025-12-01', lastStart: '2026-11-30' });
    expect([price('AT', '1 jour'), price('AT', '10 jours'), price('AT', '2 mois'), price('AT', 'annuelle')]).toEqual([9.6, 12.8, 32, 106.8]);
    // Tchéquie : eDalnice, tarif du 1er janvier 2026, carburant standard.
    expect(row('CZ')).toMatchObject({ currency: 'CZK', tariffFrom: '2026-01-01' });
    expect([price('CZ', '1 jour'), price('CZ', '10 jours'), price('CZ', '30 jours'), price('CZ', '1 an')]).toEqual([230, 300, 480, 2570]);
    // Slovaquie : eznamka.sk, nariadenie vlády 232/2024.
    expect([price('SK', '1 jour'), price('SK', '10 jours'), price('SK', '30 jours'), price('SK', '365 jours')]).toEqual([8.1, 10.8, 17.1, 90]);
    // Slovénie : Uradni list 46/2025, classe 2A.
    expect(row('SI')).toMatchObject({ currency: 'EUR', tariffFrom: '2025-07-01' });
    expect([price('SI', '7 jours'), price('SI', '1 mois')]).toEqual([16, 32]);
    // Hongrie : NÚSZ, D1, forints, depuis le 1er janvier 2026.
    expect(row('HU')).toMatchObject({ currency: 'HUF', tariffFrom: '2026-01-01' });
    expect([price('HU', '1 jour'), price('HU', '10 jours'), price('HU', '1 mois')]).toEqual([5550, 6900, 11170]);
    // France : ART, 9,27 c€ HT/km au 1er février 2024 ; Italie : ASPI, TVA comprise, 1er janvier 2026.
    expect(PER_KM_TOLLS.find((r) => r.country === 'FR')).toMatchObject({ vatRate: 0.2, asOf: '2024-02-01' });
    expect(PER_KM_TOLLS.find((r) => r.country === 'FR')!.rates[0].eurPerKm).toBe(0.0927);
    expect(PER_KM_TOLLS.find((r) => r.country === 'IT')!.rates.map((r) => r.eurPerKm)).toEqual([0.07869, 0.09315]);
    expect(PER_KM_TOLLS.find((r) => r.country === 'IT')).toMatchObject({ vatRate: null, asOf: '2026-01-01' });
  });

  it('le module ne lit jamais l’heure du système (la date de référence vient de l’appelant)', () => {
    const code = readFileSync(path.resolve(__dirname, '..', 'engine', 'tolls.ts'), 'utf8');
    expect(code).not.toMatch(/Date\.now\(|new Date\(\)/);
    expect(code).not.toMatch(/fetch\(|import .*server-only/);
  });
});

describe('chooseVignette — la moins chère qui couvre le voyage, jamais extrapolée', () => {
  const pick = (country: string, days: number, from: string) => chooseVignette(country, { days, from });

  it('Autriche : 1 jour, 10 jours, 2 mois, puis l’annuelle', () => {
    const label = (days: number) => {
      const c = pick('AT', days, '2026-10-20');
      return c.ok ? c.product.label : c.reason;
    };
    expect([label(1), label(3), label(10), label(12), label(59), label(70)]).toEqual(['1 jour', '10 jours', '10 jours', '2 mois', '2 mois', 'annuelle']);
  });

  it('un tarif qui ne vaut plus à la date du voyage ne chiffre rien (Autriche : nouveaux prix au 1er décembre)', () => {
    expect(pick('AT', 5, '2026-11-30')).toMatchObject({ ok: true });
    expect(pick('AT', 5, '2026-12-05')).toMatchObject({ ok: false, reason: 'after-tariff' });
  });

  it('Suisse : une seule vignette, qui doit couvrir tout le voyage', () => {
    expect(pick('CH', 10, '2026-12-20')).toMatchObject({ ok: true, to: '2026-12-29' });
    expect(pick('CH', 10, '2027-01-25')).toMatchObject({ ok: false, reason: 'too-long' });
    expect(pick('CH', 3, '2027-02-01')).toMatchObject({ ok: false, reason: 'after-tariff' });
  });

  it('Tchéquie, Slovaquie, Slovénie, Hongrie : les durées lues, rien au-delà', () => {
    const label = (country: string, days: number) => {
      const c = pick(country, days, '2026-10-20');
      return c.ok ? c.product.label : c.reason;
    };
    expect([label('CZ', 25), label('CZ', 100), label('SK', 1), label('SK', 11), label('SK', 31)]).toEqual(['30 jours', '1 an', '1 jour', '30 jours', '365 jours']);
    expect([label('SI', 3), label('SI', 10), label('SI', 40)]).toEqual(['7 jours', '1 mois', 'too-long']);
    expect([label('HU', 1), label('HU', 5), label('HU', 20), label('HU', 29)]).toEqual(['1 jour', '10 jours', '1 mois', 'too-long']);
  });

  it('pays sans vignette lue, date illisible', () => {
    expect(pick('PE', 3, '2026-10-20')).toMatchObject({ ok: false, reason: 'no-row' });
    expect(pick('at', 3, '20/10/2026')).toMatchObject({ ok: false, reason: 'bad-date' });
    expect(tollCurrency(' ch ')).toBe('CHF');
    expect(tollCurrency('FR')).toBeNull();
  });
});

describe('tripTolls — la ligne de budget en euros, avec sa base', () => {
  const base = { days: 8, cars: 1, start: '2026-10-20', today: '2026-10-12', rates: {} };

  it('Autriche, 2 voitures : 10 jours à 12,80 € chacune, sans conversion, base datée et sourcée', () => {
    const t = tripTolls({ ...base, country: 'AT', cars: 2 });
    expect(t.notes).toEqual([]);
    expect(t.line).not.toBeNull();
    expect(t.line!.title).toBe('Vignette autrichienne · 10 jours × 2 voitures');
    expect(t.line!.amount).toBeCloseTo(25.6, 5);
    const basis = flat(t.line!.basis);
    expect(basis).toContain('tarif officiel lu le 12 octobre 2026');
    expect(basis).toContain('oesterreich.gv.at');
    expect(basis).toContain('vignette 10 jours à 12,80 € par voiture');
    expect(basis).toContain('8 jours de voyage du 20 octobre 2026 au 27 octobre 2026');
    expect(basis).toContain('2 voitures, une vignette chacune');
    expect(basis).toContain('pays de destination seulement : pays de départ et pays traversés non comptés');
    // La précision pour le voyageur est dite ; la remarque de lecture du mainteneur ne l’est pas.
    expect(basis).toContain('droit de rétractation');
    expect(basis).toContain('celles de 1 et 10 jours valent tout de suite');
    expect(basis).not.toMatch(/403|refusé la lecture|calcul du Compas/);
  });

  it('Suisse : 40 CHF convertis avec le taux donné, le taux et sa date dits dans la base', () => {
    const t = tripTolls({ ...base, country: 'ch', rates: { CHF: rate('CHF', 0.93) } });
    expect(t.line!.title).toBe('Vignette suisse · annuelle');
    expect(t.line!.amount).toBeCloseTo(43.01, 2);
    const basis = flat(t.line!.basis);
    expect(basis).toContain('40 CHF');
    expect(basis).toContain('soit environ 43,01 €');
    expect(basis).toContain('1 € = 0,93 CHF, taux du 9 octobre 2026, Frankfurter (banques centrales)');
  });

  it('Hongrie : les forints passent par le taux, 10 jours à 6 900 Ft', () => {
    const t = tripTolls({ ...base, country: 'HU', days: 5, cars: 3, rates: { HUF: rate('HUF', 400) } });
    expect(t.line!.title).toBe('Vignette hongroise · 10 jours × 3 voitures');
    expect(t.line!.amount).toBeCloseTo(17.25 * 3, 2);
  });

  it('sans taux de change : pas de ligne, une note avec la devise d’origine, jamais un taux inventé', () => {
    for (const rates of [{}, { CHF: null }, { CHF: rate('CHF', 0) }]) {
      const t = tripTolls({ ...base, country: 'CH', rates });
      expect(t.line).toBeNull();
      expect(flat(t.notes.join(' '))).toMatch(/Vignette suisse non comptée : 40 CHF par voiture \(annuelle\), conversion en euros indisponible/);
    }
  });

  it('un tarif échu ou une durée trop longue : pas de ligne, une note qui dit pourquoi', () => {
    const late = tripTolls({ ...base, country: 'AT', start: '2026-12-05' });
    expect(late.line).toBeNull();
    expect(late.notes[0]).toMatch(/Vignette autrichienne non comptée : le tarif lu le 12 octobre 2026 vaut jusqu’au 30 novembre 2026 et le voyage commence après/);
    const long = tripTolls({ ...base, country: 'SI', days: 40 });
    expect(long.line).toBeNull();
    expect(long.notes[0]).toMatch(/Vignette slovène non comptée : aucune vignette lue ne couvre 40 jours/);
  });

  it('sans dates : le tarif à la date de la préparation, dit', () => {
    const t = tripTolls({ ...base, country: 'SK', start: null, days: 3 });
    expect(t.line!.title).toBe('Vignette slovaque · 10 jours');
    expect(flat(t.line!.basis)).toContain('dates non fixées : date de la préparation');
    expect(flat(t.line!.basis)).toContain('du 12 octobre 2026 au 14 octobre 2026');
  });

  it('un pays sans vignette lue : ni ligne ni note', () => {
    for (const country of ['FR', 'IT', 'PE', null, undefined, '']) expect(tripTolls({ ...base, country })).toEqual({ line: null, notes: [] });
  });
});

describe('needsVignette — une dépense du voyage seulement si une voiture roule et qu’une frontière est passée', () => {
  it('voiture + frontière, ou départ inconnu : oui ; dans son pays ou sans voiture : non', () => {
    expect(needsVignette({ drives: true, abroad: true })).toBe(true);
    expect(needsVignette({ drives: true, abroad: null })).toBe(true);
    expect(needsVignette({ drives: true, abroad: false })).toBe(false);
    expect(needsVignette({ drives: false, abroad: true })).toBe(false);
    expect(needsVignette({ drives: false, abroad: null })).toBe(false);
  });

  it('la préparation s’en sert, ajoute la ligne et les notes, et dit « péages non comptés » sur ses lignes de carburant', () => {
    const code = readFileSync(path.resolve(__dirname, '..', 'server', 'autofillActions.ts'), 'utf8');
    expect(code).toMatch(/needsVignette\(\{ drives: carFuel != null \|\| carKmOnSite > 0, abroad \}\)/);
    expect(code).toMatch(/tolls\?\.line[\s\S]{0,160}source: 'mesure'/);
    expect(code).toMatch(/notes\.push\(\.\.\.tolls\.notes\)/);
    expect(code).toMatch(/\$\{tollsBasis\(anchor\.countryCode\)\}/);
    expect(code).not.toMatch(/· péages non comptés`/);
  });
});

describe('péages au kilomètre — non comptés, avec la raison et le barème du pays quand une source officielle en donne un', () => {
  it('France : 9,27 c€ HT/km (ART, 1er février 2024) + TVA 20 % = 11,1 c€/km TTC, dit avec sa source et sa limite', () => {
    const basis = flat(tollsBasis('FR'));
    expect(basis).toContain(`péages non comptés (${TOLLS_REASON}`);
    expect(basis).toContain('France : 11,1 c€/km TTC en moyenne sur les autoroutes concédées');
    expect(basis).toContain('véhicules légers, tarifs du 1er février 2024, TVA de 20 % ajoutée au prix hors taxes, source : ART');
    expect(basis).toContain('un axe peut coûter bien plus ou moins');
  });

  it('Italie : plaine et montagne TTC, réseau Autostrade per l’Italia seulement', () => {
    const basis = flat(tollsBasis('it'));
    expect(basis).toContain('Italie : 7,9 c€/km TTC en plaine et 9,3 c€/km TTC en montagne sur le réseau Autostrade per l’Italia');
    expect(basis).toContain('classe A, tarifs du 1er janvier 2026, TVA comprise, source : l’opérateur');
    expect(basis).toContain('chaque autre concessionnaire a son propre tarif au km, non lu');
  });

  it('Espagne, Portugal, Croatie, Grèce : aucun barème lu à une source officielle, dit', () => {
    for (const [cc, name] of [['ES', 'Espagne'], ['PT', 'Portugal'], ['HR', 'Croatie'], ['GR', 'Grèce']]) {
      expect(perKmHint(cc)).toBe(`${name} : aucun barème moyen au km lu à une source officielle`);
      expect(tollsBasis(cc)).toContain('aucun barème moyen au km lu à une source officielle');
    }
  });

  it('ailleurs : « péages non comptés » et pourquoi, rien d’autre', () => {
    for (const cc of ['PE', 'CH', null, undefined]) expect(tollsBasis(cc)).toBe(`péages non comptés (${TOLLS_REASON})`);
    expect(perKmHint('PE')).toBeNull();
  });
});

describe('le trajet en voiture dit ses péages sans nommer le pays de départ', () => {
  const deps: TravelDeps = {
    carRoute: async () => ({ km: 120, minutes: 95, end: null }),
    walkKm: async () => 0,
    airport: () => null,
  };
  const leg = (home: boolean, from: string, to: string) =>
    planTravelLeg(
      {
        origin: home
          ? travelOrigin(null, null, { name: 'Domicile', lat: 45.76, lon: 4.84, countryCode: from })
          : travelOrigin({ name: 'Départ', lat: 45.76, lon: 4.84, countryCode: from }, null),
        target: { lat: 45.07, lon: 5.55 },
        destination: { name: 'Arrivée', countryCode: to },
        days: 3,
        party: 2,
        transport: true,
      },
      deps
    );

  it('estimateCarTrip : la base finit par la raison, ou par le texte donné', () => {
    expect(estimateCarTrip({ oneWayKm: 100, oneWayMin: 75, partySize: 2 })!.basis).toMatch(
      new RegExp(`· péages non comptés \\(${TOLLS_REASON}\\)$`)
    );
    expect(estimateCarTrip({ oneWayKm: 100, oneWayMin: 75, partySize: 2, tollsBasis: tollsBasis('FR') })!.basis).toContain('France : 11,1 c€/km TTC');
  });

  it('destination en Italie depuis le domicile : le barème de l’Italie, jamais le pays du domicile', async () => {
    const l = await leg(true, 'FR', 'IT');
    const basis = flat(l.carFuel!.basis);
    expect(basis).toContain('Italie : 7,9 c€/km TTC en plaine');
    expect(basis).not.toMatch(/France|\bFR\b/);
    expect(flat(l.transport!.basis)).not.toMatch(/France|\bFR\b/);
  });

  it('destination hors des pays cherchés : « péages non comptés » et pourquoi', async () => {
    const l = await leg(false, 'FR', 'PE');
    expect(l.carFuel!.basis).toMatch(new RegExp(`péages non comptés \\(${TOLLS_REASON}\\)$`));
  });
});
