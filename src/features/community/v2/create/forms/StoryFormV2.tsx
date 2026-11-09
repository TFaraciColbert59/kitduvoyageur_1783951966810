'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Plus,
  Minus,
  Trash2,
  Camera,
  Image as ImageIcon,
  Play,
  Pause,
  CloudSun,
  Loader2,
} from 'lucide-react';
import { useFormContext, useFormState, type UseFormReturn } from 'react-hook-form';
import type { User } from '@supabase/supabase-js';
import { CreateFormEngineV2, type CreateFormEngineApiV2 } from '../engine/CreateFormEngineV2';
import {
  createDefaultsV2,
  storySchemaV2,
  type MediaItemV2,
  type StoryFormValuesV2,
  type StoryTextLayerV2,
} from '../engine/createSchemasV2';
import { useCreateSheet } from '../CreateSheetContext';
import { publishStoryV2 } from '../createRpc';
import { TextAreaFieldV2, TextFieldV2, readError } from '../fields/FieldV2';
import { MediaFieldV2 } from '../fields/MediaFieldV2';
import { PlaceFieldV2 } from '../fields/PlaceFieldV2';
import { STORY_LIMITS } from '../fields/media';
import { StoryStageV2, type StoryTransformV2 } from '../story/StoryStageV2';
import { cameraAvailable, captureStoryPhoto } from '../story/camera';
import { carnetDayCountV2 } from '../carnet/daySync';
import { SheetPreview } from '../../shared/SheetPreview';
import { todayIso } from '../../shared/format';
import { fetchEventDayWeather, storyWeatherSticker } from '../../data/communityDetails';
import { createClient } from '@/lib/supabase/client';
import { useHapticFeedback } from '@/hooks/useHapticFeedback';
import type { CreateFormV2Props } from './types';

const AUDIENCE_OPTIONS = [
  { value: 'public', label: 'Tout le monde', description: 'Visible dans la barre des stories' },
  { value: 'abonnies', label: 'Mes abonnés', description: 'Seules les personnes qui te suivent' },
  { value: 'close_friends', label: 'Amis proches', description: 'Ta liste d’amis proches' },
  { value: 'only_me', label: 'Moi uniquement', description: 'Privée, visible par toi seule' },
] as const;

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

const WEATHER_UNAVAILABLE = 'Météo indisponible pour le moment.';

interface CarnetOption {
  id: string;
  title: string;
  visibility: string | null;
  /** Nombre de jours du carnet (dates, sinon nb_nuits + 1). */
  days: number;
}

function linkLiveLabel(url: string): string {
  if (!url.trim()) return 'Adresse attendue : http ou https.';
  try {
    const parsed = new URL(url);
    if (parsed.protocol === 'http:' || parsed.protocol === 'https:') return 'Lien valide.';
  } catch {
    /* adresse incomplète : la frappe continue */
  }
  return 'Lien invalide (adresse http ou https attendue).';
}

function setMediaList(form: UseFormReturn<StoryFormValuesV2>, media: MediaItemV2[]) {
  form.setValue('media', media, { shouldDirty: true, shouldValidate: true });
}

function StoryAudienceLine({ values }: { values: StoryFormValuesV2 }) {
  const audience =
    AUDIENCE_OPTIONS.find((option) => option.value === values.audience)?.label ?? 'Tout le monde';
  const replies =
    values.replyPolicy === 'everyone'
      ? 'réponses ouvertes'
      : values.replyPolicy === 'followers'
        ? 'réponses des abonnés'
        : 'réponses fermées';
  return (
    <small>
      {audience} · {replies}
    </small>
  );
}

/**
 * Aperçu compact de la Story (maquette `.sprev`, HTML L2908) : vignette 9:16,
 * « Story · 24 h », état d'envoi et audience. Il vit dans l'emplacement fixe
 * de la coque (FID-056) et suit donc toutes les étapes.
 */
