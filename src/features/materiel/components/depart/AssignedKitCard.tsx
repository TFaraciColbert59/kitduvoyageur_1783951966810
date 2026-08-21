import Link from 'next/link';
import { GlassCard } from '@/components/ui/GlassCard';
import { Eyebrow } from '@/components/ui/Eyebrow';
import { Metric } from '@/components/ui/Metric';

/** W-D-3 AssignedKitCard — kit assigné au départ. */
export function AssignedKitCard({ kit }: { kit: { id: string; name: string; totalWeightG: number; items: { name: string; category: string | null; weight_g: number }[] } }) {
  return (
    <GlassCard as="article" ariaLabelledBy="assigned-kit-title" className="p-4">
      <Eyebrow>Kit assigné</Eyebrow>
      <h3 id="assigned-kit-title" className="font-display font-semibold text-[20px] text-[color:var(--label)] mt-1">{kit.name}</h3>
      <Metric value={(kit.totalWeightG / 1000).toFixed(1)} unit="kg" size="md" />
      <ul className="mt-3 flex flex-col gap-1">
        {kit.items.slice(0, 4).map((i) => (
          <li key={i.name} className="flex items-center justify-between text-sm text-[color:var(--label-secondary)]">
            <span>{i.name}</span>
            <span className="text-xs text-[color:var(--label-tertiary)]">{((i.weight_g ?? 0) / 1000).toFixed(2)} kg</span>
          </li>
        ))}
      </ul>
      <Link
        href={`/hiking/cockpit?kitId=${kit.id}`}
        className="glass interactive h-9 px-4 rounded-full flex items-center justify-center text-sm font-medium text-sage-600 mt-3"
      >
        Utiliser ce kit →
      </Link>
    </GlassCard>
  );
}
