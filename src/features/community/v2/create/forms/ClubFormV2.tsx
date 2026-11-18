'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Camera, GripVertical, MapPin, Minus, Pencil, Plus, ShieldCheck, Trash2 } from 'lucide-react';
import { useFormContext, useFormState } from 'react-hook-form';
import type { User } from '@supabase/supabase-js';
import { ClubCrest } from '../../shared/ClubCrest';
import { CreateFormEngineV2, type CreateFormEngineApiV2 } from '../engine/CreateFormEngineV2';
import { clubSchemaV2, createDefaultsV2, createMediaItemV2, type ClubFormValuesV2 } from '../engine/createSchemasV2';
import { useCreateSheet } from '../CreateSheetContext';
import { checkClubSlugV2, createClubWithAdminV2 } from '../createRpc';
import { ChipsFieldV2 } from '../fields/ChipsV2';
import { SelectDropdownV2 } from '../fields/SelectDropdownV2';
import { VisibilityPickerV2 } from '../fields/VisibilityPickerV2';
import { TextAreaFieldV2, TextFieldV2, readError } from '../fields/FieldV2';
import {
  IMAGE_LIMITS,
  cropImageToRatio,
  deleteMediaObjectsV2,
  uploadMediaV2,
  uploadedObjectsOf,
  validateMediaFile,
} from '../fields/media';
import { isValidClubSlug, slugifyClubName } from '../club/slug';
import { moderateText } from '@/features/community/create/moderation';
import { useHapticFeedback } from '@/hooks/useHapticFeedback';
import { PlaceFieldV2 } from '../fields/PlaceFieldV2';
import { MeetingMapV2 } from '../sortie/MeetingMapV2';
import { SheetPreview } from '../../shared/SheetPreview';
import { CollapsibleHeroPreview, useScrollCollapsePreview } from '../photo/CollapsibleHeroPreview';
import { ClubHeroEditorV2 } from '../club/ClubHeroEditorV2';
import type { CreateFormV2Props } from './types';

/**
 * Activités de la maquette (`ACTI`, HTML L3077) : **5** valeurs, plus le champ
 * libre « Autre activité… » (FID-054). Les libellés restent ceux du produit.
 */
const ACTIVITY_CHOICES = ['Randonnée', 'Trail', 'Ski de rando', 'Vélo', 'Escalade'] as const;

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

function ClubPreview() {
  const form = useFormContext<ClubFormValuesV2>();
  const values = form.watch();
  const slug = values.slug || slugifyClubName(values.name);
  const avatarUrl = values.avatar[0]?.previewUrl || values.avatar[0]?.url || '';
  // FID-056 : l'aperçu vit dans 150 px ; la maquette `.kprev` (L3304) montre le
  // blason et la ligne d'identité, pas la bannière 3:1 (réservée à l'étape).
  return (
    <div className="lkdv-cv2c-club-preview" inert aria-hidden="true">
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
            <ShieldCheck size={10} aria-hidden="true" />{' '}
            {values.locationLabel ? values.locationLabel : 'France & Europe'}
          </small>
        </div>
      </div>
    </div>
  );
}

