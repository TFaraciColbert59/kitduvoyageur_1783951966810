'use client';

import React, { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { CommunityFormDrawer } from './CommunityFormDrawer';
import { Field, MediaInput, Select, SubmitFooter, TextArea, TextInput } from './form-fields';
import { insertCommunityPost, uploadPostMedia } from './upload';

type PostKind = 'photo' | 'billet' | 'question' | 'event';
type Audience = 'public' | 'abonnies' | 'club';

export interface PostCreateFormProps {
  open: boolean;
  onClose: () => void;
  user: any;
  onCreated: (kind: 'post', id: string) => void;
}

const TYPES: Array<{ id: PostKind; label: string }> = [
  { id: 'photo', label: 'Photo / vidéo' },
  { id: 'billet', label: 'Billet' },
  { id: 'question', label: 'Question' },
  { id: 'event', label: 'Événement' },
];

export function PostCreateForm({ open, onClose, user, onCreated }: PostCreateFormProps) {
  const [kind, setKind] = useState<PostKind>('photo');
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [audience, setAudience] = useState<Audience>('public');
  const [clubId, setClubId] = useState('');
  const [clubs, setClubs] = useState<Array<{ id: string; name: string }>>([]);
  const [location, setLocation] = useState('');
  const [tags, setTags] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [eventDate, setEventDate] = useState('');
  const [eventDuration, setEventDuration] = useState('');
  const [eventMax, setEventMax] = useState('10');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  const submit = async () => {
    setError(null);
    if (!user?.id) return setError('Connecte-toi pour publier.');
    if (kind === 'photo' && files.length === 0) return setError('Choisis au moins une photo ou vidéo.');
    if (kind !== 'photo' && !title.trim()) return setError('Le titre est requis.');
    if (kind === 'event' && !eventDate) return setError('La date de l’événement est requise.');
    if (audience === 'club' && !clubId) return setError('Choisis un club.');
    if (kind !== 'photo' && !content.trim()) return setError('Le texte est requis.');
    setBusy(true);
    try {
      const mediaUrls = await uploadPostMedia(files, user.id, audience);
      const cleanTags = tags.split(',').map((tag) => tag.trim()).filter(Boolean);
      let postId: string;

      if (kind === 'event') {
        const supabase = createClient();
        const { data: event, error: eventError } = await supabase
          .from('events')
          .insert({
            title: title.trim(),
            type: 'rando',
            emoji: '🥾',
            organizer_id: user.id,
            event_date: eventDate,
            duration: eventDuration.trim(),
            location: location.trim(),
            country: 'France',
            max_participants: Number(eventMax) || 10,
            current_participants: 0,
            description: content.trim(),
            cover_image: mediaUrls[0] || '',
            cover_alt: title.trim(),
            shared_kitty: 0,
            kitty_goal: 0,
            status: 'upcoming',
          })
          .select('id')
          .single();
        if (eventError || !event) throw new Error(eventError?.message || 'Création de l’événement refusée.');
        postId = await insertCommunityPost({
          authorId: user.id,
          content: `**${title.trim()}**\n\n📅 ${eventDate}${location.trim() ? ` · 📍 ${location.trim()}` : ''}\n\n${content.trim()}\n\n/evenements`,
          postType: 'share',
          mediaUrls,
          audience,
          clubId,
          title: title.trim(),
        });
      } else {
        const locationLine = location.trim() ? `\n\n📍 ${location.trim()}` : '';
        const fullContent =
          kind !== 'photo' && title.trim() ? `**${title.trim()}**\n\n${content.trim()}` : content.trim();
        postId = await insertCommunityPost({
          authorId: user.id,
          content: `${fullContent}${locationLine}`,
          postType: kind === 'question' ? 'question' : 'post',
          mediaUrls,
          audience,
          clubId,
          title: title.trim() || null,
        });
      }

      onCreated('post', postId);
      setTitle('');
      setContent('');
      setFiles([]);
      setLocation('');
      setTags('');
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
      ariaLabel="Créer une publication"
      error={error}
      footer={<SubmitFooter label="Publier" busy={busy} onClick={() => void submit()} />}
    >
      <p className="lkdv-form-intro">Choisis le format, ajoute ton texte ou ton média, puis publie.</p>
      <div className="lkdv-form-tabs" role="tablist" aria-label="Type de publication">
        {TYPES.map((type) => (
          <button key={type.id} type="button" aria-pressed={kind === type.id} onClick={() => setKind(type.id)}>
            {type.label}
          </button>
        ))}
      </div>

      {kind !== 'photo' ? (
        <Field label={kind === 'question' ? 'Question' : kind === 'event' ? 'Titre de la sortie' : 'Titre'}>
          <TextInput value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Un titre clair" maxLength={120} />
        </Field>
      ) : null}

      <Field label={kind === 'event' ? 'Description' : 'Texte'}>
        <TextArea
          value={content}
          onChange={(event) => setContent(event.target.value)}
          placeholder={kind === 'question' ? 'Pose ta question à la communauté…' : 'Raconte, partage, demande…'}
          maxLength={4000}
        />
      </Field>

      {kind === 'photo' || kind === 'event' ? (
        <MediaInput onChange={setFiles} label={kind === 'event' ? 'Photo de couverture (optionnel)' : 'Photos / vidéos'} />
      ) : null}

      <div className="lkdv-form-row">
        <Field label="Lieu">
          <TextInput value={location} onChange={(event) => setLocation(event.target.value)} placeholder="Lac Blanc, Chamonix…" />
        </Field>
        <Field label="Tags">
          <TextInput value={tags} onChange={(event) => setTags(event.target.value)} placeholder="rando, bivouac" />
        </Field>
      </div>

      <Field label="Audience">
        <Select value={audience} onChange={(event) => setAudience(event.target.value as Audience)}>
          <option value="public">Fil public</option>
          <option value="abonnies">Mes abonnés</option>
          <option value="club">Un club</option>
        </Select>
      </Field>
      {audience === 'club' ? (
        <Field label="Club" hint={clubs.length === 0 ? 'Aucun club actif : rejoins un club d’abord.' : undefined}>
          <Select value={clubId} onChange={(event) => setClubId(event.target.value)}>
            <option value="">Choisir un club</option>
            {clubs.map((club) => (
              <option key={club.id} value={club.id}>{club.name}</option>
            ))}
          </Select>
        </Field>
      ) : null}

      {kind === 'event' ? (
        <>
          <div className="lkdv-form-row">
            <Field label="Date">
              <TextInput type="date" value={eventDate} onChange={(event) => setEventDate(event.target.value)} />
            </Field>
            <Field label="Durée">
              <TextInput value={eventDuration} onChange={(event) => setEventDuration(event.target.value)} placeholder="2 jours" />
            </Field>
          </div>
          <Field label="Participants max">
            <TextInput type="number" min={2} max={50} value={eventMax} onChange={(event) => setEventMax(event.target.value)} />
          </Field>
        </>
      ) : null}
    </CommunityFormDrawer>
  );
}

export default PostCreateForm;
