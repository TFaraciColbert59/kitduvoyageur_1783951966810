'use client';

import React, { useEffect, useMemo, useRef } from 'react';
import {
  BookOpen,
  Check,
  Mountain,
  PenLine,
  Plus,
  Users,
} from 'lucide-react';
import { useFormContext } from 'react-hook-form';
import type { User } from '@supabase/supabase-js';
import { CreateFormEngineV2, type CreateFormEngineApiV2 } from '../engine/CreateFormEngineV2';
import {
  carnetSchemaV2,
  createDefaultsV2,
  type CarnetFormValuesV2,
} from '../engine/createSchemasV2';
import { useCreateSheet } from '../CreateSheetContext';
import { carnetCover, carnetPhotos, createCarnetV2 } from '../createRpc';
import { TextFieldV2 } from '../fields/FieldV2';
import { SelectDropdownV2 } from '../fields/SelectDropdownV2';
import { VisibilityPickerV2 } from '../fields/VisibilityPickerV2';
import { TagsFieldV2 } from '../fields/TagsFieldV2';
import { useMyClubsV2 } from '../club/useMyClubsV2';
import { PlaceFieldV2 } from '../fields/PlaceFieldV2';
import { PrefillApplierV2 } from '../fields/PrefillApplierV2';
import { deleteMediaObjectsV2, uploadedObjectsOf } from '../fields/media';
import { normalizeRouteTrace } from '../../data/communityFeedMappers';
import { useCarnetNights } from '../carnet/capabilities';
import { TracePaneV2 } from '../carnet/TracePaneV2';
import { TrailSearchFieldV2 } from '../carnet/TrailSearchFieldV2';
import { DaysPaneV2 } from '../carnet/DaysPaneV2';
import {
  carnetDayCountV2,
  carnetEndDateForDaysV2,
  syncCarnetDaysV2,
} from '../carnet/daySync';
import { useHapticFeedback } from '@/hooks/useHapticFeedback';
import { SheetPreview } from '../../shared/SheetPreview';
import { CollapsibleHeroPreview, useScrollCollapsePreview } from '../photo/CollapsibleHeroPreview';
import { CarnetHeroEditorV2 } from '../carnet/CarnetHeroEditorV2';
import type { CreateFormV2Props } from './types';

const VISIBILITIES = [
  { value: 'private', label: 'Privé', description: 'Visible par toi uniquement (par défaut)' },
  { value: 'friends', label: 'Amis', description: 'Visible par tes amis' },
  { value: 'public', label: 'Public', description: 'Visible par toute la communauté' },
] as const;

const DESTINATION_SUGGESTIONS = ['Chamonix', 'Vercors', 'Écrins', 'Queyras', 'Mercantour', 'Haute-Savoie'];

/**
 * Aide à l'écriture de la maquette (HTML L2953) : chaque chip ajoute la
 * question dans le récit (`acts['n-help']`, L3045), au lieu d'un bouton IA.
 */
const WRITING_HELP = [
  'Où as-tu dormi ?',
  'Le moment fort du jour',
  'Une rencontre marquante',
  'Ce que tu emporterais la prochaine fois',
];

function visibilityLabel(value: CarnetFormValuesV2['visibility']): string {
  return value === 'public' ? 'Public' : value === 'friends' ? 'Amis' : 'Privé';
}

function formatKm(km: number): string {
  return `${km.toFixed(1).replace('.', ',')} km`;
}

/**
 * FID-029 — **aperçu vivant** en tête d'Infos (maquette `preview`, L3008) :
 * couverture, titre, destination, jours, km, visibilité, voyageurs.
 */
