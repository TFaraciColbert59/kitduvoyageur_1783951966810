'use client';

import React from 'react';
import Link from 'next/link';
import { formatWeight } from '@/features/carnet/detail/format';
import type { CarnetDetail } from '@/features/carnet/detail/types';
import { LKDVIcon } from '@/components/ui/LKDVIcon';

export interface CarnetKitSectionProps {
  detail: CarnetDetail;
}

/** Matériel : poids réels, aucune ligne inventée, poids absent = aucune valeur. */
export function CarnetKitSection({ detail }: CarnetKitSectionProps) {
  const total = formatWeight(detail.kit.totalWeightG);

  return (
    <section id="ckp-materiel" className="ckp-section" aria-labelledby="ckp-materiel-title">
      <div className="ckp-section-head">
        <h2 className="ckp-h2" id="ckp-materiel-title">
          Matériel
          {total ? <small>Poids total</small> : null}
        </h2>
        {total ? <span className="ckp-kit-total">{total}</span> : null}
        {detail.isOwner ? (
          <Link className="ckp-pill" href="/compas">
            <LKDVIcon name="boussole" size={16} aria-hidden="true" />
            Reconfigurer
          </Link>
        ) : null}
      </div>

      {detail.kit.items.length > 0 ? (
        <div className="ckp-kit-list">
          {detail.kit.items.map((item) => {
            const weight = formatWeight(item.weightG);
            return (
              <div className="ckp-kit-row" key={item.id}>
                <span
                  className="ckp-kit-dot"
                  style={item.color ? { background: item.color } : undefined}
                  aria-hidden="true"
                />
                <span style={{ minWidth: 0, flex: 1 }}>
                  <span className="ckp-kit-name">{item.name}</span>
                  {item.detail ? <span className="ckp-kit-detail">{item.detail}</span> : null}
                </span>
                {weight ? <span className="ckp-kit-weight">{weight}</span> : null}
              </div>
            );
          })}
        </div>
      ) : (
        <div
          className="ckp-empty"
          style={{ marginTop: 10, boxShadow: 'none', background: 'transparent', padding: '18px 0' }}
        >
          <b>Matériel non renseigné.</b>
          <p>
            {detail.isOwner
              ? 'Renseignez le kit emporté pour calculer son poids.'
              : 'L’auteur n’a pas listé son matériel.'}
          </p>
        </div>
      )}
    </section>
  );
}

export default CarnetKitSection;
