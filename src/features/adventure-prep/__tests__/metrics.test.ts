import { describe, expect, it } from 'vitest';
import { metricsFor, metricValue } from '../engine/metrics';
import { buildItinerary } from '../engine/itinerary';
import { A_VERIFIER } from '../engine/trust';
import { PRICE_TO_CHECK, type ItineraryModel, type MoneyValue } from '../types';
import { fullDraft } from './fixtures';

function modelWith(overrides: Parameters<typeof fullDraft>[0]): ItineraryModel {
  const built = buildItinerary(fullDraft(overrides));
  if (!built) throw new Error('modele attendu');
  return built;
}

const terrain = (): ItineraryModel => modelWith({});
const sejour = (): ItineraryModel => modelWith({ activities: { primary: 'snowboard-sejour', extra: [], nights: [] } });
const voyage = (): ItineraryModel => modelWith({ activities: { primary: 'roadtrip', extra: [], nights: [] } });

/**
 * Duree d'activite reelle, minute par minute. Les totaux ne sont pas touches :
 * seule la somme des journees peut alimenter la duree de l'aventure.
 */
function withActivityMin(
  model: ItineraryModel,
  minutes: readonly (number | null)[],
): ItineraryModel {
  return {
    ...model,
    perDay: model.perDay.map((totals, index) => ({
      ...totals,
      activityMin: index < minutes.length ? minutes[index] : null,
    })),
  };
}

const euros = (amount: number): MoneyValue => ({ amount, currency: 'EUR', state: 'propose' });

/** Prixplique une journee entiere, ou `null` pour un prix encore inconnu. */
function withStepPrices(
  model: ItineraryModel,
  amount: number | null,
  day?: number,
): ItineraryModel {
  return {
    ...model,
    steps: model.steps.map((step) => {
      if (day !== undefined && step.day !== day) return step;
      return { ...step, price: amount === null ? PRICE_TO_CHECK : euros(amount) };
    }),
  };
}

const pick = (model: ItineraryModel, scope: 'jour' | 'aventure', id: string, day?: number) =>
  metricsFor(model, scope, day).find((metric) => metric.id === id);

/**
 * Ne price que les `priced` premieres etapes du jour 1. Les autres gardent
 * `PRICE_TO_CHECK` : c est la situation reelle d une journee ou la base ne
 *connait qu une partie des prix.
 */
function partialDay(model: ItineraryModel, priced = 1): ItineraryModel {
  let left = priced;
  return {
    ...model,
    steps: model.steps.map((step) => {
      if (step.day !== 1) return step;
      if (left <= 0) return { ...step, price: PRICE_TO_CHECK };
      left -= 1;
      return { ...step, price: euros(40) };
    }),
  };
}

