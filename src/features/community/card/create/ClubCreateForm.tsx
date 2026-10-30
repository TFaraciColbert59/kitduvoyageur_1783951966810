'use client';

import React, { useEffect, useState } from 'react';
import { z } from 'zod';
import Icon from '@/components/ui/Icon';
import { createClient } from '@/lib/supabase/client';
import { insertCommunityPost, uploadCoverImage } from './upload';
import { Chips, CountedTextArea, ImagePicker, PlaceField, QuickChips, TextField, useObjectUrl, type ChipOption } from './wizard/fields';
import { PreviewCard } from './wizard/PreviewCard';
import { CLUB_SPIRIT_TEMPLATES, appendSentence } from './wizard/assist';
import { firstIssue } from './wizard/validate';
import { moderateText, validateActivity } from './moderation';
import { useCreateFlow } from './wizard/useCreateFlow';
import { useDraftedForm } from './wizard/useDraftedForm';
import { WizardFrame } from './wizard/WizardFrame';

export interface ClubCreateFormProps {
  open: boolean;
  onClose: () => void;
  user: any;
  onCreated: (kind: 'club', id: string) => void;
}

const STEPS = ['identity', 'spirit', 'access'] as const;
type Step = (typeof STEPS)[number];
const KICKERS: Record<Step, string> = { identity: 'Identité', spirit: 'Esprit', access: 'Accès' };

type Privacy = 'open' | 'closed';

const CATEGORIES: ReadonlyArray<ChipOption<string>> = [
  'Randonnée',
  'Trail',
  'Ski',
  'Escalade',
  'Vélo',
  'Bivouac',
].map((label) => ({
  id: label,
  label,
}));

const PRIVACIES: ReadonlyArray<ChipOption<Privacy>> = [
  { id: 'open', label: 'Ouvert', icon: <Icon name="globe" size={16} aria-hidden="true" /> },
  {
    id: 'closed',
    label: 'Sur validation',
    icon: <Icon name="lock" size={16} aria-hidden="true" />,
  },
];

const INITIAL = {
  name: '',
  category: '',
  location: '',
  description: '',
  privacy: 'open' as Privacy,
};

const nameSchema = z.object({ name: z.string().trim().min(1, 'Donne un nom à ton club.') });

