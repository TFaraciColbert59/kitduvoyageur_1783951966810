'use client';

import React, { useCallback, useMemo } from 'react';
import { AccountAuthorPill } from '@/components/account/AccountAuthorPill';
import { CarnetEmpty } from './CarnetStates';
import Icon from '@/components/ui/Icon';
import type { CarnetStatsTab } from '@/features/carnet/detail/stats';
import { CarnetMediaTabs } from './CarnetMediaTabs';
import { CarnetPages, type CarnetPageId } from './CarnetPages';
import { CarnetDayHeader } from './CarnetDayHeader';
import { useDayMotion, useDaySwipe } from './CarnetDaySwipe';
import { extractCoords, projectToViewBox } from './traceGeometry';
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
  /** Ouvre le drawer Moments depuis la pastille de compte, en haut à droite. */
  onOpenMoments?: () => void;
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
 * Segments de la capsule : **un segment par page de jour** — `R` (Résumé),
 * puis `J1`, `J2`… `Jn`, dans l'ordre du balayage. Le libellé complet reste
 * l'`aria-label` du segment (« Résumé », « Jour 1 »…) : aucun segment n'est
 * muet pour un lecteur d'écran.
 */
export interface CarnetDayTab {
  id: string;
  label: string;
  icon: React.ReactNode;
}

export function buildDayTabs(count: number): CarnetDayTab[] {
  const total = Math.max(1, count);
  return Array.from({ length: total }, (_, index) => ({
    id: index === 0 ? 'resume' : `j${index}`,
    label: index === 0 ? 'Résumé' : `Jour ${index}`,
    icon: index === 0 ? 'R' : `J${index}`,
  }));
}

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
 * Carte du carnet : mini tracé, pages de jour (Résumé → J1..Jn), statistiques,
 * récit sur une ligne, participants, médias en pages. Les informations de lieu
 * et de jour vivent dans le drawer Statistiques ; la liste des moments (heure
 * et lieu) dans le drawer Moments, ouvert par la pastille de compte.
 *
 * Le balayage horizontal de la carte change de **jour**, où qu'il commence —
 * en-tête, grille, volet — au doigt comme à la souris et au clavier. La capsule
 * du pied porte **un segment par page de jour** (R, J1…Jn) et rien d'autre :
 * cliquer un segment change de jour, la lentille suit. Le carrousel média
 * (Posts, Étapes, Matériel, Nature, J’aime, Commentaires, Gérer) s'ouvre depuis
 * la barre du haut et le menu `···`, plus depuis la capsule.
 */
export function CarnetCard({
  detail,
  page,
  onPageChange,
  canWrite,
  onRequireAuth,
  onOpenCarnet,
  onOpenStat,
  onOpenMoments,
  onOpenPost,
  onDownloadGpx,
  likesPage = null,
  commentsPage = null,
  managePage = null,
  dayPage,
  onDayPageChange,
}: CarnetCardProps) {
  /* Tracé : pur, donc calculé une fois par carnet et non à chaque bascule
     d'engagement, de page ou de jour. */
  const tracePath = useMemo(() => projectToViewBox(extractCoords(detail.trace), 66, 9), [detail.trace]);
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

  /* Une seule page montée : les moments de la page affichée nourrissent la
     grille. La liste des moments ne vit plus sous la grille : elle est dans le
     drawer Moments, ouvert par la pastille de compte en haut à droite. */
  const dayTabs = useMemo(() => buildDayTabs(pageCount), [pageCount]);

  /* Les deux segments de la capsule : handler stable, donc la lentille et les
     boutons ne se remontent pas quand la carte se redessine. */
  const onDayTabChange = useCallback(
    (index: number) => setDayPage(index),
    [setDayPage],
  );

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
        <span className="ckp-cover ckp-cover--initial" aria-hidden="true">
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
            onOpenMoments={onOpenMoments}
          />

          {/* La carte ne garde que le récit, sur une ligne : les informations
              de lieu et de jour vivent dans le drawer Statistiques. */}
          {detail.description ? (
            <div className="ckp-bio-row">
              <p className="ckp-bio-line">{detail.description}</p>
              <button type="button" className="ckp-more" onClick={() => onOpenStat('days')}>
                voir plus…
              </button>
            </div>
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
                  <CarnetEmpty
                    icon={<Icon name="image-plus" size={32} aria-hidden="true" />}
                    label="Aucun moment ce jour-là"
                  />
                ) : null
              }
              likesPage={likesPage}
              commentsPage={commentsPage}
              managePage={managePage}
            />
          </div>
        </div>
      </div>

      {/* Le pied de carte est celui des drawers : la capsule 30 px de haut,
          ancrée à 10 px des bords bas et droit. Elle ne porte plus les vues
          (grille/carte) mais **les jours** : un segment par page, `R` puis
          `J1`… `Jn`, largeur `n × 41,5 + 5`, lentille blanche au pas exact. */}
      <div className="ckp-card-foot">
        <div className="ckp-capsule" style={{ '--n': dayTabs.length } as React.CSSProperties}>
          <span
            className="ckp-th"
            aria-hidden="true"
            style={{ '--i': dayIndex } as React.CSSProperties}
          />
          <CarnetMediaTabs
            items={dayTabs}
            activeIndex={dayIndex}
            onChange={onDayTabChange}
            ariaLabel="Jours du carnet"
            idPrefix="carnet-day-tab"
            panelIdFor={() => undefined}
          />
        </div>
      </div>
    </section>
  );
}

export default CarnetCard;
