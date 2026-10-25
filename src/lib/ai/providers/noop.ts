import type { AIProvider } from './types';

/**
 * Adapter de secours : toujours "disponible" mais échoue volontairement.
 * askAI l'intercepte et produit la réponse dégradée de la feature
 * (fallbackResponse du registre) — le système reste incassable sans clé IA.
 */
export const noopProvider: AIProvider = {
  name: 'noop',

  isAvailable(): boolean {
    return true;
  },

  async complete(): Promise<string> {
    throw new Error('IA indisponible');
  },
};
