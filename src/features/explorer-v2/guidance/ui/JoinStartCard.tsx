'use client';

/**
 * Lot N01 / K4.03 & S3.12 — Carte « rejoindre le départ ».
 *
 * Rend les actions décidées par `evaluateDepartureState` (démarrer sur place,
 * rejoindre le départ, rejoindre le tracé le plus proche) puis les liens
 * profonds `buildExternalNavigationLinks` vers les applications routières.
 * Aucune coordonnée n'est recalculée ni inventée dans ce composant.
 */

import React from 'react';
import {
  bearingLabel,
  formatNavigationDistance,
  type DepartureActionKind,
  type DepartureEvaluation,
  type ExternalNavigationBundle,
  type ExternalNavigationLink,
} from '@/features/navigation';
import { XpIcon } from '../../ui/XpIcon';
import {
  GuidanceBadge,
  GuidanceButton,
  GuidanceLinkButton,
  GuidancePanel,
  GuidancePanelHeader,
  cx,
} from './primitives';
import styles from './guidanceUi.module.css';

const ACTION_LABEL: Readonly<Record<DepartureActionKind, string>> = {
  start_at_origin: 'Démarrer depuis le départ',
  start_here_on_route: 'Démarrer d’ici',
  guide_to_start: 'Rejoindre le départ',
  guide_to_nearest_point: 'Rejoindre le tracé',
  open_external_road_nav: 'Itinéraire routier',
};

const ACTION_ICON: Readonly<Record<DepartureActionKind, 'play' | 'route' | 'nav' | 'loc'>> = {
  start_at_origin: 'play',
  start_here_on_route: 'play',
  guide_to_start: 'nav',
  guide_to_nearest_point: 'route',
  open_external_road_nav: 'loc',
};

const KIND_TITLE: Readonly<Record<DepartureEvaluation['kind'], string>> = {
  at_start: 'Vous êtes au départ',
  on_route_ahead: 'Vous êtes déjà sur le parcours',
  away_from_route: 'Rejoindre le départ',
  location_unavailable: 'Position actuelle indisponible',
  route_unavailable: 'Parcours indisponible',
};

function subtitleFor(evaluation: DepartureEvaluation): string {
  const distStart =
    evaluation.distanceToStartM !== null
      ? formatNavigationDistance(evaluation.distanceToStartM)
      : null;
  const cardinal = bearingLabel(evaluation.bearingToStartDeg);
  const cap = cardinal ? ` · cap ${cardinal}` : '';

  switch (evaluation.kind) {
    case 'at_start':
      return 'Le point de départ officiel est à moins de 35 m. Vous pouvez lancer le suivi.';
    case 'on_route_ahead':
      return evaluation.entryAlongTrackM !== null
        ? `Vous êtes engagé sur le tracé, ${formatNavigationDistance(evaluation.entryAlongTrackM)} après le départ.`
        : 'Vous êtes déjà sur le tracé : reprenez au point le plus proche.';
    case 'away_from_route':
      return distStart
        ? `Départ à ${distStart}${cap}. Choisissez de le rejoindre ou de rejoindre le tracé.`
        : 'Choisissez le point de reprise du parcours.';
    case 'location_unavailable':
      return evaluation.unavailableReason ?? 'Activez la localisation pour vous guider.';
    case 'route_unavailable':
      return evaluation.unavailableReason ?? 'La géométrie du parcours est absente.';
  }
}

export interface JoinStartCardProps {
  evaluation: DepartureEvaluation;
  /** Bundle produit par `buildExternalNavigationLinks`. */
  externalLinks?: ExternalNavigationBundle | null;
  busy?: boolean;
  onAction?: (action: DepartureActionKind) => void;
  onOpenExternal?: (link: ExternalNavigationLink) => void;
  className?: string;
}

export function JoinStartCard({
  evaluation,
  externalLinks = null,
  busy = false,
  onAction,
  onOpenExternal,
  className,
}: JoinStartCardProps) {
  const available = evaluation.availableActions;
  const recommended = evaluation.recommendedAction;
  const inlineActions = available.filter((action) => action !== 'open_external_road_nav');
  const wantsExternal = available.includes('open_external_road_nav');
  const readyLinks = externalLinks?.status === 'ready' ? externalLinks.links : [];
  const showsExternalButton = wantsExternal && readyLinks.length === 0;

  return (
    <GuidancePanel className={className} ariaLabel="Rejoindre le départ">
      <GuidancePanelHeader
        eyebrow="Départ"
        title={KIND_TITLE[evaluation.kind]}
        subtitle={subtitleFor(evaluation)}
        action={
          evaluation.kind === 'at_start' ? (
            <GuidanceBadge tone="success" icon="check">
              Au départ
            </GuidanceBadge>
          ) : evaluation.kind === 'away_from_route' ? (
            <GuidanceBadge tone="warning" icon="nav">
              Hors départ
            </GuidanceBadge>
          ) : null
        }
      />

      {evaluation.unavailableReason &&
      evaluation.kind !== 'location_unavailable' &&
      evaluation.kind !== 'route_unavailable' ? (
        <p className={cx(styles.warning, styles.infoBox)}>{evaluation.unavailableReason}</p>
      ) : null}

      {inlineActions.length > 0 ? (
        <div className={styles.stack} style={{ gap: 8 }}>
          {inlineActions.map((action) => (
            <GuidanceButton
              key={action}
              variant={action === recommended ? 'primary' : 'secondary'}
              fullWidth
              disabled={busy}
              onClick={() => onAction?.(action)}
            >
              <XpIcon name={ACTION_ICON[action]} size={16} />
              {ACTION_LABEL[action]}
            </GuidanceButton>
          ))}
        </div>
      ) : null}

      {showsExternalButton ? (
        <GuidanceButton
          variant={recommended === 'open_external_road_nav' ? 'primary' : 'secondary'}
          fullWidth
          disabled={busy}
          onClick={() => onAction?.('open_external_road_nav')}
        >
          <XpIcon name="loc" size={16} />
          Ouvrir l’itinéraire routier
        </GuidanceButton>
      ) : null}

      {readyLinks.length > 0 ? (
        <div className={styles.stack} style={{ gap: 6 }}>
          <p className={styles.eyebrow}>Applications du téléphone</p>
          {readyLinks.map((link) => (
            <GuidanceLinkButton
              key={link.provider}
              label={link.label}
              hint={link.provider === 'geo-uri' ? 'Application GPS par défaut' : 'Ouvrir l’itinéraire'}
              href={link.url}
              target="_blank"
              rel="noreferrer noopener"
              onClick={() => onOpenExternal?.(link)}
            />
          ))}
        </div>
      ) : wantsExternal && externalLinks?.status === 'unavailable' && externalLinks.reason ? (
        <p className={styles.subtitle}>{externalLinks.reason}</p>
      ) : null}

      {busy ? (
        <p className={styles.subtitle} role="status">
          Préparation du guidage…
        </p>
      ) : null}
    </GuidancePanel>
  );
}
