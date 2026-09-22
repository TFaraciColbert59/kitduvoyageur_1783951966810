'use client';

import Icon from '@/components/ui/Icon';
import React, { useMemo, useState } from 'react';
import type { GearCategory, GearStatus } from '../../types/preparation.types';
import { usePreparationStore } from '../../stores/usePreparationStore';
import { AddGearModal } from '../modals/AddGearModal';
import { useHapticFeedback } from '@/hooks/useHapticFeedback';
import {
  Badge,
  Button,
  Chip,
  EmptyState,
  IconButton,
  ListItem,
  Tabs,
  type TabOption,
} from '@/components/ui';

const CATEGORIES: { key: GearCategory | 'all'; label: string; icon: string }[] = [
  { key: 'all', label: 'Tout', icon: '🎒' },
  { key: 'shelter', label: 'Abri', icon: '⛺' },
  { key: 'sleep', label: 'Couchage', icon: '🛏️' },
  { key: 'cook', label: 'Cuisine', icon: '🍳' },
  { key: 'clothing', label: 'Vêtements', icon: '🧥' },
  { key: 'water', label: 'Eau', icon: '💧' },
  { key: 'safety', label: 'Sécurité', icon: '🛡️' },
  { key: 'tech', label: 'Tech', icon: '⚡' },
  { key: 'navigation', label: 'Navigation', icon: '🧭' },
  { key: 'misc', label: 'Divers', icon: '📦' },
];

export function GearTab() {
  const {
    items,
    categoryFilter,
    statusFilter,
    setCategoryFilter,
    setStatusFilter,
    setItemStatus,
    toggleItemWorn,
    removeItem,
  } = usePreparationStore();
  const { triggerHaptic } = useHapticFeedback();

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  const filteredItems = items.filter((item) => {
    if (categoryFilter !== 'all' && item.category !== categoryFilter) return false;
    if (statusFilter !== 'all' && item.status !== statusFilter) return false;
    return true;
  });

  const categoryOptions = useMemo<readonly TabOption[]>(
    () =>
      CATEGORIES.map((cat) => ({
        id: cat.key,
        label: cat.label,
        icon: <span aria-hidden="true">{cat.icon}</span>,
      })),
    []
  );

  const statusOptions = useMemo<readonly TabOption[]>(
    () => [
      { id: 'all', label: 'Tous', count: items.length },
      { id: 'packed', label: 'Dans le sac', count: items.filter((i) => i.status === 'packed').length },
      { id: 'owned', label: 'Possédés', count: items.filter((i) => i.status === 'owned').length },
      { id: 'to_buy', label: 'À acheter', count: items.filter((i) => i.status === 'to_buy').length },
    ],
    [items]
  );

  const getStatusBadge = (status: GearStatus) => {
    switch (status) {
      case 'packed':
        return { label: 'Dans le sac', tone: 'sage' as const };
      case 'owned':
        return { label: 'Possédé', tone: 'info' as const };
      case 'to_buy':
      default:
        return { label: 'À acheter', tone: 'warn' as const };
    }
  };

  const cycleStatus = (current: GearStatus): GearStatus => {
    triggerHaptic('selection');
    if (current === 'to_buy') return 'owned';
    if (current === 'owned') return 'packed';
    return 'to_buy';
  };

  return (
    <div className="space-y-[var(--space-3)] animate-in fade-in duration-200">
      <Tabs
        variant="scrollable"
        options={categoryOptions}
        value={categoryFilter}
        ariaLabel="Catégories d'équipement"
        onChange={(key) => {
          triggerHaptic('light');
          setCategoryFilter(key as GearCategory | 'all');
        }}
      />

      <div className="flex flex-col items-stretch justify-between gap-[var(--space-2)] sm:flex-row sm:items-center">
        <Tabs
          options={statusOptions}
          value={statusFilter}
          ariaLabel="Statut du matériel"
          className="overflow-x-auto"
          onChange={(status) => setStatusFilter(status as GearStatus | 'all')}
        />

        <Button
          icon={<Icon name="plus" size={14} />}
          onClick={() => {
            triggerHaptic('light');
            setIsAddModalOpen(true);
          }}
          className="shrink-0"
        >
          Ajouter un équipement
        </Button>
      </div>

      {filteredItems.length === 0 ? (
        <EmptyState
          compact
          icon={<Icon name="backpack" size={24} />}
          title="Aucun équipement dans cette sélection."
          actionLabel="Ajouter un premier équipement"
          onAction={() => setIsAddModalOpen(true)}
        />
      ) : (
        <ul className="space-y-[var(--space-2)]">
          {filteredItems.map((item) => {
            const badge = getStatusBadge(item.status);

            return (
              <ListItem
                key={item.id}
                className="border border-[color:var(--glass-border)] bg-[color:var(--glass-bg-medium)] backdrop-blur-[var(--glass-blur-sm)] saturate-[var(--glass-sat)] lkv-rim-inset"
                title={
                  <span className="flex flex-wrap items-center gap-[var(--space-2)]">
                    <span className="truncate">{item.name}</span>
                    {item.isVital && (
                      <Badge tone="danger">
                        <Icon name="shield" size={10} /> VITAL
                      </Badge>
                    )}
                    {item.isConsumable && (
                      <Badge tone="warn">
                        <Icon name="flame" size={10} /> VIVRES
                      </Badge>
                    )}
                  </span>
                }
                subtitle={
                  <span className="flex flex-wrap items-center gap-[var(--space-2)] font-mono">
                    <span className="font-extrabold text-[color:var(--lkv-text-primary)]">
                      {item.weightGrams} g
                    </span>
                    {item.brand && <span>· {item.brand}</span>}
                    {item.quantity > 1 && <span>· Qté: {item.quantity}</span>}
                  </span>
                }
                trailing={
                  <span className="flex items-center gap-[var(--space-2)]">
                    <label
                      title="Cocher si cet objet est porté sur vous (non pesé dans le Base Weight)"
                      className="hidden cursor-pointer select-none items-center gap-[var(--space-1)] text-[10px] font-mono font-semibold text-[color:var(--lkv-text-primary)] hover:opacity-80 sm:flex"
                    >
                      <input
                        type="checkbox"
                        checked={item.isWorn}
                        onChange={() => {
                          triggerHaptic('light');
                          toggleItemWorn(item.id);
                        }}
                        className="cursor-pointer rounded accent-[color:var(--sage-600)]"
                      />
                      <span>Porté 👕</span>
                    </label>

                    <Chip
                      tone={badge.tone}
                      onClick={() => setItemStatus(item.id, cycleStatus(item.status))}
                    >
                      {badge.label}
                    </Chip>

                    <IconButton
                      aria-label="Supprimer l'équipement"
                      title="Supprimer l'équipement"
                      size="sm"
                      onClick={() => {
                        triggerHaptic('light');
                        removeItem(item.id);
                      }}
                    >
                      <Icon name="trash2" size={14} />
                    </IconButton>
                  </span>
                }
              />
            );
          })}
        </ul>
      )}

      <AddGearModal isOpen={isAddModalOpen} onClose={() => setIsAddModalOpen(false)} />
    </div>
  );
}
