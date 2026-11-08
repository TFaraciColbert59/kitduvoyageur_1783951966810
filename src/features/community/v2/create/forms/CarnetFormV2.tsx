'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { BookOpen, Loader2, Plus, X } from 'lucide-react';
import { useFormContext } from 'react-hook-form';
import type { User } from '@supabase/supabase-js';
import { AiImproveButton } from '@/features/community/create/shared/AiImproveButton';
import { CreateFormEngineV2, type CreateFormEngineApiV2 } from '../engine/CreateFormEngineV2';
import {
  carnetSchemaV2,
  createDefaultsV2,
  type CarnetFormValuesV2,
} from '../engine/createSchemasV2';
import { useCreateSheet } from '../CreateSheetContext';
import { carnetCover, carnetPhotos, createCarnetV2 } from '../createRpc';
import { DateFieldV2 } from '../fields/DateFieldV2';
import { TextAreaFieldV2, TextFieldV2 } from '../fields/FieldV2';
import { NumberFieldV2, NumberStepperV2 } from '../fields/NumberStepperV2';
import { PlaceFieldV2 } from '../fields/PlaceFieldV2';
import { PrefillApplierV2 } from '../fields/PrefillApplierV2';
import { TagsFieldV2 } from '../fields/TagsFieldV2';
import { deleteMediaObjectsV2, uploadedObjectsOf } from '../fields/media';
import { HAS_CARNET_NIGHTS } from '../carnet/capabilities';
import { TracePaneV2 } from '../carnet/TracePaneV2';
import { DaysPaneV2 } from '../carnet/DaysPaneV2';
import { createClient } from '@/lib/supabase/client';
import { useHapticFeedback } from '@/hooks/useHapticFeedback';
import type { CreateFormV2Props } from './types';

const VISIBILITIES = [
  { value: 'private', label: 'Privé', description: 'Visible par toi uniquement (par défaut)' },
  { value: 'friends', label: 'Amis', description: 'Visible par tes amis' },
  { value: 'public', label: 'Public', description: 'Visible par toute la communauté' },
] as const;

const DESTINATION_SUGGESTIONS = ['Chamonix', 'Vercors', 'Écrins', 'Queyras', 'Mercantour', 'Haute-Savoie'];

function InfosStep({ user }: { user: User | null }) {
  const form = useFormContext<CarnetFormValuesV2>();
  const values = form.watch();
  const description = values.description ?? '';
  const { haptic } = useHapticFeedback();
  return (
    <>
      <TextFieldV2
        name="title"
        label="Titre du carnet"
        placeholder="Tour des Écrins"
        required
        maxLength={140}
      />
      <PlaceFieldV2
        name="destination"
        label="Destination"
        placeholder="Chamonix, Vercors…"
        required
      />
      <div className="lkdv-cv2-chips">
        {DESTINATION_SUGGESTIONS.filter((destination) => destination !== values.destination).map(
          (destination) => (
            <button
              key={destination}
              type="button"
              className="lkdv-cv2-chip lkdv-cv2-chip--sm"
              onClick={() => form.setValue('destination', destination, { shouldDirty: true, shouldValidate: true })}
            >
              {destination}
            </button>
          ),
        )}
      </div>
      <div className="lkdv-cv2c-date-range">
        <DateFieldV2 name="startDate" label="Début" />
        <DateFieldV2 name="endDate" label="Fin" hint="La fin ne précède pas le début." />
      </div>
      <NumberStepperV2 name="nbVoyageurs" label="Voyageurs" min={1} max={50} />
      <div className="lkdv-cv2-field">
        <span className="lkdv-cv2-field-label">Visibilité</span>
        <div className="lkdv-cv2c-audience-list" role="radiogroup" aria-label="Visibilité du carnet">
          {VISIBILITIES.map((option) => (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={values.visibility === option.value}
              className="lkdv-cv2c-audience-card"
              data-active={values.visibility === option.value}
              onClick={() => {
                form.setValue('visibility', option.value, { shouldDirty: true, shouldValidate: true });
                haptic('selection');
              }}
            >
              <span className="lkdv-cv2c-radio" aria-hidden="true" />
              <span>
                <b>{option.label}</b>
                <small>{option.description}</small>
              </span>
            </button>
          ))}
        </div>
      </div>
      <TextAreaFieldV2
        name="description"
        label="Récit"
        placeholder="Récit, idée, points forts…"
        maxLength={1000}
        rows={5}
        action={
          <AiImproveButton
            value={description}
            onChange={(next) =>
              form.setValue('description', next, { shouldDirty: true, shouldValidate: true })
            }
          />
        }
        hint="L’IA relit et améliore le texte, sans inventer de faits."
      />
      {!user ? <p className="lkdv-cv2c-warning">Connecte-toi pour créer un carnet.</p> : null}
    </>
  );
}

