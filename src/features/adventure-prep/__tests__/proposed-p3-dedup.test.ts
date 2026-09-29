import { describe, expect, it } from 'vitest';
import { proposedStops } from '../engine/proposedStops';
import type { AdventurePrepDraft } from '../types';
import { fullDraft } from './fixtures';

/**
 * P3.4 - DEDUPLIQUATION INTER-JOURNEES.
 *
 * `proposedStops` indexait sur `day === 1` : tous les jours suivants
 * recevaient MOT POUR MOT `WATER_LATER` et `VIEW`. Sur un voyage de six
 * jours, « Ravitaillement et eau » revenait cinq fois et « Point d'intérêt
 * sur le parcours » quatre fois.
 *
 * Regle tenue ici : un libelle generique EAU ou ARRET ne peut pas se repeter.
 * Quand le reservoir de libelles est epuise, l'etape generique est SUPPRIMEE
 * ce jour-la plutot que repetee - le repas, lui, garantit toujours un
 * ravitaillement.
 *
 * La pause (« Pause ») et le diner se repetent volontairement : ils ne sont pas
 * des libelles generiques de lieu, et les changer tous les jours rendrait le
 * programme illisible sans rien dire de plus. Ils sont hors perimetre.
 */

const PREFERENCES = {
  budgetPerPerson: 90,
  budgetLevel: 'modere' as const,
  pace: 'normal' as const,
  transport: 'train' as const,
  interests: [] as string[],
  accessibilityNeeds: [] as string[],
};

/** Aucun interet : le programme ne repose que sur les libelles generiques. */
const SANS_INTERET = (jours = 3): AdventurePrepDraft =>
  fullDraft({
    activities: { primary: 'rando-refuge', extra: [], nights: [] },
    preferences: { ...PREFERENCES, interests: [] },
    calendar: {
      startDate: '2026-07-11',
      durationDays: jours,
      returnDate: null,
      startDateIsSuggested: false,
      durationIsSuggested: false,
    },
  });

/** Un interet « arret » : la halte DOIT porter l interet, chaque jour. */
const AVEC_ARRET = (jours = 3): AdventurePrepDraft =>
  fullDraft({
    ...SANS_INTERET(jours),
    preferences: { ...PREFERENCES, interests: ['Paysage'] },
  });

function titresDe(draft: AdventurePrepDraft, jours: number): string[][] {
  return Array.from({ length: jours }, (_, index) =>
    proposedStops(draft, index + 1, jours).map((stop) => stop.title),
  );
}

describe('P3.4 - un libelle generique eau/arret ne se repete pas', () => {
  it('sur six jours, aucun titre eau/arret n apparait deux fois', () => {
    const jours = 6;
    const parJour = titresDe(SANS_INTERET(jours), jours);
    const vus = new Map<string, number[]>();
    parJour.forEach((titres, index) => {
      for (const titre of titres) {
        // Pause et diner se repetent volontairement : hors perimetre.
        if (/^(Pause|Dîner)$/.test(titre)) continue;
        if (/repas/i.test(titre)) continue;
        const joursVus = vus.get(titre) ?? [];
        joursVus.push(index + 1);
        vus.set(titre, joursVus);
      }
    });
    for (const [titre, joursVus] of vus) {
      expect(joursVus.length, `« ${titre} » revient les jours ${joursVus.join(', ')}`).toBe(1);
    }
  });

  it('les jours 2..N ne partagent plus le meme libelle d eau', () => {
    const jours = 5;
    const parJour = titresDe(SANS_INTERET(jours), jours).slice(1);
    const libellesEau = parJour.map((titres) =>
      titres.find((titre) => /eau|ravitaillement/i.test(titre) && !/repas/i.test(titre)) ?? null,
    );
    const distincts = new Set(libellesEau.filter(Boolean));
    expect(distincts.size).toBe(libellesEau.filter(Boolean).length);
  });

  it('au-dela du reservoir, l eau generique disparait plutot que de se repeter', () => {
    const jours = 9;
    const parJour = titresDe(SANS_INTERET(jours), jours).slice(1);
    const libelles = parJour.flat().filter((t) => /eau|ravitaillement/i.test(t) && !/repas/i.test(t));
    expect(new Set(libelles).size).toBe(libelles.length);
    // Une journee sur epuise n'a plus de libelle eau : c'est voulu, pas un trou.
    expect(libelles.length).toBeLessThan(jours - 1);
    // Chaque journee garde malgre tout son repas : un ravitaillement.
    for (let day = 1; day <= jours; day += 1) {
      const stops = proposedStops(SANS_INTERET(jours), day, jours);
      expect(stops.some((stop) => stop.kind === 'ravitaillement'), `jour ${day} sans ravitaillement`).toBe(true);
    }
  });

  it('idem avec un interet « arret » : la halte porte l interet chaque jour', () => {
    const jours = 6;
    for (let day = 1; day <= jours; day += 1) {
      const stops = proposedStops(AVEC_ARRET(jours), day, jours);
      expect(
        stops.some((stop) => /point de vue sur le parcours/i.test(stop.title)),
        `jour ${day} sans l'interet Paysage`,
      ).toBe(true);
    }
    // Et le libelle generique ne vient PAS se melanger a l interet.
    const generiques = titresDe(AVEC_ARRET(jours), jours)
      .flat()
      .filter((titre) => /point d.int.r.t sur le parcours|halte sur le parcours|d.couverte sur la route/i.test(titre));
    expect(generiques.length).toBeLessThanOrEqual(1);
  });
});

