'use client';

import React, { useCallback, useMemo, useState } from 'react';
import Icon from '@/components/ui/Icon';
import { Button, Chip, Sheet } from '@/components/ui';
import { activityById, primaryCandidates } from '@/features/adventure-prep/catalog';
import type { ActivityCategoryId, ActivityDef } from '@/features/adventure-prep/types';
import { ACTIVITY_CATEGORIES, searchActivities } from '@/features/adventure-prep/catalog';
import {
  canTrack,
  LOCATION_PURPOSE,
  PERMISSION_LABELS,
  REFUSED_FALLBACK,
  type LocationPermission,
} from '../engine/location';
import type { ActivityGuess } from '../engine/activityGuess';
import { useFreeDepartureStore } from '../store/useFreeDepartureStore';

export interface FreeDepartureScreenProps {
  /** Proposition issue des mesures, `null` = « Activite a identifier ». */
  guess: ActivityGuess | null;
  permission: LocationPermission;
  /** Demande l'autorisation — declenchee par l'appui sur « Demarrer ». */
  onRequestPermission: () => void;
  /** Lance la session de suivi et ouvre le cockpit. */
  onStart: () => void;
  /** Ferme l'ecran et revient au hub. */
  onClose: () => void;
  /** Change l'activite (mode manuel ou correction de la proposition). */
  onPickActivity: (activityId: string | null) => void;
}

const STACK: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 'var(--prep-block-gap)',
};

/** Ligne de choix d'activite, partagee par l'ecran et la feuille. */
function ActivityOption({
  activity,
  selected,
  onSelect,
}: {
  activity: ActivityDef;
  selected: boolean;
  onSelect: (activity: ActivityDef) => void;
}) {
  return (
    <li>
      <button
        type="button"
        className="prep-act"
        aria-pressed={selected}
        onClick={() => onSelect(activity)}
      >
        <span className="prep-act__icon" aria-hidden="true">
          <Icon name={activity.icon} size={22} />
        </span>
        <span className="prep-act__name">{activity.label}</span>
        {selected ? (
          <span className="prep-act__check">
            <Icon name="check" size={20} aria-hidden="true" />
            <span className="prep-visually-hidden">Sélectionnée</span>
          </span>
        ) : null}
      </button>
    </li>
  );
}

/**
 * « Partir librement » — la vue courte d'avant depart (A11).
 *
 * UNE decision dominante : demarrer. L'activite et la localisation sont des
 * reglages, pas des obstacles : ils se corrigent en un geste et n'empechent
 * jamais de partir. Rien n'est chiffre, rien n'est invente — si l'activite ne
 * peut pas etre identifiee, l'ecran le dit au lieu de deviner.
 */
