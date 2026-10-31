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
      'Capsule d’actions (EngagementBar)', 'Commentaires (LikeButton)', 'Freedom (rail)', 'Sortie (kudos)',
      'Cartes carnets, tuiles communauté, Compte (compteurs)',
    ],
    reste: ['StoriesViewer (Icon heart)', 'Hub et Compas : hors périmètre (interdits)'],
  },
  {
    id: 'engagement-bar',
    label: 'Capsule d’actions (like · commenter · partager)',
    canonical: 'src/components/social-kit/EngagementBar.tsx',
    status: 'unifie',
    usedBy: ['Post photo, vidéo et texte (Communauté, Compte, Carnet, Clubs, messagerie) via CommunityFeedPost'],
    reste: ['Freedom : rail vertical, format reel volontairement distinct'],
  },
  {
    id: 'like-button',
    label: "Bouton « j'aime » + compteur",
    canonical: 'src/components/social-kit/LikeButton.tsx',
    status: 'unifie',
    usedBy: ['Commentaires (CommentItem)'],
  },
  {
    id: 'comment',
    label: 'Commentaire (avatar, nom, pseudo, badge, heure, texte, like, répondre, supprimer, réponses)',
    canonical: 'src/components/social-kit/CommentItem.tsx',
    status: 'unifie',
    usedBy: ['Freedom / panneau du fil (Communauté, Compte)', 'Carnet (CarnetCommentsPane)', 'Sortie (OutingComments)', 'Clubs (ClubCommentsPanel)'],
  },
  {
    id: 'comment-composer',
    label: 'Saisie de commentaire',
    canonical: 'src/features/posts/ui/PostReplyComposer.tsx',
    status: 'partiel',
    usedBy: ['Carnet', 'Sortie', 'Clubs', 'Réponses de story'],
    reste: ['Freedom : composer propre (pièces jointes kit/GPX)'],
  },
  {
    id: 'post-panel',
    label: 'Panneau commentaires / partage (verre sur le post)',
    canonical: 'src/features/posts/ui/PostGlassPanel.tsx',
    status: 'unifie',
    usedBy: ['Tous les posts (CommunityFeedPost)'],
  },
  {
    id: 'post',
    label: 'Post (auteur, média, capsule d’actions, panneaux, gestes)',
    canonical: 'src/features/community/feed/CommunityFeedPost.tsx',
    status: 'unifie',
    usedBy: [
      'Communauté', 'Compte (PostDrawer)', 'Carnet (PostSource)', 'Clubs (PostSource)',
      'Posts privés de club', 'Messagerie (SharedPostEmbed)',
    ],
    reste: ['Freedom : format reel vertical, volontairement distinct'],
  },
  {
    id: 'post-sheet',
    label: 'Feuille qui porte un post (poignée, glissement, Échap)',
    canonical: 'src/components/compte/overlay/PostSheet.tsx',
    status: 'unifie',
    usedBy: ['Compte (PostDrawer)', 'Carnet (CarnetPostSheet)'],
  },
];
