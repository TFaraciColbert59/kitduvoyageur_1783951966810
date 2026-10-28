'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  BookOpen,
  Compass,
  FileText,
  Layers,
  Plus,
  Search,
  Sparkles,
  User,
  UserRound,
  Users,
} from 'lucide-react';
import {
  DrawerShell,
  type DrawerSecondaryItem,
  type DrawerTab,
} from '@/components/compte/drawer/shell/DrawerShell';
import { useToast } from '@/contexts/ToastContext';
import { useRecentSearches } from '@/hooks/useRecentSearches';
import { CommunityCardDrawer } from '@/features/community/card/shell/CommunityCardDrawer';
import {
  countByScope,
  filterByScope,
  type SearchScope,
} from '@/features/community/card/sections/search';
import {
  SECTION_TABS,
  sectionIndex,
  type SectionTabId,
} from '@/features/community/card/sections/sectionTabs';
import { useCommunitySearch } from '@/features/community/card/sections/useCommunitySearch';
import { useCommunitySections } from '@/features/community/card/sections/useCommunitySections';
import { ExplorerDetail, itemKey, type ExplorerItem } from './ExplorerCard';
import { ForYouPane, ListPane, SearchPane, type Rail } from './panes';

export type ProposeKind = 'carnet' | 'club' | 'sortie';

export interface ExplorerDrawerProps {
  open: boolean;
  initialTab: SectionTabId;
  initialSearch?: boolean;
  user: any;
  onClose: () => void;
  onRequireAuth: () => void;
  /** « Proposer » : ouvre le drawer Créer sur le bon type. */
  onPropose: (kind: ProposeKind) => void;
}

const TAB_ICONS: Record<SectionTabId, React.ReactNode> = {
  recherche: <Search size={18} aria-hidden="true" />,
  'pour-toi': <Sparkles size={18} aria-hidden="true" />,
  carnets: <BookOpen size={18} aria-hidden="true" />,
  clubs: <Users size={18} aria-hidden="true" />,
  sorties: <Compass size={18} aria-hidden="true" />,
};

const SCOPES: ReadonlyArray<{ id: SearchScope; label: string; icon: React.ReactNode }> = [
  { id: 'all', label: 'Tout', icon: <Layers size={15} aria-hidden="true" /> },
  { id: 'post', label: 'Publications', icon: <FileText size={15} aria-hidden="true" /> },
  { id: 'carnet', label: 'Carnets', icon: <BookOpen size={15} aria-hidden="true" /> },
  { id: 'club', label: 'Clubs', icon: <Users size={15} aria-hidden="true" /> },
  { id: 'sortie', label: 'Sorties', icon: <Compass size={15} aria-hidden="true" /> },
  { id: 'member', label: 'Membres', icon: <User size={15} aria-hidden="true" /> },
];

const PROPOSE_BY_TAB: Partial<Record<SectionTabId, ProposeKind>> = {
  carnets: 'carnet',
  clubs: 'club',
  sorties: 'sortie',
};
const MINE_LABEL: Partial<Record<SectionTabId, string>> = {
  carnets: 'Mes carnets',
  clubs: 'Mes clubs',
  sorties: 'Mes sorties',
};
const EMPTY_MINE: Partial<Record<SectionTabId, { title: string; hint: string }>> = {
  carnets: { title: 'Aucun carnet à toi', hint: 'Raconte ta prochaine aventure, jour après jour.' },
  clubs: { title: 'Tu n’as rejoint aucun club', hint: 'Rejoins une cordée ou crée la tienne.' },
  sorties: {
    title: 'Aucune sortie prévue',
    hint: 'Inscris-toi à une sortie ou propose la tienne.',
  },
};

