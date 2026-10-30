'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { Check, Image as ImageIcon, Layers, Plus, Trash2, Type, X } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { createClient } from '@/lib/supabase/client';
import { ActionPill } from '@/components/ui/ActionPill';
import { DrawerEmpty, DrawerError, DrawerShell, DrawerSkeleton, type DrawerTab } from '../shell/DrawerShell';
import './HighlightEditDrawer.css';

/** Évènement écouté par le Compte : relit les stories à la une après une modification. */
export const HIGHLIGHTS_CHANGED_EVENT = 'lkdv:highlights-changed';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const TITLE_MAX = 60;

interface StoryThumb {
  id: string;
  image: string;
  caption: string;
  isVideo: boolean;
}

interface HighlightState {
  id: string;
  title: string;
  coverStoryId: string | null;
  stories: StoryThumb[];
  available: StoryThumb[];
}

interface StoryRow {
  id: string;
  image_url: string | null;
  storage_path: string | null;
  media_type: string | null;
  caption: string | null;
}

function toThumb(row: StoryRow): StoryThumb {
  return {
    id: row.id,
    image: row.image_url || (row.storage_path ? `/api/stories/${row.id}/media` : ''),
    caption: row.caption || '',
    isVideo: row.media_type === 'video',
  };
}

function Thumb({ story }: { story: StoryThumb }) {
  return (
    <span className="lkdv-hl-thumb" aria-hidden="true">
      {story.image && !story.isVideo ? (
        // eslint-disable-next-line @next/next/no-img-element -- miniature de story distante
        <img src={story.image} alt="" loading="lazy" decoding="async" />
      ) : (
        <span className="lkdv-hl-thumb-empty">{story.isVideo ? '▶' : '○'}</span>
      )}
    </span>
  );
}

/**
 * Tiroir d'édition d'une story à la une (appui long sur la story).
 *
 * Même coquille que les autres tiroirs du Compte (`DrawerShell`, capsule à
 * icônes) : titre, couverture, stories de l'album. Les écritures passent par
 * `story_highlights` / `story_highlight_items`, protégées par la RLS du
 * propriétaire.
 */
