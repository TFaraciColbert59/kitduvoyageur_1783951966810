'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Check, GripVertical, ImagePlus, Loader2, MapPin, Moon, Plus, Trash2, UserPlus, X } from 'lucide-react';
import { toast } from 'sonner';
import { useFormContext, useFormState } from 'react-hook-form';
import { createClient } from '@/lib/supabase/client';
import type { LngLat } from '@/features/community/create/carnet/traceEngine';
import { MomentMapOverlayV2 } from './MomentMapOverlayV2';
import { dayTraceColor } from './dayTraceColors';
import {
  fetchSubscribersOnlyV2,
  normalizeSearchText,
  type SubscriberProfileV2,
} from './followersSearchV2';
import { SelectDropdownV2 } from '../fields/SelectDropdownV2';
import {
  STORY_MEDIA_MAX_BYTES,
  createMediaItemV2,
  type CarnetDayV2,
  type CarnetFormValuesV2,
  type CarnetMomentV2,
  type CarnetNightV2,
  type MediaItemV2,
} from '../engine/createSchemasV2';
import { readError } from '../fields/FieldV2';
import {
  IMAGE_LIMITS,
  cropImageToRatio,
  deleteMediaObjectsV2,
  uploadMediaV2,
  validateMediaFile,
  type MediaBucketV2,
} from '../fields/media';
import { useHapticFeedback } from '@/hooks/useHapticFeedback';
import { moveItemBetweenDays } from '../../shared/traceEditing';
import { useCarnetNights } from './capabilities';
import { DAY_PANEL_ID, dayTabId, nextTabIndex, useDaySwipe } from './daySwipe';
import { carnetDayCountV2, carnetDayDateV2, clampCarnetDaysV2, syncCarnetDaysV2 } from './daySync';

const NIGHT_OPTIONS: ReadonlyArray<{ value: CarnetNightV2['type']; label: string }> = [
  { value: 'bivouac', label: 'Bivouac' },
  { value: 'refuge', label: 'Refuge' },
  { value: 'gite', label: 'Gîte' },
  { value: 'camping', label: 'Camping' },
  { value: 'hotel', label: 'Hôtel' },
  { value: 'autre', label: 'Autre' },
];

/** Élément en cours de glisser entre jours (FID-068). */
type DayDragV2 =
  | { kind: 'moment'; day: number; moment: number }
  | { kind: 'night'; day: number };

function newDay(dayNumber: number, date: string): CarnetDayV2 {
  return {
    id: crypto.randomUUID(),
    dayNumber,
    title: '',
    date,
    night: null,
    trace: [],
    moments: [],
  };
}

function newMoment(): CarnetMomentV2 {
  return {
    id: crypto.randomUUID(),
    title: '',
    kind: 'photo',
    time: '',
    text: '',
    place: '',
    lat: null,
    lng: null,
    photo: null,
    media: [],
    encounters: [],
  };
}

function EncounterAvatarThumb({
  url,
  name,
}: {
  url?: string | null;
  name: string;
}) {
  const [broken, setBroken] = useState(false);
  if (url && !broken) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- avatar abonné
      <img
        src={url}
        alt=""
        className="lkdv-post-preview-av-img"
        onError={() => setBroken(true)}
      />
    );
  }
  return (
    <span className="lkdv-post-preview-av-fallback">
      {(name.trim().slice(0, 1) || 'V').toUpperCase()}
    </span>
  );
}

