import Image from 'next/image';
import type { InventoryItem } from '@/features/materiel/services/getInventory';
import { Badge, Card } from '@/components/ui';

/** W-I-3 InventoryCard — carte d'objet (96px). */
export function InventoryCard({ item, onSelect }: { item: InventoryItem; onSelect?: (item: InventoryItem) => void }) {
  return (
    <Card
      variant="interactive"
      onClick={() => onSelect?.(item)}
      className="flex h-full flex-col gap-1 p-2 text-left"
    >
      <div className="relative h-[44px] w-full overflow-hidden rounded-[var(--lkv-radius-sm)] bg-[color:var(--glass-bg-medium)]">
        {item.photo_url ? (
          <Image src={item.photo_url} alt={item.name} fill sizes="200px" className="object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-[10px] text-[color:var(--lkv-text-muted)]">—</div>
        )}
      </div>
      <p className="line-clamp-2 text-[12px] font-medium leading-tight text-[color:var(--lkv-text-primary)]">{item.name}</p>
      <div className="flex items-center justify-between">
        <span className="text-[10px] text-[color:var(--lkv-text-muted)]">
          {item.weight_g ? `${(item.weight_g / 1000).toFixed(2)} kg` : item.category}
        </span>
        {item.is_lent && <Badge tone="warn">Prêt</Badge>}
      </div>
    </Card>
  );
}

