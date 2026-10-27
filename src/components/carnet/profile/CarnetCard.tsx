'use client';

import React from 'react';
import { AccountAuthorPill } from '@/components/account/AccountAuthorPill';
import type { CarnetStatsTab } from '@/features/carnet/detail/stats';
import { CarnetMediaTabs } from './CarnetMediaTabs';
import { SfIcon, type SfIconName } from './sfIcons';
import { CARNET_PAGE_TABS, CarnetPages, carnetPageIndex, type CarnetPageId } from './CarnetPages';
import { extractCoords, projectToViewBox } from './traceGeometry';
import { PLACE_LINE_MISSING, placeLineParts } from '@/features/carnet/detail/place';
import type { CarnetDetail, CarnetParticipant } from '@/features/carnet/detail/types';

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
  onOpenPost: (index: number) => void;
  onDownloadGpx: () => void;
  likesPage?: React.ReactNode;
  commentsPage?: React.ReactNode;
  managePage?: React.ReactNode;
}

/**
 * Index du segment qui reçoit la lentille blanche dans la capsule.
 *
 * La capsule aligne quatre segments de 41,5 px, dans l'ordre du DOM :
 * ♥ 0 (J’aime), 💬 1 (Commentaires), ▦ 2 (Posts), 🗺 3 (Parcours).
 * Chacun ouvre une page réelle ; la lentille ne se pose donc que sur la page
 * affichée, et disparaît sur Gérer, Étapes, Matériel ou Nature.
 */
export function selectorLensIndex(page: CarnetPageId): number {
  switch (page) {
    case 'likes':
      return 0;
    case 'comments':
      return 1;
    case 'posts':
      return 2;
    case 'parcours':
      return 3;
    default:
      return -1;
  }
}

const SF_ICONS: Record<string, SfIconName> = {
  heart: 'heart',
  'message-square': 'bubble',
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

/**
 * Nom affiché d'un participant : le nom réel du profil public, à défaut son
 * handle. Un participant sans profil public garde sa ligne (initiale du handle,
 * ou la lettre de repli de `AccountAuthorPill`) — il n'est jamais supprimé.
 */
function participantLabel(person: CarnetParticipant): string {
  return person.name ?? person.handle ?? '';
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
  onOpenPost,
  onDownloadGpx,
  likesPage = null,
  commentsPage = null,
  managePage = null,
}: CarnetCardProps) {
  const traceCoords = extractCoords(detail.trace);
  const tracePath = projectToViewBox(traceCoords, 66, 9);
  /* Lieu réel de la fiche : aucune coordonnée n'est estimée ici. */
  const place = detail.place ?? { country: null, region: null, locality: null, lat: null, lng: null };
  /* Une ligne unique, du texte seul : lieu · jours · distance · dénivelé · dates.
     Aucune valeur inventée : un champ absent devient un tiret, et la ligne
     entière disparaît si le carnet n'a réellement rien à dire. */
  const placeLine = placeLineParts({
    place,
    fallback: detail.destination,
    daysCount: detail.days.length,
    distanceKm: detail.distanceKm,
    elevationM: detail.elevationM,
    dateRange: detail.dateRange,
  });
  const showPlaceLine = placeLine.some((part) => part !== PLACE_LINE_MISSING);
  const participants = detail.participants ?? [];
  const lensIndex = selectorLensIndex(page);

  return (
    /* `id="card"` : la feuille du post (OverlaySheet) s'ancre sur la carte,
       comme le post du Compte — mêmes marges, même cadre. */
    <section className="ckp-card" id="card" aria-label="Carte du carnet">
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

        {showPlaceLine ? (
          <p className="ckp-place-line">{placeLine.join(' · ')}</p>
        ) : null}

        {participants.length > 0 ? (
          <div className="ckp-people" role="list" aria-label="Participants au carnet">
            {participants.map((person) => (
              <span role="listitem" key={person.userId} className="ckp-person" data-role={person.role}>
                <AccountAuthorPill
                  name={participantLabel(person)}
                  handle={person.handle ?? undefined}
                  avatarUrl={person.avatarUrl}
                  href={`/profil/${person.userId}`}
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
        {/* Une seule lentille pour les quatre segments : elle glisse par `--i`,
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
