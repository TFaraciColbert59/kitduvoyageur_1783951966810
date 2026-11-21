'use client';

import { useState, useTransition } from 'react';
import { newId } from '@/lib/uuid';
import { transitionHubTripLifecycle, type TripLifecycleState } from './lifecycleActions';
import styles from './cockpit.module.css';

const STATE_LABELS: Record<TripLifecycleState, string> = {
  draft: 'Brouillon',
  planned: 'Planifié',
  ready: 'Prêt au départ',
  active: 'En cours',
  paused: 'En pause',
  completed: 'Terminé',
  recount: 'Récit',
  cancelled: 'Annulé',
};

const NEXT_ACTIONS: Partial<Record<TripLifecycleState, { to: TripLifecycleState; label: string }[]>> = {
  draft: [{ to: 'active', label: 'Démarrer le voyage' }],
  planned: [{ to: 'active', label: 'Démarrer le voyage' }],
  ready: [{ to: 'active', label: 'Démarrer le voyage' }],
  active: [
    { to: 'paused', label: 'Mettre en pause' },
    { to: 'completed', label: 'Clôturer le voyage' },
  ],
  paused: [
    { to: 'active', label: 'Reprendre' },
    { to: 'completed', label: 'Clôturer le voyage' },
  ],
};

export function TripLifecycleBar({
  tripId,
  initialState = 'planned',
  canEdit,
  isOnline,
}: {
  tripId: string;
  initialState?: TripLifecycleState;
  canEdit: boolean;
  isOnline: boolean;
}) {
  const [state, setState] = useState<TripLifecycleState>(initialState);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const actions = NEXT_ACTIONS[state] ?? [];

  function trigger(toState: TripLifecycleState) {
    if (!canEdit || !isOnline || pending) return;
    setFeedback(null);
    startTransition(async () => {
      const res = await transitionHubTripLifecycle({
        tripId,
        toState,
        operationId: newId(),
      });
      if (res.ok) {
        setState(res.toState);
        setFeedback(`Voyage passé à « ${STATE_LABELS[res.toState]} ».`);
      } else {
        setFeedback(res.message);
      }
    });
  }

  return (
    <div role="region" aria-label="Cycle de vie du voyage" className={styles.stepExecution}>
      <p className={styles.meta}>
        État du voyage : <strong>{STATE_LABELS[state]}</strong>
      </p>
      {canEdit && actions.length > 0 && (
        <div className={styles.stepButtons}>
          {actions.map((action) => (
            <button
              key={action.to}
              type="button"
              className="lkdv-cv2-chip"
              disabled={!isOnline || pending}
              onClick={() => trigger(action.to)}
            >
              {action.label}
            </button>
          ))}
        </div>
      )}
      {feedback && <p role="status" className={styles.meta}>{feedback}</p>}
    </div>
  );
}
