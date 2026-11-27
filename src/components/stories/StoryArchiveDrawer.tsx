'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Archive, Calendar, Check, MapPin, Search, User, X } from 'lucide-react';
import type { ArchivedStoryItem } from '@/app/api/stories/archive/route';

export type StoryArchiveScope = 'club' | 'user' | 'carnet';

export interface StoryArchiveDrawerProps {
  isOpen: boolean;
  scope: StoryArchiveScope;
  scopeId: string;
  title?: string;
  subtitle?: string;
  mode?: 'browse' | 'select';
  initialSelectedIds?: string[];
  /** Optionnel : évite un second fetch si le parent a déjà chargé les archives. */
  prefetchedStories?: ArchivedStoryItem[];
  onConfirmSelection?: (selected: ArchivedStoryItem[]) => void;
  onSelectStory?: (story: ArchivedStoryItem) => void;
  onClose: () => void;
}

function formatDateShort(iso: string): string {
  try {
    return new Intl.DateTimeFormat('fr-FR', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    }).format(new Date(iso));
  } catch {
    return iso.slice(0, 10);
  }
}

function formatMonthGroup(iso: string): string {
  try {
    const label = new Intl.DateTimeFormat('fr-FR', {
      month: 'long',
      year: 'numeric',
    }).format(new Date(iso));
    return label.charAt(0).toUpperCase() + label.slice(1);
  } catch {
    return 'Archives';
  }
}

/**
 * Drawer universel des archives de stories (appelable depuis n'importe quelle page :
 * Club, Compte utilisateur ou Carnet).
 *
 * Chaque story reste strictement attribuée à la personne qui l'a postée
 * (avatar, nom, handle et date d'origine).
 */
