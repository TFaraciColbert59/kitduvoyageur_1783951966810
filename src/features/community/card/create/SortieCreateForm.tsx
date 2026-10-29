'use client';

import React, { useEffect, useState } from 'react';
import { z } from 'zod';
import { CloudSun } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { insertCommunityPost, uploadCoverImage } from './upload';
import { Chips, CountedTextArea, ImagePicker, PlaceField, Stepper, TextField, useObjectUrl, type ChipOption } from './wizard/fields';
import { PreviewCard } from './wizard/PreviewCard';
import { forecastFor, quickDates, shortDay, type DayForecast } from './wizard/assist';
import { firstIssue, todayIso } from './wizard/validate';
import { useCreateFlow } from './wizard/useCreateFlow';
import { useDraftedForm } from './wizard/useDraftedForm';
import { WizardFrame } from './wizard/WizardFrame';

export interface SortieCreateFormProps {
  open: boolean;
  onClose: () => void;
  user: any;
  onCreated: (kind: 'sortie', id: string) => void;
}

const STEPS = ['what', 'when', 'who', 'check'] as const;
type Step = (typeof STEPS)[number];
const KICKERS: Record<Step, string> = { what: 'Quoi', when: 'Où & quand', who: 'Qui', check: 'Aperçu' };

const DURATIONS: ReadonlyArray<ChipOption<string>> = [
  { id: 'Demi-journée', label: 'Demi-journée' },
  { id: '1 journée', label: '1 journée' },
  { id: 'Week-end', label: 'Week-end' },
  { id: 'Plusieurs jours', label: 'Plusieurs jours' },
];

type Level = '' | 'facile' | 'moyen' | 'difficile';
const LEVELS: ReadonlyArray<ChipOption<Level>> = [
  { id: 'facile', label: 'Facile' },
  { id: 'moyen', label: 'Moyen' },
  { id: 'difficile', label: 'Difficile' },
];
const LEVEL_LABEL: Record<Exclude<Level, ''>, string> = { facile: 'Facile', moyen: 'Moyen', difficile: 'Difficile' };

/** La prévision MET Norway couvre environ neuf jours : au-delà, rien n'est affiché. */
const FORECAST_DAYS = 9;

const INITIAL = {
  title: '',
  description: '',
  level: '' as Level,
  location: '',
  lat: null as number | null,
  lon: null as number | null,
  date: '',
  time: '',
  duration: '1 journée',
  max: 10,
};

const whatSchema = z.object({ title: z.string().trim().min(1, 'Donne un titre à la sortie.') });
const whenSchema = z.object({
  location: z.string().trim().min(1, 'Indique le lieu de rendez-vous.'),
  date: z
    .string()
    .min(1, 'Choisis la date.')
    .refine((value) => value >= todayIso(), 'La date doit être aujourd’hui ou plus tard.'),
});

/** « 08:30 » → « 8 h 30 ». */
function readableTime(value: string): string {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value);
  if (!match) return '';
  return `${Number(match[1])} h ${match[2]}`;
}

function daysUntil(date: string): number {
  const target = new Date(`${date}T12:00:00`).getTime();
  const today = new Date(`${todayIso()}T12:00:00`).getTime();
  return Math.round((target - today) / 86_400_000);
}

