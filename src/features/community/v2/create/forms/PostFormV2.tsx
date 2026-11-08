'use client';

import React, { useRef } from 'react';
import { CalendarDays, Camera, HelpCircle, PenLine } from 'lucide-react';
import { useFormContext } from 'react-hook-form';
import { CommunityFeedPost } from '@/features/community/feed/CommunityFeedPost';
import type { FeedPost } from '@/features/community/feed/useCommunityFeed';
import type { User } from '@supabase/supabase-js';
import {
  CreateFormEngineV2,
  type CreateFormEngineApiV2,
} from '../engine/CreateFormEngineV2';
import { createDefaultsV2, postSchemaV2, type PostFormValuesV2 } from '../engine/createSchemasV2';
import { createKindConfig, stepAriaLabel } from '../engine/steps';
import { useCreateSheet } from '../CreateSheetContext';
import { createCommunityPostV2 } from '../createRpc';
import { SegmentedFieldV2 } from '../fields/ChipsV2';
import { TextAreaFieldV2, TextFieldV2 } from '../fields/FieldV2';
import { MediaFieldV2 } from '../fields/MediaFieldV2';
import { MentionFieldV2 } from '../fields/MentionFieldV2';
import { PlaceFieldV2 } from '../fields/PlaceFieldV2';
import { TagsFieldV2 } from '../fields/TagsFieldV2';
import { IMAGE_LIMITS, mediaProgress } from '../fields/media';
import { deleteMediaObjectsV2, uploadedObjectsOf } from '../fields/media';
import type { CreateFormV2Props } from './types';

const FORMAT_OPTIONS = [
  {
    value: 'photo',
    label: 'Photo',
    description: 'Montrer un moment',
    icon: <Camera size={18} aria-hidden="true" />,
  },
  {
    value: 'billet',
    label: 'Billet',
    description: 'Raconter une histoire',
    icon: <PenLine size={18} aria-hidden="true" />,
  },
  {
    value: 'question',
    label: 'Question',
    description: 'Demander à la communauté',
    icon: <HelpCircle size={18} aria-hidden="true" />,
  },
] as const;

const AUDIENCE_OPTIONS = [
  { value: 'public', label: 'Fil public', description: 'Visible par toute la communauté' },
  { value: 'abonnies', label: 'Mes abonnés', description: 'Seuls tes abonnés le voient' },
  { value: 'club', label: 'Un club', description: 'Réservé aux membres du club' },
] as const;

function previewPost(values: PostFormValuesV2, user: User | null): FeedPost {
  const media = values.media.filter((item) => item.status === 'uploaded' || item.previewUrl);
  const urls = media.map((item) => item.previewUrl || item.url).filter(Boolean);
  const metadata = (user?.user_metadata ?? {}) as Record<string, unknown>;
  return {
    id: 'cv2c-preview',
    author_id: user?.id ?? null,
    content: values.content.trim() || 'Ton aperçu apparaîtra ici.',
    title: values.title || null,
    location: values.location || null,
    image_url: urls[0] ?? null,
    image_alt: media[0]?.alt ?? '',
    media_urls: urls,
    created_at: new Date().toISOString(),
    likes_count: 0,
    comments_count: 0,
    shares_count: 0,
    post_type: values.format === 'question' ? 'question' : 'post',
    author: {
      id: user?.id ?? 'preview',
      full_name:
        (metadata.full_name as string | undefined) ??
        (metadata.name as string | undefined) ??
        'Toi',
      avatar_url: (metadata.avatar_url as string | undefined) ?? null,
      handle: (metadata.handle as string | undefined) ?? null,
      location: null,
      trust_score: null,
    },
  };
}

function FormatStep() {
  const form = useFormContext<PostFormValuesV2>();
  const values = form.watch();
  const { requestCreate, user } = useCreateSheet();
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
        <button type="button" className="lkdv-cv2c-format-card" onClick={() => requestCreate('sortie')}>
          <span className="lkdv-cv2c-format-ico" aria-hidden="true">
            <CalendarDays size={18} />
          </span>
          <b>Événement</b>
          <small>Donner rendez-vous (formulaire Sortie)</small>
        </button>
      </div>

      <span className="lkdv-cv2-field-label" id="cv2c-audience-label">
        Audience
      </span>
      <div className="lkdv-cv2c-audience-list" role="radiogroup" aria-labelledby="cv2c-audience-label">
        {AUDIENCE_OPTIONS.map((option) => {
          const active = values.audience === option.value;
          return (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={active}
              className="lkdv-cv2c-audience-card"
              data-active={active}
              onClick={() =>
                form.setValue('audience', option.value, { shouldValidate: true, shouldDirty: true })
              }
            >
              <span className="lkdv-cv2c-radio" aria-hidden="true" />
              <span>
                <b>{option.label}</b>
                <small>{option.description}</small>
              </span>
            </button>
          );
        })}
      </div>
      {values.audience === 'club' ? (
        <TextFieldV2
          name="clubId"
          label="Club"
          placeholder="Identifiant du club"
          hint="Colle l’identifiant du club (l’Explorer fournit la liste)."
          required
        />
      ) : null}
      {!user ? (
        <p className="lkdv-cv2c-warning">Connecte-toi pour publier dans la communauté.</p>
      ) : null}
    </>
  );
}

