'use client';

/**
 * Lot N02-UI / K4.17 — Photos, POI à venir et données de navigation hors ligne.
 *
 * Les repères et vignettes sont déjà filtrés, projetés et vérifiés par
 * `resolveUpcomingOfflinePoisWithMedia` : ce composant ne fabrique aucune
 * distance, aucun média et aucune coordonnée.
 */

import React from 'react';
import {
  evaluateOfflineClosures,
  type OfflineClosureEvaluation,
  type OfflineClosureNotice,
  type OfflinePoiRecord,
  type OfflineUpcomingPoiViewItem,
} from '@/features/offline';
import { XpIcon } from '@/features/explorer-v2/ui/XpIcon';
import {
  OfflineBadge,
  OfflineButton,
  OfflineEmpty,
  OfflineNotice,
  OfflinePanel,
  OfflinePanelHeader,
  formatDistanceM,
} from './primitives';
import styles from './offlineUi.module.css';

const POI_KIND_LABEL: Readonly<Record<string, string>> = {
  summit: 'Sommet',
  water: 'Point d’eau',
  refuge: 'Refuge',
  bivouac: 'Bivouac',
  viewpoint: 'Point de vue',
  danger: 'Danger',
  access: 'Accès',
  friend: 'Ambassadeur',
  trail: 'Sentier',
  highlight: 'À ne pas manquer',
  waypoint: 'Repère',
};

const POI_KIND_ICON: Readonly<Record<string, string>> = {
  summit: 'mtn',
  water: 'drop',
  refuge: 'house',
  bivouac: 'tent',
  viewpoint: 'eye',
  danger: 'alert',
  access: 'loc',
  friend: 'users',
  trail: 'route',
  highlight: 'star',
  waypoint: 'flag',
};

export function poiLabel(kind: OfflinePoiRecord['kind'] | string): string {
  return POI_KIND_LABEL[kind] ?? 'Repère';
}

export function poiIcon(kind: OfflinePoiRecord['kind'] | string): string {
  return POI_KIND_ICON[kind] ?? 'pin';
}

function useMediaObjectUrl(payload: Uint8Array | string): string | null {
  const [url, setUrl] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (typeof payload === 'string') {
      setUrl(/^(data:|https?:|blob:)/i.test(payload) ? payload : null);
      return;
    }

    if (
      payload instanceof Uint8Array &&
      typeof URL !== 'undefined' &&
      typeof URL.createObjectURL === 'function'
    ) {
      const bytes = new Uint8Array(payload);
      const blob = new Blob([bytes.buffer as ArrayBuffer], { type: 'image/webp' });
      const objectUrl = URL.createObjectURL(blob);
      setUrl(objectUrl);
      return () => URL.revokeObjectURL(objectUrl);
    }

    setUrl(null);
    return;
  }, [payload]);

  return url;
}

function OfflineMediaThumb({
  preview,
}: {
  preview: OfflineUpcomingPoiViewItem['verifiedMediaPreviews'][number];
}) {
  const url = useMediaObjectUrl(preview.payload);
  return (
    <figure className={styles.thumb} style={{ margin: 0 }}>
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element -- aperçu local (blob) du paquet, jamais optimisé côté serveur
        <img
          className={styles.thumbImage}
          src={url}
          alt={preview.caption ?? 'Aperçu photo vérifié hors ligne'}
          loading="lazy"
          width={preview.width}
          height={preview.height}
        />
      ) : (
        <span className={styles.thumbFallback}>
          <XpIcon name="image" size={20} />
        </span>
      )}
    </figure>
  );
}

export interface OfflineUpcomingPoiPanelProps {
  items: readonly OfflineUpcomingPoiViewItem[];
  routeName?: string | null;
  closures?: readonly OfflineClosureNotice[];
  nowMs?: number;
  onOpenPoi?: (poi: OfflinePoiRecord) => void;
}

export function OfflineUpcomingPoiPanel({
  items,
  routeName = null,
  closures = [],
  nowMs = Date.now(),
  onOpenPoi,
}: OfflineUpcomingPoiPanelProps) {
  const sorted = React.useMemo(
    () => [...items].sort((a, b) => a.distanceRemainingM - b.distanceRemainingM),
    [items]
  );
  const closureEvaluations: OfflineClosureEvaluation[] = evaluateOfflineClosures(closures, nowMs);

  return (
    <OfflinePanel ariaLabel="Repères à venir hors ligne">
      <OfflinePanelHeader
        eyebrow="K4.17 · Sur le parcours"
        title="Repères à venir"
        subtitle={
          routeName
            ? `${routeName} · repères et photos disponibles hors ligne.`
            : 'Repères et photos vérifiés dans le paquet téléchargé.'
        }
      />

      {closureEvaluations.length > 0 ? (
        <div className={styles.stackTight}>
          {closureEvaluations.map((closure) => (
            <OfflineNotice
              key={closure.closureId}
              tone={closure.freshness === 'uncertain_expired' ? 'warning' : 'danger'}
              icon="alert"
            >
              {closure.warningLabel}
            </OfflineNotice>
          ))}
        </div>
      ) : null}

      {sorted.length === 0 ? (
        <OfflineEmpty
          title="Aucun repère à venir"
          hint="Les repères du parcours apparaîtront ici dès qu’ils seront dans le paquet."
          icon="flag"
        />
      ) : (
        <ul className={styles.list}>
          {sorted.map((item) => (
            <li key={item.poi.id} className={styles.listItem}>
              <span className={styles.iconBubble}>
                <XpIcon name={poiIcon(item.poi.kind)} size={18} />
              </span>
              <div className={styles.grow}>
                <div className={styles.row}>
                  <p className={styles.itemTitle}>{item.poi.name}</p>
                  <OfflineBadge tone="neutral">{poiLabel(item.poi.kind)}</OfflineBadge>
                </div>
                <p className={styles.itemMeta}>
                  À {formatDistanceM(item.distanceRemainingM)} · écart{' '}
                  {formatDistanceM(item.lateralOffsetM)} du tracé
                  {item.poi.eleM != null ? ` · ${Math.round(item.poi.eleM)} m` : ''}
                </p>
                {item.poi.description ? (
                  <p className={styles.itemMeta}>{item.poi.description}</p>
                ) : null}

                {item.verifiedMediaPreviews.length > 0 ? (
                  <div className={styles.mediaRow} aria-label={`Photos de ${item.poi.name}`}>
                    {item.verifiedMediaPreviews.map((preview) => (
                      <OfflineMediaThumb key={preview.mediaId} preview={preview} />
                    ))}
                  </div>
                ) : null}
              </div>

              {onOpenPoi ? (
                <OfflineButton
                  variant="ghost"
                  aria-label={`Ouvrir ${item.poi.name}`}
                  onClick={() => onOpenPoi(item.poi)}
                >
                  <XpIcon name="chevr" size={16} />
                </OfflineButton>
              ) : null}
            </li>
          ))}
        </ul>
      )}

      <p className={styles.caption}>
        Aucun bouton dédié : ces repères enrichissent le parcours et le suivi, sans créer de nouvel
        écran.
      </p>
    </OfflinePanel>
  );
}
