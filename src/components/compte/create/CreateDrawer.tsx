'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { BookOpen, Camera, ChevronLeft, Image as ImageIcon, Map, Mountain, Users } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { stripImageMetadata } from '@/lib/media/stripImageMetadata';
import { DrawerToggle, OverlaySheet } from '../overlay/OverlaySheet';
import { CreateActions, CreateField, CreateInput, CreateMediaSlot, CreateProgress, CreateSelect, CreateTextarea } from './ui';
import './create-drawer.css';

type CreateType = 'post' | 'story' | 'carnet' | 'kit' | 'club' | 'trip';

/**
 * Catalogue : nom + icône seulement. Le sous-titre est retiré (il encombrait),
 * la tuile entière est cliquable et le type choisi porte un liseré 2 px.
 */
const CATALOG: Array<{ id: CreateType; title: string; icon: React.ReactNode }> = [
  { id: 'post', title: 'Publication', icon: <ImageIcon size={20} /> },
  { id: 'story', title: 'Story', icon: <Camera size={20} /> },
  { id: 'carnet', title: 'Carnet', icon: <BookOpen size={20} /> },
  { id: 'kit', title: 'Kit', icon: <Mountain size={20} /> },
  { id: 'club', title: 'Club', icon: <Users size={20} /> },
  { id: 'trip', title: 'Voyage', icon: <Map size={20} /> },
];

/** Étapes des formulaires à plusieurs écrans. Un seul indicateur, sans texte. */
const STEPS: Partial<Record<CreateType, number>> = { carnet: 3 };

const typeTitle = (type: CreateType) => CATALOG.find((item) => item.id === type)?.title ?? 'Créer';

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
  const [lastType, setLastType] = useState<CreateType | null>(
    CATALOG.some((item) => item.id === initialType) ? (initialType as CreateType) : null
  );
  const [step, setStep] = useState(0);
  const [direction, setDirection] = useState<'forward' | 'back'>('forward');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const totalSteps = type ? STEPS[type] ?? 1 : 1;

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

  const pickType = (next: CreateType) => {
    setType(next);
    setLastType(next);
    setStep(0);
    setError(null);
    setDirection('forward');
  };

  const goBack = () => {
    setError(null);
    if (step > 0) {
      setStep(step - 1);
    } else {
      setType(null);
    }
    setDirection('back');
  };

  const goStep = (next: number) => {
    setError(null);
    setStep(next);
    setDirection(next > step ? 'forward' : 'back');
  };

  return (
    <OverlaySheet
      title={type ? typeTitle(type) : 'Créer'}
      onClose={onClose}
      className="lkdv-create-drawer"
      heading={
        type ? (
          <div className="lkdv-cd-head">
            <button
              type="button"
              className="lkdv-cd-back"
              aria-label={step > 0 ? 'Étape précédente' : 'Tous les types de création'}
              onClick={goBack}
            >
              <ChevronLeft size={24} aria-hidden="true" />
            </button>
          </div>
        ) : (
          <span />
        )
      }
    >
      {success ? (
        <div className="lkdv-overlay-empty"><b>{success}</b><p>La création est enregistrée dans ton profil.</p></div>
      ) : !user ? (
        <div className="lkdv-overlay-empty"><b>Connecte-toi pour créer</b><p>Ton compte te permet de publier et partager.</p></div>
      ) : !type ? (
        <div className="lkdv-cd-step" data-dir={direction}>
          <div className="lkdv-cd-catalog" role="group" aria-label="Types de création">
            {CATALOG.map((item) => (
              <button
                key={item.id}
                type="button"
                className="lkdv-cd-tile"
                aria-current={item.id === lastType ? 'true' : undefined}
                aria-label={item.title}
                onClick={() => pickType(item.id)}
              >
                <span className="lkdv-cd-tile-icon" aria-hidden="true">{item.icon}</span>
                <span className="lkdv-cd-tile-name">{item.title}</span>
              </button>
            ))}
          </div>
        </div>
      ) : (
        <>
          {totalSteps > 1 ? (
            <CreateProgress step={step} total={totalSteps} label={`Étape ${step + 1} sur ${totalSteps}`} />
          ) : null}
          {error ? <p className="lkdv-cd-alert" role="alert">{error}</p> : null}
          {type === 'post' ? (
            <PostForm busy={busy} direction={direction} onSubmit={(action) => void run(action)} onCancel={onClose} />
          ) : null}
          {type === 'story' ? (
            <StoryForm busy={busy} direction={direction} onSubmit={(action) => void run(action)} onCancel={onClose} />
          ) : null}
          {type === 'carnet' ? (
            <CarnetForm
              busy={busy}
              step={step}
              direction={direction}
              goStep={goStep}
              onSubmit={(action) => void run(action)}
              onCancel={onClose}
            />
          ) : null}
          {type === 'kit' ? (
            <KitForm busy={busy} direction={direction} onSubmit={(action) => void run(action)} onCancel={onClose} />
          ) : null}
          {type === 'club' ? (
            <ClubForm busy={busy} direction={direction} onSubmit={(action) => void run(action)} onCancel={onClose} />
          ) : null}
          {type === 'trip' ? (
            <TripForm busy={busy} direction={direction} onSubmit={(action) => void run(action)} onCancel={onClose} />
          ) : null}
        </>
      )}
    </OverlaySheet>
  );
}

