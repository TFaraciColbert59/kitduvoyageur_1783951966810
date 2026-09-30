/**
 * T0 - Le moteur de derivation : la source unique de verite des 8 cartes.
 * Budget, dangerousite, fenetre, etapes, kit, traces.
 */

import { describe, expect, it } from 'vitest';

import { analyzeIntention, isRecognizedIntention } from '@/features/trajectoire/domain/intention';
import {
  deriveMissingKitEur,
  deriveTrajectoire,
  describeDuration,
  totalDistanceKm,
} from '@/features/trajectoire/domain/derive';
import { DEMO_TRACES, countAtYourScale } from '@/features/trajectoire/domain/traces';
import { ZONES, tFromHours } from '@/features/trajectoire/domain/scaleAxis';

const INTENTION = analyzeIntention(
  'Partir cinq jours dans les Dolomites, sans voiture, refuges et passages peu exposes'
);

const T_169H = tFromHours(169);

function snapshotAt(t: number, owned: readonly string[] = []) {
  return deriveTrajectoire({ t, intention: INTENTION, ownedKit: owned, traces: DEMO_TRACES });
}

describe('intention - extraction deterministe', () => {
  it('reconnait les Dolomites et les contraintes de la phrase', () => {
    expect(INTENTION.destination.id).toBe('dolomites');
    expect(INTENTION.destination.countryCode).toBe('IT');
    expect(INTENTION.constraints).toContain('sans_voiture');
    expect(INTENTION.constraints).toContain('refuges');
    expect(INTENTION.constraints).toContain('peu_expose');
    expect(isRecognizedIntention(INTENTION)).toBe(true);
  });

  it('reconnait les autres destinations du catalogue', () => {
    expect(analyzeIntention('Perou, Salkantay 6 jours').destination.id).toBe('perou');
    expect(analyzeIntention('Desert du Maroc, Zagora').destination.id).toBe('sahara');
    expect(analyzeIntention('Lofoten, fjords de Norvege').destination.id).toBe('lofoten');
    expect(analyzeIntention('Chamonix et la mer de glace').destination.id).toBe('alpes');
    expect(analyzeIntention('Pyrenees, Gavarnie').destination.id).toBe('pyrenees');
  });

  it('reconnait les intentions accentuees et majuscules', () => {
    expect(analyzeIntention('DOLOMITES, ALPES').destination.id).toBe('dolomites');
    expect(analyzeIntention('Pérou').destination.id).toBe('perou');
    expect(analyzeIntention('Désert').destination.id).toBe('sahara');
  });

  it("retombe sur le repli et l'assume quand rien n'est reconnu", () => {
    const vague = analyzeIntention('Je voudrais partir quelque part de beau');
    expect(vague.destination.id).toBe('dolomites');
    expect(isRecognizedIntention(vague)).toBe(false);
  });

  it('ne devine jamais de destination hors catalogue', () => {
    const profile = analyzeIntention('Atlantique, 2000 km de costes');
    expect(['dolomites', 'perou', 'sahara', 'lofoten', 'alpes', 'pyrenees']).toContain(
      profile.destination.id
    );
  });

  it('extrait un budget en euros quand la phrase en contient un', () => {
    expect(analyzeIntention('Dolomites, budget 1 200 EUR').budgetMaxEur).toBe(1200);
    expect(analyzeIntention('Dolomites, petit budget').budgetMaxEur).toBeNull();
  });

  it('est stable : meme phrase, meme sortie', () => {
    const phrase = 'Raid dans les Pyrenees, sans voiture, avec enfants, 900 EUR';
    expect(JSON.stringify(analyzeIntention(phrase))).toBe(JSON.stringify(analyzeIntention(phrase)));
  });

  it('donne des reperes a la destination', () => {
    expect(INTENTION.destination.anchors.length).toBeGreaterThanOrEqual(5);
    expect(INTENTION.destination.paceKmh).toBeGreaterThan(0);
  });
});

describe('derive - parite avec le prototype de reference', () => {
  it('reproduit le budget expedition a 169 h (capture du prototype)', () => {
    const snapshot = snapshotAt(T_169H); // ~169 h
    expect(snapshot.zone).toBe('expedition');
    expect(snapshot.hours).toBe(169);
    expect(snapshot.budget.transportEur).toBe(592);
    expect(snapshot.budget.hebergementEur).toBe(710);
    expect(snapshot.budget.activitesEur).toBe(254);
    expect(snapshot.budget.kitManquantEur).toBe(140);
    expect(snapshot.budget.totalEur).toBe(1696);
  });

  it('produit 5 etapes a 169 h (capture du prototype)', () => {
    expect(snapshotAt(T_169H).steps).toHaveLength(5);
  });

  it('reproduit les valeurs de la fenetre meteo a 169 h', () => {
    const snapshot = snapshotAt(T_169H);
    expect(snapshot.window.ideal).toBe('Juin - Sept.');
    expect(snapshot.window.risk).toBe('25 sept. - orages');
    expect(snapshot.window.daylight).toBe('13 h 40');
  });
});

