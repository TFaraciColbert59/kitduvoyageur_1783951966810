'use client';

import React from 'react';
import type { CollectionSearchHit } from '@/features/highlights';
import {
  bodyStyle,
  buttonStyle,
  chipStyle,
  helperStyle,
  inputStyle,
  labelStyle,
  rowStyle,
} from './styles';

export interface CollectionsPanelProps {
  hits: CollectionSearchHit[];
  query: string;
  onQueryChange: (query: string) => void;
  onOpen: (collectionId: string) => void;
  emptyLabel?: string;
}

/**
 * K5.18 — recherche de collections. Les résultats sont déjà filtrés par
 * visibilité : une collection privée d'un autre compte n'est jamais listée.
 */
export function CollectionsPanel({
  hits,
  query,
  onQueryChange,
  onOpen,
  emptyLabel = 'Aucune collection ne correspond.',
}: CollectionsPanelProps) {
  return (
    <section aria-label="Recherche de collections" style={{ display: 'grid', gap: 12 }}>
      <label style={{ display: 'grid', gap: 6 }}>
        <span style={labelStyle}>Rechercher une collection</span>
        <input
          type="search"
          style={inputStyle}
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder="Titre, thème, région…"
          aria-label="Rechercher une collection"
        />
      </label>

      {hits.length === 0 ? (
        <p style={helperStyle}>{emptyLabel}</p>
      ) : (
        <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
          {hits.map((hit) => (
            <li key={hit.collection.id} style={rowStyle}>
              <button
                type="button"
                onClick={() => onOpen(hit.collection.id)}
                style={{
                  ...bodyStyle,
                  flex: 1,
                  textAlign: 'left',
                  background: 'transparent',
                  border: 0,
                  padding: 0,
                  minHeight: 44,
                  cursor: 'pointer',
                }}
              >
                <strong style={{ display: 'block' }}>{hit.collection.title}</strong>
                <span style={{ ...helperStyle, display: 'block' }}>
                  {[hit.collection.theme, hit.collection.region].filter(Boolean).join(' · ') ||
                    'Sans thème'}{' '}
                  · {hit.collection.itemCount} objet{hit.collection.itemCount > 1 ? 's' : ''}
                </span>
              </button>
              <span style={chipStyle}>
                {hit.collection.visibility === 'public'
                  ? 'Publique'
                  : hit.collection.visibility === 'followers'
                    ? 'Abonnés'
                    : hit.collection.visibility === 'unlisted'
                      ? 'Lien'
                      : 'Privée'}
              </span>
              <button type="button" style={buttonStyle} onClick={() => onOpen(hit.collection.id)}>
                Ouvrir
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
