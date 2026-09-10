'use client';

import { Check } from 'lucide-react';
import { GlassDrawer } from '@/components/ui/GlassDrawer';
import { HapticLink } from '../../menu/HapticLink';
import { hubSectionHref } from '../../../registry/hubSectionRegistry';
import type { GearCardData } from '../../../mobile/gearEngine';

export interface GearItemPanelProps {
  card: GearCardData | null;
  tripSlug: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  busy: boolean;
  onTogglePacked: (card: GearCardData) => void;
}

export function GearItemPanel({ card, tripSlug, open, onOpenChange, busy, onTogglePacked }: GearItemPanelProps) {
  return (
    <GlassDrawer open={open} onOpenChange={onOpenChange} title={card?.name ?? 'Équipement'} width={430}>
      {card && (
        <div className="space-y-4">
          <div className="relative h-48 overflow-hidden rounded-2xl border border-white/60 bg-[var(--lkv-forest-50)]">
            {card.imageUrl ? (
              <img src={card.imageUrl} alt="" className="h-full w-full object-cover" />
            ) : (
              <span className="flex h-full items-center justify-center bg-gradient-to-br from-[var(--lkv-forest-100)] to-[var(--lkv-forest-50)]">
                <span
                  className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white/70 text-2xl font-extrabold text-[var(--lkv-primary)] ring-1 ring-white/70"
                  aria-hidden="true"
                >
                  {card.name.slice(0, 1).toUpperCase()}
                </span>
              </span>
            )}
            <span className="glass-sub-card absolute left-3 top-3 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.1em] text-[var(--lkv-primary)]">
              {card.categoryLabel}
            </span>
          </div>

          <dl className="glass-sub-card grid grid-cols-2 gap-3 rounded-2xl p-3 text-sm">
            <div>
              <dt className="text-[10px] font-medium uppercase tracking-[0.12em] text-[var(--lkv-text-primary)]/75">
                Poids
              </dt>
              <dd className="font-bold tabular-nums text-[var(--lkv-text-primary)]">
                {card.weightKg != null ? `${card.weightKg} kg` : '—'}
              </dd>
            </div>
            <div>
              <dt className="text-[10px] font-medium uppercase tracking-[0.12em] text-[var(--lkv-text-primary)]/75">
                Quantité
              </dt>
              <dd className="font-bold tabular-nums text-[var(--lkv-text-primary)]">×{card.quantity}</dd>
            </div>
            <div>
              <dt className="text-[10px] font-medium uppercase tracking-[0.12em] text-[var(--lkv-text-primary)]/75">
                Type
              </dt>
              <dd className="font-bold text-[var(--lkv-text-primary)]">
                {card.isConsumable ? 'Consommable' : card.isWorn === true ? 'Porté' : 'Matériel'}
              </dd>
            </div>
            <div>
              <dt className="text-[10px] font-medium uppercase tracking-[0.12em] text-[var(--lkv-text-primary)]/75">
                Priorité
              </dt>
              <dd className="font-bold text-[var(--lkv-text-primary)]">
                {card.isVital ? 'Essentiel' : 'Recommandé'}
              </dd>
            </div>
          </dl>

          <button
            type="button"
            onClick={() => onTogglePacked(card)}
            disabled={busy}
            className={`flex h-12 w-full items-center justify-center gap-2 rounded-full text-sm font-bold transition-transform active:scale-[0.98] disabled:opacity-50 ${
              card.isPacked
                ? 'border border-[var(--lkv-primary)]/25 bg-white/80 text-[var(--lkv-primary)]'
                : 'bg-[var(--lkv-primary)] text-white'
            }`}
          >
            <Check size={16} aria-hidden="true" />
            {card.isPacked ? 'Retirer du sac' : 'Marquer comme prêt'}
          </button>

          <HapticLink
            href={hubSectionHref({ nature: 'sortie', slug: tripSlug }, 'checklist')}
            className="flex h-11 items-center justify-center rounded-full border border-white/70 bg-white/70 text-xs font-bold text-[var(--lkv-primary)] transition-transform active:scale-[0.98]"
          >
            Voir la checklist de départ
          </HapticLink>
        </div>
      )}
    </GlassDrawer>
  );
}

export default GearItemPanel;
