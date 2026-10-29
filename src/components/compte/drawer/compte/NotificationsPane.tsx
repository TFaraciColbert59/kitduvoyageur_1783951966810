'use client';

import React, { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Bell, CheckCheck } from 'lucide-react';
import type { NotificationItem } from '@/features/compte/server/compte';
import { ActionPill } from '@/components/ui/ActionPill';
import { DrawerEmpty, DrawerError, DrawerSkeleton } from '../shell/DrawerShell';
import {
  NOTIFICATION_GROUP_LABEL,
  fetchJson,
  initials,
  notificationIcon,
  timeAgo,
} from './shared';

type Group = 'today' | 'yesterday' | 'week' | 'earlier';
const GROUPS: Array<{ id: Group; label: string }> = [
  { id: 'today', label: "Aujourd'hui" },
  { id: 'yesterday', label: 'Hier' },
  { id: 'week', label: 'Cette semaine' },
  { id: 'earlier', label: 'Plus tôt' },
];

function startOfDay(date: Date): number {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy.getTime();
}

function groupOf(value: string): Group {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'earlier';
  const today = startOfDay(new Date());
  const day = startOfDay(date);
  const delta = Math.round((today - day) / 86_400_000);
  if (delta <= 0) return 'today';
  if (delta === 1) return 'yesterday';
  if (delta < 7) return 'week';
  return 'earlier';
}

const FILTERS = ['all', 'social', 'loans', 'orders', 'system'] as const;

export function NotificationsPane({ filter = 0 }: { filter?: number }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState(false);
  const query = useQuery({
    queryKey: ['compte', 'notifications'],
    queryFn: () =>
      fetchJson<{ notifications: NotificationItem[]; unread: number }>(
        '/api/compte/compte/notifications'
      ),
    staleTime: 15_000,
  });

  const notifications = useMemo(() => query.data?.notifications ?? [], [query.data]);
  const filtered = useMemo(() => {
    const wanted = FILTERS[filter] ?? 'all';
    if (wanted === 'all') return notifications;
    return notifications.filter((item) => item.group === wanted);
  }, [filter, notifications]);

  const grouped = useMemo(() => {
    const buckets: Record<Group, NotificationItem[]> = {
      today: [],
      yesterday: [],
      week: [],
      earlier: [],
    };
    for (const item of filtered) buckets[groupOf(item.createdAt)].push(item);
    return buckets;
  }, [filtered]);

  const mark = async (body: { ids?: string[]; all?: boolean }) => {
    setBusy(true);
    try {
      await fetchJson('/api/compte/compte/notifications', {
        method: 'PATCH',
        body: JSON.stringify(body),
      });
      await queryClient.invalidateQueries({ queryKey: ['compte', 'notifications'] });
    } finally {
      setBusy(false);
    }
  };

  const open = (item: NotificationItem) => {
    if (!item.readAt) void mark({ ids: [item.id] });
    const action = item.action;
    if (action?.kind === 'post' && action.id) {
      (window as any).__lkdvOpenPost?.(action.id, {
        pane: item.type.includes('comment') ? 'comments' : 'post',
      });
      return;
    }
    if (action?.kind === 'profile' && action.id) {
      (window as any).__lkdvOpenProfile?.(action.id);
      return;
    }
    if (action?.kind === 'badge' && action.id) {
      (window as any).__lkdvOpenBadge?.(action.id);
      return;
    }
    if (action?.kind === 'loans') {
      (window as any).__lkdvOpenSlot?.('prets');
      return;
    }
    if (action?.kind === 'orders') {
      (window as any).__lkdvCompteAct?.('openAccountDrawer', 0);
      return;
    }
    if (action?.kind === 'challenge') {
      (window as any).__lkdvOpenSlot?.('communaute');
      return;
    }
    if (action?.kind === 'settings') {
      (window as any).__lkdvCompteAct?.('openAccountDrawer', 2);
      return;
    }
    if (item.link?.startsWith('/')) router.push(item.link);
  };

  if (query.isLoading) return <DrawerSkeleton />;
  if (query.isError) return <DrawerError onRetry={() => void query.refetch()} />;

  const unread = query.data?.unread ?? 0;

  return (
    <div className="lkdv-compte-pane">
      <div className="lkdv-compte-notif-head">
        <div>
          <b>{unread > 0 ? `${unread} non lue${unread > 1 ? 's' : ''}` : 'Tout est lu'}</b>
        </div>
        {unread > 0 ? (
          <ActionPill label="Tout lire" icon={<CheckCheck />} onClick={() => void mark({ all: true })} disabled={busy} />
        ) : null}
      </div>

      {filtered.length === 0 ? (
        <DrawerEmpty
          title={notifications.length === 0 ? 'Tu es à jour' : 'Aucune notification dans ce filtre'}
          hint={
            notifications.length === 0
              ? 'Les nouvelles activités, tes prêts et tes commandes arriveront ici.'
              : 'Change de filtre pour voir les autres notifications.'
          }
          action={
            <span className="lkdv-compte-empty-ico" aria-hidden="true">
              <Bell size={20} />
            </span>
          }
        />
      ) : (
        GROUPS.map((group) => {
          const items = grouped[group.id];
          if (items.length === 0) return null;
          return (
            <section key={group.id} className="lkdv-compte-notif-group">
              <h3>{group.label}</h3>
              <ul>
                {items.map((item) => {
                  const read = Boolean(item.readAt);
                  return (
                    <li key={item.id} className={read ? 'read' : 'unread'}>
                      <button
                        type="button"
                        className="lkdv-compte-notif-avatar"
                        aria-label={item.actor ? `Profil de ${item.actor.name}` : undefined}
                        onClick={() => item.actor && (window as any).__lkdvOpenProfile?.(item.actor.id)}
                      >
                        {item.actor?.avatarUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={item.actor.avatarUrl} alt="" loading="lazy" />
                        ) : item.actor ? (
                          initials(item.actor.name)
                        ) : (
                          notificationIcon(item.type)
                        )}
                      </button>
                      <button type="button" className="lkdv-compte-notif-body" onClick={() => open(item)}>
                        <span className="lkdv-compte-notif-title">
                          <b>{item.title}</b>
                          <small>{timeAgo(item.createdAt)}</small>
                        </span>
                        {item.message ? <span className="lkdv-compte-notif-msg">{item.message}</span> : null}
                        <span className="lkdv-compte-notif-tag">{NOTIFICATION_GROUP_LABEL[item.group]}</span>
                      </button>
                      {!read ? <span className="lkdv-compte-notif-dot" aria-label="Non lue" /> : null}
                    </li>
                  );
                })}
              </ul>
            </section>
          );
        })
      )}
    </div>
  );
}

export default NotificationsPane;
