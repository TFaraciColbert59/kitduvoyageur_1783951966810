'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Camera, Check, Link2, Plus, RotateCcw, Sparkles, Trash2, X } from 'lucide-react';
import type { ProfileLink, ProfileSettings } from '@/features/compte/server/compte';
import { ActionPill } from '@/components/ui/ActionPill';
import { DrawerError, DrawerSkeleton } from '../shell/DrawerShell';
import { fetchJson, initials } from './shared';
import { createClient } from '@/lib/supabase/client';

interface FormState {
  name: string;
  handle: string;
  bio: string;
  location: string;
  avatarUrl: string;
  coverUrl: string;
  links: ProfileLink[];
  visibility: 'public' | 'prive';
}

function toForm(profile: ProfileSettings): FormState {
  return {
    name: profile.name,
    handle: profile.handle,
    bio: profile.bio,
    location: profile.location,
    avatarUrl: profile.avatarUrl ?? '',
    coverUrl: profile.coverUrl ?? '',
    links: profile.links.length > 0 ? profile.links : [],
    visibility: profile.visibility,
  };
}

function completeness(form: FormState): { percent: number; missing: string[] } {
  const checks: Array<{ label: string; ok: boolean }> = [
    { label: 'Ajouter une photo de profil', ok: Boolean(form.avatarUrl.trim()) },
    { label: 'Renseigner ton nom', ok: Boolean(form.name.trim()) },
    { label: 'Choisir un handle', ok: Boolean(form.handle.trim()) },
    { label: 'Écrire une bio', ok: Boolean(form.bio.trim()) },
    { label: 'Indiquer ton massif', ok: Boolean(form.location.trim()) },
    { label: 'Ajouter une photo de couverture', ok: Boolean(form.coverUrl.trim()) },
    { label: 'Ajouter un lien', ok: form.links.some((link) => link.url.trim()) },
  ];
  const done = checks.filter((check) => check.ok).length;
  return {
    percent: Math.round((done / checks.length) * 100),
    missing: checks.filter((check) => !check.ok).map((check) => check.label).slice(0, 3),
  };
}

