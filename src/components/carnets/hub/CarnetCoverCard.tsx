import React from 'react';
import Link from 'next/link';
import AppImage from '@/components/ui/AppImage';
import Icon from '@/components/ui/Icon';
import type { CarnetHubItem } from '@/features/carnet/hub/types';
import { CarnetHubTopo } from './CarnetHubTopo';
import {
  cardAriaLabel,
  coverInitial,
  coverKicker,
  daysMetricLabel,
  dPlusMetricLabel,
  kmMetricLabel,
  liveStatusLabel,
  stampLines,
} from './labels';

/**
 * Carte de couverture du hub (maquette écran 1, propositions n° 2, 3, 10, 12) :
 * couverture portrait 4/5, voile encre, titre Instrument Serif italique,
 * tampon de pays pointillé, tracé en filigrane, trois métriques mono, avatars
 * empilés. Le j'aime (44 px) est **hors du lien** : la carte entière ouvre
 * `/carnets/{id}`.
 */
export interface CarnetCoverCardProps {
  item: CarnetHubItem;
  /** Envoi du j'aime en cours : bouton occupé, pas de double envoi. */
  likeBusy?: boolean;
  onLike: (item: CarnetHubItem) => void;
}

/** Chemin SVG du tracé normalisé (`normalizeRouteTrace` : points 0-100). */
function tracePath(trace: ReadonlyArray<[number, number]>): string {
  return trace.map(([x, y], index) => `${index === 0 ? 'M' : 'L'}${x} ${y}`).join(' ');
}

export function CarnetCoverCard({ item, likeBusy = false, onLike }: CarnetCoverCardProps) {
  const live = liveStatusLabel(item);
  const days = daysMetricLabel(item);
  const km = kmMetricLabel(item);
  const dPlus = dPlusMetricLabel(item);
  const stamp = stampLines(item);
  const hasPhoto = Boolean(item.coverImage);
  const hasMosaic = !hasPhoto && item.coverPhotos.length > 0;
  const trace = item.routeTrace && item.routeTrace.length > 1 ? item.routeTrace : null;
  const first = trace ? trace[0] : null;
  const last = trace ? trace[trace.length - 1] : null;
  const travelers = item.travelers.slice(0, 3);
  const moreTravelers = Math.max(0, item.travelersTotal - travelers.length);
  const likeLabel = item.likedByMe ? 'Retirer mon j’aime' : 'J’aime';
  const hasMetrics = Boolean(days || km || dPlus || travelers.length > 0);

  return (
    <li className="lkdh-card" data-testid="lkdh-carnet" data-id={item.id} data-phase={item.phase}>
      <Link
        className="lkdh-card-link"
        href={`/carnets/${item.id}`}
        aria-label={cardAriaLabel(item)}
        data-testid="lkdh-carnet-link"
        data-id={item.id}
      >
        <span className={`lkdh-cover${hasPhoto ? ' has-image' : ''}`}>
          {item.coverImage ? (
            <AppImage
              src={item.coverImage}
              alt={item.destination ? `${item.title} — ${item.destination}` : item.title}
              fill
              sizes="(max-width: 520px) 100vw, 500px"
              className="lkdh-cover-img"
            />
          ) : hasMosaic ? (
            <span className="lkdh-mosaic">
              {item.coverPhotos.slice(0, 3).map((photo, index) => (
                <span key={`${photo}-${index}`} className="lkdh-mosaic-cell">
                  <AppImage
                    src={photo}
                    alt={
                      index === 0
                        ? `Photo du carnet ${item.title}${item.destination ? ` — ${item.destination}` : ''}`
                        : ''
                    }
                    fill
                    sizes="(max-width: 520px) 60vw, 320px"
                    className="lkdh-mosaic-img"
                  />
                </span>
              ))}
            </span>
          ) : (
            <CarnetHubTopo initial={coverInitial(item)} />
          )}

          <span className="lkdh-veil" aria-hidden="true" />

          {trace && first && last ? (
            <svg
              className="lkdh-trace"
              viewBox="0 0 100 100"
              preserveAspectRatio="none"
              aria-hidden="true"
              focusable="false"
            >
              <path d={tracePath(trace)} />
              <circle cx={first[0]} cy={first[1]} r={1.8} />
              <circle className="lkdh-trace-end" cx={last[0]} cy={last[1]} r={2.6} />
            </svg>
          ) : null}

          {live ? (
            <span className="lkdh-live">
              <i aria-hidden="true" />
              {live}
            </span>
          ) : null}

          <span className="lkdh-stamp" aria-hidden="true">
            {stamp.map((line, index) =>
              index === 0 ? <b key={`${line}-${index}`}>{line}</b> : <span key={`${line}-${index}`}>{line}</span>,
            )}
          </span>

          <span className="lkdh-cover-body">
            <span className="lkdh-cover-kicker">{coverKicker(item)}</span>
            <span className="lkdh-cover-title">{item.title}</span>
            {hasMetrics ? (
              <span className="lkdh-metrics">
                {days ? (
                  <span className="lkdh-metric">
                    <b>{days}</b>
                    <span>jours</span>
                  </span>
                ) : null}
                {km ? (
                  <span className="lkdh-metric">
                    <b>{km}</b>
                    <span>km parcourus</span>
                  </span>
                ) : null}
                {dPlus ? (
                  <span className="lkdh-metric">
                    <b>{dPlus}</b>
                    <span>m D+</span>
                  </span>
                ) : null}
                <span className="lkdh-avatars" aria-hidden="true">
                  {travelers.map((traveler) => (
                    <span key={traveler.id || traveler.name} className="lkdh-avatar">
                      {traveler.avatarUrl ? (
                        <AppImage
                          src={traveler.avatarUrl}
                          alt=""
                          width={26}
                          height={26}
                          className="lkdh-avatar-img"
                        />
                      ) : (
                        traveler.initials.slice(0, 1)
                      )}
                    </span>
                  ))}
                  {moreTravelers > 0 ? (
                    <span className="lkdh-avatar lkdh-avatar--more">+{moreTravelers}</span>
                  ) : null}
                </span>
              </span>
            ) : null}
          </span>
        </span>
      </Link>

      <span className="lkdh-card-foot">
        <span className="lkdh-foot-author">par {item.author.name}</span>
        {item.verifiedGps ? (
          <span className="lkdh-gps" title="Trace GPS vérifiée">
            <Icon name="shield-check" size={13} aria-hidden="true" />
            <span>GPS</span>
          </span>
        ) : null}
        <button
          type="button"
          className="lkdh-like"
          aria-pressed={item.likedByMe}
          aria-label={`${likeLabel} : ${item.likesCount}`}
          aria-busy={likeBusy || undefined}
          disabled={likeBusy}
          onClick={() => onLike(item)}
          data-testid="lkdh-carnet-like"
          data-id={item.id}
        >
          <span className="lkdh-heart">
            <Icon name="heart" size={17} aria-hidden="true" />
          </span>
          <span>{item.likesCount}</span>
        </button>
        <Link
          className="lkdh-comments"
          href={`/carnets/${item.id}?commentaires=1`}
          aria-label={`Commentaires : ${item.commentsCount}`}
        >
          <Icon name="message-square" size={16} aria-hidden="true" />
          <span>{item.commentsCount}</span>
        </Link>
      </span>
    </li>
  );
}

export default CarnetCoverCard;
