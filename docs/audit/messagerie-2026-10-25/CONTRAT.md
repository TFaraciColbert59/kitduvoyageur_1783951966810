# Contrat de refonte — page Messages (`/messagerie`)

**Date :** 25 octobre 2026
**Statut :** proposition — **attend un GO explicite** avant tout code.
**Audit :** `AUDIT.md` (même dossier), captures dans `evidence/`.
**Loi :** `references/grammaire-compte.md` (19 ancres) + `docs/audit/carnet-2026-10-24/11-disposition-compte-carnet.md` (précédent validé).

---

## 1. Intention

> La messagerie devient un **écran de la famille profil** : une seule colonne verrouillée à 932 px, une barre haute à pilule et trois ronds, une carte 406 × 541 à scroll interne, une zone basse pleine largeur, la barre 48 à cinq onglets. Le verre redevient **clair**, l'encre redevient `#172B24`, la police redevient **unique**.

Ce qui ne change pas : les routes, les URL (`?conversation`, `?dest`), les 30 méthodes du service, les RLS, le realtime, les brouillons, la pagination, les gestes (glissement, appui long), la recherche A-084, les uploads, le signalement.

---

## 2. Socle à charger (ordre exact, sinon la cascade ne donne pas la géométrie)

```ts
import '@/components/compte/compte-v8.css';        // base
import '@/components/compte/compte-apple-hig.css'; // finitions !important
import '@/design/account/account-grammar-pins.css';// collisions + responsive
import { initLiquidLenses, refreshLiquidLenses } from '@/design/account/liquid-lens';
import { AccountBottomBar } from '@/components/account/AccountBottomBar';
import { AccountDrawerHost } from '@/design/account/AccountDrawerHost';
```

> **Constat de branchement (25/10) :** `account-grammar-pins.css` existe mais **aucun écran ne l'importe** aujourd'hui. Le nom `.tb` est partagé avec la barre native globale : le lot L1 doit brancher la feuille (ou prouver que `.lkdv-account-bar` suffit) et **la porte tranche** — `.tb` doit mesurer 14 / 868 / 402 × 48, sinon c'est un écart, pas un détail.

Ancêtres obligatoires :

```
div.lkdv-compte-v8.lkdv-pays.lkdv-messages > div.stage > div.pwrap > div.phone.hasnext
  ├─ div.bg
  ├─ div.top   ─ .ig-top, .card.cs
  ├─ div.mapzone
  ├─ nav.lkdv-account-bar > AccountBottomBar (402×48)
  └─ AccountDrawerHost (.sw-wrap)
```

Modèle de montage : `src/components/carnet/profile/CarnetProfileView.tsx:257-261` (précédent à 19/19).

---

## 3. Anatomie cible — 430 × 932

> **Correction du 25/10 après lecture du script de porte** : les 19 ancres exigent `.ig-header`, 3 `.ig-stat`, `.ig-bio-text`, `.ig-hl`, `.ig-hl-ring`, `.ig-grid-wrap`, `.ig-tabs`, `.ig-th` **à l'intérieur de la carte**. Une carte « liste pure » ne peut pas être verte. La liste vit donc **dans `.ig-grid-wrap`** — exactement comme la liste des moments du carnet (`CarnetProfileView.tsx:366-386`) — et le sélecteur 88 × 30 bascule liste / grille. Seules les tuiles `.ig-tile` sont facultatives dans la porte.

