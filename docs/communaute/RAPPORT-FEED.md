# Rapport — Communauté, fil Instagram LKDV

**Date :** 2026-10-23
**Branche :** `chantier/communaute-feed` (commits `1c082514`, `3c8ae297`)
**Périmètre :** `/communaute` — fil, stories, création, barre basse Compte.
**Aucun push, aucun déploiement, aucune migration.**

---

## 1. Ce qui est livré

| Livrable | Preuve |
|---|---|
| Barre supérieure : pastille auteur 28 px + nom + `@handle`, bouton `+` 38 px | `feed-after-430-clean.png` |
| Stories en rail, sans en-tête, sous la barre | `.lkdv-feed-stories`, `CommunityStoriesBar` |
| Fil unique de posts, sans héro, sans filtres, sans grille | 10 posts au premier écran, 5 textuels |
| Post image carré `1:1`, radius 28, image plein cadre, **aucune légende** | `feed-after-430-clean.png` |
| Post texte : fond de la carte Compte, texte par-dessus, hauteur auto **≤ carré** | capture 430, `max-height:100cqw` |
| Pastille auteur + `···` + capsule like/commentaire/partage 3 × 34 px | captures |
| Menu `···` : Enregistrer, Republier, Copier le lien, Signaler | `feed-menu-430.png` |
| Drawer de création : 5 lignes du Compte (carnet, voyage, kit, club, story) | `feed-create-430.png` |
| Barre basse **du Compte** : 5 onglets Explorer/Compas/Matériel/Hub/Compte, 48 px | captures 430 et 1440 |
| Feuille de commentaires basse | `feed-comments-430.png` |
| Desktop : colonne 520 px centrée, barre 500 px | `feed-1440.png` |
| Anciennes pages Communauté remplacées par des redirections | `decouvrir`, `reels`, `publier`, `post/[id]` → `/communaute` |
| Nettoyage : 7 composants du hub supprimés | voir §4 |

**Captures :** `docs/communaute/feed-after-430-clean.png`, `feed-create-430.png`,
`feed-comments-430.png`, `feed-menu-430.png`, `feed-1440.png`.

---

## 2. Preuves exécutées

| Commande | Résultat |
|---|---|
| `tsc --noEmit` (worktree propre) | **0 erreur** |
| `npm run build` (worktree propre) | **exit 0**, partagé 105 kB, middleware 98,3 kB |
| `npx vitest run` (communauté, lot2, m02, p5, profils publics) | **49/49 + 32/32** |
| `npx playwright test tests/visual/community-feed.spec.ts` (4 projets) | **20/20** |
| Page `/communaute` | HTTP 200, 10 posts, 5 textuels, 5 onglets bas, 0 erreur console |
| Drawer création | 5 lignes |
| Menu `···` | 4 actions |
| Commentaires | feuille ouverte, 0 erreur réseau |

---

## 2 bis. Boutons et fonctionnalités vérifiés (2026-10-23)

| Parcours | Résultat |
|---|---|
| Invité — like | redirige vers `/connexion?next=/communaute` |
| Invité — enregistrer (menu) | redirige vers `/connexion?next=/communaute` |
| Invité — commentaires | feuille lisible, composer remplacé par « Se connecter » |
| Invité — story (drawer) | redirige vers `/connexion?next=/communaute` |
| Invité — copier le lien | toast « Lien copié. » |
| Drawer de création | 5 lignes, destinations `/carnets/nouveau`, `/voyages`, `/materiel`, `/clubs/nouveau` |
| Barre basse | 5 liens : `/explorer`, `/compas`, `/materiel`, `/hub`, `/compte` (tous 200) |
| Fil — charger plus | 10 → 20 posts |
| Lien profond `?post` | scroll jusqu’au post ; `?comment` ouvre la feuille |
| Authentifié — like | cœur rempli (`aria-pressed=true`) |
| Authentifié — enregistrer | toast « Enregistré. », menu « Retirer des enregistrements » |
| Authentifié — commentaire | envoi, réponse, like, suppression, toast |
| Authentifié — signaler | feuille de motifs, envoi, toast « Signalement envoyé. Merci. » |
| Authentifié — story | bouton « Votre story » ouvre le sélecteur ; « Archives » ouvre la feuille |
| Story viewer | ouverture, fermeture ; boutons Aimer / Signaler / Bloquer présents |

**Preuves :**
- `npx playwright test tests/e2e/community-feed-actions.spec.ts` → **6/6**.
- `npx vitest run` (communauté, lot2, m02, p5, profils publics) → **49/49 + 32/32**.
- `npx playwright test tests/visual/community-feed.spec.ts` → **20/20**.
- `tsc --noEmit` (worktree propre) → **0**.
- `npm run build` (worktree propre, HEAD `9f082b7d`) → **exit 0**.
- Un compte de test `audit-feed-…@example.com` a servi aux parcours authentifiés ; aucun identifiant n’est versionné.

---

## 3. Décisions appliquées

- **Barre basse littérale du Compte** : Explorer, Compas, Matériel, Hub, Compte. Aucun actif sur
  `/communaute`, lentille masquée.
- **Aucune légende** sur les posts image.
- **Post texte** : fond `rgba(255,255,255,.62)` + blur 25 px (carte Compte), texte `#17402C`
  15/1.4, `height:auto`, `max-height:100cqw`, `min-height:120px`.
- **Drawer de création** : exactement 5 lignes ; pas de « Nouvelle publication ».
- **Anciennes pages Communauté** : supprimées de l'UI et remplacées par des redirections.
- **Cinq pages métier** (`/carnets`, `/clubs`, `/groupes`, `/evenements`, `/entraide`) conservées :
  elles sont liées ailleurs (26 liens recensés).

---

## 4. Nettoyage

Supprimés :
`CommunityGrid`, `CommunityContentDrawer`, `CommunityHeroCard`, `CommunityContextDrawer`,
`MobileCommunityHub`, `MobileCommunityHeader`, `CommunityShell`, `useCommunityTotals`.

Découpés / remplacés :
- `CommunityPostCard` reste pour `/feed` et les clubs ; le fil utilise `CommunityFeedPost` et
  `usePostInteractions` / `usePostComments`.
- CSS du hub (`community-social.css`) conservé pour les stories et les sous-routes historiques ;
  le nouveau fil vit dans `community-feed.css` + `account-glass.css`.

---

## 5. Résiduels assumés

1. **Redirections en meta-refresh** : les anciennes pages répondent 200 avec `NEXT_REDIRECT` +
   meta refresh, pas un 307 serveur. Le comportement navigateur est correct ; un vrai 301/307
   demanderait le registre de routes.
2. **Like de commentaire** : `post_comments.likes_count` n'existe pas dans la base live ; le
   compteur est recalculé depuis `post_comment_likes` (comme l'ancienne carte).
3. **Partage** : ne crée toujours pas de `post_shares` ; `shares_count` reste décoratif.
4. **`/feed` et les clubs** utilisent encore `CommunityPostCard` ; sa refonte n'est pas incluse.
5. **Stories authentifiées** : non testées en E2E (session absente) ; le rail guest affiche
   l'invitation.
6. **WIP parallèle** : le dossier non suivi `src/components/compte/overlay` et les modifications
   Compte n'ont pas été touchés ni commités.

---

## 6. État de l'environnement

Le serveur de développement principal tourne sur `http://localhost:4000`. Le build et le
type-check de référence ont été exécutés dans le worktree propre
`/Users/fr168256/Desktop/lkdv-communaute-feed` pour ne pas être pollués par le WIP parallèle.