function TraceStep({ user }: { user: { id: string } | null }) {
  const form = useFormContext<CarnetFormValuesV2>();
  const trace = form.watch('trace') ?? [];
  const km = form.watch('distanceKm');
  const gain = form.watch('deniveleM');
  return (
    <>
      <TracePaneV2 user={user} />
      <div className="lkdv-cv2c-metric-row">
        <NumberFieldV2 name="distanceKm" label="Distance" unit="km" max={10_000} step={0.1} />
        <NumberFieldV2 name="deniveleM" label="Dénivelé" unit="m" max={30_000} step={10} />
      </div>
      <p className="lkdv-cv2-field-hint">
        {trace.length > 1
          ? `Tracé enregistré : ${trace.length} points, ${km.toFixed(1).replace('.', ',')} km, +${gain} m.`
          : 'Trace au doigt ou importe un GPX : distance et dénivelé se remplissent seuls.'}
      </p>
    </>
  );
}

function PartageStep({ user }: { user: User | null }) {
  const form = useFormContext<CarnetFormValuesV2>();
  const values = form.watch();
  const photos = useMemo(
    () => carnetPhotos(values).filter((photo) => photo.status === 'uploaded' && photo.url),
    [values],
  );
  const cover = carnetCover(values);
  const [handle, setHandle] = useState('');
  const [resolveState, setResolveState] = useState<'idle' | 'loading' | 'error'>('idle');
  const [collaboratorNames, setCollaboratorNames] = useState<Record<string, string>>({});

  const addCollaborator = async () => {
    const raw = handle.trim().replace(/^@/, '');
    if (!raw || !user) return;
    setResolveState('loading');
    try {
      const supabase = createClient();
      const { data } = await supabase
        .from('public_profiles')
        .select('id, handle, full_name')
        .eq('handle', raw.toLowerCase())
        .maybeSingle();
      const record = data as { id?: string; handle?: string; full_name?: string } | null;
      if (!record?.id) {
        setResolveState('error');
        return;
      }
      if (!values.collaborators.includes(record.id)) {
        form.setValue('collaborators', [...values.collaborators, record.id], {
          shouldDirty: true,
          shouldValidate: true,
        });
        setCollaboratorNames((current) => ({
          ...current,
          [record.id as string]: record.full_name ?? record.handle ?? raw,
        }));
      }
      setHandle('');
      setResolveState('idle');
    } catch {
      setResolveState('error');
    }
  };

  return (
    <>
      <div className="lkdv-cv2-card lkdv-cv2c-recap">
        <span className="lkdv-cv2-eyebrow">Aperçu de la fiche</span>
        <b>{values.title || 'Titre du carnet'}</b>
        <small>
          {values.destination || 'Destination'} · {values.days.length} jour{values.days.length > 1 ? 's' : ''} ·{' '}
          {values.distanceKm.toFixed(1).replace('.', ',')} km ·{' '}
          {values.visibility === 'private' ? 'Privé' : values.visibility === 'friends' ? 'Amis' : 'Public'}
        </small>
        {cover?.url ? (
          // eslint-disable-next-line @next/next/no-img-element -- URL Storage du carnet
          <img src={cover.url} alt="" className="lkdv-cv2c-carnet-cover" />
        ) : null}
      </div>
      <div className="lkdv-cv2-field">
        <span className="lkdv-cv2-field-label">Couverture</span>
        {photos.length === 0 ? (
          <p className="lkdv-cv2-field-hint">
            Ajoute des photos dans les moments (étape Jours) : la première devient la couverture.
          </p>
        ) : (
          <div className="lkdv-cv2-media-grid">
            {photos.map((photo) => (
              <button
                key={photo.id}
                type="button"
                className={`lkdv-cv2-media-item${cover?.id === photo.id ? ' is-cover' : ''}`}
                aria-pressed={cover?.id === photo.id}
                aria-label="Choisir comme couverture"
                onClick={() =>
                  form.setValue('coverMediaId', photo.id, { shouldDirty: true, shouldValidate: true })
                }
              >
                {/* eslint-disable-next-line @next/next/no-img-element -- URL Storage du carnet */}
                <img src={photo.url} alt={photo.alt || ''} />
              </button>
            ))}
          </div>
        )}
      </div>
      <TagsFieldV2 />
      <div className="lkdv-cv2-field">
        <span className="lkdv-cv2-field-label">Voyageurs et collaborateurs</span>
        <button
          type="button"
          className="lkdv-cv2c-switch"
          role="switch"
          aria-checked={values.isCollaborative}
          onClick={() =>
            form.setValue('isCollaborative', !values.isCollaborative, { shouldDirty: true })
          }
        >
          <span className="lkdv-cv2c-switch-track" aria-hidden="true">
            <span className="lkdv-cv2c-switch-dot" />
          </span>
          Carnet collaboratif
        </button>
        {values.isCollaborative ? (
          <>
            <div className="lkdv-cv2c-inline-add">
              <input
                type="text"
                className="lkdv-cv2-input"
                value={handle}
                placeholder="@pseudo d’un compagnon de route"
                aria-label="Pseudo du collaborateur"
                onChange={(event) => setHandle(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault();
                    void addCollaborator();
                  }
                }}
              />
              <button
                type="button"
                className="lkdv-cv2-chip lkdv-cv2-chip--lg"
                onClick={() => void addCollaborator()}
                disabled={resolveState === 'loading'}
              >
                {resolveState === 'loading' ? (
                  <Loader2 size={12} className="lkdv-cv2c-spin" aria-hidden="true" />
                ) : (
                  <Plus size={12} aria-hidden="true" />
                )}
                Ajouter
              </button>
            </div>
            {resolveState === 'error' ? (
              <p className="lkdv-cv2-field-hint lkdv-cv2c-notice" role="status">
                Aucun profil trouvé avec ce pseudo.
              </p>
            ) : null}
            {values.collaborators.length > 0 ? (
              <div className="lkdv-cv2-chips">
                {values.collaborators.map((id) => (
                  <span key={id} className="lkdv-cv2-chip lkdv-cv2-chip--sm">
                    {collaboratorNames[id] ?? 'Collaborateur'}
                    <button
                      type="button"
                      className="lkdv-cv2c-chip-x"
                      aria-label="Retirer ce collaborateur"
                      onClick={() =>
                        form.setValue(
                          'collaborators',
                          values.collaborators.filter((entry) => entry !== id),
                          { shouldDirty: true, shouldValidate: true },
                        )
                      }
                    >
                      <X size={11} aria-hidden="true" />
                    </button>
                  </span>
                ))}
              </div>
            ) : null}
          </>
        ) : null}
      </div>
      {values.visibility === 'public' ? (
        <>
          <button
            type="button"
            className="lkdv-cv2c-switch"
            role="switch"
            aria-checked={values.postEnabled}
            onClick={() =>
              form.setValue('postEnabled', !values.postEnabled, { shouldDirty: true, shouldValidate: true })
            }
          >
            <span className="lkdv-cv2c-switch-track" aria-hidden="true">
              <span className="lkdv-cv2c-switch-dot" />
            </span>
            Publier une annonce dans le fil
          </button>
          {values.postEnabled ? (
            <TextAreaFieldV2
              name="postContent"
              label="Texte de l’annonce"
              placeholder="Nouveau carnet en ligne : …"
              maxLength={2000}
              rows={3}
            />
          ) : null}
        </>
      ) : (
        <p className="lkdv-cv2-field-hint">
          Carnet {values.visibility === 'private' ? 'privé' : 'amis'} : aucun post ne sera publié dans le fil.
        </p>
      )}
      <p className="lkdv-cv2-field-hint">
        <BookOpen size={11} aria-hidden="true" /> {photos.length} photo{photos.length > 1 ? 's' : ''} et{' '}
        {values.days.reduce((total, day) => total + day.moments.length, 0)} moment
        {values.days.reduce((total, day) => total + day.moments.length, 0) > 1 ? 's' : ''} seront
        enregistrés.
      </p>
    </>
  );
}

