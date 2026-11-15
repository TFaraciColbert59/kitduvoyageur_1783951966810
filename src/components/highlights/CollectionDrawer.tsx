'use client';

import React, { useState } from 'react';
import type { CollectionView } from '@/features/highlights';
import { DrawerFrame } from './DrawerFrame';
import {
  bodyStyle,
  buttonStyle,
  chipStyle,
  dangerButtonStyle,
  helperStyle,
  iconButtonStyle,
  labelStyle,
  primaryButtonStyle,
  rowStyle,
  sectionGapStyle,
} from './styles';

const VISIBILITY_LABEL: Record<CollectionView['visibility'], string> = {
  private: 'Privée',
  followers: 'Abonnés',
  public: 'Publique',
  unlisted: 'Non listée (lien)',
};

export interface CollectionDrawerProps {
  collection: CollectionView;
  onClose: () => void;
  onMove?: (itemId: string, direction: 'up' | 'down') => void;
  onRemove?: (itemId: string) => void;
  onShare?: () => void;
  onRevoke?: (linkId: string) => void;
  onVisibility?: (visibility: CollectionView['visibility']) => void;
  onOpenItem?: (itemId: string) => void;
  feedback?: { tone: 'success' | 'error'; message: string } | null;
  busy?: boolean;
}

/**
 * K5.16 / K5.18 — collection réordonnable, partage révocable.
 * La vue est projetée : les liens ne sont présents que pour le propriétaire,
 * et une collection partagée est en lecture seule.
 */
