'use client';

import React from 'react';
import { getIconForCategory, Icon } from './PreparationIcons';

export interface EquipmentGearItemProps {
  label: string;
  why: string;
  priority: string;
  status: 'missing' | 'partial' | 'substitution' | 'ok';
  available: number;
  required: number;
  onAdd: () => void;
  onAddToCart?: () => void;
}

export const EquipmentGearItem: React.FC<EquipmentGearItemProps> = ({
  label,
  why,
  priority,
  status,
  available,
  required,
  onAdd,
  onAddToCart,
}) => {
  const iconName = getIconForCategory(label);
  
  const cls = {
    ok: "state-ok",
    substitution: "state-sub",
    partial: "state-partial",
    missing: "state-missing"
  }[status] || "";

  const gap = required - available;
  const coverage = Math.min(1, Math.max(0, available / required));
  const barPct = Math.round(coverage * 100);
  const showBar = required > 1 || status === 'partial';
  const showQtyRow = showBar || status === 'missing';

  const isEssential = priority === 'vital';

  return (
    <div className={`gear-item ${cls}`} style={{ marginBottom: 8 }}>
      <div className="icon">
        <Icon name={iconName} />
      </div>
      <div className="body">
        <div className="n">
          {label}
          {isEssential && <span className="prio">Essentiel</span>}
        </div>
        <div className="why">{why}</div>
        
        {showQtyRow && (
          <div className="qty">
            <span className="have">
              Possédé <span style={{ fontWeight: 600, color: 'inherit' }}>{available}</span>
            </span>
            <span className="need">/ {required}</span>
            {gap > 0 && <span className="gap">−{gap}</span>}
            {showBar && (
              <span className="qty-bar">
                <span className="fill" style={{ width: `${barPct}%` }}></span>
              </span>
            )}
          </div>
        )}

        <div className="gear-actions">
          {status === 'missing' && (
            <button className="primary" onClick={onAdd}>
              <Icon name="plus" /> J'ai cet équipement
            </button>
          )}
          {status === 'partial' && (
            <button className="primary" onClick={onAdd}>
              <Icon name="plus" /> Compléter
            </button>
          )}
          {onAddToCart && (
            <button className="secondary" onClick={onAddToCart}>
              <Icon name="bag" /> Panier
            </button>
          )}
        </div>
      </div>
      
      <div className="status">
        {status === 'missing' && (
          <span className="pill missing"><Icon name="x" /> Manquant</span>
        )}
        {status === 'partial' && (
          <span className="pill partial"><Icon name="info" /> Insuffisant</span>
        )}
        {status === 'substitution' && (
          <span className="pill sub"><Icon name="swap" /> Équivalent</span>
        )}
        {status === 'ok' && (
          <span className="pill ok"><Icon name="check" /> Dispo</span>
        )}
      </div>
    </div>
  );
};
