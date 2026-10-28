# Messagerie — lot D : recherche intégrée, actions de rangée, volet fixe, drawers carte

**Date :** 2026-10-26
**Statut :** spec à valider (aucun code écrit)
**Référence visuelle :** `/compte` (carte `.card.cs`, drawer `.sw-wrap[data-det="card"]`, pillule `.lkdv-post-author` de la grille communautaire)

## 1. Intention

Quatre familles de changements, dans l'ordre de valeur :

1. **La conversation ne bouge plus.** Le volet bas garde sa hauteur ; on supprime la bascule `mapbig` et tout le bandeau d'en-tête (fermer, agrandir, avatar-nom).
2. **La recherche entre dans la carte.** Une barre en haut de la liste remplace le drawer de recherche et le bouton « écrire ». « Nouvelle discussion » met le curseur dedans.
3. **Les rangées agissent vers la droite.** Glisser une rangée vers la droite révèle deux actions : `Supprimer` (confirmation modale) et `Notifications` (feuille de réglages du fil).
4. **Les drawers sont des drawers de carte.** Ils se superposent à la carte liste bord à bord, avec la languette, et l'animation `.sw-wrap[data-det="card"]` du Compte.

Et deux nettoyages demandés : en-tête réduit à la seule cloche (la cloche mène au sous-drawer Notifications du Compte), pillule « Messages » sans compteur.

## 2. Décisions de conception

| Sujet | Décision | Raison |
|---|---|---|
| Suppression | `conversation_members.left_at = now()` — supprimer **pour moi** | La colonne existe déjà (aucune migration), `getConversations` ne la filtre pas encore. Instagram fait pareil : l'autre garde le fil. |
| Confirmation | Dialogue verre `role="alertdialog"` dans `.phone`, boutons Annuler / Supprimer | `window.confirm` casse la grammaire et bloque le fil. |
| Notifications | Feuille de carte avec 4 choix : 1 h, 8 h, 1 semaine, Désactiver | `updateMemberPreferences({ is_muted, mute_until })` existe déjà. |
| Recherche | Une seule barre : conversations + personnes + messages | Réutilise `query`, `searchPeople`, `searchMessages`. Aucun nouvel appel réseau pour les conversations. |
| Nouvelle discussion | Focus de la barre (`searchRef.current?.focus()`), pas de drawer | Demande explicite. |
| Cloche | `router.push('/compte?tab=notifications')` | `MobileCompteV2 → CompteLiquidGlassV8` ouvre déjà le sous-drawer Notifications avec `initialTab='notifications'`. |
| Hauteur du volet | `grid-template-rows: 335px minmax(0,1fr)` figé | Demande explicite : « ne doit pas s'agrandir ». |
| Pillule | Reprise mesurée de `.lkdv-post-author` (44 px, avatar 32, radius 999, verre) avec les jetons de la messagerie | Les tokens `--feed-*` ne sont pas définis hors communauté. |
| Rayons | Surfaces 26 · rangées 18 · bulles 18 (queue 6) · champs/pills/boutons ronds 999 · chips 14 | Une seule échelle, plus de 12/14/20/24/32 mélangés. |
| Suppression du sheet conversation | Oui (bouton agrandir retiré, en-tête retiré) | Plus d'ancre pour le geste, plus de surface doublon. |

## 3. Ce qui disparaît

- Boutons `Écrire`, `Rechercher` et badge de la cloche dans `.ig-top`.
- Compteur `tb-badge` de la pillule « Messages ».
- `.mpane-h` (bandeau) et ses boutons `Fermer` / `Ouvrir en grand`.
- État `sheetOpen` et `AccountDrawerHost` de conversation.
- Gestes associés : glissement du volet, swipe-up d'ouverture.
- Classe `mapbig` sur `.phone` et ses règles CSS.
- `searchOpen`, `newOpen` et leurs drawers.

## 4. Ce qui reste / s'ajoute

- Sélection d'une rangée → volet fixe, pillule en haut à gauche.
- Long press / swipe → options (inchangé), désormais dans un drawer de carte.
- Bloc recherche avec 3 sections (Discussions, Personnes, Messages), 2 caractères minimum pour les deux dernières.
- Dialogue de suppression + feuille de notifications.
- `AccountDrawerHost` gagne une variante `card` (géométrie + animation Compte) ; la variante `floating` reste le défaut pour ne rien casser ailleurs.

## 5. Risques

1. **Autre session en déploiement.** Trois worktrees publient le même Worker avec un autre design de /messagerie (`MessageInbox`). Toute recette prod peut être écrasée en quelques secondes : le lot se juge sur un déploiement isolé (worktree au HEAD) et la version doit être notée.
2. **`left_at` et les vues.** Le filtre ne s'applique que dans `getConversations` (client). Les RPC de comptage non lues devront être vérifiés pour ne pas compter un fil supprimé.
3. **Drawer mesuré.** La géométrie carte est mesurée à l'ouverture (ResizeObserver) : elle doit suivre le clavier et les changements de hauteur du shell.
