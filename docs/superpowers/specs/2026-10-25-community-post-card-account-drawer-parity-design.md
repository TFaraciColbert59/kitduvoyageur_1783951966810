# Carte post Communauté = drawer post Compte — design (v2, compte rempli)

**Date :** 2026-10-25
**Statut :** relevé sur la dernière version Cloudflare + compte démo `lea.fontaine`
**Périmètre :** `CommunityFeedPost` et `PostDrawer`.

## Vérité unique

`PostDrawer` du Compte, dernière version déployée. Compte de recette : `demo@lkdv.app` (`lea.fontaine`, 18 publications, 10 carnets, 6 clubs, 20 badges).

## Mesures

### Drawer Compte — pane post
- sheet `406×541`, `x=12 y=48`, rayon 28.
- header verre 60 px, avatar 40, nom 15, handle + temps, `···`, **X**.
- média **4:5**, plein cadre.
- capsule d’actions à droite : **like 2 / commentaire 5 / partage 2**, boutons ~46×31.
- menu options : **rail vertical** (Enregistrer, Copier, Republier, Signaler, Supprimer) + X.
- pas de légende.

### Drawer Compte — panes partage / commentaires
- sheet étendue jusqu’au bas de la carte : `406×794`, `x=12 y=48`.
- partage : onglets **Envoyer / Partage externe**, recherche, actions, liste conversations.
- commentaires : liste, likes/réponses/modifier/supprimer, composer textarea.
- navigation par LensPager 3 panes (partage / post / commentaires).
- fermeture : X, poignée, swipe.

### Carte Communauté actuelle
- carte `410×410`, `x=10 y=163`, rayon 28, fond `#17402C`.
- média **1:1**.
- header `pmi-author` 36 px, avatar 28, sans temps.
- capsule comptée 34 px.
- menu déroulant 4 entrées.
- panneaux commentaires/partage `410×354`, à 80 % de la carte.
- pas de X, pas de rail d’options, pas de tabs de partage, pas d’expansion à 794.

## Écarts structurants

1. Le Compte est une **sheet** ; le fil est une **carte**.
2. Le Compte a **3 panes** ; le fil 2 panneaux.
3. Le Compte **s’étend** pour partage/commentaires ; le fil reste à 410×410.
4. Le Compte a un **rail d’options** ; le fil un dropdown.
5. Le Compte a une **X** ; le fil n’en a pas.
6. Le Compte a des **onglets de partage** ; le fil non.
7. Le média Compte est **4:5** ; le fil **1:1**.
8. Header 60/40/temps vs 36/28/sans temps.
9. Le Compte a un **grab** et un swipe de fermeture.
10. Le Compte a un carrousel média ; le fil non.

## Critères

- Carte fil `406×541` au repos, `406×794` en partage/commentaires, `x=12`.
- Même header, même X, même rail, mêmes compteurs, même capsule.
- Même LensPager 3 panes, mêmes onglets de partage, même composer.
- Aucun `PostGlassPanel`, `lkdv-share-mini`, dropdown `AccountMoreMenu` dans le fil.
- Tests visuels + E2E + build Cloudflare.
