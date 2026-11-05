'use client';
import { useEffect, useRef, type ReactNode } from 'react';

interface PagerProps {
  pages: readonly ReactNode[];
  /** Page courante (contrôlée). */
  page: number;
  onPageChange: (page: number) => void;
  label?: string;
}

/** Pages horizontales aimantées ; chaque page défile verticalement sans propager le geste. */
export function Pager({ pages, page, onPageChange, label = 'Pages' }: PagerProps) {
  const el = useRef<HTMLDivElement>(null);
  const current = useRef(page);

  useEffect(() => {
    current.current = page;
    const p = el.current;
    if (!p) return;
    const w = p.clientWidth;
    if (w > 0 && Math.round(p.scrollLeft / w) !== page) {
      const reduce = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
      p.scrollTo?.({ left: page * w, behavior: reduce ? 'auto' : 'smooth' });
    }
  }, [page]);

  const onScroll = () => {
    const p = el.current;
    if (!p || p.clientWidth === 0) return;
    const i = Math.round(p.scrollLeft / p.clientWidth);
    if (i !== current.current && i >= 0 && i < pages.length) {
      current.current = i;
      onPageChange(i);
    }
  };

  return (
    <div ref={el} className="ks-pager" role="group" aria-label={label} onScroll={onScroll}>
      {pages.map((p, i) => (
        <div key={i} className="ks-page" role="group" aria-label={`Page ${i + 1} sur ${pages.length}`}>
          {p}
        </div>
      ))}
    </div>
  );
}
