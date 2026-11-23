'use client';

import '@/features/compas/v5/v5.css';
import './trackStages.css';
import type { ReactNode } from 'react';
import { V5Scope } from '../ui/V5Scope';
import { Cap } from '@/features/compas/v5/ui/primitives';

/** Une section du tiroir : légende, contenu, dans la portée des jetons du Compas v5. */
export function Block({ title, right, children, testId }: { title?: ReactNode; right?: ReactNode; children: ReactNode; testId?: string }) {
  return (
    <V5Scope>
      <section className="rts-block" data-testid={testId}>
        {title != null ? <Cap right={right}>{title}</Cap> : null}
        {children}
      </section>
    </V5Scope>
  );
}

export function Note({ children, tone }: { children: ReactNode; tone?: 'warn' | 'bad' }) {
  return <p className={`rts-note${tone ? ` ${tone}` : ''}`}>{children}</p>;
}

export function Pill({ children, tone }: { children: ReactNode; tone?: 'warn' | 'good' | 'bad' }) {
  return <span className={`rts-pill${tone ? ` ${tone}` : ''}`}>{children}</span>;
}

export function Btn({
  children,
  onClick,
  tone,
  disabled,
  ariaLabel,
  testId,
  type = 'button',
}: {
  children: ReactNode;
  onClick?: () => void;
  tone?: 'primary' | 'warn';
  disabled?: boolean;
  ariaLabel?: string;
  testId?: string;
  type?: 'button' | 'submit';
}) {
  return (
    <button type={type} className={`rts-btn${tone ? ` ${tone}` : ''}`} onClick={onClick} disabled={disabled} aria-label={ariaLabel} data-testid={testId}>
      {children}
    </button>
  );
}