```
┌──────────────────────────────────────────────┐
│ ╭ Messages ·23╮              (＋)(⌕)(🔔·7)    │  .ig-top 12/6/406×36
│ ┌──────────────────────────────────────────┐ │
│ │ (av66)  12        34        7            │ │  .ig-header 382×68
│ │         discus.  non lus  demandes       │ │  3 .ig-stat 100,7×38,5 r14
│ │ Dolomites — août · 3 membres             │ │  .ig-bio-top
│ │ Léa : À lire avant de partir sur le GR20… │ │  .ig-bio-text 12/15,6
│ │ ⦿Toutes  ⦿Directs  ⦿Groupes  ⦿Demandes   │ │  .ig-hl-row 4 anneaux 44
│ │ ▤ Dolomites — août            14:19  ·11 │ │  .ig-grid-wrap 406 gap 3
│ │ ▤ Camille Rochat              13:43      │ │   mode liste : rangées
│ │ ▤ Fatou Diallo                 3 j    ·2 │ │   (scroll interne)
│ │                        ╭ ▤ │ ▦ ╮         │ │  .ig-tabs 88×30 + lentille
│ └──────────────────────────────────────────┘ │  .card.cs 12/48/406×541
│                                              │
│ ╭ (av38) Dolomites — août      3 membres ╮  │  zone basse 334,9
│ │  Léa    Super, merci à tous !            │ │   en-tête 44
│ │  Marie  Je m'occupe du refuge.           │ │   fil (scroll)
│ │  [ Votre message… ]                (➤)   │ │   réponse rapide 44
│ ╰──────────────────────────────────────────╯ │
└──────────────────────────────────────────────┘
   ╭ Hub  Explorer  Communauté  Messages  Compte ╮  barre 402×48 à 14/868
```

| Part | Boîte | Contenu réel |
|---|---|---|
| `.ig-handle` | 12 / 7 / largeur contenu × 34 | « Messages » + pastille = somme des `unread_count` |
| `.ig-top-r` | 3 × 38 × 38 | **nouveau** (`plus`), **rechercher** (`search`), **demandes** (`bell` + pastille = `pending`) |
| `.ig-header` | 24 / 56 / 382 × 68 | avatar 66 de la conversation sélectionnée (sinon celui du compte) + 3 stats : **discussions**, **non lus**, **demandes** |
| `.ig-stat` | 100,7 × 38,5 r14 | valeur 19/700 `--tint` `tabular-nums`, libellé 10,5/500 `--label2` **en minuscules** |
| `.ig-bio` | 378 | nom + statut (« 3 membres » / « Membre LKDV ») ; ligne 2 = dernier message |
| `.ig-hl-row` | 378 × 56,4 | **4 anneaux** : Toutes · Directs · Groupes · Demandes (badge réel sur l'anneau) |
| `.ig-grid-wrap` | 406, gap 3 | **la liste** — rangées 56 : avatar 40, nom 12,5/700, aperçu 11,5 `--label2`, heure 10 `tabular-nums`, badge 16 ; mode grille = tuiles conversations (avatar + nom) |
| `.ig-tabs-float` | 320 / 549,1 / 88 × 30 | **liste / grille**, lentille 41,5 × 25 |
| `.mapzone` | 0 / 597,1 / 430 × 334,9 | `.map` r32 haut ; en-tête 44 ; fil ; réponse rapide 44 |
| `.tb` | 14 / 868 / 402 × 48 | `AccountBottomBar renderAs="button"`, **Messages** actif, pastille non lus |

Les 4 filtres occupent les **anneaux** (le sélecteur principal du Compte) ; la bascule liste/grille occupe le **sélecteur 88 × 30**. Deux sélecteurs, comme sur la référence — jamais trois.

**Conséquences assumées (validées par le GO) :**
1. **4 à 5 rangées visibles** : identité + bio + anneaux occupent le haut de la carte. Le reste défile à l'intérieur, jamais la page.
2. **Le dual-pane desktop disparaît** : une colonne, comme la grammaire l'exige.
3. La zone basse n'est plus une carte MapLibre mais **la conversation** — elle joue le rôle que la carte joue sur le Compte (le contenu vivant de l'écran).

---

## 4. Responsive

| Viewport | Règle |
|---|---|
| 430 × 932 | vérité, tout est mesuré ici |
| 768 × 1024 | colonne 430 centrée, mêmes boîtes internes, aucun reflow, `scrollHeight` = 1 024 |
| 1440 × 900 | colonne 430 centrée, fond plein écran, aucun élément étiré ; pas d'en-tête de site |

