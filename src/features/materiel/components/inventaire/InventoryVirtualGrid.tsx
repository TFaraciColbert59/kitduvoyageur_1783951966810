'use client';
import { useVirtualizer } from '@tanstack/react-virtual';
import { useRef } from 'react';
import type { InventoryItem } from '@/features/materiel/services/getInventory';
import { InventoryCard } from './InventoryCard';

/** W-I-3 InventoryVirtualGrid — grille virtualisée 2 colonnes (TanStack Virtual). */
export function InventoryVirtualGrid({ items, onSelect }: { items: InventoryItem[]; onSelect?: (item: InventoryItem) => void }) {
  const parentRef = useRef<HTMLDivElement>(null);
  const rowVirtualizer = useVirtualizer({
    count: Math.ceil(items.length / 2),
    getScrollElement: () => parentRef.current,
    estimateSize: () => 104,
    overscan: 6,
  });

  return (
    <div ref={parentRef} className="h-[52vh] overflow-y-auto">
      <div style={{ height: rowVirtualizer.getTotalSize(), position: 'relative' }}>
        {rowVirtualizer.getVirtualItems().map((virtualRow) => {
          const pair = items.slice(virtualRow.index * 2, virtualRow.index * 2 + 2);
          return (
            <div
              key={virtualRow.key}
              className="grid grid-cols-2 gap-3 absolute top-0 left-0 w-full"
              style={{ transform: `translateY(${virtualRow.start}px)`, height: 96 }}
            >
              {pair.map((item) => <InventoryCard key={item.id} item={item} onSelect={onSelect} />)}
            </div>
          );
        })}
      </div>
    </div>
  );
}