describe('P3.4 - les invariants deja tenus ne bougent pas', () => {
  it('TY-09 : le premier jour garde exactement « Eau et ravitaillement »', () => {
    expect(proposedStops(SANS_INTERET(3), 1, 3)[0].title).toBe('Eau et ravitaillement');
  });

  it('TY-05 : le libelle generique du premier jour reste disponible', () => {
    const titres = proposedStops(SANS_INTERET(3), 1, 3).map((stop) => stop.title);
    expect(titres).toContain("Point d'intérêt sur le parcours");
  });

  it('TY-06 : « Eau et ravitaillement » n apparait que sur le premier jour', () => {
    const parJour = titresDe(SANS_INTERET(6), 6);
    const occurrences = parJour.flatMap((titres, index) =>
      titres.includes('Eau et ravitaillement') ? [index + 1] : [],
    );
    expect(occurrences).toEqual([1]);
  });

  it('TY-07 : le jour 2 garde une trace de l eau sans repeter le libelle du jour 1', () => {
    const jour2 = proposedStops(SANS_INTERET(3), 2, 3).map((stop) => stop.title);
    expect(jour2).not.toContain('Eau et ravitaillement');
    expect(jour2.join(' ')).toMatch(/eau|ravitaillement/i);
  });

  it('TY-10 : l interet « Eau » ne reintroduit pas le libelle du premier jour', () => {
    const draft = fullDraft({
      ...SANS_INTERET(3),
      preferences: { ...PREFERENCES, interests: ['Eau'] },
    });
    const jour3 = proposedStops(draft, 3, 3).map((stop) => stop.title);
    expect(jour3).not.toContain('Eau et ravitaillement');
  });

  it('TY-04 : toute raison contenant « : » garde l espace insecable', () => {
    const jours = 6;
    for (let day = 1; day <= jours; day += 1) {
      for (const stop of proposedStops(SANS_INTERET(jours), day, jours)) {
        if (stop.reason && stop.reason.includes(':')) {
          expect(stop.reason).not.toMatch(/[^\u00A0]:/);
        }
      }
    }
  });

  it('proposedStops reste pur : deux appels identiques donnent le meme resultat', () => {
    const draft = SANS_INTERET(4);
    expect(proposedStops(draft, 2, 4)).toEqual(proposedStops(draft, 2, 4));
  });
});

describe('P3.4 - le reservoir est consomme DANS L ORDRE, sans decalage', () => {
  // Les tests precedents ne verifient que l ABSENCE de doublon. Un reservoir
  // mal indexe saute sa premiere variante ET reste sans doublon : ils passent
  // donc tous les deux. Ces cas-la verifient la SEQUENCE, et sont les seuls a
  // tomber si un `day - 1` revient dans `variante`.
  //
  // On filtre par APPARTENANCE au reservoir, pas par POSITION : au jour 6 le
  // reservoir est epuise, la ligne d eau disparait, et la position 0 est donc
  // occupee par la pause. Ce que ces cas capturent est QUELLE variante sort le
  // jour J : exactement l information que le decalage perdait.

  const TITRES_EAU = [
    'Eau et ravitaillement',
    'Ravitaillement et eau',
    "R\u00e9serve d'eau pour la \u00e9tape du jour",
    'Remplir les gourdes avant la suite',
    'Approvisionnement en eau du jour',
  ];
  const TITRES_ARRET = [
    "Point d'int\u00e9r\u00eat sur le parcours",
    'Halte sur le parcours',
    "D\u00e9couverte sur la route",
  ];

  const variantesParJour = (
    draft: AdventurePrepDraft,
    jours: number,
    reservoir: string[],
  ): string[][] =>
    Array.from({ length: jours }, (_, index) =>
      proposedStops(draft, index + 1, jours)
        .map((stop) => stop.title)
        .filter((title) => reservoir.includes(title)),
    );

  it('le jour 2 ouvre le reservoir : WATER_LATER[0], pas WATER_LATER[1]', () => {
    expect(proposedStops(SANS_INTERET(6), 2, 6)[0]?.title).toBe('Ravitaillement et eau');
  });

  it('les cinq libelles d eau sortent les jours 1 a 5, dans l ordre', () => {
    expect(variantesParJour(SANS_INTERET(6), 6, TITRES_EAU)).toEqual([
      [TITRES_EAU[0]],
      [TITRES_EAU[1]],
      [TITRES_EAU[2]],
      [TITRES_EAU[3]],
      [TITRES_EAU[4]],
      // Reservoir epuise : la ligne DISPARAIT, elle ne se repete pas.
      [],
    ]);
  });

  it('sur 9 jours le reservoir ne REDEMARRE jamais apres epuisement', () => {
    expect(variantesParJour(SANS_INTERET(9), 9, TITRES_EAU)).toEqual([
      [TITRES_EAU[0]],
      [TITRES_EAU[1]],
      [TITRES_EAU[2]],
      [TITRES_EAU[3]],
      [TITRES_EAU[4]],
      [],
      [],
      [],
      [],
    ]);
  });

  it('l arret generique ouvre des le jour 1 et s epuise au jour 4', () => {
    expect(variantesParJour(SANS_INTERET(6), 6, TITRES_ARRET)).toEqual([
      [TITRES_ARRET[0]],
      [TITRES_ARRET[1]],
      [TITRES_ARRET[2]],
      [],
      [],
      [],
    ]);
  });

  it('une journee hors bornes (jour 0) ne fait FUIR aucune variante', () => {
    // Avec le decalage d index (`day` au lieu de `day - 2`), le jour 0
    // rendrait WATER_LATER[0] ET VIEW[0] : deux libelles de lieu affiches
    // pour une journee qui n existe pas.
    const jour0 = proposedStops(SANS_INTERET(3), 0, 3).map((stop) => stop.title);
    const fuite = jour0.filter((titre) =>
      [...TITRES_EAU, ...TITRES_ARRET].includes(titre),
    );
    expect(fuite).toEqual([]);
  });
});
