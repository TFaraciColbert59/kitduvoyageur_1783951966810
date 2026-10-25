# Rapport — Communauté v3 « Pour toi », tiroirs et panneaux

**Date :** 2026-10-23
**Branche :** `chantier/communaute-feed`
**Production :** https://kitduvoyageur-1783951966810-963g3pn4t.vercel.app
**Alias Vercel :** https://koosmoweb.fr

---

## 1. Livré

| Élément | État |
|---|---|
| Pillule **texte « Pour toi » + chevron**, sans avatar | livré |
| Menu déroulant **Carnets / Clubs / Sorties** | livré |
| Demi-tiroir **50dvh max**, sélecteur 4 cellules 48 px, lentille | livré |
| Recherche **dans le même demi-tiroir** (loupe, champ autofocus, résultats posts/carnets/clubs/sorties) | livré |
| Cloche → `/compte?tab=notifications` → drawer Notifications du Compte | livré et testé en prod |
| Sections Carnets / Clubs / Sorties : filtres, lignes, détail, rejoindre/quitter, créer, tout voir | livré |
| Drawer de création : grille 2×2 + Story pleine largeur, même coquille 50 % | livré |
| Pillule auteur riche : avatar, nom, badge de confiance, `lieu · spot · temps` | livré |
| Toutes les cartes carrées 1:1, texte compris | livré et mesuré |
| Stories : la nôtre en premier, `+` vide si aucune, ring sage du Compte, plus de conic | livré |
| Commentaires : panneau **exactement superposé** à la carte, swipe droite | livré et mesuré |
| Partage : panneau superposé, swipe gauche, actions + conversations | livré |
| Envoi du post complet en messagerie (`message_type='post'`, `PostMessageCard`) | livré |
| Mentions `@` dans les commentaires (token + picker + liens profil) | livré |
| Gates invités/essai + toasts | livré |

---

## 2. Preuves

| Vérification | Résultat |
|---|---|
| `tsc --noEmit` | **0 erreur** |
| `npm run build` (worktree propre) | **exit 0** |
| Vitest contrats + API + messagerie + mentions | **45/45** |
| Playwright visuel (`community-feed`, 4 projets) | **20/20** |
| Playwright e2e actions (série) | **6/6** |
| Production `/communaute` | **200**, 10 posts, 3 cartes mesurées **410×410** |
| Production — recherche | champ **autofocus**, **6 résultats** |
| Production — panneau commentaires | **410×410**, identique à la carte |
| Production — panneau partage invité | gate « Se connecter pour envoyer » |
| Production — auth | like `aria-pressed=true`, cloche → `/compte?tab=notifications`, drawer Notifications ouvert |
| Production — erreurs console | **0** |

**Captures :** `docs/communaute/v3-drawer.png`, `v3-drawer-clubs.png`, `v3-drawer-sorties.png`,
`v3-create.png`, `v3-search.png`, `v3-comments-panel.png`, `v3-share-panel.png`,
`v3-stories-anon.png`, `prod-v3.png`, `prod-bell.png`, `prod-auth.png`.

---

## 3. Corrections en cours de route

1. **Tokens de verre dans le portail** : le demi-tiroir et les panneaux sont portés au body, hors
   `.lkdv-account-glass` ; les variables `--feed-ink`, `--feed-muted`, `--bar-glass-*` ont été
   rescopées sur `.lkdv-half-drawer` / `.lkdv-post-panel`.
2. **Focus recherche** : le focus initial prenait le premier bouton (fermeture) ; il cible maintenant
   `[data-autofocus]` en priorité.
3. **Swipe** : l'image native interceptait le glissement ; `draggable={false}` + seuil 56 px.
4. **Adhésion messagerie** : `conversation_members` n'a **pas** de colonne `status` ; la route
   `/api/compte/share-post` vérifie désormais `left_at IS NULL`. Sans ce correctif, l'envoi du post
   en message renvoyait 500.
5. **Anciennes feuilles** : `CommunityCommentsSheet` et `AccountCreateSheet` supprimées.

---

## 4. Résiduels

- La **loupe** est incluse ; elle ouvre le même tiroir, pas un écran séparé.
- Les **résultats de recherche** sont limités à 4 par catégorie.
- Le **détail de section** est compact (cover, stats, description 3 lignes, action, page complète).
- L'**upload réel d'une story** n'a pas été publié (sélecteur, viewer, archives testés).
- **Push GitHub refusé (403)** par le remote ; le déploiement production a été fait par **Vercel CLI**
  depuis une archive propre du commit, pas par `main`. Un futur déploiement de `main` pourrait
  écraser cette version si `main` n'est pas fusionnée.
- Un compte de test `audit-v3-…@example.com` a servi aux parcours authentifiés ; aucun identifiant
  n'est versionné.

---

## 5. Déploiement

```bash
# archive propre du commit, sans .next ni node_modules
git archive chantier/communaute-feed | tar -x -C /tmp/lkdv-v3-deploy
cp .vercel/project.json /tmp/lkdv-v3-deploy/.vercel/
cd /tmp/lkdv-v3-deploy
npx vercel --prod --yes
```

Deux déploiements production :
1. première version ;
2. correctif adhésion messagerie + tests, puis re-test production.

URL de production : **https://kitduvoyageur-1783951966810-963g3pn4t.vercel.app**
