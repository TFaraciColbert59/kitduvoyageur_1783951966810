'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Search } from 'lucide-react';
import { GlassDrawer } from '@/components/ui/GlassDrawer';

/** Loupe de recherche / changement de kit du cockpit Prochain départ. */
export function KitSwitcher({ kits, currentId }: { kits: { id: string; name: string }[]; currentId: string }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const router = useRouter();
  const filtered = kits.filter((k) => k.name.toLowerCase().includes(q.toLowerCase()));

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Changer de kit"
        className="glass interactive h-8 w-8 rounded-full flex items-center justify-center text-[#17402C] shrink-0"
      >
        <Search size={15} className="text-[#17402C]" aria-hidden="true" />
      </button>
      <GlassDrawer open={open} onOpenChange={setOpen} title="Changer de kit">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Rechercher un kit…"
          aria-label="Rechercher un kit"
          className="glass-input w-full mb-3 text-[#17402C]"
          autoFocus
        />
        <ul className="flex flex-col gap-2">
          {filtered.map((k) => (
            <li key={k.id}>
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  setQ('');
                  if (k.id !== currentId) router.push(`/materiel/depart/${k.id}`);
                }}
                className={`w-full text-left backdrop-blur-md border rounded-[var(--r-md)] px-3 py-2.5 text-sm font-medium ${
                  k.id === currentId
                    ? 'bg-sage-500/15 border-sage-500/40 text-[#17402C] font-bold'
                    : 'bg-white/30 border-white/40 text-[#17402C]'
                }`}
              >
                {k.name}
                {k.id === currentId && <span className="ml-2 text-[10px] opacity-70">en cours</span>}
              </button>
            </li>
          ))}
          {filtered.length === 0 && <li className="text-sm text-[color:var(--label-secondary)]">Aucun kit trouvé.</li>}
        </ul>
      </GlassDrawer>
    </>
  );
}