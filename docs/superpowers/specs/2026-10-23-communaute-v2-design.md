# Communauté v2 — une pièce du même hôtel que le Compte

**Date :** 2026-10-23
**Statut :** proposition à valider — aucun fichier de `src/` modifié, aucune migration, aucun déploiement.
**Périmètre :** le hub `/communaute` (mobile + desktop), ses feuilles contextuelles, la carte de
publication et les sous-routes. Le socle de grammaire partagée avec `/compte` est inclus.
**Référence visuelle :** `/compte` tel qu'il tourne le 2026-10-23 (Liquid Glass v8 + carte vivante),
captures `docs/communaute/v2-audit/compte-430x932-dev-2026-10-23.png` et
`compte-1440x900-dev-2026-10-23.png`.

---

## 1. Ce qui est vrai aujourd'hui

Le 2026-10-22, un premier chantier a aligné la Communauté sur la grammaire du Compte. Il a livré une
coquille, un héro et une capsule. Le 2026-10-23, le Compte a changé de nature : la carte vivante, les
trois drawers et le profil public v2 ont déplacé la référence. La Communauté, elle, est restée à
mi-chemin. Le constat ci-dessous est mesuré sur le serveur de développement, pas supposé.

| # | Constat | Preuve |
|---|---|---|
| 1 | **Trois sélecteurs des six espaces coexistent sur mobile** : la capsule d'icônes, le plateau texte `Fil · Carnets · Clubs · Groupes · Sorties · Entraide`, puis la barre globale à cinq destinations. | `src/components/communaute/MobileCommunityHub.tsx:157-170`, `src/components/mobile-nav/destinationRegistry.ts:145-162`, capture `communaute-430x932-dev-2026-10-23.png` |
| 2 | **La page change de produit à 768 px** : mobile = coquille immersive + héro, desktop = `Header` du site + cockpit 280 / 690 / 310 px. | `src/app/communaute/page.tsx:450-506` (mobile) et `:506-943` (desktop) |
| 3 | **Le héro n'est pas celui du Compte** : 44 px d'avatar, aucun compteur, aucune rangée de stories à la une, deux boutons. Le Compte : carte 24 px, avatar 66 px à anneau, trois compteurs, bio, cinq stories, grille 3 colonnes, sélecteur flottant 30 px. | `src/components/communaute/shell/CommunityHeroCard.tsx:53-135` vs `src/components/compte/CompteLiquidGlassV8.tsx:3261-3310` (rendu du haut) et `.ig-header` / `.ig-stat` / `.ig-hl-row` / `.ig-grid` (CSS du Compte) |
| 4 | **Le fil est une surface opaque** collée bord à bord, alors que le Compte ne pose que du verre. Le test visuel exige même une opacité ≥ 0,5 sur la carte de post. | `src/styles/community-social.css:204-263`, `tests/visual/community-social.spec.ts:41-56` |
| 5 | **Le desktop est un deuxième cockpit** : trois colonnes, `Header` global, rail « Événements en direct », rail clubs. Rien de tout cela n'existe dans le Compte. | `src/app/communaute/page.tsx:506-943`, capture `communaute-1440x900-dev-2026-10-23.png` |
| 6 | **Les chiffres affichés ne sont pas des totaux** : « 20 publications » est `posts.length`, c'est-à-dire la taille de la page ; « Stories · 33 » est la longueur du rail ; le héro invité affiche « Voyageur Y ». | `src/app/communaute/page.tsx:585-588` (`posts.length`), `src/components/communaute/CommunityStoriesBar.tsx` (compteur de rail), `CommunityHeroCard.tsx:61-65` |
| 7 | **« Charger plus » ne charge rien** : le bouton incrémente `postsLimit`, mais l'effet de chargement ne relance pas la requête puisque `loadedSectionsRef.posts` est déjà vrai. | `src/app/communaute/page.tsx:97-99`, `:381-391`, `:600-611` ; `MobileCommunityHub.tsx:235-241` |
| 8 | **La grammaire capsule est définie quatre fois** : dans `COMPTE_V8_CSS`, `DRAWER_SHELL_CSS`, `DRAWER_V2_CSS` et `community-social.css`. `liquid-capsules.css` n'est qu'une cinquième copie partielle. | `CompteLiquidGlassV8.tsx` (`.segc`, `.sel-lens`, `.ig-tabs`), `drawer/shell/DrawerShell.tsx:196-235`, `drawer/SlotShell.tsx:289-333`, `src/styles/community-social.css:1292-1305` |
| 9 | **La référence bouge** : la branche `chantier/communaute-design` est 3 commits derrière `main` et le worktree contient le chantier « carte vivante » non commité (13 fichiers suivis, 18 non suivis). | `git log HEAD..main`, `git status --short`, hash du diff `be6e9ebf572a` |
| 10 | **La page n'a pas de carte contexte** : le Compte ouvre une carte MapLibre plein cadre ; la Communauté ouvre une `Sheet` à deux lentilles. C'était un choix assumé, il reste valable. | `src/components/communaute/shell/CommunityContextDrawer.tsx:27-111` |

