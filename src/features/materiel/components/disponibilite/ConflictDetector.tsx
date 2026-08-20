import { GlassCard } from '@/components/ui/GlassCard';
import { Eyebrow } from '@/components/ui/Eyebrow';

export interface Conflict { itemId: string; itemName: string; details: string }

/** W-A-5 ConflictDetector — conflits kit vs prêt (logique serveur). */
export function ConflictDetector({ conflicts }: { conflicts: Conflict[] }) {
  return (
    <GlassCard as="article" ariaLabelledBy="conflicts-title" className="p-4">
      <Eyebrow>Détecteur de conflits</Eyebrow>
      <h3 id="conflicts-title" className="sr-only">Conflits d'équipement</h3>
      {conflicts.length === 0 ? (
        <p className="mt-2 text-sm text-[color:var(--label-secondary)]">Aucun conflit détecté.</p>
      ) : (
        <ul className="mt-2 flex flex-col gap-2">
          {conflicts.map((c) => (
            <li key={c.itemId} className="bg-white/35 rounded-[var(--r-sm)] p-3 ring-1 ring-danger/25">
              <p className="text-sm font-medium text-danger">{c.itemName}</p>
              <p className="text-xs text-[color:var(--label-secondary)]">{c.details}</p>
            </li>
          ))}
        </ul>
      )}
    </GlassCard>
  );
}