La porte `design:fidelity --all` applique les mêmes ancres aux trois viewports avec un décalage de colonne : **les trois doivent être verts**. Elle exige `scrollHeight === max(innerHeight, 932)` : la colonne se dimensionne donc en `height: max(100dvh, 932px)` — 932 à 430×932, 1 024 à 768×1 024, 932 à 1440×900.

---

## 5. Mapping composant actuel → primitive cible

| Aujourd'hui | Cible | Sort |
|---|---|---|
| `.lkdv-social-messaging-screen` + `AppShell` + `Header` | `lkdv-compte-v8 > stage > pwrap > phone` + `.bg` | remplacé |
| double `SearchField` (page + liste) | un seul champ, dans le **drawer Recherche** | fusionné |
| `IconButton` `+` 44 | `.ig-top-btn` 38 | remplacé |
| `Tabs` 4 filtres (0 × 0 sur mobile) | **4 anneaux** `.ig-hl` 72 × 56 (anneau 44) + badge réel | refondu, **rendu accessible** |
| `ConversationRow` `<button>` 404 × 78 r24, verre sombre | rangée 56 dans `.ig-grid-wrap` (mode liste), verre clair | refondu |
| gestes glissement + appui long | conservés dans la ligne | conservé |
| `ConversationListSkeleton` (Cards 76) | squelettes aux dimensions de la ligne (avatar 40, lignes 12/10) | refondu |
| `EmptyState` liste | état vide de la grammaire (phrase + action 36) | refondu |
| `ErrorState` liste | même boîte que le contenu remplacé + « Réessayer » 36 | refondu |
| `PageHeader` conversation | en-tête 44 de la zone basse ; pilule de titre dans la feuille | remplacé |
| `MessageBubble` verre sombre 8/18/18, 17 px | bulle 12/15,6 `--label`, fond `--fill2` (reçue) / `--tint` (mienne), r18 avec coin 6, max 78 % | refondu |
| `MessageComposer` 69 px | **réponse rapide 44** (zone basse) + **composer complet** dans la feuille (44 + 4 outils 38) | scindé |
| `MobileSheet` (Radix, verre sombre) | `AccountDrawerHost` 12/48/406×541 (drawers) — reste à migrer pour les 6 feuilles secondaires | en cours |
| `BottomTabBar` (`nav.lkdv-floating-tabbar` 398 × 52) | `.lkdv-account-bar > AccountBottomBar` (402 × 48) | remplacé |
| dual-pane `hidden md:flex` | supprimé | supprimé (assumé) |
| `font-mono` horodatages | `font-variant-numeric: tabular-nums` | remplacé |
| emoji 💬 état vide | icône 24 `--label2` | remplacé |
| `--glass-*`, `--lkv-*` sur cette route | tokens `--label`, `--label2`, `--fill`, `--fill2`, `--tint`, `--sep` | remplacé |

Aucune nouvelle primitive, aucune nouvelle couleur, aucun CSS d'écran hors contenu.

---

## 6. Surfaces (trois, jamais quatre)

| Surface | Usage | Boîte |
|---|---|---|
| **Carte** | liste des discussions | 12 / 48 / 406 × 541,1 r24 |
| **Zone basse** | conversation sélectionnée, réponse rapide | 0 / 597,1 / 430 × 334,9 |
| **Drawer en place** | recherche, conversation complète | `.sw-wrap` 12/48/406×541, capsule 48, barre sortie |
| **Drawer en place** (conversation) | fil complet + composer complet, ouverte par « agrandir » | `.sw-wrap` 12/48/406×541 — mesuré |
| **Popover** | menu contextuel d'une bulle | r22, blur 7,2 |

Règle d'état : **drawer ou feuille ouvert ⇒ `.tb` opacity 0** (aujourd'hui elle reste à 1). Le mécanisme existe déjà dans la grammaire : `.phone.sheet-open .tb` (`compte-apple-hig.css:1151`). On ajoute la classe, on ne bricole pas une opacité.

