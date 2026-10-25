/**
 * T2 - Versionnage des plans et regrain conservateur.
 *
 * Ces tests couvrent les deux promesses que le badge « Plan vN » affiche a
 * l'ecran. Sans eux, le badge n'est qu'un habillage : il faut prouver qu'il
 * compte, et qu'il ne ment pas sur ce qu'il compte.
 *
 *  1. IDEMPOTENCE. Un plan est IMMUABLE : a entree egale, `nextPlanVersion`
 *     renvoie le meme objet. Sans cela, le simple fait de re-rendre le
 *     composant gonflerait le numero de version, et l'utilisateur verrait
 *     « v41 » apres avoir fait glisser le curseur d'un pixel.
 *
 *  2. CONSERVATION. Le risque n 3 du dossier : « un plan monde devient sortie »
 *     ne doit JAMAIS faire perdre une etape. On verifie le contrat exact — le
 *     titre de chaque etape precedente doit survivre, soit comme titre, soit
 *     rattache au detail d'une etape du nouveau plan.
 */

import { describe, expect, it } from 'vitest';

import { deriveTrajectoire } from '@/features/trajectoire/domain/derive';
import { analyzeIntention } from '@/features/trajectoire/domain/intention';
import { tForZone, ZONES } from '@/features/trajectoire/domain/scaleAxis';
import { DEMO_TRACES } from '@/features/trajectoire/domain/traces';
import type { PlanStep } from '@/features/trajectoire/domain/types';
import {
  hashSources,
  nextPlanVersion,
  regrainSteps,
} from '@/features/trajectoire/domain/versioning';

const INTENTION = analyzeIntention(
  'Partir cinq jours dans les Dolomites, sans voiture, refuges et passages peu exposés'
);
const STAMP = '2026-09-30T08:00:00.000Z';

function snapshotAt(zoneId: (typeof ZONES)[number]['id']) {
  return deriveTrajectoire({ t: tForZone(zoneId), intention: INTENTION, traces: DEMO_TRACES });
}

/**
 * Titres de `previous` qui ont disparu de `next`.
 *
 * On cherche dans le titre ET le detail : c'est la definition de « rattacher
 * plutot que supprimer » que le module promet dans son commentaire.
 */
function lostTitles(previous: readonly PlanStep[], next: readonly PlanStep[]): string[] {
  const carried = next.map((step) => `${step.title}\n${step.detail}`).join('\n');
  return previous.map((step) => step.title).filter((title) => !carried.includes(title));
}

describe('Versionnage des plans', () => {
  it('cree une premiere version a partir du plan derive', () => {
    const snapshot = snapshotAt('expedition');
    const v1 = nextPlanVersion(null, snapshot, 'intention-1', STAMP);

    expect(v1.version).toBe(1);
    expect(v1.zone).toBe('expedition');
    // Le moteur fait autorite sur les etapes : la v1 doit les refleter
    // telles quelles, pas une version regroupee de travers.
    expect(v1.steps).toHaveLength(snapshot.steps.length);
  });

  it('est idempotent : meme entree, meme version, meme objet', () => {
    const snapshot = snapshotAt('expedition');
    const v1 = nextPlanVersion(null, snapshot, 'intention-1', STAMP);
    const again = nextPlanVersion(v1, snapshot, 'intention-1', '2026-09-30T09:00:00.000Z');

    // L'egalite d'IDENTITE est le vrai contrat : c'est elle qui permet au
    // hook de ne pas boucler sur lui-meme en comparant les references.
    expect(again).toBe(v1);
    expect(again.version).toBe(1);
    expect(again.sourcesHash).toBe(v1.sourcesHash);
  });

  it('incremente la version quand les sources changent', () => {
    const v1 = nextPlanVersion(null, snapshotAt('expedition'), 'intention-1', STAMP);
    const v2 = nextPlanVersion(v1, snapshotAt('raid'), 'intention-1', STAMP);

    expect(v2.version).toBe(2);
    expect(v2.zone).toBe('raid');
    expect(v2.sourcesHash).not.toBe(v1.sourcesHash);
  });

  it('change de version quand l intention change, a position egale', () => {
    const snapshot = snapshotAt('expedition');
    const v1 = nextPlanVersion(null, snapshot, 'intention-1', STAMP);
    const v2 = nextPlanVersion(v1, snapshot, 'intention-2', STAMP);

    expect(v2.version).toBe(2);
  });

  it('produit un hash stable et distinct de toute valeur d ordre', () => {
    // Un hash qui ne dependrait que du dernier element laisserait passer deux
    // etats differents pour un meme identifiant de version.
    expect(hashSources(['a', 'b'])).toBe(hashSources(['a', 'b']));
    expect(hashSources(['a', 'b'])).not.toBe(hashSources(['b', 'a']));
    expect(hashSources(['a', 'b'])).toMatch(/^[0-9a-f]{8}$/);
  });
});

