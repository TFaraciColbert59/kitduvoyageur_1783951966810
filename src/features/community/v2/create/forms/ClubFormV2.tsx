'use client';

import React, { useEffect, useRef, useState } from 'react';
import { ArrowDown, ArrowUp, Plus, ShieldCheck, Trash2 } from 'lucide-react';
import { useFormContext, useFormState } from 'react-hook-form';
import type { User } from '@supabase/supabase-js';
import { ClubCrest } from '../../shared/ClubCrest';
import { CreateFormEngineV2, type CreateFormEngineApiV2 } from '../engine/CreateFormEngineV2';
import { clubSchemaV2, createDefaultsV2, type ClubFormValuesV2 } from '../engine/createSchemasV2';
import { useCreateSheet } from '../CreateSheetContext';
import { checkClubSlugV2, createClubWithAdminV2 } from '../createRpc';
import { ChipsFieldV2 } from '../fields/ChipsV2';
import { TextAreaFieldV2, TextFieldV2, readError } from '../fields/FieldV2';
import { MediaFieldV2 } from '../fields/MediaFieldV2';
import { IMAGE_LIMITS, deleteMediaObjectsV2, uploadedObjectsOf } from '../fields/media';
import { isValidClubSlug, slugifyClubName } from '../club/slug';
import { moderateText } from '@/features/community/create/moderation';
import { useHapticFeedback } from '@/hooks/useHapticFeedback';
import type { CreateFormV2Props } from './types';

const ACTIVITY_CHOICES = [
  'Randonnée',
  'Trail',
  'Ski de rando',
  'Vélo',
  'Escalade',
  'Alpinisme',
  'Bivouac',
  'Raquettes',
] as const;

const CHARTER_TEMPLATES: { id: string; label: string; text: string }[] = [
  {
    id: 'rando',
    label: 'Randonnée',
    text: 'Charte du club — randonnée :\n- Respecter les sentiers balisés et la propriété privée.\n- Ne laisser aucun déchet, remporter le sien.\n- Annoncer son niveau réel avant chaque sortie.\n- Chacun garde son matériel de sécurité et sait l’utiliser.\n- En cas de doute météo, le départ peut être reporté.',
  },
  {
    id: 'alpinisme',
    label: 'Alpinisme',
    text: 'Charte du club — alpinisme :\n- DVA, pelle et sonde obligatoires sur chaque course.\n- Encadrement par un membre expérimenté désigné.\n- Conditions et itinéraire validés la veille.\n- Aucune course sans vérification du Bulletin d’Estimation du Risque d’Avalanche.\n- Retrait libre et sans justification si les conditions ne sont pas réunies.',
  },
  {
    id: 'velo',
    label: 'Vélo',
    text: 'Charte du club — vélo :\n- Casque obligatoire, éclairage pour les sorties tardives.\n- Respecter le code de la route et les autres usagers.\n- Attendre et accompagner le plus lent du groupe.\n- Matériel de réparation minimum : chambre, pompe, dérive-chaîne.\n- Signaler toute blessure ou incident à un responsable.',
  },
];

type SlugState = 'idle' | 'checking' | 'free' | 'taken' | 'invalid';