describe('derive - invariants du domaine', () => {
  it('reste dans la plage 0..1 et borne les heures', () => {
    expect(snapshotAt(-3).hours).toBe(1);
    expect(snapshotAt(9).hours).toBe(720);
  });

  it('donne un instantane complet a chaque echelle', () => {
    for (let step = 0; step <= 20; step += 1) {
      const snapshot = snapshotAt(step / 20);
      expect(snapshot.zoneLabel.length, 'zoneLabel').toBeGreaterThan(0);
      expect(snapshot.budget.totalEur, 'budget').toBeGreaterThanOrEqual(0);
      expect(snapshot.danger.score, 'danger').toBeGreaterThanOrEqual(5);
      expect(snapshot.steps.length, 'steps').toBeGreaterThan(0);
      expect(snapshot.provenance.length, 'provenance').toBeGreaterThan(0);
      expect(snapshot.veille.length, 'veille').toBe(4);
    }
  });

  it("le budget ne monte jamais a l'interieur d'une zone", () => {
    // Le cout/h est constant dans une zone : a duree croissante, le budget
    // total ne peut que croitre.
    for (const zone of ZONES) {
      let previous = -1;
      for (
        let hours = zone.minHours;
        hours <= zone.maxHours;
        hours += Math.max(1, Math.round(zone.maxHours / 8))
      ) {
        const snapshot = deriveTrajectoire({
          t: tFromHours(hours),
          intention: INTENTION,
          traces: DEMO_TRACES,
        });
        if (snapshot.zone !== zone.id) continue;
        expect(snapshot.budget.totalEur, `${zone.id} ${hours} h`).toBeGreaterThanOrEqual(previous);
        previous = snapshot.budget.totalEur;
      }
    }
  });

  it("applique des economies d'echelle : le cout horaire baisse avec la zone", () => {
    // Le cout horaire DECROIT dans une zone (facteur de couverture), mais
    // chaque zone a ses propres tarifs : il n'est donc pas monotone a
    // l'echelle du plan. On teste les deux invariants reellement garantis.
    const perHour = (hours: number) => {
      const snapshot = deriveTrajectoire({
        t: tFromHours(hours),
        intention: INTENTION,
        traces: DEMO_TRACES,
      });
      return snapshot.budget.totalEur / hours;
    };

    // 1. Economies d'echelle intra-zone : plus c'est long, moins c'est cher
    // a l'heure. Verifie sur trois zones de largeurs tres differentes.
    expect(perHour(240)).toBeLessThan(perHour(72));
    expect(perHour(720)).toBeLessThan(perHour(300));
    expect(perHour(48)).toBeLessThan(perHour(24));

    // 2. Discontinuite voulue entre zones : un raid est equipe plus
    // intensement qu'une expedition, et le tour du monde est un grand
    // voyage premium (8 + 5 + 2 EUR/h) plus cher a l'heure qu'une
    // expedition (3,5 + 4,2 + 1,5 EUR/h). On verrouille ce choix produit.
    expect(perHour(48)).toBeGreaterThan(perHour(240));
    expect(perHour(720)).toBeGreaterThan(perHour(240));

    // 3. Aucune zone ne peut etre gratuite.
    expect(perHour(3)).toBeGreaterThan(0);
    expect(perHour(12)).toBeGreaterThan(0);
  });

  it('adhere au budget : le total est toujours la somme des lignes', () => {
    for (let step = 0; step <= 20; step += 1) {
      const { budget } = snapshotAt(step / 20);
      expect(budget.totalEur).toBe(
        budget.transportEur + budget.hebergementEur + budget.activitesEur + budget.kitManquantEur
      );
    }
  });

  it("fait grossir le sac et la charge avec l'echelle", () => {
    const sortie = snapshotAt(0.02);
    const monde = snapshotAt(0.98);
    expect(monde.packLiters).toBeGreaterThan(sortie.packLiters);
    expect(monde.kitLoadKg).toBeGreaterThan(sortie.kitLoadKg);
  });

  it('active les sources externes monotoniquement', () => {
    const counts = [0, 0.2, 0.4, 0.6, 0.8, 1].map((t) => snapshotAt(t).provenance.length);
    for (let index = 1; index < counts.length; index += 1) {
      expect(counts[index]).toBeGreaterThanOrEqual(counts[index - 1]);
    }
    expect(snapshotAt(0).provenance).toEqual(['meteo', 'traces_perso', 'osm']);
    expect(snapshotAt(1).provenance).toContain('vols');
  });

  it('est une fonction pure : deux appels identiques donnent le meme resultat', () => {
    const left = snapshotAt(0.63);
    const right = snapshotAt(0.63);
    expect({ ...left, computeMs: 0 }).toEqual({ ...right, computeMs: 0 });
  });

  it('tient le budget de performance de 2 ms', () => {
    // On echantillonne 200 positions : si une seule derive depasse 2 ms,
    // le budget du dossier (risque n 1) est viole.
    let worst = 0;
    for (let index = 0; index < 200; index += 1) {
      const snapshot = deriveTrajectoire({
        t: index / 199,
        intention: INTENTION,
        traces: DEMO_TRACES,
      });
      worst = Math.max(worst, snapshot.computeMs);
    }
    expect(worst).toBeLessThan(2);
  });
});

