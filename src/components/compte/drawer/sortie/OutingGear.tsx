'use client';

import React from 'react';
import { Backpack, PackagePlus, Trash2 } from 'lucide-react';
import type { OutingGearItem, OutingKit } from '@/features/compte/server/sorties';
import { DrawerEmpty } from '../shell/DrawerShell';
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

export function OutingGear({ gear, kit, missingGear, canEdit, busy, onAttach, onRemove }: OutingGearProps) {
  const total = gear.reduce((sum, item) => sum + (item.weightG ?? 0), 0);

  return (
    <div className="lkdv-sortie-pane">
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
              <button type="button" className="lkdv-sortie-btn primary" onClick={onAttach} disabled={busy}>
                <PackagePlus size={15} aria-hidden="true" /> {busy ? 'Ajout…' : 'Rattacher'}
              </button>
            ) : null}
          </div>
        </section>
      ) : null}

      {gear.length === 0 ? (
        <DrawerEmpty
          title="Aucun matériel rattaché"
          hint={
            kit
              ? 'Rattache le kit de cette sortie pour retrouver le poids et les objets réellement portés.'
              : 'Cette sortie n’a pas de kit associé. Tu peux en choisir un depuis l’onglet Matériel de ton profil.'
          }
          action={
            canEdit && kit && kit.items.length > 0 ? (
              <button type="button" className="lkdv-sortie-btn ghost" onClick={onAttach} disabled={busy}>
                <PackagePlus size={15} aria-hidden="true" /> Rattacher {kit.name}
              </button>
            ) : undefined
          }
        />
      ) : (
        <>
          <div className="lkdv-sortie-gear-total">
            <span>{gear.length} objet{gear.length > 1 ? 's' : ''}</span>
            <b>{formatWeight(total)}</b>
          </div>
          {missingGear > 0 ? (
            <p className="lkdv-sortie-missing">
              {missingGear} objet{missingGear > 1 ? 's' : ''} du kit n’étai{missingGear > 1 ? 'ent' : 't'} pas
              dans le sac.
            </p>
          ) : null}
          <ul className="lkdv-sortie-gear">
            {gear.map((item) => (
              <li key={item.id}>
                <span className="lkdv-sortie-gear-ico" aria-hidden="true">
                  <Backpack size={15} />
                </span>
                <span className="lkdv-sortie-gear-name">{item.name}</span>
                <span className="lkdv-sortie-gear-weight">{formatWeight(item.weightG)}</span>
                {canEdit ? (
                  <button
                    type="button"
                    className="lkdv-sortie-gear-remove"
                    onClick={() => onRemove(item.id)}
                    aria-label={`Retirer ${item.name}`}
                    disabled={busy}
                  >
                    <Trash2 size={14} aria-hidden="true" />
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

export default OutingGear;
