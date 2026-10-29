'use client';

import React, { useMemo } from 'react';
import Icon from '@/components/ui/Icon';
import { formatDayLabel } from '@/features/carnet/detail/format';
import { INFO_MISSING } from '@/features/carnet/detail/dayinfo';
import type { CarnetDay, CarnetDetail, CarnetMomentItem } from '@/features/carnet/detail/types';
import { CarnetEmpty } from '../CarnetStates';

export interface CarnetMomentsPaneProps {
  detail: CarnetDetail;
  /** Page de jour affichée : `null` sur le Résumé, où tous les moments vivent. */
  day: CarnetDay | null;
}

interface MomentGroup {
  /** Numéro du jour, tel que le carnet le numérote. */
  dayNumber: number;
  /** `J2` — le repère du jour, toujours réel. */
  dayLabel: string;
  /** `27 sept.` — la date réelle du jour, `null` quand elle manque. */
  dateLabel: string | null;
  moments: CarnetMomentItem[];
}

/**
 * Regroupe les moments par jour, dans l'ordre reçu du serveur. Aucun moment
 * n'est déplacé, aucun jour n'est créé : un jour sans moment n'apparaît pas.
 */
function groupByDay(moments: CarnetMomentItem[], days: CarnetDay[]): MomentGroup[] {
  const dateByIndex = new Map<number, string | null>();
  for (const day of days) dateByIndex.set(day.index, formatDayLabel(day.date));

  const groups = new Map<number, MomentGroup>();
  for (const moment of moments) {
    const dayNumber = Math.max(1, Math.round(moment.dayNumber));
    const existing = groups.get(dayNumber);
    if (existing) {
      existing.moments.push(moment);
      continue;
    }
    groups.set(dayNumber, {
      dayNumber,
      dayLabel: `J${dayNumber}`,
      dateLabel: dateByIndex.get(dayNumber) ?? null,
      moments: [moment],
    });
  }
  return [...groups.values()].sort((a, b) => a.dayNumber - b.dayNumber);
}

/**
 * Carte d'un moment : la photo en 4:3 (rayon 14), l'heure en pastille en haut
 * à gauche, le lieu en bas sur un voile local de 18 %, puis la légende sous la
 * photo, dans la surface de la carte — jamais à même le verre.
 *
 * Un moment sans photo garde la même carte : la surface du 4:3 porte le glyphe
 * de l'horloge à 30 %, et le lieu passe sous le glyphe, dans la carte. Aucune
 * image n'est inventée, aucune carte ne change de hauteur d'une colonne à
 * l'autre.
 */
function MomentCard({ moment }: { moment: CarnetMomentItem }) {
  const time = moment.time ?? INFO_MISSING;
  const place = moment.place ?? INFO_MISSING;
  const missingPlace = moment.place === null;
  const caption = moment.caption?.trim() || null;

  return (
    <figure className="ckp-moment-card" data-nophoto={moment.imageUrl ? undefined : 'true'}>
      <span className="ckp-moment-photo">
        {moment.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- image distante du moment
          <img src={moment.imageUrl} alt="" loading="lazy" draggable={false} />
        ) : (
          <span className="ckp-moment-glyph" aria-hidden="true">
            <Icon name="clock" size={24} aria-hidden="true" />
          </span>
        )}
        <span className="ckp-moment-time">{time}</span>
        <span className="ckp-moment-place" data-missing={missingPlace ? 'true' : undefined}>
          {place}
        </span>
      </span>
      {caption ? <figcaption className="ckp-moment-caption">{caption}</figcaption> : null}
    </figure>
  );
}

/**
 * Volet « Moments » du drawer : une carte par moment, deux colonnes.
 *
 * Les moments se regroupent par jour dès que la liste en couvre plusieurs :
 * le repère du jour (`J2 · 27 sept.`) vit dans sa propre pastille, jamais à
 * même le verre. Sur une page de jour, il n'y a qu'un groupe : le repère est
 * alors porté par l'en-tête du drawer, la grille commence donc directement.
 *
 * Aucune donnée n'est recalculée : l'heure, le lieu et la légende sont ceux du
 * moment ; une valeur absente s'écrit `—`. Aucun texte d'état vide : glyphe
 * et tiret, comme partout dans la feuille.
 */
export function CarnetMomentsPane({ detail, day }: CarnetMomentsPaneProps) {
  const moments = useMemo(() => (day ? day.moments : detail.moments), [day, detail.moments]);
  const groups = useMemo(() => groupByDay(moments, detail.days ?? []), [detail.days, moments]);
  /* Le repère de jour n'a de sens que si la liste en couvre plusieurs. */
  const withDayHeader = groups.length > 1;

  if (moments.length === 0) {
    return (
      <div className="ckp-pane ckp-pane-moments">
        <CarnetEmpty icon={<Icon name="clock" size={32} aria-hidden="true" />} label="Aucun moment" />
      </div>
    );
  }

  return (
    <div className="ckp-pane ckp-pane-moments">
      {groups.map((group) => (
        <section className="ckp-moment-day" key={group.dayNumber} aria-label={`Moments du jour ${group.dayNumber}`}>
          {withDayHeader ? (
            <p className="ckp-moment-daypill">
              <b>{group.dayLabel}</b>
              {group.dateLabel ? <span>{group.dateLabel}</span> : null}
              <span className="ckp-moment-daycount">
                {group.moments.length} {group.moments.length > 1 ? 'moments' : 'moment'}
              </span>
            </p>
          ) : null}
          <div className="ckp-moment-grid">
            {group.moments.map((moment) => (
              <MomentCard key={moment.id} moment={moment} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

export default CarnetMomentsPane;
