// src/features/discovery/config.ts
// Sélection serveur du fournisseur de découverte. JAMAIS exposée au navigateur.
import 'server-only';

export type DiscoveryProviderName = 'viator' | 'klook' | 'terra' | 'legacy' | 'editorial';

/**
 * Interrupteur dur Terra. **Désactivé par défaut** : la production utilise
 * Klook. `DISCOVERY_PROVIDER=terra` ne suffit pas — il faut aussi
 * `DISCOVERY_TERRA_ENABLED=true`. Quand désactivé : aucun appel, aucune clé lue.
 */
export function isTerraEnabled(): boolean {
  const raw = process.env.DISCOVERY_TERRA_ENABLED;
  if (raw == null || raw.trim() === '') return false;
  const value = raw.trim().toLowerCase();
  return value !== 'false' && value !== '0' && value !== 'off';
}

/**
 * `DISCOVERY_PROVIDER` = `klook` (défaut prod) | `terra` | `legacy` | `editorial`.
 * Aucun fallback automatique : `terra` non activé retombe sur `editorial`
 * (contenu éditorial seul, zéro appel externe), jamais sur un autre provider.
 */
export function getDiscoveryProvider(): DiscoveryProviderName {
  const raw = (process.env.DISCOVERY_PROVIDER || 'klook').trim().toLowerCase();
  switch (raw) {
    case 'viator':
      return 'viator';
    case 'terra':
      return isTerraEnabled() ? 'terra' : 'editorial';
    case 'legacy':
      return 'legacy';
    case 'editorial':
      return 'editorial';
    case 'klook':
    default:
      return 'klook';
  }
}
