'use client';

import React from 'react';

/** Filtre d'année de la Timeline — 44 px, état actif annoncé. */
export function YearFilter({
  years,
  active,
  onChange,
}: {
  years: number[];
  active: number | 'all';
  onChange: (year: number | 'all') => void;
}) {
  if (years.length === 0) return null;

  return (
    <div
      role="group"
      aria-label="Filtrer par année"
      className="flex gap-2 overflow-x-auto pb-1"
      data-hscroll="true"
    >
      <button
        type="button"
        aria-pressed={active === 'all'}
        onClick={() => onChange('all')}
        className={`h-8 shrink-0 rounded-full border px-3 text-[11px] font-semibold transition-colors motion-reduce:transition-none ${
          active === 'all'
            ? 'border-[color:var(--lkv-primary)] bg-[color:var(--lkv-primary)] text-white'
            : 'border-[color:var(--glass-border)] bg-[color:var(--card-tint-strong)] text-[color:var(--label2)]'
        }`}
      >
        Toutes
      </button>
      {years.map((year) => (
        <button
          key={year}
          type="button"
          aria-pressed={active === year}
          onClick={() => onChange(year)}
          className={`h-8 shrink-0 rounded-full border px-3 font-mono text-[11px] font-semibold transition-colors motion-reduce:transition-none ${
            active === year
              ? 'border-[color:var(--lkv-primary)] bg-[color:var(--lkv-primary)] text-white'
              : 'border-[color:var(--glass-border)] bg-[color:var(--card-tint-strong)] text-[color:var(--label2)]'
          }`}
        >
          {year}
        </button>
      ))}
    </div>
  );
}

export default YearFilter;
