'use client';

import React, { useMemo, useState } from 'react';
import Icon from '@/components/ui/Icon';
import type { InventoryItem } from './kitCompletion';
import './inventory.css';

export interface InventoryPickerProps {
  items: InventoryItem[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
}

const CONDITION_LABELS: Record<string, string> = {
  neuf: 'Neuf',
  use: 'Usé',
  bon: 'Bon état',
  tres_bon: 'Très bon état',
  moyen: 'État moyen',
  a_remplacer: 'À remplacer',
};

function wearLabel(condition?: string | null) {
  if (!condition) return 'État inconnu';
  return CONDITION_LABELS[condition.toLowerCase()] || condition.replaceAll('_', ' ');
}

export function InventoryPicker({ items, selectedIds, onChange, loading, error, onRetry }: InventoryPickerProps) {
  const [query, setQuery] = useState('');
  const selected = useMemo(() => new Set(selectedIds), [selectedIds]);
  const filtered = useMemo(() => {
    const text = query.trim().toLowerCase();
    return items.filter((item) => !text || item.name.toLowerCase().includes(text) || (item.category || '').toLowerCase().includes(text));
  }, [items, query]);

  const toggle = (id: string) => {
    if (selected.has(id)) onChange(selectedIds.filter((value) => value !== id));
    else onChange([...selectedIds, id]);
  };

  const total = items.filter((item) => selected.has(item.id)).reduce((sum, item) => sum + (item.weightG ?? 0), 0);

  if (loading) {
    return (
      <div className="lkdv-inventory-state" aria-busy="true">
        <span className="lkdv-inventory-spinner" aria-hidden="true" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="lkdv-inventory-state" role="alert">
        <p>{error}</p>
        {onRetry ? <button type="button" className="lkdv-inventory-retry" onClick={onRetry} aria-label="Réessayer">↻</button> : null}
      </div>
    );
  }

  return (
    <div className="lkdv-inventory">
      <div className="lkdv-inventory-search">
        <Icon name="search" size={16} aria-hidden="true" />
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Rechercher dans mon inventaire"
          aria-label="Rechercher dans mon inventaire"
        />
        <span className="lkdv-inventory-total">{selectedIds.length} · {total > 0 ? `${(total / 1000).toFixed(2)} kg` : '0 kg'}</span>
      </div>

      {filtered.length === 0 ? (
        <p className="lkdv-inventory-empty">Aucun produit dans ton inventaire.</p>
      ) : (
        <ul className="lkdv-inventory-list">
          {filtered.map((item) => {
            const isSelected = selected.has(item.id);
            return (
              <li key={item.id}>
                <button
                  type="button"
                  className={`lkdv-inventory-row${isSelected ? ' is-selected' : ''}`}
                  aria-pressed={isSelected}
                  aria-label={`${item.name} — ${wearLabel(item.condition)}`}
                  onClick={() => toggle(item.id)}
                >
                  <span className="lkdv-inventory-photo">
                    {item.photoUrl ? <img src={item.photoUrl} alt="" width={48} height={48} loading="lazy" decoding="async" /> : <Icon name="backpack" size={20} aria-hidden="true" />}
                  </span>
                  <span className="lkdv-inventory-txt">
                    <b>{item.name}</b>
                    <small>{wearLabel(item.condition)}</small>
                  </span>
                  <span className="lkdv-inventory-check" aria-hidden="true">
                    {isSelected ? <Icon name="check" size={16} /> : null}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <p className="lkdv-inventory-count">{selectedIds.length} sélectionné{selectedIds.length > 1 ? 's' : ''}</p>
    </div>
  );
}

export default InventoryPicker;