function ClubHeroEditor({
  user,
  onFocusField,
}: {
  user: User | null;
  onFocusField?: (id: string) => void;
}) {
  const form = useFormContext<ClubFormValuesV2>();
  const values = form.watch();
  const bannerInputRef = useRef<HTMLInputElement | null>(null);
  const avatarInputRef = useRef<HTMLInputElement | null>(null);
  const [uploading, setUploading] = useState<'avatar' | 'banner' | null>(null);

  const bannerUrl = values.banner[0]?.previewUrl || values.banner[0]?.url || '';
  const avatarUrl = values.avatar[0]?.previewUrl || values.avatar[0]?.url || '';
  const slug = values.slug || slugifyClubName(values.name);

  const handlePickImage = async (field: 'avatar' | 'banner', file: File | undefined) => {
    if (!file) return;
    const err = validateMediaFile(file, IMAGE_LIMITS);
    if (err) return;
    const ratio = field === 'avatar' ? '1:1' : '3:1';
    const cropped = await cropImageToRatio(file, ratio);
    const previewUrl = URL.createObjectURL(cropped);
    const item = createMediaItemV2({
      name: cropped.name,
      type: cropped.type,
      size: cropped.size,
      previewUrl,
      status: user?.id ? 'uploading' : 'local',
      crop: ratio,
    });
    form.setValue(field, [item], { shouldDirty: true, shouldValidate: true });
    if (!user?.id) return;
    setUploading(field);
    try {
      const uploaded = await uploadMediaV2(cropped, {
        userId: user.id,
        bucket: 'carnet-media',
      });
      form.setValue(
        field,
        [
          {
            ...item,
            url: uploaded.url,
            storageBucket: uploaded.bucket,
            storagePath: uploaded.path,
            status: 'uploaded',
            progress: 100,
          },
        ],
        { shouldDirty: true, shouldValidate: true },
      );
    } catch {
      form.setValue(field, [{ ...item, status: 'error' }], { shouldDirty: true });
    } finally {
      setUploading(null);
    }
  };

  return (
    <div className="lkdv-cv2c-club-hero" aria-label="Aperçu interactif de la page du club">
      <input
        ref={bannerInputRef}
        type="file"
        accept="image/*"
        className="lkdv-cv2c-sr-only"
        aria-label="Changer la bannière du club"
        onChange={(e) => {
          void handlePickImage('banner', e.target.files?.[0]);
          e.target.value = '';
        }}
      />
      <input
        ref={avatarInputRef}
        type="file"
        accept="image/*"
        className="lkdv-cv2c-sr-only"
        aria-label="Changer la photo du club"
        onChange={(e) => {
          void handlePickImage('avatar', e.target.files?.[0]);
          e.target.value = '';
        }}
      />
      <button
        type="button"
        className="lkdv-cv2c-club-hero-banner"
        onClick={() => bannerInputRef.current?.click()}
      >
        {bannerUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- aperçu bannière
          <img src={bannerUrl} alt="" />
        ) : (
          <span className="lkdv-cv2c-club-hero-banner-empty">
            <Camera size={16} aria-hidden="true" />
            <span>{uploading === 'banner' ? 'Envoi…' : 'Bannière 3:1'}</span>
          </span>
        )}
        <span className="lkdv-cv2c-club-hero-edit-badge" aria-hidden="true">
          <Camera size={12} />
        </span>
      </button>

      <div className="lkdv-cv2c-club-hero-body">
        <button
          type="button"
          className="lkdv-cv2c-club-hero-avatar"
          onClick={() => avatarInputRef.current?.click()}
          aria-label="Modifier la photo du club"
        >
          {avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- aperçu avatar
            <img src={avatarUrl} alt="" />
          ) : (
            <ClubCrest
              name={values.name || 'Club'}
              activity={values.activities[0] ?? null}
              seed={values.name}
              size={56}
            />
          )}
          <span className="lkdv-cv2c-club-hero-avatar-badge" aria-hidden="true">
            <Camera size={11} />
          </span>
        </button>

        <div className="lkdv-cv2c-club-hero-meta">
          <div className="lkdv-cv2c-club-hero-title-wrap">
            <input
              id="cv2c-name"
              type="text"
              className="lkdv-cv2c-club-hero-title-input"
              value={values.name}
              maxLength={80}
              placeholder="Nom du club"
              aria-label="Nom du club"
              onChange={(e) =>
                form.setValue('name', e.target.value, { shouldDirty: true, shouldValidate: true })
              }
            />
            <Pencil size={11} aria-hidden="true" className="lkdv-cv2c-hero-pencil" />
          </div>
          <div className="lkdv-cv2c-club-hero-pills">
            {slug ? <span className="lkdv-cv2c-club-hero-pill">@{slug}</span> : null}
            <button
              type="button"
              className="lkdv-cv2c-club-hero-pill is-accent"
              onClick={() => onFocusField?.('cv2c-club-activity')}
            >
              {values.activities[0] || 'Activité'}
            </button>
            <button
              type="button"
              className="lkdv-cv2c-club-hero-pill"
              onClick={() => onFocusField?.('cv2c-locationLabel')}
            >
              <MapPin size={10} aria-hidden="true" />
              {values.locationLabel || 'Zone'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function ClubActivitiesV2() {
  const form = useFormContext<ClubFormValuesV2>();
  const values = form.watch();
  const current = values.activities[0] ?? '';
  const isPreset = (ACTIVITY_CHOICES as readonly string[]).includes(current);
  const [otherMode, setOtherMode] = useState(() => Boolean(current) && !isPreset);
  const [custom, setCustom] = useState(() => (current && !isPreset ? current : ''));
  const { haptic } = useHapticFeedback();

  const selectValue = otherMode ? '__other__' : current;

  return (
    <div id="cv2c-club-activity">
      <SelectDropdownV2
        name="activities"
        label="Activité principale"
        placeholder="Choisir une activité…"
        value={selectValue}
        options={[
          ...ACTIVITY_CHOICES.map((choice) => ({ value: choice, label: choice })),
          { value: '__other__', label: 'Autre activité…' },
        ]}
        onChange={(next) => {
          const v = String(next);
          if (v === '__other__') {
            setOtherMode(true);
            if (custom.trim()) {
              form.setValue('activities', [custom.trim().slice(0, 40)], {
                shouldDirty: true,
                shouldValidate: true,
              });
            }
          } else {
            setOtherMode(false);
            form.setValue('activities', v ? [v] : [], {
              shouldDirty: true,
              shouldValidate: true,
            });
          }
          haptic('selection');
        }}
      />
      {otherMode ? (
        <div className="lkdv-cv2c-inline-add" style={{ marginTop: 8 }}>
          <input
            type="text"
            className="lkdv-cv2-input"
            value={custom}
            maxLength={40}
            placeholder="Nom de l’activité (ex : Alpinisme, Gravel…)"
            aria-label="Activité personnalisée"
            onChange={(event) => {
              const next = event.target.value.slice(0, 40);
              setCustom(next);
              form.setValue('activities', next.trim() ? [next.trim()] : [], {
                shouldDirty: true,
                shouldValidate: true,
              });
            }}
          />
        </div>
      ) : null}
    </div>
  );
}

/**
 * Zone d'activité (maquette L3281) : lieu + **stepper** de rayon 5-60 km.
 * Le schéma garde `zoneRadiusKm` nullable : le stepper part de 20 km (valeur de
 * la maquette) et n'écrit qu'au premier geste.
 */
function ClubZoneV2() {
  const form = useFormContext<ClubFormValuesV2>();
  const values = form.watch();
  const radius = values.zoneRadiusKm ?? 20;
  const setRadius = (next: number) => {
    form.setValue('zoneRadiusKm', Math.max(5, Math.min(60, next)), {
      shouldDirty: true,
      shouldValidate: true,
    });
  };
  return (
    <>
      {/* Club#4 : le lieu se cherche (adresse réelle) puis se précise sur la
          mini-carte, épingle déplaçable ; le rayon se règle juste dessous. */}
      <PlaceFieldV2
        name="locationLabel"
        label="Zone d’activité"
        placeholder="Vercors, Isère…"
        latName="zoneLat"
        lngName="zoneLng"
        allowCurrentPosition={false}
      />
      <MeetingMapV2
        lat={values.zoneLat}
        lng={values.zoneLng}
        label="Centre de la zone d’activité"
        emptyHint="Touche la carte pour placer la zone principale du club"
        height={150}
        onChange={(lat, lng) => {
          form.setValue('zoneLat', lat, { shouldDirty: true, shouldValidate: true });
          form.setValue('zoneLng', lng, { shouldDirty: true, shouldValidate: true });
        }}
        onResolveAddress={(labelText) => {
          form.setValue('locationLabel', labelText, { shouldDirty: true, shouldValidate: true });
        }}
      />
      <div className="lkdv-cv2-field">
        <span className="lkdv-cv2-field-label" id="cv2c-club-radius-label">
          Rayon d’activité
        </span>
        <div className="lkdv-cv2c-stepper-row">
          <div className="lkdv-cv2-stepper" role="group" aria-labelledby="cv2c-club-radius-label">
            <button
              type="button"
              aria-label="Diminuer le rayon d’activité"
              onClick={() => setRadius(radius - 5)}
              disabled={radius <= 5}
            >
              <Minus size={16} aria-hidden="true" />
            </button>
            <output aria-live="polite">
              {radius}
              <span className="lkdv-cv2c-unit">km</span>
            </output>
            <button
              type="button"
              aria-label="Augmenter le rayon d’activité"
              onClick={() => setRadius(radius + 5)}
              disabled={radius >= 60}
            >
              <Plus size={16} aria-hidden="true" />
            </button>
          </div>
        </div>
      </div>
    </>
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
    if (!slug) {
      setSlugState('idle');
      return;
    }
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
      {values.name.trim() && moderateText(values.name) ? (
        <p className="lkdv-cv2-field-hint lkdv-cv2c-notice" role="status">
          {moderateText(values.name)}
        </p>
      ) : null}
      <div className="lkdv-cv2-field">
        <span className="lkdv-cv2-field-label">Adresse du club</span>
        <div
          className="lkdv-cv2c-url-input"
          data-state={slugState === 'taken' || slugState === 'invalid' ? 'invalid' : 'ok'}
        >
          <span className="lkdv-cv2c-url-prefix">lekitduvoyageur.fr/clubs/</span>
          <input
            id="cv2c-slug"
            type="text"
            className="lkdv-cv2c-url-field"
            aria-label="Adresse du club"
            placeholder="ton-club"
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
        {slugState === 'checking' || slugState === 'taken' || slugState === 'invalid' || slugState === 'free' ? (
          <p className="lkdv-cv2-field-hint">
            {slugState === 'checking'
              ? 'Vérification…'
              : slugState === 'taken'
                ? 'Cette adresse est déjà prise.'
                : slugState === 'invalid'
                  ? '2 à 60 caractères (minuscules, chiffres, tirets).'
                  : 'Adresse disponible.'}
          </p>
        ) : null}
      </div>
      {/* FID-054/FID-064 : activités sur l'étape Identité (maquette L3280),
          hint « Plusieurs choix possibles. », champ libre « Autre activité… ». */}
      <ClubActivitiesV2 />
      <ClubZoneV2 />
    </>
  );
}

function UniversStep() {
  return (
    <>
      <TextAreaFieldV2
        name="description"
        label="Description"
        placeholder="L’esprit du club, le niveau, le rythme…"
        maxLength={1500}
        rows={5}
      />
    </>
  );
}

function AdhesionStep() {
  const form = useFormContext<ClubFormValuesV2>();
  const { errors: adhesionErrors } = useFormState<ClubFormValuesV2>({ control: form.control });
  const questionsError = readError(adhesionErrors, 'joinQuestions');
  const values = form.watch();
  const { haptic } = useHapticFeedback();
  // FID-054 — réordonnancement au **pointeur** (maquette `.grip` 44 px) en plus
  // des flèches haut/bas : la poignée capture le pointeur, la ligne la plus
  // proche du doigt devient la cible, puis l'ordre est écrit d'un seul geste.
  const rowRefs = useRef<Array<HTMLLIElement | null>>([]);
  const dragRef = useRef<{ index: number; pointerId: number } | null>(null);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dragOver, setDragOver] = useState<number | null>(null);
  const [announcement, setAnnouncement] = useState('');

  const updateQuestion = (index: number, text: string) => {
    const next = [...values.joinQuestions];
    next[index] = text;
    form.setValue('joinQuestions', next, { shouldDirty: true, shouldValidate: true });
  };

  const reorderQuestion = (from: number, to: number) => {
    if (from === to || from < 0 || from >= values.joinQuestions.length) return;
    if (to < 0 || to >= values.joinQuestions.length) return;
    const next = [...values.joinQuestions];
    const [question] = next.splice(from, 1);
    next.splice(to, 0, question as string);
    form.setValue('joinQuestions', next, { shouldDirty: true, shouldValidate: true });
    setAnnouncement(`Question déplacée en position ${to + 1}.`);
    haptic('selection');
  };

  const moveQuestion = (index: number, delta: number) => {
    reorderQuestion(index, index + delta);
  };

  const rowIndexAt = (clientY: number) => {
    let target = dragRef.current?.index ?? 0;
    let best = Number.POSITIVE_INFINITY;
    rowRefs.current.forEach((row, index) => {
      if (!row) return;
      const rect = row.getBoundingClientRect();
      const distance = Math.abs(clientY - (rect.top + rect.height / 2));
      if (distance < best) {
        best = distance;
        target = index;
      }
    });
    return target;
  };

  const beginDrag = (index: number, event: React.PointerEvent<HTMLButtonElement>) => {
    if (event.button > 0) return;
    dragRef.current = { index, pointerId: event.pointerId };
    setDragIndex(index);
    setDragOver(index);
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      /* capture optionnelle (Safari ancien, tests) */
    }
  };

  const moveDrag = (event: React.PointerEvent<HTMLButtonElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    setDragOver(rowIndexAt(event.clientY));
  };

  const endDrag = (event: React.PointerEvent<HTMLButtonElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    dragRef.current = null;
    const target = rowIndexAt(event.clientY);
    setDragIndex(null);
    setDragOver(null);
    reorderQuestion(drag.index, target);
  };

  const cancelDrag = () => {
    dragRef.current = null;
    setDragIndex(null);
    setDragOver(null);
  };

  return (
    <>
      <VisibilityPickerV2
        name="privacy"
        label="Visibilité du club"
        supportClub={false}
        options={[
          { value: 'open', label: 'Ouvert' },
          { value: 'closed', label: 'Privé' },
        ]}
      />
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
      {/* FID-054 : les questions d'adhésion n'apparaissent que pour
          « Sur validation » (maquette L3291 : `${d.join==='valid'?…}`). */}
      {values.privacy === 'closed' ? (
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
          <ul className="lkdv-cv2c-questions" aria-describedby="cv2c-questions-hint">
            {values.joinQuestions.map((question, index) => (
              <li
                key={index}
                ref={(element) => {
                  rowRefs.current[index] = element;
                }}
                className="lkdv-cv2c-question-row"
                data-dragging={dragIndex === index || undefined}
                data-over={dragOver === index && dragIndex !== null && dragIndex !== index ? 'true' : undefined}
              >
                <input
                  type="text"
                  className="lkdv-cv2-input"
                  value={question}
                  maxLength={200}
                  aria-label={`Question d’adhésion ${index + 1}`}
                  onChange={(event) => updateQuestion(index, event.target.value)}
                />
                {/* FID-054 : **poignée de glisser** de la maquette (`.grip`
                    44 px, L3291) : glisser au pointeur ; les flèches haut/bas
                    restent le geste clavier, avec annonce du nouvel ordre. */}
                <button
                  type="button"
                  className="lkdv-cv2c-icon-btn lkdv-cv2c-drag"
                  aria-label={`Déplacer la question ${index + 1}. Glisse la poignée, ou flèches haut et bas`}
                  onPointerDown={(event) => beginDrag(index, event)}
                  onPointerMove={moveDrag}
                  onPointerUp={endDrag}
                  onPointerCancel={cancelDrag}
                  onKeyDown={(event) => {
                    if (event.key === 'ArrowUp') {
                      event.preventDefault();
                      event.stopPropagation();
                      moveQuestion(index, -1);
                    } else if (event.key === 'ArrowDown') {
                      event.preventDefault();
                      event.stopPropagation();
                      moveQuestion(index, 1);
                    }
                  }}
                >
                  <GripVertical size={13} aria-hidden="true" />
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
        <p className="lkdv-cv2c-sr-only" role="status">
          {announcement}
        </p>
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
      ) : null}
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
        />
      ) : null}
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
  const values = api.form.watch();
  const [previewCollapsed, setPreviewCollapsed] = useScrollCollapsePreview(api.active);
  const avatarUrl = values.avatar?.[0]?.previewUrl || values.avatar?.[0]?.url || null;
  const slug = values.slug || slugifyClubName(values.name);

  const focusField = (fieldId: string) => {
    const el = document.getElementById(fieldId);
    if (el) {
      el.scrollIntoView({ block: 'center', behavior: 'smooth' });
      if ('focus' in el && typeof (el as HTMLElement).focus === 'function') {
        (el as HTMLElement).focus();
      }
    }
  };
  return (
    <>
      {api.active ? (
        <SheetPreview compact={false}>
          <CollapsibleHeroPreview
            collapsed={previewCollapsed}
            onExpand={() => setPreviewCollapsed(false)}
            title={values.name.trim() || 'Nom du club'}
            subtitle={slug ? `@${slug}` : values.activities[0] || 'Club'}
            avatarUrl={avatarUrl}
            fallbackText={values.name || 'C'}
          >
            <ClubHeroEditorV2 user={user} />
          </CollapsibleHeroPreview>
        </SheetPreview>
      ) : null}
      {api.step === 0 ? <IdentiteStep /> : null}
      {api.step === 1 ? <UniversStep /> : null}
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
