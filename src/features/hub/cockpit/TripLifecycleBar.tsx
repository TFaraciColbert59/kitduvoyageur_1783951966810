'use client';

import { useState, useTransition } from 'react';
import { newId } from '@/lib/uuid';
import { transitionHubTripLifecycle, type TripLifecycleState } from './lifecycleActions';
import { StatusBadge, type BadgeTone } from './DrawerPrimitives';
import ds from './cockpitDrawers.module.css';

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

const STATE_TONES: Record<TripLifecycleState, BadgeTone> = {
  draft: 'neutral',
  planned: 'water',
  ready: 'water',
  active: 'good',
  paused: 'warn',
  completed: 'tint',
  recount: 'tint',
  cancelled: 'bad',
};

const NEXT_ACTIONS: Partial<Record<TripLifecycleState, { to: TripLifecycleState; label: string; primary?: boolean }[]>> = {
  draft: [{ to: 'active', label: 'Démarrer le voyage', primary: true }],
  planned: [{ to: 'active', label: 'Démarrer le voyage', primary: true }],
  ready: [{ to: 'active', label: 'Démarrer le voyage', primary: true }],
  active: [
    { to: 'paused', label: 'Mettre en pause' },
    { to: 'completed', label: 'Clôturer le voyage', primary: true },
  ],
  paused: [
    { to: 'active', label: 'Reprendre', primary: true },
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
    <div role="region" aria-label="Cycle de vie du voyage" className={ds.heroCard}>
      <div className={ds.heroTop}>
        <div>
          <p className={ds.sectionTitle} style={{ marginBottom: 4 }}>Statut du voyage</p>
          <StatusBadge tone={STATE_TONES[state]}>{STATE_LABELS[state]}</StatusBadge>
        </div>
        {canEdit && actions.length > 0 && (
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            {actions.map((action) => (
              <button
                key={action.to}
                type="button"
                className={action.primary ? ds.btnPrimary : ds.btnSecondary}
                style={{ minHeight: 38, padding: '0 12px', fontSize: 13 }}
                disabled={!isOnline || pending}
                onClick={() => trigger(action.to)}
              >
                {action.label}
              </button>
            ))}
          </div>
        )}
      </div>
      {feedback && <p role="status" className={ds.heroSub}>{feedback}</p>}
    </div>
  );
}