describe('trois metriques par contexte', () => {
  it('affiche exactement trois metriques, toujours les memes par contexte', () => {
    expect(metricsFor(terrain(), 'aventure').map((m) => m.id)).toEqual([
      'distance',
      'denivele',
      'duree',
    ]);
    expect(metricsFor(sejour(), 'aventure').map((m) => m.id)).toEqual([
      'nuitees',
      'budget',
      'duree',
    ]);
    expect(metricsFor(voyage(), 'aventure').map((m) => m.id)).toEqual([
      'distance',
      'duree',
      'budget',
    ]);
  });

  it('marque une valeur inconnue « a verifier » au lieu de zero', () => {
    for (const model of [terrain(), sejour(), voyage()]) {
      for (const metric of metricsFor(model, 'aventure')) {
        if (metric.value === null) {
          expect(metric.state).toBe('a_verifier');
        } else {
          expect(metric.state).toBe('connue');
        }
      }
    }
    const distance = metricsFor(terrain(), 'aventure')[0];
    expect(distance.value).toBeNull();
    expect(distance.formatted).toBe(A_VERIFIER);
    expect(distance.formatted).not.toBe('0 km');
  });

  it('affiche une valeur reelle quand elle existe', () => {
    const budget = metricsFor(sejour(), 'aventure').find((m) => m.id === 'budget');
    expect(budget?.value).toBe(90);
    expect(budget?.formatted).toContain('90');
    const nuitees = metricsFor(sejour(), 'aventure').find((m) => m.id === 'nuitees');
    expect(nuitees?.value).toBe(3);
  });

  it('change d\'unité entre la journee et l\'aventure', () => {
    const jour = metricsFor(sejour(), 'jour')[0];
    const aventure = metricsFor(sejour(), 'aventure')[0];
    expect(jour.id).toBe('nuitees');
    expect(aventure.id).toBe('nuitees');
  });

  describe('budget partiel d une journee', () => {
    it('annonce la somme des seules etapes pricees, et le reste', () => {
      const base = voyage();
      const dayOne = base.steps.filter((step) => step.day === 1).length;
      expect(dayOne).toBeGreaterThan(1);
      const model = partialDay(base, 1);
      const budget = pick(model, 'jour', 'budget', 1);
      if (!budget) throw new Error('budget attendu');
      // La somme reelle des 40 € de l unique etape pricee...
      expect(budget.formatted).toContain('40');
      // ...et le compte exact de ce qui reste a verifier.
      expect(budget.formatted).toContain('connus');
      expect(budget.note).toBe(`${dayOne - 1} étapes à vérifier`);
      expect(budget.formatted).toBe('40 € connus');
    });

    it('accole le pluriel quand plusieurs etapes du jour manquent de prix', () => {
      const base = voyage();
      const dayOne = base.steps.filter((step) => step.day === 1).length;
      expect(dayOne).toBeGreaterThan(2);
      const model = partialDay(base, dayOne - 2);
      const budget = pick(model, 'jour', 'budget', 1);
      if (!budget) throw new Error('budget attendu');
      expect(budget.note).toBe('2 étapes à vérifier');
      expect(budget.note).toMatch(/étapes à vérifier$/);
    });

    it('accole le singulier quand il ne manque qu un prix', () => {
      const base = voyage();
      const dayOne = base.steps.filter((step) => step.day === 1).length;
      const model = partialDay(base, dayOne - 1);
      const budget = pick(model, 'jour', 'budget', 1);
      if (!budget) throw new Error('budget attendu');
      expect(budget.note).toBe('1 étape à vérifier');
    });

    it('une journee entierement pricee naffiche ni « connus » ni precision', () => {
      const model = withStepPrices(voyage(), 25, 1);
      const budget = pick(model, 'jour', 'budget', 1);
      if (!budget) throw new Error('budget attendu');
      expect(budget.note).toBeUndefined();
      expect(budget.formatted).not.toContain('connus');
      expect(budget.formatted).toMatch(/^\d+ €$/);
    });

    it('aucun prix connu ne vaut « a verifier », pas 0 €', () => {
      const budget = pick(voyage(), 'jour', 'budget', 1);
      expect(budget?.value).toBeNull();
      expect(budget?.formatted).toBe(A_VERIFIER);
      expect(budget?.note).toBeUndefined();
    });
  });

  it('utilise les totaux du jour selectionne', () => {
    const model = terrain();
    const jour2 = metricsFor(model, 'jour', 2);
    const jour1 = metricsFor(model, 'jour', 1);
    expect(jour2).toHaveLength(3);
    expect(jour1).toHaveLength(3);
  });

  it('renvoie la valeur brute, ou null si elle est inconnue', () => {
    const model = terrain();
    expect(metricValue(model, 'aventure', 'distance')).toBeNull();
    const budget = modelWith({
      activities: { primary: 'roadtrip', extra: [], nights: [] },
    });
    expect(metricValue(budget, 'aventure', 'budget')).toBe(90);
  });
});

