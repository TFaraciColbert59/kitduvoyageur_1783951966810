'use client';
import { useState, useTransition } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { ChevronDownIcon as ChevronDown } from '@/components/icons/chevron-down';
import { setTripKit } from '@/features/trips/actions/setTripKit';
import { cn } from '@/lib/utils';

interface TripKitSelectorProps {
  tripId: string;
  kits: { id: string; name: string }[];
  currentId: string | null;
}

function cleanKitName(name: string): string {
  return (name || '').replace(/\s*\((?:copie|copy)\)\s*/gi, '').trim() || 'Kit';
}

/**
 * Sélecteur de kit pour l'onglet Équipement du hub : même grammaire que
 * KitSwitcher (depart), mais persiste via trips.kit_id (setTripKit).
 */
export function TripKitSelector({ tripId, kits, currentId }: TripKitSelectorProps) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [activeId, setActiveId] = useState<string | null>(currentId);
  const shouldReduceMotion = useReducedMotion();

  const kitsForSelect = kits.length > 0 ? kits : [];
  if (kitsForSelect.length === 0) return null;

  const current = kitsForSelect.find((k) => k.id === activeId) ?? kitsForSelect[0];

  const handleSelect = (id: string) => {
    setOpen(false);
    if (id === activeId) return;
    setActiveId(id);
    startTransition(async () => {
      await setTripKit(tripId, id);
    });
  };

  return (
    <div className="relative" aria-label="Changer de kit">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          'glass-sub-card w-full min-h-[44px] flex items-center justify-between gap-2 px-3 py-2 rounded-xl text-xs font-semibold text-[var(--lkv-primary)] hover:bg-white/40 transition-colors focus-visible:outline-2 focus-visible:outline-[var(--lkv-primary)] cursor-pointer',
          isPending && 'opacity-60'
        )}
        aria-expanded={open}
        aria-haspopup="listbox"
      >
        <span className="truncate">{cleanKitName(current.name)}</span>
        <motion.span animate={{ rotate: open ? 180 : 0 }} transition={{ duration: 0.18 }}>
          <ChevronDown size={12} aria-hidden="true" className="text-[var(--lkv-text-muted)]" />
        </motion.span>
      </button>

      <AnimatePresence>
        {open && (
          <motion.ul
            role="listbox"
            aria-label="Sélectionner un kit"
            initial={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: -4, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.97 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 top-full mt-1 z-50 glass rounded-2xl w-full min-w-[220px] overflow-hidden border border-white/60"
          >
            {kitsForSelect.map((kit) => (
              <li key={kit.id}>
                <button
                  type="button"
                  role="option"
                  aria-selected={kit.id === activeId}
                  onClick={() => handleSelect(kit.id)}
                  className={cn(
                    'w-full min-h-[44px] text-left px-3.5 py-2 text-xs font-medium transition-colors cursor-pointer',
                    kit.id === activeId
                      ? 'text-[var(--lkv-primary)] font-semibold bg-white/40'
                      : 'text-[var(--lkv-text-muted)] hover:bg-white/20 hover:text-[var(--lkv-primary)]'
                  )}
                >
                  {cleanKitName(kit.name)}
                </button>
              </li>
            ))}
          </motion.ul>
        )}
      </AnimatePresence>

      {open && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setOpen(false)}
          aria-hidden="true"
        />
      )}
    </div>
  );
}
