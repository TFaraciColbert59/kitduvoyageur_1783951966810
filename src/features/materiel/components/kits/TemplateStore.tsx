'use client';
import { useRouter } from 'next/navigation';
import { GlassCard } from '@/components/ui/GlassCard';
import { Eyebrow } from '@/components/ui/Eyebrow';
import { Badge } from '@/components/ui/Badge';
import { useToast } from '@/contexts/ToastContext';
import type { PublicKit } from '@/features/materiel/services/getPublicKits';

/** W-K-7 TemplateStore — kits publics de la communauté + fork. */
export function TemplateStore({ kits }: { kits: PublicKit[] }) {
  const router = useRouter();
  const { toast } = useToast();

  const fork = async (id: string, name: string) => {
    const res = await fetch('/api/materiel/fork', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ kit_id: id }),
    });
    if (res.ok) { toast(`Kit « ${name} » dupliqué`, 'success'); router.refresh(); }
    else toast('Erreur de fork', 'error');
  };

  return (
    <GlassCard as="article" ariaLabelledBy="templates-title" className="p-4">
      <Eyebrow>Template Store communautaire</Eyebrow>
      <h3 id="templates-title" className="sr-only">Kits publics de la communauté</h3>
      <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {kits.map((k) => (
          <div key={k.id} className="bg-white/60 rounded-[var(--r-md)] p-4 flex flex-col gap-2">
            <span className="font-display font-semibold text-[16px] text-[color:var(--label)]">{k.name}</span>
            {k.description && <p className="text-xs text-[color:var(--label-tertiary)] line-clamp-2">{k.description}</p>}
            <div className="flex items-center justify-between mt-auto pt-1">
              <span className="text-xs text-[color:var(--label-secondary)]">{(k.total_weight_g / 1000).toFixed(1)} kg · {k.itemsCount} articles</span>
              {k.tags && k.tags.length > 0 && <Badge tone="stone">{k.tags[0]}</Badge>}
            </div>
            <button type="button" onClick={() => fork(k.id, k.name)} className="glass interactive h-9 rounded-full text-xs font-medium text-sage-600">
              Forker ce kit
            </button>
          </div>
        ))}
        {kits.length === 0 && (
          <p className="text-sm text-[color:var(--label-secondary)] col-span-full">
            Aucun kit public pour le moment. Partagez un kit (is_public) pour l'afficher ici.
          </p>
        )}
      </div>
    </GlassCard>
  );
}
