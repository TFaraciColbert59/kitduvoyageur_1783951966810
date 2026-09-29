import type { AIProvider, AIRequest } from './types';

export interface RaceFailure {
  provider: string;
  raison: string;
}

export interface RaceResult {
  /** Le provider qui a repondu, ou `null` si aucun n a repondu. */
  provider: AIProvider | null;
  text: string | null;
  echecs: RaceFailure[];
  /** L appelant a abandonne : ce n est pas un echec de provider. */
  abandonne: boolean;
  /** Combien de candidats ont ete lances. Un harness de test s en sert pour
   *  verifier qu un candidat lent n a pas attendu son delai avant de cede la
   *  place. */
  lances: number;
}

export interface RaceOptions {
  /** Attente avant de lancer le suivant alors que le premier n a pas repondu. */
  hedgeMs: number;
  /** Injectable pour figer le temps dans les tests. Par defaut `setTimeout`. */
  minuterie?: (fn: () => void, ms: number) => { annuler: () => void };
}

function raison(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

/**
 * Course entre providers, avec parapluie.
 *
 * Le tout sequentiel avait un cout mesure : le 2026-09-29, sur un parcours reel,
 * NVIDIA a repondu en 4,6 s — mais sur un autre parcours il a renvoye un 503 en
 * 200 ms, OpenRouter a alors consomme son delai entier de 45 s, et l ensemble a
 * produit 70 s d ecran fige avant de reussir. Sur un itinerarie, 70 s n est pas
 * une latence acceptable : c est un abandon.
 *
 * La parade n est pas de raccourcir les delais — un provider lent n est pas un
 * provider mort, et le couper trop tot revient a choisir le premier au hasard.
 * La parade est de NE PAS ATTENDRE qu un candidat lent soit defini mort avant
 * d envoyer le suivant. Le parapluie demarre apres `hedgeMs` : assez tard pour
 * que le contact direct garde la main quand il est vivant, assez tot pour que
 * la panne ne coute pas son delai.
 *
 * Un candidat qui echoue NET (503, cle refusee) ne declenche aucune attente :
 * on passe au suivant immediatement, parce qu on sait deja qu il est mort.
 *
 * Le premier succes gagne et annule les autres : `signal` est porte jusqu aux
 * sockets, donc aucun jet de tokens n est paye pour une reponse jetee.
 */
export function raceProviders(
  candidats: AIProvider[],
  req: AIRequest,
  options: RaceOptions
): Promise<RaceResult> {
  const minuterie =
    options.minuterie ??
    ((fn: () => void, ms: number) => {
      const handle = setTimeout(fn, ms);
      return { annuler: () => clearTimeout(handle) };
    });
  const echecs: RaceFailure[] = [];
  const enCours = new Map<string, AbortController>();
  const minuteries = new Set<{ annuler: () => void }>();
  let resolu = false;
  let abandonne = false;
  let lances = 0;
  let suivant = 0;
  let resolut!: (r: RaceResult) => void;
  const promesse = new Promise<RaceResult>((res) => {
    resolut = res;
  });

  const nettoyer = () => {
    for (const m of minuteries) m.annuler();
    minuteries.clear();
  };

  const finir = (r: Omit<RaceResult, 'lances'>) => {
    if (resolu) return;
    resolu = true;
    nettoyer();
    // Les perdants sont annules : on ne paie pas un jet de tokens jete.
    for (const ctrl of enCours.values()) ctrl.abort();
    enCours.clear();
    resolut({ ...r, lances });
  };

  const lancerSuivant = () => {
    if (resolu) return;
    if (suivant >= candidats.length) {
      // Plus personne en vol : verdict « personne n a repondu ».
      if (enCours.size === 0) {
        finir({ provider: null, text: null, echecs, abandonne });
      }
      return;
    }

    const provider = candidats[suivant++];
    lances += 1;

    const ctrl = new AbortController();
    enCours.set(provider.name, ctrl);
    const surAbandon = () => ctrl.abort();
    req.signal?.addEventListener('abort', surAbandon, { once: true });

    // Parapluie : si ce candidat tient encore `hedgeMs` sans repondre, on ne
    // lui laisse pas la totalite du delai.
    const parapluie = minuterie(() => {
      if (enCours.has(provider.name) && !resolu) lancerSuivant();
    }, options.hedgeMs);
    minuteries.add(parapluie);

    const tentative = { provider, ctrl, parapluie, surAbandon };
    provider
      .complete({ ...req, signal: ctrl.signal })
      .then((text) => {
        req.signal?.removeEventListener('abort', tentative.surAbandon);
        minuteries.delete(tentative.parapluie);
        tentative.parapluie.annuler();
        if (resolu) return;
        enCours.delete(provider.name);
        finir({ provider, text, echecs, abandonne });
      })
      .catch((err: unknown) => {
        req.signal?.removeEventListener('abort', tentative.surAbandon);
        minuteries.delete(tentative.parapluie);
        tentative.parapluie.annuler();
        if (resolu) return;
        enCours.delete(provider.name);
        echecs.push({ provider: provider.name, raison: raison(err) });
        if (abandonne) {
          finir({ provider: null, text: null, echecs, abandonne });
          return;
        }
        // Echec NET : pas d attente, on passe la main tout de suite.
        lancerSuivant();
      });
  };

  if (req.signal?.aborted) {
    abandonne = true;
    finir({ provider: null, text: null, echecs, abandonne });
    return promesse;
  }

  req.signal?.addEventListener(
    'abort',
    () => {
      if (resolu) return;
      abandonne = true;
      finir({ provider: null, text: null, echecs, abandonne });
    },
    { once: true }
  );

  lancerSuivant();
  return promesse;
}

/** Duree d'attente avant parapluie, par tier. */
export const HEDGE_MS = { fast: 6_000, heavy: 12_000 } as const;
