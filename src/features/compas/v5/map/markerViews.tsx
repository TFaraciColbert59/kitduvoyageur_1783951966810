'use client';

import { useId, useState, type CSSProperties, type MouseEvent } from 'react';
import { V5Icon, stayIcon, type V5IconName } from '../ui/icons';
import type { V5Photo, V5StayKind } from '../types';

/**
 * Contenu des marqueurs de la carte. La classe `in` est la pastille visible ET le bouton : `v5.css` la centre
 * sur le point (`.v5-mk > .in`). Tout texte arrive déjà traduit ; aucune chaîne n'est écrite ici.
 */

export function StepPin({
  text,
  label,
  active,
  onClick,
}: {
  text: string;
  label: string;
  active: boolean;
  onClick: (e: MouseEvent<HTMLButtonElement>) => void;
}) {
  return (
    <button type="button" className="in" aria-label={label} data-active={active ? 'true' : undefined} onClick={onClick}>
      <span aria-hidden="true">{text}</span>
    </button>
  );
}

/** Vignette ronde : la photo, ou l'illustration du type de nuit si elle manque ou ne charge pas. */
function Thumb({ photo, kind }: { photo: V5Photo | null; kind: V5StayKind }) {
  const [broken, setBroken] = useState(false);
  if (photo && !broken) {
    // Vignette Wikimedia déjà dimensionnée (≈ 480 px) : pas de passage par l'optimiseur d'images.
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={photo.url} alt="" loading="lazy" decoding="async" referrerPolicy="no-referrer" draggable={false} onError={() => setBroken(true)} />;
  }
  return (
    <span className="fb" aria-hidden="true">
      <V5Icon name={stayIcon(kind)} />
    </span>
  );
}

export function NightPin({
  label,
  title,
  photo,
  kind,
  priceLabel,
  booked,
  credit,
  offset,
  onClick,
}: {
  label: string;
  title: string;
  photo: V5Photo | null;
  kind: V5StayKind;
  priceLabel: string | null;
  booked: boolean;
  /** Crédit de la photo (auteur et licence) : lu par les lecteurs d'écran, repris en infobulle. */
  credit: string | null;
  offset: { offsetX: number; offsetY: number };
  onClick: (e: MouseEvent<HTMLButtonElement>) => void;
}) {
  const creditId = useId();
  const style = { '--dx': `${offset.offsetX}px`, '--dy': `${offset.offsetY}px` } as CSSProperties;
  return (
    <button type="button" className="in" aria-label={label} aria-describedby={credit ? creditId : undefined} title={title} style={style} onClick={onClick}>
      <span className="ph">
        <Thumb photo={photo} kind={kind} />
        {booked && (
          <span className="ok" aria-hidden="true">
            <V5Icon name='valider' size="xs" />
          </span>
        )}
      </span>
      {priceLabel && (
        <span className="tag" aria-hidden="true">
          {priceLabel}
        </span>
      )}
      {credit && (
        <span id={creditId} className="v5-sr">
          {credit}
        </span>
      )}
    </button>
  );
}

export function AltPin({
  label,
  title,
  photo,
  kind,
  credit,
  offset,
  onClick,
}: {
  label: string;
  title: string;
  photo: V5Photo | null;
  kind: V5StayKind;
  credit: string | null;
  offset: { offsetX: number; offsetY: number };
  onClick: (e: MouseEvent<HTMLButtonElement>) => void;
}) {
  const creditId = useId();
  const style = { '--dx': `${offset.offsetX}px`, '--dy': `${offset.offsetY}px` } as CSSProperties;
  return (
    <button type="button" className="in" aria-label={label} aria-describedby={credit ? creditId : undefined} title={title} style={style} onClick={onClick}>
      <span className="ph">
        <Thumb photo={photo} kind={kind} />
      </span>
      {credit && (
        <span id={creditId} className="v5-sr">
          {credit}
        </span>
      )}
    </button>
  );
}

export function PoiPin({
  icon,
  label,
  onClick,
}: {
  icon: V5IconName;
  label: string;
  onClick: (e: MouseEvent<HTMLButtonElement>) => void;
}) {
  return (
    <button type="button" className="in" aria-label={label} onClick={onClick}>
      <V5Icon name={icon} />
    </button>
  );
}

/** Nom du lieu à côté d'une pastille : décoratif, la pastille porte déjà son nom accessible. */
export function PlaceLabel({ text, dx, dy }: { text: string; dx: number; dy: number }) {
  return (
    <span className="in" aria-hidden="true">
      <span className="v5-mk-label__t" style={{ transform: `translate(${dx}px, ${dy}px)` }}>
        {text}
      </span>
    </span>
  );
}
