'use client';
import { useEffect, useRef, useState } from 'react';
import type { KeyboardEvent, PointerEvent } from 'react';
import { ZONE_NAMES } from '../../domain/catalog';
import { SLOT_LABEL, decide, deckCurrent, deckSummary, lighten, slotOf } from '../../domain/deck';
import type { Deck } from '../../domain/deck';
import { formatWeight } from '../../domain/format';
import { resolveMaterial } from '../../domain/palette';
import { getItem, zoneOf } from '../../domain/state';
import { effG } from '../../domain/totals';
import type { KitState } from '../../domain/types';
import { Icon } from '../icons';
import './deck.css';

const TXT = {
  fill: { no: 'Plus tard', yes: 'Dedans' },
  debrief: { no: 'Pas utilisé', yes: 'Utilisé' },
  worn: 'à enfiler',
  asked: 'tu t’en es servi ?',
  of: 'sur',
  lighten: 'Alléger le kit',
  end: 'Terminer',
  deck: 'Revue des objets',
  arrows: (fill: boolean) =>
    `Flèche droite : ${fill ? 'dans le sac' : 'utilisé'}, flèche gauche : ${fill ? 'plus tard' : 'pas utilisé'}.`,
} as const;

const THRESHOLD = 90;
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const animates = (): boolean =>
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  !window.matchMedia('(prefers-reduced-motion: reduce)').matches;

interface DeckSheetProps {
  state: KitState;
  deck: Deck;
  onDeck: (next: Deck) => void;
  onState: (next: KitState) => void;
  onQuit: () => void;
}

interface Drag { sx: number; sy: number; t: number; dx: number; dy: number }

