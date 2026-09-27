'use client';

import React, { useMemo, useState } from 'react';
import Icon from '@/components/ui/Icon';
import { Button, Chip, SearchField, Switch } from '@/components/ui';
import { A_VERIFIER } from '../engine/trust';
import { GEAR_CATEGORY_LABELS, bookWeightLabel, gearToVerifyCount } from '../engine/labels';
import { buildGearNeeds, gearGaps, packWeight } from '../engine/gear';
import { mealNeeds, uncoveredMeals, waterNeeds } from '../engine/consumables';
import type { AdventurePrepStore } from '../store/useAdventurePrepStore';
import type { AdventurePrepDraft, GearCategory } from '../types';
import { MEAL_SLOT_LABELS } from '../types';

export interface GearSheetProps {
  draft: AdventurePrepDraft;
  actions: AdventurePrepStore;
}

type GearFilter = 'a_verifier' | 'manquant' | 'tout';

const FILTERS: readonly { id: GearFilter; label: string }[] = [
  { id: 'a_verifier', label: 'À vérifier' },
  { id: 'manquant', label: 'Manquant' },
  { id: 'tout', label: 'Tout' },
];

const GEAR_ICONS: Readonly<Record<GearCategory, string>> = {
  shelter: 'tent',
  sleep: 'bed-double',
  cook: 'flame',
  clothing: 'backpack',
  water: 'droplets',
  safety: 'shield',
  navigation: 'compass',
  misc: 'box',
};

/* ------------------------------------------------------------------ */
/* Equipement (A10)                                                    */
/* ------------------------------------------------------------------ */