---

## 7. Tokens, typographie, matière

- Tokens de `references/grammaire-compte.md` §1 uniquement. **Zéro littéral.**
- Base 14 / −0,14 px / `#172B24` ; titres de rangée 12,5/700 ; aperçus 11,5 `--label2` ; heures 10/500 `tabular-nums` ; badges 9/700 ; libellés d'anneau 9/500 ; barre 10/600 ; boutons 12,5/600.
- **Zéro `text-transform: uppercase`** (sauf nulle part), **zéro IBM Plex Mono**, **zéro emoji**.
- Matière : carte §4.1, verre clair §4.2, lentille §4.2, feuille §4.2 — recettes recopiées depuis la spec, jamais approximées.
- Filtre liquide : `initLiquidLenses` + `refreshLiquidLenses` sur pilule, boutons ronds, sélecteur, barre.

---

## 8. Motion (valeurs de la spec §5)

| Élément | Transition |
|---|---|
| Pilule, boutons | `transform .35s cubic-bezier(.3,1.5,.5,1)`, appui `scale(.96)` |
| Ligne de conversation | `transform .15s`, appui `scale(.985)` (conservé) |
| Lentille sélecteur / barre | `.28s` / `.55s cubic-bezier(.3,1.35,.4,1)` |
| Feuille | ouverture `translateY` 420 ms, fermeture 180 ms (comportement actuel conservé) |
| Glissement de ligne | `transform var(--motion-control-duration)` (conservé) |
| `prefers-reduced-motion` | aucune transition, aucun `scale` |

---

## 9. États

| État | Rendu |
|---|---|
| Chargement liste | 5 squelettes de ligne 60 (avatar 40, lignes 12/10), shimmer 1,4 s, carte en place |
| Liste vide | « Aucune discussion » + « Nouvelle discussion » 36 |
| Liste vide filtrée | « Aucun résultat » + « Effacer la recherche » 36 |
| Demandes vides | « Aucune demande en attente » |
| Erreur liste | carte en place, message + « Réessayer » 36 |
| Conversation vide | « Le début de votre discussion » + phrase, sans emoji |
| Chargement fil | 3 squelettes de bulle aux dimensions réelles |
| Erreur fil | bandeau dans la zone basse + « Réessayer » |
| Envoi optimiste / échec | conservés (`sending`, `error`, retry) |
| Saisie en cours | « X écrit… » 10,5 `--label2` dans l'en-tête |
| Demande en attente | zone basse = 3 actions 36 (Accepter, Refuser, Bloquer) |
| Invité | shell complet + carte « Connectez-vous pour voir vos messages » + bouton 36 vers `/connexion?next=/messagerie` |
| Hors-ligne | bandeau 36 « Hors ligne — réessai automatique » + file d'attente conservée |
| Drawer ouvert | barre opacity 0, capsule 48 visible, `Échap` et poignée ferment |
| Non-lus | pastille 16 sur la pilule, sur la barre, et badge de ligne |

---

## 10. Décisions ouvertes (à trancher au GO)

| # | Question | Proposition |
|---|---|---|
| D1 | **Surface de la conversation** : (A) zone basse inline + feuille 92 dvh pour la version complète — (B) drawer en place 406 × 541 remplaçant la carte — (C) feuille 92 dvh seule | **A** : elle garde la zone basse utile, suit le précédent commentaires-du-carnet, et laisse la liste visible |
| D2 | **3ᵉ bouton de la barre haute** : la grammaire en exige trois (créer, rechercher, notifications) ; aucune route notifications n'existe | **« Demandes »** (cloche + pastille = `pending` réels) — donnée et action existantes, zéro fonction inventée. Variante : deux boutons (casse l'invariant). |
| D3 | **`?to=<handle>` ignoré** (2 écrans hors périmètre) | **Corriger** : résoudre le handle → `dest` dans `MessageInbox` (3 lignes, même route). Sinon le lien « Message » du profil public reste mort. |
| D4 | **Branche de travail** | `chantier/messagerie-refonte` depuis `chantier/pays-refonte` (seule branche avec la porte + les primitives) |

