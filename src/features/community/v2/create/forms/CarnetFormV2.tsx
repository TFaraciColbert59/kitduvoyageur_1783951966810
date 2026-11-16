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
import { DateRangeFieldV2 } from '../fields/DateRangeFieldV2';
import { toast } from 'sonner';
import { TextAreaFieldV2, TextFieldV2 } from '../fields/FieldV2';
import { SelectDropdownV2 } from '../fields/SelectDropdownV2';
import { VisibilityPickerV2 } from '../fields/VisibilityPickerV2';
import { TagsFieldV2 } from '../fields/TagsFieldV2';
import {
  fetchMentionProfiles,
  normalizeMentionQuery,
  type MentionProfile,
} from '@/features/community/feed/MentionPicker';
import { useMyClubsV2 } from '../club/useMyClubsV2';
import { NumberStepperV2 } from '../fields/NumberStepperV2';
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
import { createClient } from '@/lib/supabase/client';
import { useHapticFeedback } from '@/hooks/useHapticFeedback';
import { SheetPreview } from '../../shared/SheetPreview';
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
        latName="startLat"
        lngName="startLng"
        required
      />
      <DateRangeFieldV2
        startName="startDate"
        endName="endDate"
        label="Dates"
      />
      <div className="lkdv-cv2c-row-2">
        <NumberStepperV2
          name="nbJours"
          label="Nombre de jours"
          min={1}
          max={60}
        />
        <NumberStepperV2 name="nbVoyageurs" label="Voyageurs" min={1} max={50} />
      </div>
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
      />
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
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<MentionProfile[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [collaboratorNames, setCollaboratorNames] = useState<Record<string, string>>({});
  const [friends, setFriends] = useState<FriendV2[] | null>(null);
  const [friendsError, setFriendsError] = useState<string | null>(null);
  const [inviteState, setInviteState] = useState<'idle' | 'copied' | 'link'>('idle');
  const [inviteUrl, setInviteUrl] = useState('');
  const { haptic } = useHapticFeedback();

  // « Voyageurs » de la maquette (L3005) : les personnes suivies servent de
  // chips d'amis.
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
          (Array.isArray(profiles) ? profiles : [])
            .map((row) => {
              const record = row as Record<string, unknown>;
              const name = String(record.full_name ?? record.handle ?? 'Ami');
              return { id: String(record.id ?? ''), name, handle: String(record.handle ?? '') };
            })
            .filter((friend) => friend.id),
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

  useEffect(() => {
    const normalized = normalizeMentionQuery(searchQuery);
    if (normalized.length < 2) {
      setSearchResults([]);
      setSearchLoading(false);
      return;
    }
    const timer = window.setTimeout(async () => {
      setSearchLoading(true);
      try {
        const supabase = createClient();
        const profiles = await fetchMentionProfiles(supabase, normalized, 6);
        setSearchResults(profiles);
      } catch {
        setSearchResults([]);
      } finally {
        setSearchLoading(false);
      }
    }, 200);
    return () => window.clearTimeout(timer);
  }, [searchQuery]);

  const selectProfile = (profile: MentionProfile) => {
    if (!values.collaborators.includes(profile.id)) {
      form.setValue('collaborators', [...values.collaborators, profile.id], {
        shouldDirty: true,
        shouldValidate: true,
      });
      form.setValue('isCollaborative', true, { shouldDirty: true });
      const displayName = profile.full_name || (profile.handle ? `@${profile.handle}` : 'Voyageur');
      setCollaboratorNames((current) => ({
        ...current,
        [profile.id]: displayName,
      }));
    }
    setSearchQuery('');
    setSearchResults([]);
    haptic('selection');
  };

  const toggleFriend = (friend: FriendV2) => {
    const selected = values.collaborators.includes(friend.id);
    const next = selected
      ? values.collaborators.filter((entry) => entry !== friend.id)
      : [...values.collaborators, friend.id];
    form.setValue('collaborators', next, { shouldDirty: true, shouldValidate: true });
    if (next.length > 0) {
      form.setValue('isCollaborative', true, { shouldDirty: true });
    }
    setCollaboratorNames((current) => ({ ...current, [friend.id]: friend.name }));
    haptic('selection');
  };

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
    toast.success('Lien d’invitation prêt');
    haptic('success');
  };

  return (
    <>
      <VisibilityPickerV2
        name="visibility"
        clubId={values.clubId}
        myClubs={myClubs}
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

      <div className="lkdv-cv2-field">
        <span className="lkdv-cv2-field-label">Voyageurs</span>
        <div style={{ position: 'relative' }}>
          <div className="lkdv-cv2c-inline-add">
            <input
              type="text"
              className="lkdv-cv2-input"
              value={searchQuery}
              placeholder="Rechercher par nom ou @pseudo…"
              aria-label="Rechercher un voyageur"
              onChange={(event) => setSearchQuery(event.target.value)}
            />
            {searchLoading ? (
              <span style={{ display: 'inline-flex', alignItems: 'center', padding: '0 8px' }}>
                <Loader2 size={16} className="lkdv-cv2c-spin" aria-hidden="true" />
              </span>
            ) : null}
          </div>
          {searchResults.length > 0 ? (
            <ul
              className="lkdv-cv2c-mention-suggestions"
              style={{
                position: 'absolute',
                top: '100%',
                left: 0,
                right: 0,
                zIndex: 20,
                background: 'var(--lkv-surface-paper, #ffffff)',
                boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                borderRadius: '8px',
                margin: '4px 0 0 0',
                padding: '4px',
                listStyle: 'none',
                maxHeight: '180px',
                overflowY: 'auto',
              }}
            >
              {searchResults.map((profile) => (
                <li key={profile.id}>
                  <button
                    type="button"
                    style={{
                      width: '100%',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      padding: '6px 8px',
                      borderRadius: '6px',
                      border: 'none',
                      background: 'transparent',
                      textAlign: 'left',
                      cursor: 'pointer',
                    }}
                    onClick={() => selectProfile(profile)}
                  >
                    {profile.avatar_url ? (
                      <img
                        src={profile.avatar_url}
                        alt=""
                        style={{ width: 24, height: 24, borderRadius: '50%', objectFit: 'cover' }}
                      />
                    ) : (
                      <span
                        style={{
                          width: 24,
                          height: 24,
                          borderRadius: '50%',
                          background: 'var(--lkv-surface-muted)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: 11,
                        }}
                      >
                        {(profile.full_name || profile.handle || '?')[0].toUpperCase()}
                      </span>
                    )}
                    <span style={{ display: 'flex', flexDirection: 'column' }}>
                      <b style={{ fontSize: '12px' }}>{profile.full_name || profile.handle}</b>
                      {profile.handle ? (
                        <small style={{ fontSize: '10.5px', color: 'var(--lkv-text-secondary)' }}>
                          @{profile.handle}
                        </small>
                      ) : null}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>

        {friends && friends.length > 0 ? (
          <div style={{ marginTop: '8px' }}>
            <span className="lkdv-cv2-field-hint" style={{ display: 'block', marginBottom: '4px' }}>
              Amis suivis :
            </span>
            <div className="lkdv-cv2-chips" aria-label="Amis suivis">
              {friends.map((friend) => {
                const selected = values.collaborators.includes(friend.id);
                return (
                  <button
                    key={friend.id}
                    type="button"
                    className={`lkdv-cv2-chip lkdv-cv2-chip--sm${selected ? ' is-active' : ''}`}
                    onClick={() => toggleFriend(friend)}
                  >
                    {friend.name}
                  </button>
                );
              })}
            </div>
          </div>
        ) : null}

        <div style={{ marginTop: '8px' }}>
          <button type="button" className="lkdv-cv2-chip lkdv-cv2-chip--lg" onClick={() => void inviteByLink()}>
            <Link2 size={12} aria-hidden="true" /> Inviter par lien
          </button>
          {inviteState !== 'idle' ? (
            <p className="lkdv-cv2-field-hint" role="status" style={{ marginTop: '4px' }}>
              {inviteState === 'copied'
                ? `Lien d’invitation copié · ${inviteUrl}`
                : `Copie impossible : ${inviteUrl}`}
            </p>
          ) : null}
        </div>
      </div>

      {values.collaborators.length > 0 ? (
        <div className="lkdv-cv2-field">
          <p className="lkdv-cv2-field-hint" role="status">
            Carnet collaboratif · {values.collaborators.length} voyageur
            {values.collaborators.length > 1 ? 's' : ''} associé
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
