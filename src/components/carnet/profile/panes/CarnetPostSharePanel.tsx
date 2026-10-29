'use client';

import React, { useMemo, useState } from 'react';
import Icon from '@/components/ui/Icon';

export interface CarnetPostSharePanelProps {
  /** Lien réel du carnet, seul contenu partagé. */
  url: string;
  /** Titre réel du carnet, porté par les partages qui l'acceptent. */
  title: string;
  onCopied: () => void;
}

interface Target {
  id: string;
  label: string;
  detail: string;
  href: (url: string, title: string) => string;
}

/** Les quatre destinations réelles du carnet — aucune conversation inventée. */
const TARGETS: Target[] = [
  {
    id: 'whatsapp',
    label: 'WhatsApp',
    detail: 'Message',
    href: (url, title) => `https://wa.me/?text=${encodeURIComponent(`${title} ${url}`)}`,
  },
  {
    id: 'x',
    label: 'X',
    detail: 'Publication',
    href: (url, title) => `https://twitter.com/intent/tweet?url=${encodeURIComponent(url)}&text=${encodeURIComponent(title)}`,
  },
  {
    id: 'facebook',
    label: 'Facebook',
    detail: 'Publication',
    href: (url) => `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`,
  },
  {
    id: 'mail',
    label: 'E-mail',
    detail: 'Message privé',
    href: (url, title) => `mailto:?subject=${encodeURIComponent(title)}&body=${encodeURIComponent(url)}`,
  },
];

/**
 * Partage du post du carnet, dans le bloc exact du fil de la Communauté.
 *
 * Même corps (`.lkdv-post-panel-body`), même recherche (`.lkdv-search-box`),
 * même grille d'actions (`.lkdv-share-actions` / `.lkdv-share-action` avec son
 * rond `.ico`), mêmes lignes de destinataire (`.lkdv-share-conv`) et même
 * mini-barre (`.lkdv-share-mini`). Seul le contenu change : le carnet n'a pas
 * de conversation à qui envoyer un post, il a quatre destinations réelles et un
 * lien.
 */
export function CarnetPostSharePanel({ url, title, onCopied }: CarnetPostSharePanelProps) {
  const [query, setQuery] = useState('');
  const [copied, setCopied] = useState(false);
  const canNativeShare = typeof navigator !== 'undefined' && 'share' in navigator;

  const targets = useMemo(() => {
    const text = query.trim().toLowerCase();
    if (!text) return TARGETS;
    return TARGETS.filter((target) => `${target.label} ${target.detail}`.toLowerCase().includes(text));
  }, [query]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      onCopied();
    } catch {
      /* le presse-papiers peut refuser : aucun état n'est inventé */
    }
  };

  const shareNative = async () => {
    if (typeof navigator === 'undefined' || !navigator.share) {
      await copy();
      return;
    }
    try {
      await navigator.share({ title, url });
    } catch {
      /* geste annulé */
    }
  };

  return (
    <>
      <div className="lkdv-post-panel-body">
        <div className="lkdv-search-box">
          <Icon name="search" size={15} aria-hidden="true" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Rechercher une destination…"
            aria-label="Rechercher une destination"
          />
        </div>

        <div className="lkdv-share-actions">
          <button
            type="button"
            className="lkdv-share-action"
            onClick={() => document.getElementById('carnet-share-targets')?.scrollIntoView({ behavior: 'smooth' })}
          >
            <span className="ico">
              <Icon name="send" size={18} aria-hidden="true" />
            </span>
            Envoyer
          </button>
          <button type="button" className="lkdv-share-action" onClick={() => void copy()}>
            <span className="ico">
              <Icon name="link" size={18} aria-hidden="true" />
            </span>
            {copied ? 'Copié' : 'Copier'}
          </button>
          {canNativeShare ? (
            <button type="button" className="lkdv-share-action" onClick={() => void shareNative()}>
              <span className="ico">
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.9"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M12 3v12M8 7l4-4 4 4M6 11v9h12v-9" />
                </svg>
              </span>
              Partager
            </button>
          ) : null}
        </div>

        <div id="carnet-share-targets">
          <p className="mb-1 text-[10px] font-bold uppercase tracking-[.08em] text-[#56665D]">Envoyer le carnet</p>
          {targets.length === 0 ? (
            <p className="lkdv-section-empty">Aucune destination trouvée.</p>
          ) : (
            targets.map((target) => (
              <div key={target.id} className="lkdv-share-conv">
                <span className="grid h-8 w-8 place-items-center rounded-full bg-[#ddebd8] text-[11px] font-bold text-[#17402C]" aria-hidden="true">
                  {target.label.charAt(0)}
                </span>
                <div>
                  <b>{target.label}</b>
                  <small>{target.detail}</small>
                </div>
                <a href={target.href(url, title)} target="_blank" rel="noopener noreferrer" aria-label={`${target.label} — ouvrir`}>
                  Envoyer
                </a>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="lkdv-share-mini" role="group" aria-label="Actions de partage">
        <button
          type="button"
          aria-label="Envoyer le carnet"
          onClick={() => document.getElementById('carnet-share-targets')?.scrollIntoView({ behavior: 'smooth' })}
        >
          <Icon name="send" size={15} aria-hidden="true" />
        </button>
        <button type="button" aria-label="Copier le lien" onClick={() => void copy()}>
          <Icon name="link" size={15} aria-hidden="true" />
        </button>
        <button type="button" aria-label="Partager via l’appareil" onClick={() => void shareNative()}>
          {/* Même glyphe que l'action « Partager » : le nom `share` n'existe pas
              dans le jeu d'icônes, un bouton muet serait un bouton mort. */}
          <svg
            width="15"
            height="15"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.9"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M12 3v12M8 7l4-4 4 4M6 11v9h12v-9" />
          </svg>
        </button>
      </div>
    </>
  );
}

export default CarnetPostSharePanel;
