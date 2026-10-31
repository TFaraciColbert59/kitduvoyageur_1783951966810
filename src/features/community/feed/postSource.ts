import type React from 'react';

/**
 * Source de données d'un post. Le bloc `CommunityFeedPost` ne connaît que cette
 * interface quand une surface autre que la Communauté (carnet, club…) le pilote :
 * la forme, les gestes et les animations restent ceux du fil, seules les
 * données (likes, favoris, commentaires, partage) viennent de la source.
 *
 * Sans `source`, le bloc utilise les tables de la Communauté (`community_posts`).
 */
export interface PostSource {
  liked: boolean;
  saved: boolean;
  likes: number;
  comments: number;
  shares?: number;
  onToggleLike: () => void | Promise<unknown>;
  /** Absent : pas d'entrée « Enregistrer » dans le menu. */
  onToggleSave?: () => void | Promise<unknown>;
  /** Absent : pas d'entrée « Copier le lien ». */
  onCopyLink?: () => boolean | Promise<boolean>;
  /** Absent : pas d'entrée « Republier ». */
  onRepost?: () => void | Promise<unknown>;
  /** Signalement : le flux est celui de l'hôte (feuille de signalement propre). */
  onReport?: () => void;
  /** Plusieurs médias (moments d'un carnet) : flèches et compteur, index piloté par l'hôte. */
  media?: {
    urls: string[];
    index: number;
    onIndexChange: (index: number) => void;
  };
  renderComments: (ctx: { onClose: () => void }) => React.ReactNode;
  renderShare: (ctx: { onClose: () => void }) => React.ReactNode;
  /** Texte sous la carte (jour · lieu · légende d'un moment). */
  footer?: React.ReactNode;
}
