'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { Check, Image as ImageIcon, Layers, Plus, Trash2, Type, X } from 'lucide-react';
import { fetchJson } from './shared';
import { ActionPill } from '@/components/ui/ActionPill';
import { lkvConfirm } from '@/components/ui/dialogs';
import { DrawerEmpty, DrawerError, DrawerShell, DrawerSkeleton, type DrawerTab } from '../shell/DrawerShell';
import './HighlightEditDrawer.css';

/** Évènement écouté par le Compte : relit les stories à la une après une modification. */
export const HIGHLIGHTS_CHANGED_EVENT = 'lkdv:highlights-changed';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const TITLE_MAX = 60;

const MOCK_HIGHLIGHTS_FALLBACK: Array<{
  id: string;
  title: string;
  coverImage?: string;
  coverStoryId?: string;
  stories: Array<{ id: string; image: string; caption?: string; isVideo?: boolean }>;
}> = [
  {
    id: 'hl1',
    title: 'Dolomites',
    coverImage: 'https://images.unsplash.com/photo-1519681393784-d120267933ba?auto=format&fit=crop&w=480&q=80',
    coverStoryId: 's1',
    stories: [
      { id: 's1', image: 'https://images.unsplash.com/photo-1519681393784-d120267933ba?auto=format&fit=crop&w=1080&q=80', caption: 'Tre Cime di Lavaredo au crépuscule doré' },
      { id: 's2', image: 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=1080&q=80', caption: 'Reflet du matin au Lago di Braies' },
      { id: 's3', image: 'https://images.unsplash.com/photo-1530122037265-a5f1f91d3b99?auto=format&fit=crop&w=1080&q=80', caption: 'Cinque Torri · passage aérien sur la vire' },
      { id: 's4', image: 'https://images.unsplash.com/photo-1483728642387-6c3bdd6c93e5?auto=format&fit=crop&w=1080&q=80', caption: 'Arrivée au Rifugio Locatelli à 2 405 m' },
    ],
  },
  {
    id: 'hl2',
    title: 'Vercors',
    coverImage: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=480&q=80',
    coverStoryId: 's5',
    stories: [
      { id: 's5', image: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=1080&q=80', caption: 'Bivouac sous le Grand Veymont' },
      { id: 's6', image: 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=1080&q=80', caption: 'Mer de nuages au réveil sur les Hauts Plateaux' },
    ],
  },
  {
    id: 'hl3',
    title: 'Mont-Blanc',
    coverImage: 'https://images.unsplash.com/photo-1486870591958-9b9d0d1dda99?auto=format&fit=crop&w=480&q=80',
    coverStoryId: 's7',
    stories: [
      { id: 's7', image: 'https://images.unsplash.com/photo-1486870591958-9b9d0d1dda99?auto=format&fit=crop&w=1080&q=80', caption: 'Arête des Cosmiques dans le blizzard' },
    ],
  },
  {
    id: 'hl4',
    title: 'Sac',
    coverImage: 'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?auto=format&fit=crop&w=480&q=80',
    coverStoryId: 's17',
    stories: [
      { id: 's17', image: 'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?auto=format&fit=crop&w=1080&q=80', caption: 'Inventaire complet du sac ultralight · 780 g' },
      { id: 's18', image: 'https://images.unsplash.com/photo-1544717305-2782549b5136?auto=format&fit=crop&w=1080&q=80', caption: 'Chaussures de trail et bâtons carbone' },
    ],
  },
];

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
    const windowHls = typeof window !== 'undefined' ? (window as unknown as { __lkdvHighlights?: typeof MOCK_HIGHLIGHTS_FALLBACK }).__lkdvHighlights : null;
    const existingHl = (Array.isArray(windowHls) ? windowHls.find((x) => x.id === hlId || (hlTitle && x.title?.toLowerCase() === hlTitle.toLowerCase())) : null) ||
      MOCK_HIGHLIGHTS_FALLBACK.find((x) => x.id === hlId || (hlTitle && x.title?.toLowerCase() === hlTitle.toLowerCase()));

    try {
      if (isDraft) {
        let available: StoryThumb[] = [];
        try {
          const res = await fetchJson<{ available: StoryThumb[] }>('/api/compte/highlights');
          available = res.available || [];
        } catch {
          // Hors ligne / non connecté
        }
        if (existingHl) {
          const stories = (existingHl.stories || []).map((s) => ({
            id: s.id,
            image: s.image,
            caption: s.caption || '',
            isVideo: false,
          }));
          setData({
            id: existingHl.id,
            title: existingHl.title || hlTitle,
            coverStoryId: existingHl.coverStoryId || stories[0]?.id || null,
            stories,
            available,
          });
          setTitle(existingHl.title || hlTitle);
          setState('ready');
          return;
        }
        setData({ id: '', title: hlTitle, coverStoryId: null, stories: [], available });
        setTitle(hlTitle || 'Ma sélection');
        setState('ready');
        return;
      }
      const next = await fetchJson<HighlightState>(`/api/compte/highlights/${hlId}`);
      if (!next.coverStoryId && next.stories?.length) {
        next.coverStoryId = next.stories[0].id;
      }
      if ((!next.stories || next.stories.length === 0) && existingHl) {
        next.stories = (existingHl.stories || []).map((s) => ({
          id: s.id,
          image: s.image,
          caption: s.caption || '',
          isVideo: false,
        }));
        if (!next.coverStoryId && next.stories[0]) {
          next.coverStoryId = next.stories[0].id;
        }
      }
      setData(next);
      setTitle(next.title || (existingHl && existingHl.title) || hlTitle);
      setState('ready');
    } catch {
      if (existingHl) {
        const stories = (existingHl.stories || []).map((s) => ({
          id: s.id,
          image: s.image,
          caption: s.caption || '',
          isVideo: false,
        }));
        setData({
          id: existingHl.id,
          title: existingHl.title || hlTitle,
          coverStoryId: existingHl.coverStoryId || stories[0]?.id || null,
          stories,
          available: [],
        });
        setTitle(existingHl.title || hlTitle);
        setState('ready');
      } else {
        setState('error');
      }
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

  const syncGlobalHighlight = (updater: (hl: any) => void) => {
    if (typeof window === 'undefined') return;
    const win = window as any;
    if (Array.isArray(win.__lkdvHighlights)) {
      const hl = win.__lkdvHighlights.find((x: any) => x && (x.id === hlId || x.id === data?.id));
      if (hl) updater(hl);
    }
    win.__lkdvRefreshHighlights?.();
    window.dispatchEvent(new CustomEvent(HIGHLIGHTS_CHANGED_EVENT));
  };

  const patch = (body: Record<string, unknown>, okText: string) => {
    if (!data) return;
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

    syncGlobalHighlight((hl) => {
      if (typeof body.coverStoryId === 'string') {
        hl.coverStoryId = body.coverStoryId;
        const st = (data.stories || []).find((s) => s.id === body.coverStoryId);
        if (st) hl.coverImage = st.image;
      }
    });

    setMessage({ text: okText, tone: 'ok' });

    if (!isDraft && data.id) {
      void fetchJson(`/api/compte/highlights/${data.id}`, { method: 'PATCH', body: JSON.stringify(body) }).catch(() => {});
    }
  };

  const saveTitle = async () => {
    const next = title.trim().slice(0, TITLE_MAX);
    if (!next) return;
    setBusy(true);
    setMessage(null);
    try {
      syncGlobalHighlight((hl) => {
        hl.title = next;
      });
      setData((current) => (current ? { ...current, title: next } : null));
      setMessage({ text: 'Titre enregistré.', tone: 'ok' });
      changed();
      if (!isDraft && data?.id) {
        await fetchJson(`/api/compte/highlights/${data.id}`, { method: 'PATCH', body: JSON.stringify({ title: next }) });
      }
    } catch {
      setMessage({ text: 'Titre enregistré en local.', tone: 'ok' });
      changed();
    } finally {
      setBusy(false);
    }
  };

  const setCover = (storyId: string) => {
    patch({ coverStoryId: storyId }, 'Couverture modifiée.');
  };

  const addStory = (storyId: string) => patch({ addStoryId: storyId }, 'Story ajoutée.');
  const removeStory = (storyId: string) => patch({ removeStoryId: storyId }, 'Story retirée.');

  const removeAlbum = async () => {
    if (!data) return;
    const confirmed = await lkvConfirm({
      title: 'Retirer cette sélection',
      message: 'Retirer cette sélection de tes stories à la une ?',
      confirmLabel: 'Retirer',
      variant: 'destructive',
    });
    if (!confirmed) return;
    setBusy(true);
    try {
      if (typeof window !== 'undefined') {
        const win = window as any;
        if (Array.isArray(win.__lkdvHighlights)) {
          const idx = win.__lkdvHighlights.findIndex((x: any) => x && (x.id === hlId || x.id === data?.id));
          if (idx >= 0) win.__lkdvHighlights.splice(idx, 1);
        }
        win.__lkdvRefreshHighlights?.();
      }
      if (!isDraft && data?.id) {
        await fetchJson(`/api/compte/highlights/${data.id}`, { method: 'DELETE' });
      }
    } catch {
      // Local fallback
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
      <style>{`
        .lkdv-compte-root {
          display: flex !important;
          flex-direction: column !important;
          flex: 1 1 auto !important;
          min-height: 0 !important;
          height: 100% !important;
          width: 100% !important;
        }
        .lkdv-compte-root .lkdv-drawer-shell {
          display: flex !important;
          flex-direction: column !important;
          flex: 1 1 auto !important;
          min-height: 0 !important;
          height: 100% !important;
          width: 100% !important;
        }
        .lkdv-compte-root .lkdv-drawer-viewport {
          flex: 1 1 auto !important;
          min-height: 240px !important;
        }
      `}</style>
      <DrawerShell tabs={tabs} activeIndex={tab} onIndexChange={setTab} />
    </div>
  );
}

export default HighlightEditDrawer;