describe('derive - kit et inventaire', () => {
  it('marque les objets deja possedes et retire leur prix', () => {
    const vide = snapshotAt(T_169H);
    const rempli = snapshotAt(0.7787, ['sac-60', 'doudoune-10']);
    const missingBefore = vide.kit.filter((item) => !item.owned).length;
    const missingAfter = rempli.kit.filter((item) => !item.owned).length;
    expect(missingAfter).toBe(missingBefore - 2);
    const sac = rempli.kit.find((item) => item.id === 'sac-60');
    expect(sac?.owned).toBe(true);
    expect(sac?.priceEur).toBeNull();
  });

  it('baisse le cout du kit manquant quand on possede plus de choses', () => {
    const vide = snapshotAt(T_169H).budget.kitManquantEur;
    const rempli = snapshotAt(0.7787, [
      'sac-60',
      'doudoune-10',
      'tente-4',
      'crampons',
      'filtre-eau',
      'balise-gps',
    ]).budget.kitManquantEur;
    expect(rempli).toBeLessThan(vide);
  });

  it("n'affiche aucun prix pour un objet possede", () => {
    const owned = snapshotAt(0.7787, ['sac-60']);
    const sac = owned.kit.find((item) => item.id === 'sac-60');
    expect(sac?.owned).toBe(true);
    expect(sac?.priceEur).toBeNull();
  });

  it('expose le cout de manquant comme fonction testable', () => {
    const zone = ZONES[3];
    expect(deriveMissingKitEur(zone, 120, 0, 9)).toBe(0);
    expect(deriveMissingKitEur(zone, 120, 2, 9)).toBeGreaterThan(0);
  });
});

describe('derive - traces comme carburant', () => {
  it('marque au moins une trace a ton echelle sur les zones testees', () => {
    // Cible du chantier T3 : >= 1 trace "a ton echelle" sur 3 zones test.
    for (const t of [0.78, 0.55, 0.95]) {
      const snapshot = snapshotAt(t);
      expect(countAtYourScale(snapshot.traces), `t=${t}`).toBeGreaterThanOrEqual(1);
    }
  });

  it('classe les traces par adequation decroissante', () => {
    const { traces } = snapshotAt(0.5);
    for (let index = 1; index < traces.length; index += 1) {
      const previous = traces[index - 1];
      const current = traces[index];
      if (previous.atYourScale === current.atYourScale) {
        expect(previous.scaleMatch).toBeGreaterThanOrEqual(current.scaleMatch);
      }
    }
  });

  it('place les traces a ton echelle en tete', () => {
    const { traces } = snapshotAt(0.78);
    const firstNonMatching = traces.findIndex((trace) => !trace.atYourScale);
    if (firstNonMatching >= 0) {
      expect(traces.slice(firstNonMatching).every((trace) => !trace.atYourScale)).toBe(true);
    }
  });

  it("n'invente aucune trace : le cardinal vient du catalogue", () => {
    expect(snapshotAt(0.5).traces).toHaveLength(DEMO_TRACES.length);
  });
});

describe('derive - formatage', () => {
  it('formate la duree en heures puis en heures + jours', () => {
    expect(describeDuration(2)).toBe('2 h');
    expect(describeDuration(7)).toBe('7 h');
    expect(describeDuration(24)).toBe('24 heures (1,0 jour)');
    // Parite prototype : au-dela de 96 h on arrondit le nombre de jours,
    // le detail a l'heure restant lisible juste avant.
    expect(describeDuration(72)).toBe('72 heures (3,0 jours)');
    expect(describeDuration(169)).toBe('169 heures (7 jours)');
    expect(describeDuration(720)).toBe('720 heures (30 jours)');
  });

  it('estime une distance totale coherente', () => {
    const snapshot = snapshotAt(T_169H);
    const km = totalDistanceKm(snapshot, INTENTION);
    expect(km).toBeGreaterThan(0);
    expect(km).toBeLessThan(2000);
  });
});
