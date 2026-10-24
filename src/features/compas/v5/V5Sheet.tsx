'use client';

import { useEffect, useRef } from 'react';
import { trapTab, useFocusReturn } from '../components/focusTrap';
import { DRAWERS } from './drawers';
import { useV5 } from './context';
import { Flow } from './ui/primitives';
import { V5Icon } from './ui/icons';

/**
 * Le tiroir : posé dans les bornes de la card (translucide, matière `.v5-sheet`), piloté par une capsule d'icônes
 * (jamais de texte), un titre et une ligne de contexte. Échap le ferme, Tab reste à l'intérieur, le focus revient
 * à ce qui l'a ouvert (WCAG 2.1.2 / 2.4.3). Le corps vient du registre `DRAWERS`.
 */
export function V5Sheet() {
  const api = useV5();
  const { space, tab, setTab, closeSpace, t } = api;
  const def = space ? DRAWERS[space] : undefined;
  const ref = useRef<HTMLDivElement>(null);
  const open = Boolean(def);
  const drag = useRef<{ y: number } | null>(null);

  useFocusReturn();
  useEffect(() => {
    if (!open) return;
    ref.current?.focus({ preventScroll: true });
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeSpace();
      else if (e.key === 'Tab') trapTab(e, ref.current);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, closeSpace]);

  if (!def) return <div className="v5-sheet" aria-hidden="true" />;
  const tabs = def.tabs(api);
  const subtitle = def.subtitle(api);
  const Body = def.Body;

  return (
    <div ref={ref} className="v5-sheet" data-open="" role="dialog" aria-modal="false" aria-label={def.title(api)} tabIndex={-1}>
      <button
        type="button"
        className="v5-sgrab"
        aria-label={t('compas.v5.core.close')}
        onClick={closeSpace}
        onPointerDown={(e) => {
          drag.current = { y: e.clientY };
          (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
        }}
        onPointerMove={(e) => {
          if (drag.current && e.clientY - drag.current.y > 48) {
            drag.current = null;
            closeSpace();
          }
        }}
        onPointerUp={() => {
          drag.current = null;
        }}
      >
        <i />
      </button>
      <div className="v5-shead">
        {tabs.length > 0 && <Flow tabs={tabs} selected={Math.min(tab, tabs.length - 1)} onSelect={setTab} label={def.title(api)} />}
        <div className="v5-sttl">
          <h2>{def.title(api)}</h2>
          {subtitle && <span>{subtitle}</span>}
          <button type="button" className="v5-sx" aria-label={t('compas.v5.core.close')} onClick={closeSpace}>
            <V5Icon name="x" size="s" />
          </button>
        </div>
      </div>
      <div className="v5-sbody">
        <Body />
      </div>
    </div>
  );
}