interface FormProps {
  busy: boolean;
  direction: 'forward' | 'back';
  onSubmit: (action: () => Promise<string>) => void;
  onCancel: () => void;
}

function PostForm({ busy, direction, onSubmit, onCancel }: FormProps) {
  const { user } = useAuth();
  const [content, setContent] = useState('');
  const [audience, setAudience] = useState('public');
  const [file, setFile] = useState<File | null>(null);
  const canSubmit = Boolean(content.trim() || file);

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
    <div className="lkdv-cd-step lkdv-cd-form" data-dir={direction}>
      <div className="lkdv-cd-group">
        <CreateMediaSlot label="Ajouter une photo" accept="image/*" file={file} onChange={setFile} disabled={busy} />
        <CreateTextarea
          label="Texte"
          value={content}
          onChange={setContent}
          placeholder="Raconte ton moment terrain…"
          disabled={busy}
        />
      </div>
      <div className="lkdv-cd-group">
        <CreateSelect
          label="Audience"
          value={audience}
          onChange={setAudience}
          disabled={busy}
          options={[
            { value: 'public', label: 'Tout le monde' },
            { value: 'abonnies', label: 'Mes abonnés' },
          ]}
        />
      </div>
      <CreateActions
        primaryLabel={busy ? 'Publication…' : 'Publier'}
        onPrimary={() => onSubmit(submit)}
        primaryDisabled={busy || !canSubmit}
        secondaryLabel="Annuler"
        onSecondary={onCancel}
      />
    </div>
  );
}

function StoryForm({ busy, direction, onSubmit, onCancel }: FormProps) {
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
    <div className="lkdv-cd-step lkdv-cd-form" data-dir={direction}>
      <div className="lkdv-cd-group">
        <CreateMediaSlot label="Ajouter une photo ou une vidéo" accept="image/*,video/*" file={file} onChange={setFile} disabled={busy} />
        <CreateInput
          label="Légende"
          value={caption}
          maxLength={280}
          placeholder="Un mot sur ce moment…"
          disabled={busy}
          onChange={(event) => setCaption(event.target.value)}
        />
      </div>
      <div className="lkdv-cd-group">
        <CreateSelect
          label="Visibilité"
          value={visibility}
          onChange={setVisibility}
          disabled={busy}
          options={[
            { value: 'public', label: 'Tout le monde' },
            { value: 'followers', label: 'Mes abonnés' },
            { value: 'close_friends', label: 'Mes proches' },
            { value: 'only_me', label: 'Moi uniquement' },
          ]}
        />
      </div>
      <CreateActions
        primaryLabel={busy ? 'Publication…' : 'Publier la story'}
        onPrimary={() => onSubmit(submit)}
        primaryDisabled={busy || !file}
        secondaryLabel="Annuler"
        onSecondary={onCancel}
      />
    </div>
  );
}

