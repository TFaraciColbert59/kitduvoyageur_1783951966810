'use client';

import React from 'react';
import Icon from '@/components/ui/Icon';

export interface CarnetSharePaneProps {
  url: string;
  title: string;
  onCopied: () => void;
}

const TARGETS = [
  { id: 'whatsapp', label: 'WhatsApp', href: (url: string, title: string) => `https://wa.me/?text=${encodeURIComponent(`${title} ${url}`)}` },
  { id: 'x', label: 'X', href: (url: string, title: string) => `https://twitter.com/intent/tweet?url=${encodeURIComponent(url)}&text=${encodeURIComponent(title)}` },
  { id: 'facebook', label: 'Facebook', href: (url: string) => `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}` },
  { id: 'mail', label: 'E-mail', href: (url: string, title: string) => `mailto:?subject=${encodeURIComponent(title)}&body=${encodeURIComponent(url)}` },
] as const;

export function CarnetSharePane({ url, title, onCopied }: CarnetSharePaneProps) {
  const canNativeShare = typeof navigator !== 'undefined' && 'share' in navigator;

  return (
    <div className="ckp-pane">
      <button
        type="button"
        className="ckp-pill ckp-pill--primary"
        onClick={() => {
          void navigator.clipboard.writeText(url).then(onCopied);
        }}
      >
        <Icon name="link" size={16} aria-hidden="true" />
        Copier le lien
      </button>

      {canNativeShare ? (
        <button
          type="button"
          className="ckp-pill"
          onClick={() => {
            void navigator.share({ title, url }).catch(() => {});
          }}
        >
          <Icon name="send" size={16} aria-hidden="true" />
          Partager…
        </button>
      ) : null}

      <div>
        {TARGETS.map((target) => (
          <a
            key={target.id}
            className="ckp-share-row"
            href={target.href(url, title)}
            target="_blank"
            rel="noopener noreferrer"
          >
            <span>{target.label}</span>
            <Icon name="external-link" size={15} aria-hidden="true" />
          </a>
        ))}
      </div>

      <p className="ckp-bio" style={{ margin: 0 }}>{url}</p>
    </div>
  );
}

export default CarnetSharePane;
