'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
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

interface SearchResult { id: string; type: string; label: string; sublabel: string; href: string }

/** GlassCommand — ⌘K connecté à la recherche Supabase (kits + items). */
export function GlassCommand() {
  const { open, context, setOpen } = useCommandStore();
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') { e.preventDefault(); setOpen(!open); }
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, setOpen]);

  useEffect(() => {
    const parsed = QuerySchema.safeParse(query);
    if (!parsed.success || query.trim().length < 2) { setResults([]); return; }
    let active = true;
    setLoading(true);
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/materiel/search?q=${encodeURIComponent(query.trim())}`);
        const data = await res.json();
        if (active) setResults(data.results ?? []);
      } catch {
        if (active) setResults([]);
      } finally {
        if (active) setLoading(false);
      }
    }, 250);
    return () => { active = false; clearTimeout(t); };
  }, [query]);

  const go = (r: SearchResult) => { setOpen(false); router.push(r.href); };

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[60] bg-ink-900/40" />
        <Dialog.Content
          aria-label={`Recherche universelle — contexte ${context}`}
          className="fixed z-[70] left-1/2 top-24 -translate-x-1/2 w-[min(640px,92vw)] glass p-2"
        >
          <div className="flex items-center gap-2 px-3 h-11 rounded-[var(--r-md)] bg-white/60">
            <Search size={18} className="text-[color:var(--label-tertiary)]" aria-hidden="true" />
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={`Rechercher dans ${context}… (kits, objets)`}
              className="flex-1 bg-transparent outline-none font-body text-[15px] text-[color:var(--label)]"
              aria-invalid={!QuerySchema.safeParse(query).success && query.length > 0}
            />
          </div>
          <div className="mt-1 flex flex-col gap-1">
            {loading && <p className="px-3 py-2 text-xs text-[color:var(--label-tertiary)]">Recherche…</p>}
            {!loading && results.length === 0 && query.trim().length >= 2 && (
              <p className="px-3 py-2 text-xs text-[color:var(--label-tertiary)]">Aucun résultat.</p>
            )}
            {results.map((r) => (
              <button
                key={`${r.type}-${r.id}`}
                type="button"
                onClick={() => go(r)}
                className="flex items-center gap-2 px-3 py-2 rounded-[var(--r-sm)] text-left hover:bg-white/40"
              >
                <span className="text-sm text-[color:var(--label)]">{r.label}</span>
                <span className="ml-auto text-xs text-[color:var(--label-tertiary)]">{r.sublabel}</span>
              </button>
            ))}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
