'use client';

import React, { useRef } from 'react';
import { createPortal } from 'react-dom';
import { LensPager } from '@/components/compte/drawer/LensPager';
import { Square, ImagePlus, Pencil, Send, Sparkles, BookOpen, Map, Backpack, Camera, Share2, Users, Shield, Route, Check, UserPlus } from 'lucide-react';
import type { CreateKind } from '../engine/createSchemas';
import './create-shared.css';

export interface CreateStep {
  id: string;
  label: string;
  icon: React.ReactNode;
}

/**
 * Étapes des six formulaires de création.
 *
 * Source unique : le drawer et les formulaires lisent la même liste, donc les
 * libellés et le nombre d’étapes ne peuvent plus diverger.
 */
export const CREATE_STEPS: Record<CreateKind, readonly CreateStep[]> = {
  post: [
    { id: 'format', label: 'Format', icon: <Square size={16} aria-hidden="true" /> },
    { id: 'media', label: 'Médias', icon: <ImagePlus size={16} aria-hidden="true" /> },
    { id: 'details', label: 'Détails', icon: <Pencil size={16} aria-hidden="true" /> },
    { id: 'publication', label: 'Publication', icon: <Send size={16} aria-hidden="true" /> },
  ],
  story: [
    { id: 'media', label: 'Média', icon: <ImagePlus size={16} aria-hidden="true" /> },
    { id: 'edit', label: 'Édition', icon: <Sparkles size={16} aria-hidden="true" /> },
    { id: 'diffusion', label: 'Diffusion', icon: <Send size={16} aria-hidden="true" /> },
  ],
  carnet: [
    { id: 'identity', label: 'Identité', icon: <BookOpen size={16} aria-hidden="true" /> },
    { id: 'itinerary', label: 'Itinéraire', icon: <Map size={16} aria-hidden="true" /> },
    { id: 'logistics', label: 'Logistique', icon: <Backpack size={16} aria-hidden="true" /> },
    { id: 'story', label: 'Récit', icon: <ImagePlus size={16} aria-hidden="true" /> },
    { id: 'sharing', label: 'Partage', icon: <Share2 size={16} aria-hidden="true" /> },
  ],
  sortie: [
    { id: 'type-place', label: 'Type & lieu', icon: <Map size={16} aria-hidden="true" /> },
    { id: 'route', label: 'Itinéraire', icon: <Route size={16} aria-hidden="true" /> },
    { id: 'participants', label: 'Participants', icon: <Users size={16} aria-hidden="true" /> },
    { id: 'safety', label: 'Sécurité', icon: <Shield size={16} aria-hidden="true" /> },
  ],
  kit: [
    { id: 'inventory', label: 'Inventaire', icon: <Backpack size={16} aria-hidden="true" /> },
    { id: 'complete', label: 'Compléter', icon: <Check size={16} aria-hidden="true" /> },
    { id: 'share', label: 'Partager', icon: <Send size={16} aria-hidden="true" /> },
  ],
  club: [
    { id: 'identity', label: 'Identité', icon: <BookOpen size={16} aria-hidden="true" /> },
    { id: 'universe', label: 'Univers', icon: <Sparkles size={16} aria-hidden="true" /> },
    { id: 'membership', label: 'Adhésion', icon: <UserPlus size={16} aria-hidden="true" /> },
    { id: 'publication', label: 'Publication', icon: <Send size={16} aria-hidden="true" /> },
  ],
};

export interface StepPagerProps {
  steps: readonly CreateStep[];
  index: number;
  onIndexChange: (index: number) => void;
  /** Une pane par étape, dans l’ordre de `steps`. */
  children: React.ReactNode;
  label?: string;
  /** Actions optionnelles à droite de la mini-capsule. */
  actions?: React.ReactNode;
  /** Regroupement de panes par étape (facultatif). */
  groups?: readonly (readonly number[])[];
  className?: string;
}

/**
 * Pager d’étapes commun, basé sur `LensPager` (swipe, clavier) et une mini
 * `CapsuleTabs` (navigation directe, roving tabindex).
 *
 * Toutes les panes restent montées pour conserver la saisie ; les panes
 * inactives sont `aria-hidden` et `inert`, donc hors du focus clavier.
 */