function StoryLivePreview({ values }: { values: StoryFormValuesV2 }) {
  const media = values.media?.[0] ?? null;
  const video = media?.type.startsWith('video/') ?? false;
  const status = !media
    ? 'Ajoute un média pour commencer'
    : media.status === 'uploaded'
      ? `${video ? 'Vidéo' : 'Photo'} · envoyé`
      : media.status === 'uploading'
        ? `${video ? 'Vidéo' : 'Photo'} · envoi ${Math.max(0, Math.min(100, media.progress))} %`
        : 'Échec de l’envoi · réessaie';
  return (
    <div className="lkdv-cv2c-story-preview" data-testid="cv2-story-preview">
      <span className="lkdv-cv2c-story-thumb" aria-hidden="true">
        {media?.previewUrl || media?.url ? (
          // eslint-disable-next-line @next/next/no-img-element -- aperçu local ou URL Storage
          <img src={media.previewUrl || media.url} alt="" />
        ) : (
          <ImageIcon size={18} />
        )}
      </span>
      <span className="lkdv-cv2c-story-meta">
        <b>Story · 24 h</b>
        <small>{status}</small>
        <StoryAudienceLine values={values} />
      </span>
    </div>
  );
}

function StoryMediaStep({
  user,
  spawnFiles,
  onGallery,
  onCamera,
  cameraNote,
}: {
  user: User | null;
  spawnFiles: { files: File[]; nonce: number } | null;
  onGallery: () => void;
  onCamera: () => void;
  cameraNote: string | null;
}) {
  const form = useFormContext<StoryFormValuesV2>();
  const values = form.watch();
  const media = values.media?.[0] ?? null;
  const durationMs = media?.durationMs ?? 0;
  const trimStart = values.trimStartMs ?? 0;
  const trimEnd = values.trimEndMs ?? Math.min(durationMs, 60_000);
  return (
    <>
      <MediaFieldV2
        name="media"
        label="Photo ou vidéo"
        required
        userId={user?.id ?? ''}
        limits={STORY_LIMITS}
        max={1}
        bucket="stories-private"
        cropOptions={[
          { value: 'original', label: 'Original' },
          { value: '9:16', label: '9:16' },
        ]}
        showAlt={false}
        hideAdd
        hint="Format vertical 9:16. Tu pourras recadrer et poser tes calques à l’étape suivante. Vidéo : 60 s maximum."
        spawnFiles={spawnFiles}
        onVideoDuration={(durationMs) => {
          const current = form.getValues('media') ?? [];
          if (!current[0]) return;
          setMediaList(form, current.map((item) => ({ ...item, durationMs })));
          if (form.getValues('trimStartMs') == null) {
            form.setValue('trimStartMs', 0, { shouldDirty: true });
          }
          if (form.getValues('trimEndMs') == null) {
            form.setValue('trimEndMs', Math.min(durationMs, 60_000), { shouldDirty: true });
          }
        }}
      />
      {/* Deux pilules de la maquette (`.src-btns`, HTML L2890). */}
      <div className="lkdv-cv2c-src-btns">
        <button type="button" className="lkdv-cv2-pill lkdv-cv2-pill--secondary" onClick={onGallery}>
          <ImageIcon size={15} aria-hidden="true" />
          Galerie
        </button>
        <button type="button" className="lkdv-cv2-pill lkdv-cv2-pill--secondary" onClick={onCamera}>
          <Camera size={15} aria-hidden="true" />
          Caméra
        </button>
      </div>
      <p className="lkdv-cv2-field-hint">
        La caméra directe n’est proposée que dans l’application ; au navigateur, la galerie suffit.
      </p>
      {cameraNote ? (
        <p className="lkdv-cv2-field-hint lkdv-cv2c-notice" role="status">
          {cameraNote}
        </p>
      ) : null}
      {/* FID-050 : les curseurs de rognage sont sur l'étape 1 (maquette `.trim`,
          HTML L2894), pas dans l'Édition. Bornes : 1 s mini, 60 s maxi. */}
      {media?.type.startsWith('video/') && (media.durationMs ?? 0) > 0 ? (
        <div className="lkdv-cv2c-trim">
          <span className="lkdv-cv2-field-label">
            Extraire la vidéo · {Math.round((trimEnd - trimStart) / 1000)} s
          </span>
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
                form.setValue('trimEndMs', Math.min(next, Math.min(durationMs, trimStart + 60_000)), {
                  shouldDirty: true,
                  shouldValidate: true,
                });
              }}
            />
          </label>
        </div>
      ) : null}
    </>
  );
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
  const { haptic } = useHapticFeedback();

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
        <span className="lkdv-cv2c-section-label">Éléments</span>
        <button
          type="button"
          className="lkdv-cv2-chip lkdv-cv2-chip--sm"
          onClick={() => {
            const id = crypto.randomUUID();
            form.setValue(
              'textLayers',
              [
                ...layers,
                { id, text: 'Ton texte', x: 0.5, y: 0.72, scale: 1, rotation: 0, style: 'clair' },
              ],
              { shouldDirty: true, shouldValidate: true },
            );
            onSelect(id);
            haptic('light');
          }}
        >
          <Plus size={12} aria-hidden="true" />
          Ajouter un texte
        </button>
      </div>
      {layersError ? (
        <p className="lkdv-cv2-field-error" role="alert">
          {layersError}
        </p>
      ) : null}
      {layers.length === 0 ? (
        <p className="lkdv-cv2-field-hint">
          Ajoute un texte : il se déplace au doigt, se redimensionne et pivote au pincement.
        </p>
      ) : (
        <ul className="lkdv-cv2c-layer-list">
          {layers.map((layer) => (
            <li
              key={layer.id}
              className="lkdv-cv2c-layer-row"
              data-selected={selectedId === layer.id || undefined}
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
                onClick={() => {
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
          ))}
        </ul>
      )}
      {selected ? (
        <div className="lkdv-cv2c-crop-row">
          <span className="lkdv-cv2-field-label">Style du texte sélectionné</span>
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
        </div>
      ) : null}
    </div>
  );
}

