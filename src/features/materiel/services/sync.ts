import { syncOffline } from '@/lib/materiel/db';

/** Sync hors-ligne : délègue à lib/materiel/db.syncOffline (last-write-wins). */
export async function syncOnReconnect(userId: string) {
  return syncOffline(userId);
}

/** Connecte la sync au retour en ligne. */
export function startOfflineSync(userId: string) {
  const onOnline = () => { syncOnReconnect(userId); };
  window.addEventListener('online', onOnline);
  return () => window.removeEventListener('online', onOnline);
}