function CarnetPreviewV2({ values }: { values: CarnetFormValuesV2 }) {
  const cover = carnetCover(values);
  const days = values.nbJours || values.days.length || 1;
  // Carnet#10 : le tracé dessiné apparaît en filigrane sur la couverture, comme
  // sur la tuile (maquette `cprev`, L3008) ; il se met à jour à chaque geste.
  const trace = normalizeRouteTrace(values.trace);
  return (
    <div className="lkdv-cv2c-carnet-preview" data-testid="cv2c-carnet-preview" inert aria-hidden="true">
      <span className="lkdv-cv2c-carnet-preview-cover" data-photo={cover?.url ? 'true' : undefined}>
        {cover?.url ? (
          // eslint-disable-next-line @next/next/no-img-element -- URL Storage du carnet
          <img src={cover.url} alt="" />
        ) : (
          <Mountain size={22} />
        )}
        {trace ? (
          <svg
            className="lkdv-cv2-trace lkdv-cv2c-carnet-preview-trace"
            viewBox="0 0 100 100"
            preserveAspectRatio="xMidYMid meet"
            aria-hidden="true"
            data-testid="cv2c-carnet-preview-trace"
          >
            <path d={trace.map(([x, y], index) => `${index === 0 ? 'M' : 'L'}${x} ${y}`).join(' ')} />
            <circle cx={trace[0]?.[0]} cy={trace[0]?.[1]} r={2.2} />
            <circle cx={trace[trace.length - 1]?.[0]} cy={trace[trace.length - 1]?.[1]} r={2.2} />
          </svg>
        ) : null}
        <span className="lkdv-cv2c-carnet-preview-visa">
          <b>{values.destination.slice(0, 2).toUpperCase() || 'FR'}</b>
          <i>
            {days} J · {formatKm(values.distanceKm).replace(' km', ' KM')}
          </i>
        </span>
      </span>
      <span className="lkdv-cv2c-carnet-preview-body">
        <b>{values.title || 'Titre du carnet'}</b>
        <small>
          {values.destination || 'Destination'} · {days} j · {formatKm(values.distanceKm)}
          {values.deniveleM > 0 ? ` · +${values.deniveleM} m` : ''}
        </small>
        <small>
          {visibilityLabel(values.visibility)} · {values.nbVoyageurs + values.collaborators.length} voyageur
          {values.nbVoyageurs + values.collaborators.length > 1 ? 's' : ''}
        </small>
      </span>
    </div>
  );
}

function InfosStep({ user }: { user: User | null }) {
  const form = useFormContext<CarnetFormValuesV2>();
  const values = form.watch();
  const description = values.description ?? '';
  const { haptic } = useHapticFeedback();
  const myClubs = useMyClubsV2(user?.id ?? null);
  useEffect(() => {
    if (values.visibility === 'club') void myClubs.load();
  }, [myClubs, values.visibility]);
  const dateCount = carnetDayCountV2(values.startDate, values.endDate);
  const days = values.nbJours || 1;

  // Nombre de jours → date de fin (unidirectionnel, sans boucle sur les dates).
  useEffect(() => {
    if (!values.startDate) return;
    const end = carnetEndDateForDaysV2(values.startDate, days);
    if (end && form.getValues('endDate') !== end) {
      form.setValue('endDate', end, { shouldDirty: true, shouldValidate: true });
    }
  }, [days, form, values.startDate]);

  // Au montage, un brouillon qui porte déjà des jours fixe le stepper (aucune
  // troncature silencieuse d'un brouillon antérieur à `nbJours`).
  const daysSyncReady = useRef(false);
  useEffect(() => {
    const current = form.getValues('days') ?? [];
    if (current.length > 0 && form.getValues('nbJours') !== current.length) {
      form.setValue('nbJours', current.length, { shouldDirty: true });
    }
    daysSyncReady.current = true;
  }, [form]);

  // Ensuite, les jours matérialisés suivent le stepper (sans perdre leurs
  // moments) : la synchronisation ne joue qu'après le montage.
  useEffect(() => {
    if (!daysSyncReady.current) return;
    const current = form.getValues('days') ?? [];
    if (current.length === 0) return;
    if (current.length === days) return;
    form.setValue('days', syncCarnetDaysV2(current, days, values.startDate), {
      shouldDirty: true,
      shouldValidate: true,
    });
  }, [days, form, values.startDate]);

  const handleDatesChange = (nextStart: string, nextEnd: string) => {
    const nextCount = carnetDayCountV2(nextStart, nextEnd);
    if (nextCount > 0 && form.getValues('nbJours') !== nextCount) {
      form.setValue('nbJours', nextCount, { shouldDirty: true });
    }
  };

  const appendHelp = (question: string) => {
    const current = form.getValues('description') ?? '';
    const next = `${current.replace(/\s+$/, '')}${current ? '\n\n' : ''}${question}\n`;
    form.setValue('description', next, { shouldDirty: true, shouldValidate: true });
    haptic('selection');
    window.setTimeout(() => {
      const field = document.getElementById('cv2c-description');
      if (field instanceof HTMLTextAreaElement) {
        field.focus();
        field.setSelectionRange(field.value.length, field.value.length);
      }
    }, 60);
  };

  return (
    <div className="lkdv-cv2c-carnet-step0">
      <PlaceFieldV2
        name="destination"
        label="Destination"
        placeholder="Chamonix, Vercors…"
        latName="startLat"
        lngName="startLng"
        required
      />
      {!user ? <p className="lkdv-cv2c-warning">Connecte-toi pour créer un carnet.</p> : null}
    </div>
  );
}

