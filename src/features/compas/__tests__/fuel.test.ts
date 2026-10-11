import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import DATA from '../data/fuelPrices.json';
import META from '../data/fuelPrices.meta.json';
import { fuelPrice, fuelPriceFor } from '../engine/fuel';
import { estimateCarTrip, fuelForKm } from '../engine/autofill';
import { planTravelLeg, travelOrigin, type TravelDeps } from '../engine/travel';

/**
 * Carburant par pays (PLAN-100 1.8 et 4.6) : le bulletin pétrolier de l'UE (CC BY 4.0) pour les
 * 27 États membres, une estimation à fourchette large ailleurs. Aucun prix inventé : un pays
 * hors de la table n'a pas de prix publié, il le dit.
 */

const script = path.resolve(__dirname, '..', '..', '..', '..', 'scripts', 'compas', 'build-fuel-prices.mjs');

describe('fuelPrice — prix publié ou estimation', () => {
  it('un État membre de l’UE : le prix du bulletin, daté, dit comme tel', () => {
    const fr = fuelPrice('FR');
    expect(fr.kind).toBe('bulletin');
    expect(fr.eurPerL).toBe(DATA.eurosuper95.FR);
    expect(fr.range).toBeNull();
    expect(fr.basis).toBe('Euro-super 95 à 2,21 €/L (bulletin pétrolier de l’UE du 5 octobre 2026)');
  });

  it('la casse et les espaces ne changent rien', () => {
    expect(fuelPrice(' de ').eurPerL).toBe(DATA.eurosuper95.DE);
  });

  it('hors de l’UE : une estimation, la moyenne pondérée de l’UE-27, avec la fourchette de l’UE', () => {
    for (const cc of ['US', 'CH', 'NO', 'JP', 'MA', 'PE']) {
      const p = fuelPrice(cc);
      expect(p.kind, cc).toBe('estimation');
      expect(p.eurPerL).toBe(DATA.eu27.eurosuper95);
      expect(p.range).toEqual({ low: Math.min(...Object.values(DATA.eurosuper95)), high: Math.max(...Object.values(DATA.eurosuper95)) });
    }
    const p = fuelPrice('US');
    expect(p.basis).toBe(
      'carburant estimé hors UE (aucune source gratuite) : moyenne de l’UE-27 à 2,01 €/L, de 1,34 à 2,61 €/L selon les pays de l’UE (bulletin pétrolier de l’UE du 5 octobre 2026) ; à vérifier sur place'
    );
  });

  it('pays inconnu ou absent : la même estimation, jamais un prix de la France', () => {
    expect(fuelPrice(null).kind).toBe('estimation');
    expect(fuelPrice(undefined).eurPerL).toBe(DATA.eu27.eurosuper95);
    expect(fuelPrice('ZZZ').kind).toBe('estimation');
  });

  it('les 27 pays sont dans la table, chacun à un prix à la pompe plausible', () => {
    expect(Object.keys(DATA.eurosuper95)).toHaveLength(27);
    for (const v of Object.values(DATA.eurosuper95)) {
      expect(v).toBeGreaterThan(0.5);
      expect(v).toBeLessThan(4);
    }
  });
});

