'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { CommunityFormDrawer } from './CommunityFormDrawer';
import { Field, Select, SubmitFooter, TextArea, TextInput } from './form-fields';
import { insertCommunityPost } from './upload';

export interface CarnetCreateFormProps {
  open: boolean;
  onClose: () => void;
  user: any;
  onCreated: (kind: 'carnet', id: string) => void;
}

export function CarnetCreateForm({ open, onClose, user, onCreated }: CarnetCreateFormProps) {
  const [title, setTitle] = useState('');
  const [destination, setDestination] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [description, setDescription] = useState('');
  const [cover, setCover] = useState('');
  const [visibility, setVisibility] = useState<'public' | 'private'>('public');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setError(null);
    if (!user?.id) return setError('Connecte-toi pour créer un carnet.');
    if (!title.trim() || !destination.trim()) return setError('Titre et destination sont requis.');
    setBusy(true);
    try {
      const supabase = createClient();
      const { data, error: insertError } = await supabase
        .from('carnets')
        .insert({
          title: title.trim(),
          destination: destination.trim(),
          description: description.trim(),
          cover_image: cover.trim(),
          start_date: startDate || null,
          end_date: endDate || null,
          visibility,
          author_id: user.id,
        })
        .select('id')
        .single();
      if (insertError || !data) throw new Error(insertError?.message || 'Création du carnet refusée.');
      try {
        await insertCommunityPost({
          authorId: user.id,
          content: `**${title.trim()}**\n\n${description.trim() || destination.trim()}`,
          postType: 'share',
          imageUrl: cover.trim() || null,
          audience: visibility === 'public' ? 'public' : 'abonnies',
          linkedCarnetId: data.id,
          title: title.trim(),
        });
      } catch {
        setError('Carnet créé, mais la publication n’a pas pu être ajoutée.');
      }
      onCreated('carnet', data.id);
      setTitle('');
      setDestination('');
      setDescription('');
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
      ariaLabel="Créer un carnet"
      error={error}
      footer={<SubmitFooter label="Créer le carnet" busy={busy} onClick={() => void submit()} />}
    >
      <p className="lkdv-form-intro">Les bases du carnet. Les étapes, moments et le kit se complètent ensuite.</p>
      <Field label="Titre">
        <TextInput value={title} onChange={(event) => setTitle(event.target.value)} maxLength={120} placeholder="Traversée du Vercors" />
      </Field>
      <Field label="Destination">
        <TextInput value={destination} onChange={(event) => setDestination(event.target.value)} maxLength={120} placeholder="Vercors, France" />
      </Field>
      <div className="lkdv-form-row">
        <Field label="Début">
          <TextInput type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} />
        </Field>
        <Field label="Fin">
          <TextInput type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} />
        </Field>
      </div>
      <Field label="Description">
        <TextArea value={description} onChange={(event) => setDescription(event.target.value)} maxLength={1000} placeholder="Le récit, l’idée, les points forts…" />
      </Field>
      <Field label="Cover (URL)">
        <TextInput value={cover} onChange={(event) => setCover(event.target.value)} placeholder="https://…" />
      </Field>
      <Field label="Visibilité">
        <Select value={visibility} onChange={(event) => setVisibility(event.target.value as typeof visibility)}>
          <option value="public">Public</option>
          <option value="private">Privé</option>
        </Select>
      </Field>
      <Link className="lkdv-form-link" href="/communaute" onClick={onClose}>Ouvrir l’éditeur complet</Link>
    </CommunityFormDrawer>
  );
}

export default CarnetCreateForm;
