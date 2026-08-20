import { GlassCard } from '@/components/ui/GlassCard';
import { Eyebrow } from '@/components/ui/Eyebrow';
import { Badge } from '@/components/ui/Badge';
import type { InventoryItem } from '@/features/materiel/services/getInventory';

function dueLabel(date: string | null): string {
  if (!date) return '';
  const days = Math.round((new Date(date).getTime() - Date.now()) / 86400000);
  if (days < 0) return 'en retard';
  if (days === 0) return 'aujourd’hui';
  return `dans ${days} j`;
}

/** W-L-6 ToCompleteList — objets à entretenir / expirer. */
export function ToCompleteList({ items }: { items: InventoryItem[] }) {
  const due = items.filter((i) => i.maintenance_due_at || i.expiry_date);
  return (
    <GlassCard as="article" ariaLabelledBy="tocomplete-title" className="p-4">
      <Eyebrow>À compléter</Eyebrow>
      <h3 id="tocomplete-title" className="sr-only">Objets à entretenir ou à surveiller</h3>
      <ul className="mt-2 flex flex-col gap-2">
        {due.map((i) => (
          <li key={i.id} className="glass p-2 flex items-center justify-between">
            <span className="text-sm text-[color:var(--label)]">{i.name}</span>
            <Badge tone="warn">{i.maintenance_due_at ? `Entretien ${dueLabel(i.maintenance_due_at)}` : `Expire ${dueLabel(i.expiry_date)}`}</Badge>
          </li>
        ))}
        {due.length === 0 && <li className="text-sm text-[color:var(--label-secondary)]">Aucun objet à entretenir.</li>}
      </ul>
    </GlassCard>
  );
}
