'use client';

import React, { useState } from 'react';
import { z } from 'zod';
import Icon from '@/components/ui/Icon';
import { createClient } from '@/lib/supabase/client';
import { prepareImage } from '@/lib/media/prepareImage';
import { Chips, CountedTextArea, useObjectUrl, type ChipOption } from './wizard/fields';
import { PreviewCard } from './wizard/PreviewCard';
import { firstIssue } from './wizard/validate';
import { MediaTray, acceptMedia } from './wizard/MediaTray';
import { StoryStage } from './StoryStage';
import { useCreateFlow } from './wizard/useCreateFlow';
import { useDraftedForm } from './wizard/useDraftedForm';
import { WizardFrame } from './wizard/WizardFrame';

export interface StoryCreateFormProps {
  open: boolean;
  onClose: () => void;
  user: any;
  onCreated: (kind: 'story', id: string) => void;
}

const STEPS = ['media', 'share'] as const;
type Step = (typeof STEPS)[number];
const KICKERS: Record<Step, string> = { media: 'Média', share: 'Diffusion' };

type Audience = 'public' | 'abonnies' | 'only_me';
const AUDIENCES: ReadonlyArray<ChipOption<Audience>> = [
  {
    id: 'public',
    label: 'Tout le monde',
    icon: <Icon name="globe" size={16} aria-hidden="true" />,
  },
  {
    id: 'abonnies',
    label: 'Mes abonnés',
    icon: <Icon name="users" size={16} aria-hidden="true" />,
  },
  { id: 'only_me', label: 'Moi', icon: <Icon name="lock" size={16} aria-hidden="true" /> },
];

const INITIAL = { caption: '', audience: 'public' as Audience };

const shareSchema = z.object({
  caption: z.string().max(280, 'La légende fait 280 caractères au plus.'),
  audience: z.enum(['public', 'abonnies', 'only_me']),
});

export function StoryCreateForm({ onClose, user, onCreated }: StoryCreateFormProps) {
  const { values, patch, clear, restored } = useDraftedForm('story', user?.id, INITIAL);
  const [files, setFiles] = useState<File[]>([]);
  const AUDIENCE_HINT: Record<Audience, string> = {
    public: 'Visible 24 h par toute la communauté.',
    abonnies: 'Visible 24 h par tes abonnés seulement.',
    only_me: 'Visible 24 h par toi seul : un brouillon à revoir.',
  };

  const flow = useCreateFlow<Step>({
    steps: STEPS,
    validate: (step) => {
      if (step === 'media') return files.length === 0 ? 'Choisis une photo ou une vidéo.' : null;
      return firstIssue(shareSchema, values);
    },
    submit: async () => {
      const file = files[0];
      if (!user?.id) throw new Error('Connecte-toi pour publier une story.');
      if (!file) throw new Error('Choisis une photo ou une vidéo.');
      const supabase = createClient();
      const isVideo = file.type.startsWith('video/');
      const cleaned = isVideo ? file : await prepareImage(file);
      const contentType = cleaned.type || (isVideo ? 'video/mp4' : 'image/jpeg');
      const ext = (cleaned.name.split('.').pop() || (isVideo ? 'mp4' : 'jpg')).toLowerCase();
      const storyId = crypto.randomUUID();
      const path = `${user.id}/${storyId}/${Date.now()}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from('stories-private')
        .upload(path, cleaned, { cacheControl: '3600', upsert: false, contentType });
      if (uploadError) throw new Error(uploadError.message);
      const caption = values.caption.trim();
      const { error: insertError } = await supabase.from('post_stories').insert({
        id: storyId,
        author_id: user.id,
        image_url: null,
        storage_bucket: 'stories-private',
        storage_path: path,
        media_type: isVideo ? 'video' : 'image',
        mime_type: contentType,
        composition: null,
        composition_version: null,
        status: 'ready',
        client_request_id: crypto.randomUUID(),
        caption: caption ? caption.slice(0, 280) : null,
        visibility: values.audience,
      });
      if (insertError) {
        await supabase.storage
          .from('stories-private')
          .remove([path])
          .catch(() => {});
        throw new Error(insertError.message);
      }
      clear();
      setFiles([]);
      onCreated('story', storyId);
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
      nextLabel={flow.wizard.isLast ? 'Publier la story' : 'Suivant'}
      onBack={flow.onBack}
      onNext={flow.onNext}
      draft={{ restored, onDiscard: clear }}
    >
      {flow.current === 'media' && files[0] ? (
        <StoryStage
          file={files[0]}
          onNext={flow.onNext}
          onReplace={(next) => {
            const result = acceptMedia([], [next], 1);
            flow.setError(result.error);
            if (result.files.length > 0) setFiles(result.files);
          }}
        />
      ) : null}
      {flow.current === 'media' && !files[0] ? (
        <MediaTray
          files={files}
          onChange={(next) => setFiles(next.slice(-1))}
          onError={flow.setError}
          max={1}
        />
      ) : null}

      {flow.current === 'share' ? (
        <>
          <CountedTextArea
            label="Un mot sur ce moment"
            value={values.caption}
            onChange={(caption) => patch({ caption })}
            max={280}
            placeholder="Visible 24 h…"
          />
          <Chips
            label="Qui la voit ?"
            options={AUDIENCES}
            value={values.audience}
            onChange={(audience) => patch({ audience })}
          />
          <p className="lkdv-wz-hint">{AUDIENCE_HINT[values.audience]}</p>
          <StoryPreview file={files[0] ?? null} caption={values.caption} />
        </>
      ) : null}
    </WizardFrame>
  );
}

/** Vignette de la story telle qu'elle partira (image ou première image de la vidéo). */
function StoryPreview({ file, caption }: { file: File | null; caption: string }) {
  const url = useObjectUrl(file);
  const isVideo = Boolean(file?.type.startsWith('video/'));
  return (
    <div className="lkdv-wz-story-preview">
      <div className="lkdv-wz-story-thumb" aria-hidden="true">
        {url && isVideo ? <video src={url} muted playsInline preload="metadata" /> : null}
        {/* eslint-disable-next-line @next/next/no-img-element -- aperçu local (blob:) */}
        {url && !isVideo ? <img src={url} alt="" /> : null}
      </div>
      <PreviewCard kicker={isVideo ? 'Story · vidéo · 24 h' : 'Story · photo · 24 h'} title={caption.trim() || 'Sans légende'} meta={[]} />
    </div>
  );
}

export default StoryCreateForm;
