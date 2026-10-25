# Recette — refonte Messages (lots 1 à 5)

**Date :** 25 octobre 2026, 18 h 00
**Branche :** `chantier/messagerie-refonte` (worktree dédié `~/lkdv-messages`, créé depuis `e19f897b`)
**Périmètre livré :** shell de la grammaire, carte (identité, 3 stats, bio, 4 anneaux, liste, sélecteur liste/grille), zone basse (fil + réponse rapide), drawer de conversation, barre basse, recherche, **les 7 feuilles secondaires**, correction `?to=<handle>`, gestion de groupe rebranchée.

## Preuves

| Preuve | Résultat |
|---|---|
| `DESIGN_BASE_URL=http://127.0.0.1:4011 npm run design:fidelity -- /messagerie --all` | **19/19 à 430, 768 et 1 440** |
| `npx tsc --noEmit` | 0 erreur |
| `npx eslint` (écran, page, helper, 7 feuilles) | 0 erreur, **0 avertissement** |
| `npx vitest run` messagerie + design (8 fichiers) | **51/51** |
| `PW_BASE_URL=http://127.0.0.1:4028 npx playwright test tests/e2e/messagerie-grammar.spec.ts --project=mobile-chromium` | **5/5** (build de production) |
| `DESIGN_BASE_URL=http://127.0.0.1:4028 npm run design:fidelity -- /messagerie --all` | **19/19 × 3** sur le **build de production** |
| `npm run build` (heap 6 Go) | **exit 0**, 337 pages |
| Écran verrouillé avec données réelles | `scrollHeight = innerHeight = 932` |
| Barre basse pour **chaque** surface ouverte (drawer, recherche, nouvelle discussion, options, groupe, signalement) | `opacity: 0` (mesuré) |
| Drawer de conversation | boîte **12 / 48 / 406 × 541** (mesuré) |
| Zone basse | opaque `--page`, composer à y 877 (plus de recouvrement) |
| Desktop | colonne 430 alignée en haut dès que la hauteur < 932 (barre haute et barre basse entières) |

## Captures (`evidence/`)

| Fichier | État |
|---|---|
| `avant-430.png`, `avant-768.png`, `avant-1440.png`, `avant-conv-430.png` | avant refonte (production) |
| `apres-430-guest.png` | invité (shell complet + carte de connexion) |
| `apres-430-data.png`, `v3-01-list.png` | liste avec 12 discussions réelles, 49 non-lus |
| `apres-430-conv.png`, `v3-03-pane.png` | conversation ouverte dans la zone basse |
| `apres-430-drawer.png`, `v3-04-drawer.png` | drawer de conversation (boîte de la carte) |
| `v3-02-newconv.png` | feuille « Nouvelle discussion » (annuaire réel) |
| `v3-05-options.png` | feuille « Options de conversation » (muet, archive, signaler) |

## Ce qui a été vérifié à l'écran

- Filtres : 4 anneaux, clic = filtre réel ; « Demandes » vide → phrase honnête + action.
- Recherche : drawer, 5 résultats réels (personnes + message), « Écrire » crée le DM.
- Conversation : 28 bulles, séparateurs de jour, réactions, accusés, réponse rapide, envoi (service inchangé).
- Drawer : titre, membres, « Options », « Gérer le groupe » (groupe), composer complet (photo, vocal, GPX/équipement/rando/kit), transfert, barre sortie.
- Feuilles secondaires : toutes sur `AccountDrawerHost`, contenu `.li`/`.ttl`/`.s2`/`.mbtn`, sous-drawer « muet » avec retour parent.
- `?to=<handle>` : résolution du handle public → DM, `?dest=` prioritaire, handle invalide → message d'erreur, jamais de faux destinataire.

## Ce qui reste

1. **Déploiement prod** : `wrangler` n'est pas authentifié dans cette session (`You are not authenticated`) et ce worktree ne porte pas la configuration de déploiement. Rien n'est déployé.
2. **e2e Playwright** : `tests/e2e/messagerie-grammar.spec.ts` (5 tests) couvre l'état **invité** sur le build de production (écran verrouillé, carte, barre, 4 filtres, drawer de recherche + barre sortie, carte de connexion). Les parcours **connectés** (liste réelle, conversation, envoi) restent en recette manuelle : le harnais n'a pas de session de test.
3. **Code mort** : `MessageInbox`, `ConversationList`, `ConversationRow`, `ConversationView`, `MessageList`, `MessageBubble` ne sont plus montés par la route. Ils restent en place (nettoyage hors périmètre de la refonte) — à supprimer dans un lot dédié, avec `cards/*`.
4. **Colonne desktop** : à 1 440 × 900 la page fait 932 px de haut (invariant de la porte) : les 16 derniers pixels de la barre demandent un défilement de 32 px.

## Risques

- **Autre session active dans `~/lkdv-pays`** : elle a commité mes fichiers à 17 h 00 dans un commit « docs(pays) ». D'où le worktree dédié ; ne pas travailler à deux dans le même.
- Certaines feuilles secondaires restent portées hors du `.phone` (Radix) : si une nouvelle feuille est ajoutée, vérifier qu'elle hérite bien des jetons.
- Le compte démo de production contient des comptes de test visibles dans l'annuaire (« Test Recette », « Final Recette ») : donnée à nettoyer, hors code.
