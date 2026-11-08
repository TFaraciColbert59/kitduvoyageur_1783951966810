'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import AppImage from '@/components/ui/AppImage';
import type { CarnetCardVM } from '../../shared/types';
import { formatCountFr, formatDays, formatKm } from '../../shared/format';
import { ExploreIcon } from '../ExploreIcons';
import { useLongPress } from '../useLongPress';

export interface CarnetTileV2Props {
  carnet: CarnetCardVM;
  /** Pleine largeur (carnet de la semaine, Carnets#3). */
  wide?: boolean;
  /** Badge « Carnet de la semaine » (tuile vedette du filtre Découvrir). */
  week?: boolean;
  /** Distance « Près de moi » affichée dans la méta (Carnets#7). */
  showDistance?: boolean;
  /** Envoi du j'aime en cours : bouton occupé, pas de double envoi. */
  likeBusy?: boolean;
  onLike: (carnet: CarnetCardVM) => void;
  onPeek: (carnet: CarnetCardVM, opener: HTMLElement) => void;
}

function visaLabel(carnet: CarnetCardVM): string {
  if (carnet.days != null && carnet.distanceKm != null) {
    return `${formatDays(carnet.days)} · ${formatKm(carnet.distanceKm)}`;
  }
  if (carnet.days != null) return formatDays(carnet.days);
  if (carnet.distanceKm != null) return formatKm(carnet.distanceKm);
  return 'Carnet';
}

function tracePath(trace: ReadonlyArray<[number, number]>): string {
  return trace.map(([x, y], index) => `${index === 0 ? 'M' : 'L'}${x} ${y}`).join(' ');
}

/**
 * Tuile carnet (signature du volet, Carnets#1-12) : couverture au verre de
 * `/compte`, tampon de visa (jours · km), trace en filigrane, anneau « En
 * route », badge « Trace GPS vérifiée », voyageurs empilés et j'aime de 44 px
 * hors du lien. La tuile entière est un seul lien ; l'appui long ouvre le Peek.
 */
