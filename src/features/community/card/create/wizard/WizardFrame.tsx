'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import Icon from '@/components/ui/Icon';
import { useWizardEdge } from './edge';
import './wizard-polish.css';

export interface WizardFrameProps {
  step: number;
  total: number;
  /** Nom court de l'étape (« Média », « Texte »…), affiché en capitales. */
  kicker: string;
  error?: string | null;
  busy?: boolean;
  nextLabel: string;
  nextDisabled?: boolean;
  onBack?: () => void;
  /** Étape suivante, ou envoi sur la dernière étape. */
  onNext: () => void;
  /** Désactive le glissement (ex. étape plein écran qui gère ses propres gestes). */
  swipeDisabled?: boolean;
  /** Saisie reprise d'un brouillon : bandeau discret avec « Effacer ». */
  draft?: { restored: boolean; onDiscard: () => void };
  children: React.ReactNode;
}

/** Distance minimale (px) et rapport horizontal/vertical pour compter comme un glissement. */
const SWIPE_DISTANCE = 56;
const SWIPE_RATIO = 1.4;
/** Zones qui gardent leur propre geste horizontal : curseurs, cartes, éléments marqués. */
const SWIPE_BLOCKERS = 'input[type="range"], [data-no-swipe], .leaflet-container';

/**
 * Cadre commun d'une étape : en-tête (nom + n/total), corps qui remplit la
 * carte sans défiler, pied avec points de progression, retour et action.
 * Un `<form>` : la touche Entrée valide l'étape (hors zones de texte).
 */
