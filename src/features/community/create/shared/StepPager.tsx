'use client';

import React from 'react';
import { LensPager } from '@/components/compte/drawer/LensPager';
import type { CreateKind } from '../engine/createSchemas';
import './create-shared.css';

export interface CreateStep {
  id: string;
  label: string;
}

/**
 * Étapes des six formulaires de création.
 *
 * Source unique : le drawer et les formulaires lisent la même liste, donc les
 * libellés et le nombre d’étapes ne peuvent plus diverger.
 */
export const CREATE_STEPS: Record<CreateKind, readonly CreateStep[]> = {
  post: [
    { id: 'format', label: 'Format' },
    { id: 'content', label: 'Contenu' },
    { id: 'audience', label: 'Audience' },
  ],
  story: [
    { id: 'media', label: 'Média' },
    { id: 'caption', label: 'Légende' },
  ],
  carnet: [
    { id: 'info', label: 'Infos' },
    { id: 'dates', label: 'Dates' },
    { id: 'visibility', label: 'Visibilité' },
  ],
  sortie: [
    { id: 'info', label: 'Infos' },
    { id: 'details', label: 'Détails' },
    { id: 'participants', label: 'Participants' },
  ],
  kit: [
    { id: 'identity', label: 'Identité' },
    { id: 'weight', label: 'Poids' },
  ],
  club: [
    { id: 'identity', label: 'Identité' },
    { id: 'presentation', label: 'Présentation' },
    { id: 'membership', label: 'Adhésion' },
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
  className = '',
}: StepPagerProps) {
  const count = steps.length;
  const safeIndex = count > 0 ? Math.max(0, Math.min(index, count - 1)) : 0;
  const panes = React.Children.toArray(children);
  const tabs = steps.map((step) => ({ id: step.id, label: step.label }));

  return (
    <div className={`lkdv-create-step-pager ${className}`.trim()}>
      <LensPager
        index={safeIndex}
        count={count}
        onIndexChange={onIndexChange}
        label={label}
      >
        {panes.map((pane, paneIndex) => {
          const step = steps[paneIndex];
          const active = paneIndex === safeIndex;
          return (
            <section
              key={step?.id ?? paneIndex}
              className="lkdv-create-step-pane"
              role="group"
              aria-roledescription="étape"
              aria-label={`${paneIndex + 1} sur ${count} — ${step?.label ?? ''}`}
              aria-hidden={active ? undefined : true}
              inert={active ? undefined : true}
              data-step-id={step?.id}
            >
              {pane}
            </section>
          );
        })}
      </LensPager>

      <div className="lkdv-create-stepbar">
        <div className="lkdv-create-step-tabs" role="tablist" aria-label={label}>
          {steps.map((step, stepIndex) => (
            <button
              key={step.id}
              type="button"
              role="tab"
              aria-label={step.label}
              aria-selected={stepIndex === safeIndex}
              className={stepIndex === safeIndex ? 'is-active' : ''}
              onClick={() => onIndexChange(stepIndex)}
            >
              {stepIndex + 1}
            </button>
          ))}
        </div>
        {actions ? <div className="lkdv-create-stepbar-actions">{actions}</div> : null}
      </div>
    </div>
  );
}

export default StepPager;
