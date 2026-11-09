'use client';

import React, { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

/**
 * Dialogue de confirmation du tiroir Création — traduction de `lkvConfirm`
 * (maquette `maquette-communaute.html` L1759-1770) :
 *
 * - **scrim plein écran** `inset:0` : rendu dans un portail sur la couche v2
 *   (`.lkdv-communaute-v2`, `position:fixed; inset:0`), donc le fond reste
 *   cliquable-proof et le dialogue est centré sur le viewport (FID-036) ;
 * - « Annuler » (ou « Continuer l'édition ») en **ghost à gauche**, action
 *   sûre, **focus initial** ; action de confirmation en **danger** à droite
 *   quand `danger` (maquette `mbtn danger`, FID-066) ;
 * - piège de focus (Tab cyclique), Échap = annulation, clic sur le scrim =
 *   annulation (maquette `done(false)`), restitution du focus au déclencheur ;
 * - le reste du tiroir est rendu `inert` + `aria-hidden` pendant l'ouverture.
 */

export interface ConfirmDialogV2Props {
  open: boolean;
  title: string;
  /** Corps du dialogue (une phrase, comme la maquette). */
  text?: React.ReactNode;
  confirmLabel: string;
  cancelLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
  /** Action de droite en rouge (maquette : `danger=true` par défaut). */
  danger?: boolean;
  /** `data-testid` du dialogue (les e2e visent `role="alertdialog"`). */
  testId?: string;
}

/** Éléments du tiroir rendus inertes pendant le dialogue (maquette L1768). */
const INERT_SELECTORS = '.lkdv-cv2-body, .lkdv-cv2-topnav, .lkdv-cv2-mini-slot, .lkdv-cv2-footer';

export function ConfirmDialogV2({
  open,
  title,
  text,
  confirmLabel,
  cancelLabel,
  onConfirm,
  onCancel,
  danger = true,
  testId,
}: ConfirmDialogV2Props) {
  const anchorRef = useRef<HTMLSpanElement | null>(null);
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLElement | null>(null);
  const [layer, setLayer] = useState<HTMLElement | null>(null);
  const titleId = useId();
  const textId = useId();

  // Cible du portail : la couche v2 (`fixed; inset:0`) la plus proche du point
  // d'ancrage. Le dialogue hérite ainsi des jetons `--cv2-*` du tiroir.
  useEffect(() => {
    if (!open || typeof document === 'undefined') {
      setLayer(null);
      return;
    }
    const anchor = anchorRef.current;
    const closest = anchor?.closest('.lkdv-communaute-v2');
    setLayer(closest instanceof HTMLElement ? closest : document.body);
  }, [open]);

  // Inertie du fond + focus initial sur l'action sûre + restitution au
  // déclencheur (maquette `requestAnimationFrame($('[data-k=no]').focus())`).
  useEffect(() => {
    if (!open || !layer) return;
    const dialog = dialogRef.current;
    triggerRef.current = document.activeElement as HTMLElement | null;
    const sheet = layer.querySelector('.lkdv-cv2-sheet');
    const touched: Array<{ element: Element; inert: boolean; ariaHidden: string | null }> = [];
    sheet?.querySelectorAll(INERT_SELECTORS).forEach((element) => {
      if (dialog && element.contains(dialog)) return;
      const html = element as HTMLElement;
      touched.push({
        element,
        inert: html.inert || element.hasAttribute('inert'),
        ariaHidden: element.getAttribute('aria-hidden'),
      });
      html.inert = true;
      element.setAttribute('inert', '');
      element.setAttribute('aria-hidden', 'true');
    });
    // Le reste du viewport (fil, barre d'onglets) ne reçoit plus le focus.
    const page = document.getElementById('page');
    const pageInert = page?.hasAttribute('inert') ?? false;
    if (page && !pageInert) page.setAttribute('inert', '');
    const timer = window.setTimeout(() => {
      dialog?.querySelector<HTMLElement>('[data-cv2-confirm-cancel]')?.focus();
    }, 80);
    return () => {
      window.clearTimeout(timer);
      touched.forEach(({ element, inert, ariaHidden }) => {
        (element as HTMLElement).inert = inert;
        if (!inert) element.removeAttribute('inert');
        if (ariaHidden == null) element.removeAttribute('aria-hidden');
        else element.setAttribute('aria-hidden', ariaHidden);
      });
      if (page && !pageInert) page.removeAttribute('inert');
      triggerRef.current?.focus?.();
    };
  }, [layer, open]);

  // Échap ne ferme **qu'un** niveau : la coque écoute `Escape` sur `document`
  // (filet de sécurité) et ouvrirait la confirmation de fermeture derrière ce
  // dialogue. En capture, cet écouteur coupe la propagation avant la coque.
  useEffect(() => {
    if (!open || typeof document === 'undefined') return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      event.stopPropagation();
      onCancel();
    };
    document.addEventListener('keydown', onKeyDown, true);
    return () => document.removeEventListener('keydown', onKeyDown, true);
  }, [onCancel, open]);

  if (!open || typeof document === 'undefined') {
    return <span ref={anchorRef} hidden />;
  }

  const dialog = (
    <div
      className="lkdv-cv2c-confirm-layer"
      onPointerDown={(event) => {
        // Clic sur le scrim : annulation, jamais de propagation au tiroir.
        if (event.target === event.currentTarget) onCancel();
      }}
    >
      <div
        ref={dialogRef}
        className="lkdv-cv2-confirm lkdv-cv2c-confirm"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={text ? textId : undefined}
        data-testid={testId}
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            event.preventDefault();
            event.stopPropagation();
            onCancel();
            return;
          }
          if (event.key !== 'Tab') return;
          const nodes = [...event.currentTarget.querySelectorAll<HTMLElement>('button')].filter(
            (node) => !node.hasAttribute('disabled'),
          );
          if (nodes.length === 0) return;
          event.preventDefault();
          const index = nodes.indexOf(document.activeElement as HTMLElement);
          const next = event.shiftKey
            ? nodes[(index - 1 + nodes.length) % nodes.length]
            : nodes[(index + 1) % nodes.length];
          next?.focus();
        }}
      >
        <b id={titleId}>{title}</b>
        {text ? (
          <p id={textId} className="lkdv-cv2-field-hint">
            {text}
          </p>
        ) : null}
        <div className="lkdv-cv2-confirm-actions">
          <button
            type="button"
            className="lkdv-cv2-pill lkdv-cv2-pill--secondary"
            data-cv2-confirm-cancel
            onClick={onCancel}
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            className={`lkdv-cv2-pill ${danger ? 'lkdv-cv2-pill--danger' : 'lkdv-cv2-pill--primary'}`}
            data-cv2-confirm-ok
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <>
      <span ref={anchorRef} hidden />
      {layer ? createPortal(dialog, layer) : null}
    </>
  );
}

export default ConfirmDialogV2;
