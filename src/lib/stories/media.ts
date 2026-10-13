/**
 * Stories V2 — URL d'affichage d'une story.
 *
 * Les nouvelles stories sont privées (bucket `stories-private`) : leur URL
 * stable est /api/stories/:id/media, qui revérifie can_view_story à chaque
 * accès puis redirige vers une URL signée courte.
 * Les stories legacy (image_url publique carnet-media) restent affichées
 * telles quelles — compatibilité conservée.
 */
export interface StoryMediaRow {
  id: string;
  image_url: string | null;
  storage_path?: string | null;
}

export function storyMediaUrl(row: StoryMediaRow): string | null {
  if (row.storage_path) return `/api/stories/${row.id}/media`;
  return row.image_url ?? null;
}
