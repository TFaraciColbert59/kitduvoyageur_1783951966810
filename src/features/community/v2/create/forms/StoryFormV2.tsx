'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Plus, Trash2, Camera, Play, Pause, CloudSun, MapPin, Loader2 } from 'lucide-react';
import { useFormContext, type UseFormReturn } from 'react-hook-form';
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
import { TextAreaFieldV2, TextFieldV2 } from '../fields/FieldV2';
import { MediaFieldV2 } from '../fields/MediaFieldV2';
import { PlaceFieldV2 } from '../fields/PlaceFieldV2';
import { STORY_LIMITS } from '../fields/media';
import { StoryStageV2 } from '../story/StoryStageV2';
import { cameraAvailable, captureStoryPhoto } from '../story/camera';
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

const WEATHER_LABELS: Record<string, string> = {
  clearsky: 'ciel clair',
  fair: 'ciel dégagé',
  partlycloudy: 'éclaircies',
  cloudy: 'nuageux',
  fog: 'brouillard',
  lightrain: 'pluie faible',
  rain: 'pluie',
  heavyrain: 'forte pluie',
  lightsnow: 'neige faible',
  snow: 'neige',
  rainandthunder: 'orage',
};

interface CarnetOption {
  id: string;
  title: string;
  visibility: string | null;
}

function weatherLabelFor(symbol: string | null, temperature: number | null): string {
  const key = (symbol ?? '').replace(/_(day|night|polartwilight)$/, '');
  const label = WEATHER_LABELS[key] ?? 'météo';
  return temperature != null ? `${Math.round(temperature)}° · ${label}` : label;
}

function setMediaList(form: UseFormReturn<StoryFormValuesV2>, media: MediaItemV2[]) {
  form.setValue('media', media, { shouldDirty: true, shouldValidate: true });
}