function CarnetBody({
  api,
  user,
  prefill,
  prefillNonce,
}: {
  api: CreateFormEngineApiV2<CarnetFormValuesV2>;
  user: User | null;
  prefill?: Record<string, unknown> | null;
  prefillNonce: number;
}) {
  const form = api.form;
  const watchedTrace = form.watch('trace');
  const trace = useMemo(() => watchedTrace ?? [], [watchedTrace]);
  const prefillValues = useMemo(() => {
    if (!prefill) return null;
    const mapped: Record<string, unknown> = {};
    for (const key of ['title', 'destination', 'startDate', 'endDate', 'visibility']) {
      if (typeof prefill[key] === 'string') mapped[key] = prefill[key];
    }
    return Object.keys(mapped).length > 0 ? mapped : null;
  }, [prefill]);

  // Le point de départ est enregistré pour la carte de la fiche (`start_geom`).
  useEffect(() => {
    if (trace.length === 0) return;
    form.setValue('startLat', trace[0][1], { shouldDirty: true });
    form.setValue('startLng', trace[0][0], { shouldDirty: true });
  }, [form, trace]);

  return (
    <>
      <PrefillApplierV2 values={prefillValues} nonce={prefillNonce} />
      {api.step === 0 ? <InfosStep user={user} /> : null}
      {api.step === 1 ? <TraceStep user={user} /> : null}
      {api.step === 2 ? <DaysPaneV2 user={user} /> : null}
      {api.step === 3 ? <PartageStep user={user} /> : null}
    </>
  );
}

