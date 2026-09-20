import { Card } from '@/components/ui';
import { Badge } from '@/components/ui/Badge';

/** W-L-4 SeasonalBanner — bandeau saisonnier IA (dérivé des données). */
export function SeasonalBanner({ message, chip }: { message: string; chip: string }) {
  return (
    <Card className="p-4 flex items-center gap-3">
      <Badge tone="sage">{chip}</Badge>
      <p className="text-sm text-[color:var(--lkv-text-secondary)]">{message}</p>
    </Card>
  );
}