export function CarnetTileV2({
  carnet,
  wide = false,
  week = false,
  showDistance = false,
  likeBusy = false,
  onLike,
  onPeek,
}: CarnetTileV2Props) {
  const [pop, setPop] = useState(false);
  const longPress = useLongPress({ onLongPress: (element) => onPeek(carnet, element) });

  useEffect(() => {
    if (!carnet.likedByMe) {
      setPop(false);
      return;
    }
    setPop(true);
    const timer = window.setTimeout(() => setPop(false), 420);
    return () => window.clearTimeout(timer);
  }, [carnet.likedByMe]);

  const metaParts = [
    carnet.destination || null,
    carnet.days != null ? formatDays(carnet.days) : null,
    carnet.distanceKm != null ? formatKm(carnet.distanceKm) : null,
    showDistance && carnet.distanceKmFromMe != null ? `à ${formatKm(carnet.distanceKmFromMe)}` : null,
  ].filter(Boolean);

  const likeLabel = carnet.likedByMe ? 'Retirer mon j’aime' : 'J’aime';
  const ariaLabel = [
    carnet.title,
    carnet.destination,
    carnet.days != null ? formatCountFr(carnet.days, 'jour') : '',
    carnet.distanceKm != null ? `${formatKm(carnet.distanceKm)} de parcours` : '',
    `par ${carnet.author.name}`,
    carnet.isLive ? 'en route' : '',
    carnet.verifiedGps ? 'trace GPS vérifiée' : '',
  ]
    .filter(Boolean)
    .join(', ');

  return (
    <article
      className={`lkdv-cv2-tile lkdv-cv2x-carnet${wide ? ' lkdv-cv2-tile--wide' : ''}${week ? ' is-week' : ''}`}
      data-testid="cv2-tile-carnet"
      data-id={carnet.id}
      {...longPress}
    >
      <Link
        className="lkdv-cv2x-tile-link"
        href={`/carnets/${carnet.id}`}
        aria-label={ariaLabel}
        data-cv2-testid="carnet-link"
      >
        <span
          className={`lkdv-cv2-cover lkdv-cv2x-carnet-cover${carnet.coverImage ? ' has-image' : ''}`}
        >
          {carnet.coverImage ? (
            <AppImage
              src={carnet.coverImage}
              alt={carnet.coverAlt ?? ''}
              fill
              sizes="(max-width: 430px) 50vw, 200px"
              className="lkdv-cv2x-cover-img"
            />
          ) : (
            <span className="lkdv-cv2x-cover-fallback" aria-hidden="true" />
          )}
          {carnet.routeTrace && carnet.routeTrace.length > 1 ? (
            <svg
              className="lkdv-cv2-trace lkdv-cv2x-cover-trace"
              viewBox="0 0 100 100"
              preserveAspectRatio="xMidYMid meet"
              aria-hidden="true"
            >
              <path d={tracePath(carnet.routeTrace)} />
              <circle cx={carnet.routeTrace[0]?.[0]} cy={carnet.routeTrace[0]?.[1]} r={1.8} />
              <circle
                cx={carnet.routeTrace[carnet.routeTrace.length - 1]?.[0]}
                cy={carnet.routeTrace[carnet.routeTrace.length - 1]?.[1]}
                r={1.8}
              />
            </svg>
          ) : null}
          {week ? <span className="lkdv-cv2x-carnet-week">Carnet de la semaine</span> : null}
          {carnet.isLive ? (
            <span className="lkdv-cv2x-live">
              <i aria-hidden="true" />
              En route
            </span>
          ) : null}
          {carnet.verifiedGps ? (
            <span className="lkdv-cv2x-gps" title="Trace GPS vérifiée">
              <ExploreIcon name="shield" size={12} />
              GPS
            </span>
          ) : null}
          <span className="lkdv-cv2-visa lkdv-cv2x-visa" aria-hidden="true">
            {/* Maquette (`maquette-communaute.html` L2321) : le visa porte
                « 4 J · 62,4 KM ». Le code pays n'est pas exposé par les données
                (Carnets#2, documenté) : on n'affiche donc que la ligne durée ·
                distance, sans la 2e ligne « n VOYAGEURS » ajoutée par la V2. */}
            <b>{visaLabel(carnet)}</b>
          </span>
        </span>

        <span className="lkdv-cv2x-carnet-body">
          <span className="lkdv-cv2-title lkdv-cv2x-carnet-title">{carnet.title}</span>
          {metaParts.length > 0 ? (
            <span className="lkdv-cv2-meta">{metaParts.join(' · ')}</span>
          ) : null}
        </span>
      </Link>

      <div className="lkdv-cv2x-tile-foot">
        <span className="lkdv-cv2-avatars" aria-hidden="true">
          {carnet.travelers.slice(0, 3).map((traveler) => (
            <span key={traveler.id || traveler.name} className="lkdv-cv2-avatar">
              {traveler.avatarUrl ? (
                <AppImage
                  src={traveler.avatarUrl}
                  alt=""
                  width={28}
                  height={28}
                  className="lkdv-cv2x-avatar-img"
                />
              ) : (
                traveler.initials.slice(0, 1)
              )}
            </span>
          ))}
          {carnet.travelersTotal > carnet.travelers.length ? (
            <span className="lkdv-cv2-avatar lkdv-cv2-avatar--more">
              +{carnet.travelersTotal - carnet.travelers.length}
            </span>
          ) : null}
        </span>

        <button
          type="button"
          className={`lkdv-cv2x-like${carnet.likedByMe ? ' is-on' : ''}`}
          aria-pressed={carnet.likedByMe}
          aria-label={`${likeLabel} : ${carnet.likesCount}`}
          aria-busy={likeBusy || undefined}
          disabled={likeBusy}
          onClick={() => onLike(carnet)}
          data-testid="cv2-carnet-like"
          data-id={carnet.id}
        >
          <span className={pop ? 'lkdv-cv2x-heart is-pop' : 'lkdv-cv2x-heart'}>
            <ExploreIcon name={carnet.likedByMe ? 'heart-filled' : 'heart'} size={17} />
          </span>
          <span className="lkdv-cv2-num">{carnet.likesCount}</span>
        </button>

        <Link
          className="lkdv-cv2x-comments"
          href={`/carnets/${carnet.id}?commentaires=1`}
          aria-label={`Commentaires : ${carnet.commentsCount}`}
        >
          <ExploreIcon name="comment" size={16} />
          <span className="lkdv-cv2-num">{carnet.commentsCount}</span>
        </Link>
      </div>
    </article>
  );
}

export default CarnetTileV2;