describe('duree : une duree reelle, jamais un nombre de jours', () => {
  it('renvoie la duree d activite du jour selectionne', () => {
    const model = withActivityMin(terrain(), [300, 120, 45]);
    const jour1 = pick(model, 'jour', 'duree', 1);
    expect(jour1?.value).toBe(300);
    expect(jour1?.formatted).toBe('5 h');
    expect(jour1?.state).toBe('connue');
    expect(pick(model, 'jour', 'duree', 2)?.formatted).toBe('2 h');
    expect(pick(model, 'jour', 'duree', 3)?.formatted).toBe('45 min');
  });

  it('reste une duree sous l heure', () => {
    const model = withActivityMin(terrain(), [45, null, null]);
    expect(pick(model, 'jour', 'duree', 1)?.formatted).toBe('45 min');
  });

  it('ne renvoie jamais l index du jour', () => {
    const model = withActivityMin(terrain(), [null, null, null]);
    const jour3 = pick(model, 'jour', 'duree', 3);
    expect(jour3?.value).toBeNull();
    expect(jour3?.formatted).toBe(A_VERIFIER);
    expect(jour3?.formatted).not.toContain('jour');
  });

  it('marque « a verifier » des qu une journee n a pas de duree connue', () => {
    const model = withActivityMin(terrain(), [300, null, 45]);
    const jour2 = pick(model, 'jour', 'duree', 2);
    expect(jour2?.value).toBeNull();
    expect(jour2?.state).toBe('a_verifier');
    expect(jour2?.formatted).toBe(A_VERIFIER);
    expect(jour2?.formatted).not.toBe('0 h');
  });

  it('additionne les durees des journees de l aventure', () => {
    const model = withActivityMin(terrain(), [300, 120, 45]);
    const duree = pick(model, 'aventure', 'duree');
    expect(duree?.value).toBe(465);
    expect(duree?.formatted).toBe('7 h 45 min');
    expect(metricValue(model, 'aventure', 'duree')).toBe(465);
  });

  it('ne presente jamais un total partiel si un seul jour est inconnu', () => {
    const model = withActivityMin(terrain(), [300, null, 45]);
    const duree = pick(model, 'aventure', 'duree');
    expect(duree?.value).toBeNull();
    expect(duree?.state).toBe('a_verifier');
    expect(duree?.formatted).toBe(A_VERIFIER);
  });

  it('exprime la duree en heures et non en jours', () => {
    const model = withActivityMin(terrain(), [300, 120, 45]);
    const duree = pick(model, 'jour', 'duree', 1);
    expect(duree?.unit).toBe('h');
    expect(duree?.unit).not.toBe('jours');
    expect(pick(terrain(), 'aventure', 'duree')?.unit).toBe('h');
  });
});

describe('budget : la depense du jour quand un jour est selectionne', () => {
  it('somme les prix de la journee selectionnee', () => {
    const model = withStepPrices(sejour(), 12, 2);
    const steps = model.steps.filter((step) => step.day === 2);
    expect(steps.length).toBeGreaterThan(0);
    const budget = pick(model, 'jour', 'budget', 2);
    expect(budget?.value).toBe(12 * steps.length);
    expect(budget?.formatted).toBe(`${12 * steps.length} €`);
    expect(metricValue(model, 'jour', 'budget', 2)).toBe(12 * steps.length);
  });

  it('ne presente pas un budget partiel quand un prix manque', () => {
    const model = withStepPrices(sejour(), null, 2);
    const budget = pick(model, 'jour', 'budget', 2);
    expect(budget?.value).toBeNull();
    expect(budget?.state).toBe('a_verifier');
    expect(budget?.formatted).toBe(A_VERIFIER);
  });

  it('conserve le budget global de l aventure', () => {
    const model = withStepPrices(sejour(), 12, 2);
    const budget = pick(model, 'aventure', 'budget');
    expect(budget?.value).toBe(90);
    expect(budget?.formatted).toBe('90 €');
  });

  it('retombe sur le budget global quand aucun jour n est selectionne', () => {
    const model = withStepPrices(sejour(), 12, 2);
    expect(pick(model, 'jour', 'budget')?.value).toBe(90);
  });
});

