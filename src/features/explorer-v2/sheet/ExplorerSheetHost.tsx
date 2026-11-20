'use client';

import React, { useMemo } from 'react';
import { ExplorerSheet } from './ExplorerSheet';
import { buildSheetModel } from './SheetContent';
import type { SheetContext } from './context';
import type { Detent } from '../state/types';

export interface ExplorerSheetHostProps {
  ctx: SheetContext;
  tab: number;
  detent: Detent;
  onTab: (index: number) => void;
  onDetent: (detent: Detent) => void;
  onClose: () => void;
  onHaptic: (event: 'sheet-open' | 'tab') => void;
}

/**
 * Enveloppe client légère chargée en `next/dynamic` uniquement à l'ouverture
 * du tiroir Explorer : sort `ExplorerSheet` + `SheetContent` du bundle initial
 * de `/explorer` tout en gardant le tiroir préchargé au temps mort.
 */
export default function ExplorerSheetHost({
  ctx,
  tab,
  detent,
  onTab,
  onDetent,
  onClose,
  onHaptic,
}: ExplorerSheetHostProps) {
  const model = useMemo(() => buildSheetModel(ctx), [ctx]);

  return (
    <ExplorerSheet
      title={model.title}
      subtitle={model.subtitle}
      tabs={model.tabs}
      tab={tab}
      onTab={onTab}
      detent={detent}
      onDetent={onDetent}
      onClose={onClose}
      onHaptic={onHaptic}
      actions={model.actions}
      onBack={model.onBack}
      mini={model.mini}
      bottomInset={0}
      labelledBy="xp-sheet-title"
      tabsBottom={model.tabsBottom ?? false}
    />
  );
}