function ClubPreview({ user }: { user: User | null }) {
  const form = useFormContext<ClubFormValuesV2>();
  const values = form.watch();
  const slug = values.slug || slugifyClubName(values.name);
  const avatarUrl = values.avatar[0]?.previewUrl || values.avatar[0]?.url || '';
  const bannerUrl = values.banner[0]?.previewUrl || values.banner[0]?.url || '';
  return (
    <div className="lkdv-cv2c-club-preview" inert aria-hidden="true">
      {bannerUrl ? (
        <span className="lkdv-cv2c-club-banner">
          {/* eslint-disable-next-line @next/next/no-img-element -- aperçu local ou URL Storage */}
          <img src={bannerUrl} alt="" />
        </span>
      ) : null}
      <div className="lkdv-cv2-card lkdv-cv2c-crest-row">
        {avatarUrl ? (
          <span className="lkdv-cv2c-club-avatar">
            {/* eslint-disable-next-line @next/next/no-img-element -- aperçu local ou URL Storage */}
            <img src={avatarUrl} alt="" />
          </span>
        ) : (
          <ClubCrest
            name={values.name || 'Ton club'}
            activity={values.activities[0] ?? null}
            seed={values.name}
            size={44}
          />
        )}
        <div>
          <b>{values.name || 'Nom du club'}</b>
          <small>
            {values.activities.length > 0 ? values.activities.join(' · ') : 'Activités à choisir'}
            {' · '}
            {values.privacy === 'open' ? 'Ouvert' : 'Sur validation'}
            {' · 1 membre (toi)'}
          </small>
          <small>
            <ShieldCheck size={10} aria-hidden="true" /> /clubs/{slug || 'ton-club'}
          </small>
        </div>
        {user ? (
          <span className="lkdv-cv2-field-hint">
            {user.user_metadata?.full_name ?? 'Toi'} · admin
          </span>
        ) : null}
      </div>
    </div>
  );
}

function IdentiteStep() {
  const form = useFormContext<ClubFormValuesV2>();
  const values = form.watch();
  const [slugState, setSlugState] = useState<SlugState>('idle');
  const [slugEdited, setSlugEdited] = useState(false);
  const slug = values.slug || slugifyClubName(values.name);
  const slugValid = isValidClubSlug(slug);

  // Le slug se propose à partir du nom tant que l'utilisateur ne l'a pas modifié.
  useEffect(() => {
    if (slugEdited) return;
    const next = slugifyClubName(values.name);
    if (next && form.getValues('slug') !== next) {
      form.setValue('slug', next, { shouldDirty: true, shouldValidate: true });
    }
  }, [form, slugEdited, values.name]);

  // Disponibilité vérifiée en direct (`Club#5`).
  useEffect(() => {
    if (!slugValid) {
      setSlugState('invalid');
      return;
    }
    const controller = { cancelled: false };
    setSlugState('checking');
    const timer = window.setTimeout(async () => {
      try {
        const available = await checkClubSlugV2(slug);
        if (!controller.cancelled) setSlugState(available ? 'free' : 'taken');
      } catch {
        if (!controller.cancelled) setSlugState('idle');
      }
    }, 400);
    return () => {
      controller.cancelled = true;
      window.clearTimeout(timer);
    };
  }, [slug, slugValid]);

  return (
    <>
      <TextFieldV2
        name="name"
        label="Nom du club"
        placeholder="La Cordée du Vercors"
        required
        maxLength={80}
      />
      {values.name.trim() && moderateText(values.name) ? (
        <p className="lkdv-cv2-field-hint lkdv-cv2c-notice" role="status">
          {moderateText(values.name)}
        </p>
      ) : null}
      <div className="lkdv-cv2-field">
        <span className="lkdv-cv2-field-label">Adresse du club</span>
        <div className="lkdv-cv2c-url-preview" data-state={slugState === 'taken' || slugState === 'invalid' ? 'invalid' : 'ok'}>
          <span>lekitduvoyageur.fr/clubs/</span>
          <b>{slug || 'ton-club'}</b>
        </div>
        <p className="lkdv-cv2-field-hint">
          {slugState === 'checking'
            ? 'Vérification de la disponibilité…'
            : slugState === 'taken'
              ? 'Cette adresse est déjà prise.'
              : slugState === 'invalid'
                ? 'Adresse invalide : 2 à 60 caractères, lettres minuscules, chiffres et tirets.'
                : slugState === 'free'
                  ? 'Adresse disponible.'
                  : 'Modifiable : minuscules, chiffres et tirets.'}
        </p>
        <input
          id="cv2c-slug"
          type="text"
          className="lkdv-cv2-input"
          aria-label="Adresse du club"
          value={values.slug}
          maxLength={60}
          onChange={(event) => {
            setSlugEdited(true);
            form.setValue('slug', event.target.value.trim().toLowerCase(), {
              shouldDirty: true,
              shouldValidate: true,
            });
          }}
        />
      </div>
    </>
  );
}