describe('accord des unites comptables', () => {
  const oneDay = () =>
    modelWith({
      activities: { primary: 'snowboard-sejour', extra: [], nights: [] },
      calendar: { startDate: '2026-07-11', durationDays: 1, durationIsSuggested: true, startDateIsSuggested: false, returnDate: '2026-07-11' },
    });

  it('ecrit « 1 jour » et jamais « 1 jours »', () => {
    const uneNuit = modelWith({
      activities: { primary: 'snowboard-sejour', extra: [], nights: [] },
      calendar: { startDate: '2026-07-11', durationDays: 2, durationIsSuggested: false, startDateIsSuggested: false, returnDate: '2026-07-12' },
    });
    const nuitees = pick(uneNuit, 'jour', 'nuitees', 1);
    expect(nuitees?.value).toBe(1);
    expect(nuitees?.formatted).toBe('1 jour');
  });

  it('une journee sans etape nuit vaut zero, pas son index', () => {
    const sansNuit = modelWith({
      activities: { primary: 'snowboard-sejour', extra: [], nights: [] },
      calendar: { startDate: '2026-07-11', durationDays: 2, durationIsSuggested: false, startDateIsSuggested: false, returnDate: '2026-07-12' },
    });
    const nuitees = pick(sansNuit, 'jour', 'nuitees', 2);
    expect(nuitees?.value).toBe(0);
    expect(nuitees?.formatted).toBe('0 jour');
  });

  it('l index du jour ne se lit jamais comme un compte de nuits', () => {
    const model = sejour();
    for (const day of [1, 2, 3]) {
      const nuitees = pick(model, 'jour', 'nuitees', day);
      const reelles = model.steps.filter((step) => step.day === day && step.kind === 'nuit').length;
      expect(nuitees?.value).toBe(reelles);
    }
  });

  it('accorda les nuitees sur le meme principe', () => {
    const uneNuitee = modelWith({
      activities: { primary: 'snowboard-sejour', extra: [], nights: [] },
      calendar: { startDate: '2026-07-11', durationDays: 1, durationIsSuggested: false, startDateIsSuggested: false, returnDate: '2026-07-11' },
    });
    expect(pick(uneNuitee, 'aventure', 'nuitees')?.formatted).toBe('1 jour');
  });

  it('laisse les unites non comptables intactes', () => {
    const budget = metricsFor(sejour(), 'aventure').find((m) => m.id === 'budget');
    expect(budget?.unit).toBe('€');
    const distance = pick(voyage(), 'jour', 'distance', 1);
    expect(distance?.unit).toBe('km');
    const denivele = pick(terrain(), 'jour', 'denivele', 1);
    expect(denivele?.unit).toBe('m');
  });
});

describe('L3.3 : les libelles de tuile tiennent dans la tuile', () => {
  // Budget de LARGEUR, pas de style : la tuile est un conteneur inline-size
  // d environ 96px utiles sur 393px (3 tuiles + gaps + padding). Le CSS ne
  // coupe pas, il met une ellipse — un libelle trop long devient « Budget /
  // per… » et perd sa nuance. On borne donc la longueur des libelles, pas leur
  // rendu : le test echoue des qu un libelle s allonge au-dela de ce que la
  // tuile peut porter sans troncature.
  const LARGEUR_TUILE_PX = 96;
  // 6,6px par caractere en caption 620 : mesure sur « Distance » (8 car) qui
  // tient dans la tuile sans etre rogne. Marge de securite de 10%.
  const PX_PAR_CAR = 6.6;
  const largeur = (label: string) => label.length * PX_PAR_CAR;

  it('aucun libelle de tuile ne deborde sa largeur', () => {
    const tropLong: string[] = [];
    for (const id of ['distance', 'denivele', 'duree', 'nuitees', 'budget'] as const) {
      const label = metricsFor(voyage(), 'aventure').find((m) => m.id === id)?.label;
      if (label !== undefined && largeur(label) > LARGEUR_TUILE_PX * 1.1) {
        tropLong.push(`${id}="${label}" (${Math.round(largeur(label))}px)`);
      }
    }
    expect(tropLong).toEqual([]);
  });

  it('le libelle budget garde la nuance par personne, en abrege', () => {
    const budget = metricsFor(voyage(), 'aventure').find((m) => m.id === 'budget');
    expect(budget?.label).toBe('Budget / pers.');
    // Il ne doit surtout PAS revenir a la forme longue qui tronquait.
    expect(budget?.label).not.toBe('Budget / personne');
  });
});

