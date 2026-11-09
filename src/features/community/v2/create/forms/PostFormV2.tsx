'use client';

import React, { useEffect, useRef } from 'react';
import { ArrowRight, CalendarDays, Camera, HelpCircle, Mountain, PenLine } from 'lucide-react';
import { useFormContext, useFormState } from 'react-hook-form';
import { CommunityFeedPost } from '@/features/community/feed/CommunityFeedPost';
import type { FeedPost } from '@/features/community/feed/useCommunityFeed';
import type { User } from '@supabase/supabase-js';
import {
  CreateFormEngineV2,
  type CreateFormEngineApiV2,
} from '../engine/CreateFormEngineV2';
import { createDefaultsV2, postSchemaV2, type PostFormValuesV2 } from '../engine/createSchemasV2';
import { useCreateSheet } from '../CreateSheetContext';
import { createCommunityPostV2 } from '../createRpc';
import { TextAreaFieldV2, TextFieldV2, readError } from '../fields/FieldV2';
import { MediaFieldV2 } from '../fields/MediaFieldV2';
import { PlaceFieldV2 } from '../fields/PlaceFieldV2';
import { IMAGE_LIMITS, mediaProgress } from '../fields/media';
import { useMyClubsV2 } from '../club/useMyClubsV2';
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
  {
    // Vraie radio de la grille (maquette L2771/L2811) : elle ne bascule plus
    // immédiatement sur Sortie, elle affiche la note + « Créer dans Sortie ».
    value: 'event',
    label: 'Événement',
    description: 'Donner rendez-vous',
    icon: <CalendarDays size={18} aria-hidden="true" />,
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
    content:
      values.content.trim() && values.format === 'billet' && values.title.trim()
        ? `${values.title.trim()}\n\n${values.content.trim()}`
        : values.content.trim() || 'Ton aperçu apparaîtra ici.',
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
  const myClubs = useMyClubsV2(user?.id ?? null);
  const { errors } = useFormState<PostFormValuesV2>({ control: form.control });
  const formatError = readError(errors, 'format');
  const clubError = readError(errors, 'clubId');
  const clubs = myClubs.clubs ?? [];

  useEffect(() => {
    if (values.audience === 'club') void myClubs.load();
  }, [myClubs, values.audience]);

  const goToSortie = () => {
    // Pont vers Sortie : titre (ou début de légende) prérempli (maquette L2864).
    const title = values.title.trim() || values.content.trim().slice(0, 60);
    requestCreate('sortie', title ? { title } : undefined);
  };

  return (
    <>
      <div className="lkdv-cv2c-section-head">
        <span className="lkdv-cv2-field-label" id="cv2c-format-label">
          Format
        </span>
        {/* FID-047 : pastille d'audience à droite, reflet du choix d'audience. */}
        <span className="lkdv-cv2c-audience-pill" aria-hidden="true">
          {AUDIENCE_OPTIONS.find((option) => option.value === values.audience)?.label ?? 'Fil public'}
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
        <div className="lkdv-cv2-field">
          <div className="lkdv-cv2c-field-head">
            <span className="lkdv-cv2-field-label" id="cv2c-clubId-label">
              Club <span aria-hidden="true">*</span>
              <span className="lkdv-cv2c-sr-only"> (obligatoire)</span>
            </span>
          </div>
          {/* Le conteneur (id `cv2c-clubId`) existe même sans club : le moteur
              y amène le focus et l'erreur reste à côté (T5). */}
          <div
            className="lkdv-cv2-chips"
            id="cv2c-clubId"
            role={clubs.length > 0 ? 'radiogroup' : undefined}
            tabIndex={-1}
            aria-labelledby="cv2c-clubId-label"
            aria-describedby={clubError ? 'cv2c-clubId-error' : undefined}
          >
            {myClubs.loading ? (
              <p className="lkdv-cv2-field-hint">Chargement de tes clubs…</p>
            ) : clubs.length > 0 ? (
              clubs.map((club) => (
                <button
                  key={club.id}
                  type="button"
                  role="radio"
                  aria-checked={values.clubId === club.id}
                  className="lkdv-cv2-chip lkdv-cv2-chip--lg"
                  onClick={() =>
                    form.setValue('clubId', club.id, { shouldDirty: true, shouldValidate: true })
                  }
                >
                  {club.name}
                </button>
              ))
            ) : (
              <p className="lkdv-cv2-field-hint">
                {myClubs.error ?? 'Aucun club actif : rejoins un club d’abord.'}
              </p>
            )}
          </div>
          {clubError ? (
            <p id="cv2c-clubId-error" className="lkdv-cv2-field-error" role="alert">
              {clubError}
            </p>
          ) : null}
        </div>
      ) : null}
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