export function CollectionDrawer({
  collection,
  onClose,
  onMove,
  onRemove,
  onShare,
  onRevoke,
  onVisibility,
  onOpenItem,
  feedback = null,
  busy = false,
}: CollectionDrawerProps) {
  const [shareOpen, setShareOpen] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const activeLinks = collection.links.filter((link) => link.revokedAt == null);

  const copy = async (path: string) => {
    try {
      await navigator.clipboard?.writeText(path);
      setCopied(path);
      window.setTimeout(() => setCopied(null), 1600);
    } catch {
      setCopied(null);
    }
  };

  return (
    <DrawerFrame
      eyebrow={collection.kind === 'editorial' ? 'Collection éditoriale' : 'Ma collection'}
      title={collection.title}
      subtitle={
        [collection.theme, collection.region, collection.partner].filter(Boolean).join(' · ') ||
        undefined
      }
      onClose={onClose}
      testId="collection-drawer"
    >
      <div style={sectionGapStyle}>
        {feedback ? (
          <p
            role="status"
            style={{
              ...helperStyle,
              color: feedback.tone === 'error' ? 'var(--lkv-danger)' : 'var(--lkv-success)',
            }}
          >
            {feedback.message}
          </p>
        ) : null}

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <span style={chipStyle} data-testid="collection-visibility">
            {VISIBILITY_LABEL[collection.visibility]}
          </span>
          <span style={chipStyle}>
            {collection.itemCount} objet{collection.itemCount > 1 ? 's' : ''}
          </span>
          {collection.shared ? <span style={chipStyle}>Lecture seule · lien</span> : null}
        </div>

        {collection.description ? <p style={bodyStyle}>{collection.description}</p> : null}

        {collection.canEdit ? (
          <label style={{ display: 'grid', gap: 6 }}>
            <span style={labelStyle}>Visibilité</span>
            <select
              style={{ ...buttonStyle, width: '100%' }}
              value={collection.visibility}
              onChange={(event) =>
                onVisibility?.(event.target.value as CollectionView['visibility'])
              }
              disabled={busy || !onVisibility || collection.kind === 'editorial'}
            >
              <option value="private">Privée</option>
              <option value="followers">Abonnés</option>
              <option value="public">Publique</option>
              <option value="unlisted">Non listée (lien)</option>
            </select>
          </label>
        ) : null}

        <section aria-label="Objets de la collection">
          <p style={labelStyle}>Contenu</p>
          {collection.items.length === 0 ? (
            <p style={helperStyle}>Cette collection est vide.</p>
          ) : (
            <ol style={{ listStyle: 'none', margin: 0, padding: 0 }}>
              {collection.items.map((item, index) => (
                <li key={item.id} style={rowStyle}>
                  <button
                    type="button"
                    onClick={() => onOpenItem?.(item.id)}
                    style={{
                      ...bodyStyle,
                      background: 'transparent',
                      border: 0,
                      padding: 0,
                      textAlign: 'left',
                      cursor: onOpenItem ? 'pointer' : 'default',
                      minHeight: 44,
                    }}
                  >
                    <span style={{ ...helperStyle, display: 'block' }}>
                      {index + 1}.{' '}
                      {item.type === 'route'
                        ? 'Parcours'
                        : item.type === 'poi'
                          ? 'Lieu'
                          : 'Highlight'}
                    </span>
                    {item.title}
                  </button>
                  {collection.canEdit ? (
                    <div style={{ display: 'flex', gap: 4 }}>
                      <button
                        type="button"
                        aria-label={`Monter ${item.title}`}
                        style={iconButtonStyle}
                        onClick={() => onMove?.(item.id, 'up')}
                        disabled={busy || index === 0 || !onMove}
                      >
                        ↑
                      </button>
                      <button
                        type="button"
                        aria-label={`Descendre ${item.title}`}
                        style={iconButtonStyle}
                        onClick={() => onMove?.(item.id, 'down')}
                        disabled={busy || index === collection.items.length - 1 || !onMove}
                      >
                        ↓
                      </button>
                      <button
                        type="button"
                        aria-label={`Retirer ${item.title}`}
                        style={{ ...iconButtonStyle, color: 'var(--lkv-danger)' }}
                        onClick={() => onRemove?.(item.id)}
                        disabled={busy || !onRemove}
                      >
                        ✕
                      </button>
                    </div>
                  ) : null}
                </li>
              ))}
            </ol>
          )}
        </section>

        {collection.canShare ? (
          <section aria-label="Partage de la collection">
            <div style={{ ...rowStyle, borderTop: 0 }}>
              <div>
                <p style={labelStyle}>Partage</p>
                <p style={helperStyle}>
                  {activeLinks.length > 0
                    ? `${activeLinks.length} lien${activeLinks.length > 1 ? 's' : ''} actif${activeLinks.length > 1 ? 's' : ''}`
                    : 'Aucun lien actif'}
                </p>
              </div>
              <button
                type="button"
                style={buttonStyle}
                onClick={() => setShareOpen((value) => !value)}
              >
                {shareOpen ? 'Fermer' : 'Partager'}
              </button>
            </div>

            {shareOpen ? (
              <div style={{ display: 'grid', gap: 8 }}>
                <button
                  type="button"
                  style={primaryButtonStyle}
                  onClick={onShare}
                  disabled={busy || !onShare}
                >
                  Créer un lien révocable
                </button>
                {collection.links.length === 0 ? (
                  <p style={helperStyle}>
                    Un lien permet une lecture sans compte. Il reste révocable.
                  </p>
                ) : (
                  <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                    {collection.links.map((link) => (
                      <li key={link.id} style={{ ...rowStyle, flexWrap: 'wrap' }}>
                        <code
                          style={{
                            fontSize: 12,
                            overflowWrap: 'anywhere',
                            color: 'var(--lkv-text-secondary)',
                          }}
                        >
                          {link.path}
                        </code>
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button
                            type="button"
                            style={buttonStyle}
                            onClick={() => copy(link.path)}
                            disabled={link.revokedAt != null}
                          >
                            {copied === link.path ? 'Copié' : 'Copier'}
                          </button>
                          <button
                            type="button"
                            style={dangerButtonStyle}
                            onClick={() => onRevoke?.(link.id)}
                            disabled={busy || link.revokedAt != null || !onRevoke}
                          >
                            {link.revokedAt ? 'Révoqué' : 'Révoquer'}
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ) : null}
          </section>
        ) : (
          <p style={helperStyle}>Partage réservé au propriétaire de la collection.</p>
        )}
      </div>
    </DrawerFrame>
  );
}
