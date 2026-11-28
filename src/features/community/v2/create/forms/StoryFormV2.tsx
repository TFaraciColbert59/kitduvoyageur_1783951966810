'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AnimatePresence } from 'framer-motion';
import {
  Plus,
  Trash2,
  CloudSun,
  Loader2,
  Link2,
  RotateCcw,
} from 'lucide-react';
import { getCurrentGeoPosition } from '@/lib/native/geolocation';
import { useFormContext, useFormState } from 'react-hook-form';
import type { User } from '@supabase/supabase-js';
import { CreateFormEngineV2, type CreateFormEngineApiV2 } from '../engine/CreateFormEngineV2';
import {
  createDefaultsV2,
  createMediaItemV2,
  storySchemaV2,
  type MediaItemV2,
  type StoryFormValuesV2,
  type StoryTextLayerV2,
} from '../engine/createSchemasV2';
import { useCreateSheet } from '../CreateSheetContext';
import { publishStoryV2 } from '../createRpc';
import { TextAreaFieldV2, TextFieldV2, readError } from '../fields/FieldV2';
import { VisibilityPickerV2 } from '../fields/VisibilityPickerV2';
import { useMyClubsV2 } from '../club/useMyClubsV2';
import { PlaceFieldV2 } from '../fields/PlaceFieldV2';
import {
  STORY_LIMITS,
  deleteMediaObjectsV2,
  uploadMediaV2,
  uploadedObjectsOf,
  validateMediaFile,
} from '../fields/media';
import { carnetDayCountV2 } from '../carnet/daySync';
import { SheetPreview } from '../../shared/SheetPreview';
import { todayIso } from '../../shared/format';
import { fetchEventDayWeather, storyWeatherSticker } from '../../data/communityDetails';
import { createClient } from '@/lib/supabase/client';
import { useHapticFeedback } from '@/hooks/useHapticFeedback';
import type { CreateFormV2Props } from './types';
import { StoryHeroPreview } from '../photo/StoryHeroPreview';
import { PhotoThumbnailStrip } from '../photo/PhotoThumbnailStrip';
import { PhotoEditorCard } from '../photo/PhotoEditorCard';
import { useScrollCollapsePreview } from '../photo/CollapsibleHeroPreview';
import {
  type PhotoEditorCategory,
  type PhotoModifiersV2,
  DEFAULT_PHOTO_MODIFIERS,
  PHOTO_EDITOR_CATEGORIES,
} from '../photo/photoEditor';

const REPLY_OPTIONS = [
  { value: 'everyone', label: 'Tout le monde' },
  { value: 'followers', label: 'Mes abonnés' },
  { value: 'off', label: 'Désactivées' },
] as const;

const LAYER_STYLES = [
  { value: 'clair', label: 'Clair' },
  { value: 'encre', label: 'Encre' },
  { value: 'sauge', label: 'Sauge' },
] as const;

interface CarnetOption {
  id: string;
  title: string;
  visibility: string | null;
  days: number;
}

