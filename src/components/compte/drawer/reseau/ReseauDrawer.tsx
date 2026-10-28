'use client';

import React, { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { DrawerEmpty, DrawerError, DrawerShell, DrawerSkeleton, type DrawerTab } from '../shell/DrawerShell';
import { DrawerAuthRequired } from '../shell/DrawerAuthRequired';
import { useAuth } from '@/contexts/AuthContext';
import { UserRow } from './UserRow';
import type { FollowRequestItem, ReseauPayload, ReseauUser } from '@/features/compte/server/reseau';
import { LKDVIcon } from '@/components/ui/LKDVIcon';

async function getJson<T>(url: string): Promise<T> {
  const response = await fetch(url, { headers: { accept: 'application/json' } });
  if (!response.ok) throw new Error(`http_${response.status}`);
  return (await response.json()) as T;
}

const FILTERS = [
  { id: 'all', label: 'Tous', icon: <LKDVIcon name="communaute" size={15} aria-hidden="true" /> },
  { id: 'mutual', label: 'Mutuels', icon: <LKDVIcon name="amis" size={15} aria-hidden="true" /> },
  { id: 'recent', label: 'Récents', icon: <LKDVIcon name="duree" size={15} aria-hidden="true" /> },
] as const;

export function ReseauDrawer({ initialTab = 0 }: { initialTab?: number }) {
  const queryClient = useQueryClient();
  const { user, loading: authLoading } = useAuth();
  const [tab, setTab] = useState(initialTab === 1 ? 1 : 0);
  const [filter, setFilter] = useState(0);
  const [search, setSearch] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);

  const followingQuery = useQuery({
    queryKey: ['reseau', 'following'],
    queryFn: () => getJson<ReseauPayload>('/api/compte/reseau/following'),
    enabled: Boolean(user) && tab === 0,
    staleTime: 30_000,
  });
  const followersQuery = useQuery({
    queryKey: ['reseau', 'followers'],
    queryFn: () => getJson<ReseauPayload>('/api/compte/reseau/followers'),
    enabled: Boolean(user) && tab === 1,
    staleTime: 30_000,
  });
  const requestsQuery = useQuery({
    queryKey: ['reseau', 'requests'],
    queryFn: () => getJson<{ requests: FollowRequestItem[] }>('/api/compte/reseau/requests'),
    enabled: Boolean(user) && tab === 1,
    staleTime: 15_000,
  });
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['reseau'] });

  const followMutation = useMutation({
    mutationFn: async ({ user, action }: { user: ReseauUser; action: 'follow' | 'unfollow' }) => {
      setBusyId(user.id);
      const response = await fetch('/api/compte/reseau/follow', {
        method: action === 'follow' ? 'POST' : 'DELETE',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ userId: user.id }),
      });
      if (!response.ok) throw new Error('follow_failed');
      return response.json();
    },
    onSettled: () => {
      setBusyId(null);
      void invalidate();
    },
  });

  const requestMutation = useMutation({
    mutationFn: async ({ request, action }: { request: FollowRequestItem; action: 'accept' | 'decline' }) => {
      setBusyId(request.id);
      const response = await fetch('/api/compte/reseau/requests', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ requestId: request.id, action }),
      });
      if (!response.ok) throw new Error('request_failed');
      return response.json();
    },
    onSettled: () => {
      setBusyId(null);
      void invalidate();
    },
  });

  const activeQuery = tab === 0 ? followingQuery : followersQuery;
  const requests = requestsQuery.data?.requests ?? [];

  const followingIds = useMemo(
    () => new Set((followingQuery.data?.users ?? []).map((user) => user.id)),
    [followingQuery.data]
  );

  const newFollowers = useMemo(() => {
    const weekAgo = Date.now() - 7 * 86_400_000;
    return (followersQuery.data?.users ?? []).filter((user) => {
      if (!user.followedAt) return false;
      const time = Date.parse(user.followedAt);
      return Number.isFinite(time) && time >= weekAgo;
    });
  }, [followersQuery.data]);

  const visibleUsers = useMemo(() => {
    const users = activeQuery.data?.users ?? [];
    const needle = search.trim().toLowerCase();
    return users.filter((user) => {
      if (needle) {
        const haystack = `${user.name} ${user.handle} ${user.massif ?? ''}`.toLowerCase();
        if (!haystack.includes(needle)) return false;
      }
      if (filter === 1 && user.relation !== 'mutual') return false;
      if (filter === 2 && !user.lastActivityAt) return false;
      return true;
    });
  }, [activeQuery.data, filter, search]);

  const renderNewFollowers = () => {
    if (tab !== 1 || search.trim() || filter > 0 || newFollowers.length === 0) return null;
    return (
      <section className="lkdv-reseau-new" aria-label="Nouveaux abonnés">
        <div className="lkdv-reseau-strip-head">
          <b>Nouveaux</b>
          <span>7 derniers jours</span>
        </div>
        <div className="lkdv-reseau-new-rows">
          {newFollowers.slice(0, 4).map((user) => (
            <div key={user.id} className="lkdv-reseau-new-row">
              <a className="lkdv-reseau-strip-avatar" href={`/profil/${encodeURIComponent(user.handle)}`} aria-label={`Profil de ${user.name}`}>
                {user.avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={user.avatarUrl} alt="" loading="lazy" />
                ) : (
                  user.name.charAt(0).toUpperCase()
                )}
              </a>
              <div className="lkdv-reseau-meta">
                <div className="lkdv-reseau-name">
                  <a href={`/profil/${encodeURIComponent(user.handle)}`}><b>{user.name}</b></a>
                  <span className="lkdv-reseau-new-badge">Nouveau</span>
                </div>
                <div className="lkdv-reseau-sub">@{user.handle}</div>
              </div>
            </div>
          ))}
        </div>
      </section>
    );
  };

  const renderRequests = () => {
    if (tab !== 1 || requests.length === 0) return null;
    return (
      <section className="lkdv-reseau-requests" aria-label="Demandes d’abonnement">
        <div className="lkdv-reseau-strip-head">
          <b>Demandes</b>
          <span>{requests.length}</span>
        </div>
        {requests.map((request) => (
          <div key={request.id} className="lkdv-reseau-request">
            <span className="lkdv-reseau-avatar" aria-hidden="true">
              {request.user.avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={request.user.avatarUrl} alt="" loading="lazy" />
              ) : (
                request.user.name.charAt(0).toUpperCase()
              )}
            </span>
            <div className="lkdv-reseau-meta">
              <div className="lkdv-reseau-name"><b>{request.user.name}</b></div>
              <div className="lkdv-reseau-sub">@{request.user.handle} veut te suivre</div>
            </div>
            <div className="lkdv-reseau-request-actions">
              <button
                type="button"
                className="lkdv-reseau-follow on"
                disabled={busyId === request.id}
                onClick={() => requestMutation.mutate({ request, action: 'accept' })}
              >
                <LKDVIcon name="valider" size={14} aria-hidden="true" /> Accepter
              </button>
              <button
                type="button"
                className="lkdv-reseau-icon"
                disabled={busyId === request.id}
                onClick={() => requestMutation.mutate({ request, action: 'decline' })}
                aria-label="Refuser la demande"
              >
                <LKDVIcon name="fermer" size={15} aria-hidden="true" />
              </button>
            </div>
          </div>
        ))}
      </section>
    );
  };

  const renderList = () => {
    if (activeQuery.isLoading) {
      return (
        <div className="lkdv-reseau-rows" aria-busy="true">
          {[0, 1, 2].map((index) => <span key={index} className="lkdv-reseau-skel" />)}
        </div>
      );
    }
    if (activeQuery.isError) return <DrawerError onRetry={() => void activeQuery.refetch()} />;
    if (visibleUsers.length === 0) {
      return (
        <DrawerEmpty
          title={search || filter > 0 ? 'Aucun résultat' : tab === 0 ? 'Tu ne suis personne' : 'Personne ne te suit encore'}
          hint={
            search || filter > 0
              ? 'Essaie un autre filtre ou une autre recherche.'
              : tab === 0
                ? 'Découvre des randonneurs de ton massif.'
                : 'Partage ton profil pour développer ton réseau.'
          }
        />
      );
    }
    return (
      <div className="lkdv-reseau-rows">
        {visibleUsers.map((user) => (
          <UserRow
            key={user.id}
            user={user}
            mode={tab === 0 ? 'following' : 'followers'}
            busy={busyId === user.id}
            onFollow={(target) => followMutation.mutate({ user: target, action: 'follow' })}
            onUnfollow={(target) => followMutation.mutate({ user: target, action: 'unfollow' })}
          />
        ))}
      </div>
    );
  };

  const renderPane = (kind: 'following' | 'followers') => (
    <div className="lkdv-reseau-pane" data-pane={kind}>
      <label className="lkdv-reseau-search">
        <LKDVIcon name="recherche" size={15} aria-hidden="true" />
        <input
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Rechercher un nom, un handle, un massif"
          aria-label="Rechercher dans le réseau"
        />
      </label>
      {kind === 'followers' ? renderRequests() : null}
      {kind === 'followers' ? renderNewFollowers() : null}
      <div className="lkdv-reseau-count">
        {kind === 'following'
          ? `${followingQuery.data?.total ?? 0} abonnements · ${followingQuery.data?.mutuals ?? 0} mutuels`
          : `${followersQuery.data?.total ?? 0} abonnés · ${followersQuery.data?.mutuals ?? 0} mutuels`}
      </div>
      {renderList()}
    </div>
  );

  const tabs: DrawerTab[] = [
    {
      id: 'following',
      label: 'Abonnements',
      icon: <LKDVIcon name="profil" size={18} aria-hidden="true" />,
      render: () => renderPane('following'),
    },
    {
      id: 'followers',
      label: 'Abonnés',
      icon: <LKDVIcon name="communaute" size={18} aria-hidden="true" />,
      render: () => renderPane('followers'),
    },
  ];

  if (authLoading) {
    return (
      <div className="lkdv-drawer-shell">
        <DrawerSkeleton />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="lkdv-drawer-shell">
        <DrawerAuthRequired
          title="Connecte-toi pour voir ton réseau"
          hint="Tes abonnés et tes demandes sont privés. La connexion prend quelques secondes."
        />
      </div>
    );
  }

  return (
    <>
      <DrawerShell
        tabs={tabs}
        activeIndex={tab}
        onIndexChange={setTab}
        secondary={{
          items: FILTERS.map((item) => ({ id: item.id, label: item.label, icon: item.icon })),
          active: filter,
          onChange: setFilter,
          label: 'Filtres du réseau',
        }}
      />
      <style dangerouslySetInnerHTML={{ __html: RESEAU_CSS }} />
    </>
  );
}

