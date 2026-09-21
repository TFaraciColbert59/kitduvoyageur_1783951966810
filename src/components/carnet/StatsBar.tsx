import React from 'react';
import { Card } from '@/components/ui';

interface Stat {
  value: string;
  label: string;
  sublabel?: string;
  hidden?: boolean;
}

interface StatsBarProps {
  stats: Stat[];
}

export default function StatsBar({ stats }: StatsBarProps) {
  const visibleStats = (stats || []).filter(s => !s.hidden && s.value !== undefined && s.value !== null && s.value !== '');
  if (visibleStats.length === 0) return null;

  return (
    <Card className="p-[var(--space-4)] sm:p-[var(--space-5)]">
      <div className="flex flex-wrap items-center justify-around gap-[var(--space-4)] divide-y divide-[color:var(--lkv-primary)]/10 md:gap-[var(--space-2)] md:divide-x md:divide-y-0">
        {visibleStats.map((stat, i) => (
          <div key={i} className="min-w-[100px] flex-1 pt-[var(--space-2)] text-center md:pt-0">
            <p className="font-mono text-[length:var(--lkv-text-title-sm)] font-bold tracking-tight text-[color:var(--lkv-text-primary)] sm:text-[length:var(--lkv-text-title-lg)]">
              {stat.value}
            </p>
            <p className="mt-[var(--space-1)] font-mono text-[length:var(--lkv-text-caption-2)] font-bold uppercase tracking-[0.18em] text-[color:var(--lkv-text-muted)]">
              {stat.label}
            </p>
            {stat.sublabel && (
              <p className="mt-[var(--space-1)] text-[length:var(--lkv-text-caption-2)] text-[color:var(--lkv-text-muted)]/80">{stat.sublabel}</p>
            )}
          </div>
        ))}
      </div>
    </Card>
  );
}