export function SortieCreateForm({ onClose, user, onCreated }: SortieCreateFormProps) {
  const { values, patch, clear, restored } = useDraftedForm('sortie', user?.id, INITIAL);
  const [cover, setCover] = useState<File | null>(null);
  const [forecast, setForecast] = useState<DayForecast | null>(null);
  const coverUrl = useObjectUrl(cover);
  const dates = quickDates();

  // Météo prévue au lieu et à la date choisis (MET Norway, via le serveur).
  const { lat, lon, date } = values;
  useEffect(() => {
    setForecast(null);
    if (lat == null || lon == null || !date) return;
    const ahead = daysUntil(date);
    if (ahead < 0 || ahead > FORECAST_DAYS) return;
    const controller = new AbortController();
    void (async () => {
      try {
        const response = await fetch(`/api/weather/point?lat=${lat.toFixed(2)}&lon=${lon.toFixed(2)}`, { signal: controller.signal });
        if (!response.ok) return;
        const payload = await response.json();
        setForecast(forecastFor(payload?.daily, date));
      } catch {
        /* sans météo, le formulaire reste complet */
      }
    })();
    return () => controller.abort();
  }, [lat, lon, date]);

  const fullDescription = [
    values.description.trim(),
    values.level ? `Niveau : ${LEVEL_LABEL[values.level]}` : '',
    values.time ? `Rendez-vous à ${readableTime(values.time)}` : '',
  ]
    .filter(Boolean)
    .join('\n');

  const flow = useCreateFlow<Step>({
    steps: STEPS,
    validate: (step) => {
      if (step === 'what') return firstIssue(whatSchema, values);
      if (step === 'when') return firstIssue(whenSchema, values);
      return null;
    },
    submit: async () => {
      if (!user?.id) throw new Error('Connecte-toi pour créer une sortie.');
      const supabase = createClient();
      const uploaded = await uploadCoverImage(cover, user.id);
      const title = values.title.trim();
      const location = values.location.trim();
      const { data, error: insertError } = await supabase
        .from('events')
        .insert({
          title,
          type: 'rando',
          emoji: '🥾',
          organizer_id: user.id,
          event_date: values.date,
          duration: values.duration,
          location,
          country: 'France',
          max_participants: values.max,
          current_participants: 0,
          description: fullDescription,
          cover_image: uploaded ?? '',
          cover_alt: title,
          shared_kitty: 0,
          kitty_goal: 0,
          status: 'upcoming',
        })
        .select('id')
        .single();
      if (insertError || !data) throw new Error(insertError?.message || 'Création de la sortie refusée.');
      try {
        const when = [values.date, values.time && readableTime(values.time)].filter(Boolean).join(' à ');
        await insertCommunityPost({
          authorId: user.id,
          content: `**${title}**\n\n📅 ${when}${location ? ` · 📍 ${location}` : ''}\n\n${fullDescription}\n\n/evenements`,
          postType: 'share',
          imageUrl: uploaded,
          title,
        });
      } catch {
        /* la sortie existe ; la publication d'annonce est facultative */
      }
      clear();
      setCover(null);
      onCreated('sortie', data.id);
      onClose();
    },
  });

  return (
    <WizardFrame
      step={flow.wizard.step}
      total={flow.wizard.total}
      kicker={KICKERS[flow.current]}
      error={flow.error}
      busy={flow.busy}
      nextLabel={flow.wizard.isLast ? 'Proposer la sortie' : 'Suivant'}
      onBack={flow.onBack}
      onNext={flow.onNext}
      draft={{ restored, onDiscard: () => { clear(); setCover(null); flow.setError(null); } }}
    >
      {flow.current === 'what' ? (
        <>
          <TextField label="Titre" value={values.title} onChange={(title) => patch({ title })} maxLength={120} placeholder="Lac Blanc au lever du jour" />
          <Chips label="Niveau" options={LEVELS} value={values.level} onChange={(level) => patch({ level: values.level === level ? '' : level })} />
          <CountedTextArea label="Le programme" value={values.description} onChange={(description) => patch({ description })} max={1500} placeholder="L’itinéraire, le matériel, l’ambiance…" />
        </>
      ) : null}

      {flow.current === 'when' ? (
        <>
          <PlaceField
            label="Lieu de rendez-vous"
            value={values.location}
            onChange={(location) => patch({ location, lat: null, lon: null })}
            onPick={(place) => patch({ location: place.label, lat: place.lat, lon: place.lon })}
            placeholder="Parking de la Flégère, Chamonix"
          />
          <Chips label="Quand ?" options={dates} value={values.date} onChange={(date) => patch({ date })} />
          <div className="lkdv-wz-row">
            <TextField label="Date" type="date" min={todayIso()} value={values.date} onChange={(date) => patch({ date })} />
            <TextField label="Heure" type="time" value={values.time} onChange={(time) => patch({ time })} />
          </div>
          {forecast ? (
            <p className="lkdv-wz-note" data-tone={forecast.rain !== null && forecast.rain >= 60 ? 'warn' : 'ok'} role="status">
              <CloudSun size={18} aria-hidden="true" />
              <span>
                {shortDay(values.date)} : {forecast.label}
                {forecast.min !== null && forecast.max !== null ? `, ${forecast.min}° / ${forecast.max}°` : ''}
                {forecast.rain !== null ? `, pluie ${forecast.rain} %` : ''}
              </span>
            </p>
          ) : values.lat != null && values.date && daysUntil(values.date) > FORECAST_DAYS ? (
            <p className="lkdv-wz-hint">La météo sera visible à 9 jours de la sortie.</p>
          ) : null}
        </>
      ) : null}

      {flow.current === 'who' ? (
        <>
          <Chips label="Durée" options={DURATIONS} value={values.duration} onChange={(duration) => patch({ duration })} />
          <Stepper label="Participants max" value={values.max} min={2} max={50} onChange={(max) => patch({ max })} />
          <ImagePicker label="Photo de la sortie (facultatif)" file={cover} onChange={setCover} aspect="16 / 9" />
        </>
      ) : null}

      {flow.current === 'check' ? (
        <>
          <PreviewCard
            kicker="Sortie"
            title={values.title}
            meta={[
              [shortDay(values.date), values.time && readableTime(values.time)].filter(Boolean).join(' à '),
              values.location && `📍 ${values.location}`,
              values.level && LEVEL_LABEL[values.level],
              values.duration,
              `${values.max} places`,
            ]}
            text={values.description}
            image={coverUrl}
          />
          {forecast ? (
            <p className="lkdv-wz-note" data-tone={forecast.rain !== null && forecast.rain >= 60 ? 'warn' : 'ok'}>
              <CloudSun size={18} aria-hidden="true" />
              <span>
                Météo prévue : {forecast.label}
                {forecast.min !== null && forecast.max !== null ? `, ${forecast.min}° / ${forecast.max}°` : ''}
              </span>
            </p>
          ) : null}
          <p className="lkdv-wz-hint">Une annonce est publiée dans le fil ; les inscriptions se font sur la page de la sortie.</p>
        </>
      ) : null}
    </WizardFrame>
  );
}

export default SortieCreateForm;
