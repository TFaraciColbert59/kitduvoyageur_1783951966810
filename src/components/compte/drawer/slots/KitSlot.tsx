'use client';

import React from 'react';
import { KitCard, KIT_CARD_CSS, type KitEntry } from '../cards/KitCard';
import {
  GearRow,
  GEAR_ROW_CSS,
  gearCategory,
  type GearEntry,
} from '../cards/GearRow';

export type KitLens = 'kits' | 'inventory';
export type KitViewer = 'owner' | 'visitor';

export interface KitSlotProps {
  /** Lentille du slot Kit : Kits ou Inventaire. */
  lens?: KitLens | string;
  /** Payload du bootstrap (`{ kits, gearItems, viewer… }`). */
  payload?: unknown;
  /** Raccourci de test/usage direct, prioritaire sur le payload. */
  kits?: KitEntry[];
  gearItems?: GearEntry[];
  /** Propriétaire ou visiteur ; sinon déduit du payload. */
  viewer?: KitViewer;
  [key: string]: unknown;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === 'object'
    ? (value as Record<string, unknown>)
    : {};
}

function readRows<T>(record: Record<string, unknown>, key: string): T[] {
  const value = record[key];
  return Array.isArray(value) ? (value as T[]) : [];
}

function resolveViewer(
  explicit: KitViewer | undefined,
  payload: Record<string, unknown>
): KitViewer {
  if (explicit === 'owner' || explicit === 'visitor') return explicit;
  if (payload.viewer === 'visitor') return 'visitor';
  const profile = asRecord(payload.profile);
  if (profile.viewer === 'visitor') return 'visitor';
  return 'owner';
}

/** Sections par catégorie, dans l'ordre réel de l'inventaire. */
function groupGear(items: GearEntry[]): Array<[string, GearEntry[]]> {
  const groups = new Map<string, GearEntry[]>();
  for (const item of items) {
    const category = gearCategory(item);
    const group = groups.get(category);
    if (group) group.push(item);
    else groups.set(category, [item]);
  }
  return [...groups.entries()];
}

function gearKey(item: GearEntry, index: number): string {
  return (
    (typeof item.realId === 'string' && item.realId) ||
    (typeof item.id === 'string' && item.id) ||
    `gear-${index}`
  );
}

/**
 * Slot Kit du drawer Profil (`lens: 'kits' | 'inventory'`).
 *
 * - Kits : une `KitCard` par kit, avec image produit systématique et les
 *   actions kit existantes (fork, partage, fiche/référencement, royalties,
 *   historique, découverte).
 * - Inventaire : une `GearRow` par objet, sections par catégorie, image
 *   produit 44 px ; le visiteur ne voit ni prix ni prêt.
 *
 * Aucune donnée n'est inventée : tout vient des props ou du payload du
 * bootstrap ; un tableau vide donne l'état vide explicite du plan.
 */
export function KitSlot({
  lens = 'kits',
  payload,
  kits,
  gearItems,
  viewer,
}: KitSlotProps) {
  const inventoryLens = lens === 'inventory';
  const records = asRecord(payload);
  const kitList = Array.isArray(kits) ? kits : readRows<KitEntry>(records, 'kits');
  const gearList = Array.isArray(gearItems)
    ? gearItems
    : readRows<GearEntry>(records, 'gearItems');
  const resolvedViewer = resolveViewer(viewer, records);
  const empty = inventoryLens ? gearList.length === 0 : kitList.length === 0;

  return (
    <div
      className="lkdv-kit-slot"
      data-testid="slot-content"
      data-slot="kit"
      data-lens={inventoryLens ? 'inventory' : 'kits'}
      data-viewer={resolvedViewer}
      data-state={empty ? 'empty' : 'ready'}
    >
      <style
        dangerouslySetInnerHTML={{ __html: KIT_SLOT_CSS + KIT_CARD_CSS + GEAR_ROW_CSS }}
      />

      {inventoryLens ? (
        gearList.length === 0 ? (
          <div className="lkdv-slot-state" data-state="empty">
            <span className="lkdv-slot-state-ico" aria-hidden="true">
              ○
            </span>
            <p>Aucun matériel enregistré.</p>
          </div>
        ) : (
          <div className="lkdv-gear-groups">
            {groupGear(gearList).map(([category, items]) => (
              <section
                key={category}
                className="lkdv-gear-group"
                aria-label={`Inventaire — ${category}`}
              >
                <h3 className="lkdv-gear-cat">{category}</h3>
                <ul className="lkdv-gear-list" aria-label={`Matériel ${category}`}>
                  {items.map((item, index) => (
                    <GearRow
                      key={gearKey(item, index)}
                      item={item}
                      viewer={resolvedViewer}
                    />
                  ))}
                </ul>
              </section>
            ))}
          </div>
        )
      ) : kitList.length === 0 ? (
        <div className="lkdv-slot-state" data-state="empty">
          <span className="lkdv-slot-state-ico" aria-hidden="true">
            ○
          </span>
          <p>Aucun kit enregistré.</p>
        </div>
      ) : (
        <ul className="lkdv-kit-list" aria-label="Kits enregistrés">
          {kitList.map((kit, index) => {
            const key =
              (typeof kit.realId === 'string' && kit.realId) ||
              (typeof kit.id === 'string' && kit.id) ||
              `kit-${index}`;
            return (
              <li key={key} className="lkdv-kit-list-item">
                <KitCard kit={kit} />
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

export const KIT_SLOT_CSS = `
.lkdv-kit-slot{display:flex!important;flex-direction:column!important;gap:8px!important;width:100%!important;min-width:0!important;box-sizing:border-box!important;}
.lkdv-kit-list{list-style:none!important;margin:0!important;padding:0!important;display:flex!important;flex-direction:column!important;gap:8px!important;width:100%!important;min-width:0!important;}
.lkdv-kit-list-item{min-width:0!important;margin:0!important;padding:0!important;}
`;

export default KitSlot;
