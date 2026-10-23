'use client';

import React, { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Bell, CheckCheck, UserPlus } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import type { NotificationItem } from '@/features/compte/server/compte';
import { DrawerEmpty, DrawerError, DrawerSkeleton } from '../shell/DrawerShell';
import { NOTIFICATION_GROUP_LABEL, fetchJson, initials, timeAgo } from './shared';

type Group = 'today' | 'yesterday' | 'week' | 'earlier';
const GROUPS: Array<{ id: Group; label: string }> = [
  { id: 'today', label: "Aujourd'hui" },
  { id: 'yesterday', label: 'Hier' },
  { id: 'week', label: 'Cette semaine' },
  { id: 'earlier', label: 'Plus tôt' },
];
const FILTERS = ['all', 'social', 'loans', 'orders', 'system'] as const;

function startOfDay(date: Date) {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy.getTime();
}
function groupOf(value: string): Group {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'earlier';
  const delta = Math.round((startOfDay(new Date()) - startOfDay(date)) / 86_400_000);
  if (delta <= 0) return 'today';
  if (delta === 1) return 'yesterday';
  if (delta < 7) return 'week';
  return 'earlier';
}

function sentence(item: NotificationItem): string {
  const name = item.actor?.name || item.title;
  if (item.type === 'post_liked' || item.type === 'carnet_liked') return `${name} a aimé ta publication`;
  if (item.type === 'post_commented' || item.type === 'carnet_commented') return `${name} a commenté ta publication`;
  if (item.type === 'new_follower' || item.type === 'follow_request') return `${name} a commencé à te suivre`;
  if (item.type === 'post_repost') return `${name} a republié ta publication`;
  if (item.type === 'mention') return `${name} t’a mentionné`;
  if (item.type === 'badge_earned') return item.title || 'Nouveau trophée';
  if (item.type === 'challenge_completed') return item.title || 'Défi terminé';
  if (item.type.startsWith('order_')) return item.title;
  if (item.type.startsWith('loan_')) return item.title;
  return item.title;
}

