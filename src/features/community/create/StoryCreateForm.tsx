'use client';

import React, { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { stripImageMetadata } from '@/lib/media/stripImageMetadata';
import { CommunityFormDrawer } from './CommunityFormDrawer';
import { Field, MediaInput, Select, SubmitFooter, TextArea } from './form-fields';

export interface StoryCreateFormProps {
  open: boolean;
  onClose: () => void;
  user: any;
  onCreated: (kind: 'story', id: string) => void;
}

export function StoryCreateForm({ open, onClose, user, onCreated }: StoryCreateFormProps) {
  const [file, setFile] = useState<File | null>(null);
  const [caption, setCaption] = useState('');
  const [audience, setAudience] = useState<'public' | 'abonnies' | 'only_me'>('public');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setError(null);
    if (!user?.id) return setError('Connecte-toi pour publier une story.');
    if (!file) return setError('Choisis une photo ou une vidéo.');
    setBusy(true);
    try {
      const supabase = createClient();
      const isVideo = file.type.startsWith('video/');
      const cleaned = isVideo ? file : await stripImageMetadata(file);
      const contentType = cleaned.type || (isVideo ? 'video/mp4' : 'image/jpeg');
      const ext = (file.name.split('.').pop() || (isVideo ? 'mp4' : 'jpg')).toLowerCase();
      const storyId = crypto.randomUUID();
      const path = `${user.id}/${storyId}/${Date.now()}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from('stories-private')
        .upload(path, cleaned, { cacheControl: '3600', upsert: false, contentType });
      if (uploadError) throw new Error(uploadError.message);
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
        caption: caption.trim() ? caption.trim().slice(0, 280) : null,
        visibility: audience,
      });
      if (insertError) {
        await supabase.storage.from('stories-private').remove([path]).catch(() => {});
        throw new Error(insertError.message);
      }
      onCreated('story', storyId);
      setFile(null);
      setCaption('');
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Publication impossible.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <CommunityFormDrawer
      open={open}
      onClose={onClose}
      ariaLabel="Créer une story"
      error={error}
      footer={<SubmitFooter label="Publier la story" busy={busy} onClick={() => void submit()} />}
    >
      <p className="lkdv-form-intro">Une photo ou une vidéo, une légende, une audience. 24 h.</p>
      <MediaInput label="Photo ou vidéo" multiple={false} onChange={(files) => setFile(files[0] ?? null)} />
      <Field label="Légende" hint="280 caractères max.">
        <TextArea value={caption} onChange={(event) => setCaption(event.target.value)} maxLength={280} placeholder="Un mot sur ce moment…" />
      </Field>
      <Field label="Audience">
        <Select value={audience} onChange={(event) => setAudience(event.target.value as typeof audience)}>
          <option value="public">Tout le monde</option>
          <option value="abonnies">Mes abonnés</option>
          <option value="only_me">Moi uniquement</option>
        </Select>
      </Field>
    </CommunityFormDrawer>
  );
}

export default StoryCreateForm;
