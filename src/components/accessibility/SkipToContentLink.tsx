'use client';

/**
 * Lien d'évitement RGAA/WCAG 2.4.1 (Lot O02-UI).
 *
 * Il reste hors écran jusqu'au focus clavier, puis place réellement le focus
 * sur la cible (`tabindex="-1"` ajouté si absent) pour que la tabulation
 * suivante continue dans le contenu, pas dans la navigation.
 */

import React, { useCallback, type ReactNode } from 'react';
import { AccessibilityStyles } from './AccessibilityStyles';

export interface SkipToContentLinkProps {
  /** Id de la cible, sans `#`. */
  targetId?: string;
  children?: ReactNode;
  className?: string;
  /** Libellé accessible si le texte visible est une abréviation. */
  label?: string;
}

export function SkipToContentLink({
  targetId = 'contenu',
  children = 'Aller au contenu principal',
  className,
  label,
}: SkipToContentLinkProps) {
  const handleClick = useCallback(
    (event: React.MouseEvent<HTMLAnchorElement>) => {
      const target = document.getElementById(targetId);
      if (!target) return;
      event.preventDefault();
      if (!target.hasAttribute('tabindex')) {
        target.setAttribute('tabindex', '-1');
      }
      target.focus({ preventScroll: true });
      try {
        target.scrollIntoView?.({ block: 'start' });
      } catch {
        // jsdom / anciens navigateurs : le focus suffit.
      }
      try {
        window.history?.replaceState?.(null, '', `#${targetId}`);
      } catch {
        // Origine opaque ou historique indisponible : le focus est déjà posé.
      }
    },
    [targetId],
  );

  return (
    <>
      <AccessibilityStyles />
      <a
        href={`#${targetId}`}
        className={['lkdv-a11y-skip', className].filter(Boolean).join(' ')}
        aria-label={label}
        onClick={handleClick}
        data-lkdv-skip-link=""
      >
        {children}
      </a>
    </>
  );
}

export default SkipToContentLink;
