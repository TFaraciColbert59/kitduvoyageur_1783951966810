'use client';
import { GlassCard } from '@/components/ui/GlassCard';
import { Eyebrow } from '@/components/ui/Eyebrow';
import { Badge } from '@/components/ui/Badge';
import { historyLabel, historyTone } from '@/lib/materiel/history';
import type { KitHistoryEntry } from '@/features/materiel/services/getKitHistory';

/** W-K-8 KitHistoryTimeline — historique des versions d'un kit en Liquid Glass. */
export function KitHistoryTimeline({ history }: { history: KitHistoryEntry[] }) {
  return (
    <GlassCard as="article" tone="sage" ariaLabelledBy="history-title" className="p-4 sm:p-5">
      <Eyebrow>Historique des versions</Eyebrow>
      <h3 id="history-title" className="font-display font-bold text-[20px] text-[#17402C] mt-0.5 mb-3">Évolution du kit</h3>
      <ol className="relative border-l border-white/30 pl-4 flex flex-col gap-2.5">
        {history.map((h) => (
          <li key={h.id} className="relative">
            <span className="absolute -left-[21px] top-1.5 h-2 w-2 rounded-full bg-[#17402C] shadow-xs" aria-hidden="true" />
            <div className="glass-sub-card p-2.5 rounded-xl flex items-center justify-between">
              <span className="text-xs font-semibold text-[#17402C]">{historyLabel(h.action)}</span>
              <Badge tone={historyTone(h.action)}>{new Date(h.created_at).toLocaleDateString('fr-FR')}</Badge>
            </div>
          </li>
        ))}
        {history.length === 0 && <li className="text-xs text-[#5A7064]">Aucun historique pour ce kit.</li>}
      </ol>
    </GlassCard>
  );
}
