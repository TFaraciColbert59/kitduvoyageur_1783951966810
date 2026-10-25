# Audit — page Messages (`/messagerie`) avant refonte

**Date :** 25 octobre 2026, 16 h 30 (Europe/Paris)
**Dépôt audité :** `~/lkdv-pays` — branche `chantier/pays-refonte` (seule branche qui porte la porte `design:fidelity` et les primitives de la grammaire)
**Cible mesurée :** production `https://kitduvoyageur.faracitonyp.workers.dev/messagerie` (alias `lkdv.app` bloqué par le proxy du poste)
**Session :** compte démo `lea.fontaine`, auto-connexion serveur active en prod (`DEMO_AUTO_LOGIN=true`)
**Méthode :** Chromium, `getComputedStyle` + `getBoundingClientRect`, viewports 430×932, 768×1024, 1440×900 ; captures regardées une par une ; données réelles lues dans Supabase (`icxyvwzfjbflcbqukpfz`).

---

## 1. Captures avant (preuves)

| Fichier | Ce qu'il montre |
|---|---|
| `evidence/avant-430.png` | Liste des discussions, 430×932 — deux champs de recherche empilés, 20 lignes, barre flottante sombre |
| `evidence/avant-conv-430.png` | Conversation ouverte — le calque est translucide, la liste transparaît, le composer est sous la barre |
| `evidence/avant-newconv-430.png` | Feuille « Nouvelle Discussion » — verre sombre, barre basse toujours visible |
| `evidence/avant-768.png` | Tablette — barre flottante collée en haut, chevauche l'en-tête du site |
| `evidence/avant-1440.png` | Desktop — même chevauchement, double navigation, deux champs de recherche |
| `evidence/ref-compte-430.png` | **Référence** `/compte` au même viewport, même session |
| `evidence/ref-compte-1440.png` | Référence à 1440 — châssis 390×844, `scrollHeight` 973 > 900 |
| `evidence/ref-carnet-1440.png` | `/carnets/[id]` en prod — 1 751 px de haut : la fiche refondue **n'est pas encore déployée** |

---

## 2. Mesures : la page Messages contre les 19 ancres

Référence mesurée le 25/10 à 16 h 34 sur `/compte` (valeurs identiques à `references/grammaire-compte.md`).

| # | Ancre | Loi (Compte, 430) | Messages aujourd'hui | Verdict |
|---|---|---|---|---|
| 1 | Écran verrouillé | `scrollHeight` = 932 | **1 301** | ✗ |
| 2 | Base typo | 14 px / −0,14 px / `#172B24` sur `.phone` | pas de `.phone` ; corps à **17 px**, texte **blanc** | ✗ |
| 3 | Barre haute `.ig-top` | 12 / 6 / 406 × 36 | **absente** | ✗ |
| 4 | Pilule `.ig-handle` | h 34, r999, 16/600, −0,32 px | **absente** | ✗ |
| 5 | 3 boutons `.ig-top-btn` | 3 × 38×38 r50 % | **absents** | ✗ |
| 6 | Carte `.card.cs` | 12 / 48 / 406 × 541,1, r24 | **absente** (une `.lkv-glass` de 430 × 1 117 fait office de carte) | ✗ |
| 7 | Scroll interne `.card-scroll` | pad `8 12 56`, gap 7 | **absent** — le scroller mesure 428 × 1 048, `scrollHeight` = `clientHeight` | ✗ |
| 8 | Identité `.ig-header` | 24 / 56 / 382 × 68 | **absente** | ✗ |
| 9 | Stats `.ig-stat` | 3 × 100,7 × 38,5 r14 | **absentes** | ✗ |
| 10 | Bio `.ig-bio-text` | 378 px, 12/15,6 | **absente** | ✗ |
| 11 | Anneaux `.ig-hl` / `.ig-hl-ring` | 71,6×56,4 / 44 | **absents** | ✗ |
| 12 | Grille `.ig-grid-wrap` / `.ig-tile` | 406, gap 3 / 134 r2 | **absente** | ✗ |
| 13 | Sélecteur `.ig-tabs` | 88 × 30, lentille 41,5 × 25 | **absent** | ✗ |
| 14 | Barre basse `.tb` | 14 / 868 / 402 × 48, 5 items 80×44 | `nav.lkdv-floating-tabbar` **0 / 872 / 430 × 52** ; surface **398 × 52 r999 à (16, 872)** ; items **77,6 × 44** ; libellés **9 px/600** ; **pas de lentille** | ✗ |
| 15 | Police unique | SF/Inter | **3 familles** servies, dont **IBM Plex Mono** (horodatages) | ✗ |
| 16 | Matière | verre clair `rgba(255,255,255,.486)` / encre `#172B24` | verre **sombre** `rgba(16,16,16,.34)` `blur(14px)` / texte **blanc** | ✗ |
| 17 | Barre haute : 0 retour, 0 `···` | création · recherche · notifications | aucun des trois | ✗ |

