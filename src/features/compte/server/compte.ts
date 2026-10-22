import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Drawer Compte — commandes, notifications, réglages, profil, partage.
 *
 * Toutes les lectures sont bornées à `auth.uid()` par la RLS et par un filtre
 * `user_id` explicite. Une valeur absente reste `null` : l'UI affiche
 * « non renseigné », jamais une valeur de démonstration.
 */

export type OrderStage = 'confirmed' | 'prepared' | 'shipped' | 'delivered' | 'cancelled';

export interface OrderItem {
  title: string;
  qty: number;
  imageUrl: string | null;
  unitCents: number | null;
}

export interface OrderSummary {
  id: string;
  reference: string;
  createdAt: string;
  status: OrderStage;
  rawStatus: string;
  totalCents: number;
  items: OrderItem[];
  trackingUrl: string | null;
  carrier: string | null;
  estimatedDelivery: string | null;
  shippingCity: string | null;
  shippingCountry: string | null;
  paymentMethod: string | null;
}

export type NotificationGroup = 'social' | 'loans' | 'orders' | 'system';

export interface NotificationItem {
  id: string;
  type: string;
  group: NotificationGroup;
  title: string;
  message: string;
  readAt: string | null;
  createdAt: string;
  link: string | null;
  actor: { name: string; avatarUrl: string | null } | null;
}

export interface ProfileLink {
  label: string;
  url: string;
}

export interface NotificationPrefs {
  social: boolean;
  loans: boolean;
  orders: boolean;
  system: boolean;
  quietHours: boolean;
}

export interface ProfileSettings {
  id: string;
  email: string;
  name: string;
  handle: string;
  bio: string;
  location: string;
  avatarUrl: string | null;
  coverUrl: string | null;
  links: ProfileLink[];
  visibility: 'public' | 'prive';
  notificationPrefs: NotificationPrefs;
  twoFaEnabled: boolean;
}

export interface ShareStats {
  views7d: number;
  views30d: number;
  url: string;
}

const ORDER_STAGES: Record<string, OrderStage> = {
  pending: 'confirmed',
  paid: 'confirmed',
  confirmed: 'confirmed',
  preparing: 'prepared',
  prepared: 'prepared',
  packed: 'prepared',
  shipped: 'shipped',
  in_transit: 'shipped',
  delivered: 'delivered',
  completed: 'delivered',
  cancelled: 'cancelled',
  canceled: 'cancelled',
  refunded: 'cancelled',
};

const ORDER_LABELS: Record<OrderStage, string> = {
  confirmed: 'Confirmée',
  prepared: 'Préparée',
  shipped: 'Expédiée',
  delivered: 'Livrée',
  cancelled: 'Annulée',
};

export function orderStage(raw: string | null | undefined): OrderStage {
  const key = (raw ?? '').trim().toLowerCase();
  return ORDER_STAGES[key] ?? 'confirmed';
}

export function orderStageLabel(stage: OrderStage): string {
  return ORDER_LABELS[stage];
}

export const ORDER_STEPS: Array<{ id: OrderStage; label: string }> = [
  { id: 'confirmed', label: 'Confirmée' },
  { id: 'prepared', label: 'Préparée' },
  { id: 'shipped', label: 'Expédiée' },
  { id: 'delivered', label: 'Livrée' },
];

export function notificationGroup(type: string, stored: string | null): NotificationGroup {
  if (stored === 'social' || stored === 'loans' || stored === 'orders' || stored === 'system') {
    return stored;
  }
  const value = type.toLowerCase();
  if (value.includes('follow') || value.includes('like') || value.includes('comment') || value.includes('post') || value.includes('message') || value.includes('group') || value.includes('carnet')) {
    return 'social';
  }
  if (value.includes('loan') || value.includes('pret') || value.includes('materiel') || value.includes('gear')) {
    return 'loans';
  }
  if (value.includes('order') || value.includes('commande') || value.includes('shipping') || value.includes('payment') || value.includes('checkout')) {
    return 'orders';
  }
  return 'system';
}

function numeric(value: unknown): number {
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : 0;
}

