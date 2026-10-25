# Recette — refonte Messages (lot 1 à 3)

**Date :** 25 octobre 2026, 17 h 15
**Périmètre livré :** shell de la grammaire, carte (identité, stats, bio, 4 anneaux, liste, sélecteur), zone basse (fil + réponse rapide), drawer de conversation, barre basse, recherche.
**Auteur du code :** `src/components/messaging/MessagesScreen.tsx` (1 324 lignes), `src/components/messaging/messages-grammar.css` (437 lignes), `src/app/messagerie/page.tsx`.

## Preuves

| Preuve | Résultat |
|---|---|
| `npm run design:fidelity -- /messagerie` (430) | **19/19** |
| `npm run design:fidelity -- /messagerie --all` | **19/19 à 430, 768 et 1 440** |
| `npx tsc --noEmit` | 0 erreur |
| `npx eslint` sur les fichiers touchés | 0 erreur, 0 avertissement |
| `npx vitest run tests/features/messaging tests/messaging tests/design/community-profile-messaging-link.spec.ts` | **28/28** |
| `npm run build` (heap 6 Go) | **exit 0**, 337 pages statiques |
| Écran verrouillé avec données réelles | `scrollHeight = innerHeight = 932` |
| Barre basse quand une conversation est ouverte | `opacity: 0` (mesuré) |
| Drawer de conversation | boîte **12 / 48 / 406 × 541** (mesuré) |
| Composer de la zone basse | 430 × 55 à y 877 (plus de recouvrement par la barre) |

Captures (viewer) : `avant-430.png`, `apres-430-guest.png`, `apres-430-data.png`, `apres-430-conv.png`, `apres-430-drawer.png`, `avant-conv-430.png`.

## Ce qui a été vérifié à l'écran, avec les données du compte démo

- Liste réelle : 12 discussions, 49 non-lus, 0 demande, avatars et aperçus réels.
- Filtres : 4 anneaux cliquables qui filtrent réellement (Toutes / Directs / Groupes / Demandes).
- Sélection d'une conversation : identité, bio et compteurs suivent la conversation choisie.
- Fil : 26 bulles, séparateurs de jour, réactions, accusés, réponse rapide.
- Drawer : titre, membres, fil, composer complet (photo, vocal, menu GPX/équipement/rando/kit), barre sortie.
- Recherche : drawer avec personnes + messages (service A-084 conservé).

## Ce qui n'est pas encore recetté

- Les 6 feuilles secondaires (options, nouvelle discussion, menu du composer, transfert, signalement, groupe) restent sur `MobileSheet` **sombre** : fonctionnelles, hors grammaire (lot 5).
- L'état **invité** n'est pas observable en production (`DEMO_AUTO_LOGIN=true` y connecte automatiquement) : il a été capturé en local.
- Aucun test e2e Playwright sur la nouvelle route ; seuls les tests unitaires existants couvrent le service.
- La prod n'est pas déployée : la branche n'a pas été fusionnée ni déployée au moment de cette recette.
