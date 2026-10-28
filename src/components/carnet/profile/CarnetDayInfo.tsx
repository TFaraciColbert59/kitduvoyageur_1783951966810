'use client';

import React, { useMemo } from 'react';
import type { CarnetDay, CarnetDetail } from '@/features/carnet/detail/types';
import { momentRows } from '@/features/carnet/detail/dayinfo';

export interface CarnetDayMomentListProps {
  detail: CarnetDetail;
  /** `null` sur la page Résumé : la liste porte alors tous les moments. */
  day: CarnetDay | null;
}

/**
 * Liste des moments de la page : heure, lieu, et le numéro de jour sur le
 * Résumé où plusieurs journées se suivent. Elle vit **sous la grille 134** :
 * les photos gardent la place qu'elles ont toujours eue, la liste ajoute les
 * repères que la grille ne porte pas. Même règle de contenu — valeurs seules,
 * tiret cadratin quand une heure ou un lieu manque.
 *
 * Les lignes d'information du jour (allure, départ, arrivée, cumul, D+) ne
 * vivent plus sur la carte : elles sont dans le drawer Statistiques.
 */
export function CarnetDayMomentList({ detail, day }: CarnetDayMomentListProps) {
  const moments = useMemo(
    () => momentRows(day ? day.moments : detail.moments, day === null),
    [day, detail.moments],
  );

  if (moments.length === 0) return null;

  return (
    <ul className="ckp-dayinfo-moments" aria-label="Moments">
      {moments.map((moment) => (
        <li className="ckp-dayinfo-moment" key={moment.id}>
          <span className="ckp-dayinfo-time">{moment.time}</span>
          <span className="ckp-dayinfo-place">{moment.place}</span>
          {moment.day ? <span className="ckp-dayinfo-day">{moment.day}</span> : null}
        </li>
      ))}
    </ul>
  );
}

export default CarnetDayMomentList;
