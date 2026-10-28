'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import Icon from '@/components/ui/Icon';
import { useToast } from '@/contexts/ToastContext';
import { createClient } from '@/lib/supabase/client';
import { CommunityDrawer } from './CommunityDrawer';
import { CommunityTabSelector, SECTION_TABS, type SectionTabId } from './CommunityTabSelector';
import {
  useCommunitySections,
  type CarnetRow,
  type ClubRow,
  type EventRow,
} from './useCommunitySections';
import { CarnetTile } from './CarnetTile';
import './carnet-tile.css';

type FilterId = 'discover' | 'mine';
type SearchKind = 'post' | 'carnet' | 'club' | 'sortie' | 'member';
type SearchScope = 'all' | SearchKind;
type SearchResult = {
  id: string;
  kind: SearchKind;
  title: string;
  meta: string;
  href: string;
  cover?: string | null;
};

const SEARCH_KINDS: Array<{ id: SearchKind; label: string; short: string; tone: string }> = [
  { id: 'post', label: 'Publications', short: 'Post', tone: '#17402C' },
  { id: 'carnet', label: 'Carnets', short: 'Carnet', tone: '#8A6A2F' },
  { id: 'club', label: 'Clubs', short: 'Club', tone: '#3D6F63' },
  { id: 'sortie', label: 'Sorties', short: 'Sortie', tone: '#A05A3C' },
  { id: 'member', label: 'Membres', short: 'Membre', tone: '#4B6B7C' },
];

export interface CommunitySectionsDrawerProps {
  open: boolean;
  initialTab: SectionTabId;
  initialSearch?: boolean;
  user: any;
  onClose: () => void;
  onRequireAuth: () => void;
}

function Cover({ src, label }: { src?: string | null; label: string }) {
  return (
    <span className="lkdv-section-cover" aria-hidden="true">
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element -- covers distantes
        <img src={src} alt="" />
      ) : (
        <span className="text-[13px] font-bold text-[#17402C]">
          {label.charAt(0).toUpperCase()}
        </span>
      )}
    </span>
  );
}

function SectionRow({
  cover,
  title,
  meta,
  label,
  action,
  onClick,
}: {
  cover?: string | null;
  title: string;
  meta: string;
  label: string;
  action?: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <div className="lkdv-section-row">
      <button
        type="button"
        className="flex min-w-0 flex-1 items-center gap-2.5 text-left"
        onClick={onClick}
      >
        <Cover src={cover} label={label} />
        <span className="lkdv-section-txt">
          <b>{title}</b>
          <small>{meta}</small>
        </span>
      </button>
      {action}
    </div>
  );
}

function SectionTile({
  cover,
  title,
  meta,
  label,
  action,
  onClick,
}: {
  cover?: string | null;
  title: string;
  meta: string;
  label: string;
  action?: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <article className="lkdv-section-tile">
      <button type="button" className="lkdv-section-tile-main" onClick={onClick}>
        <span className="lkdv-section-tile-cover">
          <Cover src={cover} label={label} />
        </span>
        <span className="lkdv-section-tile-txt">
          <b>{title}</b>
          <small>{meta}</small>
        </span>
      </button>
      {action ? <div className="lkdv-section-tile-action">{action}</div> : null}
    </article>
  );
}

