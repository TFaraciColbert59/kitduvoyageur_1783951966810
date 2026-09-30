/**
 * Gate bloquant T2 : « Un plan affiche sans donnee sans source = bug bloquant ».
 *
 * Ce test rend la regle du dossier EXECUTABLE. Le module `provenance.ts`
 * peut etre correct ; si on ne le convoque pas sur chaque instant d'echelle,
 * il ne prouve rien.
 *
 * Il est volontairement plus large qu'un cas nominal : il balaie les 5 zones,
 * puis casse volontairement la provenance pour prouver que le garde la voit.
 * Sans ce second volet, un garde-fou qui ne garde rien passerait aussi bien
 * que le vrai — et c'est le piege classique des tests qui ne testent que le
 * chemin heureux.
 */

import { describe, expect, it } from 'vitest';

import { deriveTrajectoire } from '@/features/trajectoire/domain/derive';
import { analyzeIntention } from '@/features/trajectoire/domain/intention';
import {
  CARD_LOCATIONS,
  SOURCE_LABEL,
  SOURCE_PROVENANCE,
  assertAllResolvable,
  assertSnapshotProvenance,
  cardProvenance,
  collectDisplayedData,
  provenanceFor,
  unresolvedData,
} from '@/features/trajectoire/domain/provenance';
import {
  ZONES,
  tAtZoneMiddle,
  type TrajectoireSourceId,
} from '@/features/trajectoire/domain/scaleAxis';
import { DEMO_TRACES } from '@/features/trajectoire/domain/traces';
import type { DisplayedDatum } from '@/features/trajectoire/domain/provenance';
import type { TrajectoireSnapshot } from '@/features/trajectoire/domain/types';

const INTENTION = analyzeIntention(
  'Partir cinq jours dans les Dolomites, sans voiture, refuges et passages peu exposés'
);

function snapshotFor(zoneId: (typeof ZONES)[number]['id']): TrajectoireSnapshot {
  return deriveTrajectoire({
    t: tAtZoneMiddle(zoneId),
    intention: INTENTION,
    traces: DEMO_TRACES,
  });
}

/** Une donnee dont la provenance est, elle, resoluble. */
function faultyDatum(
  location: string,
  id: string,
  sourceId: TrajectoireSourceId = 'meteo'
): DisplayedDatum {
  return {
    id,
    location,
    sourceId,
    // 'official' sans sourceRef ni observedAt : rien a remonter.
    provenance: { source: 'official' },
  };
}