function ContentStep({ user }: { user: User | null }) {
  const form = useFormContext<PostFormValuesV2>();
  const values = form.watch();
  const format = values.format;
  const isPublic = values.audience === 'public';
  const contentMax = format === 'photo' ? 600 : 2000;
  const progress = mediaProgress(values.media ?? []);

  return (
    <>
      {!isPublic ? (
        <p className="lkdv-cv2c-warning" role="status">
          Les médias ne sont disponibles que pour une publication publique : ta publication partira
          sans photo.
        </p>
      ) : (
        <MediaFieldV2
          name="media"
          label={format === 'question' ? 'Photos (optionnel)' : 'Photos'}
          userId={user?.id ?? ''}
          limits={IMAGE_LIMITS}
          max={10}
          showAlt
          showCoverChoice
          hint={format === 'photo' ? 'Jusqu’à 10 photos. Glisse les vignettes pour changer l’ordre.' : undefined}
        />
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
      <TextAreaFieldV2
        name="content"
        label={format === 'photo' ? 'Légende' : 'Texte'}
        placeholder={
          format === 'question' ? 'Pose ta question à la communauté…' : 'Raconte, partage, demande…'
        }
        maxLength={contentMax}
        required={format !== 'photo'}
        hint="Tape @ pour mentionner, # pour un hashtag"
      />
      <PlaceFieldV2
        name="location"
        label="Lieu"
        latName="locationLat"
        lngName="locationLng"
        placeholder="Lac Blanc, Chamonix…"
        hint="La position est enregistrée pour la carte."
      />
      {progress.pending > 0 ? (
        <p className="lkdv-cv2c-send-note" role="status">
          Envoi des médias… {progress.percent} %
        </p>
      ) : null}
    </>
  );
}

function DiffusionStep() {
  const form = useFormContext<PostFormValuesV2>();
  const values = form.watch();
  return (
    <>
      <div className="lkdv-cv2-card lkdv-cv2c-recap">
        <span className="lkdv-cv2-eyebrow">Diffusion</span>
        <b>
          {values.audience === 'public'
            ? 'Fil public'
            : values.audience === 'abonnies'
              ? 'Mes abonnés'
              : 'Un club'}
        </b>
        <small>
          {values.format === 'photo' ? 'Photo' : values.format === 'billet' ? 'Billet' : 'Question'}
          {values.media.length > 0
            ? ` · ${values.media.length} photo${values.media.length > 1 ? 's' : ''}`
            : ''}
        </small>
      </div>
      <TagsFieldV2 />
      <MentionFieldV2 />
      <SegmentedFieldV2
        label="Commentaires et j’aime"
        options={[
          { value: 'on', label: 'Activés' },
          { value: 'off', label: 'Masqués' },
        ]}
        value="on"
        onChange={() => undefined}
      />
      <p className="lkdv-cv2-field-hint">
        Le réglage des commentaires et la programmation seront activés dans une prochaine version.
      </p>
    </>
  );
}

function PostBody({
  api,
  user,
}: {
  api: CreateFormEngineApiV2<PostFormValuesV2>;
  user: User | null;
}) {
  const values = api.form.watch();
  const preview = previewPost(values, user);
  return (
    <>
      <div className="lkdv-cv2c-live-preview" inert aria-hidden="true">
        <CommunityFeedPost post={preview} user={user} embedded />
      </div>
      <p className="lkdv-cv2c-preview-caption" aria-hidden="true">
        Aperçu vivant · {stepAriaLabel(api.step, createKindConfig('post').steps[api.step]?.label ?? '')}
      </p>
      {api.step === 0 ? <FormatStep /> : null}
      {api.step === 1 ? <ContentStep user={user} /> : null}
      {api.step === 2 ? <DiffusionStep /> : null}
    </>
  );
}

/**
 * Publication V2 (`Publication#1-20`) : Format → Contenu → Diffusion.
 * L'audience est choisie **avant** les médias (`Publication#5`) ; l'aperçu
 * vivant est le vrai composant `CommunityFeedPost` (`Publication#4`).
 */
export function PostFormV2({ active, onNavChange }: CreateFormV2Props) {
  const { user, reportCreated } = useCreateSheet();
  const defaults = useRef(createDefaultsV2('post')).current;

  return (
    <CreateFormEngineV2<PostFormValuesV2>
      kind="post"
      schema={postSchemaV2}
      defaultValues={defaults}
      active={active}
      disabled={!user}
      onNavChange={onNavChange}
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
      {(api) => <PostBody api={api} user={user} />}
    </CreateFormEngineV2>
  );
}

export default PostFormV2;
