'use client';

import React, { useCallback, useMemo } from 'react';
import { AccountAuthorPill } from '@/components/account/AccountAuthorPill';
import Icon from '@/components/ui/Icon';
import type { CarnetStatsTab } from '@/features/carnet/detail/stats';
import { CarnetMediaTabs } from './CarnetMediaTabs';
import { CARNET_PAGE_TABS, CarnetPages, carnetPageIndex, type CarnetPageId } from './CarnetPages';
import { CarnetDayHeader } from './CarnetDayHeader';
import { useDayMotion, useDaySwipe } from './CarnetDaySwipe';
import { extractCoords, projectToViewBox } from './traceGeometry';
import { PLACE_LINE_MISSING, placeLineParts } from '@/features/carnet/detail/place';
import type { CarnetDetail, CarnetMomentItem, CarnetParticipant } from '@/features/carnet/detail/types';

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
  onOpenPost: (index: number) => void;
  onDownloadGpx: () => void;
  likesPage?: React.ReactNode;
  commentsPage?: React.ReactNode;
  managePage?: React.ReactNode;
  /**
   * Page de jour affichée : `0` = Résumé, puis un jour par page dérivée.
   * Fournie par l'écran, elle pilote aussi la carte du bas ; absente, la carte
   * garde son propre état (usage isolé, tests).
   */
  dayPage?: number;
  /** Reçoit chaque changement de page de jour, déjà borné. */
  onDayPageChange?: (page: number) => void;
}

/**
 * Index du segment qui reçoit la lentille blanche dans la capsule.
 *
 * La capsule est celle de `/compte` et des drawers : 88 × 30, deux segments de
 * 41,5 px, dans l'ordre du DOM — ▦ 0 (Posts), 🗺 1 (Parcours). Les pages
 * J’aime, Commentaires, Gérer, Étapes, Matériel et Nature n'ont pas de segment :
 * leur lentille disparaît (`data-off`).
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

/**
 * Nom affiché d'un participant : le nom réel du profil public, à défaut son
 * handle. Un participant sans profil public garde sa ligne (initiale du handle,
 * ou la lettre de repli de `AccountAuthorPill`) — il n'est jamais supprimé.
 */
function participantLabel(person: CarnetParticipant): string {
  return person.name ?? person.handle ?? '';
}

/** Un moment entre dans la grille quand il porte une image réelle. */
function withPhoto(moments: CarnetMomentItem[]): CarnetMomentItem[] {
  return moments.filter((moment) => Boolean(moment.imageUrl));
}

/**
 * Carte du carnet : mini tracé, pages de jour (Résumé → J1..Jn), participants,
 * lieu, médias en pages.
 *
 * Le balayage horizontal de la carte change de **jour**, où qu'il commence —
 * en-tête, grille ou volet. Le carrousel média (Posts, Parcours, Étapes,
 * Matériel, Nature, J’aime, Commentaires, Gérer) ne se pilote plus que par le
 * sélecteur bas et par son clavier. Le pied ne porte plus que la capsule des
 * drawers : ♥ et 💬 ont quitté la carte, leurs pages s'ouvrent depuis le menu
 * `···` de la barre du haut.
 */
