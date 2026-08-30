'use client';
import { useRouter } from 'next/navigation';
import { ChevronDown } from 'lucide-react';
import { useState } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { cn } from '@/lib/utils';

interface KitSwitcherProps {
  kits: { id: string; name: string }[];
  currentId: string;
}

export function KitSwitcher({ kits, currentId }: KitSwitcherProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const shouldReduceMotion = useReducedMotion();

  if (kits.length <= 1) return null;

  const current = kits.find((k) => k.id === currentId) ?? kits[0];

  const handleSelect = (id: string) => {
    setOpen(false);
    if (id !== currentId) {
      router.push(`/materiel/depart/${id}`);
    }
  };

  return (
    <div className="relative" aria-label="Changer de kit">
      <button
        onClick={() => setOpen((v) => !v)}
        className="glass-sub-card flex items-center gap-2 px-3 py-2 rounded-full text-[11px] sm:text-xs font-semibold text-[#17402C] hover:bg-white/30 transition-colors focus-visible:outline-2 focus-visible:outline-[#17402C]"
        aria-expanded={open}
        aria-haspopup="listbox"
      >
        <span className="max-w-[140px] truncate">{current.name}</span>
        <motion.span animate={{ rotate: open ? 180 : 0 }} transition={{ duration: 0.18 }}>
          <ChevronDown size={12} aria-hidden="true" />
        </motion.span>
      </button>

      <AnimatePresence>
        {open && (
          <motion.ul
            role="listbox"
            aria-label="Sélectionner un kit"
            initial={{ opacity: 0, y: -4, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.97 }}
            transition={{ duration: 0.15 }}
            className="absolute left-0 top-full mt-1 z-50 glass rounded-2xl shadow-lg min-w-[200px] overflow-hidden"
          >
            {kits.map((kit) => (
              <li key={kit.id}>
                <button
                  role="option"
                  aria-selected={kit.id === currentId}
                  onClick={() => handleSelect(kit.id)}
                  className={cn(
                    'w-full text-left px-4 py-2.5 text-xs font-medium transition-colors',
                    kit.id === currentId
                      ? 'text-[#17402C] font-semibold bg-white/20'
                      : 'text-[#5A7064] hover:bg-white/15 hover:text-[#17402C]'
                  )}
                >
                  {kit.name}
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
