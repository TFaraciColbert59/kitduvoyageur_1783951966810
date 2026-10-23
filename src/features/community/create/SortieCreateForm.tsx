'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { CommunityFormDrawer } from './CommunityFormDrawer';
import { Field, SubmitFooter, TextArea, TextInput } from './form-fields';
import { insertCommunityPost } from './upload';

export interface SortieCreateFormProps {
  open: boolean;
  onClose: () => void;
  user: any;
  onCreated: (kind: 'sortie', id: string) => void;
}

export function SortieCreateForm({ open, onClose, user, onCreated }: SortieCreateFormProps) {
  const [title, setTitle] = useState('');
  const [date, setDate] = useState('');
  const [duration, setDuration] = useState('');
  const [location, setLocation] = useState('');
  const [max, setMax] = useState('10');
  const [description, setDescription] = useState('');
  const [cover, setCover] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setError(null);
    if (!user?.id) return setError('Connecte-toi pour créer une sortie.');
    if (!title.trim() || !date) return setError('Titre et date sont requis.');
    setBusy(true);
    try {
      const supabase = createClient();
      const { data, error: insertError } = await supabase
        .from('events')
        .insert({
          title: title.trim(),
          type: 'rando',
          emoji: '🥾',
          organizer_id: user.id,
          event_date: date,
          duration: duration.trim(),
          location: location.trim(),
          country: 'France',
          max_participants: Number(max) || 10,
          current_participants: 0,
          description: description.trim(),
          cover_image: cover.trim(),
          cover_alt: title.trim(),
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
          content: `**${title.trim()}**\n\n📅 ${date}${location.trim() ? ` · 📍 ${location.trim()}` : ''}\n\n${description.trim()}\n\n/evenements`,
          postType: 'share',
          imageUrl: cover.trim() || null,
          title: title.trim(),
        });
      } catch {
        setError('Sortie créée, mais la publication n’a pas pu être ajoutée.');
      }
      onCreated('sortie', data.id);
      setTitle('');
      setDescription('');
      setLocation('');
      setCover('');
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Création impossible.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <CommunityFormDrawer
      open={open}
      onClose={onClose}
      ariaLabel="Créer une sortie"
      error={error}
      footer={<SubmitFooter label="Créer la sortie" busy={busy} onClick={() => void submit()} />}
    >
      <p className="lkdv-form-intro">Une sortie simple : date, lieu, participants. Le GPX se règle ensuite.</p>
      <Field label="Titre">
        <TextInput value={title} onChange={(event) => setTitle(event.target.value)} maxLength={120} placeholder="Lac Blanc au lever du jour" />
      </Field>
      <div className="lkdv-form-row">
        <Field label="Date">
          <TextInput type="date" value={date} onChange={(event) => setDate(event.target.value)} />
        </Field>
        <Field label="Durée">
          <TextInput value={duration} onChange={(event) => setDuration(event.target.value)} placeholder="1 journée" />
        </Field>
      </div>
      <Field label="Lieu">
        <TextInput value={location} onChange={(event) => setLocation(event.target.value)} placeholder="Chamonix" />
      </Field>
      <Field label="Participants max">
        <TextInput type="number" min={2} max={50} value={max} onChange={(event) => setMax(event.target.value)} />
      </Field>
      <Field label="Description">
        <TextArea value={description} onChange={(event) => setDescription(event.target.value)} maxLength={1500} placeholder="Le programme, le niveau, le matériel…" />
      </Field>
      <Field label="Cover (URL)">
        <TextInput value={cover} onChange={(event) => setCover(event.target.value)} placeholder="https://…" />
      </Field>
      <Link className="lkdv-form-link" href="/evenements" onClick={onClose}>Voir les sorties</Link>
    </CommunityFormDrawer>
  );
}

export default SortieCreateForm;
