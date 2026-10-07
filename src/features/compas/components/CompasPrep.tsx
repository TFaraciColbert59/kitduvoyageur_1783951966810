'use client';

import Icon from '@/components/ui/Icon';

export type PrepStage = 'understand' | 'itinerary' | 'rest' | 'done' | 'error' | 'stopped';

export interface PrepState {
  stage: PrepStage;
  /** Étape où l'erreur ou l'arrêt est survenu (pour cocher ce qui est fait). */
  at?: Exclude<PrepStage, 'done' | 'error' | 'stopped'>;
  message?: string;
  total?: string | null;
  digest?: string | null;
}

const STEPS: Array<{ id: 'understand' | 'itinerary' | 'rest' | 'done'; label: string; sub: string }> = [
  { id: 'understand', label: 'Comprendre ta demande', sub: 'Lieu, durée, groupe, envies' },
  { id: 'itinerary', label: 'Tracer l’itinéraire', sub: 'Lieux réels de la carte, distances mesurées' },
  { id: 'rest', label: 'Nuits, trajet, kit et budget', sub: 'Barèmes du Compas, rien d’inventé' },
  { id: 'done', label: 'Synthèse', sub: 'Tout se retouche ensuite, étape par étape' },
];
const ORDER = ['understand', 'itinerary', 'rest', 'done'] as const;

/**
 * Chargement visible de la préparation : chaque étape se coche avec son
 * résultat. La carte se dessine derrière dès que l'itinéraire est écrit.
 * « Arrêter » garde ce qui est déjà fait ; la reprise est automatique.
 */
export function CompasPrep({
  prep,
  onStop,
  onClose,
  onRetry,
  onEditRequest,
}: {
  prep: PrepState;
  onStop: () => void;
  onClose: () => void;
  onRetry: () => void;
  onEditRequest: () => void;
}) {
  const live = prep.stage === 'done' || prep.stage === 'error' || prep.stage === 'stopped' ? (prep.at ?? 'done') : prep.stage;
  const current = ORDER.indexOf(prep.stage === 'done' ? 'done' : live);
  const finished = prep.stage === 'done';
  const failed = prep.stage === 'error';
  const stopped = prep.stage === 'stopped';

  return (
    <section className="cp-prep cp-sheet-glass" role="status" aria-live="polite" aria-label="Préparation de l’aventure">
      <h2 className="cp-t2">
        {finished ? 'Ton aventure est prête' : failed ? 'Préparation interrompue' : stopped ? 'Préparation arrêtée' : 'Je prépare ton aventure…'}
      </h2>
      <ol className="cp-prep__steps">
        {STEPS.map((s, i) => {
          const state = finished || i < current ? 'done' : i === current && !failed && !stopped ? 'run' : i === current ? 'halt' : 'todo';
          return (
            <li key={s.id} className="cp-prep__step" data-state={state}>
              <span className="cp-prep__dot" aria-hidden="true">
                {state === 'done' ? <Icon name="check" size={14} /> : state === 'run' ? <span className="cp-prep__spin" /> : null}
              </span>
              <span className="cp-prep__t">
                <b>{s.label}</b>
                <span>
                  {s.id === 'done' && finished
                    ? [prep.total, prep.digest].filter(Boolean).join(' · ') || s.sub
                    : s.sub}
                </span>
              </span>
              <span className="sr-only">
                {state === 'done' ? 'fait' : state === 'run' ? 'en cours' : state === 'halt' ? 'interrompu' : 'à venir'}
              </span>
            </li>
          );
        })}
      </ol>
      {(failed || stopped) && prep.message && (
        <p className="cp-note" role={failed ? 'alert' : undefined}>
          {prep.message}
        </p>
      )}
      <div className="cp-actions">
        {finished && (
          <button type="button" className="cp-btn cp-btn--pg cp-btn--block" onClick={onClose}>
            <Icon name="check" size={16} />
            Voir mon aventure
          </button>
        )}
        {(failed || stopped) && (
          <>
            <button type="button" className="cp-btn cp-btn--soft" onClick={onEditRequest}>
              Préciser ma demande
            </button>
            <button type="button" className="cp-btn cp-btn--pg cp-btn--block" onClick={onRetry}>
              Reprendre
            </button>
          </>
        )}
        {!finished && !failed && !stopped && (
          <button type="button" className="cp-btn cp-btn--soft cp-btn--block" onClick={onStop}>
            Arrêter
          </button>
        )}
      </div>
    </section>
  );
}