export function DeckSheet({ state, deck, onDeck, onState, onQuit }: DeckSheetProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const leaveTimer = useRef<number | null>(null);
  const drag = useRef<Drag | null>(null);
  const [dragging, setDragging] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const fill = deck.kind === 'fill';
  const words = fill ? TXT.fill : TXT.debrief;
  const id = deckCurrent(deck);
  const pct = (deck.i / Math.max(1, deck.list.length)) * 100;

  useEffect(
    () => () => {
      if (leaveTimer.current !== null) window.clearTimeout(leaveTimer.current);
    },
    [],
  );

  const reset = () => {
    const el = cardRef.current;
    if (!el) return;
    el.style.transform = '';
    el.style.opacity = '';
    el.querySelectorAll<HTMLElement>('.ks-dk-flag').forEach((f) => {
      f.style.opacity = '';
    });
  };

  const choose = (yes: boolean) => {
    if (id === undefined || leaving) return;
    const el = cardRef.current;
    if (el && animates()) {
      setLeaving(true);
      el.style.transform = `translateX(${yes ? 120 : -120}%) rotate(${yes ? 9 : -9}deg)`;
      el.style.opacity = '0';
      leaveTimer.current = window.setTimeout(() => {
        leaveTimer.current = null;
        reset();
        setLeaving(false);
        onDeck(decide(deck, yes));
      }, 240);
      return;
    }
    onDeck(decide(deck, yes));
  };

  const onKey = (e: KeyboardEvent<HTMLElement>) => {
    if (e.key === 'ArrowRight' && id !== undefined) {
      e.preventDefault();
      choose(true);
    } else if (e.key === 'ArrowLeft' && id !== undefined) {
      e.preventDefault();
      choose(false);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onQuit();
    }
  };

  const down = (e: PointerEvent<HTMLDivElement>) => {
    if (id === undefined || leaving || (e.target as HTMLElement).closest('button')) return;
    drag.current = { sx: e.clientX, sy: e.clientY, t: performance.now(), dx: 0, dy: 0 };
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      /* capture indisponible */
    }
    setDragging(true);
  };
  const move = (e: PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    const el = cardRef.current;
    if (!d || !el) return;
    const dx = e.clientX - d.sx;
    const dy = e.clientY - d.sy;
    d.dx = dx;
    d.dy = dy;
    el.style.transform = `translate(${dx}px,${Math.max(0, dy) * 0.6}px) rotate(${dx / 26}deg)`;
    const yes = el.querySelector<HTMLElement>('.ks-dk-flag[data-side="yes"]');
    const no = el.querySelector<HTMLElement>('.ks-dk-flag[data-side="no"]');
    if (yes) yes.style.opacity = String(clamp(dx / THRESHOLD, 0, 1));
    if (no) no.style.opacity = String(clamp(-dx / THRESHOLD, 0, 1));
  };
  const up = () => {
    const d = drag.current;
    if (!d) return;
    drag.current = null;
    setDragging(false);
    const v = Math.abs(d.dx) / Math.max(1, performance.now() - d.t);
    if (d.dy > 110 && Math.abs(d.dx) < 60) {
      reset();
      onQuit();
      return;
    }
    if (Math.abs(d.dx) > THRESHOLD || (v > 0.7 && Math.abs(d.dx) > 30)) {
      choose(d.dx > 0);
      return;
    }
    reset();
  };

  const bar = (
    <div className="ks-dk-prog" aria-hidden="true">
      <i style={{ width: `${pct}%` }} />
    </div>
  );

  if (id === undefined) {
    const sum = deckSummary(state, deck);
    const label = `${sum.title}. ${sum.text}`;
    return (
      <section className="ks-dk" aria-label={TXT.deck} onKeyDown={onKey}>
        {bar}
        <div className="ks-dk-card" role="group" aria-label={label} aria-live="polite" tabIndex={0}>
          <div className="ks-dk-sum">
            <span className="ks-dk-t">{sum.title}</span>
            <span className="ks-dk-s">{sum.text}</span>
            <div className="ks-dk-acts">
              {sum.cut.length > 0 && (
                <button
                  type="button"
                  className="ks-dk-quiet"
                  onClick={() => {
                    onState(lighten(state, deck).state);
                    onQuit();
                  }}
                >
                  {`${TXT.lighten} ${sum.savedLabel}`}
                </button>
              )}
              <button type="button" className="ks-dk-quiet" onClick={onQuit}>
                {TXT.end}
              </button>
            </div>
          </div>
        </div>
      </section>
    );
  }

  const it = getItem(state, id);
  const z = zoneOf(state, id);
  const where = !z
    ? ''
    : z === 'main'
      ? `${ZONE_NAMES.main}, ${SLOT_LABEL[slotOf(state, id)] ?? ''}`
      : z === 'worn'
        ? TXT.worn
        : ZONE_NAMES[z];
  const count = `${deck.i + 1} ${TXT.of} ${deck.list.length}`;
  const sub = `${count} · ${fill ? `${where} · ${it ? formatWeight(effG(state, it)) : ''}` : TXT.asked}`;
  const label = `${it?.n ?? ''}, ${count}. ${fill ? where : ''} ${TXT.arrows(fill)}`;

  return (
    <section className="ks-dk" aria-label={TXT.deck} onKeyDown={onKey}>
      {bar}
      <div
        ref={cardRef}
        className="ks-dk-card"
        role="group"
        tabIndex={0}
        aria-label={label}
        aria-live="polite"
        data-drag={dragging}
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
        onPointerCancel={up}
      >
        <span className="ks-dk-flag" data-side="no" aria-hidden="true">
          {words.no}
        </span>
        <span className="ks-dk-flag" data-side="yes" aria-hidden="true">
          {words.yes}
        </span>
        <span className="ks-dk-ig" style={{ background: it ? resolveMaterial(it.color) : undefined }} aria-hidden="true">
          <Icon name="cube" />
        </span>
        <div>
          <span className="ks-dk-t">{it?.n}</span>
          <span className="ks-dk-s">{sub}</span>
        </div>
      </div>
      <div className="ks-dk-btns">
        <button type="button" className="ks-dk-btn" data-side="no" aria-label={`${words.no} : ${it?.n ?? ''}`} onClick={() => choose(false)}>
          {words.no}
        </button>
        <button type="button" className="ks-dk-btn" data-side="yes" aria-label={`${words.yes} : ${it?.n ?? ''}`} onClick={() => choose(true)}>
          {words.yes}
        </button>
      </div>
    </section>
  );
}
