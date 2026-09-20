'use client';

import { Card } from '@/components/ui';
import { useHapticFeedback } from '@/hooks/useHapticFeedback';
import { useKitSheet } from '@/features/kits/KitSheetContext';
import type { KitMessageMeta } from '../types/messaging.types';

/**
 * Carte inline d'un message de type 'kit' — la lignée circule dans les DM.
 * Clic → ouvre le KitSheet (le kit n'habite pas une adresse).
 */
export function KitCard({ meta, isMine }: { meta: KitMessageMeta; isMine: boolean }) {
  const { haptic } = useHapticFeedback();
  const { openKit } = useKitSheet();

  return (
    <Card
      variant="interactive"
      onClick={() => {
        haptic('light');
        openKit(meta.kit_id, 'messaging');
      }}
      className={`block w-full max-w-[280px] space-y-[var(--space-1)] p-[var(--space-4)] text-left ${
        isMine
          ? 'border-[color:var(--glass-border)] bg-[color:var(--card-tint-strong)]'
          : 'border-[color:var(--lkv-border)]'
      }`}
    >
      <div className={`font-mono text-[length:var(--lkv-text-caption-2)] uppercase tracking-[0.16em] ${isMine ? 'text-[color:var(--lkv-forest-100)]' : 'text-[color:var(--lkv-text-primary)]'}`}>
        Kit · lignée
      </div>
      <div className={`mt-[var(--space-1)] truncate text-[length:var(--lkv-text-subheadline)] font-semibold ${isMine ? 'text-[color:var(--lkv-text-inverted)]' : 'text-[color:var(--lkv-text-primary)]'}`}>
        {meta.kit_name || 'Kit sans nom'}
      </div>
      <div className={`mt-0.5 text-[length:var(--lkv-text-caption)] ${isMine ? 'text-[color:var(--lkv-text-inverted)]/70' : 'text-[color:var(--lkv-text-secondary)]'}`}>
        Voir la lignée →
      </div>
    </Card>
  );
}
