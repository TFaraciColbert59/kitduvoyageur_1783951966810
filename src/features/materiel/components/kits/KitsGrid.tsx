'use client';
import { useMemo, useState } from 'react';
import { GlassCard } from '@/components/ui/GlassCard';
import { Eyebrow } from '@/components/ui/Eyebrow';
import { Badge } from '@/components/ui/Badge';
import type { KitListItem } from '@/features/materiel/services/getKits';

const SEASONS = ['printemps', 'ete', 'automne', 'hiver', 'toute_saison'] as const;

/** W-K-2 + W-K-3 KitsGrid — grille de kits + filtres latéraux (données réelles). */
export function KitsGrid({ kits, onSelect }: { kits: KitListItem[]; onSelect?: (id: string) => void }) {
  const [season, setSeason] = useState<string>('all');
  const [favOnly, setFavOnly] = useState(false);
  const [trashOnly, setTrashOnly] = useState(false);

  const filtered = useMemo(() => {
    return kits.filter((k) => {
      if (trashOnly && !k.is_trashed) return false;
      if (!trashOnly && k.is_trashed) return false;
      if (season !== 'all' && k.season !== season) return false;
      if (favOnly && !k.is_favorite) return false;
      return true;
    });
  }, [kits, season, favOnly, trashOnly]);

  return (
    <div className="grid grid-cols-12 gap-4">
      <GlassCard className="col-span-12 md:col-span-3 p-4 self-start" aria-labelledby="kits-filters">
        <h2 id="kits-filters" className="sr-only">Filtres</h2>
        <Eyebrow>Filtres</Eyebrow>
        <div className="mt-3 flex flex-col gap-2">
          <label className="flex items-center gap-2 text-sm text-[color:var(--label)]">
            <input type="checkbox" checked={favOnly} onChange={(e) => setFavOnly(e.target.checked)} />
            Favoris uniquement
          </label>
          <label className="flex items-center gap-2 text-sm text-[color:var(--label)]">
            <input type="checkbox" checked={trashOnly} onChange={(e) => setTrashOnly(e.target.checked)} />
            Corbeille
          </label>
          <select
            value={season}
            onChange={(e) => setSeason(e.target.value)}
            aria-label="Filtrer par saison"
            className="glass-input mt-1"
          >
            <option value="all">Toutes saisons</option>
            {SEASONS.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>
      </GlassCard>

      <div className="col-span-12 md:col-span-9">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtered.map((k) => {
            const pct = k.item_count ? (k.checked_count / k.item_count) * 100 : 100;
            return (
              <button
                key={k.id}
                type="button"
                onClick={() => onSelect?.(k.id)}
                className="glass interactive p-4 flex flex-col gap-2 text-left"
              >
                <div className="flex items-center justify-between">
                  <span className="font-display font-semibold text-[17px] text-[color:var(--label)]">{k.name}</span>
                  {k.is_favorite && <Badge tone="sage">★</Badge>}
                </div>
                {k.description && <p className="text-xs text-[color:var(--label-tertiary)] line-clamp-2">{k.description}</p>}
                <div className="text-xs text-[color:var(--label-secondary)]">{(k.total_weight_g / 1000).toFixed(1)} kg · {k.item_count} article(s)</div>
                <div className="h-1.5 w-full rounded-full bg-stone-200/70 overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-sage-500 to-sage-300" style={{ width: `${pct}%` }} />
                </div>
              </button>
            );
          })}
          {filtered.length === 0 && (
            <p className="text-sm text-[color:var(--label-secondary)] col-span-full">Aucun kit ne correspond aux filtres.</p>
          )}
        </div>
      </div>
    </div>
  );
}