function StoryMediaStep({
  user,
  spawnFiles,
}: {
  user: User | null;
  spawnFiles: { files: File[]; nonce: number } | null;
}) {
  const form = useFormContext<StoryFormValuesV2>();
  const media = form.watch('media') ?? [];
  return (
    <>
      <MediaFieldV2
        name="media"
        label="Photo ou vidéo"
        userId={user?.id ?? ''}
        limits={STORY_LIMITS}
        max={1}
        bucket="stories-private"
        cropOptions={[
          { value: 'original', label: 'Original' },
          { value: '9:16', label: '9:16' },
        ]}
        showAlt={false}
        hint="Un seul média, format vertical 9:16 (recadrage à l’étape suivante). Vidéo : 60 s maximum."
        addLabel="Choisir dans la galerie"
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
      {media[0]?.status === 'uploaded' ? (
        <p className="lkdv-cv2-field-hint">
          Média prêt : passe à l’édition pour recadrer et poser tes calques.
        </p>
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
        <span className="lkdv-cv2c-section-label">Texte posé</span>
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

function StickerTools({ user }: { user: User | null }) {
  const form = useFormContext<StoryFormValuesV2>();
  const stickers = form.watch('stickers');
  const media = form.watch('media') ?? [];
  const [weatherState, setWeatherState] = useState<'idle' | 'loading' | 'error'>('idle');
  const [carnets, setCarnets] = useState<CarnetOption[] | null>(null);
  const [carnetOpen, setCarnetOpen] = useState(false);
  const [linkOpen, setLinkOpen] = useState(Boolean(stickers.link));
  const { haptic } = useHapticFeedback();
  const place = stickers.place;

  const setStickers = (patch: Partial<StoryFormValuesV2['stickers']>) => {
    form.setValue('stickers', { ...stickers, ...patch }, { shouldDirty: true, shouldValidate: true });
  };

  const loadWeather = async () => {
    if (place?.lat == null || place?.lng == null) {
      setWeatherState('error');
      return;
    }
    setWeatherState('loading');
    try {
      const response = await fetch(`/api/explorer/v2/weather?lat=${place.lat}&lng=${place.lng}`);
      if (!response.ok) throw new Error('weather');
      const payload = (await response.json()) as {
        hours?: Array<{ temperature_c?: number | null; symbol?: string | null }>;
      };
      const first = payload.hours?.[0];
      if (!first) throw new Error('weather');
      setStickers({ weatherLabel: weatherLabelFor(first.symbol ?? null, first.temperature_c ?? null) });
      setWeatherState('idle');
      haptic('selection');
    } catch {
      setWeatherState('error');
    }
  };

  const loadCarnets = async () => {
    if (!user) return;
    setCarnetOpen(true);
    if (carnets) return;
    try {
      const supabase = createClient();
      const { data } = await supabase
        .from('carnets')
        .select('id, title, visibility')
        .eq('author_id', user.id)
        .order('created_at', { ascending: false })
        .limit(10);
      setCarnets(Array.isArray(data) ? (data as CarnetOption[]) : []);
    } catch {
      setCarnets([]);
    }
  };

  const video = media[0];
  const durationMs = video?.durationMs ?? 0;
  const trimStart = form.watch('trimStartMs') ?? 0;
  const trimEnd = form.watch('trimEndMs') ?? Math.min(durationMs, 60_000);

  useEffect(() => {
    if (!video?.type.startsWith('video/') || durationMs <= 0) return;
    if (form.getValues('trimStartMs') == null) form.setValue('trimStartMs', 0);
    if (form.getValues('trimEndMs') == null) {
      form.setValue('trimEndMs', Math.min(durationMs, 60_000));
    }
  }, [durationMs, form, video?.type]);

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
          disabled={weatherState === 'loading'}
        >
          {weatherState === 'loading' ? (
            <Loader2 size={13} className="lkdv-cv2c-spin" aria-hidden="true" />
          ) : (
            <CloudSun size={13} aria-hidden="true" />
          )}
          {stickers.weatherLabel ? 'Actualiser la météo' : 'Météo du lieu'}
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
      {weatherState === 'error' ? (
        <p className="lkdv-cv2-field-hint lkdv-cv2c-notice" role="status">
          {place?.lat == null
            ? 'Choisis d’abord un lieu avec des coordonnées.'
            : 'Météo indisponible pour le moment.'}
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
        <button type="button" className="lkdv-cv2-chip lkdv-cv2-chip--lg" onClick={() => void loadCarnets()}>
          <MapPin size={13} aria-hidden="true" />
          Lier à un carnet
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
      {carnetOpen ? (
        <div className="lkdv-cv2c-story-tools">
          {carnets === null ? (
            <p className="lkdv-cv2-field-hint">Chargement de tes carnets…</p>
          ) : carnets.length === 0 ? (
            <p className="lkdv-cv2-field-hint">Aucun carnet à lier pour l’instant.</p>
          ) : (
            <ul className="lkdv-cv2c-product-list">
              {carnets.map((carnet) => (
                <li key={carnet.id}>
                  <button
                    type="button"
                    className="lkdv-cv2c-product-row"
                    onClick={() => {
                      setStickers({ carnetId: carnet.id, carnetTitle: carnet.title });
                      setCarnetOpen(false);
                      haptic('selection');
                    }}
                  >
                    <b>{carnet.title}</b>
                  </button>
                </li>
              ))}
            </ul>
          )}
          {stickers.carnetId ? (
            <button
              type="button"
              className="lkdv-cv2-chip lkdv-cv2-chip--sm"
              onClick={() => setStickers({ carnetId: '', carnetTitle: '' })}
            >
              Retirer le carnet lié ({stickers.carnetTitle || 'carnet'})
            </button>
          ) : null}
        </div>
      ) : null}

      {video?.type.startsWith('video/') && durationMs > 0 ? (
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

  const uploadState = !media
    ? null
    : media.status === 'uploaded'
      ? 'Prêt'
      : media.status === 'uploading'
        ? `Envoi ${media.progress} %`
        : 'Échec de l’envoi';

  return (
    <>
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
        onGallery={openGallery}
        onCamera={api.step === 0 ? () => void openCamera() : undefined}
      />
      <p className="lkdv-cv2c-preview-caption">
        {media ? `Aperçu vivant · ${uploadState ?? ''}` : 'Aucun média sélectionné'}
      </p>
      {cameraNote ? (
        <p className="lkdv-cv2-field-hint lkdv-cv2c-notice" role="status">
          {cameraNote}
        </p>
      ) : null}

      {api.step === 0 ? (
        <>
          <StoryMediaStep user={user} spawnFiles={spawnFiles} />
          <p className="lkdv-cv2-field-hint">
            <Camera size={12} aria-hidden="true" /> La caméra directe n’est proposée que dans
            l’application ; au navigateur, la galerie suffit.
          </p>
        </>
      ) : null}
      {api.step === 1 ? (
        <>
          <LayerTools selectedId={selectedLayerId} onSelect={setSelectedLayerId} />
          <StickerTools user={user} />
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
            hint="Recommandé : le texte de la story ne remplace pas une description."
          />
        </>
      ) : null}
      {api.step === 2 ? <StoryDiffusionStep /> : null}

      {media?.type.startsWith('video/') ? (
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
export function StoryFormV2({ active, onNavChange }: CreateFormV2Props) {
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
