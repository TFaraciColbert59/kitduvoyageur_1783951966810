'use client';

import React, { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { CommunityFormDrawer } from './CommunityFormDrawer';
import { Field, Select, SubmitFooter, TextArea, TextInput } from './form-fields';
import { insertCommunityPost } from './upload';

export interface ClubCreateFormProps {
  open: boolean;
  onClose: () => void;
  user: any;
  onCreated: (kind: 'club', id: string) => void;
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

export function ClubCreateForm({ open, onClose, user, onCreated }: ClubCreateFormProps) {
  const [name, setName] = useState('');
  const [category, setCategory] = useState('');
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState('');
  const [cover, setCover] = useState('');
  const [privacy, setPrivacy] = useState<'open' | 'closed'>('open');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setError(null);
    if (!user?.id) return setError('Connecte-toi pour créer un club.');
    if (!name.trim()) return setError('Le nom du club est requis.');
    setBusy(true);
    try {
      const supabase = createClient();
      const slugBase = slugify(name);
      const slug = `${slugBase || 'club'}-${Math.random().toString(36).slice(2, 6)}`;
      const { data, error: insertError } = await supabase
        .from('clubs')
        .insert({
          slug,
          name: name.trim(),
          description: [description.trim(), location.trim() ? `📍 ${location.trim()}` : ''].filter(Boolean).join('\n\n'),
          cover_image: cover.trim(),
          category: category.trim(),
          privacy,
          created_by: user.id,
          members_count: 1,
        })
        .select('id, slug')
        .single();
      if (insertError || !data) throw new Error(insertError?.message || 'Création du club refusée.');
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
          content: `**Bienvenue dans ${name.trim()}**\n\n${description.trim() || 'La cordée est ouverte.'}\n\n/clubs/${data.slug || data.id}`,
          postType: 'share',
          imageUrl: cover.trim() || null,
          audience: 'club',
          clubId: data.id,
          title: name.trim(),
        });
      } catch {
        setError('Club créé, mais la publication d’accueil n’a pas pu être ajoutée.');
      }
      onCreated('club', data.id);
      setName('');
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
      ariaLabel="Créer un club"
      error={error}
      footer={<SubmitFooter label="Créer le club" busy={busy} onClick={() => void submit()} />}
    >
      <p className="lkdv-form-intro">L’identité du club. Les règles, zones et adhésions se complètent ensuite.</p>
      <Field label="Nom">
        <TextInput value={name} onChange={(event) => setName(event.target.value)} maxLength={80} placeholder="La Cordée du Vercors" />
      </Field>
      <div className="lkdv-form-row">
        <Field label="Catégorie">
          <TextInput value={category} onChange={(event) => setCategory(event.target.value)} maxLength={60} placeholder="Randonnée" />
        </Field>
        <Field label="Lieu">
          <TextInput value={location} onChange={(event) => setLocation(event.target.value)} maxLength={80} placeholder="Vercors" />
        </Field>
      </div>
      <Field label="Description">
        <TextArea value={description} onChange={(event) => setDescription(event.target.value)} maxLength={1500} placeholder="L’esprit du club, le niveau, le rythme…" />
      </Field>
      <Field label="Cover (URL)">
        <TextInput value={cover} onChange={(event) => setCover(event.target.value)} placeholder="https://…" />
      </Field>
      <Field label="Adhésion">
        <Select value={privacy} onChange={(event) => setPrivacy(event.target.value as typeof privacy)}>
          <option value="open">Ouvert</option>
          <option value="closed">Sur validation</option>
        </Select>
      </Field>
      <a className="lkdv-form-link" href="/clubs/nouveau" onClick={onClose}>Ouvrir l’éditeur complet</a>
    </CommunityFormDrawer>
  );
}

export default ClubCreateForm;