function ContentStep({ user }: { user: User | null }) {
  const form = useFormContext<PostFormValuesV2>();
  const values = form.watch();
  const format = values.format;
  const isPublic = values.audience === 'public';
  const progress = mediaProgress(values.media ?? []);

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
        <MediaFieldV2
          name="media"
          label={format === 'question' ? 'Photos (facultatif)' : 'Photos'}
          required={format === 'photo'}
          userId={user?.id ?? ''}
          limits={IMAGE_LIMITS}
          max={10}
          showAlt
          showCoverChoice
          hint={
            format === 'photo'
              ? 'Jusqu’à 10 photos. Glisse les lignes pour changer l’ordre.'
              : 'Jusqu’à 10 photos, texte alternatif par image.'
          }
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
      {format !== 'event' ? (
        <TextAreaFieldV2
          name="content"
          label={format === 'photo' ? 'Légende' : 'Texte'}
          placeholder={
            format === 'question' ? 'Pose ta question à la communauté…' : 'Raconte, partage, demande…'
          }
          maxLength={600}
          required={format !== 'photo'}
          hint="Tape @ pour mentionner, # pour un hashtag"
        />
      ) : null}
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
  const audienceLabel =
    values.audience === 'public'
      ? 'Fil public'
      : values.audience === 'abonnies'
        ? 'Mes abonnés'
        : 'Un club';
  const formatLabel =
    values.format === 'photo'
      ? 'Photo'
      : values.format === 'billet'
        ? 'Billet'
        : values.format === 'question'
          ? 'Question'
          : 'Événement';
  return (
    <>
      <div className="lkdv-cv2-card lkdv-cv2c-recap">
        <span className="lkdv-cv2-eyebrow">Récapitulatif</span>
        <b>
          {formatLabel} · {audienceLabel}
        </b>
        <small>
          {values.media.length} média{values.media.length > 1 ? 's' : ''} · commentaires ouverts ·
          j’aime visibles
        </small>
      </div>
      {/* J-14 / FID-062 : les réglages de la maquette (commentaires, j'aime,
          programmation) restent **présentés** ; ils n'ont pas d'effet produit
          (pas de cron d'envoi, pas de commentaires par publication). Une seule
          mention « prochaine version » l'explique, au lieu des champs
          Hashtags/Mentions séparés (retirés : le hint maquette vit dans la
          légende, `Tape @ pour mentionner, # pour un hashtag`). */}
      <div className="lkdv-cv2-card lkdv-cv2c-inert-switches">
        <span className="lkdv-cv2c-inert-row">
          <span>
            <b>Autoriser les commentaires</b>
            <small>Les membres pourront répondre</small>
          </span>
          <button type="button" className="lkdv-cv2c-switch" role="switch" aria-checked aria-disabled="true" disabled>
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
          <button type="button" className="lkdv-cv2c-switch" role="switch" aria-checked aria-disabled="true" disabled>
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
          <button type="button" className="lkdv-cv2c-switch" role="switch" aria-checked={false} aria-disabled="true" disabled>
            <span className="lkdv-cv2c-switch-track" aria-hidden="true">
              <span className="lkdv-cv2c-switch-dot" />
            </span>
          </button>
        </span>
        {/* Champs présentés comme la maquette (L2834), désactivés : aucune
            programmation n'est enregistrée tant que le champ n'est pas branché. */}
        <div className="lkdv-cv2c-date-range" aria-hidden="true">
          <label className="lkdv-cv2-field-hint">
            Date
            <input type="date" className="lkdv-cv2-input" disabled />
          </label>
          <label className="lkdv-cv2-field-hint">
            Heure
            <input type="time" className="lkdv-cv2-input" disabled />
          </label>
        </div>
        <p className="lkdv-cv2-field-hint">
          Ces réglages, comme la programmation de la publication, arrivent dans une prochaine
          version.
        </p>
      </div>
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
      {/* La maquette n'affiche aucun surtitre au-dessus de l'aperçu vivant
          (T8a / T12) : l'aperçu est `aria-label="Aperçu en direct"`. */}
      {api.active ? (
        <div className="lkdv-cv2c-live-preview" inert aria-hidden="true">
          {/* FID-047 : visuel de repli de l'aperçu quand le format Photo n'a
              pas encore de média (maquette : `art(m.art) || 'meadow'`). */}
          {values.format === 'photo' && values.media.length === 0 ? (
            <span className="lkdv-cv2c-post-placeholder">
              <Mountain size={22} aria-hidden="true" />
              <small>Ton aperçu apparaîtra ici.</small>
            </span>
          ) : null}
          <CommunityFeedPost post={preview} user={user} embedded />
        </div>
      ) : null}
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
export function PostFormV2({ active, onNavChange, stepHosts }: CreateFormV2Props) {
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
      {(api) => <PostBody api={api} user={user} />}
    </CreateFormEngineV2>
  );
}

export default PostFormV2;
