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

export const LAST_AUTHED_USER_KEY = 'lkdv_last_authed_user';

export type PurgeDecision = 'none' | 'purge';

/**
 * Décide si l'état client doit être purgé :
 * - pas de session courante (déconnexion) → 'none' (la mémoire du dernier
 *   utilisateur est conservée pour détecter la prochaine connexion) ;
 * - première connexion connue → 'none' ;
 * - utilisateur courant identique au dernier authentifié (reconnexion du même
 *   compte, rechargement dur) → 'none' ;
 * - utilisateur différent → 'purge'.
 */
export function decidePurgeOnAuth(
  lastAuthedUserId: string | null,
  currentUserId: string | null
): PurgeDecision {
  if (!currentUserId) return 'none';
  if (!lastAuthedUserId) return 'none';
  return lastAuthedUserId === currentUserId ? 'none' : 'purge';
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
  'lkdv:offline:manifest',
  'lkdv_offline_reports_queue',
  'lkdv_offline_decisions_queue',
  'lkdv_offline_adventure_pack',
  'lkdv_offline_pack_version',
  'lkdv_offline_last_sync',
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
  'lkdv:offline:',
  'lkdv_depart_cache_',
  'lkdv_cache_',
  'lkdv-critical-query:',
  'lkdv_active_trip:',
  'lkdv_user_trips_cache:',
  'lkdv_trip_last_section:',
  'lkdv_active_adventure:',
  'lkdv_hub_adventures_cache:',
  'lkdv_adventure_last_section:',
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
 * Purge l'état client privé lors d'un CHANGEMENT d'utilisateur authentifié
 * (A→B). Ne s'exécute jamais pour une déconnexion seule, un rechargement ou
 * une reconnexion du même compte — la décision est prise par
 * `decidePurgeOnAuth` avec la mémoire du dernier utilisateur authentifié.
 * Best-effort : ne jette jamais.
 */
export function purgeClientStateOnUserChange(
  previousUserId: string | null | undefined,
  currentUserId: string | null,
  deps: PurgeDeps = {}
): void {
  if (!previousUserId || !currentUserId || previousUserId === currentUserId) return;

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
    const names = [...IDB_NAMES, `lkdv-adventure-offline-v2-${previousUserId}`];
    for (const name of names) {
      try {
        indexedDbRef.deleteDatabase(name);
      } catch {
        /* suppression best-effort */
      }
    }
  }

  if (deps.indexedDB === undefined) {
    void import('@/features/adventure-intelligence/offline/db')
      .then((mod) => mod.purgeOfflineData(previousUserId))
      .catch(() => {
        /* base déjà absente ou indisponible */
      });
  }
}
