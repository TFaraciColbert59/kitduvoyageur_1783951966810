'use client';

import { useEffect, useState } from 'react';
import { useKitSheet } from '@/features/kits/KitSheetContext';

interface KitOption {
  id: string;
  name: string;
  total_weight_g: number;
  item_count: number;
}

interface KitCarrySelectorProps {
  kitId: string | null;
  onSelect: (kitId: string | null) => void;
  /** Vrai dès que la randonnée est active : la question n'est jamais rejouée. */
  disabled?: boolean;
}

/**
 * Sélecteur « Emporter un kit ? » (chantier lignées, Lot 2.2).
 * Une seule question, posée AVANT le départ, jamais pendant. Le choix est
 * persisté par le HikingController (localStorage) et transmis à la session.
 */
export default function KitCarrySelector({ kitId, onSelect, disabled }: KitCarrySelectorProps) {
  const [kits, setKits] = useState<KitOption[]>([]);
  const [loading, setLoading] = useState(true);
  const { openKit } = useKitSheet();

  useEffect(() => {
    let active = true;
    fetch('/api/materiel/kits')
      .then((r) => (r.ok ? r.json() : { kits: [] }))
      .then((data: { kits?: KitOption[] }) => {
        if (!active) return;
        setKits(
          (data.kits ?? []).map((k) => ({
            id: k.id,
            name: k.name,
            total_weight_g: k.total_weight_g ?? 0,
            item_count: (k as unknown as { materiel_kit_items?: unknown[] }).materiel_kit_items?.length ?? 0,
          }))
        );
        setLoading(false);
      })
      .catch(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  if (disabled) return null;
  if (loading) return null;
  if (kits.length === 0) return null;

  return (
    <div className="fixed top-24 left-4 z-20 w-72 rounded-2xl bg-[#FBFAF6]/95 backdrop-blur-md border border-[#A3C4A3]/40 shadow-[0_16px_40px_rgba(11,31,23,0.14)] p-4">
      <div className="font-mono text-[10px] tracking-[0.18em] uppercase text-[#6B7A72]">
        Emporter un kit ?
      </div>
      <div className="flex flex-col gap-1.5 mt-2.5 max-h-52 overflow-y-auto pr-0.5">
        {kits.map((k) => {
          const selected = kitId === k.id;
          return (
            <button
              key={k.id}
              onClick={() => onSelect(selected ? null : k.id)}
              className={`text-left px-3 py-2 rounded-xl border transition-colors ${
                selected
                  ? 'bg-[#17402C] border-[#17402C] text-white'
                  : 'bg-white border-[#A3C4A3]/50 text-[#0B1F17] hover:border-[#17402C]'
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-medium truncate">{k.name}</span>
                <span className={`font-mono text-[10px] ${selected ? 'text-[#A3C4A3]' : 'text-[#6B7A72]'}`}>
                  {(k.total_weight_g / 1000).toFixed(1)} kg · {k.item_count}
                </span>
              </div>
            </button>
          );
        })}
      </div>
      {kitId && (
        <div className="mt-2 flex items-center justify-between gap-2">
          <button
            onClick={() => openKit(kitId, 'cockpit')}
            className="flex-1 py-1.5 rounded-lg text-[11px] font-medium text-[#17402C] hover:bg-[#EDF3ED] transition-colors"
          >
            Voir la fiche →
          </button>
          <button
            onClick={() => onSelect(null)}
            className="flex-1 py-1.5 rounded-lg text-[11px] font-medium text-[#6B7A72] hover:text-[#17402C] transition-colors"
          >
            Retirer le kit
          </button>
        </div>
      )}
    </div>
  );
}