### 1.1 Baseline exécutée

| Commande | Résultat |
|---|---|
| `npm run type-check` | **0 erreur** (exit 0), 2026-10-23 09:35 |
| `npx vitest run tests/design/community-social-contract.spec.ts tests/design/community-audience-security.spec.ts tests/design/community-reels-security.spec.ts tests/community` | **31/31 tests, 6 fichiers** (exit 0) |
| `npm run build` | **non exécuté pendant l'audit** : le serveur `next dev` tourne sur le même `.next`. À faire en Task 0 sur un worktree propre. |
| Captures | `docs/communaute/v2-audit/`, 430 × 932 et 1440 × 900, clair, invité |

La baseline est **verte**. Le problème n'est pas la stabilité, c'est la fidélité et la dette de
grammaire.

### 1.2 Ce que le Compte fait exactement (mesuré)

À 430 × 932, sur `/compte` :

- plein cadre, fond photo + voile, aucun header de site ;
- `.top` = 597 px (67 % de la hauteur), `.card` = 541 px, `border-radius: 24px`,
  `backdrop-filter: blur(25.2px) saturate(1.8) brightness(1.05)` ;
- `.ig-top` : capsule `ig-handle` 34 px à gauche, trois boutons ronds 34 px à droite ;
- `.ig-header` : avatar 66 px (anneau conique), trois `.ig-stat` de 39 px de haut ;
- `.ig-hl-row` : cinq anneaux de 44 px, libellés 9,8 px ;
- `.ig-grid` : trois colonnes, `gap: 3px`, tuiles `68px` (mobile : `aspect-ratio: 1/1.05`,
  `min-height: 86px`, rayon 9 px) ;
- `.ig-tabs-float` : deux cellules, 30 px de haut, à 10 px du bord bas-droit ;
- carte carte : 335 px, rayon supérieur 32 px ;
- `.tb` : barre de 48 px, cinq cellules, lentille de 420 ms ;
- `.sheet` : trois hauteurs, rayon 28 px mobile, verre, capsule 48 px + capsule secondaire 30 px.

C'est cette anatomie qui est la loi, pas l'ancienne maquette.

---

## 2. La décision produit

**La Communauté reprend la grammaire du Compte, pas son contenu.**

Cinq règles :

1. **Même coquille, même verre, mêmes capsules, mêmes rayons, mêmes transitions.** Le Compte reste
   la référence ; la Communauté est une autre pièce du même hôtel.
2. **Le fil reste un fil.** On n'invente pas une grille de photos à la place du contenu social. La
   grille du Compte devient une **seconde vue** réelle (Fil / Grille), pas la vue par défaut.
3. **Un seul sélecteur local.** La capsule 48 px des six espaces est le seul sélecteur de section.
   Le plateau texte de `NavigationPlateau` est retiré sur `/communaute` uniquement. La barre globale
   à cinq destinations reste.
