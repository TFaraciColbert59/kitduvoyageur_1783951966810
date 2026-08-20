'use client';
/**
 * LKDV — MiniBars : répartition horizontale en mini-barres empilées.
 * Chaque entrée a un label, une valeur et une couleur optionnelle.
 */
import React from 'react';

export interface MiniBarDatum {
  label: string;
  value: number;
  color?: string; // Tailwind bg-* ou hex
}

interface MiniBarsProps {
  data: MiniBarDatum[];
  className?: string;
}

export function MiniBars({ data, className = '' }: MiniBarsProps) {
  const max = Math.max(...data.map((d) => d.value), 1);
  return (
    <div className={`flex flex-col gap-1 ${className}`}>
      {data.map((d) => (
        <div key={d.label} className="flex items-center gap-2">
          <span className="w-24 truncate text-[10px] text-[#1C2620]/60 shrink-0">{d.label}</span>
          <div className="flex-1 h-1.5 bg-[#1C2620]/8 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${Math.round((d.value / max) * 100)}%`,
                backgroundColor: d.color ?? '#2D5A3D',
              }}
            />
          </div>
          <span className="text-[10px] font-semibold text-[#1C2620]/70 w-5 text-right shrink-0">
            {d.value}
          </span>
        </div>
      ))}
    </div>
  );
}