export function NotificationsPane({ filter = 0 }: { filter?: number }) {
  const router = useRouter();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [followed, setFollowed] = useState<Record<string, boolean>>({});
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
    return wanted === 'all' ? notifications : notifications.filter((item) => item.group === wanted);
  }, [filter, notifications]);
  const grouped = useMemo(() => {
    const buckets: Record<Group, NotificationItem[]> = { today: [], yesterday: [], week: [], earlier: [] };
    for (const item of filtered) buckets[groupOf(item.createdAt)].push(item);
    return buckets;
  }, [filtered]);

  const mark = async (body: { ids?: string[]; all?: boolean }) => {
    setBusy(true);
    try {
      await fetchJson('/api/compte/compte/notifications', { method: 'PATCH', body: JSON.stringify(body) });
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
        commentId: item.type.includes('comment') ? action.id : null,
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

  const follow = async (item: NotificationItem) => {
    if (!user || !item.actor || followed[item.actor.id]) return;
    const supabase = createClient();
    setFollowed((current) => ({ ...current, [item.actor!.id]: true }));
    const { error } = await supabase.from('user_follows').insert({
      follower_id: user.id,
      following_id: item.actor.id,
    });
    if (error) setFollowed((current) => ({ ...current, [item.actor!.id]: false }));
  };

  if (query.isLoading) return <DrawerSkeleton />;
  if (query.isError) return <DrawerError onRetry={() => void query.refetch()} />;

  const unread = query.data?.unread ?? 0;
  return (
    <div className="lkdv-compte-pane lkdv-notif">
      <style>{NOTIF_CSS}</style>
      <div className="lkdv-compte-notif-head">
        <div>
          <b>{unread > 0 ? `${unread} non lue${unread > 1 ? 's' : ''}` : 'Tout est lu'}</b>
          <span>Activité de ta cordée, prêts et commandes.</span>
        </div>
        {unread > 0 ? (
          <button type="button" className="lkdv-compte-btn ghost" onClick={() => void mark({ all: true })} disabled={busy}>
            <CheckCheck size={14} aria-hidden="true" /> Tout lire
          </button>
        ) : null}
      </div>

      {filtered.length === 0 ? (
        <DrawerEmpty
          title={notifications.length === 0 ? 'Tu es à jour' : 'Aucune notification dans ce filtre'}
          hint={notifications.length === 0 ? 'Les nouvelles activités de ta cordée arriveront ici.' : 'Change de filtre pour voir les autres notifications.'}
          action={<span className="lkdv-compte-empty-ico" aria-hidden="true"><Bell size={20} /></span>}
        />
      ) : (
        GROUPS.map((group) => {
          const items = grouped[group.id];
          if (!items.length) return null;
          return (
            <section key={group.id} className="lkdv-notif-group">
              <h3>{group.label}</h3>
              <ul>
                {items.map((item) => {
                  const actor = item.actor;
                  const isFollow = item.type === 'new_follower' || item.type === 'follow_request';
                  const alreadyFollowing = followed[actor?.id || ''] ?? Boolean(actor?.following);
                  return (
                    <li key={item.id} className={item.unread ? 'unread' : ''}>
                      <button type="button" className="lkdv-notif-row" onClick={() => open(item)}>
                        <span className="lkdv-notif-avatar">
                          {actor?.avatarUrl ? <img src={actor.avatarUrl} alt="" loading="lazy" /> : <span>{initials(actor?.name || item.title)}</span>}
                          <i data-group={item.group} aria-hidden="true" />
                        </span>
                        <span className="lkdv-notif-copy">
                          <span className="lkdv-notif-line"><b>{sentence(item)}</b>{item.count > 1 ? <em>+{item.count - 1}</em> : null}</span>
                          {item.message && !isFollow ? <small>{item.message}</small> : null}
                          <small className="lkdv-notif-time">{timeAgo(item.createdAt)} · {NOTIFICATION_GROUP_LABEL[item.group]}</small>
                        </span>
                        {item.target?.imageUrl ? <img className="lkdv-notif-thumb" src={item.target.imageUrl} alt="" loading="lazy" /> : null}
                      </button>
                      {isFollow && actor && !alreadyFollowing ? (
                        <button type="button" className="lkdv-notif-follow" onClick={() => void follow(item)}>
                          <UserPlus size={13} aria-hidden="true" /> Suivre
                        </button>
                      ) : null}
                      {item.unread ? <span className="lkdv-notif-dot" aria-label="Non lue" /> : null}
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

const NOTIF_CSS = `
.lkdv-notif-group{margin-top:12px!important;}
.lkdv-notif-group h3{margin:0 0 5px!important;padding:0 2px!important;font:600 10.5px/1.2 var(--sf,-apple-system,"SF Pro Text",sans-serif)!important;letter-spacing:.04em!important;text-transform:uppercase!important;color:var(--label2,#6A7A71)!important;}
.lkdv-notif-group ul{list-style:none!important;margin:0!important;padding:0!important;display:flex!important;flex-direction:column!important;gap:1px!important;}
.lkdv-notif-group li{position:relative!important;display:flex!important;align-items:center!important;gap:2px!important;border-radius:13px!important;background:rgba(255,255,255,.66)!important;box-shadow:inset 0 1px 0 rgba(255,255,255,.9),0 0 0 .5px rgba(23,43,36,.06)!important;overflow:hidden!important;}
.lkdv-notif-group li.unread{background:rgba(255,255,255,.84)!important;}
.lkdv-notif-row{display:flex!important;align-items:center!important;gap:9px!important;width:100%!important;padding:8px 9px!important;border:0!important;background:transparent!important;text-align:left!important;color:inherit!important;cursor:pointer!important;}
.lkdv-notif-avatar{position:relative!important;width:36px!important;height:36px!important;flex:none!important;border-radius:999px!important;display:grid!important;place-items:center!important;background:#e4eee1!important;color:#17402c!important;font:700 12px/1 var(--sf)!important;overflow:visible!important;}
.lkdv-notif-avatar img{width:100%!important;height:100%!important;border-radius:999px!important;object-fit:cover!important;}
.lkdv-notif-avatar i{position:absolute!important;right:-2px!important;bottom:-2px!important;width:13px!important;height:13px!important;border-radius:999px!important;border:2px solid #fff!important;background:#17402c!important;}
.lkdv-notif-avatar i[data-group="loans"]{background:#b98a2e!important;}
.lkdv-notif-avatar i[data-group="orders"]{background:#3d6f9a!important;}
.lkdv-notif-avatar i[data-group="system"]{background:#6a7a71!important;}
.lkdv-notif-copy{min-width:0!important;flex:1!important;display:flex!important;flex-direction:column!important;gap:1px!important;}
.lkdv-notif-line{display:flex!important;align-items:baseline!important;gap:4px!important;min-width:0!important;}
.lkdv-notif-line b{font:500 12px/1.3 var(--sf)!important;color:var(--label,#172B24)!important;overflow:hidden!important;text-overflow:ellipsis!important;white-space:nowrap!important;}
.lkdv-notif-line em{font:600 9.5px/1 var(--sf)!important;color:#6a7a71!important;font-style:normal!important;}
.lkdv-notif-copy small{font:400 10.5px/1.3 var(--sf)!important;color:#6a7a71!important;overflow:hidden!important;text-overflow:ellipsis!important;white-space:nowrap!important;}
.lkdv-notif-copy .lkdv-notif-time{font-size:9.5px!important;color:#8a978f!important;}
.lkdv-notif-thumb{width:38px!important;height:38px!important;border-radius:9px!important;object-fit:cover!important;flex:none!important;}
.lkdv-notif-follow{position:absolute!important;right:38px!important;bottom:7px!important;display:inline-flex!important;align-items:center!important;gap:3px!important;height:24px!important;padding:0 8px!important;border:0!important;border-radius:999px!important;background:#17402c!important;color:#fff!important;font:600 9.5px/1 var(--sf)!important;cursor:pointer!important;}
.lkdv-notif-dot{position:absolute!important;right:5px!important;top:50%!important;transform:translateY(-50%)!important;width:6px!important;height:6px!important;border-radius:999px!important;background:#17402c!important;}
`;
export default NotificationsPane;
