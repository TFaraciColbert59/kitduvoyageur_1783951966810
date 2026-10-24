'use client';

import { useEffect, useState } from 'react';
import { resolveSheetMode } from '@/features/compte/map/modes';
import type { CompteMapMode, CompteMapSheet } from '@/features/compte/map/types';

const EMPTY: CompteMapSheet = {
  kind: null,
  step: 0,
  slot: null,
  detent: 'closed',
  outingId: null,
};

export function useCompteMapContext(): { mode: CompteMapMode; outingId: string | null } {
  const [sheet, setSheet] = useState<CompteMapSheet>(() =>
    typeof window !== 'undefined' && window.__lkdvCompteMapState
      ? window.__lkdvCompteMapState
      : EMPTY
  );

  useEffect(() => {
    const previous = window.__lkdvCompteMapContext;
    window.__lkdvCompteMapContext = (next) => {
      setSheet(next);
      previous?.(next);
    };
    return () => {
      window.__lkdvCompteMapContext = previous;
    };
  }, []);

  return { mode: resolveSheetMode(sheet), outingId: sheet.outingId };
}
