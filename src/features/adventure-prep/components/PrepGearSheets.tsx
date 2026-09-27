'use client';

import React, { useMemo, useState } from 'react';
import Icon from '@/components/ui/Icon';
import { Button, SearchField, Switch } from '@/components/ui';
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
  sleep: 'bed',
  cook: 'flame',
  clothing: 'backpack',
  water: 'droplet',
  safety: 'shield',
  navigation: 'compass',
  misc: 'box',
};

type GearState = 'owned' | 'missing' | 'check' | 'shared-pending';

function getGearState(item: import('../types').GearNeed, headcount: number): GearState {
  if (item.weightGrams !== null && item.ownerId !== null) return 'owned';
  if (item.weightGrams === null && item.ownerId === null) {
    return headcount > 1 && item.quantity < headcount ? 'shared-pending' : 'check';
  }
  return 'missing';
}

function GearBadge({ state }: { state: GearState }) {
  switch (state) {
    case 'missing':
      return <span style={{ display: 'inline-flex', alignItems: 'center', padding: '2px 8px', borderRadius: 'var(--lkv-radius-sm)', fontSize: '13px', fontWeight: 600, backgroundColor: 'var(--red-bg)', color: 'var(--red-ink)' }}>Manquant</span>;
    case 'check':
      return <span style={{ display: 'inline-flex', alignItems: 'center', padding: '2px 8px', borderRadius: 'var(--lkv-radius-sm)', fontSize: '13px', fontWeight: 600, backgroundColor: 'var(--amber-bg)', color: 'var(--amber-ink)' }}>À confirmer</span>;
    case 'shared-pending':
      return <span style={{ display: 'inline-flex', alignItems: 'center', padding: '2px 8px', borderRadius: 'var(--lkv-radius-sm)', fontSize: '13px', fontWeight: 600, backgroundColor: 'var(--amber-bg)', color: 'var(--amber-ink)' }}>Partagé · à confirmer</span>;
    default:
      return null;
  }
}

