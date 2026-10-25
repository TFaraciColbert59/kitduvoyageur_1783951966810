# PROMPT — Refonte de la page Communauté au design du Compte (LKDV)

> **TL;DR :** aligne `/communaute` sur le design du Compte / Profil, réutilise à 100 % l'existant, ne perds aucune fonctionnalité, et commence par un plan ultra détaillé — aucun code avant mon « go ».
>
> **Mode d'emploi :** copie-colle tout ce qui suit dans une nouvelle session, ouverte à la racine du projet. Ne modifie rien avant de m'avoir lu en entier.

---

## 0. Qui tu es et ce que tu fais

Tu es l'agent en charge de la refonte visuelle et interactive de la **page Communauté** de LKDV.

Tu ne pars pas d'une page blanche. Le design existe déjà : c'est celui du **Compte / Profil** (Liquid Glass v8, capsules, lentilles, drawers, grille, carte contexte). Ton travail, c'est de l'**étendre à la Communauté** en le réutilisant à **100 %**, sans inventer un deuxième langage visuel.

Tu as carte blanche technique. Tu n'as **pas** carte blanche sur le design : le design de référence est la loi. Tu peux prendre des initiatives d'implémentation, jamais réinventer le visuel.

**Ta première mission n'est pas de coder. C'est de me produire un plan ultra détaillé, et de t'arrêter.**

---

## 1. Le projet, le dépôt, les commandes

- **Projet :** Le Kit du Voyageur (LKDV)
- **Dossier de travail :** `/Users/fr168256/Desktop/kitduvoyageur_1783951966810`
- **Dépôt :** `https://github.com/TFaraciColbert59/kitduvoyageur_1783951966810`
- **Branche actuelle :** `main` — tu ne travailles **jamais** directement sur `main` dès qu'on passe à l'implémentation. Tu crées une branche `chantier/communaute-design`.
- **Stack :** Next.js 15 (App Router), React 19, TypeScript strict, Tailwind, Supabase (Postgres + RLS), Vitest, Playwright, Vercel.
- **Dev local :** `npm run dev` → `http://localhost:4000`
- **Vérifications :** `npm run type-check`, `npm run lint`, `npm test`, `npm run build`, `npm run test:e2e`, `npm run test:a11y`, `npm run test:visual`, `npm run audit:contrast`.

Avant toute affirmation sur le code, tu lis le code réel. Tu ne te fies ni à ce prompt, ni à un souvenir, ni à un ancien rapport : tu vérifies. Si une info de ce prompt est périmée, tu me le dis et tu utilises la réalité du dépôt.

---

## 2. Ma demande en une phrase

**Je veux que la page Communauté ait exactement la même gueule que le nouveau Compte / Profil — mêmes capsules, mêmes lentilles, mêmes drawers, mêmes états — en réutilisant à 100 % ce qui existe déjà. Pas une copie approximative, pas un deuxième design, pas un délire à toi. Et avant de toucher au moindre fichier, tu me produis un plan ultra détaillé et tu t'arrêtes.**

---

## 3. Le résultat que je veux — et ce que je ne veux pas

### 3.1 Ce que je veux

1. La page `/communaute` (mobile et desktop) reprend le design du Compte : fond immersif plein cadre, capsule d'identité en haut, carte héro en verre, capsules de sections, lentilles, grille de contenus, drawers qui montent du bas, carte contexte.
2. La même famille de composants, les mêmes tokens, les mêmes rayons, les mêmes ombres, les mêmes transitions, les mêmes états.
3. Toutes les fonctions communauté existantes restent accessibles : fil, publications, likes, favoris, commentaires, partage, stories, carnets, clubs, groupes, sorties, entraide, découverte, reels, publication, profils, modération.
4. Les données restent **réelles** (Supabase). Aucune donnée fictive pour « remplir » le design.
5. Les URLs et les liens profonds existants continuent de fonctionner.
6. Le mobile est la référence (430 × 932), le desktop est une adaptation responsive du **même** design, pas un deuxième cockpit.
7. À la fin, tu me montres des preuves : captures avant/après, tests, build, `tsc`, accessibilité, performance.

### 3.2 Ce que je ne veux pas

- Un « nouveau design » à toi, même joli.
- Une copie approximative du Compte avec des couleurs, des rayons ou des ombres légèrement différents.
- L'import du composant `CompteLiquidGlassV8.tsx` en entier (4 544 lignes) dans la Communauté.
- Deux designs qui cohabitent : l'ancien cockpit desktop d'un côté, le nouveau mobile de l'autre.
- Des mocks, des `TODO`, des « à définir », des composants morts.
- Une régression sur `/compte`, sur les drawers existants ou sur les tests.
- Un déploiement, un push ou une migration distante sans mon accord explicite.

---

## 4. Le design de référence — la loi

### 4.1 Ce que veut dire « ce design »

Quand je dis « ce design », je parle du **Compte / Profil LKDV** tel qu'il est aujourd'hui sur mobile :

- fond immersif plein écran (image + voile), pas de header de site ;
- capsule d'identité flottante en haut (handle, actions) ;
- carte héro en verre avec stats, bio, drapeaux, liens ;
- capsules de sections et **lentilles** (`.ig-tabs`, `.sel-lens`, `.lg-tabs`) ;
- grille de tuiles avec sélecteur flottant en bas à droite ;
- drawers / feuilles qui montent du bas, avec capsule de navigation en haut et capsule secondaire en bas à droite ;
- barre de navigation basse de l'app ;
- états squelette / vide / erreur / hors-ligne ;
- mouvement `transform` / `opacity`, 420 ms `cubic-bezier(.32,.72,0,1)`, réduction de mouvement respectée.

Si tu penses que « ce design » veut dire autre chose, **arrête-toi et demande-moi** avant de produire le plan.

### 4.2 Les fichiers à lire avant de parler

