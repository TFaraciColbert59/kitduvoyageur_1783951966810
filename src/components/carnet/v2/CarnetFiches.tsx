'use client';

import React from 'react';
import {
  Award,
  Bed,
  Clock,
  Flag,
  Mountain,
  Package,
  Route as RouteIcon,
  Scale,
  Cloud,
} from 'lucide-react';
import type {
  CarnetDetail,
  CarnetEtapeDay,
  CarnetKitItemRow,
  CarnetMomentItem,
  CarnetNightItem,
  CarnetParticipant,
} from '@/features/carnet/detail/types';
import { NIGHT_TYPE_LABELS } from '@/features/carnet/detail/editSchemas';
import { CarnetArt } from './CarnetArt';
import { CarnetPostGrid } from './CarnetPostGrid';
import {
  EditPill,
  VerdictTag,
  fmtGrams,
  itemCategory,
  momentsOfParticipant,
  roleLabelFr,
} from './CarnetLenses';

const NB = ' ';

function Row({
  icon,
  title,
  sub,
  value,
}: {
  icon: React.ReactNode;
  title: string;
  sub?: string | null;
  value?: React.ReactNode;
}) {
  return (
    <div className="lkdv-li">
      <span className="ico" aria-hidden="true">
        {icon}
      </span>
      <span className="tt">
        {title}
        {sub ? <small>{sub}</small> : null}
      </span>
      <span className="rt">{value}</span>
    </div>
  );
}

const fmtDate = (iso: string | null | undefined): string | null =>
  iso
    ? new Date(`${iso}T12:00:00Z`).toLocaleDateString('fr-FR', {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
        timeZone: 'UTC',
      })
    : null;

export function EtapeFiche({
  etape,
  canEdit,
  onShowOnMap,
  onEdit,
}: {
  etape: CarnetEtapeDay;
  canEdit: boolean;
  onShowOnMap?: () => void;
  onEdit: () => void;
}) {
  const route = [etape.from, etape.to].filter(Boolean).join(' → ');
  return (
    <div className="lkdv-fiche" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div className="lkdv-fiche-hero">
        <CarnetArt />
        {etape.distanceKm != null ? (
          <span className="ov">{etape.distanceKm.toLocaleString('fr-FR')}{NB}km</span>
        ) : null}
      </div>
      <div className="lkdv-menu2">
        <Row icon={<Flag size={18} />} title="Départ" value={<b>{etape.from ?? '—'}</b>} />
        <Row icon={<Flag size={18} />} title="Arrivée" value={<b>{etape.to ?? '—'}</b>} />
        <Row
          icon={<RouteIcon size={18} />}
          title="Distance"
          sub={`Jour ${etape.dayNumber}`}
          value={<b>{etape.distanceKm != null ? `${etape.distanceKm.toLocaleString('fr-FR')}${NB}km` : '—'}</b>}
        />
        <Row
          icon={<Mountain size={18} />}
          title="Dénivelé positif"
          value={<b>{etape.elevationM != null ? `+${etape.elevationM.toLocaleString('fr-FR')}${NB}m` : '—'}</b>}
        />
        <Row icon={<Clock size={18} />} title="Durée" value={<b>{etape.durationText ?? '—'}</b>} />
        {etape.overnight ? <Row icon={<Bed size={18} />} title="Nuit" value={<b>{etape.overnight}</b>} /> : null}
        {etape.weather ? <Row icon={<Cloud size={18} />} title="Météo" value={<b>{etape.weather}</b>} /> : null}
      </div>
      {etape.note ? (
        <div className="lkdv-note-card">
          <span className="lkdv-h5">Récit de l’étape</span>
          <p>{etape.note}</p>
        </div>
      ) : null}
      {onShowOnMap ? (
        <button type="button" className="lkdv-cta2 ghost" onClick={onShowOnMap} aria-label={`Voir sur la carte : ${route || etape.label}`}>
          Voir sur la carte
        </button>
      ) : null}
      {canEdit ? <EditPill label="Modifier l’étape" onClick={onEdit} /> : null}
    </div>
  );
}

