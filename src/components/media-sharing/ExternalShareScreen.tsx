/* eslint-disable @next/next/no-img-element -- médias utilisateur servis par un CDN externe, hôtes non déclarables à l'avance. */
'use client';

import React, { useId, useState } from 'react';
import type {
  ShareCardSpec,
  TransparentStickerSpec,
  WebEmbedPayload,
} from '@/features/media-sharing';
import styles from './media-sharing.module.css';
import { formatDistanceM, maskVersionShort, SPORT_LABELS } from './format';
import { Badge, LockedState, SectionHeading } from './StateCards';
import { CheckIcon, CopyIcon, LinkIcon, ShareIcon } from './icons';

type ShareTab = 'embed' | 'card' | 'sticker';

const SHARE_TABS: Array<{ id: ShareTab; label: string }> = [
  { id: 'embed', label: 'Embed web' },
  { id: 'card', label: 'Carte sportive' },
  { id: 'sticker', label: 'Sticker' },
];

async function copyToClipboard(value: string): Promise<boolean> {
  try {
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(value);
      return true;
    }
  } catch {
    /* permission refusée : repli ci-dessous */
  }
  try {
    if (typeof document === 'undefined') return false;
    const textarea = document.createElement('textarea');
    textarea.value = value;
    textarea.setAttribute('readonly', '');
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    const copied = document.execCommand('copy');
    document.body.removeChild(textarea);
    return copied;
  } catch {
    return false;
  }
}

function CopyButton({
  value,
  label,
  onCopied,
}: {
  value: string;
  label: string;
  onCopied: (message: string) => void;
}) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      className={styles.secondaryButton}
      onClick={async () => {
        const ok = await copyToClipboard(value);
        setCopied(ok);
        onCopied(ok ? `${label} copié` : `Copie impossible pour ${label.toLowerCase()}`);
      }}
    >
      {copied ? <CheckIcon size={16} /> : <CopyIcon size={16} />}
      {label}
    </button>
  );
}

export interface ExternalShareScreenProps {
  embed: WebEmbedPayload;
  card: ShareCardSpec;
  sticker: TransparentStickerSpec;
  title: string;
}

/**
 * K5.27 / S5.25 — Partage externe.
 * Le contrat fail-closed est visible : une trace privée affiche un refus, pas
 * un aperçu vide qui laisserait croire à un rendu prêt.
 */
