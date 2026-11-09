'use client';

import React, { createContext, useContext, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

/**
 * FID-056 — **aperçu vivant dans un emplacement fixe de 150 px**, hors du flux
 * qui défile. La maquette monte `#crprev` entre la capsule et le carrousel
 * d'étapes (`maquette-communaute.html` L2692 : `.cr-prev` 150 px, `aria-label`
 * « Aperçu en direct »), jamais dans le pane : l'aperçu reste donc visible au
 * même endroit quel que soit le défilement du formulaire.
 *
 * Le formulaire fournit son aperçu (il garde la main sur ses valeurs) ; la
 * coque fournit la cible via un contexte. Sans coque (rendu isolé, tests),
 * `SheetPreview` ne rend rien : aucun aperçu orphelin dans le pane.
 */
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

/**
 * Portail de l'aperçu du formulaire vers le slot de la coque. Le contenu est
 * décoratif (il duplique les champs) : `inert` + `aria-hidden`, comme les
 * aperçus d'origine ; le nom accessible reste porté par le slot.
 */
export function SheetPreview({ children }: { children: ReactNode }) {
  const slot = useContext(SheetPreviewContext);
  if (!slot) return null;
  return createPortal(
    <div className="lkdv-cv2-preview-frame" inert aria-hidden="true">
      {children}
    </div>,
    slot,
  );
}