function TraceStep({ user, active }: { user: { id: string } | null; active: boolean }) {
  const form = useFormContext<CarnetFormValuesV2>();
  const trace = form.watch('trace') ?? [];
  const km = form.watch('distanceKm');
  const gain = form.watch('deniveleM');
  return (
    <>
      {active ? (
        <>
          <TrailSearchFieldV2 />
          <TracePaneV2 user={user} />
        </>
      ) : (
        <p className="lkdv-cv2-field-hint">Le tracé s’affiche quand tu reviens sur cette étape.</p>
      )}
      {/*
        Un seul libellé/valeur par métrique (N5) : la rangée métrique de
        `TracePaneV2` (Distance / Dénivelé, maquette `#mstats` L3038) est la
        seule source — les `NumberFieldV2` doublons qui suivaient sont retirés.
      */}
      {trace.length > 1 ? (
        <p className="lkdv-cv2-field-hint">
          {`Tracé enregistré : ${trace.length} points, ${km.toFixed(1).replace('.', ',')} km, +${gain} m.`}
        </p>
      ) : null}
    </>
  );
}

function PartageStep({ user }: { user: User | null }) {
  const form = useFormContext<CarnetFormValuesV2>();
  const values = form.watch();
  const myClubs = useMyClubsV2(user?.id ?? null);
  const photos = useMemo(
    () => carnetPhotos(values).filter((photo) => photo.status === 'uploaded' && photo.url),
    [values],
  );
  const cover = carnetCover(values);
  const { haptic } = useHapticFeedback();

  return (
    <>
      <VisibilityPickerV2
        name="visibility"
        label="Visibilité"
        options={[
          { value: 'public', label: 'Public' },
          { value: 'private', label: 'Privé' },
          { value: 'club', label: 'Club' },
        ]}
        clubs={myClubs.clubs ?? []}
        clubsLoading={myClubs.loading}
        clubsError={myClubs.error}
      />

      <div className="lkdv-cv2-field">
        <label className="lkdv-cv2-field-label">Collaboration</label>
        <button
          type="button"
          className="lkdv-cv2c-switch"
          role="switch"
          aria-checked={Boolean(values.isCollaborative)}
          onClick={() => {
            const next = !values.isCollaborative;
            form.setValue('isCollaborative', next, { shouldDirty: true, shouldValidate: true });
            haptic('selection');
          }}
        >
          <span className="lkdv-cv2c-switch-track" aria-hidden="true">
            <span className="lkdv-cv2c-switch-dot" />
          </span>
          Carnet collaboratif
        </button>
      </div>

      <div className="lkdv-cv2-field">
        <label className="lkdv-cv2-field-label">Publication dans le fil</label>
        <button
          type="button"
          className="lkdv-cv2c-switch"
          role="switch"
          aria-checked={Boolean(values.postEnabled)}
          onClick={() => {
            const next = !values.postEnabled;
            form.setValue('postEnabled', next, { shouldDirty: true, shouldValidate: true });
            haptic('selection');
          }}
        >
          <span className="lkdv-cv2c-switch-track" aria-hidden="true">
            <span className="lkdv-cv2c-switch-dot" />
          </span>
          Publier aussi dans le fil d’actualité
        </button>
        {values.postEnabled ? (
          <div style={{ marginTop: '8px' }}>
            <textarea
              className="lkdv-cv2-input"
              rows={3}
              maxLength={2000}
              placeholder="Texte de la publication accompagnant ce carnet…"
              value={values.postContent ?? ''}
              onChange={(e) =>
                form.setValue('postContent', e.target.value, { shouldDirty: true })
              }
            />
          </div>
        ) : null}
      </div>

      <TagsFieldV2 name="tags" label="Hashtags" />

      {photos.length > 0 ? (
        <div className="lkdv-cv2-field">
          <span className="lkdv-cv2-field-label">Photo de couverture</span>
          <div className="lkdv-cv2-media-grid lkdv-cv2c-hrail">
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
        </div>
      ) : null}
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
  const values = form.watch();
  const prefillValues = useMemo(() => {
    if (!prefill) return null;
    const mapped: Record<string, unknown> = {};
    for (const key of ['title', 'destination', 'startDate', 'endDate', 'visibility', 'description', 'postContent']) {
      if (typeof prefill[key] === 'string' && prefill[key]) mapped[key] = prefill[key];
    }
    for (const key of ['nbJours', 'distanceKm', 'deniveleM', 'startLat', 'startLng']) {
      if (typeof prefill[key] === 'number' && Number.isFinite(prefill[key])) mapped[key] = prefill[key];
    }
    if (typeof prefill.postEnabled === 'boolean') mapped.postEnabled = prefill.postEnabled;
    if (Array.isArray(prefill.tags) && prefill.tags.length > 0) mapped.tags = prefill.tags;
    if (Array.isArray(prefill.trace) && prefill.trace.length >= 2) mapped.trace = prefill.trace;
    if (Array.isArray(prefill.days) && prefill.days.length > 0) mapped.days = prefill.days;
    return Object.keys(mapped).length > 0 ? mapped : null;
  }, [prefill]);

  // Le point de départ est enregistré pour la carte de la fiche (`start_geom`).
  useEffect(() => {
    if (trace.length === 0) return;
    form.setValue('startLat', trace[0][1], { shouldDirty: true });
    form.setValue('startLng', trace[0][0], { shouldDirty: true });
  }, [form, trace]);

  const [previewCollapsed, setPreviewCollapsed] = useScrollCollapsePreview(api.active && api.step > 0);
  const daysCount = values.nbJours || values.days.length || 1;
  const cover = carnetCover(values);

  useEffect(() => {
    if (api.step === 0) setPreviewCollapsed(false);
  }, [api.step, setPreviewCollapsed]);

  return (
    <>
      {api.active ? (
        <SheetPreview compact={false}>
          <CollapsibleHeroPreview
            collapsed={api.step > 0 ? previewCollapsed : false}
            onExpand={() => setPreviewCollapsed(false)}
            title={values.title.trim() || 'Carnet sans titre'}
            subtitle={`${daysCount} j · ${values.nbVoyageurs || 1} voy.`}
            avatarUrl={cover?.url ?? null}
            fallbackText={values.title || 'C'}
          >
            <CarnetHeroEditorV2 user={user} />
          </CollapsibleHeroPreview>
        </SheetPreview>
      ) : null}
      <PrefillApplierV2 values={prefillValues} nonce={prefillNonce} />
      {api.step === 0 ? <InfosStep user={user} /> : null}
      {api.step === 1 ? <TraceStep user={user} active={api.active} /> : null}
      {api.step === 2 ? <DaysPaneV2 user={user} /> : null}
      {api.step === 3 ? <PartageStep user={user} /> : null}
    </>
  );
}

/**
 * Carnet V2 (`Carnet#1-20`) : Infos → Tracé → Jours → Partage.
 *
 * FID-029/030/031/051 : aperçu vivant (slot fixe de la coque depuis FID-056),
 * stepper « Nombre de jours » synchronisé aux dates dans les deux sens, jours
 * initialisés des dates à l'entrée de l'étape, voyageurs en chips + « Inviter
 * par lien » (switch collaboratif dérivé), aide à l'écriture en chips, titre 100.
 * Le reste (carte MapLibre, moments, couverture, envoi `create_carnet_v2`)
 * est conservé.
 */
export function CarnetFormV2({ active, prefill, prefillNonce, onNavChange, stepHosts }: CreateFormV2Props) {
  const { user, reportCreated } = useCreateSheet();
  const defaults = useRef(createDefaultsV2('carnet')).current;
  const hasNights = useCarnetNights();

  return (
    <CreateFormEngineV2<CarnetFormValuesV2>
      kind="carnet"
      schema={carnetSchemaV2}
      defaultValues={defaults}
      active={active}
      disabled={!user}
      onNavChange={onNavChange}
      stepHosts={stepHosts}
      queueWhenOffline
      onSubmit={async (values) => {
        try {
          const result = await createCarnetV2(values, { hasCarnetNights: hasNights });
          reportCreated('carnet', { id: result.id, name: values.title.trim() });
        } catch (error) {
          // Hors ligne, l'envoi est mis en file (Carnet#19) : les photos déjà
          // téléversées doivent rester en place pour la reprise.
          const offline = typeof navigator !== 'undefined' && navigator.onLine === false;
          if (!offline) await deleteMediaObjectsV2(uploadedObjectsOf(carnetPhotos(values)));
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
