import { GlassCard } from '@/components/ui/GlassCard';
import { Badge } from '@/components/ui/Badge';

/** W-L-4 SeasonalBanner — bandeau saisonnier IA (dérivé des données). */
export function SeasonalBanner({ message, chip }: { message: string; chip: string }) {
  return (
    <GlassCard className="p-4 flex items-center gap-3">
      <Badge tone="sage">{chip}</Badge>
      <p className="text-sm text-[color:var(--label-secondary)]">{message}</p>
    </GlassCard>
  );
}
