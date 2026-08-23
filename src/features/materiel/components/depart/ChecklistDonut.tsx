'use client';
import { useState } from 'react';
import { ListChecks } from 'lucide-react';
import { GlassCard } from '@/components/ui/GlassCard';
import { GlassDrawer } from '@/components/ui/GlassDrawer';

export interface ChecklistSection {
  name: string;
  total: number;
  done: number;
}

/** Donut SVG ultra-léger sans dépendance (zéro Recharts) pour chargement instantané. */
function SvgDonut({ pct }: { pct: number }) {
  const size = 56;
  const strokeWidth = 5.5;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.min(100, Math.max(0, pct));
  const offset = circumference - (clamped / 100) * circumference;

  return (
    <div className="relative shrink-0 self-center w-10 h-10 md:w-14 md:h-14 flex items-center justify-center">
      <svg className="w-full h-full -rotate-90" viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="rgba(23, 64, 44, 0.12)"
          strokeWidth={strokeWidth}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="#5B7F55"
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className="transition-[stroke-dashoffset] duration-500 ease-out"
        />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center font-display font-bold text-[10px] md:text-[12px] text-[#17402C]">
        {Math.round(pct)}%
      </span>
    </div>
  );
}

/** W-D-4 ChecklistDonut — sans icône titre, typo vert foncé (#17402C). */
export function ChecklistDonut({
  pct,
  items = [],
  title = 'Checklist',
}: {
  pct: number;
  sections?: ChecklistSection[];
  items?: { name: string; done: boolean }[];
  title?: string;
}) {
  const [open, setOpen] = useState(false);

  const shown = items.slice(0, 4);
  const doneCount = items.filter((i) => i.done).length;

  return (
    <>
      <GlassCard as="article" tone="sage" ariaLabelledBy="checklist-donut-title" className="p-3 md:p-4">
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Ouvrir la checklist complète"
          className="!absolute top-1.5 right-8 md:top-2 md:right-11 z-10 glass interactive h-6 w-6 md:h-8 md:w-8 !rounded-full flex items-center justify-center text-[#365233]"
        >
          <ListChecks size={12} className="md:hidden" aria-hidden="true" />
          <ListChecks size={15} className="hidden md:block" aria-hidden="true" />
        </button>
        <div className="flex items-center gap-1.5 md:gap-2 pr-14 md:pr-20">
          <p className="truncate text-[10px] md:text-sm font-semibold text-[#17402C] font-body">Checklist</p>
        </div>
        <h3 id="checklist-donut-title" className="sr-only">Complétude de la checklist</h3>
        <div className="mt-1 md:mt-1.5 flex-1 min-h-0 flex flex-col md:flex-row md:items-center gap-1 md:gap-3">
          <div className="hidden md:block">
            <SvgDonut pct={pct} />
          </div>
          <ul className="flex-1 min-w-0 min-h-0 flex flex-col justify-start gap-1 overflow-y-auto no-scrollbar">
            {shown.map((it, idx) => (
              <li
                key={it.name}
                className={`glass-sub-card px-2 py-1 max-[359px]:py-0.5 md:py-1.5 flex items-center gap-1.5 ${idx >= 3 ? 'hidden md:flex' : idx >= 2 ? 'max-[359px]:hidden' : 'flex'} ${it.done ? 'opacity-80' : ''}`}
              >
                <span
                  className={`h-2.5 w-2.5 md:h-3 md:w-3 rounded-full flex items-center justify-center shrink-0 ${it.done ? 'bg-sage-500' : 'bg-stone-200'}`}
                  aria-hidden="true"
                />
                <span className={`truncate text-[10px] md:text-[11px] leading-tight ${it.done ? 'text-[#5A7064] line-through' : 'text-[#2D4A3A]'}`}>{it.name}</span>
              </li>
            ))}
            {items.length > 4 && (
              <li className="hidden md:block text-[10px] font-medium text-sage-600 px-1">+{items.length - 4} autres…</li>
            )}
            {items.length === 0 && <p className="text-xs text-[#486944]">Aucun article.</p>}
          </ul>
        </div>
        <p className="mt-1 md:mt-1.5 text-[8px] md:text-[10px] font-semibold uppercase tracking-wider text-[#365233] text-center md:text-left">
          {doneCount}/{items.length} prêt(s)
          {items.length > 3 && (
            <>
              <span className="max-[359px]:inline hidden"> · +{items.length - 2} autres</span>
              <span className="md:hidden max-[359px]:hidden inline"> · +{items.length - 3} autres</span>
            </>
          )}
        </p>
      </GlassCard>

      <GlassDrawer open={open} onOpenChange={setOpen} title={`Checklist — ${title}`}>
        <ul className="flex flex-col gap-2">
          {items.map((it) => (
            <li key={it.name} className="backdrop-blur-md bg-white/30 border border-white/40 rounded-[var(--r-md)] p-3 flex items-center gap-2 shadow-[inset_0_1px_1px_rgba(255,255,255,0.5)]">
              <span className={`h-4 w-4 rounded-full flex items-center justify-center shrink-0 ${it.done ? 'bg-sage-500' : 'bg-stone-200'}`} aria-hidden="true" />
              <span className={`text-sm ${it.done ? 'line-through text-[#5A7064]' : 'text-[#17402C]'}`}>{it.name}</span>
            </li>
          ))}
          {items.length === 0 && <p className="text-sm text-[#486944]">Aucun article dans ce kit.</p>}
        </ul>
      </GlassDrawer>
    </>
  );
}