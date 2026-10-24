'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import Icon from '@/components/ui/Icon';
import { useToast } from '@/contexts/ToastContext';
import { createClient } from '@/lib/supabase/client';
import { CommunityDrawer } from './CommunityDrawer';
import { CommunityTabSelector, type SectionTabId } from './CommunityTabSelector';
import { useCommunitySections, type CarnetRow, type ClubRow, type EventRow } from './useCommunitySections';

type FilterId = 'discover' | 'mine';
type SearchKind = 'post' | 'carnet' | 'club' | 'sortie' | 'member';
type SearchScope = 'all' | SearchKind;
type SearchResult = { id: string; kind: SearchKind; title: string; meta: string; href: string; cover?: string | null };

const SEARCH_KINDS: Array<{ id: SearchKind; label: string; short: string; tone: string }> = [
  { id: 'post', label: 'Publications', short: 'Post', tone: '#17402C' },
  { id: 'carnet', label: 'Carnets', short: 'Carnet', tone: '#8A6A2F' },
  { id: 'club', label: 'Clubs', short: 'Club', tone: '#3D6F63' },
  { id: 'sortie', label: 'Sorties', short: 'Sortie', tone: '#A05A3C' },
  { id: 'member', label: 'Membres', short: 'Membre', tone: '#4B6B7C' },
];