export function StepPager({
  steps,
  index,
  onIndexChange,
  children,
  label = 'Étapes de création',
  actions,
  groups,
  className = '',
}: StepPagerProps) {
  const count = steps.length;
  const safeIndex = count > 0 ? Math.max(0, Math.min(index, count - 1)) : 0;
  const rootRef = useRef<HTMLDivElement | null>(null);
  const touchStart = useRef<{ x: number; y: number } | null>(null);
  const panes = React.Children.toArray(children);
  const changeStep = (next: number) => {
    onIndexChange(next);
    window.requestAnimationFrame(() => {
      const scroller = rootRef.current?.closest<HTMLElement>('.lkdv-form-body, .lkdv-drawer-body');
      scroller?.scrollTo({ top: 0, behavior: 'smooth' });
    });
  };
  const tabs = steps.map((step) => ({ id: step.id, label: step.label }));

  if (count === 1) {
    return (
      <div ref={rootRef} className={`lkdv-create-step-pager lkdv-create-step-single ${className}`.trim()}>
        {panes.map((pane, paneIndex) => (
          <section key={steps[paneIndex]?.id ?? paneIndex} className="lkdv-create-step-pane" data-step-id={steps[paneIndex]?.id}>
            {pane}
          </section>
        ))}
      </div>
    );
  }

  return (
    <div
      ref={rootRef}
      className={`lkdv-create-step-pager ${className}`.trim()}
      onKeyDown={(event) => {
        if (event.key === 'ArrowRight' && safeIndex < count - 1) changeStep(safeIndex + 1);
        if (event.key === 'ArrowLeft' && safeIndex > 0) changeStep(safeIndex - 1);
      }}
      onTouchStart={(event) => {
        const target = event.target as HTMLElement;
        if (target.closest('input, textarea, select')) return;
        const touch = event.touches[0];
        if (touch) touchStart.current = { x: touch.clientX, y: touch.clientY };
      }}
      onTouchEnd={(event) => {
        const start = touchStart.current;
        touchStart.current = null;
        const touch = event.changedTouches[0];
        if (!start || !touch) return;
        const dx = touch.clientX - start.x;
        const dy = touch.clientY - start.y;
        if (Math.abs(dx) < 50 || Math.abs(dx) <= Math.abs(dy)) return;
        if (dx < 0 && safeIndex < count - 1) changeStep(safeIndex + 1);
        if (dx > 0 && safeIndex > 0) changeStep(safeIndex - 1);
      }}
    >
      <LensPager
        index={0}
        count={1}
        onIndexChange={onIndexChange}
        label={label}
      >
        {panes.length > 0 ? (
          <section
            key={steps[safeIndex]?.id ?? safeIndex}
            className="lkdv-create-step-pane"
            role="group"
            aria-roledescription="étape"
            aria-label={`${safeIndex + 1} sur ${count} — ${steps[safeIndex]?.label ?? ''}`}
            data-step-id={steps[safeIndex]?.id}
          >
            {(groups?.[safeIndex] ?? [safeIndex]).map((paneIndex) => (
              <div key={paneIndex}>{panes[paneIndex]}</div>
            ))}
          </section>
        ) : null}
      </LensPager>
      <div className="lkdv-create-inactive-panes" style={{ display: 'none' }} aria-hidden="true">
        {panes.map((pane, paneIndex) => paneIndex === safeIndex ? null : (
          <section key={steps[paneIndex]?.id ?? paneIndex} className="lkdv-create-step-pane" inert>
            {pane}
          </section>
        ))}
      </div>

      {typeof document !== 'undefined'
        ? createPortal(
          <div className="lkdv-create-stepbar">
            <div className="lkdv-create-step-tabs" role="tablist" aria-label={label}>
          <span
            className="lkdv-create-step-lens"
            aria-hidden="true"
            style={{
              width: `calc((100% - 5px) / ${Math.max(1, count)})`,
              transform: `translateX(${safeIndex * 100}%)`,
            }}
          />
          {steps.map((step, stepIndex) => (
            <button
              key={step.id}
              type="button"
              role="tab"
              aria-label={step.label}
              aria-selected={stepIndex === safeIndex}
              className={stepIndex === safeIndex ? 'is-active' : ''}
              onClick={() => changeStep(stepIndex)}
            >
              {step.icon}
            </button>
          ))}
        </div>
          </div>
          , document.body)
        : <div className="lkdv-create-stepbar">
        <div className="lkdv-create-step-tabs" role="tablist" aria-label={label}>
          <span
            className="lkdv-create-step-lens"
            aria-hidden="true"
            style={{
              width: `calc((100% - 5px) / ${Math.max(1, count)})`,
              transform: `translateX(${safeIndex * 100}%)`,
            }}
          />
          {steps.map((step, stepIndex) => (
            <button
              key={step.id}
              type="button"
              role="tab"
              aria-label={step.label}
              aria-selected={stepIndex === safeIndex}
              className={stepIndex === safeIndex ? 'is-active' : ''}
              onClick={() => changeStep(stepIndex)}
            >
              {step.icon}
            </button>
          ))}
        </div>
      </div>}

    </div>
  );
}

export default StepPager;