4. **Le desktop est une adaptation, pas un cockpit.** Une seule colonne centrée (760 px, 860 px au
  -delà de 1280), mêmes cartes, même capsule. Pas de `Header` de site, pas de rail gauche, pas de
   rail droit.
5. **Aucun chiffre qui ne soit un total réel.** Un compteur vient d'un `count` SQL ou n'existe pas.
   Une longueur de page n'est jamais un total.

### 2.1 Ce qui n'est pas repris

- **La carte MapLibre du bas.** Le Compte a des traces GPS personnelles ; la Communauté n'a que des
  destinations textuelles (carnets, groupes, sorties). Aucune jointure fiable vers `geo_massifs`
  n'existe aujourd'hui. Une carte serait une illustration inventée. La « carte contexte » reste un
  drawer à deux lentilles.
- **Les compteurs du profil (publications / abonnés / abonnements).** Ils appartiennent au Compte.
  Le héro Communauté affiche des **totaux de communauté** (publications visibles, clubs, sorties à
  venir), pas une deuxième copie du profil.
- **Le jeu d'onglets bas du runtime Compte** (`Explorer · Compas · Matériel · Hub · Compte`). C'est
  un vestige local du runtime ; la barre canonique est celle de `destinationRegistry.ts`. On ne la
  duplique pas dans la Communauté.
- **La répartition 67 % / 33 %.** Le fil a besoin de la hauteur ; la carte n'existe pas. La carte
  héro garde sa grammaire, pas sa hauteur.

---

## 3. La grammaire reprise, brique par brique

| # | Brique du Compte | Valeur de référence | Traduction Communauté | Décision |
|---|---|---|---|---|
| 1 | Fond immersif + voile | `.lkv-app-background` + `CompteBackground` | même fond applicatif, voile local | réutilisé |
| 2 | Capsule d'identité | `.ig-top`, `.ig-handle` 34 px, 3 `.gbtn` 34 px | « Communauté » + Publier / Rechercher / Messages | réutilisé (grammaire) |
| 3 | Carte héro | `.card.cs`, rayon 24, verre, padding 10/11 | carte héro Communauté : emblème, 3 totaux, contexte, actions | étendu |
| 4 | Compteurs | `.ig-stats` 3 colonnes, `.ig-stat` 39 px | 3 totaux réels de la communauté | étendu |
| 5 | Stories à la une | `.ig-hl-row` 5 anneaux 44 px + libellés | stories réelles, mêmes anneaux | étendu |
| 6 | Capsule de section | `.segc.lg-tabs`, 48 px, `.sel-lens` 420 ms | les six espaces, icônes 18 px + libellés 9,5 px | réutilisé |
| 7 | Lentille | `--i`, `translateX`, 420 ms `cubic-bezier(.32,.72,0,1)` | identique | réutilisé |
| 8 | Grille / tuiles | `.ig-grid` 3 colonnes, tuiles 68 px, rayon 10 | vue « Grille » des médias de la communauté | réutilisé |
| 9 | Sélecteur flottant | `.ig-tabs-float` 30 px, 10 px des bords | « Fil / Grille », même position | réutilisé |
| 10 | Feuille | `.sheet` 3 hauteurs, rayon 28, verre | contexte, commentaires, filtres | réutilisé |
| 11 | Capsules de drawer | 48 px + 30 px, 14 px de marge, 54 px de bas | mêmes composants `DrawerShell` / `SlotShell` | réutilisé |
| 12 | Barre basse | `.tb` 48 px, lentille, 5 cellules | barre globale existante, inchangée | conservé |
| 13 | États | squelette, vide, erreur, hors-ligne, invité | cinq états obligatoires | étendu |
| 14 | Mouvement | `transform` / `opacity`, 420 ms, reduced motion | identique | réutilisé |