**Le design de référence (à décortiquer, pas à importer en bloc) :**

- `src/components/compte/CompteLiquidGlassV8.tsx` — l'implémentation de référence (4 544 lignes). Tu l'étudies, tu n'importes pas le fichier entier.
- `src/components/compte/MobileCompteV2.tsx`
- `src/components/compte/compte-liquid-glass-v8-runtime.js` et `.d.ts`
- `src/components/compte/drawer/shell/DrawerShell.tsx` — coquille des drawers, capsule 48 px, capsule secondaire 30 px, glissement 420 ms.
- `src/components/compte/drawer/SlotShell.tsx` — coquille des slots (lentilles, états, contenu).
- `src/components/compte/drawer/SlotSelector.tsx`
- `src/components/compte/drawer/LensPager.tsx`
- `src/components/compte/drawer/ProfileDrawerHost.tsx`
- `src/components/compte/drawer/slots/CommunitySlot.tsx` et les autres slots
- `src/components/compte/drawer/cards/*` (BadgeTile, ChallengeRow, ClubCard, CompanionRow, GearRow, HighlightCard, KitCard, LoanCard, OutingCard, RepostCard, StampTile, StatTile, WearGauge)
- `src/components/compte/drawer/reseau/*`, `sortie/*`, `compte/*`

**Les documents de design et les décisions :**

- `docs/superpowers/specs/2026-10-21-drawer-profil-5-slots-design.md` — les 5 slots, les lentilles, le swipe, la carte contexte.
- `docs/superpowers/specs/2026-10-22-refonte-contenu-drawers-design.md` — le shell commun des drawers, les états, les règles.
- `docs/superpowers/plans/2026-10-22-refonte-contenu-drawers.md` — le niveau de détail que j'attends dans un plan.
- `DESIGN_SYSTEM.md` — gouvernance, primitives, interdictions.
- `docs/Design-tokens.md` — palette officielle, classes, checklist grep.
- `docs/compas/DESIGN_REFERENCE.md` — la référence du Compas.
- `docs/design-system/PHASE2_READINESS.md` — contrats de structure, shell, safe areas.
- `docs/performance/performance-budgets.json` et `docs/performance/BASELINE.md` — les budgets de perf du projet.
- `src/styles/tokens.css`, `src/styles/liquid-glass.css`, `src/styles/community-social.css`.

**La page à refondre et son écosystème :**

- `src/app/communaute/page.tsx` (892 lignes), `layout.tsx`, `loading.tsx`, `error.tsx`
- `src/app/communaute/decouvrir/page.tsx`, `post/[id]/page.tsx`, `reels/page.tsx`, `publier/page.tsx`, `pro/page.tsx`
- `src/components/communaute/MobileCommunityHub.tsx` (434 lignes)
- `src/components/communaute/MobileCommunityHeader.tsx`
- `src/components/communaute/CommunityPostCard.tsx` (1 498 lignes)
- `src/components/communaute/CommunityStoriesBar.tsx` (910 lignes)
- `src/components/communaute/StoriesViewer.tsx` (724 lignes)
- `src/components/communaute/StoriesArchiveSheet.tsx`, `StoryViewsSheet.tsx`
- `src/components/communaute/CommunityLeftSidebar.tsx`, `CommunityRightSidebar.tsx`, `CommunityHeroOverview.tsx`
- `src/components/communaute/CommunityVideo.tsx`, `CommentItem.tsx`

**Les tests à ne pas casser :**

- `tests/design/community-social-contract.spec.ts`
- `tests/design/community-audience-security.spec.ts`
- `tests/design/community-reels-security.spec.ts`
- `tests/community/*`
- `src/components/compte/drawer/__tests__/*`
- `tests/e2e/compte-drawer-v2.spec.ts`
- `tests/design/p5-direction-tokens.spec.ts`, `tests/design/lot2-shell.spec.ts`, `tests/design/m02-destination-registry.spec.ts`

### 4.3 Les constantes visuelles à respecter

Ce sont des contrats, pas des suggestions :

| Élément | Valeur / règle |
|---|---|
| Capsule principale | 48 px de haut, `.segc.lg-tabs.lens-on`, icônes 18 px |
| Lentille principale | `.sel-lens`, `--i`, glissement 420 ms `cubic-bezier(.32,.72,0,1)` |
| Capsule secondaire | 30 px, `.ig-tabs-float`, à 10 px des bords, icônes 15 px, seulement s'il y a un second niveau |
| Contenu des drawers | 14 px de marge latérale, 62 px de marge basse |
| Cible tactile | 44 px minimum partout |
| Rayons | 18–22 px pour les cartes, 999 px pour les capsules |
| Couleurs | uniquement les tokens `--lkv-*` et les variables `--glass-*` |
| Orange | `#E4501C` interdit |
| En-tête des drawers | aucun : pas d'icône, pas de titre, pas de sous-titre, pas de bouton partager |
| Mouvement | `transform` / `opacity`, `prefers-reduced-motion` respecté |
| Safe areas | via les tokens du shell, jamais `env()` recalculé à la main |
| Scroll | un seul conteneur de scroll par écran, pas de scroll imbriqué inutile |
| Z-index | l'échelle `--z-*` / `src/lib/ui/zIndex.ts`, pas de `z-[9999]` local |
| Thèmes | clair **et** sombre, via les tokens `.dark` / `data-theme` ; aucune couleur codée en dur pour un seul thème |

### 4.4 La définition de « réutilisation à 100 % »

La réutilisation à 100 %, ce n'est pas copier-coller. C'est :

