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
    const count = variant === 'tile5' ? 5 : 4;
    return (
      <div className="lkdv-cv2x-skeleton" aria-hidden="true">
        <div className="lkdv-cv2-skeleton">
          <span className="lkdv-cv2-skeleton-bar lkdv-cv2-skeleton-bar--tile" />
        </div>
        <div className="lkdv-cv2-grid">
          {Array.from({ length: count }, (_, index) => (
            <div key={index} className="lkdv-cv2-skeleton">
              <span className="lkdv-cv2-skeleton-bar lkdv-cv2-skeleton-bar--lg" />
              <span className="lkdv-cv2-skeleton-bar lkdv-cv2-skeleton-bar--sm" />
            </div>
          ))}
        </div>
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
    <div className="lkdv-cv2-error-state" role="alert">
      <span className="lkdv-cv2-error-state-ico" aria-hidden="true">
        !
      </span>
      <b>{title}</b>
      <p>{message}</p>
      <button type="button" className="lkdv-cv2-pill lkdv-cv2-pill--secondary" onClick={onRetry}>
        Réessayer
      </button>
    </div>
  );
}

/** État vide avec une action utile (jamais un cul-de-sac). */
export function ExploreEmpty({
  icon,
  title,
  description,
  children,
}: {
  icon: ExploreIconName;
  title: string;
  description: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="lkdv-cv2-empty" role="status">
      <span className="lkdv-cv2-empty-ico" aria-hidden="true">
        <ExploreIcon name={icon} size={20} />
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
