'use client';

import React, { useCallback, useMemo } from 'react';
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
 * La capsule est celle de `/compte` : 88 × 30, deux segments de 41,5 px, dans
 * l'ordre du DOM — ▦ 0 (Posts), 🗺 1 (Parcours). Les deux actions ♥ et 💬 sont
 * sorties de la capsule : elles ne portent jamais la lentille, et elle
 * disparaît sur J’aime, Commentaires, Gérer, Étapes, Matériel ou Nature.
 */
export function selectorLensIndex(page: CarnetPageId): number {
  switch (page) {
    case 'posts':
      return 0;
    case 'parcours':
      return 1;
    default:
      return -1;
  }
}

/** Les deux seuls segments de la capsule : la référence, une fois pour toutes. */
const CAPSULE_TABS = CARNET_PAGE_TABS.slice(0, 2);

const SF_ICONS: Record<string, SfIconName> = {
  heart: 'heart',
  'message-square': 'bubble',
  map: 'map',
};

/**
 * Action ronde du pied de carte : bouton verre de 30 px, à gauche de la
 * capsule — même matière qu'elle, aucun texte visible, l'icône seule.
 */
function Action({
  icon,
  label,
  count,
  onClick,
  current,
}: {
  icon: string;
  label: string;
  count?: number;
  onClick: () => void;
  /** La page de ce bouton est affichée : encre verte sur le disque. */
  current?: boolean;
}) {
  return (
    <button
      type="button"
      className="ckp-action"
      data-icon={icon}
      onClick={onClick}
      aria-current={current ? 'page' : undefined}
      aria-label={typeof count === 'number' ? `${label}, ${count}` : label}
      title={label}
    >
      <SfIcon name={SF_ICONS[icon] ?? 'ellipsis'} size={16} />
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
  /* Tracé et ligne de lieu : purs, donc calculés une fois par carnet et non
     à chaque bascule d'engagement ou de page. */
  const tracePath = useMemo(() => projectToViewBox(extractCoords(detail.trace), 66, 9), [detail.trace]);
  /* Une ligne unique, du texte seul : lieu · jours · distance · dénivelé · dates.
     Aucune valeur inventée : un champ absent devient un tiret, et la ligne
     entière disparaît si le carnet n'a réellement rien à dire. */
  const placeLine = useMemo(() => {
    /* Lieu réel de la fiche : aucune coordonnée n'est estimée ici. */
    const place = detail.place ?? { country: null, region: null, locality: null, lat: null, lng: null };
    return placeLineParts({
      place,
      fallback: detail.destination,
      daysCount: detail.days.length,
      distanceKm: detail.distanceKm,
      elevationM: detail.elevationM,
      dateRange: detail.dateRange,
    });
  }, [
    detail.place,
    detail.destination,
    detail.days.length,
    detail.distanceKm,
    detail.elevationM,
    detail.dateRange,
  ]);
  const showPlaceLine = placeLine.some((part) => part !== PLACE_LINE_MISSING);
  const participants = detail.participants ?? [];
  const lensIndex = selectorLensIndex(page);

  /* Les deux segments de la capsule : handler stable, donc la lentille et les
     boutons ne se remontent pas quand la carte se redessine. */
  const onCapsuleChange = useCallback(
    (index: number) => onPageChange(CAPSULE_TABS[index].id),
    [onPageChange],
  );

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
        {/* Les deux actions vivent hors de la capsule : deux boutons ronds de
            30 px, 8 px à sa gauche, même matière, aucun texte. */}
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

        {/* La capsule de `/compte` : 88 × 30, deux segments, une seule lentille
            qui glisse par `--i` sous les boutons (`z-index` 0 contre 1). */}
        <div className="ckp-capsule">
          <span
            className="ckp-th"
            aria-hidden="true"
            data-off={lensIndex < 0 ? 'true' : undefined}
            style={{ '--i': Math.max(0, lensIndex) } as React.CSSProperties}
          />
          <CarnetMediaTabs
            items={CAPSULE_TABS}
            activeIndex={carnetPageIndex(page) < 2 ? carnetPageIndex(page) : -1}
            onChange={onCapsuleChange}
            ariaLabel="Grille ou carte"
          />
        </div>
      </div>
    </section>
  );
}

export default CarnetCard;
