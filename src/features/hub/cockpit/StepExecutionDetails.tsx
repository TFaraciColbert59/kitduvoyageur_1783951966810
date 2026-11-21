'use client';

import { useRef, useState, useTransition, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { newId } from '@/lib/uuid';
import { recordStepExecution } from './stepExecutionActions';
import { stepActionLabels, stepStatusLabels, stepTransitions, type StepExecution, type StepStatus } from './stepExecution';
import styles from './cockpit.module.css';

function observedTime(value: string) {
  return new Intl.DateTimeFormat('fr-FR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value));
}

export function StepExecutionDetails({ tripId, stepId, execution, canSave, isOnline, planUpdatedAt, onSaved }: {
  tripId: string;
  stepId: string;
  execution: StepExecution | undefined;
  canSave: boolean;
  isOnline: boolean;
  planUpdatedAt?: string;
  onSaved: (row: StepExecution) => void;
}) {
  const router = useRouter();
  const [note, setNote] = useState('');
  const [pending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<{ message: string; revision: string; refresh?: boolean } | null>(null);
  const attempt = useRef<{ key: string; operationId: string } | null>(null);
  const inFlight = useRef(false);
  const status = execution?.status ?? 'planned';
  const version = execution?.version ?? 0;
  const actions = stepTransitions[status];
  const revision = JSON.stringify([version, planUpdatedAt]);
  const message = feedback?.revision === revision ? feedback : null;
  const onlyEventTime = status === 'skipped' || status === 'postponed' || status === 'cancelled';

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const button = (event.nativeEvent as SubmitEvent).submitter;
    const action = button instanceof HTMLButtonElement ? button.value as StepStatus : null;
    if (!action || !actions.includes(action) || !canSave || !planUpdatedAt || !isOnline || message?.refresh || inFlight.current) return;
    const text = note.trim();
    const key = JSON.stringify([revision, action, text]);
    inFlight.current = true;
    startTransition(async () => {
      setFeedback(null);
      try {
        if (attempt.current?.key !== key) attempt.current = { key, operationId: newId() };
        const result = await recordStepExecution({
          tripId, stepId, planUpdatedAt, expectedVersion: version, operationId: attempt.current.operationId, status: action, note: text,
        });
        if (result.ok) {
          onSaved(result.execution);
          setNote('');
          attempt.current = null;
        } else {
          setFeedback({ message: result.message, refresh: result.refresh, revision });
        }
      } catch {
        setFeedback({ revision, message: 'Enregistrement indisponible. Réessaie.' });
      } finally {
        inFlight.current = false;
      }
    });
  }

  return <div className={styles.stepExecution}>
    <p role="status"><strong>{execution ? stepStatusLabels[execution.status] : 'Prévue'}</strong>
      {execution && onlyEventTime && <time dateTime={execution.occurred_at}> · {observedTime(execution.occurred_at)}</time>}
    </p>
    {execution && (
      <dl className={styles.stepTimes}>
        {([
          ['Départ réel', execution.actual_started_at],
          ['Arrivée réelle', execution.actual_arrived_at],
          ['Fin réelle', execution.actual_completed_at],
        ] as const).map(([label, value]) => value && (
          <div key={label}><dt>{label}</dt><dd><time dateTime={value}>{observedTime(value)}</time></dd></div>
        ))}
      </dl>
    )}
    {execution?.note && <p className={styles.bodyCopy}>{execution.note}</p>}
    {canSave && planUpdatedAt && actions.length > 0 && (
      <form onSubmit={submit} className={styles.stepExecution} aria-label="Suivi de l’étape">
        {!isOnline && <p role="status">Connexion nécessaire pour enregistrer l’étape.</p>}
        <label className={styles.stepNote}>Note pour les éditeurs (facultative)
          <textarea value={note} maxLength={500} rows={2} disabled={pending}
            onChange={(event) => setNote(event.currentTarget.value)} />
        </label>
        <div className={styles.stepButtons}>
          {actions.map((action) => (
            <button key={action} type="submit" value={action} className="lkdv-cv2-chip"
              disabled={!isOnline || pending || message?.refresh}>
              {stepActionLabels[action]}
            </button>
          ))}
        </div>
        {pending && <p role="status">Enregistrement…</p>}
      </form>
    )}
    {message && <p role="alert">{message.message}</p>}
    {message?.refresh && <button type="button" className="lkdv-cv2-chip" onClick={() => router.refresh()}>
      Actualiser le suivi
    </button>}
  </div>;
}
