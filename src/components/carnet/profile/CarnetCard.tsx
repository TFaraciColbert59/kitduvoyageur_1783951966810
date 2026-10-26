'use client';

import React from 'react';
import Icon from '@/components/ui/Icon';
import { AccountAuthorPill } from '@/components/account/AccountAuthorPill';
import type { CarnetStatsTab } from '@/features/carnet/detail/stats';
import { CarnetMediaTabs } from './CarnetMediaTabs';
import { SfIcon, type SfIconName } from './sfIcons';
import { CARNET_PAGE_TABS, CarnetPages, carnetPageIndex, type CarnetPageId } from './CarnetPages';
import { extractCoords, projectToViewBox, traceCenter } from './traceGeometry';
import { placeSegments } from '@/features/carnet/detail/place';
import type { CarnetDetail } from '@/features/carnet/detail/types';

/** Cible de recentrage de la carte du bas, toujours issue d'une coordonnée réelle. */
export interface CarnetPlaceFocus {
  lat: number;
  lng: number;
  zoom: number;
}

export interface CarnetCardProps {
  detail: CarnetDetail;
  /** Page active du carrousel média, mémorisée par l'écran. */
  page: CarnetPageId;
  onPageChange: (page: CarnetPageId) => void;
  canWrite: boolean;
  onRequireAuth: () => void;
  onOpenCarnet: () => void;
  onOpenStat: (stat: CarnetStatsTab) => void;
  /** Les actions du sélecteur ouvrent une page, jamais un drawer. */
  onOpenComments: () => void;
  onOpenLikes: () => void;
  onOpenParcours: () => void;
  onOpenManage: () => void;
  onSave: () => void;
  onOpenMenu: () => void;
  onFocusPlace: (focus: CarnetPlaceFocus) => void;
  menu?: React.ReactNode;
  onOpenPost: (index: number) => void;
  onDownloadGpx: () => void;
  likesPage?: React.ReactNode;
  commentsPage?: React.ReactNode;
  managePage?: React.ReactNode;
}

/**
 * Index du segment qui reçoit la lentille blanche dans la capsule.
 *
 * La capsule aligne sept segments de 41,5 px : ♥ 0, 💬 1, 🔖 2, ✏️ 3,
 * ··· 4, grille 5, carte 6. La lentille ne se pose que sur une vue ou sur la
 * page affichée ; Enregistrer, Plus et les pages hors sélecteur n'en ont pas.
 */
export function selectorLensIndex(page: CarnetPageId, isOwner: boolean): number {
  switch (page) {
    case 'likes':
      return 0;
    case 'comments':
      return 1;
    case 'manage':
      return isOwner ? 3 : -1;
    case 'posts':
      return 5;
    case 'parcours':
      return 6;
    default:
      return -1;
  }
}

const SF_ICONS: Record<string, SfIconName> = {
  heart: 'heart',
  'message-square': 'bubble',
  bookmark: 'bookmark',
  pencil: 'pencil',
  'more-horizontal': 'ellipsis',
  map: 'map',
};

function Action({
  icon,
  label,
  count,
  onClick,
  pressed,
  current,
}: {
  icon: string;
  label: string;
  count?: number;
  onClick: () => void;
  pressed?: boolean;
  /** La page de ce bouton est affichée : encre verte, sans lentille en double. */
  current?: boolean;
}) {
  const hasCount = typeof count === 'number' && count > 0;
  return (
    <button
      type="button"
      className={hasCount ? 'ckp-action ckp-action--count' : 'ckp-action'}
      data-icon={icon}
      onClick={onClick}
      aria-pressed={pressed}
      aria-current={current ? 'page' : undefined}
      aria-label={typeof count === 'number' ? `${label}, ${count}` : label}
      title={label}
    >
      <span className="ckp-action-btn">
        <span className="ckp-action-in">
          <SfIcon name={SF_ICONS[icon] ?? 'ellipsis'} size={17} />
        </span>
        {hasCount ? (
          <span className="ckp-action-count" aria-hidden="true">
            {count}
          </span>
        ) : null}
      </span>
    </button>
  );
}

interface Participant {
  id: string;
  name: string;
  handle: string | null;
  avatarUrl: string | null;
}

/** Participants réels : l'auteur puis les likers distincts. Aucune donnée inventée. */
function participantsOf(detail: CarnetDetail): Participant[] {
  const seen = new Set<string>();
  const list: Participant[] = [];
  const push = (entry: Participant | null | undefined) => {
    if (!entry?.id || seen.has(entry.id)) return;
    seen.add(entry.id);
    list.push(entry);
  };
  push(detail.author);
  for (const liker of detail.likers ?? []) push(liker);
  return list;
}

