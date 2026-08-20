import Link from 'next/link';
import { GlassCard } from '@/components/ui/GlassCard';
import { Eyebrow } from '@/components/ui/Eyebrow';
import { Badge } from '@/components/ui/Badge';

export interface CommunityKit {
  id: string;
  name: string;
  author: string;
  likes: number;
  totalWeightG: number;
  itemsCount: number;
}

/** W-D-9 SimilarCommunityKits — strip horizontal de kits communauté (type ProductGlassCard). */
export function SimilarCommunityKits({ kits }: { kits: CommunityKit[] }) {
  return (
    <GlassCard as="article" ariaLabelledBy="similar-kits-title" className="p-4">
      <Eyebrow>Kits communauté similaires</Eyebrow>
      <h3 id="similar-kits-title" className="sr-only">Kits de la communauté similaires au vôtre</h3>
      <div className="mt-3 flex gap-3 overflow-x-auto no-scrollbar">
        {kits.map((k) => (
          <Link
            key={k.id}
            href="/communaute"
            className="glass interactive block w-[200px] shrink-0 p-3"
            aria-label={`${k.name}, par ${k.author}`}
          >
            <div className="flex items-center justify-between">
              <span className="font-display font-semibold text-[15px] text-[color:var(--label)] line-clamp-1">{k.name}</span>
            </div>
            <p className="mt-1 text-xs text-[color:var(--label-tertiary)]">par {k.author}</p>
            <div className="mt-2 flex items-center justify-between">
              <span className="text-xs text-[color:var(--label-secondary)]">{(k.totalWeightG / 1000).toFixed(1)} kg · {k.itemsCount} articles</span>
              <Badge tone="stone">♥ {k.likes}</Badge>
            </div>
          </Link>
        ))}
        {kits.length === 0 && <p className="text-sm text-[color:var(--label-secondary)]">Aucun kit communautaire similaire pour le moment.</p>}
      </div>
    </GlassCard>
  );
}