**Ce qui est extrait :** les briques 2 à 10 ne peuvent pas être consommées par la Communauté tant
qu'elles vivent dans `COMPTE_V8_CSS`. Elles sont déplacées dans une couche partagée
`src/styles/lkdv-glass.css`, scopée `.lkdv-glass`, consommée par les deux pages. C'est le cœur du
chantier, et son principal risque.

---

## 4. La composition cible

### 4.1 Mobile — 430 × 932

```
┌──────────────────────────────────────────────┐
│  fond immersif + voile (aucun header site)   │
│  ╭──────────────╮        ╭──╮ ╭──╮ ╭──╮      │
│  │ Communauté   │        │ +│ │⌕ │ │✉ │      │   capsule 34 px
│  ╰──────────────╯        ╰──╯ ╰──╯ ╰──╯      │
│  ╭────────────────────────────────────────╮  │
│  │ (emblème)   12      48       6         │  │   carte héro 24 px
│  │             publ.  clubs   sorties    │  │   3 totaux réels
│  │ Tes massifs · Vercors, Chartreuse…     │  │
│  │ ╭────────╮ ╭────────╮                  │  │
│  │ │Publier │ │Découvrir│                 │  │
│  │ ╰────────╯ ╰────────╯                  │  │
│  │ ◯ ◯ ◯ ◯ ◯   stories à la une           │  │   anneaux 44 px
│  ╰────────────────────────────────────────╯  │
│  ╭────────────────────────────────────────╮  │
│  │ ▣   ▤   ⚑   ⌂   ▦   ✎   ← 6 espaces    │  │   capsule 48 px (sticky)
│  ╰────────────────────────────────────────╯  │
│  Au fil des aventures          [Fil|Grille] │   sélecteur 30 px
│  ╭────────────────────────────────────────╮  │
│  │ carte de publication en verre          │  │   20 px
│  ╰────────────────────────────────────────╯  │
│  …                                            │
│  ╭────────────────────────────────────────╮  │
│  │ barre globale 5 destinations, 48 px    │  │   inchangée
│  ╰────────────────────────────────────────╯  │
└──────────────────────────────────────────────┘
```

Le contenu scrolle dans la page, pas dans une carte de 67 %. La capsule des six espaces et le
sélecteur Fil/Grille restent accessibles : la première est `position: sticky`, le second est posé en
fin de zone de contenu (30 px, 10 px des bords).

### 4.2 Desktop — 1440 × 900

Une seule colonne de 760 px (860 px au-delà de 1280), centrée sur le même fond. Ni `Header`, ni
colonnes. La capsule des six espaces fait la largeur de la colonne ; la carte héro garde ses 24 px ;
le fil reste une colonne. La page n'est pas une maquette de téléphone : c'est la même page, plus
large.

### 4.3 Les six espaces

| Onglet | Route / état | Contenu | Sélecteur secondaire |
|---|---|---|---|
| Pour vous | `/communaute?tab=fil` | fil paginé + stories | Fil / Grille |
| Carnets | `/carnets` | réels carnets | filtres massif (30 px) |
| Clubs | `/clubs` | clubs réels | Tous / Activité / Pays / Mes clubs (30 px) |
| Expéditions | `/groupes` | groupes réels | — |
| Sorties | `/communaute?tab=evenements` | événements réels + inscription | À venir / Passées (30 px) |
| Entraide | `/entraide` | questions terrain réelles | — |

**Décision :** `entraide` cesse d'être un onglet statique. Il route vers `/entraide`, comme
`carnets`, `clubs` et `groupes`. Le deep link `?tab=entraide` est conservé : il redirige vers
`/entraide`. On ne supprime aucune fonctionnalité ; on supprime une carte qui ne montrait aucune
donnée.

### 4.4 Les feuilles

| Feuille | Déclencheur | Grammaire | Contenu |
|---|---|---|---|
| Contexte | bouton « contexte » du héro | `Sheet` + capsule 48 px à 2 lentilles | massifs réels, clubs réels |
| Commentaires | icône commentaire d'un post | `Sheet` large, sans en-tête, composer | commentaires + réponses |
| Filtres | sélecteur secondaire d'une section | `Sheet` + capsule 30 px | filtres de la section |
| Signaler | menu du post | `ReportSheet` existant | motifs |
| Stories | anneau | `StoriesViewer` existant | viewer, vues, archives |

