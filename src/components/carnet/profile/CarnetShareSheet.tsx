'use client';

import React, { useEffect } from 'react';
import { OverlaySheet } from '@/components/compte/overlay/OverlaySheet';
import { useSheetEscape } from './useSheetEscape';
import { LKDVIcon } from '@/components/ui/LKDVIcon';

export interface CarnetShareSheetProps {
  open: boolean;
  url: string;
  title: string;
  onClose: () => void;
  onCopied: () => void;
}

const TARGETS = [
  {
    id: 'whatsapp',
    label: 'WhatsApp',
    href: (url: string, title: string) => `https://wa.me/?text=${encodeURIComponent(`${title} ${url}`)}`,
  },
  {
    id: 'x',
    label: 'X',
    href: (url: string, title: string) =>
      `https://twitter.com/intent/tweet?url=${encodeURIComponent(url)}&text=${encodeURIComponent(title)}`,
  },
  {
    id: 'facebook',
    label: 'Facebook',
    href: (url: string) => `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`,
  },
  {
    id: 'mail',
    label: 'E-mail',
    href: (url: string, title: string) =>
      `mailto:?subject=${encodeURIComponent(title)}&body=${encodeURIComponent(url)}`,
  },
] as const;

/** Partage du carnet : copie, partage natif, quatre destinations réelles. */
export function CarnetShareSheet({ open, url, title, onClose, onCopied }: CarnetShareSheetProps) {
  useSheetEscape(open, onClose);
  if (!open) return null;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      onCopied();
      onClose();
    } catch {
      /* presse-papiers refusé : l'URL reste visible dans la feuille */
    }
  };

  const canNativeShare = typeof navigator !== 'undefined' && 'share' in navigator;

  const nativeShare = async () => {
    try {
      await navigator.share({ title, url });
      onClose();
    } catch {
      /* partage annulé */
    }
  };

  return (
    <OverlaySheet title="Partager le carnet" subtitle={title} onClose={onClose}>
      <div style={{ display: 'grid', gap: 8 }}>
        <button
          type="button"
          className="lkdv-drawer-btn is-primary"
          style={{ width: '100%' }}
          onClick={() => void copy()}
        >
          <LKDVIcon name="lien" size={16} aria-hidden="true" />
          Copier le lien
        </button>
        {canNativeShare ? (
          <button
            type="button"
            className="lkdv-drawer-btn is-secondary"
            style={{ width: '100%' }}
            onClick={() => void nativeShare()}
          >
            <LKDVIcon name="partager" size={16} aria-hidden="true" />
            Partager…
          </button>
        ) : null}
        <div className="lkdv-overlay-card" style={{ marginTop: 4 }}>
          {TARGETS.map((target) => (
            <a
              key={target.id}
              className="lkdv-overlay-row"
              href={target.href(url, title)}
              target="_blank"
              rel="noopener noreferrer"
            >
              <span className="lkdv-overlay-row-main">
                <b>{target.label}</b>
              </span>
              <LKDVIcon name="lien" size={15} aria-hidden="true" />
            </a>
          ))}
        </div>
        <p className="ckp-text" style={{ margin: 0, color: 'var(--feed-muted)' }}>
          {url}
        </p>
      </div>
    </OverlaySheet>
  );
}

export default CarnetShareSheet;