---

## 11. Lots

| Lot | Contenu | Fichiers | Preuve |
|---|---|---|---|
| **L1 — socle** | route montée dans le shell, `.bg`, verrouillage 932, barre haute 3 ronds, barre 48, lentilles, suppression `AppShell`/`Header`/`BottomTabBar` sur cette route | `src/app/messagerie/page.tsx`, `src/components/messaging/MessagesScreen.tsx` (nouveau), `src/features/messaging/components/*` | `design:fidelity` ≥ 12/19, capture 430 |
| **L2 — carte** | identité + 3 stats, bio, 4 anneaux, liste dans `.ig-grid-wrap`, sélecteur liste/grille, gestes, squelettes, états vide/erreur | `MessagesCard.tsx` (nouveau), `ConversationRow` | capture + clics filtres/aneeaux |
| **L3 — zone basse** | conversation inline, en-tête 44, fil, réponse rapide 44, état vide, clavier/safe area | `ConversationView` (scindé), `MessageList`, `MessageComposer` | capture + envoi réel |
| **L4 — feuille conversation** | fil complet, composer complet (photo, vocal, GPX, équipement, rando, kit), réactions, réponse, transfert, retry, pagination, typing, accusés, focus message | `ConversationSheet.tsx` (nouveau), `MessageBubble`, `MessageComposer` | capture + envoi photo + réaction |
| **L5 — drawers** | recherche, nouvelle discussion, options, groupe, transfert, signalement, partage via `AccountDrawerHost` | `MessageInbox`, `ConversationOptionsSheet`, `GroupSettingsModal`, `NewConversationModal`, `ForwardMessageSheet`, `ComposerMenuSheet` | captures de chaque volet |
| **L6 — recette** | 430/768/1440, invité, vide, erreur, chargement, hors-ligne, a11y, diff pixel, prod | — | 19/19, diff < 0,2 %, captures, tests |

Ordre imposé : L1 → L2 → L3 → L4 → L5 → L6. Un lot = un commit.

---

## 12. Tests

Conservés : les 5 fichiers existants (§3.6 de l'audit) — **aucune suppression**.

Ajoutés :

| Test | Assertion |
|---|---|
| `tests/design/messagerie-grammar.spec.ts` | aucun `--glass-`, `--lkv-`, `font-mono`, emoji, `.xxx-card` dans `features/messaging` et la route ; primitives importées |
| `tests/messaging/inbox-grammar.spec.ts` (e2e) | rangées visibles, 4 anneaux accessibles, filtre « Demandes » filtre, ouverture conversation, feuille, barre masquée |
| `tests/messaging/guest-state.spec.ts` | invité : shell + carte connexion, pas d'erreur console |

---

## 13. Porte de sortie

```bash
npm run type-check && npm run lint && npm test && npm run build
npm run design:fidelity -- /messagerie --all          # 19 ancres × 3 viewports
npm run design:diff -- avant-430.png apres-430.png --out diff-430.png --max-percent 0.2
```

Vert exigé sur : 19 ancres, `scrollHeight = innerHeight` par viewport, barre sortie quand drawer/feuille ouvert, 0 littéral de couleur, 0 `backdrop-filter` d'écran, 0 classe d'écran.

**Définition de fini :**
- [ ] 19/19 sur `/messagerie` à 430, 768, 1440.
- [ ] Les 4 filtres utilisables sur mobile (aujourd'hui 0 × 0).
- [ ] Les demandes en attente visibles et traitables sur mobile.
- [ ] Conversation ouverte : fond opaque, composer visible, barre sortie.
- [ ] Un seul champ de recherche, dans un drawer.
- [ ] Aucun test supprimé, aucune donnée inventée.
- [ ] Prod vérifiée à l'URL (capture post-déploiement + porte).
