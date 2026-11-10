'use client';

import React, { useState } from 'react';
import { OverlaySheet } from '@/components/compte/overlay/OverlaySheet';
import type {
  CarnetDetail,
  CarnetEtapeDay,
  CarnetMomentItem,
  CarnetNightItem,
  CarnetParticipant,
} from '@/features/carnet/detail/types';
import {
  EDITABLE_VERDICTS,
  NIGHT_TYPES,
  NIGHT_TYPE_LABELS,
  TRAVELER_ROLES,
  TRAVELER_ROLE_LABELS,
  VERDICT_LABELS,
  type EditableVerdict,
  type TravelerRole,
} from '@/features/carnet/detail/editSchemas';
import type { EditResult, useCarnetStructureEdits } from '@/features/carnet/detail/useCarnetStructureEdits';

/** Ce que la feuille d'édition sait modifier ; `null` côté donnée = création. */
export type CarnetEditTarget =
  | { kind: 'etape'; etape: CarnetEtapeDay | null; day: number }
  | { kind: 'nuit'; night: CarnetNightItem | null; day: number }
  | { kind: 'verdict'; itemId: string | null }
  | { kind: 'voyageur'; participant: CarnetParticipant | null }
  | { kind: 'moment'; moment: CarnetMomentItem };

type Edits = ReturnType<typeof useCarnetStructureEdits>;

export interface CarnetEditSheetProps {
  target: CarnetEditTarget;
  detail: CarnetDetail;
  edits: Edits;
  /** Seul l'auteur invite, change le rôle ou retire un voyageur (politique de la base). */
  canManageTravelers: boolean;
  onMomentRemoved: (momentId: string) => void;
  onClose: () => void;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="lkdv-overlay-field">
      <span>{label}</span>
      {children}
    </label>
  );
}

function titleOf(target: CarnetEditTarget): string {
  switch (target.kind) {
    case 'etape':
      return target.etape ? 'Modifier l’étape' : 'Ajouter une étape';
    case 'nuit':
      return target.night ? 'Modifier la nuit' : 'Ajouter une nuit';
    case 'verdict':
      return target.itemId ? 'Modifier le verdict' : 'Ajouter un verdict';
    case 'voyageur':
      return target.participant ? 'Modifier le voyageur' : 'Inviter un voyageur';
    case 'moment':
      return 'Modifier le moment';
  }
}

/**
 * Feuille d'édition du mode modification : étape, nuit, verdict, voyageur,
 * texte d'un moment. Chaque enregistrement passe par une Server Action
 * validée (zod) ; un refus de la base s'affiche ici, tel quel. Suppression :
 * confirmation en place (pas de modale), comme « Supprimer le carnet ».
 */
