import type { SupabaseClient } from '@supabase/supabase-js';
import {
  NOTIFICATION_TYPES,
  NOTIFICATION_TYPE_BY_ID,
  computeLegacyCategories,
  defaultNotificationPreference,
  notificationTypesForLegacyGroup,
  type LegacyNotificationGroup,
} from '../notificationCatalog';

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

export interface NotificationActor {
  id: string;
  name: string;
  handle: string;
  avatarUrl: string | null;
  following: boolean;
}

export interface NotificationTarget {
  type: string;
  id: string;
  title: string;
  imageUrl: string | null;
}

export type NotificationActionKind =
  | 'post'
  | 'carnet'
  | 'profile'
  | 'orders'
  | 'loans'
  | 'badge'
  | 'challenge'
  | 'settings';

export interface NotificationAction {
  kind: NotificationActionKind;
  id: string | null;
}

export interface NotificationItem {
  id: string;
  type: string;
  group: NotificationGroup;
  title: string;
  message: string;
  readAt: string | null;
  createdAt: string;
  link: string | null;
  actor: NotificationActor | null;
  count: number;
  target: NotificationTarget | null;
  action: NotificationAction | null;
  unread: boolean;
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
  // La colonne `group` a longtemps eu `system` par défaut : on ne fait
  // confiance à une valeur stockée que si elle est réellement discriminante.
  if (stored === 'social' || stored === 'loans' || stored === 'orders') {
    return stored;
  }
  const value = type.toLowerCase();
  if (
    value.includes('follow') ||
    value.includes('like') ||
    value.includes('comment') ||
    value.includes('post') ||
    value.includes('mention') ||
    value.includes('group') ||
    value.includes('carnet') ||
    value.includes('repost') ||
    value.includes('trip')
  ) {
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

export function isMessageNotification(type: string): boolean {
  return type === 'new_message' || type === 'group_message' || type === 'digest';
}

function actionForNotification(
  type: string,
  relatedType: string,
  relatedId: string,
  actorId: string
): NotificationAction | null {
  const id = relatedId || null;
  if (type.startsWith('post_') || relatedType === 'community_post' || relatedType === 'post') {
    return { kind: 'post', id };
  }
  if (type.startsWith('carnet_') || relatedType === 'carnet') return { kind: 'carnet', id };
  if (type.includes('follow')) return { kind: 'profile', id: actorId || id };
  if (type.startsWith('order_')) return { kind: 'orders', id };
  if (type.startsWith('loan_')) return { kind: 'loans', id };
  if (type === 'badge_earned') return { kind: 'badge', id };
  if (type === 'challenge_completed') return { kind: 'challenge', id };
  return null;
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

/**
 * Liste PostgREST des types exclus de l'activité : messages privés, digest et
 * types dont la personne a coupé le canal « application ». Le filtre est
 * partagé par la liste et le compteur du badge pour qu'ils ne divergent pas.
 */
async function notificationExclusionList(
  supabase: SupabaseClient,
  userId: string
): Promise<string> {
  const preferences = await loadNotificationPreferences(supabase, userId).catch(() => null);
  const disabled = (preferences?.preferences ?? [])
    .filter((preference) => !preference.inApp)
    .map((preference) => preference.type.replace(/"/g, ''));
  const excluded = ['new_message', 'group_message', 'digest', ...new Set(disabled)];
  return `(${excluded.map((type) => `"${type}"`).join(',')})`;
}

export async function loadNotifications(
  supabase: SupabaseClient,
  userId: string
): Promise<{ notifications: NotificationItem[]; unread: number }> {
  /**
   * `notify_activity()` insère directement les notifications des commandes,
   * prêts, défis et trophées sans consulter `notification_preferences`. Le
   * filtre de lecture ci-dessous rend tout de même le réglage « application »
   * effectif pour ces types : la ligne existe, mais elle n'est pas affichée
   * quand la personne l'a coupée. Aucun service externe n'est simulé.
   */
  const excludedList = await notificationExclusionList(supabase, userId);

  const filtered = () =>
    supabase
      .from('notifications')
      .select('id,type,title,message,read,read_at,created_at,link,"group",actor_id,related_type,related_id,group_count')
      .eq('user_id', userId)
      .not('type', 'in', excludedList);

  const [{ data }, { count }] = await Promise.all([
    filtered().order('created_at', { ascending: false }).limit(80),
    supabase
      .from('notifications')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('read', false)
      .not('type', 'in', excludedList),
  ]);

  const rows = (data ?? []) as Array<Record<string, unknown>>;
  const actorIds = [...new Set(rows.map((row) => text(row.actor_id)).filter(Boolean))];
  const postIds = [
    ...new Set(
      rows
        .filter((row) => {
          const type = text(row.type);
          const related = text(row.related_type);
          return type.startsWith('post_') || related === 'community_post' || related === 'post';
        })
        .map((row) => text(row.related_id))
        .filter(Boolean)
    ),
  ];
  const carnetIds = [
    ...new Set(
      rows
        .filter((row) => text(row.type).startsWith('carnet_') || text(row.related_type) === 'carnet')
        .map((row) => text(row.related_id))
        .filter(Boolean)
    ),
  ];

  const [actorRes, followRes, postRes, carnetRes] = await Promise.all([
    actorIds.length
      ? supabase.from('public_profiles').select('id,full_name,handle,avatar_url').in('id', actorIds)
      : Promise.resolve({ data: [] as Array<Record<string, unknown>> }),
    actorIds.length
      ? supabase
          .from('user_follows')
          .select('following_id')
          .eq('follower_id', userId)
          .in('following_id', actorIds)
      : Promise.resolve({ data: [] as Array<Record<string, unknown>> }),
    postIds.length
      ? supabase.from('community_posts').select('id,title,content,image_url,media_urls').in('id', postIds)
      : Promise.resolve({ data: [] as Array<Record<string, unknown>> }),
    carnetIds.length
      ? supabase.from('carnets').select('id,title,cover_image').in('id', carnetIds)
      : Promise.resolve({ data: [] as Array<Record<string, unknown>> }),
  ]);

  const following = new Set(
    ((followRes.data ?? []) as Array<Record<string, unknown>>).map((row) => text(row.following_id))
  );
  const actors = new Map<string, NotificationActor>(
    ((actorRes.data ?? []) as Array<Record<string, unknown>>).map((row) => {
      const id = text(row.id);
      return [
        id,
        {
          id,
          name: text(row.full_name) || text(row.handle) || 'Voyageur',
          handle: text(row.handle),
          avatarUrl: text(row.avatar_url) || null,
          following: following.has(id),
        },
      ];
    })
  );
  const posts = new Map(
    ((postRes.data ?? []) as Array<Record<string, unknown>>).map((row) => {
      const media = Array.isArray(row.media_urls) ? row.media_urls : [];
      return [
        text(row.id),
        {
          title: text(row.title) || text(row.content).slice(0, 80) || 'Publication',
          imageUrl: text(row.image_url) || text(media[0]) || null,
        },
      ];
    })
  );
  const carnets = new Map(
    ((carnetRes.data ?? []) as Array<Record<string, unknown>>).map((row) => [
      text(row.id),
      { title: text(row.title) || 'Carnet', imageUrl: text(row.cover_image) || null },
    ])
  );

  const notifications: NotificationItem[] = rows.map((row) => {
    const type = text(row.type);
    const actorId = text(row.actor_id);
    const relatedType = text(row.related_type);
    const relatedId = text(row.related_id);
    const action = actionForNotification(type, relatedType, relatedId, actorId);
    let target: NotificationTarget | null = null;
    if (action?.kind === 'post' && relatedId) {
      const post = posts.get(relatedId);
      target = { type: 'post', id: relatedId, title: post?.title || 'Publication', imageUrl: post?.imageUrl || null };
    } else if (action?.kind === 'carnet' && relatedId) {
      const carnet = carnets.get(relatedId);
      target = { type: 'carnet', id: relatedId, title: carnet?.title || 'Carnet', imageUrl: carnet?.imageUrl || null };
    }
    const read = row.read === true;
    return {
      id: text(row.id),
      type,
      group: notificationGroup(type, text(row.group) || null),
      title: text(row.title) || 'Notification',
      message: text(row.message),
      readAt: text(row.read_at) || (read ? text(row.created_at) : null),
      createdAt: text(row.created_at),
      link: text(row.link) || null,
      actor: actorId ? actors.get(actorId) ?? null : null,
      count: Math.max(1, numeric(row.group_count)),
      target,
      action,
      unread: !read,
    };
  });

  return { notifications, unread: count ?? notifications.filter((item) => item.unread).length };
}

/** Compteur de badge, avec les mêmes exclusions que la liste d'activité. */
export async function loadUnreadNotificationCount(
  supabase: SupabaseClient,
  userId: string
): Promise<number> {
  const excludedList = await notificationExclusionList(supabase, userId);
  const { count } = await supabase
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('read', false)
    .not('type', 'in', excludedList);
  return count ?? 0;
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

export interface NotificationPreference {
  type: string;
  inApp: boolean;
  email: boolean;
  push: boolean;
}

export interface NotificationPreferencesPayload {
  preferences: NotificationPreference[];
  categories: Record<LegacyNotificationGroup, boolean>;
}

export interface NotificationPreferencePatch {
  type: string;
  inApp?: boolean;
  email?: boolean;
  push?: boolean;
}

/**
 * Préférences fines de notification (fiche O01 S6.20).
 *
 * Lit `notification_preferences` par `notification_type` — la table déjà
 * consommée par `notify()` — et complète les types absents avec les valeurs par
 * défaut de la fonction SQL. Aucune ligne n'est inventée en base tant que la
 * personne n'a rien changé.
 */
export async function loadNotificationPreferences(
  supabase: SupabaseClient,
  userId: string
): Promise<NotificationPreferencesPayload> {
  const { data, error } = await supabase
    .from('notification_preferences')
    .select('notification_type,in_app_enabled,email_enabled,push_enabled')
    .eq('user_id', userId);
  if (error) throw error;

  const rows = new Map<string, Record<string, unknown>>(
    ((data ?? []) as Array<Record<string, unknown>>).map(
      (row): [string, Record<string, unknown>] => [text(row.notification_type), row]
    )
  );

  const preferences = NOTIFICATION_TYPES.map((definition) => {
    const row = rows.get(definition.type);
    const fallback = defaultNotificationPreference(definition);
    return {
      type: definition.type,
      inApp: row ? row.in_app_enabled !== false : fallback.inApp,
      // `notify()` force l'email à false pour ces types : on n'affiche jamais
      // un réglage qui serait ignoré. Les types in-app seulement ne promettent
      // ni email ni push.
      email: definition.inAppOnly
        ? false
        : definition.emailLocked
          ? false
          : row
            ? row.email_enabled !== false
            : fallback.email,
      push: definition.inAppOnly ? false : row ? row.push_enabled !== false : fallback.push,
    };
  });

  return { preferences, categories: computeLegacyCategories(preferences) };
}

/**
 * Écrit les préférences fines et tient `user_profiles.notification_prefs` à jour
 * pour les anciens lecteurs. Les catégories historiques sont recalculées :
 * une catégorie reste active tant qu'au moins un de ses types est actif dans
 * l'application, ce qui évite de déclarer « tout coupé » après un seul type.
 */
export async function saveNotificationPreferences(
  supabase: SupabaseClient,
  userId: string,
  patch: {
    preferences?: NotificationPreferencePatch[];
    categories?: Partial<Record<LegacyNotificationGroup, boolean>>;
  }
): Promise<NotificationPreferencesPayload> {
  const current = await loadNotificationPreferences(supabase, userId);
  const byType = new Map<string, NotificationPreference>(
    current.preferences.map((preference): [string, NotificationPreference] => [
      preference.type,
      preference,
    ])
  );

  const apply = (type: string, change: Partial<Omit<NotificationPreference, 'type'>>) => {
    const definition = NOTIFICATION_TYPE_BY_ID.get(type);
    if (!definition) throw new Error('unknown_notification_type');
    const previous = byType.get(type) ?? {
      type,
      ...defaultNotificationPreference(definition),
    };
    byType.set(type, {
      ...previous,
      ...change,
      // Ni le verrou email ni l'absence de livraison ne sont contournés par l'API.
      email: definition.emailLocked || definition.inAppOnly ? false : change.email ?? previous.email,
      push: definition.inAppOnly ? false : change.push ?? previous.push,
    });
  };

  for (const preference of patch.preferences ?? []) {
    apply(preference.type, {
      ...(typeof preference.inApp === 'boolean' ? { inApp: preference.inApp } : {}),
      ...(typeof preference.email === 'boolean' ? { email: preference.email } : {}),
      ...(typeof preference.push === 'boolean' ? { push: preference.push } : {}),
    });
  }

  for (const [group, enabled] of Object.entries(patch.categories ?? {}) as Array<
    [LegacyNotificationGroup, boolean | undefined]
  >) {
    if (typeof enabled !== 'boolean') continue;
    for (const definition of notificationTypesForLegacyGroup(group)) {
      apply(definition.type, { inApp: enabled, email: enabled, push: enabled });
    }
  }

  const changed = NOTIFICATION_TYPES.map((definition) => byType.get(definition.type)!);

  // N'écrit que les types du catalogue : une préférence d'un type inconnu ne
  // peut pas être injectée par l'API.
  const { error } = await supabase.from('notification_preferences').upsert(
    changed.map((preference) => ({
      user_id: userId,
      notification_type: preference.type,
      in_app_enabled: preference.inApp,
      email_enabled: preference.email,
      push_enabled: preference.push,
      updated_at: new Date().toISOString(),
    })),
    { onConflict: 'user_id,notification_type' }
  );
  if (error) throw error;

  // Compatibilité : même règle que l'ancienne carte, sans toucher à quietHours.
  const { data: profileRow } = await supabase
    .from('user_profiles')
    .select('notification_prefs')
    .eq('id', userId)
    .maybeSingle();
  const legacy = parsePrefs(profileRow?.notification_prefs);
  const categories = computeLegacyCategories(changed);
  const { error: legacyError } = await supabase
    .from('user_profiles')
    .update({
      notification_prefs: { ...legacy, ...categories },
      updated_at: new Date().toISOString(),
    })
    .eq('id', userId);
  if (legacyError) throw legacyError;

  return { preferences: changed, categories };
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
