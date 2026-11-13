import { AsyncLocalStorage } from 'node:async_hooks';

/**
 * Santé des cartes pendant une recherche de lieu (audit 13/11). `search` rend null aussi bien
 * quand AUCUN service n'a répondu que quand la carte n'a rien trouvé : « lieu introuvable »
 * s'affichait alors pour une panne. Les signatures publiques restent les mêmes ; l'appelant qui
 * veut les distinguer enveloppe sa recherche dans `withLookupHealth` (contexte asynchrone propre
 * à cet appel, rien de partagé entre requêtes).
 */
interface LookupHealth {
  /** Recherches où au moins un service a répondu (même une liste vide). */
  answered: number;
  /** Recherches où tous les services ont échoué (réseau, 5xx, 429, créneau plein, secours muets). */
  failed: number;
}
const healthStore = new AsyncLocalStorage<LookupHealth>();
export const noteAnswered = () => {
  const h = healthStore.getStore();
  if (h) h.answered += 1;
};
export const noteFailed = () => {
  const h = healthStore.getStore();
  if (h) h.failed += 1;
};

/**
 * Exécute `run` en notant l'état des cartes. `unavailable` : au moins une recherche a eu lieu
 * et TOUTES ont échoué (aucun service n'a répondu) ; une recherche servie par le cache, ou une
 * réponse vide d'un service qui fonctionne, n'est pas une panne.
 */
export async function withLookupHealth<T>(run: () => Promise<T>): Promise<{ value: T; unavailable: boolean }> {
  const health: LookupHealth = { answered: 0, failed: 0 };
  const value = await healthStore.run(health, run);
  return { value, unavailable: health.failed > 0 && health.answered === 0 };
}