Aucune feuille n'a d'en-tête (ni titre, ni icône, ni partage) : c'est la loi des drawers du Compte.

---

## 5. Les états

| État | Déclencheur | Rendu | Action |
|---|---|---|---|
| Chargement | premier fetch | squelette verre : héro + capsule + 2 cartes | — |
| Vide | fil vide | carte verre + titre + phrase + CTA Publier | `/communaute/publier` |
| Erreur section | une requête échoue | carte d'erreur locale, les autres sections restent | Réessayer |
| Erreur totale | toutes les requêtes échouent | carte d'erreur + Réessayer | refetch |
| Hors-ligne | `navigator.onLine === false` | `OfflineBanner` + dernières données | — |
| Invité | pas de session | héro « Rejoins la communauté » + CTA connexion ; fil public | `/connexion?next=/communaute` |
| Compte privé | RLS | contenu autorisé seulement ; pas de faux contenu | — |
| Fin de liste | plus de posts | « Tu as tout vu » discret | — |
| Contenu supprimé | post introuvable | carte « Publication introuvable » | retour |

---

## 6. Données et vérité

- **Totaux** : trois `select('*', { count: 'exact', head: true })` sur `community_posts`
  (visibles par RLS), `clubs`, `events` à venir. Aucun `array.length` affiché comme total.
- **Pagination** : `.range(offset, offset + 19)` et un état `loadingMore` séparé du premier
  chargement. Le bouton « Charger plus » fonctionne ou n'existe pas.
- **Identité** : `useAuth()` + `public_profiles` (vue `security_invoker`, `20261023090000_three_drawers.sql:12-35`).
- **Audience** : la RLS `community_posts_select_audience` (`20261015220000_community_post_audience_rls.sql:44-90`)
  filtre public / abonnés / club et les blocages. L'UI ne réimplémente pas cette logique.
- **Aucune donnée fictive** : pas de massif inventé, pas de compteur inventé, pas de story inventée.
- **Bug hors périmètre** : `post_type: 'event'` (`publier/page.tsx:597`) viole le CHECK
  `post_type IN ('post','tip','question','share')` (`20260713120000_community_features.sql:226`).
  La publication d'un événement échoue aujourd'hui. Ce n'est pas la refonte ; c'est un correctif
  séparé, à valider (migration additive ou mapping `share` + `linked_event_id`).
- **Bug corrigé dans le périmètre** : « Charger plus » (voir §1, ligne 7).

---

## 7. Tokens et CSS

- **Source unique** : `src/styles/lkdv-glass.css`, scope `.lkdv-glass`.
- **Contenu** : les 14 briques, leurs états, leurs media queries, leurs transitions. Pas les 4 500
  lignes du runtime, pas les base64, pas les écrans de la maquette desktop.
- **Jetons** : `--sf`, `--label*`, `--tint`, `--accent`, `--sep`, `--soft*`, `--fill*`, `--pg*`,
  `--ga`, `--gb`, `--glass-*` sont promus depuis `.lkdv-compte-v8` vers `.lkdv-glass` **sans changer
  une valeur**. Aucun nouveau jeton de couleur.
- **Interdits** : `#E4501C`, toute couleur littérale nouvelle, tout `z-[…]` local, tout
  `!important` nouveau.
- **Migration du Compte** : ajout de la classe `lkdv-glass` sur `.lkdv-compte-v8`, retrait des blocs
  extraits de `COMPTE_V8_CSS`, capture avant/après à 430 / 768 / 1440, clair et sombre. Si le diff
  n'est pas nul, rollback et on ne touche pas au Compte.
- **Nommage** : on garde les classes historiques `.ig-*`, `.card`, `.tb`, `.sheet` comme contrats de
  DOM. Les composants React de la Communauté produisent exactement ce markup. On ne renomme pas le
  Compte pour le plaisir.

