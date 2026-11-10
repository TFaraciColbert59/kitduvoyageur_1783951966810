'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Camera, ChevronDown, ChevronUp, GripVertical, ImagePlus, Loader2, Plus, Trash2 } from 'lucide-react';
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
import { moveItemBetweenDays } from '../../shared/traceEditing';
import { useCarnetNights } from './capabilities';
import { DAY_PANEL_ID, dayTabId, nextTabIndex, useDaySwipe } from './daySwipe';
import { carnetDayCountV2, clampCarnetDaysV2, syncCarnetDaysV2 } from './daySync';

const MOMENT_LABELS: Record<CarnetMomentKindV2, string> = {
  photo: 'Photo',
  rencontre: 'Rencontre',
  nuit: 'Nuit',
  depense: 'Dépense',
  objet: 'Objet',
  espece: 'Espèce',
};

const NIGHT_TYPES = ['refuge', 'gite', 'bivouac', 'hotel', 'camping', 'autre'] as const;

/** Élément en cours de glisser entre jours (FID-068). */
type DayDragV2 =
  | { kind: 'moment'; day: number; moment: number }
  | { kind: 'night'; day: number };

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
 * nuits/refuges seulement si `carnet_nights` répond (sonde `useCarnetNights`).
 */
export function DaysPaneV2({ user }: { user: { id: string } | null }) {
  const form = useFormContext<CarnetFormValuesV2>();
  const { errors } = useFormState<CarnetFormValuesV2>({ control: form.control });
  const daysMessage = readError(errors, 'days');
  const values = form.watch();
  const days = values.days ?? [];
  const [active, setActive] = useState(0);
  const { haptic } = useHapticFeedback();
  const hasNights = useCarnetNights();
  const clampedActive = Math.max(0, Math.min(days.length - 1, active));
  const day = days[clampedActive];

  const setDays = (next: CarnetDayV2[]) => {
    form.setValue('days', next, { shouldDirty: true, shouldValidate: true });
  };

  // Carnet#20 — tablist complet : flèches, Home/End, tabindex itinérant,
  // activation automatique ; Carnet#11 — glisser horizontal entre les jours.
  const panelRef = useRef<HTMLDivElement | null>(null);
  const goToDay = (index: number, moveFocus = false) => {
    const target = Math.max(0, Math.min(days.length - 1, index));
    if (target === clampedActive) return;
    setActive(target);
    haptic('selection');
    if (moveFocus && typeof document !== 'undefined') {
      const id = days[target] ? dayTabId(days[target].id) : '';
      requestAnimationFrame(() => document.getElementById(id)?.focus({ preventScroll: false }));
    }
  };
  const onTabsKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const next = nextTabIndex(event.key, clampedActive, days.length);
    if (next == null) return;
    event.preventDefault();
    goToDay(next, true);
  };
  const swipeHandlers = useDaySwipe({
    panelRef,
    onSwipe: (direction) => goToDay(clampedActive + direction),
    enabled: days.length > 1,
  });

  // FID-068 — glisser un moment (ou la nuitée) d'un jour à un autre : la cible
  // est la pastille de jour sous le doigt (`data-cv2-day-drop`). La
  // transformation de liste est celle, pure et testée, de `shared/traceEditing`.
  const dragRef = useRef<DayDragV2 | null>(null);
  const [drag, setDrag] = useState<DayDragV2 | null>(null);
  const [dropDay, setDropDay] = useState<number | null>(null);
  const [announcement, setAnnouncement] = useState('');

  const dayIndexAt = (clientX: number, clientY: number): number | null => {
    if (typeof document === 'undefined') return null;
    const element = document.elementFromPoint(clientX, clientY);
    const target = element?.closest<HTMLElement>('[data-cv2-day-drop]');
    if (!target) return null;
    const index = Number(target.dataset.cv2DayDrop);
    return Number.isInteger(index) ? index : null;
  };

  const applyMove = (payload: DayDragV2, targetDay: number) => {
    if (targetDay === payload.day || targetDay < 0 || targetDay >= days.length) return;
    if (payload.kind === 'moment') {
      const arrays = days.map((entry) => entry.moments);
      const moved = moveItemBetweenDays(
        arrays,
        payload.day,
        payload.moment,
        targetDay,
        arrays[targetDay].length,
      );
      setDays(days.map((entry, index) => ({ ...entry, moments: moved[index] })));
      setAnnouncement(`Moment déplacé au jour ${days[targetDay].dayNumber}.`);
    } else {
      if (days[targetDay].night) {
        setAnnouncement(`Le jour ${days[targetDay].dayNumber} a déjà une nuitée.`);
        return;
      }
      const nights = days.map((entry) => (entry.night ? [entry.night] : []));
      const moved = moveItemBetweenDays(nights, payload.day, 0, targetDay, 0);
      setDays(
        days.map((entry, index) => ({ ...entry, night: moved[index][0] ?? null })),
      );
      setAnnouncement(`Nuitée déplacée au jour ${days[targetDay].dayNumber}.`);
    }
    setActive(targetDay);
    haptic('selection');
  };

  const beginDrag = (payload: DayDragV2, event: React.PointerEvent<HTMLButtonElement>) => {
    if (event.button > 0) return;
    dragRef.current = payload;
    setDrag(payload);
    setDropDay(payload.day);
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      /* capture optionnelle (Safari ancien, tests) */
    }
  };

  const moveDrag = (event: React.PointerEvent<HTMLButtonElement>) => {
    if (!dragRef.current) return;
    setDropDay(dayIndexAt(event.clientX, event.clientY));
  };

  const endDrag = (event: React.PointerEvent<HTMLButtonElement>) => {
    const payload = dragRef.current;
    if (!payload) return;
    dragRef.current = null;
    const targetDay = dayIndexAt(event.clientX, event.clientY);
    setDrag(null);
    setDropDay(null);
    if (targetDay != null) applyMove(payload, targetDay);
  };

  const cancelDrag = () => {
    dragRef.current = null;
    setDrag(null);
    setDropDay(null);
  };

  /**
   * FID-030 — à l'entrée de l'étape, les jours sont **initialisés depuis les
   * dates** (min 1) : nombre de jours du stepper d'Infos, ou nombre de jours
   * des dates s'il est connu. L'état vide ne subsiste que **sans aucune date**
   * (maquette `syncDays`, HTML L2969 et `onStep` Jours).
   */
  useEffect(() => {
    const current = form.getValues('days') ?? [];
    if (current.length > 0) return;
    const startDate = form.getValues('startDate') ?? '';
    if (!startDate) return;
    const fromDates = carnetDayCountV2(startDate, form.getValues('endDate') ?? '');
    const count = clampCarnetDaysV2(fromDates || form.getValues('nbJours') || 1);
    form.setValue('days', syncCarnetDaysV2([], count, startDate), {
      shouldDirty: true,
      shouldValidate: true,
    });
    form.setValue('nbJours', count, { shouldDirty: true });
  }, [form, values.startDate]);

  const setDayCount = (count: number) => {
    form.setValue('nbJours', clampCarnetDaysV2(count), { shouldDirty: true });
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
    setDayCount(next.length);
    setActive(next.length - 1);
    haptic('selection');
  };

  return (
    <div className="lkdv-cv2c-days" data-dragging={drag ? 'true' : undefined}>
      <p className="lkdv-cv2c-sr-only" role="status">
        {announcement}
      </p>
      {daysMessage ? (
        <p className="lkdv-cv2-field-error" role="alert">
          {daysMessage}
        </p>
      ) : null}
      <div className="lkdv-cv2c-day-tabs" data-hscroll>
        <div
          className="lkdv-cv2c-day-tablist"
          role="tablist"
          aria-label="Jours du carnet"
          aria-orientation="horizontal"
          onKeyDown={onTabsKeyDown}
        >
          {days.map((entry, index) => (
            <button
              key={entry.id}
              type="button"
              role="tab"
              id={dayTabId(entry.id)}
              aria-selected={index === clampedActive}
              aria-controls={DAY_PANEL_ID}
              tabIndex={index === clampedActive ? 0 : -1}
              className="lkdv-cv2c-day-tab"
              data-cv2-day-drop={index}
              data-drop={dropDay === index && drag !== null ? 'true' : undefined}
              onClick={() => setActive(index)}
            >
              J{entry.dayNumber}
            </button>
          ))}
        </div>
        {days.length < 60 ? (
          <button type="button" className="lkdv-cv2c-day-tab-add" aria-label="Ajouter un jour" onClick={addDay}>
            +
          </button>
        ) : null}
      </div>
      <div
        id={DAY_PANEL_ID}
        ref={panelRef}
        role="tabpanel"
        aria-labelledby={day ? dayTabId(day.id) : undefined}
        aria-label={day ? undefined : 'Jours du carnet'}
        className="lkdv-cv2c-day-panel"
        data-testid="cv2c-day-panel"
        {...swipeHandlers}
      >
      {!day ? (
        <p className="lkdv-cv2c-empty">
          Aucune date de départ : ajoute un jour, puis raconte chaque moment. Dès que le
          carnet a des dates, les jours se remplissent tout seuls.
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
            {hasNights ? (
              <div className="lkdv-cv2-field">
                <div className="lkdv-cv2c-night-head">
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
                  {/* FID-068 : glisser la nuitée vers un autre jour (ou flèches). */}
                  {day.night ? (
                    <button
                      type="button"
                      className="lkdv-cv2c-icon-btn lkdv-cv2c-drag"
                      aria-label={`Déplacer la nuitée du jour ${day.dayNumber}. Glisse sur un jour, ou flèches gauche et droite`}
                      onPointerDown={(event) =>
                        beginDrag({ kind: 'night', day: clampedActive }, event)
                      }
                      onPointerMove={moveDrag}
                      onPointerUp={endDrag}
                      onPointerCancel={cancelDrag}
                      onKeyDown={(event) => {
                        if (event.key === 'ArrowLeft') {
                          event.preventDefault();
                          event.stopPropagation();
                          applyMove({ kind: 'night', day: clampedActive }, clampedActive - 1);
                        } else if (event.key === 'ArrowRight') {
                          event.preventDefault();
                          event.stopPropagation();
                          applyMove({ kind: 'night', day: clampedActive }, clampedActive + 1);
                        }
                      }}
                    >
                      <GripVertical size={13} aria-hidden="true" />
                    </button>
                  ) : null}
                </div>
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
                const next = days.filter((_, position) => position !== clampedActive);
                setDays(next);
                setDayCount(next.length);
                setActive(Math.max(0, clampedActive - 1));
              }}
            >
              <Trash2 size={12} aria-hidden="true" /> Retirer ce jour
            </button>
          </div>

          <ul className="lkdv-cv2c-moments">
            {day.moments.map((moment, momentIndex) => (
              <li
                key={moment.id}
                className="lkdv-cv2c-moment"
                data-dragging={
                  drag?.kind === 'moment' && drag.day === clampedActive && drag.moment === momentIndex
                    ? 'true'
                    : undefined
                }
              >
                <div className="lkdv-cv2c-moment-head">
                  {/* FID-068 : glisser le moment vers la pastille d'un autre jour
                      (ou flèches gauche/droite au clavier). */}
                  <button
                    type="button"
                    className="lkdv-cv2c-icon-btn lkdv-cv2c-drag"
                    aria-label={`Déplacer le moment ${momentIndex + 1}. Glisse sur un jour, ou flèches gauche et droite`}
                    onPointerDown={(event) =>
                      beginDrag(
                        { kind: 'moment', day: clampedActive, moment: momentIndex },
                        event,
                      )
                    }
                    onPointerMove={moveDrag}
                    onPointerUp={endDrag}
                    onPointerCancel={cancelDrag}
                    onKeyDown={(event) => {
                      if (event.key === 'ArrowLeft') {
                        event.preventDefault();
                        event.stopPropagation();
                        applyMove(
                          { kind: 'moment', day: clampedActive, moment: momentIndex },
                          clampedActive - 1,
                        );
                      } else if (event.key === 'ArrowRight') {
                        event.preventDefault();
                        event.stopPropagation();
                        applyMove(
                          { kind: 'moment', day: clampedActive, moment: momentIndex },
                          clampedActive + 1,
                        );
                      }
                    }}
                  >
                    <GripVertical size={13} aria-hidden="true" />
                  </button>
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
      </div>
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
