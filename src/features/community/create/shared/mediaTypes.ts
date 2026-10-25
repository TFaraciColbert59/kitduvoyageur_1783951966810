/**
 * Types partagés du sélecteur de médias.
 *
 * Le fichier ne dépend ni de React ni de Supabase : les schémas Zod et les
 * formulaires peuvent l’importer sans charger le composant client.
 */

export type MediaItemStatus = 'local' | 'uploading' | 'uploaded' | 'error';

export interface MediaItem {
  id: string;
  name: string;
  /** Type MIME du fichier. */
  type: string;
  /** Taille en octets. */
  size: number;
  /** URL locale (`blob:`) ou distante utilisée pour la prévisualisation. */
  previewUrl: string;
  /** URL publique une fois l’upload terminé. */
  url: string | null;
  /** Texte alternatif obligatoire pour les images à l’envoi. */
  alt: string;
  /** Image de couverture de la publication. */
  cover: boolean;
  status: MediaItemStatus;
  /** Progression de l’upload, de 0 à 100. */
  progress: number;
  error?: string;
  /** Fichier d’origine, conservé pour l’upload et le réessai. */
  file?: File;
}

/** Téléverse un fichier et renvoie son URL publique. */
export type MediaUploader = (
  file: File,
  onProgress?: (percent: number) => void,
) => Promise<string>;