---

## 8. Accessibilité

- Cibles 44 px minimum, capsule 48 px, sélecteur secondaire 30 px avec zone tactile 44 px.
- `role="tablist"`, `role="tab"`, `aria-selected`, `aria-controls`, roving `tabIndex` (déjà dans
  `CapsuleTabs`).
- Focus visible, `inert` sur les panneaux inactifs, `aria-live` sur les erreurs.
- Contrastes AA sur verre clair et sombre ; la couleur n'est jamais le seul signal.
- `prefers-reduced-motion` : lentille et feuilles instantanées.
- Zoom 200 %, lecteur d'écran (VoiceOver au minimum), navigation clavier complète.

---

## 9. Performance

Budgets du projet (`docs/performance/performance-budgets.json`) : LCP ≤ 2 500 ms, INP ≤ 200 ms,
CLS ≤ 0,1, JS partagé 104 KiB, shell ≤ 265 KiB.

- **Aucun import de `CompteLiquidGlassV8.tsx`** ni de `maplibre-gl` dans la Communauté.
- **Pas de carte** en lot 1 : c'est 286 KiB de MapLibre en moins.
- `CommunityPostCard` : présentation extraite, `ImageViewer` déjà en `dynamic`, `framer-motion`
  conservé uniquement là où il sert.
- Feuilles en `dynamic` si leur poids le justifie ; images `next/image` ou `SmartImage` avec tailles.
- Objectif : premier rendu utile ≤ 2,5 s sur 4G, aucun CLS sur la capsule sticky.

---

## 10. Critères de réussite

1. À 430 × 932, la page a le même fond, la même capsule 34 px, la même carte héro 24 px, la même
   capsule 48 px et le même verre que `/compte`. Comparaison côte à côte fournie.
2. Un seul sélecteur des six espaces est visible. Le plateau texte a disparu. La barre globale est
   intacte.
3. À 1440 × 900, il n'y a plus ni `Header` de site, ni colonne de 280 px, ni colonne de 310 px.
4. Tous les totaux affichés proviennent d'un `count` ; aucun `posts.length` n'est présenté comme un
   total.
5. « Charger plus » charge réellement 20 posts de plus, sans doublon.
6. Les six espaces mènent à un contenu réel ; `?tab=` et `?post=` fonctionnent.
7. Les cinq états sont rendus.
8. `/compte` est identique avant/après (captures 430 / 768 / 1440, clair / sombre).
9. `npm run type-check`, `npm test`, le build et les tests visuels sont verts.
10. Aucun nouveau token, aucune couleur nouvelle, aucun `#E4501C`.

---

## 11. Hors périmètre

- Refonte du backend, nouveau modèle social, DM, paiement, IA.
- Carte MapLibre de la Communauté (décision : pas de géographie inventée).
- Refonte des autres pages (`/compte`, `/profil`, `/materiel`) au-delà de l'extraction de grammaire.
- Application native, déploiement, migration distante.
- Correction du `post_type: 'event'` (correctif séparé, à valider).

---

## 12. Décisions à valider

| # | Décision | Défaut proposé | Impact si refusé |
|---|---|---|---|
| D1 | Extraire la grammaire du Compte dans `lkdv-glass.css` et migrer `/compte` | **oui** | sans extraction, la Communauté copie et le brief n'est pas satisfait |
| D2 | Desktop = une colonne centrée, pas de cockpit | **oui** | si tu veux garder un cockpit, il faut un second plan |
| D3 | Pas de carte MapLibre dans la Communauté | **oui** | une carte exige des coordonnées réelles, donc une migration et une API |
| D4 | Héro = totaux de communauté, pas les stats du profil | **oui** | si tu veux les stats du profil, on les charge en plus (3 counts) |
| D5 | `entraide` route vers `/entraide` au lieu d'une carte statique | **oui** | sinon l'onglet reste vide de données |
