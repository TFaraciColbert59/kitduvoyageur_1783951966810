'use client';

import { useCallback, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import Icon from '@/components/ui/Icon';
import { paginate } from '../engine/format';

/* ---------- Liste paginée : la hauteur disponible décide, jamais de défilement ---------- */

const ROW_H = 48;
const PAGER_H = 30;

export function PagedList<T>({
  items,
  render,
  empty,
  resetKey,
  label,
  focusIndex,
}: {
  items: readonly T[];
  render: (item: T) => ReactNode;
  empty?: ReactNode;
  /** Change → retour à la première page. */
  resetKey?: string;
  label: string;
  /** Élément à montrer à l'ouverture (index, -1 ou absent : première page). */
  focusIndex?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState(0);
  const [page, setPage] = useState(0);
  // Hauteur RÉELLE d'une ligne : certaines tiennent sur trois lignes (membre,
  // allure, niveau) et 48 px les faisait déborder sur le bloc suivant.
  const [rowH, setRowH] = useState(ROW_H);
  const focused = useRef(false);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => setHeight(el.clientHeight);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useLayoutEffect(() => setPage(0), [resetKey]);

  const perPage = useMemo(() => {
    if (height <= 0) return Math.max(1, items.length);
    if (items.length * rowH <= height) return Math.max(1, items.length);
    return Math.max(1, Math.floor((height - PAGER_H) / rowH));
  }, [height, items.length, rowH]);
  const pages = useMemo(() => paginate(items, perPage), [items, perPage]);

  useLayoutEffect(() => {
    const rows = ref.current?.querySelectorAll<HTMLElement>('.cp-list__page > *');
    if (!rows?.length) return;
    const tallest = Math.max(...Array.from(rows, (r) => r.offsetHeight));
    if (tallest > rowH) setRowH(tallest);
  });

  // La page de l'élément demandé, une seule fois, quand la hauteur est connue :
  // ensuite la pagination appartient à la personne.
  useLayoutEffect(() => {
    if (focused.current || height <= 0 || focusIndex == null || focusIndex < 0) return;
    focused.current = true;
    setPage(Math.floor(focusIndex / perPage));
  }, [focusIndex, height, perPage]);
  const current = Math.min(page, pages.length - 1);

  return (
    <div
      className="cp-list"
      ref={ref}
      aria-label={label}
      // Jamais moins d'une ligne (et sa pagination) : en dessous, la ligne
      // débordait sur le bloc suivant ; c'est le tiroir qui défile alors.
      style={
        items.length ? { minHeight: rowH + (items.length > 1 ? PAGER_H : 0) } : undefined
      }
    >
      {items.length === 0 ? (
        (empty ?? null)
      ) : (
        <>
          <div className="cp-list__page">{pages[current].map(render)}</div>
          {pages.length > 1 && (
            <div className="cp-pager">
              <button
                type="button"
                aria-label="Page précédente"
                disabled={current === 0}
                onClick={() => setPage(current - 1)}
              >
                <Icon name="chevron-left" size={16} />
              </button>
              <span aria-live="polite">
                {current + 1} / {pages.length}
              </span>
              <button
                type="button"
                aria-label="Page suivante"
                disabled={current >= pages.length - 1}
                onClick={() => setPage(current + 1)}
              >
                <Icon name="chevron-right" size={16} />
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

/* ---------- Appui long : ouvre la fiche complète ---------- */

export function useLongPress(onLongPress: () => void, onPress: () => void, ms = 450) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fired = useRef(false);
  const start = useRef<{ x: number; y: number } | null>(null);

  const clear = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  };

  return {
    onPointerDown: (e: React.PointerEvent) => {
      fired.current = false;
      start.current = { x: e.clientX, y: e.clientY };
      clear();
      timer.current = setTimeout(() => {
        fired.current = true;
        onLongPress();
      }, ms);
    },
    onPointerMove: (e: React.PointerEvent) => {
      if (!start.current) return;
      if (Math.abs(e.clientX - start.current.x) > 8 || Math.abs(e.clientY - start.current.y) > 8)
        clear();
    },
    onPointerUp: clear,
    onPointerCancel: clear,
    onPointerLeave: clear,
    onContextMenu: (e: React.MouseEvent) => e.preventDefault(),
    onClick: () => {
      if (fired.current) {
        fired.current = false;
        return;
      }
      onPress();
    },
  };
}

/* ---------- Visuels ---------- */

const CATEGORY_ICONS: Array<[RegExp, string]> = [
  [/s[ée]cu|safety|secours|pharma/i, 'shield'],
  [/abri|shelter|tente|tarp/i, 'tent'],
  [/couchage|sleep|duvet|matelas/i, 'moon'],
  [/v[êe]t|cloth|veste|chaus/i, 'shirt'],
  [/cuisine|cook|r[ée]chaud|popote/i, 'flame'],
  [/eau|water|filtre|gourde/i, 'droplet'],
  [/tech|[ée]lectr|lampe|frontale|batter/i, 'zap'],
  [/nav|gps|carte|boussole/i, 'compass'],
  [/sac|backpack|portage/i, 'backpack'],
];

export function categoryIcon(category: string | null, name = ''): string {
  const hay = `${category ?? ''} ${name}`;
  for (const [re, icon] of CATEGORY_ICONS) if (re.test(hay)) return icon;
  return 'package';
}

export function Thumb({
  image,
  alt,
  category,
  name,
  large = false,
}: {
  image?: string | null;
  alt?: string | null;
  category: string | null;
  name: string;
  large?: boolean;
}) {
  return (
    <span
      className={`cp-thumb${large ? ' cp-thumb--lg' : ''}`}
      aria-hidden={image ? undefined : true}
    >
      {image ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={image} alt={alt ?? name} loading="lazy" />
      ) : (
        <Icon name={categoryIcon(category, name)} size={large ? 34 : 20} />
      )}
    </span>
  );
}

export type Tone = 'good' | 'warn' | 'bad' | 'soft' | undefined;

export function Chip({
  tone,
  icon,
  children,
}: {
  tone?: Tone;
  icon?: string;
  children: ReactNode;
}) {
  return (
    <span className="cp-chip" data-tone={tone}>
      {icon && <Icon name={icon} size={13} />}
      {children}
    </span>
  );
}

export function Segments<K extends string>({
  value,
  options,
  onChange,
  label,
}: {
  value: K;
  options: ReadonlyArray<{ id: K; label: string; icon?: string }>;
  onChange: (id: K) => void;
  label: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  // Le groupe défile horizontalement (5 à 6 onglets) : l'onglet actif reste
  // visible, y compris quand un tiroir s'ouvre directement sur le dernier.
  // Seul le défilement horizontal du groupe bouge, jamais la page.
  useLayoutEffect(() => {
    const box = ref.current;
    const on = box?.querySelector<HTMLElement>('[aria-pressed="true"]');
    if (!box || !on) return;
    const left = on.offsetLeft - box.offsetLeft;
    const right = left + on.offsetWidth;
    if (left < box.scrollLeft) box.scrollLeft = left;
    else if (right > box.scrollLeft + box.clientWidth) box.scrollLeft = right - box.clientWidth;
  }, [value]);
  return (
    <div ref={ref} className="cp-seg" role="group" aria-label={label}>
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          aria-pressed={value === o.id}
          onClick={() => onChange(o.id)}
        >
          {o.icon && <Icon name={o.icon} size={15} />}
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** Recherche plein texte tolérante (accents, casse). */
export function useTextFilter(initial = '') {
  const [query, setQuery] = useState(initial);
  const norm = useCallback(
    (v: string) =>
      v
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase(),
    []
  );
  const matches = useCallback(
    (...fields: Array<string | null | undefined>) => {
      const q = norm(query.trim());
      if (!q) return true;
      return q.split(/\s+/).every((word) => fields.some((f) => f && norm(f).includes(word)));
    },
    [norm, query]
  );
  return { query, setQuery, matches, norm };
}
