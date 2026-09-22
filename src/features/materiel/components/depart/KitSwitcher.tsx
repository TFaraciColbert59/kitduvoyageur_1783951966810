'use client';
import { useRouter } from 'next/navigation';
import { ChevronDownIcon as ChevronDown } from '@/components/icons/chevron-down';
import { useState } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { Button } from '@/components/ui';
import { cn } from '@/lib/utils';

interface KitSwitcherProps {
  kits: { id: string; name: string }[];
  currentId: string;
}

function cleanKitName(name: string): string {
  return (name || '').replace(/\s*\((?:copie|copy)\)\s*/gi, '').trim() || 'Kit';
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
      router.push(`/hub/depart?id=${id}`);
    }
  };

  return (
    <div className="relative" aria-label="Changer de kit">
      <Button
        variant="secondary"
        size="sm"
        fullWidth
        onClick={() => setOpen((v) => !v)}
        className="justify-between gap-2 px-3 text-[11px]"
        aria-expanded={open}
        aria-haspopup="listbox"
      >
        <span className="truncate">{cleanKitName(current.name)}</span>
        <motion.span animate={{ rotate: open ? 180 : 0 }} transition={{ duration: 0.18 }}>
          <ChevronDown size={12} aria-hidden="true" className="text-[var(--lkv-text-muted)]" />
        </motion.span>
      </Button>

      <AnimatePresence>
        {open && (
          <motion.ul
            role="listbox"
            aria-label="Sélectionner un kit"
            initial={{ opacity: 0, y: -4, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.97 }}
            transition={{ duration: 0.15 }}
            className="absolute left-0 top-full z-[var(--z-fab)] mt-1 w-full min-w-[200px] overflow-hidden rounded-2xl border border-white/60 bg-[color:var(--glass-bg-medium)] shadow-lg"
          >
            {kits.map((kit) => (
              <li key={kit.id}>
                <Button
                  variant="ghost"
                  role="option"
                  aria-selected={kit.id === currentId}
                  onClick={() => handleSelect(kit.id)}
                  className={cn(
                    'h-auto w-full justify-start whitespace-normal rounded-none px-3.5 py-2 text-left text-xs font-medium',
                    kit.id === currentId
                      ? 'bg-[var(--lkv-hover-surface)] font-semibold text-[var(--lkv-primary)]'
                      : 'text-[var(--lkv-text-muted)] hover:text-[var(--lkv-primary)]'
                  )}
                >
                  {cleanKitName(kit.name)}
                </Button>
              </li>
            ))}
          </motion.ul>
        )}
      </AnimatePresence>

      {open && (
        <div
          className="fixed inset-0 z-[var(--z-sticky)]"
          onClick={() => setOpen(false)}
          aria-hidden="true"
        />
      )}
    </div>
  );
}
