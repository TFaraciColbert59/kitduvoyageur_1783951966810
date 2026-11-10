'use client';

import React from 'react';
import { ExploreIcon, type ExploreIconName } from './ExploreIcons';

/** Squelettes de premier chargement (état distinct du cache, jamais « vide »). */
export function ExploreSkeleton({
  variant,
}: {
  variant: 'tiles' | 'tickets' | 'rows' | 'tile4' | 'tile5';
}) {
  if (variant === 'tiles' || variant === 'tile4' || variant === 'tile5') {
    // Maquette `etat-st-load.png` : grille de 6 tuiles uniformes, deux
    // colonnes, shimmer vert — pas de grande tuile de vedette ni de barres de
    // titre. Le squelette est purement décoratif (`aria-hidden`).
    return (
      <div className="lkdv-cv2x-skeleton lkdv-cv2x-skeleton--tiles" aria-hidden="true">
        {Array.from({ length: 6 }, (_, index) => (
          <span
            key={index}
            className="lkdv-cv2-skeleton-bar lkdv-cv2x-skeleton-tile"
            style={{ animationDelay: `${index * 0.08}s` }}
          />
        ))}
      </div>
    );
  }
  if (variant === 'tickets') {
    return (
      <div className="lkdv-cv2-skeleton">
        {Array.from({ length: 3 }, (_, index) => (
          <span key={index} className="lkdv-cv2-skeleton-bar lkdv-cv2-skeleton-bar--lg" style={{ height: 96 }} />
        ))}
      </div>
    );
  }
  return (
    <div className="lkdv-cv2-skeleton">
      {Array.from({ length: 5 }, (_, index) => (
        <span
          key={index}
          className="lkdv-cv2-skeleton-bar"
          style={{ height: 46, animationDelay: `${index * 0.08}s` }}
        />
      ))}
    </div>
  );
}

/** Erreur de volet : message distinct + Réessayer (jamais « aucun résultat »). */
export function ExploreError({
  title,
  onRetry,
  message = 'Vérifie ta connexion, puis réessaie.',
}: {
  title: string;
  onRetry: () => void;
  message?: string;
}) {
  return (
    <div className="lkdv-cv2-error-state" role="alert" data-tone="danger">
      <span className="lkdv-cv2-error-state-ico" aria-hidden="true">
        !
      </span>
      <b>{title}</b>
      <p>{message}</p>
      <button
        type="button"
        className="lkdv-cv2-pill lkdv-cv2-pill--secondary lkdv-cv2x-error-retry"
        onClick={onRetry}
      >
        Réessayer
      </button>
    </div>
  );
}

/** Illustration « montagne » de la maquette (`etat-st-empty.png`, L2282). */
function EmptyMountainArt() {
  return (
    <svg
      viewBox="0 0 64 64"
      width="44"
      height="44"
      className="lkdv-cv2x-empty-ill"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M10 50 L26 24 L36 38 L44 28 L56 50z" />
      <path d="M8 54H58" />
      <circle cx="46" cy="14" r="5" />
    </svg>
  );
}

/** État vide avec une action utile (jamais un cul-de-sac). */
export function ExploreEmpty({
  icon,
  title,
  description,
  illustration,
  children,
}: {
  icon: ExploreIconName;
  title: string;
  description: string;
  /** Illustration pleine de la maquette (repli : icône du jeu local). */
  illustration?: 'mountain';
  children?: React.ReactNode;
}) {
  return (
    <div className="lkdv-cv2-empty" role="status">
      <span className="lkdv-cv2-empty-ico" aria-hidden="true">
        {illustration === 'mountain' ? <EmptyMountainArt /> : <ExploreIcon name={icon} size={20} />}
      </span>
      <b>{title}</b>
      <p>{description}</p>
      {children ? <div className="lkdv-cv2x-empty-actions">{children}</div> : null}
    </div>
  );
}

