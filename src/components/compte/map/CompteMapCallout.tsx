'use client';

import React from 'react';
import type { MapCarnet, MapMassif, MapPoi, MapTrack } from '@/features/compte/map/types';
import { LKDVIcon } from '@/components/ui/LKDVIcon';

type Base = { onOpen: (id: string) => void; onClose: () => void };

type Props =
  | (Base & {
      kind: 'outing';
      data: Pick<
        MapTrack,
        | 'id'
        | 'title'
        | 'startedAt'
        | 'km'
        | 'dplus'
        | 'maxAlt'
        | 'verified'
        | 'photosCount'
        | 'participantsCount'
      >;
    })
  | (Base & { kind: 'massif'; data: Pick<MapMassif, 'id' | 'name' | 'outings' | 'verified'> })
  | (Base & { kind: 'carnet'; data: Pick<MapCarnet, 'id' | 'title' | 'outingId'> })
  | (Base & { kind: 'poi'; data: Pick<MapPoi, 'id' | 'label' | 'outingId'> });

const NUMBER = new Intl.NumberFormat('fr-FR');

function meta(props: Props): string {
  if (props.kind === 'outing') {
    const row = props.data;
    const extras = [
      row.photosCount > 0 ? `${row.photosCount} photo(s)` : '',
      row.participantsCount > 0 ? `${row.participantsCount} compagnon(s)` : '',
    ]
      .filter(Boolean)
      .join(' · ');
    return `${NUMBER.format(row.km)} km · +${NUMBER.format(row.dplus)} m${
      row.maxAlt ? ` · ${NUMBER.format(row.maxAlt)} m` : ''
    }${extras ? ` · ${extras}` : ''}`;
  }
  if (props.kind === 'massif') return `${props.data.outings} sortie(s)`;
  if (props.kind === 'carnet') return 'Carnet lié à une sortie';
  return 'Point de la sortie';
}

export function CompteMapCallout(props: Props) {
  const title =
    props.kind === 'outing'
      ? props.data.title
      : props.kind === 'massif'
        ? props.data.name
        : props.kind === 'carnet'
          ? props.data.title
          : props.data.label;

  const action =
    props.kind === 'carnet'
      ? 'Ouvrir le carnet'
      : props.kind === 'massif'
        ? 'Voir les sorties'
        : 'Voir la sortie';

  const target =
    props.kind === 'carnet'
      ? props.data.id
      : props.kind === 'poi'
        ? props.data.outingId
        : props.data.id;

  const date =
    props.kind === 'outing' && props.data.startedAt
      ? new Date(props.data.startedAt).toLocaleDateString('fr-FR', {
          day: 'numeric',
          month: 'short',
          year: 'numeric',
        })
      : '';

  return (
    <div className="lkdv-map-callout" role="dialog" aria-label={title}>
      <button
        type="button"
        className="lkdv-map-callout-close"
        aria-label="Fermer"
        onClick={props.onClose}
      >
        <LKDVIcon name="fermer" size="1em" className="lkdv-icon-inline" /></button>
      <b>{title}</b>
      {props.kind === 'outing' && props.data.verified ? (
        <span className="lkdv-map-callout-badge">Trace GPS vérifiée</span>
      ) : null}
      <p>
        {date ? `${date} · ` : ''}
        {meta(props)}
      </p>
      <button
        type="button"
        className="lkdv-map-callout-cta"
        onClick={() => props.onOpen(target)}
      >
        {action}
      </button>
    </div>
  );
}

export default CompteMapCallout;
