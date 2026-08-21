import { GlassCard } from '@/components/ui/GlassCard';
import { Eyebrow } from '@/components/ui/Eyebrow';
import { Badge } from '@/components/ui/Badge';
import { historyLabel, historyTone } from '@/lib/materiel/history';
import type { KitHistoryEntry } from '@/features/materiel/services/getKitHistory';

/** W-K-8 KitHistoryTimeline — historique des versions d'un kit. */
export function KitHistoryTimeline({ history }: { history: KitHistoryEntry[] }) {
  return (
    <GlassCard as="article" ariaLabelledBy="history-title" className="p-4">
      <Eyebrow>Historique versions</Eyebrow>
      <h3 id="history-title" className="sr-only">Historique des versions du kit</h3>
      <ol className="mt-3 relative border-l border-glass-border pl-4 flex flex-col gap-3">
        {history.map((h) => (
          <li key={h.id} className="relative">
            <span className="absolute -left-[21px] top-1 h-2.5 w-2.5 rounded-full bg-sage-500" aria-hidden="true" />
            <div className="flex items-center justify-between">
              <span className="text-sm text-[color:var(--label)]">{historyLabel(h.action)}</span>
              <Badge tone={historyTone(h.action)}>{new Date(h.created_at).toLocaleDateString('fr-FR')}</Badge>
            </div>
          </li>
        ))}
        {history.length === 0 && <li className="text-sm text-[color:var(--label-secondary)]">Aucun historique pour ce kit.</li>}
      </ol>
    </GlassCard>
  );
}
