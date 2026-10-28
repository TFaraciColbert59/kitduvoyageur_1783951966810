import type { MediaItem } from './mediaTypes';

/**
 * Média unique de couverture à l’envoi.
 *
 * Le `MediaPicker` téléverse dès la sélection : on refuse donc une couverture
 * encore en cours, en échec, ou jamais envoyée (aucune URL), plutôt que
 * d’insérer une couverture vide.
 */
export function resolveCoverUrl(items: readonly MediaItem[], label = 'La couverture'): string | null {
  const item = items[0];
  if (!item) return null;
  if (item.status === 'uploading') {
    throw new Error(`Attends la fin de l’envoi de ${label.toLowerCase()}.`);
  }
  if (item.status === 'error') {
    throw new Error(`${label} n’a pas pu être envoyée. Réessaie ou retire-la.`);
  }
  if (!item.url) {
    throw new Error(`Envoie ${label.toLowerCase()} avant de valider.`);
  }
  return item.url;
}

/** Un média est-il encore en cours d’envoi ? */
export function hasUploadingMedia(items: readonly MediaItem[]): boolean {
  return items.some((item) => item.status === 'uploading');
}

/** Un média a-t-il échoué ? */
export function hasFailedMedia(items: readonly MediaItem[]): boolean {
  return items.some((item) => item.status === 'error');
}
