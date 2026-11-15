'use client';

import React from 'react';
import type { InspirationRecommendation } from '@/features/highlights';
import { bodyStyle, chipStyle, helperStyle, labelStyle, panelStyle } from './styles';

export interface InspirationRailProps {
  recommendations: InspirationRecommendation[];
  onOpen: (candidateId: string) => void;
  title?: string;
}

/**
 * K1.10 — cartes de parcours et collections recommandés dans le fil existant.
 * Chaque carte explique pourquoi elle est là ; rien n'est affiché sans
 * donnée autorisée (le moteur a déjà filtré l'audience).
 */
export function InspirationRail({
  recommendations,
  onOpen,
  title = 'Pour toi',
}: InspirationRailProps) {
  if (recommendations.length === 0) {
    return (
      <section aria-label={title} style={{ ...panelStyle, padding: 16 }}>
        <p style={labelStyle}>{title}</p>
        <p style={helperStyle}>Aucune recommandation pour l’instant.</p>
      </section>
    );
  }

  return (
    <section aria-label={title} style={{ display: 'grid', gap: 8 }}>
      <p style={labelStyle}>{title}</p>
      <ul
        style={{
          display: 'flex',
          gap: 10,
          overflowX: 'auto',
          listStyle: 'none',
          margin: 0,
          padding: '2px 0 8px',
        }}
      >
        {recommendations.map(({ candidate, reason }) => (
          <li key={candidate.id} style={{ flex: '0 0 210px' }}>
            <button
              type="button"
              onClick={() => onOpen(candidate.id)}
              style={{
                ...panelStyle,
                width: '100%',
                minHeight: 132,
                padding: 14,
                textAlign: 'left',
                cursor: 'pointer',
                display: 'grid',
                gap: 6,
                alignContent: 'start',
              }}
            >
              <span style={chipStyle}>{reason}</span>
              <span style={{ ...bodyStyle, fontWeight: 650 }}>{candidate.title}</span>
              <span style={helperStyle}>
                {[
                  candidate.region,
                  candidate.type === 'route'
                    ? 'Parcours'
                    : candidate.type === 'collection'
                      ? 'Collection'
                      : 'Highlight',
                ]
                  .filter(Boolean)
                  .join(' · ')}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
