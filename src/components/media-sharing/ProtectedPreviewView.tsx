import React from 'react';
import type { ProtectedPreviewResolution } from '@/features/media-sharing';
import styles from './media-sharing.module.css';
import {
  formatDateMs,
  formatDistanceM,
  maskVersionShort,
  PREVIEW_FAILURE_LABELS,
  SPORT_LABELS,
} from './format';
import { Badge, Stat } from './StateCards';
import { TrackMiniMap } from './TrackMiniMap';
import { elevationGraph } from './geometry';
import { EyeIcon, LockIcon, ShieldIcon } from './icons';

export interface ProtectedPreviewViewProps {
  resolution: ProtectedPreviewResolution;
}

/**
 * K5.28 — Vue publique d'un aperçu protégé.
 * Elle ne propose ni téléchargement ni navigation : même si le raw token est
 * valide, seules la géométrie simplifiée et les stats sont lisibles.
 */
export function ProtectedPreviewView({ resolution }: ProtectedPreviewViewProps) {
  if (!resolution.ok) {
    const failure = PREVIEW_FAILURE_LABELS[resolution.reason];
    return (
      <main className={styles.previewPage}>
        <div className={styles.previewFailure}>
          <span className={styles.stateIcon} aria-hidden="true">
            <LockIcon size={26} />
          </span>
          <h1>{failure.title}</h1>
          <p>{failure.message}</p>
          <p className={styles.previewFootnote}>
            Aucune coordonnée, miniature ou profil altimétrique n’est exposé.
          </p>
        </div>
      </main>
    );
  }

  const preview = resolution.preview;
  const graph = elevationGraph(preview.elevationProfile, 340, 120, 16);
  const sportLabel = SPORT_LABELS[preview.sport] ?? 'Sortie';

  return (
    <main className={styles.previewPage}>
      <article className={styles.previewCard} aria-labelledby="preview-title">
        <header className={styles.previewHeader}>
          <div>
            <p className={styles.eyebrow}>Aperçu protégé</p>
            <h1 id="preview-title">{preview.title}</h1>
            <p className={styles.previewSubtitle}>
              {sportLabel} · {formatDistanceM(preview.totalDistanceM)} · +
              {Math.round(preview.elevationGainM)} m
            </p>
          </div>
          <div className={styles.badgeRow}>
            <Badge tone="success">
              <EyeIcon size={13} /> lecture seule
            </Badge>
            <Badge tone="neutral">lien {maskVersionShort(preview.linkId)}</Badge>
          </div>
        </header>

        <TrackMiniMap
          points={preview.simplifiedPoints}
          ariaLabel={`Aperçu simplifié de ${preview.title}`}
          height={230}
        />

        <div className={styles.statsRow}>
          <Stat label="Distance" value={formatDistanceM(preview.totalDistanceM)} />
          <Stat label="Dénivelé" value={`+${Math.round(preview.elevationGainM)} m`} />
          <Stat label="Expire" value={formatDateMs(preview.expiresAtMs)} />
        </div>

        {graph.hasElevation ? (
          <figure className={styles.elevationFigure}>
            <figcaption className={styles.elevationCaption}>
              <span>Profil altimétrique simplifié</span>
              <span>
                {graph.minElevationM} m → {graph.maxElevationM} m
              </span>
            </figcaption>
            <svg
              viewBox="0 0 340 120"
              className={styles.elevationSvg}
              role="img"
              aria-label="Profil altimétrique de l'aperçu"
            >
              <path d={graph.area} className={styles.elevationArea} />
              <path d={graph.line} className={styles.elevationLine} />
            </svg>
          </figure>
        ) : null}

        <div className={styles.previewGuarantees}>
          <div>
            <ShieldIcon size={18} />
            <strong>Non téléchargeable</strong>
            <span>La géométrie n’est pas exportable.</span>
          </div>
          <div>
            <LockIcon size={18} />
            <strong>Non navigable</strong>
            <span>Ce n’est pas un itinéraire à suivre.</span>
          </div>
          <div>
            <EyeIcon size={18} />
            <strong>Révocable</strong>
            <span>L’auteur peut couper l’accès à tout moment.</span>
          </div>
        </div>

        <footer className={styles.previewFooter}>
          Lien valable jusqu’au {formatDateMs(preview.expiresAtMs)}. Aucune métadonnée
          EXIF n’est incluse.
        </footer>
      </article>
    </main>
  );
}