/**
 * Carnet V2 (`Carnet#1-20`) : Infos → Tracé → Jours → Partage.
 *
 * - carte MapLibre topo réelle (même init que `CarnetMapDrawer`), tracé au
 *   doigt, annuler/rétablir, import GPX / sortie enregistrée, profil d'altitude ;
 * - jours en mini-capsule interne, moments typés avec **photos réellement
 *   téléversées** (EXIF retiré, ≤ 10 Mo) ;
 * - couverture choisie parmi les photos, visibilité Public/Amis/Privé
 *   (**Privé par défaut**), nuits seulement si `carnet_nights` existe
 *   (`HAS_CARNET_NIGHTS`, faux en prod) ;
 * - aide à l'écriture du récit reprise de `CarnetCreateForm` (bouton IA) ;
 * - envoi `create_carnet_v2` (atomique, couverture = une photo envoyée).
 */
export function CarnetFormV2({ active, prefill, prefillNonce, onNavChange }: CreateFormV2Props) {
  const { user, reportCreated } = useCreateSheet();
  const defaults = useRef(createDefaultsV2('carnet')).current;

  return (
    <CreateFormEngineV2<CarnetFormValuesV2>
      kind="carnet"
      schema={carnetSchemaV2}
      defaultValues={defaults}
      active={active}
      disabled={!user}
      onNavChange={onNavChange}
      onSubmit={async (values) => {
        try {
          const result = await createCarnetV2(values, { hasCarnetNights: HAS_CARNET_NIGHTS });
          reportCreated('carnet', { id: result.id, name: values.title.trim() });
        } catch (error) {
          await deleteMediaObjectsV2(uploadedObjectsOf(carnetPhotos(values)));
          throw error;
        }
      }}
    >
      {(api) => (
        <CarnetBody api={api} user={user} prefill={prefill} prefillNonce={prefillNonce} />
      )}
    </CreateFormEngineV2>
  );
}

export default CarnetFormV2;