1. **Mêmes tokens** : aucune couleur, police, ombre, rayon ou flou nouveau.
2. **Mêmes composants** : `DrawerShell`, `SlotShell`, `SlotSelector`, `LensPager`, les cartes, les états, les primitives UI de `src/components/ui/`.
3. **Mêmes comportements** : mêmes transitions, mêmes gestes, mêmes focus, mêmes `aria`.
4. **Mêmes états** : squelette, vide, erreur, hors-ligne, visiteur non connecté.
5. **Aucune duplication** : si un bloc de style ou un comportement manque, tu l'**extrais** dans un composant partagé et tu migres les deux usages (Compte + Communauté). Tu ne copies pas.
6. **Preuve de non-régression** : après extraction, `/compte` est visuellement identique (capture avant/après). Si ce n'est pas le cas, tu corriges ou tu reviens en arrière.

**La Communauté n'est pas un clone du Profil.** Elle emprunte la grammaire visuelle et les composants, mais elle garde son contenu, sa hiérarchie et ses parcours. Le Profil reste la référence ; la Communauté est une autre pièce du même hôtel.

---

## 5. Le périmètre exact

### 5.1 Les routes concernées

| Route | Rôle | Priorité |
|---|---|---|
| `/communaute` | Hub principal, onglets `?tab=fil\|carnets\|clubs\|groupes\|evenements\|entraide` | Lot 1 |
| `/communaute/decouvrir` | Découverte de publications | Lot 2 |
| `/communaute/post/[id]` | Détail d'une publication | Lot 2 |
| `/communaute/reels` | Reels vidéo | Lot 2 |
| `/communaute/publier` | Création de publication | Lot 2 |
| `/communaute/pro` | Alias de `/communaute-pro` | Lot 2 (à vérifier) |

Tu peux proposer un découpage différent, mais tu dois alors me l'expliquer et me montrer que rien n'est perdu.

### 5.2 Les fonctionnalités à ne pas perdre

- Fil de publications, pagination, chargement progressif.
- Likes, favoris, commentaires, réponses, partage.
- Stories : barre, viewer, vues, archives, proches amis, utilisateurs masqués.
- Carnets : liste, filtres, recherche, carte carnet.
- Clubs : liste, filtres, appartenance, lien vers le club.
- Groupes / expéditions : liste, places, lien cockpit.
- Sorties / événements : liste, inscription, compteur de participants.
- Entraide / questions terrain.
- Découverte, recherche, massifs.
- Reels.
- Publication (texte, photos, vidéo, carnet).
- Profils publics, comptes privés, demandes d'abonnement.
- Modération : signaler, bloquer, masquer.
- États de connexion : visiteur, connecté, compte privé.
- Deep links : `?tab=`, `#comment-`, `?post=`, etc. (tu vérifies lesquels existent réellement).

### 5.3 Ce qui est hors scope

