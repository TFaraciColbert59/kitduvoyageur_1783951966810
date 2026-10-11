/**
 * Plan 2.6 : une préparation en une passe coupée après l'itinéraire (limite de
 * la fonction, réseau) ne laisse plus d'étapes orphelines.
 */
import { describe, expect, it } from 'vitest';
import {
  CLAIM_MS,
  CLOCK_SKEW_MS,
  claimIsLive,
  pendingIsLive,
  pendingIsStale,
  readPending,
  resumableRun,
  withoutClaim,
  withoutPending,
  withStepsWritten,
} from '../server/autofillState';

const T0 = 1_791_500_000_000;
const written = { runId: 'run-1', stepIds: ['s1', 's2', 's3'], routeSet: false, notes: ['Itinéraire en boucle.'], datesSet: true, stagesFallback: 0 };

describe('itinéraire écrit, inscrit tout de suite', () => {
  it('garde le reste des métadonnées et la prise des étapes ; inscrit l’attente et prend le reste', () => {
    const meta = { route_id: 7, compas: { planned_days: 3, autofill_claim: { steps: T0 - 5_000 } } };
    const next = withStepsWritten(meta, written, T0);
    expect(next.route_id).toBe(7);
    expect(next.compas).toMatchObject({
      planned_days: 3,
      autofill_claim: { steps: T0 - 5_000, rest: T0 },
      autofill_pending: { ...written, restAt: T0 },
    });
    expect(readPending(next)).toEqual({ ...written, restAt: T0 });
  });
});

describe('coupure simulée après l’itinéraire (passe unique)', () => {
  // La fonction s'arrête : aucune trace finale n'est écrite, l'attente reste.
  const afterCut = withStepsWritten({ compas: { planned_days: 3 } }, written, T0);

  it('« Annuler » retrouve toutes les étapes écrites', () => {
    expect(readPending(afterCut)?.stepIds).toEqual(['s1', 's2', 's3']);
  });

  it('une relance en une passe reprend cet itinéraire au lieu d’en écrire un second', () => {
    const pending = readPending(afterCut);
    expect(resumableRun('all', pending)).toEqual(pending);
    expect(resumableRun('rest', pending)).toEqual(pending);
    // Une phase « étapes » ne reprend rien : elle s'arrête sur l'itinéraire en attente.
    expect(resumableRun('steps', pending)).toBeNull();
  });

  it('pendant la préparation, la prise du reste fait attendre une relance ; après la coupure, elle expire', () => {
    const claims = (afterCut.compas as { autofill_claim: Record<string, number> }).autofill_claim;
    expect(T0 + 60_000 - claims.rest < CLAIM_MS).toBe(true);
    expect(T0 + CLAIM_MS - claims.rest < CLAIM_MS).toBe(false);
  });

  it('une attente que plus rien ne fait avancer est dite coupée, pas « en cours »', () => {
    const pending = readPending(afterCut)!;
    expect(pendingIsStale(pending, T0 + 30_000)).toBe(false);
    expect(pendingIsStale(pending, T0 + CLAIM_MS)).toBe(true);
    // Phase « étapes » d'un ancien écran : pas d'heure de reprise, jamais dite coupée.
    expect(pendingIsStale({ ...pending, restAt: undefined }, T0 + 10 * CLAIM_MS)).toBe(false);
  });

  it('la trace finale efface l’attente et les prises', () => {
    const c = withoutClaim(withoutPending(afterCut.compas as Record<string, unknown>));
    expect(c).toEqual({ planned_days: 3 });
  });
});

describe('lecture de l’attente', () => {
  it('rien, ou une attente sans identifiant : null', () => {
    expect(readPending({})).toBeNull();
    expect(readPending({ compas: { autofill_pending: { stepIds: ['s1'] } } })).toBeNull();
  });

  it('ne garde que des identifiants de texte', () => {
    expect(readPending({ compas: { autofill_pending: { runId: 'r', stepIds: ['s1', 2, null] } } })?.stepIds).toEqual(['s1']);
  });
});

describe('une heure dans le futur ne tient pas une préparation', () => {
  const pending = { runId: 'r', stepIds: ['s1'], routeSet: false, notes: [] };

  it('une prise : vivante de maintenant à CLAIM_MS, morte avant 60 s d’avance, au-delà, ou sans heure', () => {
    expect(claimIsLive(T0, T0)).toBe(true);
    expect(claimIsLive(T0 - CLAIM_MS + 1, T0)).toBe(true);
    expect(claimIsLive(T0 - CLAIM_MS, T0)).toBe(false);
    // Horloges de deux fonctions qui divergent de quelques secondes : encore une prise.
    expect(claimIsLive(T0 + CLOCK_SKEW_MS, T0)).toBe(true);
    expect(claimIsLive(T0 + CLOCK_SKEW_MS + 1, T0)).toBe(false);
    expect(claimIsLive(9e15, T0)).toBe(false);
    expect(claimIsLive('9e15', T0)).toBe(false);
    expect(claimIsLive(undefined, T0)).toBe(false);
    expect(claimIsLive(Number.NaN, T0)).toBe(false);
  });

  it('un restAt daté du futur est une attente coupée, jamais « en cours »', () => {
    expect(pendingIsStale({ ...pending, restAt: T0 + CLOCK_SKEW_MS }, T0)).toBe(false);
    expect(pendingIsStale({ ...pending, restAt: T0 + CLOCK_SKEW_MS + 1 }, T0)).toBe(true);
    expect(pendingIsStale({ ...pending, restAt: 9e15 }, T0)).toBe(true);
  });

  it('l’attaque : restAt et prises à 9e15 ne rendent pas la préparation vivante', () => {
    const forged = {
      compas: { autofill_pending: { ...pending, restAt: 9e15 }, autofill_claim: { steps: 9e15, rest: 9e15 } },
    };
    expect(pendingIsLive(forged, T0)).toBe(false);
    // Une vraie prise fraîche, elle, tient toujours l'attente.
    const real = { compas: { autofill_pending: { ...pending, restAt: 9e15 }, autofill_claim: { rest: T0 - 1_000 } } };
    expect(pendingIsLive(real, T0)).toBe(true);
    // Et une vraie reprise en main aussi.
    expect(pendingIsLive({ compas: { autofill_pending: { ...pending, restAt: T0 - 1_000 } } }, T0)).toBe(true);
  });
});