function text(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function parseLinks(raw: unknown): ProfileLink[] {
  if (!Array.isArray(raw)) return [];
  const links: ProfileLink[] = [];
  for (const entry of raw) {
    if (!entry || typeof entry !== 'object') continue;
    const row = entry as Record<string, unknown>;
    const url = text(row.url).trim();
    if (!/^https?:\/\//i.test(url)) continue;
    links.push({ label: text(row.label).slice(0, 40) || 'Lien', url: url.slice(0, 300) });
    if (links.length === 3) break;
  }
  return links;
}

const DEFAULT_PREFS: NotificationPrefs = {
  social: true,
  loans: true,
  orders: true,
  system: true,
  quietHours: false,
};

function parsePrefs(raw: unknown): NotificationPrefs {
  if (!raw || typeof raw !== 'object') return DEFAULT_PREFS;
  const row = raw as Record<string, unknown>;
  return {
    social: row.social !== false,
    loans: row.loans !== false,
    orders: row.orders !== false,
    system: row.system !== false,
    quietHours: row.quietHours === true,
  };
}

export async function loadOrders(supabase: SupabaseClient, userId: string): Promise<OrderSummary[]> {
  const { data } = await supabase
    .from('orders')
    .select(
      'id,order_number,status,total_eur,created_at,items,tracking_url,carrier,estimated_delivery,shipping_address,payment_method'
    )
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(50);

  return ((data ?? []) as Array<Record<string, unknown>>).map((row) => {
    const itemsRaw = Array.isArray(row.items) ? row.items : [];
    const items: OrderItem[] = itemsRaw.map((entry) => {
      const item = (entry ?? {}) as Record<string, unknown>;
      return {
        title: text(item.name) || text(item.title) || text(item.product_name) || 'Article',
        qty: Math.max(1, Math.round(numeric(item.quantity ?? item.qty ?? 1))),
        imageUrl: text(item.image_url) || text(item.image) || null,
        unitCents:
          item.unit_price_eur === undefined
            ? null
            : Math.round(numeric(item.unit_price_eur) * 100),
      };
    });
    const address = (row.shipping_address ?? {}) as Record<string, unknown>;
    const rawStatus = text(row.status) || 'confirmed';
    return {
      id: String(row.id),
      reference: text(row.order_number) || String(row.id).slice(0, 8).toUpperCase(),
      createdAt: text(row.created_at),
      status: orderStage(rawStatus),
      rawStatus,
      totalCents: Math.round(numeric(row.total_eur) * 100),
      items,
      trackingUrl: text(row.tracking_url) || null,
      carrier: text(row.carrier) || null,
      estimatedDelivery: text(row.estimated_delivery) || null,
      shippingCity: text(address.ville) || text(address.city) || null,
      shippingCountry: text(address.pays) || text(address.country) || null,
      paymentMethod: text(row.payment_method) || null,
    } satisfies OrderSummary;
  });
}

export async function loadNotifications(
  supabase: SupabaseClient,
  userId: string
): Promise<{ notifications: NotificationItem[]; unread: number }> {
  const { data } = await supabase
    .from('notifications')
    .select('id,type,title,message,read,read_at,created_at,link,"group",actor_id,related_type,related_id')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(80);

  const rows = (data ?? []) as Array<Record<string, unknown>>;
  const actorIds = [
    ...new Set(rows.map((row) => text(row.actor_id)).filter(Boolean)),
  ];
  const actorRes = actorIds.length
    ? await supabase.from('public_profiles').select('id,full_name,handle,avatar_url').in('id', actorIds)
    : { data: [] as Array<Record<string, unknown>> };
  const actors = new Map<string, { name: string; avatarUrl: string | null }>(
    ((actorRes.data ?? []) as Array<Record<string, unknown>>).map((row) => [
      text(row.id),
      {
        name: text(row.full_name) || text(row.handle) || 'Voyageur',
        avatarUrl: text(row.avatar_url) || null,
      },
    ])
  );

  const notifications: NotificationItem[] = rows.map((row) => {
    const read = row.read === true;
    const readAt = text(row.read_at) || (read ? text(row.created_at) : null);
    return {
      id: text(row.id),
      type: text(row.type),
      group: notificationGroup(text(row.type), text(row.group) || null),
      title: text(row.title) || 'Notification',
      message: text(row.message),
      readAt: readAt || null,
      createdAt: text(row.created_at),
      link: text(row.link) || null,
      actor: actors.get(text(row.actor_id)) ?? null,
    };
  });

  return { notifications, unread: notifications.filter((item) => !item.readAt).length };
}

export async function markNotificationsRead(
  supabase: SupabaseClient,
  userId: string,
  ids: string[]
): Promise<void> {
  const now = new Date().toISOString();
  if (ids.length === 0) return;
  const { error } = await supabase
    .from('notifications')
    .update({ read: true, read_at: now })
    .eq('user_id', userId)
    .in('id', ids);
  if (error) throw error;
}

export async function markAllNotificationsRead(
  supabase: SupabaseClient,
  userId: string
): Promise<void> {
  const { error } = await supabase
    .from('notifications')
    .update({ read: true, read_at: new Date().toISOString() })
    .eq('user_id', userId)
    .eq('read', false);
  if (error) throw error;
}

export async function loadProfileSettings(
  supabase: SupabaseClient,
  userId: string,
  email: string
): Promise<ProfileSettings> {
  const { data } = await supabase
    .from('user_profiles')
    .select(
      'id,email,full_name,handle,bio,location,avatar_url,cover_url,links,profile_visibility,notification_prefs,two_fa_enabled'
    )
    .eq('id', userId)
    .maybeSingle();

  const row = (data ?? {}) as Record<string, unknown>;
  return {
    id: userId,
    email: text(row.email) || email,
    name: text(row.full_name),
    handle: text(row.handle),
    bio: text(row.bio),
    location: text(row.location),
    avatarUrl: text(row.avatar_url) || null,
    coverUrl: text(row.cover_url) || null,
    links: parseLinks(row.links),
    visibility: text(row.profile_visibility) === 'prive' ? 'prive' : 'public',
    notificationPrefs: parsePrefs(row.notification_prefs),
    twoFaEnabled: row.two_fa_enabled === true,
  };
}

export interface ProfilePatch {
  name?: string;
  handle?: string;
  bio?: string;
  location?: string;
  avatarUrl?: string | null;
  coverUrl?: string | null;
  links?: ProfileLink[];
  visibility?: 'public' | 'prive';
  notificationPrefs?: Partial<NotificationPrefs>;
}

const HANDLE_RE = /^[a-z0-9_]{3,24}$/i;

export async function updateProfileSettings(
  supabase: SupabaseClient,
  userId: string,
  patch: ProfilePatch
): Promise<ProfileSettings> {
  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };

  if (patch.name !== undefined) {
    const name = patch.name.trim();
    if (!name) throw new Error('invalid_name');
    update.full_name = name.slice(0, 80);
  }
  if (patch.handle !== undefined) {
    const handle = patch.handle.trim().replace(/^@/, '').toLowerCase();
    if (!HANDLE_RE.test(handle)) throw new Error('invalid_handle');
    update.handle = handle;
  }
  if (patch.bio !== undefined) {
    if (patch.bio.length > 160) throw new Error('invalid_bio');
    if (/(https?:\/\/|www\.)/i.test(patch.bio)) throw new Error('bio_link');
    update.bio = patch.bio;
  }
  if (patch.location !== undefined) update.location = patch.location.trim().slice(0, 80);
  if (patch.avatarUrl !== undefined) {
    const url = patch.avatarUrl?.trim() ?? '';
    if (url && !/^https?:\/\//i.test(url)) throw new Error('invalid_url');
    update.avatar_url = url || null;
  }
  if (patch.coverUrl !== undefined) {
    const url = patch.coverUrl?.trim() ?? '';
    if (url && !/^https?:\/\//i.test(url)) throw new Error('invalid_url');
    update.cover_url = url || null;
  }
  if (patch.links !== undefined) {
    update.links = parseLinks(patch.links);
  }
  if (patch.visibility !== undefined) update.profile_visibility = patch.visibility;
  if (patch.notificationPrefs !== undefined) {
    const current = parsePrefs((await supabase
      .from('user_profiles')
      .select('notification_prefs')
      .eq('id', userId)
      .maybeSingle()).data?.notification_prefs);
    update.notification_prefs = { ...current, ...patch.notificationPrefs };
  }

  const { error } = await supabase.from('user_profiles').update(update).eq('id', userId);
  if (error) {
    if (String(error.code) === '23505') throw new Error('handle_taken');
    throw error;
  }
  return loadProfileSettings(supabase, userId, '');
}

export async function loadShareStats(
  supabase: SupabaseClient,
  userId: string
): Promise<ShareStats> {
  const since7 = new Date(Date.now() - 7 * 86_400_000).toISOString();
  const since30 = new Date(Date.now() - 30 * 86_400_000).toISOString();
  const [week, month] = await Promise.all([
    supabase
      .from('profile_views')
      .select('id', { count: 'exact', head: true })
      .eq('profile_id', userId)
      .gte('viewed_at', since7),
    supabase
      .from('profile_views')
      .select('id', { count: 'exact', head: true })
      .eq('profile_id', userId)
      .gte('viewed_at', since30),
  ]);
  return {
    views7d: week.count ?? 0,
    views30d: month.count ?? 0,
    url: `/profil/${userId}`,
  };
}
