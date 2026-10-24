'use client';

import React from 'react';
import Icon from '@/components/ui/Icon';
import type { CarnetDetail } from '@/features/carnet/detail/types';

export interface CarnetRecitPaneProps {
  detail: CarnetDetail;
}

export function CarnetRecitPane({ detail }: CarnetRecitPaneProps) {
  return (
    <div className="ckp-pane">
      <div className="ckp-pane-head">
        <b>{detail.title}</b>
        <small>{[detail.destination, detail.dateRange].filter(Boolean).join(' · ')}</small>
      </div>

      {detail.description ? <p className="ckp-text">{detail.description}</p> : (
        <p className="ckp-pane-empty">Aucun récit pour l’instant.</p>
      )}

      <div className="ckp-pane-meta">
        {detail.author ? (
          <span>
            <Icon name="user" size={13} aria-hidden="true" /> {detail.author.name}
            {detail.verified ? ' · Vérifié' : ''}
          </span>
        ) : null}
        <span>
          <Icon name="route" size={13} aria-hidden="true" /> {detail.days.length} étape
          {detail.days.length > 1 ? 's' : ''}
        </span>
        <span>
          <Icon name="image-plus" size={13} aria-hidden="true" /> {detail.photoMoments.length} moment
          {detail.photoMoments.length > 1 ? 's' : ''}
        </span>
      </div>
    </div>
  );
}

export default CarnetRecitPane;