export function GearSheet({ draft, actions }: GearSheetProps) {
  const [filter, setFilter] = useState<GearFilter>('a_verifier');
  const [query, setQuery] = useState('');
  const [weightDraft, setWeightDraft] = useState<Record<string, string>>({});
  const [assignment, setAssignment] = useState<Record<string, string>>({});

  const gear = useMemo(() => {
    const needs = buildGearNeeds(draft);
    // Les besoins sont recalcules a chaque ouverture : l'inventaire local
    // (poids, responsable, « dans le sac ») est conserve.
    return needs.map((item) => {
      const saved = draft.gear.find((existing) => existing.id === item.id);
      return saved
        ? { ...item, ownerId: saved.ownerId, weightGrams: saved.weightGrams, packed: saved.packed }
        : item;
    });
  }, [draft]);

  const gaps = useMemo(() => gearGaps(gear, draft.packedGearIds), [gear, draft.packedGearIds]);
  const weight = useMemo(() => packWeight(gear), [gear]);
  const toVerify = gearToVerifyCount(gear, draft.packedGearIds);

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return gear.filter((item) => {
      const packed = draft.packedGearIds.includes(item.id);
      if (filter === 'a_verifier' && packed) return false;
      if (filter === 'manquant' && packed) return false;
      if (filter === 'manquant' && item.weightGrams === null && item.ownerId === null) {
        // « Manquant » = aucun poids et aucun responsable :on ne peut pas dire
        // que ce n'est pas possede, on dit qu'on ne sait pas encore.
        return needle.length > 0 || item.vital;
      }
      if (needle && !item.name.toLowerCase().includes(needle)) return false;
      return true;
    });
  }, [gear, filter, query, draft.packedGearIds]);

  const categories = useMemo(
    () => Array.from(new Set(visible.map((item) => item.category))),
    [visible],
  );

  return (
    <div>
      <p className="prep-note" style={{ marginBottom: 14 }}>
        {toVerify} élément(s) à vérifier · {bookWeightLabel(weight)}
        {gaps.length > 0 ? ` · ${gaps.length} élément(s) sans possession connue` : ''}
      </p>

      <div style={{ display: 'grid', gap: 10, marginBottom: 16 }}>
        <div className="prep-cats">
          {FILTERS.map((option) => (
            <Chip key={option.id} selected={filter === option.id} onClick={() => setFilter(option.id)}>
              {option.label}
            </Chip>
          ))}
        </div>
        <SearchField
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Rechercher un élément"
          aria-label="Rechercher un équipement"
          onClear={() => setQuery('')}
        />
      </div>

      {categories.map((category) => (
        <section key={category} style={{ marginBottom: 20 }}>
          <h3 className="prep-section-title" style={{ marginBottom: 8 }}>
            {GEAR_CATEGORY_LABELS[category]}
          </h3>
          <ul className="prep-acts">
            {visible
              .filter((item) => item.category === category)
              .map((item) => {
                const packed = draft.packedGearIds.includes(item.id);
                return (
                  <li key={item.id} className="prep-act" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 10 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <span className="prep-act__icon">
                        <Icon name={GEAR_ICONS[item.category]} size={20} />
                      </span>
                      <span className="prep-act__name">
                        {item.name}
                        {item.quantity > 1 ? ` ×${item.quantity}` : ''}
                      </span>
                      {item.vital && (
                        <span className="prep-act__meta" style={{ color: 'var(--lkv-action)' }}>
                          Indispensable
                        </span>
                      )}
                    </div>

                    <Switch
                      checked={packed}
                      onCheckedChange={(next) => actions.setPacked(item.id, next)}
                      label="Dans le sac"
                    />

                    <div style={{ display: 'grid', gap: 8, gridTemplateColumns: '1fr 1fr' }}>
                      <label style={{ display: 'grid', gap: 4 }}>
                        <span className="prep-block__label">Poids (g)</span>
                        <input
                          type="number"
                          inputMode="numeric"
                          min={0}
                          className="prep-block__row"
                          value={weightDraft[item.id] ?? (item.weightGrams === null ? '' : String(item.weightGrams))}
                          onChange={(event) =>
                            setWeightDraft((current) => ({ ...current, [item.id]: event.target.value }))
                          }
                          onBlur={(event) => {
                            const raw = event.target.value;
                            actions.setGearWeight(
                              item.id,
                              raw.trim() === '' ? null : Number(raw) || null,
                            );
                          }}
                          placeholder={A_VERIFIER}
                        />
                      </label>
                      <label style={{ display: 'grid', gap: 4 }}>
                        <span className="prep-block__label">Responsable</span>
                        <input
                          className="prep-block__row"
                          value={assignment[item.id] ?? item.ownerId ?? ''}
                          onChange={(event) =>
                            setAssignment((current) => ({ ...current, [item.id]: event.target.value }))
                          }
                          onBlur={(event) =>
                            actions.assignGear(item.id, event.target.value.trim() || null)
                          }
                          placeholder="À confirmer"
                        />
                      </label>
                    </div>
                  </li>
                );
              })}
          </ul>
        </section>
      ))}

      {visible.length === 0 && (
        <p className="prep-note" role="status">
          Rien à afficher avec ce filtre.
        </p>
      )}

      <p className="prep-note" style={{ marginTop: 16 }}>
        Possédé ne veut pas dire préparé : la case « Dans le sac » reste à ta main.
      </p>

      <div className="prep-actionrow" style={{ marginTop: 16 }}>
        <Button variant="secondary" size="md" disabled>
          <Icon name="plus" size={18} />
          Ajouter un élément
        </Button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Eau et repas (A10)                                                  */
/* ------------------------------------------------------------------ */

export function ConsumablesSheet({ draft }: GearSheetProps) {
  const water = useMemo(() => waterNeeds(draft.itinerary), [draft.itinerary]);
  const meals = useMemo(() => uncoveredMeals(mealNeeds(draft.itinerary)), [draft.itinerary]);

  return (
    <div>
      <section style={{ marginBottom: 20 }}>
        <h3 className="prep-section-title" style={{ marginBottom: 8 }}>
          Eau
        </h3>
        {water.length === 0 ? (
          <p className="prep-note">Aucun besoin d’eau calculable pour l’instant.</p>
        ) : (
          <ul className="prep-acts">
            {water.map((need) => (
              <li key={need.stepId} className="prep-act" style={{ cursor: 'default' }}>
                <span className="prep-act__icon">
                  <Icon name="droplets" size={20} />
                </span>
                <span className="prep-act__name">
                  {need.litersPerPerson === null
                    ? `${A_VERIFIER} L par personne`
                    : `${need.litersPerPerson} L par personne`}
                </span>
                <span className="prep-act__meta">
                  {need.refillPlaceName ?? 'Point de ravitaillement à vérifier'}
                </span>
              </li>
            ))}
          </ul>
        )}
        <p className="prep-block__hint" style={{ paddingInline: 0, marginTop: 8 }}>
          L’estimation vaut jusqu’au prochain ravitaillement suffisamment fiable. Les
          quantités restent modifiables, et une alternative est proposée quand un point est
          incertain.
        </p>
      </section>

      <section style={{ marginBottom: 20 }}>
        <h3 className="prep-section-title" style={{ marginBottom: 8 }}>
          Repas à prévoir
        </h3>
        {meals.length === 0 ? (
          <p className="prep-note">Tous les repas sont couverts par le programme retenu.</p>
        ) : (
          <ul className="prep-acts">
            {meals.map((need) => (
              <li key={`${need.day}-${need.slot}`} className="prep-act" style={{ cursor: 'default' }}>
                <span className="prep-act__icon">
                  <Icon name="flame" size={20} />
                </span>
                <span className="prep-act__name">
                  Jour {need.day} · {MEAL_SLOT_LABELS[need.slot]}
                </span>
                <span className="prep-act__meta">{need.label}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <p className="prep-note">
        Aucun menu n’est inventé : seules les places non couvertes par une étape de
        restauration retenue sont listées.
      </p>
    </div>
  );
}

function uncoveredMealsInput(draft: AdventurePrepDraft) {
  return draft.itinerary;
}