export function StoryArchiveDrawer({
  isOpen,
  scope,
  scopeId,
  title,
  subtitle,
  mode = 'browse',
  initialSelectedIds = [],
  prefetchedStories,
  onConfirmSelection,
  onSelectStory,
  onClose,
}: StoryArchiveDrawerProps) {
  const [stories, setStories] = useState<ArchivedStoryItem[]>(prefetchedStories ?? []);
  const [loading, setLoading] = useState(!prefetchedStories);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [authorFilter, setAuthorFilter] = useState<string>('all');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set(initialSelectedIds));

  useEffect(() => {
    if (!isOpen) return;
    setSelectedIds(new Set(initialSelectedIds));
  }, [isOpen, initialSelectedIds]);

  useEffect(() => {
    if (!isOpen) return;
    if (prefetchedStories && prefetchedStories.length > 0) {
      setStories(prefetchedStories);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    const params = new URLSearchParams({ scope, scopeId, limit: '150' });
    fetch(`/api/stories/archive?${params.toString()}`, { cache: 'no-store' })
      .then((res) => res.json())
      .then((payload: { data?: { stories?: ArchivedStoryItem[] }; error?: string }) => {
        if (cancelled) return;
        if (payload?.data?.stories) {
          setStories(payload.data.stories);
        } else {
          setError(payload?.error || 'Impossible de charger les archives.');
        }
      })
      .catch(() => {
        if (!cancelled) setError('Erreur réseau lors du chargement des archives.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [isOpen, prefetchedStories, scope, scopeId]);

  const authors = useMemo(() => {
    const map = new Map<string, { id: string; name: string; count: number }>();
    for (const s of stories) {
      const prev = map.get(s.authorId) ?? { id: s.authorId, name: s.authorName, count: 0 };
      prev.count += 1;
      map.set(s.authorId, prev);
    }
    return Array.from(map.values()).sort((a, b) => b.count - a.count);
  }, [stories]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return stories.filter((s) => {
      if (authorFilter !== 'all' && s.authorId !== authorFilter) return false;
      if (!q) return true;
      return (
        s.caption.toLowerCase().includes(q) ||
        s.authorName.toLowerCase().includes(q) ||
        (s.outingTitle ?? '').toLowerCase().includes(q) ||
        (s.spot ?? '').toLowerCase().includes(q)
      );
    });
  }, [authorFilter, query, stories]);

  const groupedByMonth = useMemo(() => {
    const groups = new Map<string, ArchivedStoryItem[]>();
    for (const s of filtered) {
      const key = formatMonthGroup(s.createdAt);
      const arr = groups.get(key) ?? [];
      arr.push(s);
      groups.set(key, arr);
    }
    return Array.from(groups.entries());
  }, [filtered]);

  if (!isOpen) return null;

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const resolvedTitle =
    title ||
    (scope === 'club'
      ? 'Archives des stories du club'
      : scope === 'carnet'
        ? 'Archives du carnet'
        : 'Mes archives de stories');

  const resolvedSubtitle =
    subtitle ||
    (scope === 'club'
      ? `${stories.length} stories postées depuis le début · chaque story reste attribuée à son auteur`
      : `${stories.length} stories archivées`);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={resolvedTitle}
      data-testid="story-archive-drawer"
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 3400,
        background: 'rgba(12, 22, 18, 0.58)',
        backdropFilter: 'blur(14px)',
        WebkitBackdropFilter: 'blur(14px)',
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'center',
        padding: 12,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: 420,
          maxHeight: '86vh',
          borderRadius: 26,
          background: 'rgba(247, 250, 246, 0.96)',
          border: '0.5px solid rgba(255, 255, 255, 0.85)',
          boxShadow: '0 24px 64px rgba(12, 24, 18, 0.36)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          color: '#172b24',
        }}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 10,
            padding: '14px 16px 10px',
            borderBottom: '0.5px solid rgba(23, 64, 44, 0.1)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 9, minWidth: 0 }}>
            <span
              style={{
                width: 34,
                height: 34,
                borderRadius: 12,
                background: 'rgba(23, 64, 44, 0.1)',
                color: '#17402c',
                display: 'grid',
                placeItems: 'center',
                flexShrink: 0,
              }}
            >
              <Archive size={16} aria-hidden="true" />
            </span>
            <div style={{ minWidth: 0 }}>
              <b style={{ display: 'block', fontSize: 14.5, lineHeight: 1.2 }}>{resolvedTitle}</b>
              <small style={{ display: 'block', fontSize: 11, color: '#56665d', marginTop: 2 }}>
                {resolvedSubtitle}
              </small>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer les archives de stories"
            style={{
              width: 30,
              height: 30,
              borderRadius: '50%',
              border: 0,
              background: 'rgba(23, 64, 44, 0.08)',
              color: '#17402c',
              display: 'grid',
              placeItems: 'center',
              cursor: 'pointer',
              flexShrink: 0,
            }}
          >
            <X size={15} aria-hidden="true" />
          </button>
        </div>

        {/* Search & Author Filter */}
        <div style={{ padding: '10px 14px 8px', display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              height: 34,
              padding: '0 10px',
              borderRadius: 12,
              background: 'rgba(255, 255, 255, 0.85)',
              border: '0.5px solid rgba(23, 64, 44, 0.14)',
            }}
          >
            <Search size={14} color="#56665d" aria-hidden="true" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Filtrer par auteur, sortie ou légende…"
              aria-label="Rechercher dans les archives de stories"
              style={{
                flex: 1,
                border: 0,
                background: 'transparent',
                outline: 'none',
                fontSize: 12.5,
                color: '#172b24',
              }}
            />
          </div>

          {authors.length > 1 ? (
            <div
              style={{
                display: 'flex',
                gap: 6,
                overflowX: 'auto',
                scrollbarWidth: 'none',
                paddingBottom: 2,
              }}
              role="group"
              aria-label="Filtrer par auteur"
            >
              <button
                type="button"
                onClick={() => setAuthorFilter('all')}
                style={{
                  flex: 'none',
                  height: 26,
                  padding: '0 10px',
                  borderRadius: 999,
                  border: '0.5px solid rgba(23, 64, 44, 0.16)',
                  background: authorFilter === 'all' ? '#17402c' : 'rgba(255, 255, 255, 0.8)',
                  color: authorFilter === 'all' ? '#ffffff' : '#17402c',
                  fontSize: 11,
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Tous ({stories.length})
              </button>
              {authors.slice(0, 10).map((a) => (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => setAuthorFilter(authorFilter === a.id ? 'all' : a.id)}
                  style={{
                    flex: 'none',
                    height: 26,
                    padding: '0 10px',
                    borderRadius: 999,
                    border: '0.5px solid rgba(23, 64, 44, 0.16)',
                    background: authorFilter === a.id ? '#17402c' : 'rgba(255, 255, 255, 0.8)',
                    color: authorFilter === a.id ? '#ffffff' : '#17402c',
                    fontSize: 11,
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  {a.name.split(' ')[0]} ({a.count})
                </button>
              ))}
            </div>
          ) : null}
        </div>

        {/* Archive Grid */}
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '4px 14px 14px',
            display: 'flex',
            flexDirection: 'column',
            gap: 14,
          }}
        >
          {loading ? (
            <p style={{ textAlign: 'center', fontSize: 12.5, color: '#56665d', padding: '24px 0' }}>
              Chargement des archives…
            </p>
          ) : error ? (
            <p style={{ textAlign: 'center', fontSize: 12.5, color: '#a8443a', padding: '24px 0' }}>
              {error}
            </p>
          ) : groupedByMonth.length === 0 ? (
            <p style={{ textAlign: 'center', fontSize: 12.5, color: '#56665d', padding: '24px 0' }}>
              Aucune story archivée ne correspond à ce filtre.
            </p>
          ) : (
            groupedByMonth.map(([monthLabel, items]) => (
              <section key={monthLabel} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    fontSize: 11,
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    color: '#56665d',
                  }}
                >
                  <Calendar size={12} aria-hidden="true" />
                  <span>
                    {monthLabel} ({items.length})
                  </span>
                </div>

                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
                    gap: 8,
                  }}
                >
                  {items.map((st) => {
                    const isSelected = selectedIds.has(st.id);
                    return (
                      <button
                        key={st.id}
                        type="button"
                        onClick={() => {
                          if (mode === 'select') {
                            toggleSelect(st.id);
                          } else {
                            onSelectStory?.(st);
                          }
                        }}
                        aria-pressed={mode === 'select' ? isSelected : undefined}
                        style={{
                          position: 'relative',
                          display: 'flex',
                          flexDirection: 'column',
                          textAlign: 'left',
                          padding: 0,
                          borderRadius: 16,
                          overflow: 'hidden',
                          border: isSelected
                            ? '2px solid #17402c'
                            : '0.5px solid rgba(23, 64, 44, 0.14)',
                          background: '#ffffff',
                          cursor: 'pointer',
                          boxShadow: isSelected
                            ? '0 6px 16px rgba(23, 64, 44, 0.2)'
                            : '0 2px 8px rgba(16, 32, 24, 0.06)',
                        }}
                      >
                        <div style={{ position: 'relative', width: '100%', aspectRatio: '4 / 5', background: '#e5ece6' }}>
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={st.imageUrl}
                            alt={st.caption || st.spot || 'Story archivée'}
                            loading="lazy"
                            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                          />
                          <div
                            style={{
                              position: 'absolute',
                              inset: 0,
                              background:
                                'linear-gradient(180deg, rgba(0,0,0,0.28) 0%, transparent 40%, rgba(0,0,0,0.68) 100%)',
                            }}
                          />
                          {/* Author attribution pill (strictly preserves original author) */}
                          <div
                            style={{
                              position: 'absolute',
                              top: 6,
                              left: 6,
                              right: mode === 'select' ? 32 : 6,
                              display: 'flex',
                              alignItems: 'center',
                              gap: 5,
                            }}
                          >
                            {st.authorAvatarUrl ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={st.authorAvatarUrl}
                                alt={st.authorName}
                                style={{
                                  width: 20,
                                  height: 20,
                                  borderRadius: '50%',
                                  objectFit: 'cover',
                                  border: '1.5px solid #fff',
                                  flexShrink: 0,
                                }}
                              />
                            ) : (
                              <span
                                style={{
                                  width: 20,
                                  height: 20,
                                  borderRadius: '50%',
                                  background: '#17402c',
                                  color: '#fff',
                                  fontSize: 9.5,
                                  fontWeight: 700,
                                  display: 'grid',
                                  placeItems: 'center',
                                  border: '1.5px solid #fff',
                                  flexShrink: 0,
                                }}
                              >
                                <User size={10} aria-hidden="true" />
                              </span>
                            )}
                            <span
                              style={{
                                fontSize: 10.5,
                                fontWeight: 700,
                                color: '#ffffff',
                                textShadow: '0 1px 3px rgba(0,0,0,0.55)',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                              }}
                            >
                              {st.authorName}
                            </span>
                          </div>

                          {mode === 'select' ? (
                            <span
                              style={{
                                position: 'absolute',
                                top: 6,
                                right: 6,
                                width: 22,
                                height: 22,
                                borderRadius: '50%',
                                border: '1.5px solid #fff',
                                background: isSelected ? '#17402c' : 'rgba(15, 23, 20, 0.42)',
                                color: '#fff',
                                display: 'grid',
                                placeItems: 'center',
                              }}
                            >
                              {isSelected ? <Check size={12} strokeWidth={3} aria-hidden="true" /> : null}
                            </span>
                          ) : null}

                          <div
                            style={{
                              position: 'absolute',
                              left: 7,
                              right: 7,
                              bottom: 7,
                              display: 'flex',
                              flexDirection: 'column',
                              gap: 2,
                              color: '#ffffff',
                            }}
                          >
                            {st.spot ? (
                              <span
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: 3,
                                  fontSize: 9.5,
                                  fontWeight: 700,
                                  opacity: 0.92,
                                }}
                              >
                                <MapPin size={9} aria-hidden="true" />
                                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                  {st.spot}
                                </span>
                              </span>
                            ) : null}
                            <span
                              style={{
                                fontSize: 10.5,
                                lineHeight: 1.25,
                                display: '-webkit-box',
                                WebkitLineClamp: 2,
                                WebkitBoxOrient: 'vertical',
                                overflow: 'hidden',
                              }}
                            >
                              {st.caption || st.outingTitle || 'Story du club'}
                            </span>
                            <small style={{ fontSize: 9, opacity: 0.8 }}>
                              {formatDateShort(st.createdAt)}
                            </small>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </section>
            ))
          )}
        </div>

        {/* Footer CTA for select mode */}
        {mode === 'select' ? (
          <div
            style={{
              padding: '10px 14px 14px',
              borderTop: '0.5px solid rgba(23, 64, 44, 0.1)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 10,
              background: 'rgba(255, 255, 255, 0.9)',
            }}
          >
            <span style={{ fontSize: 12, fontWeight: 600, color: '#17402c' }}>
              {selectedIds.size} sélectionnée{selectedIds.size > 1 ? 's' : ''}
            </span>
            <button
              type="button"
              className="lkdv-carnet-btn-primary"
              disabled={selectedIds.size === 0}
              onClick={() => {
                const picked = stories.filter((s) => selectedIds.has(s.id));
                onConfirmSelection?.(picked);
              }}
              style={{ height: 34, padding: '0 14px', fontSize: 12 }}
            >
              Valider la sélection
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}

export default StoryArchiveDrawer;
