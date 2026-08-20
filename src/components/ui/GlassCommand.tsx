'use client';
import { useEffect, useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { Search } from 'lucide-react';
import { z } from 'zod';
import { create } from 'zustand';

const QuerySchema = z.string().min(1).max(120);

interface CommandStore { open: boolean; context: string; setOpen: (v: boolean) => void; setContext: (c: string) => void; }
export const useCommandStore = create<CommandStore>((set) => ({
  open: false, context: 'global',
  setOpen: (open) => set({ open }),
  setContext: (context) => set({ context }),
}));

export function GlassCommand() {
  const { open, context, setOpen } = useCommandStore();
  const [query, setQuery] = useState('');

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') { e.preventDefault(); setOpen(!open); }
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, setOpen]);

  const parsed = QuerySchema.safeParse(query);

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[60] bg-ink-900/40" />
        <Dialog.Content
          aria-label={`Recherche universelle — contexte ${context}`}
          className="fixed z-[70] left-1/2 top-24 -translate-x-1/2 w-[min(640px,92vw)] glass p-2"
        >
          <div className="flex items-center gap-2 px-3 h-11 rounded-[var(--r-md)] bg-white/40">
            <Search size={18} className="text-[color:var(--label-tertiary)]" aria-hidden="true" />
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={`Rechercher dans ${context}… (kits, produits, itinéraires, alertes)`}
              className="flex-1 bg-transparent outline-none font-body text-[15px] text-[color:var(--label)]"
              aria-invalid={!parsed.success && query.length > 0}
            />
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