export function CarnetEditSheet({
  target,
  detail,
  edits,
  canManageTravelers,
  onMomentRemoved,
  onClose,
}: CarnetEditSheetProps) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  // Étape
  const etape = target.kind === 'etape' ? target.etape : null;
  const [stepDay, setStepDay] = useState(String(target.kind === 'etape' ? (etape?.dayNumber ?? target.day) : 1));
  const [from, setFrom] = useState(etape?.from ?? '');
  const [to, setTo] = useState(etape?.to ?? '');
  const [distance, setDistance] = useState(etape?.distanceKm != null ? String(etape.distanceKm) : '');
  const [elevation, setElevation] = useState(etape?.elevationM != null ? String(etape.elevationM) : '');
  const [duration, setDuration] = useState(etape?.durationText ?? '');
  const [note, setNote] = useState(etape?.note ?? '');

  // Nuit
  const night = target.kind === 'nuit' ? target.night : null;
  const [nightDay, setNightDay] = useState(String(target.kind === 'nuit' ? (night?.dayNumber ?? target.day) : 1));
  const [nightName, setNightName] = useState(night?.name ?? '');
  const [nightType, setNightType] = useState<string>(night?.type ?? 'refuge');
  const [altitude, setAltitude] = useState(night?.altitudeM != null ? String(night.altitudeM) : '');
  const [infos, setInfos] = useState(night?.infos ?? '');

  // Verdict
  const itemId0 = target.kind === 'verdict' ? target.itemId : null;
  const [itemId, setItemId] = useState(itemId0 ?? detail.kit.items[0]?.id ?? '');
  const current = detail.kitVerdicts?.[itemId] ?? null;
  const [verdict, setVerdict] = useState<EditableVerdict | null>(
    target.kind === 'verdict' && current?.verdict && (EDITABLE_VERDICTS as readonly string[]).includes(current.verdict)
      ? (current.verdict as EditableVerdict)
      : null
  );
  const [verdictNote, setVerdictNote] = useState(current?.verdictNote ?? '');
  const [usedDays, setUsedDays] = useState<number[]>(current?.joursUtilises ?? []);

  // Voyageur
  const traveler = target.kind === 'voyageur' ? target.participant : null;
  const [handle, setHandle] = useState('');
  const [role, setRole] = useState<TravelerRole>('contributor');

  // Moment
  const moment = target.kind === 'moment' ? target.moment : null;
  const [place, setPlace] = useState(moment?.place ?? '');
  const [caption, setCaption] = useState(moment?.caption ?? '');

  const dayNumbers = [...new Set(detail.days.map((d) => d.dayNumber ?? d.index))].sort((a, b) => a - b);

  const run = async (action: () => Promise<EditResult>) => {
    if (busy) return;
    setBusy(true);
    setMessage(null);
    const result = await action();
    setBusy(false);
    if (!result.ok) {
      setMessage(result.error);
      return;
    }
    onClose();
  };

  const save = () =>
    run(async () => {
      switch (target.kind) {
        case 'etape':
          return edits.saveEtape(
            {
              dayNumber: stepDay,
              from,
              to,
              distanceKm: distance,
              elevationM: elevation,
              durationText: duration,
              note,
            },
            target.etape ?? undefined
          );
        case 'nuit':
          return edits.saveNight(
            { dayNumber: nightDay, name: nightName, type: nightType, altitudeM: altitude, infos },
            target.night ?? undefined
          );
        case 'verdict':
          return edits.saveVerdict({ itemId, verdict, note: verdictNote, days: usedDays });
        case 'voyageur':
          if (target.participant) return edits.changeTravelerRole(target.participant, role);
          return edits.addTraveler({ handle, role });
        case 'moment':
          return edits.updateMoment(
            target.moment.id,
            { place, caption },
            { place: target.moment.place, caption: target.moment.caption }
          );
      }
    });

  const remove = () =>
    run(async () => {
      switch (target.kind) {
        case 'etape':
          return target.etape ? edits.deleteEtape(target.etape) : { ok: true };
        case 'nuit':
          return target.night ? edits.deleteNight(target.night) : { ok: true };
        case 'verdict':
          return edits.saveVerdict({ itemId, verdict: null, days: [] });
        case 'voyageur':
          return target.participant ? edits.removeTraveler(target.participant, role) : { ok: true };
        case 'moment':
          return edits.deleteMoment(target.moment.id, onMomentRemoved);
      }
    });

  const isAuthorRow = traveler?.role === 'author';
  const travelerLocked = target.kind === 'voyageur' && (!canManageTravelers || isAuthorRow);
  const canDelete =
    (target.kind === 'etape' && Boolean(target.etape)) ||
    (target.kind === 'nuit' && Boolean(target.night)) ||
    (target.kind === 'verdict' && Boolean(current?.verdict)) ||
    (target.kind === 'voyageur' && Boolean(target.participant) && !travelerLocked) ||
    target.kind === 'moment';
  const deleteLabel =
    target.kind === 'verdict'
      ? 'Retirer le verdict'
      : target.kind === 'voyageur'
        ? 'Retirer du carnet'
        : 'Supprimer';

  return (
    <OverlaySheet
      title={titleOf(target)}
      subtitle={target.kind === 'etape' || target.kind === 'nuit' ? `J${target.kind === 'etape' ? stepDay : nightDay}` : undefined}
      onClose={onClose}
      footer={
        <div className="lkdv-row-actions" style={{ flexDirection: 'column' }}>
          {confirmDelete ? (
            <>
              <span className="lkdv-mute" role="alert">
                {target.kind === 'moment'
                  ? 'Supprimer ce moment ? Cette action est définitive.'
                  : target.kind === 'voyageur'
                    ? 'Retirer ce voyageur du carnet ?'
                    : target.kind === 'verdict'
                      ? 'Retirer ce verdict ?'
                      : 'Supprimer ? Tu pourras annuler depuis la notification.'}
              </span>
              <div className="lkdv-row-actions">
                <button type="button" className="lkdv-mbtn ghost" disabled={busy} onClick={() => setConfirmDelete(false)}>
                  Annuler
                </button>
                <button type="button" className="lkdv-mbtn danger" data-testid="edit-delete-confirm" disabled={busy} onClick={() => void remove()}>
                  {deleteLabel}
                </button>
              </div>
            </>
          ) : (
            <>
              <button
                type="button"
                className="lkdv-carnet-create-cta"
                data-testid="edit-save"
                disabled={busy || travelerLocked}
                onClick={() => void save()}
              >
                {target.kind === 'voyageur' && !traveler ? 'Inviter' : 'Enregistrer'}
              </button>
              {canDelete ? (
                <button type="button" className="lkdv-mbtn danger" data-testid="edit-delete" disabled={busy} onClick={() => setConfirmDelete(true)}>
                  {deleteLabel}
                </button>
              ) : null}
            </>
          )}
        </div>
      }
    >
      <div>
        {target.kind === 'etape' ? (
          <>
            <Field label="Jour">
              <input type="number" min={1} max={366} inputMode="numeric" value={stepDay} onChange={(e) => setStepDay(e.target.value)} />
            </Field>
            <Field label="Départ">
              <input type="text" value={from} maxLength={80} autoComplete="off" onChange={(e) => setFrom(e.target.value)} />
            </Field>
            <Field label="Arrivée">
              <input type="text" value={to} maxLength={80} autoComplete="off" onChange={(e) => setTo(e.target.value)} />
            </Field>
            <Field label="Distance (km)">
              <input type="text" inputMode="decimal" value={distance} onChange={(e) => setDistance(e.target.value)} />
            </Field>
            <Field label="Dénivelé positif (m)">
              <input type="text" inputMode="numeric" value={elevation} onChange={(e) => setElevation(e.target.value)} />
            </Field>
            <Field label="Durée">
              <input type="text" value={duration} maxLength={30} placeholder="6 h 40" onChange={(e) => setDuration(e.target.value)} />
            </Field>
            <Field label="Récit">
              <textarea value={note} maxLength={1000} onChange={(e) => setNote(e.target.value)} />
            </Field>
          </>
        ) : null}

        {target.kind === 'nuit' ? (
          <>
            <Field label="Jour">
              <input type="number" min={1} max={366} inputMode="numeric" value={nightDay} onChange={(e) => setNightDay(e.target.value)} />
            </Field>
            <Field label="Nom">
              <input type="text" value={nightName} maxLength={80} autoComplete="off" onChange={(e) => setNightName(e.target.value)} />
            </Field>
            <Field label="Type">
              <select value={nightType} onChange={(e) => setNightType(e.target.value)}>
                {NIGHT_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {NIGHT_TYPE_LABELS[t]}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Altitude (m)">
              <input type="text" inputMode="numeric" value={altitude} onChange={(e) => setAltitude(e.target.value)} />
            </Field>
            <Field label="Infos">
              <textarea value={infos} maxLength={240} placeholder="Demi-pension, dortoir de 12" onChange={(e) => setInfos(e.target.value)} />
            </Field>
            {!night && detail.nights?.some((n) => n.dayNumber === Number(nightDay)) ? (
              <p className="lkdv-mute" role="status">
                Il y a déjà une nuit ce jour-là : elle sera remplacée (annulable).
              </p>
            ) : null}
          </>
        ) : null}

        {target.kind === 'verdict' ? (
          <>
            <Field label="Objet du kit">
              <select
                value={itemId}
                disabled={Boolean(itemId0)}
                onChange={(e) => {
                  setItemId(e.target.value);
                  const next = detail.kitVerdicts?.[e.target.value];
                  setVerdict(
                    next?.verdict && (EDITABLE_VERDICTS as readonly string[]).includes(next.verdict)
                      ? (next.verdict as EditableVerdict)
                      : null
                  );
                  setVerdictNote(next?.verdictNote ?? '');
                  setUsedDays(next?.joursUtilises ?? []);
                }}
              >
                {detail.kit.items.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </Field>
            <div className="lkdv-overlay-field">
              <span>Verdict</span>
              <div className="lkdv-vpills" role="group" aria-label="Verdict">
                {EDITABLE_VERDICTS.map((v) => (
                  <button
                    key={v}
                    type="button"
                    className={`lkdv-v lkdv-v-${v}`}
                    aria-pressed={verdict === v}
                    onClick={() => setVerdict(verdict === v ? null : v)}
                  >
                    {VERDICT_LABELS[v]}
                  </button>
                ))}
              </div>
            </div>
            <Field label="Note">
              <textarea value={verdictNote} maxLength={500} onChange={(e) => setVerdictNote(e.target.value)} />
            </Field>
            {dayNumbers.length > 0 ? (
              <div className="lkdv-overlay-field">
                <span>Jours d’utilisation</span>
                <div className="lkdv-chips" role="group" aria-label="Jours d’utilisation">
                  {dayNumbers.map((d) => (
                    <button
                      key={d}
                      type="button"
                      className="lkdv-chip"
                      aria-pressed={usedDays.includes(d)}
                      onClick={() =>
                        setUsedDays((prev) => (prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d]))
                      }
                    >
                      J{d}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
          </>
        ) : null}

        {target.kind === 'voyageur' ? (
          <>
            {traveler ? (
              <p className="lkdv-mute">
                {traveler.name ?? traveler.handle ?? 'Voyageur'}
                {isAuthorRow ? ' est l’auteur du carnet : son rôle ne change pas.' : ''}
              </p>
            ) : (
              <Field label="Pseudo">
                <input
                  type="text"
                  value={handle}
                  maxLength={40}
                  autoComplete="off"
                  autoCapitalize="none"
                  placeholder="@pseudo"
                  onChange={(e) => setHandle(e.target.value)}
                />
              </Field>
            )}
            {!isAuthorRow ? (
              <Field label="Rôle">
                <select value={role} onChange={(e) => setRole(e.target.value as TravelerRole)}>
                  {TRAVELER_ROLES.map((r) => (
                    <option key={r} value={r}>
                      {TRAVELER_ROLE_LABELS[r]}
                    </option>
                  ))}
                </select>
              </Field>
            ) : null}
            {!canManageTravelers ? (
              <p className="lkdv-mute" role="status">
                Seul l’auteur du carnet invite, change le rôle ou retire un voyageur.
              </p>
            ) : null}
          </>
        ) : null}

        {target.kind === 'moment' ? (
          <>
            <Field label="Lieu">
              <input type="text" value={place} maxLength={80} autoComplete="off" onChange={(e) => setPlace(e.target.value)} />
            </Field>
            <Field label="Texte">
              <textarea value={caption} maxLength={400} onChange={(e) => setCaption(e.target.value)} />
            </Field>
          </>
        ) : null}

        <div role="alert" className="lkdv-carnet-create-msg" data-ok="false">
          {message ?? ''}
        </div>
      </div>
    </OverlaySheet>
  );
}
