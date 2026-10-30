'use client';

import React from 'react';
import Icon from '@/components/ui/Icon';
import { CarnetField } from '../CarnetField';

export interface CarnetSharePaneProps {
  url: string;
  title: string;
  onCopied: () => void;
}

const TARGETS = [
  { id: 'whatsapp', label: 'whatsapp', href: (url: string, title: string) => `https://wa.me/?text=${encodeURIComponent(`${title} ${url}`)}` },
  { id: 'x', label: 'x', href: (url: string, title: string) => `https://twitter.com/intent/tweet?url=${encodeURIComponent(url)}&text=${encodeURIComponent(title)}` },
  { id: 'facebook', label: 'facebook', href: (url: string) => `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}` },
  { id: 'mail', label: 'e-mail', href: (url: string, title: string) => `mailto:?subject=${encodeURIComponent(title)}&body=${encodeURIComponent(url)}` },
] as const;

function chunks<T>(items: readonly T[], size = 3): T[][] {
  const groups: T[][] = [];
  for (let index = 0; index < items.length; index += size) groups.push(items.slice(index, index + size));
  return groups;
}

/**
 * Partage : deux champs d'action, les quatre destinations réelles, le lien.
 * Aucun titre, aucune phrase — les libellés sont des placeholders et chaque
 * destination garde son geste (copier, partager, ouvrir, écrire).
 */
export function CarnetSharePane({ url, title, onCopied }: CarnetSharePaneProps) {
  const canNativeShare = typeof navigator !== 'undefined' && 'share' in navigator;

  return (
    <div className="ckp-pane ckp-pane-share">
      <div className="ckp-group">
        <CarnetField
          icon={<Icon name="link" size={16} aria-hidden="true" />}
          label="copier le lien"
          showValue={false}
          ariaLabel="Copier le lien du carnet"
          onClick={() => {
            void navigator.clipboard.writeText(url).then(onCopied);
          }}
        />
        {canNativeShare ? (
          <CarnetField
            icon={<Icon name="send" size={16} aria-hidden="true" />}
            label="partager…"
            showValue={false}
            ariaLabel="Partager le carnet"
            onClick={() => {
              void navigator.share({ title, url }).catch(() => {});
            }}
          />
        ) : null}
      </div>

      {chunks(TARGETS).map((group, index) => (
        <div className="ckp-group" key={index}>
          {group.map((target) => (
            <CarnetField
              key={target.id}
              label={target.label}
              href={target.href(url, title)}
              ariaLabel={`${target.label} — ouvrir dans un nouvel onglet`}
              value={<Icon name="external-link" size={16} aria-hidden="true" />}
            />
          ))}
        </div>
      ))}

      <div className="ckp-group">
        <CarnetField label="lien" value={url} wide ariaLabel={`lien ${url}`} />
      </div>
    </div>
  );
}

export default CarnetSharePane;