export function WizardFrame({
  step,
  total,
  kicker,
  error,
  busy = false,
  nextLabel,
  nextDisabled = false,
  onBack,
  onNext,
  swipeDisabled = false,
  draft,
  children,
}: WizardFrameProps) {
  const isLast = step === total - 1;
  const edge = useWizardEdge();
  const [bounce, setBounce] = useState<'left' | 'right' | null>(null);
  const swipeRef = useRef<HTMLDivElement>(null);
  const stepRef = useRef(step);
  stepRef.current = step;
  const drag = useRef<{ id: number; x: number; y: number; live: boolean } | null>(null);
  const bounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const swallowClick = useRef(false);

  useEffect(
    () => () => {
      if (bounceTimer.current) clearTimeout(bounceTimer.current);
    },
    []
  );

  /** Petit rebond : la carte refuse d'avancer (étape incomplète) ou de reculer (première étape). */
  const playBounce = useCallback((direction: 'left' | 'right') => {
    setBounce(null);
    requestAnimationFrame(() => setBounce(direction));
    if (bounceTimer.current) clearTimeout(bounceTimer.current);
    bounceTimer.current = setTimeout(() => setBounce(null), 420);
  }, []);

  const settle = useCallback(() => {
    const el = swipeRef.current;
    if (!el) return;
    el.style.transition = 'transform 0.22s cubic-bezier(0.22, 0.8, 0.25, 1)';
    el.style.transform = '';
  }, []);

  const trySwipe = useCallback(
    (direction: 'next' | 'back') => {
      if (busy) return;
      if (direction === 'back') {
        if (step > 0 && onBack) onBack();
        else if (!edge?.('prev')) playBounce('right');
        return;
      }
      // Jamais d'envoi par un glissement : la dernière étape se valide au bouton.
      if (isLast) {
        if (!edge?.('next')) playBounce('left');
        return;
      }
      if (nextDisabled) {
        playBounce('left');
        return;
      }
      const from = stepRef.current;
      onNext();
      // `onNext` valide puis avance : si l'étape n'a pas changé, elle est incomplète → rebond.
      setTimeout(() => {
        if (stepRef.current === from) playBounce('left');
      }, 90);
    },
    [busy, edge, isLast, nextDisabled, onBack, onNext, playBounce, step]
  );

  const onPointerDown = (event: React.PointerEvent<HTMLFormElement>) => {
    if (swipeDisabled || busy || event.pointerType === 'mouse' || event.button !== 0) return;
    if ((event.target as Element).closest(SWIPE_BLOCKERS)) return;
    drag.current = { id: event.pointerId, x: event.clientX, y: event.clientY, live: false };
  };

  const onPointerMove = (event: React.PointerEvent<HTMLFormElement>) => {
    const current = drag.current;
    if (!current || current.id !== event.pointerId) return;
    const dx = event.clientX - current.x;
    const dy = event.clientY - current.y;
    if (!current.live) {
      if (Math.abs(dx) < 10 || Math.abs(dx) < Math.abs(dy) * SWIPE_RATIO) return;
      current.live = true;
    }
    const el = swipeRef.current;
    if (el) {
      el.style.transition = 'none';
      el.style.transform = `translate3d(${Math.round(dx * 0.35)}px, 0, 0)`;
    }
  };

  const endDrag = (event: React.PointerEvent<HTMLFormElement>, cancelled: boolean) => {
    const current = drag.current;
    if (!current || current.id !== event.pointerId) return;
    drag.current = null;
    if (!current.live) return;
    // Le relâchement d'un glissement ne doit pas compter comme un appui (ouvrir un sélecteur de fichier…).
    swallowClick.current = true;
    setTimeout(() => {
      swallowClick.current = false;
    }, 60);
    const dx = event.clientX - current.x;
    const dy = event.clientY - current.y;
    settle();
    if (cancelled || Math.abs(dx) < SWIPE_DISTANCE || Math.abs(dx) < Math.abs(dy) * SWIPE_RATIO)
      return;
    trySwipe(dx < 0 ? 'next' : 'back');
  };

  return (
    <form
      className="lkdv-wz"
      style={{ '--wz-p': (step + 1) / Math.max(1, total) } as React.CSSProperties}
      noValidate
      onClickCapture={(event) => {
        if (!swallowClick.current) return;
        event.preventDefault();
        event.stopPropagation();
      }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={(event) => endDrag(event, false)}
      onPointerCancel={(event) => endDrag(event, true)}
      onSubmit={(event) => {
        event.preventDefault();
        if (!busy && !nextDisabled) onNext();
      }}
    >
      <div className="lkdv-wz-head">
        <span className="lkdv-wz-kicker">{kicker}</span>
        <span className="lkdv-wz-count" aria-label={`Étape ${step + 1} sur ${total}`}>
          {step + 1}/{total}
        </span>
      </div>

      <div className="lkdv-wz-body" key={step}>
        <div className="lkdv-wz-swipe" ref={swipeRef} data-bounce={bounce ?? undefined}>
          {draft?.restored && step === 0 ? (
            <p className="lkdv-wz-draft" role="status">
              <span>Brouillon repris</span>
              <button type="button" onClick={draft.onDiscard}>
                Effacer
              </button>
            </p>
          ) : null}
          {error ? (
            <p className="lkdv-wz-error" role="alert">
              {error}
            </p>
          ) : null}
          {children}
        </div>
      </div>

      <div className="lkdv-wz-foot">
        <div className="lkdv-wz-dots" aria-hidden="true">
          {/* Au-delà de 8 étapes (carnet de plusieurs jours), le compteur n/total suffit. */}
          {total <= 8
            ? Array.from({ length: total }, (_, index) => (
                <span key={index} data-on={index === step ? 'true' : 'false'} />
              ))
            : null}
        </div>
        {step > 0 && onBack ? (
          <button
            type="button"
            className="lkdv-wz-back"
            aria-label="Étape précédente"
            onClick={onBack}
            disabled={busy}
          >
            <Icon name="chevron-left" size={18} aria-hidden="true" />
          </button>
        ) : null}
        <button type="submit" className="lkdv-wz-next" disabled={busy || nextDisabled}>
          <span>{busy ? 'Envoi…' : nextLabel}</span>
          {busy || isLast ? null : <Icon name="arrow-right" size={16} aria-hidden="true" />}
        </button>
      </div>
    </form>
  );
}

export default WizardFrame;