function CarnetForm({
  busy,
  direction,
  step,
  goStep,
  onSubmit,
  onCancel,
}: {
  busy: boolean;
  direction: 'forward' | 'back';
  step: number;
  goStep: (step: number) => void;
  onSubmit: (action: () => Promise<string>) => void;
  onCancel: () => void;
}) {
  const { user } = useAuth();
  const [title, setTitle] = useState('');
  const [destination, setDestination] = useState('');
  const [description, setDescription] = useState('');
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [visibility, setVisibility] = useState('public');
  const [cover, setCover] = useState<File | null>(null);
  const [touched, setTouched] = useState<{ title: boolean; destination: boolean }>({ title: false, destination: false });

  const titleOk = title.trim().length > 0;
  const destinationOk = destination.trim().length > 0;
  const infosOk = titleOk && destinationOk;

  const titleError = touched.title && !titleOk ? 'Titre requis' : null;
  const destinationError = touched.destination && !destinationOk ? 'Destination requise' : null;

  const submit = async () => {
    if (!user) throw new Error('Connexion requise');
    if (!titleOk) throw new Error('Donne un titre à ton carnet');
    if (!destinationOk) throw new Error('Indique une destination');
    const supabase = createClient();
    let coverUrl: string | null = null;
    if (cover) {
      const cleaned = await stripImageMetadata(cover);
      const ext = cleaned.type === 'image/png' ? 'png' : 'jpg';
      const path = `carnet-covers/${user.id}/${crypto.randomUUID()}.${ext}`;
      const { error: uploadError } = await supabase.storage.from('carnet-media').upload(path, cleaned, {
        contentType: cleaned.type || 'image/jpeg',
        upsert: false,
      });
      if (uploadError) throw new Error(uploadError.message);
      coverUrl = supabase.storage.from('carnet-media').getPublicUrl(path).data.publicUrl;
    }
    const { error } = await supabase.from('carnets').insert({
      author_id: user.id,
      title: title.trim(),
      destination: destination.trim(),
      description: description.trim() || null,
      start_date: start || null,
      end_date: end || null,
      visibility,
      cover_image: coverUrl,
      is_collaborative: false,
    });
    if (error) throw new Error(error.message);
    return 'Carnet créé';
  };

  if (step === 0) {
    return (
      <div className="lkdv-cd-step lkdv-cd-form" data-dir={direction} key="carnet-infos">
        <div className="lkdv-cd-group">
          <CreateField error={titleError}>
            <CreateInput
              label="Titre"
              value={title}
              placeholder="Traversée du Vercors"
              disabled={busy}
              onChange={(event) => setTitle(event.target.value)}
              onBlur={() => setTouched((state) => ({ ...state, title: true }))}
            />
          </CreateField>
          <CreateField error={destinationError}>
            <CreateInput
              label="Destination"
              value={destination}
              placeholder="Vercors, France"
              disabled={busy}
              onChange={(event) => setDestination(event.target.value)}
              onBlur={() => setTouched((state) => ({ ...state, destination: true }))}
            />
          </CreateField>
          <CreateTextarea
            label="Récit"
            value={description}
            onChange={setDescription}
            placeholder="Le fil de l’aventure…"
            disabled={busy}
          />
        </div>
        <div className="lkdv-cd-group">
          <div className="lkdv-cd-row">
            <CreateInput label="Début" type="date" value={start} disabled={busy} onChange={(event) => setStart(event.target.value)} />
            <CreateInput label="Fin" type="date" value={end} disabled={busy} onChange={(event) => setEnd(event.target.value)} />
          </div>
        </div>
        <CreateActions
          primaryLabel="Continuer"
          onPrimary={() => {
            setTouched({ title: true, destination: true });
            if (infosOk) goStep(1);
          }}
          primaryDisabled={busy || !infosOk}
          secondaryLabel="Annuler"
          onSecondary={onCancel}
        />
      </div>
    );
  }

  if (step === 1) {
    return (
      <div className="lkdv-cd-step lkdv-cd-form" data-dir={direction} key="carnet-photos">
        <CreateMediaSlot label="Ajouter une photo de couverture" accept="image/*" file={cover} onChange={setCover} disabled={busy} />
        <CreateActions primaryLabel="Continuer" onPrimary={() => goStep(2)} primaryDisabled={busy} secondaryLabel="Annuler" onSecondary={onCancel} />
      </div>
    );
  }

  return (
    <div className="lkdv-cd-step lkdv-cd-form" data-dir={direction} key="carnet-publication">
      <CreateSelect
        label="Visibilité"
        value={visibility}
        onChange={setVisibility}
        disabled={busy}
        options={[
          { value: 'public', label: 'Public' },
          { value: 'private', label: 'Privé' },
        ]}
      />
      <CreateActions
        primaryLabel={busy ? 'Création…' : 'Créer le carnet'}
        onPrimary={() => onSubmit(submit)}
        primaryDisabled={busy || !infosOk}
        secondaryLabel="Annuler"
        onSecondary={onCancel}
      />
    </div>
  );
}

