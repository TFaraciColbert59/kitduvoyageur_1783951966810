'use client';

import React from 'react';
import { highlightParts } from '../../shared/format';

export interface HighlightedTextProps {
  text: string;
  terms: ReadonlyArray<string>;
  className?: string;
}

/**
 * Texte avec terme recherché surligné (Recherche#8) : accents et casse
 * ignorés via `highlightParts` (pur, testé), jamais de HTML injecté.
 */
export function HighlightedText({ text, terms, className }: HighlightedTextProps) {
  const parts = highlightParts(text, [...terms]);
  return (
    <span className={className}>
      {parts.map((part, index) =>
        part.match ? (
          <mark key={index} className="lkdv-cv2x-hl">
            {part.text}
          </mark>
        ) : (
          <React.Fragment key={index}>{part.text}</React.Fragment>
        ),
      )}
    </span>
  );
}

export default HighlightedText;
