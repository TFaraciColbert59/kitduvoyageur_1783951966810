import Image from 'next/image';
import type { InventoryItem } from '@/features/materiel/services/getInventory';
import { Badge } from '@/components/ui/Badge';

/** W-I-3 InventoryCard — carte d'objet (96px). */
export function InventoryCard({ item }: { item: InventoryItem }) {
  return (
    <article className="glass interactive p-2 flex flex-col gap-1 h-full">
      <div className="relative h-[44px] w-full rounded-[var(--r-sm)] overflow-hidden bg-stone-100">
        {item.photo_url ? (
          <Image src={item.photo_url} alt={item.name} fill sizes="200px" className="object-cover" />
        ) : (
          <div className="h-full w-full flex items-center justify-center text-[color:var(--label-tertiary)] text-[10px]">—</div>
        )}
      </div>
      <p className="text-[12px] font-medium text-[color:var(--label)] line-clamp-2 leading-tight">{item.name}</p>
      <div className="flex items-center justify-between">
        <span className="text-[10px] text-[color:var(--label-tertiary)]">
          {item.weight_g ? `${(item.weight_g / 1000).toFixed(2)} kg` : item.category}
        </span>
        {item.is_lent && <Badge tone="warn">Prêt</Badge>}
      </div>
    </article>
  );
}
