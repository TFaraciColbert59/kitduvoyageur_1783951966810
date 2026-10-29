'use client';

import React from 'react';
import Link from 'next/link';
import Icon from '@/components/ui/Icon';
import { formatWeight } from '@/features/carnet/detail/format';
import type { CarnetDetail } from '@/features/carnet/detail/types';
import { groupsOfThree } from '../groups';
import { CarnetEmpty } from '../CarnetStates';

export interface CarnetKitPaneProps {
  detail: CarnetDetail;
}

export function CarnetKitPane({ detail }: CarnetKitPaneProps) {
  const total = formatWeight(detail.kit.totalWeightG);

  if (detail.kit.items.length === 0) {
    return <CarnetEmpty icon={<Icon name="backpack" size={32} aria-hidden="true" />} label="Matériel non renseigné" />;
  }

  return (
    <div className="ckp-pane">
      <div className="ckp-pane-head">
        <b>Matériel</b>
        {total ? <span className="ckp-kit-total">{total}</span> : null}
      </div>

      <div className="ckp-kit-list">
        {groupsOfThree(detail.kit.items).map((group) => (
          <div className="ckp-list-group" key={group[0]?.id ?? 'groupe'}>
            {group.map((item) => {
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
        ))}
      </div>

      {detail.isOwner ? (
        <Link className="ckp-pill" href="/compas">
          <Icon name="compass" size={16} aria-hidden="true" />
          Reconfigurer
        </Link>
      ) : null}
    </div>
  );
}

export default CarnetKitPane;