/** Position refusée / indisponible : état explicatif, bouton « Autoriser ». */
export function ExploreGeoPrompt({
  state,
  onRequest,
  busy,
}: {
  state: 'idle' | 'prompt' | 'granted' | 'denied' | 'unavailable';
  onRequest: () => void;
  busy?: boolean;
}) {
  const denied = state === 'denied' || state === 'unavailable';
  return (
    <ExploreEmpty
      icon="map-pin"
      title={denied ? 'Position refusée' : 'Active ta position'}
      description={
        denied
          ? 'Sans ta position, les distances ne peuvent pas être calculées. Autorise la localisation dans les réglages du navigateur ou du téléphone, puis réessaie.'
          : 'Ta position n’est demandée qu’à la demande : elle sert à trier par distance et n’est jamais publiée.'
      }
    >
      <button
        type="button"
        className="lkdv-cv2-pill lkdv-cv2-pill--primary"
        onClick={onRequest}
        aria-busy={busy || undefined}
        disabled={busy}
      >
        Autoriser
      </button>
    </ExploreEmpty>
  );
}

/** Bandeau hors ligne (dernier contenu conservé à l'écran). */
export function ExploreOfflineBanner() {
  return (
    <div className="lkdv-cv2-offline" role="status">
      <ExploreIcon name="cloud" size={15} />
      <span>Hors ligne · contenus enregistrés sur l’appareil</span>
    </div>
  );
}

/** Pied de liste : fin de flux ou bouton « Charger la suite ». */
export function ExploreListFoot({
  hasMore,
  loadingMore,
  onLoadMore,
  total,
  label,
}: {
  hasMore: boolean;
  loadingMore: boolean;
  onLoadMore: () => void;
  total: number;
  label: string;
}) {
  if (loadingMore) {
    return (
      <p className="lkdv-cv2x-list-foot" role="status">
        Chargement…
      </p>
    );
  }
  if (hasMore) {
    return (
      <div className="lkdv-cv2x-list-foot">
        <button type="button" className="lkdv-cv2-pill lkdv-cv2-pill--secondary" onClick={onLoadMore}>
          Charger la suite
        </button>
      </div>
    );
  }
  if (total === 0) return null;
  return <p className="lkdv-cv2x-list-foot">Tu as tout vu. {label}</p>;
}

/**
 * Pied de volet « Créer … / Tout voir » (maquette `.pane-foot`, L2343 et L974).
 * Deux pilules de 44 px : la création et l'élargissement au flux complet. Quand
 * il n'y a rien de plus à voir, « Tout voir » disparaît plutôt que de ramener à
 * la page courante (Carnets#19).
 */
export function ExplorePaneFoot({
  createLabel,
  onCreate,
  onSeeAll,
  seeAllBusy = false,
  seeAllLabel = 'Tout voir',
  seeAllDescription,
}: {
  createLabel: string;
  onCreate?: () => void;
  onSeeAll?: () => void;
  seeAllBusy?: boolean;
  seeAllLabel?: string;
  seeAllDescription?: string;
}) {
  if (!onCreate && !onSeeAll) return null;
  return (
    <div className="lkdv-cv2x-pane-foot" data-testid="cv2-pane-foot">
      {onCreate ? (
        <button type="button" className="lkdv-cv2-pill lkdv-cv2-pill--secondary" onClick={onCreate}>
          <ExploreIcon name="plus" size={15} />
          {createLabel}
        </button>
      ) : null}
      {onSeeAll ? (
        <button
          type="button"
          className="lkdv-cv2-pill lkdv-cv2-pill--secondary"
          onClick={onSeeAll}
          aria-busy={seeAllBusy || undefined}
          disabled={seeAllBusy}
          aria-label={seeAllDescription}
        >
          {seeAllLabel}
          <ExploreIcon name="chevron-right" size={15} />
        </button>
      ) : null}
    </div>
  );
}

/** En-tête de volet : titre accessible + action à droite. */
export function ExplorePaneHead({
  title,
  count,
  children,
}: {
  title: string;
  count?: number;
  children?: React.ReactNode;
}) {
  return (
    <div className="lkdv-cv2-group-head lkdv-cv2x-pane-head">
      <span className="lkdv-cv2-eyebrow">
        {title}
        {count != null ? <b>{count}</b> : null}
      </span>
      {children}
    </div>
  );
}
