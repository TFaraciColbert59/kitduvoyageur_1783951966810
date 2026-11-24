'use client';

import React from 'react';
import type { MapCarnet, MapMassif, MapPoi, MapTrack } from '@/features/compte/map/types';
import type {
  ClubMapKitUsage,
  ClubMapLiveMember,
  ClubMapOutingTrack,
  ClubMapPokedexItem,
  ClubMapPostPin,
  ClubRichMapMassifSummary,
} from './clubMapTypes';

type Base = { onOpen: (id: string) => void; onClose: () => void };

export type ClubMapCalloutProps =
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
  | (Base & { kind: 'poi'; data: Pick<MapPoi, 'id' | 'label' | 'outingId'> })
  | (Base & {
      kind: 'rich-outing';
      data: ClubMapOutingTrack;
      onStartDrone?: () => void;
    })
  | (Base & { kind: 'rich-massif'; data: ClubRichMapMassifSummary })
  | (Base & {
      kind: 'country';
      data: { code: string; name: string; outings: number; members: number };
    })
  | (Base & { kind: 'post'; data: ClubMapPostPin })
  | (Base & { kind: 'pokedex'; data: ClubMapPokedexItem })
  | (Base & { kind: 'kit'; data: ClubMapKitUsage })
  | (Base & { kind: 'member'; data: ClubMapLiveMember });

const NUMBER = new Intl.NumberFormat('fr-FR');

function statusLabel(status: ClubMapOutingTrack['status']): string {
  if (status === 'live') return 'En direct';
  if (status === 'upcoming') return 'À venir';
  return 'Effectuée';
}

function meta(props: ClubMapCalloutProps): string {
  switch (props.kind) {
    case 'outing': {
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
    case 'massif':
      return `${props.data.outings} sortie(s)`;
    case 'carnet':
      return 'Carnet lié à une sortie';
    case 'poi':
      return 'Point de la sortie';
    case 'country':
      return `${props.data.outings} sortie(s) · ${props.data.members} membre(s)`;
    case 'rich-massif':
      return `${props.data.outings} sortie(s) · ${props.data.postsCount} récit(s)`;
    case 'rich-outing': {
      const o = props.data;
      return `${o.dateLabel} · ${NUMBER.format(o.km)} km · +${NUMBER.format(o.dplus)} m · ${NUMBER.format(o.maxAlt)} m`;
    }
    case 'post':
      return `${props.data.authorName} · ${props.data.timeAgo} · ${props.data.likes} J'aime`;
    case 'pokedex':
      return `${props.data.latinName ? `${props.data.latinName} · ` : ''}${props.data.outingTitle}`;
    case 'kit':
      return `${(props.data.totalWeightG / 1000).toFixed(1)} kg · ${props.data.itemsCount} objets · ${props.data.season}`;
    case 'member':
      return `@${props.data.handle} · ${props.data.role}${props.data.fuzzy ? ' · Zone ~250 m' : ' · Position live'}`;
  }
}

export function ClubMapCallout(props: ClubMapCalloutProps) {
  const title = (() => {
    switch (props.kind) {
      case 'outing':
      case 'carnet':
      case 'rich-outing':
      case 'kit':
        return props.data.title;
      case 'massif':
      case 'rich-massif':
      case 'country':
      case 'member':
        return props.data.name;
      case 'poi':
        return props.data.label;
      case 'post':
        return props.data.spot || props.data.authorName;
      case 'pokedex':
        return `🐾 ${props.data.commonName}`;
    }
  })();

  const action = (() => {
    switch (props.kind) {
      case 'carnet':
        return 'Ouvrir le carnet';
      case 'massif':
      case 'rich-massif':
        return 'Voir les sorties';
      case 'country':
        return 'Explorer la France';
      case 'post':
        return 'Voir dans le fil';
      case 'pokedex':
        return 'Ouvrir la sortie';
      case 'kit':
        return 'Coffre Kits';
      case 'member':
        return 'Voir dans la cordée';
      default:
        return 'Fiche sortie';
    }
  })();

  const target = (() => {
    switch (props.kind) {
      case 'carnet':
      case 'outing':
      case 'massif':
      case 'rich-outing':
      case 'rich-massif':
      case 'post':
      case 'kit':
      case 'member':
        return props.data.id;
      case 'country':
        return props.data.code;
      case 'poi':
      case 'pokedex':
        return props.data.outingId;
    }
  })();

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
        ×
      </button>
      <b>{title}</b>
      {props.kind === 'outing' && props.data.verified ? (
        <span className="lkdv-map-callout-badge">Trace GPS vérifiée</span>
      ) : null}
      {props.kind === 'rich-outing' ? (
        <span className={`lkdv-map-callout-badge is-${props.data.status}`}>
          {statusLabel(props.data.status)} · {props.data.massif}
        </span>
      ) : null}
      {props.kind === 'pokedex' && props.data.confidence ? (
        <span className="lkdv-map-callout-badge">Confiance {props.data.confidence}</span>
      ) : null}
      <p>
        {date ? `${date} · ` : ''}
        {meta(props)}
      </p>
      {props.kind === 'post' && props.data.caption ? (
        <p className="lkdv-map-callout-snippet">{props.data.caption.slice(0, 88)}</p>
      ) : null}
      <div className="lkdv-map-callout-actions">
        <button
          type="button"
          className="lkdv-map-callout-cta"
          onClick={() => props.onOpen(target)}
        >
          {action}
        </button>
        {props.kind === 'rich-outing' && props.onStartDrone ? (
          <button
            type="button"
            className="lkdv-map-callout-cta is-secondary"
            onClick={props.onStartDrone}
          >
            ▶ Drone 3D
          </button>
        ) : null}
      </div>
    </div>
  );
}

export default ClubMapCallout;
