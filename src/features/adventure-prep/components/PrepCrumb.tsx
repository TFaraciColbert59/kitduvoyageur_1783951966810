'use client';

import React from 'react';
import Icon from '@/components/ui/Icon';
import { PREP_STEPS, PREP_STEP_LABELS, type PrepStepId } from '../types';
import { canOpenStep } from '../engine/steps';
import type { AdventurePrepDraft } from '../types';

export interface PrepCrumbProps {
  step: PrepStepId;
  draft: AdventurePrepDraft;
  onOpenStep: (step: PrepStepId) => void;
}

export function PrepCrumb({ step, draft, onOpenStep }: PrepCrumbProps) {
  return (
    <div
      style={{
        flex: 1,
        minWidth: 0,
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        gap: 2,
      }}
      aria-live="polite"
      aria-label="Étapes de la préparation"
    >
      {PREP_STEPS.map((id, index) => {
        const isCurrent = id === step;
        const reachable = canOpenStep(draft, id);
        const isDone = reachable && !isCurrent;

        const color = isCurrent
          ? 'var(--lkv-text-primary)'
          : isDone
            ? 'var(--lkv-action)'
            : 'var(--lkv-text-subtle)';
        const fontWeight = isCurrent ? 720 : 400;

        return (
          <React.Fragment key={id}>
            {index > 0 && (
              <span
                style={{
                  color: 'var(--line-ui, color-mix(in srgb, var(--lkv-text-primary) 20%, transparent))',
                  fontSize: 13,
                }}
                aria-hidden="true"
              >
                {' · '}
              </span>
            )}
            {isDone ? (
              <button
                type="button"
                onClick={() => onOpenStep(id)}
                style={{
                  height: 44,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 5,
                  padding: '0 6px',
                  fontSize: 14,
                  whiteSpace: 'nowrap',
                  borderRadius: 10,
                  fontFamily:
                    "-apple-system, BlinkMacSystemFont, 'SF Pro Display', sans-serif",
                  color,
                  fontWeight,
                  cursor: 'pointer',
                  background: 'transparent',
                  border: 'none',
                }}
              >
                {PREP_STEP_LABELS[id]}
              </button>
            ) : (
              <span
                style={{
                  height: 44,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 5,
                  padding: '0 6px',
                  fontSize: 14,
                  whiteSpace: 'nowrap',
                  borderRadius: 10,
                  fontFamily:
                    "-apple-system, BlinkMacSystemFont, 'SF Pro Display', sans-serif",
                  color,
                  fontWeight,
                }}
                data-current={isCurrent}
                data-locked={!reachable && !isCurrent}
                {...(isCurrent ? { 'aria-current': 'step' as const } : {})}
              >
                {PREP_STEP_LABELS[id]}
              </span>
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}

export interface PrepNavProps {
  step: PrepStepId;
  draft: AdventurePrepDraft;
  onOpenStep: (step: PrepStepId) => void;
  onClose: () => void;
}

export function PrepNav({ step, draft, onOpenStep, onClose }: PrepNavProps) {
  const position = PREP_STEPS.indexOf(step);
  const previous = position > 0 ? PREP_STEPS[position - 1] : undefined;
  const canGoBack = previous !== undefined && canOpenStep(draft, previous);

  return (
    <nav
      style={{
        flex: 'none',
        height: 52,
        minHeight: 52,
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '0 12px',
        position: 'relative',
        zIndex: 20,
      }}
      aria-label="Progression de la préparation"
    >
      <button
        type="button"
        className="prep-nav__icon"
        style={{
          flex: 'none',
          width: 44,
          height: 44,
          borderRadius: '50%',
          display: 'grid',
          placeItems: 'center',
          background: 'var(--prep-glass-bg)',
          WebkitBackdropFilter: 'var(--prep-glass-blur)',
          backdropFilter: 'var(--prep-glass-blur)',
          boxShadow: 'var(--prep-glass-shadow)',
          border: '0.5px solid var(--prep-glass-border)',
          color: 'var(--lkv-text-primary)',
          cursor: 'pointer',
        }}
        disabled={!canGoBack}
        onClick={() => {
          if (canGoBack && previous) {
            onOpenStep(previous);
          }
        }}
        aria-label="Revenir en arrière"
      >
        <Icon name="chevron-left" size={20} aria-hidden="true" />
      </button>

      <PrepCrumb step={step} draft={draft} onOpenStep={onOpenStep} />

      <button
        type="button"
        style={{
          flex: 'none',
          width: 44,
          height: 44,
          borderRadius: '50%',
          display: 'grid',
          placeItems: 'center',
          background: 'var(--prep-glass-bg)',
          WebkitBackdropFilter: 'var(--prep-glass-blur)',
          backdropFilter: 'var(--prep-glass-blur)',
          boxShadow: 'var(--prep-glass-shadow)',
          border: '0.5px solid var(--prep-glass-border)',
          color: 'var(--lkv-text-primary)',
          cursor: 'pointer',
        }}
        onClick={onClose}
        aria-label="Fermer et revenir au hub"
      >
        <Icon name="x" size={20} aria-hidden="true" />
      </button>
    </nav>
  );
}

export default PrepCrumb;