function UniversStep({ user }: { user: User | null }) {
  const form = useFormContext<ClubFormValuesV2>();
  const values = form.watch();
  const [custom, setCustom] = useState('');
  const { haptic } = useHapticFeedback();

  const addCustom = () => {
    const activity = custom.trim().slice(0, 40);
    if (!activity || values.activities.includes(activity) || values.activities.length >= 5) return;
    form.setValue('activities', [...values.activities, activity], {
      shouldDirty: true,
      shouldValidate: true,
    });
    setCustom('');
    haptic('selection');
  };

  return (
    <>
      {/* Les deux médias de la maquette (HTML L3283-3289) : avatar carré et
          bannière 3:1, deux champs distincts — plus d'image unique recadrée. */}
      <MediaFieldV2
        name="avatar"
        label="Image du club (carré)"
        userId={user?.id ?? ''}
        limits={IMAGE_LIMITS}
        max={1}
        cropOptions={[{ value: '1:1', label: 'Carré' }]}
        showAlt={false}
        addLabel="Choisir une image"
        hint="Recadrage carré. Sans image, un blason est généré à partir du nom et de l’activité."
      />
      <MediaFieldV2
        name="banner"
        label="Bannière (3:1)"
        userId={user?.id ?? ''}
        limits={IMAGE_LIMITS}
        max={1}
        cropOptions={[{ value: '3:1', label: 'Bannière' }]}
        showAlt={false}
        addLabel="Ajouter une bannière"
        hint="Recadrage 3:1, affiché en tête de la page du club."
      />
      <ChipsFieldV2
        name="activities"
        label="Activités"
        multiple
        options={ACTIVITY_CHOICES.map((activity) => ({ value: activity, label: activity }))}
        hint="Plusieurs activités possibles (5 maximum)."
      />
      <div className="lkdv-cv2c-inline-add">
        <input
          type="text"
          className="lkdv-cv2-input"
          value={custom}
          maxLength={40}
          placeholder="Autre activité…"
          aria-label="Ajouter une activité"
          onChange={(event) => setCustom(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              addCustom();
            }
          }}
        />
        <button type="button" className="lkdv-cv2-chip lkdv-cv2-chip--lg" onClick={addCustom}>
          <Plus size={13} aria-hidden="true" />
          Ajouter
        </button>
      </div>
      <TextAreaFieldV2
        name="description"
        label="Description"
        placeholder="L’esprit du club, le niveau, le rythme…"
        maxLength={1500}
        rows={5}
      />
      <TextFieldV2
        name="locationLabel"
        label="Zone d’activité"
        placeholder="Vercors, Isère…"
        maxLength={120}
      />
      <div className="lkdv-cv2-field">
        <span className="lkdv-cv2-field-label">Rayon de la zone</span>
        <div className="lkdv-cv2-chips">
          {[25, 50, 100, 200].map((radius) => (
            <button
              key={radius}
              type="button"
              className="lkdv-cv2-chip lkdv-cv2-chip--lg"
              aria-pressed={values.zoneRadiusKm === radius}
              onClick={() =>
                form.setValue('zoneRadiusKm', values.zoneRadiusKm === radius ? null : radius, {
                  shouldDirty: true,
                  shouldValidate: true,
                })
              }
            >
              {radius} km
            </button>
          ))}
        </div>
      </div>
    </>
  );
}

