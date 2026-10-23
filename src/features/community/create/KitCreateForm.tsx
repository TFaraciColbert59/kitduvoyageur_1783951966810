'use client';

import React, { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { CommunityFormDrawer } from './CommunityFormDrawer';
import { Field, Select, SubmitFooter, TextArea, TextInput } from './form-fields';
import { insertCommunityPost } from './upload';

export interface KitCreateFormProps {
  open: boolean;
  onClose: () => void;
  user: any;
  onCreated: (kind: 'kit', id: string) => void;
}

const SEASONS = [
  ['toute_saison', 'Toute saison'],
  ['printemps', 'Printemps'],
  ['ete', 'Été'],
  ['automne', 'Automne'],
  ['hiver', 'Hiver'],
] as const;

export function KitCreateForm({ open, onClose, user, onCreated }: KitCreateFormProps) {
  const [name, setName] = useState('');
  const [season, setSeason] = useState('toute_saison');
  const [weight, setWeight] = useState('');
  const [description, setDescription] = useState('');
  const [cover, setCover] = useState('');
  const [isPublic, setIsPublic] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setError(null);
    if (!user?.id) return setError('Connecte-toi pour créer un kit.');
    if (!name.trim()) return setError('Le nom du kit est requis.');
    setBusy(true);
    try {
      const supabase = createClient();
      const { data, error: insertError } = await supabase
        .from('materiel_kits')
        .insert({
          user_id: user.id,
          name: name.trim(),
          description: description.trim() || null,
          season,
          total_weight_g: Number(weight) || 0,
          is_public: isPublic,
          cover_image_url: cover.trim() || null,
        })
        .select('id')
        .single();
      if (insertError || !data) throw new Error(insertError?.message || 'Création du kit refusée.');
      try {
        await insertCommunityPost({
          authorId: user.id,
          content: `**${name.trim()}**\n\n${description.trim() || 'Mon kit de matériel.'}\n\n/materiel`,
          postType: 'share',
          imageUrl: cover.trim() || null,
          linkedKitId: data.id,
          title: name.trim(),
        });
      } catch {
        setError('Kit créé, mais la publication n’a pas pu être ajoutée.');
      }
      onCreated('kit', data.id);
      setName('');
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
      ariaLabel="Créer un kit"
      error={error}
      footer={<SubmitFooter label="Créer le kit" busy={busy} onClick={() => void submit()} />}
    >
      <p className="lkdv-form-intro">Un kit rapide. Les items et le poids se détaillent dans l’éditeur complet.</p>
      <Field label="Nom">
        <TextInput value={name} onChange={(event) => setName(event.target.value)} maxLength={100} placeholder="Kit bivouac 3 saisons" />
      </Field>
      <div className="lkdv-form-row">
        <Field label="Saison">
          <Select value={season} onChange={(event) => setSeason(event.target.value)}>
            {SEASONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </Select>
        </Field>
        <Field label="Poids (g)">
          <TextInput type="number" min={0} value={weight} onChange={(event) => setWeight(event.target.value)} placeholder="4200" />
        </Field>
      </div>
      <Field label="Description">
        <TextArea value={description} onChange={(event) => setDescription(event.target.value)} maxLength={1000} placeholder="Usage, terrain, particularités…" />
      </Field>
      <Field label="Cover (URL)">
        <TextInput value={cover} onChange={(event) => setCover(event.target.value)} placeholder="https://…" />
      </Field>
      <Field label="Visibilité">
        <Select value={isPublic ? 'public' : 'private'} onChange={(event) => setIsPublic(event.target.value === 'public')}>
          <option value="public">Public</option>
          <option value="private">Privé</option>
        </Select>
      </Field>
      <a className="lkdv-form-link" href="/materiel" onClick={onClose}>Ouvrir l’éditeur complet</a>
    </CommunityFormDrawer>
  );
}

export default KitCreateForm;