function KitForm({ busy, direction, onSubmit, onCancel }: FormProps) {
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
    <div className="lkdv-cd-step lkdv-cd-form" data-dir={direction}>
      <div className="lkdv-cd-group">
        <CreateInput
          label="Nom"
          value={name}
          placeholder="Ultralight automne"
          disabled={busy}
          onChange={(event) => setName(event.target.value)}
        />
        <CreateTextarea
          label="Description"
          value={description}
          onChange={setDescription}
          placeholder="À quoi sert ce kit ?"
          disabled={busy}
        />
      </div>
      <div className="lkdv-cd-group">
        <CreateSelect
          label="Saison"
          value={season}
          onChange={setSeason}
          disabled={busy}
          options={[
            { value: 'toute_saison', label: 'Toute saison' },
            { value: 'printemps', label: 'Printemps' },
            { value: 'ete', label: 'Été' },
            { value: 'automne', label: 'Automne' },
            { value: 'hiver', label: 'Hiver' },
          ]}
        />
        <div className="lkdv-cd-switch-row">
          <span className="lkdv-cd-switch-label" aria-hidden="true">Public</span>
          <DrawerToggle checked={isPublic} onChange={setIsPublic} label="Kit public" />
        </div>
      </div>
      <CreateActions
        primaryLabel={busy ? 'Création…' : 'Créer le kit'}
        onPrimary={() => onSubmit(submit)}
        primaryDisabled={busy || !name.trim()}
        secondaryLabel="Annuler"
        onSecondary={onCancel}
      />
    </div>
  );
}

function ClubForm({ busy, direction, onSubmit, onCancel }: FormProps) {
  const { user } = useAuth();
  const [name, setName] = useState('');
  const [category, setCategory] = useState('');
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
      category: category.trim() || 'Randonnée',
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
    <div className="lkdv-cd-step lkdv-cd-form" data-dir={direction}>
      <div className="lkdv-cd-group">
        <CreateInput
          label="Nom"
          value={name}
          placeholder="Randonnée Alpine"
          disabled={busy}
          onChange={(event) => setName(event.target.value)}
        />
        <CreateInput
          label="Catégorie"
          value={category}
          placeholder="Randonnée"
          disabled={busy}
          onChange={(event) => setCategory(event.target.value)}
        />
        <CreateTextarea
          label="Description"
          value={description}
          onChange={setDescription}
          placeholder="L’esprit du club…"
          disabled={busy}
        />
      </div>
      <div className="lkdv-cd-group">
        <CreateSelect
          label="Confidentialité"
          value={privacy}
          onChange={setPrivacy}
          disabled={busy}
          options={[
            { value: 'open', label: 'Ouvert' },
            { value: 'request', label: 'Sur demande' },
            { value: 'private', label: 'Privé' },
          ]}
        />
      </div>
      <CreateActions
        primaryLabel={busy ? 'Création…' : 'Créer le club'}
        onPrimary={() => onSubmit(submit)}
        primaryDisabled={busy || !name.trim()}
        secondaryLabel="Annuler"
        onSecondary={onCancel}
      />
    </div>
  );
}

function TripForm({ busy, direction, onSubmit, onCancel }: FormProps) {
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
    <div className="lkdv-cd-step lkdv-cd-form" data-dir={direction}>
      <div className="lkdv-cd-group">
        <CreateInput
          label="Titre"
          value={title}
          placeholder="Tour du Mont-Blanc"
          disabled={busy}
          onChange={(event) => setTitle(event.target.value)}
        />
        <CreateInput
          label="Destination"
          value={destination}
          placeholder="Chamonix, France"
          disabled={busy}
          onChange={(event) => setDestination(event.target.value)}
        />
      </div>
      <div className="lkdv-cd-group">
        <div className="lkdv-cd-row">
          <CreateInput label="Début" type="date" value={start} disabled={busy} onChange={(event) => setStart(event.target.value)} />
          <CreateInput label="Fin" type="date" value={end} disabled={busy} onChange={(event) => setEnd(event.target.value)} />
        </div>
      </div>
      <div className="lkdv-cd-group">
        <CreateSelect
          label="Visibilité"
          value={visibility}
          onChange={setVisibility}
          disabled={busy}
          options={[
            { value: 'private', label: 'Privé' },
            { value: 'unlisted', label: 'Non listé' },
            { value: 'public', label: 'Public' },
          ]}
        />
      </div>
      <CreateActions
        primaryLabel={busy ? 'Création…' : 'Créer le voyage'}
        onPrimary={() => onSubmit(submit)}
        primaryDisabled={busy || !title.trim()}
        secondaryLabel="Annuler"
        onSecondary={onCancel}
      />
    </div>
  );
}

export default CreateDrawer;
