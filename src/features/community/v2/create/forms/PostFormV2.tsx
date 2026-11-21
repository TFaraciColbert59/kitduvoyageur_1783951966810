'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence } from 'framer-motion';
import {
  ArrowRight,
  CalendarDays,
  Camera,
  Check,
  Compass,
  Globe,
  HelpCircle,
  Loader2,
  Lock,
  MapPin,
  Mic,
  PenLine,
  Plus,
  Users,
} from 'lucide-react';
import { useFormContext, useFormState } from 'react-hook-form';
import type { User } from '@supabase/supabase-js';
import {
  CreateFormEngineV2,
  type CreateFormEngineApiV2,
} from '../engine/CreateFormEngineV2';
import {
  createDefaultsV2,
  postSchemaV2,
  type PostFormValuesV2,
  type MediaItemV2,
  POST_MEDIA_MAX_COUNT,
} from '../engine/createSchemasV2';
import { useCreateSheet } from '../CreateSheetContext';
import { createCommunityPostV2 } from '../createRpc';
import { TextAreaFieldV2, TextFieldV2, readError } from '../fields/FieldV2';
import { DateFieldV2, TimeFieldV2 } from '../fields/DateFieldV2';
import { VisibilityPickerV2 } from '../fields/VisibilityPickerV2';
import { PlaceFieldV2 } from '../fields/PlaceFieldV2';
import { mediaProgress } from '../fields/media';
import { useMyClubsV2 } from '../club/useMyClubsV2';
import { useMySortiesV2, type MySortieOptionV2 } from '../post/useMySortiesV2';
import { todayIso } from '../../shared/format';
import { deleteMediaObjectsV2, uploadMediaV2, uploadedObjectsOf } from '../fields/media';
import { SheetPreview } from '../../shared/SheetPreview';
import type { CreateFormV2Props } from './types';
import { PostHeroPreview } from '../photo/PostHeroPreview';
import { useScrollCollapsePreview } from '../photo/CollapsibleHeroPreview';
import { PhotoThumbnailStrip } from '../photo/PhotoThumbnailStrip';
import { PhotoEditorCard } from '../photo/PhotoEditorCard';
import {
  type PhotoEditorCategory,
  type PhotoModifiersV2,
  DEFAULT_PHOTO_MODIFIERS,
  PHOTO_EDITOR_CATEGORIES,
} from '../photo/photoEditor';

const FORMAT_OPTIONS = [
  {
    value: 'photo',
    label: 'Photo',
    description: 'Montrer un moment',
    icon: <Camera size={22} aria-hidden="true" />,
  },
  {
    value: 'billet',
    label: 'Billet',
    description: 'Raconter une histoire',
    icon: <PenLine size={22} aria-hidden="true" />,
  },
  {
    value: 'question',
    label: 'Question',
    description: 'Demander à la communauté',
    icon: <HelpCircle size={22} aria-hidden="true" />,
  },
  {
    value: 'event',
    label: 'Événement',
    description: 'Donner rendez-vous',
    icon: <CalendarDays size={22} aria-hidden="true" />,
  },
] as const;

function formatFrenchDate(iso: string): string {
  if (!iso) return '';
  const parsed = new Date(`${iso}T12:00:00`);
  if (Number.isNaN(parsed.getTime())) return iso;
  return parsed.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
}

interface SortieAttachmentPanelProps {
  sorties: MySortieOptionV2[] | null;
  loading: boolean;
  error: string | null;
  onCreateSortie: () => void;
}

