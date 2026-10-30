'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { z } from 'zod';
import Icon from '@/components/ui/Icon';
import { createClient } from '@/lib/supabase/client';
import { insertCommunityPost, uploadPostMedia } from './upload';
import { Chips, CountedTextArea, PlaceField, QuickChips, Stepper, TextField, useObjectUrl, type ChipOption } from './wizard/fields';
import { PreviewCard } from './wizard/PreviewCard';
import { appendTag, shortDay, suggestHashtags } from './wizard/assist';
import { MediaTray } from './wizard/MediaTray';
import { firstIssue, todayIso } from './wizard/validate';
import { useDraftedForm } from './wizard/useDraftedForm';
import { useWizard } from './wizard/useWizard';
import { WizardFrame } from './wizard/WizardFrame';

export type PostKind = 'photo' | 'billet' | 'question' | 'event';
type Audience = 'public' | 'abonnies' | 'club';

export interface PostCreateFormProps {
  open: boolean;
  onClose: () => void;
  user: any;
  onCreated: (kind: 'post', id: string) => void;
  /** Format choisi dans la sous-capsule du drawer. */
  format?: PostKind;
}

/** Étapes par format : un écran = une intention. */
export const POST_STEPS: Record<PostKind, ReadonlyArray<'media' | 'text' | 'details' | 'when' | 'audience'>> = {
  photo: ['media', 'text', 'audience'],
  billet: ['text', 'audience'],
  question: ['text', 'audience'],
  event: ['media', 'details', 'when', 'audience'],
};

const KICKERS = {
  media: 'Média',
  text: 'Texte',
  details: 'Détails',
  when: 'Quand',
  audience: 'Diffusion',
} as const;

const AUDIENCES: ReadonlyArray<ChipOption<Audience>> = [
  { id: 'public', label: 'Fil public', icon: <Icon name="globe" size={16} aria-hidden="true" /> },
  { id: 'abonnies', label: 'Mes abonnés', icon: <Icon name="users" size={16} aria-hidden="true" /> },
  { id: 'club', label: 'Un club', icon: <Icon name="lock" size={16} aria-hidden="true" /> },
];

const INITIAL = {
  title: '',
  content: '',
  location: '',
  audience: 'public' as Audience,
  clubId: '',
  eventDate: '',
  eventDuration: '',
  eventMax: 10,
};

const textSchema = (kind: PostKind) =>
  z.object({
    title:
      kind === 'billet' || kind === 'question'
        ? z.string().trim().min(1, kind === 'question' ? 'Pose ta question.' : 'Le titre est requis.')
        : z.string(),
    content: kind === 'billet' ? z.string().trim().min(1, 'Le texte est requis.') : z.string(),
  });

const detailsSchema = z.object({
  title: z.string().trim().min(1, 'Le titre de la sortie est requis.'),
  content: z.string().trim().min(1, 'Décris la sortie en une phrase.'),
});

const whenSchema = z.object({
  eventDate: z
    .string()
    .min(1, 'Choisis la date.')
    .refine((value) => value >= todayIso(), 'La date doit être aujourd’hui ou plus tard.'),
});

