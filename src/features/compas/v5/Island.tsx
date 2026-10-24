'use client';

import { useEffect, useRef } from 'react';
import type { CompasT } from '../components/compasTypes';
import type { PrepState } from '../components/CompasPrep';

/**
 * Îlot dynamique (comme celui de la page Compte) : la préparation en direct, puis les annonces et « Annuler ».
 * Une erreur est une alerte, le reste est annoncé poliment. Toucher l'îlot le referme ; ses boutons gardent
 * leur rôle. Il remplace le bandeau noir de l'ancien écran.
 */
export interface IslandToast {
  message: string;
  tone?: 'bad';
  sub?: string;
  undo?: () => void;
}

export function Island({
  toast,
  prep,
  running,
  t,
  onDismiss,
  onHold,
  onRelease,
  onStop,
  onResume,
  onRefine,
  onSeeDone,
  onCloseDone,
}: {
  toast: IslandToast | null;
  prep: PrepState | null;
  running: boolean;
  t: CompasT;
  onDismiss: () => void;
  /** Suspend le délai tant qu'on lit ou qu'on vise (WCAG 2.2.1). */
  onHold: () => void;
  onRelease: () => void;
  onStop: () => void;
  onResume: () => void;
  onRefine: () => void;
  onSeeDone: () => void;
  onCloseDone: () => void;
}) {
  const live = prep && (prep.stage === 'understand' || prep.stage === 'itinerary' || prep.stage === 'rest');
  const percent = prep?.stage === 'understand' ? 15 : prep?.stage === 'itinerary' ? 45 : prep?.stage === 'rest' ? 78 : 0;
  const ref = useRef<HTMLDivElement>(null);

  // La fin de préparation se referme seule : l'annonce reste le temps de la lire.
  useEffect(() => {
    if (prep?.stage !== 'done') return;
    const id = window.setTimeout(onCloseDone, 12000);
    return () => window.clearTimeout(id);
  }, [prep?.stage, onCloseDone]);

  let state: 'idle' | 'live' | 'note' = 'idle';
  let title = '';
  let sub: string | null = null;
  let tone: 'bad' | undefined;
  const actions: Array<{ label: string; onClick: () => void; title?: string }> = [];

  if (live) {
    state = 'live';
  } else if (prep && (prep.stage === 'done' || prep.stage === 'stopped' || prep.stage === 'error')) {
    state = 'note';
    if (prep.stage === 'done') {
      title = t('compas.v5.island.done');
      sub = [prep.total, prep.digest].filter(Boolean).join(' · ') || t('compas.v5.island.doneSub');
      actions.push({ label: t('compas.v5.island.see'), onClick: onSeeDone });
    } else if (prep.stage === 'stopped') {
      title = t('compas.v5.island.stopped');
      sub = prep.message ?? t('compas.v5.island.stoppedSub');
      actions.push({ label: t('compas.v5.island.resume'), onClick: onResume });
    } else {
      title = t('compas.v5.island.error');
      sub = prep.message ?? null;
      tone = 'bad';
      actions.push({ label: t('compas.v5.island.resume'), onClick: onResume }, { label: t('compas.v5.island.refine'), onClick: onRefine });
    }
  } else if (toast) {
    state = 'note';
    title = toast.message;
    sub = toast.sub ?? null;
    tone = toast.tone;
    if (toast.undo) actions.push({ label: t('compas.v5.core.undo'), onClick: toast.undo, title: 'Ctrl/⌘ + Z' });
  }

  return (
    <div
      ref={ref}
      className="v5-island"
      data-s={state}
      data-tone={tone}
      role={tone === 'bad' ? 'alert' : 'status'}
      aria-live={tone === 'bad' ? undefined : 'polite'}
      onPointerEnter={onHold}
      onPointerLeave={onRelease}
      onFocus={onHold}
      onBlur={onRelease}
      onClick={(e) => {
        if ((e.target as Element).closest('button')) return;
        if (state === 'note') onDismiss();
      }}
    >
      <div className="is live">
        <span className="spin" aria-hidden="true" />
        <span className="t">{prep ? t(`compas.v5.island.${prep.stage === 'understand' ? 'understand' : prep.stage === 'itinerary' ? 'itinerary' : 'rest'}`) : ''}</span>
        <b className="v5-num">{t('compas.v5.island.prepProgress', { percent })}</b>
        <button type="button" className="v5-island__stop" onClick={onStop} aria-label={t('compas.v5.island.stop')}>
          ■
        </button>
      </div>
      <div className="is note">
        <span className="t">
          <b>{title}</b>
          {sub && <span>{sub}</span>}
        </span>
        {actions.map((a) => (
          <button key={a.label} type="button" disabled={running && a.label === t('compas.v5.core.undo')} title={a.title} onClick={a.onClick}>
            {a.label}
          </button>
        ))}
      </div>
    </div>
  );
}
