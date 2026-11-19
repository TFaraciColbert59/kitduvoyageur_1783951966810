'use client';

import React, { useRef, useState } from 'react';
import { useFormContext } from 'react-hook-form';
import { CalendarDays, Check } from 'lucide-react';
import type { User } from '@supabase/supabase-js';
import {
  createMediaItemV2,
  type CarnetFormValuesV2,
  type MediaItemV2,
} from '../engine/createSchemasV2';
import { carnetCover } from '../createRpc';
import { useHapticFeedback } from '@/hooks/useHapticFeedback';
import { uploadMediaV2 } from '../fields/media';
import { TravelersPillPickerV2 } from './TravelersPillPickerV2';
import { toast } from 'sonner';
import './CarnetHeroEditorV2.css';

/**
 * CarnetHeroEditorV2 — carte principale du haut d'un Carnet avec :
 * - avatar/couverture ronde + 3 statistiques (jours, km, D+ m)
 * - titre, destination, dates natives (début/fin) et récit (> 3 lignes -> « afficher plus... »)
 *   directement éditables au clic dans l'aperçu
 * - bloc de 50 px en bas contenant le sélecteur horizontal de voyageurs en pilules
 */
export function CarnetHeroEditorV2({ user }: { user: User | null }) {
  const form = useFormContext<CarnetFormValuesV2>();
  const values = form.watch();
  const fileRef = useRef<HTMLInputElement>(null);
  const titleRef = useRef<HTMLInputElement>(null);
  const destRef = useRef<HTMLInputElement>(null);
  const startInputRef = useRef<HTMLInputElement>(null);
  const endInputRef = useRef<HTMLInputElement>(null);
  const descRef = useRef<HTMLTextAreaElement>(null);

  const [optimisticCover, setOptimisticCover] = useState<string | null>(null);
  const [editingDesc, setEditingDesc] = useState(false);
  const [descExpanded, setDescExpanded] = useState(false);
  const { haptic } = useHapticFeedback();

  const cover = carnetCover(values);
  const coverUrl = optimisticCover ?? cover?.url ?? null;
  const daysCount = values.nbJours || values.days.length || 1;
  const rawKm = Number(values.distanceKm || 0);
  const kmLabel =
    rawKm <= 0
      ? '0'
      : rawKm < 10
        ? rawKm.toFixed(1).replace('.', ',')
        : String(Math.round(rawKm));
  const denivele = Math.round(values.deniveleM || 0);

  const titleText = values.title.trim();
  const initials =
    (titleText || 'TD')
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0]?.toUpperCase() ?? '')
      .join('') || 'TD';

  const description = values.description ?? '';
  const isLongDesc =
    description.length > 115 || description.split('\n').length > 3;

  const updateDate = (which: 'startDate' | 'endDate', nextVal: string) => {
    const nextStart = which === 'startDate' ? nextVal : values.startDate;
    let nextEnd = which === 'endDate' ? nextVal : values.endDate;
    if (nextStart && nextEnd && nextEnd < nextStart) {
      nextEnd = nextStart;
    }
    form.setValue('startDate', nextStart, { shouldDirty: true, shouldValidate: true });
    form.setValue('endDate', nextEnd, { shouldDirty: true, shouldValidate: true });
    if (nextStart && nextEnd) {
      const s = new Date(`${nextStart}T00:00:00`).getTime();
      const e = new Date(`${nextEnd}T00:00:00`).getTime();
      if (!Number.isNaN(s) && !Number.isNaN(e) && e >= s) {
        const nextDays = Math.min(60, Math.max(1, Math.round((e - s) / 86_400_000) + 1));
        if (form.getValues('nbJours') !== nextDays) {
          form.setValue('nbJours', nextDays, { shouldDirty: true });
        }
      }
    }
  };

  const handleCoverPick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !user) return;
    haptic('light');
    const previewUrl = URL.createObjectURL(file);
    setOptimisticCover(previewUrl);
    try {
      const uploaded = await uploadMediaV2(file, {
        bucket: 'carnet-media',
        userId: user.id,
      });
      URL.revokeObjectURL(previewUrl);
      setOptimisticCover(null);

      const mediaItem: MediaItemV2 = createMediaItemV2({
        id: `cover-${Date.now()}`,
        name: file.name,
        url: uploaded.url,
        storagePath: uploaded.path,
        type: file.type || 'image/jpeg',
        size: file.size,
        crop: '1:1',
        status: 'uploaded',
      });

      const currentDays = [...(form.getValues('days') ?? [])];
      if (currentDays.length === 0) {
        currentDays.push({
          id: `day-1-${Date.now()}`,
          dayNumber: 1,
          title: 'Jour 1',
          date: form.getValues('startDate') || '',
          night: null,
          moments: [
            {
              id: `moment-cover-${Date.now()}`,
              title: 'Couverture',
              kind: 'photo',
              time: '',
              text: '',
              place: form.getValues('destination') || '',
              photo: mediaItem,
              media: [mediaItem],
              encounters: [],
            },
          ],
        });
      } else {
        const firstDay = { ...currentDays[0] };
        const moments = [...(firstDay.moments ?? [])];
        if (moments.length === 0) {
          moments.push({
            id: `moment-cover-${Date.now()}`,
            title: 'Couverture',
            kind: 'photo',
            time: '',
            text: '',
            place: form.getValues('destination') || '',
            photo: mediaItem,
            media: [mediaItem],
            encounters: [],
          });
        } else {
          moments[0] = {
            ...moments[0],
            photo: mediaItem,
            media: [mediaItem, ...(moments[0].media ?? []).slice(0, 9)],
          };
        }
        firstDay.moments = moments;
        currentDays[0] = firstDay;
      }

      form.setValue('days', currentDays, { shouldDirty: true, shouldValidate: true });
      form.setValue('coverMediaId', mediaItem.id, { shouldDirty: true });
      toast.success('Couverture mise à jour');
    } catch {
      URL.revokeObjectURL(previewUrl);
      setOptimisticCover(null);
      toast.error('Échec du téléversement de la couverture');
    }
  };

  return (
    <div
      className="lkdv-carnet-card lkdv-cv2c-carnet-ig-editor"
      role="region"
      aria-label="En-tête du carnet"
    >
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="sr-only"
        onChange={handleCoverPick}
      />

      <div className="lkdv-carnet-card-scroll">
        {/* 1. Header Avatar + 3 Stats (Jours, km, D+ m) */}
        <div className="lkdv-ig-header">
          <button
            type="button"
            className="lkdv-ig-avi-wrap"
            onClick={() => fileRef.current?.click()}
            aria-label="Choisir la photo de couverture du carnet"
          >
            <span className="lkdv-ig-avi">
              {coverUrl ? (
                // eslint-disable-next-line @next/next/no-img-element -- couverture carnet
                <img src={coverUrl} alt={titleText || 'Couverture'} />
              ) : (
                <span className="lkdv-cv2c-ig-avi-initials" aria-hidden="true">
                  {initials}
                </span>
              )}
            </span>
            <span className="seal" aria-hidden="true">
              <Check size={11} strokeWidth={2.5} />
            </span>
          </button>

          <div className="lkdv-ig-stats" role="group" aria-label="Statistiques principales">
            <div className="lkdv-ig-stat">
              <b>{daysCount}</b>
              <span>{daysCount > 1 ? 'jours' : 'jour'}</span>
            </div>
            <div className="lkdv-ig-stat">
              <b>{kmLabel}</b>
              <span>km</span>
            </div>
            <div className="lkdv-ig-stat">
              <b>+{denivele}</b>
              <span>D+ m</span>
            </div>
          </div>
        </div>

        {/* 2. Bio : Titre + Destination + Dates natives interactives + Récit */}
        <div className="lkdv-ig-bio">
          <input
            ref={titleRef}
            type="text"
            className="lkdv-ig-name lkdv-cv2c-ig-inline-input"
            value={values.title}
            maxLength={100}
            placeholder="Titre du carnet…"
            aria-label="Titre du carnet"
            onChange={(e) => {
              form.setValue('title', e.target.value, {
                shouldDirty: true,
                shouldValidate: true,
              });
            }}
          />
          {form.formState.errors.title?.message ? (
            <p className="lkdv-cv2c-ig-title-error" role="alert">
              {String(form.formState.errors.title.message)}
            </p>
          ) : null}

          <div className="lkdv-cv2c-ig-subline-row">
            <input
              ref={destRef}
              type="text"
              className="lkdv-ig-handle-sub lkdv-cv2c-ig-inline-subinput"
              value={values.destination}
              maxLength={120}
              placeholder="Destination…"
              aria-label="Destination du carnet"
              size={Math.max(10, (values.destination || 'Destination…').length)}
              onChange={(e) => {
                form.setValue('destination', e.target.value, {
                  shouldDirty: true,
                  shouldValidate: true,
                });
              }}
            />

            <span className="lkdv-ig-handle-sub" aria-hidden="true">·</span>

            <div className="lkdv-cv2c-ig-date-pills">
              <div className="lkdv-cv2c-date lkdv-cv2c-date--modern is-hero-compact">
                <CalendarDays size={13} aria-hidden="true" />
                <input
                  ref={startInputRef}
                  type="date"
                  className="lkdv-cv2-input"
                  style={{ colorScheme: 'light', accentColor: '#172B24' }}
                  value={values.startDate || ''}
                  aria-label="Date de début"
                  onChange={(e) => updateDate('startDate', e.target.value)}
                />
              </div>
              <span className="lkdv-ig-handle-sub" aria-hidden="true">–</span>
              <div className="lkdv-cv2c-date lkdv-cv2c-date--modern is-hero-compact">
                <CalendarDays size={13} aria-hidden="true" />
                <input
                  ref={endInputRef}
                  type="date"
                  className="lkdv-cv2-input"
                  style={{ colorScheme: 'light', accentColor: '#172B24' }}
                  value={values.endDate || ''}
                  min={values.startDate || undefined}
                  aria-label="Date de fin"
                  onChange={(e) => updateDate('endDate', e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* Récit éditable en direct avec « afficher plus... » au-delà de 3 lignes */}
          <div className="lkdv-cv2c-ig-recit-box">
            {editingDesc ? (
              <textarea
                ref={descRef}
                className="lkdv-cv2c-ig-recit-textarea"
                rows={3}
                maxLength={1000}
                value={description}
                placeholder="Récit, idée, points forts…"
                aria-label="Récit du carnet"
                onBlur={() => setEditingDesc(false)}
                onChange={(e) =>
                  form.setValue('description', e.target.value, {
                    shouldDirty: true,
                    shouldValidate: true,
                  })
                }
              />
            ) : (
              <div className="lkdv-cv2c-ig-recit-preview">
                <p
                  className={`lkdv-cv2c-ig-recit-text ${!descExpanded ? 'is-clamped' : ''} ${!description ? 'is-placeholder' : ''}`}
                  onClick={() => {
                    setEditingDesc(true);
                    window.setTimeout(() => descRef.current?.focus(), 20);
                  }}
                >
                  {description || 'Récit, idée, points forts… (cliquer pour écrire)'}
                </p>
                {isLongDesc ? (
                  <button
                    type="button"
                    className="lkdv-cv2c-ig-recit-more"
                    onClick={() => setDescExpanded((prev) => !prev)}
                  >
                    {descExpanded ? 'afficher moins' : 'afficher plus...'}
                  </button>
                ) : null}
              </div>
            )}
          </div>
        </div>

        {/* 3. Zone 50px en bas : bloc Voyageurs en pilules horizontales */}
        <div className="lkdv-cv2c-ig-travelers-bar">
          <TravelersPillPickerV2 userId={user?.id ?? null} compact />
        </div>
      </div>
    </div>
  );
}
