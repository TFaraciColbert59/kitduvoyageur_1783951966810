'use client';

import { useRef, useState, useTransition, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Icon from '@/components/ui/Icon';
import { newId } from '@/lib/uuid';
import { enqueueOfflineOp, type StepExecutionPayload } from './offlineQueue';
import { recordStepExecution } from './stepExecutionActions';
import { stepActionLabels, stepStatusLabels, stepTransitions, type StepExecution, type StepStatus } from './stepExecution';
import { DrawerRow, DrawerSection, StatusBadge, type BadgeTone } from './DrawerPrimitives';
import ds from './cockpitDrawers.module.css';

function observedTime(value: string) {
  return new Intl.DateTimeFormat('fr-FR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value));
}

function toneForStatus(status: StepStatus | 'planned'): BadgeTone {
  if (status === 'completed') return 'good';
  if (status === 'started' || status === 'arrived') return 'tint';
  if (status === 'postponed') return 'warn';
  if (status === 'cancelled' || status === 'skipped') return 'bad';
  return 'neutral';
}

export function StepExecutionDetails({ tripId, stepId, execution, canSave, isOnline, planUpdatedAt, pendingOffline, onSaved, onQueued }: {
  tripId: string;
  stepId: string;
  execution: StepExecution | undefined;
  canSave: boolean;
  isOnline: boolean;
  planUpdatedAt?: string;
  pendingOffline?: boolean;
  onSaved: (row: StepExecution) => void;
  onQueued?: (payload: StepExecutionPayload, operationId: string) => void;
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

  const primaryAction = actions[0] ?? null;
  const secondaryActions = actions.slice(1);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const button = (event.nativeEvent as SubmitEvent).submitter;
    const action = button instanceof HTMLButtonElement ? button.value as StepStatus : null;
    if (!action || !actions.includes(action) || !canSave || !planUpdatedAt || message?.refresh || inFlight.current) return;
    const text = note.trim();
    const key = JSON.stringify([revision, action, text]);
    inFlight.current = true;
    startTransition(async () => {
      setFeedback(null);
      try {
        if (attempt.current?.key !== key) attempt.current = { key, operationId: newId() };
        const operationId = attempt.current.operationId;
        const payload: StepExecutionPayload = {
          tripId, stepId, planUpdatedAt, expectedVersion: version, status: action, note: text,
        };
        if (!isOnline) {
          await enqueueOfflineOp({ operationId, tripId, kind: 'step_execution', payload });
          onQueued?.(payload, operationId);
          setNote('');
          attempt.current = null;
          setFeedback({ revision, message: 'Enregistré hors ligne. Synchronisation automatique au retour du réseau.' });
          return;
        }
        const result = await recordStepExecution({ ...payload, operationId });
        if (result.ok) {
          onSaved(result.execution);
          setNote('');
          attempt.current = null;
        } else {
          setFeedback({ message: result.message, refresh: result.refresh, revision });
        }
      } catch {
        const operationId = attempt.current?.operationId ?? newId();
        const payload: StepExecutionPayload = {
          tripId, stepId, planUpdatedAt, expectedVersion: version, status: action, note: text,
        };
        if (typeof navigator !== 'undefined' && !navigator.onLine) {
          await enqueueOfflineOp({ operationId, tripId, kind: 'step_execution', payload });
          onQueued?.(payload, operationId);
          setNote('');
          attempt.current = null;
          setFeedback({ revision, message: 'Connexion perdue. Enregistré localement pour synchronisation.' });
        } else {
          setFeedback({ revision, message: 'Enregistrement indisponible. Réessaie.' });
        }
      } finally {
        inFlight.current = false;
      }
    });
  }

  return (
    <div className={ds.drawerRoot} style={{ paddingBottom: 0 }}>
      <div className={ds.heroTop} role="status">
        <StatusBadge tone={toneForStatus(status)}>
          {execution ? stepStatusLabels[execution.status] : 'Prévue'}
        </StatusBadge>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          {pendingOffline && <StatusBadge tone="warn">En attente de synchronisation</StatusBadge>}
          {execution && onlyEventTime && (
            <time className={ds.rowSub} dateTime={execution.occurred_at}>{observedTime(execution.occurred_at)}</time>
          )}
        </div>
      </div>

      {execution && (execution.actual_started_at || execution.actual_arrived_at || execution.actual_completed_at) && (
        <DrawerSection title="Horaires réels enregistrés">
          {execution.actual_started_at && (
            <DrawerRow icon="play" iconTone="good" title="Départ réel"
              right={<time dateTime={execution.actual_started_at}>{observedTime(execution.actual_started_at)}</time>} />
          )}
          {execution.actual_arrived_at && (
            <DrawerRow icon="map-pin" iconTone="water" title="Arrivée réelle"
              right={<time dateTime={execution.actual_arrived_at}>{observedTime(execution.actual_arrived_at)}</time>} />
          )}
          {execution.actual_completed_at && (
            <DrawerRow icon="check" iconTone="good" title="Fin réelle"
              right={<time dateTime={execution.actual_completed_at}>{observedTime(execution.actual_completed_at)}</time>} />
          )}
        </DrawerSection>
      )}

      {execution?.note && (
        <div className={ds.editorNoteBox}>
          <span className={ds.kpiLabel}>
            <Icon name="lock" size={13} /> Note interne · visible uniquement par les éditeurs
          </span>
          <p style={{ margin: 0 }}>{execution.note}</p>
        </div>
      )}

      {canSave && planUpdatedAt && actions.length > 0 && (
        <DrawerSection title="Piloter l’étape" padded>
          <form onSubmit={submit} className={ds.drawerRoot} style={{ paddingBottom: 0 }} aria-label="Suivi de l’étape">
            {!isOnline && (
              <div className={ds.alertBanner} data-tone="warn" role="status">
                Mode hors ligne : les actions sont gardées sur cet appareil.
              </div>
            )}
            <label className={ds.fieldGroup}>
              <span className={ds.fieldLabel}>Note pour les éditeurs (facultative)</span>
              <textarea
                className={ds.fieldTextarea}
                value={note}
                maxLength={500}
                rows={2}
                disabled={pending}
                placeholder="Ex. Départ groupé à l’heure, point d’eau vérifié…"
                onChange={(event) => setNote(event.currentTarget.value)}
              />
            </label>

            {primaryAction && (
              <button
                type="submit"
                value={primaryAction}
                className={ds.btnPrimary}
                disabled={pending || message?.refresh}
              >
                {stepActionLabels[primaryAction]}
              </button>
            )}

            {secondaryActions.length > 0 && (
              <div className={ds.btnRow}>
                {secondaryActions.map((action) => (
                  <button
                    key={action}
                    type="submit"
                    value={action}
                    className={action === 'cancelled' ? ds.btnSoftDanger : ds.btnSecondary}
                    disabled={pending || message?.refresh}
                  >
                    {stepActionLabels[action]}
                  </button>
                ))}
              </div>
            )}

            {pending && <p role="status" className={ds.heroSub}>Enregistrement…</p>}
          </form>
        </DrawerSection>
      )}

      {message && (
        <div className={ds.alertBanner} data-tone={message.refresh ? 'bad' : 'good'} role="alert">
          <div style={{ flex: 1 }}>
            <p style={{ margin: 0 }}>{message.message}</p>
            {message.refresh && (
              <button
                type="button"
                className={ds.btnSecondary}
                style={{ marginTop: 8, width: '100%' }}
                onClick={() => router.refresh()}
              >
                Actualiser le suivi
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
