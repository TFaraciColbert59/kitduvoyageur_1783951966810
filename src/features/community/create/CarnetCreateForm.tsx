'use client';

import React, { useState } from 'react';
import { z } from 'zod';
import Icon from '@/components/ui/Icon';
import { createClient } from '@/lib/supabase/client';
import { insertCommunityPost, uploadCoverImage } from './upload';
import { Chips, CountedTextArea, ImagePicker, TextField, type ChipOption } from './wizard/fields';
import { firstIssue } from './wizard/validate';
import { useCreateFlow } from './wizard/useCreateFlow';
import { useDraftedForm } from './wizard/useDraftedForm';
import { WizardFrame } from './wizard/WizardFrame';

export interface CarnetCreateFormProps {
  open: boolean;
  onClose: () => void;
  user: any;
  onCreated: (kind: 'carnet', id: string) => void;
}

type Visibility = 'public' | 'private';

const STEPS = ['cover', 'where', 'story'] as const;
type Step = (typeof STEPS)[number];
const KICKERS: Record<Step, string> = { cover: 'Couverture', where: 'Où & quand', story: 'Récit' };

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
};

const titleSchema = z.object({ title: z.string().trim().min(1, 'Donne un titre à ton carnet.') });
const whereSchema = z
  .object({
    destination: z.string().trim().min(1, 'Indique la destination.'),
    startDate: z.string(),
    endDate: z.string(),
  })
  .refine((v) => !v.startDate || !v.endDate || v.endDate >= v.startDate, {
    message: 'La fin doit être après le début.',
    path: ['endDate'],
  });

export function CarnetCreateForm({ onClose, user, onCreated }: CarnetCreateFormProps) {
  const { values, patch, clear } = useDraftedForm('carnet', user?.id, INITIAL);
  const [cover, setCover] = useState<File | null>(null);

  const flow = useCreateFlow<Step>({
    steps: STEPS,
    validate: (step) => {
      if (step === 'cover') return firstIssue(titleSchema, values);
      if (step === 'where') return firstIssue(whereSchema, values);
      return null;
    },
    submit: async () => {
      if (!user?.id) throw new Error('Connecte-toi pour créer un carnet.');
      const supabase = createClient();
      const coverUrl = await uploadCoverImage(cover, user.id);
      const title = values.title.trim();
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
        })
        .select('id')
        .single();
      if (insertError || !data) throw new Error(insertError?.message || 'Création du carnet refusée.');
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
      onCreated('carnet', data.id);
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
      nextLabel={flow.wizard.isLast ? 'Créer le carnet' : 'Suivant'}
      onBack={flow.onBack}
      onNext={flow.onNext}
    >
      {flow.current === 'cover' ? (
        <>
          <ImagePicker label="Couverture" file={cover} onChange={setCover} aspect="16 / 9" />
          <TextField label="Titre" value={values.title} onChange={(title) => patch({ title })} maxLength={120} placeholder="Traversée du Vercors" />
        </>
      ) : null}

      {flow.current === 'where' ? (
        <>
          <TextField label="Destination" value={values.destination} onChange={(destination) => patch({ destination })} maxLength={120} placeholder="Vercors, France" />
          <TextField label="Début" type="date" value={values.startDate} onChange={(startDate) => patch({ startDate })} />
          <TextField label="Fin" type="date" min={values.startDate || undefined} value={values.endDate} onChange={(endDate) => patch({ endDate })} />
        </>
      ) : null}

      {flow.current === 'story' ? (
        <>
          <CountedTextArea label="Le récit en deux mots" value={values.description} onChange={(description) => patch({ description })} max={1000} placeholder="L’idée, les points forts…" />
          <Chips label="Qui peut le lire ?" options={VISIBILITIES} value={values.visibility} onChange={(visibility) => patch({ visibility })} />
        </>
      ) : null}
    </WizardFrame>
  );
}

export default CarnetCreateForm;