export function HighlightEditDrawer({ hlId }: { hlId: string }) {
  const { user } = useAuth();
  const [tab, setTab] = useState(0);
  const [state, setState] = useState<'loading' | 'ready' | 'error' | 'unsupported'>('loading');
  const [data, setData] = useState<HighlightState | null>(null);
  const [title, setTitle] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ text: string; tone: 'ok' | 'error' } | null>(null);

  const load = useCallback(async () => {
    if (!UUID.test(hlId)) {
      setState('unsupported');
      return;
    }
    if (!user?.id) return;
    try {
      const supabase = createClient();
      const [{ data: hl, error: hlError }, { data: items }, { data: mine }] = await Promise.all([
        supabase.from('story_highlights').select('id,title,cover_story_id').eq('id', hlId).maybeSingle(),
        supabase.from('story_highlight_items').select('story_id,position').eq('highlight_id', hlId).order('position', { ascending: true }),
        supabase
          .from('post_stories')
          .select('id,image_url,storage_path,media_type,caption')
          .eq('author_id', user.id)
          .order('created_at', { ascending: false })
          .limit(80),
      ]);
      if (hlError || !hl) {
        setState('error');
        return;
      }
      const inAlbumIds = ((items ?? []) as Array<{ story_id: string }>).map((item) => item.story_id);
      const mineRows = (mine ?? []) as StoryRow[];
      const known = new Map(mineRows.map((row) => [row.id, row]));
      const missing = inAlbumIds.filter((id) => !known.has(id));
      if (missing.length > 0) {
        const { data: extra } = await supabase
          .from('post_stories')
          .select('id,image_url,storage_path,media_type,caption')
          .in('id', missing);
        for (const row of (extra ?? []) as StoryRow[]) known.set(row.id, row);
      }
      const stories = inAlbumIds.map((id) => known.get(id)).filter((row): row is StoryRow => Boolean(row)).map(toThumb);
      const inAlbum = new Set(inAlbumIds);
      setData({
        id: hl.id as string,
        title: (hl.title as string) || '',
        coverStoryId: (hl.cover_story_id as string | null) ?? null,
        stories,
        available: mineRows.filter((row) => !inAlbum.has(row.id)).map(toThumb),
      });
      setTitle((hl.title as string) || '');
      setState('ready');
    } catch {
      setState('error');
    }
  }, [hlId, user?.id]);

  useEffect(() => {
    void load();
  }, [load]);

  const changed = useCallback(() => {
    window.dispatchEvent(new CustomEvent(HIGHLIGHTS_CHANGED_EVENT));
  }, []);

  const run = useCallback(
    async (action: () => PromiseLike<{ error: { message?: string } | null }>, okText: string) => {
      setBusy(true);
      setMessage(null);
      try {
        const { error } = await action();
        if (error) throw new Error(error.message || 'échec');
        setMessage({ text: okText, tone: 'ok' });
        await load();
        changed();
      } catch {
        setMessage({ text: 'La modification a échoué. Réessaie.', tone: 'error' });
      } finally {
        setBusy(false);
      }
    },
    [changed, load],
  );

  const supabase = createClient();

  const saveTitle = () => {
    const next = title.trim().slice(0, TITLE_MAX);
    if (!next || !data) return;
    void run(() => supabase.from('story_highlights').update({ title: next }).eq('id', data.id), 'Titre enregistré.');
  };

  const setCover = (storyId: string) => {
    if (!data) return;
    void run(
      () => supabase.from('story_highlights').update({ cover_story_id: storyId }).eq('id', data.id),
      'Couverture modifiée.',
    );
  };

  const addStory = (storyId: string) => {
    if (!data) return;
    void run(
      () =>
        supabase
          .from('story_highlight_items')
          .insert({ highlight_id: data.id, story_id: storyId, position: data.stories.length }),
      'Story ajoutée.',
    );
  };

  const removeStory = (storyId: string) => {
    if (!data) return;
    void run(
      () => supabase.from('story_highlight_items').delete().eq('highlight_id', data.id).eq('story_id', storyId),
      'Story retirée.',
    );
  };

  const removeAlbum = async () => {
    if (!data || !window.confirm('Retirer cette sélection de tes stories à la une ?')) return;
    setBusy(true);
    const { error } = await supabase.from('story_highlights').delete().eq('id', data.id);
    setBusy(false);
    if (error) {
      setMessage({ text: 'La suppression a échoué. Réessaie.', tone: 'error' });
      return;
    }
    changed();
    (window as unknown as { __lkdvCompteAct?: (action: string) => void }).__lkdvCompteAct?.('closeSheet');
  };

  const status = message ? (
    <p className={`lkdv-hl-msg is-${message.tone}`} role={message.tone === 'error' ? 'alert' : 'status'}>
      {message.text}
    </p>
  ) : null;

  const tabs: DrawerTab[] = [
    {
      id: 'title',
      label: 'Titre',
      icon: <Type size={18} aria-hidden="true" />,
      render: () => (
        <div className="lkdv-hl-pane">
          <label className="lkdv-hl-field">
            <span>Titre de la sélection</span>
            <input
              value={title}
              maxLength={TITLE_MAX}
              onChange={(event) => setTitle(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') saveTitle();
              }}
              placeholder="Ex. Tour du Mont-Blanc"
              aria-label="Titre de la sélection"
            />
            <small>{title.trim().length}/{TITLE_MAX}</small>
          </label>
          <ActionPill
            tone="primary"
            text="Enregistrer"
            label="Enregistrer le titre"
            icon={<Check size={16} aria-hidden="true" />}
            busy={busy}
            disabled={!title.trim() || title.trim() === data?.title}
            onClick={saveTitle}
          />
          {status}
          <button type="button" className="lkdv-hl-danger" onClick={() => void removeAlbum()} disabled={busy}>
            <Trash2 size={15} aria-hidden="true" /> Retirer des stories à la une
          </button>
        </div>
      ),
    },
    {
      id: 'cover',
      label: 'Couverture',
      icon: <ImageIcon size={18} aria-hidden="true" />,
      render: () => (
        <div className="lkdv-hl-pane">
          <p className="lkdv-hl-hint">Choisis la story qui sert de couverture.</p>
          {data && data.stories.length > 0 ? (
            <div className="lkdv-hl-grid" role="listbox" aria-label="Couverture">
              {data.stories.map((story) => {
                const selected = (data.coverStoryId ?? data.stories[0]?.id) === story.id;
                return (
                  <button
                    key={story.id}
                    type="button"
                    role="option"
                    aria-selected={selected}
                    className={`lkdv-hl-cell${selected ? ' is-on' : ''}`}
                    onClick={() => setCover(story.id)}
                    disabled={busy}
                    aria-label={story.caption || 'Story'}
                  >
                    <Thumb story={story} />
                    {selected ? <Check size={14} className="lkdv-hl-check" aria-hidden="true" /> : null}
                  </button>
                );
              })}
            </div>
          ) : (
            <DrawerEmpty title="Aucune story" hint="Ajoute des stories pour choisir une couverture." />
          )}
          {status}
        </div>
      ),
    },
    {
      id: 'stories',
      label: 'Stories',
      icon: <Layers size={18} aria-hidden="true" />,
      render: () => (
        <div className="lkdv-hl-pane">
          <h3 className="lkdv-hl-h">Dans la sélection ({data?.stories.length ?? 0})</h3>
          {data && data.stories.length > 0 ? (
            <ul className="lkdv-hl-list">
              {data.stories.map((story) => (
                <li key={story.id}>
                  <Thumb story={story} />
                  <span className="lkdv-hl-cap">{story.caption || 'Story sans légende'}</span>
                  <ActionPill
                    label="Retirer cette story"
                    icon={<X size={16} aria-hidden="true" />}
                    disabled={busy}
                    onClick={() => removeStory(story.id)}
                  />
                </li>
              ))}
            </ul>
          ) : (
            <p className="lkdv-hl-hint">Cette sélection est vide.</p>
          )}
          <h3 className="lkdv-hl-h">Ajouter une de tes stories</h3>
          {data && data.available.length > 0 ? (
            <div className="lkdv-hl-grid">
              {data.available.map((story) => (
                <button
                  key={story.id}
                  type="button"
                  className="lkdv-hl-cell"
                  onClick={() => addStory(story.id)}
                  disabled={busy}
                  aria-label={`Ajouter ${story.caption || 'cette story'}`}
                >
                  <Thumb story={story} />
                  <Plus size={14} className="lkdv-hl-check" aria-hidden="true" />
                </button>
              ))}
            </div>
          ) : (
            <p className="lkdv-hl-hint">Aucune autre story disponible.</p>
          )}
          {status}
        </div>
      ),
    },
  ];

  if (state === 'loading') {
    return (
      <div className="lkdv-drawer-shell">
        <DrawerSkeleton />
      </div>
    );
  }
  if (state === 'error') {
    return (
      <div className="lkdv-drawer-shell">
        <DrawerError onRetry={() => { setState('loading'); void load(); }} />
      </div>
    );
  }
  if (state === 'unsupported') {
    return (
      <div className="lkdv-drawer-shell">
        <DrawerEmpty
          title="Sélection automatique"
          hint="Cette story à la une est générée à partir de ton sac et de tes carnets : elle n'est pas modifiable."
        />
      </div>
    );
  }

  return (
    <div className="lkdv-compte-root">
      <DrawerShell tabs={tabs} activeIndex={tab} onIndexChange={setTab} />
    </div>
  );
}

export default HighlightEditDrawer;
