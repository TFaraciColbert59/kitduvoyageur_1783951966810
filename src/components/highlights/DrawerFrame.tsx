'use client';

import React, { useEffect, useId, useRef } from 'react';
import {
  backdropStyle,
  bodyStyle,
  headerStyle,
  helperStyle,
  iconButtonStyle,
  labelStyle,
  sheetStyle,
  titleStyle,
} from './styles';

export interface DrawerFrameProps {
  title: string;
  eyebrow?: string;
  subtitle?: string;
  onClose: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
  testId?: string;
}

/**
 * Coquille de drawer autonome du lot C03. Elle ne remplace pas le drawer
 * Explorer : elle se monte dans un sous-drawer existant et restaure le
 * contexte au retour (`onClose` laisse le parent intact).
 */
export function DrawerFrame({
  title,
  eyebrow,
  subtitle,
  onClose,
  children,
  footer,
  testId,
}: DrawerFrameProps) {
  const titleId = useId();
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        onClose();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      previous?.focus?.();
    };
  }, [onClose]);

  return (
    <div style={backdropStyle} data-testid={testId ? `${testId}-backdrop` : undefined}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        style={sheetStyle}
        data-testid={testId}
        onClick={(event) => event.stopPropagation()}
      >
        <div style={headerStyle}>
          <div style={{ minWidth: 0 }}>
            {eyebrow ? <p style={labelStyle}>{eyebrow}</p> : null}
            <h2 id={titleId} style={titleStyle}>
              {title}
            </h2>
            {subtitle ? <p style={{ ...helperStyle, marginTop: 4 }}>{subtitle}</p> : null}
          </div>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            style={iconButtonStyle}
            aria-label="Fermer"
          >
            ✕
          </button>
        </div>
        <div style={bodyStyle}>{children}</div>
        {footer ? <div style={{ paddingTop: 12 }}>{footer}</div> : null}
      </div>
    </div>
  );
}
