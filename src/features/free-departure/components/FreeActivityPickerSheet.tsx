'use client';

import React, { useCallback, useMemo, useState } from 'react';
import Icon from '@/components/ui/Icon';
import { Button, Chip, Sheet } from '@/components/ui';
import {
  ACTIVITY_CATEGORIES,
  activityById,
  primaryCandidates,
  searchActivities,
} from '@/features/adventure-prep/catalog';
import type { ActivityCategoryId, ActivityDef } from '@/features/adventure-prep/types';

export interface FreeActivityPickerSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Activite retenue, ou `null` en detection automatique. */
  activityId: string | null;
  /** `null` = retour a la detection automatique. */
  onPickActivity: (activityId: string | null) => void;
  /**
   * Titre de l'appel. L'ecran 60 demande une activite AVANT de partir, l'ecran
   * 62 corrige une sortie terminee : les deux ne promettent pas la meme chose,
   * donc ils ne portent pas le meme texte.
   */
  title: string;
  description?: string;
}

/**
 * Feuille de choix d'activite, partagee par les ecrans 60 et 62.
 *
 * C'est une FEUILLE et non un ecran : la liste est longue (vingt-deux
 * activites) et le retour doit etre immediat. Empiler un quatrieme ecran
 * plein pour choisir un mot aurait transforme un reglage en etape.
 *
 * Elle n'affiche que les activites `canBePrimary` : le retour libre commence
 * une sortie, il ne compose pas une aventure. Une nuit de bivouac se decidera
 * dans le preparateur, ou la avec le reste du programme.
 */
export function FreeActivityPickerSheet({
  open,
  onOpenChange,
  activityId,
  onPickActivity,
  title,
  description,
}: FreeActivityPickerSheetProps) {
  const [query, setQuery] = useState('');
  const [categoryId, setCategoryId] = useState<ActivityCategoryId | 'all'>('all');

  const selected = activityId === null ? null : activityById(activityId);

  const options = useMemo(() => {
    const allowed = new Set(primaryCandidates().map((activity) => activity.id));
    return searchActivities(query, categoryId).filter((activity) => allowed.has(activity.id));
  }, [query, categoryId]);

  const choose = useCallback(
    (activity: ActivityDef) => {
      onPickActivity(activity.id);
      onOpenChange(false);
    },
    [onPickActivity, onOpenChange]
  );

  return (
    <Sheet open={open} onOpenChange={onOpenChange} title={title} description={description} detent="large">
      <div className="prep-block__stack">
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
          {ACTIVITY_CATEGORIES.map((category) => (
            <Chip
              key={category.id}
              selected={categoryId === category.id}
              onClick={() => setCategoryId(category.id)}
            >
              {category.label}
            </Chip>
          ))}
        </div>

        <ul className="prep-acts" aria-label="Activités">
          {options.map((activity) => (
            <li key={activity.id}>
              <button
                type="button"
                className="prep-act"
                aria-pressed={activity.id === activityId}
                onClick={() => choose(activity)}
              >
                <span className="prep-act__icon" aria-hidden="true">
                  <Icon name={activity.icon} size={22} />
                </span>
                <span className="prep-act__name">{activity.label}</span>
                {activity.id === activityId ? (
                  <span className="prep-act__check">
                    <Icon name="check" size={20} aria-hidden="true" />
                    <span className="prep-visually-hidden">Sélectionnée</span>
                  </span>
                ) : null}
              </button>
            </li>
          ))}
        </ul>

        {options.length === 0 ? (
          <p className="prep-note" data-tone="warn">
            Aucune activité ne correspond à « {query} ». Efface la recherche ou change de catégorie.
          </p>
        ) : null}

        {activityId !== null ? (
          <Button
            variant="secondary"
            size="md"
            onClick={() => {
              onPickActivity(null);
              onOpenChange(false);
            }}
          >
            <Icon name="sparkles" size={18} aria-hidden="true" />
            Revenir à la détection automatique
          </Button>
        ) : null}

        {selected ? (
          <p className="prep-note">
            {selected.label} sera écrit dans ton carnet. Tu pourras encore le changer avant de partir.
          </p>
        ) : null}
      </div>
    </Sheet>
  );
}

export default FreeActivityPickerSheet;
