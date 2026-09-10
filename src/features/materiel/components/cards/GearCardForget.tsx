'use client';
import Icon from '@/components/ui/Icon';
import Link from 'next/link';
import { GlassCard } from '@/components/ui/GlassCard';
import { ProgressBar } from '@/components/ui/ProgressBar';

interface ForgetData {
  forgetRemaining: number;
  checkedItems: number;
  totalItems: number;
  nextDepartLabel: string | null;
  sampleItems?: { name: string; is_checked: boolean }[];
}

export function GearCardForget({ data, className }: { data: ForgetData; className?: string }) {
  const pct = data.totalItems > 0 ? Math.round((data.checkedItems / data.totalItems) * 100) : 100;
  const items =
    data.sampleItems && data.sampleItems.length > 0
      ? data.sampleItems
      : [
          { name: 'Tente & Bivouac', is_checked: true },
          { name: 'Gourde filtrante 1L', is_checked: false },
          { name: 'Trousse de secours', is_checked: false },
        ];

  return (
    <GlassCard as="article" interactive ariaLabelledBy="forget-title" className={className}>
      <div className="p-2.5 sm:p-5 flex flex-col justify-between h-full gap-1.5 sm:gap-4">
        {/* Header with Title & Large Metric */}
        <div className="flex items-start justify-between pr-7 md:pr-10 gap-1">
          <div className="space-y-0.5 min-w-0 flex-1">
            <h2
              id="forget-title"
              className="text-[12px] sm:text-[17px] font-display font-bold text-[var(--lkv-primary)] leading-tight truncate"
            >
              À emporter
            </h2>
          </div>
          <div className="text-right shrink-0">
            <span
              className={`text-[17px] sm:text-[30px] font-mono font-bold leading-none ${data.forgetRemaining === 0 ? 'text-[var(--lkv-primary)]' : 'text-[var(--lkv-danger)]'}`}
            >
              {data.forgetRemaining}
            </span>
            <span className="block text-[8px] sm:text-[9.5px] font-semibold uppercase tracking-wider text-[var(--lkv-text-muted)]">
              {data.forgetRemaining === 0 ? 'Prêt' : 'restant'}
            </span>
          </div>
        </div>

        {/* Mini Checklist List */}
        <div className="glass-sub-card p-1.5 sm:p-2.5 flex flex-col gap-1 sm:gap-2">
          {items.slice(0, 2).map((item, idx) => (
            <div
              key={idx}
              className="flex items-center gap-1.5 px-0.5 py-0.2 rounded-lg text-[10px] sm:text-xs font-medium text-[var(--lkv-primary)]"
            >
              <span
                className={`glass-check-circle ${item.is_checked ? 'checked' : ''} !w-3.5 !h-3.5`}
              >
                {item.is_checked && <Icon name="check" size={8} strokeWidth={3} />}
              </span>
              <span
                className={`flex-1 truncate ${item.is_checked ? 'line-through opacity-60 text-[var(--lkv-primary-soft)]' : ''}`}
              >
                {item.name}
              </span>
            </div>
          ))}
        </div>

        {/* Progress Bar */}
        <div className="space-y-0.5 sm:space-y-1">
          <div className="flex items-center justify-between text-[10px] sm:text-xs font-semibold text-[var(--lkv-primary-soft)]">
            <span>Complétude</span>
            <span className="font-mono text-[var(--lkv-primary)]">{pct}%</span>
          </div>
          <ProgressBar
            value={pct}
            label="Checklist de départ"
            tone={pct === 100 ? 'sage' : 'warn'}
          />
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between pt-0.5">
          <span className="text-[9.5px] sm:text-xs text-[var(--lkv-text-muted)] truncate max-w-[80px] sm:max-w-[140px]">
            {data.nextDepartLabel ?? 'Aucun départ'}
          </span>
          <Link
            href="/hub/oublis"
            className="glass-capsule-btn secondary text-[9.5px] sm:text-xs !h-6 sm:!h-7 !px-2 sm:!px-2.5"
          >
            <span>Voir</span>
            <Icon name="arrow-right" size={10} />
          </Link>
        </div>
      </div>
    </GlassCard>
  );
}
