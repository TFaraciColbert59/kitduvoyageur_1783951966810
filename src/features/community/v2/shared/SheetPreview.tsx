'use client';

import React, { createContext, useContext, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, Eye } from 'lucide-react';

export const SheetPreviewContext = createContext<HTMLElement | null>(null);

/** Cible rendue par `CommunitySheetShell` entre la capsule et le pager. */
export function SheetPreviewSlot({
  slotRef,
}: {
  slotRef: (element: HTMLDivElement | null) => void;
}) {
  return (
    <div
      ref={slotRef}
      className="lkdv-cv2-preview-slot"
      data-testid="cv2-preview-slot"
      role="group"
      aria-label="Aperçu en direct"
    />
  );
}

export interface SheetPreviewSummary {
  icon?: ReactNode;
  title: string;
  meta?: string;
  badge?: string;
}

/**
 * Bandeau résumé 1 ligne dépliable (ou carte complète) dans l'emplacement fixe
 * de la coque (`CommunitySheetShell`). En mode compact, affiche une barre
 * claire de 44 px avec bouton « Aperçu » pour éviter de couper les cartes ou
 * d'écraser le formulaire sur mobile.
 */
export function SheetPreview({
  children,
  compact = false,
  summary,
}: {
  children: ReactNode;
  compact?: boolean;
  summary?: SheetPreviewSummary;
}) {
  const host = useContext(SheetPreviewContext);
  const [expanded, setExpanded] = useState(false);
  if (!host) return null;

  const showCollapsedBar = compact && !expanded && Boolean(summary);

  return createPortal(
    <div
      className="lkdv-cv2-preview-frame"
      data-compact={showCollapsedBar ? 'true' : undefined}
      data-expanded={compact && expanded ? 'true' : undefined}
    >
      {showCollapsedBar && summary ? (
        <div className="lkdv-cv2c-preview-bar">
          {summary.icon ? (
            <span className="lkdv-cv2c-preview-bar-ico" aria-hidden="true">
              {summary.icon}
            </span>
          ) : null}
          <span className="lkdv-cv2c-preview-bar-txt">
            <b>{summary.title}</b>
            {summary.meta ? <small>{summary.meta}</small> : null}
          </span>
          {summary.badge ? <span className="lkdv-cv2c-preview-bar-badge">{summary.badge}</span> : null}
          <button
            type="button"
            className="lkdv-cv2c-preview-toggle"
            aria-expanded={false}
            onClick={() => setExpanded(true)}
          >
            <Eye size={13} aria-hidden="true" />
            Aperçu
            <ChevronDown size={13} aria-hidden="true" />
          </button>
        </div>
      ) : (
        <>
          {compact ? (
            <div className="lkdv-cv2c-preview-collapse-row">
              <button
                type="button"
                className="lkdv-cv2c-preview-toggle"
                aria-expanded={true}
                onClick={() => setExpanded(false)}
              >
                Masquer l’aperçu
                <ChevronDown
                  size={13}
                  aria-hidden="true"
                  style={{ transform: 'rotate(180deg)' }}
                />
              </button>
            </div>
          ) : null}
          {children}
        </>
      )}
    </div>,
    host,
  );
}