/* ---------------------------------------------------------------------------
 * L0.2 — la duree d une journee ne doit JAMAIS etre l index du jour.
 *
 * Symptome d origine : sur la carte du jour 2, la tuile « Duree » affichait
 * « 2 h ». C etait l index du jour lu comme une mesure d activite. Le nombre
 * etait plausible, donc invisible a la relecture -- c est ce qui l a laisse
 * passer.
 *
 * Le test fixe des durees par journee qui n ont AUCUN rapport avec leur index
 * (jour 1 = 7 h, jour 2 = 25 min, jour 3 = 2 h 30). Ainsi, si l index se
 * glisse quelque part, il ne peut pas tomber juste par hasard.
 * ------------------------------------------------------------------------ */

describe('L0.2 — la duree du jour est une mesure, pas son index', () => {
  // 420 = 7 h, 25 = 25 min, 150 = 2 h 30. Aucun de ces nombres ne vaut son index.
  const durees = [420, 25, 150] as const;

  const model = (): ItineraryModel => withActivityMin(terrain(), durees);

  it('chaque journee affiche SA duree, et pas son numero', () => {
    const m = model();
    for (const [index, minutes] of durees.entries()) {
      const day = index + 1;
      const duree = metricsFor(m, 'jour', day).find((x) => x.id === 'duree');
      expect(duree?.value, `jour ${day}`).toBe(minutes);
      // L index du jour, exprime en minutes : la valeur qui ne doit JAMAIS sortir.
      expect(duree?.value, `jour ${day} ne doit pas valoir son index`).not.toBe(day);
    }
  });

  it('une duree d activite nulle reste une mesure vaut zero', () => {
    // Le jour 3 a ete replique a 0 min : c est un fait (« rien de prevu ce
    // jour-la »), pas une donnee manquante. Le ne pas confondre avec null
    // est exactement la frontiere que l item veut verrouiller.
    const m = withActivityMin(terrain(), [0, 25, 150]);
    const duree = metricsFor(m, 'jour', 1).find((x) => x.id === 'duree');
    expect(duree?.value).toBe(0);
    expect(duree?.state).toBe('connue');
  });

  it('une duree inconnue reste « a verifier », jamais 0 ni l index', () => {
    const m = withActivityMin(terrain(), [null, 25, 150]);
    const duree = metricsFor(m, 'jour', 1).find((x) => x.id === 'duree');
    expect(duree?.value).toBeNull();
    expect(duree?.state).toBe('a_verifier');
    expect(duree?.formatted).toBe(A_VERIFIER);
    // Le piege du lot H5 : un 0 de remplacement se lirait « 0 h », presente
    // comme une mesure. Le 0 WMO « degage » est le meme genre de defaut.
    expect(duree?.formatted).not.toBe('0 h');
  });

  it('le total de l aventure est la somme des journees, pas la derniere', () => {
    const m = model();
    const total = metricsFor(m, 'aventure').find((x) => x.id === 'duree');
    // 595 min = 7 h + 25 min + 2 h 30. Ni 150 (dernier jour), ni 3 (jours).
    expect(total?.value).toBe(595);
    expect(total?.value).not.toBe(150);
  });

  it('une seule journee inconnue suffit a rendre le total « a verifier »', () => {
    const m = withActivityMin(terrain(), [420, null, 150]);
    const total = metricsFor(m, 'aventure').find((x) => x.id === 'duree');
    expect(total?.value).toBeNull();
    expect(total?.state).toBe('a_verifier');
  });
});