export function PostCreateForm({ open, onClose, user, onCreated, format = 'photo' }: PostCreateFormProps) {
  const steps = POST_STEPS[format];
  const wizard = useWizard(steps.length);
  const { values, patch, clear, restored } = useDraftedForm('post', user?.id, INITIAL);
  const [files, setFiles] = useState<File[]>([]);
  const [clubs, setClubs] = useState<Array<{ id: string; name: string }>>([]);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { reset } = wizard;
  useEffect(() => {
    reset();
    setError(null);
  }, [format, reset]);

  useEffect(() => {
    if (!open || !user?.id) return;
    let cancelled = false;
    const supabase = createClient();
    void (async () => {
      const { data: memberships } = await supabase
        .from('club_members')
        .select('club_id')
        .eq('user_id', user.id)
        .eq('status', 'active');
      const ids = (memberships ?? []).map((row: { club_id: string }) => row.club_id);
      if (!ids.length) return;
      const { data } = await supabase.from('clubs').select('id,name').in('id', ids);
      if (!cancelled) setClubs((data ?? []) as Array<{ id: string; name: string }>);
    })();
    return () => {
      cancelled = true;
    };
  }, [open, user?.id]);

  const current = steps[wizard.step] ?? 'text';
  const hasMedia = files.length > 0;
  const firstImage = files.find((file) => file.type.startsWith('image/')) ?? null;
  const previewUrl = useObjectUrl(current === 'audience' ? firstImage : null);
  const hashtags = suggestHashtags(values.content).map((tag) => ({ id: tag, label: `#${tag}` }));
  const FORMAT_LABEL: Record<PostKind, string> = { photo: 'Photo', billet: 'Billet', question: 'Question', event: 'Événement' };
  const AUDIENCE_LABEL: Record<Audience, string> = { public: 'Fil public', abonnies: 'Mes abonnés', club: clubs.find((club) => club.id === values.clubId)?.name ?? 'Un club' };

  // Les médias ne partent que sur le fil public : on le dit avant l'envoi, pas après l'échec.
  const audienceOptions = useMemo(
    () => AUDIENCES.map((option) => ({ ...option, disabled: hasMedia && option.id !== 'public' })),
    [hasMedia],
  );

  const validateStep = (): string | null => {
    if (current === 'media') {
      return format === 'photo' && files.length === 0 ? 'Choisis au moins une photo ou une vidéo.' : null;
    }
    if (current === 'text') return firstIssue(textSchema(format), values);
    if (current === 'details') return firstIssue(detailsSchema, values);
    if (current === 'when') return firstIssue(whenSchema, values);
    if (current === 'audience' && values.audience === 'club' && !values.clubId) return 'Choisis un club.';
    return null;
  };

  const submit = async () => {
    if (!user?.id) {
      setError('Connecte-toi pour publier.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const title = values.title.trim();
      const content = values.content.trim();
      const location = values.location.trim();
      const mediaUrls = await uploadPostMedia(files, user.id, values.audience, (done, total) =>
        setProgress({ done, total }),
      );
      let postId: string;

      if (format === 'event') {
        const supabase = createClient();
        const { data: event, error: eventError } = await supabase
          .from('events')
          .insert({
            title,
            type: 'rando',
            emoji: '🥾',
            organizer_id: user.id,
            event_date: values.eventDate,
            duration: values.eventDuration.trim(),
            location,
            country: 'France',
            max_participants: values.eventMax,
            current_participants: 0,
            description: content,
            cover_image: mediaUrls[0] || '',
            cover_alt: title,
            shared_kitty: 0,
            kitty_goal: 0,
            status: 'upcoming',
          })
          .select('id')
          .single();
        if (eventError || !event) throw new Error(eventError?.message || 'Création de l’événement refusée.');
        postId = await insertCommunityPost({
          authorId: user.id,
          content: `**${title}**\n\n📅 ${values.eventDate}${location ? ` · 📍 ${location}` : ''}\n\n${content}\n\n/evenements`,
          postType: 'share',
          mediaUrls,
          audience: values.audience,
          clubId: values.clubId,
          title,
        });
      } else {
        const locationLine = location ? `\n\n📍 ${location}` : '';
        const body = format === 'photo' ? content : [title && `**${title}**`, content].filter(Boolean).join('\n\n');
        postId = await insertCommunityPost({
          authorId: user.id,
          content: `${body}${locationLine}`,
          postType: format === 'question' ? 'question' : 'post',
          mediaUrls,
          audience: values.audience,
          clubId: values.clubId,
          title: title || null,
        });
      }

      clear();
      setFiles([]);
      wizard.reset();
      onCreated('post', postId);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Publication impossible.');
    } finally {
      setBusy(false);
      setProgress(null);
    }
  };

  const onNext = () => {
    const problem = validateStep();
    if (problem) {
      setError(problem);
      return;
    }
    setError(null);
    if (wizard.isLast) void submit();
    else wizard.next();
  };

  const nextLabel = wizard.isLast
    ? progress
      ? `Envoi ${progress.done}/${progress.total}`
      : format === 'event'
        ? 'Proposer'
        : 'Publier'
    : 'Suivant';

  return (
    <WizardFrame
      step={wizard.step}
      total={wizard.total}
      kicker={KICKERS[current]}
      error={error}
      busy={busy}
      nextLabel={nextLabel}
      onBack={() => {
        setError(null);
        wizard.back();
      }}
      onNext={onNext}
      draft={{ restored, onDiscard: () => { clear(); setFiles([]); setError(null); } }}
    >
      {current === 'media' ? <MediaTray files={files} onChange={setFiles} onError={setError} /> : null}

      {current === 'text' ? (
        <>
          {format === 'billet' || format === 'question' ? (
            <TextField
              label={format === 'question' ? 'Ta question' : 'Titre'}
              value={values.title}
              onChange={(title) => patch({ title })}
              maxLength={120}
              placeholder={format === 'question' ? 'Quel sac pour le GR20 ?' : 'Un titre clair'}
            />
          ) : null}
          <CountedTextArea
            label={format === 'photo' ? 'Légende' : format === 'question' ? 'Précisions (facultatif)' : 'Texte'}
            value={values.content}
            onChange={(content) => patch({ content })}
            max={4000}
            placeholder={format === 'photo' ? 'Raconte ce moment… #bivouac' : 'Raconte, partage, demande…'}
          />
          {format !== 'question' ? (
            <QuickChips label="Mots-clés" options={hashtags} onPick={(tag) => patch({ content: appendTag(values.content, tag) })} />
          ) : null}
          <PlaceField label="Lieu" value={values.location} onChange={(location) => patch({ location })} placeholder="Lac Blanc, Chamonix…" />
        </>
      ) : null}

      {current === 'details' ? (
        <>
          <TextField label="Titre de la sortie" value={values.title} onChange={(title) => patch({ title })} maxLength={120} placeholder="Lac Blanc au lever du jour" />
          <CountedTextArea label="Description" value={values.content} onChange={(content) => patch({ content })} max={1500} placeholder="Le programme, le niveau, le matériel…" />
          <PlaceField label="Lieu" value={values.location} onChange={(location) => patch({ location })} placeholder="Chamonix" />
        </>
      ) : null}

      {current === 'when' ? (
        <>
          <TextField label="Date" type="date" value={values.eventDate} min={todayIso()} onChange={(eventDate) => patch({ eventDate })} />
          <TextField label="Durée" value={values.eventDuration} onChange={(eventDuration) => patch({ eventDuration })} placeholder="2 jours" />
          <Stepper label="Participants max" value={values.eventMax} min={2} max={50} onChange={(eventMax) => patch({ eventMax })} />
        </>
      ) : null}

      {current === 'audience' ? (
        <>
          <Chips
            label="Qui peut voir ?"
            options={audienceOptions}
            value={values.audience}
            onChange={(audience) => patch({ audience, clubId: audience === 'club' ? values.clubId : '' })}
          />
          {hasMedia ? <p className="lkdv-wz-hint">Les photos et vidéos sont réservées au fil public.</p> : null}
          {values.audience === 'club' ? (
            clubs.length === 0 ? (
              <p className="lkdv-wz-hint">Aucun club actif : rejoins un club d’abord.</p>
            ) : (
              <Chips
                label="Quel club ?"
                options={clubs.map((club) => ({ id: club.id, label: club.name }))}
                value={values.clubId}
                onChange={(clubId) => patch({ clubId })}
              />
            )
          ) : null}
          <PreviewCard
            kicker={FORMAT_LABEL[format]}
            title={values.title || values.content.split('\n')[0] || ''}
            meta={[values.location && `📍 ${values.location}`, format === 'event' && shortDay(values.eventDate), AUDIENCE_LABEL[values.audience], files.length > 1 && `${files.length} médias`]}
            text={values.title ? values.content : values.content.split('\n').slice(1).join(' ')}
            image={previewUrl}
          />
        </>
      ) : null}
    </WizardFrame>
  );
}

export default PostCreateForm;
