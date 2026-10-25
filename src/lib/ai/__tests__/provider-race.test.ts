import { describe, it, expect, vi } from 'vitest';
import { raceProviders, HEDGE_MS, type RaceResult } from '../providers/providerRace';
import type { AIProvider, AIRequest } from '../providers/types';

function req(signal?: AbortSignal): AIRequest {
  return {
    feature: 'itinerary',
    tier: 'fast',
    system: 'sys',
    prompt: 'q',
    maxTokens: 512,
    ...(signal ? { signal } : {}),
  };
}

/** Minuterie manuelle : rien ne se déclenche tant qu on ne la fait pas tourner. */
function minuterieManuelle() {
  const enAttente: { fn: () => void; annulee: boolean }[] = [];
  return {
    minuterie: (fn: () => void) => {
      const t = { fn, annulee: false };
      enAttente.push(t);
      return { annuler: () => { t.annulee = true; } };
    },
    /** Declenche le parapluie le plus ancien encore vivant. */
    parapluieSuivant() {
      const t = enAttente.find((x) => !x.annulee);
      if (!t) return false;
      t.fn();
      return true;
    },
    enAttente,
  };
}

/** Une doublure qui compte ses appels et se souvient d avoir ete annulee. */
interface Doublure extends AIProvider {
  appeles: number;
  annulee: boolean;
}

function provider(
  name: string,
  comportement: (r: AIRequest) => Promise<string>
): Doublure {
  const doublure: Doublure = {
    name,
    isAvailable: () => true,
    appeles: 0,
    annulee: false,
    complete: (r: AIRequest) => {
      doublure.appeles += 1;
      r.signal?.addEventListener('abort', () => {
        doublure.annulee = true;
      });
      return comportement(r);
    },
  };
  return doublure;
}

const echec = (msg: string) => () => Promise.reject(new Error(msg));

describe('providerRace — la course avec parapluie', () => {
  it('AI-RACE-01: le premier qui repond gagne, sans lancer les autres', async () => {
    const { minuterie, parapluieSuivant } = minuterieManuelle();
    const rapide = provider('rapide', () => Promise.resolve('reponse'));
    const jamais = provider('jamais', () => new Promise<string>(() => {}));

    const course: RaceResult = await raceProviders([rapide, jamais], req(), {
      hedgeMs: 6000,
      minuterie,
    });

    expect(course.provider?.name).toBe('rapide');
    expect(course.text).toBe('reponse');
    expect(course.lances).toBe(1);
    // Le parapluie n a jamais eu lieu de tirer : le contact direct garde la main.
    expect(parapluieSuivant()).toBe(false);
  });

  it('AI-RACE-02: un candidat lent ne bloque pas — le parapluie passe la main', async () => {
    const { minuterie, parapluieSuivant } = minuterieManuelle();
    const lent = provider('lent', () => new Promise<string>(() => {}));
    const relais = provider('relais', () => Promise.resolve('reponse du relais'));

    const promesse = raceProviders([lent, relais], req(), { hedgeMs: 6000, minuterie });
    // Le premier candidat tient sans repondre : on declenche son parapluie.
    expect(parapluieSuivant()).toBe(true);
    const course = await promesse;

    expect(course.provider?.name).toBe('relais');
    expect(course.lances).toBe(2);
  });

  it('AI-RACE-03: un echec net passe la main SANS attendre le parapluie', async () => {
    const { minuterie, parapluieSuivant } = minuterieManuelle();
    const casse = provider('casse', echec('NVIDIA NIM HTTP 503'));
    const relais = provider('relais', () => Promise.resolve('reponse du relais'));

    const course = await raceProviders([casse, relais], req(), {
      hedgeMs: 6000,
      minuterie,
    });

    expect(course.provider?.name).toBe('relais');
    expect(course.echecs).toEqual([{ provider: 'casse', raison: 'NVIDIA NIM HTTP 503' }]);
    // Aucune attente : le parapluie du candidat casse n a pas ete necessaire.
    expect(parapluieSuivant()).toBe(false);
  });

  it('AI-RACE-04: le perdant est ANNULE — aucun jet de tokens paye pour rien', async () => {
    const { minuterie, parapluieSuivant } = minuterieManuelle();
    const lent = provider('lent', () => new Promise<string>(() => {}));
    const relais = provider('relais', () => Promise.resolve('victoire'));

    const promesse = raceProviders([lent, relais], req(), { hedgeMs: 6000, minuterie });
    parapluieSuivant();
    const course = await promesse;

    expect(course.provider?.name).toBe('relais');
    // Le perdant a ete coupe, pas simplement ignore.
    expect(lent.annulee).toBe(true);
  });

  it('AI-RACE-05: tout le monde echoue → aucun gagnant, echecs dans l ordre', async () => {
    const { minuterie } = minuterieManuelle();
    const a = provider('a', echec('panne a'));
    const b = provider('b', echec('delai depasse'));

    const course = await raceProviders([a, b], req(), { hedgeMs: 6000, minuterie });

    expect(course.provider).toBeNull();
    expect(course.text).toBeNull();
    expect(course.abandonne).toBe(false);
    expect(course.echecs.map((e) => e.provider)).toEqual(['a', 'b']);
  });

  it('AI-RACE-06: l abandon de l appelant interrompt la course et se distingue d une panne', async () => {
    const { minuterie } = minuterieManuelle();
    const ctrl = new AbortController();
    const lent = provider('lent', () => new Promise<string>(() => {}));

    const promesse = raceProviders([lent], req(ctrl.signal), { hedgeMs: 6000, minuterie });
    ctrl.abort();
    const course = await promesse;

    expect(course.abandonne).toBe(true);
    expect(course.provider).toBeNull();
    // Un abandon n est pas une panne de provider : la liste reste vide.
    expect(course.echecs).toEqual([]);
  });

  it('AI-RACE-07: un signal deja abandonne ne lance rien du tout', async () => {
    const { minuterie } = minuterieManuelle();
    const ctrl = new AbortController();
    ctrl.abort();
    const p = provider('p', () => Promise.resolve('trop tard'));

    const course = await raceProviders([p], req(ctrl.signal), { hedgeMs: 6000, minuterie });

    expect(course.abandonne).toBe(true);
    expect(course.lances).toBe(0);
    expect(p.appeles).toBe(0);
  });

  it('AI-RACE-08: le parapluie est plus long sur heavy que sur fast', () => {
    // Erreur d impatience sur heavy = un raisonnement long coupe prematurely,
    // donc un parcours incomplet. Le parapluie doit laisser plus de place.
    expect(HEDGE_MS.heavy).toBeGreaterThan(HEDGE_MS.fast);
  });
});
