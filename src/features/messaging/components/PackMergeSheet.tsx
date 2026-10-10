'use client';

import React, { useState, useMemo } from 'react';
import Icon from '@/components/ui/Icon';
import { useHapticFeedback } from '@/hooks/useHapticFeedback';
import type { PackMergeResult } from '../domain/packMerge';
import type { KitSnapshot } from '../types/outdoorObjects.types';
import { computeKitPreviewMergeResult } from '../domain/packMerge';

export interface DeduplicatedEquipmentItem {
  id: string;
  name: string;
  category: string;
  weightGrams: number;
  assignedToName: string;
  savedDuplicatesCount?: number;
}

export interface PackMergeSheetProps {
  isOpen?: boolean;
  open?: boolean;
  onClose?: () => void;
  result?: PackMergeResult;
  kitSnapshot?: KitSnapshot;
  tripTitle?: string;
  totalSavedGrams?: number;
  onApplyMerge?: () => void;
}

export const PackMergeSheet: React.FC<PackMergeSheetProps> = ({
  isOpen = true,
  open,
  onClose,
  result,
  kitSnapshot,
  tripTitle = "Optimisation du sac d'équipe",
  totalSavedGrams,
  onApplyMerge,
}) => {
  const { haptic } = useHapticFeedback();
  const [selectedTab, setSelectedTab] = useState<'loads' | 'items'>('loads');

  const isVisible = open !== undefined ? open : isOpen;

  const effectiveResult = useMemo(() => {
    if (result) return result;
    if (kitSnapshot) return computeKitPreviewMergeResult(kitSnapshot);
    return undefined;
  }, [result, kitSnapshot]);

  if (!isVisible) return null;

  const savedGrams =
    totalSavedGrams ??
    effectiveResult?.metrics?.weightSavedDeduplicationGrams ??
    effectiveResult?.groupStats?.weightSavedGrams ??
    0;

  const warnings = effectiveResult?.warnings || [];
  const individualLoads = effectiveResult?.individualLoads
    ? Object.values(effectiveResult.individualLoads)
    : [];
  const deduplicatedItems = effectiveResult?.deduplicatedItems || [];

  const handleApply = () => {
    haptic('success');
    onApplyMerge?.();
    onClose?.();
  };

  return (
    <>
      {/* Backdrop overlay scrim */}
      <div
        className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm transition-opacity"
        onClick={() => {
          haptic('light');
          onClose?.();
        }}
        aria-hidden="true"
      />

      {/* Bottom Sheet Dialog */}
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="pack-merge-title"
        // eslint-disable-next-line no-restricted-syntax -- lkdv-safe-area-ok: bottom sheet container requires home indicator inset
        className="fixed inset-x-0 bottom-0 z-50 mx-auto max-w-lg rounded-t-[var(--lkv-radius-lg)] border-t border-[color:var(--glass-border)] bg-[color:var(--glass-bg-sheet)] p-[var(--space-4)] pb-[calc(var(--space-4)+env(safe-area-inset-bottom,0px))] shadow-elevation-4 backdrop-blur-[var(--glass-blur-lg)]"
      >
        {/* Header with Title and 44px Close Button */}
        <div className="flex items-center justify-between gap-3">
          <div>
            <h3
              id="pack-merge-title"
              className="text-[length:var(--lkv-text-headline)] font-bold text-[color:var(--lkv-text-primary)]"
            >
              Pack Merge — Répartition du matériel
            </h3>
            <p className="text-xs text-[color:var(--lkv-text-secondary)]">
              {tripTitle}
            </p>
          </div>

          <button
            type="button"
            onClick={() => {
              haptic('light');
              onClose?.();
            }}
            className="flex h-[44px] w-[44px] min-h-[44px] min-w-[44px] items-center justify-center rounded-full text-[color:var(--lkv-text-secondary)] transition-colors hover:bg-black/5 dark:hover:bg-white/5"
            aria-label="Fermer la vue Pack Merge"
          >
            ✕
          </button>
        </div>

        {/* Collective Weight Saved Banner */}
        {savedGrams > 0 && (
          <div className="mt-3 flex items-center gap-2.5 rounded-xl border border-[color:var(--glass-border)] bg-[color:var(--lkv-secondary)]/15 p-2.5 text-xs text-[color:var(--lkv-forest-600)] dark:text-[color:var(--lkv-text-primary)]">
            <Icon name="sparkles" size={16} className="shrink-0 text-[color:var(--lkv-action)]" aria-hidden="true" />
            <span className="font-semibold">
              ✓ {savedGrams} g économisés par dédoublonnage de groupe
            </span>
          </div>
        )}

        {/* Overload & Safety Warnings */}
        {warnings.length > 0 && (
          <div className="mt-3 space-y-1.5">
            {warnings.map((w, idx) => (
              <div
                key={idx}
                className="flex items-center gap-2 rounded-xl bg-amber-500/10 p-2.5 text-xs font-semibold text-[color:var(--lkv-warning,#b45309)] dark:text-amber-200"
              >
                <span aria-hidden="true">⚠</span>
                <span>{w}</span>
              </div>
            ))}
          </div>
        )}

        {/* Segmented View Switcher — Apple HIG 48px container / 44px touch targets */}
        <div className="mt-3.5 flex h-12 min-h-[48px] items-center rounded-xl bg-black/[0.05] p-1 dark:bg-white/[0.05]">
          <button
            type="button"
            onClick={() => {
              haptic('light');
              setSelectedTab('loads');
            }}
            className={`flex h-full min-h-[44px] flex-1 items-center justify-center rounded-lg text-xs font-semibold transition-all ${
              selectedTab === 'loads'
                ? 'bg-white text-[color:var(--lkv-text-primary)] shadow-sm dark:bg-neutral-800'
                : 'text-[color:var(--lkv-text-secondary)]'
            }`}
          >
            Charges & Sécurité ({individualLoads.length})
          </button>
          <button
            type="button"
            onClick={() => {
              haptic('light');
              setSelectedTab('items');
            }}
            className={`flex h-full min-h-[44px] flex-1 items-center justify-center rounded-lg text-xs font-semibold transition-all ${
              selectedTab === 'items'
                ? 'bg-white text-[color:var(--lkv-text-primary)] shadow-sm dark:bg-neutral-800'
                : 'text-[color:var(--lkv-text-secondary)]'
            }`}
          >
            Matériel ({deduplicatedItems.length})
          </button>
        </div>

        {/* Tab 1: Individual Loads and Safety Bars */}
        {selectedTab === 'loads' && (
          <div className="mt-3 max-h-60 space-y-3 overflow-y-auto pr-1">
            {individualLoads.map((load) => {
              const roleOrBreed = load.roleOrBreed || (load.isDog ? 'Chien' : 'Équipier');
              return (
                <div
                  key={load.participantId}
                  className="rounded-xl border border-[color:var(--glass-border)] bg-[color:var(--glass-bg-medium)] p-3"
                >
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-[color:var(--lkv-text-primary)]">
                      {load.name} ({roleOrBreed})
                    </span>
                    <span className="font-mono text-[11px] tabular-nums">
                      {load.allocatedWeightKg} kg / {load.maxSafeWeightKg} kg ({load.loadPercentage}%)
                    </span>
                  </div>

                  {/* Load Bar */}
                  <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-black/[0.06] dark:bg-white/[0.08]">
                    <div
                      className={`h-full transition-all ${
                        load.isOverloaded
                          ? 'bg-red-500'
                          : load.loadPercentage > 85
                            ? 'bg-amber-500'
                            : 'bg-[color:var(--lkv-primary)]'
                      }`}
                      style={{ width: `${Math.min(100, load.loadPercentage)}%` }}
                    />
                  </div>

                  {load.isOverloaded && (
                    <div className="mt-1.5 flex items-center gap-1 text-[11px] font-semibold text-red-600 dark:text-red-400">
                      <Icon name="ExclamationTriangleIcon" size={12} aria-hidden="true" />
                      <span>Surcharge critique ! Allégez d&apos;au moins {(load.overloadGrams / 1000).toFixed(1)} kg.</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Tab 2: Shared & Deduplicated Items */}
        {selectedTab === 'items' && (
          <div className="mt-3 max-h-60 divide-y divide-black/[0.06] overflow-y-auto rounded-xl border border-[color:var(--glass-border)] bg-[color:var(--glass-bg-medium)] dark:divide-white/[0.08]">
            {deduplicatedItems.map((item) => (
              <div
                key={item.itemId || item.id}
                className="flex min-h-[44px] items-center justify-between p-2.5 text-xs"
              >
                <div className="min-w-0 pr-2">
                  <span className="font-semibold text-[color:var(--lkv-text-primary)]">
                    {item.name}
                  </span>
                  <span className="block text-[10px] opacity-70">
                    Porté par {item.assignedParticipantName || 'Groupe'}
                  </span>
                </div>
                <span className="font-mono font-bold text-[color:var(--lkv-action)]">
                  {item.weightGrams >= 1000
                    ? `${(item.weightGrams / 1000).toFixed(2)} kg`
                    : `${item.weightGrams} g`}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Action Footer */}
        <div className="mt-4">
          <button
            type="button"
            onClick={handleApply}
            className="flex h-12 min-h-[48px] w-full items-center justify-center gap-2 rounded-xl bg-[color:var(--lkv-action)] font-semibold text-white shadow-elevation-2 transition-transform active:scale-[0.98]"
          >
            <Icon name="check" size={18} aria-hidden="true" />
            <span>Appliquer la répartition au groupe</span>
          </button>
        </div>
      </div>
    </>
  );
};
