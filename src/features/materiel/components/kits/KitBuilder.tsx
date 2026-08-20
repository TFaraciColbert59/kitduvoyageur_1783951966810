'use client';
import { Reorder } from 'framer-motion';
import { useState } from 'react';
import type { InventoryItem } from '@/features/materiel/services/getInventory';

/** W-K-4 KitBuilder — drag & drop inventaire → kit en cours. */
export function KitBuilder({
  inventory, initialKitItems, onDrop,
}: { inventory: InventoryItem[]; initialKitItems: InventoryItem[]; onDrop: (item: InventoryItem) => void }) {
  const [kitItems, setKitItems] = useState(initialKitItems);

  return (
    <div className="grid grid-cols-2 gap-4">
      <div className="glass p-3">
        <p className="text-sm font-medium mb-2">Inventaire</p>
        <ul className="flex flex-col gap-1 max-h-[420px] overflow-y-auto">
          {inventory.map((item) => (
            <li
              key={item.id}
              draggable
              onDragStart={(e) => e.dataTransfer.setData('itemId', item.id)}
              className="glass interactive p-2 text-sm cursor-grab"
            >
              {item.name}
            </li>
          ))}
        </ul>
      </div>
      <div
        className="glass p-3"
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          const itemId = e.dataTransfer.getData('itemId');
          const item = inventory.find((i) => i.id === itemId);
          if (item) { onDrop(item); setKitItems((prev) => [...prev, item]); }
        }}
      >
        <p className="text-sm font-medium mb-2">Kit en cours</p>
        <Reorder.Group axis="y" values={kitItems} onReorder={setKitItems} className="flex flex-col gap-1">
          {kitItems.map((item) => (
            <Reorder.Item key={item.id} value={item} className="glass p-2 text-sm">
              {item.name}
            </Reorder.Item>
          ))}
        </Reorder.Group>
      </div>
    </div>
  );
}
