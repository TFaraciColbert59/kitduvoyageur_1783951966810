'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  BookOpen,
  Check,
  Link2,
  Loader2,
  Mountain,
  PenLine,
  Plus,
  Users,
  X,
} from 'lucide-react';
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
import { NumberStepperV2 } from '../fields/NumberStepperV2';
import { PlaceFieldV2 } from '../fields/PlaceFieldV2';
import { PrefillApplierV2 } from '../fields/PrefillApplierV2';
import { deleteMediaObjectsV2, uploadedObjectsOf } from '../fields/media';
import { HAS_CARNET_NIGHTS } from '../carnet/capabilities';
import { TracePaneV2 } from '../carnet/TracePaneV2';
import { DaysPaneV2 } from '../carnet/DaysPaneV2';
import {
  carnetDayCountV2,
  carnetEndDateForDaysV2,
  syncCarnetDaysV2,
} from '../carnet/daySync';
import { createClient } from '@/lib/supabase/client';
import { useHapticFeedback } from '@/hooks/useHapticFeedback';
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

interface FriendV2 {
  id: string;
  name: string;
  handle: string;
}

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
  return (
    <div className="lkdv-cv2c-carnet-preview" data-testid="cv2c-carnet-preview" inert aria-hidden="true">
      <span className="lkdv-cv2c-carnet-preview-cover">
        {cover?.url ? (
          // eslint-disable-next-line @next/next/no-img-element -- URL Storage du carnet
          <img src={cover.url} alt="" />
        ) : (
          <Mountain size={22} />
        )}
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
  const dateCount = carnetDayCountV2(values.startDate, values.endDate);
  const days = values.nbJours || 1;

  // Dates → nombre de jours, dans les deux sens (maquette `onInput`, L2971).
  useEffect(() => {
    if (dateCount <= 0) return;
    if (form.getValues('nbJours') === dateCount) return;
    form.setValue('nbJours', dateCount, { shouldDirty: true });
  }, [dateCount, form]);

  // Nombre de jours → date de fin (maquette `onSet days`, L2972).
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
    <>
      <CarnetPreviewV2 values={values} />
      <TextFieldV2
        name="title"
        label="Titre du carnet"
        placeholder="Tour des Écrins"
        required
        // Maquette L2967 : `max:100` (le schéma borne à 100).
        maxLength={100}
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
      <div className="lkdv-cv2-field">
        <span className="lkdv-cv2-field-label">Dates</span>
        <div className="lkdv-cv2c-date-range">
          <DateFieldV2 name="startDate" label="Début" />
          <DateFieldV2 name="endDate" label="Fin" hint="La fin ne précède pas le début." />
        </div>
        {/* Maquette L2970 : stepper « Nombre de jours » + hint
            « Proposé à partir des dates, et inversement. » (FID-029). */}
        <NumberStepperV2
          name="nbJours"
          label="Nombre de jours"
          min={1}
          max={60}
          hint="Proposé à partir des dates, et inversement."
        />
        {dateCount > 0 ? (
          <p className="lkdv-cv2-field-hint" role="status">
            <Check size={11} aria-hidden="true" /> {dateCount} jour{dateCount > 1 ? 's' : ''} d’après tes dates
          </p>
        ) : null}
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
      {/* « Aide à l'écriture » en chips (maquette L2982) : chaque chip ajoute la
          question au récit (comportement de `acts['n-help']`, L3045). */}
      <div className="lkdv-cv2-field">
        <span className="lkdv-cv2-field-label">Aide à l’écriture</span>
        <div className="lkdv-cv2-chips">
          {WRITING_HELP.map((help) => (
            <button
              key={help}
              type="button"
              className="lkdv-cv2-chip lkdv-cv2-chip--sm"
              onClick={() => appendHelp(help)}
            >
              <PenLine size={11} aria-hidden="true" /> {help}
            </button>
          ))}
        </div>
      </div>
      {!user ? <p className="lkdv-cv2c-warning">Connecte-toi pour créer un carnet.</p> : null}
    </>
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
        <TracePaneV2 user={user} />
      ) : (
        <p className="lkdv-cv2-field-hint">Le tracé s’affiche quand tu reviens sur cette étape.</p>
      )}
      {/*
        Un seul libellé/valeur par métrique (N5) : la rangée métrique de
        `TracePaneV2` (Distance / Dénivelé, maquette `#mstats` L3038) est la
        seule source — les `NumberFieldV2` doublons qui suivaient sont retirés.
      */}
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
  const [friends, setFriends] = useState<FriendV2[] | null>(null);
  const [friendsError, setFriendsError] = useState<string | null>(null);
  const [inviteState, setInviteState] = useState<'idle' | 'copied' | 'link'>('idle');
  const [inviteUrl, setInviteUrl] = useState('');
  const { haptic } = useHapticFeedback();

  // « Voyageurs » de la maquette (L3005) : les personnes suivies servent de
  // chips d'amis. Aucune table d'invitation n'existe (SP §6) : le lien copié
  // est une invitation générique, jamais une fausse adhésion.
  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;
    const load = async () => {
      try {
        const supabase = createClient();
        const { data: follows, error } = await supabase
          .from('user_follows')
          .select('following_id')
          .eq('follower_id', user.id)
          .limit(20);
        if (error) throw error;
        const ids = (Array.isArray(follows) ? follows : [])
          .map((row) => String((row as Record<string, unknown>).following_id ?? ''))
          .filter(Boolean);
        if (ids.length === 0) {
          if (!cancelled) setFriends([]);
          return;
        }
        const { data: profiles } = await supabase
          .from('public_profiles')
          .select('id, handle, full_name')
          .in('id', ids);
        if (cancelled) return;
        setFriends(
          (Array.isArray(profiles) ? profiles : []).map((row) => {
            const record = row as Record<string, unknown>;
            const name = String(record.full_name ?? record.handle ?? 'Ami');
            return { id: String(record.id ?? ''), name, handle: String(record.handle ?? '') };
          }).filter((friend) => friend.id),
        );
      } catch {
        if (!cancelled) {
          setFriends([]);
          setFriendsError('Ta liste d’amis est indisponible pour le moment.');
        }
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  // Le switch « Carnet collaboratif » devient un **état dérivé** (FID-031) :
  // un carnet est collaboratif dès qu'un voyageur y est associé.
  useEffect(() => {
    const derived = values.collaborators.length > 0;
    if (form.getValues('isCollaborative') !== derived) {
      form.setValue('isCollaborative', derived, { shouldDirty: true });
    }
  }, [form, values.collaborators.length]);

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

  const toggleFriend = (friend: FriendV2) => {
    const selected = values.collaborators.includes(friend.id);
    form.setValue(
      'collaborators',
      selected
        ? values.collaborators.filter((entry) => entry !== friend.id)
        : [...values.collaborators, friend.id],
      { shouldDirty: true, shouldValidate: true },
    );
    setCollaboratorNames((current) => ({ ...current, [friend.id]: friend.name }));
    haptic('selection');
  };

  /**
   * « Inviter par lien » (maquette `n-invite`, L3053) : copie une URL
   * d'invitation. Aucune route d'invitation n'existe encore (SP §6, pas de
   * table) : l'adresse suit le format de la maquette et n'accorde aucun accès
   * tant que le chantier invitations n'est pas livré — c'est assumé et écrit
   * au code, pas une fausse adhésion.
   */
  const inviteByLink = async () => {
    const token = crypto.randomUUID().slice(0, 8);
    const url = `${window.location.origin}/inviter/carnet-${token}`;
    setInviteUrl(url);
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(url);
        setInviteState('copied');
      } else {
        setInviteState('link');
      }
    } catch {
      setInviteState('link');
    }
    haptic('success');
  };

  return (
    <>
      <div className="lkdv-cv2-card lkdv-cv2c-recap">
        <span className="lkdv-cv2-eyebrow">Aperçu de la fiche</span>
        <b>{values.title || 'Titre du carnet'}</b>
        <small>
          {values.destination || 'Destination'} · {values.nbJours} jour{values.nbJours > 1 ? 's' : ''} ·{' '}
          {values.distanceKm.toFixed(1).replace('.', ',')} km · {visibilityLabel(values.visibility)}
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
      {/* Maquette L3005 : fieldset « Voyageurs » avec chips d'amis + « Inviter
          par lien » ; le switch collaboratif n'est plus un réglage séparé. */}
      <div className="lkdv-cv2-field">
        <span className="lkdv-cv2-field-label">Voyageurs</span>
        {friends === null ? (
          <p className="lkdv-cv2-field-hint" role="status">
            <Loader2 size={12} className="lkdv-cv2c-spin" aria-hidden="true" /> Chargement de tes amis…
          </p>
        ) : friends.length === 0 ? (
          <p className="lkdv-cv2-field-hint">
            {friendsError ?? 'Aucun ami à inviter pour l’instant : ajoute un pseudo ci-dessous.'}
          </p>
        ) : (
          <div className="lkdv-cv2-chips" role="group" aria-label="Inviter des voyageurs">
            {friends.map((friend) => (
              <button
                key={friend.id}
                type="button"
                className="lkdv-cv2-chip lkdv-cv2-chip--lg"
                aria-pressed={values.collaborators.includes(friend.id)}
                onClick={() => toggleFriend(friend)}
              >
                <Users size={12} aria-hidden="true" /> {friend.name}
              </button>
            ))}
          </div>
        )}
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
        <button type="button" className="lkdv-cv2-chip lkdv-cv2-chip--lg" onClick={() => void inviteByLink()}>
          <Link2 size={12} aria-hidden="true" /> Inviter par lien
        </button>
        {inviteState !== 'idle' ? (
          <p className="lkdv-cv2-field-hint" role="status">
            {inviteState === 'copied'
              ? `Lien d’invitation copié · ${inviteUrl}`
              : `Copie impossible : ${inviteUrl}`}
          </p>
        ) : null}
      </div>
      {values.collaborators.length > 0 ? (
        <>
        {/* FID-031 : l'ancien switch « Carnet collaboratif » est un **état
            dérivé** — un carnet est collaboratif dès qu'un voyageur est lié. */}
        <p className="lkdv-cv2-field-hint" role="status">
          Carnet collaboratif · {values.collaborators.length} voyageur
          {values.collaborators.length > 1 ? 's' : ''} invité
          {values.collaborators.length > 1 ? 's' : ''}
        </p>
        <div className="lkdv-cv2-chips" aria-label="Voyageurs invités">
          {values.collaborators.map((id) => (
            <span key={id} className="lkdv-cv2-chip lkdv-cv2-chip--sm">
              {collaboratorNames[id] ?? friends?.find((friend) => friend.id === id)?.name ?? 'Voyageur'}
              <button
                type="button"
                className="lkdv-cv2c-chip-x"
                aria-label="Retirer ce voyageur"
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
        </>
      ) : null}
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
      {api.step === 1 ? <TraceStep user={user} active={api.active} /> : null}
      {api.step === 2 ? <DaysPaneV2 user={user} /> : null}
      {api.step === 3 ? <PartageStep user={user} /> : null}
    </>
  );
}

/**
 * Carnet V2 (`Carnet#1-20`) : Infos → Tracé → Jours → Partage.
 *
 * FID-029/030/031/051 : aperçu vivant en tête d'Infos, stepper « Nombre de
 * jours » synchronisé aux dates dans les deux sens, jours initialisés des
 * dates à l'entrée de l'étape, voyageurs en chips + « Inviter par lien »
 * (switch collaboratif dérivé), aide à l'écriture en chips, titre 100.
 * Le reste (carte MapLibre, moments, couverture, envoi `create_carnet_v2`)
 * est conservé.
 */
export function CarnetFormV2({ active, prefill, prefillNonce, onNavChange, stepHosts }: CreateFormV2Props) {
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
      stepHosts={stepHosts}
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
