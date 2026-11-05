'use client';
import { useLayoutEffect, useRef, type KeyboardEvent, type ReactNode } from 'react';

export interface CapsuleItem {
  id: string;
  /** Nom accessible du bouton (obligatoire : l'icône est seule). */
  label: string;
  icon: ReactNode;
}

interface CapsuleProps {
  /** tablist (catégories, pages) ou radiogroup (modes). */
  kind: 'tablist' | 'radiogroup';
  label: string;
  items: readonly CapsuleItem[];
  value: string | null;
  onChange: (id: string) => void;
  /** Largeur d'un bouton (44 px par défaut, 38 px au-delà de 4 boutons). */
  buttonWidth?: number;
}

/** Capsule de verre à lentille animée : icônes de 18 px seules, flèches clavier, tabulation itinérante. */
export function Capsule({ kind, label, items, value, onChange, buttonWidth }: CapsuleProps) {
  const root = useRef<HTMLDivElement>(null);
  const lens = useRef<HTMLSpanElement>(null);
  const bw = buttonWidth ?? (items.length > 4 ? 38 : 44);
  const index = items.findIndex((i) => i.id === value);
  const radio = kind === 'radiogroup';

  useLayoutEffect(() => {
    const r = root.current;
    const l = lens.current;
    if (!r || !l) return;
    const b = r.querySelectorAll('button')[index];
    r.dataset.none = String(!b);
    if (!b) return;
    const pl = parseFloat(getComputedStyle(r).paddingLeft) || 2.5;
    l.style.width = `${b.offsetWidth}px`;
    l.style.setProperty('--x', `${b.offsetLeft - pl}px`);
  }, [index, items.length, bw]);

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const n = items.length;
    if (!n) return;
    const cur = Math.max(0, index);
    let next = cur;
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') next = (cur + 1) % n;
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') next = (cur - 1 + n) % n;
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = n - 1;
    else return;
    e.preventDefault();
    onChange(items[next].id);
    root.current?.querySelectorAll('button')[next]?.focus();
  };

  return (
    <div
      ref={root}
      className="ks-caps"
      role={kind}
      aria-label={label}
      hidden={items.length < 2}
      style={{ '--bw': `${bw}px` } as React.CSSProperties}
      onKeyDown={onKeyDown}
    >
      <span ref={lens} className="ks-lens" aria-hidden="true" />
      {items.map((it, i) => {
        const on = i === index;
        return (
          <button
            key={it.id}
            type="button"
            role={radio ? 'radio' : 'tab'}
            {...(radio ? { 'aria-checked': on } : { 'aria-selected': on })}
            aria-label={it.label}
            tabIndex={on || (index < 0 && i === 0) ? 0 : -1}
            onClick={() => onChange(it.id)}
          >
            {it.icon}
          </button>
        );
      })}
    </div>
  );
}