function MomentEncountersRow({
  encounters,
  userId,
  carnetTitle,
  onChange,
}: {
  encounters: string[];
  userId: string;
  carnetTitle: string;
  onChange: (next: string[]) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [query, setQuery] = useState('');
  const [subscribers, setSubscribers] = useState<SubscriberProfileV2[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [inviteCopied, setInviteCopied] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);

  // Charge nos abonnés réels dès le montage pour résoudre noms + photos
  useEffect(() => {
    if (!userId) return undefined;
    let active = true;
    const supabase = createClient();
    void fetchSubscribersOnlyV2(supabase, userId).then((list) => {
      if (!active) return;
      setSubscribers(list);
      setLoaded(true);
    });
    return () => {
      active = false;
    };
  }, [userId]);

  useEffect(() => {
    if (!editing) return undefined;
    const onPointerDown = (e: PointerEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setEditing(false);
      }
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [editing]);

  const addName = (raw: string) => {
    const clean = raw.trim();
    if (!clean) {
      setEditing(false);
      return;
    }
    if (!encounters.includes(clean)) {
      onChange([...encounters, clean]);
    }
    setQuery('');
    setEditing(false);
  };

  const sendReferralInvite = async () => {
    const origin =
      typeof window !== 'undefined' && window.location?.origin
        ? window.location.origin
        : 'https://lekitduvoyageur.fr';
    const refId = userId || 'voyageur';
    const carnetParam = carnetTitle.trim()
      ? `&carnet=${encodeURIComponent(carnetTitle.trim().slice(0, 60))}`
      : '';
    const referralUrl = `${origin}/inscription?ref=${encodeURIComponent(refId)}${carnetParam}`;
    try {
      if (typeof navigator !== 'undefined' && navigator.share) {
        await navigator.share({
          title: 'Rejoins mon carnet sur Le Kit du Voyageur',
          text: 'Crée ton compte avec mon lien de parrainage :',
          url: referralUrl,
        });
      } else if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(referralUrl);
      }
      setInviteCopied(true);
      toast.success('Lien de parrainage copié — partage-le pour inviter à créer un compte');
      window.setTimeout(() => setInviteCopied(false), 3500);
    } catch {
      if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(referralUrl).catch(() => {});
        setInviteCopied(true);
        toast.success('Lien de parrainage copié !');
      }
    }
  };

  const qNorm = normalizeSearchText(query);
  const matching = subscribers
    .filter((s) => !encounters.includes(s.name))
    .filter((s) => {
      if (!qNorm) return true;
      return (
        normalizeSearchText(s.name).includes(qNorm) ||
        (s.handle ? normalizeSearchText(s.handle).includes(qNorm) : false)
      );
    })
    .slice(0, 8);

  const resolveAvatarForName = (name: string): string | null => {
    const target = normalizeSearchText(name);
    const match = subscribers.find(
      (s) =>
        normalizeSearchText(s.name) === target ||
        (s.handle && normalizeSearchText(`@${s.handle}`) === target),
    );
    return match?.avatarUrl ?? null;
  };

  return (
    <div className="lkdv-cv2c-travelers-wrap is-compact" ref={wrapRef} role="group" aria-label="Compagnons rencontrés">
      {editing ? (
        <div className="lkdv-cv2c-traveler-dropdown" role="listbox" aria-label="Choisir une rencontre parmi tes abonnés">
          {matching.map((person) => (
            <button
              key={person.id}
              type="button"
              className="lkdv-cv2c-traveler-dropdown-item"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => addName(person.name)}
            >
              <span className="lkdv-post-preview-av">
                <EncounterAvatarThumb url={person.avatarUrl} name={person.name} />
              </span>
              <span className="lkdv-cv2c-traveler-dropdown-meta">
                <span className="lkdv-cv2c-traveler-dropdown-name">{person.name}</span>
                {person.handle ? (
                  <small className="lkdv-cv2c-traveler-dropdown-handle">@{person.handle}</small>
                ) : null}
              </span>
            </button>
          ))}
          {matching.length === 0 ? (
            <div className="lkdv-cv2c-traveler-dropdown-empty">
              {!loaded
                ? 'Chargement de tes abonnés…'
                : subscribers.length === 0
                  ? 'Aucun abonné trouvé · Utilise Inviter'
                  : 'Aucun abonné correspondant · Utilise Inviter'}
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="lkdv-cv2c-travelers-scroll">
        <div className="lkdv-cv2c-travelers-row">
          {encounters.map((name, index) => {
            const avatarUrl = resolveAvatarForName(name);
            return (
              <div
                key={`${index}-${name}`}
                className="lkdv-post-hero-author-pill lkdv-cv2c-traveler-pill"
              >
                <span className="lkdv-post-preview-av">
                  <EncounterAvatarThumb url={avatarUrl} name={name} />
                </span>
                <span className="lkdv-post-hero-author-meta">
                  <b>{name}</b>
                </span>
                <button
                  type="button"
                  className="lkdv-cv2c-encounter-chip-remove"
                  aria-label={`Retirer ${name}`}
                  onClick={() => onChange(encounters.filter((_, idx) => idx !== index))}
                >
                  <X size={11} aria-hidden="true" />
                </button>
              </div>
            );
          })}

          {editing ? (
            <div className="lkdv-post-hero-author-pill lkdv-cv2c-traveler-pill is-editing">
              <span className="lkdv-post-preview-av">
                <span className="lkdv-post-preview-av-fallback">
                  {(query.trim().slice(0, 1) || '+').toUpperCase()}
                </span>
              </span>
              <input
                ref={inputRef}
                type="text"
                className="lkdv-cv2c-traveler-input"
                placeholder="Rechercher un abonné…"
                aria-label="Rechercher une rencontre"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && matching.length > 0) {
                    e.preventDefault();
                    e.stopPropagation();
                    addName(matching[0].name);
                  } else if (e.key === 'Escape') {
                    e.stopPropagation();
                    setEditing(false);
                    setQuery('');
                  }
                }}
              />
            </div>
          ) : (
            <button
              type="button"
              className="lkdv-post-hero-author-pill lkdv-cv2c-traveler-pill is-dashed"
              onClick={() => {
                setEditing(true);
                window.setTimeout(() => inputRef.current?.focus(), 20);
              }}
              aria-label="Ajouter une rencontre"
            >
              <span className="lkdv-post-preview-av lkdv-cv2c-traveler-plus-av">
                <Plus size={13} aria-hidden="true" />
              </span>
              <span className="lkdv-post-hero-author-meta">
                <b>{encounters.length === 0 ? 'Rencontre' : 'Ajouter'}</b>
              </span>
            </button>
          )}

          {/* Bouton adjacent d'invitation par lien de parrainage, même style pilule */}
          <button
            type="button"
            className={`lkdv-post-hero-author-pill lkdv-cv2c-traveler-pill is-dashed lkdv-cv2c-invite-pill ${inviteCopied ? 'is-copied' : ''}`}
            onClick={() => void sendReferralInvite()}
            aria-label="Inviter par lien de parrainage"
          >
            <span className="lkdv-post-preview-av lkdv-cv2c-traveler-plus-av">
              {inviteCopied ? <Check size={12} aria-hidden="true" /> : <UserPlus size={12} aria-hidden="true" />}
            </span>
            <span className="lkdv-post-hero-author-meta">
              <b>{inviteCopied ? 'Lien copié' : 'Inviter'}</b>
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}

function MomentMediaSlotV2({
  userId,
  media = [],
  photo,
  onChange,
}: {
  userId: string;
  media?: MediaItemV2[];
  photo?: MediaItemV2 | null;
  onChange: (patch: { media: MediaItemV2[]; photo: MediaItemV2 | null }) => void;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const mediaList = useMemo(() => {
    if (media.length > 0) return media;
    if (photo) return [photo];
    return [];
  }, [media, photo]);

  const currentMedia = mediaList[activeIndex] ?? mediaList[0] ?? null;

  const uploadFiles = async (files: FileList | null) => {
    if (!files || files.length === 0 || !userId) return;
    const remaining = 5 - mediaList.length;
    if (remaining <= 0) {
      setNotice('5 médias maximum par moment.');
      return;
    }
    const toUpload = Array.from(files).slice(0, remaining);
    setUploading(true);
    setNotice(null);

    const newlyAdded: MediaItemV2[] = [];
    try {
      for (const file of toUpload) {
        const isVideo = file.type.startsWith('video/');
        if (isVideo) {
          if (file.size > STORY_MEDIA_MAX_BYTES) {
            setNotice(`${file.name} dépasse 25 Mo.`);
            continue;
          }
          const uploaded = await uploadMediaV2(file, { userId, bucket: 'carnet-moments-media' });
          newlyAdded.push(
            createMediaItemV2({
              name: file.name,
              type: file.type || 'video/mp4',
              size: file.size,
              url: uploaded.url,
              storageBucket: uploaded.bucket,
              storagePath: uploaded.path,
              status: 'uploaded',
              progress: 100,
              crop: '1:1',
            }),
          );
        } else {
          const validation = validateMediaFile(file, IMAGE_LIMITS);
          if (!validation.ok) {
            setNotice(validation.message ?? 'Photo refusée.');
            continue;
          }
          const prepared = await cropImageToRatio(file, '1:1');
          const uploaded = await uploadMediaV2(prepared, { userId, bucket: 'carnet-media' });
          newlyAdded.push(
            createMediaItemV2({
              name: file.name,
              type: prepared.type || file.type,
              size: prepared.size,
              url: uploaded.url,
              storageBucket: uploaded.bucket,
              storagePath: uploaded.path,
              status: 'uploaded',
              progress: 100,
              crop: '1:1',
            }),
          );
        }
      }

      if (newlyAdded.length > 0) {
        const nextMedia = [...mediaList, ...newlyAdded];
        onChange({ media: nextMedia, photo: nextMedia[0] ?? null });
        setActiveIndex(nextMedia.length - 1);
      }
    } catch (err) {
      setNotice(err instanceof Error ? err.message : 'Échec de l’envoi du média.');
    } finally {
      setUploading(false);
    }
  };

  const removeCurrent = () => {
    if (!currentMedia) return;
    if (currentMedia.storagePath && currentMedia.storageBucket) {
      void deleteMediaObjectsV2([
        {
          bucket: currentMedia.storageBucket as MediaBucketV2,
          path: currentMedia.storagePath,
        },
      ]);
    }
    const nextMedia = mediaList.filter((_, idx) => idx !== activeIndex);
    const nextIndex = Math.max(0, Math.min(activeIndex, nextMedia.length - 1));
    setActiveIndex(nextIndex);
    onChange({ media: nextMedia, photo: nextMedia[0] ?? null });
  };

  return (
    <div className="lkdv-cv2c-moment-media-slot">
      <input
        ref={inputRef}
        type="file"
        accept="image/*,video/mp4,video/webm,video/quicktime"
        multiple
        className="lkdv-cv2c-sr-only"
        aria-label="Photos ou vidéos du moment (max 5)"
        onChange={(event) => {
          void uploadFiles(event.target.files);
          event.target.value = '';
        }}
      />

      {mediaList.length === 0 ? (
        <button
          type="button"
          className="lkdv-cv2c-moment-media-empty"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          aria-label="Ajouter une photo ou vidéo"
        >
          {uploading ? (
            <Loader2 size={18} className="lkdv-cv2c-spin" aria-hidden="true" />
          ) : (
            <>
              <ImagePlus size={20} strokeWidth={1.8} aria-hidden="true" />
              <span>Média</span>
            </>
          )}
        </button>
      ) : (
        <div className="lkdv-cv2c-moment-media-preview" style={{ position: 'relative', width: '100%', height: '100%' }}>
          {currentMedia?.type?.startsWith('video/') ? (
            <video
              src={currentMedia.url}
              className="lkdv-cv2c-moment-media-thumb"
              muted
              playsInline
            />
          ) : (
            <img
              src={currentMedia?.url ?? ''}
              alt={currentMedia?.alt || 'Média du moment'}
              className="lkdv-cv2c-moment-media-thumb"
            />
          )}

          {uploading ? (
            <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Loader2 size={18} className="lkdv-cv2c-spin" style={{ color: '#fff' }} aria-hidden="true" />
            </div>
          ) : null}

          {/* Delete active item */}
          <button
            type="button"
            className="lkdv-cv2c-icon-btn"
            style={{ position: 'absolute', top: 3, right: 3, width: 20, height: 20, background: 'rgba(0,0,0,0.6)', color: '#fff', borderRadius: '50%' }}
            aria-label="Retirer ce média"
            onClick={removeCurrent}
          >
            <Trash2 size={10} aria-hidden="true" />
          </button>

          {/* Add more button if < 5 */}
          {mediaList.length < 5 ? (
            <button
              type="button"
              className="lkdv-cv2c-icon-btn"
              style={{ position: 'absolute', top: 3, left: 3, width: 20, height: 20, background: 'rgba(0,0,0,0.6)', color: '#fff', borderRadius: '50%' }}
              aria-label="Ajouter un autre média"
              onClick={() => inputRef.current?.click()}
            >
              <Plus size={11} aria-hidden="true" />
            </button>
          ) : null}

          {/* Badge & thumb switcher */}
          <div
            className="lkdv-cv2c-moment-media-badge"
            onClick={() => {
              if (mediaList.length > 1) {
                setActiveIndex((activeIndex + 1) % mediaList.length);
              }
            }}
            style={{ cursor: mediaList.length > 1 ? 'pointer' : 'default' }}
          >
            {activeIndex + 1}/{mediaList.length}
          </div>
        </div>
      )}

      {notice ? (
        <p className="lkdv-cv2-field-error" style={{ fontSize: '10px' }} role="alert">
          {notice}
        </p>
      ) : null}
    </div>
  );
}

/**
 * Jours et moments du carnet (`Carnet#11-13`, `Carnet#20`) : mini-capsule des
 * jours dans le panneau, moments typés (photo, rencontre, nuit, dépense, objet,
 * espèce), **photos réellement téléversées** dans le bucket des carnets,
 * nuits/refuges seulement si `carnet_nights` répond (sonde `useCarnetNights`).
 */
export function DaysPaneV2({ user }: { user: { id: string } | null }) {
  const form = useFormContext<CarnetFormValuesV2>();
  const { errors } = useFormState<CarnetFormValuesV2>({ control: form.control });
  const daysMessage = readError(errors, 'days');
  const values = form.watch();
  const days = values.days ?? [];
  const [active, setActive] = useState(0);
  const { haptic } = useHapticFeedback();
  const hasNights = useCarnetNights();
  const clampedActive = Math.max(0, Math.min(days.length - 1, active));
  const day = days[clampedActive];

  const setDays = (next: CarnetDayV2[]) => {
    form.setValue('days', next, { shouldDirty: true, shouldValidate: true });
  };

  // Carnet#20 — tablist complet : flèches, Home/End, tabindex itinérant,
  // activation automatique ; Carnet#11 — glisser horizontal entre les jours.
  const panelRef = useRef<HTMLDivElement | null>(null);
  const goToDay = (index: number, moveFocus = false) => {
    const target = Math.max(0, Math.min(days.length - 1, index));
    if (target === clampedActive) return;
    setActive(target);
    haptic('selection');
    if (moveFocus && typeof document !== 'undefined') {
      const id = days[target] ? dayTabId(days[target].id) : '';
      requestAnimationFrame(() => document.getElementById(id)?.focus({ preventScroll: false }));
    }
  };
  const onTabsKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const next = nextTabIndex(event.key, clampedActive, days.length);
    if (next == null) return;
    event.preventDefault();
    goToDay(next, true);
  };
  const swipeHandlers = useDaySwipe({
    panelRef,
    onSwipe: (direction) => goToDay(clampedActive + direction),
    enabled: days.length > 1,
  });

  // FID-068 — glisser un moment (ou la nuitée) d'un jour à un autre : la cible
  // est la pastille de jour sous le doigt (`data-cv2-day-drop`). La
  // transformation de liste est celle, pure et testée, de `shared/traceEditing`.
  const dragRef = useRef<DayDragV2 | null>(null);
  const [drag, setDrag] = useState<DayDragV2 | null>(null);
  const [dropDay, setDropDay] = useState<number | null>(null);
  const [announcement, setAnnouncement] = useState('');

  const dayIndexAt = (clientX: number, clientY: number): number | null => {
    if (typeof document === 'undefined') return null;
    const element = document.elementFromPoint(clientX, clientY);
    const target = element?.closest<HTMLElement>('[data-cv2-day-drop]');
    if (!target) return null;
    const index = Number(target.dataset.cv2DayDrop);
    return Number.isInteger(index) ? index : null;
  };

  const applyMove = (payload: DayDragV2, targetDay: number) => {
    if (targetDay === payload.day || targetDay < 0 || targetDay >= days.length) return;
    if (payload.kind === 'moment') {
      const arrays = days.map((entry) => entry.moments);
      const moved = moveItemBetweenDays(
        arrays,
        payload.day,
        payload.moment,
        targetDay,
        arrays[targetDay].length,
      );
      setDays(days.map((entry, index) => ({ ...entry, moments: moved[index] })));
      setAnnouncement(`Moment déplacé au jour ${days[targetDay].dayNumber}.`);
    } else {
      if (days[targetDay].night) {
        setAnnouncement(`Le jour ${days[targetDay].dayNumber} a déjà une nuitée.`);
        return;
      }
      const nights = days.map((entry) => (entry.night ? [entry.night] : []));
      const moved = moveItemBetweenDays(nights, payload.day, 0, targetDay, 0);
      setDays(
        days.map((entry, index) => ({ ...entry, night: moved[index][0] ?? null })),
      );
      setAnnouncement(`Nuitée déplacée au jour ${days[targetDay].dayNumber}.`);
    }
    setActive(targetDay);
    haptic('selection');
  };

  const beginDrag = (payload: DayDragV2, event: React.PointerEvent<HTMLButtonElement>) => {
    if (event.button > 0) return;
    dragRef.current = payload;
    setDrag(payload);
    setDropDay(payload.day);
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      /* capture optionnelle (Safari ancien, tests) */
    }
  };

  const moveDrag = (event: React.PointerEvent<HTMLButtonElement>) => {
    if (!dragRef.current) return;
    setDropDay(dayIndexAt(event.clientX, event.clientY));
  };

  const endDrag = (event: React.PointerEvent<HTMLButtonElement>) => {
    const payload = dragRef.current;
    if (!payload) return;
    dragRef.current = null;
    const targetDay = dayIndexAt(event.clientX, event.clientY);
    setDrag(null);
    setDropDay(null);
    if (targetDay != null) applyMove(payload, targetDay);
  };

  const cancelDrag = () => {
    dragRef.current = null;
    setDrag(null);
    setDropDay(null);
  };

  /**
   * FID-030 — à l'entrée de l'étape, les jours sont **initialisés depuis les
   * dates** (min 1) : nombre de jours du stepper d'Infos, ou nombre de jours
   * des dates s'il est connu. L'état vide ne subsiste que **sans aucune date**
   * (maquette `syncDays`, HTML L2969 et `onStep` Jours).
   */
  const [mapOpenMomentId, setMapOpenMomentId] = useState<string | null>(null);

  useEffect(() => {
    const current = form.getValues('days') ?? [];
    if (current.length > 0) return;
    const startDate = form.getValues('startDate') ?? '';
    const fromDates = startDate ? carnetDayCountV2(startDate, form.getValues('endDate') ?? '') : 0;
    const count = clampCarnetDaysV2(fromDates || form.getValues('nbJours') || 1);
    form.setValue('days', syncCarnetDaysV2([], count, startDate), {
      shouldDirty: false,
      shouldValidate: false,
    });
  }, [form, values.startDate]);

  const setDayCount = (count: number) => {
    form.setValue('nbJours', clampCarnetDaysV2(count), { shouldDirty: true });
  };

  const updateDay = (index: number, patch: Partial<CarnetDayV2>) => {
    setDays(days.map((entry, position) => (position === index ? { ...entry, ...patch } : entry)));
  };

  const updateMoment = (dayIndex: number, momentIndex: number, patch: Partial<CarnetMomentV2>) => {
    setDays(
      days.map((entry, position) =>
        position === dayIndex
          ? {
              ...entry,
              moments: entry.moments.map((moment, momentPosition) =>
                momentPosition === momentIndex ? { ...moment, ...patch } : moment,
              ),
            }
          : entry,
      ),
    );
  };

  const addDay = () => {
    const startDate = values.startDate || '';
    const nextNumber = Math.min(60, days.length + 1);
    const last = days[days.length - 1];
    const nextDate = startDate
      ? carnetDayDateV2(startDate, days.length)
      : last?.date
        ? new Date(new Date(`${last.date}T12:00:00`).getTime() + 86_400_000).toISOString().slice(0, 10)
        : '';
    const next = [
      ...days.map((entry, idx) => ({ ...entry, dayNumber: idx + 1 })),
      newDay(nextNumber, nextDate),
    ];
    setDays(next);
    setDayCount(next.length);
    setActive(next.length - 1);
    haptic('selection');
  };

  return (
    <div className="lkdv-cv2c-days" data-dragging={drag ? 'true' : undefined}>
      <p className="lkdv-cv2c-sr-only" role="status">
        {announcement}
      </p>
      {daysMessage ? (
        <p className="lkdv-cv2-field-error" role="alert">
          {daysMessage}
        </p>
      ) : null}
      <div className="lkdv-cv2c-day-tabs" data-hscroll>
        <div
          className="lkdv-cv2c-day-tablist"
          role="tablist"
          aria-label="Jours du carnet"
          aria-orientation="horizontal"
          onKeyDown={onTabsKeyDown}
        >
          {days.map((entry, index) => (
            <button
              key={entry.id}
              type="button"
              role="tab"
              id={dayTabId(entry.id)}
              aria-selected={index === clampedActive}
              aria-controls={DAY_PANEL_ID}
              tabIndex={index === clampedActive ? 0 : -1}
              className="lkdv-cv2c-day-tab"
              data-cv2-day-drop={index}
              data-drop={dropDay === index && drag !== null ? 'true' : undefined}
              onClick={() => setActive(index)}
            >
              J{entry.dayNumber}
            </button>
          ))}
        </div>
        {days.length < 60 ? (
          <button type="button" className="lkdv-cv2c-day-tab-add" aria-label="Ajouter un jour" onClick={addDay}>
            +
          </button>
        ) : null}
      </div>
      <div
        id={DAY_PANEL_ID}
        ref={panelRef}
        role="tabpanel"
        aria-labelledby={day ? dayTabId(day.id) : undefined}
        aria-label={day ? undefined : 'Jours du carnet'}
        className="lkdv-cv2c-day-panel"
        data-testid="cv2c-day-panel"
        {...swipeHandlers}
      >
      {!day ? (
        <p className="lkdv-cv2c-empty">
          Aucune date de départ : ajoute un jour, puis raconte chaque moment. Dès que le
          carnet a des dates, les jours se remplissent tout seuls.
        </p>
      ) : (
        <>
          <div className="lkdv-cv2c-day-actions">
            {hasNights ? (
              <button
                type="button"
                className="lkdv-cv2c-switch"
                role="switch"
                aria-checked={Boolean(day.night)}
                onClick={() =>
                  updateDay(clampedActive, {
                    night: day.night ? null : { name: '', type: 'bivouac', altitudeM: null, infos: '' },
                  })
                }
              >
                <span className="lkdv-cv2c-switch-track" aria-hidden="true">
                  <span className="lkdv-cv2c-switch-dot" />
                </span>
                Nuitée
              </button>
            ) : <span />}

            <div className="lkdv-cv2c-day-actions-right">
              {days.length > 1 ? (
                <button
                  type="button"
                  className="lkdv-cv2c-icon-btn lkdv-cv2c-moment-delete"
                  aria-label="Retirer ce jour"
                  title="Retirer ce jour"
                  onClick={() => {
                    const startDate = values.startDate ?? '';
                    const next = days
                      .filter((_, position) => position !== clampedActive)
                      .map((entry, idx) => ({
                        ...entry,
                        dayNumber: idx + 1,
                        date: startDate ? carnetDayDateV2(startDate, idx) : entry.date,
                      }));
                    setDays(next);
                    setDayCount(next.length);
                    setActive(Math.min(clampedActive, Math.max(0, next.length - 1)));
                    haptic('selection');
                  }}
                >
                  <Trash2 size={14} aria-hidden="true" />
                </button>
              ) : null}
            </div>
          </div>
          {hasNights && day.night ? (() => {
            const nightNameError = readError(errors, `days.${clampedActive}.night.name`);
            return (
              <div className="lkdv-cv2c-night-card" data-testid="cv2c-night-card">
                <div className="lkdv-cv2c-night-card-head">
                  <span className="lkdv-cv2c-night-card-title">
                    <Moon size={13} aria-hidden="true" />
                    Nuitée · J{day.dayNumber}
                  </span>
                  <button
                    type="button"
                    className="lkdv-cv2c-icon-btn lkdv-cv2c-night-close"
                    aria-label="Retirer la nuitée"
                    title="Retirer la nuitée"
                    onClick={() => {
                      updateDay(clampedActive, { night: null });
                      haptic('selection');
                    }}
                  >
                    <X size={13} aria-hidden="true" />
                  </button>
                </div>
                <div className="lkdv-cv2c-night-top-grid">
                  <input
                    type="text"
                    className="lkdv-cv2-input lkdv-cv2c-night-input-sm"
                    value={day.night.name}
                    placeholder="Nom (Refuge du Temple…)"
                    aria-label="Nom de la nuitée"
                    aria-invalid={Boolean(nightNameError)}
                    maxLength={120}
                    onChange={(event) =>
                      updateDay(clampedActive, { night: { ...day.night!, name: event.target.value } })
                    }
                  />
                  <SelectDropdownV2
                    name={`days.${clampedActive}.night.type`}
                    options={[...NIGHT_OPTIONS]}
                    value={day.night.type}
                    placeholder="Type"
                    onChange={(next) =>
                      updateDay(clampedActive, {
                        night: { ...day.night!, type: String(next) as CarnetNightV2['type'] },
                      })
                    }
                  />
                </div>
                {nightNameError ? (
                  <p className="lkdv-cv2-field-error" role="alert">
                    {nightNameError}
                  </p>
                ) : null}
                <div className="lkdv-cv2c-night-meta-grid">
                  <div className="lkdv-cv2c-night-alt-wrap">
                    <input
                      type="number"
                      className="lkdv-cv2-input lkdv-cv2c-night-input-sm"
                      value={day.night.altitudeM ?? ''}
                      min={-500}
                      max={9000}
                      placeholder="Alt."
                      aria-label="Altitude de la nuitée (m)"
                      onChange={(event) => {
                        const raw = event.target.value;
                        const parsed = raw === '' ? null : Number.parseInt(raw, 10);
                        updateDay(clampedActive, {
                          night: {
                            ...day.night!,
                            altitudeM: parsed !== null && Number.isFinite(parsed) ? parsed : null,
                          },
                        });
                      }}
                    />
                    <span className="lkdv-cv2c-night-unit" aria-hidden="true">m</span>
                  </div>
                  <input
                    type="text"
                    className="lkdv-cv2-input lkdv-cv2c-night-input-sm"
                    value={day.night.infos}
                    placeholder="Eau, gardien, demi-pension…"
                    aria-label="Informations sur la nuitée"
                    maxLength={300}
                    onChange={(event) =>
                      updateDay(clampedActive, { night: { ...day.night!, infos: event.target.value } })
                    }
                  />
                </div>
              </div>
            );
          })() : null}

          {day.moments.length > 0 ? (
            <ul className="lkdv-cv2c-moments">
              {day.moments.map((moment, momentIndex) => {
                const isMapOpen = mapOpenMomentId === moment.id;
                const dayTrace = ((day.trace && day.trace.length >= 2
                  ? day.trace
                  : values.trace) ?? []) as LngLat[];
                return (
                <li
                  key={moment.id}
                  className={`lkdv-cv2c-moment lkdv-cv2c-moment-card ${isMapOpen ? 'has-map-open' : ''}`}
                  data-dragging={
                    drag?.kind === 'moment' && drag.day === clampedActive && drag.moment === momentIndex
                      ? 'true'
                      : undefined
                  }
                >
                  {isMapOpen ? (
                    <MomentMapOverlayV2
                      trace={dayTrace}
                      traceColor={dayTraceColor(clampedActive)}
                      lat={moment.lat}
                      lng={moment.lng}
                      place={moment.place}
                      onSelectPoint={(nextLat, nextLng, placeLabel) =>
                        updateMoment(clampedActive, momentIndex, {
                          lat: nextLat,
                          lng: nextLng,
                          ...(placeLabel ? { place: placeLabel.slice(0, 120) } : {}),
                        })
                      }
                      onClose={() => setMapOpenMomentId(null)}
                    />
                  ) : null}
                  <div className="lkdv-cv2c-moment-head">
                    {/* FID-068 : glisser le moment vers la pastille d'un autre jour
                        (ou flèches gauche/droite au clavier). */}
                    <button
                      type="button"
                      className="lkdv-cv2c-icon-btn lkdv-cv2c-drag"
                      aria-label={`Déplacer le moment ${momentIndex + 1}. Glisse sur un jour, ou flèches gauche et droite`}
                      onPointerDown={(event) =>
                        beginDrag(
                          { kind: 'moment', day: clampedActive, moment: momentIndex },
                          event,
                        )
                      }
                      onPointerMove={moveDrag}
                      onPointerUp={endDrag}
                      onPointerCancel={cancelDrag}
                      onKeyDown={(event) => {
                        if (event.key === 'ArrowLeft') {
                          event.preventDefault();
                          event.stopPropagation();
                          applyMove(
                            { kind: 'moment', day: clampedActive, moment: momentIndex },
                            clampedActive - 1,
                          );
                        } else if (event.key === 'ArrowRight') {
                          event.preventDefault();
                          event.stopPropagation();
                          applyMove(
                            { kind: 'moment', day: clampedActive, moment: momentIndex },
                            clampedActive + 1,
                          );
                        }
                      }}
                    >
                      <GripVertical size={13} aria-hidden="true" />
                    </button>
                    <span className="lkdv-cv2c-moment-kind">
                      Moment {momentIndex + 1}
                    </span>
                    <button
                      type="button"
                      className="lkdv-cv2c-icon-btn"
                      aria-label="Placer un checkpoint sur la carte"
                      title="Checkpoint sur la carte"
                      aria-pressed={moment.lat != null && moment.lng != null}
                      onClick={() =>
                        setMapOpenMomentId((cur) => (cur === moment.id ? null : moment.id))
                      }
                    >
                      <MapPin size={12} aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      className="lkdv-cv2c-icon-btn lkdv-cv2c-moment-delete"
                      aria-label="Retirer ce moment"
                      onClick={() =>
                        updateDay(clampedActive, {
                          moments: day.moments.filter((_, position) => position !== momentIndex),
                        })
                      }
                    >
                      <Trash2 size={12} aria-hidden="true" />
                    </button>
                  </div>

                  <div className="lkdv-cv2c-moment-card-row">
                    {/* Colonne gauche : photo en grand (100px) */}
                    <div className="lkdv-cv2c-moment-media-left">
                      <MomentMediaSlotV2
                        userId={user?.id ?? ''}
                        media={moment.media ?? (moment.photo ? [moment.photo] : [])}
                        photo={moment.photo}
                        onChange={({ media: nextMedia, photo: nextPhoto }) =>
                          updateMoment(clampedActive, momentIndex, { media: nextMedia, photo: nextPhoto })
                        }
                      />
                    </div>

                    {/* Colonne droite : éléments organisés proprement */}
                    <div className="lkdv-cv2c-moment-fields-right">
                      <div className="lkdv-cv2c-moment-top-grid">
                        <input
                          type="text"
                          className="lkdv-cv2-input lkdv-cv2c-moment-input-sm lkdv-cv2c-moment-title-input"
                          value={moment.title ?? ''}
                          placeholder="Titre du moment"
                          aria-label="Titre du moment"
                          maxLength={120}
                          onChange={(event) =>
                            updateMoment(clampedActive, momentIndex, { title: event.target.value })
                          }
                        />
                      </div>

                      <div className="lkdv-cv2c-moment-meta-grid">
                        <input
                          type="time"
                          className="lkdv-cv2-input lkdv-cv2c-moment-input-sm"
                          value={moment.time}
                          aria-label="Heure du moment"
                          onChange={(event) =>
                            updateMoment(clampedActive, momentIndex, { time: event.target.value })
                          }
                        />
                        <input
                          type="text"
                          className="lkdv-cv2-input lkdv-cv2c-moment-input-sm"
                          value={moment.place}
                          maxLength={120}
                          placeholder="Lieu"
                          aria-label="Lieu du moment"
                          onChange={(event) =>
                            updateMoment(clampedActive, momentIndex, { place: event.target.value })
                          }
                        />
                      </div>

                      <input
                        type="text"
                        className="lkdv-cv2-input lkdv-cv2c-moment-input-sm"
                        maxLength={500}
                        value={moment.text}
                        placeholder="Raconter ce moment…"
                        aria-label="Commentaire du moment"
                        onChange={(event) =>
                          updateMoment(clampedActive, momentIndex, { text: event.target.value })
                        }
                      />
                    </div>
                  </div>

                  {/* Rencontres en bas sur toute la largeur (défilement horizontal) */}
                  <div className="lkdv-cv2c-moment-encounters-footer">
                    <MomentEncountersRow
                      encounters={moment.encounters ?? []}
                      userId={user?.id ?? ''}
                      carnetTitle={values.title ?? ''}
                      onChange={(encounters) =>
                        updateMoment(clampedActive, momentIndex, { encounters })
                      }
                    />
                  </div>
                </li>
                );
              })}
            </ul>
          ) : null}

          {day.moments.length < 100 ? (
            <button
              type="button"
              className="lkdv-cv2c-moment-empty"
              data-testid="cv2c-add-moment-dashed"
              style={day.moments.length > 0 ? { marginTop: '10px' } : undefined}
              onClick={() => {
                updateDay(clampedActive, { moments: [...day.moments, newMoment()] });
                haptic('selection');
              }}
              aria-label={day.moments.length === 0 ? 'Ajouter un premier moment' : 'Ajouter un moment'}
            >
              <span className="lkdv-cv2c-moment-empty-icon">
                <Plus size={20} aria-hidden="true" />
              </span>
              <span>{day.moments.length === 0 ? 'Ajouter un premier moment' : 'Ajouter un moment'}</span>
            </button>
          ) : null}
        </>
      )}
      </div>
    </div>
  );
}

export default DaysPaneV2;