export function CommunitySectionsDrawer({
  open,
  initialTab,
  initialSearch = false,
  user,
  onClose,
  onRequireAuth,
}: CommunitySectionsDrawerProps) {
  const { toast } = useToast();
  const [tab, setTab] = useState<SectionTabId>(initialTab);
  const [filter, setFilter] = useState<FilterId>('discover');
  const [query, setQuery] = useState('');
  const [scope, setScope] = useState<SearchScope>('all');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [selected, setSelected] = useState<CarnetRow | ClubRow | EventRow | null>(null);
  const searchReturnTab = useRef<SectionTabId>('carnets');
  const {
    carnets,
    clubs,
    sorties,
    loading,
    error,
    joinClub,
    leaveClub,
    toggleEvent,
    toggleCarnetLike,
  } = useCommunitySections(user, open);

  useEffect(() => {
    if (!open) return;
    setTab(initialSearch ? 'recherche' : initialTab);
    setFilter('discover');
    setSelected(null);
    setQuery('');
    setScope('all');
    setResults([]);
  }, [initialSearch, initialTab, open]);

  useEffect(() => {
    const text = query.trim();
    if (text.length < 2) {
      setResults([]);
      setSearching(false);
      return;
    }
    let cancelled = false;
    const timer = window.setTimeout(async () => {
      setSearching(true);
      try {
        const supabase = createClient();
        const like = `%${text}%`;
        const [posts, carnetRows, clubRows, eventRows, memberRows] = await Promise.all([
          supabase
            .from('community_posts')
            .select('id,content,image_url,media_urls')
            .ilike('content', like)
            .order('created_at', { ascending: false })
            .limit(5),
          supabase.from('carnets').select('id,title,cover_image').ilike('title', like).limit(5),
          supabase
            .from('clubs')
            .select('id,slug,name,cover_image,members_count,category')
            .ilike('name', like)
            .limit(5),
          supabase
            .from('events')
            .select('id,title,location,event_date')
            .ilike('title', like)
            .limit(5),
          supabase
            .from('public_profiles')
            .select('id,full_name,handle,avatar_url,location')
            .or(`full_name.ilike.${like},handle.ilike.${like}`)
            .limit(5),
        ]);
        if (cancelled) return;
        const next: SearchResult[] = [
          ...((posts.data ?? []) as any[]).map((row) => ({
            id: row.id,
            kind: 'post' as const,
            title: row.content?.slice(0, 72) || 'Publication',
            meta: 'Publication',
            href: `/communaute?post=${row.id}`,
            cover: row.image_url || row.media_urls?.[0] || null,
          })),
          ...((carnetRows.data ?? []) as any[]).map((row) => ({
            id: row.id,
            kind: 'carnet' as const,
            title: row.title,
            meta: 'Carnet',
            href: `/carnets/${row.id}`,
            cover: row.cover_image,
          })),
          ...((clubRows.data ?? []) as any[]).map((row) => ({
            id: row.id,
            kind: 'club' as const,
            title: row.name,
            meta: `${row.members_count ?? 0} membres${row.category ? ` · ${row.category}` : ''}`,
            href: `/clubs/${row.slug || row.id}`,
            cover: row.cover_image,
          })),
          ...((eventRows.data ?? []) as any[]).map((row) => ({
            id: row.id,
            kind: 'sortie' as const,
            title: row.title,
            meta: [row.location, row.event_date].filter(Boolean).join(' · '),
            href: '/communaute',
            cover: null,
          })),
          ...((memberRows.data ?? []) as any[]).map((row) => ({
            id: row.id,
            kind: 'member' as const,
            title: row.full_name || `@${row.handle || 'voyageur'}`,
            meta: [row.handle ? `@${row.handle}` : null, row.location].filter(Boolean).join(' · '),
            href: `/profil/${row.id}`,
            cover: row.avatar_url,
          })),
        ];
        setResults(next);
      } catch {
        if (!cancelled) setResults([]);
      } finally {
        if (!cancelled) setSearching(false);
      }
    }, 280);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [query]);

  const filteredCarnets = useMemo(
    () => (filter === 'mine' ? carnets.filter((row) => row.author_id === user?.id) : carnets),
    [carnets, filter, user?.id]
  );
  const filteredClubs = useMemo(
    () => (filter === 'mine' ? clubs.filter((row) => row.is_member) : clubs),
    [clubs, filter]
  );
  const filteredSorties = useMemo(
    () => (filter === 'mine' ? sorties.filter((row) => row.is_registered) : sorties),
    [filter, sorties]
  );

  const changeTab = (next: SectionTabId) => {
    if (next === 'recherche' && tab !== 'recherche') searchReturnTab.current = tab;
    setTab(next);
    if (next !== 'recherche') setQuery('');
    setFilter('discover');
    setSelected(null);
  };

  const closeSearch = () => {
    setQuery('');
    setScope('all');
    changeTab(searchReturnTab.current);
  };

  const handleClub = async (club: ClubRow) => {
    if (!user?.id) {
      onRequireAuth();
      return;
    }
    const ok = club.is_member ? await leaveClub(club) : await joinClub(club);
    toast(
      ok ? (club.is_member ? 'Club quitté.' : 'Club rejoint.') : 'Action impossible.',
      ok ? 'success' : 'error'
    );
  };

  const handleEvent = async (event: EventRow) => {
    if (!user?.id) {
      onRequireAuth();
      return;
    }
    const ok = await toggleEvent(event);
    toast(
      ok
        ? event.is_registered
          ? 'Inscription annulée.'
          : 'Inscription confirmée.'
        : 'Action impossible.',
      ok ? 'success' : 'error'
    );
  };

  const detailTitle = selected
    ? 'name' in selected
      ? selected.name
      : (selected as CarnetRow | EventRow).title
    : '';

  const visibleResults = useMemo(
    () => (scope === 'all' ? results : results.filter((result) => result.kind === scope)),
    [results, scope]
  );
  const cardRows: any[] =
    tab === 'carnets'
      ? filteredCarnets
      : tab === 'clubs'
        ? filteredClubs
        : tab === 'sorties'
          ? filteredSorties
          : [];
  const detailStartX = useRef<number | null>(null);

  const resultGroups = useMemo(
    () =>
      SEARCH_KINDS.map((kind) => ({
        ...kind,
        rows: visibleResults.filter((result) => result.kind === kind.id),
      })).filter((group) => group.rows.length > 0),
    [visibleResults]
  );

  return (
    <CommunityDrawer
      open={open}
      onClose={onClose}
      title="Explorer"
      ariaLabel="Explorer la communauté"
      onSwipeLeft={() => {
        if (selected) return;
        const index = SECTION_TABS.findIndex((item) => item.id === tab);
        const next = SECTION_TABS[(index + 1) % SECTION_TABS.length];
        if (next) changeTab(next.id);
      }}
      onSwipeRight={() => {
        if (selected) return;
        const index = SECTION_TABS.findIndex((item) => item.id === tab);
        const prev = SECTION_TABS[(index - 1 + SECTION_TABS.length) % SECTION_TABS.length];
        if (prev) changeTab(prev.id);
      }}
    >
      {tab !== 'recherche' ? (
        <div className="lkdv-search-tabs">
          <CommunityTabSelector value={tab} onChange={changeTab} />
        </div>
      ) : null}

      {tab === 'recherche' ? (
        <div className="lkdv-search-box lkdv-search-box--hero">
          <Icon name="search" size={17} aria-hidden="true" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Posts, carnets, clubs, sorties, membres…"
            aria-label="Rechercher dans toute la communauté"
            data-autofocus={initialSearch ? 'true' : undefined}
          />
          {query ? (
            <button
              type="button"
              className="lkdv-search-clear"
              aria-label="Effacer la recherche"
              onClick={() => setQuery('')}
            >
              <Icon name="x" size={14} aria-hidden="true" />
            </button>
          ) : null}
          <button
            type="button"
            className="lkdv-search-close"
            aria-label="Fermer la recherche"
            onClick={closeSearch}
          >
            <Icon name="x" size={16} aria-hidden="true" />
          </button>
        </div>
      ) : null}

      {query.trim().length >= 2 ? (
        <div className="lkdv-search-results" aria-busy={searching}>
          {searching ? <p className="lkdv-section-loading">Recherche…</p> : null}
          {!searching && visibleResults.length === 0 ? (
            <div className="lkdv-search-empty">
              <p>Aucun résultat pour « {query.trim()} ».</p>
              <button type="button" onClick={() => setQuery('')}>
                Effacer la recherche
              </button>
            </div>
          ) : null}
          {!searching
            ? resultGroups.map((group) => (
                <section
                  key={group.id}
                  className="lkdv-result-group"
                  aria-label={group.label}
                  style={{ '--result-tone': group.tone } as React.CSSProperties}
                >
                  {group.rows.map((result) => (
                    <Link
                      key={`${result.kind}-${result.id}`}
                      href={result.href}
                      className="lkdv-section-row lkdv-result-row"
                      data-kind={result.kind}
                      onClick={onClose}
                    >
                      <Cover src={result.cover} label={result.title} />
                      <span className="lkdv-section-txt">
                        <b>{result.title}</b>
                        <small>{result.meta}</small>
                      </span>
                      <span className="lkdv-result-kind">
                        <span className="lkdv-result-dot" aria-hidden="true" />
                        {group.short}
                      </span>
                      <Icon name="arrow-right" size={14} aria-hidden="true" />
                    </Link>
                  ))}
                </section>
              ))
            : null}
        </div>
      ) : selected ? (
        <div
          className="lkdv-section-detail"
          onPointerDown={(event) => {
            event.stopPropagation();
            detailStartX.current = event.clientX;
          }}
          onPointerUp={(event) => {
            event.stopPropagation();
            const start = detailStartX.current;
            detailStartX.current = null;
            if (start === null) return;
            const dx = event.clientX - start;
            if (Math.abs(dx) < 48) return;
            const index = cardRows.findIndex((row) => row.id === selected.id);
            if (dx > 0) {
              if (index > 0) setSelected(cardRows[index - 1]);
              else setSelected(null);
            } else if (index >= 0 && index < cardRows.length - 1) {
              setSelected(cardRows[index + 1]);
            }
          }}
        >
          <div className="overflow-hidden rounded-2xl bg-white/55 shadow-inner">
            <div className="h-20 w-full bg-[rgba(23,64,44,.12)]">
              {(selected as any).cover_image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={(selected as any).cover_image}
                  alt=""
                  className="h-full w-full object-cover"
                />
              ) : null}
            </div>
            <div className="p-3">
              <h3 className="m-0 text-[15px] font-bold">{detailTitle}</h3>
              <p className="mt-1 text-[11px] text-[#56665D]">
                {'members_count' in selected
                  ? `${selected.members_count ?? 0} membres${selected.category ? ` · ${selected.category}` : ''}`
                  : 'event_date' in selected
                    ? [selected.location, selected.event_date].filter(Boolean).join(' · ')
                    : 'author_name' in selected
                      ? selected.author_name || 'Carnet'
                      : 'Carnet'}
              </p>
              {selected.description ? (
                <p className="mt-2 line-clamp-3 text-[12px] leading-[1.45] text-[#17352A]">
                  {selected.description}
                </p>
              ) : null}
              <div className="mt-3 flex gap-2">
                {'members_count' in selected ? (
                  <button
                    type="button"
                    className="lkdv-section-action"
                    onClick={() => void handleClub(selected as ClubRow)}
                  >
                    {selected.is_member ? 'Quitter' : 'Rejoindre'}
                  </button>
                ) : 'event_date' in selected ? (
                  <button
                    type="button"
                    className="lkdv-section-action"
                    onClick={() => void handleEvent(selected as EventRow)}
                  >
                    {selected.is_registered ? 'Quitter' : 'Rejoindre'}
                  </button>
                ) : null}
                <Link
                  href={
                    'members_count' in selected
                      ? `/clubs/${(selected as ClubRow).slug || selected.id}`
                      : 'event_date' in selected
                        ? '/communaute'
                        : `/clubs/${selected.id}`
                  }
                  className="lkdv-section-action inline-flex items-center justify-center no-underline"
                >
                  Voir la page
                </Link>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div>
          {loading ? <p className="lkdv-section-loading">Chargement…</p> : null}
          {error ? <p className="lkdv-section-empty">{error}</p> : null}

          {!loading && tab === 'carnets' ? (
            <div className="lkdv-ct-grid">
              {filteredCarnets.map((row) => (
                <CarnetTile
                  key={row.id}
                  carnet={row}
                  onNavigate={onClose}
                  onLike={(carnet) => {
                    if (!user?.id || user.is_anonymous) {
                      onRequireAuth();
                      return;
                    }
                    void toggleCarnetLike(carnet).then((ok) => {
                      if (!ok) toast('Action impossible.', 'error');
                    });
                  }}
                />
              ))}
            </div>
          ) : null}

          {!loading && tab === 'clubs' ? (
            <div className="lkdv-section-grid">
              {filteredClubs.map((row) => (
                <SectionTile
                  key={row.id}
                  cover={row.cover_image}
                  title={row.name}
                  meta={`${row.members_count ?? 0} membres${row.category ? ` · ${row.category}` : ''}`}
                  label={row.name}
                  onClick={() => setSelected(row)}
                  action={
                    <button
                      type="button"
                      className="lkdv-section-action"
                      onClick={() => void handleClub(row)}
                    >
                      {row.is_member ? 'Quitter' : 'Rejoindre'}
                    </button>
                  }
                />
              ))}
            </div>
          ) : null}

          {!loading && tab === 'sorties' ? (
            <div className="lkdv-section-grid">
              {filteredSorties.map((row) => (
                <SectionTile
                  key={row.id}
                  cover={row.cover_image}
                  title={row.title}
                  meta={[
                    row.event_date ? new Date(row.event_date).toLocaleDateString('fr-FR') : null,
                    row.location,
                    `${row.current_participants ?? 0}/${row.max_participants ?? '∞'}`,
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                  label={row.title}
                  onClick={() => setSelected(row)}
                  action={
                    <button
                      type="button"
                      className="lkdv-section-action"
                      onClick={() => void handleEvent(row)}
                    >
                      {row.is_registered ? 'Quitter' : 'Rejoindre'}
                    </button>
                  }
                />
              ))}
            </div>
          ) : null}

          {!loading && !error && tab !== 'recherche' ? (
            <div className="lkdv-section-cta">
              <Link
                href={tab === 'carnets' ? '/communaute' : tab === 'clubs' ? '/communaute' : '/hub'}
                onClick={onClose}
              >
                Créer
              </Link>
              <Link
                href={
                  tab === 'carnets'
                    ? '/communaute'
                    : tab === 'clubs'
                      ? '/communaute'
                      : '/communaute'
                }
                onClick={onClose}
              >
                Tout voir
              </Link>
            </div>
          ) : null}
        </div>
      )}

      {!selected && ['carnets', 'clubs', 'sorties'].includes(tab) ? (
        <div className="lkdv-section-mini" role="tablist" aria-label="Filtrer cette section">
          <button
            type="button"
            role="tab"
            aria-selected={filter === 'discover'}
            aria-pressed={filter === 'discover'}
            aria-label="Découvrir"
            onClick={() => setFilter('discover')}
          >
            <Icon name="compass" size={15} aria-hidden="true" />
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={filter === 'mine'}
            aria-pressed={filter === 'mine'}
            aria-label={
              tab === 'sorties' ? 'Mes sorties' : tab === 'clubs' ? 'Mes clubs' : 'Mes carnets'
            }
            onClick={() => setFilter('mine')}
          >
            <Icon
              name={tab === 'clubs' ? 'users' : tab === 'sorties' ? 'map' : 'bookmark'}
              size={15}
              aria-hidden="true"
            />
          </button>
          <button
            type="button"
            role="button"
            aria-label="Rechercher"
            onClick={() => changeTab('recherche')}
          >
            <Icon name="search" size={15} aria-hidden="true" />
          </button>
        </div>
      ) : null}
    </CommunityDrawer>
  );
}

export default CommunitySectionsDrawer;