const SEARCH_SCOPES: Array<{ id: SearchScope; label: string }> = [
  { id: 'all', label: 'Tout' },
  ...SEARCH_KINDS.map((kind) => ({ id: kind.id as SearchScope, label: kind.label })),
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
        <span className="text-[13px] font-bold text-[#17402C]">{label.charAt(0).toUpperCase()}</span>
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
      <button type="button" className="flex min-w-0 flex-1 items-center gap-2.5 text-left" onClick={onClick}>
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
  const { carnets, clubs, sorties, loading, error, joinClub, leaveClub, toggleEvent } = useCommunitySections(user, open);

  useEffect(() => {
    if (!open) return;
    setTab(initialTab);
    setFilter('discover');
    setSelected(null);
    setQuery('');
    setScope('all');
    setResults([]);
  }, [initialTab, open]);

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
          supabase.from('clubs').select('id,slug,name,cover_image,members_count,category').ilike('name', like).limit(5),
          supabase.from('events').select('id,title,location,event_date').ilike('title', like).limit(5),
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
            href: '/evenements',
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
    [carnets, filter, user?.id],
  );
  const filteredClubs = useMemo(
    () => (filter === 'mine' ? clubs.filter((row) => row.is_member) : clubs),
    [clubs, filter],
  );
  const filteredSorties = useMemo(
    () => (filter === 'mine' ? sorties.filter((row) => row.is_registered) : sorties),
    [filter, sorties],
  );

  const changeTab = (next: SectionTabId) => {
    setTab(next);
    setFilter('discover');
    setSelected(null);
  };

  const handleClub = async (club: ClubRow) => {
    if (!user?.id) {
      onRequireAuth();
      return;
    }
    const ok = club.is_member ? await leaveClub(club) : await joinClub(club);
    toast(ok ? (club.is_member ? 'Club quitté.' : 'Club rejoint.') : 'Action impossible.', ok ? 'success' : 'error');
  };

  const handleEvent = async (event: EventRow) => {
    if (!user?.id) {
      onRequireAuth();
      return;
    }
    const ok = await toggleEvent(event);
    toast(ok ? (event.is_registered ? 'Inscription annulée.' : 'Inscription confirmée.') : 'Action impossible.', ok ? 'success' : 'error');
  };

  const detailTitle = selected
    ? 'name' in selected
      ? selected.name
      : (selected as CarnetRow | EventRow).title
    : '';

  const visibleResults = useMemo(
    () => (scope === 'all' ? results : results.filter((result) => result.kind === scope)),
    [results, scope],
  );
  const resultGroups = useMemo(
    () =>
      SEARCH_KINDS.map((kind) => ({
        ...kind,
        rows: visibleResults.filter((result) => result.kind === kind.id),
      })).filter((group) => group.rows.length > 0),
    [visibleResults],
  );

  return (
    <CommunityDrawer open={open} onClose={onClose} title="Explorer" ariaLabel="Explorer la communauté">
      <section className="lkdv-search-section" aria-labelledby="lkdv-search-title">
        <div className="lkdv-search-rail">
          <span className="lkdv-search-kicker">Explorer</span>
          {query.trim().length >= 2 ? (
            <span className="lkdv-search-count">{visibleResults.length} résultat{visibleResults.length > 1 ? 's' : ''}</span>
          ) : (
            <span className="lkdv-search-count">Fil · carnets · clubs · sorties · membres</span>
          )}
        </div>
        <h2 id="lkdv-search-title">Tout trouver</h2>
        <p className="lkdv-search-sub">Une recherche, tous les univers de la communauté.</p>
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
            <button type="button" className="lkdv-search-clear" aria-label="Effacer la recherche" onClick={() => setQuery('')}>
              <Icon name="x" size={14} aria-hidden="true" />
            </button>
          ) : null}
        </div>
        <div className="lkdv-search-scopes" role="tablist" aria-label="Filtrer la recherche">
          {SEARCH_SCOPES.map((item) => {
            const count = item.id === 'all'
              ? results.length
              : results.filter((result) => result.kind === item.id).length;
            return (
              <button
                key={item.id}
                type="button"
                role="tab"
                aria-selected={scope === item.id}
                className="lkdv-search-scope"
                onClick={() => setScope(item.id)}
              >
                {item.label}
                {query.trim().length >= 2 && count > 0 ? <span>{count}</span> : null}
              </button>
            );
          })}
        </div>
      </section>

      {query.trim().length < 2 ? (
        <div className="lkdv-search-tabs">
          <CommunityTabSelector value={tab} onChange={changeTab} />
        </div>
      ) : null}

      {query.trim().length >= 2 ? (
        <div className="lkdv-search-results" aria-busy={searching}>
          {searching ? <p className="lkdv-section-loading">Recherche…</p> : null}
          {!searching && visibleResults.length === 0 ? (
            <div className="lkdv-search-empty">
              <p>Aucun résultat pour « {query.trim()} ».</p>
              <button type="button" onClick={() => setQuery('')}>Effacer la recherche</button>
            </div>
          ) : null}
          {!searching
            ? resultGroups.map((group) => (
                <section key={group.id} className="lkdv-result-group" aria-label={group.label} style={{ '--result-tone': group.tone } as React.CSSProperties}>
                  <header className="lkdv-result-group-head">
                    <span className="lkdv-result-dot" aria-hidden="true" />
                    <b>{group.label}</b>
                    <span>{group.rows.length}</span>
                  </header>
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
      ) : String(tab) === 'pour-toi' ? (
        <div className="lkdv-pourtoi-section">
          <p className="overline">Ton fil</p>
          <h3>Pour toi</h3>
          <p>Retrouve les publications, les carnets, les clubs et les sorties qui comptent pour toi.</p>
          <div className="actions">
            <button type="button" onClick={onClose}>Voir le fil</button>
            <Link href="/carnets" onClick={onClose}>Explorer les carnets</Link>
          </div>
        </div>
      ) : selected ? (
        <div>
          <button type="button" className="mb-2 mt-1 inline-flex items-center gap-1 text-[11px] font-semibold text-[#56665D]" onClick={() => setSelected(null)}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              <path d="M15 6l-6 6 6 6" />
            </svg>
            Retour
          </button>
          <div className="overflow-hidden rounded-2xl bg-white/55 shadow-[inset_0_1px_0_rgba(255,255,255,.95)]">
            <div className="h-20 w-full bg-[rgba(23,64,44,.12)]">
              {(selected as any).cover_image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={(selected as any).cover_image} alt="" className="h-full w-full object-cover" />
              ) : null}
            </div>
            <div className="p-3">
              <h3 className="m-0 text-[15px] font-bold">{detailTitle}</h3>
              <p className="mt-1 text-[11px] text-[#56665D]">
                {'members_count' in selected
                  ? `${selected.members_count ?? 0} membres${selected.category ? ` · ${selected.category}` : ''}`
                  : 'event_date' in selected
                    ? [selected.location, selected.event_date].filter(Boolean).join(' · ')
                    : 'author_name' in selected ? selected.author_name || 'Carnet' : 'Carnet'}
              </p>
              {selected.description ? (
                <p className="mt-2 line-clamp-3 text-[12px] leading-[1.45] text-[#17352A]">{selected.description}</p>
              ) : null}
              <div className="mt-3 flex gap-2">
                {'members_count' in selected ? (
                  <button type="button" className="lkdv-section-action" onClick={() => void handleClub(selected as ClubRow)}>
                    {selected.is_member ? 'Quitter' : 'Rejoindre'}
                  </button>
                ) : 'event_date' in selected ? (
                  <button type="button" className="lkdv-section-action" onClick={() => void handleEvent(selected as EventRow)}>
                    {selected.is_registered ? 'Quitter' : 'Rejoindre'}
                  </button>
                ) : null}
                <Link
                  href={
                    'members_count' in selected
                      ? `/clubs/${(selected as ClubRow).slug || selected.id}`
                      : 'event_date' in selected
                        ? '/evenements'
                        : `/carnets/${selected.id}`
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
          <div className="lkdv-section-filters">
            <button type="button" aria-pressed={filter === 'discover'} onClick={() => setFilter('discover')}>
              Découvrir
            </button>
            <button type="button" aria-pressed={filter === 'mine'} onClick={() => setFilter('mine')}>
              {tab === 'sorties' ? 'Mes sorties' : tab === 'clubs' ? 'Mes clubs' : 'Mes carnets'}
            </button>
          </div>

          {loading ? <p className="lkdv-section-loading">Chargement…</p> : null}
          {error ? <p className="lkdv-section-empty">{error}</p> : null}

          {!loading && tab === 'carnets'
            ? filteredCarnets.map((row) => (
                <SectionRow
                  key={row.id}
                  cover={row.cover_image}
                  title={row.title}
                  meta={[row.author_name, row.created_at ? new Date(row.created_at).toLocaleDateString('fr-FR') : null].filter(Boolean).join(' · ')}
                  label={row.title}
                  onClick={() => setSelected(row)}
                />
              ))
            : null}

          {!loading && tab === 'clubs'
            ? filteredClubs.map((row) => (
                <SectionRow
                  key={row.id}
                  cover={row.cover_image}
                  title={row.name}
                  meta={`${row.members_count ?? 0} membres${row.category ? ` · ${row.category}` : ''}`}
                  label={row.name}
                  onClick={() => setSelected(row)}
                  action={
                    <button type="button" className="lkdv-section-action" onClick={() => void handleClub(row)}>
                      {row.is_member ? 'Quitter' : 'Rejoindre'}
                    </button>
                  }
                />
              ))
            : null}

          {!loading && tab === 'sorties'
            ? filteredSorties.map((row) => (
                <SectionRow
                  key={row.id}
                  cover={row.cover_image}
                  title={row.title}
                  meta={[row.event_date ? new Date(row.event_date).toLocaleDateString('fr-FR') : null, row.location, `${row.current_participants ?? 0}/${row.max_participants ?? '∞'}`].filter(Boolean).join(' · ')}
                  label={row.title}
                  onClick={() => setSelected(row)}
                  action={
                    <button type="button" className="lkdv-section-action" onClick={() => void handleEvent(row)}>
                      {row.is_registered ? 'Quitter' : 'Rejoindre'}
                    </button>
                  }
                />
              ))
            : null}

          {!loading && !error ? (
            <div className="lkdv-section-cta">
              <Link href={tab === 'carnets' ? '/carnets/nouveau' : tab === 'clubs' ? '/clubs/nouveau' : '/voyages'} onClick={onClose}>
                Créer
              </Link>
              <Link href={tab === 'carnets' ? '/carnets' : tab === 'clubs' ? '/clubs' : '/evenements'} onClick={onClose}>
                Tout voir
              </Link>
            </div>
          ) : null}
        </div>
      )}
    </CommunityDrawer>
  );
}

export default CommunitySectionsDrawer;
