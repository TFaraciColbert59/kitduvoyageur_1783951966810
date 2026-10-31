# Inventaire des briques d'interface (social)

Principe : **une brique = une implémentation**. Les pages piochent dans `src/components/social-kit/` ; les nuances (reel plein écran, carte Club…) passent par des props, jamais par un second composant.
Source de vérité machine : `src/components/social-kit/inventory.ts` (`UI_INVENTORY`).

| Brique | Canonique | État |
|---|---|---|
| Icône « j'aime » | `social-kit/LikeIcon` | **Unifiée** (verrou : `__tests__/likeUnique.test.ts`) |
| Bouton « j'aime » + compteur | `social-kit/LikeButton` | Partiel (commentaires) |
| Commentaire | `social-kit/CommentItem` (données `SocialComment`) | Partiel : fil/Compte/Club (`PostCommentsPanel`) + Freedom |
| Saisie de commentaire | `features/posts/ui/PostReplyComposer` | Partiel |
| Panneau commentaires/partage | `features/posts/ui/PostGlassPanel` | Partiel |
| Post | `features/community/feed/CommunityFeedPost` | Partiel |

## Reste à migrer (ordre conseillé)
1. `OutingComments`, `CarnetCommentsPane`, `CommentsSheet`, `communaute/CommentItem`, `CommunityPostCard` → `CommentItem`.
2. Capsule d'actions des posts (like/commenter/partager) → `EngagementBar` unique (aujourd'hui 4 `<button>` locaux dans `CommunityPostMedia`, `PostCardSurface`, `CarnetPostSheet`, `FreedomActionsPill`).
3. Tiroirs `PostDrawer` / `CarnetPostSheet` / Freedom → `PostGlassPanel`.
4. `PostCardSurface`, `CarnetPostSheet` → `CommunityFeedPost`.

## Règle
Jamais de `<Heart>` lucide ni de SVG de cœur hors `LikeIcon` : le test échoue sinon.
