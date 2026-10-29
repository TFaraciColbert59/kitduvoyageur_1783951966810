'use client';

import React, { useMemo } from 'react';
import Icon from '@/components/ui/Icon';
import type { CarnetDay, CarnetDetail } from '@/features/carnet/detail/types';
import { INFO_MISSING, momentRows } from '@/features/carnet/detail/dayinfo';
import { CarnetField } from '../CarnetField';
import { CarnetEmpty } from '../CarnetStates';
import { groupsOfThree } from '../groups';

export interface CarnetMomentsPaneProps {
  detail: CarnetDetail;
  /** Page de jour affichée : `null` sur le Résumé, où tous les moments vivent. */
  day: CarnetDay | null;
}

/**
 * Volet « Moments » du drawer : la liste qui vivait sous la grille 134.
 *
 * Une ligne de liste du système par moment — 48 px, libellé à gauche (l'heure,
 * préfixée de son jour sur le Résumé), valeur à droite (le lieu, ellipse au
 * milieu quand il est long), filet de 0,5 px inséré de 16 px entre deux lignes,
 * trois lignes au plus par groupe puis 20 px d'air. Aucune donnée n'est
 * recalculée ici : `momentRows` rend l'heure et le lieu réels, et un tiret
 * quand l'un des deux manque. Aucun texte d'état vide : glyphe + `—`.
 */
export function CarnetMomentsPane({ detail, day }: CarnetMomentsPaneProps) {
  const moments = useMemo(
    () => momentRows(day ? day.moments : detail.moments, day === null),
    [day, detail.moments],
  );
  const groups = useMemo(() => groupsOfThree(moments), [moments]);

  if (moments.length === 0) {
    return (
      <div className="ckp-pane ckp-pane-moments">
        <CarnetEmpty icon={<Icon name="clock" size={32} aria-hidden="true" />} label="Aucun moment" />
      </div>
    );
  }

  return (
    <div className="ckp-pane ckp-pane-moments">
      {groups.map((group, index) => (
        <div className="ckp-group" key={index}>
          {group.map((moment) => {
            /* Le jour ne s'écrit que sur le Résumé, où plusieurs journées se
               suivent : il ne remplace jamais l'heure, il la précède. */
            const label = moment.day ? `${moment.day} · ${moment.time}` : moment.time;
            /* Un lieu réellement absent garde la place de la valeur et prend la
               teinte du tiret (`is-missing`), jamais l'encre d'une donnée. */
            const place = moment.place === INFO_MISSING ? undefined : moment.place;
            return (
              <CarnetField
                key={moment.id}
                label={label}
                value={place}
                /* Un lieu se reconnaît par sa fin : colonne élargie, ellipse au
                   milieu, valeur toujours alignée à droite. */
                wide
                mid
                ariaLabel={`${label} — ${moment.place}`}
              />
            );
          })}
        </div>
      ))}
    </div>
  );
}

export default CarnetMomentsPane;