export function GearSheet({ draft, actions }: GearSheetProps) {
  const [filter, setFilter] = useState<GearFilter>('a_verifier');
  const [query, setQuery] = useState('');
  
  const gear = useMemo(() => {
    const needs = buildGearNeeds(draft);
    return needs.map((item) => {
      const saved = draft.gear.find((existing) => existing.id === item.id);
      return saved
        ? { ...item, ownerId: saved.ownerId, weightGrams: saved.weightGrams, packed: saved.packed }
        : item;
    });
  }, [draft]);

  const headcount = draft.group.adults + draft.group.children;

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return gear.filter((item) => {
      const st = getGearState(item, headcount);
      const isMissing = st === 'missing';
      const packed = draft.packedGearIds.includes(item.id);
      
      if (filter === 'a_verifier' && packed) return false;
      if (filter === 'manquant' && !isMissing) return false;
      if (needle && !item.name.toLowerCase().includes(needle)) return false;
      return true;
    });
  }, [gear, filter, query, draft.packedGearIds, headcount]);

  const categories = useMemo(
    () => Array.from(new Set(visible.map((item) => item.category))),
    [visible],
  );

  return (
    <div>
      <div style={{ display: 'flex', gap: 2, padding: 3, borderRadius: 14, backgroundColor: 'var(--surface-2)', marginBottom: 16 }}>
        {FILTERS.map((option) => (
          <button 
            key={option.id} 
            type="button"
            aria-pressed={filter === option.id}
            onClick={() => setFilter(option.id)}
            style={{ 
              flex: 1, minHeight: 40, borderRadius: 11, fontSize: 'var(--f-sec)', fontWeight: filter === option.id ? 700 : 500, 
              color: filter === option.id ? 'var(--ink)' : 'var(--ink-2)', 
              backgroundColor: filter === option.id ? 'var(--surface)' : 'transparent', 
              boxShadow: filter === option.id ? '0 1px 3px var(--line)' : 'none',
              border: 'none', cursor: 'pointer'
            }}
          >
            {option.label}
          </button>
        ))}
      </div>

      {categories.map((category) => (
        <section key={category} style={{ marginBottom: 20 }}>
          <h3 style={{ fontSize: 'var(--f-body)', fontWeight: 700, marginBottom: 8, color: 'var(--lkv-text-primary)' }}>
            {GEAR_CATEGORY_LABELS[category]}
          </h3>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
            {visible
              .filter((item) => item.category === category)
              .map((item) => {
                const packed = draft.packedGearIds.includes(item.id);
                const itemState = getGearState(item, headcount);
                
                return (
                  <li key={item.id} style={{ 
                    display: 'flex', flexDirection: 'column', gap: 10, padding: 12, 
                    backgroundColor: 'var(--surface)', border: '1px solid var(--line)', 
                    borderRadius: 'var(--r-block)', boxShadow: 'var(--sh-1)' 
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 'var(--f-body)', fontWeight: 700, color: 'var(--lkv-text-primary)' }}>
                          {item.name}
                        </div>
                        <div style={{ fontSize: 'var(--f-sec)', color: 'var(--lkv-text-secondary)', marginTop: 2 }}>
                          {item.quantity} × {item.ownerId ?? 'Non attribué'}
                        </div>
                        <div style={{ fontSize: 'var(--f-sec)', color: item.weightGrams === null ? 'var(--ink-3)' : 'var(--lkv-text-secondary)', marginTop: 2 }}>
                          {item.weightGrams === null ? 'Poids inconnu' : `${item.weightGrams} g`}
                        </div>
                      </div>
                      <GearBadge state={itemState} />
                    </div>
                    
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 4 }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', flex: 1 }}>
                        <div style={{ 
                          width: 26, height: 26, borderRadius: 8, border: '2px solid var(--line-ui)', 
                          backgroundColor: packed ? 'var(--green)' : 'var(--surface)', borderColor: packed ? 'var(--green)' : 'var(--line-ui)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center'
                        }}>
                          {packed && <Icon name="check" size={16} style={{ color: 'var(--btn-on-solid)' }} />}
                        </div>
                        <span style={{ fontSize: 'var(--f-body)', fontWeight: 500, color: 'var(--lkv-text-primary)' }}>Dans le sac</span>
                        <input 
                          type="checkbox" 
                          checked={packed} 
                          onChange={(e) => actions.setPacked(item.id, e.target.checked)} 
                          style={{ position: 'absolute', opacity: 0, width: 0, height: 0 }}
                          aria-label={`Dans le sac pour ${item.name}`}
                        />
                      </label>
                    </div>
                  </li>
                );
              })}
          </ul>
          
          <button style={{ 
            marginTop: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, 
            width: '100%', minHeight: 52, borderRadius: 16, backgroundColor: 'var(--surface)', 
            border: '1px solid var(--line-ui)', color: 'var(--ink)', fontSize: 'var(--f-body)', fontWeight: 600, cursor: 'pointer' 
          }}>
            <Icon name="plus" size={20} />
            Ajouter un élément
          </button>
        </section>
      ))}

      {visible.length === 0 && (
        <p style={{ fontSize: 'var(--f-sec)', color: 'var(--ink-2)' }} role="status">
          Rien à afficher avec ce filtre.
        </p>
      )}
    </div>
  );
}