export function ExplorerDrawer({
  open,
  initialTab,
  initialSearch = false,
  user,
  onClose,
  onRequireAuth,
  onPropose,
}: ExplorerDrawerProps) {
  const { toast } = useToast();
  const router = useRouter();
  const [index, setIndex] = useState(() => sectionIndex(initialSearch ? 'recherche' : initialTab));
  const [scopeIndex, setScopeIndex] = useState(0);
  const [modes, setModes] = useState<Record<string, number>>({ carnets: 0, clubs: 0, sorties: 0 });
  const [query, setQuery] = useState('');
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const { recentSearches, addSearch, removeSearch } = useRecentSearches();

  const data = useCommunitySections(user, open);
  const search = useCommunitySearch(query, open && index === 0);
  const scope = SCOPES[scopeIndex]?.id ?? 'all';

  useEffect(() => {
    if (!open) return;
    setIndex(sectionIndex(initialSearch ? 'recherche' : initialTab));
    setScopeIndex(0);
    setModes({ carnets: 0, clubs: 0, sorties: 0 });
    setQuery('');
    setSelectedKey(null);
  }, [initialSearch, initialTab, open]);

  useEffect(() => {
    if (!open || !initialSearch) return;
    const timer = window.setTimeout(
      () => document.querySelector<HTMLElement>('.lkdv-cd [data-autofocus]')?.focus(),
      140
    );
    return () => window.clearTimeout(timer);
  }, [initialSearch, open]);

  const activeId = SECTION_TABS[index]?.id ?? 'recherche';

  const all = useMemo(() => {
    const carnets: ExplorerItem[] = data.carnets.map((row) => ({ kind: 'carnet', row }));
    const clubs: ExplorerItem[] = data.clubs.map((row) => ({ kind: 'club', row }));
    const sorties: ExplorerItem[] = data.sorties.map((row) => ({ kind: 'sortie', row }));
    return { carnets, clubs, sorties };
  }, [data.carnets, data.clubs, data.sorties]);

  const listFor = useCallback(
    (id: 'carnets' | 'clubs' | 'sorties'): ExplorerItem[] => {
      const items = all[id];
      if (modes[id] !== 1) return items;
      return items.filter((item) => {
        if (item.kind === 'carnet') return item.row.author_id === user?.id;
        if (item.kind === 'club') return Boolean(item.row.is_member);
        return Boolean(item.row.is_registered);
      });
    },
    [all, modes, user?.id]
  );

  const selected = useMemo(
    () =>
      [...all.carnets, ...all.clubs, ...all.sorties].find(
        (item) => itemKey(item) === selectedKey
      ) ?? null,
    [all, selectedKey]
  );

  const requireUser = useCallback(() => {
    if (user?.id && !user.is_anonymous) return true;
    onRequireAuth();
    return false;
  }, [onRequireAuth, user?.id, user?.is_anonymous]);

  const act = useCallback(
    async (item: ExplorerItem) => {
      if (item.kind === 'carnet') {
        setSelectedKey(itemKey(item));
        return;
      }
      if (!requireUser()) return;
      if (item.kind === 'club') {
        const ok = item.row.is_member
          ? await data.leaveClub(item.row)
          : await data.joinClub(item.row);
        toast(
          ok ? (item.row.is_member ? 'Club quitté.' : 'Club rejoint.') : 'Action impossible.',
          ok ? 'success' : 'error'
        );
      } else {
        const ok = await data.toggleEvent(item.row);
        toast(
          ok
            ? item.row.is_registered
              ? 'Inscription annulée.'
              : 'Inscription confirmée.'
            : 'Action impossible.',
          ok ? 'success' : 'error'
        );
      }
    },
    [data, requireUser, toast]
  );

  const goTab = (id: SectionTabId) => {
    setIndex(sectionIndex(id));
    setSelectedKey(null);
  };

  const rails: Rail[] = [
    {
      kind: 'carnet',
      title: 'Carnets récents',
      items: all.carnets.slice(0, 8),
      empty: 'Aucun carnet pour l’instant.',
    },
    {
      kind: 'club',
      title: 'Clubs actifs',
      items: all.clubs.slice(0, 8),
      empty: 'Aucun club pour l’instant.',
    },
    {
      kind: 'sortie',
      title: 'Sorties à venir',
      items: all.sorties.slice(0, 8),
      empty: 'Aucune sortie prévue.',
    },
  ];

  const renderList = (id: 'carnets' | 'clubs' | 'sorties') => {
    if (
      selected &&
      selected.kind === (id === 'carnets' ? 'carnet' : id === 'clubs' ? 'club' : 'sortie')
    ) {
      return (
        <ExplorerDetail
          item={selected}
          onBack={() => setSelectedKey(null)}
          onAction={() => void act(selected)}
          onClose={onClose}
        />
      );
    }
    const empty = EMPTY_MINE[id] as { title: string; hint: string };
    return (
      <ListPane
        label={SECTION_TABS[sectionIndex(id)]?.label ?? id}
        items={listFor(id)}
        mine={modes[id] === 1}
        emptyTitle={empty.title}
        emptyHint={empty.hint}
        onOpen={(item) => setSelectedKey(itemKey(item))}
        onAction={(item) => void act(item)}
        onPropose={() => onPropose(PROPOSE_BY_TAB[id] as ProposeKind)}
        onLikeCarnet={(carnet) => {
          if (!requireUser()) return;
          void data.toggleCarnetLike(carnet).then((ok) => {
            if (!ok) toast('Action impossible.', 'error');
          });
        }}
        onNavigate={onClose}
        resetKey={`${id}-${modes[id]}`}
      />
    );
  };

  const visibleResults = filterByScope(search.results, scope);

  const tabs: DrawerTab[] = SECTION_TABS.map((tab) => ({
    id: tab.id,
    label: tab.label,
    icon: TAB_ICONS[tab.id],
    render: () => {
      if (tab.id === 'recherche') {
        return (
          <SearchPane
            query={query}
            onQuery={setQuery}
            results={visibleResults}
            searching={search.searching}
            recents={recentSearches.map((entry) => entry.query)}
            onRemoveRecent={removeSearch}
            autoFocus={initialSearch}
            onNavigate={() => {
              addSearch(query);
              onClose();
            }}
            resetKey={`${search.text}-${scope}`}
          />
        );
      }
      if (tab.id === 'pour-toi') {
        return (
          <ForYouPane
            rails={rails}
            onOpen={(item) => {
              // Un carnet s'ouvre directement sur sa page ; clubs et sorties s'ouvrent en place.
              if (item.kind === 'carnet') {
                onClose();
                router.push(`/carnets/${item.row.id}`);
                return;
              }
              goTab(item.kind === 'club' ? 'clubs' : 'sorties');
              setSelectedKey(itemKey(item));
            }}
            onSeeAll={(kind) =>
              goTab(kind === 'carnet' ? 'carnets' : kind === 'club' ? 'clubs' : 'sorties')
            }
          />
        );
      }
      return renderList(tab.id);
    },
  }));

  const modeItems = (id: SectionTabId): DrawerSecondaryItem[] => [
    { id: 'discover', label: 'Découvrir', icon: <Compass size={15} aria-hidden="true" /> },
    {
      id: 'mine',
      label: MINE_LABEL[id] ?? 'Mes éléments',
      icon: <UserRound size={15} aria-hidden="true" />,
    },
    { id: 'propose', label: 'Proposer', icon: <Plus size={15} aria-hidden="true" /> },
  ];

  const secondary =
    activeId === 'recherche'
      ? {
          items: SCOPES.map((entry) => ({
            id: entry.id,
            label: `${entry.label}${search.text.length >= 2 ? ` (${countByScope(search.results, entry.id)})` : ''}`,
            icon: entry.icon,
          })),
          active: scopeIndex,
          onChange: setScopeIndex,
          label: 'Filtrer la recherche',
        }
      : activeId === 'pour-toi'
        ? undefined
        : {
            items: modeItems(activeId),
            active: modes[activeId] ?? 0,
            onChange: (next: number) => {
              if (next === 2) {
                onPropose(PROPOSE_BY_TAB[activeId] as ProposeKind);
                return;
              }
              setModes((current) => ({ ...current, [activeId]: next }));
              setSelectedKey(null);
            },
            label: 'Filtrer la liste',
          };

  const needsData = index >= 1;
  const state =
    needsData && data.loading && data.carnets.length + data.clubs.length + data.sorties.length === 0
      ? 'loading'
      : needsData && data.error
        ? 'error'
        : 'ready';

  return (
    <CommunityCardDrawer open={open} onClose={onClose} ariaLabel="Explorer la communauté" strict>
      <DrawerShell
        tabs={tabs}
        activeIndex={index}
        secondary={secondary}
        state={state}
        onRetry={() => void data.reload()}
        onIndexChange={(next) => {
          if (next === index) onClose();
          else goTab(SECTION_TABS[next]?.id ?? 'recherche');
        }}
      />
    </CommunityCardDrawer>
  );
}

export default ExplorerDrawer;
