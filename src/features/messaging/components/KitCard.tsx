'use client';

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
    <button
      type="button"
      onClick={() => {
        haptic('light');
        openKit(meta.kit_id, 'messaging');
      }}
      className={`block w-full max-w-[280px] text-left rounded-2xl px-4 py-3 transition-transform active:scale-[0.98] ${
        isMine ? 'bg-white/15 border border-white/25' : 'bg-white/70 border border-[#17402C]/15'
      }`}
    >
      <div className={`font-mono text-[9px] tracking-[0.16em] uppercase ${isMine ? 'text-[#C8DAC3]' : 'text-[#17402C]'}`}>
        Kit · lignée
      </div>
      <div className={`text-[15px] font-semibold mt-1 truncate ${isMine ? 'text-white' : 'text-[#14140F]'}`}>
        {meta.kit_name || 'Kit sans nom'}
      </div>
      <div className={`text-[11px] mt-0.5 ${isMine ? 'text-white/70' : 'text-[#5A574E]'}`}>
        Voir la lignée →
      </div>
    </button>
  );
}