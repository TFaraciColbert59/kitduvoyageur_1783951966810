'use client';
import { Badge, Card, EmptyState } from '@/components/ui';
import { Eyebrow } from '@/components/ui/Eyebrow';
import { historyLabel, historyTone } from '@/lib/materiel/history';
import type { KitHistoryEntry } from '@/features/materiel/services/getKitHistory';

/** W-K-8 KitHistoryTimeline — historique des versions d'un kit en Liquid Glass. */
export function KitHistoryTimeline({ history }: { history: KitHistoryEntry[] }) {
  return (
    <Card as="article" tone="sage" ariaLabelledBy="history-title" className="p-4 sm:p-5">
      <Eyebrow>Historique des versions</Eyebrow>
      <h3 id="history-title" className="font-display font-bold text-[20px] text-[var(--lkv-primary)] mt-0.5 mb-3">Évolution du kit</h3>
      <ol className="relative border-l border-white/30 pl-4 flex flex-col gap-2.5">
        {history.map((h) => (
          <li key={h.id} className="relative">
            <span className="absolute -left-[var(--space-5)] top-1.5 h-2 w-2 rounded-full bg-[var(--lkv-primary)]" aria-hidden="true" />
            <Card variant="compact" className="flex items-center justify-between p-2.5">
              <span className="text-xs font-semibold text-[var(--lkv-primary)]">{historyLabel(h.action)}</span>
              <Badge tone={historyTone(h.action)}>{new Date(h.created_at).toLocaleDateString('fr-FR')}</Badge>
            </Card>
          </li>
        ))}
        {history.length === 0 && (
          <li>
            <EmptyState compact title="Aucun historique pour ce kit." />
          </li>
        )}
      </ol>
    </Card>
  );
}
