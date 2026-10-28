'use client';

import React, { useMemo } from 'react';
import type { CarnetDay, CarnetDetail } from '@/features/carnet/detail/types';
import { dayInfoRows, momentRows } from '@/features/carnet/detail/dayinfo';

export interface CarnetDayInfoProps {
  detail: CarnetDetail;
  /** `null` sur la page Résumé : les lignes portent alors les totaux. */
  day: CarnetDay | null;
}

/**
 * Informations de la page affichée, sous la ligne de lieu : allure, activité,
 * départ, arrivée, cumul depuis le départ — ou les totaux sur le Résumé.
 *
 * Même matière que le reste de la carte : aucune pastille, aucun cadre, des
 * libellés de 9,5/600 et des valeurs de 11,5/600. Une valeur absente est un
 * tiret cadratin ; aucune phrase, aucune donnée inventée.
 */
export function CarnetDayInfo({ detail, day }: CarnetDayInfoProps) {
  const rows = useMemo(() => dayInfoRows(detail, day), [day, detail]);

  return (
    <dl className="ckp-dayinfo" aria-label={day ? `Informations du jour ${day.index}` : 'Informations du carnet'}>
      {rows.map((entry) => (
        <div className="ckp-dayinfo-row" key={entry.key}>
          <dt className="ckp-dayinfo-l">{entry.label}</dt>
          <dd className="ckp-dayinfo-v">{entry.value}</dd>
        </div>
      ))}
    </dl>
  );
}

/**
 * Liste des moments de la page : heure, lieu, et le numéro de jour sur le
 * Résumé où plusieurs journées se suivent. Elle vit **sous la grille 134** :
 * les photos gardent la place qu'elles ont toujours eue, la liste ajoute les
 * repères que la grille ne porte pas. Même règle de contenu — valeurs seules,
 * tiret cadratin quand une heure ou un lieu manque.
 */
export function CarnetDayMomentList({ detail, day }: CarnetDayInfoProps) {
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

export default CarnetDayInfo;