**Synthèse : 19 ancres, 0 conforme.** La page n'est pas « presque » la grammaire : elle appartient à l'ancien système (`--glass-*`, `--lkv-*`, `Card`, `PageHeader`, `BottomTabBar`), et son verre est **sombre** là où la référence est claire.

Valeurs mesurées utiles pour la refonte (avant) :

| Part | Boîte | Matière |
|---|---|---|
| Champ de recherche (page) | 51 / 18,8 / 354 × 22,4 (dans une pilule 406 × 44 r999) | `rgba(16,16,16,.34)`, `blur(12px)` |
| Champ de recherche (liste) | 52 / 73,8 / 300 × 22,4 (pilule 352 × 44) | idem |
| Ligne de conversation | 13 / 132 / **404 × 78**, r **24** | `rgba(16,16,16,.34)`, `blur(14px)` |
| Avatar de ligne | 48 × 48 r50 | — |
| Titre de ligne | **15 px / 700** (600 si lu) | blanc |
| Aperçu | **12 px** | blanc / blanc 71 % |
| Horodatage | **11 px**, **IBM Plex Mono** | blanc 71 % |
| Bulle de message | 315 × 91, r **8 / 18 / 18** | `rgba(16,16,16,.34)`, `blur(18px) saturate(1.8)`, texte **17 px** blanc |
| Séparateur de jour | 169 × 25 r999 | `rgba(16,16,16,.38)`, 11 px, MAJUSCULES |
| Composer (conversation) | 428 × 69 à y **862** | `rgba(16,16,16,.34)`, `blur(14px)` |
| Champ de saisie | 220 × 44 r18 | **fond blanc plein** |
| Feuille « Nouvelle Discussion » | 0 / 93 / 430 × 839 | verre sombre |

---

## 3. Inventaire exhaustif

### 3.1 Routes et entrées (à conserver telles quelles)

| Entrée | Comportement |
|---|---|
| `/messagerie` | liste des discussions |
| `/messagerie?conversation=<uuid>` | ouvre la conversation si elle est dans la liste (`MessageInbox.tsx:86-98`) |
| `/messagerie?dest=<uuid>` | vérifie les blocages puis `get_or_create_direct_conversation`, ouvre, nettoie l'URL (`MessageInbox.tsx:37-84`) |
| `/messagerie?to=<handle>` | **paramètre ignoré** — utilisé par `PublicProfileV2.tsx:237` et `UserRow.tsx:99` ⇒ **lien mort** (voir §5.6) |
| Barre basse « Messages » | `AccountBottomBar.tsx:49` (label `Messages`, href `/messagerie`) |
| `Header.tsx:264`, `HamburgerMenu.tsx:88` | liens d'entrée |
| `/profil/[id]` → bouton message | `PublicMobileProfileView.tsx:348` (`?dest=`) |

### 3.2 Composants (23 fichiers, 6 617 lignes)

