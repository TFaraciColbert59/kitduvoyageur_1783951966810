'use client';

import { useState } from 'react';
import { Li } from '@/features/compas/v5/ui/primitives';
import { RouteRow } from '../ui/RouteRow';
import type { DayReading } from '../../../dayReading';
import { fmtDuration, fmtKm, fmtMeters } from '../../../fmt';
import { SUN_METHOD } from '../../../insights/daylight';
import type { CollaborativeStage } from '../../../types';
import { useRouteViewMode } from '../expertMode';
import { Btn, Note, Pill } from '../track/atoms';
import { useRouteWorkspace } from '../WorkspaceContext';

/** Les trois chiffres d'un jour (comme `.v5-stats3` du Compas), l'inconnu dit « inconnu » et jamais 0. */
export function DayStats({ reading }: { reading: DayReading }) {
  const { expert } = useRouteViewMode();
  const d = reading.duration;
  const rest = reading.kind === 'rest';
  return (
    <div className="v5-stats3" data-testid={`day-stats-${reading.stageId}`}>
      <div>
        <b className="v5-num">{rest ? '–' : reading.distanceKm != null ? fmtKm(reading.distanceKm) : '–'}</b>
        <small>{rest ? 'Repos' : reading.distanceKm != null ? 'Distance' : 'Distance inconnue'}</small>
      </div>
      <div>
        <b className="v5-num">{rest ? '–' : reading.ascentM != null ? `+${fmtMeters(reading.ascentM)}` : '–'}</b>
        <small>{rest ? 'Sans tracé' : reading.ascentM != null ? 'Dénivelé positif' : 'D+ inconnu'}</small>
      </div>
      <div>
        <b className="v5-num">{rest ? '0 min' : d.minutes != null ? `${d.lowerBound ? '≥ ' : d.basis === 'naismith' ? '≈ ' : ''}${fmtDuration(d.minutes)}` : '–'}</b>
        <small>{rest ? 'Marche' : d.minutes != null ? 'Marche' : 'Durée inconnue'}</small>
        {expert && !rest ? <span className="rts-method">{d.method}</span> : null}
      </div>
    </div>
  );
}

/** Départ, arrivée estimée et coucher du soleil : l'arrivée passe en orange si elle dépasse le coucher (6.5). */
export function DayArrival({ reading }: { reading: DayReading }) {
  const { expert } = useRouteViewMode();
  if (reading.kind === 'rest') return null;
  const a = reading.arrival;
  const title = a.known ? (
    <span className="rts-arrival" data-late={a.late ? 'true' : 'false'} data-testid={`arrival-${reading.stageId}`}>
      Départ {reading.departureTimeLocal} · arrivée ≈ <b>{a.arrivalLocal}</b>
    </span>
  ) : (
    <span className="rts-arrival" data-late="false">
      Départ {reading.departureTimeLocal} · arrivée inconnue
    </span>
  );
  const detail = a.known
    ? a.sunsetLocal
      ? a.late
        ? `Après le coucher du soleil (${a.sunsetLocal}) de ${Math.abs(a.marginMin ?? 0)} min : prévoyez une lampe ou partez plus tôt.`
        : `Coucher du soleil à ${a.sunsetLocal}, marge de ${fmtDuration(a.marginMin ?? 0)}.`
      : (a.reason ?? undefined)
    : a.reason
      ? `Impossible à dire : ${a.reason}.`
      : undefined;
  return (
    <div className="v5-grp">
      <Li
        icon={a.late ? 'clock' : 'sun'}
        title={title}
        detail={detail}
        right={a.late ? <Pill tone="warn">Après le coucher</Pill> : undefined}
      />
      {expert && a.known ? <p className="rts-note" style={{ padding: '0 14px 8px' }}>{SUN_METHOD}</p> : null}
    </div>
  );
}

/** Date locale du jour, fuseau et changement d'heure (6.8). */
export function DayDate({ reading }: { reading: DayReading }) {
  const { expert } = useRouteViewMode();
  if (!reading.dateLabel) return <Note>Date non renseignée : l’arrivée et le coucher ne peuvent pas être comparés.</Note>;
  return (
    <p className="v5-meta" data-testid={`day-date-${reading.stageId}`}>
      <b>{reading.dateLabel}</b>
      {expert ? ` · ${reading.timezone}` : ''}
      {reading.dstChange ? (
        <>
          {' '}
          <Pill tone="warn">{reading.dstChange === 'back' ? 'Changement d’heure : journée de 25 h' : 'Changement d’heure : journée de 23 h'}</Pill>
        </>
      ) : null}
    </p>
  );
}

