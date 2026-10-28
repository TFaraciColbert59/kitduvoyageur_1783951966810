'use client';

import React, { useState } from 'react';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/client';
import { insertCommunityPost, uploadCoverImage } from './upload';
import { Chips, CountedTextArea, ImagePicker, Stepper, TextField, type ChipOption } from './wizard/fields';
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

const STEPS = ['what', 'when', 'who'] as const;
type Step = (typeof STEPS)[number];
const KICKERS: Record<Step, string> = { what: 'Quoi', when: 'Où & quand', who: 'Qui' };

const DURATIONS: ReadonlyArray<ChipOption<string>> = [
  { id: 'Demi-journée', label: 'Demi-journée' },
  { id: '1 journée', label: '1 journée' },
  { id: 'Week-end', label: 'Week-end' },
  { id: 'Plusieurs jours', label: 'Plusieurs jours' },
];

const INITIAL = {
  title: '',
  description: '',
  location: '',
  date: '',
  duration: '1 journée',
  max: 10,
};

const whatSchema = z.object({ title: z.string().trim().min(1, 'Donne un titre à la sortie.') });
const whenSchema = z.object({
  date: z
    .string()
    .min(1, 'Choisis la date.')
    .refine((value) => value >= todayIso(), 'La date doit être aujourd’hui ou plus tard.'),
});

export function SortieCreateForm({ onClose, user, onCreated }: SortieCreateFormProps) {
  const { values, patch, clear } = useDraftedForm('sortie', user?.id, INITIAL);
  const [cover, setCover] = useState<File | null>(null);

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
      const coverUrl = await uploadCoverImage(cover, user.id);
      const title = values.title.trim();
      const location = values.location.trim();
      const description = values.description.trim();
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
          description,
          cover_image: coverUrl ?? '',
          cover_alt: title,
          shared_kitty: 0,
          kitty_goal: 0,
          status: 'upcoming',
        })
        .select('id')
        .single();
      if (insertError || !data) throw new Error(insertError?.message || 'Création de la sortie refusée.');
      try {
        await insertCommunityPost({
          authorId: user.id,
          content: `**${title}**\n\n📅 ${values.date}${location ? ` · 📍 ${location}` : ''}\n\n${description}\n\n/evenements`,
          postType: 'share',
          imageUrl: coverUrl,
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
    >
      {flow.current === 'what' ? (
        <>
          <TextField label="Titre" value={values.title} onChange={(title) => patch({ title })} maxLength={120} placeholder="Lac Blanc au lever du jour" />
          <CountedTextArea label="Le programme" value={values.description} onChange={(description) => patch({ description })} max={1500} placeholder="Le niveau, le matériel, le point de rendez-vous…" />
        </>
      ) : null}

      {flow.current === 'when' ? (
        <>
          <TextField label="Lieu" value={values.location} onChange={(location) => patch({ location })} placeholder="Chamonix" />
          <TextField label="Date" type="date" min={todayIso()} value={values.date} onChange={(date) => patch({ date })} />
          <Chips label="Durée" options={DURATIONS} value={values.duration} onChange={(duration) => patch({ duration })} />
        </>
      ) : null}

      {flow.current === 'who' ? (
        <>
          <Stepper label="Participants max" value={values.max} min={2} max={50} onChange={(max) => patch({ max })} />
          <ImagePicker label="Photo de la sortie (facultatif)" file={cover} onChange={setCover} aspect="16 / 9" />
        </>
      ) : null}
    </WizardFrame>
  );
}

export default SortieCreateForm;