describe('fuelPriceFor — plusieurs pays traversés', () => {
  it('un seul pays distinct : son prix', () => {
    expect(fuelPriceFor(['FR', 'FR', null]).eurPerL).toBe(DATA.eurosuper95.FR);
  });

  it('deux pays de l’UE : la moyenne des deux, dite avec chaque prix', () => {
    const p = fuelPriceFor(['FR', 'IT']);
    expect(p.kind).toBe('bulletin');
    expect(p.eurPerL).toBeCloseTo((DATA.eurosuper95.FR + DATA.eurosuper95.IT) / 2, 3);
    expect(p.basis).toBe('Euro-super 95, moyenne des pays du trajet : FR 2,21 €/L, IT 2,07 €/L (bulletin pétrolier de l’UE du 5 octobre 2026)');
  });

  it('sans nommer les pays (départ du domicile) : le même prix, aucun code dans la base', () => {
    const named = fuelPriceFor(['BE', 'FR']);
    const anonymous = fuelPriceFor(['BE', 'FR'], { nameCountries: false });
    expect(anonymous.eurPerL).toBe(named.eurPerL);
    expect(anonymous.kind).toBe('bulletin');
    expect(anonymous.basis).toBe('Euro-super 95, moyenne des pays du trajet : 2,09 €/L (bulletin pétrolier de l’UE du 5 octobre 2026)');
    expect(anonymous.basis).not.toMatch(/\b(?:BE|FR)\b/);
    // Un seul pays, ou une estimation : la base ne nommait déjà aucun pays.
    expect(fuelPriceFor(['BE', 'BE'], { nameCountries: false })).toEqual(fuelPrice('BE'));
    expect(fuelPriceFor(['BE', 'CH'], { nameCountries: false })).toEqual(fuelPrice(null));
  });

  it('un pays hors UE parmi eux : le tout reste une estimation', () => {
    const p = fuelPriceFor(['FR', 'CH']);
    expect(p.kind).toBe('estimation');
    expect(p.range).not.toBeNull();
  });

  it('aucun pays connu : l’estimation', () => {
    expect(fuelPriceFor([null, undefined]).kind).toBe('estimation');
  });
});

describe('le carburant du trajet suit le pays', () => {
  it('estimateCarTrip : le prix du pays, la base le dit, les péages restent non comptés', () => {
    const fr = estimateCarTrip({ oneWayKm: 100, oneWayMin: 75, partySize: 4, fuel: fuelPrice('FR') })!;
    const mt = estimateCarTrip({ oneWayKm: 100, oneWayMin: 75, partySize: 4, fuel: fuelPrice('MT') })!;
    expect(fr.fuelEur).toBe(Math.round(((200 * 6.5) / 100) * DATA.eurosuper95.FR));
    expect(mt.fuelEur).toBeLessThan(fr.fuelEur);
    expect(fr.basis).toMatch(/6,5 L\/100 km · Euro-super 95 à 2,21 €\/L \(bulletin pétrolier de l’UE du 5 octobre 2026\)/);
    expect(fr.basis).toMatch(/péages non comptés/);
    expect(fr.fuelSource).toBe('bulletin');
    expect(fr.fuelRangeEur).toBeNull();
  });

  it('sans pays donné : l’estimation de l’UE-27, jamais l’ancien 1,80 €/L', () => {
    const t = estimateCarTrip({ oneWayKm: 100, oneWayMin: 75, partySize: 4 })!;
    expect(t.fuelEur).toBe(Math.round(((200 * 6.5) / 100) * DATA.eu27.eurosuper95));
    expect(t.fuelSource).toBe('estimation');
    expect(t.basis).toMatch(/carburant estimé hors UE/);
    expect(t.fuelRangeEur).toEqual({
      low: Math.round(((200 * 6.5) / 100) * Math.min(...Object.values(DATA.eurosuper95))),
      high: Math.round(((200 * 6.5) / 100) * Math.max(...Object.values(DATA.eurosuper95))),
    });
    expect(t.basis).toMatch(/entre \d+ € et \d+ € pour ce trajet/);
  });

  it('fuelForKm : kilomètres sur place au prix du pays', () => {
    const it = fuelForKm(300, 5, fuelPrice('IT'));
    expect(it.cars).toBe(2);
    expect(it.fuelEur).toBe(Math.round(((300 * 6.5) / 100) * DATA.eurosuper95.IT * 2));
  });
});

