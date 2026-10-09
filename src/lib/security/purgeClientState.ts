export interface PurgeStorageLike {
  length: number;
  key(index: number): string | null;
  removeItem(key: string): void;
}

export interface PurgeIdbLike {
  deleteDatabase(name: string): unknown;
}

export interface PurgeDeps {
  localStorage?: PurgeStorageLike | null;
  sessionStorage?: PurgeStorageLike | null;
  indexedDB?: PurgeIdbLike | null;
}

const EXACT_LOCAL_KEYS = [
  'kdv_cart',
  'kdv_wishlist',
  'lkdv_guest_equipment',
  'lkdv_guest_kits',
  'lkdv_guest_gear',
  'lkdv_hub_state_v1',
  'lkdv_gear_state_v1',
  'lkdv_participants_state_v1',
  'lkdv_preparation_state_v2',
  'lkdv_free_departure_v2',
  'lkdv:trip-draft',
  'lkdv_depart_order',
  'lkdv-kits-cockpit-order',
  'lkdv-materiel-cockpit-order-v3',
  'user_profile_data',
  'user_account_settings_v1',
  'user_clubs_data',
  'user_carnets_data',
  'lkdv_active_hike_session',
  'lkdv_hike_state',
  'lkdv_emergency_contact',
  'lkdv_offline_sync_queue',
  'lkdv_planned_hikes',
  'lkdv_active_planned_hike_id',
  'lkdv_last_location',
  'lkdv_active_trip',
  'lkdv_user_trips_cache',
  'lkdv_trip_last_section',
  'lkdv_active_adventure',
  'lkdv_hub_adventures_cache',
  'lkdv_adventure_last_section',
  'lkdv_trip_offline_queue_v1',
  'lkdv_trip_sync_journal_v1',
  'lkdv_depart_offline_queue_v1',
  'lkdv_dismissed_depart_alerts_v2',
  'lkdv_prep_recent_activities_v1',
  'lkdv_prep_invite_permissions_v1',
  'lkdv_prep_recent_places_v1',
  'lkdv_recent_searches',
];

const LOCAL_KEY_PREFIXES = [
  'lkdv_adventure_prep_v',
  'lkdv_compte_cache_',
  'lkdv:offline:trip:',
  'lkdv_depart_cache_',
  'lkdv_cache_',
  'lkdv-critical-query:',
  'lkdv_pref_',
];

const SESSION_KEYS = ['lkdv_hub_switcher_autopen'];

const IDB_NAMES = [
  'lkdv-trips',
  'lkdv-trip-sync',
  'lkdv-materiel',
  'lkdv-cache',
  'lkdv-offline',
  'lkdv-offline-routes',
  'lkdv-local-vault',
  'lkdv-adventure-offline-v1',
];

const IDB_PREFIXES = ['lkdv-adventure-offline-'];

function purgeStorage(
  storage: PurgeStorageLike | null | undefined,
  exactKeys: string[],
  prefixes: string[]
): void {
  if (!storage) return;
  for (const key of exactKeys) storage.removeItem(key);
  for (let index = storage.length - 1; index >= 0; index -= 1) {
    const key = storage.key(index);
    if (key && prefixes.some((prefix) => key.startsWith(prefix))) {
      storage.removeItem(key);
    }
  }
}

/**
 * Purge l'état client privé lors d'un changement d'utilisateur connecté
 * (connexion d'un autre compte, déconnexion). Ne touche pas aux préférences
 * d'appareil (thème, consentement cookies) ni aux clés du service worker
 * (traitées par purgePrivateCaches). No-op si l'utilisateur n'a pas changé.
 */
export function purgeClientStateOnUserChange(
  previousUserId: string | null | undefined,
  currentUserId: string | null,
  deps: PurgeDeps = {}
): void {
  if (previousUserId === undefined || previousUserId === currentUserId) return;

  const localStorageRef =
    deps.localStorage !== undefined
      ? deps.localStorage
      : typeof localStorage !== 'undefined'
        ? localStorage
        : null;
  const sessionStorageRef =
    deps.sessionStorage !== undefined
      ? deps.sessionStorage
      : typeof sessionStorage !== 'undefined'
        ? sessionStorage
        : null;
  const indexedDbRef =
    deps.indexedDB !== undefined
      ? deps.indexedDB
      : typeof indexedDB !== 'undefined'
        ? indexedDB
        : null;

  purgeStorage(localStorageRef, EXACT_LOCAL_KEYS, LOCAL_KEY_PREFIXES);
  purgeStorage(sessionStorageRef, SESSION_KEYS, []);

  if (indexedDbRef) {
    const names = [...IDB_NAMES];
    if (previousUserId) names.push(`lkdv-adventure-offline-v2-${previousUserId}`);
    for (const name of names) {
      try {
        indexedDbRef.deleteDatabase(name);
      } catch {
        /* suppression best-effort */
      }
    }
    for (const prefix of IDB_PREFIXES) {
      if (previousUserId) {
        try {
          indexedDbRef.deleteDatabase(`${prefix}v2-${previousUserId}`);
        } catch {
          /* suppression best-effort */
        }
      }
    }
  }
}