function SortieAttachmentPanel({
  sorties,
  loading,
  error,
  onCreateSortie,
}: SortieAttachmentPanelProps) {
  const form = useFormContext<PostFormValuesV2>();
  const values = form.watch();
  const eventDate = values.eventDate;
  const linkedEventId = values.linkedEventId;

  const matchingForDate = useMemo(
    () => (sorties ?? []).filter((s) => !eventDate || s.eventDate === eventDate),
    [eventDate, sorties],
  );
  const otherUpcoming = useMemo(
    () => (sorties ?? []).filter((s) => eventDate && s.eventDate !== eventDate),
    [eventDate, sorties],
  );

  // Auto-rattachement si l'utilisateur n'a qu'une sortie exacte à cette date et aucune sélection manuelle encore faite
  useEffect(() => {
    if (!eventDate || linkedEventId || matchingForDate.length !== 1) return;
    const only = matchingForDate[0];
    if (!only) return;
    form.setValue('linkedEventId', only.id, { shouldDirty: false, shouldValidate: true });
    form.setValue('linkedEventTitle', only.title, { shouldDirty: false });
    if (!form.getValues('title')?.trim()) {
      form.setValue('title', only.title, { shouldDirty: false });
    }
    if (!form.getValues('location')?.trim() && only.location) {
      form.setValue('location', only.location, { shouldDirty: false });
    }
  }, [eventDate, form, linkedEventId, matchingForDate]);

  const attachSortie = (sortie: MySortieOptionV2) => {
    const isAlready = linkedEventId === sortie.id;
    if (isAlready) {
      form.setValue('linkedEventId', '', { shouldDirty: true, shouldValidate: true });
      form.setValue('linkedEventTitle', '', { shouldDirty: true });
      return;
    }
    form.setValue('eventDate', sortie.eventDate, { shouldDirty: true, shouldValidate: true });
    form.setValue('linkedEventId', sortie.id, { shouldDirty: true, shouldValidate: true });
    form.setValue('linkedEventTitle', sortie.title, { shouldDirty: true });
    if (!form.getValues('title')?.trim()) {
      form.setValue('title', sortie.title, { shouldDirty: true });
    }
    if (!form.getValues('location')?.trim() && sortie.location) {
      form.setValue('location', sortie.location, { shouldDirty: true });
    }
  };

  return (
    <div className="lkdv-cv2-card lkdv-cv2c-event-sortie-box" data-testid="cv2c-event-sortie-panel">
      <div className="lkdv-cv2c-section-head">
        <span className="lkdv-cv2-field-label">Sortie rattachée</span>
        <button
          type="button"
          className="lkdv-cv2-chip lkdv-cv2-chip--sm"
          onClick={onCreateSortie}
        >
          <Plus size={12} aria-hidden="true" />
          Créer une sortie
        </button>
      </div>

      {loading && !sorties ? (
        <p className="lkdv-cv2-field-hint">
          <Loader2 size={13} className="lkdv-cv2c-spin" aria-hidden="true" /> Recherche de tes sorties…
        </p>
      ) : null}

      {error ? <p className="lkdv-cv2-field-error">{error}</p> : null}

      {!loading && matchingForDate.length > 0 ? (
        <div className="lkdv-cv2c-sortie-pick-list" role="radiogroup" aria-label="Sorties à cette date">
          {matchingForDate.map((sortie) => {
            const selected = linkedEventId === sortie.id;
            return (
              <button
                key={sortie.id}
                type="button"
                role="radio"
                aria-checked={selected}
                className="lkdv-cv2c-sortie-pick-item"
                data-active={selected || undefined}
                onClick={() => attachSortie(sortie)}
              >
                <span className="lkdv-cv2c-sortie-pick-main">
                  <b>{sortie.title}</b>
                  <small>
                    {[
                      sortie.location || null,
                      sortie.distanceKm ? `${sortie.distanceKm} km` : null,
                      sortie.maxParticipants ? `${sortie.currentParticipants}/${sortie.maxParticipants} part.` : null,
                    ]
                      .filter(Boolean)
                      .join(' · ') || formatFrenchDate(sortie.eventDate)}
                  </small>
                </span>
                <span className="lkdv-cv2c-sortie-pick-check" aria-hidden="true">
                  {selected ? <Check size={14} /> : null}
                </span>
              </button>
            );
          })}
        </div>
      ) : null}

      {!loading && matchingForDate.length === 0 ? (
        <div className="lkdv-cv2c-event-empty-sortie" data-testid="cv2c-event-no-sortie">
          <p className="lkdv-cv2-field-hint">
            <b>
              {eventDate
                ? `Aucune sortie créée le ${formatFrenchDate(eventDate)}.`
                : 'Aucune sortie sélectionnée.'}
            </b>{' '}
            Crée ta sortie au préalable pour y rattacher les inscriptions et l’itinéraire, ou poursuis avec une annonce directe.
          </p>
          <button
            type="button"
            className="lkdv-cv2-pill lkdv-cv2-pill--secondary lkdv-cv2c-format-cta"
            onClick={onCreateSortie}
            data-testid="cv2c-event-create-sortie-btn"
          >
            Créer la sortie {eventDate ? `du ${formatFrenchDate(eventDate)}` : 'au préalable'}
            <ArrowRight size={15} aria-hidden="true" />
          </button>
        </div>
      ) : null}

      {otherUpcoming.length > 0 ? (
        <div className="lkdv-cv2c-event-other-sorties">
          <span className="lkdv-cv2-field-hint">Ou rattacher une sortie à une autre date :</span>
          <div className="lkdv-cv2c-hrail lkdv-cv2c-story-carnet-rail">
            {otherUpcoming.slice(0, 8).map((sortie) => {
              const selected = linkedEventId === sortie.id;
              return (
                <button
                  key={sortie.id}
                  type="button"
                  className="lkdv-cv2-chip lkdv-cv2-chip--sm"
                  aria-pressed={selected}
                  data-active={selected || undefined}
                  onClick={() => attachSortie(sortie)}
                >
                  <Compass size={12} aria-hidden="true" />
                  {sortie.title} · {sortie.eventDate.slice(5)}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function FormatStep({
  sortiesState,
  voiceMode = false,
  onVoiceModeChange,
}: {
  sortiesState: ReturnType<typeof useMySortiesV2>;
  voiceMode?: boolean;
  onVoiceModeChange?: (active: boolean) => void;
}) {
  const form = useFormContext<PostFormValuesV2>();
  const values = form.watch();
  const { requestCreate, user } = useCreateSheet();
  const myClubs = useMyClubsV2(user?.id ?? null);
  const { errors } = useFormState<PostFormValuesV2>({ control: form.control });
  const formatError = readError(errors, 'format');
  const clubs = myClubs.clubs ?? [];

  useEffect(() => {
    if (values.audience === 'club') void myClubs.load();
  }, [myClubs, values.audience]);

  useEffect(() => {
    if (values.format === 'event') {
      if (!values.eventDate) {
        form.setValue('eventDate', todayIso(), { shouldDirty: false, shouldValidate: false });
      }
      void sortiesState.load();
    }
  }, [form, sortiesState, values.eventDate, values.format]);

  const goToSortieUpstream = () => {
    const title = values.title.trim() || values.content.trim().slice(0, 60);
    requestCreate('sortie', {
      ...(title ? { title } : {}),
      ...(values.eventDate ? { date: values.eventDate } : {}),
      ...(values.location.trim() ? { place: values.location.trim() } : {}),
      returnToPostEvent: true,
    });
  };

  return (
    <>
      <div className="lkdv-cv2c-section-head">
        <span className="lkdv-cv2-field-label" id="cv2c-format-label">
          Format
        </span>
      </div>
      <div className="lkdv-cv2c-format-grid" role="radiogroup" aria-labelledby="cv2c-format-label">
        {FORMAT_OPTIONS.map((option) => {
          const active = !voiceMode && values.format === option.value;
          return (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={active}
              className="lkdv-cv2c-format-card"
              data-active={active}
              onClick={() => {
                onVoiceModeChange?.(false);
                form.setValue('format', option.value, { shouldValidate: true, shouldDirty: true });
                if (option.value === 'event' && !form.getValues('eventDate')) {
                  form.setValue('eventDate', todayIso(), { shouldDirty: true });
                }
              }}
            >
              <span className="lkdv-cv2c-format-ico" aria-hidden="true">
                {option.icon}
              </span>
              <b>{option.label}</b>
              <small>{option.description}</small>
            </button>
          );
        })}
        {onVoiceModeChange ? (
          <button
            type="button"
            role="radio"
            aria-checked={voiceMode}
            className="lkdv-cv2c-format-card"
            data-active={voiceMode}
            style={{ gridColumn: '1 / -1' }}
            onClick={() => onVoiceModeChange(true)}
          >
            <span className="lkdv-cv2c-format-ico" aria-hidden="true">
              <Mic size={22} aria-hidden="true" />
            </span>
            <b>Note vocale</b>
            <small>Enregistrer un audio</small>
          </button>
        ) : null}
      </div>
      {values.format === 'event' ? (
        <div className="lkdv-cv2c-event-format-flow" data-testid="cv2c-event-flow">
          <DateFieldV2
            name="eventDate"
            label="Date de l’événement"
            required
            min={todayIso()}
          />
          <SortieAttachmentPanel
            sorties={sortiesState.sorties}
            loading={sortiesState.loading}
            error={sortiesState.error}
            onCreateSortie={goToSortieUpstream}
          />
        </div>
      ) : null}
      {formatError ? (
        <p className="lkdv-cv2-field-error" role="alert">
          {formatError}
        </p>
      ) : null}

      <VisibilityPickerV2
        name="audience"
        label="Visibilité"
        options={[
          { value: 'public', label: 'Public' },
          { value: 'abonnies', label: 'Privé' },
          { value: 'club', label: 'Club' },
        ]}
        clubs={clubs}
        clubsLoading={myClubs.loading}
        clubsError={myClubs.error}
        onCreateClub={() => requestCreate('club')}
      />
      {!user ? (
        <p className="lkdv-cv2c-warning">Connecte-toi pour publier dans la communauté.</p>
      ) : null}
    </>
  );
}

interface ContentStepProps {
  user: User | null;
  activePhotoIndex: number;
  setActivePhotoIndex: (index: number) => void;
  activeCategory: PhotoEditorCategory | null;
  setActiveCategory: (cat: PhotoEditorCategory | null) => void;
  onTriggerFileInput: () => void;
  onRemovePhoto: (index: number) => void;
  onChangeModifier: <K extends keyof PhotoModifiersV2>(key: K, value: PhotoModifiersV2[K]) => void;
  onResetCategory: (cat: PhotoEditorCategory) => void;
}

function ContentStep({
  user: _user,
  sortiesState,
  onCreateSortieUpstream,
  activePhotoIndex,
  setActivePhotoIndex,
  activeCategory,
  setActiveCategory,
  onTriggerFileInput,
  onRemovePhoto,
  onChangeModifier,
  onResetCategory,
}: ContentStepProps & {
  sortiesState: ReturnType<typeof useMySortiesV2>;
  onCreateSortieUpstream: () => void;
}) {
  const form = useFormContext<PostFormValuesV2>();
  const values = form.watch();
  const format = values.format;
  const isPublic = values.audience === 'public';
  const progress = mediaProgress(values.media ?? []);
  const { errors } = useFormState<PostFormValuesV2>({ control: form.control });
  const mediaError = readError(errors, 'media');

  const safeIndex = Math.min(
    Math.max(0, activePhotoIndex),
    Math.max(0, values.media.length - 1),
  );
  const activeMedia = values.media[safeIndex];

  const allowComments = values.allowComments ?? true;
  const allowLikes = values.allowLikes ?? true;
  const scheduleEnabled = values.scheduleEnabled ?? false;

  return (
    <>
      {mediaError ? (
        <p className="lkdv-cv2-field-error" role="alert">
          {mediaError}
        </p>
      ) : null}

      {format === 'event' ? (
        <div className="lkdv-cv2-card lkdv-cv2c-event-linked-summary" data-testid="cv2c-event-step2-sortie">
          <div className="lkdv-cv2c-section-head">
            <span className="lkdv-cv2-field-label">
              {values.eventDate ? `Événement du ${formatFrenchDate(values.eventDate)}` : 'Événement'}
            </span>
            <button
              type="button"
              className="lkdv-cv2-chip lkdv-cv2-chip--sm"
              onClick={onCreateSortieUpstream}
            >
              <Plus size={12} aria-hidden="true" />
              {values.linkedEventId ? 'Nouvelle sortie' : 'Créer la sortie'}
            </button>
          </div>
          {values.linkedEventId ? (
            <div className="lkdv-cv2c-event-linked-pill">
              <Compass size={14} aria-hidden="true" />
              <span>
                Sortie rattachée : <b>{values.linkedEventTitle || 'Sortie sélectionnée'}</b>
              </span>
              <button
                type="button"
                className="lkdv-cv2-chip lkdv-cv2-chip--sm"
                onClick={() => {
                  form.setValue('linkedEventId', '', { shouldDirty: true, shouldValidate: true });
                  form.setValue('linkedEventTitle', '', { shouldDirty: true });
                }}
              >
                Détacher
              </button>
            </div>
          ) : (
            <p className="lkdv-cv2-field-hint">
              Aucune sortie rattachée — tu peux en créer une ou publier l’annonce directement.
            </p>
          )}
        </div>
      ) : null}

      {format === 'billet' || format === 'question' || format === 'event' ? (
        <TextFieldV2
          name="title"
          label={
            format === 'question'
              ? 'Titre de la question'
              : format === 'event'
                ? 'Titre de l’événement'
                : 'Titre'
          }
          placeholder={
            format === 'question'
              ? 'Votre meilleur spot pour bivouaquer ?'
              : format === 'event'
                ? 'Sortie lever de soleil au Lac Blanc'
                : 'Lac Blanc au lever du jour'
          }
          required
          maxLength={120}
        />
      ) : null}

      <TextAreaFieldV2
        name="content"
        label={
          format === 'photo'
            ? 'Légende'
            : format === 'event'
              ? 'Détails & programme'
              : 'Texte'
        }
        placeholder={
          format === 'question'
            ? 'Pose ta question… (@mention, #hashtag)'
            : format === 'event'
              ? 'Heure de RDV, matériel conseillé, programme… (@mention, #hashtag)'
              : 'Raconte, partage… (@mention, #hashtag)'
        }
        maxLength={600}
        required={format !== 'photo' && !(format === 'event' && Boolean(values.linkedEventId))}
      />

      <PlaceFieldV2
        name="location"
        label="Lieu"
        latName="locationLat"
        lngName="locationLng"
        placeholder="Lac Blanc, Chamonix…"
      />

      {/* Switches de publication transférés depuis l'ancienne étape Diffusion (F1.6) */}
      <div className="lkdv-cv2-card lkdv-cv2c-inert-switches" data-testid="post-publication-switches">
        <span className="lkdv-cv2c-inert-row">
          <span>
            <b>Autoriser les commentaires</b>
            <small>Les membres pourront répondre</small>
          </span>
          <button
            type="button"
            className="lkdv-cv2c-switch"
            role="switch"
            aria-label="Autoriser les commentaires"
            aria-checked={allowComments}
            onClick={() =>
              form.setValue('allowComments', !allowComments, { shouldDirty: true })
            }
          >
            <span className="lkdv-cv2c-switch-track" aria-hidden="true">
              <span className="lkdv-cv2c-switch-dot" />
            </span>
          </button>
        </span>

        <span className="lkdv-cv2c-inert-row">
          <span>
            <b>Autoriser les j’aime</b>
            <small>Affiche le compteur de j’aime</small>
          </span>
          <button
            type="button"
            className="lkdv-cv2c-switch"
            role="switch"
            aria-label="Autoriser les j’aime"
            aria-checked={allowLikes}
            onClick={() =>
              form.setValue('allowLikes', !allowLikes, { shouldDirty: true })
            }
          >
            <span className="lkdv-cv2c-switch-track" aria-hidden="true">
              <span className="lkdv-cv2c-switch-dot" />
            </span>
          </button>
        </span>

        <span className="lkdv-cv2c-inert-row">
          <span>
            <b>Programmer la publication</b>
            <small>Choisis la date et l’heure d’envoi</small>
          </span>
          <button
            type="button"
            className="lkdv-cv2c-switch"
            role="switch"
            aria-label="Programmer la publication"
            aria-checked={scheduleEnabled}
            onClick={() =>
              form.setValue('scheduleEnabled', !scheduleEnabled, { shouldDirty: true })
            }
          >
            <span className="lkdv-cv2c-switch-track" aria-hidden="true">
              <span className="lkdv-cv2c-switch-dot" />
            </span>
          </button>
        </span>

        {scheduleEnabled ? (
          <div className="lkdv-cv2c-date-range">
            <DateFieldV2
              name="scheduleDate"
              label="Date"
              min={new Date().toISOString().slice(0, 10)}
            />
            <TimeFieldV2 name="scheduleTime" label="Heure" />
          </div>
        ) : (
          <div className="lkdv-cv2c-date-range">
            <span className="lkdv-cv2-chip">
              <CalendarDays size={14} aria-hidden="true" />
              Publication immédiate
            </span>
          </div>
        )}
      </div>

      {progress.pending > 0 ? (
        <p className="lkdv-cv2c-send-note" role="status">
          Envoi des médias… {progress.percent} %
        </p>
      ) : null}
    </>
  );
}

function PostBody({
  api,
  user,
  prefill,
  prefillNonce,
  activePhotoIndex,
  setActivePhotoIndex,
  activeCategory,
  setActiveCategory,
  previewCollapsed,
  setPreviewCollapsed,
  savedModifiersRef,
  voiceMode = false,
  onVoiceModeChange,
  voiceStepContent,
}: {
  api: CreateFormEngineApiV2<PostFormValuesV2>;
  user: User | null;
  prefill?: Record<string, unknown> | null;
  prefillNonce?: number;
  activePhotoIndex: number;
  setActivePhotoIndex: React.Dispatch<React.SetStateAction<number>>;
  activeCategory: PhotoEditorCategory | null;
  setActiveCategory: React.Dispatch<React.SetStateAction<PhotoEditorCategory | null>>;
  previewCollapsed: boolean;
  setPreviewCollapsed: React.Dispatch<React.SetStateAction<boolean>>;
  savedModifiersRef: React.MutableRefObject<Record<string, PhotoModifiersV2>>;
  voiceMode?: boolean;
  onVoiceModeChange?: (active: boolean) => void;
  voiceStepContent?: React.ReactNode;
}) {
  const form = api.form;
  const values = form.watch();
  const { requestCreate } = useCreateSheet();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const sortiesState = useMySortiesV2(user?.id ?? null);
  const lastPrefillNonceRef = useRef<number>(-1);

  useEffect(() => {
    if (!prefill || prefillNonce === undefined || prefillNonce === lastPrefillNonceRef.current) return;
    lastPrefillNonceRef.current = prefillNonce;
    if (typeof prefill.format === 'string') {
      form.setValue('format', prefill.format as PostFormValuesV2['format'], { shouldDirty: true });
    }
    if (typeof prefill.eventDate === 'string' && prefill.eventDate) {
      form.setValue('eventDate', prefill.eventDate, { shouldDirty: true });
    }
    if (typeof prefill.linkedEventId === 'string' && prefill.linkedEventId) {
      form.setValue('linkedEventId', prefill.linkedEventId, { shouldDirty: true, shouldValidate: true });
    }
    if (typeof prefill.linkedEventTitle === 'string' && prefill.linkedEventTitle) {
      form.setValue('linkedEventTitle', prefill.linkedEventTitle, { shouldDirty: true });
      if (!form.getValues('title')?.trim()) {
        form.setValue('title', prefill.linkedEventTitle, { shouldDirty: true });
      }
    }
    if (typeof prefill.location === 'string' && prefill.location && !form.getValues('location')?.trim()) {
      form.setValue('location', prefill.location, { shouldDirty: true });
    }
    void sortiesState.reload();
    if (prefill.step === 1) {
      api.setStep(1);
    }
  }, [api, form, prefill, prefillNonce, sortiesState]);

  const handleTriggerFileInput = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleFilesSelected = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (!files || files.length === 0) return;

      const currentMedia = form.getValues('media') ?? [];
      const remaining = POST_MEDIA_MAX_COUNT - currentMedia.length;
      if (remaining <= 0) return;

      const addedFiles = Array.from(files).slice(0, remaining);
      const newItems: MediaItemV2[] = addedFiles.map((file, idx) => {
        const id = `photo-${Date.now()}-${idx}-${Math.random().toString(36).slice(2, 7)}`;
        const previewUrl =
          typeof URL !== 'undefined' && typeof URL.createObjectURL === 'function'
            ? URL.createObjectURL(file)
            : '';
        return {
          id,
          name: file.name,
          type: file.type || 'image/jpeg',
          size: file.size,
          previewUrl,
          url: previewUrl,
          alt: '',
          cover: currentMedia.length === 0 && idx === 0,
          status: 'uploaded',
          progress: 100,
          storageBucket: 'carnet-media',
          storagePath: `posts/${id}`,
          crop: '4:5',
          modifiers: { ...DEFAULT_PHOTO_MODIFIERS },
        };
      });

      const nextMedia = [...currentMedia, ...newItems];
      form.setValue('media', nextMedia, { shouldValidate: true, shouldDirty: true });
      setActivePhotoIndex(currentMedia.length);
      e.target.value = '';

      if (user?.id) {
        addedFiles.forEach((file, idx) => {
          const itemId = newItems[idx].id;
          void uploadMediaV2(file, {
            userId: user.id,
            bucket: 'carnet-media',
          })
            .then((uploaded) => {
              const latest = form.getValues('media') ?? [];
              const updated = latest.map((m) =>
                m.id === itemId
                  ? {
                      ...m,
                      url: uploaded.url,
                      storageBucket: uploaded.bucket,
                      storagePath: uploaded.path,
                      status: 'uploaded' as const,
                      progress: 100,
                      modifiers:
                        savedModifiersRef.current[itemId] ??
                        m.modifiers ??
                        DEFAULT_PHOTO_MODIFIERS,
                    }
                  : m,
              );
              form.setValue('media', updated, { shouldDirty: true, shouldValidate: true });
            })
            .catch(() => {
              /* conserve l'aperçu en cas d'erreur réseau */
            });
        });
      }
    },
    [form, savedModifiersRef, setActivePhotoIndex, user?.id],
  );

  const handleRemovePhoto = useCallback(
    (index: number) => {
      const currentMedia = form.getValues('media') ?? [];
      const nextMedia = currentMedia.filter((_, i) => i !== index);
      form.setValue('media', nextMedia, { shouldValidate: true, shouldDirty: true });
      if (activePhotoIndex >= nextMedia.length) {
        setActivePhotoIndex(Math.max(0, nextMedia.length - 1));
      }
    },
    [activePhotoIndex, form],
  );

  const handleChangeModifier = useCallback(
    <K extends keyof PhotoModifiersV2>(key: K, value: PhotoModifiersV2[K]) => {
      const currentMedia = form.getValues('media') ?? [];
      const safeIndex = Math.min(
        Math.max(0, activePhotoIndex),
        Math.max(0, currentMedia.length - 1),
      );
      if (!currentMedia[safeIndex]) return;

      const nextMedia = [...currentMedia];
      const item = nextMedia[safeIndex];
      const nextMods: PhotoModifiersV2 = {
        ...(savedModifiersRef.current[item.id] ?? item.modifiers ?? DEFAULT_PHOTO_MODIFIERS),
        [key]: value,
      };
      savedModifiersRef.current[item.id] = nextMods;
      nextMedia[safeIndex] = {
        ...item,
        modifiers: nextMods,
      };
      form.setValue('media', nextMedia, { shouldDirty: true, shouldTouch: true });
    },
    [activePhotoIndex, form, savedModifiersRef],
  );

  const handleResetCategory = useCallback(
    (cat: PhotoEditorCategory) => {
      const currentMedia = form.getValues('media') ?? [];
      const safeIndex = Math.min(
        Math.max(0, activePhotoIndex),
        Math.max(0, currentMedia.length - 1),
      );
      if (!currentMedia[safeIndex]) return;

      const nextMedia = [...currentMedia];
      const item = nextMedia[safeIndex];
      const currentMods = {
        ...(savedModifiersRef.current[item.id] ?? item.modifiers ?? DEFAULT_PHOTO_MODIFIERS),
      };
      const spec = PHOTO_EDITOR_CATEGORIES.find((c) => c.id === cat);
      if (spec) {
        for (const mod of spec.modifiers) {
          (currentMods as any)[mod.key] = mod.defaultValue;
        }
      }
      savedModifiersRef.current[item.id] = currentMods;
      nextMedia[safeIndex] = {
        ...item,
        modifiers: currentMods,
      };
      form.setValue('media', nextMedia, { shouldDirty: true, shouldTouch: true });
    },
    [activePhotoIndex, form, savedModifiersRef],
  );

  const handleSelectCategory = useCallback(
    (category: PhotoEditorCategory) => {
      setActiveCategory((prev) => (prev === category ? null : category));
    },
    [],
  );

  const rawMediaList = values.media ?? [];
  const mediaList = rawMediaList.map((item) =>
    savedModifiersRef.current[item.id]
      ? { ...item, modifiers: savedModifiersRef.current[item.id] }
      : item,
  );
  const hydratedValues = { ...values, media: mediaList };
  const safePhotoIndex = Math.min(Math.max(0, activePhotoIndex), Math.max(0, mediaList.length - 1));
  const activePhotoModifiers = mediaList[safePhotoIndex]?.modifiers ?? DEFAULT_PHOTO_MODIFIERS;
  const isEditorOpen = Boolean(activeCategory && mediaList.length > 0);

  return (
    <>
      {api.active && !voiceMode ? (
        <SheetPreview compact={false}>
          <PostHeroPreview
            values={hydratedValues}
            user={user}
            activePhotoIndex={activePhotoIndex}
            activeCategory={activeCategory}
            onSelectCategory={handleSelectCategory}
            onTriggerFileInput={handleTriggerFileInput}
            fileInputRef={fileInputRef}
            onFilesSelected={handleFilesSelected}
            onRemoveActivePhoto={() => handleRemovePhoto(safePhotoIndex)}
            onPassToStory={() => {
              const target = mediaList[safePhotoIndex];
              if (!target) return;
              requestCreate('story', { media: [target] });
            }}
            collapsed={isEditorOpen ? false : previewCollapsed}
            onExpand={() => setPreviewCollapsed(false)}
          />
          {!isEditorOpen && !previewCollapsed ? (
            <PhotoThumbnailStrip
              media={mediaList}
              activeIndex={safePhotoIndex}
              onSelectPhoto={setActivePhotoIndex}
              onRemovePhoto={handleRemovePhoto}
              onReorderPhotos={(nextMedia) => {
                form.setValue('media', nextMedia, { shouldDirty: true, shouldTouch: true });
              }}
              onAddPhotoClick={handleTriggerFileInput}
              maxCount={POST_MEDIA_MAX_COUNT}
            />
          ) : null}
          <AnimatePresence initial={false}>
            {isEditorOpen && activeCategory ? (
              <PhotoEditorCard
                key="post-photo-editor"
                category={activeCategory}
                modifiers={activePhotoModifiers}
                onChangeModifier={handleChangeModifier}
                onResetCategory={handleResetCategory}
                onClose={() => setActiveCategory(null)}
              />
            ) : null}
          </AnimatePresence>
        </SheetPreview>
      ) : null}
      {!isEditorOpen && api.step === 0 ? (
        <FormatStep
          sortiesState={sortiesState}
          voiceMode={voiceMode}
          onVoiceModeChange={onVoiceModeChange}
        />
      ) : null}
      {!isEditorOpen && api.step === 1 ? (
        voiceMode && voiceStepContent ? (
          <>{voiceStepContent}</>
        ) : (
          <ContentStep
          user={user}
          sortiesState={sortiesState}
          onCreateSortieUpstream={() => {
            const title = values.title.trim() || values.content.trim().slice(0, 60);
            requestCreate('sortie', {
              ...(title ? { title } : {}),
              ...(values.eventDate ? { date: values.eventDate } : {}),
              ...(values.location.trim() ? { place: values.location.trim() } : {}),
              returnToPostEvent: true,
            });
          }}
          activePhotoIndex={activePhotoIndex}
          setActivePhotoIndex={setActivePhotoIndex}
          activeCategory={activeCategory}
          setActiveCategory={setActiveCategory}
          onTriggerFileInput={handleTriggerFileInput}
          onRemovePhoto={handleRemovePhoto}
          onChangeModifier={handleChangeModifier}
          onResetCategory={handleResetCategory}
        />
        )
      ) : null}
    </>
  );
}

/**
 * Publication V2 (Refonte Milestone 1) : Format → Contenu (2 étapes).
 * L'étape Diffusion et sa carte récapitulative sont supprimées.
 * La retouche photo Instagram (3 catégories, 15 modificateurs) et le carrousel
 * de miniatures sont intégrés directement avec proportions réalistes.
 */
export function PostFormV2({
  active,
  prefill,
  prefillNonce,
  onNavChange,
  stepHosts,
  voiceMode = false,
  onVoiceModeChange,
  voiceStepContent,
}: CreateFormV2Props) {
  const { user, reportCreated } = useCreateSheet();
  const defaults = useRef(createDefaultsV2('post')).current;
  const [activePhotoIndex, setActivePhotoIndex] = useState(0);
  const [activeCategory, setActiveCategory] = useState<PhotoEditorCategory | null>(null);
  const [previewCollapsed, setPreviewCollapsed] = useScrollCollapsePreview(
    active,
    activeCategory !== null,
  );
  const savedModifiersRef = useRef<Record<string, PhotoModifiersV2>>({});

  return (
    <CreateFormEngineV2<PostFormValuesV2>
      kind="post"
      schema={postSchemaV2}
      defaultValues={defaults}
      active={active}
      disabled={!user}
      onNavChange={onNavChange}
      stepHosts={stepHosts}
      onSubmit={async (values) => {
        try {
          const result = await createCommunityPostV2(values);
          reportCreated('post', { id: result.id });
        } catch (error) {
          // Aucun média orphelin dans le bucket si l'écriture échoue.
          await deleteMediaObjectsV2(uploadedObjectsOf(values.media));
          throw error;
        }
      }}
    >
      {(api) => (
        <PostBody
          api={api}
          user={user}
          prefill={prefill}
          prefillNonce={prefillNonce}
          activePhotoIndex={activePhotoIndex}
          setActivePhotoIndex={setActivePhotoIndex}
          activeCategory={activeCategory}
          setActiveCategory={setActiveCategory}
          previewCollapsed={previewCollapsed}
          setPreviewCollapsed={setPreviewCollapsed}
          savedModifiersRef={savedModifiersRef}
          voiceMode={voiceMode}
          onVoiceModeChange={onVoiceModeChange}
          voiceStepContent={voiceStepContent}
        />
      )}
    </CreateFormEngineV2>
  );
}

export default PostFormV2;
