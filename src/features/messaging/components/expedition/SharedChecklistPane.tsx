'use client';

import React, { useState } from 'react';
import type { ExpeditionChecklistItem, ChecklistCategory } from '../../types/expeditionRooms.types';
import { calculateChecklistProgress } from '../../types/expeditionRooms.types';

export interface SharedChecklistPaneProps {
  items?: ExpeditionChecklistItem[];
  onToggleItem?: (itemId: string, isCompleted: boolean) => void;
  onAssignItem?: (itemId: string, userId: string | null, userName?: string | null) => void;
  onAddItem?: (label: string, category: ChecklistCategory) => void;
  currentUserId?: string;
  className?: string;
}

const CATEGORY_LABELS: Record<string, string> = {
  safety: 'Sécurité & Secours',
  gear: 'Matériel Technique',
  food: 'Vivres & Eau',
  logistics: 'Logistique & Cartes',
  navigation: 'Navigation',
  camp: 'Bivouac & Abri',
  medical: 'Pharmacie',
  admin: 'Autorisations',
};

export const SharedChecklistPane: React.FC<SharedChecklistPaneProps> = ({
  items = [],
  onToggleItem,
  onAssignItem,
  onAddItem,
  currentUserId,
  className = '',
}) => {
  const [newLabel, setNewLabel] = useState('');
  const [newCategory, setNewCategory] = useState<ChecklistCategory>('gear');

  const { total, completed, percentage } = calculateChecklistProgress(items);

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newLabel.trim()) return;
    onAddItem?.(newLabel.trim(), newCategory);
    setNewLabel('');
  };

  return (
    <div className={`flex flex-col gap-3 ${className}`}>
      {/* Header with progress counters */}
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between text-xs text-[color:var(--lkv-text-primary)]">
          <span className="font-semibold">Checklist Partagée</span>
          <span className="text-[color:var(--lkv-text-secondary)]">
            {completed}/{total} ({percentage}%)
          </span>
        </div>
        <div
          role="progressbar"
          aria-valuenow={percentage}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Progression de la checklist"
          className="h-2 w-full overflow-hidden rounded-full bg-black/10 dark:bg-white/15"
        >
          <div
            className="h-full bg-[color:var(--lkv-action)] transition-all duration-300"
            style={{ width: `${percentage}%` }}
          />
        </div>
      </div>

      {/* Items list */}
      {items.length === 0 ? (
        <div className="rounded-2xl border border-[color:var(--glass-border)] bg-[color:var(--glass-bg-subtle)] p-4 text-center text-xs text-[color:var(--lkv-text-secondary)]">
          Aucun élément dans la checklist pour le moment.
        </div>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {items.map((item) => {
            const isAssignedToMe = currentUserId && item.assignedTo === currentUserId;

            return (
              <li
                key={item.id}
                className="flex items-center justify-between gap-2 rounded-xl border border-[color:var(--glass-border)] bg-[color:var(--glass-bg-subtle)] px-2.5 py-1 transition-colors hover:bg-[color:var(--lkv-hover-surface)]"
              >
                <button
                  type="button"
                  role="checkbox"
                  aria-checked={item.isCompleted}
                  aria-label={`${item.label}, ${CATEGORY_LABELS[item.category] || item.category}, ${item.isCompleted ? 'coché' : 'non coché'}`}
                  onClick={() => onToggleItem?.(item.id, !item.isCompleted)}
                  className="flex h-[44px] min-h-[44px] flex-1 items-center gap-2.5 text-left focus-visible:outline-none"
                >
                  <span
                    aria-hidden="true"
                    className={`flex size-5 shrink-0 items-center justify-center rounded-lg border text-xs font-bold transition-all ${
                      item.isCompleted
                        ? 'border-[color:var(--lkv-action)] bg-[color:var(--lkv-action)] text-white'
                        : 'border-[color:var(--glass-border)] bg-transparent text-transparent'
                    }`}
                  >
                    ✓
                  </span>
                  <div className="flex min-w-0 flex-col">
                    <span
                      className={`truncate text-xs font-medium ${
                        item.isCompleted
                          ? 'line-through opacity-60 text-[color:var(--lkv-text-secondary)]'
                          : 'text-[color:var(--lkv-text-primary)]'
                      }`}
                    >
                      {item.label}
                    </span>
                    <span className="text-[10px] text-[color:var(--lkv-text-secondary)]">
                      {CATEGORY_LABELS[item.category] || item.category}
                    </span>
                  </div>
                </button>

                {/* Assignment tag */}
                <div className="flex shrink-0 items-center gap-1">
                  {item.assignedName || item.assignedToName ? (
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-medium border border-[color:var(--glass-border)] ${
                        isAssignedToMe
                          ? 'bg-[color:var(--lkv-secondary)]/20 text-[color:var(--lkv-primary)] font-semibold'
                          : 'bg-black/5 text-[color:var(--lkv-text-secondary)] dark:bg-white/5'
                      }`}
                    >
                      {item.assignedName || item.assignedToName}
                    </span>
                  ) : onAssignItem && currentUserId ? (
                    <button
                      type="button"
                      onClick={() => onAssignItem(item.id, currentUserId, 'Moi')}
                      className="flex h-[44px] min-h-[44px] items-center text-[10px] text-[color:var(--lkv-action)] hover:underline focus-visible:outline-none"
                    >
                      Prendre
                    </button>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {/* Quick Add Form */}
      {onAddItem && (
        <form onSubmit={handleAdd} className="flex items-center gap-2 pt-1">
          <input
            type="text"
            value={newLabel}
            onChange={(e) => setNewLabel(e.target.value)}
            placeholder="Ajouter un équipement ou une tâche..."
            className="h-[44px] min-h-[44px] flex-1 rounded-xl border border-[color:var(--glass-border)] bg-[color:var(--glass-bg-subtle)] px-3 text-xs text-[color:var(--lkv-text-primary)] placeholder:text-[color:var(--lkv-text-secondary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--lkv-primary)]"
          />
          <select
            value={newCategory}
            onChange={(e) => setNewCategory(e.target.value as ChecklistCategory)}
            aria-label="Catégorie"
            className="h-[44px] min-h-[44px] rounded-xl border border-[color:var(--glass-border)] bg-[color:var(--glass-bg-subtle)] px-2 text-xs text-[color:var(--lkv-text-primary)] focus-visible:outline-none"
          >
            <option value="gear">Matériel</option>
            <option value="safety">Sécurité</option>
            <option value="food">Vivres</option>
            <option value="logistics">Logistique</option>
            <option value="navigation">Navigation</option>
            <option value="camp">Bivouac</option>
            <option value="medical">Médical</option>
            <option value="admin">Administratif</option>
          </select>
          <button
            type="submit"
            className="flex h-[44px] min-h-[44px] items-center justify-center rounded-xl bg-[color:var(--lkv-primary)] px-3 text-xs font-semibold text-white shadow-sm hover:opacity-95 focus-visible:outline-none"
          >
            +
          </button>
        </form>
      )}
    </div>
  );
};