| Composant | Lignes | Rôle | Primitive actuelle |
|---|---|---|---|
| `MessageInbox` | 316 | orchestration liste ↔ conversation, deep links, recherche locale | `Card`, `ErrorState`, `SearchField` |
| `ConversationList` | 354 | carte liste, chrome de recherche, 4 filtres, résultats A-084, appui long | `Card`, `SearchField`, `IconButton`, `Tabs`, `EmptyState` |
| `ConversationRow` | 310 | ligne, swipe iOS Mail, appui long | `<button>` ad hoc, `Image` |
| `ConversationView` | 504 | en-tête, fil, composer, options, groupe, transfert, signalement | `PageHeader`, `IconButton`, `Button` |
| `MessageList` | 308 | fil, séparateurs de jour, groupage 2 min, accusés, pagination, pilule « nouveaux messages » | `Button`, `EmptyState`, `Skeleton` |
| `MessageBubble` | 520 | bulle, réactions, réponse, transfert, retry, cartes jointes | ad hoc + cartes |
| `MessageComposer` | 291 | saisie, brouillon par conversation, photo, vocal, menu GPX/équipement/rando/kit | `Button`, `IconButton` |
| `VoiceRecorderBar` | 159 | enregistrement vocal | ad hoc |
| `ComposerMenuSheet` | 315 | 4 sources de partage (GPX, inventaire, randonnées, kits) | `MobileSheet` |
| `ConversationOptionsSheet` | 258 | appui long : accepter/refuser, archive, son, signaler | `MobileSheet` |
| `ConversationOptionsMenuModal` | 172 | options de conversation (idem + quitter) | `MobileSheet` |
| `GroupSettingsModal` | 357 | nom, membres, rôles, retrait, quitter | `MobileSheet` |
| `NewConversationModal` | 143 | annuaire public, création DM | `MobileSheet` |
| `ForwardMessageSheet` | 146 | transfert vers une autre conversation | `MobileSheet` |
| `MobileSheet` | 33 | enveloppe Radix | Radix |
| `TypingIndicator` | 27 | « X écrit… » | ad hoc |
| `AudioPlayerBubble` | 128 | lecture des notes vocales | ad hoc |
| `cards/*` (Kit, Product, Trail, GPX, OpenGraph, Post) | ~500 | aperçus de messages enrichis | ad hoc |
| `useConversations` | 84 | liste + realtime `conversation_members` / `messages` | Supabase |
| `useMessages` | 368 | page 50, optimiste, realtime, marquage lu, retry, réactions | Supabase |
| `useRealtimeMessaging` | 67 | canal `typing-<conv>` | Supabase broadcast |
| `useBackGuard`, `useKeyboardInset`, `useAttachmentUrl` | 49 / 42 / — | retour matériel, clavier, URL signée des pièces jointes | — |
| `messagingService` | 1 311 | 30 méthodes (voir §3.5) | Supabase |

### 3.3 Contrôles visibles (aucun ne disparaît)

| Zone | Contrôle | Effet | API |
|---|---|---|---|
| Chrome liste | champ « Rechercher une discussion… » | filtre local titre / nom / dernier message | — |
| Chrome liste | champ « Rechercher un voyageur, un groupe… » | recherche transverse ≥ 2 car., debounce 150 ms | `searchMessages`, `searchPeople` |
| Chrome liste | bouton `+` 44 | ouvre « Nouvelle Discussion » | — |
| Chrome liste | 4 onglets Toutes / Directs / Groupes / Demandes (+ badge) | filtre — **invisibles à 430** (0×0) | — |
| Ligne | tap | ouvre la conversation | — |
| Ligne | appui long 450 ms | feuille d'options | `accept/declineMessageRequest`, `updateMemberPreferences` |
| Ligne | glissement gauche | Accepter / Refuser (demande) ou Archiver / Son (normale) | idem |
| Ligne | badge non-lus | compteur réel, `99+` au-delà | — |
| Résultat A-084 | ligne personne | démarre un DM | `getOrCreateDirectConversation` |
| Résultat A-084 | ligne message | ouvre la conversation au message | — |
| En-tête conversation | retour | ferme (garde-fou historique) | — |
| En-tête conversation | avatar / titre | profil du contact ou réglages du groupe | — |
| En-tête conversation | `···` | options de conversation | — |
| En-tête conversation | avatar groupe (si groupe) | gestion du groupe | — |
| Fil | appui sur bulle | réponse, réaction, transfert, retry | `toggleReaction`, `sendMessage` |
| Fil | « Charger les messages précédents » | pagination avant | `getMessages(before)` |
| Fil | pilule « Nouveaux messages » | retour au bas | — |
| Composer | champ texte 44–132 px | envoi, Entrée (pointeur fin) | `sendMessage` |
| Composer | photo | upload + envoi image (métadonnées retirées) | `uploadAttachment` |
| Composer | micro | note vocale | idem |
| Composer | `•••` | GPX / équipement / randonnée / kit | idem |
| Composer | envoyer | envoi | `sendMessage` |
| Demande en attente | Accepter / Refuser / Bloquer | statut | `acceptMessageRequest`, `declineMessageRequest`, `ReportBlockModal` |
| Erreur fil | « Réessayer » | recharge | `getMessages` |
| Erreur liste | « Réessayer » | recharge | `getConversations` |

