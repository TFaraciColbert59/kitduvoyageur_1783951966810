'use client';

import React from 'react';
import Icon from '@/components/ui/Icon';
import { Button } from '@/components/ui';
import { NO_VALUE, type TracePoint } from '../engine/freeSession';
import { FreeTraceMap } from './FreeTraceMap';

export interface FreeLiveScreenProps {
  /** Activite retenue, ou « Suivi libre » si l'utilisateur n'en a pas choisi. */
  activityLabel: string;
  activityIcon: string;
  /** Horloge d'ecoulement, deja formatee. */
  clock: string;
  distance: string;
  pace: string;
  elevation: string;
  paused: boolean;
  /** Phrase a afficher quand le suivi n'enregistre pas. `null` si tout va bien. */
  trackingNote: string | null;
  trace: TracePoint[];
  onPause: () => void;
  onResume: () => void;
  onFinish: () => void;
}

/**
 * Ecran 61 — le suivi en cours.
 *
 * C'est l'ecran le plus simple de toute l'application, et c'est volontaire :
 * pendant une sortie, un pouce a couvrir l'ecran et un oeil a regarder le
 * terrain, pas a lire. Trois mesures, un chrono, deux boutons.
 *
 * Ce qui n'y est pas, et pourquoi : aucun score, aucun pourcentage, aucune
 * calorie, aucun badge. Ce sont des metriques de jeu ; ici on mesure une
 * sortie. Elles ont leur place dans le carnet, apres coup.
 */
export function FreeLiveScreen({
  activityLabel,
  activityIcon,
  clock,
  distance,
  pace,
  elevation,
  paused,
  trackingNote,
  trace,
  onPause,
  onResume,
  onFinish,
}: FreeLiveScreenProps) {
  return (
    <div className="adventure-prep free-departure" data-paused={paused ? 'true' : 'false'}>
      <div className="free-screen">
        <div className="prep-nav free-top">
          <span className="free-top__icon">
            <Icon name={activityIcon} size={18} aria-hidden="true" />
            <span className="free-top__title">{activityLabel}</span>
          </span>
        </div>

        <div className="prep-body free-body">
          <div className="free-clock">
            <span className="free-clock__label">Durée écoulée</span>
            <span className="free-clock__value">{clock}</span>
          </div>

          {/* La pause est ANNONCÉE, pas seulement dans le bouton : un ecran qui affiche
              un bouton « Reprendre » sans le dire laisse croire que le
              suivi continue. */}
          {paused ? (
            <p className="free-paused" aria-live="polite">
              <Icon name="pause" size={14} aria-hidden="true" />
              En pause — ton chrono et ta trace sont figés
            </p>
          ) : null}

          {trackingNote ? (
            <p className="prep-note" data-tone="warn" aria-live="polite">
              {trackingNote}
            </p>
          ) : null}

          <div className="free-metrics">
            <div className="free-metric">
              <p className="free-metric__value" data-unknown={distance === NO_VALUE ? 'true' : undefined}>
                {distance}
              </p>
              <p className="free-metric__label">Distance</p>
            </div>
            <div className="free-metric">
              <p className="free-metric__value" data-unknown={pace === NO_VALUE ? 'true' : undefined}>
                {pace}
              </p>
              <p className="free-metric__label">Allure min/km</p>
            </div>
            <div className="free-metric">
              <p className="free-metric__value" data-unknown={elevation === NO_VALUE ? 'true' : undefined}>
                {elevation}
              </p>
              <p className="free-metric__label">Dénivelé +</p>
            </div>
          </div>

          <FreeTraceMap pillLabel="Ma trace" trace={trace} name="Ma trace" />
        </div>

        <div className="prep-footer free-actions">
          <Button variant="secondary" size="lg" onClick={onFinish}>
            <Icon name="square" size={18} aria-hidden="true" />
            Terminer
          </Button>
          <Button
            variant="primary"
            size="lg"
            fullWidth
            className="prep-footer__primary"
            onClick={paused ? onResume : onPause}
          >
            <Icon name={paused ? 'play' : 'pause'} size={18} aria-hidden="true" />
            {paused ? 'Reprendre' : 'Pause'}
          </Button>
        </div>
      </div>
    </div>
  );
}

export default FreeLiveScreen;