export function NightFiche({
  night,
  date,
  canEdit,
  onShowOnMap,
  onEdit,
}: {
  night: CarnetNightItem;
  date: string | null;
  canEdit: boolean;
  onShowOnMap?: () => void;
  onEdit: () => void;
}) {
  return (
    <div className="lkdv-fiche" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div className="lkdv-fiche-hero">
        <CarnetArt />
        {night.altitudeM != null ? (
          <span className="ov">{night.altitudeM.toLocaleString('fr-FR')}{NB}m</span>
        ) : null}
      </div>
      <div className="lkdv-menu2">
        <Row icon={<Bed size={18} />} title="Type" value={<b>{NIGHT_TYPE_LABELS[night.type]}</b>} />
        <Row
          icon={<Mountain size={18} />}
          title="Altitude"
          value={<b>{night.altitudeM != null ? `${night.altitudeM.toLocaleString('fr-FR')}${NB}m` : '—'}</b>}
        />
        <Row
          icon={<Clock size={18} />}
          title={`Nuit du jour ${night.dayNumber}`}
          sub={night.name}
          value={<b>{fmtDate(date) ?? ''}</b>}
        />
        {night.infos ? <Row icon={<Flag size={18} />} title="Infos" sub={night.infos} /> : null}
      </div>
      {onShowOnMap ? (
        <button type="button" className="lkdv-cta2 ghost" onClick={onShowOnMap}>
          Voir sur la carte
        </button>
      ) : null}
      {canEdit ? <EditPill label="Modifier la nuit" onClick={onEdit} /> : null}
    </div>
  );
}

export function ItemFiche({
  item,
  days,
  canEdit,
  onEdit,
}: {
  item: CarnetKitItemRow;
  days: number[];
  canEdit: boolean;
  onEdit: () => void;
}) {
  return (
    <div className="lkdv-fiche" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div
        className="lkdv-fiche-hero"
        style={{ display: 'grid', placeItems: 'center', background: 'linear-gradient(160deg, var(--mint), var(--soft))' }}
      >
        <span className="lkdv-pic" style={{ width: 64, height: 64, borderRadius: 20, background: 'rgba(255,255,255,.7)' }} aria-hidden="true">
          <Package size={36} />
        </span>
      </div>
      <div className="lkdv-menu2">
        <Row icon={<Scale size={18} />} title="Poids" value={<b>{fmtGrams(item.weightG)}</b>} />
        <Row icon={<Award size={18} />} title="Verdict" value={<VerdictTag verdict={item.verdict} />} />
        <Row
          icon={<Clock size={18} />}
          title="Utilisé"
          value={
            days.length > 0 ? (
              <span style={{ display: 'flex', gap: 4 }}>
                {days.map((d) => (
                  <span key={d} className="lkdv-dtag">
                    J{d}
                  </span>
                ))}
              </span>
            ) : (
              <b>—</b>
            )
          }
        />
      </div>
      {item.verdictNote ? (
        <div className="lkdv-note-card">
          <span className="lkdv-h5">Note</span>
          <p>{item.verdictNote}</p>
        </div>
      ) : null}
      {item.detail && itemCategory(item) !== item.detail ? <p className="lkdv-mute">{item.detail}</p> : null}
      {canEdit ? <EditPill label="Modifier l’objet" onClick={onEdit} /> : null}
    </div>
  );
}

export function ParticipantFiche({
  detail,
  participant,
  canEdit,
  pinnedIds,
  onSelectMoment,
  onEdit,
}: {
  detail: CarnetDetail;
  participant: CarnetParticipant;
  canEdit: boolean;
  pinnedIds?: ReadonlySet<string>;
  onSelectMoment: (moment: CarnetMomentItem, index: number) => void;
  onEdit: () => void;
}) {
  const name = participant.name || participant.handle || 'Voyageur';
  const mine = detail.moments.filter(
    (m) => m.authorId === participant.userId || (!m.authorId && m.authorName === participant.name)
  );
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div className="lkdv-crew" style={{ cursor: 'default' }}>
        {participant.avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img className="lkdv-av" style={{ width: 48, height: 48 }} src={participant.avatarUrl} alt="" />
        ) : (
          <span className="lkdv-av" style={{ width: 48, height: 48, fontSize: 19 }} aria-hidden="true">
            {(name[0] ?? '·').toUpperCase()}
          </span>
        )}
        <div className="t">
          <b>{name}</b>
          <span className="lkdv-mute">{roleLabelFr(participant.role)}</span>
        </div>
        <div style={{ textAlign: 'right' }}>
          <b className="lkdv-mono" style={{ fontSize: 18 }}>
            {momentsOfParticipant(detail, participant)}
          </b>
          <div className="lkdv-mute" style={{ fontSize: 10.5 }}>
            moments
          </div>
        </div>
      </div>
      <h3 className="lkdv-h5">Ses moments</h3>
      <CarnetPostGrid
        moments={mine}
        onSelect={onSelectMoment}
        emptyLabel="Ce voyageur n’a pas encore partagé de moment."
        pinnedIds={pinnedIds}
      />
      {canEdit ? <EditPill label="Modifier le voyageur" onClick={onEdit} /> : null}
    </div>
  );
}