> **Limite de recette :** l'appui long (450 ms) est câblé sur `onTouchStart` ; il n'a pas pu être déclenché au pointeur souris dans Chromium. Son comportement est attesté par le code (`ConversationRow.tsx:46`, `useLongPress`), pas par une capture. La recette tactile (émulation `hasTouch`) est à faire au lot L2.

### 3.4 États

| État | Aujourd'hui | Défaut |
|---|---|---|
| Chargement liste | 5 squelettes `Card` 76 px | hors grammaire |
| Liste vide | `EmptyState` « Aucune discussion » | hors grammaire |
| Liste vide (filtre) | « Aucun résultat » / « Aucune demande en attente » | ok |
| Erreur liste | `ErrorState` « Discussions indisponibles » | ok |
| Conversation vide | « C'est le début de votre discussion » + emoji 💬 32 px | emoji interdit par la grammaire |
| Conversation en chargement | 3 squelettes de bulles | hors grammaire |
| Erreur conversation | bandeau `role=alert` + Réessayer | ok |
| Envoi optimiste | `temp-*` + statut `sending`, réconciliation realtime | ok (à conserver) |
| Échec d'envoi | statut `error` + retry | ok |
| Indicateur de saisie | « X écrit… » | hors grammaire |
| Demande en attente | barre d'actions 3 boutons | hors grammaire |
| Invité | `Card` « Connexion requise » + bouton `/connexion` | **non observable en prod** (auto-login démo) |
| Hors-ligne | pas d'état dédié | à traiter en recette |
| Non-lus | badge rouge `--lkv-danger` | hors tokens |
| Brouillon | `localStorage` par conversation | ok (à conserver) |

### 3.5 Données et API (réelles, 25/10)

Tables : `conversations` (70), `conversation_members` (156), `messages` (413), `message_reactions` (145), `message_attachments` (0), `user_blocks`, vue `public_profiles`.
Types réellement présents : `text`, `image`, `post`. Le code gère en plus `audio`, `gpx`, `product`, `trail`, `kit`, `file`, `video`, `system` — **aucune donnée de ces types en base** : la recette de ces états devra se faire sur un jeu de test, pas en inventant à l'écran.