export function CarnetCard({
  detail,
  page,
  onPageChange,
  canWrite,
  onRequireAuth,
  onOpenCarnet,
  onOpenStat,
  onOpenPost,
  onDownloadGpx,
  likesPage = null,
  commentsPage = null,
  managePage = null,
  dayPage,
  onDayPageChange,
}: CarnetCardProps) {
  /* Tracé et ligne de lieu : purs, donc calculés une fois par carnet et non
     à chaque bascule d'engagement, de page ou de jour. */
  const tracePath = useMemo(() => projectToViewBox(extractCoords(detail.trace), 66, 9), [detail.trace]);
  /* Une ligne unique, du texte seul : lieu · jours · distance · dénivelé · dates.
     Aucune valeur inventée : un champ absent devient un tiret, et la ligne
     entière disparaît si le carnet n'a réellement rien à dire. */
  const placeLine = useMemo(() => {
    /* Lieu réel de la fiche : aucune coordonnée n'est estimée ici. */
    const place = detail.place ?? { country: null, region: null, locality: null, lat: null, lng: null };
    /* Même source que la rangée de statistiques : le total du carnet, le
       `summary` des jours en relais. La carte ne montre jamais deux totaux. */
    const summary = detail.summary ?? { distanceKm: null, elevationM: null, days: 0, moments: 0 };
    return placeLineParts({
      place,
      fallback: detail.destination,
      daysCount: summary.days > 0 ? summary.days : detail.etapes.length,
      distanceKm: detail.distanceKm ?? summary.distanceKm,
      elevationM: detail.elevationM ?? summary.elevationM,
      dateRange: detail.dateRange,
    });
  }, [
    detail.place,
    detail.destination,
    detail.etapes.length,
    detail.summary,
    detail.distanceKm,
    detail.elevationM,
    detail.dateRange,
  ]);
  const showPlaceLine = placeLine.some((part) => part !== PLACE_LINE_MISSING);
  const participants = detail.participants ?? [];

  /* Balayage : page 0 = Résumé, puis un jour par page dérivée. Un carnet sans
     aucun jour ne garde que le Résumé — aucune page n'est fabriquée.
     La page peut être tenue par l'écran (`dayPage`), pour que la carte du bas
     suive le jour affiché ; sans elle, la carte garde son propre état. */
  const days = detail.days ?? [];
  const [localDayPage, setLocalDayPage] = React.useState(0);
  const pageCount = days.length + 1;
  const boundedPage = (next: number) => Math.max(0, Math.min(pageCount - 1, next));
  const controlledPage = typeof dayPage === 'number';
  const dayIndex = boundedPage(controlledPage ? (dayPage as number) : localDayPage);
  const setDayPage = useCallback(
    (next: number) => {
      const bounded = boundedPage(next);
      if (!controlledPage) setLocalDayPage(bounded);
      onDayPageChange?.(bounded);
    },
    // `boundedPage` ne dépend que de `pageCount`, déjà dans les dépendances.
    [controlledPage, onDayPageChange, pageCount],
  );
  const day = dayIndex === 0 ? null : days[dayIndex - 1];
  const swipe = useDaySwipe({ count: pageCount, index: dayIndex, onChange: setDayPage });
  const motion = useDayMotion(dayIndex, swipe.direction);

  /* Moments de la page : tous sur le Résumé, ceux du jour ensuite. */
  const gridMoments = useMemo(
    () => (day ? withPhoto(day.moments) : detail.photoMoments),
    [day, detail.photoMoments],
  );

  /* La grille du jour est un sous-ensemble : l'index ouvert par le post est
     celui du moment réel dans la galerie complète du carnet. */
  const openGridPost = useCallback(
    (index: number) => {
      const moment = gridMoments[index];
      if (!moment) {
        onOpenPost(index);
        return;
      }
      const global = detail.photoMoments.findIndex((entry) => entry.id === moment.id);
      onOpenPost(global >= 0 ? global : index);
    },
    [detail.photoMoments, gridMoments, onOpenPost],
  );

  /* Les deux segments de la capsule : handler stable, donc la lentille et les
     boutons ne se remontent pas quand la carte se redessine. */
  const onCapsuleChange = useCallback(
    (index: number) => onPageChange(CAPSULE_TABS[index].id),
    [onPageChange],
  );

  const lensIndex = selectorLensIndex(page);

  /* Couverture de la carte : le mini tracé réel, ou la pastille du carnet. */
  const cover = (
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
  );

  return (
    /* `id="card"` : la feuille du post (OverlaySheet) s'ancre sur la carte,
       comme le post du Compte — mêmes marges, même cadre. */
    <section
      className="ckp-card"
      id="card"
      aria-label="Carte du carnet"
      {...swipe.handlers}
    >
      <div className="ckp-card-scroll">
        {/* Le contenu de la carte glisse d'un bloc au changement de jour.
            L'élément n'est jamais remonté : focus, images et carrousel restent
            en place, seule la classe d'animation est reposée. */}
        <div className={`ckp-day-pane ${motion}`.trim()}>
          <CarnetDayHeader
            detail={detail}
            day={day}
            cover={cover}
            onOpenStat={onOpenStat}
          />

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
              onOpenPost={openGridPost}
              onDownloadGpx={onDownloadGpx}
              moments={gridMoments}
              emptyGrid={
                day ? (
                  <div className="ckp-grid-empty">
                    <Icon name="image-plus" size={20} aria-hidden="true" />
                    <b>Aucun moment ce jour-là.</b>
                    <p>La page reste vraie : ce jour n’a pas de photo.</p>
                  </div>
                ) : null
              }
              likesPage={likesPage}
              commentsPage={commentsPage}
              managePage={managePage}
            />
          </div>
        </div>
      </div>

      {/* Le pied de carte est celui des drawers : la capsule 88 × 30 à deux
          segments, à 10 px des bords bas et droit. Plus aucun bouton rond. */}
      <div className="ckp-card-foot">
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