function StickerTools() {
  const form = useFormContext<StoryFormValuesV2>();
  const stickers = form.watch('stickers');
  const [weatherState, setWeatherState] = useState<'idle' | 'loading' | 'unavailable'>('idle');
  const [linkOpen, setLinkOpen] = useState(Boolean(stickers.link));
  const { haptic } = useHapticFeedback();
  const place = stickers.place;

  const setStickers = (patch: Partial<StoryFormValuesV2['stickers']>) => {
    form.setValue('stickers', { ...stickers, ...patch }, { shouldDirty: true, shouldValidate: true });
  };

  const loadWeather = async () => {
    if (place?.lat == null || place?.lng == null) {
      setWeatherState('unavailable');
      return;
    }
    setWeatherState('loading');
    try {
      // FID-069 — la Story dure 24 h : la météo est celle du **jour de
      // publication** (date connue), à partir du lieu choisi. Même format que
      // la maquette (`storyWeatherSticker`, HTML L3328 : « 4° · Éclaircies »).
      // Unités impériales **hors périmètre** : aucune préférence d'unités dans
      // le profil ni dans les données (CO `Kit#15`), donc degrés Celsius seuls.
      const weather = await fetchEventDayWeather({ lat: place.lat, lng: place.lng }, todayIso());
      const label = storyWeatherSticker(weather);
      if (!label) {
        setWeatherState('unavailable');
        return;
      }
      setStickers({ weatherLabel: label });
      setWeatherState('idle');
      haptic('selection');
    } catch {
      setWeatherState('unavailable');
    }
  };

  return (
    <div className="lkdv-cv2c-story-tools">
      <span className="lkdv-cv2c-section-label">Stickers voyage</span>
      <PlaceFieldV2
        name="stickers.place.label"
        label="Lieu"
        latName="stickers.place.lat"
        lngName="stickers.place.lng"
        placeholder="Chamonix…"
        hint="Le lieu choisi peut aussi donner la météo."
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
      <div className="lkdv-cv2c-inline-add">
        <button
          type="button"
          className="lkdv-cv2-chip lkdv-cv2-chip--lg"
          onClick={() => void loadWeather()}
          disabled={weatherState === 'loading' || place?.lat == null || place?.lng == null}
        >
          {weatherState === 'loading' ? (
            <Loader2 size={13} className="lkdv-cv2c-spin" aria-hidden="true" />
          ) : (
            <CloudSun size={13} aria-hidden="true" />
          )}
          {stickers.weatherLabel ? 'Actualiser la météo' : 'Météo du jour'}
        </button>
        {stickers.weatherLabel ? (
          <button
            type="button"
            className="lkdv-cv2-chip lkdv-cv2-chip--lg"
            aria-pressed
            onClick={() => setStickers({ weatherLabel: '' })}
          >
            {stickers.weatherLabel} · retirer
          </button>
        ) : null}
      </div>
      {place?.lat == null || place?.lng == null ? (
        <p className="lkdv-cv2-field-hint lkdv-cv2c-notice" role="status">
          Météo indisponible : choisis d’abord un lieu avec des coordonnées.
        </p>
      ) : weatherState === 'unavailable' ? (
        <p className="lkdv-cv2-field-hint lkdv-cv2c-notice" role="status">
          {WEATHER_UNAVAILABLE}
        </p>
      ) : null}

      <div className="lkdv-cv2c-inline-add">
        <button
          type="button"
          className="lkdv-cv2-chip lkdv-cv2-chip--lg"
          aria-expanded={linkOpen}
          onClick={() => {
            setLinkOpen(true);
            if (!stickers.link) setStickers({ link: { url: '', label: '' } });
          }}
        >
          Ajouter un lien
        </button>
      </div>
      {linkOpen ? (
        <>
          <TextFieldV2
            name="stickers.link.url"
            label="Lien"
            placeholder="https://…"
            inputMode="url"
            hint="Le lien est vérifié en direct (http ou https)."
          />
          {/* FID-050 : validation **à la frappe** (le schéma revalide à
              l'envoi ; ici on informe sans bloquer l'étape). */}
          <p className="lkdv-cv2-field-hint" role="status">
            {linkLiveLabel(stickers.link?.url ?? '')}
          </p>
          <TextFieldV2 name="stickers.link.label" label="Titre du lien" placeholder="Mon carnet" />
          <button
            type="button"
            className="lkdv-cv2-chip lkdv-cv2-chip--sm"
            onClick={() => {
              setLinkOpen(false);
              setStickers({ link: null });
            }}
          >
            Retirer le lien
          </button>
        </>
      ) : null}
    </div>
  );
}