| Méthode | Table / RPC | Notes |
|---|---|---|
| `getConversations` | `conversation_members` + `conversations` | puis RPC `get_last_messages` pour les aperçus |
| `getOrCreateDirectConversation` | RPC `get_or_create_direct_conversation` | vérifie les blocages en amont |
| `getMessages` | `messages` | 50 par page, `before` pour l'historique |
| `sendMessage` | `messages` | optimiste côté hook |
| `toggleReaction` | `message_reactions` | |
| `uploadAttachment` | bucket privé → clé durable | > 25 Mio refusé |
| `searchMessages` / `searchPeople` | `messages` / `public_profiles` | bornés par RLS |
| `markAsRead` | `conversation_members.last_read_at` | seulement si l'onglet est visible |
| `updateMemberPreferences` | `conversation_members` | muet / archivé |
| `acceptMessageRequest` / `declineMessageRequest` | `conversation_members.status` | 7 demandes en attente en base |
| `forwardMessage` | `messages` + `message_attachments` | |
| `getGroupMembers` / `updateGroupInfo` / `updateMemberRole` / `removeGroupMember` / `leaveGroup` | `conversation_members`, `conversations` | 8 groupes |
| `getShareableInventory` / `getShareableTrails` | `product_ownership`, `products`, `hiking_routes` | |
| Realtime | `messages` INSERT, `conversation_members`, canal `typing-<conv>` | resync après coupure |

RLS : active sur `conversations` (3 politiques), `conversation_members` (5), `messages` (5), `message_reactions` (4), `message_attachments` (3), `user_blocks` (7). `public_profiles` est une **vue** (pas de RLS propre, hérite des tables de base).

### 3.6 Tests existants (à ne pas supprimer)

| Fichier | Couverture |
|---|---|
| `tests/features/messaging/messaging-error-states.spec.ts` | erreur SQL ≠ faux vide ; ordre chronologique des derniers messages |
| `tests/features/messaging/messaging-search.spec.ts` | < 2 caractères = aucune requête ; RLS ; refus propre ; exclusion des conversations existantes |
| `tests/features/messaging/messaging-send-message.spec.ts` | échec RLS → `null` ; 0 ligne → `null` ; succès → id serveur ; chemin démo |
| `tests/features/messaging/messaging-upload-attachment.spec.ts` | session absente, bucket refusé, > 25 Mio, clé durable, aperçu démo |
| `tests/messaging/messagingUtils.spec.ts` | formatage des horodatages (7 cas) |
| `tests/design/community-profile-messaging-link.spec.ts` | le lien profil ouvre bien un DM réel, sans contourner RLS |
| `tests/mobile-layout.spec.ts`, `tests/design/m02-destination-registry.spec.ts` | mentions de la route |

Aucun test e2e Playwright dédié à la messagerie, aucun test de rendu de l'inbox.

---

## 4. Ce qui est sain (à préserver tel quel)

1. Le service et ses 30 méthodes : aucune requête à réécrire.
2. RLS complète sur les 6 tables de messagerie.
3. Envoi optimiste + réconciliation realtime + retry (`temp-*`).
4. Brouillons par conversation en `localStorage`.
5. Pagination 50 + « charger les précédents » + conservation de la position.
6. Marquage lu conditionné à la visibilité de l'onglet.
7. Gestes : glissement (archiver/muet/accepter/refuser) et appui long.
8. Deep links `?conversation=` et `?dest=` avec garde-fous de blocage.
9. Recherche A-084 : messages bornés par RLS + personnes publiques, exclusion des conversations existantes.
10. Uploads : retrait des métadonnées EXIF, validation GPX (taille, structure, 50 000 points), clé durable en bucket privé.
11. Indicateur de saisie, accusés de lecture (simple et groupe), séparateurs de jour, groupage 2 minutes.
12. Signalement / blocage via `ReportBlockModal`.

---

## 5. Défauts mesurés (preuves à l'appui)

