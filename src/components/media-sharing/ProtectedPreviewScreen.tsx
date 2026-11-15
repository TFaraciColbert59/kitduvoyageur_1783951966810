'use client';

import React, { useId, useState } from 'react';
import type { PublishableTrackProjection } from '@/features/media-sharing';
import styles from './media-sharing.module.css';
import {
  absolutePreviewUrl,
  createProtectedPreviewLink,
  revokeProtectedPreviewLink,
  type PreviewLinkSummary,
} from './client';
import { formatDateMs, formatExpiry, formatDateTimeMs } from './format';
import { Badge, EmptyState, ErrorState, SectionHeading } from './StateCards';
import { CheckIcon, CopyIcon, EyeIcon, LinkIcon, LockIcon, ShieldIcon } from './icons';

const TTL_OPTIONS = [
  { value: 3600, label: '1 heure' },
  { value: 86_400, label: '24 heures' },
  { value: 604_800, label: '7 jours' },
] as const;

async function copyToClipboard(value: string): Promise<boolean> {
  try {
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(value);
      return true;
    }
  } catch {
    /* repli */
  }
  try {
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

interface DisplayLink extends PreviewLinkSummary {
  token: string;
  url: string;
}

export interface ProtectedPreviewScreenProps {
  track: PublishableTrackProjection;
  ownerId: string;
  initialLinks?: DisplayLink[];
}

/**
 * K5.28 — Création et révocation d'un aperçu protégé.
 * Le jeton brut n'existe que dans la réponse de création puis dans cet état ;
 * le serveur ne conserve que son SHA-256.
 */
export function ProtectedPreviewScreen({
  track,
  ownerId,
  initialLinks = [],
}: ProtectedPreviewScreenProps) {
  const headingId = useId();
  const [ttl, setTtl] = useState<number>(TTL_OPTIONS[0].value);
  const [links, setLinks] = useState<DisplayLink[]>(initialLinks);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState('');
  const [copiedLinkId, setCopiedLinkId] = useState<string | null>(null);

  async function createLink() {
    setBusy(true);
    setError(null);
    setStatus('');
    try {
      const created = await createProtectedPreviewLink({
        track,
        ownerId,
        expiresInSec: ttl,
      });
      setLinks((current) => [
        {
          ...created.record,
          token: created.token,
          url: created.url,
        },
        ...current,
      ]);
      setStatus('Lien créé. Copie-le maintenant : il reste révocable à tout moment.');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Création impossible');
    } finally {
      setBusy(false);
    }
  }

  async function revokeLink(linkId: string) {
    setBusy(true);
    setError(null);
    try {
      await revokeProtectedPreviewLink({ linkId, ownerId });
      setLinks((current) =>
        current.map((link) =>
          link.linkId === linkId ? { ...link, revokedAtMs: Date.now() } : link,
        ),
      );
      setStatus('Lien révoqué. Le destinataire ne peut plus rien consulter.');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Révocation impossible');
    } finally {
      setBusy(false);
    }
  }

  async function copyLink(link: DisplayLink) {
    const url = absolutePreviewUrl(link.url);
    const copied = await copyToClipboard(url);
    if (copied) {
      setCopiedLinkId(link.linkId);
      setStatus('Lien copié dans le presse-papiers.');
    } else {
      setStatus('Copie impossible : sélectionne le lien manuellement.');
    }
  }

  const activeLinks = links.filter((link) => link.revokedAtMs === null);

  return (
    <section className={styles.screen} aria-labelledby={headingId}>
      <SectionHeading
        eyebrow="Aperçu révocable"
        title="Partager un tracé sans le rendre navigable"
        description="Un lien à durée limitée, sans téléchargement ni guidage, invalidé si les zones de confidentialité changent."
        action={
          <div className={styles.badgeRow}>
            <Badge tone="success">
              <ShieldIcon size={13} /> SHA-256
            </Badge>
            <Badge tone="neutral">non navigable</Badge>
          </div>
        }
      />

      <div className={styles.previewControls}>
        <div className={styles.fieldGroup}>
          <span className={styles.fieldLabel}>Durée du lien</span>
          <div className={styles.segmented} role="group" aria-label="Durée du lien">
            {TTL_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                className={styles.segment}
                data-active={ttl === option.value ? 'true' : 'false'}
                aria-pressed={ttl === option.value}
                onClick={() => setTtl(option.value)}
                disabled={busy}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
        <button
          type="button"
          className={styles.primaryButton}
          onClick={createLink}
          disabled={busy}
        >
          <LinkIcon size={17} />
          {busy ? 'Création…' : 'Créer un lien révocable'}
        </button>
      </div>

      <p className={styles.srOnly} role="status" aria-live="polite">
        {status}
      </p>
      {error ? (
        <ErrorState
          title="Le lien n'a pas été créé"
          message={error}
          onRetry={createLink}
        />
      ) : null}

      <div className={styles.statsRow}>
        <div className={styles.stat}>
          <span className={styles.statLabel}>Liens actifs</span>
          <strong className={styles.statValue}>{activeLinks.length}</strong>
          <span className={styles.statHint}>révocables individuellement</span>
        </div>
        <div className={styles.stat}>
          <span className={styles.statLabel}>Audience</span>
          <strong className={styles.statValue}>Lien privé</strong>
          <span className={styles.statHint}>hors fil et hors profil</span>
        </div>
        <div className={styles.stat}>
          <span className={styles.statLabel}>Masque</span>
          <strong className={styles.statValue}>{track.maskedPointCount}</strong>
          <span className={styles.statHint}>points retirés</span>
        </div>
      </div>

      {links.length === 0 ? (
        <EmptyState
          title="Aucun lien pour l'instant"
          message="Crée un lien à durée limitée. Il ne donnera accès ni au fichier GPX ni à la navigation."
        />
      ) : (
        <ul className={styles.linkList} aria-label="Liens d'aperçu">
          {links.map((link) => {
            const revoked = link.revokedAtMs !== null;
            return (
              <li key={link.linkId}>
                <div className={styles.linkCard} data-revoked={revoked ? 'true' : 'false'}>
                  <div className={styles.linkTop}>
                    <div className={styles.linkTitle}>
                      <span className={styles.linkIcon} aria-hidden="true">
                        {revoked ? <LockIcon size={18} /> : <EyeIcon size={18} />}
                      </span>
                      <div>
                        <strong>{revoked ? 'Lien révoqué' : 'Aperçu protégé'}</strong>
                        <p>
                          {revoked
                            ? `Révoqué le ${formatDateTimeMs(link.revokedAtMs)}`
                            : `Expire le ${formatDateMs(link.expiresAtMs)} · ${formatExpiry(link.expiresAtMs)}`}
                        </p>
                      </div>
                    </div>
                    <Badge tone={revoked ? 'danger' : 'success'}>
                      {revoked ? 'inactif' : 'actif'}
                    </Badge>
                  </div>

                  <div className={styles.linkRow}>
                    <code className={styles.linkValue}>{absolutePreviewUrl(link.url)}</code>
                    <div className={styles.linkActions}>
                      <button
                        type="button"
                        className={styles.iconButton}
                        aria-label="Copier le lien d'aperçu"
                        onClick={() => copyLink(link)}
                        disabled={revoked}
                      >
                        {copiedLinkId === link.linkId ? (
                          <CheckIcon size={17} />
                        ) : (
                          <CopyIcon size={17} />
                        )}
                      </button>
                      <button
                        type="button"
                        className={styles.dangerButton}
                        onClick={() => revokeLink(link.linkId)}
                        disabled={revoked || busy}
                      >
                        Révoquer
                      </button>
                    </div>
                  </div>
                  <p className={styles.linkFootnote}>
                    Lien court SHA-256 · le jeton brut n’est jamais stocké côté serveur.
                  </p>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