export function EditProfilePane() {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<FormState | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ text: string; tone: 'ok' | 'error' } | null>(null);

  const query = useQuery({
    queryKey: ['compte', 'profile'],
    queryFn: () => fetchJson<ProfileSettings>('/api/compte/compte/profile'),
    staleTime: 20_000,
  });

  useEffect(() => {
    if (query.data) setForm(toForm(query.data));
  }, [query.data]);

  const stats = useMemo(() => (form ? completeness(form) : { percent: 0, missing: [] }), [form]);

  if (query.isLoading) return <DrawerSkeleton />;
  if (query.isError || !query.data || !form) {
    return <DrawerError onRetry={() => void query.refetch()} />;
  }

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((current) => (current ? { ...current, [key]: value } : current));
  };

  const uploadPhoto = async (file: File | undefined, key: 'avatarUrl' | 'coverUrl') => {
    if (!file || !query.data) return;
    setBusy(true);
    setMessage(null);
    try {
      const extension = (file.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg';
      const path = `profiles/${query.data.id}/${key === 'avatarUrl' ? 'avatar' : 'cover'}-${Date.now()}.${extension}`;
      const supabase = createClient();
      const { error } = await supabase.storage.from('carnet-media').upload(path, file, {
        cacheControl: '3600',
        upsert: true,
        contentType: file.type || 'image/jpeg',
      });
      if (error) throw error;
      const { data: publicUrl } = supabase.storage.from('carnet-media').getPublicUrl(path);
      set(key, publicUrl.publicUrl);
      setMessage({ text: 'Photo prête, enregistre ton profil.', tone: 'ok' });
    } catch (error) {
      setMessage({ text: error instanceof Error ? error.message : 'Envoi de la photo impossible', tone: 'error' });
    } finally {
      setBusy(false);
    }
  };

  const reset = () => {
    if (query.data) setForm(toForm(query.data));
    setMessage(null);
  };

  const save = async () => {
    setBusy(true);
    setMessage(null);
    try {
      const updated = await fetchJson<ProfileSettings>('/api/compte/compte/profile', {
        method: 'PATCH',
        body: JSON.stringify({
          name: form.name,
          handle: form.handle,
          bio: form.bio,
          location: form.location,
          avatarUrl: form.avatarUrl || null,
          coverUrl: form.coverUrl || null,
          links: form.links.filter((link) => link.url.trim()),
          visibility: form.visibility,
        }),
      });
      queryClient.setQueryData(['compte', 'profile'], updated);
      setForm(toForm(updated));
      setMessage({ text: 'Profil enregistré', tone: 'ok' });
    } catch (error) {
      setMessage({ text: error instanceof Error ? error.message : 'Enregistrement impossible', tone: 'error' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="lkdv-compte-pane lkdv-compte-edit">
      <section className={`lkdv-compte-edit-hero${form.coverUrl ? ' has-cover' : ''}`}>
        {form.coverUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img className="lkdv-compte-edit-cover" src={form.coverUrl} alt="" loading="lazy" />
        ) : null}
        <div className="lkdv-compte-edit-hero-tools">
          <PhotoPill label={form.coverUrl ? 'Changer la couverture' : 'Choisir une couverture'} disabled={busy} onFile={(file) => void uploadPhoto(file, 'coverUrl')} />
          {form.coverUrl ? <ActionPill label="Retirer la couverture" icon={<X />} onClick={() => set('coverUrl', '')} /> : null}
        </div>
        <div className="lkdv-compte-edit-preview">
          <div className="lkdv-compte-edit-avatar">
            {form.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={form.avatarUrl} alt="" loading="lazy" />
            ) : (
              <span aria-hidden="true">{initials(form.name || 'LKDV')}</span>
            )}
            <PhotoPill
              small
              label={form.avatarUrl ? 'Changer la photo' : 'Choisir une photo'}
              disabled={busy}
              onFile={(file) => void uploadPhoto(file, 'avatarUrl')}
            />
          </div>
          <div>
            <b>{form.name || 'Ton nom'}</b>
            <small>@{form.handle || 'handle'}</small>
            {form.location ? <span>{form.location}</span> : null}
          </div>
          <div className="lkdv-compte-ring" aria-label={`Profil complété à ${stats.percent} %`}>
            <svg viewBox="0 0 36 36" aria-hidden="true">
              <circle cx="18" cy="18" r="15" fill="none" stroke="rgba(23,43,36,.1)" strokeWidth="3" />
              <circle
                cx="18"
                cy="18"
                r="15"
                fill="none"
                stroke="#3D7A52"
                strokeWidth="3"
                strokeLinecap="round"
                strokeDasharray={`${(stats.percent / 100) * 94.2} 94.2`}
                transform="rotate(-90 18 18)"
              />
            </svg>
            <b>{stats.percent}%</b>
          </div>
        </div>
        {form.avatarUrl ? (
          <ActionPill className="lkdv-compte-edit-avatar-clear" label="Retirer la photo" icon={<X />} onClick={() => set('avatarUrl', '')} />
        ) : null}
      </section>

      {stats.missing.length > 0 ? (
        <section className="lkdv-compte-suggestions">
          <b>
            <Sparkles size={14} aria-hidden="true" /> Complète ton profil
          </b>
          <ul>
            {stats.missing.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="lkdv-compte-form">
        <label>
          <span>Nom affiché</span>
          <input value={form.name} onChange={(event) => set('name', event.target.value)} maxLength={80} />
        </label>
        <label>
          <span>Handle</span>
          <div className="lkdv-compte-prefix">
            <span aria-hidden="true">@</span>
            <input
              value={form.handle}
              onChange={(event) => set('handle', event.target.value.replace(/[^a-zA-Z0-9_]/g, ''))}
              maxLength={24}
              placeholder="ton_handle"
            />
          </div>
        </label>
        <label>
          <span>Bio · {form.bio.length}/160</span>
          <textarea
            value={form.bio}
            onChange={(event) => set('bio', event.target.value)}
            maxLength={160}
            rows={3}
            placeholder="Ton massif, ton style de sortie, ce que tu cherches…"
          />
        </label>
        <label>
          <span>Massif / région</span>
          <input value={form.location} onChange={(event) => set('location', event.target.value)} maxLength={80} />
        </label>
        <label>
          <span>Visibilité</span>
          <select value={form.visibility} onChange={(event) => set('visibility', event.target.value as 'public' | 'prive')}>
            <option value="public">Public</option>
            <option value="prive">Privé (sur invitation)</option>
          </select>
        </label>

        <div className="lkdv-compte-links">
          <div className="lkdv-compte-links-head">
            <span>Liens · {form.links.length}/3</span>
            {form.links.length < 3 ? (
              <button
                type="button"
                className="lkdv-compte-link"
                onClick={() => set('links', [...form.links, { label: '', url: '' }])}
              >
                <Plus size={13} aria-hidden="true" /> Ajouter
              </button>
            ) : null}
          </div>
          {form.links.length === 0 ? (
            <p className="lkdv-compte-empty-line">
              <Link2 size={13} aria-hidden="true" /> Aucun lien : ajoute ton carnet, ton club ou ton site.
            </p>
          ) : (
            form.links.map((link, index) => (
              <div key={index} className="lkdv-compte-link-row">
                <input
                  value={link.label}
                  onChange={(event) => {
                    const next = [...form.links];
                    next[index] = { ...next[index], label: event.target.value };
                    set('links', next);
                  }}
                  placeholder="Libellé"
                  maxLength={40}
                  aria-label={`Libellé du lien ${index + 1}`}
                />
                <input
                  value={link.url}
                  onChange={(event) => {
                    const next = [...form.links];
                    next[index] = { ...next[index], url: event.target.value };
                    set('links', next);
                  }}
                  placeholder="https://…"
                  maxLength={300}
                  aria-label={`URL du lien ${index + 1}`}
                />
                <button
                  type="button"
                  className="lkdv-compte-link-remove"
                  onClick={() => set('links', form.links.filter((_, position) => position !== index))}
                  aria-label={`Supprimer le lien ${index + 1}`}
                >
                  <Trash2 size={14} aria-hidden="true" />
                </button>
              </div>
            ))
          )}
        </div>
      </section>

      {message ? (
        <p className={`lkdv-compte-inline-status ${message.tone}`} role="status">
          {message.text}
        </p>
      ) : null}

      <div className="lkdv-compte-savebar">
        <ActionPill label="Annuler" icon={<RotateCcw />} onClick={reset} disabled={busy} />
        <ActionPill
          tone="primary"
          label={busy ? 'Enregistrement en cours' : 'Enregistrer le profil'}
          icon={<Check />}
          busy={busy}
          onClick={() => void save()}
          disabled={!form.name.trim() || !form.handle.trim()}
        />
      </div>

    </div>
  );
}

/** Pilule appareil photo posée sur l'image : le champ fichier reste natif. */
function PhotoPill({ label, disabled, small = false, onFile }: { label: string; disabled?: boolean; small?: boolean; onFile: (file: File | undefined) => void }) {
  return (
    <label className={`lkdv-apill lkdv-compte-photo-pill${small ? ' is-small' : ''}`} aria-label={label} title={label} data-disabled={disabled || undefined}>
      <Camera aria-hidden="true" />
      <input type="file" accept="image/*" aria-label={label} disabled={disabled} onChange={(event) => onFile(event.target.files?.[0])} />
    </label>
  );
}

export default EditProfilePane;