/**
 * « Lier à un carnet » de la Diffusion (maquette L2905, FID-028). Les carnets
 * de l'utilisateur sont lus dans `carnets` ; le nombre de jours vient des
 * dates (`start_date`/`end_date`), à défaut de `nb_nuits + 1`. Le jour choisi
 * est borné 1..60 comme la colonne `linked_carnet_day` (migration lot F L22).
 */
function StoryCarnetLink() {
  const form = useFormContext<StoryFormValuesV2>();
  const stickers = form.watch('stickers');
  const { user } = useCreateSheet();
  const [carnets, setCarnets] = useState<CarnetOption[] | null>(null);
  const [error, setError] = useState<string | null>(null);
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
        if (!cancelled) {
          setCarnets([]);
          setError('Tes carnets sont indisponibles pour le moment.');
        }
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

  const selected = carnets?.find((carnet) => carnet.id === stickers.carnetId) ?? null;

  return (
    <div className="lkdv-cv2-field">
      <span className="lkdv-cv2-field-label" id="cv2c-story-carnet-label">
        Lier à un carnet
      </span>
      <div className="lkdv-cv2-chips" role="radiogroup" aria-labelledby="cv2c-story-carnet-label">
        <button
          type="button"
          role="radio"
          aria-checked={!stickers.carnetId}
          className="lkdv-cv2-chip lkdv-cv2-chip--lg"
          onClick={() => {
            setStickers({ carnetId: '', carnetTitle: '', carnetDay: null });
            haptic('selection');
          }}
        >
          Aucun
        </button>
        {carnets?.map((carnet) => (
          <button
            key={carnet.id}
            type="button"
            role="radio"
            aria-checked={stickers.carnetId === carnet.id}
            className="lkdv-cv2-chip lkdv-cv2-chip--lg"
            onClick={() => {
              setStickers({ carnetId: carnet.id, carnetTitle: carnet.title, carnetDay: 1 });
              haptic('selection');
            }}
          >
            {carnet.title}
          </button>
        ))}
      </div>
      {carnets === null ? (
        <p className="lkdv-cv2-field-hint" role="status">
          Chargement de tes carnets…
        </p>
      ) : null}
      {error ? (
        <p className="lkdv-cv2-field-hint" role="status">
          {error}
        </p>
      ) : null}
      {selected ? (
        <div className="lkdv-cv2-chips" role="radiogroup" aria-label="Jour du carnet">
          {Array.from({ length: selected.days }, (_, index) => index + 1).map((day) => (
            <button
              key={day}
              type="button"
              role="radio"
              aria-checked={(stickers.carnetDay ?? 1) === day}
              className="lkdv-cv2-chip lkdv-cv2-chip--sm"
              onClick={() => {
                setStickers({ carnetDay: day });
                haptic('selection');
              }}
            >
              Jour {day}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function StoryDiffusionStep() {
  const form = useFormContext<StoryFormValuesV2>();
  const values = form.watch();
  return (
    <>
      <span className="lkdv-cv2-field-label" id="cv2c-story-audience">
        Audience
      </span>
      <div className="lkdv-cv2c-audience-list" role="radiogroup" aria-labelledby="cv2c-story-audience">
        {AUDIENCE_OPTIONS.map((option) => (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={values.audience === option.value}
            className="lkdv-cv2c-audience-card"
            data-active={values.audience === option.value}
            onClick={() =>
              form.setValue('audience', option.value, { shouldDirty: true, shouldValidate: true })
            }
          >
            <span className="lkdv-cv2c-radio" aria-hidden="true" />
            <span>
              <b>{option.label}</b>
              <small>{option.description}</small>
            </span>
          </button>
        ))}
      </div>
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
      {/* FID-028 — lien carnet **et choix du jour** dans la Diffusion
          (maquette L2905 : « Lier à un carnet » puis chips « Jour n »). Le
          jour est écrit dans `stickers.carnetDay` → `linked_carnet_day`. */}
      <StoryCarnetLink />
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
      <p className="lkdv-cv2-field-hint">La story expire automatiquement au bout de 24 h.</p>
    </>
  );
}

function StoryBody({
  api,
  user,
}: {
  api: CreateFormEngineApiV2<StoryFormValuesV2>;
  user: User | null;
}) {
  const form = api.form;
  const values = form.watch();
  const media = values.media?.[0] ?? null;
  const [selectedLayerId, setSelectedLayerId] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const [spawnFiles, setSpawnFiles] = useState<{ files: File[]; nonce: number } | null>(null);
  const [cameraNote, setCameraNote] = useState<string | null>(null);
  const [transform, setTransform] = useState<StoryTransformV2>({ scale: 1, x: 0, y: 0 });
  const { haptic } = useHapticFeedback();

  const onChangeLayer = useCallback(
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

  const openGallery = useCallback(() => {
    document.getElementById('cv2c-media')?.click();
  }, []);

  const openCamera = useCallback(async () => {
    setCameraNote(null);
    if (!cameraAvailable()) {
      openGallery();
      return;
    }
    try {
      const capture = await captureStoryPhoto();
      if (!capture) return;
      haptic('light');
      setSpawnFiles({ files: [capture.file], nonce: Date.now() });
    } catch {
      setCameraNote('Caméra indisponible. Choisis une photo dans la galerie.');
    }
  }, [haptic, openGallery]);

  // Zoom de la maquette (`.zoomc`, HTML L1240/L2892) : bornes 1 → 3.
  const zoom = useCallback(
    (delta: number) => {
      setTransform((current) => ({
        ...current,
        scale: Math.max(1, Math.min(3, Number((current.scale + delta).toFixed(2)))),
      }));
      haptic('selection');
    },
    [haptic],
  );

  return (
    <>
      {/* FID-056 : l'aperçu compact vit dans l'emplacement fixe de la coque,
          au-dessus du pager, et reste visible à toutes les étapes. */}
      {api.active ? (
        <SheetPreview>
          <StoryLivePreview values={values} />
        </SheetPreview>
      ) : null}
      {api.step === 0 ? (
        <StoryMediaStep
          user={user}
          spawnFiles={spawnFiles}
          onGallery={openGallery}
          onCamera={() => void openCamera()}
          cameraNote={cameraNote}
        />
      ) : null}

      {api.step === 1 ? (
        <>
          {media ? (
            <>
              {api.active ? (
                <StoryStageV2
                  media={media}
                  textLayers={values.textLayers ?? []}
                  stickers={values.stickers}
                  selectedLayerId={selectedLayerId}
                  onSelectLayer={setSelectedLayerId}
                  onChangeLayer={onChangeLayer}
                  trimStartMs={values.trimStartMs}
                  trimEndMs={values.trimEndMs}
                  playing={playing}
                  onTogglePlaying={() => setPlaying((current) => !current)}
                  transform={transform}
                  onTransformChange={setTransform}
                />
              ) : null}
              <div className="lkdv-cv2c-zoom-row" role="group" aria-label="Cadrage de la story">
                <button
                  type="button"
                  aria-label="Dézoomer"
                  onClick={() => zoom(-0.25)}
                  disabled={transform.scale <= 1}
                >
                  <Minus size={14} aria-hidden="true" />
                </button>
                <button
                  type="button"
                  className="lkdv-cv2c-zoom-value"
                  aria-label={`Recentrer le média (zoom ${transform.scale.toFixed(1)} fois)`}
                  onClick={() => setTransform({ scale: 1, x: 0, y: 0 })}
                >
                  {transform.scale.toFixed(1).replace('.', ',')}×
                </button>
                <button
                  type="button"
                  aria-label="Zoomer"
                  onClick={() => zoom(0.25)}
                  disabled={transform.scale >= 3}
                >
                  <Plus size={14} aria-hidden="true" />
                </button>
                <button type="button" onClick={openGallery}>
                  Remplacer
                </button>
              </div>
            </>
          ) : (
            <p className="lkdv-cv2c-warning">
              Reviens à l’étape Média pour choisir une photo ou une vidéo.
            </p>
          )}

          {/* Légende et texte alternatif remontés dans le flux visible (T7). */}
          <TextAreaFieldV2
            name="caption"
            label="Légende"
            placeholder="Un mot sur ce moment…"
            maxLength={280}
            rows={3}
          />
          <TextFieldV2
            name="altText"
            label="Texte alternatif"
            placeholder="Décris la story pour les personnes malvoyantes"
            maxLength={200}
            hint="Lu par les lecteurs d’écran. Facultatif."
          />
          <LayerTools selectedId={selectedLayerId} onSelect={setSelectedLayerId} />
          <StickerTools />
        </>
      ) : null}

      {api.step === 2 ? (
        <>
          {/* L'aperçu figé n'est monté que sur l'étape affichée : un seul
              visualiseur vivant à la fois (WebGLArbiter, ADR-002). */}
          {media && api.active ? (
            <div className="lkdv-cv2c-final-preview">
              <span className="lkdv-cv2-field-label">Aperçu final exact</span>
              <StoryStageV2
                media={media}
                textLayers={values.textLayers ?? []}
                stickers={values.stickers}
                selectedLayerId={null}
                onSelectLayer={() => undefined}
                onChangeLayer={() => undefined}
                trimStartMs={values.trimStartMs}
                trimEndMs={values.trimEndMs}
                playing={false}
                onTogglePlaying={() => undefined}
                transform={transform}
                onTransformChange={() => undefined}
                previewOnly
              />
            </div>
          ) : null}
          <StoryDiffusionStep />
        </>
      ) : null}

      {media?.type.startsWith('video/') && api.step === 1 ? (
        <button
          type="button"
          className="lkdv-cv2-chip lkdv-cv2-chip--lg"
          onClick={() => setPlaying((current) => !current)}
          aria-pressed={playing}
        >
          {playing ? <Pause size={13} aria-hidden="true" /> : <Play size={13} aria-hidden="true" />}
          {playing ? 'Pause de l’extrait' : 'Lire l’extrait'}
        </button>
      ) : null}
    </>
  );
}

/**
 * Story V2 (`Story#1-20`) : Média → Édition → Diffusion.
 *
 * L'éditeur est plein cadre 9:16 : il **réutilise le visualiseur existant** en
 * mode composition (`StoriesViewer compose`) — aucune seconde implémentation
 * des barres ni du dock. Cadrage au pincement, textes déplaçables (3 styles),
 * stickers lieu/altitude/météo/distance, lien vérifié en direct, carnet lié,
 * rognage vidéo réel (`trim_start_ms`/`trim_end_ms`), caméra Capacitor et
 * audience à 4 valeurs (dont `close_friends`).
 */
export function StoryFormV2({ active, onNavChange, stepHosts }: CreateFormV2Props) {
  const { user, reportCreated } = useCreateSheet();
  const defaults = useRef(createDefaultsV2('story')).current;

  return (
    <CreateFormEngineV2<StoryFormValuesV2>
      kind="story"
      schema={storySchemaV2}
      defaultValues={defaults}
      active={active}
      disabled={!user}
      onNavChange={onNavChange}
      stepHosts={stepHosts}
      onSubmit={async (values) => {
        if (!user) throw new Error('Connecte-toi pour publier une story.');
        const result = await publishStoryV2(values, user.id);
        reportCreated('story', { id: result.id });
      }}
    >
      {(api) => <StoryBody api={api} user={user} />}
    </CreateFormEngineV2>
  );
}

export default StoryFormV2;