describe('le trajet d’approche est chiffré au prix du ou des pays', () => {
  const deps: TravelDeps = {
    carRoute: async () => ({ km: 120, minutes: 95, end: null }),
    walkKm: async () => 0,
    airport: () => null,
  };
  const leg = (from: string, to: string) =>
    planTravelLeg(
      {
        origin: travelOrigin({ name: 'Départ', lat: 45.76, lon: 4.84, countryCode: from }, null),
        target: { lat: 45.07, lon: 5.55 },
        destination: { name: 'Arrivée', countryCode: to },
        days: 3,
        party: 2,
        transport: true,
      },
      deps
    );

  it('même pays de l’UE : son prix publié, la source mesurée', async () => {
    const l = await leg('FR', 'FR');
    expect(l.carFuel?.fuelSource).toBe('bulletin');
    expect(l.carFuel?.fuelEur).toBe(Math.round(((240 * 6.5) / 100) * DATA.eurosuper95.FR));
    expect(l.carFuel?.basis).toMatch(/Euro-super 95 à 2,21 €\/L/);
  });

  it('départ et destination dans deux pays de l’UE : la moyenne des deux, dite', async () => {
    const l = await leg('FR', 'IT');
    expect(l.carFuel?.basis).toMatch(/moyenne des pays du trajet : FR 2,21 €\/L, IT 2,07 €\/L/);
  });

  it('une destination hors de l’UE : l’estimation, avec sa fourchette en euros pour ce trajet', async () => {
    const l = await leg('FR', 'CH');
    expect(l.carFuel?.fuelSource).toBe('estimation');
    expect(l.carFuel?.fuelRangeEur?.low).toBeLessThan(l.carFuel?.fuelRangeEur?.high ?? 0);
    expect(l.carFuel?.basis).toMatch(/carburant estimé hors UE \(aucune source gratuite\)/);
  });
});

describe('build-fuel-prices — le fichier est celui du bulletin', () => {
  it('la méta cite la source, la licence CC BY 4.0, les dates et l’empreinte', () => {
    expect(META.licence).toBe('CC BY 4.0');
    expect(META.page).toBe('https://energy.ec.europa.eu/data-and-analysis/weekly-oil-bulletin_en');
    expect(META.pricesDate).toBe(DATA.date);
    expect(META.pagePublished).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(META.sha256).toMatch(/^[0-9a-f]{64}$/);
    expect(META.countries).toBe(27);
    expect(META.credit).toMatch(/Commission européenne/);
  });

  it('le fichier JSON est tel que le script l’écrit (jamais édité à la main)', () => {
    const text = readFileSync(path.resolve(__dirname, '..', 'data', 'fuelPrices.json'), 'utf8');
    expect(JSON.parse(text)).toEqual(DATA);
  });

  it('le script refuse une cellule hors bornes, une ligne inconnue et un pays manquant', async () => {
    const { parseBulletin } = (await import(script)) as {
      parseBulletin: (cells: Record<string, string | number>) => { date: string; eurosuper95: Record<string, number> };
    };
    const countries = [
      'Austria', 'Belgium', 'Bulgaria', 'Croatia', 'Cyprus', 'Czechia', 'Denmark', 'Estonia', 'Finland', 'France',
      'Germany', 'Greece', 'Hungary', 'Ireland', 'Italy', 'Latvia', 'Lithuania', 'Luxembourg', 'Malta', 'Netherlands',
      'Poland', 'Portugal', 'Romania', 'Slovakia', 'Slovenia', 'Spain', 'Sweden',
    ];
    const sheet = (): Record<string, string | number> => {
      const cells: Record<string, string | number> = {
        A1: 'in EUR',
        B1: 'Euro-super 95  (I)',
        C1: 'Gas oil automobile Automotive gas oil Dieselkraftstoff (I)',
        A2: 46300,
        B2: '1000 l',
        C2: '1000 l',
      };
      countries.forEach((c, i) => {
        cells[`A${i + 3}`] = c;
        cells[`B${i + 3}`] = 1800 + i;
        cells[`C${i + 3}`] = 2000 + i;
      });
      cells.A30 = 'CE/EC/EG EUR27_2020 (IV)\nMoyenne pondérée';
      cells.B30 = 2006.3;
      cells.C30 = 2148.5;
      return cells;
    };
    const ok = parseBulletin(sheet());
    expect(ok.date).toBe('2026-10-05');
    expect(ok.eurosuper95.AT).toBe(1.8);
    const high = sheet();
    high.B5 = 99999;
    expect(() => parseBulletin(high)).toThrow(/hors bornes/);
    const unknown = sheet();
    unknown.A5 = 'Atlantis';
    expect(() => parseBulletin(unknown)).toThrow(/ligne inconnue/);
    const missing = sheet();
    delete missing.A5;
    delete missing.B5;
    delete missing.C5;
    expect(() => parseBulletin(missing)).toThrow(/pays absents/);
    const unit = sheet();
    unit.B2 = 't';
    expect(() => parseBulletin(unit)).toThrow(/unité inattendue/);
  });
});