function AdhesionStep() {
  const form = useFormContext<ClubFormValuesV2>();
  const { errors: adhesionErrors } = useFormState<ClubFormValuesV2>({ control: form.control });
  const questionsError = readError(adhesionErrors, 'joinQuestions');
  const values = form.watch();
  const { haptic } = useHapticFeedback();

  const updateQuestion = (index: number, text: string) => {
    const next = [...values.joinQuestions];
    next[index] = text;
    form.setValue('joinQuestions', next, { shouldDirty: true, shouldValidate: true });
  };

  const moveQuestion = (index: number, delta: number) => {
    const target = index + delta;
    if (target < 0 || target >= values.joinQuestions.length) return;
    const next = [...values.joinQuestions];
    [next[index], next[target]] = [next[target], next[index]];
    form.setValue('joinQuestions', next, { shouldDirty: true, shouldValidate: true });
    haptic('selection');
  };

  return (
    <>
      <span className="lkdv-cv2-field-label" id="cv2c-club-privacy">
        Adhésion
      </span>
      <div className="lkdv-cv2c-mode-cards" role="radiogroup" aria-labelledby="cv2c-club-privacy">
        <button
          type="button"
          role="radio"
          aria-checked={values.privacy === 'open'}
          className="lkdv-cv2c-mode-card"
          onClick={() => form.setValue('privacy', 'open', { shouldDirty: true, shouldValidate: true })}
        >
          <b>Ouvert</b>
          <small>Tout le monde rejoint immédiatement le club.</small>
        </button>
        <button
          type="button"
          role="radio"
          aria-checked={values.privacy === 'closed'}
          className="lkdv-cv2c-mode-card"
          onClick={() => form.setValue('privacy', 'closed', { shouldDirty: true, shouldValidate: true })}
        >
          <b>Sur validation</b>
          <small>Chaque demande est examinée par un administrateur.</small>
        </button>
      </div>
      <TextAreaFieldV2
        name="membershipRules"
        label="Règles du club"
        placeholder="Niveau requis, matériel, charte du club…"
        maxLength={1000}
        rows={4}
      />
      <div className="lkdv-cv2c-charter-row">
        {CHARTER_TEMPLATES.map((template) => (
          <button
            key={template.id}
            type="button"
            className="lkdv-cv2-chip lkdv-cv2-chip--sm"
            onClick={() =>
              form.setValue('membershipRules', template.text, { shouldDirty: true, shouldValidate: true })
            }
          >
            Modèle {template.label}
          </button>
        ))}
      </div>
      <div className="lkdv-cv2-field">
        <span className="lkdv-cv2-field-label">Questions d’adhésion (3 maximum)</span>
        {questionsError ? (
          <p className="lkdv-cv2-field-error" role="alert">
            {questionsError}
          </p>
        ) : null}
        {values.joinQuestions.length === 0 ? (
          <p className="lkdv-cv2-field-hint">
            Aucune question : la demande est acceptée sans formulaire.
          </p>
        ) : (
          <ul className="lkdv-cv2c-questions">
            {values.joinQuestions.map((question, index) => (
              <li key={index} className="lkdv-cv2c-question-row">
                <input
                  type="text"
                  className="lkdv-cv2-input"
                  value={question}
                  maxLength={200}
                  aria-label={`Question d’adhésion ${index + 1}`}
                  onChange={(event) => updateQuestion(index, event.target.value)}
                />
                <button
                  type="button"
                  className="lkdv-cv2c-icon-btn"
                  aria-label="Monter la question"
                  onClick={() => moveQuestion(index, -1)}
                >
                  <ArrowUp size={13} aria-hidden="true" />
                </button>
                <button
                  type="button"
                  className="lkdv-cv2c-icon-btn"
                  aria-label="Descendre la question"
                  onClick={() => moveQuestion(index, 1)}
                >
                  <ArrowDown size={13} aria-hidden="true" />
                </button>
                <button
                  type="button"
                  className="lkdv-cv2c-icon-btn"
                  aria-label="Retirer la question"
                  onClick={() =>
                    form.setValue(
                      'joinQuestions',
                      values.joinQuestions.filter((_, position) => position !== index),
                      { shouldDirty: true, shouldValidate: true },
                    )
                  }
                >
                  <Trash2 size={13} aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
        )}
        {values.joinQuestions.length < 3 ? (
          <button
            type="button"
            className="lkdv-cv2-chip lkdv-cv2-chip--lg"
            onClick={() =>
              form.setValue('joinQuestions', [...values.joinQuestions, ''], {
                shouldDirty: true,
                shouldValidate: true,
              })
            }
          >
            <Plus size={13} aria-hidden="true" />
            Ajouter une question
          </button>
        ) : null}
      </div>
    </>
  );
}

function PublicationStep() {
  const form = useFormContext<ClubFormValuesV2>();
  const values = form.watch();
  return (
    <>
      <button
        type="button"
        className="lkdv-cv2c-switch"
        role="switch"
        aria-checked={values.welcomePost}
        onClick={() => form.setValue('welcomePost', !values.welcomePost, { shouldDirty: true })}
      >
        <span className="lkdv-cv2c-switch-track" aria-hidden="true">
          <span className="lkdv-cv2c-switch-dot" />
        </span>
        Publier un post d’accueil dans le club
      </button>
      {values.welcomePost ? (
        <TextAreaFieldV2
          name="welcomeContent"
          label="Message d’accueil"
          placeholder="Bienvenue dans le club ! Présente-toi…"
          maxLength={2000}
          rows={4}
          hint="Le post est publié dans le fil du club (audience club)."
        />
      ) : null}
      <p className="lkdv-cv2-field-hint">
        {values.privacy === 'open'
          ? 'Club ouvert : le post d’accueil part dès la création.'
          : 'Club sur validation : le post d’accueil partira à la création du club, quand l’adhésion est ouverte.'}
      </p>
      <div className="lkdv-cv2-card lkdv-cv2c-recap">
        <span className="lkdv-cv2-eyebrow">Ensuite</span>
        <b>Organise la première sortie</b>
        <small>L’île de confirmation propose « Organiser une sortie » juste après la création.</small>
      </div>
    </>
  );
}

function ClubBody({
  api,
  user,
}: {
  api: CreateFormEngineApiV2<ClubFormValuesV2>;
  user: User | null;
}) {
  return (
    <>
      {api.active ? <ClubPreview user={user} /> : null}
      {api.step === 0 ? <IdentiteStep /> : null}
      {api.step === 1 ? <UniversStep user={user} /> : null}
      {api.step === 2 ? <AdhesionStep /> : null}
      {api.step === 3 ? <PublicationStep /> : null}
    </>
  );
}

/**
 * Club V2 (`Club#1-20`) : Identité → Univers → Adhésion → Publication.
 *
 * Image facultative (blason `ClubCrest` généré sinon), slug vérifié en direct
 * (`check_club_slug`, aperçu d’URL), activités en chips multiples, zone
 * d’activité, adhésion Ouvert / Sur validation en `radiogroup`, questions
 * d’adhésion réordonnables (3 max), modèles de charte, post d’accueil, aperçu
 * tuile vivant, et **une seule RPC atomique** (`create_club_with_admin`).
 * À la fin, « Organiser la première sortie » bascule sur Sortie avec le club.
 */
export function ClubFormV2({ active, onNavChange, stepHosts }: CreateFormV2Props) {
  const { user, reportCreated } = useCreateSheet();
  const defaults = useRef(createDefaultsV2('club')).current;

  return (
    <CreateFormEngineV2<ClubFormValuesV2>
      kind="club"
      schema={clubSchemaV2}
      defaultValues={defaults}
      active={active}
      disabled={!user}
      onNavChange={onNavChange}
      stepHosts={stepHosts}
      onSubmit={async (values) => {
        const slug = values.slug.trim() || slugifyClubName(values.name);
        try {
          const result = await createClubWithAdminV2(values, slug);
          reportCreated('club', {
            id: result.id,
            slug: result.slug ?? slug,
            name: values.name.trim(),
          });
        } catch (error) {
          await deleteMediaObjectsV2(
            uploadedObjectsOf([...values.avatar, ...values.banner]),
          );
          throw error;
        }
      }}
    >
      {(api) => <ClubBody api={api} user={user} />}
    </CreateFormEngineV2>
  );
}

export default ClubFormV2;