- Refonte du backend ou nouveau modèle social.
- Nouvelles fonctionnalités produit (pas de DM, pas de paiement, pas d'IA).
- Refonte des autres pages (`/compte`, `/profil`, `/materiel`, etc.) — sauf extraction minimale de composants partagés, avec preuve de non-régression.
- Application native, iOS, Android.
- Déploiement, migration distante, changement d'infrastructure.

Toute migration SQL nécessaire doit être **additive**, rétrocompatible, avec RLS et tests, et je dois la valider avant exécution.

---

## 6. Les règles non négociables

1. **Aucun code avant le plan et mon « go ».** Pas de fichier modifié, pas de migration, pas de commande qui écrit.
2. **Le design de référence gagne toujours.** En cas de doute : tu ouvres `/compte`, tu compares, tu choisis ce qui existe.
3. **Réutilisation à 100 %.** Pas de nouveau token, pas de nouvelle primitive, pas de copie. Si ça manque, tu extrais.
4. **Aucune régression.** Les tests existants restent verts, `/compte` ne bouge pas, les URLs marchent encore.
5. **Données réelles uniquement.** Aucun mock sur un compte authentifié. Un état vide est un état vide, pas un faux contenu.
6. **Rien ne disparaît en silence.** Chaque fonctionnalité actuelle a une nouvelle maison, ou une justification écrite que je valide.
7. **Mobile d'abord.** 360, 390, 430 px. Puis 768, 1024, 1440. Safe areas, clavier, iOS Safari, Capacitor.
8. **Accessibilité AA.** 44 px, focus visible, clavier, `aria-selected`, `aria-label`, `inert` sur les panneaux inactifs, contraste, `prefers-reduced-motion`.
9. **Performance.** Pas d'import du fichier de 4 544 lignes. Code splitting, images optimisées, pas de CLS, budgets chiffrés.
10. **Tests avant code.** TDD pour la logique, tests de composants, e2e, visuel, a11y. Pas de test désactivé, pas de `--no-verify`.
11. **Preuve avant affirmation.** Si tu dis « c'est vert », tu montres la commande et la sortie. Sinon, ce n'est pas fait.
12. **Pas de déploiement, pas de push, pas de migration distante sans mon accord.** Tu travailles en local, sur une branche.

---

## 7. Les skills à charger

Tu charges les skills **avant** d'agir, dans cet ordre. Tu annonces chaque skill utilisé et tu expliques en une phrase pourquoi. Si un skill n'existe pas dans ton environnement, tu prends l'équivalent réel le plus proche et tu le notes.

| Ordre | Skill | Quand | Ce que j'attends |
|---|---|---|---|
| 1 | `using-superpowers` | dès le début | tu vérifies les skills avant toute action, tu annonces ta démarche |
| 2 | `brainstorming` | avant le plan | tu classifies la demande, tu poses max 5 questions bloquantes, tu explores le contexte |
| 3 | `writing-plans` | pour le plan | un plan task-by-task, avec fichiers, tests, vérifications, commits |
| 4 | `frontend-design` | direction visuelle | une direction intentionnelle, pas un template |
| 5 | `apple-ui-designer` | mobile iOS | HIG, SF, translucidité, safe areas, feeling natif |
| 6 | `ui-ux-pro-max` | design system | cohérence, hiérarchie, responsive, accessibilité |
| 7 | `interaction-design` | micro-interactions | transitions, gestes, feedback, réduction de mouvement |
| 8 | `ux-mobile` | mobile | 44 px, pouce, clavier, scroll, safe areas |
| 9 | `lkdv-development` | règles projet | architecture, conventions, pièges LKDV |
| 10 | `nextjs-performance` | Next.js | server/client, bundle, images, rendu |
| 11 | `vercel-react-best-practices` | React | hooks, mémoïsation, rendu, data fetching |
| 12 | `performance` + `core-web-vitals` | budgets | LCP, INP, CLS, preuves avant/après |
| 13 | `web-design-guidelines` | audit UI | conformité aux règles web |
| 14 | `security-audit` | données / API | RLS, auth, erreurs, fuites |
| 15 | `supabase-postgres-best-practices` | schéma / requêtes | index, policies, migrations, perfs |
| 16 | `test-driven-development` | code | Red → Green → Refactor |
| 17 | `testing-qa` | stratégie de tests | unit, intégration, e2e, visuel, a11y |
| 18 | `subagent-driven-development` ou `executing-plans` | exécution | tâches indépendantes, revues, checkpoints |
| 19 | `systematic-debugging` | bug | reproduction, preuve, cause racine |
| 20 | `requesting-code-review` + `receiving-code-review` | avant merge | revue critique, pas de complaisance |
| 21 | `verification-before-completion` | fin | commandes, sorties, captures, pas de « je pense » |
| 22 | `webapp-testing` | vérification navigateur | Playwright, console, réseau, captures |
| 23 | `web-quality-audit` | audit final | perf, a11y, SEO, best practices |

Tu peux en charger d'autres si le projet les a (`.agents/skills/`, `.claude/skills/`), notamment `code-quality` (qualité, sécurité, anti-régression) et `using-git-worktrees` (isolation de branche), mais tu ne remplaces pas les skills de process par des skills de décoration.

---

## 8. Les MCP, plugins et outils

Tu utilises ce qui est disponible, et tu me dis ce que tu utilises.

| Outil | Usage | Limite |
|---|---|---|
| **Playwright MCP** (`browser_*`) | ouvrir `localhost:4000`, captures 430 / 768 / 1440, console, réseau, snapshot a11y | local uniquement |
| **Supabase MCP** | lire le schéma, les tables, les policies RLS, les advisors, les logs | **lecture seule** ; aucune écriture, aucune migration distante sans mon accord |
| **Vercel MCP** | inspecter les déploiements, les erreurs runtime, les logs | **aucun déploiement** sans mon accord |
| **GitHub MCP** | lire le dépôt, les issues, les PR | **aucun push, aucune PR** sans mon accord |
| **`webapp-testing`** | Playwright local, vérification fonctionnelle | — |
| **`bash`** | commandes de test, build, `tsc`, grep | pas de commande destructive |

**Plugins et agents locaux :** `.claude/agents/*`, `.agents/agents/*`, `.claude/skills/*`, `.agents/skills/*`. Tu peux t'en servir pour une tâche bornée (audit sécurité, audit perf, revue de code), jamais pour définir le design, le shell partagé ou la matrice de réutilisation : ça reste ton travail. Tu me dis lesquels tu as réellement utilisés, et pourquoi.

Commandes de référence :

```bash
npm run dev                 # http://localhost:4000
npm run type-check          # tsc --noEmit
npm run lint
npm test                    # vitest run
npx vitest run <fichier>    # test ciblé
npm run build
npm run test:e2e
npm run test:e2e:local
npm run test:a11y
npm run test:visual
npm run audit:contrast
```

Tu exécutes toi-même les commandes. Tu ne me demandes pas de les lancer, ni de faire les captures à ta place : tu as le shell et le navigateur.

Tu ne lances pas `npm run build` et `npm test` en boucle pour « voir ». Tu cibles, tu prouves, tu avances.

---

## 9. Phase 0 — Audit obligatoire (avant le plan)

Tu ne rédiges pas le plan avant d'avoir fait cet audit. Tu le fais dans l'ordre, et tu gardes les preuves.

### 9.1 Lire les documents

Lis en entier les documents du §4.2. Note les règles qui te concernent, les composants à réutiliser, les interdictions.

### 9.2 Inventorier l'existant

Pour chaque route, composant, données, test, tu remplis un tableau :

| Élément | Chemin | Rôle | État | Preuve (fichier:ligne) |
|---|---|---|---|---|
| Page hub | `src/app/communaute/page.tsx` | ... | À adapter | ... |
| Hub mobile | `src/components/communaute/MobileCommunityHub.tsx` | ... | À adapter | ... |
| ... | ... | ... | ... | ... |

Tu cites les lignes réelles. Pas de « probablement », pas de « il existe un composant quelque part ».

### 9.3 Décortiquer le design de référence

Tu démontes le Compte / Profil en briques :

1. fond immersif ;
2. capsule d'identité ;
3. carte héro ;
4. capsules de sections ;
5. lentilles ;
6. grille / tuiles ;
7. sélecteur flottant ;
8. carte contexte ;
9. drawers / feuilles ;
10. barre de navigation ;
11. états ;
12. mouvement ;
13. tokens ;
14. CSS réel (classes, dimensions, `!important`, media queries).

Pour chaque brique : composant exact, chemin, classes, dimensions, comportement, où c'est utilisé, ce qui est réutilisable tel quel, ce qui doit être extrait.

### 9.4 Établir la baseline

Avant de toucher quoi que ce soit :

1. `npm run type-check` → note le résultat.
2. `npm test` → note le nombre de tests, les échecs éventuels.
3. `npm run build` → note le résultat.
4. Ouvre `/communaute` et `/compte` dans Playwright à 430 × 932, 768 × 1024, 1440 × 900, en clair et en sombre.
5. Capture les deux pages, note les erreurs console, les warnings d'hydratation, les requêtes en échec.
6. Sauvegarde les captures dans `docs/communaute/baseline/` (ou un dossier équivalent que tu proposes).

Si la baseline est déjà rouge, tu ne commences pas par la refonte : tu me le dis, tu identifies la cause, et tu proposes de la corriger d'abord ou de l'isoler.

### 9.5 Auditer les données

- Tables réellement utilisées (vérifiées dans le code des pages et composants communauté) : `community_posts`, `community_post_drafts`, `post_likes`, `post_saves`, `post_comments`, `post_comment_likes`, `post_stories`, `story_highlights`, `story_highlight_items`, `story_views`, `story_likes`, `story_reports`, `story_hidden_users`, `story_close_friends`, `carnets`, `clubs`, `club_members`, `travel_groups`, `events`, `event_participants`, `user_follows`, `follow_requests`, `user_blocks`, `comment_reports`, `community_moderation_queue`, `public_profiles`, `materiel_kits`.
- Policies RLS : qui lit quoi, qui écrit quoi.
- Index : les requêtes du fil sont-elles indexées ?
- Données manquantes : quels états vides sont réels, lesquels sont des bugs ?
- Realtime : est-il utilisé ? Faut-il le garder ?

Tu ne modifies rien. Tu constates, tu documentes.

### 9.6 Auditer les fonctionnalités

Pour chaque fonctionnalité du §5.2 : où elle vit aujourd'hui, comment elle marche, quelles données, quels états, quels tests. Tu identifies celles qui sont déjà cassées ou incomplètes : elles ne sont pas dans le scope de la refonte, mais tu ne dois pas les casser davantage.

### 9.7 Auditer la réutilisation

Tu produis la première version de la matrice de réutilisation :

| Besoin Communauté | Composant existant | Chemin | Décision | Justification | Test de non-régression |
|---|---|---|---|---|---|
| Coquille de drawer | `DrawerShell` | `src/components/compte/drawer/shell/DrawerShell.tsx` | Réutilisé tel quel | 48 px, `.sel-lens`, 420 ms | `DrawerShell.test.tsx` + capture `/compte` |
| ... | ... | ... | ... | ... | ... |

Les décisions possibles : **réutilisé tel quel**, **étendu**, **extrait**, **nouveau (exceptionnel, justifié)**. « Copié » n'existe pas.

### 9.8 Lister les risques et les inconnues

Tout ce qui peut casser : CSS global, tests visuels, hydration, imports lourds, RLS, deep links, `?tab=`, composants de 1 500 lignes, dette existante. Tu les classes (probabilité × impact) et tu proposes une mitigation.

---

## 10. Phase 1 — Le plan ultra détaillé (ton premier livrable)

### 10.1 Où l'écrire

Tu écris **deux documents** :

1. **Le spec design** : `docs/superpowers/specs/2026-10-22-communaute-refonte-design.md`
   - 1 à 3 pages.
   - Le quoi, le pourquoi, les décisions, les écrans, les états.
   - Il doit permettre à quelqu'un qui n'a pas lu le code de comprendre la cible.

2. **Le plan d'implémentation** : `docs/superpowers/plans/2026-10-22-communaute-refonte.md`
   - **Ultra détaillé** : minimum 400 lignes, idéalement 600–900.
   - Le comment, tâche par tâche, fichier par fichier, test par test.
   - Chaque tâche a une case à cocher `- [ ]`.
   - C'est le document que je vais lire et valider. C'est le livrable le plus important.

Si la date du jour est différente, tu utilises la date réelle. Tu ne réutilises pas un nom de fichier existant.

### 10.2 Les 16 sections obligatoires du plan

Le plan doit contenir, dans cet ordre :

1. **Verdict exécutif** — 10 lignes max : ce qui est gardé, ce qui change, ce qui disparaît, le risque principal, l'effort.
2. **Inventaire de l'existant** — le tableau du §9.2, complet, avec preuves `fichier:ligne`.
3. **Anatomie du design de référence** — les 14 briques du §9.3, avec composants, classes, dimensions, comportements.
4. **Matrice de réutilisation 100 %** — le tableau du §9.7, complet. Tu donnes le compte : X réutilisés tels quels, Y étendus, Z extraits, 0 dupliqués. Si tu as un « nouveau », tu le justifies et tu montres pourquoi aucun composant existant ne pouvait convenir.
5. **Architecture cible** — arbre des routes, arbre des composants, arbre des fichiers, frontières client/serveur, état, flux de données. Un schéma ASCII est bienvenu.
6. **Mapping fonctionnel** — chaque fonctionnalité du §5.2 → nouvel emplacement → interaction → état vide → état erreur → permission → deep link. Un tableau « rien perdu ».
7. **Écran par écran** — pour chaque écran / vue / drawer :
   - un wireframe ASCII ou une description spatiale (zones, ordre, proportions) ;
   - objectif ;
   - hiérarchie visuelle ;
   - contenu exact ;
   - actions ;
   - états (squelette, vide, erreur, hors-ligne, visiteur) ;
   - mobile (430) ;
   - desktop (1440) ;
   - thème clair et thème sombre ;
   - comportement clavier ;
   - copy FR exacte ;
   - analytics si existant.
8. **Données et API** — tables, colonnes, requêtes, index, RLS, routes API, types, cache, pagination, realtime, erreurs 401/403/404/409/500. Aucune requête inventée : tu cites les tables et colonnes réelles.
9. **Design tokens et CSS** — tokens utilisés, classes réutilisées, ce qui est extrait, ce qui est interdit, ce qui change dans `community-social.css`, comment éviter les collisions.
10. **Accessibilité** — checklist WCAG AA : focus, clavier, lecteur d'écran, `aria`, contrastes, 44 px, zoom 200 %, réduction de mouvement, états non visuels.
11. **Performance** — budgets chiffrés : LCP, INP, CLS, JS initial, poids des images. Tu pars des budgets du projet (`docs/performance/performance-budgets.json`) ; si la page n'en a pas, tu en proposes un et tu le justifies. Stratégie : code splitting, `next/image`, lazy, pagination, pas d'import massif, pas de re-render inutile. Mesures avant/après.
12. **Tests** — matrice unit / composant / intégration / e2e / visuel / a11y. Fichiers, cas, commandes, seuils. Les tests existants à ne pas casser. Les nouveaux tests à écrire.
13. **Plan par phases et tâches** — le cœur du plan. Chaque tâche :
    - titre ;
    - fichiers (Create / Modify / Delete / Test) ;
    - dépendances ;
    - étapes numérotées ;
    - test à écrire d'abord ;
    - commande de vérification ;
    - résultat attendu ;
    - commit.
14. **Risques, rollback, rollout** — tableau risque / probabilité / impact / mitigation ; plan de retour arrière ; feature flag si pertinent ; monitoring ; critères d'arrêt.
15. **Questions ouvertes et hypothèses** — max 10, avec pour chacune l'hypothèse par défaut que tu prends si je ne réponds pas.
16. **Definition of Done** — la checklist du §12, adaptée au projet.

### 10.3 Le format exact d'une tâche

Chaque tâche doit ressembler à ça, pas à un paragraphe vague :

```markdown
### Task 3 — Extraire le shell immersif partagé

**Files:**
- Create: `src/components/shell/ImmersiveShell.tsx`
- Modify: `src/components/compte/CompteLiquidGlassV8.tsx` (import uniquement)
- Test: `src/components/shell/__tests__/ImmersiveShell.test.tsx`

**Dépend de :** Task 2

**Steps:**
1. Écrire le test qui rend le shell avec deux sections et vérifie que la capsule est présente, que le contenu est scrollable et que le focus reste piégé.
2. Lancer le test : il doit échouer.
3. Créer `ImmersiveShell.tsx` en extrayant le markup et le CSS existants, sans changer une seule valeur.
4. Migrer `/compte` sur le nouveau composant.
5. Lancer `npx vitest run src/components/shell/__tests__/ImmersiveShell.test.tsx` → vert.
6. Lancer `npx playwright test tests/design/compte-drawer-v2.spec.ts` → vert.
7. Capturer `/compte` avant/après à 430 × 932 → identique.
8. Commit.

**Verification:**
- `npm run type-check` → 0 erreur.
- `npx vitest run ...` → 0 échec.
- Capture `/compte` → aucune différence visuelle.

**Commit:** `refactor(shell): extraire le shell immersif partagé`
```

### 10.4 Le niveau de preuve exigé

- Chaque affirmation sur l'existant cite un fichier et une ligne.
- Chaque commande citée existe dans `package.json` ou est une commande standard (`npx vitest`, `npx playwright`).
- Chaque composant cité existe réellement. Tu vérifies son chemin.
- Chaque table citée existe réellement dans les migrations. Tu vérifies.
- Aucun « TBD », « à définir », « selon besoin », « on verra ».
- Aucun « je pense que », « probablement », « il devrait y avoir ».
- Si tu ne sais pas, tu écris « inconnu — à vérifier en Task X » et tu mets la vérification dans la tâche.

### 10.5 Ce que tu m'envoies dans le chat

Pas le plan complet (il est dans le fichier). Un message court, structuré :

```markdown
## Plan prêt — rien n'a été codé

**Ce que je garde :** ...
**Ce que je change :** ...
**Réutilisation :** X composants tels quels · Y étendus · Z extraits · 0 dupliqués.
**Les 3 risques principaux :** ...
**Le plan :** `docs/superpowers/plans/...`
**Le spec :** `docs/superpowers/specs/...`
**Ce que j'ai besoin de valider :** ...
**Questions bloquantes :** 0 à 5 maximum.
```

Puis tu t'arrêtes.

### 10.6 STOP

À partir de maintenant, tu ne codes pas. Tu ne modifies aucun fichier de `src/`. Tu ne lances aucune migration. Tu ne déploies pas. Tu ne pousses pas.

Tu attends mon « go » explicite. « Ok », « continue », « go » comptent. « Ça a l'air bien » ne compte pas.

Si je demande des changements, tu mets à jour le spec et le plan, tu me renvoies le résumé, et tu t'arrêtes à nouveau.

### 10.7 Auto-contrôle du plan avant de me l'envoyer

Tu relis ton plan avec ces 11 cases. Si une case est fausse, tu corriges avant de m'écrire.

- [ ] Chaque affirmation sur l'existant a un `fichier:ligne`.
- [ ] Chaque composant cité existe (chemin vérifié).
- [ ] Chaque table et colonne citée existe (migration ou code vérifié).
- [ ] Chaque tâche a des fichiers, des étapes, un test, une commande et un commit.
- [ ] Chaque écran a ses états : squelette, vide, erreur, hors-ligne, visiteur.
- [ ] Chaque fonctionnalité du §5.2 apparaît dans le mapping « rien perdu ».
- [ ] La matrice de réutilisation couvre 100 % des besoins.
- [ ] Il reste 0 « TBD », 0 « à définir », 0 « probablement ».
- [ ] Chaque risque a une mitigation et un critère d'arrêt.
- [ ] Le spec et le plan ne se contredisent pas.
- [ ] Les chemins de fichiers et les dates sont exacts.

---

## 11. Phase 2 — L'implémentation (seulement après mon « go »)

Quand je dis « go », tu appliques le plan, dans l'ordre, sans sauter de tâche.

### 11.1 Branche et commits

- Avant de créer la branche : `git status`. S'il y a des modifications non commitées qui ne sont pas les tiennes, tu ne les stash pas, tu ne les écrases pas : tu me demandes.
- Branche : `chantier/communaute-design`.
- Un commit par tâche, message conventionnel en français : `feat(communaute): ...`, `refactor(shell): ...`, `test(communaute): ...`, `fix(communaute): ...`.
- Pas de commit fourre-tout. Pas de `--no-verify`. Pas de `git push` sans mon accord.

### 11.2 Ordre de travail

1. **Fondations** : extraction des composants partagés, sans changement visuel. Preuve : `/compte` identique.
2. **Données / API** : uniquement si nécessaire. Types, mappers, routes, tests. Aucune migration distante sans accord.
3. **Mobile** : le hub, les sections, les drawers, les états.
4. **Desktop** : adaptation responsive du même design, pas un deuxième cockpit.
5. **Sous-routes** : découverte, post, reels, publier, pro.
6. **Accessibilité** : clavier, lecteur d'écran, contrastes, mouvements.
7. **Performance** : bundle, images, LCP, CLS, INP.
8. **Tests** : compléter la matrice, e2e, visuel, a11y.
9. **Documentation** : mettre à jour le plan (cases cochées), le spec, les captures.

### 11.3 Discipline d'exécution

- TDD : le test d'abord pour la logique et les composants. Pour le visuel, la capture de référence d'abord.
- Après chaque tâche : `npm run type-check`, le test ciblé, la capture si l'UI change.
- Après chaque phase : `npm test`, `npm run build`, les e2e concernés.
- Si un test échoue : tu stops, tu diagnostiques avec `systematic-debugging`, tu corriges, tu reprouves. Tu ne passes pas à la suite.
- Si le scope grandit : tu stops, tu mets à jour le plan, tu me demandes. Tu ne « profites pas d'être là ».
- Tu peux utiliser des subagents pour les tâches indépendantes, mais **le design system, le shell partagé et la cohérence visuelle restent ton travail**. Tu ne délègues pas la cohérence.
- Avant de dire « fini » : `verification-before-completion`, `requesting-code-review`, captures, commandes, sorties.

### 11.4 Ce qui est interdit pendant l'implémentation

- Modifier `/compte` sans preuve de non-régression.
- Importer `CompteLiquidGlassV8.tsx` en entier dans la Communauté.
- Créer une couleur, une ombre, un rayon, une police, un token.
- Copier-coller un bloc de CSS ou un composant au lieu de l'extraire.
- Mettre un mock, un `placeholder` de données, un `TODO` visuel.
- Désactiver un test, un lint, un type-check.
- Utiliser `any` sans justification écrite.
- Ajouter une dépendance sans justification écrite.
- Déployer, pousser, migrer sans mon accord.
- Dire « c'est fait » sans commande ni capture.

---

## 12. Definition of Done

La refonte est terminée quand, et seulement quand :

- [ ] La page `/communaute` mobile ressemble à `/compte` : même fond, même capsule, même héro, mêmes lentilles, mêmes drawers, mêmes états.
- [ ] Le desktop est une adaptation du même design, pas un cockpit séparé.
- [ ] Toutes les fonctionnalités du §5.2 sont accessibles, testées, et aucune n'a disparu.
- [ ] Les URLs et deep links existants fonctionnent (`?tab=`, posts, commentaires).
- [ ] La matrice de réutilisation est appliquée : 0 duplication, 0 nouveau token.
- [ ] `/compte` est visuellement identique avant/après (captures).
- [ ] Les tests existants sont verts ; les nouveaux tests couvrent les parcours critiques.
- [ ] `npm run type-check` → 0 erreur.
- [ ] `npm run lint` → 0 erreur.
- [ ] `npm test` → 0 échec.
- [ ] `npm run build` → succès.
- [ ] Playwright : 0 erreur console, 0 warning d'hydratation, 0 requête en échec.
- [ ] A11y : axe 0 critique/sérieux, parcours clavier complet, 44 px, contrastes AA, `prefers-reduced-motion`.
- [ ] Performance : budgets respectés, mesures avant/après documentées.
- [ ] Captures mobile 360 / 390 / 430 et desktop 768 / 1024 / 1440, en clair et en sombre.
- [ ] Le plan est à jour, les cases sont cochées, les commits sont propres.
- [ ] Je peux ouvrir la page, cliquer partout, et ne rien casser.

---

## 13. Les 12 pièges qui me font perdre du temps

1. **Copier le CSS du Profil** au lieu de l'extraire → deux designs qui divergent.
2. **Importer `CompteLiquidGlassV8` en entier** → 4 544 lignes dans le bundle Communauté.
3. **Garder l'ancien cockpit desktop** à côté du nouveau mobile → deux produits.
4. **Perdre `?tab=`** et les liens profonds → les utilisateurs et les tests cassent.
5. **Mettre des mocks** pour « remplir » les états vides → mensonge produit.
6. **Inventer une 7e couleur / ombre / rayon** → le design se délite.
7. **Oublier les états** squelette, vide, erreur, hors-ligne, visiteur → page blanche.
8. **Oublier le clavier et le lecteur d'écran** → accessibilité en régression.
9. **Casser les tests des drawers** (la suite `src/components/compte/drawer/__tests__/`) → je perds confiance.
10. **Réécrire `CommunityPostCard` de zéro** au lieu d'extraire la présentation → logique métier perdue.
11. **Dire « c'est fini » sans preuve** → je dois tout revérifier.
12. **Élargir le scope** sans me demander → tu livres quelque chose que je n'ai pas validé.

---

## 14. La checklist « rien oublié »

Tu vérifies chaque point dans le plan. Si un point n'est pas applicable, tu écris pourquoi.

### Routes et navigation
- [ ] `/communaute` et ses 6 onglets.
- [ ] `/communaute/decouvrir`, `/communaute/post/[id]`, `/communaute/reels`, `/communaute/publier`, `/communaute/pro`.
- [ ] Deep links, `?tab=`, back/forward, scroll restoration.
- [ ] Navigation basse, retour, gestes, clavier.
- [ ] Redirections si une URL change.

### Données
- [ ] Tables réelles, colonnes réelles, types réels.
- [ ] RLS, permissions, comptes privés, blocages.
- [ ] Pagination, chargement progressif, erreurs partielles.
- [ ] Realtime si utilisé.
- [ ] Index si une requête est lente.
- [ ] Aucun mock.

### Contenus
- [ ] Fil, likes, favoris, commentaires, réponses, partage.
- [ ] Stories, viewer, vues, archives, proches amis.
- [ ] Carnets, clubs, groupes, sorties, entraide.
- [ ] Découverte, recherche, massifs.
- [ ] Reels, publication.
- [ ] Profils, demandes d'abonnement, modération.
- [ ] Notifications générées par les interactions (like, commentaire, follow) — ne pas casser le déclencheur existant.

### États
- [ ] Squelette.
- [ ] Vide avec CTA.
- [ ] Erreur avec réessayer.
- [ ] Hors-ligne.
- [ ] Visiteur non connecté.
- [ ] Compte privé.
- [ ] Chargement infini / fin de liste.
- [ ] Contenu supprimé / introuvable.

### Design
- [ ] Tokens uniquement.
- [ ] Capsules 48 / 30 px.
- [ ] Lentilles, `--i`, 420 ms.
- [ ] 14 px / 62 px.
- [ ] 44 px.
- [ ] Rayons, ombres, flous, liserés.
- [ ] Pas d'orange `#E4501C`.
- [ ] Pas de header dans les drawers.
- [ ] Carte contexte si pertinente.
- [ ] Cohérence avec `/compte`.

### Mouvement
- [ ] Transitions `transform` / `opacity`.
- [ ] 420 ms `cubic-bezier(.32,.72,0,1)`.
- [ ] `prefers-reduced-motion`.
- [ ] Pas de layout shift.
- [ ] Pas d'animation qui bloque l'entrée.

### Accessibilité
- [ ] Clavier complet.
- [ ] Focus visible.
- [ ] `aria-selected`, `aria-label`, `role="tab"`, `role="tabpanel"`.
- [ ] `inert` sur les panneaux inactifs.
- [ ] Contrastes AA.
- [ ] Zoom 200 %.
- [ ] Lecteur d'écran (VoiceOver au minimum).
- [ ] Pas d'information uniquement par la couleur.

### Performance
- [ ] Pas d'import massif.
- [ ] Code splitting.
- [ ] `next/image`, tailles, lazy, blur.
- [ ] Vidéos : poster, préload.
- [ ] LCP, INP, CLS mesurés.
- [ ] Bundle avant/après.
- [ ] Pas de re-render inutile.

### SEO et metadata
- [ ] `metadata` conservée.
- [ ] Canonical.
- [ ] JSON-LD.
- [ ] Open Graph.
- [ ] Titres et headings cohérents.
- [ ] Pages publiques indexables, pages privées non.

### Tests
- [ ] Unitaires.
- [ ] Composants.
- [ ] Intégration.
- [ ] E2E.
- [ ] Visuel.
- [ ] A11y.
- [ ] Tests existants verts.
- [ ] Captures de référence.

### Livraison
- [ ] Branche propre.
- [ ] Commits conventionnels.
- [ ] Plan à jour.
- [ ] Spec à jour.
- [ ] Captures avant/après.
- [ ] Rapport final avec preuves.
- [ ] Aucun déploiement sans accord.

---

## 15. Les questions que tu peux me poser

Tu as le droit de me poser **maximum 5 questions bloquantes**, en un seul message, avant de produire le plan. Pas 20. Pas une par tour.

Une question est bloquante si, sans sa réponse, tu risques de partir dans la mauvaise direction. Pour tout le reste, tu prends l'hypothèse par défaut, tu l'écris dans le plan, et tu avances.

Hypothèses par défaut :

1. « Ce design » = le Compte / Profil Liquid Glass v8 tel qu'il est sur mobile aujourd'hui.
2. Le lot 1, c'est le hub `/communaute` mobile + desktop. Les sous-routes sont lot 2.
3. Les 6 espaces actuels sont conservés et deviennent des lentilles / sections. Aucun n'est supprimé.
4. La barre de navigation basse reste.
5. Aucune nouvelle fonctionnalité produit.
6. Aucune migration distante sans validation.
7. Le français est la langue de l'interface.
8. Le desktop est une adaptation du design mobile, pas un cockpit séparé.

Si mes réponses contredisent ces hypothèses, ce sont mes réponses qui gagnent.

---

## 16. Ton premier message, mot pour mot

Quand tu as fini l'audit et écrit le plan, tu m'envoies exactement ce format :

```markdown
## Plan prêt — rien n'a été codé

**Ce que je garde :** [3–5 lignes]
**Ce que je change :** [3–5 lignes]
**Réutilisation :** X composants tels quels · Y étendus · Z extraits · 0 dupliqués.
**Les 3 risques principaux :** [3 lignes]
**Le plan :** `docs/superpowers/plans/2026-10-22-communaute-refonte.md`
**Le spec :** `docs/superpowers/specs/2026-10-22-communaute-refonte-design.md`
**Ce que j'ai besoin de valider :** [2–4 lignes]
**Questions bloquantes :** [0 à 5, ou « aucune »]

Je m'arrête ici. Dis-moi « go » et j'implémente dans l'ordre du plan.
```

Pas de code. Pas de fichier `src/` modifié. Pas de migration. Pas de déploiement. Pas de push.

---

## 17. Le rappel final

Je ne veux pas que tu me fasses un joli design à toi. Je veux que tu **étendes** le design qui existe déjà, que tu **réutilises** ce qui est déjà là, et que tu me le **prouves**.

Le design de référence gagne toujours.
La réutilisation à 100 % n'est pas une option.
Le plan vient avant le code.
Et « c'est fait » veut dire : commande exécutée, sortie affichée, capture montrée.

Maintenant, commence par l'audit. Pas par le code.
