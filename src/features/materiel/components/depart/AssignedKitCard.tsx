import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';
import { GlassCard } from '@/components/ui/GlassCard';

const MAX_VISIBLE = 8;

/** W-D-3 AssignedKitCard — sans icône titre, typo vert foncé (#17402C). */
export function AssignedKitCard({
  kit,
}: {
  kit: { id: string; name: string; totalWeightG: number; items: { name: string; weight_g: number; photoUrl: string | null; productHref: string | null }[] };
}) {
  const weightKg = (kit.totalWeightG / 1000).toFixed(1);
  const visible = kit.items.slice(0, MAX_VISIBLE);
  const hidden = kit.items.length - visible.length;

  return (
    <GlassCard as="article" tone="sage" ariaLabelledBy="assigned-kit-title" className="p-3 md:p-4">
      <Link
        href={`/hiking/cockpit?kitId=${kit.id}`}
        aria-label="Utiliser ce kit"
        className="!absolute top-1.5 right-8 md:top-2 md:right-11 z-10 glass interactive h-6 w-6 md:h-8 md:w-8 !rounded-full flex items-center justify-center text-[#365233]"
      >
        <ArrowUpRight size={12} className="md:hidden" aria-hidden="true" />
        <ArrowUpRight size={15} className="hidden md:block" aria-hidden="true" />
      </Link>
      <div className="flex items-center gap-1.5 md:gap-2 pr-14 md:pr-20">
        <p className="truncate min-w-0 text-[10px] md:text-sm font-semibold text-[#17402C] font-body">Kit assigné</p>
      </div>
      <div className="mt-0.5 flex items-center justify-between gap-1.5 md:gap-2 pr-12 md:pr-20">
        <h3 id="assigned-kit-title" className="font-display font-bold text-[#17402C] text-[13px] max-[359px]:text-[12px] md:text-[18px] leading-tight truncate">
          {kit.name}
        </h3>
        <span className="shrink-0 px-1.5 py-0.5 rounded-full bg-[#17402C]/10 text-[#17402C] text-[9px] md:text-[10px] font-bold whitespace-nowrap">
          {kit.items.length} art.
        </span>
      </div>

      <div className="mt-1 md:mt-2 flex-1 min-h-0 grid grid-cols-2 md:flex md:items-center gap-1.5 md:gap-2 content-start overflow-y-auto md:overflow-x-auto no-scrollbar">
        {visible.map((i, idx) => {
          const wrapClass = idx >= 4 ? 'hidden md:block' : idx >= 2 ? 'max-[359px]:hidden' : '';
          const cell = (
            <div
              title={i.name}
              className="h-[26px] max-[359px]:h-[18px] w-full md:w-16 md:h-16 rounded-[10px] md:rounded-[14px] shrink-0 overflow-hidden glass-sub-card flex items-center justify-center"
            >
              {i.photoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={i.photoUrl} alt={i.name} className="h-full w-full object-cover" />
              ) : (
                <span className="text-[14px] md:text-[22px]" aria-hidden="true">🎒</span>
              )}
            </div>
          );
          return i.productHref ? (
            <Link key={i.name} href={i.productHref} aria-label={`Voir le produit ${i.name}`} className={`shrink-0 ${wrapClass}`}>
              {cell}
            </Link>
          ) : (
            <div key={i.name} className={`shrink-0 w-full md:w-auto ${wrapClass}`}>
              {cell}
            </div>
          );
        })}
        {hidden > 0 && (
          <div
            className="hidden md:flex shrink-0 h-16 w-16 rounded-[14px] glass-sub-card flex-col items-center justify-center gap-0.5"
            aria-hidden="true"
          >
            <span className="font-mono font-bold text-[14px] text-[#17402C]">+{hidden}</span>
            <span className="text-[9px] font-semibold uppercase tracking-wide text-[#365233]">articles</span>
          </div>
        )}
        {kit.items.length === 0 && <p className="text-xs text-[#486944]">Aucun article.</p>}
      </div>

      <div className="mt-1 md:mt-2 hidden md:flex glass-sub-card shrink-0 px-3 py-2 items-center justify-between">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-[#365233]">Poids total</span>
        <span className="font-mono font-bold text-[14px] text-[#17402C]">{weightKg} kg</span>
      </div>
    </GlassCard>
  );
}