export function ExternalShareScreen({
  embed,
  card,
  sticker,
  title,
}: ExternalShareScreenProps) {
  const headingId = useId();
  const [tab, setTab] = useState<ShareTab>('embed');
  const [status, setStatus] = useState('');

  const authorized = embed.authorized && card.authorized && sticker.authorized;

  if (!authorized) {
    return (
      <section className={styles.screen} aria-labelledby={headingId}>
        <SectionHeading
          eyebrow="Partage externe"
          title={title}
          description="Diffusion hors de l'application."
        />
        <LockedState
          title="Partage impossible"
          message="Cette sortie n'est pas publique. Aucun embed, aucune carte et aucun sticker ne sont générés."
        />
      </section>
    );
  }

  const stickerDataUri = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(
    sticker.svgMarkup,
  )}`;
  const sportLabel = SPORT_LABELS[card.sport] ?? 'Sortie';

  return (
    <section className={styles.screen} aria-labelledby={headingId}>
      <SectionHeading
        eyebrow="Partage externe"
        title={title}
        description="Embed web, carte sportive et sticker transparent, sans EXIF."
        action={
          <div className={styles.badgeRow}>
            <Badge tone="success">sans EXIF</Badge>
            <Badge tone="neutral">masque {maskVersionShort(embed.maskVersion)}</Badge>
          </div>
        }
      />

      <div className={styles.segmented} role="tablist" aria-label="Format de partage">
        {SHARE_TABS.map((entry) => (
          <button
            key={entry.id}
            type="button"
            role="tab"
            id={`share-tab-${entry.id}`}
            aria-selected={tab === entry.id}
            aria-controls={`share-panel-${entry.id}`}
            tabIndex={tab === entry.id ? 0 : -1}
            className={styles.segment}
            data-active={tab === entry.id ? 'true' : 'false'}
            onClick={() => setTab(entry.id)}
            onKeyDown={(event) => {
              if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return;
              event.preventDefault();
              const index = SHARE_TABS.findIndex((item) => item.id === tab);
              const nextIndex =
                event.key === 'ArrowRight'
                  ? (index + 1) % SHARE_TABS.length
                  : (index - 1 + SHARE_TABS.length) % SHARE_TABS.length;
              setTab(SHARE_TABS[nextIndex].id);
            }}
          >
            {entry.label}
          </button>
        ))}
      </div>

      <p className={styles.srOnly} role="status" aria-live="polite">
        {status}
      </p>

      {tab === 'embed' ? (
        <div
          role="tabpanel"
          id="share-panel-embed"
          aria-labelledby="share-tab-embed"
          className={styles.sharePanel}
        >
          <div className={styles.embedPreview}>
            <div className={styles.embedChrome} aria-hidden="true">
              <span />
              <span />
              <span />
              <em>kitduvoyageur.fr/embed</em>
            </div>
            <div className={styles.embedBody}>
              <span className={styles.embedRoute} aria-hidden="true">
                <LinkIcon size={26} />
              </span>
              <div>
                <h3>{embed.title}</h3>
                <p>
                  {sportLabel} · {formatDistanceM(embed.totalDistanceM)} · +
                  {Math.round(embed.elevationGainM)} m
                </p>
              </div>
            </div>
            <div className={styles.embedFooter}>
              <span>{embed.simplifiedPoints.length} points simplifiés</span>
              <span>{embed.elevationProfile.length} mesures altimétriques</span>
            </div>
          </div>
          <div className={styles.codeBlock}>
            <div className={styles.codeHeader}>
              <span>iframe</span>
              <CopyButton
                value={embed.embedHtml}
                label="Copier le code"
                onCopied={setStatus}
              />
            </div>
            <pre>
              <code>{embed.embedHtml}</code>
            </pre>
          </div>
        </div>
      ) : null}

      {tab === 'card' ? (
        <div
          role="tabpanel"
          id="share-panel-card"
          aria-labelledby="share-tab-card"
          className={styles.sharePanel}
        >
          <div className={styles.shareCard} data-theme={card.theme}>
            <div className={styles.shareCardHeader}>
              <span className={styles.shareCardSport}>{sportLabel}</span>
              <span className={styles.shareCardBrand}>LKDV</span>
            </div>
            <div className={styles.shareCardRoute}>
              <svg viewBox="0 0 280 140" role="img" aria-label="Tracé simplifié de la sortie">
                <path d={card.routeSvgPath} className={styles.shareCardPath} />
              </svg>
              {card.heroPhotoUrl ? (
                <img
                  className={styles.shareCardPhoto}
                  src={card.heroPhotoUrl}
                  alt=""
                  loading="lazy"
                />
              ) : null}
            </div>
            <h3>{card.title}</h3>
            <div className={styles.shareCardStats}>
              <span>
                <strong>{card.stats.distanceKm.toLocaleString('fr-FR')}</strong> km
              </span>
              <span>
                <strong>+{card.stats.elevationGainM}</strong> m
              </span>
              <span>
                <strong>{card.stats.durationFormatted}</strong>
              </span>
            </div>
          </div>
          <div className={styles.shareActions}>
            <CopyButton
              value={`${card.title} — ${card.stats.distanceKm} km — +${card.stats.elevationGainM} m`}
              label="Copier les stats"
              onCopied={setStatus}
            />
            <span className={styles.inlineNote}>Format 1080 × 1350 pour les réseaux.</span>
          </div>
        </div>
      ) : null}

      {tab === 'sticker' ? (
        <div
          role="tabpanel"
          id="share-panel-sticker"
          aria-labelledby="share-tab-sticker"
          className={styles.sharePanel}
        >
          <div className={styles.stickerStage}>
            <img
              className={styles.stickerImage}
              src={stickerDataUri}
              alt={`Sticker transparent du tracé de ${sticker.trackId}`}
            />
          </div>
          <div className={styles.shareActions}>
            <CopyButton value={sticker.svgMarkup} label="Copier le SVG" onCopied={setStatus} />
            <a
              className={styles.secondaryButton}
              href={stickerDataUri}
              download={`lkdv-${sticker.trackId}.svg`}
            >
              <ShareIcon size={16} />
              Télécharger le SVG
            </a>
            <span className={styles.inlineNote}>
              {sticker.width} × {sticker.height} px · fond transparent.
            </span>
          </div>
        </div>
      ) : null}
    </section>
  );
}