describe('T2 — provenance des donnees affichees', () => {
  it('ne laisse passer AUCUNE donnee sans source resolvable, sur les 5 zones', () => {
    for (const zone of ZONES) {
      const snapshot = snapshotFor(zone.id);

      expect(
        unresolvedData(snapshot).map((datum) => `${datum.location}/${datum.id}`),
        `zone ${zone.id} : donnee(s) sans provenance resolvable`
      ).toEqual([]);

      expect(() => assertSnapshotProvenance(snapshot)).not.toThrow();
    }
  });

  it('leve des qu UNE donnee est irresoluble (le garde agit vraiment)', () => {
    // Le cas nominal passe : sans cette ligne, `expect().toThrow()` ne
    // prouverait rien, il pourrait passer parce que le garde ne leve jamais.
    expect(() => assertAllResolvable([])).not.toThrow();

    // Une donnee fautive suffit a faire lever.
    expect(() => assertAllResolvable([faultyDatum('window', 'ideal')])).toThrow(/bug bloquant T2/);
  });

  it('nomme CHAQUE donnee fautive, pas seulement la premiere', () => {
    // Deux cartes cassees, deux lignes. Un garde qui s'arreterait a la
    // premiere obligerait a corriger, re-tester, recommencer : exactement le
    // travail que le message doit supprimer.
    expect(() =>
      assertAllResolvable([
        faultyDatum('window', 'ideal'),
        faultyDatum('danger', 'score'),
        faultyDatum('kit', 'sac-60l'),
      ])
    ).toThrow(/window\/ideal/);

    // Le message contient les trois.
    let message = '';
    try {
      assertAllResolvable([
        faultyDatum('window', 'ideal'),
        faultyDatum('danger', 'score'),
        faultyDatum('kit', 'sac-60l'),
      ]);
    } catch (error) {
      message = error instanceof Error ? error.message : String(error);
    }

    expect(message).toContain('3 donnee(s)');
    expect(message).toContain('window/ideal');
    expect(message).toContain('danger/score');
    expect(message).toContain('kit/sac-60l');
    // La source est nommee elle aussi : le correctif se deduit de l'erreur.
    expect(message).toContain('source meteo');
  });

  it('couvre les 8 cartes du dossier', () => {
    const snapshot = snapshotFor('expedition');

    for (const location of CARD_LOCATIONS) {
      const card = cardProvenance(snapshot, location);
      expect(card.sources.length, `carte ${location} sans source`).toBeGreaterThan(0);
      expect(card.resolvable, `carte ${location} non resolvable`).toBe(true);
      expect(SOURCE_LABEL[card.primary]).toBeTruthy();
    }
  });

  it('trace chaque ligne des cartes a contenu variable', () => {
    const snapshot = snapshotFor('expedition');
    const data = collectDisplayedData(snapshot);

    // Le compte n'est pas fige : ajouter une ligne au plan doit pouvoir
    // ajouter une provenance. Ce qui est fige, c'est la COUVERTURE.
    expect(data.length).toBeGreaterThan(CARD_LOCATIONS.length);

    // Une ligne par etape de plan, une par item de kit, une par trace.
    const steps = data.filter((datum) => datum.location === 'plan').length;
    const kit = data.filter((datum) => datum.location === 'kit').length;
    const traces = data.filter((datum) => datum.location === 'traces').length;

    expect(steps).toBe(snapshot.steps.length);
    expect(kit).toBe(snapshot.kit.length);
    expect(traces).toBe(snapshot.traces.length);

    // Les etapes sont affichees par DEUX cartes (recit + liste) : les deux
    // doivent etre couvertes, sinon l'une des deux n'a pas de provenance.
    expect(data.filter((datum) => datum.location === 'steps').length).toBe(snapshot.steps.length);
  });

  it('classe chaque source dans la taxonomie de provenance existante', () => {
    const VALID = ['measured', 'official', 'community', 'computed', 'estimated', 'suggested'];

    for (const sourceId of Object.keys(SOURCE_PROVENANCE) as (keyof typeof SOURCE_PROVENANCE)[]) {
      expect(VALID).toContain(SOURCE_PROVENANCE[sourceId]);
    }

    // Une trace vecue est une mesure. Une trace de la tribu est un temoignage.
    // Un prix publie est une source officielle. Ce sont les trois seules
    // distinctions qui portent du sens ici.
    expect(SOURCE_PROVENANCE.traces_perso).toBe('measured');
    expect(SOURCE_PROVENANCE.traces_tribu).toBe('community');
    expect(SOURCE_PROVENANCE.routestack).toBe('official');
  });

  it('ne fabrique aucune horloge : pas d observedAt sans source reelle', () => {
    const provenance = provenanceFor('meteo');

    // Sans contexte d'observation, aucune date. Une date synthetique qui
    // « a l'air d'etre une observation » est le piege que la regle ferme.
    expect(provenance.observedAt).toBeUndefined();
    // Mais elle reste resolvable : la source, elle, est nommee.
    expect(provenance.sourceRef).toBeTruthy();
  });

  it('accepte une observation reelle fournie par l appelant', () => {
    const observedAt = '2026-09-30T08:00:00.000Z';
    const provenance = provenanceFor('meteo', { observedAt: { meteo: observedAt } });

    expect(provenance.observedAt).toBe(observedAt);
    expect(provenance.source).toBe('official');
  });
});
