'use client';

import React, { useRef, useState } from 'react';
import { Camera, ChevronDown, ChevronUp, ImagePlus, Loader2, Plus, Trash2 } from 'lucide-react';
import { useFormContext, useFormState } from 'react-hook-form';
import {
  CARNET_MOMENT_KINDS_V2,
  createMediaItemV2,
  type CarnetDayV2,
  type CarnetFormValuesV2,
  type CarnetMomentKindV2,
  type CarnetMomentV2,
  type MediaItemV2,
} from '../engine/createSchemasV2';
import { readError } from '../fields/FieldV2';
import {
  IMAGE_LIMITS,
  cropImageToRatio,
  deleteMediaObjectsV2,
  uploadMediaV2,
  validateMediaFile,
} from '../fields/media';
import { useHapticFeedback } from '@/hooks/useHapticFeedback';
import { HAS_CARNET_NIGHTS } from './capabilities';

const MOMENT_LABELS: Record<CarnetMomentKindV2, string> = {
  photo: 'Photo',
  rencontre: 'Rencontre',
  nuit: 'Nuit',
  depense: 'Dépense',
  objet: 'Objet',
  espece: 'Espèce',
};

const NIGHT_TYPES = ['refuge', 'gite', 'bivouac', 'hotel', 'camping', 'autre'] as const;

function newDay(dayNumber: number, date: string): CarnetDayV2 {
  return {
    id: crypto.randomUUID(),
    dayNumber,
    title: '',
    date,
    night: null,
    moments: [],
  };
}

function newMoment(): CarnetMomentV2 {
  return { id: crypto.randomUUID(), kind: 'photo', time: '', text: '', place: '', photo: null };
}

function MomentPhotoV2({
  userId,
  value,
  onChange,
}: {
  userId: string;
  value: MediaItemV2 | null;
  onChange: (next: MediaItemV2 | null) => void;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [state, setState] = useState<'idle' | 'uploading' | 'error'>('idle');
  const [notice, setNotice] = useState<string | null>(null);

  const upload = async (file: File | undefined) => {
    if (!file || !userId) return;
    const validation = validateMediaFile(file, IMAGE_LIMITS);
    if (!validation.ok) {
      setNotice(validation.message ?? 'Photo refusée.');
      return;
    }
    setState('uploading');
    setNotice(null);
    try {
      const prepared = await cropImageToRatio(file, '4:5');
      const uploaded = await uploadMediaV2(prepared, { userId, bucket: 'carnet-media' });
      onChange(
        createMediaItemV2({
          name: file.name,
          type: prepared.type || file.type,
          size: prepared.size,
          url: uploaded.url,
          storageBucket: uploaded.bucket,
          storagePath: uploaded.path,
          status: 'uploaded',
          progress: 100,
          crop: '4:5',
        }),
      );
      setState('idle');
    } catch (error) {
      setState('error');
      setNotice(error instanceof Error ? error.message : 'Envoi de la photo impossible.');
    }
  };

  return (
    <div className="lkdv-cv2c-moment-photo">
      {value?.url ? (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element -- URL Storage du carnet */}
          <img src={value.url} alt={value.alt || 'Photo du moment'} />
          <button
            type="button"
            className="lkdv-cv2c-icon-btn"
            aria-label="Retirer la photo du moment"
            onClick={() => {
              if (value.storagePath) {
                void deleteMediaObjectsV2([{ bucket: 'carnet-media', path: value.storagePath }]);
              }
              onChange(null);
            }}
          >
            <Trash2 size={13} aria-hidden="true" />
          </button>
        </>
      ) : null}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="lkdv-cv2c-sr-only"
        aria-label="Photo du moment"
        onChange={(event) => {
          void upload(event.target.files?.[0]);
          event.target.value = '';
        }}
      />
      <button
        type="button"
        className="lkdv-cv2-chip lkdv-cv2-chip--sm"
        onClick={() => inputRef.current?.click()}
        disabled={state === 'uploading'}
      >
        {state === 'uploading' ? (
          <Loader2 size={12} className="lkdv-cv2c-spin" aria-hidden="true" />
        ) : (
          <ImagePlus size={12} aria-hidden="true" />
        )}
        {value ? 'Remplacer la photo' : 'Ajouter une photo'}
      </button>
      {notice ? (
        <p className="lkdv-cv2-field-error" role="alert">
          {notice}
        </p>
      ) : null}
    </div>
  );
}