function LayerTools({
  selectedId,
  onSelect,
}: {
  selectedId: string | null;
  onSelect: (id: string | null) => void;
}) {
  const form = useFormContext<StoryFormValuesV2>();
  const { errors: layerErrors } = useFormState<StoryFormValuesV2>({ control: form.control });
  const layersError = readError(layerErrors, 'textLayers');
  const layers = form.watch('textLayers') ?? [];
  const stickers = form.watch('stickers');
  const [weatherState, setWeatherState] = useState<'idle' | 'loading' | 'unavailable'>('idle');
  const [weatherHint, setWeatherHint] = useState<string | null>(null);
  const [linkOpen, setLinkOpen] = useState(Boolean(stickers.link?.url));
  const [linkUrlDraft, setLinkUrlDraft] = useState(stickers.link?.url ?? '');
  const [linkLabelDraft, setLinkLabelDraft] = useState(stickers.link?.label ?? '');
  const { haptic } = useHapticFeedback();
  const place = stickers.place;

  useEffect(() => {
    if (stickers.link?.url) {
      setLinkOpen(true);
      setLinkUrlDraft(stickers.link.url);
      setLinkLabelDraft(stickers.link.label ?? '');
    }
  }, [stickers.link]);

  const setStickers = (patch: Partial<StoryFormValuesV2['stickers']>) => {
    form.setValue('stickers', { ...stickers, ...patch }, { shouldDirty: true, shouldValidate: true });
  };

  const loadWeather = async () => {
    setWeatherState('loading');
    setWeatherHint(null);
    try {
      let coords: { lat: number; lng: number } | null =
        place?.lat != null && place?.lng != null ? { lat: place.lat, lng: place.lng } : null;
      let resolvedPlace = place;

      if (!coords && place?.label?.trim()) {
        try {
          const geoRes = await fetch(
            `/api/geocode?q=${encodeURIComponent(place.label.trim())}&limit=1`,
          );
          if (geoRes.ok) {
            const geoJson = (await geoRes.json()) as {
              matches?: Array<{ lat?: number; lon?: number; name?: string }>;
            };
            const first = geoJson.matches?.[0];
            if (first && typeof first.lat === 'number' && typeof first.lon === 'number') {
              coords = { lat: first.lat, lng: first.lon };
              resolvedPlace = {
                label: place.label.trim() || first.name || 'Lieu',
                lat: first.lat,
                lng: first.lon,
              };
            }
          }
        } catch {
          /* fallback below */
        }
      }

      if (!coords) {
        try {
          const position = await getCurrentGeoPosition({ enableHighAccuracy: false, timeout: 4_500 });
          coords = { lat: position.latitude, lng: position.longitude };
          resolvedPlace = {
            label: place?.label?.trim() || 'Ma position',
            lat: position.latitude,
            lng: position.longitude,
          };
        } catch {
          setWeatherState('unavailable');
          setWeatherHint('Indique un lieu ou active la géolocalisation pour charger la météo.');
          return;
        }
      }

      const weather = await fetchEventDayWeather(coords, todayIso());
      const label = storyWeatherSticker(weather);
      if (!label) {
        setWeatherState('unavailable');
        setWeatherHint('Prévision météo indisponible pour ce lieu aujourd’hui.');
        return;
      }
      setStickers({
        ...(resolvedPlace ? { place: resolvedPlace } : {}),
        weatherLabel: label,
      });
      setWeatherState('idle');
      haptic('selection');
    } catch {
      setWeatherState('unavailable');
      setWeatherHint('Météo indisponible pour le moment.');
    }
  };

  const syncLinkStickers = (nextUrl: string, nextLabel: string) => {
    setLinkUrlDraft(nextUrl);
    setLinkLabelDraft(nextLabel);
    const trimmedUrl = nextUrl.trim();
    if (!trimmedUrl && !nextLabel.trim()) {
      setStickers({ link: null });
      return;
    }
    setStickers({ link: { url: trimmedUrl, label: nextLabel } });
  };

  const update = (id: string, patch: Partial<StoryTextLayerV2>) => {
    form.setValue(
      'textLayers',
      layers.map((layer) => (layer.id === id ? { ...layer, ...patch } : layer)),
      { shouldDirty: true, shouldValidate: true },
    );
  };

  const selected = layers.find((layer) => layer.id === selectedId) ?? layers[layers.length - 1] ?? null;

  return (
    <div className="lkdv-cv2c-story-tools">
      <div className="lkdv-cv2c-section-head">
        <span className="lkdv-cv2c-section-label">
          Calques texte{layers.length > 0 ? ` (${layers.length}/5)` : ''}
        </span>
        <button
          type="button"
          className="lkdv-cv2-chip lkdv-cv2-chip--sm"
          disabled={layers.length >= 5}
          onClick={() => {
            if (layers.length >= 5) return;
            const id = crypto.randomUUID();
            form.setValue(
              'textLayers',
              [
                ...layers,
                { id, text: 'Ton texte', x: 0.5, y: 0.42, scale: 1, rotation: 0, style: 'clair' },
              ],
              { shouldDirty: true, shouldValidate: true },
            );
            onSelect(id);
            haptic('light');
          }}
        >
          <Plus size={12} aria-hidden="true" />
          {layers.length >= 5 ? '5 max' : 'Ajouter un texte'}
        </button>
      </div>
      {layersError ? (
        <p className="lkdv-cv2-field-error" role="alert">
          {layersError}
        </p>
      ) : null}
      {layers.length > 0 ? (
        <ul className="lkdv-cv2c-layer-list">
          {layers.map((layer) => {
            const isActive = selected?.id === layer.id;
            return (
              <li
                key={layer.id}
                className="lkdv-cv2c-layer-row"
                data-selected={isActive || undefined}
                onClick={() => onSelect(layer.id)}
              >
                <input
                  type="text"
                  className="lkdv-cv2-input"
                  value={layer.text}
                  maxLength={120}
                  aria-label="Texte de la story"
                  onFocus={() => onSelect(layer.id)}
                  onChange={(event) => update(layer.id, { text: event.target.value })}
                />
                <button
                  type="button"
                  className="lkdv-cv2c-icon-btn"
                  aria-label="Retirer ce texte"
                  onClick={(event) => {
                    event.stopPropagation();
                    form.setValue(
                      'textLayers',
                      layers.filter((entry) => entry.id !== layer.id),
                      { shouldDirty: true, shouldValidate: true },
                    );
                    if (selectedId === layer.id) onSelect(null);
                  }}
                >
                  <Trash2 size={13} aria-hidden="true" />
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
      {selected ? (
        <div className="lkdv-cv2-card lkdv-cv2c-story-layer-card">
          <div className="lkdv-cv2c-story-layer-head">
            <div className="lkdv-cv2-seg lkdv-cv2c-seg" role="group" aria-label="Style du texte">
              {LAYER_STYLES.map((style) => (
                <button
                  key={style.value}
                  type="button"
                  aria-pressed={selected.style === style.value}
                  onClick={() => update(selected.id, { style: style.value })}
                >
                  {style.label}
                </button>
              ))}
            </div>
            <button
              type="button"
              className="lkdv-cv2-chip lkdv-cv2-chip--sm"
              aria-label="Recentrer ce texte"
              title="Recentrer et réinitialiser"
              onClick={() => update(selected.id, { x: 0.5, y: 0.42, scale: 1, rotation: 0 })}
            >
              <RotateCcw size={12} aria-hidden="true" />
              Centrer
            </button>
          </div>
          <p className="lkdv-cv2-field-hint">
            Déplace, pince ou tire la poignée du texte directement sur l’aperçu ({(selected.scale ?? 1).toFixed(1)}× · {selected.rotation ?? 0}°).
          </p>
        </div>
      ) : null}

      {/* Widgets Météo & Lien regroupés dans le bloc Calques texte */}
      <div className="lkdv-cv2c-inline-add">
        <button
          type="button"
          className="lkdv-cv2-chip lkdv-cv2-chip--lg"
          onClick={() => void loadWeather()}
          disabled={weatherState === 'loading'}
        >
          {weatherState === 'loading' ? (
            <Loader2 size={13} className="lkdv-cv2c-spin" aria-hidden="true" />
          ) : (
            <CloudSun size={13} aria-hidden="true" />
          )}
          {stickers.weatherLabel ? stickers.weatherLabel : 'Météo du jour'}
        </button>
        {stickers.weatherLabel ? (
          <button
            type="button"
            className="lkdv-cv2-chip lkdv-cv2-chip--sm"
            onClick={() => setStickers({ weatherLabel: '' })}
          >
            Retirer météo
          </button>
        ) : null}
        <button
          type="button"
          className="lkdv-cv2-chip lkdv-cv2-chip--lg"
          aria-expanded={linkOpen}
          onClick={() => {
            const next = !linkOpen;
            setLinkOpen(next);
            if (!next) {
              setLinkUrlDraft('');
              setLinkLabelDraft('');
              setStickers({ link: null });
            }
          }}
        >
          <Link2 size={13} aria-hidden="true" />
          {linkOpen ? 'Retirer le lien' : 'Lien'}
        </button>
      </div>
      {weatherHint ? (
        <p className="lkdv-cv2-field-hint" role="status">
          {weatherHint}
        </p>
      ) : null}
      {linkOpen ? (
        <div className="lkdv-cv2c-row-2">
          <div className="lkdv-cv2-field">
            <label className="lkdv-cv2-field-label" htmlFor="cv2c-story-link-url">
              URL
            </label>
            <input
              id="cv2c-story-link-url"
              type="url"
              inputMode="url"
              className="lkdv-cv2-input"
              placeholder="https://…"
              value={linkUrlDraft}
              onChange={(e) => syncLinkStickers(e.target.value, linkLabelDraft)}
            />
          </div>
          <div className="lkdv-cv2-field">
            <label className="lkdv-cv2-field-label" htmlFor="cv2c-story-link-label">
              Titre du lien
            </label>
            <input
              id="cv2c-story-link-label"
              type="text"
              className="lkdv-cv2-input"
              placeholder="Mon carnet"
              maxLength={60}
              value={linkLabelDraft}
              onChange={(e) => syncLinkStickers(linkUrlDraft, e.target.value)}
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}

function StickerTools() {
  const form = useFormContext<StoryFormValuesV2>();
  const stickers = form.watch('stickers');

  const setStickers = (patch: Partial<StoryFormValuesV2['stickers']>) => {
    form.setValue('stickers', { ...stickers, ...patch }, { shouldDirty: true, shouldValidate: true });
  };

  return (
    <div className="lkdv-cv2c-story-tools">
      <PlaceFieldV2
        name="stickers.place.label"
        label="Lieu"
        latName="stickers.place.lat"
        lngName="stickers.place.lng"
        placeholder="Chamonix…"
      />
      <div className="lkdv-cv2c-metric-row">
        <div className="lkdv-cv2-field">
          <label className="lkdv-cv2-field-label" htmlFor="cv2c-story-altitude">
            Altitude
          </label>
          <div className="lkdv-cv2c-number-row">
            <input
              id="cv2c-story-altitude"
              type="number"
              inputMode="numeric"
              min={-500}
              max={9000}
              className="lkdv-cv2-input"
              value={stickers.altitudeM ?? ''}
              placeholder="—"
              onChange={(event) => {
                const raw = event.target.value;
                setStickers({ altitudeM: raw === '' ? null : Number(raw) });
              }}
            />
            <span className="lkdv-cv2c-unit lkdv-cv2c-number-unit">m</span>
          </div>
        </div>
        <div className="lkdv-cv2-field">
          <label className="lkdv-cv2-field-label" htmlFor="cv2c-story-distance">
            Distance du jour
          </label>
          <div className="lkdv-cv2c-number-row">
            <input
              id="cv2c-story-distance"
              type="number"
              inputMode="decimal"
              min={0}
              max={500}
              step={0.1}
              className="lkdv-cv2-input"
              value={stickers.distanceKm ?? ''}
              placeholder="—"
              onChange={(event) => {
                const raw = event.target.value;
                setStickers({ distanceKm: raw === '' ? null : Number(raw) });
              }}
            />
            <span className="lkdv-cv2c-unit lkdv-cv2c-number-unit">km</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function StoryCarnetLink() {
  const form = useFormContext<StoryFormValuesV2>();
  const stickers = form.watch('stickers');
  const { user } = useCreateSheet();
  const [carnets, setCarnets] = useState<CarnetOption[] | null>(null);
  const { haptic } = useHapticFeedback();

  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;
    const load = async () => {
      try {
        const supabase = createClient();
        const { data, error: queryError } = await supabase
          .from('carnets')
          .select('id, title, visibility, start_date, end_date, nb_nuits')
          .eq('author_id', user.id)
          .order('created_at', { ascending: false })
          .limit(20);
        if (queryError) throw queryError;
        if (cancelled) return;
        setCarnets(
          (Array.isArray(data) ? data : []).map((row) => {
            const record = row as Record<string, unknown>;
            const start = typeof record.start_date === 'string' ? record.start_date : '';
            const end = typeof record.end_date === 'string' ? record.end_date : '';
            const nights = typeof record.nb_nuits === 'number' ? record.nb_nuits : 0;
            const fromDates = carnetDayCountV2(start, end);
            return {
              id: String(record.id ?? ''),
              title: String(record.title ?? 'Carnet'),
              visibility: typeof record.visibility === 'string' ? record.visibility : null,
              days: Math.max(1, Math.min(60, fromDates || nights + 1 || 1)),
            };
          }),
        );
      } catch {
        if (!cancelled) setCarnets([]);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  const setStickers = (patch: Partial<StoryFormValuesV2['stickers']>) => {
    form.setValue('stickers', { ...stickers, ...patch }, { shouldDirty: true, shouldValidate: true });
  };

  return (
    <div className="lkdv-cv2-field">
      <span className="lkdv-cv2-field-label" id="cv2c-story-carnet-label">
        Lier à un carnet
      </span>
      <div
        className="lkdv-cv2c-hrail lkdv-cv2c-story-carnet-rail"
        data-hscroll
        role="radiogroup"
        aria-labelledby="cv2c-story-carnet-label"
      >
        <button
          type="button"
          role="radio"
          aria-checked={!stickers.carnetId}
          className="lkdv-cv2c-story-carnet-card is-none"
          data-active={!stickers.carnetId}
          onClick={() => {
            setStickers({ carnetId: '', carnetTitle: '', carnetDay: null });
            haptic('selection');
          }}
        >
          <b>Aucun carnet</b>
          <small>Story autonome</small>
        </button>
        {carnets?.map((carnet) => {
          const isSelected = stickers.carnetId === carnet.id;
          return (
            <div
              key={carnet.id}
              className="lkdv-cv2c-story-carnet-card"
              data-active={isSelected}
            >
              <button
                type="button"
                role="radio"
                aria-checked={isSelected}
                className="lkdv-cv2c-story-carnet-main"
                onClick={() => {
                  setStickers({ carnetId: carnet.id, carnetTitle: carnet.title, carnetDay: 1 });
                  haptic('selection');
                }}
              >
                <b>{carnet.title}</b>
                <small>{carnet.days} jour{carnet.days > 1 ? 's' : ''}</small>
              </button>
              <div
                className="lkdv-cv2c-story-carnet-days"
                data-hscroll
                role="radiogroup"
                aria-label={`Jours de ${carnet.title}`}
              >
                {Array.from({ length: carnet.days }, (_, index) => index + 1).map((day) => {
                  const activeDay = isSelected && (stickers.carnetDay ?? 1) === day;
                  return (
                    <button
                      key={day}
                      type="button"
                      role="radio"
                      aria-checked={activeDay}
                      className="lkdv-cv2c-story-day-pill"
                      data-active={activeDay}
                      onClick={() => {
                        setStickers({ carnetId: carnet.id, carnetTitle: carnet.title, carnetDay: day });
                        haptic('selection');
                      }}
                    >
                      J{day}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function StoryDiffusionStep({ inCarnet = false }: { inCarnet?: boolean }) {
  const form = useFormContext<StoryFormValuesV2>();
  const values = form.watch();
  const { user, requestCreate } = useCreateSheet();
  const myClubs = useMyClubsV2(user?.id ?? null);
  useEffect(() => {
    if (values.audience === 'club') void myClubs.load();
  }, [myClubs, values.audience]);
  return (
    <>
      <VisibilityPickerV2
        name="audience"
        label="Visibilité"
        options={[
          { value: 'public', label: 'Public' },
          { value: 'only_me', label: 'Privé' },
          { value: 'club', label: 'Club' },
        ]}
        clubs={myClubs.clubs ?? []}
        clubsLoading={myClubs.loading}
        clubsError={myClubs.error}
        onCreateClub={() => requestCreate('club')}
      />
      {!inCarnet ? (
        <>
          <div className="lkdv-cv2c-crop-row">
            <span className="lkdv-cv2-field-label">Réponses</span>
            <div className="lkdv-cv2-seg lkdv-cv2c-seg" role="group" aria-label="Qui peut répondre">
              {REPLY_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  aria-pressed={values.replyPolicy === option.value}
                  onClick={() =>
                    form.setValue('replyPolicy', option.value, { shouldDirty: true, shouldValidate: true })
                  }
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
          <StoryCarnetLink />
        </>
      ) : null}
      <button
        type="button"
        className="lkdv-cv2c-switch"
        role="switch"
        aria-checked={values.allowReshare}
        onClick={() => form.setValue('allowReshare', !values.allowReshare, { shouldDirty: true })}
      >
        <span className="lkdv-cv2c-switch-track" aria-hidden="true">
          <span className="lkdv-cv2c-switch-dot" />
        </span>
        Autoriser le partage par les spectateurs
      </button>
    </>
  );
}

const STORY_MAX_COUNT = 20;

interface StoryBodyProps {
  api: CreateFormEngineApiV2<StoryFormValuesV2>;
  user: User | null;
  prefill?: Record<string, unknown> | null;
  prefillNonce?: number;
  activeSlideIndex: number;
  setActiveSlideIndex: React.Dispatch<React.SetStateAction<number>>;
  activeCategory: PhotoEditorCategory | null;
  setActiveCategory: React.Dispatch<React.SetStateAction<PhotoEditorCategory | null>>;
  previewCollapsed: boolean;
  setPreviewCollapsed: React.Dispatch<React.SetStateAction<boolean>>;
  savedModifiersRef: React.MutableRefObject<Record<string, PhotoModifiersV2>>;
  inCarnet?: boolean;
}

function StoryBody({
  api,
  user,
  prefill,
  prefillNonce,
  activeSlideIndex,
  setActiveSlideIndex,
  activeCategory,
  setActiveCategory,
  previewCollapsed,
  setPreviewCollapsed,
  savedModifiersRef,
  inCarnet = false,
}: StoryBodyProps) {
  const form = api.form;
  const values = form.watch();
  const [selectedLayerId, setSelectedLayerId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const { errors } = useFormState<StoryFormValuesV2>({ control: form.control });
  const mediaError = readError(errors, 'media');
  const lastPrefillNonceRef = useRef<number>(-1);

  useEffect(() => {
    if (!prefill || prefillNonce === undefined || prefillNonce === lastPrefillNonceRef.current) return;
    lastPrefillNonceRef.current = prefillNonce;
    const prefillMedia = prefill.media as MediaItemV2[] | undefined;
    if (Array.isArray(prefillMedia) && prefillMedia.length > 0) {
      for (const m of prefillMedia) {
        if (m.modifiers) savedModifiersRef.current[m.id] = m.modifiers;
      }
      form.setValue('media', prefillMedia.slice(0, STORY_MAX_COUNT), {
        shouldDirty: true,
        shouldValidate: true,
      });
      setActiveSlideIndex(0);
    }
    if (typeof prefill.caption === 'string' && prefill.caption && !form.getValues('caption')?.trim()) {
      form.setValue('caption', prefill.caption, { shouldDirty: true });
    }
    if (prefill.stickers && typeof prefill.stickers === 'object') {
      form.setValue(
        'stickers',
        { ...form.getValues('stickers'), ...(prefill.stickers as StoryFormValuesV2['stickers']) },
        { shouldDirty: true },
      );
    }
    if (Array.isArray(prefill.textLayers) && prefill.textLayers.length > 0 && (form.getValues('textLayers')?.length ?? 0) === 0) {
      form.setValue('textLayers', prefill.textLayers as StoryTextLayerV2[], { shouldDirty: true });
    }
  }, [form, prefill, prefillNonce, savedModifiersRef, setActiveSlideIndex]);

  const handleTriggerFileInput = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleFilesSelected = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(e.target.files ?? []);
      e.target.value = '';
      if (files.length === 0) return;

      const currentMedia = form.getValues('media') ?? [];
      const remaining = STORY_MAX_COUNT - currentMedia.length;
      if (remaining <= 0) return;

      const acceptedFiles = files.slice(0, remaining);
      const validItems: { file: File; item: MediaItemV2 }[] = [];

      for (const file of acceptedFiles) {
        const validation = validateMediaFile(file, STORY_LIMITS);
        if (!validation.ok) {
          form.setError('media', {
            type: 'manual',
            message: validation.message ?? 'Fichier non accepté.',
          });
          continue;
        }
        const previewUrl =
          typeof URL !== 'undefined' && typeof URL.createObjectURL === 'function'
            ? URL.createObjectURL(file)
            : '';
        const isVideo = file.type.startsWith('video/');
        const id = `story-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
        const item = createMediaItemV2({
          id,
          name: file.name,
          type: file.type || 'image/jpeg',
          size: file.size,
          previewUrl,
          url: previewUrl,
          durationMs: isVideo ? 15_000 : undefined,
          status: user?.id ? 'uploading' : 'local',
          progress: user?.id ? 10 : 100,
          storageBucket: 'stories-private',
          storagePath: '',
          crop: '9:16',
          modifiers: { ...DEFAULT_PHOTO_MODIFIERS },
        });
        savedModifiersRef.current[item.id] = { ...DEFAULT_PHOTO_MODIFIERS };
        validItems.push({ file, item });
      }

      if (validItems.length === 0) return;

      const nextMedia = [...currentMedia, ...validItems.map((v) => v.item)];
      form.setValue('media', nextMedia, { shouldDirty: true, shouldValidate: true });
      setActiveSlideIndex(currentMedia.length);

      const firstVideo = validItems.find((v) => v.file.type.startsWith('video/'));
      if (firstVideo) {
        form.setValue('trimStartMs', 0, { shouldDirty: true });
        form.setValue('trimEndMs', 15_000, { shouldDirty: true });
      }

      if (!user?.id) return;
      for (const { file, item } of validItems) {
        void uploadMediaV2(file, {
          userId: user.id,
          bucket: 'stories-private',
        })
          .then((uploaded) => {
            const current = form.getValues('media') ?? [];
            const updated = current.map((m) =>
              m.id === item.id
                ? {
                    ...m,
                    previewUrl: m.previewUrl || uploaded.url,
                    url: uploaded.url || m.previewUrl || m.url,
                    storageBucket: uploaded.bucket,
                    storagePath: uploaded.path,
                    status: 'uploaded' as const,
                    progress: 100,
                    modifiers:
                      savedModifiersRef.current[item.id] ?? m.modifiers ?? DEFAULT_PHOTO_MODIFIERS,
                  }
                : m,
            );
            form.setValue('media', updated, { shouldDirty: true, shouldValidate: true });
          })
          .catch(() => {
            const current = form.getValues('media') ?? [];
            const updated = current.map((m) =>
              m.id === item.id ? { ...m, status: 'error' as const } : m,
            );
            form.setValue('media', updated, { shouldDirty: true, shouldValidate: true });
          });
      }
    },
    [form, savedModifiersRef, setActiveSlideIndex, user?.id],
  );

  const handleRemoveMedia = useCallback(
    (index: number) => {
      const current = form.getValues('media') ?? [];
      const removed = current[index];
      if (removed) {
        void deleteMediaObjectsV2(uploadedObjectsOf([removed]));
      }
      const next = current.filter((_, i) => i !== index);
      form.setValue('media', next, { shouldDirty: true, shouldValidate: true });
      if (activeSlideIndex >= next.length) {
        setActiveSlideIndex(Math.max(0, next.length - 1));
      }
      if (next.length === 0) setActiveCategory(null);
    },
    [activeSlideIndex, form, setActiveCategory, setActiveSlideIndex],
  );

  const handleChangeModifier = useCallback(
    <K extends keyof PhotoModifiersV2>(key: K, value: PhotoModifiersV2[K]) => {
      const current = form.getValues('media') ?? [];
      const safeIndex = Math.min(Math.max(0, activeSlideIndex), Math.max(0, current.length - 1));
      const item = current[safeIndex];
      if (!item) return;
      const currentMods =
        savedModifiersRef.current[item.id] ?? item.modifiers ?? DEFAULT_PHOTO_MODIFIERS;
      const nextMods: PhotoModifiersV2 = {
        ...currentMods,
        [key]: value,
      };
      savedModifiersRef.current[item.id] = nextMods;
      const nextMedia = [...current];
      nextMedia[safeIndex] = { ...item, modifiers: nextMods };
      form.setValue('media', nextMedia, { shouldDirty: true, shouldTouch: true });
    },
    [activeSlideIndex, form, savedModifiersRef],
  );

  const handleResetCategory = useCallback(
    (cat: PhotoEditorCategory) => {
      const current = form.getValues('media') ?? [];
      const safeIndex = Math.min(Math.max(0, activeSlideIndex), Math.max(0, current.length - 1));
      const item = current[safeIndex];
      if (!item) return;
      const currentMods = {
        ...(savedModifiersRef.current[item.id] ?? item.modifiers ?? DEFAULT_PHOTO_MODIFIERS),
      };
      const spec = PHOTO_EDITOR_CATEGORIES.find((c) => c.id === cat);
      if (spec) {
        for (const mod of spec.modifiers) {
          (currentMods as Record<string, unknown>)[mod.key] = mod.defaultValue;
        }
      }
      savedModifiersRef.current[item.id] = currentMods;
      const nextMedia = [...current];
      nextMedia[safeIndex] = { ...item, modifiers: currentMods };
      form.setValue('media', nextMedia, { shouldDirty: true, shouldTouch: true });
    },
    [activeSlideIndex, form, savedModifiersRef],
  );

  const handleSelectCategory = useCallback(
    (category: PhotoEditorCategory) => {
      setActiveCategory((prev) => (prev === category ? null : category));
    },
    [setActiveCategory],
  );

  const handleUpdateLayer = useCallback(
    (id: string, patch: Partial<StoryTextLayerV2>) => {
      const layers = form.getValues('textLayers') ?? [];
      form.setValue(
        'textLayers',
        layers.map((layer) => (layer.id === id ? { ...layer, ...patch } : layer)),
        { shouldDirty: true, shouldValidate: true },
      );
    },
    [form],
  );

  const rawMediaList = values.media ?? [];
  const mediaList: MediaItemV2[] = rawMediaList.map((item) =>
    savedModifiersRef.current[item.id]
      ? { ...item, modifiers: savedModifiersRef.current[item.id] }
      : item,
  );
  const hydratedValues: StoryFormValuesV2 = { ...values, media: mediaList };
  const safeSlideIndex = Math.min(Math.max(0, activeSlideIndex), Math.max(0, mediaList.length - 1));
  const activeMedia = mediaList[safeSlideIndex] ?? null;
  const activeModifiers = activeMedia?.modifiers ?? DEFAULT_PHOTO_MODIFIERS;
  const isEditorOpen = Boolean(activeCategory && mediaList.length > 0);
  const durationMs = activeMedia?.durationMs ?? 0;
  const trimStart = values.trimStartMs ?? 0;
  const trimEnd = values.trimEndMs ?? Math.min(durationMs, 60_000);

  return (
    <>
      {api.active ? (
        <SheetPreview compact={false}>
          <StoryHeroPreview
            values={hydratedValues}
            user={user}
            activeSlideIndex={safeSlideIndex}
            activeCategory={activeCategory}
            onSelectCategory={handleSelectCategory}
            onTriggerFileInput={handleTriggerFileInput}
            fileInputRef={fileInputRef}
            onFilesSelected={handleFilesSelected}
            selectedLayerId={selectedLayerId}
            onSelectLayer={setSelectedLayerId}
            onUpdateLayer={handleUpdateLayer}
            onRemoveActiveMedia={() => handleRemoveMedia(safeSlideIndex)}
            collapsed={isEditorOpen ? false : previewCollapsed}
            onExpand={() => setPreviewCollapsed(false)}
          />
          <AnimatePresence initial={false}>
            {isEditorOpen && activeCategory ? (
              <PhotoEditorCard
                key="story-photo-editor"
                category={activeCategory}
                modifiers={activeModifiers}
                onChangeModifier={handleChangeModifier}
                onResetCategory={handleResetCategory}
                onClose={() => setActiveCategory(null)}
              />
            ) : null}
          </AnimatePresence>
        </SheetPreview>
      ) : null}

      {!isEditorOpen && api.step === 0 ? (
        <>
          <PhotoThumbnailStrip
            media={mediaList}
            activeIndex={safeSlideIndex}
            onSelectPhoto={setActiveSlideIndex}
            onRemovePhoto={handleRemoveMedia}
            onReorderPhotos={(nextOrder) => {
              form.setValue('media', nextOrder, { shouldDirty: true, shouldTouch: true });
            }}
            onAddPhotoClick={handleTriggerFileInput}
            maxCount={STORY_MAX_COUNT}
          />
          {mediaError ? (
            <p className="lkdv-cv2-field-error" role="alert">
              {mediaError}
            </p>
          ) : null}
          {activeMedia?.type.startsWith('video/') && durationMs > 0 ? (
            <div className="lkdv-cv2c-trim">
              <span className="lkdv-cv2-field-label">
                Extrait vidéo · {Math.round((trimEnd - trimStart) / 1000)} s
              </span>
              <div className="lkdv-cv2c-row-2">
                <label className="lkdv-cv2c-trim-row">
                  <span className="lkdv-cv2-field-hint">Début</span>
                  <input
                    type="range"
                    min={0}
                    max={Math.max(0, durationMs - 1000)}
                    step={100}
                    value={trimStart}
                    aria-label="Début de l’extrait"
                    onChange={(event) => {
                      const next = Math.min(Number(event.target.value), trimEnd - 1000);
                      form.setValue('trimStartMs', Math.max(0, next), {
                        shouldDirty: true,
                        shouldValidate: true,
                      });
                    }}
                  />
                </label>
                <label className="lkdv-cv2c-trim-row">
                  <span className="lkdv-cv2-field-hint">Fin</span>
                  <input
                    type="range"
                    min={Math.min(durationMs, 1000)}
                    max={durationMs}
                    step={100}
                    value={trimEnd}
                    aria-label="Fin de l’extrait"
                    onChange={(event) => {
                      const next = Math.max(Number(event.target.value), trimStart + 1000);
                      form.setValue(
                        'trimEndMs',
                        Math.min(next, Math.min(durationMs, trimStart + 60_000)),
                        { shouldDirty: true, shouldValidate: true },
                      );
                    }}
                  />
                </label>
              </div>
            </div>
          ) : null}

          <LayerTools selectedId={selectedLayerId} onSelect={setSelectedLayerId} />
          <StickerTools />
        </>
      ) : null}

      {!isEditorOpen && api.step === 1 ? <StoryDiffusionStep inCarnet={inCarnet} /> : null}
    </>
  );
}

export function StoryFormV2({ active, prefill, prefillNonce, onNavChange, stepHosts, inCarnet = false }: CreateFormV2Props) {
  const { user, reportCreated } = useCreateSheet();
  const defaults = useRef(createDefaultsV2('story')).current;
  const [activeSlideIndex, setActiveSlideIndex] = useState(0);
  const [activeCategory, setActiveCategory] = useState<PhotoEditorCategory | null>(null);
  const [previewCollapsed, setPreviewCollapsed] = useScrollCollapsePreview(
    active,
    activeCategory !== null,
  );
  const savedModifiersRef = useRef<Record<string, PhotoModifiersV2>>({});

  return (
    <CreateFormEngineV2<StoryFormValuesV2>
      kind="story"
      schema={storySchemaV2}
      defaultValues={defaults}
      active={active}
      disabled={!user}
      onNavChange={onNavChange}
      stepHosts={stepHosts}
      liveValidation
      onSubmit={async (values) => {
        if (!user) throw new Error('Connecte-toi pour publier une story.');
        const result = await publishStoryV2(values, user.id);
        reportCreated('story', { id: result.id });
      }}
    >
      {(api) => (
        <StoryBody
          api={api}
          user={user}
          prefill={prefill}
          prefillNonce={prefillNonce}
          activeSlideIndex={activeSlideIndex}
          setActiveSlideIndex={setActiveSlideIndex}
          activeCategory={activeCategory}
          setActiveCategory={setActiveCategory}
          previewCollapsed={previewCollapsed}
          setPreviewCollapsed={setPreviewCollapsed}
          savedModifiersRef={savedModifiersRef}
          inCarnet={inCarnet}
        />
      )}
    </CreateFormEngineV2>
  );
}

export default StoryFormV2;