/** Eau et ravitaillement du jour, avec la plus longue distance sans eau (6.6). Jamais « eau disponible » sans relevé. */
export function DayWater({ reading }: { reading: DayReading }) {
  const { expert } = useRouteViewMode();
  if (reading.kind === 'rest') return null;
  const w = reading.water;
  const waterTitle =
    w.status === 'known'
      ? `Plus longue distance sans eau : ${fmtKm(w.gapKm ?? 0)}`
      : w.status === 'no_water_data'
        ? 'Aucun point d’eau relevé sur le tracé'
        : 'Eau non évaluée';
  const waterDetail =
    w.status === 'known'
      ? `Entre ${w.fromLabel} (km ${w.fromKm}) et ${w.toLabel} (km ${w.toKm}) · ${w.waterPointCount} point${w.waterPointCount > 1 ? 's' : ''} d’eau relevé${w.waterPointCount > 1 ? 's' : ''}, état et potabilité inconnus`
      : w.status === 'no_water_data'
        ? 'Un point absent des données n’est pas un point sans eau : emportez de quoi couvrir la journée.'
        : 'Relevez les lieux de la journée pour connaître les points d’eau.';
  const s = reading.supplies;
  return (
    <div className="v5-grp" data-testid={`day-water-${reading.stageId}`}>
      <RouteRow icon="drop" title={waterTitle} subtitle={waterDetail} state={w.status === 'known' ? undefined : 'unknown'} value={w.status === 'known' ? fmtKm(w.gapKm ?? 0) : undefined} />
      {expert && w.status === 'known' ? <p className="rts-note" style={{ padding: '0 14px 8px' }}>{w.method}</p> : null}
      <RouteRow
        icon="cart"
        title={s.length > 0 ? `${s.length} commerce${s.length > 1 ? 's' : ''} ou restaurant${s.length > 1 ? 's' : ''} sur l’étape` : 'Pas de ravitaillement relevé'}
        subtitle={s.length > 0 ? s.slice(0, 3).map((x) => `${x.name} (km ${x.alongKm})`).join(' · ') : null}
      />
    </div>
  );
}

/** Repli : la sortie réelle la plus proche (route ou transport), sinon « Repli non évalué » (6.10). */
export function DayBailoutRow({ reading }: { reading: DayReading }) {
  const b = reading.bailout;
  if (reading.kind === 'rest') return null;
  return (
    <div className="v5-grp" data-testid={`day-bailout-${reading.stageId}`}>
      <RouteRow
        icon="shield"
        title={b.status === 'found' ? `Repli : ${b.label}` : 'Repli non évalué'}
        state={b.status === 'found' ? undefined : 'unknown'}
        subtitle={
          b.status === 'found' && b.hit
            ? `${b.hit.candidate.kind === 'transport_stop' ? 'Arrêt de transport' : 'Accès routier'} à ${fmtKm(b.hit.distanceKm)} à vol d’oiseau du tracé, vers le km ${b.hit.alongKm}`
            : b.reason
              ? `Aucun candidat réel : ${b.reason}.`
              : null
        }
      />
    </div>
  );
}

const COMMON_ZONES = ['Europe/Paris', 'Europe/London', 'Europe/Madrid', 'Europe/Rome', 'Europe/Zurich', 'Atlantic/Reykjavik', 'America/New_York', 'America/Vancouver', 'Asia/Tokyo', 'Pacific/Auckland'];

/** Heure de départ, date et fuseau d'une journée (6.5, 6.8). */
export function ScheduleForm({ stage }: { stage: CollaborativeStage }) {
  const { runOperation, canEditStages } = useRouteWorkspace();
  const [time, setTime] = useState(stage.departureTimeLocal);
  const [date, setDate] = useState(stage.dateIso ?? '');
  const [zone, setZone] = useState(stage.timezone);
  const [chain, setChain] = useState(true);
  const { expert } = useRouteViewMode();
  const dirty = time !== stage.departureTimeLocal || (date || null) !== stage.dateIso || zone !== stage.timezone;
  return (
    <form
      className="rts-block"
      data-testid={`schedule-${stage.id}`}
      onSubmit={(e) => {
        e.preventDefault();
        void runOperation(
          {
            type: 'set_stage_schedule',
            stageId: stage.id,
            departureTimeLocal: time,
            dateIso: date || null,
            timezone: zone,
            chainFollowing: Boolean(date) && chain,
          },
          { [stage.id]: stage.entityVersion }
        );
      }}
    >
      <div className="rts-row-form">
        <label className="rts-field">
          Heure de départ
          <input type="time" value={time} onChange={(e) => setTime(e.target.value)} disabled={!canEditStages} />
        </label>
        <label className="rts-field">
          Date du jour
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} disabled={!canEditStages} />
        </label>
      </div>
      {expert ? (
        <label className="rts-field">
          Fuseau du lieu
          <input list="rts-zones" value={zone} onChange={(e) => setZone(e.target.value)} disabled={!canEditStages} />
          <datalist id="rts-zones">
            {COMMON_ZONES.map((z) => (
              <option key={z} value={z} />
            ))}
          </datalist>
        </label>
      ) : null}
      {date ? (
        <label className="rts-toggle">
          <input type="checkbox" checked={chain} onChange={(e) => setChain(e.target.checked)} disabled={!canEditStages} />
          Caler les jours suivants un jour après l’autre
        </label>
      ) : null}
      <Btn type="submit" disabled={!canEditStages || !dirty || !time}>
        Enregistrer l’horaire
      </Btn>
    </form>
  );
}
