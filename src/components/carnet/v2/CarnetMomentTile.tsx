'use client';

import React from 'react';
import {
  AlertTriangle,
  Backpack,
  Camera,
  Check,
  Euro,
  Leaf,
  Mic,
  Quote,
  Type,
  Video,
} from 'lucide-react';
import type { CarnetMomentItem } from '@/features/carnet/detail/types';
import { MOMENT_TYPE_LABELS, type MomentType, isMomentType } from '@/features/carnet/detail/momentTypes';
import { CarnetVideoThumb } from './CarnetVideo';

/** Pictogramme de la pastille de type — maquette `TYPE_IC`. */
export const MOMENT_TYPE_ICONS: Record<MomentType, React.ComponentType<{ size?: number; strokeWidth?: number; 'aria-hidden'?: boolean }>> = {
  photo: Camera,
  video: Video,
  voice: Mic,
  text: Type,
  meet: Quote,
  spend: Euro,
  kit: Backpack,
  species: Leaf,
  inc: AlertTriangle,
};

/** Hauteurs (25–95 %) déterministes de la note vocale : mêmes barres à chaque rendu. */
export function waveHeights(seed: number, count = 14): number[] {
  const heights: number[] = [];
  for (let i = 0; i < count; i += 1) {
    heights.push(25 + Math.round(70 * Math.abs(Math.sin((i + seed) * 1.7) * Math.cos((i + seed) * 0.45))));
  }
  return heights;
}

function seedOf(id: string): number {
  let hash = 0;
  for (let i = 0; i < id.length; i += 1) hash = (hash * 31 + id.charCodeAt(i)) % 997;
  return hash;
}

const NB = ' ';

/** Libellé court d'un moment : légende, sinon titre, sinon lieu. */
function momentText(moment: CarnetMomentItem): string {
  return moment.caption?.trim() || moment.title?.trim() || moment.place?.trim() || '';
}

export function tileAriaLabel(moment: CarnetMomentItem, type: MomentType | null, pinned: boolean): string {
  const kind = type ? MOMENT_TYPE_LABELS[type] : 'Moment';
  const place = moment.place?.trim() || moment.title?.trim() || '';
  const parts = [place ? `${kind} : ${place}` : kind, moment.time].filter(Boolean).join(', ');
  return pinned ? `${parts}, épinglé` : parts;
}

export interface CarnetMomentTileBodyProps {
  moment: CarnetMomentItem;
  type: MomentType | null;
}

/** Corps de la tuile : l'image du moment ou l'aplat du type (`.tfill`). */
export function CarnetMomentTileBody({ moment, type }: CarnetMomentTileBodyProps) {
  const text = momentText(moment);
  if ((type === 'photo' || type === 'video') && moment.imageUrl) {
    /* Vidéo (proposition n° 31) : vignette vidéo inerte, jamais une image figée
       qui laisserait croire à une photo ; la tuile ouvre le moment comme avant. */
    if (type === 'video') return <CarnetVideoThumb src={moment.imageUrl} />;
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={moment.imageUrl} alt="" loading="lazy" decoding="async" />;
  }
  switch (type) {
    case 'voice':
      return (
        <div className="lkdv-tfill c-voice">
          <div className="wv" aria-hidden="true">
            {waveHeights(seedOf(moment.id)).map((height, i) => (
              <i key={i} style={{ height: `${height}%` }} />
            ))}
          </div>
          <small>
            {[moment.meta?.durationLabel, text].filter(Boolean).join(' · ')}
          </small>
        </div>
      );
    case 'text':
      return (
        <div className="lkdv-tfill c-text">
          <small>{text}</small>
        </div>
      );
    case 'meet':
      return (
        <div className="lkdv-tfill c-meet">
          <small>{`«${NB}${text}${NB}»`}</small>
        </div>
      );
    case 'spend': {
      const amount = moment.meta?.amountEur;
      return (
        <div className="lkdv-tfill c-spend">
          {typeof amount === 'number' ? <big>{`${amount}${NB}€`}</big> : null}
          <small>{text}</small>
        </div>
      );
    }
    case 'kit':
      return (
        <div className="lkdv-tfill c-kit">
          <Backpack className="ic" size={22} strokeWidth={1.6} aria-hidden />
          <small>{text}</small>
        </div>
      );
    case 'species':
      return (
        <div className="lkdv-tfill c-species">
          <Leaf className="ic" size={22} strokeWidth={1.6} aria-hidden />
          <small>{text}</small>
        </div>
      );
    case 'inc':
      return (
        <div className="lkdv-tfill c-inc">
          <AlertTriangle className="ic" size={22} strokeWidth={1.6} aria-hidden />
          <small>{text}</small>
        </div>
      );
    default:
      return (
        <div className="lkdv-tfill c-text">
          <small>{text || 'Moment'}</small>
        </div>
      );
  }
}

/** Pastille de type (icône seule, en haut à droite) — `.t-type`. */
export function CarnetTileTypeBadge({ type }: { type: MomentType | null }) {
  if (!type || !isMomentType(type)) return null;
  const Icon = MOMENT_TYPE_ICONS[type];
  return (
    <span className="lkdv-ig-tile-type" data-type={type} aria-hidden="true">
      <Icon size={12} strokeWidth={2.1} aria-hidden />
    </span>
  );
}

/** Coche d'épinglage — `.t-pinned`. */
export function CarnetTilePinned() {
  return (
    <span className="lkdv-ig-tile-pinned" aria-hidden="true">
      <Check size={9} strokeWidth={2.6} aria-hidden />
    </span>
  );
}