/**
 * Jours et moments du carnet (`Carnet#11-13`, `Carnet#20`) : mini-capsule des
 * jours dans le panneau, moments typés (photo, rencontre, nuit, dépense, objet,
 * espèce), **photos réellement téléversées** dans le bucket des carnets,
 * nuits/refuges seulement si `carnet_nights` existe (`HAS_CARNET_NIGHTS`).
 */
export function DaysPaneV2({ user }: { user: { id: string } | null }) {
  const form = useFormContext<CarnetFormValuesV2>();
  const { errors } = useFormState<CarnetFormValuesV2>({ control: form.control });
  const daysMessage = readError(errors, 'days');
  const values = form.watch();
  const days = values.days ?? [];
  const [active, setActive] = useState(0);
  const { haptic } = useHapticFeedback();
  const clampedActive = Math.max(0, Math.min(days.length - 1, active));
  const day = days[clampedActive];

  const setDays = (next: CarnetDayV2[]) => {
    form.setValue('days', next, { shouldDirty: true, shouldValidate: true });
  };

  const updateDay = (index: number, patch: Partial<CarnetDayV2>) => {
    setDays(days.map((entry, position) => (position === index ? { ...entry, ...patch } : entry)));
  };

  const updateMoment = (dayIndex: number, momentIndex: number, patch: Partial<CarnetMomentV2>) => {
    setDays(
      days.map((entry, position) =>
        position === dayIndex
          ? {
              ...entry,
              moments: entry.moments.map((moment, momentPosition) =>
                momentPosition === momentIndex ? { ...moment, ...patch } : moment,
              ),
            }
          : entry,
      ),
    );
  };

  const addDay = () => {
    const last = days[days.length - 1];
    const nextNumber = last ? Math.min(60, last.dayNumber + 1) : 1;
    const nextDate = last?.date
      ? new Date(new Date(`${last.date}T12:00:00`).getTime() + 86_400_000).toISOString().slice(0, 10)
      : values.startDate || '';
    const next = [...days, newDay(nextNumber, nextDate)];
    setDays(next);
    setActive(next.length - 1);
    haptic('selection');
  };

  const proposeDays = () => {
    if (!values.startDate || !values.endDate) return;
    const start = new Date(`${values.startDate}T12:00:00`).getTime();
    const end = new Date(`${values.endDate}T12:00:00`).getTime();
    if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return;
    const count = Math.min(60, Math.round((end - start) / 86_400_000) + 1);
    const next: CarnetDayV2[] = days.slice(0, count);
    for (let index = next.length; index < count; index += 1) {
      const date = new Date(start + index * 86_400_000).toISOString().slice(0, 10);
      next.push(newDay(index + 1, date));
    }
    for (let index = 0; index < next.length; index += 1) {
      const date = new Date(start + index * 86_400_000).toISOString().slice(0, 10);
      if (!next[index].date) next[index] = { ...next[index], date };
    }
    setDays(next);
    setActive(0);
    haptic('selection');
  };

  return (
    <div className="lkdv-cv2c-days">
      {daysMessage ? (
        <p className="lkdv-cv2-field-error" role="alert">
          {daysMessage}
        </p>
      ) : null}
      <div className="lkdv-cv2c-day-tabs" data-hscroll role="tablist" aria-label="Jours du carnet">
        {days.map((entry, index) => (
          <button
            key={entry.id}
            type="button"
            role="tab"
            aria-selected={index === clampedActive}
            className="lkdv-cv2c-day-tab"
            onClick={() => setActive(index)}
          >
            J{entry.dayNumber}
          </button>
        ))}
        {days.length < 60 ? (
          <button type="button" className="lkdv-cv2c-day-tab-add" aria-label="Ajouter un jour" onClick={addDay}>
            +
          </button>
        ) : null}
      </div>
      {values.startDate && values.endDate ? (
        <button type="button" className="lkdv-cv2-chip lkdv-cv2-chip--sm" onClick={proposeDays}>
          Proposer les jours selon les dates
        </button>
      ) : null}

      {!day ? (
        <p className="lkdv-cv2c-empty">
          Aucun jour pour l’instant. Ajoute un jour, puis raconte chaque moment.
        </p>
      ) : (
        <>
          <div className="lkdv-cv2c-media-edit">
            <div className="lkdv-cv2c-media-edit-head">
              <b>Jour {day.dayNumber}</b>
              <span className="lkdv-cv2-field-hint">Moments : {day.moments.length}</span>
            </div>
            <div className="lkdv-cv2-field">
              <label className="lkdv-cv2-field-label" htmlFor={`cv2c-day-title-${day.id}`}>
                Titre du jour
              </label>
              <input
                id={`cv2c-day-title-${day.id}`}
                type="text"
                className="lkdv-cv2-input"
                value={day.title}
                maxLength={120}
                placeholder="Étape, refuge, point de vue…"
                onChange={(event) => updateDay(clampedActive, { title: event.target.value })}
              />
            </div>
            <div className="lkdv-cv2-field">
              <label className="lkdv-cv2-field-label" htmlFor={`cv2c-day-date-${day.id}`}>
                Date
              </label>
              <input
                id={`cv2c-day-date-${day.id}`}
                type="date"
                className="lkdv-cv2-input"
                value={day.date}
                onChange={(event) => updateDay(clampedActive, { date: event.target.value })}
              />
            </div>
            {HAS_CARNET_NIGHTS ? (
              <div className="lkdv-cv2-field">
                <button
                  type="button"
                  className="lkdv-cv2c-switch"
                  role="switch"
                  aria-checked={Boolean(day.night)}
                  onClick={() =>
                    updateDay(clampedActive, {
                      night: day.night ? null : { name: '', type: 'bivouac', infos: '' },
                    })
                  }
                >
                  <span className="lkdv-cv2c-switch-track" aria-hidden="true">
                    <span className="lkdv-cv2c-switch-dot" />
                  </span>
                  Nuitée
                </button>
                {day.night ? (
                  <div className="lkdv-cv2c-media-edit">
                    <input
                      type="text"
                      className="lkdv-cv2-input"
                      value={day.night.name}
                      placeholder="Refuge du Temple"
                      aria-label="Nom de la nuitée"
                      onChange={(event) =>
                        updateDay(clampedActive, { night: { ...day.night!, name: event.target.value } })
                      }
                    />
                    <select
                      className="lkdv-cv2-input"
                      value={day.night.type}
                      aria-label="Type de nuitée"
                      onChange={(event) =>
                        updateDay(clampedActive, {
                          night: { ...day.night!, type: event.target.value as typeof NIGHT_TYPES[number] },
                        })
                      }
                    >
                      {NIGHT_TYPES.map((type) => (
                        <option key={type} value={type}>
                          {type}
                        </option>
                      ))}
                    </select>
                    <input
                      type="text"
                      className="lkdv-cv2-input"
                      value={day.night.infos}
                      placeholder="Demi-pension, eau, gardien…"
                      aria-label="Informations sur la nuitée"
                      onChange={(event) =>
                        updateDay(clampedActive, { night: { ...day.night!, infos: event.target.value } })
                      }
                    />
                  </div>
                ) : null}
              </div>
            ) : null}
            <button
              type="button"
              className="lkdv-cv2-chip lkdv-cv2-chip--sm"
              onClick={() => {
                setDays(days.filter((_, position) => position !== clampedActive));
                setActive(Math.max(0, clampedActive - 1));
              }}
            >
              <Trash2 size={12} aria-hidden="true" /> Retirer ce jour
            </button>
          </div>

          <ul className="lkdv-cv2c-moments">
            {day.moments.map((moment, momentIndex) => (
              <li key={moment.id} className="lkdv-cv2c-moment">
                <div className="lkdv-cv2c-moment-head">
                  <span className="lkdv-cv2c-moment-kind">
                    <Camera size={11} aria-hidden="true" /> {MOMENT_LABELS[moment.kind]}
                  </span>
                  <button
                    type="button"
                    className="lkdv-cv2c-icon-btn lkdv-cv2c-moment-delete"
                    aria-label="Retirer ce moment"
                    onClick={() =>
                      updateDay(clampedActive, {
                        moments: day.moments.filter((_, position) => position !== momentIndex),
                      })
                    }
                  >
                    <Trash2 size={12} aria-hidden="true" />
                  </button>
                </div>
                <div className="lkdv-cv2-chips">
                  {CARNET_MOMENT_KINDS_V2.map((kind) => (
                    <button
                      key={kind}
                      type="button"
                      className="lkdv-cv2-chip lkdv-cv2-chip--sm"
                      aria-pressed={moment.kind === kind}
                      onClick={() => updateMoment(clampedActive, momentIndex, { kind })}
                    >
                      {MOMENT_LABELS[kind]}
                    </button>
                  ))}
                </div>
                <div className="lkdv-cv2c-media-edit">
                  <div className="lkdv-cv2c-date-range">
                    <div className="lkdv-cv2-field">
                      <label className="lkdv-cv2-field-label">Heure</label>
                      <input
                        type="time"
                        className="lkdv-cv2-input"
                        value={moment.time}
                        aria-label="Heure du moment"
                        onChange={(event) =>
                          updateMoment(clampedActive, momentIndex, { time: event.target.value })
                        }
                      />
                    </div>
                    <div className="lkdv-cv2-field">
                      <label className="lkdv-cv2-field-label">Lieu</label>
                      <input
                        type="text"
                        className="lkdv-cv2-input"
                        value={moment.place}
                        maxLength={120}
                        placeholder="Col du Vallon…"
                        aria-label="Lieu du moment"
                        onChange={(event) =>
                          updateMoment(clampedActive, momentIndex, { place: event.target.value })
                        }
                      />
                    </div>
                  </div>
                  <div className="lkdv-cv2-field">
                    <label className="lkdv-cv2-field-label">Raconter</label>
                    <textarea
                      className="lkdv-cv2-input"
                      rows={2}
                      maxLength={500}
                      value={moment.text}
                      placeholder="Petit commentaire, rencontre, souvenir…"
                      onChange={(event) =>
                        updateMoment(clampedActive, momentIndex, { text: event.target.value })
                      }
                    />
                  </div>
                  <MomentPhotoV2
                    userId={user?.id ?? ''}
                    value={moment.photo}
                    onChange={(photo) => updateMoment(clampedActive, momentIndex, { photo })}
                  />
                </div>
              </li>
            ))}
          </ul>
          {day.moments.length < 12 ? (
            <button
              type="button"
              className="lkdv-cv2c-add-media"
              onClick={() =>
                updateDay(clampedActive, { moments: [...day.moments, newMoment()] })
              }
            >
              <Plus size={14} aria-hidden="true" /> Ajouter un moment
            </button>
          ) : null}
        </>
      )}
      <p className="lkdv-cv2-field-hint">
        Chaque moment peut porter une photo : elle est téléversée maintenant (EXIF retiré, 10 Mo maximum), pas à l’envoi.
      </p>
      <div className="lkdv-cv2c-inline-add">
        {days.length > 1 ? (
          <button
            type="button"
            className="lkdv-cv2-chip lkdv-cv2-chip--sm"
            onClick={() => setActive(Math.max(0, clampedActive - 1))}
            aria-label="Jour précédent"
          >
            <ChevronUp size={12} aria-hidden="true" /> Jour précédent
          </button>
        ) : null}
        {days.length > 1 && clampedActive < days.length - 1 ? (
          <button
            type="button"
            className="lkdv-cv2-chip lkdv-cv2-chip--sm"
            onClick={() => setActive(clampedActive + 1)}
            aria-label="Jour suivant"
          >
            <ChevronDown size={12} aria-hidden="true" /> Jour suivant
          </button>
        ) : null}
      </div>
    </div>
  );
}

export default DaysPaneV2;
