'use client';

import React, { useCallback, useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import { z } from 'zod';
import Icon from '@/components/ui/Icon';
import { createClient } from '@/lib/supabase/client';
import { dateOfDay, dayCountFromDates, MAX_DAYS, totalDistanceKm, type DayTrace } from '@/features/carnet/trace/days';
import { insertCommunityPost, uploadCoverImage } from './upload';
import { CarnetDaySelector } from './carnet/CarnetDaySelector';
import { Chips, CountedTextArea, ImagePicker, TextField, type ChipOption } from './wizard/fields';
import { firstIssue } from './wizard/validate';
import { useCreateFlow } from './wizard/useCreateFlow';
import { useDraftedForm } from './wizard/useDraftedForm';
import { WizardFrame } from './wizard/WizardFrame';

// Leaflet n'est chargé que sur l'étape « Carte » : pas de carte dans le bundle du fil.
const CarnetTraceEditor = dynamic(() => import('./carnet/CarnetTraceEditor'), {
  ssr: false,
  loading: () => <div className="lkdv-tr" aria-busy="true" />,
});

export interface CarnetCreateFormProps {
  open: boolean;
  onClose: () => void;
  user: any;
  onCreated: (kind: 'carnet', id: string) => void;
}

type Visibility = 'public' | 'private';

interface DayEntry {
  /** Petit commentaire du jour (une phrase). */
  comment: string;
  /** Ce qu'on a fait. */
  recit: string;
  /** Où on a dormi / fini la journée. */
  place: string;
}

const EMPTY_DAY: DayEntry = { comment: '', recit: '', place: '' };

const VISIBILITIES: ReadonlyArray<ChipOption<Visibility>> = [
  { id: 'public', label: 'Public', icon: <Icon name="globe" size={16} aria-hidden="true" /> },
  { id: 'private', label: 'Privé', icon: <Icon name="lock" size={16} aria-hidden="true" /> },
];

const INITIAL = {
  title: '',
  destination: '',
  startDate: '',
  endDate: '',
  description: '',
  visibility: 'public' as Visibility,
  /** Jours ajoutés (+) ou retirés (−) par rapport au nombre de jours des dates. */
  extraDays: 0,
  days: [] as DayEntry[],
};

const generalSchema = z
  .object({
    title: z.string().trim().min(1, 'Donne un titre à ton carnet.'),
    destination: z.string().trim().min(1, 'Indique la destination.'),
    startDate: z.string(),
    endDate: z.string(),
  })
  .refine((v) => !v.startDate || !v.endDate || v.endDate >= v.startDate, {
    message: 'La fin doit être après le début.',
    path: ['endDate'],
  });

const daySchema = z.object({
  comment: z.string().max(140, 'Le commentaire fait 140 caractères au plus.'),
  recit: z.string().max(600, 'Le récit fait 600 caractères au plus.'),
  place: z.string().max(120),
});

const shortDate = (iso: string | null) =>
  iso ? new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short', timeZone: 'UTC' }).format(new Date(`${iso}T00:00:00Z`)) : null;

export function CarnetCreateForm({ onClose, user, onCreated }: CarnetCreateFormProps) {
  const { values, patch, clear } = useDraftedForm('carnet', user?.id, INITIAL);
  const [cover, setCover] = useState<File | null>(null);
  const [dayImages, setDayImages] = useState<Record<number, File | null>>({});
  const [traces, setTraces] = useState<DayTrace[]>([]);
  const [mapDay, setMapDay] = useState(1);

  const baseDays = dayCountFromDates(values.startDate, values.endDate);
  const dayCount = Math.max(1, Math.min(MAX_DAYS, baseDays + values.extraDays));
  const steps = useMemo(
    () => ['general', ...Array.from({ length: dayCount }, (_, i) => `day-${i + 1}`), 'map'],
    [dayCount],
  );

  const entryOf = (day: number): DayEntry => ({ ...EMPTY_DAY, ...(values.days[day - 1] ?? {}) });
  const setEntry = (day: number, change: Partial<DayEntry>) => {
    const next = Array.from({ length: Math.max(values.days.length, day) }, (_, i) => ({ ...EMPTY_DAY, ...(values.days[i] ?? {}) }));
    next[day - 1] = { ...(next[day - 1] as DayEntry), ...change };
    patch({ days: next });
  };

  const onTraceChange = useCallback((day: number, trace: DayTrace | null) => {
    setTraces((current) => {
      const others = current.filter((entry) => entry.day !== day);
      return trace ? [...others, trace].sort((a, b) => a.day - b.day) : others;
    });
  }, []);

  const flow = useCreateFlow<string>({
    steps,
    validate: (step) => {
      if (step === 'general') return firstIssue(generalSchema, values);
      if (step.startsWith('day-')) return firstIssue(daySchema, entryOf(Number(step.slice(4))));
      return null;
    },
    submit: async () => {
      if (!user?.id) throw new Error('Connecte-toi pour créer un carnet.');
      const supabase = createClient();
      const title = values.title.trim();
      const authorName = user.user_metadata?.full_name || 'Voyageur';

      const [coverUrl, ...dayUrls] = await Promise.all([
        uploadCoverImage(cover, user.id),
        ...Array.from({ length: dayCount }, (_, i) => uploadCoverImage(dayImages[i + 1] ?? null, user.id)),
      ]);

      const lastPlace = entryOf(dayCount).place.trim();
      const { data, error: insertError } = await supabase
        .from('carnets')
        .insert({
          title,
          destination: values.destination.trim(),
          description: values.description.trim(),
          cover_image: coverUrl ?? '',
          start_date: values.startDate || null,
          end_date: values.endDate || null,
          visibility: values.visibility,
          author_id: user.id,
          distance_km: totalDistanceKm(traces),
          nb_nuits: Math.max(0, dayCount - 1),
          lieu_depart: entryOf(1).place.trim() || values.destination.trim(),
          lieu_arrivee: lastPlace || values.destination.trim(),
        })
        .select('id')
        .single();
      if (insertError || !data) throw new Error(insertError?.message || 'Création du carnet refusée.');

      // Chaque jour : son petit commentaire (avec la photo) puis ce qu'on a fait.
      const moments = Array.from({ length: dayCount }, (_, i) => i + 1).flatMap((day) => {
        const entry = entryOf(day);
        const rows: Array<Record<string, unknown>> = [];
        const base = { carnet_id: data.id, jour_numero: day, auteur_nom: authorName, auteur_id: user.id, lieu: entry.place.trim() || null };
        const image = dayUrls[day - 1] ?? null;
        if (entry.comment.trim() || image) rows.push({ ...base, citation: entry.comment.trim() || `Jour ${day}`, image_url: image });
        if (entry.recit.trim()) rows.push({ ...base, citation: entry.recit.trim(), image_url: null });
        return rows;
      });
      if (moments.length > 0) {
        const { error: momentsError } = await supabase.from('carnet_moments').insert(moments);
        if (momentsError) console.warn('[carnet] moments non enregistrés :', momentsError.message);
      }

      // Tracés par jour : table ajoutée par la migration 20261028150000 ; absente, le carnet reste créé.
      const drawn = traces.filter((trace) => trace.coords.length >= 2);
      if (drawn.length > 0) {
        const { error: traceError } = await supabase.from('carnet_day_traces').insert(
          drawn.map((trace) => ({
            carnet_id: data.id,
            jour_numero: trace.day,
            coords: trace.coords,
            waypoints: trace.waypoints,
            snapped: trace.snapped,
            distance_km: trace.distanceKm,
            end_label: trace.endLabel ?? null,
          })),
        );
        if (traceError) console.warn('[carnet] tracés non enregistrés :', traceError.message);
      }

      try {
        await insertCommunityPost({
          authorId: user.id,
          content: `**${title}**\n\n${values.description.trim() || values.destination.trim()}`,
          postType: 'share',
          imageUrl: coverUrl,
          audience: values.visibility === 'public' ? 'public' : 'abonnies',
          linkedCarnetId: data.id,
          title,
        });
      } catch {
        /* le carnet existe ; la publication d'annonce est facultative */
      }

      clear();
      setCover(null);
      setDayImages({});
      setTraces([]);
      onCreated('carnet', data.id);
      onClose();
    },
  });

  const { current } = flow;
  const isDay = current.startsWith('day-');
  const day = isDay ? Number(current.slice(4)) : 0;
  const dayDate = shortDate(dateOfDay(values.startDate, day));
  const kicker = current === 'general' ? 'Général' : isDay ? `Jour ${day}${dayDate ? ` · ${dayDate}` : ''}` : 'Carte';

  return (
    <WizardFrame
      step={flow.wizard.step}
      total={flow.wizard.total}
      kicker={kicker}
      error={flow.error}
      busy={flow.busy}
      nextLabel={flow.wizard.isLast ? 'Créer le carnet' : 'Suivant'}
      onBack={flow.onBack}
      onNext={flow.onNext}
    >
      {current === 'general' ? (
        <>
          <div className="lkdv-wz-row">
            <ImagePicker label="Couverture" file={cover} onChange={setCover} compact />
            <TextField label="Titre" value={values.title} onChange={(title) => patch({ title })} maxLength={120} placeholder="Traversée du Vercors" />
          </div>
          <TextField label="Destination" value={values.destination} onChange={(destination) => patch({ destination })} maxLength={120} placeholder="Vercors, France" />
          <div className="lkdv-wz-field--two">
            <TextField label="Début" type="date" value={values.startDate} onChange={(startDate) => patch({ startDate })} />
            <TextField label="Fin" type="date" min={values.startDate || undefined} value={values.endDate} onChange={(endDate) => patch({ endDate })} />
          </div>
          <Chips label="Qui peut le lire ?" options={VISIBILITIES} value={values.visibility} onChange={(visibility) => patch({ visibility })} />
        </>
      ) : null}

      {isDay ? (
        <>
          <div className="lkdv-wz-row">
            <ImagePicker
              label="Photo"
              file={dayImages[day] ?? null}
              onChange={(file) => setDayImages((current) => ({ ...current, [day]: file }))}
              compact
            />
            <TextField label="Petit commentaire" value={entryOf(day).comment} onChange={(comment) => setEntry(day, { comment })} maxLength={140} placeholder="Grand soleil sur le col" />
          </div>
          <CountedTextArea label="Ce qu’on a fait" value={entryOf(day).recit} onChange={(recit) => setEntry(day, { recit })} max={600} placeholder="Départ, passages, rencontres, bivouac…" />
          <TextField label="Étape du soir" value={entryOf(day).place} onChange={(place) => setEntry(day, { place })} maxLength={120} placeholder="Refuge, village, bivouac…" />
          {day === dayCount ? (
            <div className="lkdv-wz-actions">
              <button type="button" className="lkdv-wz-link" disabled={dayCount >= MAX_DAYS} onClick={() => patch({ extraDays: values.extraDays + 1 })}>
                + Un jour de plus
              </button>
              {dayCount > 1 ? (
                <button type="button" className="lkdv-wz-link" onClick={() => patch({ extraDays: values.extraDays - 1 })}>
                  Retirer ce jour
                </button>
              ) : null}
            </div>
          ) : null}
        </>
      ) : null}

      {current === 'map' ? (
        <div className="lkdv-tr-host">
          <CarnetTraceEditor days={traces} activeDay={Math.min(mapDay, dayCount)} onChange={onTraceChange} />
          <CarnetDaySelector total={dayCount} active={Math.min(mapDay, dayCount)} onChange={setMapDay} />
        </div>
      ) : null}
    </WizardFrame>
  );
}

export default CarnetCreateForm;