export function FreeDepartureScreen({
  guess,
  permission,
  onRequestPermission,
  onStart,
  onClose,
  onPickActivity,
}: FreeDepartureScreenProps) {
  const activityId = useFreeDepartureStore((state) => state.activityId);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [categoryId, setCategoryId] = useState<ActivityCategoryId | 'all'>('all');

  const manual = activityId ? activityById(activityId) : null;
  /** Un choix manuel prime toujours : la proposition ne l'ecrase jamais. */
  const shown = manual ?? guess;
  const tracking = canTrack(permission);

  const options = useMemo(() => {
    const pool = searchActivities(query, categoryId);
    const allowed = new Set(primaryCandidates().map((a) => a.id));
    return pool.filter((a) => allowed.has(a.id));
  }, [query, categoryId]);

  const choose = useCallback(
    (activity: ActivityDef) => {
      onPickActivity(activity.id);
      setPickerOpen(false);
    },
    [onPickActivity]
  );

  const handleStart = useCallback(() => {
    // L'autorisation se demande ICI, au moment necessaire — pas au montage.
    if (permission === 'inconnue') onRequestPermission();
    onStart();
  }, [onRequestPermission, onStart, permission]);

  return (
    <div className="adventure-prep">
      <div className="prep-screen">
        <div className="prep-body">
          <h1 className="prep-title">Partir librement</h1>
          <p className="prep-help">
            Aucun itinéraire à préparer. L’app démarre le suivi, enregistre ta trace, et te propose
            l’activité à la fin — tu pourras la corriger.
          </p>

          {/* --- Activité : détection automatique ou choix manuel --------- */}
          <section style={STACK} aria-labelledby="free-activity">
            <h2 id="free-activity" className="prep-section-title">
              Activité
            </h2>

            <ul className="prep-block" aria-label="Activité retenue">
              <li>
                <button
                  type="button"
                  className="prep-block__row"
                  aria-pressed={activityId === null}
                  onClick={() => onPickActivity(null)}
                >
                  <span className="prep-block__label">Détection automatique</span>
                  <span className="prep-block__value" data-unknown={shown === null}>
                    {shown === null ? 'Activité à identifier' : shown.label}
                  </span>
                  {activityId === null ? (
                    <span className="prep-block__hint">
                      L’app la déduira de ton allure à la fin.
                    </span>
                  ) : null}
                </button>
              </li>

              {shown !== null && !manual && guess !== null ? (
                <li>
                  <p className="prep-note">
                    Proposition d’après {guess.because}.
                    {guess.confidence === 'incertaine'
                      ? ' Lecture incertaine : corrige si c’est faux.'
                      : ''}
                  </p>
                </li>
              ) : null}

              {manual ? (
                <li>
                  <p className="prep-note">
                    Activité choisie par toi. La détection ne l’écrasera pas.
                  </p>
                </li>
              ) : null}
            </ul>

            <Button
              variant="secondary"
              size="md"
              className="self-start"
              onClick={() => setPickerOpen(true)}
              aria-haspopup="dialog"
            >
              <Icon name="edit3" size={18} aria-hidden="true" />
              {manual ? 'Changer d’activité' : 'Choisir moi-même'}
            </Button>
          </section>

          {/* --- Localisation : usage expliqué ----------------------------- */}
          <section style={STACK} aria-labelledby="free-location">
            <h2 id="free-location" className="prep-section-title">
              Localisation
            </h2>
            <p className="prep-help">{LOCATION_PURPOSE}</p>
            <p className="prep-block__value" data-unknown={!tracking}>
              {PERMISSION_LABELS[permission]}
            </p>
            {permission === 'refusee' ? (
              <p className="prep-note" data-tone="warn">
                {REFUSED_FALLBACK}
              </p>
            ) : null}
          </section>
        </div>

        <div className="prep-footer">
          <Button
            variant="primary"
            size="lg"
            className="prep-footer__primary"
            onClick={handleStart}
          >
            <Icon name="play" size={18} aria-hidden="true" />
            Démarrer
          </Button>
          <Button variant="ghost" size="md" onClick={onClose}>
            Revenir au hub
          </Button>
        </div>

        {/* Choix manuel : une seule vue secondaire, jamais un écran empilé. */}
        <Sheet
          open={pickerOpen}
          onOpenChange={setPickerOpen}
          title="Quelle activité ?"
          detent="large"
        >
          <div style={STACK}>
            <input
              type="search"
              className="prep-block__row"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Rechercher une activité"
              aria-label="Rechercher une activité"
            />

            <div className="prep-cats" role="group" aria-label="Catégories d'activité">
              <Chip selected={categoryId === 'all'} onClick={() => setCategoryId('all')}>
                Toutes
              </Chip>
              {ACTIVITY_CATEGORIES.map((item) => (
                <Chip
                  key={item.id}
                  selected={categoryId === item.id}
                  onClick={() => setCategoryId(item.id)}
                >
                  {item.label}
                </Chip>
              ))}
            </div>

            <ul className="prep-acts" aria-label="Activités">
              {options.map((activity) => (
                <ActivityOption
                  key={activity.id}
                  activity={activity}
                  selected={activity.id === activityId}
                  onSelect={choose}
                />
              ))}
            </ul>

            {activityId !== null ? (
              <Button
                variant="secondary"
                size="md"
                onClick={() => {
                  onPickActivity(null);
                  setPickerOpen(false);
                }}
              >
                Revenir à la détection automatique
              </Button>
            ) : null}
          </div>
        </Sheet>
      </div>
    </div>
  );
}

export default FreeDepartureScreen;
