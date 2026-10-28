'use client';
import { useTranslation } from '@/lib/i18n/context';
import type { TranslationKey } from '@/lib/i18n/translate';
import { AiNotice } from './AiNotice';
import { LKDVIcon } from '@/components/ui/LKDVIcon';

export type PrepStage = 'understand' | 'itinerary' | 'rest' | 'done' | 'error' | 'stopped';

export interface PrepState {
  stage: PrepStage;
  /** Étape où l'erreur ou l'arrêt est survenu (pour cocher ce qui est fait). */
  at?: Exclude<PrepStage, 'done' | 'error' | 'stopped'>;
  message?: string;
  total?: string | null;
  digest?: string | null;
  /** L'IA a produit quelque chose dans cette préparation (conseils, étapes) : la mention reste. */
  usedAi?: boolean;
}

// Clés du dictionnaire (`compas.prep.*`), lues au rendu dans la locale du site.
const STEPS: Array<{ id: 'understand' | 'itinerary' | 'rest' | 'done'; label: TranslationKey; sub: TranslationKey }> = [
  { id: 'understand', label: 'compas.prep.understand', sub: 'compas.prep.understandSub' },
  { id: 'itinerary', label: 'compas.prep.itinerary', sub: 'compas.prep.itinerarySub' },
  { id: 'rest', label: 'compas.prep.rest', sub: 'compas.prep.restSub' },
  { id: 'done', label: 'compas.prep.done', sub: 'compas.prep.doneSub' },
];
const STATE_LABEL: Record<'done' | 'run' | 'halt' | 'todo', TranslationKey> = {
  done: 'compas.prep.stateDone',
  run: 'compas.prep.stateRun',
  halt: 'compas.prep.stateHalt',
  todo: 'compas.prep.stateTodo',
};
const ORDER = ['understand', 'itinerary', 'rest', 'done'] as const;

/**
 * Chargement visible de la préparation : chaque étape se coche avec son
 * résultat. La carte se dessine derrière dès que l'itinéraire est écrit.
 * « Arrêter » garde ce qui est déjà fait ; la reprise est automatique.
 *
 * Mention « IA » (PLAN-100 5.3) : dite dès le démarrage quand l'interrupteur est allumé (`aiOn`),
 * gardée à la fin seulement si l'IA a produit quelque chose (`prep.usedAi`) ; jamais quand elle
 * est éteinte, ni après une erreur ou un arrêt.
 */
export function CompasPrep({
  prep,
  aiOn = false,
  onStop,
  onClose,
  onRetry,
  onEditRequest,
}: {
  prep: PrepState;
  /** Interrupteur de l'IA du site (`AI_MODE`) : faux, rien ne parle d'IA. */
  aiOn?: boolean;
  onStop: () => void;
  onClose: () => void;
  onRetry: () => void;
  onEditRequest: () => void;
}) {
  const { t } = useTranslation();
  const live = prep.stage === 'done' || prep.stage === 'error' || prep.stage === 'stopped' ? (prep.at ?? 'done') : prep.stage;
  const current = ORDER.indexOf(prep.stage === 'done' ? 'done' : live);
  const finished = prep.stage === 'done';
  const failed = prep.stage === 'error';
  const stopped = prep.stage === 'stopped';

  return (
    <section className="cp-prep cp-sheet-glass" role="status" aria-live="polite" aria-label={t('compas.prep.label')}>
      <h2 className="cp-t2">
        {t(finished ? 'compas.prep.titleDone' : failed ? 'compas.prep.titleFailed' : stopped ? 'compas.prep.titleStopped' : 'compas.prep.titleRunning')}
      </h2>
      <ol className="cp-prep__steps">
        {STEPS.map((s, i) => {
          const state = finished || i < current ? 'done' : i === current && !failed && !stopped ? 'run' : i === current ? 'halt' : 'todo';
          return (
            <li key={s.id} className="cp-prep__step" data-state={state}>
              <span className="cp-prep__dot" aria-hidden="true">
                {state === 'done' ? <LKDVIcon name="valider" size={14} /> : state === 'run' ? <span className="cp-prep__spin" /> : null}
              </span>
              <span className="cp-prep__t">
                <b>{t(s.label)}</b>
                <span>
                  {s.id === 'done' && finished
                    ? [prep.total, prep.digest].filter(Boolean).join(' · ') || t(s.sub)
                    : t(s.sub)}
                </span>
              </span>
              <span className="sr-only">{t(STATE_LABEL[state])}</span>
            </li>
          );
        })}
      </ol>
      {/* En cours avec un message : une attente annoncée (limite de fréquence, reprise seule). */}
      {!failed && !stopped && !finished && prep.message && <p className="cp-note">{prep.message}</p>}
      {/* Le navigateur demande la position au lancement (plan 2.10) : pourquoi, ce qui part, et refuser ne bloque rien. */}
      {!failed && !stopped && !finished && !prep.message && (
        <p className="cp-note">{t('compas.prep.positionNote')}</p>
      )}
      {aiOn && !failed && !stopped && !finished && <AiNotice variant="run" />}
      {aiOn && finished && prep.usedAi && <AiNotice variant="done" />}
      {(failed || stopped) && prep.message && (
        <p className="cp-note" role={failed ? 'alert' : undefined}>
          {prep.message}
        </p>
      )}
      <div className="cp-actions">
        {finished && (
          <button type="button" className="cp-btn cp-btn--pg cp-btn--block" onClick={onClose}>
            <LKDVIcon name="valider" size={16} />
            {t('compas.prep.viewAdventure')}
          </button>
        )}
        {(failed || stopped) && (
          <>
            <button type="button" className="cp-btn cp-btn--soft" onClick={onEditRequest}>
              {t('compas.prep.editRequest')}
            </button>
            <button type="button" className="cp-btn cp-btn--pg cp-btn--block" onClick={onRetry}>
              {t('compas.prep.retry')}
            </button>
          </>
        )}
        {!finished && !failed && !stopped && (
          <button type="button" className="cp-btn cp-btn--soft cp-btn--block" onClick={onStop}>
            {t('compas.prep.stop')}
          </button>
        )}
      </div>
    </section>
  );
}