| # | Défaut | Preuve | Gravité |
|---|---|---|---|
| 5.1 | **Deux champs de recherche empilés** (un par la page, un par la liste) | capture 430, inputs à y 18,8 et 73,8 | visible, bloquant pour la refonte |
| 5.2 | **La page défile** : 1 301 px pour 932, le scroller de liste ne défile pas (`scrollHeight` = `clientHeight` = 1 048) | mesure + capture | bloquant |
| 5.3 | **Les 4 filtres sont inaccessibles sur mobile** : 8 libellés en DOM, tous à 0 × 0 ; l'onglet actif reste `all`, qui **exclut les demandes en attente** ⇒ 7 demandes invisibles sur mobile | mesure DOM + `ConversationList.tsx:166-184` | fonctionnel |
| 5.4 | **La conversation ouverte est translucide** : `rgba(16,16,16,.34)` + `blur(14px)` — la liste transparaît derrière le fil | `avant-conv-430.png` | visuel majeur |
| 5.5 | **Le composer est sous la barre** : composer y 862→931, barre y 872→924 ⇒ champ de saisie masqué, impossible de répondre | mesure | bloquant |
| 5.6 | **`?to=<handle>` ignoré** : deux points d'entrée (profil public, lignes de réseau) n'ouvrent aucune discussion | `MessageInbox.tsx:38,88` vs `PublicProfileV2.tsx:237`, `UserRow.tsx:99` | fonctionnel |
| 5.7 | **Barre basse non conforme** : 398 × 52 r999 sombre à (16, 872), items 77,6 × 44, libellés 9 px, **aucune lentille**, pastille absente | mesure | grammaire |
| 5.8 | **Verre sombre contre verre clair** : `rgba(16,16,16,.34)` / texte blanc sur messages, `rgba(255,255,255,.486)` / `#172B24` sur le Compte | mesures croisées | grammaire |
| 5.9 | **Trois familles de police**, dont IBM Plex Mono sur les horodatages | mesure | grammaire |
| 5.10 | **À 768 et 1440 la barre flottante est collée en haut** (0 / 0 / 1440 × 29) et chevauche l'en-tête du site ; deux navigations coexistent | captures 768 / 1440 | responsive |
| 5.11 | La barre basse **reste visible** quand une conversation ou une feuille est ouverte (opacity 1) | mesure | grammaire (état drawer) |
| 5.12 | Emoji 💬 32 px dans l'état vide du fil | `MessageList.tsx:178` | grammaire |
| 5.13 | Deux rendus complets de l'inbox dans le DOM mobile et desktop (2 `tablist`, 2 listes) | mesure (2 listes, 8 libellés) | dette de rendu |
| 5.14 | Comptes de test visibles dans l'annuaire public (« Test Recette », « Final Recette ») | `avant-newconv-430.png` | données (hors périmètre code) |
| 5.15 | Bruit console : 3 erreurs `POST /api/csp-report` → 429 | console prod | non bloquant |

---

## 6. Hors périmètre

- Toutes les autres routes (Hub, Explorer, Communauté, Compte, carnets, pays).
- Le composant global `BottomTabBar` / `Header` / `AppShell` : ils servent d'autres écrans ; la messagerie cessera de les monter **sur sa route seulement**.
- Le schéma Supabase, les RLS, les RPC, le bucket `message-attachments`.
- La fonctionnalité notifications : **elle n'existe pas** (aucune route `src/app/notifications`) — rien à brancher.
- Le nettoyage des comptes de test en base (constaté, non traité ici).
- La refonte visuelle des cartes enrichies (produit, randonnée, kit, GPX, post) au-delà de leur intégration dans la nouvelle bulle.

---

## 7. Risques

| Risque | Parade |
|---|---|
| La porte `design:fidelity` exige une session : en local sans `DEMO_AUTO_LOGIN`, l'inbox affiche l'état invité | lancer la porte sur l'URL de prod, ou avec la session démo en local |
| L'état **invité** n'est pas observable en prod (auto-login serveur) | recette dédiée sur un build `DEMO_AUTO_LOGIN=false` |
| Remplacer la barre basse sur une seule route crée une incohérence avec Hub/Explorer tant qu'ils ne sont pas refondus | assumé : c'est déjà le cas de `/carnets/[id]` et `/pays/[code]` |
| Le type `?to=` est utilisé ailleurs : le corriger change deux écrans hors périmètre | décision à prendre (voir contrat §9) |
| Types de messages sans données (audio, gpx, product, trail, kit) | les tester sur jeu de test, jamais en inventant à l'écran |
| La fiche carnet refondue n'est pas déployée : le précédent n'existe qu'en local | livrer la messagerie derrière le même socle, et déployer ensuite |