function slugify(value: string) {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

export function ClubCreateForm({ onClose, user, onCreated }: ClubCreateFormProps) {
  const { values, patch, clear, restored } = useDraftedForm('club', user?.id, INITIAL);
  const [badge, setBadge] = useState<File | null>(null);
  const badgeUrl = useObjectUrl(badge);
  // Nom déjà pris ? Vérifié pendant la saisie (lecture seule, non bloquant).
  const [nameTaken, setNameTaken] = useState<boolean | null>(null);
  const trimmedName = values.name.trim();
  useEffect(() => {
    setNameTaken(null);
    if (trimmedName.length < 3) return;
    let cancelled = false;
    const timer = window.setTimeout(async () => {
      try {
        const escaped = trimmedName.replace(/[\\%_]/g, (char) => `\\${char}`);
        const { data } = await createClient().from('clubs').select('id').ilike('name', escaped).limit(1);
        if (!cancelled) setNameTaken(Array.isArray(data) && data.length > 0);
      } catch {
        /* vérification facultative */
      }
    }, 500);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [trimmedName]);
  const nameProblem = trimmedName ? moderateText(trimmedName) : null;
  const activityProblem = values.category.trim() ? validateActivity(values.category) : null;
  const spiritOptions = CLUB_SPIRIT_TEMPLATES.filter((sentence) => !values.description.includes(sentence)).map((sentence) => ({
    id: sentence,
    label: sentence.split(',')[0].replace(/\.$/, ''),
  }));

  const flow = useCreateFlow<Step>({
    steps: STEPS,
    validate: (step) => {
      if (step === 'identity') {
        if (!badge) return 'Ajoute une image pour ton club.';
        return (
          firstIssue(nameSchema, values) ??
          moderateText(values.name) ??
          validateActivity(values.category)
        );
      }
      if (step === 'spirit')
        return moderateText(values.location) ?? moderateText(values.description);
      return null;
    },
    submit: async () => {
      if (!user?.id) throw new Error('Connecte-toi pour créer un club.');
      const supabase = createClient();
      const coverUrl = await uploadCoverImage(badge, user.id);
      const name = values.name.trim();
      const description = values.description.trim();
      const location = values.location.trim();
      const slug = `${slugify(name) || 'club'}-${Math.random().toString(36).slice(2, 6)}`;
      const { data, error: insertError } = await supabase
        .from('clubs')
        .insert({
          slug,
          name,
          description: [description, location ? `📍 ${location}` : ''].filter(Boolean).join('\n\n'),
          cover_image: coverUrl ?? '',
          category: values.category.trim().replace(/\s+/g, ' '),
          privacy: values.privacy,
          created_by: user.id,
          members_count: 1,
        })
        .select('id, slug')
        .single();
      if (insertError || !data)
        throw new Error(insertError?.message || 'Création du club refusée.');
      const { error: memberError } = await supabase.from('club_members').insert({
        club_id: data.id,
        user_id: user.id,
        role: 'admin',
        status: 'active',
      });
      if (memberError) throw new Error(memberError.message);
      try {
        await insertCommunityPost({
          authorId: user.id,
          content: `**Bienvenue dans ${name}**\n\n${description || 'La cordée est ouverte.'}\n\n/clubs/${data.slug || data.id}`,
          postType: 'share',
          imageUrl: coverUrl,
          audience: 'club',
          clubId: data.id,
          title: name,
        });
      } catch {
        /* le club existe ; le message d'accueil est facultatif */
      }
      clear();
      setBadge(null);
      onCreated('club', data.id);
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
      nextLabel={flow.wizard.isLast ? 'Créer le club' : 'Suivant'}
      onBack={flow.onBack}
      onNext={flow.onNext}
      draft={{ restored, onDiscard: () => { clear(); setBadge(null); flow.setError(null); } }}
    >
      {flow.current === 'identity' ? (
        <>
          <ImagePicker
            label="Image du club (obligatoire)"
            file={badge}
            onChange={setBadge}
            aspect="1 / 1"
            round
          />
          <TextField
            label="Nom du club"
            value={values.name}
            onChange={(name) => patch({ name })}
            maxLength={80}
            placeholder="La Cordée du Vercors"
          />
          {nameProblem ? (
            <p className="lkdv-wz-inline" role="status">{nameProblem}</p>
          ) : nameTaken ? (
            <p className="lkdv-wz-inline" role="status">Un club porte déjà ce nom : ajoute ton massif ou ta ville pour le distinguer.</p>
          ) : nameTaken === false ? (
            <p className="lkdv-wz-inline" data-tone="ok" role="status">Nom disponible.</p>
          ) : null}
          <TextField
            label="Activité"
            value={values.category}
            onChange={(category) => patch({ category })}
            maxLength={40}
            placeholder="Randonnée, trail, ski…"
          />
          {activityProblem ? <p className="lkdv-wz-inline" role="status">{activityProblem}</p> : null}
          <Chips
            label="Suggestions"
            options={CATEGORIES}
            value={values.category}
            onChange={(category) => patch({ category })}
          />
        </>
      ) : null}

      {flow.current === 'spirit' ? (
        <>
          <PlaceField
            label="Massif ou ville"
            value={values.location}
            onChange={(location) => patch({ location })}
            placeholder="Vercors"
          />
          <CountedTextArea
            label="L’esprit du club"
            value={values.description}
            onChange={(description) => patch({ description })}
            max={1500}
            placeholder="Le niveau, le rythme, l’ambiance…"
          />
          <QuickChips
            label="Phrases toutes prêtes"
            options={spiritOptions}
            onPick={(sentence) => patch({ description: appendSentence(values.description, sentence) })}
          />
        </>
      ) : null}

      {flow.current === 'access' ? (
        <>
          <Chips
            label="Qui peut rejoindre ?"
            options={PRIVACIES}
            value={values.privacy}
            onChange={(privacy) => patch({ privacy })}
          />
          <p className="lkdv-wz-hint">
            {values.privacy === 'open'
              ? 'Tout le monde peut rejoindre en un geste.'
              : 'Tu valides chaque demande avant l’entrée dans le club.'}
          </p>
          <PreviewCard
            kicker={`Club · ${values.privacy === 'open' ? 'Ouvert' : 'Sur validation'}`}
            title={values.name}
            meta={[values.category, values.location && `📍 ${values.location}`, '1 membre']}
            text={values.description}
            image={badgeUrl}
            round
          />
        </>
      ) : null}
    </WizardFrame>
  );
}

export default ClubCreateForm;
