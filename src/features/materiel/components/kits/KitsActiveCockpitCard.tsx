'use client';

import Icon from '@/components/ui/Icon';
import { motion } from 'framer-motion';
import { Badge, Card, EmptyState, ListItem } from '@/components/ui';
import { ShoppingBagIcon as ShoppingBag } from '@/components/icons/shopping-bag';
import { ClockIcon as Clock } from '@/components/icons/clock';
import type { KitListItem } from '@/features/materiel/services/getKits';

interface Props {
  kit: KitListItem | null;
}

/** Widget 5 — Composition du Kit Actif avec entrée staggerée des articles et état vide amélioré. */
export function KitsActiveCockpitCard({ kit }: Props) {
  const items = kit?.items ?? [];
  const weightKg = kit ? (kit.total_weight_g / 1000).toFixed(1) : '0.0';

  return (
    <Card
      as="article"
      tone="sage"
      ariaLabelledBy="active-kit-title"
      className="p-3 md:p-4 flex flex-col justify-between h-full min-h-0"
    >
      <div className="flex items-center justify-between gap-1.5 pr-12 md:pr-14 shrink-0">
        <p className="truncate text-[10px] md:text-sm font-semibold text-[var(--lkv-primary)] font-body">
          Mon Kit Actif
        </p>
        <span
          className="shrink-0 px-1.5 py-0.5 rounded-full bg-[var(--lkv-primary)]/10 text-[var(--lkv-primary)] text-[9px] md:text-[10px] font-bold"
          aria-label={`${items.length} articles dans ce kit`}
        >
          {items.length} art.
        </span>
      </div>

      <h3
        id="active-kit-title"
        className="font-display font-bold text-[var(--lkv-primary)] text-[13px] md:text-[16px] leading-tight truncate shrink-0 mt-0.5"
      >
        {kit?.name ?? 'Mon Kit'}
      </h3>

      {/* Liste des équipements avec état vide amélioré */}
      <div
        className="my-1.5 flex-1 min-h-[90px] max-h-[140px] md:max-h-[160px] overflow-y-auto no-scrollbar flex flex-col gap-1"
        role="list"
        tabIndex={0}
        aria-label="Articles du kit actif"
      >
        {items.length === 0 ? (
          <EmptyState
            compact
            icon={<span aria-hidden="true">🎒</span>}
            title="Kit vide"
            description="Utilisez l'Assembleur ci-dessus pour ajouter des articles."
          />
        ) : (
          items.map((item, idx) => {
            const isUnowned = !item.product_ownership_id;
            return (
              <motion.div
                key={`${item.name}-${idx}`}
                role="listitem"
                initial={{ opacity: 0, x: -6 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.2, delay: idx * 0.03, ease: [0.16, 1, 0.3, 1] }}
                className={
                  isUnowned
                    ? 'rounded-lg border border-dashed border-white/30 bg-white/[0.04] opacity-70'
                    : ''
                }
              >
                <ListItem
                  as="div"
                  leading={
                    <span
                      className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-md border ${
                        isUnowned
                          ? 'border-white/30 bg-white/5 text-[var(--lkv-text-muted)]'
                          : 'bg-[var(--lkv-primary)]/10 border-[var(--lkv-primary)]/20 text-[var(--lkv-primary)]'
                      }`}
                      aria-hidden="true"
                    >
                      {isUnowned ? (
                        <Clock size={9} />
                      ) : (
                        <Icon name="check" size={10} strokeWidth={3} />
                      )}
                    </span>
                  }
                  title={
                    <span className={isUnowned ? 'italic text-[var(--lkv-text-muted)]' : 'font-semibold text-[var(--lkv-primary)]'}>
                      {item.name}
                    </span>
                  }
                  metadata={
                    isUnowned ? (
                      <Badge tone="info" className="gap-0.5 px-1 py-0.5 text-[8px] font-bold">
                        <ShoppingBag size={8} aria-hidden="true" />
                        En commande
                      </Badge>
                    ) : (
                      <span className="text-[9px] font-mono text-[var(--lkv-text-muted)]">
                        {item.weight_g ? `${item.weight_g}g` : '—'}
                      </span>
                    )
                  }
                />
              </motion.div>
            );
          })
        )}
      </div>

      {/* Capsule inférieure Poids Total */}
      <Card variant="compact" className="flex shrink-0 items-center justify-between px-2.5 py-1.5 text-[11px]">
        <span className="text-[9px] md:text-[10px] font-semibold uppercase tracking-wider text-[var(--lkv-primary-soft)]">
          Poids total
        </span>
        <motion.span
          key={weightKg}
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
          className="font-mono font-bold text-[var(--lkv-primary)]"
          aria-label={`Poids total : ${weightKg} kg`}
        >
          {weightKg} kg
        </motion.span>
      </Card>
    </Card>
  );
}