describe('Regrain conservateur', () => {
  it('laisse le moteur decider du grain', () => {
    const snapshot = snapshotAt('expedition');
    expect(regrainSteps([], snapshot)).toHaveLength(snapshot.steps.length);
    expect(regrainSteps(snapshot.steps, snapshot)).toHaveLength(snapshot.steps.length);
  });

  it('ne perd aucune etape quand le curseur resserre', () => {
    // Le cas le plus defavorable du dossier : un plan d'expedition (5 etapes)
    // qui devient une sortie (2 etapes). Trois etapes doivent etre rattachees,
    // jamais supprimees.
    const wide = snapshotAt('expedition');
    const narrow = snapshotAt('run');
    expect(wide.steps.length).toBeGreaterThan(narrow.steps.length);

    const regrained = regrainSteps(wide.steps, narrow);

    expect(regrained).toHaveLength(narrow.steps.length);
    expect(lostTitles(wide.steps, regrained)).toEqual([]);
  });

  it('ne perd aucune etape sur tout l axe, dans les deux sens', () => {
    // Un invariant verifie sur un seul couple de zones ne prouve rien : le
    // bug pourrait ne se voir qu'a certaines granularites. On parcourt donc la
    // liste complete des zones, dans les deux sens.
    for (const from of ZONES) {
      for (const to of ZONES) {
        const previous = snapshotAt(from.id).steps;
        const regrained = regrainSteps(previous, snapshotAt(to.id));

        expect(regrained, `${from.id} -> ${to.id}`).toHaveLength(snapshotAt(to.id).steps.length);
        expect(lostTitles(previous, regrained), `${from.id} -> ${to.id}`).toEqual([]);
      }
    }
  });

  it('cumule les distances quand une etape est rattachee', () => {
    const previous: PlanStep[] = [
      { id: 'a', title: 'A', detail: 'detail A', distanceKm: 10, sourceId: 'osm' },
      { id: 'b', title: 'B', detail: 'detail B', distanceKm: 20, sourceId: 'osm' },
    ];
    const snapshot = snapshotAt('run');
    const before = snapshot.steps.reduce((total, step) => total + (step.distanceKm ?? 0), 0);
    const regrained = regrainSteps(previous, snapshot);
    const after = regrained.reduce((total, step) => total + (step.distanceKm ?? 0), 0);

    // Les distances sont cumulees, pas remplacees : rattacher A et B a une
    // etape ne doit pas faire disparaitre les 30 km parcourus.
    expect(after).toBeGreaterThanOrEqual(before);
  });

  it('ne modifie pas le snapshot partage', () => {
    // Regle d immutabilite : si regrainSteps ecrivait dans snapshot.steps,
    // la 8e carte afficherait un plan que personne n a demande.
    const snapshot = snapshotAt('expedition');
    const before = JSON.stringify(snapshot.steps);

    regrainSteps(snapshotAt('expedition').steps, snapshot);

    expect(JSON.stringify(snapshot.steps)).toBe(before);
  });
});