export const RESEAU_CSS = `
.lkdv-reseau-pane{display:flex!important;flex-direction:column!important;gap:10px!important;padding:4px 0 10px!important;}
.lkdv-reseau-search{display:flex!important;align-items:center!important;gap:8px!important;height:40px!important;padding:0 12px!important;border-radius:14px!important;background:rgba(255,255,255,.55)!important;box-shadow:inset 0 1px 0 rgba(255,255,255,.95),0 0 0 .5px rgba(23,43,36,.1)!important;color:var(--label2)!important;flex:none!important;}
.lkdv-reseau-search input{flex:1!important;min-width:0!important;border:0!important;background:none!important;outline:none!important;font:500 13px var(--sf)!important;color:var(--label)!important;}
.lkdv-reseau-search input::placeholder{color:var(--label3)!important;}
.lkdv-reseau-count{font:500 11.5px var(--sf)!important;color:var(--label2)!important;padding:0 2px!important;}
.lkdv-reseau-strip,.lkdv-reseau-requests{display:flex!important;flex-direction:column!important;gap:7px!important;padding:10px 12px!important;border-radius:18px!important;background:rgba(255,255,255,.5)!important;box-shadow:inset 0 1px 0 rgba(255,255,255,.95),0 0 0 .5px rgba(23,43,36,.08)!important;}
.lkdv-reseau-strip-head{display:flex!important;align-items:center!important;justify-content:space-between!important;gap:8px!important;font:600 12.5px var(--sf)!important;}
.lkdv-reseau-strip-head span{font:500 11px var(--sf)!important;color:var(--label2)!important;}
.lkdv-reseau-strip-avatars{display:flex!important;gap:6px!important;overflow-x:auto!important;scrollbar-width:none!important;padding:1px 0!important;}
.lkdv-reseau-strip-avatars::-webkit-scrollbar{display:none!important;}
.lkdv-reseau-strip-avatar{width:34px!important;height:34px!important;border-radius:50%!important;flex:none!important;display:grid!important;place-items:center!important;background:linear-gradient(155deg,#fff,#DDEBD8)!important;color:#17402C!important;font:700 12px var(--sf)!important;overflow:hidden!important;box-shadow:inset 0 1px 0 #fff,0 0 0 .5px rgba(23,43,36,.12)!important;}
.lkdv-reseau-strip-avatar img{width:100%!important;height:100%!important;object-fit:cover!important;}
.lkdv-reseau-strip p{margin:0!important;font:400 11.5px/1.35 var(--sf)!important;color:var(--label2)!important;}
.lkdv-reseau-rows{display:flex!important;flex-direction:column!important;gap:6px!important;}
.lkdv-reseau-row{display:grid!important;grid-template-columns:44px minmax(0,1fr) auto!important;align-items:center!important;gap:10px!important;padding:8px 9px!important;border-radius:16px!important;background:rgba(255,255,255,.52)!important;box-shadow:inset 0 1px 0 rgba(255,255,255,.95),0 0 0 .5px rgba(23,43,36,.07)!important;}
.lkdv-reseau-avatar{width:44px!important;height:44px!important;border-radius:50%!important;display:grid!important;place-items:center!important;overflow:hidden!important;background:linear-gradient(155deg,#fff,#DDEBD8)!important;color:#17402C!important;font:700 14px var(--sf)!important;box-shadow:inset 0 1px 0 #fff,0 0 0 .5px rgba(23,43,36,.12)!important;}
.lkdv-reseau-avatar img{width:100%!important;height:100%!important;object-fit:cover!important;}
.lkdv-reseau-meta{min-width:0!important;}
.lkdv-reseau-name{display:flex!important;align-items:center!important;gap:4px!important;min-width:0!important;}
.lkdv-reseau-name b{font:600 13.5px/1.2 var(--sf)!important;white-space:nowrap!important;overflow:hidden!important;text-overflow:ellipsis!important;}
.lkdv-reseau-name svg{color:var(--good,#3D7A52)!important;flex:none!important;}
.lkdv-reseau-sub{font:400 11.5px/1.3 var(--sf)!important;color:var(--label2)!important;white-space:nowrap!important;overflow:hidden!important;text-overflow:ellipsis!important;}
.lkdv-reseau-hint{display:flex!important;align-items:center!important;gap:4px!important;font:500 10.5px/1.3 var(--sf)!important;color:var(--label3)!important;}
.lkdv-reseau-actions{display:flex!important;align-items:center!important;gap:3px!important;}
.lkdv-reseau-follow{display:inline-flex!important;align-items:center!important;gap:4px!important;height:28px!important;padding:0 9px!important;border:0!important;border-radius:999px!important;background:var(--pg,rgba(23,64,44,.12))!important;color:var(--pg-ink,#17402C)!important;font:600 11px var(--sf)!important;cursor:pointer!important;white-space:nowrap!important;}
.lkdv-reseau-follow.on{background:rgba(23,43,36,.07)!important;color:var(--label2)!important;}
.lkdv-reseau-follow.confirm{background:rgba(179,58,44,.12)!important;color:#9C2F22!important;box-shadow:inset 0 0 0 .5px rgba(179,58,44,.2)!important;}
.lkdv-reseau-follow:disabled,.lkdv-reseau-icon:disabled{opacity:.45!important;cursor:default!important;}
.lkdv-reseau-icon{width:28px!important;height:28px!important;display:grid!important;place-items:center!important;border:0!important;border-radius:50%!important;background:rgba(255,255,255,.5)!important;color:var(--label2)!important;box-shadow:inset 0 1px 0 #fff,0 0 0 .5px rgba(23,43,36,.08)!important;cursor:pointer!important;text-decoration:none!important;}
.lkdv-reseau-icon.on{color:#8a6418!important;background:rgba(232,192,104,.25)!important;}
.lkdv-reseau-request{display:grid!important;grid-template-columns:40px minmax(0,1fr) auto!important;align-items:center!important;gap:8px!important;}
.lkdv-reseau-request .lkdv-reseau-avatar{width:40px!important;height:40px!important;}
.lkdv-reseau-request-actions{display:flex!important;align-items:center!important;gap:3px!important;}
.lkdv-reseau-skel{display:block!important;height:60px!important;border-radius:16px!important;background:linear-gradient(90deg,rgba(255,255,255,.35),rgba(255,255,255,.7),rgba(255,255,255,.35))!important;background-size:200% 100%!important;animation:lkdvDrawerShimmer 1.4s ease-in-out infinite!important;}
.lkdv-reseau-new,.lkdv-reseau-suggest{display:flex!important;flex-direction:column!important;gap:6px!important;padding:10px 12px!important;border-radius:18px!important;background:rgba(255,255,255,.48)!important;box-shadow:inset 0 1px 0 rgba(255,255,255,.95),0 0 0 .5px rgba(23,43,36,.08)!important;}
.lkdv-reseau-new-rows{display:flex!important;flex-direction:column!important;gap:6px!important;}
.lkdv-reseau-new-row{display:grid!important;grid-template-columns:34px minmax(0,1fr) auto!important;align-items:center!important;gap:8px!important;}
.lkdv-reseau-new-row .lkdv-reseau-strip-avatar{width:34px!important;height:34px!important;}
.lkdv-reseau-new-badge{display:inline-flex!important;align-items:center!important;height:17px!important;padding:0 6px!important;border-radius:999px!important;background:rgba(61,122,82,.12)!important;color:#2C5E3E!important;font:600 8.5px var(--sf)!important;letter-spacing:.03em!important;text-transform:uppercase!important;}
@media (max-width:380px){.lkdv-reseau-row{grid-template-columns:40px minmax(0,1fr) auto!important;gap:7px!important;}.lkdv-reseau-avatar{width:40px!important;height:40px!important;}.lkdv-reseau-icon:nth-of-type(3){display:none!important;}}
`;
