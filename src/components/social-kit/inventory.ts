/**
 * Inventaire des briques d'interface de l'application.
 * Une brique = UNE implémentation ; chaque page la « pioche » ici.
 * `status` : 'unifie' (toutes les surfaces passent par la brique),
 *            'partiel' (reste des surfaces à migrer, listées dans `reste`).
 */
export interface InventoryEntry {
  id: string;
  label: string;
  /** Composant canonique. */
  canonical: string;
  status: 'unifie' | 'partiel';
  /** Surfaces qui l'utilisent. */
  usedBy: string[];
  /** Surfaces encore à migrer. */
  reste?: string[];
}

export const UI_INVENTORY: InventoryEntry[] = [
  {
    id: 'like-icon',
    label: "Icône « j'aime »",
    canonical: 'src/components/social-kit/LikeIcon.tsx',
    status: 'unifie',
    usedBy: [
      'Fil Communauté (CommunityPostMedia)', 'Freedom (FreedomActionsPill, commentaires)',
      'Post Compte (PostCardSurface)', 'Carnet (CarnetPostSheet)', 'Sortie (OutingComments)',
      'Cartes carnets (CarnetHubCard, MobileCarnetCard, CarnetTile ×2)', 'Compte (ActiviteCard, CarnetsTab, MesCarnetsCard, DetailDrawers, shared)',
      'AccountActionPill', 'Commentaires (CommentItem via LikeButton)',
    ],
    reste: ['StoriesViewer (Icon heart), CommunityPostCard (HeartSvg délègue déjà), CompasCards (gelé)'],
  },
  {
    id: 'like-button',
    label: "Bouton « j'aime » + compteur",
    canonical: 'src/components/social-kit/LikeButton.tsx',
    status: 'partiel',
    usedBy: ['Commentaires (CommentItem)'],
    reste: ['Capsule d’actions des posts : encore des <button> locaux qui portent LikeIcon'],
  },
  {
    id: 'comment',
    label: 'Commentaire (avatar, nom, heure, texte, like, répondre, modifier/supprimer/signaler, réponses)',
    canonical: 'src/components/social-kit/CommentItem.tsx',
    status: 'partiel',
    usedBy: ['PostCommentsPanel (fil, Compte, Club)', 'FreedomCommentsDrawer'],
    reste: ['OutingComments', 'CarnetCommentsPane', 'CommentsSheet', 'CommentItem communaute/', 'CommunityPostCard (fil legacy)', 'ClubInlineFeed'],
  },
  {
    id: 'comment-composer',
    label: 'Saisie de commentaire',
    canonical: 'src/features/posts/ui/PostReplyComposer.tsx',
    status: 'partiel',
    usedBy: ['PostCommentsPanel', 'Réponses de story'],
    reste: ['Freedom (composer propre : pièces jointes kit/GPX)', 'OutingComments', 'CarnetCommentsPane'],
  },
  {
    id: 'comment-panel',
    label: 'Panneau commentaires / partage (verre sur le post)',
    canonical: 'src/features/posts/ui/PostGlassPanel.tsx',
    status: 'partiel',
    usedBy: ['CommunityFeedPost', 'ClubInlineFeed'],
    reste: ['Freedom (tiroir plein écran)', 'CarnetPostSheet / PostDrawer (OverlaySheet)'],
  },
  {
    id: 'post',
    label: 'Post (auteur, média, capsule d’actions)',
    canonical: 'src/features/community/feed/CommunityFeedPost.tsx',
    status: 'partiel',
    usedBy: ['Fil Communauté', 'ClubInlineFeed'],
    reste: ['PostCardSurface (Compte)', 'CarnetPostSheet', 'CommunityPostCard (legacy)', 'Freedom (format reel vertical, volontairement distinct)'],
  },
];