export function ConsumablesSheet({ draft }: GearSheetProps) {
  const water = useMemo(() => waterNeeds(draft.itinerary), [draft.itinerary]);
  const meals = useMemo(() => uncoveredMeals(mealNeeds(draft.itinerary)), [draft.itinerary]);

  return (
    <div>
      <section style={{ marginBottom: 20 }}>
        <h3 style={{ fontSize: 'var(--f-body)', fontWeight: 700, marginBottom: 8, color: 'var(--lkv-text-primary)' }}>Eau</h3>
        {water.length === 0 ? (
          <p style={{ fontSize: 'var(--f-sec)', color: 'var(--ink-2)' }}>Aucun besoin d’eau calculable pour l’instant.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {water.map((need) => (
              <div key={need.stepId} style={{ 
                padding: 12, backgroundColor: 'var(--surface)', border: '1px solid var(--line)', 
                borderRadius: 'var(--r-block)', boxShadow: 'var(--sh-1)' 
              }}>
                <div style={{ fontSize: 'var(--f-body)', fontWeight: 700, color: 'var(--lkv-text-primary)' }}>
                  {need.litersPerPerson === null ? `${A_VERIFIER} L/pers.` : `${need.litersPerPerson} L/pers.`}
                </div>
                <div style={{ fontSize: 'var(--f-sec)', color: 'var(--lkv-text-secondary)', marginTop: 2 }}>
                  Jusqu'à : {need.refillPlaceName ?? 'Point de ravitaillement à vérifier'}
                </div>
                <div style={{ marginTop: 8, display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 8px', borderRadius: 8, fontSize: 13, fontWeight: 600, backgroundColor: need.confidence === 'fiable' ? 'var(--green-tint)' : 'var(--amber-bg)', color: need.confidence === 'fiable' ? 'var(--green-ink)' : 'var(--amber-ink)' }}>
                  {need.confidence === 'fiable' ? <Icon name="check" size={14} /> : <Icon name="alert-triangle" size={14} />}
                  {need.confidence === 'fiable' ? 'Fiable' : 'Incertaine'}
                </div>
                {need.alternativePlaceName && (
                  <div style={{ marginTop: 8, padding: 10, backgroundColor: 'var(--blue-bg)', color: 'var(--blue-ink)', borderRadius: 14, fontSize: 'var(--f-sec)' }}>
                    <b>Alternative :</b> {need.alternativePlaceName}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      <section style={{ marginBottom: 20 }}>
        <h3 style={{ fontSize: 'var(--f-body)', fontWeight: 700, marginBottom: 8, color: 'var(--lkv-text-primary)' }}>Repas à prévoir</h3>
        {meals.length === 0 ? (
          <p style={{ fontSize: 'var(--f-sec)', color: 'var(--ink-2)' }}>Tous les repas sont couverts par le programme retenu.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {meals.map((need) => (
              <div key={`${need.day}-${need.slot}`} style={{ 
                display: 'flex', alignItems: 'center', gap: 12, padding: 12, 
                backgroundColor: 'var(--surface)', border: '1px solid var(--line)', 
                borderRadius: 'var(--r-block)', boxShadow: 'var(--sh-1)' 
              }}>
                <Icon name="flame" size={24} style={{ color: 'var(--amber-ink)' }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 'var(--f-body)', fontWeight: 700, color: 'var(--lkv-text-primary)' }}>
                    Jour {need.day} · {MEAL_SLOT_LABELS[need.slot]}
                  </div>
                  <div style={{ fontSize: 'var(--f-sec)', color: 'var(--lkv-text-secondary)', marginTop: 2 }}>
                    À prévoir
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

export function ParticipantsSheet({ draft }: GearSheetProps) {
  const members = draft.group.knownMembers;
  
  return (
    <div>
      <section style={{ marginBottom: 20 }}>
        <h3 style={{ fontSize: 'var(--f-body)', fontWeight: 700, marginBottom: 8, color: 'var(--lkv-text-primary)' }}>Membres confirmés</h3>
        {members.length === 0 ? (
          <p style={{ fontSize: 'var(--f-sec)', color: 'var(--ink-2)' }}>Aucun membre confirmé pour l'instant.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {members.map(member => (
              <div key={member} style={{ 
                display: 'flex', alignItems: 'center', gap: 12, padding: 12, 
                backgroundColor: 'var(--surface)', border: '1px solid var(--line)', 
                borderRadius: 'var(--r-block)', boxShadow: 'var(--sh-1)' 
              }}>
                <div style={{
                  width: 40, height: 40, borderRadius: '50%', backgroundColor: 'var(--green-tint)', 
                  display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, fontWeight: 700, color: 'var(--green-ink)'
                }}>
                  {member.charAt(0).toUpperCase()}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 'var(--f-body)', fontWeight: 700, color: 'var(--lkv-text-primary)' }}>{member}</div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
                   <span style={{ fontSize: 'var(--f-sec)', color: 'var(--lkv-text-secondary)' }}>Peut proposer des étapes</span>
                   <Switch checked={true} onCheckedChange={() => {}} aria-label="Droits" />
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
      
      <div style={{ display: 'flex', gap: 8, marginTop: 24 }}>
        <button style={{ 
          flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, 
          minHeight: 52, borderRadius: 16, backgroundColor: 'var(--green)', 
          color: 'var(--surface)', fontSize: 'var(--f-body)', fontWeight: 600, cursor: 'pointer', border: 'none'
        }}>
          Inviter quelqu'un
        </button>
        <button style={{ 
          flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, 
          minHeight: 52, borderRadius: 16, backgroundColor: 'var(--surface)', 
          border: '1px solid var(--line-ui)', color: 'var(--ink)', fontSize: 'var(--f-body)', fontWeight: 600, cursor: 'pointer' 
        }}>
          Copier le lien
        </button>
      </div>
    </div>
  );
}