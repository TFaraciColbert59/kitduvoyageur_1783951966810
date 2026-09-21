'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import Icon from '@/components/ui/AppIcon';
import { useHapticFeedback } from '@/hooks/useHapticFeedback';
import type { CarnetKitItem } from '@/lib/mock/carnet-chartreuse';
import { Badge, Card, Chip } from '@/components/ui';

interface KitSouvenirCardProps {
  intro?: string;
  items: CarnetKitItem[];
}

export default function KitSouvenirCard({ intro, items }: KitSouvenirCardProps) {
  const { triggerHaptic } = useHapticFeedback();
  const [checkedItems, setCheckedItems] = useState<Record<string, boolean>>({});
  const [selectedFilter, setSelectedFilter] = useState('all');

  const toggleCheck = (id: string) => {
    triggerHaptic('selection');
    setCheckedItems((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const categories = ['all', 'Couchage', 'Vêtements', 'Cuisine', 'Hydratation'];

  const filteredItems = items.filter((item) => {
    if (selectedFilter === 'all') return true;
    const nameLow = item.name.toLowerCase();
    const detailLow = (item.detail || '').toLowerCase();
    if (selectedFilter === 'Couchage') return nameLow.includes('duvet') || nameLow.includes('sac') || detailLow.includes('confort');
    if (selectedFilter === 'Vêtements') return nameLow.includes('veste') || nameLow.includes('hardshell') || detailLow.includes('portée');
    if (selectedFilter === 'Cuisine') return nameLow.includes('réchaud') || detailLow.includes('combustible');
    if (selectedFilter === 'Hydratation') return nameLow.includes('gourde') || detailLow.includes('eau');
    return true;
  });

  return (
    <Card className="space-y-[var(--space-4)] p-[var(--space-4)] sm:p-[var(--space-6)]">
      <div className="flex flex-col justify-between gap-[var(--space-3)] border-b border-[color:var(--lkv-primary)]/10 pb-[var(--space-3)] sm:flex-row sm:items-center">
        <div className="flex items-center gap-[var(--space-2)]">
          <span className="text-[length:var(--lkv-text-title-sm)]" aria-hidden>🎒</span>
          <div>
            <h3 className="font-display text-[length:var(--lkv-text-caption)] font-bold text-[color:var(--lkv-text-primary)] sm:text-[length:var(--lkv-text-subheadline)]">
              Dans le sac <span className="font-serif font-normal italic text-[color:var(--lkv-forest-800)]">de l’expédition</span>
            </h3>
            <span className="font-mono text-[length:var(--lkv-text-caption-2)] text-[color:var(--lkv-text-muted)]">
              {items.length} indispensables archivés · Poids estimé 4.8 kg
            </span>
          </div>
        </div>

        <div className="flex items-center gap-[var(--space-2)]">
          <Link
            href="/ai-configurator"
            onClick={() => triggerHaptic('light')}
            className="inline-flex min-h-[var(--control-height-sm)] items-center gap-[var(--space-1)] rounded-full bg-[color:var(--lkv-action)] px-[var(--space-3)] text-[length:var(--lkv-text-caption-2)] font-bold text-[color:var(--lkv-on-action)]"
          >
            <Icon name="SparklesIcon" size={13} aria-hidden="true" />
            <span>Reconfigurer IA</span>
          </Link>
        </div>
      </div>

      {intro && (
        <p className="rounded-[var(--lkv-radius-2xl)] border border-[color:var(--lkv-primary)]/5 bg-[color:var(--lkv-primary)]/5 p-[var(--space-3)] font-sans text-[length:var(--lkv-text-caption-2)] italic leading-relaxed text-[color:var(--lkv-text-secondary)]">
          {intro}
        </p>
      )}

      <div className="flex flex-wrap gap-[var(--space-1)]">
        {categories.map((cat) => (
          <Chip
            key={cat}
            selected={selectedFilter === cat}
            onClick={() => {
              triggerHaptic('light');
              setSelectedFilter(cat);
            }}
          >
            {cat === 'all' ? 'Tout le sac' : cat}
          </Chip>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-[var(--space-2)] pt-[var(--space-1)] sm:grid-cols-2">
        {filteredItems.map((item) => {
          const isChecked = checkedItems[item.id];
          return (
            <button
              key={item.id}
              type="button"
              role="checkbox"
              aria-checked={!!isChecked}
              onClick={() => toggleCheck(item.id)}
              className={`flex cursor-pointer items-center gap-[var(--space-3)] rounded-[var(--lkv-radius-2xl)] border p-[var(--space-3)] text-left transition-colors ${
                isChecked
                  ? 'border-[color:var(--lkv-success)]/40 bg-[color:var(--lkv-success-bg)]'
                  : 'border-[color:var(--lkv-border)] bg-[color:var(--lkv-surface-muted)] hover:bg-[color:var(--lkv-hover-surface)]'
              }`}
            >
              <span
                aria-hidden
                className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-[var(--lkv-radius-sm)] text-[length:var(--lkv-text-caption-2)] font-bold transition-colors ${
                  isChecked ? 'bg-[color:var(--lkv-primary)] text-[color:var(--lkv-text-inverted)]' : 'border border-[color:var(--lkv-border-strong)] bg-[color:var(--lkv-field-bg)]'
                }`}
              >
                {isChecked && '✓'}
              </span>

              <span
                className="h-3 w-3 shrink-0 rounded-full"
                style={{ backgroundColor: item.color || 'var(--lkv-primary)' }}
                aria-hidden="true"
              />

              <span className="min-w-0 flex-1">
                <p className={`truncate text-[length:var(--lkv-text-caption-2)] font-bold ${isChecked ? 'text-[color:var(--lkv-text-muted)] line-through' : 'text-[color:var(--lkv-text-primary)]'}`}>
                  {item.name}
                </p>
                {item.detail && (
                  <p className="truncate font-mono text-[length:var(--lkv-text-caption-2)] text-[color:var(--lkv-text-muted)]">{item.detail}</p>
                )}
              </span>

              {item.weight && (
                <Badge className="shrink-0 font-mono font-bold">
                  {item.weight}
                </Badge>
              )}
            </button>
          );
        })}
      </div>
    </Card>
  );
}
