'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { Check, Image as ImageIcon, Layers, Plus, Trash2, Type, X } from 'lucide-react';
import { fetchJson } from './shared';
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
export function HighlightEditDrawer({ hlId, hlTitle = '' }: { hlId: string; hlTitle?: string }) {
  // Sélection générée automatiquement (sac, carnets) : pas encore en base. On la
  // compose ici puis on la crée à l'enregistrement.
  const isDraft = !UUID.test(hlId);
  const [tab, setTab] = useState(0);
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [data, setData] = useState<HighlightState | null>(null);
  const [title, setTitle] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ text: string; tone: 'ok' | 'error' } | null>(null);

  const load = useCallback(async () => {
    try {
      if (isDraft) {
        const { available } = await fetchJson<{ available: StoryThumb[] }>('/api/compte/highlights');
        setData({ id: '', title: hlTitle, coverStoryId: null, stories: [], available });
        setTitle(hlTitle || 'Ma sélection');
        setState('ready');
        return;
      }
      const next = await fetchJson<HighlightState>(`/api/compte/highlights/${hlId}`);
      setData(next);
      setTitle(next.title);
      setState('ready');
    } catch {
      setState('error');
    }
  }, [hlId, hlTitle, isDraft]);

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

  const patch = (body: Record<string, unknown>, okText: string) => {
    if (!data) return;
    if (isDraft) {
      // Brouillon local : rien n'est écrit tant que la sélection n'est pas créée.
      setData((current) => {
        if (!current) return current;
        const next = { ...current };
        if (typeof body.coverStoryId === 'string') next.coverStoryId = body.coverStoryId;
        if (typeof body.addStoryId === 'string') {
          const story = current.available.find((item) => item.id === body.addStoryId);
          if (story) {
            next.stories = [...current.stories, story];
            next.available = current.available.filter((item) => item.id !== story.id);
          }
        }
        if (typeof body.removeStoryId === 'string') {
          const story = current.stories.find((item) => item.id === body.removeStoryId);
          if (story) {
            next.stories = current.stories.filter((item) => item.id !== story.id);
            next.available = [story, ...current.available];
            if (current.coverStoryId === story.id) next.coverStoryId = null;
          }
        }
        return next;
      });
      setMessage({ text: okText, tone: 'ok' });
      return;
    }
    void run(
      () =>
        fetchJson(`/api/compte/highlights/${data.id}`, { method: 'PATCH', body: JSON.stringify(body) }).then(
          () => ({ error: null }),
          (error: Error) => ({ error: { message: error.message } }),
        ),
      okText,
    );
  };

  const createHighlight = async () => {
    const next = title.trim().slice(0, TITLE_MAX);
    if (!data || !next) return;
    setBusy(true);
    setMessage(null);
    try {
      await fetchJson('/api/compte/highlights', {
        method: 'POST',
        body: JSON.stringify({
          title: next,
          coverStoryId: data.coverStoryId ?? data.stories[0]?.id ?? null,
          storyIds: data.stories.map((story) => story.id),
        }),
      });
      changed();
      (window as unknown as { __lkdvCompteAct?: (action: string) => void }).__lkdvCompteAct?.('closeSheet');
    } catch {
      setMessage({ text: 'La création a échoué. Réessaie.', tone: 'error' });
    } finally {
      setBusy(false);
    }
  };

  const saveTitle = () => {
    const next = title.trim().slice(0, TITLE_MAX);
    if (!next) return;
    if (isDraft) {
      void createHighlight();
      return;
    }
    patch({ title: next }, 'Titre enregistré.');
  };
  const setCover = (storyId: string) => patch({ coverStoryId: storyId }, 'Couverture modifiée.');
  const addStory = (storyId: string) => patch({ addStoryId: storyId }, 'Story ajoutée.');
  const removeStory = (storyId: string) => patch({ removeStoryId: storyId }, 'Story retirée.');

  const removeAlbum = async () => {
    if (!data || !window.confirm('Retirer cette sélection de tes stories à la une ?')) return;
    setBusy(true);
    try {
      await fetchJson(`/api/compte/highlights/${data.id}`, { method: 'DELETE' });
    } catch {
      setBusy(false);
      setMessage({ text: 'La suppression a échoué. Réessaie.', tone: 'error' });
      return;
    }
    setBusy(false);
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
            text={isDraft ? 'Créer la sélection' : 'Enregistrer'}
            label={isDraft ? 'Créer la sélection à la une' : 'Enregistrer le titre'}
            icon={<Check size={16} aria-hidden="true" />}
            busy={busy}
            disabled={!title.trim() || (!isDraft && title.trim() === data?.title)}
            onClick={saveTitle}
          />
          {status}
          {isDraft ? null : (
            <button type="button" className="lkdv-hl-danger" onClick={() => void removeAlbum()} disabled={busy}>
              <Trash2 size={15} aria-hidden="true" /> Retirer des stories à la une
            </button>
          )}
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
  return (
    <div className="lkdv-compte-root">
      <DrawerShell tabs={tabs} activeIndex={tab} onIndexChange={setTab} />
    </div>
  );
}

export default HighlightEditDrawer;
