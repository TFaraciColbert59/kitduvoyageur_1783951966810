'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowRight, CalendarDays, Camera, Globe, HelpCircle, Lock, PenLine, Users } from 'lucide-react';
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
import { deleteMediaObjectsV2, uploadedObjectsOf } from '../fields/media';
import { SheetPreview } from '../../shared/SheetPreview';
import type { CreateFormV2Props } from './types';
import { PostHeroPreview } from '../photo/PostHeroPreview';
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

function FormatStep() {
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

  const goToSortie = () => {
    const title = values.title.trim() || values.content.trim().slice(0, 60);
    requestCreate('sortie', title ? { title } : undefined);
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
          const active = values.format === option.value;
          return (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={active}
              className="lkdv-cv2c-format-card"
              data-active={active}
              onClick={() =>
                form.setValue('format', option.value, { shouldValidate: true, shouldDirty: true })
              }
            >
              <span className="lkdv-cv2c-format-ico" aria-hidden="true">
                {option.icon}
              </span>
              <b>{option.label}</b>
              <small>{option.description}</small>
            </button>
          );
        })}
      </div>
      {values.format === 'event' ? (
        <>
          <p className="lkdv-cv2-card lkdv-cv2-field-hint" data-testid="cv2c-event-note">
            <b>Un événement se crée dans le formulaire Sortie.</b> Date, lieu, capacité et sécurité
            y sont réunis, et l’annonce part avec la sortie, en une seule fois.
          </p>
          <button
            type="button"
            className="lkdv-cv2-pill lkdv-cv2-pill--secondary lkdv-cv2c-format-cta"
            onClick={goToSortie}
          >
            Créer dans Sortie
            <ArrowRight size={15} aria-hidden="true" />
          </button>
        </>
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
      {values.audience !== 'public' && values.media.length > 0 ? (
        <div className="lkdv-cv2c-warning" role="alert">
          <b>Les médias ne sont autorisés que dans le fil public.</b> {values.media.length} média
          {values.media.length > 1 ? 's' : ''} ajouté{values.media.length > 1 ? 's' : ''}.
          <button
            type="button"
            className="lkdv-cv2c-linkbtn"
            onClick={() => {
              form.setValue('audience', 'public', { shouldDirty: true, shouldValidate: true });
              form.setValue('clubId', '', { shouldDirty: true, shouldValidate: true });
            }}
          >
            Passer en fil public
          </button>
        </div>
      ) : null}
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
  activePhotoIndex,
  setActivePhotoIndex,
  activeCategory,
  setActiveCategory,
  onTriggerFileInput,
  onRemovePhoto,
  onChangeModifier,
  onResetCategory,
}: ContentStepProps) {
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
      {format === 'event' ? (
        <p className="lkdv-cv2-field-hint">
          Ce format ne se publie pas ici : choisis « Créer dans Sortie » à l’étape Format.
        </p>
      ) : !isPublic ? (
        <p className="lkdv-cv2c-warning" role="status">
          Les médias ne sont disponibles que pour une publication publique : ta publication partira
          sans photo.
        </p>
      ) : (
        <>
          {/* Bandeau de miniatures horizontales (F1.2) */}
          <PhotoThumbnailStrip
            media={values.media}
            activeIndex={safeIndex}
            onSelectPhoto={setActivePhotoIndex}
            onRemovePhoto={onRemovePhoto}
            onAddPhotoClick={onTriggerFileInput}
            maxCount={POST_MEDIA_MAX_COUNT}
          />

          {mediaError ? (
            <p className="lkdv-cv2-field-error" role="alert">
              {mediaError}
            </p>
          ) : null}
        </>
      )}

      {format === 'billet' || format === 'question' ? (
        <TextFieldV2
          name="title"
          label={format === 'question' ? 'Titre de la question' : 'Titre'}
          placeholder={
            format === 'question'
              ? 'Votre meilleur spot pour bivouaquer ?'
              : 'Lac Blanc au lever du jour'
          }
          required
          maxLength={120}
        />
      ) : null}

      {format !== 'event' ? (
        <TextAreaFieldV2
          name="content"
          label={format === 'photo' ? 'Légende' : 'Texte'}
          placeholder={
            format === 'question'
              ? 'Pose ta question… (@mention, #hashtag)'
              : 'Raconte, partage… (@mention, #hashtag)'
          }
          maxLength={600}
          required={format !== 'photo'}
        />
      ) : null}

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
  activePhotoIndex,
  setActivePhotoIndex,
  activeCategory,
  setActiveCategory,
  previewCollapsed,
  setPreviewCollapsed,
  savedModifiersRef,
}: {
  api: CreateFormEngineApiV2<PostFormValuesV2>;
  user: User | null;
  activePhotoIndex: number;
  setActivePhotoIndex: React.Dispatch<React.SetStateAction<number>>;
  activeCategory: PhotoEditorCategory | null;
  setActiveCategory: React.Dispatch<React.SetStateAction<PhotoEditorCategory | null>>;
  previewCollapsed: boolean;
  setPreviewCollapsed: React.Dispatch<React.SetStateAction<boolean>>;
  savedModifiersRef: React.MutableRefObject<Record<string, PhotoModifiersV2>>;
}) {
  const form = api.form;
  const values = form.watch();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

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
    },
    [form],
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

  return (
    <>
      {api.active ? (
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
            collapsed={previewCollapsed}
            onExpand={() => setPreviewCollapsed(false)}
          />
          {activeCategory && mediaList.length > 0 ? (
            <PhotoEditorCard
              category={activeCategory}
              modifiers={activePhotoModifiers}
              onChangeModifier={handleChangeModifier}
              onResetCategory={handleResetCategory}
              onClose={() => setActiveCategory(null)}
            />
          ) : null}
        </SheetPreview>
      ) : null}
      {api.step === 0 ? <FormatStep /> : null}
      {api.step === 1 ? (
        <ContentStep
          user={user}
          activePhotoIndex={activePhotoIndex}
          setActivePhotoIndex={setActivePhotoIndex}
          activeCategory={activeCategory}
          setActiveCategory={setActiveCategory}
          onTriggerFileInput={handleTriggerFileInput}
          onRemovePhoto={handleRemovePhoto}
          onChangeModifier={handleChangeModifier}
          onResetCategory={handleResetCategory}
        />
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
export function PostFormV2({ active, onNavChange, stepHosts }: CreateFormV2Props) {
  const { user, reportCreated } = useCreateSheet();
  const defaults = useRef(createDefaultsV2('post')).current;
  const [activePhotoIndex, setActivePhotoIndex] = useState(0);
  const [activeCategory, setActiveCategory] = useState<PhotoEditorCategory | null>(null);
  const [previewCollapsed, setPreviewCollapsed] = useState(false);
  const savedModifiersRef = useRef<Record<string, PhotoModifiersV2>>({});

  useEffect(() => {
    if (!active) return undefined;
    let expandTimer: number | null = null;
    const onScroll = (event: Event) => {
      const target = event.target as HTMLElement | null;
      if (!target) return;
      if (
        !target.classList?.contains('lkdv-cv2-pane') &&
        !target.classList?.contains('lkdv-lens-pane')
      ) {
        return;
      }
      const top = target.scrollTop;
      if (top > 12) {
        if (expandTimer !== null) {
          window.clearTimeout(expandTimer);
          expandTimer = null;
        }
        setPreviewCollapsed(true);
      } else if (top <= 4) {
        if (expandTimer === null) {
          expandTimer = window.setTimeout(() => {
            expandTimer = null;
            setPreviewCollapsed(false);
          }, 200);
        }
      }
    };
    document.addEventListener('scroll', onScroll, true);
    return () => {
      document.removeEventListener('scroll', onScroll, true);
      if (expandTimer !== null) window.clearTimeout(expandTimer);
    };
  }, [active]);

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
          activePhotoIndex={activePhotoIndex}
          setActivePhotoIndex={setActivePhotoIndex}
          activeCategory={activeCategory}
          setActiveCategory={setActiveCategory}
          previewCollapsed={previewCollapsed}
          setPreviewCollapsed={setPreviewCollapsed}
          savedModifiersRef={savedModifiersRef}
        />
      )}
    </CreateFormEngineV2>
  );
}

export default PostFormV2;