/** Carte du carnet : mini tracé, statistiques, participants, lieu, médias en pages. */
export function CarnetCard({
  detail,
  page,
  onPageChange,
  canWrite,
  onRequireAuth,
  onOpenCarnet,
  onOpenStat,
  onOpenComments,
  onOpenLikes,
  onOpenParcours,
  onOpenManage,
  onSave,
  onOpenMenu,
  onFocusPlace,
  menu = null,
  onOpenPost,
  onDownloadGpx,
  likesPage = null,
  commentsPage = null,
  managePage = null,
}: CarnetCardProps) {
  const traceCoords = extractCoords(detail.trace);
  const tracePath = projectToViewBox(traceCoords, 66, 9);
  const center = traceCenter(traceCoords);
  /* Le centre de la trace reste la cible du recentrage (comportement validé) ;
     les coordonnées réelles du lieu prennent le relais sur un carnet sans trace. */
  const place = detail.place ?? { country: null, region: null, locality: null, lat: null, lng: null };
  const placeFocus: CarnetPlaceFocus | null = center
    ? { ...center, zoom: 10 }
    : place.lat !== null && place.lng !== null
      ? { lat: place.lat, lng: place.lng, zoom: 10 }
      : null;
  const placePills = placeSegments(place, detail.destination);
  const participants = participantsOf(detail);
  const lensIndex = selectorLensIndex(page, detail.isOwner);

  return (
    <section className="ckp-card" aria-label="Carte du carnet">
      <div className="ckp-card-scroll">
        <div className="ckp-head">
          <button
            type="button"
            className="ckp-cover-btn"
            onClick={onOpenCarnet}
            aria-label="Ouvrir le carnet"
          >
            {tracePath ? (
              <span className="ckp-cover ckp-cover--trace" aria-hidden="true">
                <svg viewBox="0 0 66 66" width="62" height="62" focusable="false">
                  <polyline
                    points={tracePath}
                    fill="none"
                    stroke="rgba(255,255,255,.9)"
                    strokeWidth="4.6"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <polyline
                    points={tracePath}
                    fill="none"
                    stroke="#17402c"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </span>
            ) : (
              <span className="ckp-cover ckp-cover--initial">
                {(detail.destination ?? detail.title).charAt(0).toUpperCase()}
              </span>
            )}
          </button>

          <div className="ckp-id-stats">
            {detail.stats.map((stat) => (
              <button
                key={stat.key}
                type="button"
                className="ckp-stat"
                onClick={() => onOpenStat(stat.key)}
                aria-label={`${stat.label} ${stat.value}`}
              >
                <b className="ckp-stat-v">{stat.value}</b>
                <span className="ckp-stat-l">{stat.label}</span>
              </button>
            ))}
          </div>
        </div>

        {detail.description ? <p className="ckp-bio-line">{detail.description}</p> : null}

        {placePills.length > 0 || detail.dateRange ? (
          <div className="ckp-place-row">
            {placePills.map((segment, index) => (
              <button
                key={segment.key}
                type="button"
                className="ckp-place-pill"
                onClick={() => placeFocus && onFocusPlace(placeFocus)}
                disabled={!placeFocus}
                aria-label={`Recentrer la carte sur ${segment.label}`}
              >
                {index === 0 ? <Icon name="map-pin" size={12} aria-hidden="true" /> : null}
                <span>{segment.label}</span>
              </button>
            ))}
            {detail.dateRange ? <span className="ckp-place-date">{detail.dateRange}</span> : null}
          </div>
        ) : null}

        {participants.length > 0 ? (
          <div className="ckp-people" role="list" aria-label="Participants au carnet">
            {participants.map((person) => (
              <span role="listitem" key={person.id} className="ckp-person">
                <AccountAuthorPill
                  name={person.name}
                  handle={person.handle ?? undefined}
                  avatarUrl={person.avatarUrl}
                  href={`/profil/${person.id}`}
                />
              </span>
            ))}
          </div>
        ) : null}

        <div className="ckp-media">
          <CarnetPages
            detail={detail}
            page={page}
            onPageChange={onPageChange}
            canWrite={canWrite}
            onRequireAuth={onRequireAuth}
            onOpenPost={onOpenPost}
            onDownloadGpx={onDownloadGpx}
            likesPage={likesPage}
            commentsPage={commentsPage}
            managePage={managePage}
          />
        </div>
      </div>

      <div className="ckp-card-foot">
        {/* Une seule lentille pour les sept segments : elle glisse par `--i`,
            ne se pose que sur la vue ou la page active, et reste sous les
            boutons (`z-index` 0 contre 1). */}
        <span
          className="ckp-th"
          aria-hidden="true"
          data-off={lensIndex < 0 ? 'true' : undefined}
          style={{ '--i': Math.max(0, lensIndex) } as React.CSSProperties}
        />
        <div className="ckp-actions" role="group" aria-label="Actions du carnet">
          <Action
            icon="heart"
            label="J’aime"
            count={detail.engagement.likes}
            onClick={onOpenLikes}
            current={page === 'likes'}
          />
          <Action
            icon="message-square"
            label="Commenter"
            count={detail.engagement.comments}
            onClick={onOpenComments}
            current={page === 'comments'}
          />
          <Action
            icon="bookmark"
            label={detail.engagement.favorited ? 'Enregistré' : 'Enregistrer'}
            onClick={onSave}
            pressed={detail.engagement.favorited}
          />
          {detail.isOwner ? (
            <Action icon="pencil" label="Gérer" onClick={onOpenManage} current={page === 'manage'} />
          ) : (
            <Action icon="map" label="Parcours" onClick={onOpenParcours} />
          )}
          <span className="ckp-more-anchor">
            <button type="button" className="ckp-action" data-icon="more" onClick={onOpenMenu} aria-label="Plus d’options">
              <span className="ckp-action-btn">
                <span className="ckp-action-in">
                  <Icon name="more-horizontal" size={16} aria-hidden="true" />
                </span>
              </span>
            </button>
            {menu}
          </span>
        </div>

        <span className="ckp-foot-sep" aria-hidden="true" />

        <CarnetMediaTabs
          items={CARNET_PAGE_TABS.slice(0, 2)}
          activeIndex={carnetPageIndex(page) < 2 ? carnetPageIndex(page) : -1}
          onChange={(index) => onPageChange(CARNET_PAGE_TABS[index].id)}
          ariaLabel="Grille ou carte"
        />
      </div>
    </section>
  );
}

export default CarnetCard;
