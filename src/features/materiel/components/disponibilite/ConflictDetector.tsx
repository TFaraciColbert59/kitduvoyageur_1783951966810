import { Card, EmptyState } from '@/components/ui';
import { Eyebrow } from '@/components/ui/Eyebrow';

export interface Conflict { itemId: string; itemName: string; details: string }

/** W-A-5 ConflictDetector — conflits kit vs prêt (logique serveur). */
export function ConflictDetector({ conflicts }: { conflicts: Conflict[] }) {
  return (
    <Card as="article" ariaLabelledBy="conflicts-title" className="p-4">
      <Eyebrow>Détecteur de conflits</Eyebrow>
      <h3 id="conflicts-title" className="sr-only">Conflits d'équipement</h3>
      {conflicts.length === 0 ? (
        <EmptyState compact title="Aucun conflit détecté." />
      ) : (
        <ul className="mt-2 flex flex-col gap-2">
          {conflicts.map((c) => (
            <li key={c.itemId}>
              <Card variant="compact" tone="danger" className="p-3">
                <p className="text-sm font-medium text-[var(--lkv-danger)]">{c.itemName}</p>
                <p className="text-xs text-[color:var(--lkv-text-secondary)]">{c.details}</p>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
