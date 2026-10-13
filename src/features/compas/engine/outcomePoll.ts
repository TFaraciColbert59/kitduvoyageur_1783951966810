/**
 * Suivi économe d'une préparation lancée en arrière-plan (plan 100, 1.2
 * « Coût de calcul » et 2.8).
 *
 * L'écran n'attend plus l'issue par une relecture fixe toutes les 4 s, ni par
 * un rendu complet de la page. Ce suivi :
 *
 * - allonge l'intervalle (3 s, 4 s, 5 s, 7 s, puis 10 s) : une préparation
 *   longue (jusqu'à 300 s) coûte une trentaine de relectures au lieu de 75 ;
 * - ne lit rien quand l'onglet est caché ou le réseau absent, et relit tout de
 *   suite à la reprise (le rythme repart du début) ;
 * - s'arrête dès que l'issue est connue (ou que « Arrêter » est pressé) et ne
 *   laisse ni minuterie ni écouteur derrière lui ;
 * - n'a jamais deux requêtes en vol : la boucle attend chaque réponse ;
 * - garde le délai maximal en heure réelle : après une longue absence, une
 *   dernière relecture reprend l'issue si le serveur l'a écrite entre-temps.
 *
 * Pur : l'onglet et le réseau passent par `PollEnvironment` (injectable).
 */

/** Pause entre deux relectures, de la plus vive à la plus lente (la dernière se répète). */
export const OUTCOME_POLL_DELAYS_MS = [3_000, 4_000, 5_000, 7_000, 10_000] as const;

export interface PollReading<T> {
  /** L'issue de la préparation, ou `null` tant qu'elle tourne. */
  outcome: T | null;
  /** Repère du voyage : change quand des étapes, le tracé ou l'issue sont écrits. */
  stamp: string | null;
}

/** L'onglet et le réseau, vus du suivi. */
export interface PollEnvironment {
  /** Onglet visible et réseau présent : on peut interroger le serveur. */
  canPoll(): boolean;
  /** Appelle `cb` quand on peut de nouveau interroger. Rend la désinscription. */
  onResume(cb: () => void): () => void;
}

export type OutcomeResult<T> =
  { kind: 'outcome'; outcome: T } | { kind: 'stopped' } | { kind: 'timeout' };

export interface WaitForOutcomeOptions<T> {
  /** Une relecture ; `null` ou un rejet = réseau coupé, on réessaie plus tard. */
  poll: () => Promise<PollReading<T> | null>;
  /** Appelé à chaque nouveau repère du voyage (jamais deux fois le même de suite). */
  onStamp?: (stamp: string) => void;
  /** Délai maximal en heure réelle depuis le début. */
  maxMs: number;
  /** « Arrêter » : réveille toute attente. */
  signal?: AbortSignal;
  isStopped?: () => boolean;
  env?: PollEnvironment;
  delaysMs?: readonly number[];
}

/** Environnement du navigateur : `visibilitychange` et `online`. */
export function browserPollEnvironment(): PollEnvironment {
  const hidden = () => typeof document !== 'undefined' && document?.visibilityState === 'hidden';
  const offline = () => typeof navigator !== 'undefined' && navigator?.onLine === false;
  const canPoll = () => !hidden() && !offline();
  return {
    canPoll,
    onResume(cb) {
      if (typeof document === 'undefined' || typeof window === 'undefined' || !document || !window)
        return () => {};
      const resume = () => {
        if (canPoll()) cb();
      };
      document.addEventListener('visibilitychange', resume);
      window.addEventListener('online', resume);
      return () => {
        document.removeEventListener('visibilitychange', resume);
        window.removeEventListener('online', resume);
      };
    },
  };
}

/** Attend `ms`, ou la fin de l'attente si le signal tombe. Ne laisse aucune minuterie. */
function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    if (signal?.aborted) return resolve();
    const done = () => {
      clearTimeout(timer);
      signal?.removeEventListener('abort', done);
      resolve();
    };
    const timer = setTimeout(done, ms);
    signal?.addEventListener('abort', done, { once: true });
  });
}

/** Attend le retour de l'onglet et du réseau, ou le signal d'arrêt. */
function untilResumed(env: PollEnvironment, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    if (signal?.aborted || env.canPoll()) return resolve();
    let off: () => void = () => {};
    const finish = () => {
      off();
      signal?.removeEventListener('abort', finish);
      resolve();
    };
    off = env.onResume(finish);
    signal?.addEventListener('abort', finish, { once: true });
    // Reprise survenue entre la vérification et l'inscription.
    if (env.canPoll()) finish();
  });
}

export async function waitForOutcome<T>(
  options: WaitForOutcomeOptions<T>
): Promise<OutcomeResult<T>> {
  const env = options.env ?? browserPollEnvironment();
  const delays =
    options.delaysMs && options.delaysMs.length > 0 ? options.delaysMs : OUTCOME_POLL_DELAYS_MS;
  const stopped = () => options.signal?.aborted === true || options.isStopped?.() === true;
  const startedAt = Date.now();
  let seen: string | null = null;
  let step = 0;

  for (;;) {
    if (stopped()) return { kind: 'stopped' };

    if (!env.canPoll()) {
      await untilResumed(env, options.signal);
      if (stopped()) return { kind: 'stopped' };
      // De retour devant l'écran : on relit tout de suite et le rythme repart du début.
      step = 0;
    }

    // Une seule requête en vol : on attend sa réponse avant toute autre.
    const reading = await options.poll().catch(() => null);

    if (reading?.outcome != null) return { kind: 'outcome', outcome: reading.outcome };
    if (stopped()) return { kind: 'stopped' };
    if (reading?.stamp && reading.stamp !== seen) {
      seen = reading.stamp;
      options.onStamp?.(reading.stamp);
    }
    if (Date.now() - startedAt >= options.maxMs) return { kind: 'timeout' };

    await sleep(delays[Math.min(step, delays.length - 1)], options.signal);
    step += 1;
  }
}
