'use client';

import React, { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { BookOpen, Camera, Image as ImageIcon, Map, Mountain, Plus, Users } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { stripImageMetadata } from '@/lib/media/stripImageMetadata';
import { DrawerButton, OverlaySheet } from '../overlay/OverlaySheet';

type CreateType = 'post' | 'story' | 'carnet' | 'kit' | 'club' | 'trip';

const CATALOG = [
  { id: 'post' as const, title: 'Publication', subtitle: 'Photo, texte ou question', icon: <ImageIcon size={20} /> },
  { id: 'story' as const, title: 'Story', subtitle: 'Visible 24 h', icon: <Camera size={20} /> },
  { id: 'carnet' as const, title: 'Carnet', subtitle: 'Récit d’une aventure', icon: <BookOpen size={20} /> },
  { id: 'kit' as const, title: 'Kit', subtitle: 'Compose ton sac', icon: <Mountain size={20} /> },
  { id: 'club' as const, title: 'Club', subtitle: 'Rassemble ta cordée', icon: <Users size={20} /> },
  { id: 'trip' as const, title: 'Voyage', subtitle: 'Prépare une aventure', icon: <Map size={20} /> },
];

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Création impossible';
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

export interface CreateDrawerProps {
  initialType?: string;
  onClose: () => void;
  onCreated?: () => void;
}

export function CreateDrawer({ initialType, onClose, onCreated }: CreateDrawerProps) {
  const { user } = useAuth();
  const router = useRouter();
  const [type, setType] = useState<CreateType | null>(
    CATALOG.some((item) => item.id === initialType) ? (initialType as CreateType) : null
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const run = async (action: () => Promise<string>) => {
    setBusy(true);
    setError(null);
    try {
      const message = await action();
      setSuccess(message);
      onCreated?.();
      router.refresh();
      window.setTimeout(onClose, 900);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <OverlaySheet
      title={type ? CATALOG.find((item) => item.id === type)?.title || 'Créer' : 'Créer'}
      subtitle={type ? 'Tout se passe ici, sans quitter ton compte.' : 'Choisis ce que tu veux créer.'}
      onClose={onClose}
      headerRight={
        type ? (
          <button type="button" className="lkdv-create-back" onClick={() => setType(null)}>
            Tous les types
          </button>
        ) : undefined
      }
    >
      {success ? (
        <div className="lkdv-overlay-empty"><b>{success}</b><p>La création est enregistrée dans ton profil.</p></div>
      ) : !user ? (
        <div className="lkdv-overlay-empty"><b>Connecte-toi pour créer</b><p>Ton compte te permet de publier et partager.</p></div>
      ) : !type ? (
        <div className="lkdv-create-catalog">
          {CATALOG.map((item) => (
            <button key={item.id} type="button" className="lkdv-create-card" onClick={() => setType(item.id)}>
              <span className="lkdv-create-icon">{item.icon}</span>
              <span><b>{item.title}</b><small>{item.subtitle}</small></span>
              <Plus size={16} aria-hidden="true" />
            </button>
          ))}
        </div>
      ) : (
        <>
          {error ? <p className="lkdv-create-error" role="alert">{error}</p> : null}
          {type === 'post' ? <PostForm busy={busy} onSubmit={(action) => void run(action)} /> : null}
          {type === 'story' ? <StoryForm busy={busy} onSubmit={(action) => void run(action)} /> : null}
          {type === 'carnet' ? <CarnetForm busy={busy} onSubmit={(action) => void run(action)} /> : null}
          {type === 'kit' ? <KitForm busy={busy} onSubmit={(action) => void run(action)} /> : null}
          {type === 'club' ? <ClubForm busy={busy} onSubmit={(action) => void run(action)} /> : null}
          {type === 'trip' ? <TripForm busy={busy} onSubmit={(action) => void run(action)} /> : null}
        </>
      )}
    </OverlaySheet>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="lkdv-overlay-field"><span>{label}</span>{children}</label>;
}

function PostForm({ busy, onSubmit }: { busy: boolean; onSubmit: (action: () => Promise<string>) => void }) {
  const { user } = useAuth();
  const [content, setContent] = useState('');
  const [audience, setAudience] = useState('public');
  const [file, setFile] = useState<File | null>(null);
  const preview = useMemo(() => (file ? URL.createObjectURL(file) : null), [file]);

  const submit = async () => {
    if (!user) throw new Error('Connexion requise');
    if (!content.trim() && !file) throw new Error('Ajoute un texte ou une photo');
    const supabase = createClient();
    let imageUrl: string | null = null;
    if (file) {
      const cleaned = await stripImageMetadata(file);
      const ext = cleaned.type === 'image/png' ? 'png' : 'jpg';
      const path = `community-posts/${user.id}/${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage.from('carnet-media').upload(path, cleaned, {
        contentType: cleaned.type || 'image/jpeg',
        upsert: false,
      });
      if (error) throw new Error(error.message);
      imageUrl = supabase.storage.from('carnet-media').getPublicUrl(path).data.publicUrl;
    }
    const { error } = await supabase.from('community_posts').insert({
      author_id: user.id,
      title: '',
      content: content.trim(),
      audience,
      image_url: imageUrl,
      media_urls: imageUrl ? [imageUrl] : [],
      client_request_id: crypto.randomUUID(),
    });
    if (error) throw new Error(error.message);
    return 'Publication créée';
  };

  return (
    <div>
      {preview ? <img className="lkdv-create-preview" src={preview} alt="" /> : null}
      <Field label="Photo"><input type="file" accept="image/*" onChange={(event) => setFile(event.target.files?.[0] ?? null)} /></Field>
      <Field label="Texte"><textarea value={content} onChange={(event) => setContent(event.target.value)} placeholder="Raconte ton moment terrain…" /></Field>
      <Field label="Audience">
        <select value={audience} onChange={(event) => setAudience(event.target.value)}>
          <option value="public">Tout le monde</option>
          <option value="abonnies">Mes abonnés</option>
        </select>
      </Field>
      <DrawerButton tone="primary" disabled={busy} onClick={() => onSubmit(submit)}>{busy ? 'Publication…' : 'Publier'}</DrawerButton>
    </div>
  );
}

function StoryForm({ busy, onSubmit }: { busy: boolean; onSubmit: (action: () => Promise<string>) => void }) {
  const { user } = useAuth();
  const [file, setFile] = useState<File | null>(null);
  const [caption, setCaption] = useState('');
  const [visibility, setVisibility] = useState('public');

  const submit = async () => {
    if (!user) throw new Error('Connexion requise');
    if (!file) throw new Error('Choisis une photo ou une vidéo');
    const supabase = createClient();
    const isVideo = file.type.startsWith('video/');
    const cleaned = isVideo ? file : await stripImageMetadata(file);
    const ext = file.name.split('.').pop() || (isVideo ? 'mp4' : 'jpg');
    const storyId = crypto.randomUUID();
    const path = `${user.id}/${storyId}/${Date.now()}.${ext}`;
    const { error: uploadError } = await supabase.storage.from('stories-private').upload(path, cleaned, {
      contentType: file.type || (isVideo ? 'video/mp4' : 'image/jpeg'),
      upsert: false,
    });
    if (uploadError) throw new Error(uploadError.message);
    const { error } = await supabase.from('post_stories').insert({
      id: storyId,
      author_id: user.id,
      image_url: null,
      storage_bucket: 'stories-private',
      storage_path: path,
      media_type: isVideo ? 'video' : 'image',
      mime_type: file.type || undefined,
      status: 'ready',
      client_request_id: crypto.randomUUID(),
      caption: caption.trim() || null,
      visibility,
    });
    if (error) throw new Error(error.message);
    return 'Story publiée';
  };

  return (
    <div>
      <Field label="Média"><input type="file" accept="image/*,video/*" onChange={(event) => setFile(event.target.files?.[0] ?? null)} /></Field>
      <Field label="Légende"><input value={caption} onChange={(event) => setCaption(event.target.value)} maxLength={280} placeholder="Un mot sur ce moment…" /></Field>
      <Field label="Visibilité">
        <select value={visibility} onChange={(event) => setVisibility(event.target.value)}>
          <option value="public">Tout le monde</option>
          <option value="followers">Mes abonnés</option>
          <option value="close_friends">Mes proches</option>
          <option value="only_me">Moi uniquement</option>
        </select>
      </Field>
      <DrawerButton tone="primary" disabled={busy} onClick={() => onSubmit(submit)}>{busy ? 'Publication…' : 'Publier la story'}</DrawerButton>
    </div>
  );
}

function CarnetForm({ busy, onSubmit }: { busy: boolean; onSubmit: (action: () => Promise<string>) => void }) {
  const { user } = useAuth();
  const [title, setTitle] = useState('');
  const [destination, setDestination] = useState('');
  const [description, setDescription] = useState('');
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [visibility, setVisibility] = useState('public');

  const submit = async () => {
    if (!user) throw new Error('Connexion requise');
    if (!title.trim()) throw new Error('Donne un titre à ton carnet');
    if (!destination.trim()) throw new Error('Indique une destination');
    const supabase = createClient();
    const { error } = await supabase.from('carnets').insert({
      author_id: user.id,
      title: title.trim(),
      destination: destination.trim(),
      description: description.trim() || null,
      start_date: start || null,
      end_date: end || null,
      visibility,
      cover_image: null,
      is_collaborative: false,
    });
    if (error) throw new Error(error.message);
    return 'Carnet créé';
  };

  return (
    <div>
      <Field label="Titre"><input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Traversée du Vercors" /></Field>
      <Field label="Destination"><input value={destination} onChange={(event) => setDestination(event.target.value)} placeholder="Vercors, France" /></Field>
      <Field label="Récit"><textarea value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Le fil de l’aventure…" /></Field>
      <div className="lkdv-create-row">
        <Field label="Début"><input type="date" value={start} onChange={(event) => setStart(event.target.value)} /></Field>
        <Field label="Fin"><input type="date" value={end} onChange={(event) => setEnd(event.target.value)} /></Field>
      </div>
      <Field label="Visibilité">
        <select value={visibility} onChange={(event) => setVisibility(event.target.value)}>
          <option value="public">Public</option>
          <option value="private">Privé</option>
        </select>
      </Field>
      <DrawerButton tone="primary" disabled={busy} onClick={() => onSubmit(submit)}>{busy ? 'Création…' : 'Créer le carnet'}</DrawerButton>
    </div>
  );
}

function KitForm({ busy, onSubmit }: { busy: boolean; onSubmit: (action: () => Promise<string>) => void }) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [season, setSeason] = useState('toute_saison');
  const [isPublic, setIsPublic] = useState(false);

  const submit = async () => {
    if (!name.trim()) throw new Error('Donne un nom à ton kit');
    const response = await fetch('/api/materiel/kits', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: name.trim(), description: description.trim() || null, season, is_public: isPublic, items: [] }),
    });
    if (!response.ok) {
      const payload = await response.json().catch(() => null);
      throw new Error(payload?.error || 'Création impossible');
    }
    return 'Kit créé';
  };

  return (
    <div>
      <Field label="Nom"><input value={name} onChange={(event) => setName(event.target.value)} placeholder="Ultralight automne" /></Field>
      <Field label="Description"><textarea value={description} onChange={(event) => setDescription(event.target.value)} placeholder="À quoi sert ce kit ?" /></Field>
      <Field label="Saison">
        <select value={season} onChange={(event) => setSeason(event.target.value)}>
          <option value="toute_saison">Toute saison</option>
          <option value="printemps">Printemps</option>
          <option value="ete">Été</option>
          <option value="automne">Automne</option>
          <option value="hiver">Hiver</option>
        </select>
      </Field>
      <label className="lkdv-create-check"><input type="checkbox" checked={isPublic} onChange={(event) => setIsPublic(event.target.checked)} /> Kit public</label>
      <DrawerButton tone="primary" disabled={busy} onClick={() => onSubmit(submit)}>{busy ? 'Création…' : 'Créer le kit'}</DrawerButton>
    </div>
  );
}

function ClubForm({ busy, onSubmit }: { busy: boolean; onSubmit: (action: () => Promise<string>) => void }) {
  const { user } = useAuth();
  const [name, setName] = useState('');
  const [category, setCategory] = useState('Randonnée');
  const [description, setDescription] = useState('');
  const [privacy, setPrivacy] = useState('open');

  const submit = async () => {
    if (!user) throw new Error('Connexion requise');
    if (!name.trim()) throw new Error('Donne un nom à ton club');
    const supabase = createClient();
    const slug = `${slugify(name)}-${Date.now().toString(36)}`;
    const { data, error } = await supabase.from('clubs').insert({
      name: name.trim(),
      type: 'activite',
      emoji: '🥾',
      description: description.trim(),
      category,
      rules: '',
      privacy,
      cover_color: 'from-[var(--lkv-forest-600)] to-[var(--lkv-primary)]',
      created_by: user.id,
      slug,
      members_count: 1,
      active_this_month: 0,
    }).select('id').single();
    if (error || !data) throw new Error(error?.message || 'Création impossible');
    const { error: memberError } = await supabase.from('club_members').insert({
      club_id: data.id,
      user_id: user.id,
      role: 'admin',
      status: 'active',
    });
    if (memberError) throw new Error(memberError.message);
    return 'Club créé';
  };

  return (
    <div>
      <Field label="Nom"><input value={name} onChange={(event) => setName(event.target.value)} placeholder="Randonnée Alpine" /></Field>
      <Field label="Catégorie"><input value={category} onChange={(event) => setCategory(event.target.value)} /></Field>
      <Field label="Description"><textarea value={description} onChange={(event) => setDescription(event.target.value)} placeholder="L’esprit du club…" /></Field>
      <Field label="Confidentialité">
        <select value={privacy} onChange={(event) => setPrivacy(event.target.value)}>
          <option value="open">Ouvert</option>
          <option value="request">Sur demande</option>
          <option value="private">Privé</option>
        </select>
      </Field>
      <DrawerButton tone="primary" disabled={busy} onClick={() => onSubmit(submit)}>{busy ? 'Création…' : 'Créer le club'}</DrawerButton>
    </div>
  );
}

function TripForm({ busy, onSubmit }: { busy: boolean; onSubmit: (action: () => Promise<string>) => void }) {
  const { user } = useAuth();
  const [title, setTitle] = useState('');
  const [destination, setDestination] = useState('');
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [visibility, setVisibility] = useState('private');

  const submit = async () => {
    if (!user) throw new Error('Connexion requise');
    if (!title.trim()) throw new Error('Donne un titre à ton voyage');
    const supabase = createClient();
    const slug = `${slugify(title)}-${Date.now().toString(36)}`;
    const { error } = await supabase.from('trips').insert({
      user_id: user.id,
      title: title.trim(),
      slug,
      destination_name: destination.trim() || null,
      start_date: start || null,
      end_date: end || null,
      visibility,
      status: 'draft',
    });
    if (error) throw new Error(error.message);
    return 'Voyage créé';
  };

  return (
    <div>
      <Field label="Titre"><input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Tour du Mont-Blanc" /></Field>
      <Field label="Destination"><input value={destination} onChange={(event) => setDestination(event.target.value)} placeholder="Chamonix, France" /></Field>
      <div className="lkdv-create-row">
        <Field label="Début"><input type="date" value={start} onChange={(event) => setStart(event.target.value)} /></Field>
        <Field label="Fin"><input type="date" value={end} onChange={(event) => setEnd(event.target.value)} /></Field>
      </div>
      <Field label="Visibilité">
        <select value={visibility} onChange={(event) => setVisibility(event.target.value)}>
          <option value="private">Privé</option>
          <option value="unlisted">Non listé</option>
          <option value="public">Public</option>
        </select>
      </Field>
      <DrawerButton tone="primary" disabled={busy} onClick={() => onSubmit(submit)}>{busy ? 'Création…' : 'Créer le voyage'}</DrawerButton>
      <p className="lkdv-create-note">Tu pourras ouvrir le Compas ensuite pour construire l’itinéraire.</p>
    </div>
  );
}

export default CreateDrawer;
