# Messagerie lot D — recette

**Date :** 2026-10-26
**Commits :** `9dbbb13d` (implémentation), `2c4dda51` (drawer de carte)
**Prod :** https://kitduvoyageur.faracitonyp.workers.dev/messagerie

## Livré

| Demande | Mesure prod (430 × 932) |
|---|---|
| Le volet bas ne s'agrandit plus | `.map` = `{ y: 335, h: 597 }` avant ET après ouverture d'un fil (`paneFixed: true`) ; plus de classe `mapbig` |
| Recherche en haut de la liste | `.msearch` dans la carte ; « Nouvelle discussion » → `document.activeElement` = « Rechercher une discussion, une personne ou un message » |
| Recherche transverse | « GR20 » → section `Messages` (4 résultats), liste filtrée à 2 fils |
| Swipe à droite | glissement tactile 117 px → rangée `translate3d(108px)` + boutons « Supprimer la conversation » / « Gérer les notifications » |
| Suppression + confirmation | `lkvConfirm` (ConfirmDialog Radix) « Supprimer la conversation ? » → Annuler garde 14 fils ; Supprimer retire le fil (14 → 13, absent de la liste) |
| Notifications du fil | feuille carte : `1 heure / 8 heures / 1 semaine / Désactiver` (2 colonnes) |
| Top de la discussion | plus de bandeau, plus de boutons Fermer/Agrandir ; pillule auteur `{ x: 12, y: 345, w: 202, h: 44 }` (avatar 32, radius 999, verre) |
| Drawers sur la carte | `sheet` = `card` exactement : `{ x: 12, y: 98, w: 406, h: 229 }` ; languette présente ; classe `.in` posée ; transition `.54s cubic-bezier(.32,.72,0,1)` du Compte |
| En-tête | un seul bouton : « Notifications » ; pillule « Messages » sans compteur (`messagesBadge: false`) |
| Rayons | surfaces 26 · rangées 18 · bulles 18 (queue 6) · champs/pills 999 · chips 14 |

Captures : `audit-msg/D1-list.png`, `D2-conv.png`, `E1-search.png`, `E2-swipe.png`, `E3-confirm.png`, `F1-drawer.png`, `G1-confirm.png`, `G2-after-delete.png`, `I1-list.png`, `I2-conv.png`.

## Portes

- `npx tsc --noEmit` : 0 erreur.
- `npx eslint` sur les 6 fichiers touchés : 0 erreur (1 warning préexistant sur `currentUserId` non utilisé).
- `npx vitest run src/components/messaging` : 6/6 (modèle : filtre, `left_at`, swipe borné, seuil 40 %).

## Écarts connus

1. **La cloche n'ouvre pas le sous-drawer du Compte.** Elle navigue bien vers `/compte?tab=notifications`, mais `CompteLiquidGlassV8.applyInitialTab` appelle `window.__lkdvCompteAct('openAccountDrawer', 1)` — présent, mais sans effet : `.sw-wrap` reste `data-det="card"`, aucun volet visible. Le pont legacy du Compte ne pilote pas le drawer React actuel. Correction hors périmètre messagerie (chantier Compte).
2. **Guerre de déploiement.** Trois worktrees publient le même Worker. Ma version a été écrasée à 09:53Z puis republiée ; à 11:12 locale la prod affiche bien le lot D (`msearch`, 13 fils, cloche seule). Toute recette ultérieure doit noter la version.
3. **Fil de démo supprimé.** Le test de suppression a retiré « Voyageur à l'essai » du cache de démo de ce profil navigateur (14 → 13). Aucune ligne Supabase touchée pour une conversation démo.
4. **Rangée sous le sélecteur.** La capsule de filtres flotte au-dessus de la carte (référence Compte) : la 4ᵉ rangée passe dessous. Un voile de bas de carte l'atténuerait si besoin.

## Suite possible

- Ouvrir réellement le sous-drawer Notifications du Compte (pont `openAccountDrawer` à réparer ou paramètre d'URL géré côté Compte).
- Voile de bas de carte sous la capsule de filtres.
- Swipe horizontal entre les cinq onglets de l'app (hors périmètre).
