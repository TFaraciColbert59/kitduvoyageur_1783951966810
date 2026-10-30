'use client';

import React, { useMemo, useState } from 'react';
import { Backpack, PackagePlus, Trash2 } from 'lucide-react';
import { ActionPill } from '@/components/ui/ActionPill';
import type { OutingGearItem, OutingKit } from '@/features/compte/server/sorties';
import { DrawerEmpty } from '../shell/DrawerShell';
import { generatedProductImage } from '../cards/productImage';
import { formatWeight } from './shared';

export interface OutingGearProps {
  gear: OutingGearItem[];
  kit: OutingKit | null;
  missingGear: number;
  canEdit: boolean;
  busy: boolean;
  onAttach: () => void;
  onRemove: (gearId: string) => void;
}

const WEAR_BY_CONDITION: Record<string, number> = {
  neuf: 0,
  bon: 22,
  use: 55,
  a_remplacer: 82,
  pour_pieces: 100,
};

function wearOf(condition: string | null | undefined): number | null {
  if (!condition) return null;
  return WEAR_BY_CONDITION[condition] ?? null;
}

function statusOf(item: OutingGearItem): string | null {
  if (item.isLent) return 'En prêt';
  if (item.listingMode === 'pret' || item.inventoryStatus === 'en_pret') return 'Prêté';
  if (item.listingMode === 'location' || item.inventoryStatus === 'a_louer' || item.inventoryStatus === 'en_location') {
    return 'À louer';
  }
  if (item.listingMode === 'vente' || item.inventoryStatus === 'a_vendre' || item.inventoryStatus === 'vendu') {
    return 'À vendre';
  }
  return null;
}

function categoryOf(item: OutingGearItem): string {
  const category = item.category?.trim();
  return category || 'Autres';
}

export function OutingGear({ gear, kit, missingGear, canEdit, busy, onAttach, onRemove }: OutingGearProps) {
  const total = gear.reduce((sum, item) => sum + (item.weightG ?? 0), 0);
  const categories = useMemo(() => {
    const values = Array.from(new Set(gear.map(categoryOf))).sort((a, b) => a.localeCompare(b, 'fr'));
    return ['Tout', ...values];
  }, [gear]);
  const [category, setCategory] = useState('Tout');
  const visible = category === 'Tout' ? gear : gear.filter((item) => categoryOf(item) === category);

  return (
    <div className="lkdv-sortie-pane lkdv-sortie-gear-pane">
      {kit ? (
        <section className="lkdv-sortie-section">
          <header>
            <b>Kit utilisé</b>
            <span>{kit.name}</span>
          </header>
          <div className="lkdv-sortie-kit">
            <span className="lkdv-sortie-kit-ico" aria-hidden="true">
              <Backpack size={20} />
            </span>
            <div>
              <b>{kit.name}</b>
              <small>
                {kit.items.length} objet{kit.items.length > 1 ? 's' : ''} ·{' '}
                {formatWeight(kit.totalWeightG ?? total)}
              </small>
            </div>
            {canEdit && gear.length === 0 && kit.items.length > 0 ? (
              <ActionPill tone="primary" label={`Rattacher ${kit.name}`} icon={<PackagePlus />} busy={busy} onClick={onAttach} />
            ) : null}
          </div>
        </section>
      ) : null}

      {gear.length === 0 ? (
        <DrawerEmpty
          title="Aucun matériel rattaché"
          hint={kit ? undefined : 'Pas de kit associé.'}
        />
      ) : (
        <>
          <div className="lkdv-sortie-gear-total">
            <span>
              {gear.length} objet{gear.length > 1 ? 's' : ''}
              {missingGear > 0 ? ` · ${missingGear} manquant${missingGear > 1 ? 's' : ''}` : ''}
            </span>
            <b>{formatWeight(total)}</b>
          </div>

          <div className="lkdv-sortie-product-grid">
            {visible.map((item) => {
              const wear = wearOf(item.condition);
              const status = statusOf(item);
              const image = item.photoUrl || generatedProductImage(item.name, 240);
              return (
                <article className="lkdv-sortie-product" key={item.id} data-product-id={item.id}>
                  <div className="lkdv-sortie-product-visual">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={image} alt="" loading="lazy" decoding="async" />
                    {status ? <span className="lkdv-sortie-product-status">{status}</span> : null}
                  </div>
                  <div className="lkdv-sortie-product-body">
                    <b title={item.name}>{item.name}</b>
                    <small>{formatWeight(item.weightG)}</small>
                    {wear !== null ? (
                      <div
                        className="lkdv-sortie-product-wear"
                        role="progressbar"
                        aria-label={`Usure de ${item.name}`}
                        aria-valuemin={0}
                        aria-valuemax={100}
                        aria-valuenow={wear}
                      >
                        <span>usure</span>
                        <i>
                          <u style={{ width: `${wear}%` }} />
                        </i>
                      </div>
                    ) : null}
                  </div>
                  {canEdit ? (
                    <button
                      type="button"
                      className="lkdv-sortie-gear-remove"
                      onClick={() => onRemove(item.id)}
                      aria-label={`Retirer ${item.name}`}
                      disabled={busy}
                    >
                      <Trash2 size={13} aria-hidden="true" />
                    </button>
                  ) : null}
                </article>
              );
            })}
          </div>

          <nav className="lkdv-sortie-category-bar" aria-label="Catégories de matériel">
            {categories.map((entry) => (
              <button
                key={entry}
                type="button"
                aria-pressed={category === entry}
                className={category === entry ? 'on' : ''}
                onClick={() => setCategory(entry)}
              >
                {entry}
              </button>
            ))}
          </nav>
        </>
      )}
    </div>
  );
}

export default OutingGear;
